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

const router = Router();

const movementSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  quantity: z.number().int().positive(),
  date: z.string().datetime().optional(),
  note: z.string().optional().nullable(),
});

// Query params validados na borda HTTP (antes eram `String()`/`Number()` na
// mão, que engoliam entrada inválida em silêncio). Limites preservados:
// pageSize entre 1 e 100, default 20.
const movementListQuerySchema = z.object({
  page: pageParam,
  pageSize: pageSizeParam({ min: 1, max: 100, default: 20 }),
  type: z.enum(['IN', 'OUT']).optional(),
  from: optionalDateParam,
  to: optionalDateParam,
  q: optionalTextParam,
});

router.get('/:id/movements', async (req, res, next) => {
  try {
    const id = req.params.id;
    const { page, pageSize, type, from, to, q } = movementListQuerySchema.parse(req.query);

    const where: Prisma.StockMovementWhereInput = { productId: id };
    if (type) {
      where.type = type;
    }
    if (from || to) {
      where.date = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    if (q) {
      where.note = { contains: q, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    res.json({ items, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/movements', async (req, res, next) => {
  try {
    const id = req.params.id;
    const data = movementSchema.parse(req.body);

    // Toda a sequência ler-saldo -> decidir -> escrever-movimentação roda
    // dentro de uma transação com lock de linha (`FOR UPDATE`) no produto:
    // duas requisições OUT concorrentes para o mesmo produto serializam
    // aqui, a segunda só lê o saldo depois que a primeira commitou. Sem
    // isso, ambas podiam ler o mesmo saldo e ambas passar na checagem,
    // deixando o estoque negativo.
    const created = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Product" WHERE "id" = ${id} FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new HttpError(404, 'Produto não encontrado.');
      }

      const agg = await tx.stockMovement.groupBy({
        by: ['type'],
        where: { productId: id },
        _sum: { quantity: true },
      });
      const sumIn = agg.find((a) => a.type === 'IN')?._sum.quantity ?? 0;
      const sumOut = agg.find((a) => a.type === 'OUT')?._sum.quantity ?? 0;
      const balance = sumIn - sumOut;

      if (data.type === 'OUT' && data.quantity > balance) {
        throw new HttpError(422, 'Saída maior que o saldo atual do produto.');
      }

      return tx.stockMovement.create({
        data: {
          productId: id,
          type: data.type,
          quantity: data.quantity,
          date: data.date ? new Date(data.date) : new Date(),
          note: data.note ?? undefined,
        },
      });
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

export default router;
