import { describe, expect, it } from 'vitest';

import { formatBalanceTransition, formatDelta, formatQuantity } from '../src/lib/formatNumber';

/**
 * Helper único de formatação numérica (Task 2, docs/ui-ux/implementation-plan.md).
 *
 * P-3/P-4: a formatação derivou dentro do próprio protótipo (Fase 6) — o
 * mesmo diálogo mostrou `1250` num lugar e `1.250` noutro. Este módulo existe
 * para que isso deixe de ser possível: um único lugar decide separador de
 * milhar (pt-BR) e sinal de menos tipográfico. Nenhum componente consome
 * ainda — a aplicação acontece nas Tasks 13, 15, 18, 19, 20 e 21.
 */
describe('formatQuantity — separador de milhar pt-BR', () => {
  it('formata milhar com separador pt-BR', () => {
    expect(formatQuantity(1250)).toBe('1.250');
  });

  it('formata zero sem separador', () => {
    expect(formatQuantity(0)).toBe('0');
  });

  it('formata valores abaixo de mil sem separador', () => {
    expect(formatQuantity(120)).toBe('120');
  });
});

describe('formatDelta — sinal sempre textual, negativo com sinal tipográfico (P-4)', () => {
  it('prefixa positivo com "+"', () => {
    expect(formatDelta(12)).toBe('+12');
  });

  it('devolve "0" sem sinal quando o delta é zero', () => {
    expect(formatDelta(0)).toBe('0');
  });

  it('usa o sinal de menos tipográfico (U+2212), nunca hífen-menos (U+002D), no negativo', () => {
    const result = formatDelta(-45);
    // Assert explícito sobre o code point — a diferença visual entre os dois
    // caracteres não é confiável neste formato de teste (prototype.md §8.1).
    expect(result.codePointAt(0)).toBe(0x2212);
    expect(result).toBe('−45');
  });

  it('aplica o separador de milhar também no delta negativo', () => {
    expect(formatDelta(-1500)).toBe('−1.500');
  });
});

describe('formatBalanceTransition — "antes → depois", honesto quanto à ausência (§14.2 regra 1)', () => {
  it('formata os dois lados quando o saldo anterior existe', () => {
    expect(formatBalanceTransition(120, 132)).toBe('120 → 132');
  });

  it('usa "—" quando não há saldo anterior (ex.: Estoque inicial)', () => {
    expect(formatBalanceTransition(null, 50)).toBe('— → 50');
  });

  it('usa "—" também quando o saldo anterior é undefined', () => {
    expect(formatBalanceTransition(undefined, 50)).toBe('— → 50');
  });

  it('aplica separador de milhar nos dois lados', () => {
    expect(formatBalanceTransition(1200, 1320)).toBe('1.200 → 1.320');
  });
});
