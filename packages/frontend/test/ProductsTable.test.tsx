import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ProductWithBalance } from '../src/api/types';
import ProductsTable from '../src/components/products/ProductsTable';
import type { Sort } from '../src/components/ui/DataTable';

import { makeProduct } from './helpers/factories';
import { makeSpyActions } from './helpers/render';

/**
 * Characterization tests do `ProductsTable` (`characterization-plan.md` §6).
 *
 * Regra desta suíte: proteger **capacidades**, não layout. Nenhum teste toca
 * `className`, largura de coluna, ordem visual de colunas ou estrutura de
 * `div` — a migração pode reescrever o DOM inteiro desde que estes
 * comportamentos continuem verdadeiros.
 *
 * Erro e carregando NÃO são testados aqui: já estão em `DataTable.test.tsx` e
 * a tabela apenas repassa as props (§6, "NÃO RELEVANTE aqui").
 */

function renderTable(
  items: ProductWithBalance[],
  overrides: Partial<Parameters<typeof ProductsTable>[0]> = {},
) {
  const actions = makeSpyActions();
  const props = {
    items,
    isLoading: false,
    error: null,
    sorts: [{ by: 'name', dir: 'asc' }] as Sort[],
    onSortsChange: vi.fn(),
    onTogglePrimarySort: vi.fn(),
    statusFilter: [],
    onToggleStatus: vi.fn(),
    onClearStatus: vi.fn(),
    selectedIds: new Set<string>(),
    onToggleSelected: vi.fn(),
    expandedIds: {},
    onToggleExpanded: vi.fn(),
    actions,
    ...overrides,
  };

  const view = render(<ProductsTable {...props} />);
  return { ...view, props, actions, rerender: (next: Partial<typeof props>) => view.rerender(<ProductsTable {...props} {...next} />) };
}

