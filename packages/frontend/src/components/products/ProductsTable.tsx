import { ArrowDownToLine } from 'lucide-react';
import React from 'react';

import type { ProductWithBalance } from '../../api/types';
import type { ProductSortKey, StatusKey } from '../../hooks/useProductsQuery';
import { formatQuantity } from '../../lib/formatNumber';
import Badge from '../ui/Badge';
import { Button } from '../ui/Button';
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
  /** Há busca ou filtro de status ativo? Distingue os dois estados vazios (A-10). */
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onCreateProduct: () => void;
  actions: ProductActions;
  footer?: React.ReactNode;
};

/**
 * Controle de ordenação de um critério.
 *
 * O nome acessível é montado por conteúdo (nunca `aria-label`, que apagaria o
 * sufixo de direção): "Ordenar por " + rótulo visível + direção quando ativo.
 * T13-SD1 §9 — `aria-sort` vive no `<th>` e anuncia só "Produto, crescente";
 * quem distingue o subcritério é o nome deste botão.
 */
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
      className="group inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      onClick={onClick}
    >
      <span className="sr-only">Ordenar por </span>
      <span className={active ? 'text-gray-900' : 'text-gray-700'}>{label}</span>
      {/* O indicador acompanha SÓ o critério ativo. Com dois controles no mesmo
          cabeçalho (T13-SD1), uma seta em ambos tornaria impossível ver qual
          está ativo — o rótulo continua sempre visível (§13.3). */}
      {active && (
        <>
          <span aria-hidden="true" className={`text-gray-600 ${dir === 'desc' ? 'rotate-180' : ''}`}>
            ▲
          </span>
          <span className="sr-only">{dir === 'asc' ? '(ordenado crescente)' : '(ordenado decrescente)'}</span>
        </>
      )}
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
  hasActiveFilters,
  onClearFilters,
  onCreateProduct,
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
          className="h-4 w-4 rounded-control border-border-strong text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        />
      ),
    },
    {
      // Coluna "Produto": nome + SKU fundidos (design-system.md §13.2). O `<th>`
      // próprio do SKU deixa de existir; a ordenação por SKU passa a viver aqui,
      // em dois controles nomeados, e o `aria-sort` cobre os dois critérios
      // através de `sortKeys` (T13-SD1).
      key: 'name',
      header: 'Produto',
      width: 'w-[46%]',
      sortKeys: ['name', 'sku'],
      headerRender: (
        <span className="inline-flex items-center gap-1">
          <span className="text-gray-700">Produto</span>
          <span aria-hidden="true" className="text-text-secondary">
            ·
          </span>
          <SortableHeader
            label="Nome"
            active={isPrimary('name')}
            dir={primary?.dir}
            onClick={() => onTogglePrimarySort('name')}
          />
          <SortableHeader
            label="SKU"
            active={isPrimary('sku')}
            dir={primary?.dir}
            onClick={() => onTogglePrimarySort('sku')}
          />
        </span>
      ),
      render: (p) => (
        <div>
          {/* Gatilho ÚNICO de disclosure (antes o SKU era um segundo gatilho
              para a mesma região). A região existe sempre, apenas oculta —
              é o que torna `aria-controls` válido mesmo recolhido (A-7). */}
          <button
            type="button"
            className="rounded text-left text-sm font-medium text-gray-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            aria-expanded={!!expandedIds[p.id]}
            aria-controls={describeRow(p)}
            onClick={() => onToggleExpanded(p.id)}
          >
            {p.name}
          </button>
          {/* SKU sob o nome: maiúsculas vêm do conteúdo, não de CSS (§13.2),
              e o texto continua selecionável para copiar. */}
          <div className="text-xs text-gray-600">{p.sku}</div>
          <div
            id={describeRow(p)}
            hidden={!expandedIds[p.id]}
            className="mt-2 rounded-control border border-gray-200 bg-white p-3 text-xs text-gray-700"
          >
            <div className="mb-1 font-medium text-gray-800">Descrição</div>
            <p className="whitespace-pre-line">{p.description || 'Sem descrição.'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'balance',
      header: 'Saldo Atual',
      align: 'right',
      width: 'w-[16%]',
      tabularNums: true,
      headerRender: (
        <SortableHeader
          label="Saldo Atual"
          active={isPrimary('balance')}
          dir={primary?.dir}
          onClick={() => onTogglePrimarySort('balance')}
        />
      ),
      // Par saldo/mínimo: o veredito nunca aparece sem a evidência (C-6/UF-40).
      // Ambos com o helper da Task 2 e algarismos tabulares (A-6).
      render: (p) => (
        <div>
          <div className="font-semibold text-gray-900">
            {formatQuantity(p.balance)} <span className="font-normal text-gray-600">un.</span>
          </div>
          <div className="text-xs text-gray-600">mín. {formatQuantity(p.minStock)}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-[14%]',
      headerRender: (
        <StatusFilterMenu selected={statusFilter} onToggle={onToggleStatus} onClear={onClearStatus} />
      ),
      // Vocabulário único (Task 13). A regra de cálculo continua em
      // `products/types.ts` — aqui é só apresentação.
      render: (p) => {
        const status = productStatus(p);
        if (status === 'OK') return <Badge variant="success">Em estoque</Badge>;
        if (status === 'ATTN') return <Badge variant="warning">Estoque baixo</Badge>;
        return <Badge variant="danger">Sem estoque</Badge>;
      },
    },
    {
      key: '__actions',
      header: 'Ações',
      align: 'right',
      width: 'w-[14%]',
      render: (p) => (
        <div className="flex items-center justify-end gap-2">
          {/* "Movimentar" é a PRIMARY da linha; a baixa rápida é atalho neutro
              (perde o vermelho, A-1) e o resto vai para o overflow (§10.2). */}
          <Button variant="primary" size="sm" onClick={() => actions.onMove(p)}>
            Movimentar
          </Button>
          <Button
            variant="shortcut"
            size="sm"
            aria-label={`Dar baixa rápida em ${p.name}`}
            onClick={() => actions.onQuickOut(p)}
          >
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
          </Button>
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
      // A-10: a causa do vazio muda a saída oferecida. Um texto genérico para
      // os dois casos é justamente o antipadrão apontado na auditoria.
      empty={
        hasActiveFilters ? (
          <div className="flex flex-col items-center gap-2">
            <span>Nenhum produto corresponde à busca ou ao filtro.</span>
            <Button variant="secondary" size="sm" onClick={onClearFilters}>
              Limpar filtros
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span>Nenhum produto cadastrado ainda.</span>
            <Button variant="primary" size="sm" onClick={onCreateProduct}>
              Adicionar Produto
            </Button>
          </div>
        )
      }
      footer={footer}
    />
  );
}

export default ProductsTable;
