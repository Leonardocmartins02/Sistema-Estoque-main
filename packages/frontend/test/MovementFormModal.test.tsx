import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../src/api/httpClient';
import { createMovement } from '../src/api/movements';
import { MovementFormModal, movementSchema } from '../src/components/MovementFormModal';
import { ToastProvider } from '../src/components/ui/ToastProvider';

vi.mock('../src/api/movements', () => ({ createMovement: vi.fn() }));

const mockedCreateMovement = vi.mocked(createMovement);

const PRODUCT = { id: 'p1', name: 'Caneta Azul', sku: 'CAN-001', balance: 20, minStock: 5 };

function renderModal(onOpenChange = vi.fn(), product = PRODUCT) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MovementFormModal open onOpenChange={onOpenChange} product={product} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** Declara a intenção — passo que passou a ser obrigatório na Task 17. */
async function chooseIntent(user: ReturnType<typeof userEvent.setup>, intent: 'Entrada' | 'Saída') {
  await user.click(await screen.findByRole('radio', { name: intent }));
}

/** O rótulo do primário nomeia a consequência, então não é fixo. */
function submitButton() {
  return screen.getByRole('button', { name: /^Registrar (entrada|saída)/i });
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

    // Task 17: a intenção passou a ser obrigatória antes dos demais campos.
    await chooseIntent(user, 'Entrada');
    const dateInput = await screen.findByLabelText(/Data \(opcional\)/i);
    fireEvent.change(dateInput, { target: { value: '2027-05-10T15:31' } });
    await user.clear(screen.getByLabelText(/Quantidade/i));
    await user.type(screen.getByLabelText(/Quantidade/i), '3');

    await user.click(submitButton());

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

    await chooseIntent(user, 'Entrada');
    await user.clear(await screen.findByLabelText(/Quantidade/i));
    await user.type(screen.getByLabelText(/Quantidade/i), '2');
    await user.click(submitButton());

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
    await chooseIntent(user, 'Entrada');
    const dateInput = await screen.findByLabelText(/Data \(opcional\)/i);
    fireEvent.change(dateInput, { target: { value: 'nao-e-uma-data' } });
    expect((dateInput as HTMLInputElement).value).toBe('');

    await user.click(submitButton());

    await waitFor(() => expect(mockedCreateMovement).toHaveBeenCalledTimes(1));
    expect(mockedCreateMovement.mock.calls[0][1].date).toBeUndefined();
  });
});

/**
 * Task 17 — gramática de operação (D1/D2, UF-20/UF-21).
 *
 * O risco que estes testes travam: uma ENTRADA lançada no lugar de uma SAÍDA.
 * Antes, o `<select>` já vinha em `IN` e bastava um clique distraído.
 */
