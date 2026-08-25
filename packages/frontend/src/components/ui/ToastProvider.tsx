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

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { id, type: 'info', durationMs: 3500, ...t };
    setToasts((prev) => [...prev, toast]);
    if (toast.durationMs && toast.durationMs > 0) {
      setTimeout(() => dismiss(id), toast.durationMs);
    }
  }, [dismiss]);

  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Container */}
      <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-end p-4">
        <div className="flex w-full max-w-sm flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-2 rounded-lg border p-3 shadow-sm ring-1 ring-black/5 transition ${
                t.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : t.type === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-gray-200 bg-white text-gray-800'
              }`}
            >
              <div className="flex-1">
                {t.title && <div className="text-sm font-medium">{t.title}</div>}
                <div className="text-sm">{t.message}</div>
              </div>
              <button
                className="rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                onClick={() => dismiss(t.id)}
              >
                Fechar
              </button>
            </div>
          ))}
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
