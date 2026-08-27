import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/app';
import { prisma } from '../src/shared/prisma';
import { resetDb } from './helpers/db';
import { createTestUser, loginAndGetToken } from './helpers/auth';

/**
 * `GET /api/products/summary` — contagem por status derivado do saldo, para o
 * banner de alerta de estoque baixo do frontend. Não devolve os produtos, só
 * os totais: o objetivo é evitar que o front precise buscar a listagem
 * inteira (`pageSize=0`) só para saber "quantos estão baixos".
 */
describe('GET /api/products/summary — contagem por status', () => {
  const app = createServer();
  let token: string;

  beforeAll(async () => {
    await resetDb();
    const { user, password } = await createTestUser('summary@example.com', 'senha-forte-123');
    token = await loginAndGetToken(app, user.email, password);

    // OK: saldo 17 >= minStock 5
    const alpha = await prisma.product.create({
      data: { name: 'Alpha Widget', sku: 'ALP-001', minStock: 5 },
    });
    await prisma.stockMovement.createMany({
      data: [
        { productId: alpha.id, type: 'IN', quantity: 20 },
        { productId: alpha.id, type: 'OUT', quantity: 3 },
      ],
    });

    // ATTN: 0 < saldo 4 < minStock 10
    const bravo = await prisma.product.create({
      data: { name: 'Bravo Widget', sku: 'BRA-002', minStock: 10 },
    });
    await prisma.stockMovement.create({ data: { productId: bravo.id, type: 'IN', quantity: 4 } });

    // OUT: saldo 0 (entradas e saídas se cancelam)
    const charlie = await prisma.product.create({
      data: { name: 'Charlie Widget', sku: 'CHA-003', minStock: 2 },
    });
    await prisma.stockMovement.createMany({
      data: [
        { productId: charlie.id, type: 'IN', quantity: 5 },
        { productId: charlie.id, type: 'OUT', quantity: 5 },
      ],
    });

    // OUT: saldo 0 sem NENHUMA movimentação — não aparece no groupBy.
    await prisma.product.create({ data: { name: 'Delta Widget', sku: 'DEL-004', minStock: 0 } });
  });

  it('exige autenticação', async () => {
    const res = await request(app).get('/api/products/summary');
    expect(res.status).toBe(401);
  });

  it('conta produtos por status derivado do saldo', async () => {
    const res = await request(app)
      .get('/api/products/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: 1, attn: 1, out: 2 });
  });

  it('usa UMA agregação de saldo, não uma consulta por produto', async () => {
    let groupByCalls = 0;
    prisma.$use(async (params, next) => {
      if (params.model === 'StockMovement' && params.action === 'groupBy') {
        groupByCalls += 1;
      }
      return next(params);
    });

    const res = await request(app)
      .get('/api/products/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(groupByCalls).toBeLessThanOrEqual(1);
  });
});
