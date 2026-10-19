import dns, { type LookupAddress } from 'node:dns';
import { BlockList, isIP } from 'node:net';

import { HttpError } from '../shared/httpError';

/**
 * Proteção contra SSRF (research.md, Questão 8). A URL do destino vem do
 * usuário e o servidor faz requisições para ela — sem esta guarda, o recurso
 * vira uma forma de fazer o servidor acessar a rede interna (banco, painel
 * de admin, metadados de nuvem em 169.254.169.254).
 *
 * Duas camadas:
 * 1. `validateDestinationUrl` no cadastro — feedback imediato ao usuário.
 * 2. `createGuardedLookup` na hora de CONECTAR — a que realmente protege:
 *    o DNS é resolvido, cada IP é checado e a conexão é aberta NESSE IP.
 *    Validar só no cadastro deixa passar DNS rebinding (o nome resolve para
 *    um IP público na validação e para um interno no envio).
 */

const internal = new BlockList();
// IPv4 — redes privadas, link-local/metadados, CGNAT, "esta rede",
// documentação/benchmark, multicast e reservado.
internal.addSubnet('0.0.0.0', 8, 'ipv4');
internal.addSubnet('10.0.0.0', 8, 'ipv4');
internal.addSubnet('100.64.0.0', 10, 'ipv4');
internal.addSubnet('169.254.0.0', 16, 'ipv4');
internal.addSubnet('172.16.0.0', 12, 'ipv4');
internal.addSubnet('192.0.0.0', 24, 'ipv4');
internal.addSubnet('192.0.2.0', 24, 'ipv4');
internal.addSubnet('192.168.0.0', 16, 'ipv4');
internal.addSubnet('198.18.0.0', 15, 'ipv4');
internal.addSubnet('198.51.100.0', 24, 'ipv4');
internal.addSubnet('203.0.113.0', 24, 'ipv4');
internal.addSubnet('224.0.0.0', 4, 'ipv4');
internal.addSubnet('240.0.0.0', 4, 'ipv4');
// IPv6 — não especificado, NAT64, discard, documentação, ULA, link-local,
// multicast.
internal.addAddress('::', 'ipv6');
internal.addSubnet('64:ff9b::', 96, 'ipv6');
internal.addSubnet('100::', 64, 'ipv6');
internal.addSubnet('2001:db8::', 32, 'ipv6');
internal.addSubnet('fc00::', 7, 'ipv6');
internal.addSubnet('fe80::', 10, 'ipv6');
internal.addSubnet('ff00::', 8, 'ipv6');

// IPv4 mapeado em IPv6 (`::ffff:a.b.c.d`), bloqueado inteiro: um AAAA
// legítimo nunca devolve endereço mapeado, e é o desvio clássico para
// alcançar 127.0.0.1/10.x "por IPv6". Lista SEPARADA e consultada só para
// endereços IPv6 — o `BlockList` do Node compara IPv4 contra regras IPv6 na
// forma mapeada, então esta regra na lista `internal` bloquearia todo IPv4.
const ipv4Mapped = new BlockList();
ipv4Mapped.addSubnet('::ffff:0:0', 96, 'ipv6');

const loopback = new BlockList();
loopback.addSubnet('127.0.0.0', 8, 'ipv4');
loopback.addAddress('::1', 'ipv6');

export type GuardOptions = {
  /** Só fora de produção: libera o receptor de demonstração em localhost. */
  allowLoopback: boolean;
};

export function isBlockedAddress(address: string, { allowLoopback }: GuardOptions): boolean {
  const family = isIP(address);
  if (family === 0) return true; // não é IP — nunca conectar "às cegas"
  const type = family === 4 ? 'ipv4' : 'ipv6';
  if (type === 'ipv6' && ipv4Mapped.check(address, 'ipv6')) return true;
  if (internal.check(address, type)) return true;
  return !allowLoopback && loopback.check(address, type);
}

/** Erro de conexão recusada pela guarda — o worker registra como `BLOCKED_DESTINATION`. */
export class BlockedDestinationError extends Error {
  code = 'BLOCKED_DESTINATION';

  constructor(hostname: string) {
    super(`Destino ${hostname} resolve para um endereço interno e foi bloqueado.`);
    this.name = 'BlockedDestinationError';
  }
}

type Resolver = (hostname: string) => Promise<LookupAddress[]>;

const systemResolver: Resolver = (hostname) => dns.promises.lookup(hostname, { all: true, verbatim: true });

/**
 * Validação no cadastro/edição do destino. Lança `HttpError(400)` com
 * mensagem para o usuário; devolve a URL normalizada.
 */
export async function validateDestinationUrl(
  raw: string,
  options: { production: boolean; resolve?: Resolver },
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, 'URL de destino inválida.');
  }

  const allowedProtocols = options.production ? ['https:'] : ['https:', 'http:'];
  if (!allowedProtocols.includes(url.protocol)) {
    throw new HttpError(
      400,
      options.production ? 'O destino precisa usar https.' : 'O destino precisa usar http ou https.',
    );
  }
  if (url.username || url.password) {
    throw new HttpError(400, 'A URL de destino não pode conter usuário e senha.');
  }

  const guard = { allowLoopback: !options.production };
  // `URL` mantém colchetes em IPv6 literal (`[::1]`).
  const hostname = url.hostname.replace(/^\[(.*)\]$/, '$1');

  let addresses: string[];
  if (isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      addresses = (await (options.resolve ?? systemResolver)(hostname)).map((entry) => entry.address);
    } catch {
      throw new HttpError(400, `Não foi possível resolver o endereço ${hostname}.`);
    }
    if (addresses.length === 0) {
      throw new HttpError(400, `Não foi possível resolver o endereço ${hostname}.`);
    }
  }

  if (addresses.some((address) => isBlockedAddress(address, guard))) {
    throw new HttpError(400, 'O destino aponta para um endereço de rede interna e não é permitido.');
  }

  return url;
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address?: string | LookupAddress[],
  family?: number,
) => void;

type LookupFn = (hostname: string, options: dns.LookupOptions, callback: LookupCallback) => void;

/**
 * Função `lookup` para `http.request`/`https.request`: resolve o nome, recusa
 * se QUALQUER endereço for interno e entrega ao socket exatamente os
 * endereços validados. Suporta os dois formatos que o Node pede — endereço
 * único, ou `all: true` (usado pelo `autoSelectFamily`, padrão desde o Node 20).
 */
export function createGuardedLookup(options: GuardOptions & { lookup?: LookupFn }) {
  const lookup: LookupFn = options.lookup ?? (dns.lookup as unknown as LookupFn);

  return (hostname: string, lookupOptions: dns.LookupOptions, callback: LookupCallback): void => {
    lookup(hostname, { ...lookupOptions, all: true }, (err, result) => {
      if (err) return callback(err);
      const addresses = (Array.isArray(result) ? result : []) as LookupAddress[];
      if (addresses.length === 0) {
        return callback(Object.assign(new Error(`Sem endereço para ${hostname}`), { code: 'ENOTFOUND' }));
      }
      if (addresses.some((entry) => isBlockedAddress(entry.address, options))) {
        return callback(new BlockedDestinationError(hostname));
      }
      if (lookupOptions.all) return callback(null, addresses);
      return callback(null, addresses[0].address, addresses[0].family);
    });
  };
}
