import { ArrowDownLeft, ArrowUpRight, Package, SlidersHorizontal, type LucideIcon } from 'lucide-react';

import type { Movement } from '../../api/types';

type MovementType = Movement['type'];

/**
 * Vocabulário único dos quatro tipos (design-system.md §14.1). Antes cada
 * tela tinha o seu mapa, e `INITIAL_STOCK` chegou a vazar cru (UF-34).
 */
export const MOVEMENT_TYPE_LABEL: Record<MovementType, string> = {
  IN: 'Entrada',
  OUT: 'Saída',
  ADJUSTMENT: 'Ajuste',
  INITIAL_STOCK: 'Estoque inicial',
};

// Seta = direção do estoque (entra ↙, sai ↗); ajuste e estoque inicial não
// têm direção, então usam o ícone do que são. A cor só reforça.
const STYLE: Record<MovementType, { icon: LucideIcon; chip: string }> = {
  IN: { icon: ArrowDownLeft, chip: 'bg-success-subtle text-success' },
  OUT: { icon: ArrowUpRight, chip: 'bg-danger-subtle text-danger' },
  ADJUSTMENT: { icon: SlidersHorizontal, chip: 'bg-info-subtle text-info' },
  INITIAL_STOCK: { icon: Package, chip: 'border border-border bg-surface-subtle text-text-secondary' },
};

/** Ícone + palavra, forma única em tabela, lista, cartão e painel. */
export function MovementTypeLabel({ type, className = '' }: { type: MovementType; className?: string }) {
  const { icon: Icon, chip } = STYLE[type];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-medium ${className}`}>
      <span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-sm ${chip}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      {MOVEMENT_TYPE_LABEL[type]}
    </span>
  );
}

export default MovementTypeLabel;
