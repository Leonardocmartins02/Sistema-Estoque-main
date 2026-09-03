import { createRequire } from 'node:module';

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * REV-22 (Task 27, `implementation-plan.md` §9.3.4/D-27.5) — teste versionado
 * que prova o enforcement do vocabulário legado do design system.
 *
 * Carrega a CONFIG ESLINT REAL (`eslint.config.js`, raiz do monorepo), nunca
 * uma cópia do seletor: uma cópia continuaria verde depois de uma regressão
 * no seletor real, e é exatamente essa lacuna que o REV-22 existe para
 * fechar. `createRequire(import.meta.url)` é necessário porque
 * `packages/frontend` é ESM (`"type": "module"`) e `eslint.config.js` é
 * CommonJS — não há resolução estática de módulo aqui, então `allowJs:
 * false` no `tsconfig` do frontend não é obstáculo (D-27.5).
 *
 * Nenhuma dependência nova: `eslint` já é devDependency do monorepo; o teste
 * roda na suíte Vitest já existente.
 */
const require = createRequire(import.meta.url);
const config = require('../../../eslint.config.js') as Array<{
  rules?: Record<string, unknown>;
}>;

const RESTRICTED_RULE = 'no-restricted-syntax';

/** Um arquivo real de `src/` — é o que `pnpm -r run lint` lintaria de fato. */
const PRODUCTION_FILENAME = 'packages/frontend/src/components/ui/Fake.tsx';

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

/** Só as mensagens da regra sob teste — ruído de outras regras (ex.:
 * `no-unused-vars`) não deve interferir nas asserções. */
function restrictedMessages(code: string, filename?: string) {
  return lint(code, filename).filter((m) => m.ruleId === RESTRICTED_RULE);
}

describe('REV-22 — regra de lint do design system (config REAL, no-restricted-syntax)', () => {
  it('A: a regra está configurada com severidade "error"', () => {
    expect(ruleSeverity(RESTRICTED_RULE)).toBe('error');
  });

  it('B: literal proibido em className JSX é bloqueado (className="ring-blue-200")', () => {
    const code = `export function A() { return (<div className="ring-blue-200" />); }\n`;
    expect(restrictedMessages(code).length).toBeGreaterThan(0);
  });

  it('C: mapa de classes em nível de módulo é bloqueado (bypass real do Badge.tsx)', () => {
    const code = `export const styles = {\n  info: 'ring-blue-200',\n};\n`;
    expect(restrictedMessages(code).length).toBeGreaterThan(0);
  });

  it('D: template/string condicional é bloqueado', () => {
    const code = "const condition = true;\nexport const x = `border ${condition ? 'ring-blue-200' : ''}`;\n";
    expect(restrictedMessages(code).length).toBeGreaterThan(0);
  });

  it('E: vocabulário semântico aprovado não é bloqueado (ring-accent, rounded-control)', () => {
    const code = `export function A() { return (<div className="ring-accent rounded-control" />); }\n`;
    expect(restrictedMessages(code)).toHaveLength(0);
  });

  it('F: comentário contendo vocabulário antigo não é bloqueado', () => {
    const code = `// ring-blue-200 foi rejeitado\nexport const y = 1;\n`;
    expect(restrictedMessages(code)).toHaveLength(0);
  });
});
