import { Router } from 'express';
import { prisma } from '../shared/prisma';
import { z } from 'zod';

const router = Router();

router.get('/', async (req, res) => {
  const search = String(req.query.search || '').trim();
  const page = Math.max(Number(req.query.page || 1), 1);
  // Suporta pageSize=0 (retorna todos) e aumenta limite máximo para 1000
  const rawPageSize = Number(req.query.pageSize ?? 10);
  const pageSize = rawPageSize === 0 ? 0 : Math.min(Math.max(rawPageSize, 1), 1000);
  const sortByRaw = String(req.query.sortBy || 'name');
  const sortDirRaw = String(req.query.sortDir || 'asc');
  const sortBy = ['name', 'sku', 'balance'].includes(sortByRaw) ? (sortByRaw as 'name' | 'sku' | 'balance') : 'name';
  const sortDir = sortDirRaw === 'desc' ? 'desc' : 'asc';
  const statusParam = String(req.query.status || '').trim();
  const statusFilter = statusParam
    ? statusParam.split(',').map((s) => s.toUpperCase()).filter((s) => ['OK', 'ATTN', 'OUT'].includes(s)) as Array<'OK'|'ATTN'|'OUT'>
    : [];

  // Normalize function to remove diacritics and lowercase
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  let products = await prisma.product.findMany({ orderBy: { name: 'asc' } });

  if (search) {
    const nQuery = normalize(search);
    products = products.filter((p) => {
      const nName = normalize(p.name);
      const nSku = normalize(p.sku);
      return nName.includes(nQuery) || nSku.includes(nQuery);
    });
  }

  // Calculate balance per product
  const productsWithBalance = await Promise.all(
    products.map(async (p) => {
      const agg = await prisma.stockMovement.groupBy({
        by: ['type'],
        where: { productId: p.id },
        _sum: { quantity: true },
      });
      const sumIn = agg.find((a) => a.type === 'IN')?._sum.quantity || 0;
      const sumOut = agg.find((a) => a.type === 'OUT')?._sum.quantity || 0;
      return { ...p, balance: sumIn - sumOut };
    })
  );

  // Optional status filtering before sorting/pagination
  const filteredByStatus = statusFilter.length === 0
    ? productsWithBalance
    : productsWithBalance.filter((p) => {
        const isOut = p.balance === 0;
        const isAttn = p.balance > 0 && p.balance < p.minStock;
        const isOk = p.balance >= p.minStock;
        const map: Record<'OK'|'ATTN'|'OUT', boolean> = { OK: isOk, ATTN: isAttn, OUT: isOut };
        return statusFilter.some((s) => map[s]);
      });

  // Sort according to sortBy/sortDir
  const sorted = [...filteredByStatus].sort((a, b) => {
    let av: string | number = '';
    let bv: string | number = '';
    if (sortBy === 'name') {
      av = a.name.toLowerCase();
      bv = b.name.toLowerCase();
    } else if (sortBy === 'sku') {
      av = a.sku.toLowerCase();
      bv = b.sku.toLowerCase();
    } else {
      // balance
      av = a.balance;
      bv = b.balance;
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginação em memória (para datasets pequenos). Se pageSize=0, retorna todos
  const total = sorted.length;
  let items = sorted;
  let respPage = page;
  let respPageSize = pageSize;
  if (pageSize !== 0) {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    items = sorted.slice(start, end);
  } else {
    // quando retornando todos, padroniza page=1
    respPage = 1;
    respPageSize = 0;
  }

  res.json({ items, total, page: respPage, pageSize: respPageSize });
});

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  description: z.string().optional().nullable(),
  minStock: z.number().int().min(0).default(0),
  initialStock: z.number().int().min(0).optional().default(0),
});

router.post('/', async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);

    // Ensure unique SKU
    const existing = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (existing) return res.status(409).json({ message: 'SKU já cadastrado.' });

    const { initialStock, ...productData } = data;
    const created = await prisma.product.create({ data: { ...productData } });

    if ((initialStock ?? 0) > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: created.id,
          type: 'IN',
          quantity: initialStock!,
          date: new Date(),
        },
      });
    }
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res) => {
  const id = req.params.id;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return res.status(404).json({ message: 'Produto não encontrado' });

  const agg = await prisma.stockMovement.groupBy({
    by: ['type'],
    where: { productId: id },
    _sum: { quantity: true },
  });
  const sumIn = agg.find((a) => a.type === 'IN')?._sum.quantity || 0;
  const sumOut = agg.find((a) => a.type === 'OUT')?._sum.quantity || 0;

  res.json({ ...product, balance: sumIn - sumOut });
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const data = productSchema.partial().parse(req.body);

    // Prevent updating to an existing SKU of another product
    if (data.sku) {
      const existing = await prisma.product.findUnique({ where: { sku: data.sku } });
      if (existing && existing.id !== id) return res.status(409).json({ message: 'SKU já em uso.' });
    }

    const updated = await prisma.product.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return res.status(404).json({ message: 'Produto não encontrado' });

  // Remover movimentações primeiro para evitar violação de FK
  await prisma.stockMovement.deleteMany({ where: { productId: id } });
  await prisma.product.delete({ where: { id } });
  res.status(204).send();
});

export default router;
