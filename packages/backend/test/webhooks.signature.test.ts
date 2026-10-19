import { Webhook } from 'standardwebhooks';
import { describe, it, expect } from 'vitest';

import { generateWebhookSecret } from '../src/webhooks/secrets';
import { buildSignatureHeaders } from '../src/webhooks/signature';

/**
 * A prova de compatibilidade com a Standard Webhooks é verificar nossa
 * assinatura com a biblioteca de REFERÊNCIA da spec — se a nossa
 * implementação divergir do padrão, é aqui que quebra.
 */
describe('assinatura Standard Webhooks', () => {
  const body = JSON.stringify({ type: 'webhook.test', timestamp: '2026-10-19T12:00:00.000Z', data: {} });

  it('gera os três headers da spec', () => {
    const headers = buildSignatureHeaders({
      eventId: 'evt_123',
      body,
      secret: generateWebhookSecret(),
      sentAt: new Date('2026-10-19T12:00:05.000Z'),
    });
    expect(headers['webhook-id']).toBe('evt_123');
    expect(headers['webhook-timestamp']).toBe(String(Date.parse('2026-10-19T12:00:05.000Z') / 1000));
    expect(headers['webhook-signature']).toMatch(/^v1,[A-Za-z0-9+/]+=*$/);
  });

  it('é aceita pela implementação de referência', () => {
    const secret = generateWebhookSecret();
    const headers = buildSignatureHeaders({ eventId: 'evt_abc', body, secret, sentAt: new Date() });
    expect(() => new Webhook(secret).verify(body, headers)).not.toThrow();
  });

  it('corpo alterado em um byte é rejeitado pela implementação de referência', () => {
    const secret = generateWebhookSecret();
    const headers = buildSignatureHeaders({ eventId: 'evt_abc', body, secret, sentAt: new Date() });
    expect(() => new Webhook(secret).verify(body.replace('12:00', '12:01'), headers)).toThrow();
  });

  it('segredo de outro destino não valida a assinatura', () => {
    const headers = buildSignatureHeaders({
      eventId: 'evt_abc',
      body,
      secret: generateWebhookSecret(),
      sentAt: new Date(),
    });
    expect(() => new Webhook(generateWebhookSecret()).verify(body, headers)).toThrow();
  });
});
