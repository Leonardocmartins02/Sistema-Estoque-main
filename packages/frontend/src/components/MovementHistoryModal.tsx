import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMovements } from '../api/movements';
import type { Movement, Paged } from '../api/types';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
};

export function MovementHistoryModal({ open, onOpenChange, productId }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [type, setType] = useState<'' | 'IN' | 'OUT'>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [q, setQ] = useState<string>('');

  // Resetar paginação ao abrir para um produto
  useEffect(() => {
    if (open) {
      setPage(1);
    }
  }, [open, productId]);

  const query = useQuery<Paged<Movement>>({
    queryKey: ['movements', productId, page, pageSize, type, from, to, q],
    queryFn: () => fetchMovements(productId, page, pageSize, { type, from, to, q }),
    enabled: open && !!productId,
    staleTime: 5_000,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 w-[95vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-4 shadow focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="text-lg font-medium">Histórico de Movimentações</Dialog.Title>

          {/* Filtros */}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700">Tipo</label>
              <select
                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                value={type}
                onChange={(e) => {
                  setType(e.target.value as '' | 'IN' | 'OUT');
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                <option value="IN">Entrada (IN)</option>
                <option value="OUT">Saída (OUT)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">De</label>
              <input
                type="date"
                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Até</label>
              <input
                type="date"
                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="sm:col-span-5">
              <label className="block text-xs font-medium text-gray-700">Buscar por Observação</label>
              <input
                type="search"
                placeholder="Ex.: ajuste, nota, motivo"
                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-600">
              Total: <span className="font-medium">{total}</span>{' '}
              {total > 0 && (
                <span>
                  (Página {page} de {totalPages})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
                disabled={page <= 1 || query.isFetching}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                ← Anterior
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
                disabled={page >= totalPages || query.isFetching}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              >
                Próxima →
              </button>
              <select
                className="rounded-md border px-2 py-1 text-sm"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}/página
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Data</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tipo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Quantidade</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Obs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {query.isLoading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-sm text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                )}
                {query.isError && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-sm text-red-700">
                      {(query.error as Error)?.message || 'Erro ao carregar movimentações'}
                    </td>
                  </tr>
                )}
                {!query.isLoading && !query.isError && items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-sm text-gray-500">
                      Nenhuma movimentação encontrada.
                    </td>
                  </tr>
                )}
                {items.map((m) => {
                  const when = new Date(m.date).toLocaleString();
                  return (
                    <tr key={m.id}>
                      <td className="px-4 py-2 text-sm text-gray-800">{when}</td>
                      <td className={`px-4 py-2 text-sm font-medium ${m.type === 'IN' ? 'text-green-700' : 'text-red-700'}`}>
                        {m.type}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-800">{m.quantity}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{m.note || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-end">
            <Dialog.Close asChild>
              <button className="rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand">
                Fechar
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default MovementHistoryModal;
