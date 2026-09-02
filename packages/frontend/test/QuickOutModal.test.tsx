import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../src/api/httpClient';
import { quickOutProduct, type QuickOutResponse } from '../src/api/quickOut';
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

describe('QuickOutModal — erro do servidor não é duplicado na tela (C-3)', () => {
  beforeEach(() => {
    mockedQuickOutProduct.mockReset();
  });

  it('renderiza a mensagem de erro uma única vez', async () => {
    mockedQuickOutProduct.mockRejectedValue(new ApiRequestError(422, 'Estoque insuficiente.'));
    renderModal();

    await submit();

    await waitFor(() => expect(screen.getAllByText('Estoque insuficiente.').length).toBeGreaterThan(0));
    // O texto aparece no bloco de erro do formulário; o toast some sozinho e
    // não é contado aqui porque usa role="status" à parte — ver ToastProvider.
    expect(screen.getAllByText('Estoque insuficiente.', { selector: 'h3' })).toHaveLength(1);
  });
});

describe('QuickOutModal — campo de quantidade tem nome acessível (N-8 / Task 6)', () => {
  it('o campo de quantidade é alcançável por getByLabelText', () => {
    renderModal();

    expect(screen.getByLabelText(/Quantidade/i)).toBeInTheDocument();
  });
});

/**
 * Requisitos da Task 20 — migração para o primitivo `Modal` (C-1, A-13, A-14ʳ,
 * REV-14). O que estes testes protegem não é o invólucro escolhido, é o que a
 * pessoa que usa teclado e leitor de tela ganha com ele: saber que está num
 * diálogo, começar no campo que vai preencher, voltar ao lugar de onde saiu e
 * ouvir o saldo que o servidor de fato gravou.
 */

/** Um gatilho real: sem ele não há como afirmar que o foco *volta* para algum lugar. */
function TriggerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <ToastProvider>
      <button type="button" onClick={() => setOpen(true)}>
        abrir baixa
      </button>
      <QuickOutModal open={open} onOpenChange={setOpen} product={product} />
    </ToastProvider>
  );
}

describe('QuickOutModal — o diálogo se anuncia como diálogo (C-1)', () => {
  beforeEach(() => {
    mockedQuickOutProduct.mockReset();
  });

  it('expõe role=dialog modal com nome acessível', async () => {
    renderModal();

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/Baixa Rápida de Estoque/i);
  });
});

describe('QuickOutModal — foco inicial e retorno de foco (REV-14 / C-1)', () => {
  beforeEach(() => {
    mockedQuickOutProduct.mockReset();
  });

  it('ao abrir, o foco vai para o campo de quantidade — não para o "Fechar"', async () => {
    const user = userEvent.setup();
    render(<TriggerHarness />);

    await user.click(screen.getByRole('button', { name: 'abrir baixa' }));

    // "Foco dentro do diálogo" passaria com o foco no botão de fechar, que
    // precede o corpo — e não melhoraria nada para quem vai digitar.
    await waitFor(() => expect(screen.getByLabelText(/Quantidade/i)).toHaveFocus());
  });

  it('ao fechar, o foco volta para o gatilho', async () => {
    const user = userEvent.setup();
    render(<TriggerHarness />);

    const trigger = screen.getByRole('button', { name: 'abrir baixa' });
    await user.click(trigger);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe('QuickOutModal — preview associado e anunciado (A-14ʳ)', () => {
  beforeEach(() => {
    mockedQuickOutProduct.mockReset();
  });

  it('o preview do saldo está associado ao campo de quantidade', async () => {
    renderModal();

    const field = screen.getByLabelText(/Quantidade/i);
    const describedBy = field.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    const preview = describedBy!
      .split(' ')
      .map((id) => document.getElementById(id))
      .find((node) => node && /Saldo Atual/i.test(node.textContent ?? ''));

    expect(preview).toBeTruthy();
    expect(preview).toHaveTextContent(/Novo Saldo/i);
  });

  it('o novo saldo é anunciado com o rótulo que o nomeia, não como número solto', () => {
    renderModal();

    // `aria-live` na célula e `aria-atomic`: sem isso o anúncio é "4 un.",
    // indistinguível do saldo atual, porque só o número muda. Busca dentro do
    // diálogo — o `ToastProvider` mantém live regions próprias, sempre montadas.
    const live = screen.getByRole('dialog').querySelector('[aria-live="polite"]');
    expect(live).toBeTruthy();
    expect(live).toHaveAttribute('aria-atomic', 'true');
    expect(live).toHaveTextContent(/Novo Saldo/i);
    expect(live).not.toHaveTextContent(/Saldo Atual/i);
  });
});

describe('QuickOutModal — os atalhos de quantidade são um grupo nomeado', () => {
  beforeEach(() => {
    mockedQuickOutProduct.mockReset();
  });

  it('a grade de atalhos tem contexto acessível e o campo declara-se obrigatório', () => {
    renderModal();

    const group = screen.getByRole('group', { name: /Valores frequentes/i });
    // Quem chega por Shift+Tab ouve "50, botão alternar" — o grupo é o que
    // diz de que quantidade se trata.
    expect(group).toContainElement(screen.getByRole('button', { name: '50' }));

    expect(screen.getByLabelText(/Quantidade/i)).toBeRequired();
  });
});

describe('QuickOutModal — o sucesso declara o saldo devolvido pela API (§4.2)', () => {
  beforeEach(() => {
    mockedQuickOutProduct.mockReset();
  });

  it('o toast anuncia o novo saldo vindo da resposta, não de cálculo local', async () => {
    // Resposta realista: `newBalance` é a autoridade — o cache da listagem pode
    // estar velho, e o saldo calculado sobre ele seria um número inventado.
    mockedQuickOutProduct.mockResolvedValue({
      success: true,
      movement: {
        id: 'm1',
        productId: 'p1',
        type: 'OUT',
        quantity: 1,
        date: '2026-09-02T12:00:00.000Z',
        note: null,
        createdAt: '2026-09-02T12:00:00.000Z',
      },
      newBalance: 4,
      product: { id: 'p1', name: 'Caneta Azul', sku: 'CAN-001' },
    } satisfies QuickOutResponse);

    renderModal();
    await submit();

    expect(await screen.findByText(/Novo saldo: 4 un\./i)).toBeInTheDocument();
  });

  it('sem `newBalance` na resposta, o toast omite o saldo em vez de inventá-lo', async () => {
    mockedQuickOutProduct.mockResolvedValue({} as never);

    renderModal();
    await submit();

    expect(await screen.findByText(/1 unidade\(s\)/i)).toBeInTheDocument();
    // `Novo Saldo` sem valor é o rótulo do preview e continua legítimo; o que
    // não pode existir é a AFIRMAÇÃO de um saldo que o servidor não devolveu.
    expect(screen.queryByText(/Novo saldo: \d/i)).toBeNull();
  });
});
