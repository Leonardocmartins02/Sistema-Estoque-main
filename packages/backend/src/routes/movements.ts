import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { recordMovement } from '../services/stockService';
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
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'INITIAL_STOCK']).optional(),
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

    const [rows, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { email: true } } },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    // Achata `user: { email }` em `userEmail` — mesmo padrão de exposição
    // mínima de `routes/auth.ts` (nunca o registro completo do usuário).
    // `null` quando a movimentação não tem `userId` (registro anterior à
    // Fase 1 de auditoria), nunca omitido silenciosamente.
    const items = rows.map(({ user, ...movement }) => ({ ...movement, userEmail: user?.email ?? null }));

    res.json({ items, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/movements', async (req, res, next) => {
  try {
    const id = req.params.id;
    const data = movementSchema.parse(req.body);

    // Lock, cálculo de saldo, validação de saldo insuficiente e gravação de
    // previousQuantity/newQuantity/userId ficam centralizados no StockService
    // (mesmo padrão de lock de linha que já existia aqui, agora reaproveitado
    // por movements.ts, quick-out.ts e products.ts).
    const created = await recordMovement({
      productId: id,
      type: data.type,
      quantity: data.quantity,
      userId: req.user!.id,
      date: data.date ? new Date(data.date) : undefined,
      note: data.note,
      insufficientStockMessage: 'Saída maior que o saldo atual do produto.',
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

export default router;
