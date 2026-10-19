import { Prisma, type WebhookDelivery, type WebhookEndpoint, type WebhookEvent } from '@prisma/client';

import { env } from '../shared/env';
import { logger } from '../shared/logger';
import { prisma } from '../shared/prisma';

import { createGuardedLookup } from './destinationGuard';
import { sendWebhook, type SendResult } from './httpSender';
import { decideNext } from './retryPolicy';
import { decryptWebhookSecret } from './secrets';
import { buildSignatureHeaders } from './signature';

const USER_AGENT = 'SimpleStock-Webhooks/1.0';
const AUTO_DISABLE_AFTER_MS = 5 * 24 * 3600_000;
/** Folga do prazo de reivindicação sobre o tempo limite da requisição (PRD, NFR 3). */
const LEASE_MARGIN_MS = 45_000;

type LookupFn = Parameters<typeof createGuardedLookup>[0]['lookup'];

export type ProcessBatchOptions = {
  now?: Date;
  random?: () => number;
  schedule?: number[];
  timeoutMs?: number;
  batchSize?: number;
  /** Só para testes: resolve DNS sem rede (ex.: simular rebinding). */
  lookup?: LookupFn;
};

type ClaimedDelivery = WebhookDelivery & { endpoint: WebhookEndpoint; event: WebhookEvent };

/**
 * Data para SQL cru comparável com as colunas do Prisma. O Prisma grava
 * `DateTime` como `timestamp` SEM fuso, em UTC; num `$queryRaw`, um `Date`
 * vira `timestamptz` e a comparação converte a coluna pelo fuso da SESSÃO —
 * num banco fora de UTC (o Postgres local roda em America/Sao_Paulo) a
 * reivindicação ficaria 3 h deslocada. Texto ISO convertido para `timestamp`
 * descarta o sufixo `Z` e compara relógio UTC com relógio UTC.
 */
function utc(date: Date) {
  return Prisma.sql`(${date.toISOString()})::timestamp`;
}

/**
 * Reivindica um lote numa ÚNICA instrução SQL, curta, sem chamada HTTP no
 * meio: as linhas viram SENDING com um prazo (`lockedUntil`) e a transação
 * termina. `FOR UPDATE SKIP LOCKED` faz dois workers simultâneos pegarem
 * lotes disjuntos em vez de esperar um pelo outro ou pegar a mesma linha.
 *
 * Elegíveis: PENDING vencidas, e SENDING com prazo vencido — essa segunda
 * condição é a recuperação de um worker que morreu no meio de um envio.
 */
