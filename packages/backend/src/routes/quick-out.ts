import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { HttpError } from '../shared/httpError';
import { prisma } from '../shared/prisma';
import {
  optionalDateParam,
  optionalTextParam,
  pageParam,
  pageSizeParam,
} from '../shared/queryParams';
import { normalizeForSearch } from '../shared/text';

const router = Router();

const quickOutSchema = z.object({
  productId: z.string().min(1, 'ID do produto é obrigatório'),
  quantity: z.number().int().positive('Quantidade deve ser maior que zero'),
  note: z.string().optional(),
});

router.post('/', async (req, res, next) => {
  try {
    const { productId, quantity, note } = quickOutSchema.parse(req.body);

    // Mesma proteção de transação + lock de linha usada em movements.ts —
    // ver o comentário lá para o motivo (condição de corrida no saldo).
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Product" WHERE "id" = ${productId} FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new HttpError(404, 'Produto não encontrado.');
      }
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });

      const agg = await tx.stockMovement.groupBy({
        by: ['type'],
        where: { productId },
        _sum: { quantity: true },
      });
      const sumIn = agg.find((a) => a.type === 'IN')?._sum.quantity ?? 0;
      const sumOut = agg.find((a) => a.type === 'OUT')?._sum.quantity ?? 0;
      const currentBalance = sumIn - sumOut;

      if (quantity > currentBalance) {
        throw new HttpError(422, 'Estoque insuficiente.');
      }

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          type: 'OUT',
          quantity,
          note: note || `Baixa rápida - ${quantity} un.`,
        },
      });

      await tx.product.update({ where: { id: productId }, data: { updatedAt: new Date() } });

      return { movement, product, newBalance: currentBalance - quantity };
    });

    res.json({
      success: true,
      movement: result.movement,
      newBalance: result.newBalance,
      product: {
        id: result.product.id,
        name: result.product.name,
        sku: result.product.sku,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Query params validados na borda HTTP; limites preservados (pageSize 1..100,
// default 20). Datas fora do formato agora viram 400 em vez de serem ignoradas.
const historyQuerySchema = z.object({
  page: pageParam,
  pageSize: pageSizeParam({ min: 1, max: 100, default: 20 }),
  q: optionalTextParam,
  from: optionalDateParam,
  to: optionalDateParam,
});

// Histórico geral de baixas (movimentos OUT)
router.get('/history', async (req, res, next) => {
  try {
    const { page, pageSize, q, from, to } = historyQuerySchema.parse(req.query);

    // Filtro base: apenas saídas (OUT), agora com data/paginação/contagem no
    // banco. Antes esta rota carregava TODOS os movimentos OUT com
    // `include: { product: true }` a cada request e paginava em memória.
    const where: Prisma.StockMovementWhereInput = { type: 'OUT' };
    if (from || to) {
      where.date = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    if (q) {
      // Mesma decisão de `routes/products.ts`: a busca é diacritic-insensitive
      // ("lapis" encontra "Lápis") e o Postgres não faz isso com ILIKE. Aqui o
      // termo ainda casa contra nome/SKU do produto E contra a nota, então o
      // pré-filtro varre uma projeção estreita (id, nota e nome/SKU do produto)
      // dos movimentos já restritos por tipo/data, e devolve só os ids que
      // casam para o `where`. A partir daí `orderBy`/`skip`/`take`/`count`
      // rodam no banco. Migrar para a extensão `unaccent` (+ índice funcional)
      // elimina este pré-filtro — ver backlog.
      const term = normalizeForSearch(q);
      const candidates = await prisma.stockMovement.findMany({
        where,
        select: { id: true, note: true, product: { select: { name: true, sku: true } } },
      });
      where.id = {
        in: candidates
          .filter(
            (movement) =>
              normalizeForSearch(movement.product.name).includes(term) ||
              normalizeForSearch(movement.product.sku).includes(term) ||
              normalizeForSearch(movement.note ?? '').includes(term),
          )
          .map((movement) => movement.id),
      };
    }

    const [rows, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    const items = rows.map((movement) => ({
      id: movement.id,
      productId: movement.productId,
      productName: movement.product.name,
      productSku: movement.product.sku,
      quantity: movement.quantity,
      date: movement.date,
      note: movement.note || null,
    }));

    res.json({ items, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

export default router;
