import React from 'react';

// Fechado: estados de estoque (design-system.md §3.2) + `info`, que desde a v2
// tem token próprio (research.md Q5) — antes emprestava o par de acento.
type Variant = 'success' | 'warning' | 'danger' | 'info';

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
  children: React.ReactNode;
};

const styles: Record<Variant, string> = {
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  info: 'bg-info-subtle text-info',
};

// M-6: badge não é clicável, não é arrastável — nada muda quando o mouse
// passa por cima. `hover:scale`/`will-change` prometiam interatividade que
// não existe. Removidos.
//
// v2: pílula (`rounded-pill`) de 24px, peso 600 e `gap` para o ponto do
// `StatusBadge` — a forma separa "estado" de "controle" (botão e campo são
// `rounded-control`).
export const Badge: React.FC<BadgeProps> = ({ variant = 'info', className = '', children, ...props }) => (
  <span
    className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 text-xs font-semibold ${styles[variant]} ${className}`}
    {...props}
  >
    {children}
  </span>
);

export default Badge;
