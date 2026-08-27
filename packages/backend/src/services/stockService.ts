import { Prisma, StockMovement } from '@prisma/client';

import { HttpError } from '../shared/httpError';
import { logger } from '../shared/logger';
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

export type AdjustmentDeltaRow = {
  productId?: string;
  previousQuantity: number | null;
  newQuantity: number | null;
};

/**
 * Soma o efeito de movimentações ADJUSTMENT no saldo, uma por uma.
 *
 * `IN`/`OUT`/`INITIAL_STOCK` são comutativos (soma é soma, ordem não
 * importa) e continuam agregados via `groupBy` nos dois pontos que usam
 * este helper (`currentBalance` aqui, `balancesFor` em `routes/products.ts`).
 * `ADJUSTMENT` NÃO é comutativo por natureza — fixa um saldo absoluto num
 * ponto no tempo — mas seu efeito INCREMENTAL é sempre exatamente
 * `newQuantity - previousQuantity`. Somar esse delta (em vez de achar "o
 * ajuste mais recente" e tratá-lo como baseline) dá o mesmo resultado sem
 * precisar de uma noção de "checkpoint": a soma de TODOS os deltas de TODAS
 * as movimentações (de qualquer tipo, em qualquer ordem) já é o saldo final,
 * porque `previousQuantity` de cada ajuste sempre reflete o saldo real no
 * momento em que foi criado (`recordAdjustmentInTx` garante isso).
 *
 * DECISÃO REGISTRADA: uma `ADJUSTMENT` sem `previousQuantity`/`newQuantity`
 * preenchidos nunca deveria existir (o `StockService` sempre preenche os
 * dois) — só é possível por escrita direta no banco fora deste serviço
 * (dado legado/corrompido). Nesse caso, o efeito dela no saldo é tratado
 * como zero (não lança erro — não queremos que uma única linha corrompida
 * derrube uma listagem inteira de produtos) e a ocorrência é logada como
 * warning, para não ficar silenciosa a quem opera o sistema.
 */
export function sumAdjustmentDeltas(rows: AdjustmentDeltaRow[]): number {
  let total = 0;
  for (const row of rows) {
    if (row.previousQuantity === null || row.newQuantity === null) {
      logger.warn(
        { productId: row.productId },
        'StockMovement ADJUSTMENT sem previousQuantity/newQuantity — efeito tratado como zero no cálculo de saldo.',
      );
      continue;
    }
    total += row.newQuantity - row.previousQuantity;
  }
  return total;
}

/** Saldo atual do produto — ver `sumAdjustmentDeltas` para a regra de ADJUSTMENT. */
async function currentBalance(tx: Prisma.TransactionClient, productId: string): Promise<number> {
  const agg = await tx.stockMovement.groupBy({
    by: ['type'],
    where: { productId, type: { in: ['IN', 'OUT', 'INITIAL_STOCK'] } },
    _sum: { quantity: true },
  });
  const sumIn =
    (agg.find((a) => a.type === 'IN')?._sum.quantity ?? 0) +
    (agg.find((a) => a.type === 'INITIAL_STOCK')?._sum.quantity ?? 0);
  const sumOut = agg.find((a) => a.type === 'OUT')?._sum.quantity ?? 0;

  const adjustments = await tx.stockMovement.findMany({
    where: { productId, type: 'ADJUSTMENT' },
    select: { previousQuantity: true, newQuantity: true },
  });

  return sumIn - sumOut + sumAdjustmentDeltas(adjustments);
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
