export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'INITIAL_STOCK';

export type StockStatus = 'OK' | 'ATTN' | 'OUT';

/**
 * Status derivado do saldo — EXCLUSIVO: todo produto tem exatamente um.
 * Precedência OUT → ATTN → OK, a mesma que `GET /products/summary` sempre
 * usou. Com `minStock` 0, saldo positivo é OK (nunca ATTN) e saldo 0 é OUT.
 */
export function deriveStockStatus(balance: number, minStock: number): StockStatus {
  if (balance === 0) return 'OUT';
  if (balance < minStock) return 'ATTN';
  return 'OK';
}
