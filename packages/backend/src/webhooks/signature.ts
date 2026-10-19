import { createHmac } from 'node:crypto';

export type SignatureHeaders = {
  'webhook-id': string;
  'webhook-timestamp': string;
  'webhook-signature': string;
};

/**
 * Headers de assinatura da Standard Webhooks
 * (https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md):
 * HMAC-SHA256, com a chave = bytes do segredo depois do prefixo `whsec_`,
 * sobre `id.timestamp.corpo`. O corpo assinado tem que ser EXATAMENTE os
 * bytes enviados — quem chama passa a string que vai no corpo da requisição.
 *
 * `sentAt` é o momento DESTA tentativa (não o do evento): o receptor usa o
 * timestamp para recusar reenvio de uma requisição antiga capturada.
 */
export function buildSignatureHeaders(input: {
  eventId: string;
  body: string;
  secret: string;
  sentAt: Date;
}): SignatureHeaders {
  const timestamp = String(Math.floor(input.sentAt.getTime() / 1000));
  const key = Buffer.from(input.secret.replace(/^whsec_/, ''), 'base64');
  const signature = createHmac('sha256', key)
    .update(`${input.eventId}.${timestamp}.${input.body}`)
    .digest('base64');

  return {
    'webhook-id': input.eventId,
    'webhook-timestamp': timestamp,
    'webhook-signature': `v1,${signature}`,
  };
}
