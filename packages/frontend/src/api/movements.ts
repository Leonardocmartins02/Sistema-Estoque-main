import { apiFetch } from './httpClient';
import type { Movement, Paged } from './types';

export async function fetchMovements(
  productId: string,
  page = 1,
  pageSize = 20,
  filters?: { type?: 'IN' | 'OUT' | 'ADJUSTMENT' | 'INITIAL_STOCK' | ''; from?: string; to?: string; q?: string },
): Promise<Paged<Movement>> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters?.type) params.set('type', filters.type);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.q) params.set('q', filters.q);

  return apiFetch(`/products/${productId}/movements?${params.toString()}`);
}

export async function createMovement(
  productId: string,
  data: { type: 'IN' | 'OUT'; quantity: number; date?: string; note?: string },
): Promise<Movement> {
  return apiFetch(`/products/${productId}/movements`, { method: 'POST', body: JSON.stringify(data) });
}
