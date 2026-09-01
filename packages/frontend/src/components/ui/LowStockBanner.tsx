import type { ProductStockSummary } from '@simplestock/shared';

import Button from './Button';

/**
 * Alerta de estoque baixo — puramente apresentacional (dados vêm de
 * `useProductStockSummary`). Fica em uma live region SEMPRE montada, como o
 * `ApiStatusBanner`: uma região criada só quando o alerta aparece não é
 * anunciada por leitor de tela.
 */
export function LowStockBanner({
  summary,
  onShowLowStock,
}: {
  summary: ProductStockSummary | undefined;
  onShowLowStock: () => void;
}) {
  const lowStockCount = summary ? summary.attn + summary.out : 0;

  return (
    <div role="status" aria-live="polite">
      {lowStockCount > 0 && summary && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-surface border border-warning bg-warning-subtle px-3 py-2 text-sm text-warning">
          <span>
            {lowStockCount} produto{lowStockCount === 1 ? '' : 's'} com estoque baixo: {summary.attn} em atenção,{' '}
            {summary.out} sem estoque.
          </span>
          <Button variant="secondary" size="sm" onClick={onShowLowStock}>
            Ver produtos
          </Button>
        </div>
      )}
    </div>
  );
}

export default LowStockBanner;
