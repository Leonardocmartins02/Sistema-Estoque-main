import { Prisma, StockMovement } from '@prisma/client';

import { HttpError } from '../shared/httpError';
import { prisma } from '../shared/prisma';

/**
 * Tipo de movimentação que `recordMovement`/`recordMovementInTx` sabe
 * gravar. `ADJUSTMENT` NÃO entra neste union de propósito: diferente de
 * `IN`/`OUT`/`INITIAL_STOCK`, que têm sinal fixo por tipo (`SIGNED_DIRECTION`
 * abaixo), um ajuste pode subir ou descer o saldo com o mesmo `type` — o
 * dado de entrada é o saldo alvo, não uma quantidade com sinal implícito.
 * Por isso `ADJUSTMENT` tem seu próprio par de funções
 * (`recordAdjustment`/`recordAdjustmentInTx`, feature "Ajuste de Estoque"),
 * com uma fórmula de cálculo diferente, em vez de forçar esse caso dentro de
 * `SIGNED_DIRECTION`.
 */
export type RecordableMovementType = 'IN' | 'OUT' | 'INITIAL_STOCK';

export type RecordMovementInput = {
  productId: string;
  type: RecordableMovementType;
  quantity: number;
  /** Sempre o id do usuário autenticado (req.user.id) — nunca um valor vindo do body. */
  userId: string;
  date?: Date;
  note?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  /** Mensagem de erro específica da rota chamadora para o caso de saldo insuficiente. */
  insufficientStockMessage?: string;
};

const SIGNED_DIRECTION: Record<RecordableMovementType, 1 | -1> = {
  IN: 1,
  INITIAL_STOCK: 1,
  OUT: -1,
};

/**
 * Saldo atual do produto. `IN`/`OUT`/`INITIAL_STOCK` são comutativos — a
 * ordem não importa, soma é soma. `ADJUSTMENT` NÃO é: ele fixa um saldo
 * absoluto num ponto no tempo (`newQuantity`), então qualquer soma de
 * quantidades assinadas que ignore esse ponto de corte conta duas vezes (ou
 * zero vezes) o que o ajuste já corrigiu. Por isso: acha o `ADJUSTMENT` mais
 * recente (se houver) e usa `newQuantity` dele como baseline, somando só as
 * movimentações IN/OUT/INITIAL_STOCK criadas DEPOIS dele. Sem nenhum
 * `ADJUSTMENT` ainda, o comportamento é idêntico ao de antes (soma de tudo).
 */
async function currentBalance(tx: Prisma.TransactionClient, productId: string): Promise<number> {
  const lastAdjustment = await tx.stockMovement.findFirst({
    where: { productId, type: 'ADJUSTMENT' },
    orderBy: { createdAt: 'desc' },
    select: { newQuantity: true, createdAt: true },
  });

  const where: Prisma.StockMovementWhereInput = lastAdjustment
    ? { productId, createdAt: { gt: lastAdjustment.createdAt } }
    : { productId };

  const agg = await tx.stockMovement.groupBy({
    by: ['type'],
    where,
    _sum: { quantity: true },
  });
  const sumIn =
    (agg.find((a) => a.type === 'IN')?._sum.quantity ?? 0) +
    (agg.find((a) => a.type === 'INITIAL_STOCK')?._sum.quantity ?? 0);
  const sumOut = agg.find((a) => a.type === 'OUT')?._sum.quantity ?? 0;
  const baseline = lastAdjustment?.newQuantity ?? 0;

  return baseline + sumIn - sumOut;
}

/**
 * Núcleo do StockService: lock de linha no produto + saldo atual + validação
 * + criação da movimentação com previousQuantity/newQuantity preenchidos.
 * Sempre roda com `FOR UPDATE`, mesmo quando o produto acabou de ser criado
 * na mesma transação (custo desprezível) — um único caminho de validação,
 * sem variante "sem lock" que alguém possa reusar incorretamente.
 */
