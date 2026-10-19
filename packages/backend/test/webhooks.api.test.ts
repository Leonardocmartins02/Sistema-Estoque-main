import { Webhook } from 'standardwebhooks';
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { createServer } from '../src/app';
import { prisma } from '../src/shared/prisma';
import { decryptWebhookSecret } from '../src/webhooks/secrets';
import { buildSignatureHeaders } from '../src/webhooks/signature';

import { createTestUser, loginAndGetToken } from './helpers/auth';
import { resetDb } from './helpers/db';
import { createTestEndpoint } from './helpers/webhooks';

/**
 * API de configuração (`/api/webhooks`) — PRD, Requisitos Funcionais 5–10,
 * 19–21, 23. URLs com IP literal de loopback evitam depender de DNS no teste;
 * a validação de produção (só https) está coberta nos testes unitários de
 * destinationGuard.
 */
describe('API /api/webhooks', () => {
  const app = createServer();
  let token: string;
  let userId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  function createEndpoint(body: object) {
    return request(app).post('/api/webhooks').set(auth()).send(body);
  }

  async function failedDeliveryFor(endpointId: string) {
    const event = await prisma.webhookEvent.create({
      data: {
        id: `evt_teste_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: 'webhook.test',
        payload: { type: 'webhook.test', timestamp: new Date().toISOString(), data: { endpointId, message: 'x' } },
        occurredAt: new Date(),
      },
    });
    return prisma.webhookDelivery.create({
      data: {
        eventId: event.id,
        endpointId,
        status: 'FAILED',
        attemptCount: 8,
        finishedAt: new Date(),
        attempts: {
          create: [{ startedAt: new Date(), durationMs: 12, responseStatus: 500, errorCode: 'HTTP_ERROR', responseSnippet: 'erro' }],
        },
      },
    });
  }

  beforeAll(async () => {
    await resetDb();
    const { user, password } = await createTestUser('webhooks-api@example.com', 'senha-forte-123');
    userId = user.id;
    token = await loginAndGetToken(app, user.email, password);
  });

  beforeEach(async () => {
    await prisma.webhookEndpoint.deleteMany();
    await prisma.webhookEvent.deleteMany();
  });

  it.each([
    ['get', '/api/webhooks'],
    ['post', '/api/webhooks'],
    ['put', '/api/webhooks/x'],
    ['delete', '/api/webhooks/x'],
    ['post', '/api/webhooks/x/rotate-secret'],
    ['post', '/api/webhooks/x/test'],
    ['get', '/api/webhooks/x/deliveries'],
    ['get', '/api/webhooks/deliveries/x'],
    ['post', '/api/webhooks/deliveries/x/retry'],
  ] as const)('%s %s exige autenticação', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });

  describe('criação', () => {
    it('cria destino ativo e devolve o segredo whsec_ uma única vez', async () => {
      const res = await createEndpoint({
        url: 'http://127.0.0.1:4100/webhook',
        eventTypes: ['stock.status.changed'],
        description: 'Compras',
      });

      expect(res.status).toBe(201);
      expect(res.body.secret).toMatch(/^whsec_/);
      expect(res.body.endpoint).toMatchObject({
        url: 'http://127.0.0.1:4100/webhook',
        eventTypes: ['stock.status.changed'],
        description: 'Compras',
        active: true,
        disabledReason: null,
        failingSince: null,
        lastDelivery: null,
      });

      const list = await request(app).get('/api/webhooks').set(auth());
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(1);
      expect(JSON.stringify(list.body)).not.toContain(res.body.secret);
      expect(JSON.stringify(list.body)).not.toContain('secretCiphertext');
    });

    it('guarda o segredo cifrado — o banco não tem o valor em claro, mas ele decifra para o original', async () => {
      const res = await createEndpoint({ url: 'http://127.0.0.1:4100/w', eventTypes: ['stock.movement.created'] });

      const stored = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id: res.body.endpoint.id } });
      expect(stored.secretCiphertext).not.toContain(res.body.secret);
      expect(decryptWebhookSecret(stored.secretCiphertext)).toBe(res.body.secret);
    });

    it('autoria vem da sessão, nunca do corpo', async () => {
      const res = await createEndpoint({
        url: 'http://127.0.0.1:4100/w',
        eventTypes: ['stock.movement.created'],
        createdById: 'outro-usuario',
      });

      const stored = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id: res.body.endpoint.id } });
      expect(stored.createdById).toBe(userId);
      expect(stored.updatedById).toBe(userId);
    });

    it('eventos repetidos são gravados uma vez só', async () => {
      const res = await createEndpoint({
        url: 'http://127.0.0.1:4100/w',
        eventTypes: ['stock.movement.created', 'stock.movement.created'],
      });
      expect(res.body.endpoint.eventTypes).toEqual(['stock.movement.created']);
    });

    it.each([
      [{ url: 'não é url', eventTypes: ['stock.movement.created'] }, 'URL inválida'],
      [{ url: 'ftp://127.0.0.1/x', eventTypes: ['stock.movement.created'] }, 'protocolo'],
      [{ url: 'http://169.254.169.254/latest', eventTypes: ['stock.movement.created'] }, 'metadados de nuvem'],
      [{ url: 'http://10.0.0.5/hook', eventTypes: ['stock.movement.created'] }, 'rede privada'],
      [{ url: 'http://127.0.0.1:4100/w', eventTypes: [] }, 'nenhum evento'],
      [{ url: 'http://127.0.0.1:4100/w', eventTypes: ['webhook.test'] }, 'webhook.test não é inscrevível'],
      [{ url: 'http://127.0.0.1:4100/w', eventTypes: ['product.deleted'] }, 'evento desconhecido'],
    ])('recusa com 400: %j (%s)', async (body) => {
      const res = await createEndpoint(body);
      expect(res.status).toBe(400);
      expect(await prisma.webhookEndpoint.count()).toBe(0);
    });
  });

  describe('edição, desativação e exclusão', () => {
    it('edita URL, eventos e descrição; updatedById vem da sessão', async () => {
      const { endpoint } = await createTestEndpoint();

      const res = await request(app)
        .put(`/api/webhooks/${endpoint.id}`)
        .set(auth())
        .send({ url: 'http://127.0.0.1:4200/novo', eventTypes: ['stock.status.changed'], description: 'ERP' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        url: 'http://127.0.0.1:4200/novo',
        eventTypes: ['stock.status.changed'],
        description: 'ERP',
      });
      const stored = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id: endpoint.id } });
      expect(stored.updatedById).toBe(userId);
    });

    it('edição também passa pela guarda de SSRF', async () => {
      const { endpoint } = await createTestEndpoint();
      const res = await request(app).put(`/api/webhooks/${endpoint.id}`).set(auth()).send({ url: 'http://192.168.0.1/' });
      expect(res.status).toBe(400);
    });

    it('desativar cancela as entregas pendentes sem apagar o histórico', async () => {
      const { endpoint } = await createTestEndpoint();
      const failed = await failedDeliveryFor(endpoint.id);
      const pendingEvent = await prisma.webhookEvent.create({
        data: { id: `evt_pend_${Date.now()}`, type: 'webhook.test', payload: {}, occurredAt: new Date() },
      });
      const pending = await prisma.webhookDelivery.create({ data: { eventId: pendingEvent.id, endpointId: endpoint.id } });

      const res = await request(app).put(`/api/webhooks/${endpoint.id}`).set(auth()).send({ active: false });

      expect(res.status).toBe(200);
      expect(res.body.active).toBe(false);
      const after = await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: pending.id } });
      expect(after.status).toBe('CANCELLED');
      expect(after.finishedAt).not.toBeNull();
      expect((await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: failed.id } })).status).toBe('FAILED');
    });

    it('reativar limpa o motivo de desativação automática e o "falhando desde"', async () => {
      const { endpoint } = await createTestEndpoint({ active: false });
      await prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: { disabledReason: 'Destino respondeu 410 Gone.', failingSince: new Date() },
      });

      const res = await request(app).put(`/api/webhooks/${endpoint.id}`).set(auth()).send({ active: true });

      expect(res.body).toMatchObject({ active: true, disabledReason: null, failingSince: null });
    });

    it('excluir remove destino, entregas e tentativas', async () => {
      const { endpoint } = await createTestEndpoint();
      const delivery = await failedDeliveryFor(endpoint.id);

      const res = await request(app).delete(`/api/webhooks/${endpoint.id}`).set(auth());

      expect(res.status).toBe(204);
      expect(await prisma.webhookEndpoint.count()).toBe(0);
      expect(await prisma.webhookDelivery.count({ where: { id: delivery.id } })).toBe(0);
      expect(await prisma.webhookAttempt.count({ where: { deliveryId: delivery.id } })).toBe(0);
    });

    it.each([
      ['put', { active: false }],
      ['delete', undefined],
    ] as const)('%s em destino inexistente → 404', async (method, body) => {
      const res = await request(app)[method]('/api/webhooks/nao-existe').set(auth()).send(body);
      expect(res.status).toBe(404);
    });
  });

  describe('rotação de segredo', () => {
    it('gera segredo novo, devolve uma vez e invalida o anterior', async () => {
      const { endpoint, secret: oldSecret } = await createTestEndpoint();

      const res = await request(app).post(`/api/webhooks/${endpoint.id}/rotate-secret`).set(auth());

      expect(res.status).toBe(200);
      expect(res.body.secret).toMatch(/^whsec_/);
      expect(res.body.secret).not.toBe(oldSecret);
      const stored = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id: endpoint.id } });
      const current = decryptWebhookSecret(stored.secretCiphertext);
      expect(current).toBe(res.body.secret);

      // Assinatura feita com o segredo antigo não valida mais com o atual.
      const body = '{}';
      const headers = buildSignatureHeaders({ eventId: 'evt_x', body, secret: oldSecret, sentAt: new Date() });
      expect(() => new Webhook(current).verify(body, headers)).toThrow();
    });
  });

  describe('evento de teste', () => {
    it('cria um webhook.test com uma entrega pendente só para aquele destino', async () => {
      const { endpoint } = await createTestEndpoint({ eventTypes: ['stock.status.changed'] });
      await createTestEndpoint(); // outro destino ativo não recebe

      const res = await request(app).post(`/api/webhooks/${endpoint.id}/test`).set(auth());

      expect(res.status).toBe(202);
      const delivery = await prisma.webhookDelivery.findUniqueOrThrow({
        where: { id: res.body.deliveryId },
        include: { event: true },
      });
      expect(delivery).toMatchObject({ endpointId: endpoint.id, status: 'PENDING' });
      expect(delivery.event.type).toBe('webhook.test');
      expect(delivery.event.payload).toMatchObject({
        type: 'webhook.test',
        data: { endpointId: endpoint.id, message: expect.any(String) },
      });
      expect(await prisma.webhookDelivery.count()).toBe(1);
    });

    it('destino desativado → 409', async () => {
      const { endpoint } = await createTestEndpoint({ active: false });
      const res = await request(app).post(`/api/webhooks/${endpoint.id}/test`).set(auth());
      expect(res.status).toBe(409);
    });
  });

  describe('entregas e reenvio', () => {
    it('lista entregas do destino paginadas, com situação derivada', async () => {
      const { endpoint } = await createTestEndpoint();
      await failedDeliveryFor(endpoint.id);
      const retryingEvent = await prisma.webhookEvent.create({
        data: { id: `evt_retry_${Date.now()}`, type: 'webhook.test', payload: {}, occurredAt: new Date() },
      });
      await prisma.webhookDelivery.create({
        data: { eventId: retryingEvent.id, endpointId: endpoint.id, attemptCount: 2 },
      });

      const res = await request(app).get(`/api/webhooks/${endpoint.id}/deliveries?pageSize=10`).set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 10 });
      expect(res.body.items.map((d: { status: string }) => d.status).sort()).toEqual(['FAILED', 'RETRYING']);
      const failed = res.body.items.find((d: { status: string }) => d.status === 'FAILED');
      expect(failed.nextAttemptAt).toBeNull();

      const onlyRetrying = await request(app).get(`/api/webhooks/${endpoint.id}/deliveries?status=RETRYING`).set(auth());
      expect(onlyRetrying.body.total).toBe(1);
      expect(onlyRetrying.body.items[0].attemptCount).toBe(2);
    });

    it('status desconhecido no filtro → 400', async () => {
      const { endpoint } = await createTestEndpoint();
      const res = await request(app).get(`/api/webhooks/${endpoint.id}/deliveries?status=OK`).set(auth());
      expect(res.status).toBe(400);
    });

    it('detalhe traz evento, webhook-id e tentativas', async () => {
      const { endpoint } = await createTestEndpoint();
      const delivery = await failedDeliveryFor(endpoint.id);

      const res = await request(app).get(`/api/webhooks/deliveries/${delivery.id}`).set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: delivery.id,
        eventId: delivery.eventId,
        eventType: 'webhook.test',
        status: 'FAILED',
        payload: { type: 'webhook.test' },
        attempts: [{ responseStatus: 500, errorCode: 'HTTP_ERROR', responseSnippet: 'erro', durationMs: 12 }],
      });
    });

    it('reenviar entrega que falhou definitivamente: volta para a fila com o MESMO evento', async () => {
      const { endpoint } = await createTestEndpoint();
      const delivery = await failedDeliveryFor(endpoint.id);

      const res = await request(app).post(`/api/webhooks/deliveries/${delivery.id}/retry`).set(auth());

      expect(res.status).toBe(202);
      const after = await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
      expect(after).toMatchObject({ status: 'PENDING', attemptCount: 0, eventId: delivery.eventId, finishedAt: null });
      expect(await prisma.webhookAttempt.count({ where: { deliveryId: delivery.id } })).toBe(1); // histórico mantido
    });

    it('reenviar entrega que não falhou definitivamente → 409', async () => {
      const { endpoint } = await createTestEndpoint();
      const event = await prisma.webhookEvent.create({
        data: { id: `evt_ok_${Date.now()}`, type: 'webhook.test', payload: {}, occurredAt: new Date() },
      });
      const delivered = await prisma.webhookDelivery.create({
        data: { eventId: event.id, endpointId: endpoint.id, status: 'DELIVERED', finishedAt: new Date() },
      });

      const res = await request(app).post(`/api/webhooks/deliveries/${delivered.id}/retry`).set(auth());
      expect(res.status).toBe(409);
    });

    it('reenviar para destino desativado → 409', async () => {
      const { endpoint } = await createTestEndpoint();
      const delivery = await failedDeliveryFor(endpoint.id);
      await prisma.webhookEndpoint.update({ where: { id: endpoint.id }, data: { active: false } });

      const res = await request(app).post(`/api/webhooks/deliveries/${delivery.id}/retry`).set(auth());
      expect(res.status).toBe(409);
    });

    it('lista de destinos mostra a situação da entrega mais recente', async () => {
      const { endpoint } = await createTestEndpoint();
      await failedDeliveryFor(endpoint.id);

      const res = await request(app).get('/api/webhooks').set(auth());
      expect(res.body[0].lastDelivery).toEqual({ status: 'FAILED', at: expect.any(String) });
    });
  });
});
