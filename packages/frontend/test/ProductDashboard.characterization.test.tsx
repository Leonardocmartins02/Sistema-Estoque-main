import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMovement, fetchMovements } from '../src/api/movements';
import { fetchProduct, fetchProductStockSummary, fetchProducts } from '../src/api/products';
import { fetchQuickOutHistory } from '../src/api/quickOut';
import { ProductDashboard } from '../src/components/ProductDashboard';
import { useProductMutations } from '../src/hooks/useProductMutations';

import { makeProduct, paged } from './helpers/factories';
import { renderWithProviders } from './helpers/render';

vi.mock('../src/api/products', () => ({
  fetchProducts: vi.fn(),
  fetchProduct: vi.fn(),
  fetchProductStockSummary: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));
vi.mock('../src/api/movements', () => ({ fetchMovements: vi.fn(), createMovement: vi.fn() }));
vi.mock('../src/api/quickOut', () => ({ fetchQuickOutHistory: vi.fn(), quickOutProduct: vi.fn() }));

vi.mock('../src/hooks/useProductMutations', async () => {
  const actual = await vi.importActual<typeof import('../src/hooks/useProductMutations')>(
    '../src/hooks/useProductMutations',
  );
  return { ...actual, useProductMutations: vi.fn(actual.useProductMutations) };
});

const mockedFetchProducts = vi.mocked(fetchProducts);
const mockedFetchSummary = vi.mocked(fetchProductStockSummary);

/**
 * Characterization tests do `ProductDashboard` (`characterization-plan.md` §10).
 *
 * O dashboard testa **fiação e orquestração** — nunca renderização de linha ou
 * de card, que pertence a `ProductsTable.test.tsx` e `ProductCardList.test.tsx`.
 * Duplicar aqui seria a redundância que o plano evita (§10, A-12).
 *
 * `ProductDashboard.test.tsx` (existente) já cobre: seleção limpa ao paginar
 * (F-04) e `mutate` antes de `setPage` (F-08).
 *
 * NOTA DE AMBIENTE: o jsdom não aplica breakpoints do Tailwind, então a tabela
 * (`hidden md:block`) e a lista de cards (`md:hidden`) renderizam **as duas** em
 * todo teste — cada produto aparece em duplicidade. Por isso as âncoras usam
 * controles que só existem numa das superfícies (o checkbox, na tabela) ou
 * aceitam explicitamente as duas ocorrências. Isso é limite do ambiente, não
 * comportamento do produto (§11).
 *
 * NÃO congelado neste arquivo (§12):
 *   · a paginação renderizada antes dos cards no mobile (C-4) — nenhuma
 *     asserção sobre ordem visual;
 *   · "Excluir selecionados" visível e permanentemente desabilitado no mobile
 *     (N-3);
 *   · o `serverError` do `ProductFormModal` persistindo ao reabrir (F-10);
 *   · as duas instâncias de `ProductFormModal` montadas ao mesmo tempo (A-9).
 */

const products = [
  makeProduct({ id: 'p1', name: 'Caneta Azul', sku: 'CAN-001', balance: 20, minStock: 5 }),
  makeProduct({ id: 'p2', name: 'Borracha Branca', sku: 'BOR-002', balance: 2, minStock: 8 }),
];

/** Últimos argumentos da consulta de produtos: [search, page, pageSize, sortBy, sortDir, status]. */
function lastQuery() {
  const calls = mockedFetchProducts.mock.calls;
  return calls[calls.length - 1];
}

beforeEach(() => {
  vi.mocked(fetchProduct).mockReset();
  vi.mocked(fetchMovements).mockReset();
  vi.mocked(fetchQuickOutHistory).mockReset();
  mockedFetchProducts.mockReset();
  mockedFetchSummary.mockReset();

  mockedFetchProducts.mockResolvedValue(paged(products, { total: products.length }));
  mockedFetchSummary.mockResolvedValue({ ok: 1, attn: 1, out: 0 });
  vi.mocked(fetchProduct).mockResolvedValue(products[0]);
  vi.mocked(fetchMovements).mockResolvedValue(paged([], { total: 0 }));
  vi.mocked(fetchQuickOutHistory).mockResolvedValue(paged([], { total: 0 }));
});

describe('ProductDashboard — a seleção não sobrevive à mudança de recorte (PD-1)', () => {
  it('PD-1 · buscar limpa a seleção', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);

    await user.click(await screen.findByRole('checkbox', { name: 'Selecionar Caneta Azul' }));
    // A Task 16 trocou o botão sempre visível (e desabilitado) por uma barra
    // contextual que só existe enquanto há seleção (N-3). O contrato de PD-1 —
    // "a seleção não sobrevive à mudança de recorte" — é o mesmo; muda o sinal
    // observável: a barra deixa de existir em vez de ficar desabilitada.
    expect(screen.getByRole('button', { name: /Excluir selecionados \(1\)/i })).toBeEnabled();

    await user.type(screen.getByLabelText(/Buscar por Nome ou SKU/i), 'borracha');

    // Sem isto, uma ação em lote pode atingir produtos que não estão na tela.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Excluir selecionados/i })).not.toBeInTheDocument(),
    );
  });

  it('PD-1 · filtrar por status limpa a seleção', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);

    await user.click(await screen.findByRole('checkbox', { name: 'Selecionar Caneta Azul' }));
    expect(screen.getByRole('button', { name: /Excluir selecionados \(1\)/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /Filtrar por Status/i }));
    // Rótulo atualizado na Task 14 — vocabulário único ("Estoque baixo" no
    // lugar do antigo "Atenção", exclusivo do filtro).
    await user.click(await screen.findByRole('menuitemcheckbox', { name: /Estoque baixo/i }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Excluir selecionados/i })).not.toBeInTheDocument(),
    );
  });
});

