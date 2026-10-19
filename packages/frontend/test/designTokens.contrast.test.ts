import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Task 1 da refatoração visual (`docs/features/refatoracao-visual/implementation-plan.md`)
 * — contraste dos tokens v2 medido a partir do `index.css` real.
 *
 * Por que este arquivo existe: o contraste dos pares era calculado à mão e
 * registrado no `prototype.md`. Um ajuste de valor depois (um cinza um pouco
 * mais claro, um fundo de seleção mais azul) passaria sem ninguém recalcular —
 * foi assim que `text-muted` sobre a linha selecionada caiu para 4,44:1 no
 * protótipo. Aqui cada par usado nas telas tem o mínimo da WCAG 2.2 AA
 * (1.4.3 texto 4,5:1; 1.4.11 contorno e indicador 3:1) e falha se o token mudar.
 *
 * Lê os arquivos como texto (sem importar o `tailwind.config.js`, que é ESM fora
 * do `tsconfig`): o que vale é o que o navegador recebe.
 */
// `fileURLToPath` + caminho: no ambiente jsdom o `URL` global é o do jsdom, e o
// `readFileSync` do Node recusa a instância dele.
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../src/index.css'), 'utf8');
const tailwindConfig = readFileSync(resolve(here, '../tailwind.config.js'), 'utf8');

type Rgb = readonly [number, number, number];

/** Tokens `--color-*` do `:root`, em canais RGB sem função (design-system.md §19). */
function rootTokens(): Map<string, Rgb> {
  const root = css.match(/:root\s*{([\s\S]*?)}/)?.[1] ?? '';
  const tokens = new Map<string, Rgb>();
  for (const [, name, r, g, b] of root.matchAll(/--color-([a-z0-9-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
    tokens.set(name, [Number(r), Number(g), Number(b)]);
  }
  return tokens;
}

/** Luminância relativa da WCAG 2.x. */
function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const TEXT = 4.5;
const NON_TEXT = 3;

/** [frente, fundo, mínimo, onde o par aparece] */
const PAIRS: ReadonlyArray<readonly [string, string, number, string]> = [
  // Neutros
  ['text-primary', 'background', TEXT, 'título e texto sobre o canvas'],
  ['text-primary', 'surface', TEXT, 'texto em cartão e tabela'],
  ['text-secondary', 'background', TEXT, 'único tom secundário permitido sobre o canvas'],
  ['text-secondary', 'surface-subtle', TEXT, 'texto secundário no cabeçalho da tabela e no detalhe'],
  ['text-muted', 'surface', TEXT, 'SKU, legenda, caption'],
  ['text-muted', 'surface-subtle', TEXT, 'rótulo do cabeçalho da tabela'],
  ['text-muted', 'surface-selected', TEXT, 'SKU na linha selecionada'],
  ['border-strong', 'surface', NON_TEXT, 'contorno de controle (1.4.11)'],
  ['border-strong', 'background', NON_TEXT, 'contorno de controle sobre o canvas'],
  ['focus', 'surface', NON_TEXT, 'anel de foco'],
  ['focus', 'background', NON_TEXT, 'anel de foco sobre o canvas'],
  // Acento
  ['surface', 'accent', TEXT, 'texto do botão primário'],
  ['accent-strong', 'surface', TEXT, 'link e botão terciário'],
  ['accent-subtle-text', 'accent-subtle', TEXT, 'botão tonal, aba ativa'],
  ['accent-subtle-text', 'accent-subtle-hover', TEXT, 'botão tonal em hover'],
  // Estados
  ['success', 'success-subtle', TEXT, 'badge "Em estoque", entrada'],
  ['warning', 'warning-subtle', TEXT, 'badge "Estoque baixo", aviso'],
  ['danger', 'danger-subtle', TEXT, 'badge "Sem estoque", saída, erro'],
  ['info', 'info-subtle', TEXT, 'ajuste'],
  // Sidebar (D2 — escura)
  ['sidebar-text', 'sidebar', TEXT, 'item de navegação'],
  ['sidebar-label', 'sidebar', TEXT, 'rótulo de grupo'],
  ['sidebar-text-active', 'sidebar-item-active', TEXT, 'item ativo'],
  ['sidebar-text-active', 'sidebar-item-hover', TEXT, 'item em hover'],
  ['sidebar-indicator', 'sidebar', NON_TEXT, 'barra do item ativo'],
  ['sidebar-badge-text', 'sidebar-badge', TEXT, 'contador de estoque baixo / sem estoque'],
  ['sidebar-avatar-text', 'sidebar-avatar', TEXT, 'iniciais do usuário'],
  // Superfície invertida (KPI em destaque, toast, tooltip)
  ['inverse-text', 'inverse', TEXT, 'valor do KPI em destaque, texto do toast'],
  ['inverse-text-muted', 'inverse', TEXT, 'rótulo do KPI em destaque, detalhe do tooltip'],
  ['inverse-warning', 'inverse', TEXT, 'ícone/valor de atenção no KPI em destaque'],
  ['inverse-success', 'inverse', TEXT, 'ícone de sucesso no toast'],
  ['inverse-link', 'inverse', TEXT, 'link no toast'],
];

describe('tokens de cor v2 — contraste (WCAG 2.2 AA)', () => {
  const tokens = rootTokens();

  it.each(PAIRS)('%s sobre %s ≥ %s:1 (%s)', (fg, bg, min) => {
    const front = tokens.get(fg);
    const back = tokens.get(bg);
    expect(front, `--color-${fg} não existe no :root`).toBeDefined();
    expect(back, `--color-${bg} não existe no :root`).toBeDefined();
    expect(contrast(front!, back!)).toBeGreaterThanOrEqual(min);
  });
});

describe('tokens de cor v2 — consistência', () => {
  it('toda cor do tailwind.config.js aponta para um token definido no :root', () => {
    const tokens = rootTokens();
    const referenced = [...tailwindConfig.matchAll(/var\(--color-([a-z0-9-]+)\)/g)].map(([, name]) => name);
    expect(referenced.length).toBeGreaterThan(0);
    expect(referenced.filter((name) => !tokens.has(name))).toEqual([]);
  });

  it('todo token do :root tem uma cor no tailwind.config.js (nenhum valor órfão)', () => {
    const referenced = new Set([...tailwindConfig.matchAll(/var\(--color-([a-z0-9-]+)\)/g)].map(([, name]) => name));
    expect([...rootTokens().keys()].filter((name) => !referenced.has(name))).toEqual([]);
  });
});
