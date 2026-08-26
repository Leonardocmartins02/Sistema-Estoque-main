import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/app';
import { resetDb } from './helpers/db';
import { createTestUser } from './helpers/auth';

describe('POST /api/auth/login', () => {
  const app = createServer();
  let email: string;
  let password: string;

  beforeAll(async () => {
    await resetDb();
    const created = await createTestUser('login@example.com', 'senha-correta-123');
    email = created.user.email;
    password = created.password;
  });

  it('retorna um token para credenciais válidas', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(email);
  });

  it('rejeita senha incorreta com mensagem genérica', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'senha-errada' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('E-mail ou senha inválidos.');
  });

  it('rejeita e-mail inexistente com a MESMA mensagem genérica (não vaza quem existe)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nao-existe@example.com', password: 'qualquer-coisa' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('E-mail ou senha inválidos.');
  });

  it('rejeita payload sem e-mail válido com 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nao-e-email', password: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('rotas protegidas por requireAuth', () => {
  const app = createServer();

  it('nega acesso sem token', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });

  it('nega acesso com token inválido', async () => {
    const res = await request(app).get('/api/products').set('Authorization', 'Bearer token-invalido');
    expect(res.status).toBe(401);
  });

  it('/health permanece acessível sem token', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
