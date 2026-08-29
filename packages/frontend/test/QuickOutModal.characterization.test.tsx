import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../src/api/httpClient';
import { quickOutProduct } from '../src/api/quickOut';
import { QuickOutModal } from '../src/components/QuickOutModal';
import { ToastProvider } from '../src/components/ui/ToastProvider';

vi.mock('../src/api/quickOut', () => ({ quickOutProduct: vi.fn() }));

const mockedQuickOutProduct = vi.mocked(quickOutProduct);

/**
 * Characterization tests do `QuickOutModal` (`characterization-plan.md` §2).
 *
 * O contrato de comportamento vem de `user-flows.md` §9.3, itens 1–10.
 * `QuickOutModal.test.tsx` (existente) cobre o contrato de **erro** da API
 * (F-07 / C-3) e não é duplicado aqui.
 *
 * NÃO congelado neste arquivo (§12) — nenhuma asserção afirma que estes
 * comportamentos devem sobreviver, porque todos são bugs ou mudanças já
 * decididas:
 *   · `max` do input = saldo × 2 e o rótulo "Estoque zerado" (ALTERAR, F-01);
 *   · o ramo "Estoque negativo", que é código morto (N-4: `Math.max(0, …)`);
 *   · a ausência de `role="dialog"`, focus trap, retorno de foco e autofoco (C-1);
 *   · o listener de teclado global no `window`, que intercepta a página inteira (C-1);
 *   · a ausência de `<label>` no campo de quantidade (N-8) — por isso os testes
 *     localizam o campo por `role="spinbutton"`, que é o que existe hoje e o que
 *     continuará existindo depois de o rótulo ser corrigido;
 *   · a ajuda "Máx. 255 caracteres", que não é validada em lugar nenhum (N-1).
 *
 * `Shift+Enter` também não é testado: o listener apenas ignora o atalho, sem
 * cancelar o submit nativo do form, e o jsdom não faz submissão implícita —
 * um teste aqui afirmaria algo verdadeiro só no ambiente de teste (A-3).
 */

const product = { id: 'p1', name: 'Caneta Azul', sku: 'CAN-001', currentBalance: 10 };

function renderModal(overrides: Partial<typeof product> = {}) {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  render(
    <ToastProvider>
      <QuickOutModal
        open
        onOpenChange={onOpenChange}
        product={{ ...product, ...overrides }}
        onSuccess={onSuccess}
      />
    </ToastProvider>,
  );
  return { onOpenChange, onSuccess, user: userEvent.setup() };
}

/** O campo de quantidade não tem `<label>` associado (N-8): `spinbutton` é o acesso estável. */
const quantityField = () => screen.getByRole('spinbutton');
const confirmButton = () => screen.getByRole('button', { name: /Confirmar Baixa|Processando/i });

async function setQuantity(user: ReturnType<typeof userEvent.setup>, value: string) {
  await user.clear(quantityField());
  await user.type(quantityField(), value);
}

beforeEach(() => {
  mockedQuickOutProduct.mockReset();
  mockedQuickOutProduct.mockResolvedValue({} as never);
});

