import type { ProductWithBalance } from '../../api/types';

/** Ações que a tabela desktop e a lista de cards mobile disparam no container. */
export type ProductActions = {
  onMove: (product: ProductWithBalance) => void;
  onQuickOut: (product: ProductWithBalance) => void;
  onEdit: (product: ProductWithBalance) => void;
  onHistory: (product: ProductWithBalance) => void;
  onZeroBalance: (product: ProductWithBalance) => void;
  onDelete: (product: ProductWithBalance) => void;
};

export type ProductStatus = 'OK' | 'ATTN' | 'OUT';

export function productStatus(product: ProductWithBalance): ProductStatus {
  if (product.balance === 0) return 'OUT';
  if (product.balance < product.minStock) return 'ATTN';
  return 'OK';
}
