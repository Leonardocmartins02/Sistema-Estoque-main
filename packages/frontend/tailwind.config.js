/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Tokens semânticos (Fase 5, design-system.md §2–§4). Primitivo →
        // semântico: componente consome só estes nomes, nunca a paleta
        // default do Tailwind diretamente para cor de acento/estado/borda.
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-subtle': 'rgb(var(--color-surface-subtle) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        'border-strong': 'rgb(var(--color-border-strong) / <alpha-value>)',
        'border-hover': 'rgb(var(--color-border-hover) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-strong': 'rgb(var(--color-accent-strong) / <alpha-value>)',
        'accent-subtle': 'rgb(var(--color-accent-subtle) / <alpha-value>)',
        'accent-subtle-text': 'rgb(var(--color-accent-subtle-text) / <alpha-value>)',
        focus: 'rgb(var(--color-focus) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        'success-subtle': 'rgb(var(--color-success-subtle) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        'warning-subtle': 'rgb(var(--color-warning-subtle) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        'danger-subtle': 'rgb(var(--color-danger-subtle) / <alpha-value>)',
      },
      // Dois níveis de raio (design-system.md §7). `rounded-full`,
      // `rounded-lg`, `rounded-xl`, `rounded-2xl` saem do vocabulário na
      // Task 27, quando os últimos consumidores migrarem.
      borderRadius: {
        control: '6px',
        surface: '8px',
      },
      // Escala tipográfica fechada — cinco tamanhos (design-system.md §5.2).
      fontSize: {
        'page-title': ['24px', { lineHeight: '1.25', fontWeight: '600' }],
        'section-title': ['18px', { lineHeight: '1.35', fontWeight: '600' }],
        'component-title': ['16px', { lineHeight: '1.40', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.55', fontWeight: '400' }],
        label: ['14px', { lineHeight: '1.40', fontWeight: '500' }],
        'table-cell': ['14px', { lineHeight: '1.40', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '1.40', fontWeight: '400' }],
        'table-header': ['12px', { lineHeight: '1.40', fontWeight: '600' }],
      },
      // Um único token de sombra — reservado a overlay/camada real
      // (design-system.md §8). Valor idêntico ao já validado no protótipo
      // da Fase 6 (docs/ui-ux/prototype/dashboard.html).
      boxShadow: {
        overlay: '0 10px 24px -6px rgb(0 0 0 / 0.18), 0 4px 8px -4px rgb(0 0 0 / 0.10)',
      },
      // Motion — política mínima (design-system.md §16): 120ms para
      // transição de estado, 180ms para entrada/saída de overlay. Chaves
      // nomeadas, sem tocar `DEFAULT` — o `transition` (150ms) já usado sem
      // duração explícita em `Card.tsx`/`ToastProvider.tsx` não pode mudar
      // de comportamento nesta task.
      transitionDuration: {
        120: '120ms',
        180: '180ms',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
          'Noto Color Emoji',
        ],
      },
    },
  },
  plugins: [],
}
