import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ApiStatusBanner from '../src/components/ui/ApiStatusBanner';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiStatusBanner', () => {
  it('anuncia a indisponibilidade da API em uma região viva polida', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    render(<ApiStatusBanner intervalMs={1_000_000} />);

    const region = await screen.findByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    await waitFor(() => expect(region).toHaveTextContent(/API está indisponível/i));
  });

  it('mantém a região viva montada quando a API está disponível (para o anúncio funcionar depois)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response));

    render(<ApiStatusBanner intervalMs={1_000_000} />);

    const region = await screen.findByRole('status');
    await waitFor(() => expect(region).not.toHaveTextContent(/API está indisponível/i));
  });
});
