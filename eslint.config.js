const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const importPlugin = require('eslint-plugin-import');
const unusedImports = require('eslint-plugin-unused-imports');
const prettier = require('eslint-config-prettier');

// ---------------------------------------------------------------------------
// Task 27 — enforcement do vocabulário do design system
// (docs/ui-ux/implementation-plan.md §9.3.4 e §9.3.5)
//
// D-27.1 — lista FECHADA de 19 utilitários. Uma entrada por utilitário, cada
// uma cobrindo `Literal` (string comum) e `TemplateElement` (parte estática de
// template literal) numa única lista de seletores esquery. É o que alcança as
// três formas reais de uso, e não só o atributo JSX:
//
//   className="ring-blue-200"                      → Literal
//   const styles = { info: 'ring-blue-200' }       → Literal (o bypass do Badge)
//   `border ${c ? 'ring-blue-200' : ''}`           → Literal
//   className={`shadow-md ${d}`}                   → TemplateElement
//
// Comentário não é nó de `Literal`/`TemplateElement` — a regra não o alcança
// por desenho (é onde o projeto documenta *por que* um token foi rejeitado),
// não por lacuna.
//
// NÃO adicionar termos além dos 19 (D-27.1 é fechada por REV-21). Ficam
// deliberadamente de fora, registrados como follow-up sem owner:
// `ring-emerald-*`, `ring-amber-*`, `ring-rose-*` (§9.3.4) e `text-indigo-700`
// (§9.3.5). Nenhum plugin novo, nenhuma dependência nova: `no-restricted-syntax`
// é regra nativa.
// ---------------------------------------------------------------------------

/** Fronteira de utilitário exato: nem `\w` nem `-` colados nos dois lados. */
const exactBoundary = (token) => `(?<![\\w-])${token}(?![\\w-])`;

function exactUtility(token) {
  const boundary = exactBoundary(token);
  return {
    selector: `Literal[value=/${boundary}/], TemplateElement[value.raw=/${boundary}/]`,
    message: `Utilitário "${token}" está fora do design system (Task 27). Use o token semântico equivalente do design-system.md.`,
  };
}

function prefixUtility(prefix) {
  // Prefixo: fronteira só à esquerda — a variante numérica continua depois.
  const boundary = `(?<![\\w-])${prefix}`;
  return {
    selector: `Literal[value=/${boundary}/], TemplateElement[value.raw=/${boundary}/]`,
    message: `Utilitário "${prefix}*" está fora do design system (Task 27). Use o token semântico equivalente do design-system.md.`,
  };
}

// ---------------------------------------------------------------------------
// D-27.3″ — exceção ESTRUTURAL do dot decorativo, expressa no próprio seletor.
//
// `rounded-full` permanece proibido globalmente; só ESTA entrada (1 das 19)
// recebe a guarda. As outras 18 não são afetadas.
//
// Por que no seletor e não por `eslint-disable-next-line` (D-27.3, SUPERSEDED):
// os 19 seletores compartilham um único `ruleId`, então uma directive local
// silenciaria os 19 naquela linha — e `reportUnusedDisableDirectives` não
// detecta esse alargamento, porque a directive continua "utilizada". A exceção
// seria auditável para remoção, jamais para crescimento.
//
// A exceção só reconhece um dot que satisfaça, CUMULATIVAMENTE:
//  - elemento JSX `<span>`;
//  - `aria-hidden="true"` LITERAL (não `{true}`, não `"false"`, não ausente);
//  - `className` DIRETAMENTE no span — relação filho (`>`), nunca descendente
//    genérico, para que `className={cn("h-2 w-2 rounded-full")}` não passe;
//  - parte estática composta EXATAMENTE por `h-2`, `w-2` e `rounded-full`,
//    em qualquer ordem, e por nada mais.
//
// Fronteira dos três tokens: as seis permutações são enumeradas e ancoradas em
// `^`/`$` com `\s+` entre elas. Isso delimita por whitespace/início/fim por
// construção — `h-2.5` NÃO equivale a `h-2` e `w-2.5` NÃO equivale a `w-2`,
// sem depender de lookaround (onde o `.` poderia encerrar o match).
//
// Semântica FAIL-CLOSED, intencional (§9.3.5): é uma allowlist estrita, não
// autorização parcial do elemento. Qualquer quarto utilitário estático revoga a
// exceção e `rounded-full` volta a ser acusado — junto com o utilitário
// proibido adicional, se ele estiver entre os 19. É assim que o caso do padding
// se fecha sem manter uma denylist geométrica.
//
// Limitação registrada honestamente: a regra prova estrutura JSX, `aria-hidden`
// literal e o conjunto estático permitido. Ela não resolve valores de runtime
// nem calcula layout CSS — não é um layout engine. A allowlist impede que exista
// qualquer outro utilitário estático no mesmo `className`, então a limitação é
// estreita e não reabre nenhuma decisão.
// ---------------------------------------------------------------------------
const DOT_TOKENS = ['h-2', 'w-2', 'rounded-full'];

