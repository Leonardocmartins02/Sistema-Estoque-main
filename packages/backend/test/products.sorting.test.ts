import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/app';
import { prisma } from '../src/shared/prisma';
import { resetDb } from './helpers/db';
import { createTestUser, loginAndGetToken } from './helpers/auth';

/**
 * Task 3 (D-A) — ordenação global aplicada ANTES da paginação.
 *
 * Regra: busca → filtros → orderBy → desempate estável → skip/take. Nunca
 * "seleciona a página e ordena o array dela". Todo `orderBy` paginado termina
 * com `id`, senão `OFFSET` sobre valores repetidos duplica ou salta linhas.
 *
 * SD-1 (implementation-plan.md §9.3.1): a collation nativa de cada ambiente é
 * aceita. Por isso **nenhuma** asserção aqui depende de acento, caixa ou
 * locale — os fixtures usam ASCII inequívoco (`Produto 00`..`Produto 24`,
 * `SKU-00`..`SKU-24`). Um teste que dependesse de collation mediria o
 * ambiente, não a regra.
 */
describe('GET /api/products — ordenação global antes da paginação (D-A)', () => {
  const app = createServer();
  let token: string;

  /** 25 > pageSize 10: a ordenação precisa atravessar 3 páginas para ser provada. */
  const TOTAL = 25;
  const PAGE_SIZE = 10;

  beforeAll(async () => {
    await resetDb();
    const { user, password } = await createTestUser('ordenacao@example.com', 'senha-forte-123');
    token = await loginAndGetToken(app, user.email, password);

    for (let i = 0; i < TOTAL; i += 1) {
      const n = String(i).padStart(2, '0');
      await prisma.product.create({
        data: { name: `Produto ${n}`, sku: `SKU-${n}`, minStock: 0 },
      });
    }
  });

  async function fetchPage(params: Record<string, string | number>) {
    const search = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString();
    return request(app).get(`/api/products?${search}`).set('Authorization', `Bearer ${token}`);
  }

  /** Concatena as páginas na ordem em que o usuário as veria ao navegar. */
  async function collectAllPages(params: Record<string, string | number>) {
    const names: string[] = [];
    const ids: string[] = [];
    const pages = Math.ceil(TOTAL / PAGE_SIZE);
    for (let page = 1; page <= pages; page += 1) {
      const res = await fetchPage({ ...params, page, pageSize: PAGE_SIZE });
      expect(res.status).toBe(200);
      for (const item of res.body.items as Array<{ id: string; name: string }>) {
        names.push(item.name);
        ids.push(item.id);
      }
    }
    return { names, ids };
  }

  describe('whitelist de parâmetros', () => {
    it('rejeita sortBy fora da whitelist com 400, sem cair em default silencioso', async () => {
      const res = await fetchPage({ sortBy: 'createdAt' });
      expect(res.status).toBe(400);
    });

    it('rejeita sortDir fora da whitelist com 400', async () => {
      const res = await fetchPage({ sortBy: 'name', sortDir: 'ascending' });
      expect(res.status).toBe(400);
    });

    it('rejeita tentativa de injeção no campo de ordenação', async () => {
      const res = await fetchPage({ sortBy: 'name; DROP TABLE products' });
      expect(res.status).toBe(400);
    });
  });

  describe('compatibilidade com chamadas existentes', () => {
    it('sem parâmetro de ordenação, mantém o default name asc', async () => {
      const res = await fetchPage({ page: 1, pageSize: PAGE_SIZE });
      expect(res.status).toBe(200);
      expect(res.body.items.map((p: { name: string }) => p.name)).toEqual([
        'Produto 00',
        'Produto 01',
        'Produto 02',
        'Produto 03',
        'Produto 04',
        'Produto 05',
        'Produto 06',
        'Produto 07',
        'Produto 08',
        'Produto 09',
      ]);
    });
  });

  describe('a ordenação atravessa as páginas', () => {
    it('name asc: a concatenação das páginas é a sequência global ordenada', async () => {
      const { names } = await collectAllPages({ sortBy: 'name', sortDir: 'asc' });
      expect(names).toHaveLength(TOTAL);
      expect(names).toEqual([...names].sort());
      expect(names[0]).toBe('Produto 00');
      expect(names[TOTAL - 1]).toBe('Produto 24');
    });

    it('name desc: a concatenação das páginas é a sequência global invertida', async () => {
      const { names } = await collectAllPages({ sortBy: 'name', sortDir: 'desc' });
      expect(names).toHaveLength(TOTAL);
      expect(names).toEqual([...names].sort().reverse());
      expect(names[0]).toBe('Produto 24');
      expect(names[TOTAL - 1]).toBe('Produto 00');
    });

    it('sku asc e desc atravessam as páginas na ordem global', async () => {
      const asc = await collectAllPages({ sortBy: 'sku', sortDir: 'asc' });
      expect(asc.names).toHaveLength(TOTAL);
      expect(asc.names).toEqual([...asc.names].sort());

      const desc = await collectAllPages({ sortBy: 'sku', sortDir: 'desc' });
      expect(desc.names).toEqual([...desc.names].sort().reverse());
    });

    it('nenhum item é duplicado ou omitido ao percorrer todas as páginas', async () => {
      const { ids } = await collectAllPages({ sortBy: 'name', sortDir: 'asc' });
      expect(ids).toHaveLength(TOTAL);
      expect(new Set(ids).size).toBe(TOTAL);
    });
  });

  describe('desempate estável', () => {
    /**
     * Os 25 produtos não têm movimentação, logo `balance` empata em 100% dos
     * registros. Sem `id` como último critério do `orderBy`, a ordem entre
     * páginas fica à mercê do plano de execução e o mesmo produto pode
     * aparecer em duas páginas — ou sumir de todas.
     */
    it('com todos os saldos empatados, nenhum item se repete nem some entre páginas', async () => {
      const { ids } = await collectAllPages({ sortBy: 'balance', sortDir: 'asc' });
      expect(ids).toHaveLength(TOTAL);
      expect(new Set(ids).size).toBe(TOTAL);
    });

    /**
     * Ausência de duplicata sozinha é um teste fraco: numa tabela pequena o
     * Postgres pode devolver ordem consistente por acaso. Com o desempate
     * explícito por `id` asc, o empate total em `balance` obriga a sequência a
     * ser exatamente a ordem de `id` — isso, sim, só passa se o desempate
     * existir.
     */
    it('com empate total, a sequência segue exatamente a ordem de id (asc)', async () => {
      const { ids } = await collectAllPages({ sortBy: 'balance', sortDir: 'asc' });
      expect(ids).toEqual([...ids].sort());
    });

    it('duas requisições idênticas devolvem a mesma página quando há empate', async () => {
      const first = await fetchPage({
        sortBy: 'balance',
        sortDir: 'asc',
        page: 2,
        pageSize: PAGE_SIZE,
      });
      const second = await fetchPage({
        sortBy: 'balance',
        sortDir: 'asc',
        page: 2,
        pageSize: PAGE_SIZE,
      });
      expect(first.status).toBe(200);
      expect(first.body.items.map((p: { id: string }) => p.id)).toEqual(
        second.body.items.map((p: { id: string }) => p.id),
      );
    });

    it('o desempate por id também vale para name empatado entre páginas', async () => {
      // Produtos homônimos: só o `id` distingue, e é ele que estabiliza a ordem.
      await prisma.product.create({ data: { name: 'Homonimo', sku: 'HOM-1', minStock: 0 } });
      await prisma.product.create({ data: { name: 'Homonimo', sku: 'HOM-2', minStock: 0 } });
      await prisma.product.create({ data: { name: 'Homonimo', sku: 'HOM-3', minStock: 0 } });

      const first = await fetchPage({ search: 'Homonimo', sortBy: 'name', sortDir: 'asc', pageSize: 2, page: 1 });
      const second = await fetchPage({ search: 'Homonimo', sortBy: 'name', sortDir: 'asc', pageSize: 2, page: 2 });
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      const ids = [
        ...first.body.items.map((p: { id: string }) => p.id),
        ...second.body.items.map((p: { id: string }) => p.id),
      ];
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3);
      // Nomes idênticos: só o desempate por id define a ordem entre páginas.
      expect(ids).toEqual([...ids].sort());

      // Limpa para não afetar os demais testes deste arquivo.
      await prisma.product.deleteMany({ where: { name: 'Homonimo' } });
    });
  });

  describe('ordenação combinada com busca e filtro', () => {
    it('preserva a busca e ordena o subconjunto inteiro', async () => {
      const res = await fetchPage({
        search: 'Produto 1',
        sortBy: 'name',
        sortDir: 'desc',
        pageSize: 0,
      });
      expect(res.status).toBe(200);
      const names = res.body.items.map((p: { name: string }) => p.name);
      // 'Produto 1' casa com Produto 10..19 → 10 itens (não existe "Produto 1",
      // o primeiro é "Produto 01", que casa com "Produto 0").
      expect(names).toHaveLength(10);
      expect(names).toEqual([...names].sort().reverse());
    });

    it('preserva o filtro de status e ordena o subconjunto inteiro', async () => {
      const res = await fetchPage({
        status: 'OUT',
        sortBy: 'name',
        sortDir: 'asc',
        pageSize: 0,
      });
      expect(res.status).toBe(200);
      const names = res.body.items.map((p: { name: string }) => p.name);
      // Todos os 25 estão sem movimentação, logo todos são OUT.
      expect(names).toHaveLength(TOTAL);
      expect(names).toEqual([...names].sort());
    });
  });
});