async function claimBatch(now: Date, leaseUntil: Date, batchSize: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "WebhookDelivery"
    SET "status" = 'SENDING', "lockedUntil" = ${utc(leaseUntil)}, "updatedAt" = ${utc(now)}
    WHERE "id" IN (
      SELECT "id" FROM "WebhookDelivery"
      WHERE ("status" = 'PENDING' AND "nextAttemptAt" <= ${utc(now)})
         OR ("status" = 'SENDING' AND "lockedUntil" < ${utc(now)})
      ORDER BY "nextAttemptAt"
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"
  `;
  return rows.map((row) => row.id);
}

/** Desativa o destino e cancela o que ainda estava na fila para ele. */
async function disableEndpoint(tx: Prisma.TransactionClient, endpointId: string, reason: string, now: Date) {
  await tx.webhookEndpoint.update({ where: { id: endpointId }, data: { active: false, disabledReason: reason } });
  await tx.webhookDelivery.updateMany({
    where: { endpointId, status: 'PENDING' },
    data: { status: 'CANCELLED', finishedAt: now, lockedUntil: null },
  });
}

async function recordResult(delivery: ClaimedDelivery, result: SendResult, options: Required<Omit<ProcessBatchOptions, 'lookup'>>) {
  const { now } = options;
  const attemptsDone = delivery.attemptCount + 1;
  const decision = decideNext({
    outcome: result.outcome,
    attemptsDone,
    schedule: options.schedule,
    now,
    random: options.random,
  });

  await prisma.$transaction(async (tx) => {
    await tx.webhookAttempt.create({
      data: {
        deliveryId: delivery.id,
        startedAt: now,
        durationMs: result.durationMs,
        responseStatus: result.responseStatus,
        errorCode: result.errorCode,
        responseSnippet: result.responseSnippet,
      },
    });

    if (decision.action === 'delivered') {
      await tx.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'DELIVERED', attemptCount: attemptsDone, deliveredAt: now, finishedAt: now, lockedUntil: null },
      });
      await tx.webhookEndpoint.updateMany({
        where: { id: delivery.endpointId, failingSince: { not: null } },
        data: { failingSince: null },
      });
      return;
    }

    // Primeira falha depois de um sucesso inicia a contagem de "falhando desde".
    const failingSince = delivery.endpoint.failingSince ?? now;
    if (!delivery.endpoint.failingSince) {
      await tx.webhookEndpoint.update({ where: { id: delivery.endpointId }, data: { failingSince } });
    }

    if (decision.action === 'retry') {
      await tx.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'PENDING', attemptCount: attemptsDone, nextAttemptAt: decision.nextAttemptAt, lockedUntil: null },
      });
      return;
    }

    await tx.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: 'FAILED', attemptCount: attemptsDone, finishedAt: now, lockedUntil: null },
    });

    const reason =
      decision.disableEndpointReason ??
      (now.getTime() - failingSince.getTime() >= AUTO_DISABLE_AFTER_MS
        ? `Desativado automaticamente: falhando desde ${failingSince.toISOString()}.`
        : null);
    if (reason) {
      await disableEndpoint(tx, delivery.endpointId, reason, now);
      logger.warn({ endpointId: delivery.endpointId, reason }, 'Destino de webhook desativado automaticamente');
    }
  });
}

async function processOne(delivery: ClaimedDelivery, options: Required<Omit<ProcessBatchOptions, 'lookup'>>, lookup: ReturnType<typeof createGuardedLookup>) {
  // Destino desativado depois que a entrega entrou na fila: cancela em vez
  // de enviar ("destino inativo não recebe nada").
  if (!delivery.endpoint.active) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: 'CANCELLED', finishedAt: options.now, lockedUntil: null },
    });
    return;
  }

  // O corpo é serializado a partir do JSON guardado e assinado exatamente
  // como vai no fio — a assinatura é refeita a cada tentativa (timestamp
  // novo), sempre sobre os mesmos bytes que o receptor recebe.
  const body = JSON.stringify(delivery.event.payload);
  const secret = decryptWebhookSecret(delivery.endpoint.secretCiphertext);
  const headers = {
    // Relógio REAL, não o `now` de agendamento: o receptor compara este
    // timestamp com o relógio dele para recusar requisição antiga repetida.
    ...buildSignatureHeaders({ eventId: delivery.eventId, body, secret, sentAt: new Date() }),
    'content-type': 'application/json',
    'user-agent': USER_AGENT,
  };

  const result = await sendWebhook({
    url: delivery.endpoint.url,
    headers,
    body,
    timeoutMs: options.timeoutMs,
    lookup,
    now: options.now,
  });
  await recordResult(delivery, result, options);
}

/**
 * Um ciclo do worker: reivindica até `batchSize` entregas vencidas, envia em
 * paralelo e registra cada resultado. Relógio, aleatoriedade e cronograma
 * são injetáveis para os testes não dependerem de timers reais.
 */
export async function processBatch(input: ProcessBatchOptions = {}): Promise<{ claimed: number }> {
  const options = {
    now: input.now ?? new Date(),
    random: input.random ?? Math.random,
    schedule: input.schedule ?? env.WEBHOOK_RETRY_SCHEDULE_SECONDS,
    timeoutMs: input.timeoutMs ?? env.WEBHOOK_REQUEST_TIMEOUT_MS,
    batchSize: input.batchSize ?? env.WEBHOOK_BATCH_SIZE,
  };
  const lookup = createGuardedLookup({ allowLoopback: env.NODE_ENV !== 'production', lookup: input.lookup });

  const leaseUntil = new Date(options.now.getTime() + options.timeoutMs + LEASE_MARGIN_MS);
  const ids = await claimBatch(options.now, leaseUntil, options.batchSize);
  if (ids.length === 0) return { claimed: 0 };

  const deliveries = await prisma.webhookDelivery.findMany({
    where: { id: { in: ids } },
    include: { endpoint: true, event: true },
  });

  await Promise.all(
    deliveries.map((delivery) =>
      processOne(delivery, options, lookup).catch((err: unknown) => {
        // Erro inesperado (ex.: segredo que não decifra por troca de chave):
        // a entrega fica SENDING e volta a ser elegível quando o prazo vencer.
        logger.error({ err, deliveryId: delivery.id }, 'Falha inesperada ao processar entrega de webhook');
      }),
    ),
  );

  return { claimed: ids.length };
}