describe('ProductDashboard — cada ação de linha abre o diálogo correspondente (PD-2)', () => {
  /**
   * O teste mais valioso do dashboard: percorre o **fluxo do usuário** (acionar
   * na tela → o diálogo certo aparece) em vez de invocar callbacks de filhos
   * mockados. A migração troca os quatro modais, e é aqui que a fiação quebra
   * em silêncio.
   */
  it('PD-2 · "Movimentar" abre o diálogo de movimentação', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);

    await screen.findByRole('checkbox', { name: 'Selecionar Caneta Azul' });
    await user.click(screen.getAllByRole('button', { name: 'Movimentar' })[0]);

    expect(await screen.findByRole('dialog', { name: /Movimentar Estoque/i })).toBeInTheDocument();
  });

  it('PD-2 · a baixa rápida da linha abre o diálogo de baixa daquele produto', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);

    await screen.findByRole('checkbox', { name: 'Selecionar Caneta Azul' });
    await user.click(screen.getByRole('button', { name: 'Dar baixa rápida em Caneta Azul' }));

    expect(await screen.findByText('Baixa Rápida de Estoque')).toBeInTheDocument();
    // O diálogo tem que abrir para o produto certo, não para um qualquer.
    expect(screen.getAllByText(/CAN-001/).length).toBeGreaterThan(0);
  });

  it('PD-2 · "Ver Histórico" abre o histórico de movimentações', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);

    await screen.findByRole('checkbox', { name: 'Selecionar Caneta Azul' });
    await user.click(screen.getAllByRole('button', { name: 'Mais ações para Caneta Azul' })[0]);
    await user.click(await screen.findByRole('menuitem', { name: 'Ver Histórico' }));

    // Task 19: o título passou a nomear o produto (UF-35) — dois históricos de
    // produtos diferentes deixaram de ser indistinguíveis pelo nome acessível.
    expect(await screen.findByRole('dialog', { name: /Histórico · Caneta Azul/ })).toBeInTheDocument();
  });

  it('PD-2 · "Ajustar Estoque" abre o diálogo de ajuste', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);

    await screen.findByRole('checkbox', { name: 'Selecionar Caneta Azul' });
    await user.click(screen.getAllByRole('button', { name: 'Mais ações para Caneta Azul' })[0]);
    await user.click(await screen.findByRole('menuitem', { name: 'Ajustar Estoque' }));

    expect(await screen.findByRole('dialog', { name: /Ajustar Estoque/i })).toBeInTheDocument();
  });

  it('PD-2 · "Adicionar Produto" abre o formulário de cadastro', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);

    await screen.findByRole('checkbox', { name: 'Selecionar Caneta Azul' });
    await user.click(screen.getByRole('button', { name: /Adicionar Produto/i }));

    expect(await screen.findByRole('dialog', { name: /Novo Produto/i })).toBeInTheDocument();
  });
});

/**
 * Novos contratos da Task 16 — zona de controle e paridade mobile.
 */