describe('ProductsTable — dados da linha (PT-1, PT-2)', () => {
  it('PT-1 · expõe nome, SKU e saldo de cada produto', () => {
    renderTable([makeProduct({ name: 'Caneta Azul', sku: 'CAN-001', balance: 20 })]);

    expect(screen.getByText('Caneta Azul')).toBeInTheDocument();
    expect(screen.getByText('CAN-001')).toBeInTheDocument();
    // O saldo é o dado; "un." é apresentação e fica fora da asserção.
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('PT-2 · traduz os três estados de estoque em rótulos distintos na tela', () => {
    renderTable([
      makeProduct({ id: 'ok', name: 'Produto OK', sku: 'OK-1', balance: 20, minStock: 5 }),
      makeProduct({ id: 'attn', name: 'Produto Atenção', sku: 'AT-1', balance: 2, minStock: 5 }),
      makeProduct({ id: 'out', name: 'Produto Zerado', sku: 'ZR-1', balance: 0, minStock: 5 }),
    ]);

    // A *regra* está em PS-1; aqui interessa que os três estados cheguem à tela
    // como rótulos legíveis e diferentes entre si.
    expect(screen.getByText('Em Estoque')).toBeInTheDocument();
    expect(screen.getByText('Estoque Baixo')).toBeInTheDocument();
    expect(screen.getByText('Fora de Estoque')).toBeInTheDocument();
  });
});

describe('ProductsTable — ordenação (PT-3, PT-4)', () => {
  it('PT-3 · o cabeçalho ativo declara a direção da ordenação em aria-sort', () => {
    renderTable([makeProduct()], { sorts: [{ by: 'sku', dir: 'asc' }] });

    // Asserção restrita ao cabeçalho ATIVO. O DataTable aplica aria-sort="none"
    // a todos os demais (A-8ʳ) — é um bug conhecido e não vira contrato aqui.
    expect(screen.getByRole('columnheader', { name: /SKU/i })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('PT-3 · a direção descendente também é declarada', () => {
    renderTable([makeProduct()], { sorts: [{ by: 'sku', dir: 'desc' }] });

    expect(screen.getByRole('columnheader', { name: /SKU/i })).toHaveAttribute('aria-sort', 'descending');
  });

  it('PT-4 · clicar no cabeçalho pede a troca da ordenação primária com a chave da coluna', async () => {
    const user = userEvent.setup();
    const { props } = renderTable([makeProduct()]);

    await user.click(screen.getByRole('button', { name: /Saldo Atual/i }));
    expect(props.onTogglePrimarySort).toHaveBeenCalledWith('balance');

    await user.click(screen.getByRole('button', { name: /SKU/i }));
    expect(props.onTogglePrimarySort).toHaveBeenLastCalledWith('sku');
  });
});

describe('ProductsTable — seleção (PT-5)', () => {
  it('PT-5 · cada linha tem um checkbox com nome acessível próprio que dispara a seleção', async () => {
    const user = userEvent.setup();
    const { props } = renderTable([
      makeProduct({ id: 'p1', name: 'Caneta Azul' }),
      makeProduct({ id: 'p2', name: 'Borracha Branca' }),
    ]);

    // O nome acessível é o que distingue uma linha da outra para quem não vê a
    // tabela — sem ele a ação em lote fica impossível de operar por teclado.
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar Borracha Branca' }));

    expect(props.onToggleSelected).toHaveBeenCalledWith('p2', true);
  });

  it('PT-5 · o checkbox reflete o estado de seleção recebido e permite desmarcar', async () => {
    const user = userEvent.setup();
    const { props } = renderTable([makeProduct({ id: 'p1', name: 'Caneta Azul' })], {
      selectedIds: new Set(['p1']),
    });

    const checkbox = screen.getByRole('checkbox', { name: 'Selecionar Caneta Azul' });
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(props.onToggleSelected).toHaveBeenCalledWith('p1', false);
  });
});

describe('ProductsTable — descrição expansível (PT-6)', () => {
  it('PT-6 · a descrição pode ser revelada, e o gatilho anuncia o estado em aria-expanded', async () => {
    const user = userEvent.setup();
    const { props, rerender } = renderTable([
      makeProduct({ id: 'p1', name: 'Caneta Azul', description: 'Tinta azul, ponta 1.0mm' }),
    ]);

    // Recolhido: a descrição não está na tela e o gatilho declara aria-expanded=false.
    expect(screen.queryByText('Tinta azul, ponta 1.0mm')).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Caneta Azul', expanded: false });

    await user.click(trigger);
    expect(props.onToggleExpanded).toHaveBeenCalledWith('p1');

    // O componente é controlado: quem guarda `expandedIds` é o container.
    rerender({ expandedIds: { p1: true } });

    expect(screen.getByText('Tinta azul, ponta 1.0mm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Caneta Azul', expanded: true })).toBeInTheDocument();
  });

  it('PT-6 · a descrição pode ser recolhida de volta', async () => {
    const user = userEvent.setup();
    const { props } = renderTable(
      [makeProduct({ id: 'p1', name: 'Caneta Azul', description: 'Tinta azul, ponta 1.0mm' })],
      { expandedIds: { p1: true } },
    );

    expect(screen.getByText('Tinta azul, ponta 1.0mm')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Caneta Azul', expanded: true }));
    expect(props.onToggleExpanded).toHaveBeenCalledWith('p1');
  });

  it('PT-6 · produto sem descrição comunica a ausência em vez de ficar mudo', () => {
    renderTable([makeProduct({ id: 'p1', name: 'Caneta Azul', description: null })], {
      expandedIds: { p1: true },
    });

    expect(screen.getByText('Sem descrição.')).toBeInTheDocument();
  });

  /**
   * NÃO congelado: hoje o nome E o SKU são dois gatilhos separados para a mesma
   * expansão. A migração funde SKU sob o nome (§18 do Design System), então o
   * contrato é *poder revelar a descrição*, não *por onde*. Este teste afirma a
   * capacidade a partir do SKU sem exigir que ela continue existindo ali.
   */
  it('PT-6 · hoje o SKU também revela a descrição (capacidade, não a via)', async () => {
    const user = userEvent.setup();
    const { props } = renderTable([makeProduct({ id: 'p1', sku: 'CAN-001' })]);

    await user.click(screen.getByRole('button', { name: 'CAN-001' }));
    expect(props.onToggleExpanded).toHaveBeenCalledWith('p1');
  });
});

describe('ProductsTable — ações da linha (PT-7)', () => {
  it('PT-7 · "Movimentar" dispara onMove com o produto da linha', async () => {
    const user = userEvent.setup();
    const product = makeProduct({ id: 'p1', name: 'Caneta Azul' });
    const { actions } = renderTable([product]);

    await user.click(screen.getByRole('button', { name: 'Movimentar' }));

    expect(actions.onMove).toHaveBeenCalledWith(product);
  });

  it('PT-7 · a baixa rápida tem nome acessível por produto e dispara onQuickOut', async () => {
    const user = userEvent.setup();
    const product = makeProduct({ id: 'p1', name: 'Caneta Azul' });
    const { actions } = renderTable([product]);

    // É um botão só de ícone: sem nome acessível vira um controle mudo.
    await user.click(screen.getByRole('button', { name: 'Dar baixa rápida em Caneta Azul' }));

    expect(actions.onQuickOut).toHaveBeenCalledWith(product);
  });
});

describe('ProductsTable — estado vazio (PT-8)', () => {
  /**
   * Afirma que **existe** um estado vazio customizado, não qual é o texto: o
   * texto atual ("Nenhum produto encontrado.") está classificado como ALTERAR
   * INTENCIONALMENTE (A-10 — passará a distinguir "sem cadastro" de "filtro sem
   * resultado"). Congelar a frase travaria o alvo.
   */
  it('PT-8 · lista vazia renderiza o estado vazio da própria tabela', () => {
    renderTable([]);

    expect(screen.getByText(/Nenhum produto/i)).toBeInTheDocument();
  });
});
