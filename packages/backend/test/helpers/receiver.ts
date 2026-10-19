import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export type ReceivedRequest = {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
};

type Handler = (req: ReceivedRequest, res: ServerResponse) => void;

/**
 * Receptor HTTP real em 127.0.0.1, porta aleatória — o worker é testado
 * fazendo requisições de verdade, sem rede externa (loopback é liberado
 * fora de produção pela guarda de SSRF).
 */
export async function startReceiver(handler: Handler = (_req, res) => res.writeHead(200).end('ok')) {
  const requests: ReceivedRequest[] = [];
  let current: Handler = handler;

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const received = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      };
      requests.push(received);
      current(received, res);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/webhook`,
    origin: `http://127.0.0.1:${port}`,
    requests,
    respondWith(next: Handler) {
      current = next;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
