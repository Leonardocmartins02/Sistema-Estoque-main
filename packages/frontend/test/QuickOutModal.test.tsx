import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../src/api/httpClient';
import { quickOutProduct } from '../src/api/quickOut';
import { QuickOutModal } from '../src/components/QuickOutModal';
import { ToastProvider } from '../src/components/ui/ToastProvider';

vi.mock('../src/api/quickOut', () => ({ quickOutProduct: vi.fn() }));

const mockedQuickOutProduct = vi.mocked(quickOutProduct);

const product = { id: 'p1', name: 'Caneta Azul', sku: 'CAN-001', currentBalance: 5 };

function renderModal() {
  const onOpenChange = vi.fn();
  render(
    <ToastProvider>
      <QuickOutModal open onOpenChange={onOpenChange} product={product} />
    </ToastProvider>,
  );
  return { onOpenChange };
}

async function submit() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Confirmar Baixa/i }));
}

describe('QuickOutModal — erro da API chega ao usuário (F-07 / UF-26)', () => {
  beforeEach(() => {
    mockedQuickOutProduct.mockReset();
  });

  it('exibe a mensagem de negócio do backend (422 "Estoque insuficiente.")', async () => {
    mockedQuickOutProduct.mockRejectedValue(new ApiRequestError(422, 'Estoque insuficiente.'));
    renderModal();

    await submit();

    // Pode aparecer mais de uma vez (bloco de erro duplicado C-3 + toast);
    // o que importa aqui é que a mensagem do backend chegue ao usuário.
    await waitFor(() => expect(screen.getAllByText('Estoque insuficiente.').length).toBeGreaterThan(0));
    expect(screen.queryByText('Falha ao registrar baixa')).toBeNull();
  });

  it('exibe a mensagem sanitizada do backend em erro interno (500)', async () => {
    mockedQuickOutProduct.mockRejectedValue(new ApiRequestError(500, 'Erro interno do servidor.'));
    renderModal();

    await submit();

    await waitFor(() => expect(screen.getAllByText('Erro interno do servidor.').length).toBeGreaterThan(0));
  });

  it('cai no texto genérico quando o erro não é da API (não vaza detalhe interno)', async () => {
    mockedQuickOutProduct.mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'x')"));
    renderModal();

    await submit();

    await waitFor(() => expect(screen.getAllByText('Falha ao registrar baixa').length).toBeGreaterThan(0));
    expect(screen.queryByText(/Cannot read properties/i)).toBeNull();
  });

  it('cai no texto genérico quando a API não traz mensagem utilizável', async () => {
    mockedQuickOutProduct.mockRejectedValue(new ApiRequestError(422, ''));
    renderModal();

    await waitFor(() => expect(screen.getByRole('button', { name: /Confirmar Baixa/i })).toBeEnabled());
    await submit();

    await waitFor(() => expect(screen.getAllByText('Falha ao registrar baixa').length).toBeGreaterThan(0));
  });
});
