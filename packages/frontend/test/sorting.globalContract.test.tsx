import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchProducts } from '../src/api/products';
import { fetchQuickOutHistory } from '../src/api/quickOut';
import QuickOutHistoryModal from '../src/components/QuickOutHistoryModal';
import ProductsTable from '../src/components/products/ProductsTable';
import { DataTable } from '../src/components/ui/DataTable';
import { useProductsQuery } from '../src/hooks/useProductsQuery';

import { makeProduct } from './helpers/factories';
import { makeSpyActions } from './helpers/render';

vi.mock('../src/api/products', () => ({ fetchProducts: vi.fn() }));
vi.mock('../src/api/quickOut', () => ({ fetchQuickOutHistory: vi.fn() }));

const mockedFetchProducts = vi.mocked(fetchProducts);
const mockedFetchHistory = vi.mocked(fetchQuickOutHistory);

/**
 * Task 3 (D-A) — o frontend deixa de reordenar a página já carregada.
 *
 * A ordenação passa a ser inteiramente do backend: global, aplicada sobre o
 * conjunto filtrado antes da paginação. O papel do cliente é **enviar** o
 * critério e **exibir** a resposta na ordem em que ela veio — nunca reordenar
 * os itens que recebeu, porque isso reorganiza só a página e faz uma
 * capacidade global parecer existir sem existir.
 *
 * SD-1 (§9.3.1): nenhuma asserção depende de acento, caixa ou locale.
 */

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedFetchProducts.mockReset();
  mockedFetchHistory.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useProductsQuery — não reordena a resposta do backend (D-A)', () => {
  it('expõe os itens exatamente na ordem devolvida pela API', async () => {
    // Ordem deliberadamente NÃO alfabética: se o hook reordenasse localmente,
    // ele "consertaria" esta lista e o teste falharia.
    const apiOrder = [
      makeProduct({ id: 'p3', name: 'Charlie', sku: 'SKU-C' }),
      makeProduct({ id: 'p1', name: 'Alfa', sku: 'SKU-A' }),
      makeProduct({ id: 'p2', name: 'Bravo', sku: 'SKU-B' }),
    ];
    mockedFetchProducts.mockResolvedValue({ items: apiOrder, total: 3, page: 1, pageSize: 10 });

    const { result } = renderHook(() => useProductsQuery(), { wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(3));
    expect(result.current.viewItems.map((p) => p.name)).toEqual(['Charlie', 'Alfa', 'Bravo']);
  });

  it('mantém a ordem da API mesmo com a ordenação primária declarada como name', async () => {
    const apiOrder = [
      makeProduct({ id: 'p2', name: 'Zulu', sku: 'SKU-Z' }),
      makeProduct({ id: 'p1', name: 'Alfa', sku: 'SKU-A' }),
    ];
    mockedFetchProducts.mockResolvedValue({ items: apiOrder, total: 2, page: 1, pageSize: 10 });

    const { result } = renderHook(() => useProductsQuery(), { wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    // `sorts` default é [{ by: 'name', dir: 'asc' }] — antes da Task 3 isso
    // disparava um `Intl.Collator` sobre a página e devolveria Alfa primeiro.
    expect(result.current.sorts[0]).toEqual({ by: 'name', dir: 'asc' });
    expect(result.current.viewItems.map((p) => p.name)).toEqual(['Zulu', 'Alfa']);
  });

  it('envia sortBy e sortDir à API ao trocar a ordenação primária', async () => {
    mockedFetchProducts.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
    const { result } = renderHook(() => useProductsQuery(), { wrapper });
    await waitFor(() => expect(mockedFetchProducts).toHaveBeenCalled());

    act(() => result.current.togglePrimarySort('balance'));

    await waitFor(() => {
      const last = mockedFetchProducts.mock.calls.at(-1);
      // Assinatura posicional: (search, page, pageSize, sortBy, sortDir, status)
      expect(last?.[3]).toBe('balance');
      expect(last?.[4]).toBe('asc');
    });
  });
});

/**
 * Correção 3-F1 — coluna única pelo caminho REAL de `ProductsTable`.
 *
 * `ProductsTable` não usa o `handleSort` do `DataTable`: seus cabeçalhos são
 * `headerRender` customizados que chamam `onTogglePrimarySort` diretamente
 * (`ProductsTable.tsx:110,148,173`). Remover `event.shiftKey` do `DataTable`
 * (já corrigido) não fecha esse caminho — é `togglePrimarySort`, no hook, que
 * precisa nunca acumular critérios.
 *
 * Este componente espelha EXATAMENTE a fiação real de produção
 * (`ProductDashboard.tsx:183-197`: `sorts`, `onSortsChange`,
 * `onTogglePrimarySort` vindos do mesmo `useProductsQuery()`), para que o
 * clique no cabeçalho exercite o mesmo estado e o mesmo componente que a tela
 * real usa — não um `DataTable` sintético com `sortable: true`.
 */
function ProductsTableWithRealHook() {
  const products = useProductsQuery();
  return (
    <ProductsTable
      items={products.viewItems}
      isLoading={products.query.isLoading}
      error={null}
      sorts={products.sorts}
      onSortsChange={products.setSorts}
      onTogglePrimarySort={products.togglePrimarySort}
      statusFilter={products.statusFilter}
      onToggleStatus={products.toggleStatus}
      onClearStatus={products.clearStatus}
      selectedIds={new Set()}
      onToggleSelected={() => {}}
      expandedIds={{}}
      onToggleExpanded={() => {}}
      actions={makeSpyActions()}
    />
  );
}

describe('useProductsQuery.togglePrimarySort — exatamente um critério (3-F1)', () => {
  it('trocar de coluna substitui o critério anterior, nunca o preserva como secundário', async () => {
    mockedFetchProducts.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
    const { result } = renderHook(() => useProductsQuery(), { wrapper });
    await waitFor(() => expect(mockedFetchProducts).toHaveBeenCalled());

    // Estado inicial do hook: [{ by: 'name', dir: 'asc' }].
    expect(result.current.sorts).toEqual([{ by: 'name', dir: 'asc' }]);

    act(() => result.current.togglePrimarySort('sku'));
    // O critério anterior ('name') NÃO pode sobreviver como secundário.
    expect(result.current.sorts).toEqual([{ by: 'sku', dir: 'asc' }]);

    act(() => result.current.togglePrimarySort('balance'));
    expect(result.current.sorts).toEqual([{ by: 'balance', dir: 'asc' }]);
  });

  it('clicar duas vezes na mesma coluna continua alternando asc/desc, sem duplicar', async () => {
    mockedFetchProducts.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
    const { result } = renderHook(() => useProductsQuery(), { wrapper });
    await waitFor(() => expect(mockedFetchProducts).toHaveBeenCalled());

    act(() => result.current.togglePrimarySort('name'));
    expect(result.current.sorts).toEqual([{ by: 'name', dir: 'desc' }]);

    act(() => result.current.togglePrimarySort('name'));
    expect(result.current.sorts).toEqual([{ by: 'name', dir: 'asc' }]);
  });
});

describe('ProductsTable + useProductsQuery — aria-sort exclusivo (3-F1)', () => {
  it('ao trocar para SKU pelo clique real, só o cabeçalho SKU anuncia ordenação — Nome deixa de anunciar', async () => {
    mockedFetchProducts.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
    const user = userEvent.setup();
    render(<ProductsTableWithRealHook />, { wrapper });
    await waitFor(() => expect(mockedFetchProducts).toHaveBeenCalled());

    // Estado inicial: Nome é o primário (default do hook).
    expect(screen.getByRole('columnheader', { name: /Nome do Produto/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    // Não sorted não é "none": Task 11 (A-8ʳ) removeu aria-sort="none" do
    // não-primário — o atributo passa a existir só na coluna ordenada.
    expect(screen.getByRole('columnheader', { name: /^SKU/i })).not.toHaveAttribute('aria-sort');

    await user.click(screen.getByRole('button', { name: /SKU/i }));

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /^SKU/i })).toHaveAttribute('aria-sort', 'ascending');
    });
    // O critério anterior some do DOM real: nenhuma contradição entre o
    // aria-sort do <th> e o sr-only interno do SortableHeader.
    expect(screen.getByRole('columnheader', { name: /Nome do Produto/i })).not.toHaveAttribute('aria-sort');
    expect(screen.getByRole('columnheader', { name: /Nome do Produto/i })).not.toHaveTextContent(
      /ordenado crescente|ordenado decrescente/,
    );
  });
});

