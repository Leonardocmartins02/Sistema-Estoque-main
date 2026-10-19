import { env } from './shared/env';
import { logger } from './shared/logger';
import { prisma } from './shared/prisma';
import { processBatch } from './webhooks/dispatcher';
import { purgeFinishedDeliveries } from './webhooks/retention';

/**
 * Processo de entrega de webhooks — separado da API de propósito
 * (research.md, Questão 2): um destino lento não disputa o event loop com as
 * requisições do estoque, e o worker pode ser derrubado e reiniciado sem
 * perder nada (entregas reivindicadas voltam para a fila quando o prazo vence).
 *
 * Laço: processa lotes enquanto houver trabalho; sem trabalho, dorme
 * `WEBHOOK_POLL_INTERVAL_MS`. A retenção roda no máximo uma vez por hora.
 */
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

let running = true;
let wakeUp: (() => void) | null = null;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    wakeUp = () => {
      clearTimeout(timer);
      resolve();
    };
  });
}

async function main() {
  logger.info(
    { pollIntervalMs: env.WEBHOOK_POLL_INTERVAL_MS, batchSize: env.WEBHOOK_BATCH_SIZE, schedule: env.WEBHOOK_RETRY_SCHEDULE_SECONDS },
    'Worker de webhooks iniciado',
  );
  let lastPurge = 0;

  while (running) {
    try {
      if (Date.now() - lastPurge >= PURGE_INTERVAL_MS) {
        const purged = await purgeFinishedDeliveries();
        if (purged.deliveries + purged.events > 0) logger.info(purged, 'Retenção de webhooks aplicada');
        lastPurge = Date.now();
      }

      const { claimed } = await processBatch();
      if (claimed > 0) {
        logger.debug({ claimed }, 'Lote de webhooks processado');
        continue; // pode haver mais trabalho vencido: não dorme
      }
    } catch (err) {
      // Ex.: banco fora do ar. Não derruba o processo — tenta de novo no
      // próximo ciclo; nada se perde porque o estado está todo no banco.
      logger.error({ err }, 'Erro no ciclo do worker de webhooks');
    }
    if (running) await sleep(env.WEBHOOK_POLL_INTERVAL_MS);
  }

  await prisma.$disconnect();
  logger.info('Worker de webhooks encerrado');
}

function shutdown(signal: string) {
  // Termina o lote em andamento (o laço checa `running` entre lotes) e não
  // reivindica nenhum novo.
  logger.info(`Recebido ${signal}, encerrando o worker depois do lote atual...`);
  running = false;
  wakeUp?.();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

void main();
