import { useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ProductWithBalance } from '../api/types';
import { useConfirm } from '../hooks/useConfirm';
import { useProductMutations } from '../hooks/useProductMutations';
import { useProductsQuery, type StatusKey } from '../hooks/useProductsQuery';
import { useProductStockSummary } from '../hooks/useProductStockSummary';
import { formatQuantity } from '../lib/formatNumber';

import { AdjustmentFormModal } from './AdjustmentFormModal';
import { MovementFormModal } from './MovementFormModal';
import { MovementHistoryModal } from './MovementHistoryModal';
import ProductCardList from './products/ProductCardList';
import { ProductFiltersSheet } from './products/ProductFiltersSheet';
import ProductsTable from './products/ProductsTable';
import { OPTIONS as STATUS_OPTIONS } from './products/StatusFilterMenu';
import type { ProductActions } from './products/types';
import { ProductFormModal } from './ProductFormModal';
import QuickOutHistoryModal from './QuickOutHistoryModal';
import QuickOutListModal from './QuickOutListModal';
import { QuickOutModal } from './QuickOutModal';
import { Badge } from './ui/Badge';
import Button from './ui/Button';
import Input from './ui/Input';
import LowStockBanner from './ui/LowStockBanner';

/** Vocabulário único (Task 14) reaproveitado — nunca uma quarta cópia. */
const STATUS_LABEL: Record<StatusKey, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
) as Record<StatusKey, string>;

/**
 * Container de orquestração da tela de produtos.
 *
 * Estado de listagem vive em `useProductsQuery`, mutações em
 * `useProductMutations`, e apresentação em `products/ProductsTable` e
 * `products/ProductCardList`. Este arquivo só conecta as peças e controla
 * quais diálogos estão abertos.
 */
