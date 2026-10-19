/**
 * Política de retentativa (research.md, Questão 3) — função pura, sem banco
 * nem relógio próprio, para ser testada sem esperar timers reais.
 *
 * Base: Standard Webhooks (backoff exponencial com jitter, 2xx = sucesso,
 * 3xx = falha, 410 desativa) + cronograma publicado da Svix. O cronograma é
 * uma lista de esperas em segundos, uma por tentativa: `schedule[n]` é quanto
 * esperar ANTES da tentativa n+1 (o `schedule[0]` = 0 é a 1ª, imediata), e o
 * tamanho da lista é o número máximo de tentativas.
 */

export type AttemptOutcome =
  | { kind: 'success'; status: number }
  | { kind: 'http_error'; status: number; retryAfterSeconds?: number | null }
  | { kind: 'redirect'; status: number }
  | { kind: 'timeout' }
  | { kind: 'network' }
  | { kind: 'blocked' };

export type RetryDecision =
  | { action: 'delivered' }
  | { action: 'retry'; nextAttemptAt: Date }
  | { action: 'fail'; disableEndpointReason?: string };

const RETRY_AFTER_CAP_SECONDS = 24 * 3600;
const STATUSES_WITH_RETRY_AFTER = new Set([429, 503]);

/** ±20%: evita que entregas que falharam juntas retentem todas no mesmo segundo. */
function jitter(random: () => number): number {
  return 0.8 + 0.4 * random();
}

export function decideNext(input: {
  outcome: AttemptOutcome;
  /** Tentativas feitas, CONTANDO a que acabou de acontecer. */
  attemptsDone: number;
  schedule: number[];
  now: Date;
  random: () => number;
}): RetryDecision {
  const { outcome, attemptsDone, schedule, now, random } = input;

  if (outcome.kind === 'success') return { action: 'delivered' };

  if (outcome.kind === 'http_error' && outcome.status === 410) {
    return { action: 'fail', disableEndpointReason: 'Destino respondeu 410 Gone — desativado automaticamente.' };
  }

  if (attemptsDone >= schedule.length) return { action: 'fail' };

  let delaySeconds = schedule[attemptsDone] * jitter(random);

  if (outcome.kind === 'http_error' && STATUSES_WITH_RETRY_AFTER.has(outcome.status) && outcome.retryAfterSeconds != null) {
    delaySeconds = Math.max(delaySeconds, Math.min(outcome.retryAfterSeconds, RETRY_AFTER_CAP_SECONDS));
  }

  return { action: 'retry', nextAttemptAt: new Date(now.getTime() + Math.round(delaySeconds * 1000)) };
}

/** `Retry-After` em segundos ou data HTTP (RFC 9110); inválido → `null`. */
export function parseRetryAfter(value: string | undefined, now: Date): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  if (!/[a-z]/i.test(trimmed)) return null; // "-5", "1.5": nem segundos nem data
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.round((date - now.getTime()) / 1000));
}