describe('QuickOutModal — saída do diálogo (QOM-1, QOM-12)', () => {
  it('QOM-1 · Escape fecha o diálogo', async () => {
    const { onOpenChange, user } = renderModal();

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('QOM-12 · "Cancelar" fecha sem chamar a API', async () => {
    const { onOpenChange, user } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockedQuickOutProduct).not.toHaveBeenCalled();
  });

  it('QOM-5 · interagir dentro do diálogo não o fecha', async () => {
    const { onOpenChange, user } = renderModal();

    await user.click(screen.getByText('Baixa Rápida de Estoque'));
    await user.click(quantityField());

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('QuickOutModal — Enter como atalho de submissão (QOM-2, QOM-3, QOM-4)', () => {
  it('QOM-2 · Enter num campo de texto submete a baixa uma única vez', async () => {
    const { user } = renderModal();

    await user.click(quantityField());
    await user.keyboard('{Enter}');

    await waitFor(() => expect(mockedQuickOutProduct).toHaveBeenCalledTimes(1));
  });

  it('QOM-3 · Enter dentro do textarea de observação não submete', async () => {
    const { user } = renderModal();

    // Sem isto é impossível escrever uma observação de duas linhas.
    await user.click(screen.getByLabelText(/Observação/i));
    await user.keyboard('{Enter}');

    expect(mockedQuickOutProduct).not.toHaveBeenCalled();
  });

  it('QOM-4 · Enter durante o envio não dispara uma segunda baixa', async () => {
    // Proteção contra baixa duplicada — consequência de dados, não de UI.
    let resolveCall: (value: unknown) => void = () => {};
    mockedQuickOutProduct.mockImplementation(
      () => new Promise((resolve) => { resolveCall = resolve; }) as never,
    );

    const { user } = renderModal();

    await user.click(quantityField());
    await user.keyboard('{Enter}');
    await waitFor(() => expect(mockedQuickOutProduct).toHaveBeenCalledTimes(1));

    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');

    expect(mockedQuickOutProduct).toHaveBeenCalledTimes(1);

    resolveCall({});
    await waitFor(() => expect(confirmButton()).toBeEnabled());
  });
});

describe('QuickOutModal — atalhos de quantidade (QOM-6)', () => {
  it('QOM-6 · acionar um atalho define a quantidade e só ele fica marcado', async () => {
    const { user } = renderModal();

    await user.click(screen.getByRole('button', { name: '25', pressed: false }));

    expect(quantityField()).toHaveValue(25);
    // `aria-pressed` é o que torna o estado audível: sem ele o atalho ativo
    // existe apenas como cor de fundo.
    expect(screen.getByRole('button', { name: '25' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '50' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('QOM-6 · os cinco valores frequentes estão disponíveis', () => {
    renderModal();

    for (const amount of ['1', '5', '10', '25', '50']) {
      expect(screen.getByRole('button', { name: amount })).toBeInTheDocument();
    }
  });
});

describe('QuickOutModal — preview do saldo resultante (QOM-7)', () => {
  it('QOM-7 · o novo saldo é recalculado a cada digitação', async () => {
    const { user } = renderModal({ currentBalance: 10 });

    await setQuantity(user, '3');

    // Saldo atual e novo saldo convivem na tela: 10 continua visível, 7 aparece.
    expect(screen.getByText('7')).toBeInTheDocument();

    await setQuantity(user, '8');

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('7')).not.toBeInTheDocument();
  });
});

describe('QuickOutModal — submissão inválida (QOM-8)', () => {
  it('QOM-8 · a ação primária fica desabilitada com quantidade zero', async () => {
    const { user } = renderModal();

    await setQuantity(user, '0');

    expect(confirmButton()).toBeDisabled();
  });

  it('QOM-8 · a ação primária volta a ficar disponível com quantidade positiva', async () => {
    const { user } = renderModal();

    await setQuantity(user, '0');
    expect(confirmButton()).toBeDisabled();

    await setQuantity(user, '4');
    expect(confirmButton()).toBeEnabled();
  });
});

describe('QuickOutModal — o dado enviado e o resultado (QOM-9, QOM-10)', () => {
  it('QOM-9 · o payload carrega produto, quantidade e observação', async () => {
    const { user } = renderModal({ id: 'p42' });

    await setQuantity(user, '3');
    await user.type(screen.getByLabelText(/Observação/i), 'Requisição setor B');
    await user.click(confirmButton());

    // É o dado. Toast e fechamento não protegem o que foi de fato gravado.
    await waitFor(() =>
      expect(mockedQuickOutProduct).toHaveBeenCalledWith({
        productId: 'p42',
        quantity: 3,
        note: 'Requisição setor B',
      }),
    );
  });

  it('QOM-9 · observação vazia não é enviada como string vazia', async () => {
    const { user } = renderModal();

    await setQuantity(user, '2');
    await user.click(confirmButton());

    await waitFor(() =>
      expect(mockedQuickOutProduct).toHaveBeenCalledWith(expect.objectContaining({ note: undefined })),
    );
  });

  it('QOM-10 · o sucesso fecha o diálogo, dispara onSuccess e anuncia a quantidade', async () => {
    const { onOpenChange, onSuccess, user } = renderModal();

    await setQuantity(user, '3');
    await user.click(confirmButton());

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    // A invalidação da lista depende de `onSuccess`: sem ele a tela mente
    // sobre o saldo até o próximo refetch.
    expect(onSuccess).toHaveBeenCalledTimes(1);
    // Afirma a *quantidade* anunciada, não a frase: o texto do toast ganha o
    // novo saldo na migração (§4.2 do design-direction).
    expect(await screen.findByText(/3 unidade\(s\)/i)).toBeInTheDocument();
  });
});

describe('QuickOutModal — falha de submissão preserva o trabalho (QOM-11)', () => {
  it('QOM-11 · o diálogo continua aberto com os valores digitados e permite tentar de novo', async () => {
    mockedQuickOutProduct.mockRejectedValueOnce(new ApiRequestError(422, 'Estoque insuficiente.'));

    const { onOpenChange, user } = renderModal();

    await setQuantity(user, '7');
    await user.type(screen.getByLabelText(/Observação/i), 'Saída para o setor B');
    await user.click(confirmButton());

    await waitFor(() => expect(screen.getAllByText('Estoque insuficiente.').length).toBeGreaterThan(0));

    // Sem isto, a pessoa redigita quantidade e observação após cada 422.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(quantityField()).toHaveValue(7);
    expect(screen.getByLabelText(/Observação/i)).toHaveValue('Saída para o setor B');

    mockedQuickOutProduct.mockResolvedValue({} as never);
    await user.click(confirmButton());

    await waitFor(() => expect(mockedQuickOutProduct).toHaveBeenCalledTimes(2));
  });
});
