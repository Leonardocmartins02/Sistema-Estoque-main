import { Prisma } from '@prisma/client';
import type { ProductStockSummary } from '@simplestock/shared';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../shared/prisma';
import { optionalTextParam, pageParam, pageSizeParam } from '../shared/queryParams';
import { normalizeForSearch } from '../shared/text';

const router = Router();

const STOCK_STATUSES = ['OK', 'ATTN', 'OUT'] as const;
type StockStatus = (typeof STOCK_STATUSES)[number];

const listQuerySchema = z.object({
  search: optionalTextParam,
  page: pageParam,
  // `0` significa "traga todos" — contrato já consumido pelo frontend. Acima
  // disso o limite continua sendo 1000 itens por página, como antes; a
  // diferença é que agora um valor fora da faixa vira 400 em vez de ser
  // silenciosamente truncado.
  pageSize: pageSizeParam({ min: 0, max: 1000, default: 10 }),
  sortBy: z.enum(['name', 'sku', 'balance']).default('name'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
  status: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((part) => part.trim().toUpperCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(STOCK_STATUSES))),
});

/**
 * Saldo de vários produtos em UMA ida ao banco.
 *
 * Antes isto era um `stockMovement.groupBy` por produto dentro de um
 * `Promise.all` — 1 + N queries por request de listagem. Agora é um único
 * `groupBy` por `['productId', 'type']` restrito aos ids pedidos, com a
 * subtração IN - OUT feita em memória sobre o resultado agregado.
 */
async function balancesFor(productIds: string[]): Promise<Map<string, number>> {
  const balances = new Map<string, number>(productIds.map((id) => [id, 0]));
  if (productIds.length === 0) return balances;

  const grouped = await prisma.stockMovement.groupBy({
    by: ['productId', 'type'],
    where: { productId: { in: productIds } },
    _sum: { quantity: true },
  });

  for (const row of grouped) {
    const quantity = row._sum.quantity ?? 0;
    const signed = row.type === 'IN' ? quantity : -quantity;
    balances.set(row.productId, (balances.get(row.productId) ?? 0) + signed);
  }

  return balances;
}

function matchesStatus(
  product: { balance: number; minStock: number },
  statuses: StockStatus[],
): boolean {
  if (statuses.length === 0) return true;
  const map: Record<StockStatus, boolean> = {
    OUT: product.balance === 0,
    ATTN: product.balance > 0 && product.balance < product.minStock,
    OK: product.balance >= product.minStock,
  };
  return statuses.some((status) => map[status]);
}

