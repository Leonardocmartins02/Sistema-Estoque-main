import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { fetchProducts } from '../api/products';
import type { Paged, ProductWithBalance } from '../api/types';
import type { Sort } from '../components/ui/DataTable';

import { useDebouncedValue } from './useDebouncedValue';

export type StatusKey = 'OK' | 'ATTN' | 'OUT';
export type ProductSortKey = 'name' | 'sku' | 'balance';

const PAGE_SIZE = 10;

function isProductSortKey(key: string): key is ProductSortKey {
  return key === 'name' || key === 'sku' || key === 'balance';
}

/**
 * Estado de listagem de produtos (busca, página, ordenação, filtro de status)
 * + a query do React Query que os consome. Extraído de `ProductDashboard` para
 * que o dashboard volte a ser um container de orquestração.
 */
export function useProductsQuery() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [sorts, setSorts] = useState<Sort[]>([{ by: 'name', dir: 'asc' }]);
  const [statusFilter, setStatusFilter] = useState<StatusKey[]>([]); // vazio = todos

  // A ordenação enviada ao backend é sempre a primária da tabela — derivada,
  // nunca um segundo estado espelhado (que antes podia divergir).
  const primary = sorts[0];
  const sortBy: ProductSortKey = primary && isProductSortKey(primary.by) ? primary.by : 'name';
  const sortDir = primary?.dir ?? 'asc';

  const query = useQuery<Paged<ProductWithBalance>>({
    queryKey: ['products', debouncedSearch, page, PAGE_SIZE, sortBy, sortDir, statusFilter.join(',')],
    queryFn: () =>
      fetchProducts(debouncedSearch, page, PAGE_SIZE, sortBy, sortDir, statusFilter.length ? statusFilter : undefined),
    staleTime: 15_000,
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;
  const currentPage = query.data?.page ?? page;
  const currentPageSize = query.data?.pageSize ?? PAGE_SIZE;
  const totalPages = Math.max(Math.ceil(total / currentPageSize), 1);

  // Reordenação client-side: o backend já devolve ordenado, mas o nome usa
  // collation pt-BR aqui (acentos) e ordenações secundárias só existem no
  // cliente (Shift + clique no cabeçalho).
  const viewItems = useMemo(() => {
    const arr = [...items];
    if (primary?.by === 'name') {
      const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
      arr.sort((a, b) => (primary.dir === 'asc' ? collator.compare(a.name, b.name) : collator.compare(b.name, a.name)));
    }
    if (sorts.length <= 1) return arr;
    const secondary = sorts.slice(1);
    arr.sort((a, b) => {
      for (const s of secondary) {
        const raw = (row: ProductWithBalance) => (row as unknown as Record<string, unknown>)[s.by];
        let av = raw(a);
        let bv = raw(b);
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av! < bv!) return s.dir === 'asc' ? -1 : 1;
        if (av! > bv!) return s.dir === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return arr;
  }, [items, sorts, primary]);

  const changeSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const changeSorts = useCallback((next: Sort[]) => {
    setSorts(next);
    setPage(1);
  }, []);

  /** Clique no cabeçalho: torna a coluna a ordenação primária e alterna asc/desc. */
  const togglePrimarySort = useCallback((key: ProductSortKey) => {
    setSorts((current) => {
      const head = current[0];
      const dir = !head || head.by !== key ? 'asc' : head.dir === 'asc' ? 'desc' : 'asc';
      const rest = head && head.by === key ? current.slice(1) : current;
      return [{ by: key, dir }, ...rest];
    });
    setPage(1);
  }, []);

  const toggleStatus = useCallback((value: StatusKey) => {
    setStatusFilter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
    setPage(1);
  }, []);

  const clearStatus = useCallback(() => {
    setStatusFilter([]);
    setPage(1);
  }, []);

  /** Usado pelo banner de alerta de estoque baixo (`LowStockBanner`). */
  const showLowStock = useCallback(() => {
    setStatusFilter(['ATTN', 'OUT']);
    setPage(1);
  }, []);

  return {
    // busca
    search,
    setSearch: changeSearch,
    // paginação
    page: currentPage,
    setPage,
    totalPages,
    total,
    // ordenação
    sorts,
    setSorts: changeSorts,
    togglePrimarySort,
    // filtro de status
    statusFilter,
    toggleStatus,
    clearStatus,
    showLowStock,
    // dados
    query,
    items,
    viewItems,
  };
}
