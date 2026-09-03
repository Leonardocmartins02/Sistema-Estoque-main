import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdjustment } from '../src/api/adjustments';
import { ApiRequestError } from '../src/api/httpClient';
import { fetchProduct } from '../src/api/products';
import type { Movement } from '../src/api/types';
import { AdjustmentFormModal } from '../src/components/AdjustmentFormModal';
import { ToastProvider } from '../src/components/ui/ToastProvider';

vi.mock('../src/api/adjustments', () => ({ createAdjustment: vi.fn() }));
vi.mock('../src/api/products', () => ({ fetchProduct: vi.fn() }));

const mockedCreateAdjustment = vi.mocked(createAdjustment);
const mockedFetchProduct = vi.mocked(fetchProduct);

const product = {
  id: 'p1',
  name: 'Borracha Branca',
  sku: 'BORRACHA-012',
  balance: 20,
  minStock: 0,
  createdAt: '2027-01-01T00:00:00.000Z',
  updatedAt: '2027-01-01T00:00:00.000Z',
};

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
    mockedFetchProduct.mockReset();
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

  it('torna o botão de confirmação inerte e mostra indicador de carregamento enquanto a mutação está pendente', async () => {
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

    // O mecanismo de "inerte" é aria-disabled, não disabled: desabilitar o
    // botão focado perderia o foco para o <body> (ver A3 em "correções
    // pós-review" mais abaixo). A proteção contra envio duplo vive no handler.
    await waitFor(() => expect(confirmButton).toHaveAttribute('aria-disabled', 'true'));
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

describe('AdjustmentFormModal — conflito de concorrência (Task 5)', () => {
  beforeEach(() => {
    mockedCreateAdjustment.mockReset();
    mockedFetchProduct.mockReset();
  });

  it('409: mostra estado de conflito com o saldo visto e o saldo real, sem fechar o modal nem chamar onSuccess', async () => {
    const user = userEvent.setup();
    mockedCreateAdjustment.mockRejectedValueOnce(
      new ApiRequestError(409, 'O saldo deste produto mudou desde que você o visualizou.'),
    );
    mockedFetchProduct.mockResolvedValueOnce({ ...product, balance: 15 });
    const { onOpenChange, onSuccess } = renderModal();

    await fillValidFormAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));

    // Saldo que o usuário via (20, o balance inicial) e o saldo real (15).
    expect(await screen.findByText('20')).toBeInTheDocument();
    expect(await screen.findByText('15')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('não reenvia a mutação automaticamente após o conflito', async () => {
    const user = userEvent.setup();
    mockedCreateAdjustment.mockRejectedValueOnce(new ApiRequestError(409, 'Conflito.'));
    mockedFetchProduct.mockResolvedValueOnce({ ...product, balance: 15 });
    renderModal();

    await fillValidFormAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));
    await screen.findByRole('button', { name: 'Revisar' });

    expect(mockedCreateAdjustment).toHaveBeenCalledTimes(1);
  });

  it('erro genérico (não 409) não vira estado de conflito', async () => {
    const user = userEvent.setup();
    mockedCreateAdjustment.mockRejectedValueOnce(new ApiRequestError(500, 'Erro interno do servidor.'));
    renderModal();

    await fillValidFormAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));

    expect(await screen.findByText('Erro interno do servidor.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revisar' })).not.toBeInTheDocument();
    expect(mockedFetchProduct).not.toHaveBeenCalled();
  });

  it('"Revisar" volta ao formulário com a quantidade vazia e o motivo preservado', async () => {
    const user = userEvent.setup();
    mockedCreateAdjustment.mockRejectedValueOnce(new ApiRequestError(409, 'Conflito.'));
    mockedFetchProduct.mockResolvedValueOnce({ ...product, balance: 15 });
    renderModal();

    await fillValidFormAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));
    await user.click(await screen.findByRole('button', { name: 'Revisar' }));

    expect(await screen.findByLabelText(/Nova quantidade/i)).toHaveValue(null);
    expect(screen.getByLabelText(/Motivo/i)).toHaveValue('Contagem física mensal');
  });

  it('novo envio após "Revisar" usa o saldo real (novo) como expectedPreviousQuantity, não o original', async () => {
    const user = userEvent.setup();
    mockedCreateAdjustment.mockRejectedValueOnce(new ApiRequestError(409, 'Conflito.'));
    mockedFetchProduct.mockResolvedValueOnce({ ...product, balance: 15 });
    mockedCreateAdjustment.mockResolvedValueOnce({
      id: 'm2',
      productId: 'p1',
      type: 'ADJUSTMENT',
      quantity: 3,
      previousQuantity: 15,
      newQuantity: 12,
      note: 'Contagem física mensal',
      date: '2027-05-10T18:31:00.000Z',
      createdAt: '2027-05-10T18:31:00.000Z',
    });
    renderModal();

    await fillValidFormAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));
    await user.click(await screen.findByRole('button', { name: 'Revisar' }));

    await user.type(screen.getByLabelText(/Nova quantidade/i), '12');
    await user.click(screen.getByRole('button', { name: /Ajustar/i }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));

    await waitFor(() => expect(mockedCreateAdjustment).toHaveBeenCalledTimes(2));
    expect(mockedCreateAdjustment).toHaveBeenNthCalledWith(2, 'p1', {
      targetQuantity: 12,
      expectedPreviousQuantity: 15,
      reason: 'Contagem física mensal',
    });
  });
});

