import { formatDelta } from '../../lib/formatNumber';

type DeltaProps = {
  /** Efeito no saldo, com sinal. `null` = ajuste legado sem antes/depois (PRD RF 56). */
  value: number | null;
  /** Unidade depois do número; `false` omite (indicador do dashboard). */
  unit?: string | false;
  /** Seta de tendência ↗/↘ como reforço (P4) — decorativa, o sinal já diz a direção. */
  trend?: boolean;
  className?: string;
};

/**
 * Diferença assinada (P4 da refatoração visual): o sinal é sempre texto
 * (`+`/`−` tipográfico, via `formatDelta`); cor e seta só reforçam
 * (WCAG 1.4.1). Algarismos tabulares: o delta mora em coluna de tabela.
 */
export function Delta({ value, unit = 'un.', trend = false, className = '' }: DeltaProps) {
  if (value == null) {
    // Nunca um zero inventado (REV-11): o dado não existe, e a tela diz isso.
    return (
      <span className={`text-text-secondary ${className}`}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">variação não registrada</span>
      </span>
    );
  }

  const tone = value > 0 ? 'text-success' : value < 0 ? 'text-danger' : 'text-text-secondary';
  const arrow = value > 0 ? '↗' : value < 0 ? '↘' : null;

  return (
    <span className={`whitespace-nowrap font-semibold tabular-nums ${tone} ${className}`}>
      {formatDelta(value)}
      {unit ? ` ${unit}` : ''}
      {trend && arrow && <span aria-hidden="true"> {arrow}</span>}
    </span>
  );
}

export default Delta;
