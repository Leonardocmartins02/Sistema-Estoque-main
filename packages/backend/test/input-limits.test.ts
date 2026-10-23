import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/app';
import { resetDb } from './helpers/db';
import { createTestUser, loginAndGetToken } from './helpers/auth';

describe('limites de tamanho nas entradas', () => {
  const app = createServer();
  let token: string;

  beforeAll(async () => {
    await resetDb();
    const { user, password } = await createTestUser('limites@example.com', 'senha-forte-123');
    token = await loginAndGetToken(app, user.email, password);
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('rejeita senha gigante no login (evita custo de bcrypt sob demanda)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'limites@example.com', password: 'a'.repeat(1000) });
    expect(res.status).toBe(400);
  });

  it('rejeita nome, SKU e descrição acima do limite ao criar produto', async () => {
    const base = { name: 'Item', sku: `LIM-${Date.now()}`, minStock: 0, initialStock: 0 };
    for (const override of [
      { name: 'n'.repeat(201) },
      { sku: 's'.repeat(65) },
      { description: 'd'.repeat(2001) },
    ]) {
      const res = await request(app).post('/api/products').set(auth()).send({ ...base, ...override });
      expect(res.status).toBe(400);
    }
  });

  it('rejeita observação acima do limite na baixa rápida', async () => {
    const res = await request(app)
      .post('/api/quick-out')
      .set(auth())
      .send({ productId: 'x', quantity: 1, note: 'n'.repeat(501) });
    expect(res.status).toBe(400);
  });

  it('rejeita termo de busca gigante', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ search: 'a'.repeat(201) })
      .set(auth());
    expect(res.status).toBe(400);
  });

  it('rejeita corpo JSON acima de 100kb com 413', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.co', password: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
  });
});

describe('cabeçalhos de segurança', () => {
  it('não expõe X-Powered-By e envia nosniff', async () => {
    const res = await request(createServer()).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('JSON malformado', () => {
  it('responde 400 (e não 500)', async () => {
    const res = await request(createServer())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
  });
});
