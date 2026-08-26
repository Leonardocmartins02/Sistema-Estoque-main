import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/app';
import { prisma } from '../src/shared/prisma';
import { resetDb } from './helpers/db';
import { createTestUser, loginAndGetToken } from './helpers/auth';

/**
 * Cobre a "Parte 3" do backlog de backend em `GET /api/products`:
 *
 * - paginação/busca/filtro/ordenação empurrados para o banco;
 * - saldo continuando correto depois da remoção do N+1 (era um `groupBy` por
 *   produto dentro de um `Promise.all`, agora é UMA agregação por request);
 * - query params validados com Zod (entrada inválida => 400).
 *
 * O contrato da resposta (`{ items, total, page, pageSize }`, cada item com
 * `balance`) não pode mudar — o frontend depende dele.
 */
describe('GET /api/products — listagem, busca e paginação', () => {
  const app = createServer();
  let token: string;

  const expectedBalances: Record<string, number> = {
    'Alpha Widget': 17,
    'Bravo Widget': 4,
    'Charlie Widget': 0,
    'Delta Widget': 0,
    'Zebra Ácida': 100,
  };

  beforeAll(async () => {
    await resetDb();
    const { user, password } = await createTestUser('listagem@example.com', 'senha-forte-123');
    token = await loginAndGetToken(app, user.email, password);

    // Alpha: saldo 17 (OK, >= minStock 5)
    const alpha = await prisma.product.create({
      data: { name: 'Alpha Widget', sku: 'ALP-001', minStock: 5 },
    });
    await prisma.stockMovement.createMany({
      data: [
        { productId: alpha.id, type: 'IN', quantity: 20 },
        { productId: alpha.id, type: 'OUT', quantity: 3 },
      ],
    });

    // Bravo: saldo 4 (ATTN, 0 < 4 < minStock 10)
    const bravo = await prisma.product.create({
      data: { name: 'Bravo Widget', sku: 'BRA-002', minStock: 10 },
    });
    await prisma.stockMovement.create({ data: { productId: bravo.id, type: 'IN', quantity: 4 } });

    // Charlie: saldo 0 (OUT) — entradas e saídas se cancelam
    const charlie = await prisma.product.create({
      data: { name: 'Charlie Widget', sku: 'CHA-003', minStock: 2 },
    });
    await prisma.stockMovement.createMany({
      data: [
        { productId: charlie.id, type: 'IN', quantity: 5 },
        { productId: charlie.id, type: 'OUT', quantity: 5 },
      ],
    });

    // Delta: saldo 0 sem NENHUMA movimentação — não aparece no `groupBy`,
    // então tem que ser preenchido com 0 pelo mapa de saldos.
    await prisma.product.create({ data: { name: 'Delta Widget', sku: 'DEL-004', minStock: 0 } });

    // Zebra Ácida: saldo 100 (OK) — nome acentuado, usado na busca sem acento.
    const zebra = await prisma.product.create({
      data: { name: 'Zebra Ácida', sku: 'ZEB-005', minStock: 1 },
    });
    await prisma.stockMovement.create({ data: { productId: zebra.id, type: 'IN', quantity: 100 } });
  });

  const list = (qs: string) =>
    request(app).get(`/api/products?${qs}`).set('Authorization', `Bearer ${token}`);

  it('mantém o contrato da resposta e pagina pelo banco', async () => {
    const res = await list('page=1&pageSize=2&sortBy=name&sortDir=asc');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 5, page: 1, pageSize: 2 });
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.map((p: { name: string }) => p.name)).toEqual([
      'Alpha Widget',
      'Bravo Widget',
    ]);
  });

  it('retorna a última página parcial sem alterar o total', async () => {
    const res = await list('page=3&pageSize=2&sortBy=name&sortDir=asc');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe('Zebra Ácida');
  });

  it('pageSize=0 devolve todos os itens e normaliza page=1', async () => {
    const res = await list('pageSize=0');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 5, page: 1, pageSize: 0 });
    expect(res.body.items).toHaveLength(5);
  });

  it('calcula o saldo de todos os produtos corretamente (regressão do N+1)', async () => {
    const res = await list('pageSize=0');

    expect(res.status).toBe(200);
    const byName = Object.fromEntries(
      res.body.items.map((p: { name: string; balance: number }) => [p.name, p.balance]),
    );
    expect(byName).toEqual(expectedBalances);
  });

  it('usa UMA agregação de saldo por request, não uma por produto', async () => {
    // Regressão direta do N+1: antes eram 1 + N queries (`stockMovement.groupBy`
    // dentro de um `Promise.all` sobre a lista inteira de produtos).
    let groupByCalls = 0;
    prisma.$use(async (params, next) => {
      if (params.model === 'StockMovement' && params.action === 'groupBy') {
        groupByCalls += 1;
      }
      return next(params);
    });

    const res = await list('pageSize=0');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(5);
    expect(groupByCalls).toBeLessThanOrEqual(1);
  });

  it('busca é insensível a acentos e a maiúsculas/minúsculas', async () => {
    const semAcento = await list('search=acida');
    expect(semAcento.status).toBe(200);
    expect(semAcento.body.total).toBe(1);
    expect(semAcento.body.items[0].name).toBe('Zebra Ácida');
    expect(semAcento.body.items[0].balance).toBe(100);

    const comAcento = await list('search=%C3%81CIDA');
    expect(comAcento.body.total).toBe(1);
    expect(comAcento.body.items[0].name).toBe('Zebra Ácida');
  });

  it('busca também casa por SKU', async () => {
    const res = await list('search=bra-002');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].sku).toBe('BRA-002');
  });

  it('busca sem resultado devolve lista vazia com total 0', async () => {
    const res = await list('search=nao-existe-nada-com-esse-nome');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 0, page: 1, pageSize: 10 });
    expect(res.body.items).toEqual([]);
  });

  it('filtra por status derivado do saldo', async () => {
    const semEstoque = await list('status=OUT&pageSize=0');
    expect(semEstoque.status).toBe(200);
    expect(semEstoque.body.items.map((p: { name: string }) => p.name).sort()).toEqual([
      'Charlie Widget',
      'Delta Widget',
    ]);

    const atencao = await list('status=ATTN&pageSize=0');
    expect(atencao.body.total).toBe(1);
    expect(atencao.body.items[0].name).toBe('Bravo Widget');
  });

  it('ordena por saldo (valor derivado) mantendo total e paginação', async () => {
    const res = await list('sortBy=balance&sortDir=desc&page=1&pageSize=2');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(res.body.items.map((p: { name: string }) => p.name)).toEqual([
      'Zebra Ácida',
      'Alpha Widget',
    ]);
  });

  it.each([
    ['page=0', 'page abaixo do mínimo'],
    ['page=abc', 'page não numérico'],
    ['page=1.5', 'page não inteiro'],
    ['pageSize=5000', 'pageSize acima do limite de 1000'],
    ['pageSize=-1', 'pageSize negativo'],
    ['sortBy=preco', 'sortBy fora da allow-list'],
    ['sortDir=cima', 'sortDir fora da allow-list'],
    ['status=INVALIDO', 'status fora da allow-list'],
  ])('devolve 400 para query param inválido (%s)', async (qs) => {
    const res = await list(qs);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Dados inválidos.');
  });
});
