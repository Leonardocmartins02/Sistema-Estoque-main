import React, { useEffect, useState } from 'react';

/**
 * ApiStatusBanner
 * Faz um ping periódico em /health e exibe um aviso quando a API estiver offline.
 */
export function ApiStatusBanner({ intervalMs = 10000 }: { intervalMs?: number }) {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(true);

  async function check() {
    try {
      setChecking(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('/health', { signal: controller.signal });
      clearTimeout(timeout);
      setOffline(!res.ok);
    } catch {
      setOffline(true);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    check();
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  if (!offline) return null;

  return (
    <div className="mx-auto max-w-5xl px-4">
      <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        A API está indisponível no momento. Algumas ações podem falhar. Tentando reconectar automaticamente...
        {!checking && (
          <button
            type="button"
            className="ml-2 rounded border border-amber-300 bg-white/70 px-2 py-0.5 text-xs hover:bg-white"
            onClick={check}
          >
            Tentar agora
          </button>
        )}
      </div>
    </div>
  );
}

export default ApiStatusBanner;
