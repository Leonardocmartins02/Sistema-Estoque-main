import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/app';
import { prisma } from '../src/shared/prisma';
import { resetDb } from './helpers/db';
import { createTestUser, loginAndGetToken } from './helpers/auth';

/**
 * Fase 1 do plano de estoque auditável: toda movimentação passa a gravar
 * previousQuantity/newQuantity/userId através de um serviço central
 * (StockService), em vez de cada rota calcular saldo e escrever na mão.
 */
describe('estoque auditável (previousQuantity/newQuantity/userId)', () => {
  const app = createServer();
  let token: string;
  let userId: string;

  beforeAll(async () => {
    await resetDb();
    const { user, password } = await createTestUser('auditoria@example.com', 'senha-forte-123');
    userId = user.id;
    token = await loginAndGetToken(app, user.email, password);
  });

  it('IN grava previousQuantity/newQuantity corretos e associa o userId autenticado', async () => {
    const product = await prisma.product.create({
      data: { name: 'Papel A4', sku: `AUD-IN-${Date.now()}`, minStock: 0 },
    });
    await prisma.stockMovement.create({
      data: { productId: product.id, type: 'IN', quantity: 10, previousQuantity: 0, newQuantity: 10, userId },
    });

    const res = await request(app)
      .post(`/api/products/${product.id}/movements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'IN', quantity: 5 });

    expect(res.status).toBe(201);
    expect(res.body.previousQuantity).toBe(10);
    expect(res.body.newQuantity).toBe(15);
    expect(res.body.userId).toBe(userId);

    const persisted = await prisma.stockMovement.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(persisted.previousQuantity).toBe(10);
    expect(persisted.newQuantity).toBe(15);
    expect(persisted.userId).toBe(userId);
  });

  it('OUT válido decrementa corretamente e grava saldo anterior/posterior', async () => {
    const product = await prisma.product.create({
      data: { name: 'Caneta Azul', sku: `AUD-OUT-${Date.now()}`, minStock: 0 },
    });
    await prisma.stockMovement.create({
      data: { productId: product.id, type: 'IN', quantity: 20, previousQuantity: 0, newQuantity: 20, userId },
    });

    const res = await request(app)
      .post(`/api/products/${product.id}/movements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'OUT', quantity: 8 });

    expect(res.status).toBe(201);
    expect(res.body.previousQuantity).toBe(20);
    expect(res.body.newQuantity).toBe(12);
  });

  it('OUT com quantidade maior que o saldo retorna 422 e não cria movimentação', async () => {
    const product = await prisma.product.create({
      data: { name: 'Borracha Branca', sku: `AUD-REJ-${Date.now()}`, minStock: 0 },
    });
    await prisma.stockMovement.create({
      data: { productId: product.id, type: 'IN', quantity: 3, previousQuantity: 0, newQuantity: 3, userId },
    });

    const countBefore = await prisma.stockMovement.count({ where: { productId: product.id } });

    const res = await request(app)
      .post(`/api/products/${product.id}/movements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'OUT', quantity: 5 });

    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Saída maior que o saldo atual do produto.');

    const countAfter = await prisma.stockMovement.count({ where: { productId: product.id } });
    expect(countAfter).toBe(countBefore);
  });

  it('quick-out grava previousQuantity/newQuantity e newBalance na resposta bate com newQuantity', async () => {
    const product = await prisma.product.create({
      data: { name: 'Grampeador', sku: `AUD-QO-${Date.now()}`, minStock: 0 },
    });
    await prisma.stockMovement.create({
      data: { productId: product.id, type: 'IN', quantity: 6, previousQuantity: 0, newQuantity: 6, userId },
    });

    const res = await request(app)
      .post('/api/quick-out')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, quantity: 4 });

    expect(res.status).toBe(200);
    expect(res.body.newBalance).toBe(2);
    expect(res.body.movement.previousQuantity).toBe(6);
    expect(res.body.movement.newQuantity).toBe(2);
    expect(res.body.movement.userId).toBe(userId);
  });

  it('quick-out com estoque insuficiente retorna 422 e não cria movimentação', async () => {
    const product = await prisma.product.create({
      data: { name: 'Clipes', sku: `AUD-QOREJ-${Date.now()}`, minStock: 0 },
    });
    await prisma.stockMovement.create({
      data: { productId: product.id, type: 'IN', quantity: 2, previousQuantity: 0, newQuantity: 2, userId },
    });

    const countBefore = await prisma.stockMovement.count({ where: { productId: product.id } });

    const res = await request(app)
      .post('/api/quick-out')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, quantity: 3 });

    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Estoque insuficiente.');

    const countAfter = await prisma.stockMovement.count({ where: { productId: product.id } });
    expect(countAfter).toBe(countBefore);
  });

  it('userId da movimentação vem sempre da sessão autenticada, nunca de um valor forjado no body', async () => {
    const product = await prisma.product.create({
      data: { name: 'Régua', sku: `AUD-USR-${Date.now()}`, minStock: 0 },
    });

    const res = await request(app)
      .post(`/api/products/${product.id}/movements`)
      .set('Authorization', `Bearer ${token}`)
      // "userId" não faz parte do schema aceito pela rota — mesmo enviado,
      // não pode influenciar o valor gravado.
      .send({ type: 'IN', quantity: 3, userId: 'usuario-forjado-xyz' });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(userId);
    expect(res.body.userId).not.toBe('usuario-forjado-xyz');
  });

  it('POST /products com initialStock cria uma StockMovement do tipo INITIAL_STOCK (não IN)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Marcador', sku: `AUD-INIT-${Date.now()}`, minStock: 0, initialStock: 15 });

    expect(res.status).toBe(201);

    const movements = await prisma.stockMovement.findMany({ where: { productId: res.body.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe('INITIAL_STOCK');
    expect(movements[0].previousQuantity).toBe(0);
    expect(movements[0].newQuantity).toBe(15);
    expect(movements[0].userId).toBe(userId);
  });

  it('POST /products sem initialStock não cria nenhuma movimentação', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sem Estoque Inicial', sku: `AUD-NOINIT-${Date.now()}` });

    expect(res.status).toBe(201);

    const movements = await prisma.stockMovement.findMany({ where: { productId: res.body.id } });
    expect(movements).toHaveLength(0);
  });
});