describe('DataTable — Shift+clique não é mais oferecido (UF-08 / D-D)', () => {
  type Row = { id: string; name: string };
  const rows: Row[] = [
    { id: '1', name: 'Alfa' },
    { id: '2', name: 'Bravo' },
  ];

  function renderTable(onSortsChange: (next: { by: string; dir: 'asc' | 'desc' }[]) => void) {
    return render(
      <DataTable<Row>
        columns={[
          { key: 'name', header: 'Nome', sortable: true },
          { key: 'id', header: 'Id', sortable: true },
        ]}
        items={rows}
        getRowId={(r) => r.id}
        sorts={[{ by: 'name', dir: 'asc' }]}
        onSortsChange={onSortsChange}
      />,
    );
  }

  it('Shift+clique num segundo cabeçalho substitui a ordenação, não acumula um critério secundário', async () => {
    const user = userEvent.setup();
    const onSortsChange = vi.fn();
    renderTable(onSortsChange);

    await user.keyboard('{Shift>}');
    await user.click(screen.getByRole('button', { name: 'Ordenar por Id' }));
    await user.keyboard('{/Shift}');

    expect(onSortsChange).toHaveBeenCalled();
    const next = onSortsChange.mock.calls.at(-1)?.[0];
    // Ordenação multi-coluna não é oferecida: sempre um único critério.
    expect(next).toHaveLength(1);
    expect(next?.[0].by).toBe('id');
  });

  it('clique simples continua trocando o critério primário', async () => {
    const user = userEvent.setup();
    const onSortsChange = vi.fn();
    renderTable(onSortsChange);

    await user.click(screen.getByRole('button', { name: 'Ordenar por Id' }));

    const next = onSortsChange.mock.calls.at(-1)?.[0];
    expect(next).toHaveLength(1);
    expect(next?.[0].by).toBe('id');
  });
});

