import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/app';
import { prisma } from '../src/shared/prisma';
import { resetDb } from './helpers/db';
import { createTestUser, loginAndGetToken } from './helpers/auth';

/**
 * Regressão do bug original: `movements.ts`/`quick-out.ts` faziam
 * ler-saldo -> decidir -> escrever fora de uma transação. Duas saídas (OUT)
 * concorrentes podiam ambas ler o mesmo saldo, ambas passar na checagem, e
 * o estoque final ficava negativo. A correção usa `prisma.$transaction` com
 * `SELECT ... FOR UPDATE` na linha do produto, serializando as duas
 * requisições no Postgres.
 */
describe('condição de corrida no saldo de estoque', () => {
  const app = createServer();
  let token: string;

  beforeAll(async () => {
    await resetDb();
    const { user, password } = await createTestUser('concorrencia@example.com', 'senha-forte-123');
    token = await loginAndGetToken(app, user.email, password);
  });

  it('POST /:id/movements: duas saídas concorrentes nunca deixam o saldo negativo', async () => {
    const product = await prisma.product.create({
      data: { name: 'Caneta Concorrência', sku: `CONC-MOV-${Date.now()}`, minStock: 0 },
    });
    await prisma.stockMovement.create({ data: { productId: product.id, type: 'IN', quantity: 10 } });

    const send = () =>
      request(app)
        .post(`/api/products/${product.id}/movements`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'OUT', quantity: 7 });

    const [resA, resB] = await Promise.all([send(), send()]);

    // Com saldo=10 e duas saídas de 7, só uma pode ser aceita (201); a outra
    // tem que ser rejeitada por saldo insuficiente (422) — nunca as duas 201.
    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 422]);

    const balance = await currentBalance(product.id);
    expect(balance).toBe(3);
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it('POST /quick-out: duas baixas rápidas concorrentes nunca deixam o saldo negativo', async () => {
    const product = await prisma.product.create({
      data: { name: 'Lápis Concorrência', sku: `CONC-QO-${Date.now()}`, minStock: 0 },
    });
    await prisma.stockMovement.create({ data: { productId: product.id, type: 'IN', quantity: 5 } });

    const send = () =>
      request(app)
        .post('/api/quick-out')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: product.id, quantity: 4 });

    const [resA, resB] = await Promise.all([send(), send()]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 422]);

    const balance = await currentBalance(product.id);
    expect(balance).toBe(1);
    expect(balance).toBeGreaterThanOrEqual(0);
  });
});

async function currentBalance(productId: string): Promise<number> {
  const agg = await prisma.stockMovement.groupBy({
    by: ['type'],
    where: { productId },
    _sum: { quantity: true },
  });
  const sumIn = agg.find((a) => a.type === 'IN')?._sum.quantity ?? 0;
  const sumOut = agg.find((a) => a.type === 'OUT')?._sum.quantity ?? 0;
  return sumIn - sumOut;
}
