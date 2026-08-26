import { apiFetch } from './httpClient';
import type { Product, ProductWithBalance } from './types';

export async function fetchProducts(
  search: string,
  page = 1,
  pageSize = 10,
  sortBy: 'name' | 'sku' | 'balance' = 'name',
  sortDir: 'asc' | 'desc' = 'asc',
  status?: Array<'OK' | 'ATTN' | 'OUT'>,
): Promise<{ items: ProductWithBalance[]; total: number; page: number; pageSize: number }> {
  const term = search.trim();
  const params = new URLSearchParams();
  if (term) params.set('search', term);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  params.set('sortBy', sortBy);
  params.set('sortDir', sortDir);
  if (status && status.length > 0) params.set('status', status.join(','));

  return apiFetch(`/products?${params.toString()}`);
}

export async function createProduct(data: {
  name: string;
  sku: string;
  description?: string | null;
  minStock: number;
  initialStock?: number;
}): Promise<Product> {
  return apiFetch('/products', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateProduct(
  id: string,
  data: Partial<{ name: string; sku: string; description?: string | null; minStock: number }>,
): Promise<Product> {
  return apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteProduct(id: string): Promise<void> {
  await apiFetch<void>(`/products/${id}`, { method: 'DELETE' });
}
