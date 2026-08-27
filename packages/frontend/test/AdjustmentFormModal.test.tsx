import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdjustment } from '../src/api/adjustments';
import { ApiRequestError } from '../src/api/httpClient';
import type { Movement } from '../src/api/types';
import { AdjustmentFormModal } from '../src/components/AdjustmentFormModal';
import { ToastProvider } from '../src/components/ui/ToastProvider';

vi.mock('../src/api/adjustments', () => ({ createAdjustment: vi.fn() }));

const mockedCreateAdjustment = vi.mocked(createAdjustment);

const product = { id: 'p1', name: 'Borracha Branca', sku: 'BORRACHA-012', balance: 20 };

function renderModal(onOpenChange = vi.fn(), onSuccess = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    onOpenChange,
    onSuccess,
    ...render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <AdjustmentFormModal open onOpenChange={onOpenChange} product={product} onSuccess={onSuccess} />
        </ToastProvider>
      </QueryClientProvider>,
    ),
  };
}

async function fillValidFormAndAdvance(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByLabelText(/Nova quantidade/i));
  await user.type(screen.getByLabelText(/Nova quantidade/i), '18');
  await user.type(screen.getByLabelText(/Motivo/i), 'Contagem física mensal');
  await user.click(screen.getByRole('button', { name: /Ajustar/i }));
}

