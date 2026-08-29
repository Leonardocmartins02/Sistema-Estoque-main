import { describe, expect, it } from 'vitest';

import { productStatus } from '../src/components/products/types';

import { makeProduct } from './helpers/factories';

/**
 * PS-1 — `productStatus()` é a implementação **canônica** da regra de estoque.
 *
 * Characterization test unitário, sem render: a regra é testada uma vez aqui em
 * vez de replicada nas três superfícies que a exibem (tabela, cards, lista de
 * baixa). PT-2 e PCL-2 testam a *tradução em tela*; este arquivo testa a
 * *regra* (`characterization-plan.md` §6.1).
 */
describe('productStatus — regra canônica de estado de estoque (PS-1)', () => {
  it('devolve OUT quando o saldo é zero', () => {
    expect(productStatus(makeProduct({ balance: 0, minStock: 5 }))).toBe('OUT');
  });

  it('devolve ATTN quando há saldo mas ele está abaixo do mínimo', () => {
    expect(productStatus(makeProduct({ balance: 4, minStock: 5 }))).toBe('ATTN');
  });

  it('devolve OK quando o saldo alcança o mínimo', () => {
    expect(productStatus(makeProduct({ balance: 5, minStock: 5 }))).toBe('OK');
  });

  it('devolve OK quando o saldo supera o mínimo', () => {
    expect(productStatus(makeProduct({ balance: 20, minStock: 5 }))).toBe('OK');
  });

  it('devolve OK quando o mínimo é zero e há saldo', () => {
    expect(productStatus(makeProduct({ balance: 3, minStock: 0 }))).toBe('OK');
  });

  /**
   * O caso-limite que motivou N-5.
   *
   * A regra canônica prioriza `OUT`: saldo zero é saldo zero, mesmo com mínimo
   * zero. `QuickOutListModal` implementa a mesma regra por conta própria e
   * diverge exatamente aqui (`isOut` e `isOk` ficam ambos verdadeiros, e a
   * linha renderiza dois badges contraditórios). Esse bug **não** é congelado
   * em teste nenhum — ver §12. Aqui se fixa apenas o comportamento correto,
   * que é o alvo para o qual a migração deve convergir.
   */
  it('prioriza OUT no limite balance=0 com minStock=0', () => {
    expect(productStatus(makeProduct({ balance: 0, minStock: 0 }))).toBe('OUT');
  });
});
