import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchProducts } from '../src/api/products';
import { fetchQuickOutHistory } from '../src/api/quickOut';
import QuickOutHistoryModal from '../src/components/QuickOutHistoryModal';
import { DataTable } from '../src/components/ui/DataTable';
import { useProductsQuery } from '../src/hooks/useProductsQuery';

import { makeProduct } from './helpers/factories';

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
