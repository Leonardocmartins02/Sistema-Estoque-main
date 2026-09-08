import React from 'react';

// Nome acessível obrigatório pelo tipo, não pela convenção (design-system.md
// §11): `label` ou `aria-label`, nunca nenhum dos dois.
type LabelledProps =
  | { label: string; 'aria-label'?: string }
  | { label?: string; 'aria-label': string };

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> &
  LabelledProps & {
    hint?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
  };

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, id, hint, error, leftIcon, rightIcon, className = '', ...props }, ref) => {
    const inputId = id || React.useId();
    const describedByIds: string[] = [];
    if (hint) describedByIds.push(`${inputId}-hint`);
    if (error) describedByIds.push(`${inputId}-error`);

    // Contorno de controle (design-system.md §3.4): `border-strong` atende
    // 3:1 contra a superfície; `border-gray-300`/`border-red-300` não
    // atendiam. Erro escolhe `danger` no lugar de `border-strong` — nunca os
    // dois juntos.
    const borderColor = error ? 'border-danger' : 'border-border-strong';

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative mt-1">
          {leftIcon && (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {leftIcon}
            </span>
          )}
          {/*
            ALVO DE TOQUE — mesma política já aplicada ao `Button` (`sm` e `md`).
            Sem piso de altura o campo se dimensionava só pelo conteúdo:
            `text-sm` (line-height 20px) + `py-2` (8+8) + `border` (1+1) = 38px,
            abaixo do mínimo de 44 exigido no mobile. `min-h-11` eleva SÓ a caixa;
            tipografia, padding e ícones continuam idênticos, e o texto de um input
            de linha única é centrado verticalmente pelo próprio browser.

            Sem `min-w-11`: o primitivo já é `w-full`, então a largura nunca é o
            eixo em falta — o piso horizontal seria inerte.

            A partir do breakpoint `md:` (768px), desktop-first: `min-h-0` devolve
            a densidade compacta atual, acima do piso global de 24×24.
          */}
          <input
            id={inputId}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={describedByIds.join(' ') || undefined}
            className={`w-full min-h-11 rounded-control border ${borderColor} bg-surface py-2 text-sm outline-none transition hover:border-border-hover focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-subtle disabled:text-text-muted ${leftIcon ? 'pl-9 pr-3' : rightIcon ? 'pl-3 pr-9' : 'px-3'} md:min-h-0 ${className}`}
            {...props}
          />
          {rightIcon && (
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              {rightIcon}
            </span>
          )}
        </div>
        {hint && !error && (
          <p id={`${inputId}-hint`} className="mt-1 text-xs text-gray-500">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export default Input;
