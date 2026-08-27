import type { ProductStockSummary } from '@simplestock/shared';
import { useQuery } from '@tanstack/react-query';

import { fetchProductStockSummary } from '../api/products';

/**
 * Contagem de produtos por status (`OK`/`ATTN`/`OUT`) para o alerta de
 * estoque baixo do header. Refetch periódico em vez de tempo real — não há
 * infra de push neste sistema, e um alerta de estoque não precisa ser
 * instantâneo (ver plano em `docs`/histórico de decisão).
 */
export function useProductStockSummary() {
  return useQuery<ProductStockSummary>({
    queryKey: ['products', 'summary'],
    queryFn: fetchProductStockSummary,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
