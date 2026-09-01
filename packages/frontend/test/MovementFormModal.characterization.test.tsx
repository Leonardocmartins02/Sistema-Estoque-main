import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../src/api/httpClient';
import { createMovement } from '../src/api/movements';
import type { Movement } from '../src/api/types';
import { MovementFormModal } from '../src/components/MovementFormModal';
import { ToastProvider } from '../src/components/ui/ToastProvider';

vi.mock('../src/api/movements', () => ({ createMovement: vi.fn() }));

const mockedCreateMovement = vi.mocked(createMovement);

/**
 * Characterization tests do `MovementFormModal` (`implementation-plan.md`,
 * Task 4 / REV-04). Escritos **antes** das Tasks 17 e 18 reescreverem o
 * componente — protegem o contrato observável atual, não a estrutura do DOM.
 *
 * `MovementFormModal.test.tsx` (existente) já cobre o campo Data (UI + schema
 * Zod) e não é duplicado aqui.
 *
 * NÃO congelado neste arquivo (Task 4, "Comportamentos ALTERAR
 * INTENCIONALMENTE" / "Bugs que NÃO devem ser congelados"):
 *   · o tipo default `IN` — nenhum teste aqui depende de não selecionar o
 *     tipo explicitamente antes de submeter (D2/P-4 vai remover o default);
 *   · o rótulo "Entrada (IN)" / "Saída (OUT)" — localizamos a opção pelo
 *     `value` do `<option>`, nunca pelo texto visível (UF-20);
 *   · o `max` livre da quantidade em `OUT` — nenhum teste envia uma
 *     quantidade maior que um saldo e afirma que isso deveria falhar (D-F,
 *     Task 18 própria).
 */

function makeMovement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: 'm1',
    productId: 'p1',
    type: 'IN',
    quantity: 3,
    date: '2027-05-10T18:31:00.000Z',
    note: null,
    createdAt: '2027-05-10T18:31:00.000Z',
    ...overrides,
  };
}

function Harness() {
  const [open, setOpen] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Movimentar
      </button>
      <MovementFormModal
        open={open}
        onOpenChange={setOpen}
        product={{ id: 'p1', name: 'Caneta Azul', sku: 'CAN-001', balance: 20, minStock: 5 }}
        onSuccess={() => setSuccessCount((n) => n + 1)}
      />
      <p data-testid="success-count">{successCount}</p>
    </>
  );
}

function renderModal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <Harness />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function openModal() {
  const user = userEvent.setup();
  renderModal();
  await user.click(screen.getByRole('button', { name: 'Movimentar' }));
  await screen.findByRole('dialog');
  return user;
}

/**
 * Task 17: o `<select>` de tipo virou um `radiogroup` sem opção
 * pré-selecionada (REV-08). O CONTRATO de MFM-1..MFM-6 é o mesmo — muda apenas
 * COMO a intenção é declarada, e o primário passa a nomear a consequência.
 */
function intentRadio(type: 'IN' | 'OUT'): HTMLInputElement {
  return screen.getByRole('radio', { name: type === 'IN' ? 'Entrada' : 'Saída' }) as HTMLInputElement;
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /^Registrar (entrada|saída)|^Registrando/i }) as HTMLButtonElement;
}

function quantityField(): HTMLInputElement {
  return screen.getByLabelText(/^Quantidade/i) as HTMLInputElement;
}

function noteField(): HTMLTextAreaElement {
  return screen.getByLabelText(/^Observação/i) as HTMLTextAreaElement;
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  { type, quantity, note }: { type: 'IN' | 'OUT'; quantity: string; note?: string },
) {
  await user.click(intentRadio(type));
  await user.clear(quantityField());
  await user.type(quantityField(), quantity);
  if (note !== undefined) {
    await user.clear(noteField());
    await user.type(noteField(), note);
  }
  await user.click(submitButton());
}

describe('MovementFormModal — payload de submissão (MFM-1)', () => {
  beforeEach(() => {
    mockedCreateMovement.mockReset();
    mockedCreateMovement.mockResolvedValue(makeMovement());
  });

  it('IN: envia tipo, quantidade e observação corretos', async () => {
    const user = await openModal();

    await fillAndSubmit(user, { type: 'IN', quantity: '7', note: 'Reposição de fornecedor' });

    await waitFor(() => expect(mockedCreateMovement).toHaveBeenCalledTimes(1));
    const [productId, payload] = mockedCreateMovement.mock.calls[0];
    expect(productId).toBe('p1');
    expect(payload.type).toBe('IN');
    expect(payload.quantity).toBe(7);
    expect(payload.note).toBe('Reposição de fornecedor');
  });

  it('OUT: envia tipo, quantidade e observação corretos', async () => {
    const user = await openModal();

    await fillAndSubmit(user, { type: 'OUT', quantity: '2', note: 'Quebra em manuseio' });

    await waitFor(() => expect(mockedCreateMovement).toHaveBeenCalledTimes(1));
    const [productId, payload] = mockedCreateMovement.mock.calls[0];
    expect(productId).toBe('p1');
    expect(payload.type).toBe('OUT');
    expect(payload.quantity).toBe(2);
    expect(payload.note).toBe('Quebra em manuseio');
  });
});

