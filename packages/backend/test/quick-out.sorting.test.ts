import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/app';
import { prisma } from '../src/shared/prisma';
import { resetDb } from './helpers/db';
import { createTestUser, loginAndGetToken } from './helpers/auth';

/**
 * Task 3 (D-A) — `GET /api/quick-out/history` ganha ordenação global real.
 *
 * Hoje a rota tem `orderBy: { date: 'desc' }` fixo e não aceita parâmetro
 * nenhum, enquanto a interface oferece quatro critérios e os aplica **só
 * sobre a página carregada** (F-03). Estes testes fixam o contrato que torna
 * os quatro critérios verdadeiros: whitelist, ordenação no banco antes da
 * paginação e desempate estável por `id`.
 *
 * SD-1 (§9.3.1): nenhuma asserção depende de acento, caixa ou locale — os
 * fixtures usam ASCII inequívoco.
 */
describe('GET /api/quick-out/history — ordenação global (D-A / F-03)', () => {
  const app = createServer();
  let token: string;

  /** 25 saídas > pageSize 10: prova que a ordem atravessa 3 páginas. */
  const TOTAL = 25;
  const PAGE_SIZE = 10;

  beforeAll(async () => {
    await resetDb();
    const { user, password } = await createTestUser('qohsort@example.com', 'senha-forte-123');
    token = await loginAndGetToken(app, user.email, password);

    // Dois produtos com nome/SKU em ordem ASCII inequívoca e oposta entre si,
    // para que ordenar por productName e por productSku produza ordens
    // distintas e verificáveis.
    const alfa = await prisma.product.create({
      data: { name: 'Alfa', sku: 'SKU-Z', minStock: 0 },
    });
    const beta = await prisma.product.create({
      data: { name: 'Beta', sku: 'SKU-A', minStock: 0 },
    });

    await prisma.stockMovement.create({
      data: { productId: alfa.id, type: 'IN', quantity: 10_000, date: new Date('2026-01-01T00:00:00Z') },
    });
    await prisma.stockMovement.create({
      data: { productId: beta.id, type: 'IN', quantity: 10_000, date: new Date('2026-01-01T00:00:00Z') },
    });

    // 25 saídas com quantidade e data estritamente crescentes, alternando o
    // produto. Quantidade e data são únicas — a ordem esperada é inequívoca.
    for (let i = 0; i < TOTAL; i += 1) {
      const day = String(i + 1).padStart(2, '0');
      await prisma.stockMovement.create({
        data: {
          productId: i % 2 === 0 ? alfa.id : beta.id,
          type: 'OUT',
          quantity: i + 1,
          date: new Date(`2026-02-${day}T10:00:00Z`),
          note: `baixa ${String(i).padStart(2, '0')}`,
        },
      });
    }
  });

  async function fetchPage(params: Record<string, string | number>) {
    const search = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString();
    return request(app)
      .get(`/api/quick-out/history?${search}`)
      .set('Authorization', `Bearer ${token}`);
  }

  type HistoryItem = {
    id: string;
    productName: string;
    productSku: string;
    quantity: number;
    date: string;
  };

  async function collectAllPages(params: Record<string, string | number>) {
    const items: HistoryItem[] = [];
    const pages = Math.ceil(TOTAL / PAGE_SIZE);
    for (let page = 1; page <= pages; page += 1) {
      const res = await fetchPage({ ...params, page, pageSize: PAGE_SIZE });
      expect(res.status).toBe(200);
      items.push(...(res.body.items as HistoryItem[]));
    }
    return items;
  }

  describe('whitelist de parâmetros', () => {
    it('rejeita sortBy fora da whitelist com 400', async () => {
      const res = await fetchPage({ sortBy: 'note' });
      expect(res.status).toBe(400);
    });

    it('rejeita sortDir fora da whitelist com 400', async () => {
      const res = await fetchPage({ sortBy: 'date', sortDir: 'descending' });
      expect(res.status).toBe(400);
    });

    it('rejeita tentativa de injeção no campo de ordenação', async () => {
      const res = await fetchPage({ sortBy: 'product.name; DROP TABLE "StockMovement"' });
      expect(res.status).toBe(400);
    });

    it('aceita os quatro critérios previstos pelo plano', async () => {
      for (const sortBy of ['productName', 'productSku', 'quantity', 'date']) {
        const res = await fetchPage({ sortBy, sortDir: 'asc', pageSize: 1 });
        expect(res.status).toBe(200);
      }
    });
  });

  describe('compatibilidade com chamadas existentes', () => {
    it('sem parâmetro de ordenação, mantém o default date desc', async () => {
      const res = await fetchPage({ page: 1, pageSize: PAGE_SIZE });
      expect(res.status).toBe(200);
      const dates = (res.body.items as HistoryItem[]).map((m) => new Date(m.date).getTime());
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
      // A saída mais recente é a de maior quantidade (25), pela construção do fixture.
      expect((res.body.items as HistoryItem[])[0].quantity).toBe(TOTAL);
    });
  });

  describe('a ordenação atravessa as páginas', () => {
    it('quantity asc: a concatenação das páginas é a sequência global crescente', async () => {
      const items = await collectAllPages({ sortBy: 'quantity', sortDir: 'asc' });
      const quantities = items.map((m) => m.quantity);
      expect(quantities).toHaveLength(TOTAL);
      expect(quantities).toEqual([...quantities].sort((a, b) => a - b));
      expect(quantities[0]).toBe(1);
      expect(quantities[TOTAL - 1]).toBe(TOTAL);
    });

    it('quantity desc: a concatenação das páginas é a sequência global decrescente', async () => {
      const items = await collectAllPages({ sortBy: 'quantity', sortDir: 'desc' });
      const quantities = items.map((m) => m.quantity);
      expect(quantities).toEqual([...quantities].sort((a, b) => b - a));
      expect(quantities[0]).toBe(TOTAL);
      expect(quantities[TOTAL - 1]).toBe(1);
    });

    it('date asc atravessa as páginas na ordem global', async () => {
      const items = await collectAllPages({ sortBy: 'date', sortDir: 'asc' });
      const dates = items.map((m) => new Date(m.date).getTime());
      expect(dates).toHaveLength(TOTAL);
      expect(dates).toEqual([...dates].sort((a, b) => a - b));
    });

    it('productName asc agrupa Alfa antes de Beta ao longo de todas as páginas', async () => {
      const items = await collectAllPages({ sortBy: 'productName', sortDir: 'asc' });
      const names = items.map((m) => m.productName);
      expect(names).toHaveLength(TOTAL);
      expect(names).toEqual([...names].sort());
      expect(names[0]).toBe('Alfa');
      expect(names[TOTAL - 1]).toBe('Beta');
    });

    it('productName desc inverte o agrupamento globalmente', async () => {
      const items = await collectAllPages({ sortBy: 'productName', sortDir: 'desc' });
      const names = items.map((m) => m.productName);
      expect(names).toEqual([...names].sort().reverse());
      expect(names[0]).toBe('Beta');
      expect(names[TOTAL - 1]).toBe('Alfa');
    });

    it('productSku asc ordena por SKU, não por nome do produto', async () => {
      const items = await collectAllPages({ sortBy: 'productSku', sortDir: 'asc' });
      const skus = items.map((m) => m.productSku);
      expect(skus).toHaveLength(TOTAL);
      expect(skus).toEqual([...skus].sort());
      // SKU-A pertence a "Beta": ordenar por SKU tem que diferir de ordenar por nome.
      expect(skus[0]).toBe('SKU-A');
      expect(items[0].productName).toBe('Beta');
    });

    it('nenhum registro é duplicado ou omitido ao percorrer todas as páginas', async () => {
      const items = await collectAllPages({ sortBy: 'quantity', sortDir: 'asc' });
      const ids = items.map((m) => m.id);
      expect(ids).toHaveLength(TOTAL);
      expect(new Set(ids).size).toBe(TOTAL);
    });
  });

  describe('desempate estável', () => {
    /**
     * `productName` empata em ~metade dos registros (13 Alfa, 12 Beta). Sem
     * `id` como último critério, paginar sobre esse empate pode repetir ou
     * perder linhas.
     */
    it('com productName empatado, nenhum registro se repete nem some entre páginas', async () => {
      const items = await collectAllPages({ sortBy: 'productName', sortDir: 'asc' });
      const ids = items.map((m) => m.id);
      expect(new Set(ids).size).toBe(TOTAL);
    });

    /**
     * Prova o desempate em vez de só constatar ausência de duplicata: dentro
     * de cada grupo de `productName` idêntico, a ordem tem de ser exatamente a
     * de `id` asc. Sem o desempate explícito isso não se sustenta.
     */
    it('dentro de cada grupo de productName, a ordem segue exatamente id (asc)', async () => {
      const items = await collectAllPages({ sortBy: 'productName', sortDir: 'asc' });
      for (const group of ['Alfa', 'Beta']) {
        const ids = items.filter((m) => m.productName === group).map((m) => m.id);
        expect(ids.length).toBeGreaterThan(1);
        expect(ids).toEqual([...ids].sort());
      }
    });

    it('duas requisições idênticas devolvem a mesma página quando há empate', async () => {
      const first = await fetchPage({ sortBy: 'productName', sortDir: 'asc', page: 2, pageSize: PAGE_SIZE });
      const second = await fetchPage({ sortBy: 'productName', sortDir: 'asc', page: 2, pageSize: PAGE_SIZE });
      expect(first.status).toBe(200);
      expect((first.body.items as HistoryItem[]).map((m) => m.id)).toEqual(
        (second.body.items as HistoryItem[]).map((m) => m.id),
      );
    });
  });

  describe('ordenação combinada com busca e intervalo de datas', () => {
    it('preserva a busca textual e ordena o subconjunto inteiro', async () => {
      const res = await fetchPage({ q: 'Alfa', sortBy: 'quantity', sortDir: 'desc', pageSize: 100 });
      expect(res.status).toBe(200);
      const items = res.body.items as HistoryItem[];
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((m) => m.productName === 'Alfa')).toBe(true);
      const quantities = items.map((m) => m.quantity);
      expect(quantities).toEqual([...quantities].sort((a, b) => b - a));
    });

    it('preserva o intervalo de datas e ordena o subconjunto inteiro', async () => {
      const res = await fetchPage({
        from: '2026-02-01T00:00:00Z',
        to: '2026-02-10T23:59:59Z',
        sortBy: 'quantity',
        sortDir: 'asc',
        pageSize: 100,
      });
      expect(res.status).toBe(200);
      const quantities = (res.body.items as HistoryItem[]).map((m) => m.quantity);
      expect(quantities).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });
});
