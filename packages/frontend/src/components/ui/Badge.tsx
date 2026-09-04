import React from 'react';

// Fechado: estados de estoque (design-system.md §3.2) + `accent-subtle`, que
// serve o papel "informativo" — não existe token `info` separado (§3.1).
// `info` é o nome da prop mantido por compatibilidade com os chamadores
// atuais (`ProductDashboard`, `StatusFilterMenu`, e `MovementHistoryModal`
// via `TYPE_VARIANT.ADJUSTMENT`); o rename é cosmético e não é desta task.
type Variant = 'success' | 'warning' | 'danger' | 'info';

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
  children: React.ReactNode;
};

const styles: Record<Variant, string> = {
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  info: 'bg-accent-subtle text-accent-subtle-text',
};

// M-6: badge não é clicável, não é arrastável — nada muda quando o mouse
// passa por cima. `hover:scale`/`will-change` prometiam interatividade que
// não existe. Removidos.
export const Badge: React.FC<BadgeProps> = ({ variant = 'info', className = '', children, ...props }) => (
  <span
    className={`inline-flex items-center rounded-control px-2.5 py-0.5 text-xs font-medium ${styles[variant]} ${className}`}
    {...props}
  >
    {children}
  </span>
);

export default Badge;
