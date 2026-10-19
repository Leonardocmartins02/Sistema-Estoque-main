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
        'surface-selected': 'rgb(var(--color-surface-selected) / <alpha-value>)',
        track: 'rgb(var(--color-track) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        'border-strong': 'rgb(var(--color-border-strong) / <alpha-value>)',
        'border-hover': 'rgb(var(--color-border-hover) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
        'text-disabled': 'rgb(var(--color-text-disabled) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-strong': 'rgb(var(--color-accent-strong) / <alpha-value>)',
        'accent-subtle': 'rgb(var(--color-accent-subtle) / <alpha-value>)',
        'accent-subtle-hover': 'rgb(var(--color-accent-subtle-hover) / <alpha-value>)',
        'accent-subtle-border': 'rgb(var(--color-accent-subtle-border) / <alpha-value>)',
        'accent-subtle-text': 'rgb(var(--color-accent-subtle-text) / <alpha-value>)',
        focus: 'rgb(var(--color-focus) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        'success-subtle': 'rgb(var(--color-success-subtle) / <alpha-value>)',
        'success-fill': 'rgb(var(--color-success-fill) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        'warning-subtle': 'rgb(var(--color-warning-subtle) / <alpha-value>)',
        'warning-subtle-border': 'rgb(var(--color-warning-subtle-border) / <alpha-value>)',
        'warning-fill': 'rgb(var(--color-warning-fill) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        'danger-subtle': 'rgb(var(--color-danger-subtle) / <alpha-value>)',
        'danger-subtle-border': 'rgb(var(--color-danger-subtle-border) / <alpha-value>)',
        'danger-fill': 'rgb(var(--color-danger-fill) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
        'info-subtle': 'rgb(var(--color-info-subtle) / <alpha-value>)',
        // Sidebar escura (D2 da refatoração visual) e superfície invertida
        // (KPI em destaque, toast, tooltip) — v2, research.md Q5.
        sidebar: 'rgb(var(--color-sidebar) / <alpha-value>)',
        'sidebar-text': 'rgb(var(--color-sidebar-text) / <alpha-value>)',
        'sidebar-text-active': 'rgb(var(--color-sidebar-text-active) / <alpha-value>)',
        'sidebar-label': 'rgb(var(--color-sidebar-label) / <alpha-value>)',
        'sidebar-item-active': 'rgb(var(--color-sidebar-item-active) / <alpha-value>)',
        'sidebar-item-hover': 'rgb(var(--color-sidebar-item-hover) / <alpha-value>)',
        'sidebar-border': 'rgb(var(--color-sidebar-border) / <alpha-value>)',
        'sidebar-indicator': 'rgb(var(--color-sidebar-indicator) / <alpha-value>)',
        'sidebar-badge': 'rgb(var(--color-sidebar-badge) / <alpha-value>)',
        'sidebar-badge-text': 'rgb(var(--color-sidebar-badge-text) / <alpha-value>)',
        'sidebar-avatar': 'rgb(var(--color-sidebar-avatar) / <alpha-value>)',
        'sidebar-avatar-text': 'rgb(var(--color-sidebar-avatar-text) / <alpha-value>)',
        inverse: 'rgb(var(--color-inverse) / <alpha-value>)',
        'inverse-text': 'rgb(var(--color-inverse-text) / <alpha-value>)',
        'inverse-text-muted': 'rgb(var(--color-inverse-text-muted) / <alpha-value>)',
        'inverse-warning': 'rgb(var(--color-inverse-warning) / <alpha-value>)',
        'inverse-success': 'rgb(var(--color-inverse-success) / <alpha-value>)',
        'inverse-link': 'rgb(var(--color-inverse-link) / <alpha-value>)',
      },
      // Raio v2 (research.md Q5 e Q8): `sm` para item de menu, botão de
      // paginação, tooltip e ícone de tipo; `control` para campo e botão;
      // `surface` para cartão, região e painel; `pill` para badge, chip e
      // contador. `sm` substitui o `rounded-sm` default (2px), que não tem
      // nenhum consumidor. `rounded-full`, `rounded-lg`, `rounded-xl` e
      // `rounded-2xl` continuam proibidos no lint (Task 27): a pílula entra
      // por token, não por utilitário cru.
      borderRadius: {
        sm: '6px',
        control: '10px',
        surface: '14px',
        pill: '9999px',
      },
      // Escala tipográfica fechada (design-system.md §5.2) + dois papéis
      // numéricos da v2: `kpi` (indicadores do dashboard) e `display-number`
      // (saldo em destaque na página do produto).
      fontSize: {
        'page-title': ['24px', { lineHeight: '1.25', fontWeight: '600', letterSpacing: '-0.015em' }],
        kpi: ['28px', { lineHeight: '1.15', fontWeight: '600', letterSpacing: '-0.02em' }],
        'display-number': ['40px', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '-0.02em' }],
        'section-title': ['18px', { lineHeight: '1.35', fontWeight: '600' }],
        'component-title': ['16px', { lineHeight: '1.40', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.55', fontWeight: '400' }],
        label: ['14px', { lineHeight: '1.40', fontWeight: '500' }],
        'table-cell': ['14px', { lineHeight: '1.40', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '1.40', fontWeight: '400' }],
        'table-header': ['12px', { lineHeight: '1.40', fontWeight: '600' }],
      },
      // Sombra: `overlay` continua o único nível suspenso (design-system.md
      // §8; valor validado no protótipo da Fase 6). `card` (v2) é quase
      // imperceptível e só acompanha a borda para separar a superfície do
      // canvas — estrutura antes de sombra.
      boxShadow: {
        card: '0 1px 2px rgb(16 24 40 / 0.05)',
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
