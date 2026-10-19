import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/** Cronograma da Svix: imediato, 5 s, 5 min, 30 min, 2 h, 5 h, 10 h, 10 h (research.md, Questão 3). */
const DEFAULT_RETRY_SCHEDULE_SECONDS = [0, 5, 300, 1800, 7200, 18000, 36000, 36000];

/**
 * Chave AES-256-GCM dos segredos de webhook: base64 que decodifica para
 * exatamente 32 bytes. A comparação de ida e volta recusa texto que o
 * `Buffer.from(..., 'base64')` aceitaria em silêncio (ele ignora caracteres
 * inválidos em vez de falhar).
 */
const encryptionKeySchema = z
  .string({ required_error: 'WEBHOOK_SECRET_ENCRYPTION_KEY é obrigatório (ver .env.example)' })
  .refine((value) => {
    const bytes = Buffer.from(value, 'base64');
    return bytes.length === 32 && bytes.toString('base64') === value;
  }, 'WEBHOOK_SECRET_ENCRYPTION_KEY deve ser o base64 de exatamente 32 bytes (ver .env.example)');

/**
 * Sobrescrita do cronograma (demonstração e testes): segundos separados por
 * vírgula. O número de valores é o número máximo de tentativas.
 */
const retryScheduleSchema = z
  .string()
  .transform((value) => value.split(',').map((part) => part.trim()))
  // Regex em vez de `z.coerce.number()`: `Number('')` é 0, e uma lista vazia
  // viraria em silêncio "uma tentativa imediata".
  .pipe(
    z
      .array(z.string().regex(/^\d+$/, 'Cronograma: inteiros >= 0 separados por vírgula').transform(Number))
      .min(1)
      .max(20),
  );

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter pelo menos 16 caracteres'),
  CORS_ALLOWED_ORIGINS: z.string().min(1, 'CORS_ALLOWED_ORIGINS é obrigatório'),
  WEBHOOK_SECRET_ENCRYPTION_KEY: encryptionKeySchema,
  WEBHOOK_RETRY_SCHEDULE_SECONDS: retryScheduleSchema.default(DEFAULT_RETRY_SCHEDULE_SECONDS.join(',')),
  WEBHOOK_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  WEBHOOK_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  WEBHOOK_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(10),
});

export const env = envSchema.parse(process.env);

export const corsAllowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
