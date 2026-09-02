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

/**
 * F-01 — Task 21: impedir baixa rápida maior que o saldo disponível.
 *
 * Simétrica à Task 18 (D-F), que aplica a mesma regra à saída manual: duas
 * saídas do mesmo sistema não podem ter regras diferentes sobre a mesma
 * quantidade. A UI **previne**; o backend **decide** — a regra de saldo
 * continua no `StockService`, dentro da transação com lock de linha.
 */

const overBalance = () => String(product.currentBalance + 1);

async function setQuantity(user: ReturnType<typeof userEvent.setup>, value: string) {
  const field = screen.getByLabelText(/Quantidade/i);
  await user.clear(field);
  await user.type(field, value);
}

describe('QuickOutModal — quantidade acima do saldo é impedida (F-01)', () => {
  beforeEach(() => {
    mockedQuickOutProduct.mockReset();
    mockedQuickOutProduct.mockResolvedValue({} as never);
  });

  it('(a) com quantidade > saldo, a confirmação fica indisponível e a API não é chamada', async () => {
    const user = userEvent.setup();
    renderModal();

    await setQuantity(user, overBalance());

    const confirm = screen.getByRole('button', { name: /Confirmar Baixa/i });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');

    // Acionar mesmo assim não pode gravar: quem impede é o schema, não o
    // atributo — o atributo só ANUNCIA. Uma baixa indevida é permanente.
    await user.click(confirm);
    expect(mockedQuickOutProduct).not.toHaveBeenCalled();
  });

  it('(b) a razão do impedimento é comunicada e associada ao campo', async () => {
    const user = userEvent.setup();
    renderModal();

    await setQuantity(user, overBalance());

    const field = screen.getByLabelText(/Quantidade/i);
    expect(field).toHaveAttribute('aria-invalid', 'true');

    // A explicação chega no momento do impedimento — sem precisar submeter — e
    // nomeia o saldo disponível, nunca só "não pode".
    const describedBy = field.getAttribute('aria-describedby');
    const explanation = describedBy!
      .split(' ')
      .map((id) => document.getElementById(id))
      .find((node) => /acima do saldo/i.test(node?.textContent ?? ''));

    expect(explanation).toBeTruthy();
    expect(explanation).toHaveTextContent(`${product.currentBalance} un.`);
  });

  it('(c) com quantidade = saldo, a confirmação continua disponível e o preview mostra zero', async () => {
    const user = userEvent.setup();
    renderModal();

    await setQuantity(user, String(product.currentBalance));

    const confirm = screen.getByRole('button', { name: /Confirmar Baixa/i });
    expect(confirm).not.toHaveAttribute('aria-disabled', 'true');
    expect(confirm).toBeEnabled();

    // Saída IGUAL ao saldo não é impedimento: resulta em zero, que é legítimo —
    // e "Estoque zerado" continua sendo o rótulo certo para ESSE caso.
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/Estoque zerado/i)).toBeInTheDocument();

    await user.click(confirm);
    await waitFor(() =>
      expect(mockedQuickOutProduct).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: product.currentBalance }),
      ),
    );
  });

  it('(d) nenhum caminho da UI representa saldo negativo nem o rotula "Estoque zerado"', async () => {
    const user = userEvent.setup();
    renderModal();

    await setQuantity(user, '999');

    // Escopo: a célula "Novo Saldo" — é ela que projeta o futuro do saldo, e é
    // o único lugar onde um número negativo poderia aparecer. O diálogo inteiro
    // não serve como alvo porque o SKU ("CAN-001") contém hífen seguido de
    // dígito.
    const projecao = screen.getByRole('dialog').querySelector('[aria-live="polite"]')!;
    expect(projecao).toHaveTextContent(/Novo Saldo/i);

    // Nem o sinal tipográfico (−, U+2212) nem o hífen-menos podem preceder um
    // número na projeção: o impossível é bloqueio, não destino.
    expect(projecao.textContent).not.toMatch(/[−-]\s*\d/);
    // E o impossível não pode ser representado APENAS como "Estoque zerado",
    // que é o vício que F-01 corrige.
    expect(screen.queryByText(/Estoque zerado/i)).toBeNull();
    expect(mockedQuickOutProduct).not.toHaveBeenCalled();
  });

  it('corrigir a quantidade reabilita a confirmação sem perder a observação', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/Observação/i), 'Requisição setor B');
    await setQuantity(user, overBalance());
    expect(screen.getByRole('button', { name: /Confirmar Baixa/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await setQuantity(user, '2');

    expect(screen.getByRole('button', { name: /Confirmar Baixa/i })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByLabelText(/Observação/i)).toHaveValue('Requisição setor B');
  });

  it('a projeção anunciada nomeia o teto, não só "insuficiente"', async () => {
    // Achado do accessibility-reviewer (F1). Quando o impedimento ocorre o foco
    // JÁ está no campo — e uma troca de `aria-describedby` não é reanunciada
    // com o foco parado. Se o saldo só existisse na mensagem do campo, quem usa
    // leitor de tela ouviria "Saldo insuficiente" sem nunca saber o teto.
    const user = userEvent.setup();
    renderModal();

    await setQuantity(user, overBalance());

    const projecao = screen.getByRole('dialog').querySelector('[aria-live="polite"]')!;
    expect(projecao).toHaveTextContent(new RegExp(`${product.currentBalance} un\\.`));
  });

  it('não emite aria-disabled="false" junto do disabled nativo', async () => {
    // Achado do accessibility-reviewer (F4): os dois no mesmo elemento se
    // contradizem. `quantidade <= 0` usa o `disabled` nativo (QOM-8); o
    // atributo ARIA não pode aparecer ao lado dele nem para dizer "false".
    const user = userEvent.setup();
    renderModal();

    await setQuantity(user, '0');

    const confirm = screen.getByRole('button', { name: /Confirmar Baixa/i });
    expect(confirm).toBeDisabled();
    expect(confirm).not.toHaveAttribute('aria-disabled');
  });

  it('impedido, a descrição do campo não repete o mesmo fato duas vezes', async () => {
    // Achado do accessibility-reviewer (F7): encadear o preview junto da
    // mensagem fazia o bloqueio ser lido em duas redações a cada re-foco.
    const user = userEvent.setup();
    renderModal();

    await setQuantity(user, overBalance());

    const ids = screen.getByLabelText(/Quantidade/i).getAttribute('aria-describedby')!.split(' ');
    expect(ids).toHaveLength(1);
    expect(document.getElementById(ids[0])).toHaveTextContent(/acima do saldo/i);
  });

  it('o teto do campo é o saldo disponível, não o dobro dele', async () => {
    renderModal();

    // `max` governa a seta do `number` e o `aria-valuemax` anunciado pelo
    // spinbutton — anunciar o dobro do saldo era declarar um teto que o
    // domínio recusa.
    expect(screen.getByLabelText(/Quantidade/i)).toHaveAttribute(
      'max',
      String(product.currentBalance),
    );
  });
});

describe('QuickOutModal — o backend continua sendo a autoridade (saldo stale)', () => {
  beforeEach(() => {
    mockedQuickOutProduct.mockReset();
  });

  it('quantidade válida no cliente que o backend recusa com 422 preserva o diálogo e os valores', async () => {
    // Outra pessoa deu baixa enquanto este diálogo estava aberto: a validação
    // de cliente estava satisfeita e ainda assim a operação é impossível.
    mockedQuickOutProduct.mockRejectedValue(new ApiRequestError(422, 'Estoque insuficiente.'));
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    await setQuantity(user, '2');
    await user.click(screen.getByRole('button', { name: /Confirmar Baixa/i }));

    await waitFor(() =>
      expect(screen.getAllByText('Estoque insuficiente.').length).toBeGreaterThan(0),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText(/Quantidade/i)).toHaveValue(2);
  });
});
