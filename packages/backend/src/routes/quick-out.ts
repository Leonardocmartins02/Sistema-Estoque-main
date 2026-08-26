import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { HttpError } from '../shared/httpError';
import { prisma } from '../shared/prisma';

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

// Histórico geral de baixas (movimentos OUT)
router.get('/history', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize || 20), 1), 100);
    const q = String(req.query.q || '').trim(); // busca por nome, sku ou note
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    // Filtro base: apenas saídas (OUT)
    const whereBase: Prisma.StockMovementWhereInput = { type: 'OUT' };

    const dateFilter: Prisma.DateTimeFilter = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) {
        dateFilter.gte = d;
      }
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) {
        dateFilter.lte = d;
      }
    }
    if (Object.keys(dateFilter).length > 0) {
      whereBase.date = dateFilter;
    }

    // Se tiver termo de busca, fazemos em memória após join para nome/sku
    const [itemsRaw] = await Promise.all([
      prisma.stockMovement.findMany({
        where: whereBase,
        include: { product: true },
        orderBy: { date: 'desc' },
      }),
      prisma.stockMovement.count({ where: whereBase }),
    ]);

    const normalize = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
    const filtered = q
      ? itemsRaw.filter((m) => {
          const term = normalize(q);
          const name = normalize(m.product?.name || '');
          const sku = normalize(m.product?.sku || '');
          const note = normalize(m.note || '');
          return name.includes(term) || sku.includes(term) || note.includes(term);
        })
      : itemsRaw;

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = filtered.slice(start, end).map((m) => ({
      id: m.id,
      productId: m.productId,
      productName: m.product?.name || '',
      productSku: m.product?.sku || '',
      quantity: m.quantity,
      date: m.date,
      note: m.note || null,
    }));

    res.json({ items: pageItems, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

export default router;
