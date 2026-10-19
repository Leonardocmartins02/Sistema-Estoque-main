import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { env } from '../shared/env';

const SECRET_PREFIX = 'whsec_';
const FORMAT_VERSION = 'v1';

function defaultKey(): Buffer {
  return Buffer.from(env.WEBHOOK_SECRET_ENCRYPTION_KEY, 'base64');
}

/** Segredo no formato Standard Webhooks: `whsec_` + base64 de 32 bytes aleatórios. */
export function generateWebhookSecret(): string {
  return SECRET_PREFIX + randomBytes(32).toString('base64');
}

/**
 * Cifra o segredo para guardar no banco (AES-256-GCM). HMAC precisa do
 * segredo em claro para assinar, então não dá para guardar só um hash; cifrar
 * com uma chave que fica FORA do banco (variável de ambiente) faz um vazamento
 * do banco sozinho não bastar para forjar eventos (research.md, Questão 9).
 *
 * Formato: `v1:<iv>:<authTag>:<ciphertext>`, tudo em base64 — a versão no
 * prefixo permite trocar o algoritmo no futuro sem ambiguidade.
 */
export function encryptWebhookSecret(secret: string, key: Buffer = defaultKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [FORMAT_VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/** Lança se a chave estiver errada ou o valor tiver sido adulterado (GCM autentica). */
export function decryptWebhookSecret(stored: string, key: Buffer = defaultKey()): string {
  const [version, iv, tag, ciphertext] = stored.split(':');
  if (version !== FORMAT_VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Formato de segredo cifrado desconhecido.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
