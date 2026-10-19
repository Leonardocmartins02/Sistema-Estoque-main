import type { LookupAddress } from 'node:dns';

import type { WebhookPayload } from '@simplestock/shared';
import { Webhook } from 'standardwebhooks';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { prisma } from '../src/shared/prisma';
import { processBatch, type ProcessBatchOptions } from '../src/webhooks/dispatcher';
import { purgeFinishedDeliveries } from '../src/webhooks/retention';

import { resetDb } from './helpers/db';
import { startReceiver } from './helpers/receiver';
import { createTestEndpoint } from './helpers/webhooks';

/**
 * Worker de entrega (PRD, Requisitos Funcionais 11–17, 22 e critérios de
 * aceite). `processBatch` é chamado direto, com relógio e aleatoriedade
 * injetados — nenhum teste espera um timer real do cronograma.
 */
describe('worker de webhooks — processBatch', () => {
  let receiver: Awaited<ReturnType<typeof startReceiver>>;
  let clock: Date;
  let seq = 0;

  const SHORT_SCHEDULE = [0, 10, 20];
  const options = (extra: Partial<ProcessBatchOptions> = {}): ProcessBatchOptions => ({
    now: clock,
    random: () => 0.5, // jitter neutro (fator 1,0)
    schedule: SHORT_SCHEDULE,
    timeoutMs: 2000,
    batchSize: 10,
    ...extra,
  });

  const advance = (seconds: number) => {
    clock = new Date(clock.getTime() + seconds * 1000);
  };

  async function enqueue(endpointId: string, overrides: { status?: 'PENDING' | 'SENDING'; lockedUntil?: Date } = {}) {
    seq += 1;
    const payload: WebhookPayload = {
      type: 'webhook.test',
      timestamp: clock.toISOString(),
      data: { endpointId, message: `mensagem ${seq}` },
    };
    const event = await prisma.webhookEvent.create({
      data: { id: `evt_disp_${seq}_${Date.now()}`, type: payload.type, payload, occurredAt: clock },
    });
    return prisma.webhookDelivery.create({
      data: { eventId: event.id, endpointId, nextAttemptAt: clock, ...overrides },
    });
  }

  const reload = (id: string) =>
    prisma.webhookDelivery.findUniqueOrThrow({ where: { id }, include: { attempts: { orderBy: { startedAt: 'asc' } } } });

  beforeEach(async () => {
    await resetDb();
    clock = new Date('2026-10-19T12:00:00.000Z');
    receiver = await startReceiver();
  });

  afterEach(async () => {
    await receiver.close();
  });

  it('entrega assinada, verificável pela implementação de referência, e marca como entregue', async () => {
    const { endpoint, secret } = await createTestEndpoint({ url: receiver.url });
    const delivery = await enqueue(endpoint.id);

    const result = await processBatch(options());

    expect(result.claimed).toBe(1);
    expect(receiver.requests).toHaveLength(1);
    const [req] = receiver.requests;
    expect(req.method).toBe('POST');
    expect(req.headers['content-type']).toBe('application/json');
    expect(req.headers['user-agent']).toMatch(/^SimpleStock-Webhooks\//);
    expect(req.headers['webhook-id']).toBe(delivery.eventId);
    expect(
      new Webhook(secret).verify(req.body, {
        'webhook-id': String(req.headers['webhook-id']),
        'webhook-timestamp': String(req.headers['webhook-timestamp']),
        'webhook-signature': String(req.headers['webhook-signature']),
      }),
    ).toMatchObject({ type: 'webhook.test', data: { endpointId: endpoint.id } });

    const after = await reload(delivery.id);
    expect(after).toMatchObject({ status: 'DELIVERED', attemptCount: 1, lockedUntil: null });
    expect(after.deliveredAt).not.toBeNull();
    expect(after.finishedAt).not.toBeNull();
    expect(after.attempts).toHaveLength(1);
    expect(after.attempts[0]).toMatchObject({ responseStatus: 200, errorCode: null, responseSnippet: 'ok' });
  });

  it('500 e depois 200: retenta no horário agendado com o MESMO webhook-id', async () => {
    const { endpoint } = await createTestEndpoint({ url: receiver.url });
    const delivery = await enqueue(endpoint.id);

    receiver.respondWith((_req, res) => res.writeHead(500).end('falhou'));
    await processBatch(options());

    let after = await reload(delivery.id);
    expect(after).toMatchObject({ status: 'PENDING', attemptCount: 1 });
    expect(after.nextAttemptAt.getTime()).toBe(clock.getTime() + 10_000);
    expect(after.attempts[0]).toMatchObject({ responseStatus: 500, errorCode: 'HTTP_ERROR', responseSnippet: 'falhou' });

    // Antes do horário: nada é reivindicado.
    advance(9);
    expect((await processBatch(options())).claimed).toBe(0);

    receiver.respondWith((_req, res) => res.writeHead(200).end());
    advance(1);
    await processBatch(options());

    after = await reload(delivery.id);
    expect(after).toMatchObject({ status: 'DELIVERED', attemptCount: 2 });
    expect(receiver.requests.map((r) => r.headers['webhook-id'])).toEqual([delivery.eventId, delivery.eventId]);
  });

  it('esgotadas as tentativas, falha definitivamente e marca o destino como "falhando desde"', async () => {
    const { endpoint } = await createTestEndpoint({ url: receiver.url });
    const delivery = await enqueue(endpoint.id);
    receiver.respondWith((_req, res) => res.writeHead(502).end());

    await processBatch(options());
    const firstFailureAt = clock;
    advance(10);
    await processBatch(options());
    advance(20);
    await processBatch(options());

    const after = await reload(delivery.id);
    expect(after).toMatchObject({ status: 'FAILED', attemptCount: 3 });
    expect(after.finishedAt).not.toBeNull();
    expect(after.attempts).toHaveLength(3);

    const stored = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id: endpoint.id } });
    expect(stored.failingSince?.toISOString()).toBe(firstFailureAt.toISOString());
    expect(stored.active).toBe(true); // falhando há 30 s, longe dos 5 dias
  });

  it('410 Gone: falha na hora, sem novas tentativas, e desativa o destino com o motivo', async () => {
    const { endpoint } = await createTestEndpoint({ url: receiver.url });
    const delivery = await enqueue(endpoint.id);
    receiver.respondWith((_req, res) => res.writeHead(410).end());

    await processBatch(options());

    expect(await reload(delivery.id)).toMatchObject({ status: 'FAILED', attemptCount: 1 });
    const stored = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id: endpoint.id } });
    expect(stored.active).toBe(false);
    expect(stored.disabledReason).toMatch(/410/);
  });

  it('desativação por 410 cancela entregas pendentes do destino que já estavam na fila', async () => {
    const { endpoint } = await createTestEndpoint({ url: receiver.url });
    const first = await enqueue(endpoint.id);
    const queued = await prisma.webhookDelivery.update({
      where: { id: (await enqueue(endpoint.id)).id },
      data: { nextAttemptAt: new Date(clock.getTime() + 60_000) },
    });
    receiver.respondWith((_req, res) => res.writeHead(410).end());

    await processBatch(options());

    expect(await reload(first.id)).toMatchObject({ status: 'FAILED' });
    expect(await reload(queued.id)).toMatchObject({ status: 'CANCELLED' });
  });

  it('503 com Retry-After maior que o cronograma: respeita o Retry-After', async () => {
    const { endpoint } = await createTestEndpoint({ url: receiver.url });
    const delivery = await enqueue(endpoint.id);
    receiver.respondWith((_req, res) => res.writeHead(503, { 'Retry-After': '120' }).end());

    await processBatch(options());

    const after = await reload(delivery.id);
    expect(after.nextAttemptAt.getTime()).toBe(clock.getTime() + 120_000);
  });

  it('destino que não responde dentro do tempo limite: falha com TIMEOUT', async () => {
    const { endpoint } = await createTestEndpoint({ url: receiver.url });
    const delivery = await enqueue(endpoint.id);
    receiver.respondWith((_req, res) => setTimeout(() => res.writeHead(200).end(), 1500));

    await processBatch(options({ timeoutMs: 200 }));

    const after = await reload(delivery.id);
    expect(after).toMatchObject({ status: 'PENDING', attemptCount: 1 });
    expect(after.attempts[0]).toMatchObject({ errorCode: 'TIMEOUT', responseStatus: null });
    expect(after.attempts[0].durationMs).toBeLessThan(1500);
  });

  it('redirecionamento é falha e não é seguido', async () => {
    const { endpoint } = await createTestEndpoint({ url: receiver.url });
    const delivery = await enqueue(endpoint.id);
    receiver.respondWith((req, res) => {
      if (req.url === '/webhook') res.writeHead(302, { Location: `${receiver.origin}/outro` }).end();
      else res.writeHead(200).end();
    });

    await processBatch(options());

    const after = await reload(delivery.id);
    expect(after.attempts[0]).toMatchObject({ errorCode: 'REDIRECT', responseStatus: 302 });
    expect(receiver.requests.map((r) => r.url)).toEqual(['/webhook']);
  });

  it('guarda só um trecho de até 1 KB da resposta', async () => {
    const { endpoint } = await createTestEndpoint({ url: receiver.url });
    const delivery = await enqueue(endpoint.id);
    receiver.respondWith((_req, res) => res.writeHead(500).end('x'.repeat(50_000)));

    await processBatch(options());

    const after = await reload(delivery.id);
    expect(after.attempts[0].responseSnippet!.length).toBeLessThanOrEqual(1024);
  });

  it('destino que passa a resolver para IP interno: bloqueia sem conectar (DNS rebinding)', async () => {
    const { endpoint } = await createTestEndpoint({ url: 'http://destino.exemplo.test/webhook' });
    const delivery = await enqueue(endpoint.id);
    const rebinding = (
      _hostname: string,
      _options: object,
      callback: (err: null, addresses: LookupAddress[]) => void,
    ) => callback(null, [{ address: '10.0.0.5', family: 4 }]);

    await processBatch(options({ lookup: rebinding }));

    const after = await reload(delivery.id);
    expect(after).toMatchObject({ status: 'PENDING', attemptCount: 1 });
    expect(after.attempts[0]).toMatchObject({ errorCode: 'BLOCKED_DESTINATION', responseStatus: null });
  });

  it('entrega reivindicada por um worker que morreu é retomada depois do prazo — e só depois', async () => {
    const { endpoint } = await createTestEndpoint({ url: receiver.url });
    const stuck = await enqueue(endpoint.id, {
      status: 'SENDING',
      lockedUntil: new Date(clock.getTime() + 30_000),
    });

    expect((await processBatch(options())).claimed).toBe(0); // prazo ainda vale

    advance(31);
    await processBatch(options());

    expect(await reload(stuck.id)).toMatchObject({ status: 'DELIVERED', attemptCount: 1 });
    expect(receiver.requests).toHaveLength(1);
  });

  it('dois workers ao mesmo tempo: cada entrega é enviada exatamente uma vez', async () => {
    const { endpoint } = await createTestEndpoint({ url: receiver.url });
    for (let i = 0; i < 20; i += 1) await enqueue(endpoint.id);

    const worker = async () => {
      let total = 0;
      for (;;) {
        const { claimed } = await processBatch(options({ batchSize: 3 }));
        if (claimed === 0) return total;
        total += claimed;
      }
    };
    const [a, b] = await Promise.all([worker(), worker()]);

    expect(a + b).toBe(20);
    expect(receiver.requests).toHaveLength(20);
    expect(new Set(receiver.requests.map((r) => r.headers['webhook-id'])).size).toBe(20);
    expect(await prisma.webhookDelivery.count({ where: { status: 'DELIVERED' } })).toBe(20);
  });

  it('entrega de destino desativado é cancelada em vez de enviada', async () => {
    const { endpoint } = await createTestEndpoint({ url: receiver.url, active: false });
    const delivery = await enqueue(endpoint.id);

    await processBatch(options());

    expect(await reload(delivery.id)).toMatchObject({ status: 'CANCELLED', attemptCount: 0 });
    expect(receiver.requests).toHaveLength(0);
  });

  it('falhando há 5 dias ou mais: a falha definitiva desativa o destino com o motivo', async () => {
    const { endpoint } = await createTestEndpoint({ url: receiver.url });
    await prisma.webhookEndpoint.update({
      where: { id: endpoint.id },
      data: { failingSince: new Date(clock.getTime() - 6 * 24 * 3600_000) },
    });
    const delivery = await enqueue(endpoint.id);
    receiver.respondWith((_req, res) => res.writeHead(500).end());

    await processBatch(options({ schedule: [0] }));

    expect(await reload(delivery.id)).toMatchObject({ status: 'FAILED' });
    const stored = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id: endpoint.id } });
    expect(stored.active).toBe(false);
    expect(stored.disabledReason).toMatch(/falhando desde/);
  });

  it('falhando há menos de 5 dias: a falha definitiva NÃO desativa', async () => {
    const { endpoint } = await createTestEndpoint({ url: receiver.url });
    await prisma.webhookEndpoint.update({
      where: { id: endpoint.id },
      data: { failingSince: new Date(clock.getTime() - 4 * 24 * 3600_000) },
    });
    await enqueue(endpoint.id);
    receiver.respondWith((_req, res) => res.writeHead(500).end());

    await processBatch(options({ schedule: [0] }));

    expect((await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id: endpoint.id } })).active).toBe(true);
  });

  it('um sucesso limpa o "falhando desde"', async () => {
    const { endpoint } = await createTestEndpoint({ url: receiver.url });
    await prisma.webhookEndpoint.update({ where: { id: endpoint.id }, data: { failingSince: new Date(0) } });
    await enqueue(endpoint.id);

    await processBatch(options());

    expect((await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id: endpoint.id } })).failingSince).toBeNull();
  });
});

