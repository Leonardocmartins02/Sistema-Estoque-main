import { describe, it, expect } from 'vitest';

import { decideNext, parseRetryAfter } from '../src/webhooks/retryPolicy';

const SCHEDULE = [0, 5, 300, 1800, 7200, 18000, 36000, 36000];
const now = new Date('2026-10-19T12:00:00.000Z');
const noJitter = () => 0.5; // fator 1,0 exato

describe('decideNext — política de retentativa (research.md, Questão 3)', () => {
  it('2xx é entregue', () => {
    expect(
      decideNext({ outcome: { kind: 'success', status: 204 }, attemptsDone: 1, schedule: SCHEDULE, now, random: noJitter }),
    ).toEqual({ action: 'delivered' });
  });

  it('falha agenda a próxima tentativa pelo cronograma (5 s depois da 1ª, 5 min depois da 2ª)', () => {
    const afterFirst = decideNext({
      outcome: { kind: 'http_error', status: 500 },
      attemptsDone: 1,
      schedule: SCHEDULE,
      now,
      random: noJitter,
    });
    expect(afterFirst).toEqual({ action: 'retry', nextAttemptAt: new Date(now.getTime() + 5_000) });

    const afterSecond = decideNext({ outcome: { kind: 'timeout' }, attemptsDone: 2, schedule: SCHEDULE, now, random: noJitter });
    expect(afterSecond).toEqual({ action: 'retry', nextAttemptAt: new Date(now.getTime() + 300_000) });
  });

  it('jitter fica dentro de ±20% do intervalo', () => {
    const at = (random: number) =>
      (decideNext({ outcome: { kind: 'network' }, attemptsDone: 2, schedule: SCHEDULE, now, random: () => random }) as {
        nextAttemptAt: Date;
      }).nextAttemptAt.getTime() - now.getTime();
    expect(at(0)).toBe(240_000);
    expect(at(0.999999)).toBeLessThanOrEqual(360_000);
    expect(at(0.999999)).toBeGreaterThan(359_000);
  });

  it('esgotadas as tentativas do cronograma, falha definitivamente', () => {
    expect(
      decideNext({ outcome: { kind: 'http_error', status: 500 }, attemptsDone: 8, schedule: SCHEDULE, now, random: noJitter }),
    ).toEqual({ action: 'fail' });
  });

  it('410 Gone falha na hora e manda desativar o destino', () => {
    expect(
      decideNext({ outcome: { kind: 'http_error', status: 410 }, attemptsDone: 1, schedule: SCHEDULE, now, random: noJitter }),
    ).toEqual({ action: 'fail', disableEndpointReason: 'Destino respondeu 410 Gone — desativado automaticamente.' });
  });

  it('redirecionamento e destino bloqueado também seguem o cronograma (não são definitivos)', () => {
    for (const outcome of [{ kind: 'redirect', status: 302 }, { kind: 'blocked' }] as const) {
      expect(decideNext({ outcome, attemptsDone: 1, schedule: SCHEDULE, now, random: noJitter }).action).toBe('retry');
    }
  });

  it('429/503 com Retry-After maior que o cronograma: espera o Retry-After', () => {
    const decision = decideNext({
      outcome: { kind: 'http_error', status: 503, retryAfterSeconds: 120 },
      attemptsDone: 1,
      schedule: SCHEDULE,
      now,
      random: noJitter,
    });
    expect(decision).toEqual({ action: 'retry', nextAttemptAt: new Date(now.getTime() + 120_000) });
  });

  it('Retry-After menor que o cronograma não antecipa a tentativa', () => {
    const decision = decideNext({
      outcome: { kind: 'http_error', status: 429, retryAfterSeconds: 1 },
      attemptsDone: 2,
      schedule: SCHEDULE,
      now,
      random: noJitter,
    });
    expect(decision).toEqual({ action: 'retry', nextAttemptAt: new Date(now.getTime() + 300_000) });
  });

  it('Retry-After é limitado a 24 h', () => {
    const decision = decideNext({
      outcome: { kind: 'http_error', status: 503, retryAfterSeconds: 10 * 24 * 3600 },
      attemptsDone: 1,
      schedule: SCHEDULE,
      now,
      random: noJitter,
    });
    expect(decision).toEqual({ action: 'retry', nextAttemptAt: new Date(now.getTime() + 24 * 3600_000) });
  });

  it('Retry-After em outro status (ex.: 500) é ignorado', () => {
    const decision = decideNext({
      outcome: { kind: 'http_error', status: 500, retryAfterSeconds: 3600 },
      attemptsDone: 1,
      schedule: SCHEDULE,
      now,
      random: noJitter,
    });
    expect(decision).toEqual({ action: 'retry', nextAttemptAt: new Date(now.getTime() + 5_000) });
  });
});

describe('parseRetryAfter', () => {
  it('aceita segundos', () => {
    expect(parseRetryAfter('120', now)).toBe(120);
  });

  it('aceita data HTTP', () => {
    expect(parseRetryAfter('Mon, 19 Oct 2026 12:10:00 GMT', now)).toBe(600);
  });

  it('data no passado vira 0', () => {
    expect(parseRetryAfter('Mon, 19 Oct 2026 11:00:00 GMT', now)).toBe(0);
  });

  it.each([undefined, '', 'amanhã', '-5', '1.5'])('valor inválido %j é ignorado', (value) => {
    expect(parseRetryAfter(value, now)).toBeNull();
  });
});
