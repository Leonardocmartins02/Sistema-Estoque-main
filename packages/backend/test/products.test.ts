import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/app';
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
