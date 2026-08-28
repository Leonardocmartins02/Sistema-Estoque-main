import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteProduct, fetchProductStockSummary, fetchProducts } from '../src/api/products';
import type { ProductWithBalance } from '../src/api/types';
import { ProductDashboard } from '../src/components/ProductDashboard';
import { useProductMutations } from '../src/hooks/useProductMutations';
import { useProductsQuery } from '../src/hooks/useProductsQuery';
import { ToastProvider } from '../src/components/ui/ToastProvider';

vi.mock('../src/api/products', () => ({
  fetchProducts: vi.fn(),
  deleteProduct: vi.fn(),
  fetchProductStockSummary: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  fetchProduct: vi.fn(),
}));

// Mocks "abertos": por padrão chamam a implementação real (usada pelos testes
// de F-04, que precisam do estado real de paginação/seleção). O describe de
// F-08 sobrescreve o retorno para isolar a ordem das chamadas do handler.
vi.mock('../src/hooks/useProductsQuery', async () => {
  const actual = await vi.importActual<typeof import('../src/hooks/useProductsQuery')>(
    '../src/hooks/useProductsQuery',
  );
  return { ...actual, useProductsQuery: vi.fn(actual.useProductsQuery) };
});

vi.mock('../src/hooks/useProductMutations', async () => {
  const actual = await vi.importActual<typeof import('../src/hooks/useProductMutations')>(
    '../src/hooks/useProductMutations',
  );
  return { ...actual, useProductMutations: vi.fn(actual.useProductMutations) };
});

const mockedFetchProducts = vi.mocked(fetchProducts);
const mockedDeleteProduct = vi.mocked(deleteProduct);
const mockedFetchProductStockSummary = vi.mocked(fetchProductStockSummary);

function makeProduct(n: number): ProductWithBalance {
  const id = String(n).padStart(2, '0');
  return {
    id: `p${id}`,
    name: `Produto ${id}`,
    sku: `SKU-${id}`,
    description: null,
    minStock: 1,
    balance: 10,
    createdAt: '2027-01-01T00:00:00.000Z',
    updatedAt: '2027-01-01T00:00:00.000Z',
  };
}

const page1Items = Array.from({ length: 10 }, (_, i) => makeProduct(i + 1));
const page2Items = Array.from({ length: 10 }, (_, i) => makeProduct(i + 11));

function renderWithProviders(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

describe('ProductDashboard — seleção não atravessa paginação (F-04)', () => {
  beforeEach(() => {
    mockedFetchProducts.mockReset();
    mockedDeleteProduct.mockReset();
    mockedFetchProductStockSummary.mockReset();
    mockedFetchProductStockSummary.mockResolvedValue({ ok: 20, attn: 0, out: 0 });
    mockedFetchProducts.mockImplementation(async (_search, page = 1) => ({
      items: page === 1 ? page1Items : page2Items,
      total: 20,
      page,
      pageSize: 10,
    }));
  });

  it('limpa a seleção ao mudar de página e não deixa itens da página anterior alcançáveis por ação em lote', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);

    const checkbox = await screen.findByLabelText('Selecionar Produto 01');
    await user.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(screen.getByRole('button', { name: 'Excluir (1)' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Próxima →' }));
    await waitFor(() => expect(screen.getByText('Página 2 de 2')).toBeInTheDocument());

    // O produto marcado nem está mais na tela...
    expect(screen.queryByLabelText('Selecionar Produto 01')).not.toBeInTheDocument();
    // ...e a ação em lote fica indisponível: não há como ela atingir um item
    // que ficou para trás na página anterior.
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled();
  });
});

describe('ProductDashboard — ordem de operações ao excluir a página (F-08)', () => {
  const callOrder: string[] = [];

  const items = [makeProduct(11), makeProduct(12)]; // página 2, N != 1

  const setPage = vi.fn((...args: unknown[]) => {
    callOrder.push('setPage');
    return args;
  });

  const removeProductsMutate = vi.fn(() => {
    callOrder.push('removeProducts.mutate');
  });

  beforeEach(() => {
    callOrder.length = 0;
    setPage.mockClear();
    removeProductsMutate.mockClear();
    mockedFetchProductStockSummary.mockReset();
    mockedFetchProductStockSummary.mockResolvedValue({ ok: 12, attn: 0, out: 0 });

    vi.mocked(useProductsQuery).mockReturnValue({
      search: '',
      setSearch: vi.fn(),
      page: 2,
      setPage,
      totalPages: 2,
      total: 12,
      sorts: [{ by: 'name', dir: 'asc' }],
      setSorts: vi.fn(),
      togglePrimarySort: vi.fn(),
      statusFilter: [],
      toggleStatus: vi.fn(),
      clearStatus: vi.fn(),
      showLowStock: vi.fn(),
      query: { isError: false, isLoading: false, isFetching: false, error: null } as never,
      items,
      viewItems: items,
    } as never);

    vi.mocked(useProductMutations).mockReturnValue({
      removeProduct: { mutate: vi.fn(), isPending: false } as never,
      zeroBalance: { mutate: vi.fn(), isPending: false } as never,
      removeProducts: { mutate: removeProductsMutate, isPending: false } as never,
      zeroBalances: { mutate: vi.fn(), isPending: false } as never,
      invalidateProducts: vi.fn(),
    });
  });

  it('dispara a exclusão da página atual antes de trocar para a página 1', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDashboard />);

    await user.click(screen.getByRole('button', { name: 'Excluir página' }));
    await user.click(await screen.findByRole('button', { name: 'Excluir página' }));

    await waitFor(() => expect(removeProductsMutate).toHaveBeenCalledWith(items));
    expect(setPage).toHaveBeenCalledWith(1);

    // O bug documentado: a tela salta para a página 1 ANTES de a exclusão
    // dos itens da página N ser disparada — o que se vê deixa de
    // corresponder ao que está sendo apagado.
    expect(callOrder).toEqual(['removeProducts.mutate', 'setPage']);
  });
});
