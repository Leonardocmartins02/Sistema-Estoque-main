/**
 * Receptor de DEMONSTRAÇÃO dos webhooks do SimpleStock — fora do app, só
 * para desenvolvimento e para o vídeo. Faz o que um receptor real deve fazer
 * (verificar a assinatura com a biblioteca de referência da Standard
 * Webhooks e descartar duplicatas pelo `webhook-id`) e pode falhar de
 * propósito, para mostrar retentativa e recuperação.
 *
 * Uso:
 *   WEBHOOK_SECRET=whsec_... pnpm --filter @simplestock/backend demo:receiver
 *
 * Variáveis:
 *   WEBHOOK_SECRET   segredo exibido ao criar o destino (obrigatório)
 *   PORT             porta (padrão 4100) — cadastre http://localhost:4100/webhook
 *   FAIL_FIRST=N     responde 500 nas N primeiras tentativas de cada evento
 *   RESPOND_STATUS   responde sempre este status (ex.: 410 para ver a desativação)
 *   DELAY_MS         espera antes de responder (ex.: 20000 para ver o timeout)
 *
 * GET / mostra os eventos recebidos numa página que se atualiza sozinha.
 */
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { pathToFileURL } from 'node:url';

import { Webhook } from 'standardwebhooks';

export type ReceivedEvent = {
  webhookId: string;
  type: string;
  summary: string;
  receivedAt: string;
};

export type DemoReceiverOptions = {
  secret: string;
  failFirst?: number;
  respondStatus?: number;
  delayMs?: number;
  log?: (line: string) => void;
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

type Payload = { type: string; data: Record<string, unknown> };

function summarize(payload: Payload): string {
  const data = payload.data;
  const product = data.product as { sku?: string } | undefined;
  if (payload.type === 'stock.movement.created') {
    return `${product?.sku} ${data.type} ${data.quantity} un. (saldo ${data.previousQuantity} → ${data.newQuantity})`;
  }
  if (payload.type === 'stock.status.changed') {
    return `${product?.sku} status ${data.previousStatus} → ${data.newStatus} (saldo ${data.newQuantity})`;
  }
  return String(data.message ?? '');
}

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

function page(events: ReceivedEvent[]): string {
  const rows = events
    .map(
      (e) =>
        `<tr><td>${escape(new Date(e.receivedAt).toLocaleTimeString('pt-BR'))}</td><td><code>${escape(e.type)}</code></td>` +
        `<td>${escape(e.summary)}</td><td><code>${escape(e.webhookId)}</code></td></tr>`,
    )
    .join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="refresh" content="2">
<title>Receptor de webhooks</title><style>body{font:15px system-ui;margin:24px;color:#1d2330}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #dde1e8;padding:6px 8px;text-align:left}
code{font-size:13px}</style></head><body><h1>Receptor de demonstração</h1>
<p>${events.length} evento(s) aceito(s), assinatura verificada, duplicatas descartadas.</p>
<table><thead><tr><th>Hora</th><th>Tipo</th><th>Resumo</th><th>webhook-id</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export function createDemoReceiver(options: DemoReceiverOptions): { server: Server; received: ReceivedEvent[] } {
  const verifier = new Webhook(options.secret);
  const log = options.log ?? ((line: string) => console.log(line));
  const received: ReceivedEvent[] = [];
  const attemptsById = new Map<string, number>();
  const accepted = new Set<string>();

  const server = createServer(async (req, res) => {
    if (req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page([...received].reverse()));
      return;
    }

    const body = await readBody(req);
    const now = new Date().toLocaleTimeString('pt-BR');
    let payload: Payload;
    try {
      // Verificação sobre o corpo CRU, exatamente como chegou — reserializar
      // o JSON mudaria os bytes e invalidaria a assinatura.
      payload = verifier.verify(body, req.headers as Record<string, string>) as Payload;
    } catch {
      log(`${now}  ✗ assinatura inválida — recusado (401)`);
      res.writeHead(401).end('assinatura inválida');
      return;
    }

    const webhookId = String(req.headers['webhook-id']);
    const attempt = (attemptsById.get(webhookId) ?? 0) + 1;
    attemptsById.set(webhookId, attempt);

    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));

    if (options.respondStatus) {
      log(`${now}  ↯ ${payload.type} tentativa ${attempt} — respondendo ${options.respondStatus} (modo forçado)`);
      res.writeHead(options.respondStatus).end();
      return;
    }
    if (options.failFirst && attempt <= options.failFirst) {
      log(`${now}  ↯ ${payload.type} tentativa ${attempt} — falha simulada (500)`);
      res.writeHead(500).end('falha simulada');
      return;
    }

    if (accepted.has(webhookId)) {
      log(`${now}  = ${payload.type} tentativa ${attempt} — duplicata de ${webhookId}, ignorada (200)`);
      res.writeHead(200).end('duplicata');
      return;
    }

    accepted.add(webhookId);
    const event = { webhookId, type: payload.type, summary: summarize(payload), receivedAt: new Date().toISOString() };
    received.push(event);
    log(`${now}  ✓ ${payload.type} tentativa ${attempt} — ${event.summary}`);
    res.writeHead(200).end('ok');
  });

  return { server, received };
}

function numberFromEnv(name: string): number | undefined {
  const value = process.env[name];
  return value ? Number(value) : undefined;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    console.error('Defina WEBHOOK_SECRET com o segredo whsec_... exibido ao criar o destino.');
    process.exit(1);
  }
  const port = numberFromEnv('PORT') ?? 4100;
  const { server } = createDemoReceiver({
    secret,
    failFirst: numberFromEnv('FAIL_FIRST'),
    respondStatus: numberFromEnv('RESPOND_STATUS'),
    delayMs: numberFromEnv('DELAY_MS'),
  });
  server.listen(port, () => {
    console.log(`Receptor de webhooks em http://localhost:${port}/webhook (eventos: http://localhost:${port}/)`);
  });
}
