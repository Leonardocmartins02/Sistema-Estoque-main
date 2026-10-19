import { prisma } from '../../src/shared/prisma';

/** Limpa todas as tabelas de negócio do banco de teste, respeitando FKs. */
export async function resetDb() {
  await prisma.$transaction([
    prisma.webhookAttempt.deleteMany(),
    prisma.webhookDelivery.deleteMany(),
    prisma.webhookEvent.deleteMany(),
    prisma.webhookEndpoint.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.product.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
