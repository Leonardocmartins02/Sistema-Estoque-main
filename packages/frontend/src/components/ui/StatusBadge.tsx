import type { ProductStatus } from '../products/types';

import { Badge } from './Badge';

/**
 * Vocabulário fechado do estado de estoque (Fase 4; P5 da refatoração visual):
 * um nome por estado no produto inteiro. A regra que escolhe o estado continua
 * em `productStatus()` (PS-1) — aqui é só a tradução em tela.
 */
export const STATUS_LABEL: Record<ProductStatus, string> = {
  OK: 'Em estoque',
  ATTN: 'Estoque baixo',
  OUT: 'Sem estoque',
};

const VARIANT: Record<ProductStatus, 'success' | 'warning' | 'danger'> = {
  OK: 'success',
  ATTN: 'warning',
  OUT: 'danger',
};

// Ponto no preenchimento de status (`*-fill`), o mesmo da barra de status e
// dos contadores da sidebar — validado lado a lado (research.md Q5).
const DOT: Record<ProductStatus, string> = {
  OK: 'bg-success-fill',
  ATTN: 'bg-warning-fill',
  OUT: 'bg-danger-fill',
};

/** Cor + palavra + ponto. O ponto é decorativo: o leitor de tela ouve só a palavra (WCAG 1.4.1). */
export function StatusBadge({ status, className }: { status: ProductStatus; className?: string }) {
  return (
    <Badge variant={VARIANT[status]} className={className}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-pill ${DOT[status]}`} />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export default StatusBadge;
