import React from 'react';

// Nome acessível obrigatório pelo tipo, não pela convenção (design-system.md
// §11): `label` ou `aria-label`, nunca nenhum dos dois.
type LabelledProps =
  | { label: string; 'aria-label'?: string }
  | { label?: string; 'aria-label': string };

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  LabelledProps & {
    hint?: string;
    error?: string;
  };

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, id, hint, error, className = '', ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id || generatedId;

    // SD-3 (implementation-plan.md §9.3.2): `aria-describedby` referencia
    // somente elementos realmente renderizados. Com `error`, o hint é
    // suprimido — e por isso o id do hint também sai da lista. Não copiar a
    // dívida do `ui/Input`, que referencia o hint mesmo sem renderizá-lo.
    const describedByIds: string[] = [];
    if (hint && !error) describedByIds.push(`${textareaId}-hint`);
    if (error) describedByIds.push(`${textareaId}-error`);

    // Contorno de controle (design-system.md §3.4): `border-strong` atende
    // 3:1 contra a superfície. Erro escolhe `danger` no lugar de
    // `border-strong` — nunca os dois juntos.
    const borderColor = error ? 'border-danger' : 'border-border-strong';

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative mt-1">
          <textarea
            id={textareaId}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={describedByIds.join(' ') || undefined}
            className={`w-full resize-y rounded-control border ${borderColor} bg-surface px-3 py-2 text-sm outline-none transition hover:border-border-hover focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-subtle disabled:text-text-muted ${className}`}
            {...props}
          />
        </div>
        {hint && !error && (
          <p id={`${textareaId}-hint`} className="mt-1 text-xs text-gray-500">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${textareaId}-error`} className="mt-1 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export default Textarea;
