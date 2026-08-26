import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/app';
import { prisma } from '../src/shared/prisma';
import { resetDb } from './helpers/db';
import { createTestUser, loginAndGetToken } from './helpers/auth';

/**
 * `GET /api/quick-out/history` carregava TODOS os movimentos OUT com
 * `include: { product: true }` e paginava em memória. Agora `where`/`orderBy`/
 * `skip`/`take`/`count` vão para o banco; a normalização de acentos da busca
 * continua em memória (ver comentário na rota) e os query params passaram a
 * ser validados com Zod.
 *
 * O contrato (`{ items, total, page, pageSize }`, item com `productName`/
 * `productSku`) não pode mudar.
 */
describe('GET /api/quick-out/history — paginação, busca e validação', () => {
  const app = createServer();
  let token: string;

  beforeAll(async () => {
    await resetDb();
    const { user, password } = await createTestUser('historico@example.com', 'senha-forte-123');
    token = await loginAndGetToken(app, user.email, password);

    const lapis = await prisma.product.create({
      data: { name: 'Lápis Grafite', sku: 'LAP-100', minStock: 0 },
    });
    const caneta = await prisma.product.create({
      data: { name: 'Caneta Azul', sku: 'CAN-200', minStock: 0 },
    });

    await prisma.stockMovement.createMany({
      data: [
        { productId: lapis.id, type: 'IN', quantity: 500, date: new Date('2026-01-01T10:00:00Z') },
        { productId: caneta.id, type: 'IN', quantity: 500, date: new Date('2026-01-01T10:00:00Z') },
        // Saídas: 3 do lápis, 2 da caneta (as entradas acima NÃO podem aparecer).
        {
          productId: lapis.id,
          type: 'OUT',
          quantity: 1,
          date: new Date('2026-02-01T10:00:00Z'),
          note: 'Baixa rápida - almoxarifado',
        },
        {
          productId: lapis.id,
          type: 'OUT',
          quantity: 2,
          date: new Date('2026-03-01T10:00:00Z'),
          note: 'Reposição da recepção',
        },
        {
          productId: lapis.id,
          type: 'OUT',
          quantity: 3,
          date: new Date('2026-04-01T10:00:00Z'),
          note: null,
        },
        {
          productId: caneta.id,
          type: 'OUT',
          quantity: 4,
          date: new Date('2026-05-01T10:00:00Z'),
          note: 'Uso interno',
        },
        {
          productId: caneta.id,
          type: 'OUT',
          quantity: 5,
          date: new Date('2026-06-01T10:00:00Z'),
          note: null,
        },
      ],
    });
  });

  const history = (qs: string) =>
    request(app).get(`/api/quick-out/history?${qs}`).set('Authorization', `Bearer ${token}`);

  it('lista apenas saídas, mais recentes primeiro, paginando no banco', async () => {
    const res = await history('page=1&pageSize=2');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 5, page: 1, pageSize: 2 });
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({
      productName: 'Caneta Azul',
      productSku: 'CAN-200',
      quantity: 5,
      note: null,
    });
    expect(res.body.items[1].quantity).toBe(4);
  });

  it('respeita a segunda página sem alterar o total', async () => {
    const res = await history('page=2&pageSize=2');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(res.body.items.map((m: { quantity: number }) => m.quantity)).toEqual([3, 2]);
  });

  it('filtra por intervalo de datas no banco', async () => {
    const res = await history('from=2026-03-01&to=2026-05-02&pageSize=100');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items.map((m: { quantity: number }) => m.quantity)).toEqual([4, 3, 2]);
  });

  it('busca por nome do produto é insensível a acentos', async () => {
    const res = await history('q=lapis&pageSize=100');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(
      res.body.items.every((m: { productName: string }) => m.productName === 'Lápis Grafite'),
    ).toBe(true);
  });

  it('busca também casa por SKU e por nota', async () => {
    const porSku = await history('q=CAN-200&pageSize=100');
    expect(porSku.body.total).toBe(2);

    const porNota = await history('q=reposicao&pageSize=100');
    expect(porNota.body.total).toBe(1);
    expect(porNota.body.items[0].note).toBe('Reposição da recepção');
  });

  it.each([
    ['page=0', 'page abaixo do mínimo'],
    ['pageSize=0', 'pageSize abaixo do mínimo'],
    ['pageSize=101', 'pageSize acima do limite de 100'],
    ['from=nao-e-data', 'from não parseável'],
    ['to=2026-13-45', 'to não parseável'],
  ])('devolve 400 para query param inválido (%s)', async (qs) => {
    const res = await history(qs);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Dados inválidos.');
  });
});
