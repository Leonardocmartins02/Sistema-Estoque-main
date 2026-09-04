import { createRequire } from 'node:module';

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * REV-22 (Task 27 — `docs/ui-ux/implementation-plan.md` §9.3.4 e §9.3.5) —
 * teste versionado que prova o enforcement do vocabulário legado do design
 * system.
 *
 * Por que este arquivo existe: validar a regra com uma violação temporária
 * provaria apenas que ela funcionava *naquele minuto*. Depois, uma regressão
 * no seletor deixaria o lint verde sem ninguém notar. Este teste fecha essa
 * lacuna.
 *
 * Carrega a CONFIG ESLINT REAL (`eslint.config.js`, raiz do monorepo), nunca
 * uma cópia do seletor (D-27.5): uma cópia continuaria verde depois de uma
 * regressão no seletor real. `createRequire(import.meta.url)` é necessário
 * porque `packages/frontend` é ESM (`"type": "module"`) e `eslint.config.js`
 * é CommonJS — não há resolução estática de módulo aqui, então `allowJs:
 * false` no `tsconfig` do frontend não é obstáculo.
 *
 * Nenhuma dependência nova: `eslint` (9.35.0) já é devDependency do
 * monorepo, e o teste roda na suíte Vitest já existente.
 *
 * Contrato coberto:
 *  - A–F  → existência, severidade `error` (D-27.2), lista nominal fechada
 *           dos 19 (D-27.1), Literals, TemplateElements, class maps fora de
 *           JSX, e ausência de falso positivo no vocabulário aprovado;
 *  - G–O  → semântica da exceção estrutural do dot decorativo (D-27.3″),
 *           conforme os nove casos discriminativos exigidos por D-27.6.
 */
const require = createRequire(import.meta.url);
const config = require('../../../eslint.config.js') as Array<{
  rules?: Record<string, unknown>;
}>;

const RESTRICTED_RULE = 'no-restricted-syntax';

/**
 * Um caminho real de `src/` — é o que `pnpm -r run lint` lintaria de fato, e
 * é o alvo declarado da proibição (`packages/{frontend,backend}/src`).
 */
const PRODUCTION_FILENAME = 'packages/frontend/src/components/ui/Fake.tsx';

/** A lista fechada dos 19 utilitários banidos (D-27.1). Nenhum termo entra,
 * nenhum sai — D-27.3″ mudou apenas a *forma* da entrada de `rounded-full`. */
const CLOSED_LIST: ReadonlyArray<readonly [label: string, sample: string]> = [
  ['rounded-full', 'rounded-full'],
  ['rounded-2xl', 'rounded-2xl'],
  ['rounded-xl', 'rounded-xl'],
  ['rounded-lg', 'rounded-lg'],
  ['shadow-2xl', 'shadow-2xl'],
  ['shadow-xl', 'shadow-xl'],
  ['shadow-md', 'shadow-md'],
  ['shadow-sm', 'shadow-sm'],
  ['text-3xl', 'text-3xl'],
  ['text-4xl', 'text-4xl'],
  ['text-xl', 'text-xl'],
  ['text-[NNpx]', 'text-[10px]'],
  ['ring-indigo-*', 'ring-indigo-600'],
  ['ring-brand', 'ring-brand'],
  ['ring-blue-*', 'ring-blue-200'],
  ['text-gray-400', 'text-gray-400'],
  ['border-gray-300', 'border-gray-300'],
  ['bg-gradient-*', 'bg-gradient-to-r'],
  ['animate-fade-in', 'animate-fade-in'],
];

function ruleSeverity(ruleName: string): unknown {
  for (const block of config) {
    if (block?.rules && Object.prototype.hasOwnProperty.call(block.rules, ruleName)) {
      const entry = block.rules[ruleName];
      return Array.isArray(entry) ? entry[0] : entry;
    }
  }
  return undefined;
}

function lint(code: string, filename = PRODUCTION_FILENAME) {
  const linter = new Linter();
  return linter.verify(code, config as never, { filename });
}

/**
 * Só as mensagens da regra sob teste — ruído de outras regras (ex.:
 * `no-unused-vars`) não deve interferir nas asserções.
 */
