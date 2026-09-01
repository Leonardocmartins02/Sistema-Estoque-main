import type { ProductWithBalance } from '../../api/types';
import { formatQuantity } from '../../lib/formatNumber';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

import ProductActionsMenu from './ProductActionsMenu';
import { productStatus, type ProductActions } from './types';

type Props = {
  items: ProductWithBalance[];
  isLoading: boolean;
  error: string | null;
  /** Há busca ou filtro ativo? Distingue os dois estados vazios (A-10/A-12ʳ). */
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onCreateProduct: () => void;
  actions: ProductActions;
};

/**
 * Lista de produtos em cards (mobile).
 *
 * O card **é** a linha com mais respiro vertical (design-system.md §15.2
 * regra 3) — deixou de ser um `ui/Card` com moldura própria envolvendo uma
 * linha. Superfície com borda e `radius-surface`, sem sombra, ocupando toda a
 * largura disponível dentro do gutter do shell (D-B).
 */
const SURFACE = 'rounded-surface border bg-white px-4 py-3';

export function ProductCardList({
  items,
  isLoading,
  error,
  hasActiveFilters,
  onClearFilters,
  onCreateProduct,
  actions,
}: Props) {
  if (isLoading) {
    return (
      <div className={`${SURFACE} text-sm text-gray-600`} role="status">
        Carregando...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${SURFACE} text-sm text-red-800`} role="alert">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    // A-12ʳ: o vazio era mudo. Agora é anunciado e nomeia a causa, com a
    // saída correspondente — mesmo contrato já usado na tabela (A-10).
    return (
      <div className={`${SURFACE} flex flex-col items-center gap-2 text-sm text-gray-600`} role="status">
        {hasActiveFilters ? (
          <>
            <span>Nenhum produto corresponde à busca ou ao filtro.</span>
            <Button variant="secondary" size="sm" onClick={onClearFilters}>
              Limpar filtros
            </Button>
          </>
        ) : (
          <>
            <span>Nenhum produto cadastrado ainda.</span>
            <Button variant="primary" size="sm" onClick={onCreateProduct}>
              Adicionar Produto
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((p) => {
        const status = productStatus(p);
        return (
          <li key={p.id} className={SURFACE}>
            <div className="flex items-start justify-between gap-3">
              {/* `flex-1 min-w-0` deixa o bloco encolher: sem isso o nome
                  mantinha a largura do conteúdo e empurrava saldo/status para
                  fora do viewport em 320px. O nome quebra em linhas — não é
                  truncado, para não esconder informação. */}
              <div className="min-w-0 flex-1">
                <div className="text-base font-medium text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-600">SKU: {p.sku}</div>
              </div>
              {/* Par saldo/mínimo, ambos tabulares e pelo helper da Task 2 —
                  o veredito nunca aparece sem a evidência (C-5/UF-23). */}
              <div className="flex shrink-0 flex-col items-end tabular-nums">
                <span className="text-sm font-semibold text-gray-900">
                  {formatQuantity(p.balance)} <span className="font-normal text-gray-600">un.</span>
                </span>
                <span className="text-xs text-gray-600">mín. {formatQuantity(p.minStock)}</span>
              </div>
            </div>
            <div className="mt-2">
              {/* Vocabulário único (Task 14): as mesmas três palavras da
                  tabela e do filtro. */}
              {status === 'OK' && <Badge variant="success">Em estoque</Badge>}
              {status === 'ATTN' && <Badge variant="warning">Estoque baixo</Badge>}
              {status === 'OUT' && <Badge variant="danger">Sem estoque</Badge>}
            </div>
            <div className="mt-3 flex items-center gap-2">
              {/* Alvos de 44×44 no mobile (§15.2 regra 4). "Movimentar" é a
                  PRIMARY do card; a baixa rápida vive no overflow (P-1). */}
              <Button variant="primary" size="md" className="h-11 flex-1" onClick={() => actions.onMove(p)}>
                Movimentar
              </Button>
              <ProductActionsMenu product={p} actions={actions} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default ProductCardList;
