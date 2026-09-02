import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchProducts } from '../src/api/products';
import QuickOutListModal from '../src/components/QuickOutListModal';

import { makeProduct, paged } from './helpers/factories';
import { renderWithProviders } from './helpers/render';

vi.mock('../src/api/products', () => ({ fetchProducts: vi.fn() }));

const mockedFetchProducts = vi.mocked(fetchProducts);

/**
 * Characterization tests do `QuickOutListModal` (`characterization-plan.md` §3).
 *
 * Contrato de `user-flows.md` §9.3, itens 11–17. Cobertura anterior: zero.
 *
 * `fetchProducts(search, page, pageSize, sortBy, sortDir)` é posicional; os
 * testes afirmam os argumentos da chamada porque é a **consulta** que precisa
 * sobreviver à migração, não o formato da tabela.
 *
 * NÃO congelado neste arquivo (§12) — nenhuma asserção exige que sobrevivam:
 *   · `Escape` não fechar (ALTERAR INTENCIONALMENTE — passará a fechar);
 *   · a linha não ser alcançável por teclado (`<tr onClick>` sem role/tabIndex);
 *   · a tabela clipada sem rolagem no mobile (UF-29) e o `colSpan={4}` numa
 *     tabela de 5 colunas (N-2);
 *   · `return null` antes de 8 hooks (A-12) e o `fetch` manual sem
 *     cancelamento (F-02);
 *   · a falha de consulta silenciosa, que vira "Nenhum produto disponível."
 *     (N-6) — por isso nenhum teste afirma que um erro de API produz o estado
 *     vazio;
 *   · o duplo badge contraditório quando `balance=0` e `minStock=0` (N-5): a
 *     regra correta está fixada em `productStatus.test.ts` (PS-1);
 *   · a busca com `placeholder` e sem `<label>` (B-7) — daí o acesso por
 *     `role="searchbox"`;
 *   · a página fixa em 10 itens, que é configuração interna sem decisão de
 *     produto (NÃO RELEVANTE).
 */

const rows = [
  makeProduct({ id: 'p1', name: 'Caneta Azul', sku: 'CAN-001', balance: 20, minStock: 5 }),
  makeProduct({ id: 'p2', name: 'Borracha Branca', sku: 'BOR-002', balance: 2, minStock: 8 }),
];

/**
 * Harness com os providers reais (achado DEP-02, Task 22).
 *
 * Trocado ANTES da migração do componente, com o produto ainda inalterado: no
 * instante em que `QuickOutListModal` passa a usar `useQuery`, um `render` puro
 * — sem `QueryClientProvider` — derruba os 14 testes em bloco, e a quebra
 * pareceria da migração quando na verdade é do harness.
 */
function renderList(overrides: { onOpenHistory?: () => void } = {}) {
  const onOpenChange = vi.fn();
  const onPick = vi.fn();
  const onOpenHistory = overrides.onOpenHistory ?? vi.fn();
  renderWithProviders(
    <QuickOutListModal open onOpenChange={onOpenChange} onPick={onPick} onOpenHistory={onOpenHistory} />,
  );
  return { onOpenChange, onPick, onOpenHistory, user: userEvent.setup() };
}

/** A busca não tem `<label>` (B-7); `searchbox` é o acesso estável por papel. */
const searchField = () => screen.getByRole('searchbox');

/** Argumentos posicionais da última consulta: [search, page, pageSize, sortBy, sortDir]. */
function lastQuery() {
  const calls = mockedFetchProducts.mock.calls;
  return calls[calls.length - 1];
}

beforeEach(() => {
  mockedFetchProducts.mockReset();
  mockedFetchProducts.mockResolvedValue(paged(rows, { total: rows.length }));
});