describe('ProductDashboard — paridade de filtro e ordenação (Task 16)', () => {
  /**
   * UF-07/UF-41: entrar no filtro pelo banner e não conseguir sair. O jsdom não
   * avalia media query, então o teste afirma **existência e ação** do caminho de
   * saída — não a largura em que ele aparece.
   */
  it('limpar o filtro é alcançável e realmente limpa, sem depender da largura', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);
    await screen.findByRole('checkbox', { name: 'Selecionar Caneta Azul' });

    // Entra no filtro pelo banner de estoque baixo (mesmo caminho do UF-07).
    await user.click(screen.getByRole('button', { name: /Ver produtos/i }));
    await waitFor(() => expect(lastQuery()?.[5]).toEqual(['ATTN', 'OUT']));

    // O filtro ativo fica visível como chip removível, em qualquer largura.
    expect(await screen.findByRole('button', { name: /Remover filtro Estoque baixo/i })).toBeInTheDocument();

    // A saída existe fora de qualquer menu e é acionável.
    await user.click(screen.getByRole('button', { name: /^Limpar filtros$/i }));

    // Asserção pela UI, não pela chamada de rede: voltar ao recorte sem filtro
    // reusa a queryKey já cacheada pelo React Query, então NÃO há novo fetch —
    // o observável é o filtro ter sumido da tela.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Remover filtro/i })).not.toBeInTheDocument(),
    );
  });

  it('a ordenação do mobile envia os mesmos sortBy/sortDir do desktop', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);
    await screen.findByRole('checkbox', { name: 'Selecionar Caneta Azul' });

    await user.click(screen.getByRole('button', { name: /Filtrar e ordenar/i }));
    const sheet = await screen.findByRole('dialog', { name: /Filtrar e ordenar/i });

    await user.click(within(sheet).getByRole('button', { name: /Ordenar por Saldo/i }));

    // Mesmo contrato global da Task 3: chave válida e página de volta à 1.
    await waitFor(() => expect(lastQuery()?.[3]).toBe('balance'));
    expect(lastQuery()?.[1]).toBe(1);
  });

  it('as ações em lote pertencem ao ramo da tabela, não ao dos cards (N-3)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);

    // Sem seleção, o controle não existe — ausência, não desabilitação (N-3).
    await screen.findByRole('checkbox', { name: 'Selecionar Caneta Azul' });
    expect(screen.queryByRole('button', { name: /Excluir selecionados/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Selecionar Caneta Azul' }));

    // O produto não tem estado de viewport (DEP-03): a troca é só CSS. O que dá
    // para afirmar é o RAMO do DOM em que o controle vive.
    const tableBranch = document.querySelector('[data-surface="table"]') as HTMLElement;
    const cardsBranch = document.querySelector('[data-surface="cards"]') as HTMLElement;
    expect(tableBranch).not.toBeNull();
    expect(cardsBranch).not.toBeNull();

    const batch = await screen.findByRole('button', { name: /Excluir selecionados/i });
    expect(tableBranch).toContainElement(batch);
    expect(cardsBranch).not.toContainElement(batch);
  });

  it('a paginação é renderizada depois da lista e informa o total (C-4)', async () => {
    renderWithProviders(<ProductDashboard />);
    await screen.findByRole('checkbox', { name: 'Selecionar Caneta Azul' });

    const nav = screen.getByRole('navigation', { name: /Paginação/i });
    const cards = document.querySelector('[data-surface="cards"]') as HTMLElement;

    // `compareDocumentPosition` devolve FOLLOWING quando `nav` vem depois.
    expect(cards.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nav).toHaveTextContent(/2 produtos?/i);
  });
});

/**
 * REV-05: PD-2 provava que o diálogo CERTO abria, não que ele abria para o
 * produto certo. Os diálogos ainda não exibem o produto no corpo (UF-35, fora
 * desta task), então a identidade é afirmada pelo dado que cada um busca/envia
 * — que é exatamente o que quebraria em silêncio se a fiação trocasse de linha.
 */
