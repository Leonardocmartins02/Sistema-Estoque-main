import React from 'react';

export interface Option {
  label: string;
  value: string | number;
}

// Nome acessível obrigatório pelo tipo, não pela convenção (design-system.md
// §11): `label` ou `aria-label`, nunca nenhum dos dois.
type LabelledProps =
  | { label: string; 'aria-label'?: string }
  | { label?: string; 'aria-label': string };

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> &
  LabelledProps & {
    hint?: string;
    error?: string;
    options: Option[];
  };

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, id, hint, error, options, className = '', children, ...props }, ref) => {
    const selectId = id || React.useId();
    const describedByIds: string[] = [];
    if (hint) describedByIds.push(`${selectId}-hint`);
    if (error) describedByIds.push(`${selectId}-error`);

    // Contorno de controle (design-system.md §3.4): `border-strong` atende
    // 3:1 contra a superfície; `border-gray-300`/`border-red-300` não
    // atendiam. Erro escolhe `danger` no lugar de `border-strong` — nunca os
    // dois juntos.
    const borderColor = error ? 'border-danger' : 'border-border-strong';

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative mt-1">
          <select
            id={selectId}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={describedByIds.join(' ') || undefined}
            className={`w-full appearance-none rounded-control border ${borderColor} bg-surface px-3 py-2 text-sm outline-none transition hover:border-border-hover focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-subtle disabled:text-text-muted ${className}`}
            {...props}
          >
            {children}
            {options.map((opt) => (
              <option key={String(opt.value)} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {hint && !error && (
          <p id={`${selectId}-hint`} className="mt-1 text-xs text-gray-500">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${selectId}-error`} className="mt-1 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';

export default Select;
