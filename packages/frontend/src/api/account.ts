import { apiFetch } from './httpClient';

export interface AccountExport {
  user: { id: string; email: string; createdAt: string; updatedAt: string };
  movements: Array<{ id: string; productId: string; type: string; quantity: number; date: string; note: string | null }>;
  exportedAt: string;
}

/** LGPD art. 18 — acesso/portabilidade dos dados do próprio usuário. */
export function fetchMyData(): Promise<AccountExport> {
  return apiFetch<AccountExport>('/auth/me/data');
}

/** LGPD art. 18 — eliminação da conta (exige a senha como reautenticação). */
export function deleteMyAccount(password: string): Promise<void> {
  return apiFetch<void>('/auth/me', { method: 'DELETE', body: JSON.stringify({ password }) });
}
