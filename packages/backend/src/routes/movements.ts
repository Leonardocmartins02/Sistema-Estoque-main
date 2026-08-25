import { Router } from 'express';
import { prisma } from '../shared/prisma';
import { z } from 'zod';

const router = Router();

const movementSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  quantity: z.number().int().positive(),
  date: z.string().datetime().optional(),
  note: z.string().optional().nullable(),
});

router.get('/:id/movements', async (req, res) => {
  const id = req.params.id;
  const page = Math.max(Number(req.query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize || 20), 1), 100);
  const type = String(req.query.type || '').trim(); // IN | OUT | ''
  const from = String(req.query.from || '').trim(); // ISO date
  const to = String(req.query.to || '').trim(); // ISO date
  const q = String(req.query.q || '').trim(); // substring of note

  const where: any = { productId: id };
  if (type === 'IN' || type === 'OUT') {
    where.type = type;
  }
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) {
      where.date = { ...(where.date || {}), gte: d };
    }
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) {
      where.date = { ...(where.date || {}), lte: d };
    }
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
});

router.post('/:id/movements', async (req, res, next) => {
  try {
    console.log('Received POST request to create movement:', {
      params: req.params,
      body: req.body,
      headers: req.headers
    });
    
    const id = req.params.id;
    console.log('Validating movement data...');
    const data = movementSchema.parse(req.body);
    console.log('Validated movement data:', data);

    // Validate product exists
    console.log('Checking if product exists:', id);
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      console.error('Product not found:', id);
      return res.status(404).json({ message: 'Produto não encontrado' });
    }
    console.log('Product found:', product);

    // Compute current balance
    const agg = await prisma.stockMovement.groupBy({
      by: ['type'],
      where: { productId: id },
      _sum: { quantity: true },
    });
    const sumIn = agg.find((a) => a.type === 'IN')?._sum.quantity || 0;
    const sumOut = agg.find((a) => a.type === 'OUT')?._sum.quantity || 0;
    const balance = sumIn - sumOut;

    if (data.type === 'OUT' && data.quantity > balance) {
      const errorMessage = `Insufficient balance. Requested: ${data.quantity}, Available: ${balance}`;
      console.error(errorMessage);
      return res.status(422).json({ 
        message: 'Saída maior que o saldo atual do produto.',
        details: errorMessage
      });
    }

    console.log('Creating movement with data:', {
      productId: id,
      type: data.type,
      quantity: data.quantity,
      date: data.date ? new Date(data.date) : new Date(),
      note: data.note ?? undefined,
    });

    const created = await prisma.stockMovement.create({
      data: {
        productId: id,
        type: data.type,
        quantity: data.quantity,
        date: data.date ? new Date(data.date) : new Date(),
        note: data.note ?? undefined,
      },
    });

    console.log('Movement created successfully:', created);
    res.status(201).json(created);
  } catch (err) {
    console.error('Error in POST /:id/movements:', err);
    next(err);
  }
});

export default router;
