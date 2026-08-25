import type { Product, ProductWithBalance } from './types';

// Base da API configurável via VITE_API_BASE em produção
// Em dev, manter vazio para usar o proxy do Vite
const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? '';
const API_PREFIX = `${API_BASE}/api`;

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

export async function fetchQuickOutHistory(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  from?: string; // ISO
  to?: string; // ISO
}): Promise<{ items: QuickOutHistoryItem[]; total: number; page: number; pageSize: number }> {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('pageSize', String(params.pageSize));
  if (params.q) sp.set('q', params.q);
  if (params.from) sp.set('from', params.from);
  if (params.to) sp.set('to', params.to);
  const res = await fetch(`${API_PREFIX}/quick-out/history?${sp.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || 'Falha ao carregar histórico de baixas');
  }
  return res.json();
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
  const response = await fetch(`${API_PREFIX}/quick-out`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Falha ao processar baixa rápida');
  }

  return response.json();
}