describe('MovementFormModal — falha do servidor (MFM-2, MFM-3)', () => {
  beforeEach(() => {
    mockedCreateMovement.mockReset();
  });

  it('MFM-2 · mantém o diálogo aberto com os valores digitados e permite tentar de novo', async () => {
    mockedCreateMovement.mockRejectedValueOnce(new ApiRequestError(422, 'Estoque insuficiente.'));
    const user = await openModal();

    await fillAndSubmit(user, { type: 'OUT', quantity: '9', note: 'Baixa manual' });

    await waitFor(() => expect(mockedCreateMovement).toHaveBeenCalledTimes(1));

    // Diálogo continua aberto e os valores digitados sobrevivem à falha.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(quantityField()).toHaveValue(9);
    expect(noteField()).toHaveValue('Baixa manual');
    expect(intentRadio('OUT')).toBeChecked();

    // Tentar de novo: a mesma submissão, desta vez aceita pela API.
    mockedCreateMovement.mockResolvedValueOnce(makeMovement({ type: 'OUT', quantity: 9 }));
    await user.click(submitButton());

    await waitFor(() => expect(mockedCreateMovement).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('MFM-3 · a mensagem de erro do servidor chega ao usuário', async () => {
    mockedCreateMovement.mockRejectedValue(new ApiRequestError(422, 'Estoque insuficiente.'));
    const user = await openModal();

    await fillAndSubmit(user, { type: 'OUT', quantity: '9' });

    await waitFor(() => expect(screen.getAllByText('Estoque insuficiente.').length).toBeGreaterThan(0));
    // A mensagem aparece associada a um alerta (bloco do formulário e/ou toast).
    expect(screen.getAllByRole('alert').some((el) => el.textContent === 'Estoque insuficiente.')).toBe(true);
  });
});

describe('MovementFormModal — submissão duplicada (MFM-4)', () => {
  beforeEach(() => {
    mockedCreateMovement.mockReset();
  });

  it('durante o envio, uma segunda tentativa de submissão não dispara uma segunda movimentação', async () => {
    let resolveCall: (value: Movement) => void = () => {};
    mockedCreateMovement.mockImplementation(
      () => new Promise<Movement>((resolve) => { resolveCall = resolve; }),
    );

    const user = await openModal();
    // Task 17: a intenção precisa ser declarada antes de existir submissão.
    await user.click(intentRadio('IN'));
    await user.clear(quantityField());
    await user.type(quantityField(), '4');
    await user.click(submitButton());

    await waitFor(() => expect(mockedCreateMovement).toHaveBeenCalledTimes(1));

    // Task 5 (design-system.md §11.2): durante o envio o botão fica
    // `aria-disabled` — não `disabled` nativo — e continua focável; a
    // proteção contra segunda submissão vem do guard do próprio `Button`,
    // não da remoção de foco. Uma segunda tentativa de clique nele não deve
    // gerar uma segunda chamada à API.
    const submit = submitButton();
    expect(submit).not.toBeDisabled();
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(submit);

    expect(mockedCreateMovement).toHaveBeenCalledTimes(1);

    resolveCall(makeMovement({ quantity: 4 }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('MovementFormModal — sucesso (MFM-5)', () => {
  beforeEach(() => {
    mockedCreateMovement.mockReset();
    mockedCreateMovement.mockResolvedValue(makeMovement());
  });

  it('fecha o diálogo, dispara onSuccess e anuncia o resultado', async () => {
    const user = await openModal();

    await fillAndSubmit(user, { type: 'IN', quantity: '5' });

    await waitFor(() => expect(mockedCreateMovement).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('success-count')).toHaveTextContent('1'));
    // Task 17: o anúncio continua existindo — mas passou a declarar direção e
    // quantidade (e o novo saldo, quando o backend o devolve) em vez da frase
    // genérica "Movimentação lançada com sucesso.". O contrato de MFM-5 é
    // "anuncia o resultado", não o texto exato.
    await waitFor(() => expect(screen.getAllByRole('status').length).toBeGreaterThan(0));
    expect(screen.getAllByRole('status').some((el) => /Entrada de 5 un\./i.test(el.textContent ?? ''))).toBe(
      true,
    );
  });
});

describe('MovementFormModal — o diálogo se anuncia como tal e devolve o foco (MFM-6)', () => {
  beforeEach(() => {
    mockedCreateMovement.mockReset();
  });

  it('expõe role=dialog rotulado, e o foco retorna ao gatilho ao cancelar', async () => {
    const user = await openModal();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Movimentar Estoque');

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Movimentar' })).toHaveFocus());
  });

  it('após sucesso, o foco também retorna ao gatilho', async () => {
    mockedCreateMovement.mockResolvedValue(makeMovement());
    const user = await openModal();

    await fillAndSubmit(user, { type: 'IN', quantity: '5' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Movimentar' })).toHaveFocus());
  });
});