/** As 6 permutações dos três tokens, separadas por whitespace obrigatório. */
const DOT_PERMUTATIONS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
]
  .map((order) => order.map((i) => DOT_TOKENS[i]).join('\\s+'))
  .join('|');

/** Allowlist ancorada: o conteúdo estático inteiro é exatamente os 3 tokens. */
const DOT_ALLOWLIST = `^\\s*(?:${DOT_PERMUTATIONS})\\s*$`;

/** `<span aria-hidden="true">` — a checagem do irmão é order-independent. */
const DOT_SPAN =
  'JSXOpeningElement[name.name="span"]:has(JSXAttribute[name.name="aria-hidden"][value.value="true"])';
const DOT_CLASSNAME = `${DOT_SPAN} > JSXAttribute[name.name="className"]`;

/** `className="h-2 w-2 rounded-full"` — string direta no atributo. */
const DOT_EXCEPTION_LITERAL = `${DOT_CLASSNAME} > Literal[value=/${DOT_ALLOWLIST}/]`;

/** ``className={`h-2 w-2 rounded-full ${dot}`}`` — a forma usada no `src`. */
const DOT_EXCEPTION_TEMPLATE = `${DOT_CLASSNAME} > JSXExpressionContainer > TemplateLiteral > TemplateElement[value.raw=/${DOT_ALLOWLIST}/]`;

function roundedFullWithDotException() {
  const boundary = exactBoundary('rounded-full');
  return {
    selector:
      `Literal[value=/${boundary}/]:not(${DOT_EXCEPTION_LITERAL}), ` +
      `TemplateElement[value.raw=/${boundary}/]:not(${DOT_EXCEPTION_TEMPLATE})`,
    message:
      'Utilitário "rounded-full" está fora do design system (Task 27). Exceção única (D-27.3″): ' +
      '<span aria-hidden="true"> cujo className estático seja exatamente "h-2 w-2 rounded-full".',
  };
}

const designSystemRestrictions = [
  // Exatos (15) — fronteira nos dois lados.
  roundedFullWithDotException(),
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
  // Prefixos (3) — só fronteira à esquerda.
  prefixUtility('ring-indigo-'),
  prefixUtility('ring-blue-'),
  prefixUtility('bg-gradient-'),
  // Valor arbitrário (1) — os colchetes já delimitam.
  {
    selector:
      'Literal[value=/text-\\[[0-9]+px\\]/], TemplateElement[value.raw=/text-\\[[0-9]+px\\]/]',
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
  // Uma `eslint-disable` que deixou de ser necessária passa a falhar o lint —
  // é o que impede exceção local de virar permanente sem ninguém notar.
  // Nenhuma directive é adicionada para `rounded-full`: D-27.3 (baseada em
  // directive) está SUPERSEDED por D-27.3″, que vive no seletor.
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
  // O enforcement alcança só `src/` de cada pacote — é o que `pnpm -r run lint`
  // lê como código de produção e é o alvo declarado em D-27.1. `test/` não é
  // alvo da proibição: não é código de produção e o contrato não o exige.
  // Severidade `error` por D-27.2/D-27.7 — `warn` + promoção fica REJEITADA,
  // porque não impede regressão no CI.
  {
    files: ['packages/{frontend,backend}/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...designSystemRestrictions],
    },
  },
  prettier,
];
