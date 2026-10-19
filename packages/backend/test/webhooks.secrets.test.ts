import { randomBytes } from 'node:crypto';

import { describe, it, expect } from 'vitest';

import {
  decryptWebhookSecret,
  encryptWebhookSecret,
  generateWebhookSecret,
} from '../src/webhooks/secrets';

describe('segredo de assinatura do destino', () => {
  it('gera segredo no formato Standard Webhooks: whsec_ + base64 de 32 bytes', () => {
    const secret = generateWebhookSecret();
    expect(secret.startsWith('whsec_')).toBe(true);
    expect(Buffer.from(secret.slice('whsec_'.length), 'base64')).toHaveLength(32);
  });

  it('nunca gera o mesmo segredo duas vezes', () => {
    expect(generateWebhookSecret()).not.toBe(generateWebhookSecret());
  });

  it('cifrar e decifrar devolve o segredo original', () => {
    const secret = generateWebhookSecret();
    expect(decryptWebhookSecret(encryptWebhookSecret(secret))).toBe(secret);
  });

  it('o valor cifrado não contém o segredo nem a parte base64 dele', () => {
    const secret = generateWebhookSecret();
    const stored = encryptWebhookSecret(secret);
    expect(stored).not.toContain(secret);
    expect(stored).not.toContain(secret.slice('whsec_'.length));
  });

  it('cifrar o mesmo segredo duas vezes gera valores diferentes (IV aleatório)', () => {
    const secret = generateWebhookSecret();
    expect(encryptWebhookSecret(secret)).not.toBe(encryptWebhookSecret(secret));
  });

  it('decifrar com outra chave falha em vez de devolver lixo', () => {
    const stored = encryptWebhookSecret(generateWebhookSecret());
    expect(() => decryptWebhookSecret(stored, randomBytes(32))).toThrow();
  });

  it('valor cifrado adulterado falha (GCM autentica o conteúdo)', () => {
    const stored = encryptWebhookSecret(generateWebhookSecret());
    const parts = stored.split(':');
    const ciphertext = Buffer.from(parts[3], 'base64');
    ciphertext[0] ^= 0xff;
    parts[3] = ciphertext.toString('base64');
    expect(() => decryptWebhookSecret(parts.join(':'))).toThrow();
  });
});