describe('MovementFormModal — declaração de intenção (D2/P-4)', () => {
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

  it('(a) ao abrir, nenhuma intenção está selecionada', async () => {
    renderModal();

    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(radio).not.toBeChecked();
    }
  });

  it('(b) sem intenção escolhida, a quantidade é inerte e o envio é impossível', async () => {
    const user = userEvent.setup();
    renderModal();

    // Inércia FUNCIONAL, não estética: digitar não deixa valor no campo.
    const quantity = await screen.findByLabelText(/^Quantidade/i);
    await user.type(quantity, '7');
    expect(quantity).toBeDisabled();
    expect((quantity as HTMLInputElement).value).not.toBe('7');

    // E não existe caminho de submissão.
    expect(screen.queryByRole('button', { name: /^Registrar/i })).not.toBeInTheDocument();
    expect(mockedCreateMovement).not.toHaveBeenCalled();
  });

  it('(c) escolhida a intenção, o preview mostra o saldo resultante — entrada', async () => {
    const user = userEvent.setup();
    renderModal();

    await chooseIntent(user, 'Entrada');
    await user.clear(screen.getByLabelText(/^Quantidade/i));
    await user.type(screen.getByLabelText(/^Quantidade/i), '12');

    // 20 + 12 = 32
    expect(await screen.findByTestId('movement-preview')).toHaveTextContent(/20\s*→\s*32/);
    expect(screen.getByTestId('movement-preview')).toHaveTextContent(/\+12/);
  });

  it('(c) escolhida a intenção, o preview mostra o saldo resultante — saída', async () => {
    const user = userEvent.setup();
    renderModal();

    await chooseIntent(user, 'Saída');
    await user.clear(screen.getByLabelText(/^Quantidade/i));
    await user.type(screen.getByLabelText(/^Quantidade/i), '8');

    // 20 − 8 = 12, com o menos tipográfico do helper da Task 2
    expect(await screen.findByTestId('movement-preview')).toHaveTextContent(/20\s*→\s*12/);
    expect(screen.getByTestId('movement-preview')).toHaveTextContent(/−8/);
  });

  it('(c) o preview não apresenta saldo negativo como futuro plausível', async () => {
    const user = userEvent.setup();
    renderModal();

    await chooseIntent(user, 'Saída');
    await user.clear(screen.getByLabelText(/^Quantidade/i));
    await user.type(screen.getByLabelText(/^Quantidade/i), '50');

    // O bloqueio é da Task 18; aqui basta não anunciar −30 como resultado normal.
    const preview = await screen.findByTestId('movement-preview');
    expect(preview).toHaveTextContent(/saldo insuficiente/i);
    expect(preview).not.toHaveTextContent(/→\s*−30/);
  });

  it('(d) o radiogroup tem nome acessível e é operável por teclado', async () => {
    const user = userEvent.setup();
    renderModal();

    const group = await screen.findByRole('radiogroup', { name: /Intenção/i });
    expect(group).toBeInTheDocument();

    const [entrada, saida] = screen.getAllByRole('radio');
    entrada.focus();
    await user.keyboard('{ArrowRight}');
    expect(saida).toBeChecked();
    expect(entrada).not.toBeChecked();
  });

  it('o contexto do produto acionado aparece no diálogo', async () => {
    renderModal();

    expect(await screen.findByText('Caneta Azul')).toBeInTheDocument();
    expect(screen.getByText(/CAN-001/)).toBeInTheDocument();
    expect(screen.getByText(/mín\.\s*5/i)).toBeInTheDocument();
  });

  it('o botão primário nomeia a consequência', async () => {
    const user = userEvent.setup();
    renderModal();

    await chooseIntent(user, 'Entrada');
    await user.clear(screen.getByLabelText(/^Quantidade/i));
    await user.type(screen.getByLabelText(/^Quantidade/i), '12');

    expect(submitButton()).toHaveAccessibleName(/Registrar entrada de 12 un\./i);
  });

  it('o toast de sucesso declara o novo saldo vindo da resposta do backend', async () => {
    const user = userEvent.setup();
    mockedCreateMovement.mockResolvedValue({
      id: 'm1',
      productId: 'p1',
      type: 'IN',
      quantity: 3,
      date: '2027-05-10T18:31:00.000Z',
      note: null,
      createdAt: '2027-05-10T18:31:00.000Z',
      newQuantity: 23,
    });
    renderModal();

    await chooseIntent(user, 'Entrada');
    await user.clear(screen.getByLabelText(/^Quantidade/i));
    await user.type(screen.getByLabelText(/^Quantidade/i), '3');
    await user.click(submitButton());

    // 23 vem do backend, não de 20+3 calculado sobre o snapshot da listagem.
    expect(await screen.findByRole('status')).toHaveTextContent(/23/);
  });

  it('sem saldo na resposta, o toast omite o saldo em vez de inventá-lo', async () => {
    const user = userEvent.setup();
    mockedCreateMovement.mockResolvedValue({
      id: 'm1',
      productId: 'p1',
      type: 'IN',
      quantity: 3,
      date: '2027-05-10T18:31:00.000Z',
      note: null,
      createdAt: '2027-05-10T18:31:00.000Z',
    });
    renderModal();

    await chooseIntent(user, 'Entrada');
    await user.clear(screen.getByLabelText(/^Quantidade/i));
    await user.type(screen.getByLabelText(/^Quantidade/i), '3');
    await user.click(submitButton());

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent(/entrada/i);
    expect(toast).not.toHaveTextContent(/saldo/i);
  });
});