describe('ProductDashboard — cada ação age sobre AQUELE produto (PD-2, REV-05)', () => {
  it('PD-2 · "Ver Histórico" no segundo produto busca o histórico do segundo produto', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);
    await screen.findByRole('checkbox', { name: 'Selecionar Borracha Branca' });

    const table = document.querySelector('[data-surface="table"]') as HTMLElement;
    await user.click(within(table).getByRole('button', { name: 'Mais ações para Borracha Branca' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Ver Histórico' }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(vi.mocked(fetchMovements)).toHaveBeenCalled());
    expect(vi.mocked(fetchMovements).mock.calls.at(-1)?.[0]).toBe('p2');

    // Task 19: a identidade deixou de ser só inferível pela chamada de API —
    // o título nomeia o produto acionado (UF-35), como já ocorre no formulário.
    expect(within(dialog).getByText(/Histórico · Borracha Branca/)).toBeInTheDocument();
    expect(within(dialog).getByText(/BOR-002/)).toBeInTheDocument();
  });

  it('PD-2 · "Movimentar" no segundo produto lança a movimentação no segundo produto', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);
    await screen.findByRole('checkbox', { name: 'Selecionar Borracha Branca' });

    const table = document.querySelector('[data-surface="table"]') as HTMLElement;
    await user.click(within(table).getAllByRole('button', { name: 'Movimentar' })[1]);
    const dialog = await screen.findByRole('dialog', { name: /Movimentar Estoque/i });

    // Task 17: o diálogo passou a mostrar o contexto do produto, então a
    // identidade agora é visível — não só inferível pela chamada de API.
    expect(within(dialog).getByText('Borracha Branca')).toBeInTheDocument();
    expect(within(dialog).getByText(/BOR-002/)).toBeInTheDocument();

    // A intenção precisa ser declarada antes da quantidade (D2/P-4).
    await user.click(within(dialog).getByRole('radio', { name: 'Entrada' }));
    await user.clear(screen.getByLabelText(/^Quantidade/i));
    await user.type(screen.getByLabelText(/^Quantidade/i), '3');
    await user.click(screen.getByRole('button', { name: /^Registrar entrada/i }));

    await waitFor(() => expect(vi.mocked(createMovement)).toHaveBeenCalled());
    expect(vi.mocked(createMovement).mock.calls.at(-1)?.[0]).toBe('p2');
  });
});

describe('ProductDashboard — caminho da baixa pela lista (PD-3)', () => {
  /**
   * Caminho B inteiro — hoje o único disponível no mobile, já que o card não
   * tem baixa rápida (C-5).
   */
  it('PD-3 · "Baixa de Produtos" abre a lista, e escolher um produto fecha a lista e abre a baixa', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);

    await screen.findByRole('checkbox', { name: 'Selecionar Caneta Azul' });

    // A lista faz a **própria** consulta de produtos, separada da tabela. Dar a
    // ela um produto que a tabela não está exibindo torna o alvo do clique
    // inequívoco sem precisar navegar a estrutura do DOM para achar o modal
    // (a tabela mantém os itens já em cache do React Query).
    mockedFetchProducts.mockResolvedValue(
      paged([makeProduct({ id: 'p9', name: 'Grampeador Vermelho', sku: 'GRA-009', balance: 4 })], {
        total: 1,
      }),
    );

    await user.click(screen.getByRole('button', { name: /Baixa de Produtos/i }));
    await screen.findByText('Selecionar Produto para Baixa');

    await user.click((await screen.findAllByText('Grampeador Vermelho'))[0]);

    expect(await screen.findByText('Baixa Rápida de Estoque')).toBeInTheDocument();
    expect(screen.getAllByText(/GRA-009/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Selecionar Produto para Baixa')).not.toBeInTheDocument();
  });
});

describe('ProductDashboard — entrada no filtro de estoque baixo (PD-4)', () => {
  it('PD-4 · "Ver produtos" do alerta aplica o filtro de estoque baixo e volta à primeira página', async () => {
    mockedFetchSummary.mockResolvedValue({ ok: 1, attn: 3, out: 2 });
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);

    await user.click(await screen.findByRole('button', { name: /Ver produtos/i }));

    // Metade do UF-07: hoje só se **entra** no filtro por aqui. A saída é
    // responsabilidade do StatusFilterMenu e está coberta em SFM-2.
    await waitFor(() => expect(lastQuery()?.[5]).toEqual(['ATTN', 'OUT']));
    expect(lastQuery()?.[1]).toBe(1);
  });
});

describe('ProductDashboard — ações em lote operam sobre a página visível (PD-5)', () => {
  it('PD-5 · "Excluir página" entrega ao mutate exatamente os itens correntes', async () => {
    const removeProductsMutate = vi.fn();
    vi.mocked(useProductMutations).mockReturnValue({
      removeProduct: { mutate: vi.fn(), isPending: false } as never,
      zeroBalance: { mutate: vi.fn(), isPending: false } as never,
      removeProducts: { mutate: removeProductsMutate, isPending: false } as never,
      zeroBalances: { mutate: vi.fn(), isPending: false } as never,
      invalidateProducts: vi.fn(),
    });

    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);

    await screen.findByRole('checkbox', { name: 'Selecionar Caneta Azul' });
    await user.click(screen.getByRole('button', { name: 'Excluir página' }));
    await user.click(await screen.findByRole('button', { name: 'Excluir página' }));

    // Consequência de dados: o escopo da ação em lote é o que está na tela.
    await waitFor(() =>
      expect(removeProductsMutate).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'p1' }),
        expect.objectContaining({ id: 'p2' }),
      ]),
    );
  });
});

