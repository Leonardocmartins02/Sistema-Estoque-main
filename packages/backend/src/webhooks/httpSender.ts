import http from 'node:http';
import https from 'node:https';

import type { WebhookAttemptErrorCode } from '@simplestock/shared';

import { createGuardedLookup } from './destinationGuard';
import { parseRetryAfter, type AttemptOutcome } from './retryPolicy';

/** Teto do trecho de resposta/erro guardado na tentativa (PRD, NFR 6). */
export const SNIPPET_MAX_BYTES = 1024;

export type SendResult = {
  outcome: AttemptOutcome;
  durationMs: number;
  responseStatus: number | null;
  errorCode: WebhookAttemptErrorCode | null;
  responseSnippet: string | null;
};

type GuardedLookup = ReturnType<typeof createGuardedLookup>;

export type SendInput = {
  url: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
  lookup: GuardedLookup;
  now: Date;
};

class TimeoutError extends Error {}

function truncate(text: string): string {
  const bytes = Buffer.from(text, 'utf8');
  return bytes.length <= SNIPPET_MAX_BYTES ? text : bytes.subarray(0, SNIPPET_MAX_BYTES).toString('utf8');
}

/**
 * Uma tentativa de entrega. Nunca lança — todo resultado (sucesso, HTTP de
 * erro, timeout, rede, destino bloqueado) volta como `SendResult` para o
 * dispatcher registrar.
 *
 * - `lookup` guardado: o DNS é resolvido e validado NA CONEXÃO (research.md,
 *   Questão 8); `agent: false` garante conexão nova por tentativa, então a
 *   validação nunca é pulada por um socket reaproveitado.
 * - Redirecionamento não é seguido (`http.request` não segue sozinho) e
 *   conta como falha (Standard Webhooks).
 * - O tempo limite cobre a tentativa inteira até chegar o status; depois
 *   dele, o trecho da resposta é lido só até 1 KB.
 */
export function sendWebhook(input: SendInput): Promise<SendResult> {
  const started = Date.now();
  const url = new URL(input.url);
  const transport = url.protocol === 'https:' ? https : http;

  return new Promise<SendResult>((resolve) => {
    let settled = false;
    let status: number | null = null;
    let retryAfter: string | undefined;
    const chunks: Buffer[] = [];
    let collected = 0;

    const finish = (result: Omit<SendResult, 'durationMs'>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, durationMs: Date.now() - started });
    };

    const finishWithResponse = () => {
      if (status === null) return;
      const snippet = chunks.length > 0 ? truncate(Buffer.concat(chunks).toString('utf8')) : null;
      if (status >= 200 && status < 300) {
        finish({ outcome: { kind: 'success', status }, responseStatus: status, errorCode: null, responseSnippet: snippet });
      } else if (status >= 300 && status < 400) {
        finish({ outcome: { kind: 'redirect', status }, responseStatus: status, errorCode: 'REDIRECT', responseSnippet: snippet });
      } else {
        finish({
          outcome: { kind: 'http_error', status, retryAfterSeconds: parseRetryAfter(retryAfter, input.now) },
          responseStatus: status,
          errorCode: 'HTTP_ERROR',
          responseSnippet: snippet,
        });
      }
    };

    const req = transport.request(url, {
      method: 'POST',
      headers: { ...input.headers, 'content-length': Buffer.byteLength(input.body) },
      lookup: input.lookup as unknown as http.RequestOptions['lookup'],
      agent: false,
    });

    // `finish` usa `timer`, mas só roda em callbacks assíncronos — sempre
    // depois desta linha.
    const timer = setTimeout(() => {
      if (status !== null) {
        // Status já chegou: só o corpo está lento — fica com o que veio.
        finishWithResponse();
        req.destroy();
        return;
      }
      req.destroy(new TimeoutError());
    }, input.timeoutMs);

    req.on('response', (res) => {
      status = res.statusCode ?? 0;
      const header = res.headers['retry-after'];
      retryAfter = Array.isArray(header) ? header[0] : header;

      res.on('data', (chunk: Buffer) => {
        if (collected >= SNIPPET_MAX_BYTES) return;
        chunks.push(chunk);
        collected += chunk.length;
        if (collected >= SNIPPET_MAX_BYTES) {
          finishWithResponse();
          res.destroy();
        }
      });
      res.on('end', finishWithResponse);
      res.on('close', finishWithResponse);
      res.on('error', finishWithResponse);
    });

    req.on('error', (err: NodeJS.ErrnoException) => {
      if (status !== null) return finishWithResponse();
      if (err instanceof TimeoutError) {
        return finish({ outcome: { kind: 'timeout' }, responseStatus: null, errorCode: 'TIMEOUT', responseSnippet: null });
      }
      if (err.code === 'BLOCKED_DESTINATION') {
        return finish({
          outcome: { kind: 'blocked' },
          responseStatus: null,
          errorCode: 'BLOCKED_DESTINATION',
          responseSnippet: truncate(err.message),
        });
      }
      // Só o código/mensagem do erro de rede (ex.: ECONNREFUSED) — nunca
      // headers ou corpo da requisição, que carregam a assinatura.
      return finish({
        outcome: { kind: 'network' },
        responseStatus: null,
        errorCode: 'NETWORK',
        responseSnippet: truncate(err.code ?? err.message),
      });
    });

    req.end(input.body);
  });
}
