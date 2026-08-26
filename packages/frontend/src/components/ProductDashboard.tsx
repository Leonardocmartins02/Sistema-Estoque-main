import { useQuery , useQueryClient } from '@tanstack/react-query';
import { ChevronDown, MoreHorizontal, Search, Plus, ArrowDownToLine, Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { createMovement } from '../api/movements';
import { fetchProducts , deleteProduct } from '../api/products';
import type { ProductWithBalance, Paged } from '../api/types';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

import { MovementFormModal } from './MovementFormModal';
import { MovementHistoryModal } from './MovementHistoryModal';
import { ProductFormModal } from './ProductFormModal';
import { QuickOutModal } from './QuickOutModal';
import Badge from './ui/Badge';
import Card from './ui/Card';
import { DataTable, type Column, type Sort } from './ui/DataTable';
import Input from './ui/Input';
import QuickOutListModal from './QuickOutListModal';
import QuickOutHistoryModal from './QuickOutHistoryModal';
import Button from './ui/Button';
import { useToast } from './ui/ToastProvider';

export function ProductDashboard() {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [page, setPage] = useState(1);
  // Paginação padrão: 10 itens por página (sem UI para alterar hoje)
  const [pageSize] = useState(10);
  const [sortBy, setSortBy] = useState<'name' | 'sku' | 'balance'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [tableSorts, setTableSorts] = useState<Sort[]>([{ by: 'name', dir: 'asc' }]);
  const togglePrimarySort = (key: 'name' | 'sku' | 'balance') => {
    setTableSorts((curr) => {
      const primary = curr[0];
      const nextDir = !primary || primary.by !== key ? 'asc' : primary.dir === 'asc' ? 'desc' : 'asc';
      const nextSorts = [{ by: key, dir: nextDir }, ...(primary && primary.by === key ? curr.slice(1) : curr.slice(0))];
      // Reflete no estado de ordenação do backend
      setSortBy(key);
      setSortDir(nextDir as any);
      setPage(1);
      return nextSorts as any;
    });
  };

  // Cabeçalho de filtro de Status com menu em portal fixo (evita clipping/sobreposição)
  function StatusFilterHeader() {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number } | null>(null);

    const onOpen = (e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const preferredTop = rect.bottom + 8;
      const preferredLeft = rect.right - 256; // ~ w-64
      const estimatedHeight = 240;
      const willOverflowBottom = preferredTop + estimatedHeight > window.innerHeight;
      const top = willOverflowBottom ? undefined : preferredTop;
      const bottom = willOverflowBottom ? window.innerHeight - rect.top + 8 : undefined;
      const left = Math.max(8, preferredLeft);
      setPos({ top, bottom, left });
      setOpen(true);
    };

    useEffect(() => {
      if (!open) return;
      const close = () => setOpen(false);
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') setOpen(false);
      };
      window.addEventListener('mousedown', close);
      window.addEventListener('keydown', onKey);
      window.addEventListener('resize', close);
      window.addEventListener('scroll', close, true);
      return () => {
        window.removeEventListener('mousedown', close);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', close);
        window.removeEventListener('scroll', close, true);
      };
    }, [open]);

    return (
      <>
        <button
          type="button"
          className="group inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white/70 px-2 py-1 text-[11px] font-semibold tracking-wide text-gray-700 shadow-sm hover:bg-white hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          onClick={onOpen}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Filtrar por Status"
        >
          <span className="select-none">Status</span>
          {statusFilter.length > 0 && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
              {statusFilter.length}
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform group-hover:text-gray-700 ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && pos && createPortal(
          <div
            role="menu"
            aria-label="Filtrar status"
            className="z-[10000] w-64 select-none rounded-xl border border-gray-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur-sm ring-1 ring-black/5"
            style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left }}
            onMouseDown={(e)=>e.stopPropagation()}
          >
            <div className="mb-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Filtrar Status</div>
              <div className="mt-0.5 text-[11px] text-gray-400">Selecione um ou mais estados.</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {([
                ['OK','OK','bg-emerald-500'],
                ['ATTN','Atenção','bg-amber-500'],
                ['OUT','Em falta','bg-rose-500'],
              ] as const).map(([val,label,color])=> {
                const active = statusFilter.includes(val as any);
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => { toggleStatus(val as any); setPage(1); }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition ${
                      active
                        ? 'border-transparent bg-indigo-600 text-white shadow-sm'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    aria-pressed={active}
                  >
                    <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
                    <span>{label}</span>
                    {active && <Check className="h-3.5 w-3.5 opacity-90" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                onClick={()=>{ setStatusFilter([]); setPage(1); }}
                title="Limpar filtros"
              >
                Limpar filtros
              </button>
              <button
                type="button"
                className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                onClick={()=> setOpen(false)}
                title="Fechar"
              >
                Fechar
              </button>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }
  const qc = useQueryClient();
  const [openMove, setOpenMove] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [openHistory, setOpenHistory] = useState(false);
  const [openQuickOut, setOpenQuickOut] = useState(false);
  const [openQuickOutList, setOpenQuickOutList] = useState(false);
  const [openQuickOutHistory, setOpenQuickOutHistory] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithBalance | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { show: showToast } = useToast();
  
  // Log para depuração
  useEffect(() => {
    console.log('selectedProduct atualizado:', selectedProduct);
  }, [selectedProduct]);
  type StatusKey = 'OK' | 'ATTN' | 'OUT';
  const [statusFilter, setStatusFilter] = useState<StatusKey[]>([]); // vazio = Todos
  const toggleStatus = (val: StatusKey) =>
    setStatusFilter((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));
  const [editInitial, setEditInitial] = useState<Partial<ProductWithBalance> | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpanded = (id: string) => setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));

  // Componente interno: menu de ações com portal e posicionamento fixo para evitar clipping/rolagem
  function ActionMenu({
    trigger,
    items,
  }: {
    trigger: (args: { onClick: (e: React.MouseEvent) => void }) => React.ReactNode;
    items: React.ReactNode;
  }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number } | null>(null);

    const handleOpen = (e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const preferredTop = rect.bottom + 8;
      const preferredLeft = rect.right - 192; // ~ w-48
      const estimatedHeight = 220; // altura estimada do menu
      const willOverflowBottom = preferredTop + estimatedHeight > window.innerHeight;
      const top = willOverflowBottom ? undefined : preferredTop;
      const bottom = willOverflowBottom ? window.innerHeight - rect.top + 8 : undefined;
      const left = Math.max(8, preferredLeft);
      setPos({ top, bottom, left });
      setOpen(true);
    };

    useEffect(() => {
      if (!open) return;
      const close = () => setOpen(false);
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') setOpen(false);
      };
      window.addEventListener('mousedown', close);
      window.addEventListener('keydown', onKey);
      window.addEventListener('resize', close);
      window.addEventListener('scroll', close, true);
      return () => {
        window.removeEventListener('mousedown', close);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', close);
        window.removeEventListener('scroll', close, true);
      };
    }, [open]);

    return (
      <>
        {trigger({ onClick: handleOpen })}
        {open && pos &&
          createPortal(
            <div
              className="z-[1000] w-48 rounded-md border bg-white p-1 text-sm shadow-lg"
              style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {items}
            </div>,
            document.body
          )}
      </>
    );
  }

  const query = useQuery<Paged<ProductWithBalance>>({
    queryKey: ['products', debounced, page, pageSize, sortBy, sortDir, statusFilter.join(',')],
    queryFn: () => fetchProducts(debounced, page, pageSize, sortBy, sortDir, statusFilter.length ? (statusFilter as any) : undefined),
    staleTime: 15_000,
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;
  const currentPage = query.data?.page ?? page;
  const currentPageSize = query.data?.pageSize ?? pageSize;
  const totalPages = Math.max(Math.ceil(total / currentPageSize), 1);

  // Itens já vêm filtrados pelo backend conforme statusFilter
  const filteredItems = items;

  // Ordenação client-side conforme a direção escolhida no cabeçalho por Nome (A→Z ou Z→A),
  // e em seguida aplica ordenações secundárias (se houver).
  const viewItems = useMemo(() => {
    const arr = [...filteredItems];
    const primary = tableSorts[0];
    if (primary?.by === 'name') {
      const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
      arr.sort((a: any, b: any) =>
        primary.dir === 'asc' ? collator.compare(a.name, b.name) : collator.compare(b.name, a.name)
      );
    }
    if (!tableSorts || tableSorts.length <= 1) return arr;
    const secondarySorts = tableSorts.slice(1) as Sort[];
    arr.sort((a: any, b: any) => {
      for (const s of secondarySorts) {
        let av: any = a[s.by];
        let bv: any = b[s.by];
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return s.dir === 'asc' ? -1 : 1;
        if (av > bv) return s.dir === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return arr;
  }, [filteredItems, tableSorts]);

  return (
    <section aria-labelledby="products-heading" className="mt-8">
      {/* Barra de ações principal */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 id="products-heading" className="text-3xl font-semibold tracking-tight text-gray-900">
            Produtos
          </h2>
          <p className="text-sm text-gray-500">Gerencie o cadastro e o estoque</p>
          <div className="mt-6 flex items-center gap-2">
            <Button variant="primary" size="md" onClick={() => setOpenCreate(true)}>
              <Plus className="h-4 w-4" />
              Adicionar Produto
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                // Abre a lista de produtos para escolher
                setOpenQuickOutList(true);
              }}
            >
              <ArrowDownToLine className="h-4 w-4" />
              Baixa de Produtos
            </Button>
          </div>

      {/* Barra de paginação e ações em massa — movida para baixo da tabela */}
        </div>
      </div>

      {/* (removido) Busca e filtros original — será renderizado na faixa da paginação */}

      {/* Faixa com Busca (botão de excluir ao lado direito) */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-md">
          <Input
            id="search"
            label="Buscar por Nome ou SKU"
            type="search"
            placeholder="Ex.: Caneta ou SKU123"
            leftIcon={<Search className="h-4 w-4 text-gray-400" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={async () => {
              if (selectedIds.size === 0) return;
              const count = selectedIds.size;
              const ok = window.confirm(`Excluir ${count} produto(s) selecionado(s)? Esta ação também remove as movimentações destes produtos.`);
              if (!ok) return;
              try {
                const ids = Array.from(selectedIds);
                const ops = ids.map((id) => deleteProduct(id));
                const results = await Promise.allSettled(ops);
                const failed = results.filter((r) => r.status === 'rejected');
                if (failed.length > 0) {
                  showToast({ type: 'error', message: `Falhou em ${failed.length} de ${results.length} exclusões.` });
                } else {
                  showToast({ type: 'success', message: `${results.length} produto(s) excluído(s).` });
                }
              } catch (e: any) {
                showToast({ type: 'error', message: e?.message || 'Erro ao excluir selecionados' });
              } finally {
                setSelectedIds(new Set());
                await qc.invalidateQueries({ queryKey: ['products'] });
              }
            }}
            title={selectedIds.size ? `${selectedIds.size} selecionado(s)` : 'Selecione itens para excluir'}
          >
            Excluir
          </Button>
        </div>
      </div>

      {/* Tabela (desktop/tablet) com DataTable */}
      <div className="mt-6 hidden md:block">
          {(() => {
          const columns: Column<ProductWithBalance & { __actions?: true }>[] = [
            {
              key: '__select',
              header: '',
              width: 'w-[4%]',
              // Remover seletor geral no cabeçalho (deixar cabeçalho vazio)
              headerRender: <span className="sr-only">Selecionar</span>,
              render: (row) => {
                const p = row as ProductWithBalance;
                const checked = selectedIds.has(p.id);
                return (
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${p.name}`}
                    checked={checked}
                    onChange={(e) => {
                      const isChecked = e.currentTarget.checked;
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (isChecked) next.add(p.id);
                        else next.delete(p.id);
                        return next;
                      });
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  />
                );
              },
            },
            {
              key: 'name',
              header: 'Nome do Produto',
              sortable: false,
              width: 'w-[36%]',
              headerRender: (
                <button
                  type="button"
                  className="group inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white select-none"
                  onClick={() => togglePrimarySort('name')}
                  title="Ordenar por Nome"
                >
                  <span className="select-none cursor-default inline-block text-gray-700">Nome do Produto</span>
                  <span className={`transition-transform text-gray-400 group-hover:text-gray-700 ${tableSorts[0]?.by==='name' && tableSorts[0]?.dir==='desc' ? 'rotate-180' : ''}`}>▲</span>
                </button>
              ),
              render: (p) => (
                <div
                  className="cursor-pointer"
                  onClick={() => {
                    // Evita abrir/fechar ao selecionar texto do nome
                    const sel = typeof window !== 'undefined' ? window.getSelection()?.toString() : '';
                    if (sel && sel.length > 0) return;
                    toggleExpanded((p as ProductWithBalance).id);
                  }}
                  title="Ver descrição"
                >
                  <div className="text-sm text-gray-900 select-none">{(p as ProductWithBalance).name}</div>
                  {expandedIds[(p as ProductWithBalance).id] && (
                    <div className="mt-2 rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700">
                      <div className="mb-1 font-medium text-gray-800">Descrição</div>
                      <p className="whitespace-pre-line">{(p as ProductWithBalance).description || 'Sem descrição.'}</p>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'sku',
              header: 'SKU',
              sortable: false,
              width: 'w-[20%]',
              headerRender: (
                <button
                  type="button"
                  className="group inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white select-none"
                  onClick={() => togglePrimarySort('sku')}
                  title="Ordenar por SKU"
                >
                  <span className="select-none cursor-default inline-block text-gray-700">SKU</span>
                  <span className={`transition-transform text-gray-400 group-hover:text-gray-700 ${tableSorts[0]?.by==='sku' && tableSorts[0]?.dir==='desc' ? 'rotate-180' : ''}`}>▲</span>
                </button>
              ),
              render: (p) => (
                <span
                  className="cursor-pointer text-sm font-medium tracking-wide text-gray-500 hover:text-gray-700 uppercase"
                  onClick={() => toggleExpanded((p as ProductWithBalance).id)}
                >
                  {(p as ProductWithBalance).sku}
                </span>
              ),
            },
            {
              key: 'balance',
              header: 'Saldo Atual',
              sortable: false,
              align: 'right',
              width: 'w-[12%]',
              headerRender: (
                <button
                  type="button"
                  className="group inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white select-none"
                  onClick={() => togglePrimarySort('balance')}
                  title="Ordenar por Saldo"
                >
                  <span className="select-none cursor-default inline-block text-gray-700">Saldo Atual</span>
                  <span className={`transition-transform text-gray-400 group-hover:text-gray-700 ${tableSorts[0]?.by==='balance' && tableSorts[0]?.dir==='desc' ? 'rotate-180' : ''}`}>▲</span>
                </button>
              ),
              render: (p) => {
                const it = p as ProductWithBalance;
                const isOut = it.balance === 0;
                const isAttn = it.balance > 0 && it.balance < it.minStock;
                const cls = isOut ? 'text-rose-600' : isAttn ? 'text-amber-600' : 'text-gray-900';
                return (
                  <span className={`font-semibold ${cls}`}>{it.balance} <span className="font-normal text-gray-500">un.</span></span>
                );
              },
            },
            {
              key: 'status',
              header: 'Status',
              width: 'w-[14%]',
              headerRender: (
                <div className="inline-flex items-center">
                  <StatusFilterHeader />
                </div>
              ),
              render: (p) => {
                const it = p as ProductWithBalance;
                const isOut = it.balance === 0;
                const isAttn = it.balance > 0 && it.balance < it.minStock;
                const isOk = it.balance >= it.minStock;
                return (
                  <span>
                    {isOk && <Badge variant="success">Em Estoque</Badge>}
                    {isAttn && <Badge variant="warning">Estoque Baixo</Badge>}
                    {isOut && <Badge variant="danger">Fora de Estoque</Badge>}
                  </span>
                );
              },
            },
            {
              key: '__actions',
              header: 'Ações',
              align: 'right',
              width: 'w-[10%]',
              render: (row) => {
                const p = row as ProductWithBalance;
                return (
                  <div className="flex items-center justify-end gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-full border px-3.5 py-1.5 text-sm hover:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProductId(p.id);
                          setOpenMove(true);
                        }}
                        title="Lançar entrada/saída"
                      >
                        Movimentar
                      </button>
                      <button
                        type="button"
                        className="rounded-full border p-1.5 text-sm text-red-600 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Botão de baixa rápida clicado para o produto:', p);
                          setSelectedProduct(p);
                          setOpenQuickOut(true);
                        }}
                        title="Dar baixa rápida"
                      >
                        <ArrowDownToLine className="h-4 w-4" />
                      </button>
                    </div>
                    <ActionMenu
                      trigger={({ onClick }) => (
                        <button
                          type="button"
                          aria-label="Mais ações"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClick(e);
                          }}
                          className="inline-flex items-center rounded-md border bg-white p-1.5 text-gray-600 hover:bg-gray-50"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      )}
                      items={
                        <>
                          <button
                            type="button"
                            className="block w-full rounded-md px-3 py-2.5 text-left hover:bg-gray-50"
                            onClick={() => {
                              setEditInitial(p);
                              setOpenEdit(true);
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="block w-full rounded-md px-3 py-2.5 text-left hover:bg-gray-50"
                            onClick={() => {
                              setSelectedProductId(p.id);
                              setOpenHistory(true);
                            }}
                          >
                            Ver Histórico
                          </button>
                          <button
                            type="button"
                            className="block w-full rounded-md px-3 py-2.5 text-left hover:bg-gray-50 disabled:opacity-50"
                            disabled={p.balance <= 0}
                            onClick={async (e) => {
                              e.stopPropagation();
                              console.log('Zerar estoque clicado', { id: p.id, name: p.name, balance: p.balance });
                              if (p.balance <= 0) return;
                              const ok = window.confirm(`Zerar saldo de ${p.name}? Será lançada uma SAÍDA (OUT) de ${p.balance}.`);
                              if (!ok) return;
                              try {
                                console.log('Criando movimento de saída...');
                                await createMovement(p.id, { type: 'OUT', quantity: p.balance });
                                console.log('Movimento criado com sucesso');
                                await qc.invalidateQueries({ queryKey: ['products'] });
                                showToast({ type: 'success', message: `Saldo de ${p.name} zerado com sucesso.` });
                              } catch (e: any) {
                                console.error('Erro ao zerar saldo:', e);
                                showToast({ type: 'error', message: e?.message || 'Falha ao zerar saldo' });
                              }
                            }}
                          >
                            Zerar Estoque
                          </button>
                          <button
                            type="button"
                            className="block w-full rounded-md px-3 py-2.5 text-left text-red-700 hover:bg-red-50"
                            onClick={async (e) => {
                              e.stopPropagation();
                              console.log('Excluir produto clicado', { id: p.id, name: p.name });
                              const ok = window.confirm(`Excluir produto ${p.name}? Esta ação não pode ser desfeita.`);
                              if (!ok) return;
                              try {
                                console.log('Excluindo produto...');
                                await deleteProduct(p.id);
                                console.log('Produto excluído com sucesso');
                                await qc.invalidateQueries({ queryKey: ['products'] });
                                showToast({ type: 'success', message: `Produto ${p.name} excluído.` });
                              } catch (e: any) {
                                console.error('Erro ao excluir produto:', e);
                                showToast({ type: 'error', message: e?.message || 'Falha ao excluir produto' });
                              }
                            }}
                          >
                            Excluir
                          </button>
                        </>
                      }
                    />
                  </div>
                );
              },
            },
          ];

          // Usar a ordem já calculada em viewItems (respeita A→Z e Z→A conforme cabeçalho)
          const itemsForTable = viewItems;

          return (
            <DataTable<ProductWithBalance>
              columns={columns as any}
              items={itemsForTable}
              getRowId={(p) => p.id}
              // Multi-ordenação com Shift + clique no cabeçalho
              sorts={tableSorts}
              onSortsChange={(next) => {
                setTableSorts(next);
                const primary = next[0];
                if (primary && (primary.by === 'name' || primary.by === 'sku' || primary.by === 'balance')) {
                  setSortBy(primary.by as any);
                  setSortDir(primary.dir);
                }
                setPage(1);
              }}
              isLoading={query.isLoading}
              error={query.isError ? (query.error as Error)?.message || 'Erro ao carregar produtos' : null}
              empty={<span>Nenhum produto encontrado.</span>}
              footer={
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-full border px-3.5 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                      disabled={items.length === 0 || query.isFetching}
                      onClick={async (e) => {
                        console.log('=== BOTÃO ZERAR PÁGINA CLICADO ===');
                        console.log('Items na página:', items);
                        console.log('Quantidade de itens:', items.length);
                        console.log('Carregando dados?', query.isFetching);
                        console.log('Botão desabilitado?', items.length === 0 || query.isFetching);
                        
                        e.preventDefault();
                        e.stopPropagation();
                        
                        if (items.length === 0) {
                          console.log('Nenhum item para zerar');
                          return;
                        }
                        
                        const totalBalance = items.reduce((acc, it) => acc + (it.balance > 0 ? it.balance : 0), 0);
                        console.log('Saldo total a ser zerado:', totalBalance);
                        
                        if (totalBalance <= 0) {
                          const msg = 'Nenhum item com saldo > 0 nesta página.';
                          console.log(msg);
                          showToast({ type: 'info', message: msg });
                          return;
                        }
                        
                        const confirmMsg = `Zerar todos os produtos desta página? Será lançada SAÍDA (OUT) total de ${totalBalance}.`;
                        console.log('Mensagem de confirmação:', confirmMsg);
                        const ok = window.confirm(confirmMsg);
                        
                        if (!ok) {
                          console.log('Usuário cancelou a operação');
                          return;
                        }
                        
                        try {
                          console.log('Iniciando processo de zerar saldos...');
                          const itemsToZero = items.filter((it) => it.balance > 0);
                          console.log(`${itemsToZero.length} itens para zerar`);
                          
                          const ops = itemsToZero.map((it) => {
                            console.log(`Criando movimento para produto ${it.id} (${it.name}): SAÍDA de ${it.balance}`);
                            return createMovement(it.id, { type: 'OUT', quantity: it.balance })
                              .then(() => console.log(`Movimento criado para produto ${it.id}`))
                              .catch(err => {
                                console.error(`Erro ao criar movimento para produto ${it.id}:`, err);
                                throw err;
                              });
                          });
                          
                          console.log('Aguardando conclusão de todas as operações...');
                          const results = await Promise.allSettled(ops);
                          
                          const failed = results.filter((r) => r.status === 'rejected');
                          console.log(`Operações concluídas: ${results.length - failed.length} sucesso, ${failed.length} falhas`);
                          
                          if (failed.length > 0) {
                            const errorMsg = `Falha ao zerar ${failed.length} de ${results.length} produtos.`;
                            console.error(errorMsg, { failed });
                            showToast({ type: 'error', message: errorMsg });
                          }
                          
                          console.log('Invalidando cache de produtos...');
                          await qc.invalidateQueries({ queryKey: ['products'] });
                          
                          const successMsg = 'Saldos da página zerados com sucesso!';
                          console.log(successMsg);
                          showToast({ type: 'success', message: successMsg });
                          
                        } catch (error) {
                          const errorMsg = 'Erro inesperado ao processar a operação';
                          console.error(errorMsg, error);
                          showToast({ type: 'error', message: errorMsg });
                        }
                      }}
                      title="Zerar todos os saldos da página"
                    >
                      Zerar página
                    </button>
                    <button
                      type="button"
                      className="rounded-full border px-3.5 py-2 text-sm hover:bg-red-50 text-red-700 border-red-300 disabled:opacity-50"
                      disabled={items.length === 0 || query.isFetching}
                      onClick={async (e) => {
                        console.log('=== BOTÃO EXCLUIR PÁGINA CLICADO ===');
                        console.log('Items na página:', items);
                        console.log('Quantidade de itens:', items.length);
                        console.log('Carregando dados?', query.isFetching);
                        console.log('Botão desabilitado?', items.length === 0 || query.isFetching);
                        
                        e.preventDefault();
                        e.stopPropagation();
                        
                        if (items.length === 0) {
                          console.log('Nenhum item para excluir');
                          return;
                        }
                        
                        const confirmMsg = `Excluir todos os ${items.length} produtos desta página? Esta ação remove os produtos e suas movimentações.`;
                        console.log('Mensagem de confirmação:', confirmMsg);
                        const ok = window.confirm(confirmMsg);
                        
                        if (!ok) {
                          console.log('Usuário cancelou a operação');
                          return;
                        }
                        
                        try {
                          console.log('Iniciando processo de exclusão...');
                          
                          const ops = items.map((it) => {
                            console.log(`Excluindo produto ${it.id} (${it.name})...`);
                            return deleteProduct(it.id)
                              .then(() => console.log(`Produto ${it.id} excluído com sucesso`))
                              .catch(err => {
                                console.error(`Erro ao excluir produto ${it.id}:`, err);
                                throw err;
                              });
                          });
                          
                          console.log('Aguardando conclusão de todas as exclusões...');
                          const results = await Promise.allSettled(ops);
                          
                          const failed = results.filter((r) => r.status === 'rejected');
                          console.log(`Exclusões concluídas: ${results.length - failed.length} sucesso, ${failed.length} falhas`);
                          
                          if (failed.length > 0) {
                            const errorMsg = `Falha ao excluir ${failed.length} de ${results.length} produtos.`;
                            console.error(errorMsg, { failed });
                            showToast({ type: 'error', message: errorMsg });
                          } else {
                            console.log('Todos os produtos foram excluídos com sucesso');
                          }
                          
                          console.log('Redirecionando para a primeira página...');
                          setPage(1);
                          
                          console.log('Invalidando cache de produtos...');
                          await qc.invalidateQueries({ queryKey: ['products'] });
                          
                          const successMsg = 'Produtos da página excluídos com sucesso!';
                          console.log(successMsg);
                          showToast({ type: 'success', message: successMsg });
                          
                        } catch (error) {
                          const errorMsg = 'Erro inesperado ao processar a exclusão';
                          console.error(errorMsg, error);
                          showToast({ type: 'error', message: errorMsg });
                        }
                      }}
                      title="Excluir todos os produtos da página"
                    >
                      Excluir página
                    </button>
                  </div>
                </div>
              }
            />
          );
        })()}
      </div>

      {/* Barra de paginação e ações em massa (abaixo da tabela) */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Controles de paginação */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border px-3.5 py-2 text-sm disabled:opacity-50 hover:bg-gray-50"
            disabled={currentPage <= 1 || query.isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-600 px-2">
            Página {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            className="rounded-full border px-3.5 py-2 text-sm disabled:opacity-50 hover:bg-gray-50"
            disabled={currentPage >= totalPages || query.isFetching}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima →
          </button>
        </div>
      </div>

      {/* Cards (mobile) */}
      <div className="mt-4 space-y-3 md:hidden">
        {query.isLoading && (
          <Card className="text-sm text-gray-500">Carregando...</Card>
        )}
        {query.isError && (
          <Card className="text-sm text-red-700">{(query.error as Error)?.message || 'Erro ao carregar produtos'}</Card>
        )}
        {!query.isLoading && !query.isError && filteredItems.length === 0 && (
          <Card className="text-sm text-gray-500">Nenhum produto encontrado.</Card>
        )}
        {filteredItems.map((p: ProductWithBalance) => {
          const isOut = p.balance === 0;
          const isAttn = p.balance > 0 && p.balance < p.minStock;
          const isOk = p.balance >= p.minStock;
          return (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-medium text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-500">SKU: {p.sku}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">Saldo: {p.balance}</div>
                  <div className="mt-1">
                    {isOk && (
                      <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">OK</span>
                    )}
                    {isAttn && (
                      <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Atenção</span>
                    )}
                    {isOut && (
                      <span className="inline-flex items-center rounded-md bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">Em Falta</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border px-3.5 py-1.5 text-sm hover:bg-gray-50"
                  onClick={() => {
                    setSelectedProductId(p.id);
                    setOpenMove(true);
                  }}
                  title="Lançar entrada/saída"
                >
                  Movimentar
                </button>
                <ActionMenu
                  trigger={({ onClick }) => (
                    <button
                      type="button"
                      aria-label="Mais ações"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClick(e);
                      }}
                      className="inline-flex items-center rounded-md border bg-white p-1.5 text-gray-600 hover:bg-gray-50"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  )}
                  items={
                    <>
                      <button
                        type="button"
                        className="block w-full rounded-md px-2.5 py-2 text-left hover:bg-gray-50"
                        onClick={() => {
                          setEditInitial(p);
                          setOpenEdit(true);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded-md px-2.5 py-2 text-left hover:bg-gray-50"
                        onClick={() => {
                          setSelectedProductId(p.id);
                          setOpenHistory(true);
                        }}
                      >
                        Ver Histórico
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded-md px-2.5 py-2 text-left hover:bg-gray-50 disabled:opacity-50"
                        disabled={p.balance <= 0}
                        onClick={async () => {
                          if (p.balance <= 0) return;
                          const ok = window.confirm(`Zerar saldo de ${p.name}? Será lançada uma SAÍDA (OUT) de ${p.balance}.`);
                          if (!ok) return;
                          try {
                            await createMovement(p.id, { type: 'OUT', quantity: p.balance });
                            qc.invalidateQueries({ queryKey: ['products'] });
                            showToast({ type: 'success', message: `Saldo de ${p.name} zerado com sucesso.` });
                          } catch (e: any) {
                            showToast({ type: 'error', message: e?.message || 'Falha ao zerar saldo' });
                          }
                        }}
                      >
                        Zerar Estoque
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded-md px-2.5 py-2 text-left text-red-700 hover:bg-red-50"
                        onClick={async () => {
                          const ok = window.confirm(`Excluir produto ${p.name}? Esta ação não pode ser desfeita.`);
                          if (!ok) return;
                          try {
                            await deleteProduct(p.id);
                            qc.invalidateQueries({ queryKey: ['products'] });
                            showToast({ type: 'success', message: `Produto ${p.name} excluído.` });
                          } catch (e: any) {
                            showToast({ type: 'error', message: e?.message || 'Falha ao excluir produto' });
                          }
                        }}
                      >
                        Excluir
                      </button>
                    </>
                  }
                />
              </div>
            </Card>
          );
        })}
        <MovementFormModal
          open={openMove}
          onOpenChange={setOpenMove}
          productId={selectedProductId || ''}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['products'] });
          }}
        />
        <MovementHistoryModal
          open={openHistory}
          onOpenChange={setOpenHistory}
          productId={selectedProductId || ''}
        />
        <QuickOutListModal
          open={openQuickOutList}
          onOpenChange={setOpenQuickOutList}
          items={filteredItems}
          loading={query.isLoading}
          onOpenHistory={() => setOpenQuickOutHistory(true)}
          onPick={(p) => {
            setSelectedProduct(p);
            setOpenQuickOutList(false);
            setOpenQuickOut(true);
          }}
        />
        <QuickOutHistoryModal
          open={openQuickOutHistory}
          onOpenChange={setOpenQuickOutHistory}
        />
        {selectedProduct && (
          <QuickOutModal
            open={openQuickOut}
            onOpenChange={setOpenQuickOut}
            product={{
              id: selectedProduct.id,
              name: selectedProduct.name,
              sku: selectedProduct.sku,
              currentBalance: selectedProduct.balance || 0,
            }}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ['products'] });
            }}
          />
        )}
      </div>

      <ProductFormModal
        open={openCreate}
        onOpenChange={setOpenCreate}
        mode="create"
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['products'] });
        }}
      />
      <ProductFormModal
        open={openEdit}
        onOpenChange={setOpenEdit}
        mode="edit"
        initialId={editInitial?.id}
        initialValues={{
          name: editInitial?.name,
          sku: editInitial?.sku,
          minStock: editInitial?.minStock,
          description: (editInitial as any)?.description,
        }}
        onSuccess={() => {
          setEditInitial(null);
          qc.invalidateQueries({ queryKey: ['products'] });
        }}
      />

      <MovementFormModal
        open={openMove}
        onOpenChange={(v) => {
          setOpenMove(v);
          if (!v) setSelectedProductId(null);
        }}
        productId={selectedProductId || ''}
        onSuccess={() => {
          // Atualiza saldos após movimentação
          qc.invalidateQueries({ queryKey: ['products'] });
        }}
      />

      <MovementHistoryModal
        open={openHistory}
        onOpenChange={(v) => {
          setOpenHistory(v);
          if (!v) setSelectedProductId(null);
        }}
        productId={selectedProductId || ''}
      />
    </section>
  );
}

export default ProductDashboard;
