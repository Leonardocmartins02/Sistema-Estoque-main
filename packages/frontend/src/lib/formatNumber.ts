/**
 * Helper único de formatação numérica (Task 2, docs/ui-ux/implementation-plan.md).
 *
 * P-3: separador de milhar pt-BR e sinal de menos tipográfico num único
 * lugar — a formatação derivou dentro do próprio protótipo da Fase 6
 * (`1250` × `1.250` no mesmo diálogo) quando deixada a cargo de convenção.
 * P-4: `−` (U+2212, sinal de menos tipográfico), nunca `-` (U+002D,
 * hífen-menos), que é mais estreito e desalinha numa coluna tabular.
 *
 * Escopo fechado: saldo, quantidade e delta. Não é um `formatEverything` —
 * datas e texto corrente não entram aqui.
 */

const MINUS_SIGN = '−';

/** Quantidade/saldo com separador de milhar pt-BR. Nunca altera o valor enviado à API — é formatação de apresentação. */
export function formatQuantity(value: number): string {
  return value.toLocaleString('pt-BR');
}

/** Delta sempre assinado em texto: `+` no positivo, `−` (tipográfico) no negativo, sem sinal no zero. */
export function formatDelta(value: number): string {
  if (value > 0) return `+${formatQuantity(value)}`;
  if (value < 0) return `${MINUS_SIGN}${formatQuantity(Math.abs(value))}`;
  return formatQuantity(0);
}

/**
 * `antes → depois` (design-system.md §14.2 regra 1). Quando não há saldo
 * anterior (ex.: Estoque inicial), mostra `—` — honesto quanto à ausência,
 * em vez de fingir zero.
 */
export function formatBalanceTransition(previous: number | null | undefined, next: number): string {
  const previousLabel = previous == null ? '—' : formatQuantity(previous);
  return `${previousLabel} → ${formatQuantity(next)}`;
}