export async function recordMovementInTx(
  tx: Prisma.TransactionClient,
  input: RecordMovementInput,
): Promise<StockMovement> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Product" WHERE "id" = ${input.productId} FOR UPDATE
  `;
  if (locked.length === 0) {
    throw new HttpError(404, 'Produto não encontrado.');
  }

  const previousQuantity = await currentBalance(tx, input.productId);
  const newQuantity = previousQuantity + SIGNED_DIRECTION[input.type] * input.quantity;

  if (newQuantity < 0) {
    throw new HttpError(422, input.insufficientStockMessage ?? 'Saldo insuficiente para esta movimentação.');
  }

  return tx.stockMovement.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      date: input.date ?? new Date(),
      note: input.note ?? undefined,
      previousQuantity,
      newQuantity,
      userId: input.userId,
      referenceType: input.referenceType ?? undefined,
      referenceId: input.referenceId ?? undefined,
    },
  });
}

/** Variante que abre sua própria transação — uso padrão para rotas que só gravam uma movimentação. */
export async function recordMovement(input: RecordMovementInput): Promise<StockMovement> {
  return prisma.$transaction((tx) => recordMovementInTx(tx, input));
}

export type RecordAdjustmentInput = {
  productId: string;
  /** Saldo alvo informado pelo usuário — a contagem física observada, nunca um delta. */
  targetQuantity: number;
  /** Saldo que o usuário via na tela quando iniciou o ajuste — proteção contra perda de atualização concorrente. */
  expectedPreviousQuantity: number;
  reason: string;
  /** Sempre o id do usuário autenticado (req.user.id) — nunca um valor vindo do body. */
  userId: string;
};

/**
 * Núcleo do ajuste de estoque (feature "Ajuste de Estoque"): mesmo lock de
 * linha + transação de `recordMovementInTx`, mas com uma fórmula de cálculo
 * diferente — `newQuantity` é o DADO DE ENTRADA (o saldo alvo), e
 * `quantity`/o sentido da variação são DERIVADOS dele, ao contrário de
 * `IN`/`OUT`/`INITIAL_STOCK`, onde `newQuantity` é derivado de um `quantity`
 * com sinal fixo por tipo.
 *
 * Duas validações de negócio acontecem dentro da transação, depois do lock:
 * 1. Se o saldo real (lido agora) diverge do `expectedPreviousQuantity` que
 *    o usuário via, a operação é um CONFLITO (409) — nunca aplica "por
 *    cima" de uma alteração concorrente que o usuário não viu.
 * 2. Se o saldo alvo é igual ao saldo real, não há ajuste de verdade a
 *    registrar (400) — evita poluir o histórico com "ajustes" sem efeito.
 */
export async function recordAdjustmentInTx(
  tx: Prisma.TransactionClient,
  input: RecordAdjustmentInput,
): Promise<StockMovement> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Product" WHERE "id" = ${input.productId} FOR UPDATE
  `;
  if (locked.length === 0) {
    throw new HttpError(404, 'Produto não encontrado.');
  }

  const previousQuantity = await currentBalance(tx, input.productId);

  if (previousQuantity !== input.expectedPreviousQuantity) {
    throw new HttpError(
      409,
      'O saldo deste produto mudou desde que você o visualizou. Revise o novo saldo antes de tentar novamente.',
    );
  }

  if (input.targetQuantity === previousQuantity) {
    throw new HttpError(400, 'O novo saldo informado é igual ao saldo atual — nenhum ajuste é necessário.');
  }

  const newQuantity = input.targetQuantity;
  const quantity = Math.abs(newQuantity - previousQuantity);

  return tx.stockMovement.create({
    data: {
      productId: input.productId,
      type: 'ADJUSTMENT',
      quantity,
      previousQuantity,
      newQuantity,
      note: input.reason,
      userId: input.userId,
    },
  });
}

/** Variante que abre sua própria transação — uso padrão para a rota HTTP de ajuste. */
export async function recordAdjustment(input: RecordAdjustmentInput): Promise<StockMovement> {
  return prisma.$transaction((tx) => recordAdjustmentInTx(tx, input));
}
