import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/app';
import { prisma } from '../src/shared/prisma';
import { resetDb } from './helpers/db';
import { createTestUser, loginAndGetToken } from './helpers/auth';

/**
 * Correção 3-F3 (REV-08) — os testes existentes de `sortBy=sku` e
 * `sortBy=balance` em `products.sorting.test.ts` não eram discriminativos:
 *
 * - REV-08(a): os fixtures (`Produto NN` / `SKU-NN`) têm o mesmo sufixo em
 *   nome e SKU, então ordenar por SKU produz a MESMA sequência de nomes que
 *   ordenar por nome. Uma implementação que ignorasse `sortBy=sku` e sempre
 *   ordenasse por `name` passaria despercebida — o teste só observava
 *   `item.name`, nunca `item.sku`.
 * - REV-08(b): nenhum dos 25 produtos tinha `StockMovement`, logo `balance`
 *   empatava em 100% dos casos. Os testes de `sortBy=balance` exercitavam só
 *   o desempate por `id` — uma implementação que devolvesse sempre `id asc`
 *   ignorando `balance` por completo também passaria.
 *
 * Este arquivo cria fixtures deliberadamente discriminativos para os dois
 * casos, isolado do arquivo original para não alterar as 31 asserções já
 * verdes que dependem do conjunto `Produto 00..24`.
 */
