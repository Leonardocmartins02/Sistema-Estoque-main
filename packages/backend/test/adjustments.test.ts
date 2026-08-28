import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/app';
import { prisma } from '../src/shared/prisma';
import { resetDb } from './helpers/db';
import { createTestUser, loginAndGetToken } from './helpers/auth';

/**
 * Task 1 do implementation-plan.md — StockService.recordAdjustment +
 * POST /products/:id/adjustments. Ajuste de estoque via saldo alvo (nunca
 * delta), com verificação de conflito de concorrência via
 * expectedPreviousQuantity.
 */
describe('POST /products/:id/adjustments', () => {
  const app = createServer();
  let token: string;
  let userId: string;

  beforeAll(async () => {
    await resetDb();
    const { user, password } = await createTestUser('ajuste@example.com', 'senha-forte-123');
    userId = user.id;
    token = await loginAndGetToken(app, user.email, password);
  });

  async function createProductWithBalance(sku: string, balance: number) {
    const product = await prisma.product.create({
      data: { name: 'Produto de Ajuste', sku, minStock: 0 },
    });
    if (balance > 0) {
      await prisma.stockMovement.create({
        data: { productId: product.id, type: 'IN', quantity: balance, previousQuantity: 0, newQuantity: balance, userId },
      });
    }
    return product;
  }

  /** Espelha a mesma regra de `stockService.currentBalance`: um ADJUSTMENT
   * fixa um saldo absoluto (`newQuantity`) num ponto no tempo; só IN/OUT/
   * INITIAL_STOCK criados depois dele somam a partir dali. */
  async function currentBalance(productId: string): Promise<number> {
    const lastAdjustment = await prisma.stockMovement.findFirst({
      where: { productId, type: 'ADJUSTMENT' },
      orderBy: { createdAt: 'desc' },
      select: { newQuantity: true, createdAt: true },
    });

    const agg = await prisma.stockMovement.groupBy({
      by: ['type'],
      where: lastAdjustment ? { productId, createdAt: { gt: lastAdjustment.createdAt } } : { productId },
      _sum: { quantity: true },
    });
    const sumIn =
      (agg.find((a) => a.type === 'IN')?._sum.quantity ?? 0) +
      (agg.find((a) => a.type === 'INITIAL_STOCK')?._sum.quantity ?? 0);
    const sumOut = agg.find((a) => a.type === 'OUT')?._sum.quantity ?? 0;
    return (lastAdjustment?.newQuantity ?? 0) + sumIn - sumOut;
  }

  it('ajuste para baixo: grava previousQuantity/newQuantity/quantity corretos', async () => {
    const product = await createProductWithBalance(`ADJ-DOWN-${Date.now()}`, 20);

    const res = await request(app)
      .post(`/api/products/${product.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 18, expectedPreviousQuantity: 20, reason: 'Contagem física mensal' });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('ADJUSTMENT');
    expect(res.body.previousQuantity).toBe(20);
    expect(res.body.newQuantity).toBe(18);
    expect(res.body.quantity).toBe(2);
    expect(res.body.userId).toBe(userId);
    expect(res.body.note).toBe('Contagem física mensal');
  });

  it('ajuste para cima: grava previousQuantity/newQuantity/quantity corretos', async () => {
    const product = await createProductWithBalance(`ADJ-UP-${Date.now()}`, 10);

    const res = await request(app)
      .post(`/api/products/${product.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 12, expectedPreviousQuantity: 10, reason: 'Correção de contagem' });

    expect(res.status).toBe(201);
    expect(res.body.previousQuantity).toBe(10);
    expect(res.body.newQuantity).toBe(12);
    expect(res.body.quantity).toBe(2);
  });

  it('ajuste para zero é permitido', async () => {
    const product = await createProductWithBalance(`ADJ-ZERO-${Date.now()}`, 5);

    const res = await request(app)
      .post(`/api/products/${product.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 0, expectedPreviousQuantity: 5, reason: 'Perda total' });

    expect(res.status).toBe(201);
    expect(res.body.previousQuantity).toBe(5);
    expect(res.body.newQuantity).toBe(0);
  });

  it('alvo igual ao saldo atual é rejeitado e não cria movimentação', async () => {
    const product = await createProductWithBalance(`ADJ-SAME-${Date.now()}`, 20);
    const countBefore = await prisma.stockMovement.count({ where: { productId: product.id } });

    const res = await request(app)
      .post(`/api/products/${product.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 20, expectedPreviousQuantity: 20, reason: 'Sem divergência' });

    expect(res.status).toBe(400);

    const countAfter = await prisma.stockMovement.count({ where: { productId: product.id } });
    expect(countAfter).toBe(countBefore);
  });

  it('alvo negativo é rejeitado', async () => {
    const product = await createProductWithBalance(`ADJ-NEG-${Date.now()}`, 20);

    const res = await request(app)
      .post(`/api/products/${product.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: -1, expectedPreviousQuantity: 20, reason: 'Motivo válido' });

    expect(res.status).toBe(400);
  });

  /**
   * Prisma `Int` sobre PostgreSQL é `int4` (máximo 2.147.483.647). Sem teto no
   * Zod, um alvo acima disso passava na borda HTTP e só estourava no INSERT,
   * virando um 500 genérico (erro não-HttpError/não-ZodError) em vez do 400 que
   * a entrada inválida merece. O limite não é estético: é o do tipo persistido.
   */
  it('alvo acima do máximo de um INT do PostgreSQL é rejeitado com 400, sem tocar o banco', async () => {
    const product = await createProductWithBalance(`ADJ-OVERFLOW-${Date.now()}`, 20);
    const countBefore = await prisma.stockMovement.count({ where: { productId: product.id } });

    const res = await request(app)
      .post(`/api/products/${product.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 2_147_483_648, expectedPreviousQuantity: 20, reason: 'Estouro de int4' });

    expect(res.status).toBe(400);

    const countAfter = await prisma.stockMovement.count({ where: { productId: product.id } });
    expect(countAfter).toBe(countBefore);
  });

  it('alvo exatamente no máximo de um INT do PostgreSQL é aceito', async () => {
    const product = await createProductWithBalance(`ADJ-MAXINT-${Date.now()}`, 20);

    const res = await request(app)
      .post(`/api/products/${product.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 2_147_483_647, expectedPreviousQuantity: 20, reason: 'Limite exato do tipo' });

    expect(res.status).toBe(201);
    expect(res.body.newQuantity).toBe(2_147_483_647);
  });

  it('motivo vazio/em branco é rejeitado', async () => {
    const product = await createProductWithBalance(`ADJ-NOREASON-${Date.now()}`, 20);

    const res = await request(app)
      .post(`/api/products/${product.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 18, expectedPreviousQuantity: 20, reason: '   ' });

    expect(res.status).toBe(400);
  });

  it('motivo com 501 caracteres é rejeitado; com exatamente 500 é aceito', async () => {
    const productTooLong = await createProductWithBalance(`ADJ-TOOLONG-${Date.now()}`, 20);
    const resTooLong = await request(app)
      .post(`/api/products/${productTooLong.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 18, expectedPreviousQuantity: 20, reason: 'a'.repeat(501) });
    expect(resTooLong.status).toBe(400);

    const productExact = await createProductWithBalance(`ADJ-EXACT500-${Date.now()}`, 20);
    const resExact = await request(app)
      .post(`/api/products/${productExact.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 18, expectedPreviousQuantity: 20, reason: 'a'.repeat(500) });
    expect(resExact.status).toBe(201);
  });

  it('userId gravado é sempre o do usuário autenticado, mesmo com userId forjado no corpo', async () => {
    const product = await createProductWithBalance(`ADJ-USERID-${Date.now()}`, 20);

    const res = await request(app)
      .post(`/api/products/${product.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 18, expectedPreviousQuantity: 20, reason: 'Motivo válido', userId: 'usuario-forjado-xyz' });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(userId);
    expect(res.body.userId).not.toBe('usuario-forjado-xyz');
  });

  it('conflito: saldo real mudou desde que o usuário viu a tela — rejeita com 409, sem gravar', async () => {
    const product = await createProductWithBalance(`ADJ-CONFLICT-${Date.now()}`, 20);

    // Alguém mais baixou o estoque enquanto o formulário estava aberto.
    await request(app)
      .post(`/api/products/${product.id}/movements`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'OUT', quantity: 5 });

    const countBefore = await prisma.stockMovement.count({ where: { productId: product.id } });

    const res = await request(app)
      .post(`/api/products/${product.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 18, expectedPreviousQuantity: 20, reason: 'Contagem física mensal' });

    expect(res.status).toBe(409);

    const countAfter = await prisma.stockMovement.count({ where: { productId: product.id } });
    expect(countAfter).toBe(countBefore);
    expect(await currentBalance(product.id)).toBe(15);
  });

  it('ADJUSTMENT para baixo seguido de ADJUSTMENT para cima: o segundo enxerga o saldo resultante do primeiro', async () => {
    const product = await createProductWithBalance(`ADJ-SEQ-${Date.now()}`, 20);

    const first = await request(app)
      .post(`/api/products/${product.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 18, expectedPreviousQuantity: 20, reason: 'Contagem física — primeira conferência' });
    expect(first.status).toBe(201);
    expect(first.body.previousQuantity).toBe(20);
    expect(first.body.newQuantity).toBe(18);

    // O segundo ajuste usa 18 como expectedPreviousQuantity — só é aceito se
    // o saldo calculado pelo sistema já refletir o primeiro ajuste. Antes da
    // correção de currentBalance(), o sistema ainda enxergava 20 (ignorava
    // ADJUSTMENT por completo), e este segundo pedido seria rejeitado com
    // 409 mesmo estando correto.
    const second = await request(app)
      .post(`/api/products/${product.id}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 25, expectedPreviousQuantity: 18, reason: 'Contagem física — recontagem' });
    expect(second.status).toBe(201);
    expect(second.body.previousQuantity).toBe(18);
    expect(second.body.newQuantity).toBe(25);

    expect(await currentBalance(product.id)).toBe(25);

    // Nenhuma movimentação indevida: exatamente IN inicial + 2 ADJUSTMENT, nada a mais.
    const total = await prisma.stockMovement.count({ where: { productId: product.id } });
    expect(total).toBe(3);
  });

  it('produto não encontrado retorna 404', async () => {
    const res = await request(app)
      .post('/api/products/produto-inexistente/adjustments')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetQuantity: 18, expectedPreviousQuantity: 20, reason: 'Motivo válido' });

    expect(res.status).toBe(404);
  });

  it('sem autenticação retorna 401', async () => {
    const product = await createProductWithBalance(`ADJ-NOAUTH-${Date.now()}`, 20);

    const res = await request(app)
      .post(`/api/products/${product.id}/adjustments`)
      .send({ targetQuantity: 18, expectedPreviousQuantity: 20, reason: 'Motivo válido' });

    expect(res.status).toBe(401);
  });

  /**
   * Concorrência real: duas requisições simultâneas com o MESMO
   * expectedPreviousQuantity (20, o saldo que ambas "viam") mas ALVOS
   * DIFERENTES (18 e 15). Como os alvos divergem entre si, o saldo real após
   * o vencedor gravar nunca pode coincidir por acaso com o
   * expectedPreviousQuantity do perdedor (20) — então o perdedor recebe
   * sempre 409, nunca 400. Isso torna o resultado determinístico e permite
   * validar a integridade real do saldo, não só o status HTTP.
   */
  it('concorrência: duas requisições simultâneas nunca aplicam as duas — saldo final íntegro', async () => {
    const product = await createProductWithBalance(`ADJ-RACE-${Date.now()}`, 20);

    const sendA = () =>
      request(app)
        .post(`/api/products/${product.id}/adjustments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetQuantity: 18, expectedPreviousQuantity: 20, reason: 'Contagem operador A' });
    const sendB = () =>
      request(app)
        .post(`/api/products/${product.id}/adjustments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetQuantity: 15, expectedPreviousQuantity: 20, reason: 'Contagem operador B' });

    const [resA, resB] = await Promise.all([sendA(), sendB()]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    // Nunca as duas sucedem, e o perdedor é sempre 409 (nunca 400), pelo
    // argumento de desenho do teste explicado acima.
    expect(statuses).toEqual([201, 409]);

    const movements = await prisma.stockMovement.findMany({
      where: { productId: product.id, type: 'ADJUSTMENT' },
    });
    // Exatamente uma movimentação de ajuste foi criada — sem duplicação.
    expect(movements).toHaveLength(1);

    const [movement] = movements;
    // Os dois operadores viam saldo 20 — é isso que deve estar registrado
    // como previousQuantity, independentemente de quem venceu.
    expect(movement.previousQuantity).toBe(20);
    // O novo saldo gravado é de quem venceu (18 ou 15) — e precisa bater
    // exatamente com o saldo real final do produto (sem perda de atualização).
    expect([18, 15]).toContain(movement.newQuantity);
    expect(await currentBalance(product.id)).toBe(movement.newQuantity);

    const winningResponse = resA.status === 201 ? resA : resB;
    expect(winningResponse.body.newQuantity).toBe(movement.newQuantity);
  });
});
