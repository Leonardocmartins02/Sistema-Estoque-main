import { Check } from 'lucide-react';

import type { ProductSortKey, StatusKey } from '../../hooks/useProductsQuery';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

import { OPTIONS } from './StatusFilterMenu';

const SORTS: Array<{ key: ProductSortKey; label: string }> = [
  { key: 'name', label: 'Nome' },
  { key: 'sku', label: 'SKU' },
  { key: 'balance', label: 'Saldo' },
];

type Props = {
  open: boolean;
  onClose: () => void;
  statusFilter: StatusKey[];
  onToggleStatus: (value: StatusKey) => void;
  sortBy: ProductSortKey;
  sortDir: 'asc' | 'desc';
  onTogglePrimarySort: (key: ProductSortKey) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
};

/**
 * Filtro **e** ordenação do mobile, compostos sobre a variante `sheet` do
 * primitivo `Modal` (Task 9) — sem um segundo sistema de overlay e sem
 * dependência nova.
 *
 * A ordenação oferecida aqui é **a mesma da Task 3**: dispara
 * `onTogglePrimarySort`, então vai ao banco e atravessa a paginação. Não existe
 * um segundo caminho de ordenação — seria justamente a capacidade que mente
 * (UF-08/D-A) que o plano removeu.
 */
export function ProductFiltersSheet({
  open,
  onClose,
  statusFilter,
  onToggleStatus,
  sortBy,
  sortDir,
  onTogglePrimarySort,
  hasActiveFilters,
  onClearFilters,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} variant="sheet" size="lg" title="Filtrar e ordenar">
      <div className="flex flex-col gap-5">
        <section aria-labelledby="sheet-status">
          <h3 id="sheet-status" className="text-table-header uppercase tracking-wide text-gray-600">
            Status
          </h3>
          <ul className="mt-2 flex flex-col gap-1">
            {OPTIONS.map((opt) => {
              const checked = statusFilter.includes(opt.value);
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    aria-pressed={checked}
                    onClick={() => onToggleStatus(opt.value)}
                    className="flex h-11 w-full items-center gap-2 rounded-control px-2 text-left text-sm text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    <span className={`h-2 w-2 rounded-full ${opt.dot}`} aria-hidden="true" />
                    <span className="flex-1">{opt.label}</span>
                    {checked && <Check className="h-4 w-4 text-accent" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="sheet-sort">
          <h3 id="sheet-sort" className="text-table-header uppercase tracking-wide text-gray-600">
            Ordenar por
          </h3>
          <ul className="mt-2 flex flex-col gap-1">
            {SORTS.map((s) => {
              const active = sortBy === s.key;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onTogglePrimarySort(s.key)}
                    className="flex h-11 w-full items-center gap-2 rounded-control px-2 text-left text-sm text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    <span className="flex-1">Ordenar por {s.label}</span>
                    {active && (
                      <span className="text-xs text-gray-600">
                        {sortDir === 'asc' ? 'crescente' : 'decrescente'}
                      </span>
                    )}
                    {active && <Check className="h-4 w-4 text-accent" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* A saída do filtro também vive DENTRO da sheet — entrar e não sair
            era exatamente o beco sem saída do UF-07/UF-41. */}
        <Button variant="secondary" size="md" className="h-11" disabled={!hasActiveFilters} onClick={onClearFilters}>
          Limpar filtros
        </Button>
      </div>
    </Modal>
  );
}

export default ProductFiltersSheet;