describe('GET /api/products — sortBy=sku e sortBy=balance são realmente discriminativos (REV-08 / 3-F3)', () => {
  const app = createServer();
  let token: string;

  beforeAll(async () => {
    await resetDb();
    const { user, password } = await createTestUser('discriminativo@example.com', 'senha-forte-123');
    token = await loginAndGetToken(app, user.email, password);
  });

  async function fetchPage(params: Record<string, string | number>) {
    const search = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString();
    const res = await request(app)
      .get(`/api/products?${search}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body as { items: Array<{ id: string; name: string; sku: string; balance: number }>; total: number };
  }

  describe('sortBy=sku ordena pelo campo SKU, não pelo nome', () => {
    /**
     * 12 produtos (> pageSize 10, para também provar que a ordem atravessa
     * páginas) com a ordem de SKU deliberadamente OPOSTA à ordem de nome:
     * `Nome 00` recebe o maior SKU (`SKU-11`), `Nome 11` recebe o menor
     * (`SKU-00`). Se a implementação usasse `name` quando `sortBy=sku` é
     * pedido, a sequência de SKUs observada viria em ordem DECRESCENTE em vez
     * de crescente — o teste reprovaria exatamente essa implementação.
     */
    const COUNT = 12;
    const expectedSkuAsc = Array.from({ length: COUNT }, (_, i) => `SKU-${String(i).padStart(2, '0')}`);
    const expectedNameAsc = Array.from({ length: COUNT }, (_, i) => `Nome ${String(i).padStart(2, '0')}`);

    beforeAll(async () => {
      for (let i = 0; i < COUNT; i += 1) {
        const nameSuffix = String(i).padStart(2, '0');
        const skuSuffix = String(COUNT - 1 - i).padStart(2, '0'); // ordem inversa
        await prisma.product.create({
          data: { name: `Nome ${nameSuffix}`, sku: `SKU-${skuSuffix}`, minStock: 0 },
        });
      }
    });

    it('sortBy=sku asc devolve os SKUs em ordem crescente — não a ordem dos nomes', async () => {
      const body = await fetchPage({ sortBy: 'sku', sortDir: 'asc', pageSize: 0, search: 'Nome' });
      const skus = body.items.map((p) => p.sku);
      const names = body.items.map((p) => p.name);

      expect(skus).toHaveLength(COUNT);
      expect(skus).toEqual(expectedSkuAsc);
      // A sequência de nomes correspondente é a ordem INVERSA da alfabética —
      // prova de que quem decidiu a ordem foi o SKU, não o nome.
      expect(names).toEqual([...expectedNameAsc].reverse());
      // As duas sequências (por sku vs. por name) têm de divergir; se
      // coincidissem, o teste não discriminaria nada.
      expect(names).not.toEqual(expectedNameAsc);
    });

    it('sortBy=sku desc inverte a sequência de SKUs', async () => {
      const body = await fetchPage({ sortBy: 'sku', sortDir: 'desc', pageSize: 0, search: 'Nome' });
      const skus = body.items.map((p) => p.sku);

      expect(skus).toEqual([...expectedSkuAsc].reverse());
    });

    it('a ordenação por SKU atravessa páginas na sequência global', async () => {
      const pageSize = 5;
      const collected: string[] = [];
      const pages = Math.ceil(COUNT / pageSize);
      for (let page = 1; page <= pages; page += 1) {
        const body = await fetchPage({ sortBy: 'sku', sortDir: 'asc', pageSize, page, search: 'Nome' });
        collected.push(...body.items.map((p) => p.sku));
      }
      expect(collected).toEqual(expectedSkuAsc);
    });
  });

  describe('sortBy=balance ordena por saldo real, não apenas por id', () => {
    /**
     * Saldos DISTINTOS e não-monotônicos em relação à ordem de criação:
     * A=20 (criado 1º), B=5, C=12, D=5 (criado 4º) — B e D empatam em 5,
     * provando o desempate por id dentro do próprio teste de valor real.
     *
     * Por que isto reprova "devolve sempre id asc": os produtos são criados
     * na ordem A,B,C,D. Se a API ignorasse `balance` e devolvesse a ordem de
     * `id` (que aqui coincide com a ordem de criação), o resultado seria
     * [A,B,C,D] — que não corresponde à ordem por valor (B/D empatados em
     * 5, depois C=12, depois A=20). A `expectedAsc` é montada com os ids
     * REAIS devolvidos pela criação, não hardcoded, então o teste continua
     * válido mesmo que a implementação do gerador de id mude.
     */
    let idA: string, idB: string, idC: string, idD: string;

    beforeAll(async () => {
      const a = await prisma.product.create({ data: { name: 'Produto Saldo A', sku: 'BAL-A', minStock: 0 } });
      const b = await prisma.product.create({ data: { name: 'Produto Saldo B', sku: 'BAL-B', minStock: 0 } });
      const c = await prisma.product.create({ data: { name: 'Produto Saldo C', sku: 'BAL-C', minStock: 0 } });
      const d = await prisma.product.create({ data: { name: 'Produto Saldo D', sku: 'BAL-D', minStock: 0 } });
      idA = a.id;
      idB = b.id;
      idC = c.id;
      idD = d.id;

      // Saldo real via StockMovement (mesmo mecanismo que `balancesFor` soma
      // — não é possível escrever `balance` diretamente, é campo derivado).
      await prisma.stockMovement.create({ data: { productId: idA, type: 'IN', quantity: 20, date: new Date() } });
      await prisma.stockMovement.create({ data: { productId: idB, type: 'IN', quantity: 5, date: new Date() } });
      await prisma.stockMovement.create({ data: { productId: idC, type: 'IN', quantity: 12, date: new Date() } });
      await prisma.stockMovement.create({ data: { productId: idD, type: 'IN', quantity: 5, date: new Date() } });
    });

    function expectedAscIds() {
      // B e D empatam em 5: o desempate é sempre id asc (também quando a
      // direção pedida é desc — ver `products.ts`, comparador de balance).
      const tied = [idB, idD].sort();
      return [...tied, idC, idA];
    }

    it('asc: ordem numérica crescente de saldo, com id asc desempatando o par de valor igual', async () => {
      const body = await fetchPage({
        sortBy: 'balance',
        sortDir: 'asc',
        pageSize: 0,
        search: 'Produto Saldo',
      });
      const ids = body.items.map((p) => p.id);
      const balances = body.items.map((p) => p.balance);

      expect(ids).toEqual(expectedAscIds());
      expect(balances).toEqual([5, 5, 12, 20]);
    });

    it('desc: ordem numérica decrescente, com o mesmo desempate id asc dentro do empate', async () => {
      const body = await fetchPage({
        sortBy: 'balance',
        sortDir: 'desc',
        pageSize: 0,
        search: 'Produto Saldo',
      });
      const ids = body.items.map((p) => p.id);
      const balances = body.items.map((p) => p.balance);

      const tied = [idB, idD].sort();
      expect(ids).toEqual([idA, idC, ...tied]);
      expect(balances).toEqual([20, 12, 5, 5]);
    });

    it('a ordenação por saldo atravessa páginas mantendo a sequência global', async () => {
      const pageSize = 2;
      const collected: string[] = [];
      for (let page = 1; page <= 2; page += 1) {
        const body = await fetchPage({
          sortBy: 'balance',
          sortDir: 'asc',
          pageSize,
          page,
          search: 'Produto Saldo',
        });
        collected.push(...body.items.map((p) => p.id));
      }
      expect(collected).toEqual(expectedAscIds());
    });
  });
});
