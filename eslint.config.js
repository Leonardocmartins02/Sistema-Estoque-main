const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const importPlugin = require('eslint-plugin-import');
const unusedImports = require('eslint-plugin-unused-imports');
const prettier = require('eslint-config-prettier');

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
  prettier,
];