function restrictedMessages(code: string, filename?: string) {
  return lint(code, filename).filter((m) => m.ruleId === RESTRICTED_RULE);
}

/**
 * Asserção deliberadamente NÃO cardinal (D-27.6, "forma da asserção"): basta
 * que o token proibido esteja ENTRE as mensagens. Nos casos fail-closed o
 * `rounded-full` também é acusado, e isso é o comportamento correto — exigir
 * "exatamente uma mensagem" transformaria o contrato certo em falha.
 */
function reportsToken(code: string, token: string): boolean {
  return restrictedMessages(code).some((m) => m.message.includes(token));
}

/** Um `<span>` com `className` estático direto, no formato do dot decorativo. */
function dotSpan(ariaHidden: string, className: string): string {
  return `export function Dot() {\n  return (\n    <span\n      aria-hidden="${ariaHidden}"\n      className="${className}"\n    />\n  );\n}\n`;
}

describe('REV-22 — enforcement do design system (config REAL, no-restricted-syntax)', () => {
  // ---------------------------------------------------------------------
  // A–F · contrato base (preservado do escopo original do REV-22)
  // ---------------------------------------------------------------------

  it('A: a regra está configurada com severidade "error" (D-27.2 / D-27.7)', () => {
    expect(ruleSeverity(RESTRICTED_RULE)).toBe('error');
  });

  it('B: literal proibido em className JSX é bloqueado (className="ring-blue-200")', () => {
    const code = `export function A() { return (<div className="ring-blue-200" />); }\n`;
    expect(restrictedMessages(code).length).toBeGreaterThan(0);
  });

  it('B2: a lista nominal fechada dos 19 é aplicada, termo a termo (D-27.1)', () => {
    const naoAcusados = CLOSED_LIST.filter(
      ([, sample]) =>
        restrictedMessages(`export function A() { return (<div className="${sample}" />); }\n`)
          .length === 0,
    ).map(([label]) => label);

    expect(naoAcusados).toEqual([]);
  });

  it('C: mapa de classes em nível de módulo é bloqueado (o bypass real do Badge.tsx)', () => {
    const code = `export const styles = {\n  info: 'ring-blue-200',\n};\n`;
    expect(restrictedMessages(code).length).toBeGreaterThan(0);
  });

  it('D: TemplateElement (template/string condicional) é bloqueado', () => {
    const code =
      "const condition = true;\nexport const x = `border ${condition ? 'ring-blue-200' : ''}`;\n";
    expect(restrictedMessages(code).length).toBeGreaterThan(0);
  });

  it('D2: TemplateElement na parte estática de um className interpolado é bloqueado', () => {
    const code =
      'export function A(props: { d: string }) {\n' +
      '  return (<div className={`shadow-md ${props.d}`} />);\n' +
      '}\n';
    expect(reportsToken(code, 'shadow-md')).toBe(true);
  });

  it('E: vocabulário semântico aprovado não gera falso positivo', () => {
    const code =
      'export function A() {\n' +
      '  return (<div className="rounded-control rounded-surface shadow-overlay text-base ring-accent focus-visible:ring-accent ring-offset-2 border-strong text-secondary" />);\n' +
      '}\n';
    expect(restrictedMessages(code)).toHaveLength(0);
  });

  it('F: vocabulário antigo dentro de comentário não é bloqueado (não é nó da AST)', () => {
    const code = `// ring-blue-200 e text-gray-400 foram rejeitados por contraste (M-4)\nexport const y = 1;\n`;
    expect(restrictedMessages(code)).toHaveLength(0);
  });

  // ---------------------------------------------------------------------
  // G–O · semântica da exceção estrutural do dot decorativo (D-27.3″/D-27.6)
  //
  // A exceção só reconhece, cumulativamente: elemento <span>;
  // aria-hidden="true" literal; className DIRETO no span (relação filho, não
  // descendente); parte estática composta EXATAMENTE por h-2, w-2 e
  // rounded-full, em qualquer ordem e nada mais; tokens delimitados por
  // whitespace/início/fim.
  // ---------------------------------------------------------------------

  it('G: dot decorativo legítimo e exato é PERMITIDO (D-27.3″)', () => {
    expect(restrictedMessages(dotSpan('true', 'h-2 w-2 rounded-full'))).toHaveLength(0);
  });

  it('G2: a exceção não depende da ordem dos três tokens', () => {
    expect(restrictedMessages(dotSpan('true', 'rounded-full w-2 h-2'))).toHaveLength(0);
  });

  it('H: dot + shadow-md é reprovado — shadow-md está ENTRE as mensagens (fail-closed)', () => {
    const code = dotSpan('true', 'h-2 w-2 rounded-full shadow-md');
    expect(restrictedMessages(code).length).toBeGreaterThan(0);
    expect(reportsToken(code, 'shadow-md')).toBe(true);
  });

  it('I: dot + text-3xl é reprovado — text-3xl está ENTRE as mensagens (fail-closed)', () => {
    const code = dotSpan('true', 'h-2 w-2 rounded-full text-3xl');
    expect(restrictedMessages(code).length).toBeGreaterThan(0);
    expect(reportsToken(code, 'text-3xl')).toBe(true);
  });

  it('J: aria-hidden="false" NÃO recebe a exceção — rounded-full continua proibido', () => {
    expect(reportsToken(dotSpan('false', 'h-2 w-2 rounded-full'), 'rounded-full')).toBe(true);
  });

  it('J2: aria-hidden={true} (expressão, não literal string) NÃO recebe a exceção', () => {
    const code =
      'export function Dot() {\n' +
      '  return (<span aria-hidden={true} className="h-2 w-2 rounded-full" />);\n' +
      '}\n';
    expect(reportsToken(code, 'rounded-full')).toBe(true);
  });

  it('J3: aria-hidden ausente NÃO recebe a exceção', () => {
    const code =
      'export function Dot() {\n' +
      '  return (<span className="h-2 w-2 rounded-full" />);\n' +
      '}\n';
    expect(reportsToken(code, 'rounded-full')).toBe(true);
  });

  it('K: className através de helper cn()/clsx NÃO recebe a exceção (caminho AST direto)', () => {
    const code =
      'declare function cn(...parts: string[]): string;\n' +
      'export function Dot() {\n' +
      '  return (<span aria-hidden="true" className={cn("h-2 w-2 rounded-full")} />);\n' +
      '}\n';
    expect(reportsToken(code, 'rounded-full')).toBe(true);
  });

  it('L: h-2.5 / w-2.5 NÃO equivalem a h-2 / w-2 — a fronteira é whitespace/início/fim', () => {
    const variantes = ['h-2.5 w-2.5 rounded-full', 'h-2 w-2.5 rounded-full', 'h-2.5 w-2 rounded-full'];

    const naoAcusadas = variantes.filter(
      (className) => !reportsToken(dotSpan('true', className), 'rounded-full'),
    );

    expect(naoAcusadas).toEqual([]);
  });

  it('M: rounded-full fora do padrão do dot continua proibido', () => {
    const code =
      'export function Chip() {\n' +
      '  return (<button type="button" className="rounded-full px-4" />);\n' +
      '}\n';
    expect(reportsToken(code, 'rounded-full')).toBe(true);
  });

  it('N: elemento diferente de <span> NÃO recebe a exceção', () => {
    const code =
      'export function Dot() {\n' +
      '  return (<div aria-hidden="true" className="h-2 w-2 rounded-full" />);\n' +
      '}\n';
    expect(reportsToken(code, 'rounded-full')).toBe(true);
  });

  it('O: qualquer utilitário estático adicional REVOGA a exceção (allowlist estrita)', () => {
    const extras = ['h-2 w-2 rounded-full px-8 py-4', 'h-2 w-2 rounded-full p-6', 'h-2 w-2 rounded-full scale-150', 'h-2 w-2 rounded-full min-w-40'];

    const naoAcusados = extras.filter(
      (className) => !reportsToken(dotSpan('true', className), 'rounded-full'),
    );

    expect(naoAcusados).toEqual([]);
  });
});