describe('AdjustmentFormModal — formulário e confirmação (Task 4)', () => {
  beforeEach(() => {
    mockedCreateAdjustment.mockReset();
    mockedCreateAdjustment.mockResolvedValue({
      id: 'm1',
      productId: 'p1',
      type: 'ADJUSTMENT',
      quantity: 2,
      previousQuantity: 20,
      newQuantity: 18,
      note: 'Contagem física mensal',
      date: '2027-05-10T18:31:00.000Z',
      createdAt: '2027-05-10T18:31:00.000Z',
    });
  });

  it('mostra o saldo atual somente leitura', async () => {
    renderModal();
    expect(await screen.findByText(/Saldo atual/i)).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('mostra o preview ao vivo (saldo atual → novo saldo, diferença com sinal) conforme digita', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.clear(screen.getByLabelText(/Nova quantidade/i));
    await user.type(screen.getByLabelText(/Nova quantidade/i), '18');

    expect(await screen.findByText(/20 → 18/)).toBeInTheDocument();
    expect(screen.getByText(/-2/)).toBeInTheDocument();
  });

  it('preenche saldo alvo e motivo válidos e avança para a confirmação com os dados corretos', async () => {
    const user = userEvent.setup();
    renderModal();

    await fillValidFormAndAdvance(user);

    expect(await screen.findByText('Ajustar estoque?')).toBeInTheDocument();
    expect(screen.getByText('Borracha Branca')).toBeInTheDocument();
    expect(screen.getByText(/20 → 18/)).toBeInTheDocument();
    expect(screen.getByText('Contagem física mensal')).toBeInTheDocument();
  });

  it('não chama createAdjustment antes da confirmação final', async () => {
    const user = userEvent.setup();
    renderModal();

    await fillValidFormAndAdvance(user);

    expect(await screen.findByText('Ajustar estoque?')).toBeInTheDocument();
    expect(mockedCreateAdjustment).not.toHaveBeenCalled();
  });

  it('confirmar dispara createAdjustment com o payload correto', async () => {
    const user = userEvent.setup();
    renderModal();

    await fillValidFormAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));

    await waitFor(() => expect(mockedCreateAdjustment).toHaveBeenCalledTimes(1));
    expect(mockedCreateAdjustment).toHaveBeenCalledWith('p1', {
      targetQuantity: 18,
      expectedPreviousQuantity: 20,
      reason: 'Contagem física mensal',
    });
  });

  it('bloqueia a confirmação quando o alvo é igual ao saldo atual', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.clear(screen.getByLabelText(/Nova quantidade/i));
    await user.type(screen.getByLabelText(/Nova quantidade/i), '20');
    await user.type(screen.getByLabelText(/Motivo/i), 'Sem divergência');
    await user.click(screen.getByRole('button', { name: /Ajustar/i }));

    expect(await screen.findByText(/diferente do saldo atual/i)).toBeInTheDocument();
    expect(screen.queryByText('Ajustar estoque?')).not.toBeInTheDocument();
    expect(mockedCreateAdjustment).not.toHaveBeenCalled();
  });

  it('permite alvo zero', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.clear(screen.getByLabelText(/Nova quantidade/i));
    await user.type(screen.getByLabelText(/Nova quantidade/i), '0');
    await user.type(screen.getByLabelText(/Motivo/i), 'Perda total');
    await user.click(screen.getByRole('button', { name: /Ajustar/i }));

    expect(await screen.findByText('Ajustar estoque?')).toBeInTheDocument();
    expect(screen.getByText(/20 → 0/)).toBeInTheDocument();
  });

  it('rejeita alvo negativo com erro inline, sem avançar', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.clear(screen.getByLabelText(/Nova quantidade/i));
    await user.type(screen.getByLabelText(/Nova quantidade/i), '-1');
    await user.type(screen.getByLabelText(/Motivo/i), 'Motivo válido');
    await user.click(screen.getByRole('button', { name: /Ajustar/i }));

    expect(await screen.findByText(/valor válido/i)).toBeInTheDocument();
    expect(screen.queryByText('Ajustar estoque?')).not.toBeInTheDocument();
  });

  it('rejeita motivo vazio com erro inline, sem avançar', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.clear(screen.getByLabelText(/Nova quantidade/i));
    await user.type(screen.getByLabelText(/Nova quantidade/i), '18');
    await user.click(screen.getByRole('button', { name: /Ajustar/i }));

    expect(await screen.findByText(/Informe o motivo/i)).toBeInTheDocument();
    expect(screen.queryByText('Ajustar estoque?')).not.toBeInTheDocument();
  });

  it('rejeita motivo acima de 500 caracteres com erro inline, sem avançar', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.clear(screen.getByLabelText(/Nova quantidade/i));
    await user.type(screen.getByLabelText(/Nova quantidade/i), '18');
    // 501 caracteres via `user.type` (tecla por tecla) estoura o timeout do
    // teste sem agregar nada à cobertura — `fireEvent.change` define o valor
    // final direto, mesmo padrão já usado em MovementFormModal.test.tsx.
    fireEvent.change(screen.getByLabelText(/Motivo/i), { target: { value: 'a'.repeat(501) } });
    await user.click(screen.getByRole('button', { name: /Ajustar/i }));

    expect(await screen.findByText(/máximo de 500/i)).toBeInTheDocument();
    expect(screen.queryByText('Ajustar estoque?')).not.toBeInTheDocument();
  });

  it('desabilita e mostra indicador de carregamento no botão de confirmação enquanto a mutação está pendente', async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: Movement) => void = () => {};
    mockedCreateAdjustment.mockReturnValueOnce(
      new Promise<Movement>((resolve) => {
        resolvePromise = resolve;
      }),
    );
    renderModal();

    await fillValidFormAndAdvance(user);
    const confirmButton = await screen.findByRole('button', { name: 'Confirmar ajuste' });
    await user.click(confirmButton);

    await waitFor(() => expect(confirmButton).toBeDisabled());
    resolvePromise({
      id: 'm1',
      productId: 'p1',
      type: 'ADJUSTMENT',
      quantity: 2,
      previousQuantity: 20,
      newQuantity: 18,
      note: 'Contagem física mensal',
      date: '2027-05-10T18:31:00.000Z',
      createdAt: '2027-05-10T18:31:00.000Z',
    });
  });

  it('sucesso: fecha o modal, mostra toast e chama onSuccess', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onSuccess } = renderModal();

    await fillValidFormAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Estoque ajustado com sucesso/i)).toBeInTheDocument();
  });

  it('erro HTTP genérico (não 409): volta ao formulário, mostra erro, preserva os dados', async () => {
    const user = userEvent.setup();
    mockedCreateAdjustment.mockRejectedValueOnce(new ApiRequestError(500, 'Erro interno do servidor.'));
    const { onOpenChange } = renderModal();

    await fillValidFormAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));

    expect(await screen.findByText('Erro interno do servidor.')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    // Volta ao formulário (não fica preso na confirmação) com os dados preservados.
    expect(screen.getByLabelText(/Nova quantidade/i)).toHaveValue(18);
    expect(screen.getByLabelText(/Motivo/i)).toHaveValue('Contagem física mensal');
  });

  it('cancelar no formulário não chama createAdjustment', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockedCreateAdjustment).not.toHaveBeenCalled();
  });

  it('cancelar na confirmação não chama createAdjustment', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    await fillValidFormAndAdvance(user);
    await screen.findByText('Ajustar estoque?');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockedCreateAdjustment).not.toHaveBeenCalled();
  });
});
