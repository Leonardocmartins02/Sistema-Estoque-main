import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/app';
import { prisma } from '../src/shared/prisma';
import { resetDb } from './helpers/db';
import { createTestUser, loginAndGetToken } from './helpers/auth';

/**
 * Task 2 do implementation-plan.md: GET /:id/movements passa a aceitar
 * ADJUSTMENT (e INITIAL_STOCK, mesma lacuna) no filtro de tipo, e a devolver
 * o e-mail de quem fez a movimentação — quando existir.
 */
describe('GET /api/products/:id/movements — ADJUSTMENT no filtro e autor', () => {
  const app = createServer();
  let token: string;
  let userId: string;
  let userEmail: string;
  let productId: string;

  beforeAll(async () => {
    await resetDb();
    userEmail = 'autor-ajuste@example.com';
    const { user, password } = await createTestUser(userEmail, 'senha-forte-123');
    userId = user.id;
    token = await loginAndGetToken(app, user.email, password);

    const product = await prisma.product.create({
      data: { name: 'Caneta com Ajuste', sku: `MOV-ADJ-${Date.now()}`, minStock: 0 },
    });
    productId = product.id;

    await prisma.stockMovement.createMany({
      data: [
        { productId, type: 'IN', quantity: 10, previousQuantity: 0, newQuantity: 10, userId },
        {
          productId,
          type: 'ADJUSTMENT',
          quantity: 2,
          previousQuantity: 10,
          newQuantity: 8,
          note: 'Contagem física mensal',
          userId,
        },
        {
          productId,
          type: 'INITIAL_STOCK',
          quantity: 5,
          previousQuantity: 0,
          newQuantity: 5,
          userId,
        },
      ],
    });

    // Simula um registro legado sem userId (anterior à Fase 1 de auditoria).
    await prisma.stockMovement.create({
      data: { productId, type: 'ADJUSTMENT', quantity: 1, previousQuantity: 8, newQuantity: 7, note: 'Ajuste antigo' },
    });
  });

  const movements = (qs: string) =>
    request(app)
      .get(`/api/products/${productId}/movements?${qs}`)
      .set('Authorization', `Bearer ${token}`);

  it('filtra por type=ADJUSTMENT e devolve só movimentações de ajuste', async () => {
    const res = await movements('type=ADJUSTMENT');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.every((m: { type: string }) => m.type === 'ADJUSTMENT')).toBe(true);
  });

  it('filtra por type=INITIAL_STOCK', async () => {
    const res = await movements('type=INITIAL_STOCK');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].type).toBe('INITIAL_STOCK');
  });

  it('devolve o e-mail do autor quando userId está preenchido', async () => {
    const res = await movements('type=IN');

    expect(res.status).toBe(200);
    expect(res.body.items[0].userEmail).toBe(userEmail);
  });

  it('devolve userEmail nulo para movimentação sem userId, sem quebrar a resposta', async () => {
    const res = await movements('type=ADJUSTMENT');

    expect(res.status).toBe(200);
    const legacy = res.body.items.find((m: { note: string }) => m.note === 'Ajuste antigo');
    expect(legacy).toBeDefined();
    expect(legacy.userEmail).toBeNull();
  });
});

/**
 * `GET /api/products/:id/movements` parseava `page`/`pageSize`/`type`/`from`/
 * `to`/`q` na mão com `String()`/`Number()`, engolindo silenciosamente valores
 * inválidos. Agora tudo passa por Zod e vira 400 no handler de erro global.
 */
describe('GET /api/products/:id/movements — validação de query params', () => {
  const app = createServer();
  let token: string;
  let productId: string;

  beforeAll(async () => {
    await resetDb();
    const { user, password } = await createTestUser('movquery@example.com', 'senha-forte-123');
    token = await loginAndGetToken(app, user.email, password);

    const product = await prisma.product.create({
      data: { name: 'Grampeador', sku: 'GRA-900', minStock: 0 },
    });
    productId = product.id;

    await prisma.stockMovement.createMany({
      data: [
        {
          productId,
          type: 'IN',
          quantity: 10,
          date: new Date('2026-01-10T10:00:00Z'),
          note: 'Compra inicial',
        },
        {
          productId,
          type: 'OUT',
          quantity: 2,
          date: new Date('2026-02-10T10:00:00Z'),
          note: 'Saída setor A',
        },
        {
          productId,
          type: 'OUT',
          quantity: 3,
          date: new Date('2026-03-10T10:00:00Z'),
          note: 'Saída setor B',
        },
      ],
    });
  });

  const movements = (qs: string) =>
    request(app)
      .get(`/api/products/${productId}/movements?${qs}`)
      .set('Authorization', `Bearer ${token}`);

  it('mantém o contrato e os defaults de paginação', async () => {
    const res = await movements('');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 3, page: 1, pageSize: 20 });
    expect(res.body.items).toHaveLength(3);
  });

  it('filtra por tipo e por intervalo de datas', async () => {
    const res = await movements('type=OUT&from=2026-03-01&to=2026-03-31');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].quantity).toBe(3);
  });

  it('filtra por trecho da nota', async () => {
    const res = await movements('q=setor');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it.each([
    ['page=0', 'page abaixo do mínimo'],
    ['page=abc', 'page não numérico'],
    ['pageSize=0', 'pageSize abaixo do mínimo'],
    ['pageSize=101', 'pageSize acima do limite de 100'],
    ['type=TALVEZ', 'type fora do enum'],
    ['from=amanha', 'from não parseável'],
  ])('devolve 400 para query param inválido (%s)', async (qs) => {
    const res = await movements(qs);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Dados inválidos.');
  });
});
