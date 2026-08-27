import { ArrowDownToLine } from 'lucide-react';
import React from 'react';

import type { ProductWithBalance } from '../../api/types';
import type { ProductSortKey, StatusKey } from '../../hooks/useProductsQuery';
import Badge from '../ui/Badge';
import { DataTable, type Column, type Sort } from '../ui/DataTable';

import ProductActionsMenu from './ProductActionsMenu';
import StatusFilterMenu from './StatusFilterMenu';
import { productStatus, type ProductActions } from './types';

type Props = {
  items: ProductWithBalance[];
  isLoading: boolean;
  error: string | null;
  sorts: Sort[];
  onSortsChange: (next: Sort[]) => void;
  onTogglePrimarySort: (key: ProductSortKey) => void;
  statusFilter: StatusKey[];
  onToggleStatus: (value: StatusKey) => void;
  onClearStatus: () => void;
  selectedIds: Set<string>;
  onToggleSelected: (id: string, selected: boolean) => void;
  expandedIds: Record<string, boolean>;
  onToggleExpanded: (id: string) => void;
  actions: ProductActions;
  footer?: React.ReactNode;
};

function SortableHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir?: 'asc' | 'desc';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="group inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
      onClick={onClick}
    >
      <span className="text-gray-700">{label}</span>
      <span
        aria-hidden="true"
        className={`text-gray-600 transition-transform group-hover:text-gray-800 ${
          active && dir === 'desc' ? 'rotate-180' : ''
        }`}
      >
        ▲
      </span>
      <span className="sr-only">{active ? (dir === 'asc' ? '(ordenado crescente)' : '(ordenado decrescente)') : ''}</span>
    </button>
  );
}

/** Tabela de produtos (desktop/tablet). Extraída de `ProductDashboard`. */
export function ProductsTable({
  items,
  isLoading,
  error,
  sorts,
  onSortsChange,
  onTogglePrimarySort,
  statusFilter,
  onToggleStatus,
  onClearStatus,
  selectedIds,
  onToggleSelected,
  expandedIds,
  onToggleExpanded,
  actions,
  footer,
}: Props) {
  const primary = sorts[0];
  const isPrimary = (key: ProductSortKey) => primary?.by === key;

  const describeRow = (p: ProductWithBalance) => `product-description-${p.id}`;

  const columns: Column<ProductWithBalance>[] = [
    {
      key: '__select',
      header: 'Selecionar',
      width: 'w-[4%]',
      headerRender: <span className="sr-only">Selecionar</span>,
      render: (p) => (
        <input
          type="checkbox"
          aria-label={`Selecionar ${p.name}`}
          checked={selectedIds.has(p.id)}
          onChange={(e) => onToggleSelected(p.id, e.currentTarget.checked)}
          className="h-4 w-4 rounded border-gray-400 text-indigo-600 focus:ring-indigo-600"
        />
      ),
    },
    {
      key: 'name',
      header: 'Nome do Produto',
      width: 'w-[36%]',
      headerRender: (
        <SortableHeader
          label="Nome do Produto"
          active={isPrimary('name')}
          dir={primary?.dir}
          onClick={() => onTogglePrimarySort('name')}
        />
      ),
      render: (p) => (
        <div>
          {/* Antes era um `<div onClick>` sem tabIndex/role: invisível para
              teclado. Um `<button>` nativo dá foco, Enter/Espaço e o estado
              de expansão via aria-expanded/aria-controls de graça. */}
          <button
            type="button"
            className="rounded text-left text-sm text-gray-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            aria-expanded={!!expandedIds[p.id]}
            aria-controls={describeRow(p)}
            onClick={() => onToggleExpanded(p.id)}
          >
            {p.name}
          </button>
          {expandedIds[p.id] && (
            <div
              id={describeRow(p)}
              className="mt-2 rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700"
            >
              <div className="mb-1 font-medium text-gray-800">Descrição</div>
              <p className="whitespace-pre-line">{p.description || 'Sem descrição.'}</p>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      width: 'w-[20%]',
      headerRender: (
        <SortableHeader
          label="SKU"
          active={isPrimary('sku')}
          dir={primary?.dir}
          onClick={() => onTogglePrimarySort('sku')}
        />
      ),
      render: (p) => (
        <button
          type="button"
          className="rounded text-sm font-medium uppercase tracking-wide text-gray-700 hover:text-gray-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          aria-expanded={!!expandedIds[p.id]}
          aria-controls={describeRow(p)}
          onClick={() => onToggleExpanded(p.id)}
        >
          {p.sku}
        </button>
      ),
    },
    {
      key: 'balance',
      header: 'Saldo Atual',
      align: 'right',
      width: 'w-[12%]',
      headerRender: (
        <SortableHeader
          label="Saldo Atual"
          active={isPrimary('balance')}
          dir={primary?.dir}
          onClick={() => onTogglePrimarySort('balance')}
        />
      ),
      render: (p) => {
        const status = productStatus(p);
        const cls = status === 'OUT' ? 'text-rose-700' : status === 'ATTN' ? 'text-amber-700' : 'text-gray-900';
        return (
          <span className={`font-semibold ${cls}`}>
            {p.balance} <span className="font-normal text-gray-600">un.</span>
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-[14%]',
      headerRender: (
        <StatusFilterMenu selected={statusFilter} onToggle={onToggleStatus} onClear={onClearStatus} />
      ),
      render: (p) => {
        const status = productStatus(p);
        if (status === 'OK') return <Badge variant="success">Em Estoque</Badge>;
        if (status === 'ATTN') return <Badge variant="warning">Estoque Baixo</Badge>;
        return <Badge variant="danger">Fora de Estoque</Badge>;
      },
    },
    {
      key: '__actions',
      header: 'Ações',
      align: 'right',
      width: 'w-[14%]',
      render: (p) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-full border px-3.5 py-1.5 text-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            onClick={() => actions.onMove(p)}
          >
            Movimentar
          </button>
          <button
            type="button"
            aria-label={`Dar baixa rápida em ${p.name}`}
            className="rounded-full border p-1.5 text-sm text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            onClick={() => actions.onQuickOut(p)}
          >
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
          </button>
          <ProductActionsMenu product={p} actions={actions} />
        </div>
      ),
    },
  ];

  return (
    <DataTable<ProductWithBalance>
      columns={columns}
      items={items}
      getRowId={(p) => p.id}
      sorts={sorts}
      onSortsChange={onSortsChange}
      isLoading={isLoading}
      error={error}
      empty={<span>Nenhum produto encontrado.</span>}
      footer={footer}
    />
  );
}

export default ProductsTable;
