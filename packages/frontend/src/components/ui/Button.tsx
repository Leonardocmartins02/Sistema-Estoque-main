import React from 'react';

// `ghost` é alias de `tertiary` (design-system.md §10.1): 7 chamadores usam o
// nome antigo hoje, e o rename é cosmético — pode sair depois (D-E). Os dois
// resolvem para o mesmo estilo.
type Variant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'destructive' | 'shortcut';
type CanonicalVariant = Exclude<Variant, 'ghost'>;
type Size = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

// Foco: uma única semântica em todo o produto (design-system.md §9) — anel
// `accent` de 2px, offset de 2px, só em `focus-visible`. `outline-none` é
// incondicional, mas sempre acompanhado do anel — nunca removido sem
// substituição.
const base =
  'inline-flex items-center justify-center gap-1.5 rounded-control font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed';

// Hierarquia por preenchimento, não por forma (design-system.md §10.1).
const variants: Record<CanonicalVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong',
  secondary: 'bg-surface border border-border-strong text-text-primary hover:bg-surface-subtle',
  tertiary: 'text-text-secondary hover:bg-surface-subtle',
  destructive: 'bg-danger text-white hover:bg-danger/90',
  // SPECIALIZED SHORTCUT: neutro, sem peso de fonte destacado.
  shortcut: 'text-text-secondary hover:bg-surface-subtle font-normal',
};

// Dois tamanhos, não três — `lg` eliminado (design-system.md §10.3; zero usos
// verificados no código antes da remoção).
const sizes: Record<Size, string> = {
  md: 'text-sm px-3.5 py-2',
  sm: 'text-xs px-2.5 py-1.5',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      className = '',
      children,
      onClick,
      disabled,
      'aria-disabled': ariaDisabledProp,
      'aria-busy': ariaBusyProp,
      ...rest
    },
    ref,
  ) => {
    const resolvedVariant: CanonicalVariant = variant === 'ghost' ? 'tertiary' : variant;

    // `loading` usa `aria-disabled`, não `disabled` (design-system.md §11.2):
    // o botão continua focável, e a ativação é bloqueada aqui, no handler —
    // não pelo atributo nativo, que tiraria o foco do controle recém-acionado.
    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      if (isLoading) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        aria-disabled={isLoading ? true : ariaDisabledProp}
        aria-busy={isLoading ? true : ariaBusyProp}
        onClick={handleClick}
        className={`${base} ${variants[resolvedVariant]} ${sizes[size]} ${className}`}
        {...rest}
      >
        {isLoading && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export default Button;
