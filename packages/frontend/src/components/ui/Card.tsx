import React from 'react';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  interactive?: boolean;
}

/**
 * `Card` NUNCA tem sombra própria (design-system.md §8): o token único de
 * sombra é reservado a modal/sheet/popover/menu/toast — camadas de verdade
 * sobre o plano da página. `Card` é uma região que contém, não uma camada.
 *
 * PROIBIDO envolver a região de dados (a tabela de produtos) com `Card`: a
 * região de dados tem tratamento de borda próprio, e "card dentro de card"
 * anula a proximidade como sinal de agrupamento (§6).
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ title, subtitle, actions, footer, interactive, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-surface border bg-white ${interactive ? 'transition' : ''} ${className}`}
        {...props}
      >
        {(title || actions || subtitle) && (
          <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100">
            <div>
              {title && <div className="text-base font-medium text-gray-900">{title}</div>}
              {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
          </div>
        )}
        <div className="px-4 py-3">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-gray-100">{footer}</div>}
      </div>
    );
  }
);
Card.displayName = 'Card';

export default Card;
