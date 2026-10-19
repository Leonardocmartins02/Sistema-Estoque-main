import type { MovementType, StockStatus } from './stock.js';

/**
 * Contrato EXTERNO dos webhooks (docs/features/integracoes-webhooks/PRD.md,
 * "Contrato de Eventos"). Sistemas receptores dependem destes formatos —
 * mudar um campo aqui é mudança de contrato, não refactor interno.
 */

/** Tipos em que um destino pode se inscrever. */
export const SUBSCRIBABLE_WEBHOOK_EVENT_TYPES = ['stock.movement.created', 'stock.status.changed'] as const;
export type SubscribableWebhookEventType = (typeof SUBSCRIBABLE_WEBHOOK_EVENT_TYPES)[number];

/** `webhook.test` só nasce do botão de teste e só vai para aquele destino. */
export type WebhookEventType = SubscribableWebhookEventType | 'webhook.test';

export type WebhookProductSnapshot = { id: string; sku: string; name: string };

export type StockMovementCreatedData = {
  movementId: string;
  product: WebhookProductSnapshot;
  type: MovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  /** Data informada da movimentação (pode ser retroativa em IN/OUT). */
  movementDate: string;
  note: string | null;
};

export type StockStatusChangedData = {
  movementId: string;
  product: WebhookProductSnapshot & { minStock: number };
  previousStatus: StockStatus;
  newStatus: StockStatus;
  previousQuantity: number;
  newQuantity: number;
};

export type WebhookTestData = { endpointId: string; message: string };

type Envelope<T extends WebhookEventType, D> = {
  type: T;
  /** Momento em que o evento aconteceu (ISO 8601), não o do envio. */
  timestamp: string;
  data: D;
};

export type WebhookPayload =
  | Envelope<'stock.movement.created', StockMovementCreatedData>
  | Envelope<'stock.status.changed', StockStatusChangedData>
  | Envelope<'webhook.test', WebhookTestData>;

// ---------------------------------------------------------------------------
// API de configuração (`/api/webhooks`) — DTOs consumidos pelo frontend.
// ---------------------------------------------------------------------------

/**
 * Situação da entrega como a UI mostra. `RETRYING` não existe no banco: é
 * PENDING com pelo menos uma tentativa feita.
 */
export const WEBHOOK_DELIVERY_STATUSES = ['PENDING', 'RETRYING', 'SENDING', 'DELIVERED', 'FAILED', 'CANCELLED'] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

export type WebhookAttemptErrorCode = 'TIMEOUT' | 'NETWORK' | 'BLOCKED_DESTINATION' | 'REDIRECT' | 'HTTP_ERROR';

export type WebhookEndpointDTO = {
  id: string;
  url: string;
  description: string | null;
  eventTypes: SubscribableWebhookEventType[];
  active: boolean;
  /** Motivo quando o SISTEMA desativou (410 Gone, falhando há 5 dias). */
  disabledReason: string | null;
  failingSince: string | null;
  lastDelivery: { status: WebhookDeliveryStatus; at: string } | null;
  createdAt: string;
  updatedAt: string;
};

/** Única resposta que carrega o segredo em claro: criação e rotação. */
export type WebhookEndpointCreatedDTO = { endpoint: WebhookEndpointDTO; secret: string };
export type WebhookSecretRotatedDTO = { secret: string };

export type WebhookDeliveryDTO = {
  id: string;
  endpointId: string;
  eventId: string;
  eventType: WebhookEventType;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  /** `null` quando a entrega já terminou (entregue, falhou, cancelada). */
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WebhookAttemptDTO = {
  id: string;
  startedAt: string;
  durationMs: number;
  responseStatus: number | null;
  errorCode: WebhookAttemptErrorCode | null;
  responseSnippet: string | null;
};

export type WebhookDeliveryDetailDTO = WebhookDeliveryDTO & {
  payload: WebhookPayload;
  attempts: WebhookAttemptDTO[];
};
