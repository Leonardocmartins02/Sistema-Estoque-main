import { randomUUID } from 'node:crypto';

import { Prisma, type StockMovement } from '@prisma/client';
import { deriveStockStatus, type WebhookPayload } from '@simplestock/shared';

export type LockedProduct = { id: string; sku: string; name: string; minStock: number };

/** Id do evento — vira o header `webhook-id`, estável em toda tentativa. */
function newEventId(): string {
  return `evt_${randomUUID().replace(/-/g, '')}`;
}

/**
 * Grava os eventos e as entregas DENTRO da transação do StockService
 * (outbox transacional, research.md Questão 1). Se a transação for desfeita
 * — saldo insuficiente, conflito de ajuste, qualquer erro — nada daqui
 * existe; se confirmar, o worker tem garantia de encontrar tudo.
 *
 * Nenhuma chamada HTTP acontece aqui, jamais: a entrega é do worker.
 *
 * Fan-out na própria transação: uma entrega por destino ATIVO e INSCRITO no
 * tipo no momento do evento — é o que faz "destino inativo não acumula
 * eventos" sem regra extra no worker. Sem nenhum inscrito, o evento nem é
 * gravado (não há quem entregar, e a tabela não cresce à toa).
 */
export async function emitStockEventsInTx(
  tx: Prisma.TransactionClient,
  input: {
    movement: StockMovement;
    product: LockedProduct;
    previousQuantity: number;
    newQuantity: number;
  },
): Promise<void> {
  const { movement, product, previousQuantity, newQuantity } = input;
  const occurredAt = movement.createdAt;
  const timestamp = occurredAt.toISOString();
  const snapshot = { id: product.id, sku: product.sku, name: product.name };

  const payloads: WebhookPayload[] = [
    {
      type: 'stock.movement.created',
      timestamp,
      data: {
        movementId: movement.id,
        product: snapshot,
        type: movement.type,
        quantity: movement.quantity,
        previousQuantity,
        newQuantity,
        movementDate: movement.date.toISOString(),
        note: movement.note ?? null,
      },
    },
  ];

  // INITIAL_STOCK só existe na criação do produto: não havia status anterior
  // para "mudar" (PRD, Requisito Funcional 2).
  if (movement.type !== 'INITIAL_STOCK') {
    const previousStatus = deriveStockStatus(previousQuantity, product.minStock);
    const newStatus = deriveStockStatus(newQuantity, product.minStock);
    if (previousStatus !== newStatus) {
      payloads.push({
        type: 'stock.status.changed',
        timestamp,
        data: {
          movementId: movement.id,
          product: { ...snapshot, minStock: product.minStock },
          previousStatus,
          newStatus,
          previousQuantity,
          newQuantity,
        },
      });
    }
  }

  const endpoints = await tx.webhookEndpoint.findMany({
    where: { active: true, eventTypes: { hasSome: payloads.map((payload) => payload.type) } },
    select: { id: true, eventTypes: true },
  });

  for (const payload of payloads) {
    const subscribers = endpoints.filter((endpoint) => endpoint.eventTypes.includes(payload.type));
    if (subscribers.length === 0) continue;

    await tx.webhookEvent.create({
      data: {
        id: newEventId(),
        type: payload.type,
        payload: payload as unknown as Prisma.InputJsonObject,
        occurredAt,
        deliveries: {
          createMany: { data: subscribers.map((endpoint) => ({ endpointId: endpoint.id })) },
        },
      },
    });
  }
}
