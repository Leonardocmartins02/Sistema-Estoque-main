import { Prisma } from '@prisma/client';
import type { ProductStockSummary } from '@simplestock/shared';
import { Router } from 'express';
import { z } from 'zod';

import { recordMovementInTx, sumAdjustmentDeltas } from '../services/stockService';
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
 * Saldo de vários produtos em UMA ida ao banco (mais uma para ADJUSTMENT).
 *
 * `IN`/`OUT`/`INITIAL_STOCK` continuam num único `groupBy` por
 * `['productId', 'type']` — comutativos, soma direta no banco. `ADJUSTMENT`
 * NÃO tem sinal fixo por tipo (pode subir ou descer o saldo com o mesmo
 * `type`) — por isso NUNCA deve ser tratado como "tudo que não é IN é
 * negativo" (esse era o bug: `INITIAL_STOCK` e `ADJUSTMENT` ficavam com
 * sinal invertido). O efeito de cada ADJUSTMENT é `newQuantity -
 * previousQuantity`, somado via `sumAdjustmentDeltas` (mesma função usada
 * por `stockService.currentBalance`, ver lá a explicação completa e a
 * decisão registrada para ADJUSTMENT incompleto/legado).
 */
async function balancesFor(productIds: string[]): Promise<Map<string, number>> {
  const balances = new Map<string, number>(productIds.map((id) => [id, 0]));
  if (productIds.length === 0) return balances;

  const grouped = await prisma.stockMovement.groupBy({
    by: ['productId', 'type'],
    where: { productId: { in: productIds }, type: { in: ['IN', 'OUT', 'INITIAL_STOCK'] } },
    _sum: { quantity: true },
  });

  for (const row of grouped) {
    const quantity = row._sum.quantity ?? 0;
    const signed = row.type === 'OUT' ? -quantity : quantity;
    balances.set(row.productId, (balances.get(row.productId) ?? 0) + signed);
  }

  const adjustments = await prisma.stockMovement.findMany({
    where: { productId: { in: productIds }, type: 'ADJUSTMENT' },
    select: { productId: true, previousQuantity: true, newQuantity: true },
  });
  const adjustmentsByProduct = new Map<string, typeof adjustments>();
  for (const adjustment of adjustments) {
    const list = adjustmentsByProduct.get(adjustment.productId) ?? [];
    list.push(adjustment);
    adjustmentsByProduct.set(adjustment.productId, list);
  }
  for (const [productId, rows] of adjustmentsByProduct) {
    balances.set(productId, (balances.get(productId) ?? 0) + sumAdjustmentDeltas(rows));
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
      // Ordenação por `name`/`sku` é do banco, seguindo a collation da coluna.
      // SD-1 (docs/ui-ux/implementation-plan.md §9.3.1, 31/08/2026) decidiu
      // **aceitar a collation nativa de cada ambiente**: ordem linguística
      // pt-BR idêntica entre local, CI e produção não é requisito desta
      // versão, e a diferença é risco residual aceito e documentado. Por isso
      // não há coluna normalizada, ICU nem raw SQL aqui — e, se isso virar
      // requisito, entra como task funcional própria. O que **não** volta é
      // reordenar em memória a página já carregada: era isso que fazia a
      // ordenação parecer global sem ser.
      // `id` é o desempate final obrigatório (Task 3, item d): com nomes ou
      // SKUs repetidos, `OFFSET` sem critério determinístico pode devolver o
      // mesmo produto em duas páginas — ou omiti-lo de todas. A ordenação
      // continua acontecendo no banco, antes de `skip`/`take`.
      const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
        sortBy === 'sku' ? { sku: sortDir } : { name: sortDir },
        { id: 'asc' },
      ];

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

    // 3-F2 (REV-01): `name`/`sku` usam o PostgreSQL como autoridade de
    // ordenação, também neste caminho — a mesma que o caminho sem valor
    // derivado já usa (linha ~164). Antes, este caminho reordenava os
    // candidatos em JS com `.toLowerCase()` (ver histórico do commit), uma
    // autoridade DIFERENTE da collation do banco: o mesmo `sortBy=name`
    // podia produzir ordens diferentes só por existir um filtro de `status`
    // na consulta. SD-1 (implementation-plan.md §9.3.1) aceita a collation
    // nativa de cada ambiente — mas exige que ela seja usada de forma
    // consistente, nunca substituída por uma comparação de string em JS.
    //
    // Para `sortBy=balance` a ordem da consulta de candidatos não importa:
    // o array é inteiramente reordenado por saldo abaixo, e `id` desempata.
    const candidatesOrderBy: Prisma.ProductOrderByWithRelationInput[] =
      sortBy === 'balance'
        ? [{ id: 'asc' }]
        : [sortBy === 'sku' ? { sku: sortDir } : { name: sortDir }, { id: 'asc' }];

    const candidates = await prisma.product.findMany({ where, orderBy: candidatesOrderBy });
    const balances = await balancesFor(candidates.map((product) => product.id));
    const withBalance = candidates.map((product) => ({
      ...product,
      balance: balances.get(product.id) ?? 0,
    }));

    // `Array.prototype.filter` preserva a ordem relativa dos elementos que
    // passam — não reordena. Para `name`/`sku`, `candidates` já chegou do
    // Prisma na ordem final (collation do banco, com `id` como desempate);
    // aplicar o filtro de status não destrói essa ordem, só remove itens.
    const filtered = withBalance.filter((product) => matchesStatus(product, status));

    // `balance` é campo derivado (não existe como coluna): precisa do
    // comparador em memória. `name`/`sku` já saíram ordenados do banco em
    // `candidates`/`filtered` — reordená-los aqui reintroduziria exatamente
    // o problema desta correção.
    let sorted = filtered;
    if (sortBy === 'balance') {
      const direction = sortDir === 'asc' ? 1 : -1;
      sorted = [...filtered].sort((a, b) => {
        if (a.balance !== b.balance) return (a.balance - b.balance) * direction;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
    }

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

    // Produto + movimentação de estoque inicial na mesma transação: se a
    // gravação da movimentação falhar, a criação do produto também é
    // revertida — antes eram dois `await` separados e um produto podia
    // ficar órfão, sem sua movimentação inicial, se o segundo falhasse.
    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data: { ...productData } });

      if ((initialStock ?? 0) > 0) {
        await recordMovementInTx(tx, {
          productId: product.id,
          type: 'INITIAL_STOCK',
          quantity: initialStock,
          userId: req.user!.id,
          note: 'Estoque inicial',
        });
      }

      return product;
    });

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
