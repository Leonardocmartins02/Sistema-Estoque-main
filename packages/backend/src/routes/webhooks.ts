import { Prisma } from '@prisma/client';
import { SUBSCRIBABLE_WEBHOOK_EVENT_TYPES, WEBHOOK_DELIVERY_STATUSES } from '@simplestock/shared';
import { Router } from 'express';
import { z } from 'zod';

import { env } from '../shared/env';
import { HttpError } from '../shared/httpError';
import { prisma } from '../shared/prisma';
import { pageParam, pageSizeParam } from '../shared/queryParams';
import { validateDestinationUrl } from '../webhooks/destinationGuard';
import { toDeliveryDetailDTO, toDeliveryDTO, toEndpointDTO } from '../webhooks/dto';
import { createTestEvent } from '../webhooks/events';
import { encryptWebhookSecret, generateWebhookSecret } from '../webhooks/secrets';

/**
 * Configuração de destinos de webhook (docs/features/integracoes-webhooks/).
 * Montado com `requireAuth` em routes/index.ts; toda autoria
 * (`createdById`/`updatedById`, logs) vem de `req.user`, nunca do corpo.
 */
const router = Router();

const endpointSchema = z.object({
  url: z.string().trim().min(1, 'Informe a URL de destino.').max(2048, 'URL muito longa.'),
  description: z.string().trim().max(200, 'Descrição muito longa (máximo de 200 caracteres).').nullable().optional(),
  // `webhook.test` fica de fora de propósito: não é inscrevível, só nasce do
  // botão de teste. Duplicatas são descartadas em vez de recusadas.
  eventTypes: z
    .array(z.enum(SUBSCRIBABLE_WEBHOOK_EVENT_TYPES))
    .min(1, 'Selecione pelo menos um evento.')
    .transform((types) => [...new Set(types)]),
  active: z.boolean().optional(),
});

const deliveriesQuerySchema = z.object({
  page: pageParam,
  pageSize: pageSizeParam({ min: 1, max: 100, default: 20 }),
  status: z.enum(WEBHOOK_DELIVERY_STATUSES).optional(),
});

/** Status da UI → filtro do banco (RETRYING/PENDING dividem o mesmo status). */
function deliveryStatusWhere(status?: (typeof WEBHOOK_DELIVERY_STATUSES)[number]): Prisma.WebhookDeliveryWhereInput {
  if (!status) return {};
  if (status === 'PENDING') return { status: 'PENDING', attemptCount: 0 };
  if (status === 'RETRYING') return { status: 'PENDING', attemptCount: { gt: 0 } };
  return { status };
}

async function checkedUrl(raw: string): Promise<string> {
  const url = await validateDestinationUrl(raw, { production: env.NODE_ENV === 'production' });
  return url.toString();
}

async function findEndpointOr404(id: string) {
  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id } });
  if (!endpoint) throw new HttpError(404, 'Destino não encontrado.');
  return endpoint;
}

