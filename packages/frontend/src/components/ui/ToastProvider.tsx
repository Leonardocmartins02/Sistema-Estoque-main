import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type Toast = {
  id: string;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  durationMs?: number;
};

type ToastContextValue = {
  toasts: Toast[];
  show: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  return (
    <div
      className={`pointer-events-auto flex items-start gap-2 rounded-surface border p-3 shadow-overlay ring-1 ring-black/5 transition ${
        toast.type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : toast.type === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-900'
          : 'border-gray-200 bg-white text-gray-800'
      }`}
    >
      <div className="flex-1">
        {toast.title && <div className="text-sm font-medium">{toast.title}</div>}
        <div className="text-sm">{toast.message}</div>
      </div>
      <button
        type="button"
        aria-label={`Fechar notificação: ${toast.message}`}
        className="rounded-md px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        onClick={() => onDismiss(toast.id)}
      >
        Fechar
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2);
      const toast: Toast = { id, type: 'info', durationMs: 3500, ...t };
      setToasts((prev) => [...prev, toast]);
      // Erro persiste até dispensa manual (design-system.md §17, A-11): é a
      // única explicação de por que a operação falhou, e não pode desaparecer
      // sozinha antes de a pessoa terminar de ler.
      if (toast.type !== 'error' && toast.durationMs && toast.durationMs > 0) {
        setTimeout(() => dismiss(id), toast.durationMs);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);

  // Toasts são o único feedback de várias ações assíncronas (excluir, movimentar,
  // baixa rápida). Sem uma live region eles são silenciosos para leitor de tela.
  // Duas regiões separadas e SEMPRE montadas (uma região montada junto com o
  // conteúdo costuma não ser anunciada): `status`/polite para sucesso e info,
  // `alert`/assertive para erros.
  const politeToasts = toasts.filter((t) => t.type !== 'error');
  const errorToasts = toasts.filter((t) => t.type === 'error');

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Container */}
      <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-end p-4">
        <div className="flex w-full max-w-sm flex-col gap-2">
          <div role="status" aria-live="polite" aria-relevant="additions text" className="flex flex-col gap-2">
            {politeToasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>
          <div role="alert" aria-live="assertive" aria-relevant="additions text" className="flex flex-col gap-2">
            {errorToasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
