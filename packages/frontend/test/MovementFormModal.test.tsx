import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMovement } from '../src/api/movements';
import { MovementFormModal, movementSchema } from '../src/components/MovementFormModal';
import { ToastProvider } from '../src/components/ui/ToastProvider';

vi.mock('../src/api/movements', () => ({ createMovement: vi.fn() }));

const mockedCreateMovement = vi.mocked(createMovement);

function renderModal(onOpenChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MovementFormModal open onOpenChange={onOpenChange} productId="p1" />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('MovementFormModal — campo Data (opcional)', () => {
  beforeEach(() => {
    mockedCreateMovement.mockReset();
    mockedCreateMovement.mockResolvedValue({
      id: 'm1',
      productId: 'p1',
      type: 'IN',
      quantity: 3,
      date: '2027-05-10T18:31:00.000Z',
      note: null,
      createdAt: '2027-05-10T18:31:00.000Z',
    });
  });

  it('aceita o valor de um input datetime-local e envia ISO-8601 completo para a API', async () => {
    const user = userEvent.setup();
    renderModal();

    const dateInput = await screen.findByLabelText(/Data \(opcional\)/i);
    fireEvent.change(dateInput, { target: { value: '2027-05-10T15:31' } });
    await user.clear(screen.getByLabelText(/Quantidade/i));
    await user.type(screen.getByLabelText(/Quantidade/i), '3');

    await user.click(screen.getByRole('button', { name: 'Lançar' }));

    await waitFor(() => expect(mockedCreateMovement).toHaveBeenCalledTimes(1));
    const [productId, payload] = mockedCreateMovement.mock.calls[0];
    expect(productId).toBe('p1');
    expect(payload.date).toBe(new Date('2027-05-10T15:31').toISOString());
    // Sanidade: é um ISO completo aceitável por `z.string().datetime()` no backend
    expect(payload.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('não bloqueia o envio quando a data fica vazia (campo é opcional)', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.clear(await screen.findByLabelText(/Quantidade/i));
    await user.type(screen.getByLabelText(/Quantidade/i), '2');
    await user.click(screen.getByRole('button', { name: 'Lançar' }));

    await waitFor(() => expect(mockedCreateMovement).toHaveBeenCalledTimes(1));
    expect(mockedCreateMovement.mock.calls[0][1].date).toBeUndefined();
  });

  it('trata data inválida como campo vazio quando o input a descarta (comportamento do navegador)', async () => {
    const user = userEvent.setup();
    renderModal();

    // Um `<input type="datetime-local">` não guarda texto livre: o navegador
    // (e o jsdom) sanitizam qualquer valor fora do formato para "". Por isso
    // este caminho não gera erro de validação — ele simplesmente cai no caso
    // "sem data", e o backend usa a data atual.
    const dateInput = await screen.findByLabelText(/Data \(opcional\)/i);
    fireEvent.change(dateInput, { target: { value: 'nao-e-uma-data' } });
    expect((dateInput as HTMLInputElement).value).toBe('');

    await user.click(screen.getByRole('button', { name: 'Lançar' }));

    await waitFor(() => expect(mockedCreateMovement).toHaveBeenCalledTimes(1));
    expect(mockedCreateMovement.mock.calls[0][1].date).toBeUndefined();
  });
});

describe('movementSchema — validação da data fora da UI', () => {
  // O input protege o formulário, mas o schema é a real garantia: ele também
  // roda contra valores que não vieram do input (autofill, extensão, teste).
  // A regressão que este teste trava é o `z.string().datetime()` original,
  // que rejeitava o formato do próprio input e vazava o erro cru em inglês.
  it('aceita o formato produzido pelo input datetime-local', () => {
    const parsed = movementSchema.safeParse({ type: 'IN', quantity: 1, date: '2027-05-10T15:31', note: '' });
    expect(parsed.success).toBe(true);
  });

  it('aceita data ausente ou vazia (campo opcional)', () => {
    expect(movementSchema.safeParse({ type: 'IN', quantity: 1, note: '' }).success).toBe(true);
    expect(movementSchema.safeParse({ type: 'IN', quantity: 1, date: '', note: '' }).success).toBe(true);
  });

  it('rejeita data irreconhecível com mensagem em português, nunca "Invalid datetime"', () => {
    const parsed = movementSchema.safeParse({
      type: 'IN',
      quantity: 1,
      date: 'nao-e-uma-data',
      note: '',
    });
    expect(parsed.success).toBe(false);
    const messages = parsed.success ? [] : parsed.error.issues.map((i) => i.message);
    expect(messages).toContain('Data inválida');
    expect(messages.join(' ')).not.toMatch(/Invalid datetime/i);
  });
});