router.get('/', async (_req, res, next) => {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, attemptCount: true, updatedAt: true },
        },
      },
    });
    res.json(endpoints.map(({ deliveries, ...endpoint }) => toEndpointDTO(endpoint, deliveries[0])));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const data = endpointSchema.parse(req.body);
    const url = await checkedUrl(data.url);
    const secret = generateWebhookSecret();

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        url,
        description: data.description || null,
        eventTypes: data.eventTypes,
        active: data.active ?? true,
        secretCiphertext: encryptWebhookSecret(secret),
        createdById: req.user!.id,
        updatedById: req.user!.id,
      },
    });

    req.log.info({ endpointId: endpoint.id, userId: req.user!.id }, 'Destino de webhook criado');
    // Única resposta (junto da rotação) que carrega o segredo em claro.
    res.status(201).json({ endpoint: toEndpointDTO(endpoint, null), secret });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const current = await findEndpointOr404(req.params.id);
    const data = endpointSchema.partial().parse(req.body);
    const url = data.url !== undefined ? await checkedUrl(data.url) : undefined;

    const deactivating = data.active === false && current.active;
    const reactivating = data.active === true && !current.active;

    const updated = await prisma.$transaction(async (tx) => {
      // Desativar cancela o que ainda não saiu — "destino inativo não recebe
      // nada" (idea.md). SENDING em voo termina normalmente; o histórico
      // (FAILED/DELIVERED) não é tocado.
      if (deactivating) {
        await tx.webhookDelivery.updateMany({
          where: { endpointId: current.id, status: 'PENDING' },
          data: { status: 'CANCELLED', finishedAt: new Date(), lockedUntil: null },
        });
      }

      return tx.webhookEndpoint.update({
        where: { id: current.id },
        data: {
          url,
          description: data.description === undefined ? undefined : data.description || null,
          eventTypes: data.eventTypes,
          active: data.active,
          // Reativar é o usuário assumindo que o destino voltou: zera o
          // motivo da desativação automática e a contagem de "falhando desde".
          ...(reactivating ? { disabledReason: null, failingSince: null } : {}),
          updatedById: req.user!.id,
        },
      });
    });

    req.log.info({ endpointId: updated.id, userId: req.user!.id, active: updated.active }, 'Destino de webhook alterado');
    res.json(toEndpointDTO(updated));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const endpoint = await findEndpointOr404(req.params.id);
    // Cascata no banco remove entregas e tentativas. Eventos que ficarem sem
    // entrega nenhuma são limpos pela retenção do worker.
    await prisma.webhookEndpoint.delete({ where: { id: endpoint.id } });
    req.log.info({ endpointId: endpoint.id, url: endpoint.url, userId: req.user!.id }, 'Destino de webhook excluído');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/:id/rotate-secret', async (req, res, next) => {
  try {
    const endpoint = await findEndpointOr404(req.params.id);
    const secret = generateWebhookSecret();
    await prisma.webhookEndpoint.update({
      where: { id: endpoint.id },
      data: { secretCiphertext: encryptWebhookSecret(secret), updatedById: req.user!.id },
    });
    req.log.info({ endpointId: endpoint.id, userId: req.user!.id }, 'Segredo de webhook rotacionado');
    res.json({ secret });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/test', async (req, res, next) => {
  try {
    const endpoint = await findEndpointOr404(req.params.id);
    if (!endpoint.active) throw new HttpError(409, 'Ative o destino antes de enviar um teste.');

    const { deliveryId } = await createTestEvent(prisma, endpoint.id);
    req.log.info({ endpointId: endpoint.id, deliveryId, userId: req.user!.id }, 'Evento de teste de webhook enfileirado');
    res.status(202).json({ deliveryId });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/deliveries', async (req, res, next) => {
  try {
    const endpoint = await findEndpointOr404(req.params.id);
    const { page, pageSize, status } = deliveriesQuerySchema.parse(req.query);
    const where: Prisma.WebhookDeliveryWhereInput = { endpointId: endpoint.id, ...deliveryStatusWhere(status) };

    const [total, deliveries] = await prisma.$transaction([
      prisma.webhookDelivery.count({ where }),
      prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { event: { select: { type: true } } },
      }),
    ]);

    res.json({ items: deliveries.map(toDeliveryDTO), total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

router.get('/deliveries/:deliveryId', async (req, res, next) => {
  try {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: req.params.deliveryId },
      include: { event: true, attempts: { orderBy: { startedAt: 'asc' } } },
    });
    if (!delivery) throw new HttpError(404, 'Entrega não encontrada.');
    res.json(toDeliveryDetailDTO(delivery));
  } catch (err) {
    next(err);
  }
});

router.post('/deliveries/:deliveryId/retry', async (req, res, next) => {
  try {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: req.params.deliveryId },
      include: { endpoint: { select: { active: true } } },
    });
    if (!delivery) throw new HttpError(404, 'Entrega não encontrada.');
    if (!delivery.endpoint.active) {
      throw new HttpError(409, 'O destino está desativado. Reative-o antes de reenviar.');
    }

    // Condicional no próprio UPDATE: dois cliques simultâneos não reenviam
    // duas vezes, e uma entrega que mudou de estado entre a leitura e aqui é
    // recusada em vez de reenviada por cima.
    const { count } = await prisma.webhookDelivery.updateMany({
      where: { id: delivery.id, status: 'FAILED' },
      data: { status: 'PENDING', attemptCount: 0, nextAttemptAt: new Date(), finishedAt: null, lockedUntil: null },
    });
    if (count === 0) {
      throw new HttpError(409, 'Só é possível reenviar uma entrega que falhou definitivamente.');
    }

    req.log.info({ deliveryId: delivery.id, userId: req.user!.id }, 'Entrega de webhook reenviada manualmente');
    res.status(202).json({ deliveryId: delivery.id });
  } catch (err) {
    next(err);
  }
});

export default router;
