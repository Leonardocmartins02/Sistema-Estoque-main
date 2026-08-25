import React from 'react';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ title, subtitle, actions, footer, interactive, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-lg border bg-white shadow-sm ${interactive ? 'transition hover:shadow-md' : ''} ${className}`}
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
