const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const importPlugin = require('eslint-plugin-import');
const unusedImports = require('eslint-plugin-unused-imports');
const prettier = require('eslint-config-prettier');

// Task 27 (implementation-plan.md §9.3.4, D-27.1) — lista FECHADA de 19
// utilitários fora do design system. Uma entrada por utilitário, cada uma
// cobrindo Literal (string comum) e TemplateElement (template literal) numa
// única lista de seletores esquery — é o que alcança tanto
// `className="ring-blue-200"` quanto `const styles = { info: 'ring-blue-200' }`
// e `` `border ${c ? 'ring-blue-200' : ''}` `` (o bypass real do Badge.tsx).
// Comentários não são nós de Literal/TemplateElement — a regra não os alcança
// por desenho, não por lacuna.
//
// NÃO adicionar termos além dos 19 fechados (D-27.1) — inclusive
// ring-emerald-*/ring-amber-*/ring-rose-* ficam de fora, registrados como
// follow-up sem owner desta task.
function exactUtility(token) {
  const boundary = `(?<![\\w-])${token}(?![\\w-])`;
  return {
    selector: `Literal[value=/${boundary}/], TemplateElement[value.raw=/${boundary}/]`,
    message: `Utilitário "${token}" está fora do design system (Task 27). Use o token semântico equivalente do design-system.md.`,
  };
}

function prefixUtility(prefix) {
  const boundary = `(?<![\\w-])${prefix}`;
  return {
    selector: `Literal[value=/${boundary}/], TemplateElement[value.raw=/${boundary}/]`,
    message: `Utilitário "${prefix}*" está fora do design system (Task 27). Use o token semântico equivalente do design-system.md.`,
  };
}

const designSystemRestrictions = [
  // Exatos (15) — fronteira nos dois lados.
  exactUtility('rounded-full'),
  exactUtility('rounded-2xl'),
  exactUtility('rounded-xl'),
  exactUtility('rounded-lg'),
  exactUtility('shadow-2xl'),
  exactUtility('shadow-xl'),
  exactUtility('shadow-md'),
  exactUtility('shadow-sm'),
  exactUtility('text-3xl'),
  exactUtility('text-4xl'),
  exactUtility('text-xl'),
  exactUtility('ring-brand'),
  exactUtility('text-gray-400'),
  exactUtility('border-gray-300'),
  exactUtility('animate-fade-in'),
  // Prefixos (3) — só fronteira à esquerda (a variante continua depois).
  prefixUtility('ring-indigo-'),
  prefixUtility('ring-blue-'),
  prefixUtility('bg-gradient-'),
  // Valor arbitrário (1) — os colchetes já delimitam, sem fronteira \w/-.
  {
    selector: 'Literal[value=/text-\\[[0-9]+px\\]/], TemplateElement[value.raw=/text-\\[[0-9]+px\\]/]',
    message:
      'Utilitário "text-[Npx]" (valor arbitrário) está fora do design system (Task 27). Use a escala de tipografia do design-system.md.',
  },
];

module.exports = [
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/.claude/**',
      '**/coverage/**',
      'pnpm-lock.yaml',
    ],
  },
  // D-27.3: exceções `eslint-disable-next-line` obsoletas passam a falhar o
  // lint — é o que torna uma exceção local auditável em vez de permanente.
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'unused-imports': unusedImports },
    rules: {
      'unused-imports/no-unused-imports': 'error',
      // Assinaturas fixas por convenção (ex: error handler do Express, que
      // precisa de 4 parâmetros para o Express reconhecê-lo como tal) usam
      // prefixo `_` para o parâmetro não utilizado — nunca é "esquecido".
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Rebaixado para warning (não error) só nesta migração: o código
      // legado do frontend (ProductDashboard.tsx e afiliados, ver backlog em
      // CLAUDE.md) tem ~25 usos de `any` pré-existentes. Bloquear o CI nisso
      // agora pararia a esteira por dívida técnica já conhecida, não por
      // regressão nova. Código novo deve evitar `any` mesmo assim — o
      // warning continua visível no `pnpm lint`.
      '@typescript-eslint/no-explicit-any': 'warn',
      'import/order': [
        'warn',
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      // Resolução de módulo TS (paths, extensões) fica a cargo do
      // typechecker (`pnpm typecheck`) — evita falso-positivo do resolver
      // padrão do eslint-plugin-import em um monorepo pnpm.
      'import/no-unresolved': 'off',
    },
  },
  // Task 27 — o enforcement alcança só `src/` de cada pacote: é o que
  // `pnpm -r run lint` lê como código de produção. `test/` não é alvo da
  // proibição (D-27.1) — não é código de produção e o contrato não o exige.
  {
    files: ['packages/{frontend,backend}/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...designSystemRestrictions],
    },
  },
  prettier,
];