describe('QuickOutListModal — localizar um produto (QOL-1, QOL-2)', () => {
  it('QOL-1 · o campo de busca recebe o foco ao abrir', async () => {
    renderList();

    // Afirma que *a busca tem foco* — não que ela tenha o atributo `autoFocus`.
    // O primitivo de diálogo usará outro mecanismo para o mesmo efeito.
    await waitFor(() => expect(searchField()).toHaveFocus());
  });

  it('QOL-2 · digitar na busca refaz a consulta com o termo', async () => {
    const { user } = renderList();
    await screen.findByText('Caneta Azul');

    await user.type(searchField(), 'caneta');

    await waitFor(() => expect(lastQuery()?.[0]).toBe('caneta'));
  });
});

describe('QuickOutListModal — escolher um produto (QOL-3)', () => {
  it('QOL-3 · acionar a linha do produto o seleciona', async () => {
    const { onPick, user } = renderList();

    // O alvo é a linha inteira, deliberadamente grande. A migração não pode
    // reduzi-lo a um botão pequeno dentro dela.
    await user.click(await screen.findByText('Caneta Azul'));

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', name: 'Caneta Azul' }));
  });

  it('QOL-3 · acionar outra linha seleciona o produto correspondente', async () => {
    const { onPick, user } = renderList();

    await user.click(await screen.findByText('BOR-002'));

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' }));
  });
});

describe('QuickOutListModal — ordenação (QOL-4, QOL-5)', () => {
  it('QOL-4 · ordenar pela mesma coluna alterna a direção na consulta', async () => {
    const { user } = renderList();
    await screen.findByText('Caneta Azul');

    await user.click(screen.getByRole('button', { name: /Nome do Produto/i }));
    await waitFor(() => expect(lastQuery()?.[4]).toBe('desc'));

    await user.click(screen.getByRole('button', { name: /Nome do Produto/i }));
    await waitFor(() => expect(lastQuery()?.[4]).toBe('asc'));
  });

  it('QOL-4 · ordenar por SKU e por Saldo troca o critério enviado à API', async () => {
    const { user } = renderList();
    await screen.findByText('Caneta Azul');

    await user.click(screen.getByRole('button', { name: /^SKU/i }));
    await waitFor(() => expect(lastQuery()?.[3]).toBe('sku'));

    await user.click(screen.getByRole('button', { name: /^Saldo/i }));
    await waitFor(() => expect(lastQuery()?.[3]).toBe('balance'));
  });

  it('QOL-5 · ordenar volta para a primeira página', async () => {
    mockedFetchProducts.mockResolvedValue(paged(rows, { total: 25 }));
    const { user } = renderList();
    await screen.findByText('Caneta Azul');

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(lastQuery()?.[1]).toBe(2));

    // Sem isto a pessoa ordena e cai numa página vazia.
    await user.click(screen.getByRole('button', { name: /^SKU/i }));
    await waitFor(() => expect(lastQuery()?.[1]).toBe(1));
  });
});

describe('QuickOutListModal — o que cada produto expõe (QOL-6, QOL-7)', () => {
  it('QOL-6 · cada produto mostra nome, SKU, saldo, estoque mínimo e status', async () => {
    mockedFetchProducts.mockResolvedValue(
      paged([makeProduct({ id: 'p1', name: 'Caneta Azul', sku: 'CAN-001', balance: 20, minStock: 5 })], {
        total: 1,
      }),
    );
    renderList();

    // Esta é hoje a **única** tela que mostra saldo e mínimo juntos (C-6).
    // Os cinco dados são o contrato; a ordem das colunas não é.
    const row = await screen.findByRole('row', { name: /Caneta Azul/ });
    expect(within(row).getByText('Caneta Azul')).toBeInTheDocument();
    expect(within(row).getByText('CAN-001')).toBeInTheDocument();
    expect(within(row).getByText('20')).toBeInTheDocument();
    expect(within(row).getByText('5')).toBeInTheDocument();
    expect(within(row).getByText('Em Estoque')).toBeInTheDocument();
  });

  it('QOL-7 · o contador de itens reflete o total informado pela API', async () => {
    mockedFetchProducts.mockResolvedValue(paged(rows, { total: 42 }));
    renderList();

    expect(await screen.findByText(/42 item\(ns\)/i)).toBeInTheDocument();
  });
});

