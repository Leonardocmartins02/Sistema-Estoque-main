import type { LookupAddress } from 'node:dns';

import { describe, it, expect } from 'vitest';

import {
  BlockedDestinationError,
  createGuardedLookup,
  isBlockedAddress,
  validateDestinationUrl,
} from '../src/webhooks/destinationGuard';

const fakeResolver =
  (addresses: string[]) =>
  async (): Promise<LookupAddress[]> =>
    addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));

describe('isBlockedAddress — faixas internas', () => {
  it.each([
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.10',
    '169.254.169.254', // metadados de nuvem
    '100.64.0.1', // CGNAT
    '0.0.0.0',
    '224.0.0.1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    '::',
    '::ffff:127.0.0.1', // IPv4 mapeado em IPv6
    '::ffff:10.0.0.1',
    '::ffff:7f00:1', // mesmo 127.0.0.1, em hexadecimal
    '::ffff:8.8.8.8', // mapeado é sempre bloqueado, até para IP público
  ])('bloqueia %s em qualquer ambiente', (address) => {
    expect(isBlockedAddress(address, { allowLoopback: true })).toBe(true);
    expect(isBlockedAddress(address, { allowLoopback: false })).toBe(true);
  });

  it.each(['127.0.0.1', '127.1.2.3', '::1'])('loopback %s só é liberado fora de produção', (address) => {
    expect(isBlockedAddress(address, { allowLoopback: true })).toBe(false);
    expect(isBlockedAddress(address, { allowLoopback: false })).toBe(true);
  });

  it.each(['8.8.8.8', '93.184.215.14', '2606:4700:4700::1111'])('libera endereço público %s', (address) => {
    expect(isBlockedAddress(address, { allowLoopback: false })).toBe(false);
  });

  it('172.32.0.1 está fora de 172.16.0.0/12 e é liberado', () => {
    expect(isBlockedAddress('172.32.0.1', { allowLoopback: false })).toBe(false);
  });
});

describe('validateDestinationUrl — cadastro do destino', () => {
  it('aceita https público em produção', async () => {
    const url = await validateDestinationUrl('https://hooks.exemplo.com/estoque', {
      production: true,
      resolve: fakeResolver(['93.184.215.14']),
    });
    expect(url.toString()).toBe('https://hooks.exemplo.com/estoque');
  });

  it('recusa http em produção', async () => {
    await expect(
      validateDestinationUrl('http://hooks.exemplo.com', { production: true, resolve: fakeResolver(['93.184.215.14']) }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('aceita http://localhost fora de produção (receptor de demonstração)', async () => {
    await expect(
      validateDestinationUrl('http://localhost:4100/webhook', { production: false, resolve: fakeResolver(['127.0.0.1']) }),
    ).resolves.toBeInstanceOf(URL);
  });

  it.each(['ftp://exemplo.com', 'não é url', 'https://usuario:senha@exemplo.com'])(
    'recusa %s',
    async (raw) => {
      await expect(
        validateDestinationUrl(raw, { production: false, resolve: fakeResolver(['93.184.215.14']) }),
      ).rejects.toMatchObject({ status: 400 });
    },
  );

  it('recusa IP interno literal', async () => {
    await expect(
      validateDestinationUrl('https://169.254.169.254/latest', { production: true, resolve: fakeResolver([]) }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('recusa nome que resolve para endereço interno — basta um dos endereços', async () => {
    await expect(
      validateDestinationUrl('https://interno.exemplo.com', {
        production: true,
        resolve: fakeResolver(['93.184.215.14', '10.0.0.5']),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('recusa nome que não resolve', async () => {
    await expect(
      validateDestinationUrl('https://nao-existe.exemplo', {
        production: true,
        resolve: async () => {
          throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
        },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('createGuardedLookup — validação na hora da conexão (DNS rebinding)', () => {
  type Callback = (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void;

  function lookupReturning(addresses: string[]) {
    return (_hostname: string, _options: object, callback: Callback) =>
      callback(
        null,
        addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })),
      );
  }

  function run(lookup: ReturnType<typeof createGuardedLookup>, options: { all?: boolean }) {
    return new Promise<{ err: Error | null; address?: unknown; family?: number }>((resolve) => {
      lookup('destino.exemplo.com', options, (err, address, family) => resolve({ err, address, family }));
    });
  }

  it('recusa quando o nome resolve para endereço interno no momento da conexão', async () => {
    const guarded = createGuardedLookup({ allowLoopback: false, lookup: lookupReturning(['10.0.0.5']) });
    const { err } = await run(guarded, {});
    expect(err).toBeInstanceOf(BlockedDestinationError);
  });

  it('entrega o endereço validado no formato simples', async () => {
    const guarded = createGuardedLookup({ allowLoopback: false, lookup: lookupReturning(['93.184.215.14']) });
    const { err, address, family } = await run(guarded, {});
    expect(err).toBeNull();
    expect(address).toBe('93.184.215.14');
    expect(family).toBe(4);
  });

  it('entrega todos os endereços quando a conexão pede `all` (autoSelectFamily)', async () => {
    const guarded = createGuardedLookup({
      allowLoopback: false,
      lookup: lookupReturning(['93.184.215.14', '2606:4700:4700::1111']),
    });
    const { err, address } = await run(guarded, { all: true });
    expect(err).toBeNull();
    expect(address).toEqual([
      { address: '93.184.215.14', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    ]);
  });
});