export function ProductDashboard() {
  const products = useProductsQuery();
  const { removeProduct, zeroBalance, removeProducts, zeroBalances, invalidateProducts } = useProductMutations();
  const { confirm, confirmDialog } = useConfirm();
  const stockSummary = useProductStockSummary();
  const queryClient = useQueryClient();

  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<ProductWithBalance | null>(null);
  // Task 17: o diálogo de movimentação precisa do produto INTEIRO (nome, SKU,
  // saldo e mínimo) para dar contexto e calcular o preview — não só do id.
  const [movingProduct, setMovingProduct] = useState<ProductWithBalance | null>(null);
  // Task 19: o histórico passou a precisar do produto inteiro — sem nome e SKU
  // o título não podia nomear o produto (UF-35). O saldo NÃO vem daqui: o
  // diálogo o busca na rota do produto (REV-06).
  const [historyProduct, setHistoryProduct] = useState<ProductWithBalance | null>(null);
  const [quickOutProduct, setQuickOutProduct] = useState<ProductWithBalance | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<ProductWithBalance | null>(null);
  const [openQuickOutList, setOpenQuickOutList] = useState(false);
  const [openQuickOutHistory, setOpenQuickOutHistory] = useState(false);
  const [openFilters, setOpenFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const hasActiveFilters = products.search.trim() !== '' || products.statusFilter.length > 0;
  const activeFilterCount = products.statusFilter.length + (products.search.trim() !== '' ? 1 : 0);
  const primarySort = products.sorts[0];
  const sortBy = (primarySort?.by ?? 'name') as 'name' | 'sku' | 'balance';
  const sortDir = primarySort?.dir ?? 'asc';

  const clearAllFilters = useCallback(() => {
    products.setSearch('');
    products.clearStatus();
  }, [products]);

  // Decisão de produto: seleção múltipla não atravessa paginação/busca/filtro
  // (F-04). Sem isto, uma ação em lote podia atingir produtos que não estão
  // mais visíveis na tela.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [products.page, products.search, products.statusFilter]);

  const toggleSelected = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const actions: ProductActions = useMemo(
    () => ({
      onMove: (p) => setMovingProduct(p),
      onQuickOut: (p) => setQuickOutProduct(p),
      onEdit: (p) => setEditing(p),
      onHistory: (p) => setHistoryProduct(p),
      onAdjust: (p) => setAdjustingProduct(p),
      onZeroBalance: async (p) => {
        if (p.balance <= 0) return;
        const ok = await confirm({
          title: `Zerar saldo de ${p.name}?`,
          description: `Será lançada uma SAÍDA (OUT) de ${p.balance} unidade(s).`,
          confirmLabel: 'Zerar estoque',
        });
        if (ok) zeroBalance.mutate(p);
      },
      onDelete: async (p) => {
        const ok = await confirm({
          title: `Excluir produto ${p.name}?`,
          description: 'Esta ação não pode ser desfeita e remove também as movimentações deste produto.',
          confirmLabel: 'Excluir',
        });
        if (ok) removeProduct.mutate(p);
      },
    }),
    [confirm, zeroBalance, removeProduct],
  );

  const { items, viewItems, query } = products;
  const errorMessage = query.isError ? (query.error as Error)?.message || 'Erro ao carregar produtos' : null;
  const busy = query.isFetching;

  const handleDeleteSelected = async () => {
    const chosen = items.filter((p) => selectedIds.has(p.id));
    if (chosen.length === 0) return;
    const ok = await confirm({
      title: `Excluir ${chosen.length} produto(s) selecionado(s)?`,
      description: 'Esta ação também remove as movimentações destes produtos e não pode ser desfeita.',
      confirmLabel: 'Excluir selecionados',
    });
    if (!ok) return;
    setSelectedIds(new Set());
    removeProducts.mutate(chosen);
  };

  const handleZeroPage = async () => {
    const withBalance = items.filter((p) => p.balance > 0);
    const totalBalance = withBalance.reduce((acc, p) => acc + p.balance, 0);
    if (totalBalance <= 0) return;
    const ok = await confirm({
      title: 'Zerar todos os produtos desta página?',
      description: `Será lançada uma SAÍDA (OUT) totalizando ${totalBalance} unidade(s) em ${withBalance.length} produto(s).`,
      confirmLabel: 'Zerar página',
    });
    if (ok) zeroBalances.mutate(withBalance);
  };

  const handleDeletePage = async () => {
    if (items.length === 0) return;
    const ok = await confirm({
      title: `Excluir todos os ${items.length} produtos desta página?`,
      description: 'Esta ação remove os produtos e suas movimentações e não pode ser desfeita.',
      confirmLabel: 'Excluir página',
    });
    if (!ok) return;
    removeProducts.mutate(items);
    products.setPage(1);
  };

  return (
    <section aria-labelledby="products-heading" className="mt-8">
      <div>
        <h2 id="products-heading" className="text-page-title text-text-primary">
          Produtos
        </h2>
        <p className="text-sm text-gray-600">Gerencie o cadastro e o estoque</p>
        <LowStockBanner summary={stockSummary.data} onShowLowStock={products.showLowStock} />
        {/* Duas ações com rótulos longos e sem regra de quebra (design-system.md
            §15.2 regra 5): empilham em largura total abaixo de `sm`. */}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="primary" size="md" onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar Produto
          </Button>
          <Button variant="secondary" size="md" onClick={() => setOpenQuickOutList(true)}>
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
            Baixa de Produtos
          </Button>
        </div>
      </div>

      {/* Zona de controle — mesmo container do shell (D-B). A busca é inline em
          todas as larguras; a sheet leva filtro E ordenação ao mobile. */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-md">
          <Input
            id="search"
            label="Buscar por Nome ou SKU"
            type="search"
            placeholder="Ex.: Caneta ou SKU123"
            leftIcon={<Search className="h-4 w-4 text-gray-500" aria-hidden="true" />}
            value={products.search}
            onChange={(e) => products.setSearch(e.target.value)}
          />
        </div>
        <Button variant="secondary" size="md" className="h-11 md:hidden" onClick={() => setOpenFilters(true)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filtrar e ordenar
          {activeFilterCount > 0 && <Badge variant="info">{activeFilterCount}</Badge>}
        </Button>
      </div>

      {/* Chips de filtro ativo — removíveis e visíveis em QUALQUER largura.
          É a saída do beco sem saída do UF-07/UF-41: entrou pelo banner, sai
          por aqui, sem depender de um menu que só existe no desktop. */}
      {hasActiveFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {products.search.trim() !== '' && (
            <button
              type="button"
              onClick={() => products.setSearch('')}
              className="inline-flex h-8 items-center gap-1 rounded-control border border-border-strong bg-white px-2 text-xs text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              Busca: {products.search}
              <X className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">Remover filtro de busca</span>
            </button>
          )}
          {products.statusFilter.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => products.toggleStatus(key)}
              className="inline-flex h-8 items-center gap-1 rounded-control border border-border-strong bg-white px-2 text-xs text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              {STATUS_LABEL[key]}
              <X className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">Remover filtro {STATUS_LABEL[key]}</span>
            </button>
          ))}
          <Button variant="tertiary" size="sm" onClick={clearAllFilters}>
            Limpar filtros
          </Button>
        </div>
      )}

      {/* Tabela (desktop/tablet) */}
      <div data-surface="table" className="mt-6 hidden md:block">
        {/* Barra contextual de seleção: SUBSTITUI a zona de controle enquanto
            há seleção e some quando não há — em vez de um "Excluir" visível e
            permanentemente desabilitado (N-3). Vive dentro do ramo da tabela
            porque a seleção só existe nesta superfície (DEP-03). */}
        {selectedIds.size > 0 && (
          <div
            role="region"
            aria-label="Ações para a seleção atual"
            className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-surface border bg-accent-subtle px-3 py-2"
          >
            <span className="text-sm text-accent-subtle-text">
              {selectedIds.size} selecionado(s) nesta página
            </span>
            <Button variant="destructive" size="sm" disabled={removeProducts.isPending} onClick={handleDeleteSelected}>
              Excluir selecionados ({selectedIds.size})
            </Button>
          </div>
        )}
        <ProductsTable
          items={viewItems}
          isLoading={query.isLoading}
          error={errorMessage}
          sorts={products.sorts}
          onSortsChange={products.setSorts}
          onTogglePrimarySort={products.togglePrimarySort}
          statusFilter={products.statusFilter}
          onToggleStatus={products.toggleStatus}
          onClearStatus={products.clearStatus}
          selectedIds={selectedIds}
          onToggleSelected={toggleSelected}
          expandedIds={expandedIds}
          onToggleExpanded={toggleExpanded}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearAllFilters}
          onCreateProduct={() => setOpenCreate(true)}
          actions={actions}
          footer={
            // Região destrutiva rotulada, fora da hierarquia primária (§10.2).
            <div
              role="region"
              aria-label="Ações destrutivas da página"
              className="flex flex-wrap items-center justify-end gap-2"
            >
              <Button
                variant="secondary"
                size="sm"
                disabled={items.length === 0 || busy || zeroBalances.isPending}
                onClick={handleZeroPage}
              >
                Zerar página
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={items.length === 0 || busy || removeProducts.isPending}
                onClick={handleDeletePage}
              >
                Excluir página
              </Button>
            </div>
          }
        />
      </div>

      {/* Cards (mobile) */}
      <div data-surface="cards" className="mt-4 md:hidden">
        <ProductCardList
          items={viewItems}
          isLoading={query.isLoading}
          error={errorMessage}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearAllFilters}
          onCreateProduct={() => setOpenCreate(true)}
          actions={actions}
        />
      </div>

      {/* C-4: a paginação vem DEPOIS da lista, nas duas superfícies, e informa
          o total de itens — antes era renderizada acima dos cards. */}
      <nav aria-label="Paginação de produtos" className="mt-6 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={products.page <= 1 || busy}
          onClick={() => products.setPage((p) => Math.max(1, p - 1))}
        >
          ← Anterior
        </Button>
        <span className="px-2 text-sm text-gray-700" aria-live="polite">
          Página {products.page} de {products.totalPages} · {formatQuantity(products.total)}{' '}
          {products.total === 1 ? 'produto' : 'produtos'}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={products.page >= products.totalPages || busy}
          onClick={() => products.setPage((p) => Math.min(products.totalPages, p + 1))}
        >
          Próxima →
        </Button>
      </nav>

      <ProductFiltersSheet
        open={openFilters}
        onClose={() => setOpenFilters(false)}
        statusFilter={products.statusFilter}
        onToggleStatus={products.toggleStatus}
        sortBy={sortBy}
        sortDir={sortDir}
        onTogglePrimarySort={products.togglePrimarySort}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearAllFilters}
      />

      {/* Diálogos — uma instância de cada (antes MovementFormModal e
          MovementHistoryModal eram renderizados duas vezes, e ambos montavam
          sempre). */}
      <ProductFormModal
        open={openCreate}
        onOpenChange={setOpenCreate}
        mode="create"
        onSuccess={invalidateProducts}
      />
      <ProductFormModal
        open={editing !== null}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
        mode="edit"
        initialId={editing?.id}
        initialValues={{
          name: editing?.name,
          sku: editing?.sku,
          minStock: editing?.minStock,
          description: editing?.description ?? '',
        }}
        onSuccess={() => {
          setEditing(null);
          invalidateProducts();
        }}
      />

      {movingProduct && (
        <MovementFormModal
          open
          onOpenChange={(v) => {
            if (!v) setMovingProduct(null);
          }}
          product={{
            id: movingProduct.id,
            name: movingProduct.name,
            sku: movingProduct.sku,
            balance: movingProduct.balance,
            minStock: movingProduct.minStock,
          }}
          onSuccess={invalidateProducts}
        />
      )}

      {historyProduct && (
        <MovementHistoryModal
          open
          onOpenChange={(v) => {
            if (!v) setHistoryProduct(null);
          }}
          product={{ id: historyProduct.id, name: historyProduct.name, sku: historyProduct.sku }}
        />
      )}

      <QuickOutListModal
        open={openQuickOutList}
        onOpenChange={setOpenQuickOutList}
        onOpenHistory={() => setOpenQuickOutHistory(true)}
        onPick={(p) => {
          setOpenQuickOutList(false);
          setQuickOutProduct(p);
        }}
      />

      <QuickOutHistoryModal open={openQuickOutHistory} onOpenChange={setOpenQuickOutHistory} />

      {quickOutProduct && (
        <QuickOutModal
          open
          onOpenChange={(v) => {
            if (!v) setQuickOutProduct(null);
          }}
          product={{
            id: quickOutProduct.id,
            name: quickOutProduct.name,
            sku: quickOutProduct.sku,
            currentBalance: quickOutProduct.balance,
          }}
          onSuccess={invalidateProducts}
        />
      )}

      {/* Montado só enquanto há produto em ajuste (mesmo padrão do QuickOutModal):
          AdjustmentFormModal guarda a baseline de saldo em useState derivado de
          product.balance, então desmontar é o que garante que o próximo produto
          ajustado não herde a baseline do anterior. */}
      {adjustingProduct && (
        <AdjustmentFormModal
          open
          onOpenChange={(v) => {
            if (!v) setAdjustingProduct(null);
          }}
          product={{
            id: adjustingProduct.id,
            name: adjustingProduct.name,
            sku: adjustingProduct.sku,
            balance: adjustingProduct.balance,
          }}
          onSuccess={() => {
            invalidateProducts();
            queryClient.invalidateQueries({ queryKey: ['movements', adjustingProduct.id] });
          }}
        />
      )}

      {confirmDialog}
    </section>
  );
}

export default ProductDashboard;