router.get('/', async (req, res, next) => {
  try {
    const { search, page, pageSize, sortBy, sortDir, status } = listQuerySchema.parse(req.query);
    // `pageSize=0` = "todos": a resposta padroniza `page: 1`, como antes.
    const respPage = pageSize === 0 ? 1 : page;

    const where: Prisma.ProductWhereInput = {};

    if (search) {
      // DECISÃO — busca insensível a acentos.
      // O comportamento histórico (e esperado pelo frontend) é diacritic-
      // insensitive: "lapis" encontra "Lápis". O Postgres não faz isso com
      // `contains`/`mode: 'insensitive'` — ILIKE resolve só caixa, não acento.
      // As opções eram:
      //   (a) trocar por `mode: 'insensitive'` puro — empurraria tudo para o
      //       banco, mas QUEBRARIA a busca sem acento (regressão visível);
      //   (b) extensão `unaccent` + índice funcional — é a solução correta a
      //       longo prazo, mas exige `CREATE EXTENSION` (privilégio que nem
      //       todo Postgres gerenciado concede ao owner) e não pôde ser
      //       validada contra um banco real neste ambiente;
      //   (c) manter a normalização em memória APENAS para o caso de busca.
      // Escolhemos (c): o caminho quente (listagem sem busca) fica 100% no
      // banco, e quando há termo de busca varremos só uma projeção estreita
      // (id/name/sku, sem movimentações) para resolver os ids que casam,
      // devolvendo-os ao `where`. Filtro, ordenação, `skip`/`take` e `count`
      // continuam no banco. Item de backlog: migrar para (b) quando houver um
      // Postgres onde a extensão possa ser validada.
      const term = normalizeForSearch(search);
      const candidates = await prisma.product.findMany({
        select: { id: true, name: true, sku: true },
      });
      const matchingIds = candidates
        .filter(
          (candidate) =>
            normalizeForSearch(candidate.name).includes(term) ||
            normalizeForSearch(candidate.sku).includes(term),
        )
        .map((candidate) => candidate.id);

      if (matchingIds.length === 0) {
        res.json({ items: [], total: 0, page: respPage, pageSize });
        return;
      }
      where.id = { in: matchingIds };
    }

    // `status` filtra por saldo e `sortBy=balance` ordena por saldo — ambos são
    // valores derivados das movimentações, que o Prisma não sabe expressar em
    // `where`/`orderBy` sem uma coluna/view materializada (item de backlog
    // "saldo como coluna computada"). Só nesses dois casos caímos no caminho
    // em memória — e mesmo lá o saldo sai de UMA agregação, nunca de N.
    const needsDerivedValue = status.length > 0 || sortBy === 'balance';

    if (!needsDerivedValue) {
      // Ordenação por `name`/`sku` agora é do banco. Nuance conhecida e
      // aceita: a ordenação em memória anterior comparava `toLowerCase()`, o
      // que era case-insensitive; no banco a ordem passa a seguir a collation
      // da coluna. O container do projeto usa `postgres:16-alpine` (musl), cuja
      // collation é efetivamente byte-order — "Zebra" vem antes de "abacaxi" e
      // acentuados vêm depois de "Z". Se isso incomodar na UI, a correção certa
      // é uma collation ICU não determinística (ou `citext`) na coluna, não
      // voltar a ordenar em memória.
      const orderBy: Prisma.ProductOrderByWithRelationInput =
        sortBy === 'sku' ? { sku: sortDir } : { name: sortDir };

      const [total, pageProducts] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({
          where,
          orderBy,
          ...(pageSize === 0 ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
        }),
      ]);

      const balances = await balancesFor(pageProducts.map((product) => product.id));
      const items = pageProducts.map((product) => ({
        ...product,
        balance: balances.get(product.id) ?? 0,
      }));

      res.json({ items, total, page: respPage, pageSize });
      return;
    }

    const candidates = await prisma.product.findMany({ where, orderBy: { name: 'asc' } });
    const balances = await balancesFor(candidates.map((product) => product.id));
    const withBalance = candidates.map((product) => ({
      ...product,
      balance: balances.get(product.id) ?? 0,
    }));

    const filtered = withBalance.filter((product) => matchesStatus(product, status));
    const direction = sortDir === 'asc' ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'balance') return (a.balance - b.balance) * direction;
      const av = sortBy === 'sku' ? a.sku.toLowerCase() : a.name.toLowerCase();
      const bv = sortBy === 'sku' ? b.sku.toLowerCase() : b.name.toLowerCase();
      if (av < bv) return -direction;
      if (av > bv) return direction;
      return 0;
    });

    const start = (page - 1) * pageSize;
    const items = pageSize === 0 ? sorted : sorted.slice(start, start + pageSize);

    res.json({ items, total: filtered.length, page: respPage, pageSize });
  } catch (err) {
    next(err);
  }
});

// Precisa vir antes de `GET /:id` — senão "summary" seria capturado como id.
router.get('/summary', async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({ select: { id: true, minStock: true } });
    const balances = await balancesFor(products.map((product) => product.id));

    const summary: ProductStockSummary = { ok: 0, attn: 0, out: 0 };
    for (const product of products) {
      const balance = balances.get(product.id) ?? 0;
      if (balance === 0) summary.out += 1;
      else if (balance < product.minStock) summary.attn += 1;
      else summary.ok += 1;
    }

    res.json(summary);
  } catch (err) {
    next(err);
  }
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
          quantity: initialStock,
          date: new Date(),
        },
      });
    }
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ message: 'Produto não encontrado' });

    const balances = await balancesFor([id]);

    res.json({ ...product, balance: balances.get(id) ?? 0 });
  } catch (err) {
    next(err);
  }
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

router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ message: 'Produto não encontrado' });

    // Remover movimentações primeiro para evitar violação de FK
    await prisma.stockMovement.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
