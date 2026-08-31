import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/app';
import { prisma } from '../src/shared/prisma';
import { resetDb } from './helpers/db';
import { createTestUser, loginAndGetToken } from './helpers/auth';

/**
 * Correção 3-F2 (REV-01) — os dois caminhos internos de `GET /api/products`
 * precisam usar a MESMA autoridade para ordenar `name`/`sku`.
 *
 * Caminho A (`routes/products.ts`, sem `status` e sem `sortBy=balance`):
 * `orderBy` do Prisma — a ordem é decidida pelo PostgreSQL, conforme a
 * collation do ambiente (SD-1, implementation-plan.md §9.3.1: aceita-se a
 * collation nativa, sem coluna normalizada/ICU/raw SQL).
 *
 * Caminho B (com `status` ou `sortBy=balance`): antes desta correção,
 * comparava `a.name.toLowerCase() < b.name.toLowerCase()` em JavaScript —
 * uma autoridade DIFERENTE da collation do banco. O mesmo `sortBy=name`
 * podia produzir ordens diferentes só por existir ou não um filtro de
 * status na mesma consulta lógica.
 *
 * ESTE TESTE NÃO FIXA UMA ORDEM LINGUÍSTICA PT-BR. Ele não afirma "Á vem
 * antes de Z" nem qualquer resultado esperado a priori. Ele compara duas
 * respostas da MESMA API, sobre o MESMO conjunto lógico de produtos, uma
 * forçando o caminho A (sem status) e outra forçando o caminho B (com
 * status que captura os mesmos produtos) — e exige que a sequência de IDs
 * seja idêntica. Isso prova consistência entre os dois caminhos
 * independentemente de qual seja a collation real do ambiente que rodar o
 * teste (local, CI ou produção).
 */
describe('GET /api/products — consistência de ordenação textual entre os dois caminhos internos (REV-01 / 3-F2)', () => {
  const app = createServer();
  let token: string;

  /**
   * Pares de nome/SKU que diferem SÓ na caixa (maiúscula/minúscula).
   *
   * Por quê isso expõe a divergência sem depender de acento: sob
   * `toLowerCase()`, cada par colapsa para o MESMO valor de comparação —
   * `'Bravo'.toLowerCase() === 'bravo'.toLowerCase()` — então o comparador em
   * JS cai no desempate por `id` (essencialmente aleatório, são `cuid`).
   * Já a collation real do PostgreSQL trata maiúscula/minúscula como um
   * critério de comparação de verdade (em praticamente qualquer collation —
   * seja locale-aware, seja byte-order/C, onde maiúscula e minúscula têm
   * pontos de código diferentes) — o resultado é determinístico pela string,
   * não pelo `id`. As duas autoridades só coincidiriam por acaso, e a chance
   * cai para praticamente zero com três pares independentes.
   *
   * Todos sem movimentação → saldo 0 → status OUT para todos, o que torna o
   * conjunto lógico idêntico entre "sem status" e "status=OUT".
   */
  beforeAll(async () => {
    await resetDb();
    const { user, password } = await createTestUser('collation@example.com', 'senha-forte-123');
    token = await loginAndGetToken(app, user.email, password);

    const pairs = [
      { lower: 'bravo', upper: 'Bravo' },
      { lower: 'alfa', upper: 'Alfa' },
      { lower: 'charlie', upper: 'Charlie' },
    ];
    for (const { lower, upper } of pairs) {
      await prisma.product.create({
        data: { name: lower, sku: `${lower.toUpperCase()}-LOW`, minStock: 0 },
      });
      await prisma.product.create({
        data: { name: upper, sku: `${upper.toUpperCase()}-UP`, minStock: 0 },
      });
    }
  });

  async function fetchIds(params: Record<string, string | number>) {
    const search = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString();
    const res = await request(app)
      .get(`/api/products?${search}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return (res.body.items as Array<{ id: string }>).map((p) => p.id);
  }

  it('name asc: caminho A (sem status) e caminho B (status=OUT, mesmo conjunto lógico) produzem a MESMA sequência de IDs', async () => {
    const pathA = await fetchIds({ sortBy: 'name', sortDir: 'asc', pageSize: 0 });
    const pathB = await fetchIds({ sortBy: 'name', sortDir: 'asc', status: 'OUT', pageSize: 0 });

    expect(pathA).toHaveLength(6);
    expect(pathB).toHaveLength(6);
    expect(pathB).toEqual(pathA);
  });

  it('name desc: os dois caminhos concordam também na direção descendente', async () => {
    const pathA = await fetchIds({ sortBy: 'name', sortDir: 'desc', pageSize: 0 });
    const pathB = await fetchIds({ sortBy: 'name', sortDir: 'desc', status: 'OUT', pageSize: 0 });

    expect(pathB).toEqual(pathA);
  });

  it('sku asc: os dois caminhos concordam para o critério sku', async () => {
    const pathA = await fetchIds({ sortBy: 'sku', sortDir: 'asc', pageSize: 0 });
    const pathB = await fetchIds({ sortBy: 'sku', sortDir: 'asc', status: 'OUT', pageSize: 0 });

    expect(pathB).toEqual(pathA);
  });

  it('sku desc: os dois caminhos concordam também na direção descendente', async () => {
    const pathA = await fetchIds({ sortBy: 'sku', sortDir: 'desc', pageSize: 0 });
    const pathB = await fetchIds({ sortBy: 'sku', sortDir: 'desc', status: 'OUT', pageSize: 0 });

    expect(pathB).toEqual(pathA);
  });
});
