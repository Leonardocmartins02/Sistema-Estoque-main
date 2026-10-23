import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteMyAccount, fetchMyData } from '../src/api/account';
import { ApiRequestError } from '../src/api/httpClient';
import { AccountDataModal } from '../src/components/AccountDataModal';

vi.mock('../src/api/account', () => ({ fetchMyData: vi.fn(), deleteMyAccount: vi.fn() }));

const mockedFetch = vi.mocked(fetchMyData);
const mockedDelete = vi.mocked(deleteMyAccount);

function renderModal(onAccountDeleted = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AccountDataModal open onOpenChange={vi.fn()} onAccountDeleted={onAccountDeleted} />
    </QueryClientProvider>,
  );
  return { onAccountDeleted };
}

describe('AccountDataModal (LGPD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    URL.revokeObjectURL = vi.fn();
  });

  it('explica quais dados são guardados', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: /meus dados/i })).toBeInTheDocument();
    expect(screen.getByText(/guardamos seu e-mail/i)).toBeInTheDocument();
  });

  it('baixa uma cópia dos dados', async () => {
    mockedFetch.mockResolvedValue({ user: { id: '1', email: 'a@b.co', createdAt: '', updatedAt: '' }, movements: [], exportedAt: '' });
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: /baixar meus dados/i }));
    await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });

  it('só habilita a exclusão após informar a senha e exclui ao confirmar', async () => {
    mockedDelete.mockResolvedValue(undefined);
    const { onAccountDeleted } = renderModal();
    const button = screen.getByRole('button', { name: /excluir minha conta/i });
    expect(button).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/senha/i), 'minha-senha');
    expect(button).toBeEnabled();
    await userEvent.click(button);

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('minha-senha'));
    await waitFor(() => expect(onAccountDeleted).toHaveBeenCalled());
  });

  it('mostra o erro (role=alert) quando a senha está incorreta e não desloga', async () => {
    mockedDelete.mockRejectedValue(new ApiRequestError(403, 'Senha incorreta.'));
    const { onAccountDeleted } = renderModal();
    await userEvent.type(screen.getByLabelText(/senha/i), 'errada');
    await userEvent.click(screen.getByRole('button', { name: /excluir minha conta/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Senha incorreta.');
    expect(onAccountDeleted).not.toHaveBeenCalled();
  });
});
