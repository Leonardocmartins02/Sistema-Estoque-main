import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/app';
import { prisma } from '../src/shared/prisma';
import { resetDb } from './helpers/db';
import { createTestUser, loginAndGetToken } from './helpers/auth';

describe('direitos do titular (LGPD)', () => {
  const app = createServer();

  beforeAll(async () => {
    await resetDb();
  });

  it('exige autenticação', async () => {
    expect((await request(app).get('/api/auth/me/data')).status).toBe(401);
    expect((await request(app).delete('/api/auth/me')).status).toBe(401);
  });

  it('exporta os dados do próprio usuário, sem o hash da senha', async () => {
    const { user, password } = await createTestUser('titular@example.com', 'senha-forte-123');
    const token = await loginAndGetToken(app, user.email, password);

    const res = await request(app).get('/api/auth/me/data').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, email: 'titular@example.com' });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(Array.isArray(res.body.movements)).toBe(true);
  });

  it('só exclui a conta com a senha correta', async () => {
    const { user, password } = await createTestUser('excluir1@example.com', 'senha-forte-123');
    const token = await loginAndGetToken(app, user.email, password);

    const semSenha = await request(app).delete('/api/auth/me').set('Authorization', `Bearer ${token}`).send({});
    expect(semSenha.status).toBe(400);

    const errada = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'senha-errada' });
    expect(errada.status).toBe(403);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it('exclui a conta e mantém o histórico de estoque anonimizado', async () => {
    const { user, password } = await createTestUser('excluir2@example.com', 'senha-forte-123');
    const token = await loginAndGetToken(app, user.email, password);
    const product = await prisma.product.create({ data: { name: 'Item LGPD', sku: `LGPD-${Date.now()}` } });
    const movement = await prisma.stockMovement.create({
      data: { productId: product.id, type: 'IN', quantity: 3, userId: user.id },
    });

    const res = await request(app).delete('/api/auth/me').set('Authorization', `Bearer ${token}`).send({ password });

    expect(res.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    const kept = await prisma.stockMovement.findUnique({ where: { id: movement.id } });
    expect(kept).not.toBeNull();
    expect(kept!.userId).toBeNull();
  });
});
