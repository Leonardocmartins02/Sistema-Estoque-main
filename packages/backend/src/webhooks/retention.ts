import { prisma } from '../shared/prisma';

const RETENTION_DAYS = 30;

/**
 * Retenção (research.md, Questão 6): entregas finalizadas (entregue, falhou,
 * cancelada) há mais de 30 dias saem junto com suas tentativas (cascata), e
 * eventos que ficaram sem nenhuma entrega — por esta limpeza ou pela
 * exclusão de um destino — saem em seguida. Pendentes nunca são apagadas.
 *
 * Um evento novo nunca é visto sem entregas: ele e as entregas nascem no
 * mesmo `create` aninhado (events.ts).
 */
export async function purgeFinishedDeliveries({ now = new Date() }: { now?: Date } = {}) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 3600_000);

  const deliveries = await prisma.webhookDelivery.deleteMany({
    where: { status: { in: ['DELIVERED', 'FAILED', 'CANCELLED'] }, finishedAt: { lt: cutoff } },
  });
  const events = await prisma.webhookEvent.deleteMany({ where: { deliveries: { none: {} } } });

  return { deliveries: deliveries.count, events: events.count };
}
