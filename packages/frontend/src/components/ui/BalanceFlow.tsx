import { formatQuantity } from '../../lib/formatNumber';

type BalanceFlowProps = {
  previous: number | null | undefined;
  next: number | null | undefined;
  className?: string;
};

/**
 * `antes → depois` (design-system.md §14.2), com o saldo final em destaque.
 * A seta é decorativa para leitor de tela; o texto `sr-only` diz a mesma
 * transição em palavras ("de 20 para 15") — a dívida A5 paga no
 * `MovementHistoryModal`, agora num lugar só. Mesma regra de
 * `formatBalanceTransition`: sem saldo anterior (estoque inicial) é `—`,
 * nunca zero.
 */
export function BalanceFlow({ previous, next, className = '' }: BalanceFlowProps) {
  if (next == null) {
    // Linha legada sem os campos de auditoria (o `seed.ts` grava direto).
    return (
      <span className={`text-text-secondary ${className}`}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">saldos não registrados</span>
      </span>
    );
  }

  const nextLabel = formatQuantity(next);
  return (
    <span className={`whitespace-nowrap tabular-nums text-text-secondary ${className}`}>
      <span aria-hidden="true">
        {previous == null ? '—' : formatQuantity(previous)} →{' '}
        <span className="font-semibold text-text-primary">{nextLabel}</span>
      </span>
      <span className="sr-only">
        {previous == null
          ? `sem saldo anterior, saldo final ${nextLabel}`
          : `de ${formatQuantity(previous)} para ${nextLabel}`}
      </span>
    </span>
  );
}

export default BalanceFlow;
