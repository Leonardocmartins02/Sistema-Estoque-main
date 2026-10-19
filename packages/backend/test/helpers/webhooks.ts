import type { SubscribableWebhookEventType } from '@simplestock/shared';

import { prisma } from '../../src/shared/prisma';
import { encryptWebhookSecret, generateWebhookSecret } from '../../src/webhooks/secrets';

/**
 * Cria um destino direto no banco (sem passar pela API de configuração) para
 * testes que só precisam de "um destino existe". Devolve o segredo em claro
 * para quem precisar verificar assinatura.
 */
export async function createTestEndpoint(
  options: {
    url?: string;
    eventTypes?: SubscribableWebhookEventType[];
    active?: boolean;
  } = {},
) {
  const secret = generateWebhookSecret();
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      url: options.url ?? 'http://127.0.0.1:9/webhook',
      eventTypes: options.eventTypes ?? ['stock.movement.created', 'stock.status.changed'],
      active: options.active ?? true,
      secretCiphertext: encryptWebhookSecret(secret),
    },
  });
  return { endpoint, secret };
}

/** Eventos de um produto, mais antigo primeiro (o payload guarda o productId em `data.product.id`). */
export async function eventsForProduct(productId: string) {
  const events = await prisma.webhookEvent.findMany({
    orderBy: { createdAt: 'asc' },
    include: { deliveries: true },
  });
  return events.filter(
    (event) => (event.payload as { data: { product?: { id: string } } }).data.product?.id === productId,
  );
}