/**
 * Correções pós-review (accessibility A2/A3, security #12). Escopo fechado:
 * nenhuma refatoração adjacente, só o comportamento que os reviewers apontaram.
 */
describe('AdjustmentFormModal — correções pós-review', () => {
  beforeEach(() => {
    mockedCreateAdjustment.mockReset();
    mockedFetchProduct.mockReset();
  });

  /**
   * A2 — o conflito é o único caminho de erro do fluxo que não tinha live
   * region. Sem isso, quem usa leitor de tela pode acreditar que ajustou o
   * estoque quando o ajuste foi recusado.
   */
  it('A2: o estado de conflito é anunciado como live region (role="alert")', async () => {
    const user = userEvent.setup();
    mockedCreateAdjustment.mockRejectedValueOnce(new ApiRequestError(409, 'Conflito.'));
    mockedFetchProduct.mockResolvedValueOnce({ ...product, balance: 15 });
    renderModal();

    await fillValidFormAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));
    await screen.findByRole('button', { name: 'Revisar' });

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((el) => /o estoque deste produto mudou/i.test(el.textContent ?? ''))).toBe(true);
  });

  /**
   * A3 — o spinner do Button é aria-hidden e o rótulo não mudava: o envio era
   * silencioso. E `disabled` no botão que está com o foco joga o foco para o
   * body, deixando o rodapé sem controle focável durante a requisição.
   */
  it('A3: durante o envio o botão comunica o estado por texto e mantém o foco', async () => {
    const user = userEvent.setup();
    let resolveCreate: (movement: Movement) => void = () => {};
    mockedCreateAdjustment.mockImplementationOnce(
      () =>
        new Promise<Movement>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    const { onOpenChange } = renderModal();

    await fillValidFormAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));

    const pendingButton = await screen.findByRole('button', { name: /Confirmando/i });
    expect(pendingButton).toHaveFocus();
    expect(pendingButton).not.toBeDisabled();
    expect(pendingButton).toHaveAttribute('aria-disabled', 'true');

    // aria-disabled mantém o foco, então a proteção contra envio duplo tem de
    // vir do handler, não do atributo `disabled`.
    await user.click(pendingButton);
    expect(mockedCreateAdjustment).toHaveBeenCalledTimes(1);

    resolveCreate({
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
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  /**
   * #12 — o fetchQuery que busca o saldo real depois do 409 não tinha
   * try/catch: se ele falhasse, nenhum setStep rodava e o usuário ficava parado
   * na confirmação, sem mensagem nenhuma.
   */
  it('#12: falha ao buscar o saldo atualizado no 409 não fecha o modal, preserva o motivo e mostra o erro', async () => {
    const user = userEvent.setup();
    mockedCreateAdjustment.mockRejectedValueOnce(new ApiRequestError(409, 'Conflito.'));
    mockedFetchProduct.mockRejectedValueOnce(new Error('Falha de rede'));
    const { onOpenChange, onSuccess } = renderModal();

    await fillValidFormAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));

    expect(await screen.findByText(/não foi possível obter o saldo atualizado/i)).toBeInTheDocument();
    // Não finge que a revisão aconteceu: nenhum passo de conflito é exibido.
    expect(screen.queryByRole('button', { name: 'Revisar' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Motivo/i)).toHaveValue('Contagem física mensal');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('#12: depois da falha é possível tentar de novo, e a baseline continua a original', async () => {
    const user = userEvent.setup();
    mockedCreateAdjustment.mockRejectedValueOnce(new ApiRequestError(409, 'Conflito.'));
    mockedFetchProduct.mockRejectedValueOnce(new Error('Falha de rede'));
    mockedCreateAdjustment.mockResolvedValueOnce({
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
    renderModal();

    await fillValidFormAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));
    await screen.findByText(/não foi possível obter o saldo atualizado/i);

    await user.click(screen.getByRole('button', { name: /^Ajustar$/i }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));

    await waitFor(() => expect(mockedCreateAdjustment).toHaveBeenCalledTimes(2));
    expect(mockedCreateAdjustment).toHaveBeenNthCalledWith(2, 'p1', {
      targetQuantity: 18,
      expectedPreviousQuantity: 20,
      reason: 'Contagem física mensal',
    });
  });
});

/**
 * A1/A4 (Task 25, `implementation-plan.md` §9.3.3) — foco programático nas
 * transições de step e identidade da live region do step `form`.
 *
 * RED escrito ANTES do GREEN de `AdjustmentFormModal` (ordem TDD registrada
 * em §9.3.3, passo 4) — o `Modal` já aceita `titleRef` (SD-5, GREEN), mas
 * `AdjustmentFormModal` ainda não o utiliza.
 */
describe('AdjustmentFormModal — A1/A4 (foco programático e live region)', () => {
  beforeEach(() => {
    mockedCreateAdjustment.mockReset();
    mockedFetchProduct.mockReset();
  });

  it('A1: form → confirm — o heading "Ajustar estoque?" recebe foco', async () => {
    const user = userEvent.setup();
    renderModal();

    await fillValidFormAndAdvance(user);

    // Role + nome acessível, nunca seletor CSS: é o mesmo heading que rotula
    // o diálogo (`Dialog.Title` via `ui/Modal`).
    expect(await screen.findByRole('heading', { name: 'Ajustar estoque?' })).toHaveFocus();
  });

  it('A1: confirm → conflict — o heading "O estoque deste produto mudou" recebe foco', async () => {
    const user = userEvent.setup();
    // Reaproveita exatamente o padrão de mock 409 já usado pela suíte de
    // conflito (describe "conflito de concorrência").
    mockedCreateAdjustment.mockRejectedValueOnce(new ApiRequestError(409, 'Conflito.'));
    mockedFetchProduct.mockResolvedValueOnce({ ...product, balance: 15 });
    renderModal();

    await fillValidFormAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));
    await screen.findByRole('button', { name: 'Revisar' }); // marca a chegada ao passo de conflito

    expect(
      await screen.findByRole('heading', { name: 'O estoque deste produto mudou' }),
    ).toHaveFocus();
  });

  it('A1: conflict → form via "Revisar" — o campo "Nova quantidade" recebe foco', async () => {
    const user = userEvent.setup();
    mockedCreateAdjustment.mockRejectedValueOnce(new ApiRequestError(409, 'Conflito.'));
    mockedFetchProduct.mockResolvedValueOnce({ ...product, balance: 15 });
    renderModal();

    await fillValidFormAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));
    await user.click(await screen.findByRole('button', { name: 'Revisar' }));

    expect(await screen.findByLabelText(/Nova quantidade/i)).toHaveFocus();
  });

  /**
   * A4 — interpretação registrada em §9.3.3: "sempre montada" = sempre
   * montada DURANTE o step `form`, independentemente de `hasValidPreview`.
   * Hoje o nó só existe quando `hasValidPreview` é `true`
   * (`{hasValidPreview && <p aria-live="polite">}`), e `setValue('targetQuantity',
   * '')` em `handleReview` zera o valor — o nó é DESMONTADO logo depois de
   * "Revisar", exatamente quando o contrato exige que ele já exista.
   *
   * A busca é escopada ao `role="dialog"` real (`screen.getByRole('dialog')
   * .querySelector('[aria-live="polite"]')`), não à página inteira: `<p
   * aria-live="polite">` não carrega role/nome acessível próprio que
   * discrimine sua identidade, e `ToastProvider` — sempre montado por este
   * harness — expõe um `<div role="status" aria-live="polite">` permanente
   * FORA do diálogo. Escopar ao diálogo isola o nó do `AdjustmentFormModal`
   * sem depender da tag `<p>` nem de nenhum detalhe de implementação além da
   * semântica (é uma live region dentro do diálogo do formulário).
   */
  /**
   * A5 (§14.2 regra 3, precedente de Task 19 — `MovementHistoryModal.test.tsx`,
   * "a seta recebe texto sr-only, pagando a dívida A5"): a transição visual
   * "20 → 18" é `aria-hidden`; quem usa leitor de tela precisa do
   * equivalente textual "de 20 para 18", num nó separado.
   *
   * `getByText` casa pelo texto INTEIRO de um nó — o `<span aria-hidden>`
   * contém literalmente "20 → 18" (nunca a frase "de 20 para 18"), então esta
   * busca só pode ser satisfeita pelo `<span className="sr-only">`. Não é
   * necessário inspecionar `className` para discriminar: a frase em si já é
   * exclusiva do nó acessível, exatamente como no precedente citado.
   */
  it('A5: na confirmação, existe o equivalente textual sr-only da transição de saldo', async () => {
    const user = userEvent.setup();
    renderModal();

    await fillValidFormAndAdvance(user);
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('de 20 para 18')).toBeInTheDocument();
  });

  it('A4: após "Revisar", a live region do step form já existe (mesmo sem preview válido) e é o MESMO nó ao ganhar conteúdo', async () => {
    const user = userEvent.setup();
    mockedCreateAdjustment.mockRejectedValueOnce(new ApiRequestError(409, 'Conflito.'));
    mockedFetchProduct.mockResolvedValueOnce({ ...product, balance: 15 });
    renderModal();

    await fillValidFormAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: 'Confirmar ajuste' }));
    await user.click(await screen.findByRole('button', { name: 'Revisar' }));

    // 1. Volta ao `form`: a quantidade está vazia (`hasValidPreview` falso
    // hoje), mas o nó da live region precisa existir mesmo assim.
    await screen.findByLabelText(/Nova quantidade/i);
    const liveRegionAfterReview = screen.getByRole('dialog').querySelector('[aria-live="polite"]');
    expect(liveRegionAfterReview).not.toBeNull();

    // 2. Sem preview válido ainda, o nó não pode exibir o preview da
    // tentativa anterior (20 → 18) — seria uma leitura obsoleta para quem usa
    // leitor de tela.
    expect(liveRegionAfterReview).not.toHaveTextContent(/20 → 18/);

    // 3-4. Digita uma nova quantidade válida.
    await user.type(screen.getByLabelText(/Nova quantidade/i), '12');

    // 5. Identidade: é o MESMO nó que ganhou conteúdo, não um novo `<p>`
    // remontado quando `hasValidPreview` voltou a ser verdadeiro.
    const liveRegionNow = screen.getByRole('dialog').querySelector('[aria-live="polite"]');
    expect(liveRegionNow).toBe(liveRegionAfterReview);

    // 6. Conteúdo atualizado com o preview correto: saldo real pós-conflito
    // (15, não o saldo original 20) → nova quantidade (12), diferença -3.
    expect(liveRegionNow).toHaveTextContent(/15 → 12/);
    expect(liveRegionNow).toHaveTextContent(/-3/);

    // 7. A5: o mesmo nó também expõe o equivalente textual sr-only — não
    // basta o texto decorativo `aria-hidden` "15 → 12"; `getByText` só casa
    // com a frase completa "de 15 para 12", que só existe no span acessível.
    expect(within(liveRegionNow as HTMLElement).getByText('de 15 para 12')).toBeInTheDocument();
  });
});