describe('ProductDashboard — busca repassada à consulta (PD-6)', () => {
  it('PD-6 · o termo digitado chega à API e a listagem volta à primeira página', async () => {
    mockedFetchProducts.mockResolvedValue(paged(products, { total: 25 }));
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);

    await screen.findByRole('checkbox', { name: 'Selecionar Caneta Azul' });
    await user.click(screen.getByRole('button', { name: 'Próxima →' }));
    await waitFor(() => expect(lastQuery()?.[1]).toBe(2));

    await user.type(screen.getByLabelText(/Buscar por Nome ou SKU/i), 'caneta');

    // A busca é debounced (300ms): o contrato é o termo chegar, não quando.
    await waitFor(() => expect(lastQuery()?.[0]).toBe('caneta'), { timeout: 3000 });
    expect(lastQuery()?.[1]).toBe(1);
  });
});

/**
 * 3-F4 (REV-06) — trocar a ordenação também tem que voltar para a página 1.
 *
 * `togglePrimarySort` (`useProductsQuery.ts`) já chama `setPage(1)`; o que
 * faltava era um teste comportamental que provasse isso pelo caminho real
 * (`ProductDashboard` → `ProductsTable` → `useProductsQuery`), no mesmo nível
 * de integração do PD-6 acima — não uma chamada isolada ao hook.
 */
describe('ProductDashboard — trocar a ordenação reseta a página (3-F4 / REV-06)', () => {
  it('busca já aplicada permanece; ao ordenar estando na página 2, a próxima consulta usa page=1 com o novo critério', async () => {
    mockedFetchProducts.mockResolvedValue(paged(products, { total: 25 }));
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);

    await screen.findByRole('checkbox', { name: 'Selecionar Caneta Azul' });

    // Busca já definida antes da troca de ordenação — precisa sobreviver.
    await user.type(screen.getByLabelText(/Buscar por Nome ou SKU/i), 'caneta');
    await waitFor(() => expect(lastQuery()?.[0]).toBe('caneta'), { timeout: 3000 });

    await user.click(screen.getByRole('button', { name: 'Próxima →' }));
    await waitFor(() => expect(lastQuery()?.[1]).toBe(2));

    // Estado imediatamente antes de ordenar: página 2, ordenação default (name asc).
    expect(lastQuery()?.[3]).toBe('name');

    await user.click(screen.getByRole('button', { name: /SKU/i }));

    await waitFor(() => expect(lastQuery()?.[3]).toBe('sku'));
    // page volta a 1 — não fica presa na página 2 com um recorte que já não
    // corresponde à nova ordenação.
    expect(lastQuery()?.[1]).toBe(1);
    // A direção do novo critério é asc (troca de coluna, não é o mesmo campo).
    expect(lastQuery()?.[4]).toBe('asc');
    // A busca continua na consulta — ordenar não é uma mudança de recorte que
    // deva descartar o filtro já aplicado.
    expect(lastQuery()?.[0]).toBe('caneta');
  });

  it('clicar na mesma coluna de novo (asc → desc) também volta para a página 1', async () => {
    mockedFetchProducts.mockResolvedValue(paged(products, { total: 25 }));
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);

    await screen.findByRole('checkbox', { name: 'Selecionar Caneta Azul' });

    await user.click(screen.getByRole('button', { name: 'Próxima →' }));
    await waitFor(() => expect(lastQuery()?.[1]).toBe(2));

    // Ordenação já é 'name' (default) — clicar em "Ordenar por Nome" alterna
    // o MESMO critério para desc, não troca de critério. (O rótulo do controle
    // mudou na Task 13, com a fusão do SKU sob o nome; o contrato de reset de
    // página é o mesmo.)
    await user.click(screen.getByRole('button', { name: /Ordenar por Nome/i }));

    await waitFor(() => expect(lastQuery()?.[4]).toBe('desc'));
    expect(lastQuery()?.[3]).toBe('name');
    expect(lastQuery()?.[1]).toBe(1);
  });
});
