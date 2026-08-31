import { apiFetch } from './httpClient';

export interface QuickOutRequest {
  productId: string;
  quantity: number;
  note?: string;
}

export interface QuickOutHistoryItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  date: string;
  note: string | null;
}

/** Critérios de ordenação aceitos pelo backend (whitelist de `GET /quick-out/history`). */
export type QuickOutHistorySortBy = 'productName' | 'productSku' | 'quantity' | 'date';
export type QuickOutHistorySortDir = 'asc' | 'desc';

export async function fetchQuickOutHistory(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  from?: string; // ISO
  to?: string; // ISO
  // Task 3 (D-A): a ordenação é global e resolvida no banco antes da
  // paginação. O cliente só transporta o critério — nunca reordena a resposta.
  sortBy?: QuickOutHistorySortBy;
  sortDir?: QuickOutHistorySortDir;
}): Promise<{ items: QuickOutHistoryItem[]; total: number; page: number; pageSize: number }> {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('pageSize', String(params.pageSize));
  if (params.q) sp.set('q', params.q);
  if (params.from) sp.set('from', params.from);
  if (params.to) sp.set('to', params.to);
  if (params.sortBy) sp.set('sortBy', params.sortBy);
  if (params.sortDir) sp.set('sortDir', params.sortDir);

  return apiFetch(`/quick-out/history?${sp.toString()}`);
}

export interface QuickOutResponse {
  success: boolean;
  movement: {
    id: string;
    productId: string;
    type: 'OUT';
    quantity: number;
    date: string;
    note: string | null;
    createdAt: string;
  };
  newBalance: number;
  product: {
    id: string;
    name: string;
    sku: string;
  };
}

export async function quickOutProduct(data: QuickOutRequest): Promise<QuickOutResponse> {
  return apiFetch('/quick-out', { method: 'POST', body: JSON.stringify(data) });
}
