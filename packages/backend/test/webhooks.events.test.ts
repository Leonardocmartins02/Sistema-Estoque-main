import type { WebhookPayload } from '@simplestock/shared';
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { createServer } from '../src/app';
import { prisma } from '../src/shared/prisma';

import { createTestUser, loginAndGetToken } from './helpers/auth';
import { resetDb } from './helpers/db';
import { createTestEndpoint, eventsForProduct } from './helpers/webhooks';

/**
 * Outbox transacional (PRD, Requisitos Funcionais 1–4): o evento e as
 * entregas nascem na MESMA transação da StockMovement — existem se e somente
 * se a movimentação foi confirmada. Testado pela borda HTTP (padrão de
 * stockService.test.ts), não chamando o serviço direto.
 */
describe('webhooks — eventos nascem na transação do estoque', () => {
  const app = createServer();
  let token: string;
  let userId: string;
  let seq = 0;

  async function productWithBalance(balance: number, minStock = 0) {
    seq += 1;
    const product = await prisma.product.create({
      data: { name: `Produto ${seq}`, sku: `WH-${seq}-${Date.now()}`, minStock },
    });
    if (balance > 0) {
      await prisma.stockMovement.create({
        data: { productId: product.id, type: 'IN', quantity: balance, previousQuantity: 0, newQuantity: balance },
      });
    }
    return product;
  }

  function move(productId: string, body: object) {
    return request(app).post(`/api/products/${productId}/movements`).set('Authorization', `Bearer ${token}`).send(body);
  }

  beforeAll(async () => {
    await resetDb();
    const { user, password } = await createTestUser('webhooks-eventos@example.com', 'senha-forte-123');
    userId = user.id;
    token = await loginAndGetToken(app, user.email, password);
  });

  beforeEach(async () => {
    await prisma.webhookEndpoint.deleteMany();
    await prisma.webhookEvent.deleteMany();
  });

  it('entrada gera stock.movement.created com fotografia do saldo e uma entrega pendente', async () => {
    const { endpoint } = await createTestEndpoint({ eventTypes: ['stock.movement.created'] });
    const product = await productWithBalance(10);

    const res = await move(product.id, { type: 'IN', quantity: 5, note: 'Compra NF 123' });
    expect(res.status).toBe(201);

    const events = await eventsForProduct(product.id);
    expect(events).toHaveLength(1);
    const payload = events[0].payload as WebhookPayload;
    expect(payload).toEqual({
      type: 'stock.movement.created',
      timestamp: expect.any(String),
      data: {
        movementId: res.body.id,
        product: { id: product.id, sku: product.sku, name: product.name },
        type: 'IN',
        quantity: 5,
        previousQuantity: 10,
        newQuantity: 15,
        movementDate: expect.any(String),
        note: 'Compra NF 123',
      },
    });
    expect(events[0].id.startsWith('evt_')).toBe(true);
    expect(events[0].deliveries).toHaveLength(1);
    expect(events[0].deliveries[0]).toMatchObject({ endpointId: endpoint.id, status: 'PENDING', attemptCount: 0 });
  });

  it('payload não carrega dado de usuário (id ou e-mail de quem movimentou)', async () => {
    await createTestEndpoint();
    const product = await productWithBalance(3);

    await move(product.id, { type: 'IN', quantity: 1 });

    const serialized = JSON.stringify((await eventsForProduct(product.id)).map((e) => e.payload));
    expect(serialized).not.toContain(userId);
    expect(serialized).not.toContain('webhooks-eventos@example.com');
  });

  it('movimentação retroativa: timestamp é o da gravação, movementDate é a data informada', async () => {
    await createTestEndpoint({ eventTypes: ['stock.movement.created'] });
    const product = await productWithBalance(0);
    const informed = '2026-01-15T10:00:00.000Z';

    const before = Date.now();
    await move(product.id, { type: 'IN', quantity: 2, date: informed });

    const [event] = await eventsForProduct(product.id);
    const payload = event.payload as Extract<WebhookPayload, { type: 'stock.movement.created' }>;
    expect(payload.data.movementDate).toBe(informed);
    expect(Date.parse(payload.timestamp)).toBeGreaterThanOrEqual(before - 1000);
    expect(event.occurredAt.toISOString()).toBe(payload.timestamp);
  });

  it('saída recusada por saldo insuficiente (422) não gera evento nem entrega', async () => {
    await createTestEndpoint();
    const product = await productWithBalance(2);

    const res = await move(product.id, { type: 'OUT', quantity: 5 });
    expect(res.status).toBe(422);

    expect(await eventsForProduct(product.id)).toHaveLength(0);
    expect(await prisma.webhookDelivery.count()).toBe(0);
  });

  it('ajuste recusado por conflito (409) não gera evento', async () => {
    await createTestEndpoint();
    const product = await productWithBalance(20);

    const res = await request(app)
      .post(`/api/products/${product.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 18, expectedPreviousQuantity: 15, reason: 'Inventário' });
    expect(res.status).toBe(409);

    expect(await eventsForProduct(product.id)).toHaveLength(0);
  });

  it('ajuste aceito gera evento com type ADJUSTMENT e o motivo em note', async () => {
    await createTestEndpoint({ eventTypes: ['stock.movement.created'] });
    const product = await productWithBalance(20);

    const res = await request(app)
      .post(`/api/products/${product.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 18, expectedPreviousQuantity: 20, reason: 'Inventário' });
    expect(res.status).toBe(201);

    const [event] = await eventsForProduct(product.id);
    expect((event.payload as WebhookPayload).data).toMatchObject({
      type: 'ADJUSTMENT',
      quantity: 2,
      previousQuantity: 20,
      newQuantity: 18,
      note: 'Inventário',
    });
  });

  it('baixa rápida também gera evento (passa pelo mesmo StockService)', async () => {
    await createTestEndpoint({ eventTypes: ['stock.movement.created'] });
    const product = await productWithBalance(4);

    const res = await request(app)
      .post('/api/quick-out')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, quantity: 1 });
    expect(res.status).toBe(200);

    const [event] = await eventsForProduct(product.id);
    expect((event.payload as WebhookPayload).data).toMatchObject({ type: 'OUT', previousQuantity: 4, newQuantity: 3 });
  });

  it('mudança de status OK → ATTN gera stock.status.changed; ATTN → ATTN não gera', async () => {
    const { endpoint } = await createTestEndpoint({ eventTypes: ['stock.status.changed'] });
    const product = await productWithBalance(12, 10);

    await move(product.id, { type: 'OUT', quantity: 5 });
    let events = await eventsForProduct(product.id);
    const statusEvents = events.filter((e) => e.type === 'stock.status.changed');
    expect(statusEvents).toHaveLength(1);
    expect(statusEvents[0].payload).toMatchObject({
      type: 'stock.status.changed',
      data: {
        product: { id: product.id, sku: product.sku, name: product.name, minStock: 10 },
        previousStatus: 'OK',
        newStatus: 'ATTN',
        previousQuantity: 12,
        newQuantity: 7,
      },
    });
    expect(statusEvents[0].deliveries.map((d) => d.endpointId)).toEqual([endpoint.id]);

    await move(product.id, { type: 'OUT', quantity: 1 });
    events = await eventsForProduct(product.id);
    expect(events.filter((e) => e.type === 'stock.status.changed')).toHaveLength(1);
  });

  it('OK → OUT direto gera um único stock.status.changed', async () => {
    await createTestEndpoint({ eventTypes: ['stock.status.changed'] });
    const product = await productWithBalance(12, 10);

    await move(product.id, { type: 'OUT', quantity: 12 });

    const statusEvents = (await eventsForProduct(product.id)).filter((e) => e.type === 'stock.status.changed');
    expect(statusEvents).toHaveLength(1);
    expect(statusEvents[0].payload).toMatchObject({ data: { previousStatus: 'OK', newStatus: 'OUT' } });
  });

  it('destino inscrito só em status não recebe entrega de movimentação que não muda status', async () => {
    await createTestEndpoint({ eventTypes: ['stock.status.changed'] });
    const product = await productWithBalance(30, 10);

    await move(product.id, { type: 'OUT', quantity: 1 });

    expect(await prisma.webhookDelivery.count()).toBe(0);
  });

  it('destino inscrito nos dois tipos recebe duas entregas quando o status muda', async () => {
    const { endpoint } = await createTestEndpoint();
    const product = await productWithBalance(10, 10);

    await move(product.id, { type: 'OUT', quantity: 1 });

    const deliveries = await prisma.webhookDelivery.findMany({ where: { endpointId: endpoint.id } });
    expect(deliveries).toHaveLength(2);
  });

  it('criação de produto com estoque inicial gera só stock.movement.created (sem mudança de status)', async () => {
    await createTestEndpoint();

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Grampeador', sku: `WH-INIT-${Date.now()}`, minStock: 5, initialStock: 8 });
    expect(res.status).toBe(201);

    const events = await eventsForProduct(res.body.id);
    expect(events.map((e) => e.type)).toEqual(['stock.movement.created']);
    expect((events[0].payload as WebhookPayload).data).toMatchObject({
      type: 'INITIAL_STOCK',
      previousQuantity: 0,
      newQuantity: 8,
    });
  });

  it('destino inativo não recebe entrega; sem nenhum inscrito, nenhum evento é gravado', async () => {
    await createTestEndpoint({ active: false });
    const product = await productWithBalance(5);

    await move(product.id, { type: 'IN', quantity: 1 });

    expect(await prisma.webhookDelivery.count()).toBe(0);
    expect(await eventsForProduct(product.id)).toHaveLength(0);
  });

  it('vários destinos inscritos: uma entrega por destino para o mesmo evento', async () => {
    const a = await createTestEndpoint({ eventTypes: ['stock.movement.created'] });
    const b = await createTestEndpoint({ eventTypes: ['stock.movement.created'] });
    const product = await productWithBalance(5);

    await move(product.id, { type: 'IN', quantity: 1 });

    const [event] = await eventsForProduct(product.id);
    expect(event.deliveries.map((d) => d.endpointId).sort()).toEqual([a.endpoint.id, b.endpoint.id].sort());
  });
});