/**
 * Task 18 — impedir saída manual acima do saldo (D-F).
 *
 * A Task 17 já recusa desenhar saldo negativo como futuro plausível, mas
 * **não impedia** o envio: o 422 do backend era a primeira notícia de algo que
 * a interface sabia desde a primeira tecla. Aqui o contrato é outro — a
 * submissão precisa ser **impossível**.
 *
 * A autoridade da regra continua no backend (`stockService.recordMovementInTx`
 * valida `newQuantity < 0` dentro da transação com lock de linha). A UI
 * **previne**; o backend **decide** — por isso o caso de corrida (saldo muda
 * com o formulário aberto) continua sendo tratado como erro do servidor.
 */
describe('MovementFormModal — impedir saída acima do saldo (D-F)', () => {
  beforeEach(() => {
    mockedCreateMovement.mockReset();
    mockedCreateMovement.mockResolvedValue({
      id: 'm1',
      productId: 'p1',
      type: 'OUT',
      quantity: 20,
      date: '2027-05-10T18:31:00.000Z',
      note: null,
      createdAt: '2027-05-10T18:31:00.000Z',
    });
  });

  /** O saldo de PRODUCT é 20 — o teto de uma saída é exatamente esse. */
  async function chooseOutAndType(user: ReturnType<typeof userEvent.setup>, quantity: string) {
    await chooseIntent(user, 'Saída');
    await user.clear(screen.getByLabelText(/^Quantidade/i));
    await user.type(screen.getByLabelText(/^Quantidade/i), quantity);
    return screen.getByLabelText(/^Quantidade/i) as HTMLInputElement;
  }

  it('(1) saldo + 1: a confirmação fica indisponível, a API não é chamada e a mensagem é associada ao campo', async () => {
    const user = userEvent.setup();
    renderModal();

    const quantity = await chooseOutAndType(user, '21');

    // A confirmação existe (a intenção foi declarada) mas está indisponível.
    // `aria-disabled`, não `disabled` (design-system.md §11.2): o botão
    // continua focável e anunciado, para que o bloqueio seja ENCONTRADO em vez
    // de percebido como a ausência de um controle.
    expect(submitButton()).toHaveAttribute('aria-disabled', 'true');

    // O impedimento é anunciado pelo próprio campo — sem depender do botão.
    expect(quantity).toHaveAttribute('aria-invalid', 'true');
    const describedBy = quantity.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const message = describedBy!
      .split(' ')
      .map((id) => document.getElementById(id))
      .find((el) => /saldo/i.test(el?.textContent ?? ''));
    expect(message).toBeTruthy();
    // A mensagem informa qual é o saldo disponível, não só que há impedimento.
    expect(message).toHaveTextContent(/20/);
    // §11.0: erro de campo não leva role="alert" (só o erro assíncrono leva).
    expect(message).not.toHaveAttribute('role', 'alert');

    // ...e o impedimento é ANUNCIADO quando ocorre: trocar `aria-describedby`
    // é silencioso para quem já está com o foco no campo, então a consequência
    // vive numa região polida (mesmo padrão do `AdjustmentFormModal`).
    expect(screen.getByTestId('movement-preview')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('movement-preview')).toHaveTextContent(/saldo insuficiente/i);

    // E a submissão é de fato impossível, não apenas desencorajada.
    await user.click(submitButton());
    expect(mockedCreateMovement).not.toHaveBeenCalled();
  });

  it('(2) IN não é afetado: entrada muito acima do saldo continua submetendo', async () => {
    const user = userEvent.setup();
    renderModal();

    await chooseIntent(user, 'Entrada');
    await user.clear(screen.getByLabelText(/^Quantidade/i));
    await user.type(screen.getByLabelText(/^Quantidade/i), '500');

    expect(submitButton()).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByLabelText(/^Quantidade/i)).toHaveAttribute('aria-invalid', 'false');

    await user.click(submitButton());

    await waitFor(() => expect(mockedCreateMovement).toHaveBeenCalledTimes(1));
    expect(mockedCreateMovement.mock.calls[0][1]).toMatchObject({ type: 'IN', quantity: 500 });
  });

  it('(3) limite inclusivo: saída igual ao saldo é permitida, o preview mostra zero e o envio ocorre', async () => {
    const user = userEvent.setup();
    renderModal();

    const quantity = await chooseOutAndType(user, '20');

    expect(quantity).toHaveAttribute('aria-invalid', 'false');
    expect(submitButton()).not.toHaveAttribute('aria-disabled', 'true');
    // 20 → 0 é um resultado legítimo, não um impedimento.
    expect(screen.getByTestId('movement-preview')).toHaveTextContent(/20\s*→\s*0/);
    expect(screen.getByTestId('movement-preview')).not.toHaveTextContent(/insuficiente/i);

    await user.click(submitButton());

    await waitFor(() => expect(mockedCreateMovement).toHaveBeenCalledTimes(1));
    expect(mockedCreateMovement.mock.calls[0][1]).toMatchObject({ type: 'OUT', quantity: 20 });
  });

  it('(4) saldo muda durante o preenchimento: o 422 real aparece e o valor digitado é preservado', async () => {
    const user = userEvent.setup();
    // Válido no cliente (18 <= 20), recusado pelo backend porque outra pessoa
    // deu baixa enquanto o formulário estava aberto. O backend é a autoridade.
    mockedCreateMovement.mockRejectedValue(
      new ApiRequestError(422, 'Saída maior que o saldo atual do produto.'),
    );
    renderModal();

    await chooseOutAndType(user, '18');
    await user.click(submitButton());

    await waitFor(() => expect(mockedCreateMovement).toHaveBeenCalledTimes(1));

    // A mensagem REAL do backend, nunca um texto genérico do cliente.
    await waitFor(() =>
      expect(
        screen.getAllByRole('alert').some((el) => el.textContent === 'Saída maior que o saldo atual do produto.'),
      ).toBe(true),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Quantidade/i)).toHaveValue(18);
  });

  it('(5) nunca negativo: digitação, colagem e o teto do campo não produzem saldo negativo', async () => {
    const user = userEvent.setup();
    renderModal();

    // Digitação.
    const quantity = await chooseOutAndType(user, '999');
    expect(screen.getByTestId('movement-preview')).not.toHaveTextContent(/→\s*−/);
    expect(submitButton()).toHaveAttribute('aria-disabled', 'true');

    // Colagem — o mesmo impedimento, por outro caminho de entrada.
    await user.clear(quantity);
    await user.click(quantity);
    await user.paste('750');
    expect(quantity).toHaveValue(750);
    expect(screen.getByTestId('movement-preview')).not.toHaveTextContent(/→\s*−/);
    expect(submitButton()).toHaveAttribute('aria-disabled', 'true');

    // Seta do `number`: o campo declara o teto, então o incremento nativo para
    // no saldo em vez de passar dele.
    expect(quantity).toHaveAttribute('max', '20');

    await user.click(submitButton());
    expect(mockedCreateMovement).not.toHaveBeenCalled();
  });

  it('(6) vocabulário: a quantidade impossível não é comunicada apenas como estoque zerado', async () => {
    const user = userEvent.setup();
    renderModal();

    await chooseOutAndType(user, '50');

    // O vício que F-01 corrige na baixa rápida: mostrar 0 e chamar de
    // "Estoque zerado" uma quantidade que é, na verdade, impossível.
    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveTextContent(/estoque zerado/i);
    expect(dialog).toHaveTextContent(/saldo insuficiente/i);
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
