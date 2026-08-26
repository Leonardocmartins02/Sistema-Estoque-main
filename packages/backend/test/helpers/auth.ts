import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../src/shared/prisma';
import { hashPassword } from '../../src/shared/password';

export async function createTestUser(email = 'test@example.com', password = 'senha-forte-123') {
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  return { user, password };
}

export async function loginAndGetToken(app: Express, email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login de teste falhou (status ${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}