describe('QuickOutHistoryModal — delega a ordenação ao backend (F-03)', () => {
  const items = [
    {
      id: 'm1',
      productId: 'p1',
      productName: 'Alfa',
      productSku: 'SKU-A',
      quantity: 5,
      date: '2026-02-01T10:00:00.000Z',
      note: 'nota 1',
    },
    {
      id: 'm2',
      productId: 'p2',
      productName: 'Bravo',
      productSku: 'SKU-B',
      quantity: 9,
      date: '2026-02-02T10:00:00.000Z',
      note: 'nota 2',
    },
  ];

  it('envia sortBy e sortDir na consulta inicial, com o default do contrato', async () => {
    mockedFetchHistory.mockResolvedValue({ items, total: 2, page: 1, pageSize: 10 });
    render(<QuickOutHistoryModal open onOpenChange={vi.fn()} />);

    await waitFor(() => expect(mockedFetchHistory).toHaveBeenCalled());
    const params = mockedFetchHistory.mock.calls.at(-1)?.[0];
    expect(params).toMatchObject({ sortBy: 'date', sortDir: 'desc' });
  });

  it('acionar um cabeçalho pede a nova ordenação à API', async () => {
    const user = userEvent.setup();
    mockedFetchHistory.mockResolvedValue({ items, total: 2, page: 1, pageSize: 10 });
    render(<QuickOutHistoryModal open onOpenChange={vi.fn()} />);
    await waitFor(() => expect(mockedFetchHistory).toHaveBeenCalled());

    await user.click(screen.getByTitle('Ordenar por Quantidade'));

    await waitFor(() => {
      const params = mockedFetchHistory.mock.calls.at(-1)?.[0];
      expect(params).toMatchObject({ sortBy: 'quantity', sortDir: 'asc' });
    });
  });

  it('exibe as linhas na ordem devolvida pela API, sem reordenar localmente', async () => {
    // A API devolve Bravo antes de Alfa; ordenar localmente por produto
    // inverteria isso. A tela tem de respeitar a ordem recebida.
    mockedFetchHistory.mockResolvedValue({
      items: [items[1], items[0]],
      total: 2,
      page: 1,
      pageSize: 10,
    });
    render(<QuickOutHistoryModal open onOpenChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Bravo')).toBeInTheDocument());

    const rendered = screen.getAllByText(/^(Alfa|Bravo)$/).map((el) => el.textContent);
    expect(rendered).toEqual(['Bravo', 'Alfa']);
  });
});

/**
 * 3-F4 (REV-06) — trocar a ordenação do histórico de baixas também tem que
 * voltar para a página 1, preservando busca e intervalo de datas já
 * aplicados.
 *
 * Os quatro handlers de cabeçalho (`QuickOutHistoryModal.tsx`) já chamam
 * `setPage(1)` antes de `setSortBy`/`setSortDir`; faltava a prova
 * comportamental. Os campos de data não têm `<label>` (N-8, dívida
 * conhecida) — localizados por `input[type="date"]`, mesmo padrão de
 * `QuickOutHistoryModal.test.tsx`.
 */
describe('QuickOutHistoryModal — trocar a ordenação reseta a página (3-F4 / REV-06)', () => {
  const items = [
    {
      id: 'm1',
      productId: 'p1',
      productName: 'Alfa',
      productSku: 'SKU-A',
      quantity: 5,
      date: '2026-02-01T10:00:00.000Z',
      note: 'nota 1',
    },
  ];

  function dateFields() {
    return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
  }

  it('busca e intervalo de datas já aplicados permanecem; ordenar na página 2 volta para page=1 com o novo critério', async () => {
    mockedFetchHistory.mockResolvedValue({ items, total: 25, page: 1, pageSize: 10 });
    const user = userEvent.setup();
    render(<QuickOutHistoryModal open onOpenChange={vi.fn()} />);
    await waitFor(() => expect(mockedFetchHistory).toHaveBeenCalled());

    // Busca e datas já definidas ANTES de ordenar — precisam sobreviver.
    await user.type(screen.getByRole('searchbox'), 'nota');
    await waitFor(() => {
      expect(mockedFetchHistory.mock.calls.at(-1)?.[0]).toMatchObject({ q: 'nota' });
    });

    const [fromField, toField] = dateFields();
    await user.type(fromField, '2026-08-01');
    await user.type(toField, '2026-08-31');
    await waitFor(() => {
      expect(mockedFetchHistory.mock.calls.at(-1)?.[0]).toMatchObject({ from: '2026-08-01', to: '2026-08-31' });
    });

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => {
      expect(mockedFetchHistory.mock.calls.at(-1)?.[0]).toMatchObject({ page: 2 });
    });

    await user.click(screen.getByTitle('Ordenar por Quantidade'));

    await waitFor(() => {
      const params = mockedFetchHistory.mock.calls.at(-1)?.[0];
      // Novo critério enviado corretamente.
      expect(params).toMatchObject({ sortBy: 'quantity', sortDir: 'asc' });
      // page volta a 1 — não fica presa na página 2.
      expect(params).toMatchObject({ page: 1 });
      // Busca e datas continuam na consulta: ordenar não descarta o recorte.
      expect(params).toMatchObject({ q: 'nota', from: '2026-08-01', to: '2026-08-31' });
    });
  });

  it('acionar a mesma coluna de novo (asc → desc) também volta para a página 1', async () => {
    mockedFetchHistory.mockResolvedValue({ items, total: 25, page: 1, pageSize: 10 });
    const user = userEvent.setup();
    render(<QuickOutHistoryModal open onOpenChange={vi.fn()} />);
    await waitFor(() => expect(mockedFetchHistory).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => {
      expect(mockedFetchHistory.mock.calls.at(-1)?.[0]).toMatchObject({ page: 2 });
    });

    // Default já é sortBy=date desc; clicar de novo em "Data" alterna para asc.
    await user.click(screen.getByTitle('Ordenar por Data'));

    await waitFor(() => {
      const params = mockedFetchHistory.mock.calls.at(-1)?.[0];
      expect(params).toMatchObject({ sortBy: 'date', sortDir: 'asc', page: 1 });
    });
  });
});
