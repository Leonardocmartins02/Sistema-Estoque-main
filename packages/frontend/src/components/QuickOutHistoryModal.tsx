import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import Button from './ui/Button';
import { fetchQuickOutHistory, type QuickOutHistoryItem } from '../api/quickOut';

export type QuickOutHistoryModalProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export default function QuickOutHistoryModal({ open, onOpenChange }: QuickOutHistoryModalProps) {
  const [items, setItems] = useState<QuickOutHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  type SortDir = 'asc' | 'desc';
  const [sortBy, setSortBy] = useState<'productName' | 'productSku' | 'quantity' | 'date'>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  // (removido) estado de exportação CSV

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchQuickOutHistory({ page, pageSize, q, from: from || undefined, to: to || undefined });
        setItems(data.items);
        setTotal(data.total);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, page, pageSize, q, from, to]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const viewItems = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      let av: any = (a as any)[sortBy];
      let bv: any = (b as any)[sortBy];
      if (sortBy === 'date') {
        av = new Date(av).getTime();
        bv = new Date(bv).getTime();
      } else if (typeof av === 'string') {
        av = av.toLowerCase();
        bv = (bv as string).toLowerCase();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [items, sortBy, sortDir]);

  if (!open) return null;

  const content = (
    <div className="fixed inset-0 z-[10000] p-4 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}>
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-b from-white to-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-gray-900">Histórico de Baixas</h2>
            <p className="mt-1 text-sm text-gray-600">Consulte todas as baixas (OUT) registradas no sistema.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              placeholder="Buscar por nome, SKU ou observação"
              className="w-72 rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <input type="date" className="rounded-md border border-gray-300 px-2 py-1 text-sm" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            <span className="text-xs text-gray-400">até</span>
            <input type="date" className="rounded-md border border-gray-300 px-2 py-1 text-sm" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
            <div className="text-xs text-gray-500">{loading ? '...' : `${total} registro(s)`}</div>
          </div>

          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="min-w-full table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600 w-[32%]">
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-800" onClick={() => { setSortBy('productName'); setSortDir((d) => (sortBy==='productName' ? (d==='asc'?'desc':'asc') : 'asc')); }} title="Ordenar por Produto">
                      Produto
                      <span className={`text-gray-400 ${sortBy==='productName' && sortDir==='desc' ? 'rotate-180' : ''}`}>▲</span>
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600 w-[18%]">
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-800" onClick={() => { setSortBy('productSku'); setSortDir((d) => (sortBy==='productSku' ? (d==='asc'?'desc':'asc') : 'asc')); }} title="Ordenar por SKU">
                      SKU
                      <span className={`text-gray-400 ${sortBy==='productSku' && sortDir==='desc' ? 'rotate-180' : ''}`}>▲</span>
                    </button>
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-600 w-[10%]">
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-800" onClick={() => { setSortBy('quantity'); setSortDir((d) => (sortBy==='quantity' ? (d==='asc'?'desc':'asc') : 'asc')); }} title="Ordenar por Quantidade">
                      Qtde
                      <span className={`text-gray-400 ${sortBy==='quantity' && sortDir==='desc' ? 'rotate-180' : ''}`}>▲</span>
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600 w-[20%]">
                    <button type="button" className="inline-flex items-center gap-1 hover:text-gray-800" onClick={() => { setSortBy('date'); setSortDir((d) => (sortBy==='date' ? (d==='asc'?'desc':'asc') : 'desc')); }} title="Ordenar por Data">
                      Data
                      <span className={`text-gray-400 ${sortBy==='date' && sortDir==='desc' ? 'rotate-180' : ''}`}>▲</span>
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600 w-[20%]">Observação</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">Carregando...</td></tr>
                ) : viewItems.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">Nenhuma baixa encontrada.</td></tr>
                ) : (
                  viewItems.map((m) => (
                    <tr key={m.id}>
                      <td className="border-t border-gray-100 px-4 py-3 text-sm text-gray-800">{m.productName}</td>
                      <td className="border-t border-gray-100 px-4 py-3 text-sm text-gray-600 uppercase">{m.productSku}</td>
                      <td className="border-t border-gray-100 px-4 py-3 text-sm text-gray-800 text-right">{m.quantity}</td>
                      <td className="border-t border-gray-100 px-4 py-3 text-sm text-gray-700">{m.date ? new Date(m.date).toLocaleString('pt-BR') : '-'}</td>
                      <td className="border-t border-gray-100 px-4 py-3 text-sm text-gray-700">{m.note || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-gray-500">Página {page} de {totalPages} • {total} registro(s)</div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setPage((p) => Math.max(1, p-1))} disabled={page<=1}>Anterior</Button>
              <Button variant="ghost" onClick={() => setPage((p) => Math.min(totalPages, p+1))} disabled={page>=totalPages}>Próxima</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
