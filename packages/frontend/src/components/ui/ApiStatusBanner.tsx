import { useCallback, useEffect, useState } from 'react';

// Mesma base configurável via VITE_API_BASE usada pelo resto da API — sem
// isso, em um deploy split (frontend na Netlify, backend no Render), esta
// checagem batia no próprio domínio do frontend em vez do backend.
const API_BASE = (import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE ?? '';

/**
 * ApiStatusBanner
 * Faz um ping periódico em /health e exibe um aviso quando a API estiver offline.
 *
 * O aviso aparece/some por polling, sem interação do usuário — por isso vive
 * dentro de uma live region `role="status"` que fica SEMPRE montada (uma região
 * criada no mesmo instante do conteúdo normalmente não é anunciada).
 */
export function ApiStatusBanner({ intervalMs = 10000 }: { intervalMs?: number }) {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    try {
      setChecking(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      setOffline(!res.ok);
    } catch {
      setOffline(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
    const id = setInterval(() => void check(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, check]);

  return (
    <div className="mx-auto max-w-5xl px-4" role="status" aria-live="polite">
      {offline && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          A API está indisponível no momento. Algumas ações podem falhar. Tentando reconectar automaticamente...
          {!checking && (
            <button
              type="button"
              className="ml-2 rounded border border-amber-400 bg-white px-2 py-0.5 text-xs text-amber-900 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
              onClick={() => void check()}
            >
              Tentar agora
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ApiStatusBanner;