describe('retenção — purgeFinishedDeliveries', () => {
  const now = new Date('2026-10-19T12:00:00.000Z');
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 3600_000);

  beforeEach(async () => {
    await resetDb();
  });

  it('apaga entregas finalizadas há mais de 30 dias (com tentativas) e eventos que ficaram sem entrega', async () => {
    const { endpoint } = await createTestEndpoint();
    const make = async (id: string, data: object) => {
      await prisma.webhookEvent.create({ data: { id, type: 'webhook.test', payload: {}, occurredAt: daysAgo(40) } });
      return prisma.webhookDelivery.create({ data: { eventId: id, endpointId: endpoint.id, ...data } });
    };

    const old = await make('evt_old', {
      status: 'DELIVERED',
      finishedAt: daysAgo(31),
      attempts: { create: { startedAt: daysAgo(31), durationMs: 5, responseStatus: 200 } },
    });
    const oldFailed = await make('evt_old_failed', { status: 'FAILED', finishedAt: daysAgo(45) });
    const recent = await make('evt_recent', { status: 'DELIVERED', finishedAt: daysAgo(29) });
    const pending = await make('evt_pending', { status: 'PENDING', createdAt: daysAgo(40) });

    const result = await purgeFinishedDeliveries({ now });

    expect(result).toEqual({ deliveries: 2, events: 2 });
    const remaining = (await prisma.webhookDelivery.findMany()).map((d) => d.id).sort();
    expect(remaining).toEqual([recent.id, pending.id].sort());
    expect(await prisma.webhookAttempt.count({ where: { deliveryId: old.id } })).toBe(0);
    expect(await prisma.webhookEvent.findUnique({ where: { id: 'evt_old' } })).toBeNull();
    expect(await prisma.webhookEvent.findUnique({ where: { id: oldFailed.eventId } })).toBeNull();
    expect(await prisma.webhookEvent.findUnique({ where: { id: 'evt_recent' } })).not.toBeNull();
  });

  it('apaga eventos órfãos deixados pela exclusão de um destino', async () => {
    await prisma.webhookEvent.create({ data: { id: 'evt_orfao', type: 'webhook.test', payload: {}, occurredAt: now } });

    const result = await purgeFinishedDeliveries({ now });

    expect(result.events).toBe(1);
  });
});
