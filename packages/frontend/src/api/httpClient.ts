import type { ApiError } from './types';

// Base da API: em produção, defina VITE_API_BASE (ex.: https://sua-api.com).
// Em desenvolvimento, deixa vazio para usar o proxy do Vite ("/api").
const API_BASE = (import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE ?? '';
const API_PREFIX = `${API_BASE}/api`;

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

/** Chamado pelo AuthProvider sempre que o token muda (login/logout/restauração). */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** Chamado pelo AuthProvider para reagir a um 401 vindo de qualquer chamada de API. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

/**
 * Client HTTP central da aplicação — único lugar que sabe montar a URL da
 * API, anexar o token de auth e tratar erro/timeout. Todas as chamadas em
 * `api/*.ts` passam por aqui em vez de `fetch` direto.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let res: Response;
  try {
    res = await fetch(`${API_PREFIX}${path}`, { ...init, headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiRequestError(0, 'Tempo de resposta da API excedido. Tente novamente.');
    }
    throw new ApiRequestError(0, 'Falha de rede ao chamar a API.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    onUnauthorized?.();
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const isJson = res.headers.get('content-type')?.includes('application/json') ?? false;
  const body: unknown = isJson ? await res.json().catch(() => undefined) : undefined;

  if (!res.ok) {
    const message = (body as ApiError | undefined)?.message || `Falha na requisição (HTTP ${res.status})`;
    throw new ApiRequestError(res.status, message);
  }

  return body as T;
}
