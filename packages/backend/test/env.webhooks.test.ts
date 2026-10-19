import { randomBytes } from 'node:crypto';

import { describe, it, expect } from 'vitest';

import { envSchema } from '../src/shared/env';

const base = {
  DATABASE_URL: 'postgresql://x',
  JWT_SECRET: 'x'.repeat(32),
  CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
  WEBHOOK_SECRET_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
};

describe('env — variáveis de webhook', () => {
  it('sem a chave de cifragem, a aplicação não sobe', () => {
    expect(envSchema.safeParse({ ...base, WEBHOOK_SECRET_ENCRYPTION_KEY: undefined }).success).toBe(false);
  });

  it('recusa chave que não tem exatamente 32 bytes', () => {
    expect(
      envSchema.safeParse({ ...base, WEBHOOK_SECRET_ENCRYPTION_KEY: randomBytes(16).toString('base64') }).success,
    ).toBe(false);
    expect(envSchema.safeParse({ ...base, WEBHOOK_SECRET_ENCRYPTION_KEY: 'não é base64!!' }).success).toBe(false);
  });

  it('padrões: cronograma da Svix (8 tentativas), 15 s de timeout, polling de 1 s, lote de 10', () => {
    const env = envSchema.parse(base);
    expect(env.WEBHOOK_RETRY_SCHEDULE_SECONDS).toEqual([0, 5, 300, 1800, 7200, 18000, 36000, 36000]);
    expect(env.WEBHOOK_REQUEST_TIMEOUT_MS).toBe(15000);
    expect(env.WEBHOOK_POLL_INTERVAL_MS).toBe(1000);
    expect(env.WEBHOOK_BATCH_SIZE).toBe(10);
  });

  it('cronograma pode ser encurtado para demonstração', () => {
    const env = envSchema.parse({ ...base, WEBHOOK_RETRY_SCHEDULE_SECONDS: '0, 2,4,8' });
    expect(env.WEBHOOK_RETRY_SCHEDULE_SECONDS).toEqual([0, 2, 4, 8]);
  });

  it.each(['', '0,-1', '0,abc', '1.5'])('recusa cronograma inválido %j', (value) => {
    expect(envSchema.safeParse({ ...base, WEBHOOK_RETRY_SCHEDULE_SECONDS: value }).success).toBe(false);
  });
});
