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

    // Lock, saldo, validação e previousQuantity/newQuantity/userId ficam no
    // StockService (ver stockService.ts) — mesmo mecanismo de movements.ts.
    const movement = await recordMovement({
      productId,
      type: 'OUT',
      quantity,
      userId: req.user!.id,
      note: note || `Baixa rápida - ${quantity} un.`,
      insufficientStockMessage: 'Estoque insuficiente.',
    });

    // Leitura à parte, só para formatar a resposta (nome/sku do produto) —
    // não faz parte da decisão de saldo, que já foi resolvida acima.
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });

    res.json({
      success: true,
      movement,
      newBalance: movement.newQuantity,
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Query params validados na borda HTTP; limites preservados (pageSize 1..100,
// default 20). Datas fora do formato agora viram 400 em vez de serem ignoradas.
//
// `sortBy`/`sortDir` são whitelist (`z.enum`): a chave que chega do cliente
// nunca vira campo de `orderBy` diretamente — ela é traduzida por
// `historyOrderBy()` abaixo. Valor fora do domínio é 400, nunca um default
// silencioso. Default `date desc` preserva o contrato anterior, quando a rota
// tinha essa ordem fixa e não aceitava parâmetro nenhum.
const historyQuerySchema = z.object({
  page: pageParam,
  pageSize: pageSizeParam({ min: 1, max: 100, default: 20 }),
  q: optionalTextParam,
  from: optionalDateParam,
  to: optionalDateParam,
  sortBy: z.enum(['productName', 'productSku', 'quantity', 'date']).default('date'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

type HistorySortKey = z.infer<typeof historyQuerySchema>['sortBy'];

/**
 * Tradução chave externa → campo Prisma conhecido.
 *
 * `productName`/`productSku` ordenam pela relação (`product.name`/`sku`), que
 * o Prisma expressa em `orderBy` — a ordenação continua no banco, antes de
 * `skip`/`take`.
 *
 * `id` é o desempate final obrigatório (Task 3, item d): sem ele, `OFFSET`
 * sobre valores repetidos — duas baixas do mesmo produto, mesma quantidade ou
 * mesmo instante — duplica ou salta linhas entre páginas, e a ordenação
 * "global" volta a mentir, só que de forma mais difícil de perceber.
 */
function historyOrderBy(
  sortBy: HistorySortKey,
  sortDir: 'asc' | 'desc',
): Prisma.StockMovementOrderByWithRelationInput[] {
  const primary: Record<HistorySortKey, Prisma.StockMovementOrderByWithRelationInput> = {
    productName: { product: { name: sortDir } },
    productSku: { product: { sku: sortDir } },
    quantity: { quantity: sortDir },
    date: { date: sortDir },
  };
  return [primary[sortBy], { id: 'asc' }];
}

// Histórico geral de baixas (movimentos OUT)
router.get('/history', async (req, res, next) => {
  try {
    const { page, pageSize, q, from, to, sortBy, sortDir } = historyQuerySchema.parse(req.query);

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
        orderBy: historyOrderBy(sortBy, sortDir),
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
