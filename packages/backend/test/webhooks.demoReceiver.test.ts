import type { AddressInfo } from 'node:net';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createDemoReceiver } from '../scripts/webhook-receiver';
import { prisma } from '../src/shared/prisma';
import { processBatch } from '../src/webhooks/dispatcher';
import { createTestEvent } from '../src/webhooks/events';

import { resetDb } from './helpers/db';
import { createTestEndpoint } from './helpers/webhooks';

/**
 * O receptor de demonstração é o "outro lado" do vídeo: se ele não aceitar o
 * que o worker envia, a demo mente. Por isso a ponta a ponta real — worker
 * enviando de verdade para o receptor, que verifica com a biblioteca de
 * referência.
 */
describe('receptor de demonstração', () => {
  let close: () => Promise<void>;
  const lines: string[] = [];

  async function start(options: Parameters<typeof createDemoReceiver>[0]) {
    const demo = createDemoReceiver({ ...options, log: (line) => lines.push(line) });
    await new Promise<void>((resolve) => demo.server.listen(0, '127.0.0.1', resolve));
    close = () => new Promise((resolve) => demo.server.close(() => resolve()));
    const { port } = demo.server.address() as AddressInfo;
    return { ...demo, url: `http://127.0.0.1:${port}/webhook` };
  }

  beforeEach(async () => {
    await resetDb();
    lines.length = 0;
  });

  afterEach(async () => {
    await close?.();
  });

  it('aceita a entrega do worker, verificando a assinatura', async () => {
    const { endpoint, secret } = await createTestEndpoint();
    const demo = await start({ secret });
    await prisma.webhookEndpoint.update({ where: { id: endpoint.id }, data: { url: demo.url } });
    const { deliveryId } = await createTestEvent(prisma, endpoint.id);

    await processBatch({ schedule: [0] });

    expect(demo.received).toHaveLength(1);
    expect(demo.received[0].type).toBe('webhook.test');
    expect((await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: deliveryId } })).status).toBe('DELIVERED');
  });

  it('FAIL_FIRST=1: a 1ª tentativa falha, a retentativa é aceita — o mesmo evento, uma vez só', async () => {
    const { endpoint, secret } = await createTestEndpoint();
    const demo = await start({ secret, failFirst: 1 });
    await prisma.webhookEndpoint.update({ where: { id: endpoint.id }, data: { url: demo.url } });
    const { deliveryId } = await createTestEvent(prisma, endpoint.id);

    const t0 = new Date();
    await processBatch({ now: t0, schedule: [0, 5], random: () => 0.5 });
    await processBatch({ now: new Date(t0.getTime() + 5_000), schedule: [0, 5], random: () => 0.5 });

    expect(demo.received).toHaveLength(1);
    expect(lines.some((line) => line.includes('falha simulada'))).toBe(true);
    const delivery = await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: deliveryId } });
    expect(delivery).toMatchObject({ status: 'DELIVERED', attemptCount: 2 });
  });

  it('assinatura com outro segredo é recusada com 401', async () => {
    const { endpoint } = await createTestEndpoint();
    const demo = await start({ secret: (await createTestEndpoint()).secret });
    await prisma.webhookEndpoint.update({ where: { id: endpoint.id }, data: { url: demo.url } });
    const { deliveryId } = await createTestEvent(prisma, endpoint.id);

    await processBatch({ schedule: [0, 5] });

    expect(demo.received).toHaveLength(0);
    const attempts = await prisma.webhookAttempt.findMany({ where: { deliveryId } });
    expect(attempts[0].responseStatus).toBe(401);
  });
});
