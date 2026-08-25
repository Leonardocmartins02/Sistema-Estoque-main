import type { Product, ProductWithBalance } from './types';

// Base da API: em produção, defina VITE_API_BASE (ex.: https://sua-api.com)
// Em desenvolvimento, deixa vazio para usar o proxy do Vite ("/api").
const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? '';
const API_PREFIX = `${API_BASE}/api`;

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
  const qs = params.toString();
  const url = `${API_PREFIX}/products?${qs}`;

  try {
    // Add timeout to avoid hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json();
        detail = body?.message ? `: ${body.message}` : '';
      } catch {
        // ignore body parse errors
      }
      throw new Error(`Falha ao carregar produtos (HTTP ${res.status})${detail}`);
    }
    return res.json();
  } catch (err: any) {
    // Rede ou outras falhas
    if (err?.name === 'AbortError') {
      throw new Error('Tempo de resposta da API excedido. Tente novamente.');
    }
    throw new Error(err?.message || 'Falha ao carregar produtos');
  }
}

export async function createProduct(data: {
  name: string;
  sku: string;
  description?: string | null;
  minStock: number;
  initialStock?: number;
}): Promise<Product> {
  const res = await fetch(`${API_PREFIX}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || 'Falha ao criar produto');
  }
  return res.json();
}

export async function updateProduct(
  id: string,
  data: Partial<{ name: string; sku: string; description?: string | null; minStock: number }>,
): Promise<Product> {
  const res = await fetch(`${API_PREFIX}/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || 'Falha ao atualizar produto');
  }
  return res.json();
}

export async function deleteProduct(id: string): Promise<void> {
  const url = `${API_PREFIX}/products/${id}`;
  console.log('Deleting product:', url);
  
  try {
    const res = await fetch(url, { 
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log('Delete product response status:', res.status);
    
    if (!res.ok) {
      let errorMessage = 'Falha ao excluir produto';
      try {
        const errorData = await res.json();
        console.error('Error details:', errorData);
        errorMessage = errorData?.message || errorMessage;
      } catch (e) {
        const text = await res.text();
        console.error('Failed to parse error response:', text);
      }
      throw new Error(errorMessage);
    }
    
    console.log('Product deleted successfully');
  } catch (error) {
    console.error('Error in deleteProduct:', error);
    throw error;
  }
}
