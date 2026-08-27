import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/app';
import { prisma } from '../src/shared/prisma';
import { resetDb } from './helpers/db';
import { createTestUser, loginAndGetToken } from './helpers/auth';

describe('Produtos (autenticado)', () => {
  const app = createServer();
  let token: string;

  beforeAll(async () => {
    await resetDb();
    const { user, password } = await createTestUser('produtos@example.com', 'senha-forte-123');
    token = await loginAndGetToken(app, user.email, password);
  });

  it('cria um produto e calcula saldo inicial via initialStock', async () => {
    const createRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Lápis HB', sku: `LAPIS-${Date.now()}`, minStock: 5, initialStock: 20 });

    expect(createRes.status).toBe(201);

    const getRes = await request(app)
      .get(`/api/products/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.balance).toBe(20);
  });

  it('saldo exibido reflete ADJUSTMENT para baixo (não trata como sinal fixo negativo)', async () => {
    const createRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Produto Ajuste Baixo', sku: `ADJ-BAL-DOWN-${Date.now()}`, minStock: 0, initialStock: 20 });
    expect(createRes.status).toBe(201);

    const adjustRes = await request(app)
      .post(`/api/products/${createRes.body.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 18, expectedPreviousQuantity: 20, reason: 'Contagem física mensal' });
    expect(adjustRes.status).toBe(201);

    const getRes = await request(app)
      .get(`/api/products/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.balance).toBe(18);
  });

  it('saldo exibido reflete ADJUSTMENT para cima (não trata como sinal fixo negativo)', async () => {
    const createRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Produto Ajuste Cima', sku: `ADJ-BAL-UP-${Date.now()}`, minStock: 0, initialStock: 10 });
    expect(createRes.status).toBe(201);

    const adjustRes = await request(app)
      .post(`/api/products/${createRes.body.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 12, expectedPreviousQuantity: 10, reason: 'Correção de contagem' });
    expect(adjustRes.status).toBe(201);

    const getRes = await request(app)
      .get(`/api/products/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.balance).toBe(12);
  });

  it('saldo exibido acumula dois ajustes sequenciais corretamente', async () => {
    const createRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Produto Dois Ajustes', sku: `ADJ-BAL-SEQ-${Date.now()}`, minStock: 0, initialStock: 20 });
    expect(createRes.status).toBe(201);

    await request(app)
      .post(`/api/products/${createRes.body.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 18, expectedPreviousQuantity: 20, reason: 'Primeira conferência' });
    await request(app)
      .post(`/api/products/${createRes.body.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 25, expectedPreviousQuantity: 18, reason: 'Recontagem' });

    const getRes = await request(app)
      .get(`/api/products/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.balance).toBe(25);
  });

  it('lista de produtos calcula saldo de vários produtos corretamente, misturando ajustados e não ajustados', async () => {
    const plain = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Produto Sem Ajuste', sku: `ADJ-BAL-LIST-PLAIN-${Date.now()}`, minStock: 0, initialStock: 20 });
    const adjusted = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Produto Com Ajuste', sku: `ADJ-BAL-LIST-ADJ-${Date.now()}`, minStock: 0, initialStock: 20 });
    await request(app)
      .post(`/api/products/${adjusted.body.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 18, expectedPreviousQuantity: 20, reason: 'Contagem física mensal' });

    const listRes = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .query({ pageSize: 0 });
    expect(listRes.status).toBe(200);

    const plainItem = listRes.body.items.find((p: { id: string }) => p.id === plain.body.id);
    const adjustedItem = listRes.body.items.find((p: { id: string }) => p.id === adjusted.body.id);
    expect(plainItem.balance).toBe(20);
    expect(adjustedItem.balance).toBe(18);
  });

  it('ADJUSTMENT incompleto (sem previousQuantity/newQuantity) não derruba a consulta e tem efeito zero no saldo', async () => {
    const createRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Produto Ajuste Incompleto', sku: `ADJ-BAL-MALFORMED-${Date.now()}`, minStock: 0, initialStock: 20 });
    expect(createRes.status).toBe(201);

    // Simula um dado legado/corrompido: só o StockService grava ADJUSTMENT,
    // e ele sempre preenche previousQuantity/newQuantity — este insert
    // direto no banco é o único jeito de reproduzir o cenário.
    await prisma.stockMovement.create({
      data: {
        productId: createRes.body.id,
        type: 'ADJUSTMENT',
        quantity: 5,
        previousQuantity: null,
        newQuantity: null,
        note: 'Registro legado sem auditoria completa',
      },
    });

    const getRes = await request(app)
      .get(`/api/products/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    // Efeito da linha incompleta tratado como zero — saldo continua sendo
    // só o do initialStock, decisão registrada (não lança erro, não finge
    // que a linha não existe: é logada como warning, ver stockService.ts).
    expect(getRes.body.balance).toBe(20);
  });

  it('rejeita SKU duplicado com 409', async () => {
    const sku = `DUP-${Date.now()}`;
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`).send({ name: 'A', sku });
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'B', sku });
    expect(res.status).toBe(409);
  });

  it('rejeita payload inválido com 400', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });
});