describe('QuickOutListModal — navegação entre páginas (QOL-8)', () => {
  it('QOL-8 · "Próxima" e "Anterior" pedem a página certa à API', async () => {
    mockedFetchProducts.mockResolvedValue(paged(rows, { total: 25 }));
    const { user } = renderList();
    await screen.findByText('Caneta Azul');

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(lastQuery()?.[1]).toBe(2));

    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    await waitFor(() => expect(lastQuery()?.[1]).toBe(1));
  });

  it('QOL-8 · a navegação é bloqueada nos limites do resultado', async () => {
    mockedFetchProducts.mockResolvedValue(paged(rows, { total: 15 }));
    const { user } = renderList();
    await screen.findByText('Caneta Azul');

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Próxima' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
  });
});

describe('QuickOutListModal — saídas do diálogo (QOL-9, QOL-10)', () => {
  /**
   * QOL-9 protege a **capacidade** de chegar ao histórico a partir da lista.
   *
   * A *forma* fica em aberto: hoje "sem fechar a lista" são dois `createPortal`
   * irmãos, mas depois da migração o mesmo comportamento produziria dois
   * `aria-modal` e dois focus traps concorrentes. Se a Fase 8 adotar navegação
   * pai→filho, este teste muda junto — e a mudança precisa ser declarada
   * (§3, ressalva A-7).
   */
  it('QOL-9 · "Histórico de Baixas" abre o histórico sem fechar a lista', async () => {
    const { onOpenChange, onOpenHistory, user } = renderList();

    await user.click(screen.getByRole('button', { name: 'Histórico de Baixas' }));

    expect(onOpenHistory).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('QOL-10 · o controle explícito "Fechar" fecha o diálogo', async () => {
    const { onOpenChange, user } = renderList();

    // Backdrop não substitui o controle explícito: é o único caminho de saída
    // que funciona por teclado hoje.
    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('QOL-10 · interagir dentro do diálogo não o fecha', async () => {
    const { onOpenChange, user } = renderList();

    await user.click(await screen.findByText('Selecionar Produto para Baixa'));
    await user.click(searchField());

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

/**
 * Requisitos da Task 22 — o que a migração **corrige**.
 *
 * Os casos acima congelam o que precisa sobreviver; estes descrevem o que
 * precisa mudar. Nenhum deles passava antes da migração: o componente não era
 * um diálogo (C-1), a linha só existia para o mouse, a falha de consulta virava
 * "Nenhum produto disponível." (N-6), o status era recalculado à mão e
 * divergia no limite `balance=0, minStock=0` (N-5) e a busca não tinha rótulo
 * (B-7).
 */
describe('QuickOutListModal — requisitos da migração (Task 22)', () => {
  it('se anuncia como diálogo modal rotulado pelo título (C-1)', async () => {
    renderList();

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Selecionar Produto para Baixa');
  });

  it('Escape fecha o diálogo (ALTERAR INTENCIONALMENTE — §9.3 item 12)', async () => {
    const { onOpenChange, user } = renderList();
    await screen.findByText('Caneta Azul');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('a linha do produto é acionável por teclado, sem perder o alvo grande do clique', async () => {
    const { onPick, user } = renderList();

    const row = await screen.findByRole('row', { name: /Caneta Azul/ });
    // O alvo do mouse continua sendo a linha inteira (QOL-3); o que falta hoje
    // é um controle real dentro dela para quem navega por teclado.
    const trigger = within(row).queryByRole('button', { name: /Caneta Azul/i });
    expect(trigger, 'a linha precisa expor um controle operável por teclado').not.toBeNull();

    trigger!.focus();
    expect(trigger).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
  });

  it('falha de consulta é comunicada e não se confunde com lista vazia (N-6)', async () => {
    mockedFetchProducts.mockRejectedValue(new Error('Falha ao carregar produtos'));
    renderList();

    // A mensagem da API aparece; o texto de vazio **não** — os dois estados
    // dizem coisas diferentes sobre o que fazer a seguir.
    expect(await screen.findByText('Falha ao carregar produtos')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum produto disponível.')).not.toBeInTheDocument();
  });

  it('no erro, o contador não afirma "0 item(ns)" (N-6, achado do accessibility-reviewer)', async () => {
    mockedFetchProducts.mockRejectedValue(new Error('Falha ao carregar produtos'));
    renderList();
    await screen.findByText('Falha ao carregar produtos');

    // O texto secundário não pode desdizer a célula principal: "0 item(ns)" é
    // a leitura "não há nada aqui" que N-6 tirou da tabela, reaparecendo ao
    // lado da busca. Quando a consulta falhou, o total é desconhecido.
    expect(screen.queryByText(/0 item\(ns\)/i)).not.toBeInTheDocument();
  });

  it('a direção da ordenação é anunciada pelo aria-sort da coluna ativa (M-5)', async () => {
    const { user } = renderList();
    await screen.findByText('Caneta Azul');

    // A seta `▲` é `aria-hidden`; sem `aria-sort` o estado de ordenação teria
    // deixado de existir para o leitor de tela em vez de melhorar.
    const nameHeader = screen.getByRole('columnheader', { name: /Nome do Produto/i });
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    // Só a coluna ativa anuncia (A-8ʳ, mesma decisão de `ui/DataTable`).
    expect(screen.getByRole('columnheader', { name: /^SKU/i })).not.toHaveAttribute('aria-sort');

    await user.click(screen.getByRole('button', { name: /Nome do Produto/i }));

    await waitFor(() => expect(nameHeader).toHaveAttribute('aria-sort', 'descending'));
  });

  it('as live regions são o mesmo nó entre carregando, sucesso e erro', async () => {
    const status = () => screen.getByTestId('quick-out-list-status');
    const alert = () => screen.getByTestId('quick-out-list-alert');

    // Uma região criada junto com o conteúdo costuma não ser anunciada: as duas
    // precisam estar sempre montadas e só trocar de texto.
    const { user } = renderList();
    const firstStatus = status();
    const firstAlert = alert();

    await waitFor(() => expect(status()).toHaveTextContent(/produtos encontrados/i));
    expect(status()).toBe(firstStatus);
    expect(alert()).toBe(firstAlert);

    // Buscar de novo com a API falhando: consulta nova, mesmas regiões.
    mockedFetchProducts.mockRejectedValue(new Error('Falha ao carregar produtos'));
    await user.type(searchField(), 'x');

    await waitFor(() => expect(alert()).toHaveTextContent(/Falha ao carregar produtos/));
    expect(status()).toBe(firstStatus);
    expect(alert()).toBe(firstAlert);
  });

  it('o resultado vazio continua distinto do erro', async () => {
    mockedFetchProducts.mockResolvedValue(paged([], { total: 0 }));
    renderList();

    expect(await screen.findByText('Nenhum produto disponível.')).toBeInTheDocument();
  });

  it('no limite saldo 0 com mínimo 0 a linha mostra um único status (N-5, PS-1)', async () => {
    mockedFetchProducts.mockResolvedValue(
      paged([makeProduct({ id: 'p9', name: 'Grampeador', sku: 'GRA-009', balance: 0, minStock: 0 })], {
        total: 1,
      }),
    );
    renderList();

    const row = await screen.findByRole('row', { name: /Grampeador/ });
    expect(within(row).getByText('Fora de Estoque')).toBeInTheDocument();
    // Hoje `isOut` e `isOk` são ambos verdadeiros e a linha renderiza dois
    // badges contraditórios. A regra canônica prioriza OUT (PS-1).
    expect(within(row).queryByText('Em Estoque')).not.toBeInTheDocument();
  });

  it('a busca tem rótulo associado, não só placeholder (B-7)', async () => {
    renderList();

    expect(screen.getByLabelText(/Buscar por Nome ou SKU/i)).toBe(searchField());
  });
});
