import { deriveStockStatus } from '@simplestock/shared';
import { describe, it, expect } from 'vitest';

/**
 * Regra EXCLUSIVA de status (um produto tem exatamente um status), a mesma
 * precedência que `GET /products/summary` sempre usou: OUT → ATTN → OK.
 * É a regra que os eventos `stock.status.changed` precisam — diferente do
 * filtro `matchesStatus` da listagem, que não é exclusivo (dívida registrada
 * em docs/features/integracoes-webhooks/implementation-plan.md).
 */
describe('deriveStockStatus', () => {
  it('saldo 0 é OUT, mesmo com minStock 0', () => {
    expect(deriveStockStatus(0, 5)).toBe('OUT');
    expect(deriveStockStatus(0, 0)).toBe('OUT');
  });

  it('saldo positivo abaixo do mínimo é ATTN', () => {
    expect(deriveStockStatus(1, 5)).toBe('ATTN');
    expect(deriveStockStatus(4, 5)).toBe('ATTN');
  });

  it('saldo igual ou acima do mínimo é OK', () => {
    expect(deriveStockStatus(5, 5)).toBe('OK');
    expect(deriveStockStatus(12, 5)).toBe('OK');
  });

  it('com minStock 0, qualquer saldo positivo é OK — nunca ATTN', () => {
    expect(deriveStockStatus(1, 0)).toBe('OK');
  });
});
