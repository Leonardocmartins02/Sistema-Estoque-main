import type { WebhookAttempt, WebhookDelivery, WebhookEndpoint, WebhookEvent } from '@prisma/client';
import type {
  SubscribableWebhookEventType,
  WebhookAttemptDTO,
  WebhookAttemptErrorCode,
  WebhookDeliveryDetailDTO,
  WebhookDeliveryDTO,
  WebhookDeliveryStatus,
  WebhookEndpointDTO,
  WebhookEventType,
  WebhookPayload,
} from '@simplestock/shared';

/** PENDING com tentativa feita é "Retentando" para quem lê — não existe no banco. */
export function deliveryStatusOf(delivery: Pick<WebhookDelivery, 'status' | 'attemptCount'>): WebhookDeliveryStatus {
  if (delivery.status === 'PENDING' && delivery.attemptCount > 0) return 'RETRYING';
  return delivery.status;
}

const FINISHED = new Set(['DELIVERED', 'FAILED', 'CANCELLED']);

/** Nunca inclui `secretCiphertext` — o segredo só sai na criação/rotação. */
export function toEndpointDTO(
  endpoint: WebhookEndpoint,
  lastDelivery?: Pick<WebhookDelivery, 'status' | 'attemptCount' | 'updatedAt'> | null,
): WebhookEndpointDTO {
  return {
    id: endpoint.id,
    url: endpoint.url,
    description: endpoint.description,
    eventTypes: endpoint.eventTypes as SubscribableWebhookEventType[],
    active: endpoint.active,
    disabledReason: endpoint.disabledReason,
    failingSince: endpoint.failingSince?.toISOString() ?? null,
    lastDelivery: lastDelivery
      ? { status: deliveryStatusOf(lastDelivery), at: lastDelivery.updatedAt.toISOString() }
      : null,
    createdAt: endpoint.createdAt.toISOString(),
    updatedAt: endpoint.updatedAt.toISOString(),
  };
}

export function toDeliveryDTO(delivery: WebhookDelivery & { event: Pick<WebhookEvent, 'type'> }): WebhookDeliveryDTO {
  return {
    id: delivery.id,
    endpointId: delivery.endpointId,
    eventId: delivery.eventId,
    eventType: delivery.event.type as WebhookEventType,
    status: deliveryStatusOf(delivery),
    attemptCount: delivery.attemptCount,
    nextAttemptAt: FINISHED.has(delivery.status) ? null : delivery.nextAttemptAt.toISOString(),
    deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    createdAt: delivery.createdAt.toISOString(),
    updatedAt: delivery.updatedAt.toISOString(),
  };
}

function toAttemptDTO(attempt: WebhookAttempt): WebhookAttemptDTO {
  return {
    id: attempt.id,
    startedAt: attempt.startedAt.toISOString(),
    durationMs: attempt.durationMs,
    responseStatus: attempt.responseStatus,
    errorCode: attempt.errorCode as WebhookAttemptErrorCode | null,
    responseSnippet: attempt.responseSnippet,
  };
}

export function toDeliveryDetailDTO(
  delivery: WebhookDelivery & { event: WebhookEvent; attempts: WebhookAttempt[] },
): WebhookDeliveryDetailDTO {
  return {
    ...toDeliveryDTO(delivery),
    payload: delivery.event.payload as unknown as WebhookPayload,
    attempts: delivery.attempts.map(toAttemptDTO),
  };
}
