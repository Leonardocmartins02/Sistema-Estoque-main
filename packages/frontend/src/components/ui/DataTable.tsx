import React from 'react';

type Align = 'left' | 'center' | 'right';

export type Column<T> = {
  key: keyof T | string;
  header: string;
  // Cabeçalho custom (render). Se presente, tem precedência sobre o comportamento padrão
  headerRender?: React.ReactNode;
  width?: string; // ex.: 'w-1/3' ou classes tailwind
  align?: Align;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  // Renderizador opcional de filtro por coluna (aparece em uma linha abaixo do cabeçalho)
  filterRender?: React.ReactNode;
};

export type Sort = { by: string; dir: 'asc' | 'desc' };

export type DataTableProps<T> = {
  columns: Column<T>[];
  items: T[];
  // Ordenação simples (legado)
  sort?: Sort;
  onSortChange?: (next: Sort) => void;
  // Ordenação múltipla (preferencial)
  sorts?: Sort[];
  onSortsChange?: (next: Sort[]) => void;
  isLoading?: boolean;
  error?: string | null;
  empty?: React.ReactNode;
  getRowId: (row: T) => string;
  className?: string;
  footer?: React.ReactNode;
};

export function DataTable<T>({
  columns,
  items,
  sort,
  onSortChange,
  sorts,
  onSortsChange,
  isLoading,
  error,
  empty,
  getRowId,
  className = '',
  footer,
}: DataTableProps<T>) {
  const handleSort = (e: React.MouseEvent, col: Column<T>) => {
    if (!col.sortable) return;
    const colKey = String(col.key);
    // Preferir ordenação múltipla quando disponível
    if (onSortsChange) {
      const current = sorts ?? [];
      const idx = current.findIndex((s) => s.by === colKey);
      let next: Sort[] = [];
      const shift = e.shiftKey;
      if (idx === -1) {
        // adicionar asc
        next = shift ? [...current, { by: colKey, dir: 'asc' }] : [{ by: colKey, dir: 'asc' }];
      } else {
        const existing = current[idx];
        if (existing.dir === 'asc') {
          // alterna para desc
          next = [...current.slice(0, idx), { by: colKey, dir: 'desc' }, ...current.slice(idx + 1)];
        } else {
          // remover da lista
          next = [...current.slice(0, idx), ...current.slice(idx + 1)];
          if (!shift && next.length === 0) {
            // se não segurar shift e removemos tudo, deixar somente asc
            next = [{ by: colKey, dir: 'asc' }];
          }
        }
        if (!shift) {
          // sem shift, manter apenas esta coluna
          const self = next.find((s) => s.by === colKey) ?? { by: colKey, dir: 'asc' };
          next = [self];
        }
      }
      onSortsChange(next);
      return;
    }
    // Fallback para ordenação simples
    if (!onSortChange) return;
    const nextDir = sort?.by === colKey && sort?.dir === 'asc' ? 'desc' : 'asc';
    onSortChange({ by: colKey, dir: nextDir });
  };

  const alignClass = (align?: Align) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <div className={`overflow-hidden rounded-lg border bg-white shadow-sm select-none ${className}`}>
      {error && (
        <div className="border-b border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {isLoading && (
        <div className="border-b border-gray-100 p-3 text-sm text-gray-600">Carregando...</div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed border-separate border-spacing-0" role="table">
          {/* Colgroup mantém larguras estáveis entre thead/tbody */}
          <colgroup>
            {columns.map((col) => (
              <col key={String(col.key)} className={col.width || ''} />
            ))}
          </colgroup>
          <thead className="bg-gray-50/90 backdrop-blur-sm select-none" role="rowgroup">
            <tr role="row">
              {columns.map((col) => {
                const isSorted = sorts
                  ? (sorts ?? []).some((s) => s.by === String(col.key))
                  : sort?.by === String(col.key);
                const dir = sorts
                  ? (sorts ?? []).find((s) => s.by === String(col.key))?.dir
                  : isSorted
                  ? sort?.dir
                  : undefined;
                return (
                  <th
                    key={String(col.key)}
                    scope="col"
                    role="columnheader"
                    aria-sort={isSorted ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 first:rounded-tl-lg last:rounded-tr-lg select-none whitespace-nowrap ${
                      alignClass(col.align)
                    } ${col.width || ''}`}
                  >
                    {col.headerRender ? (
                      col.headerRender
                    ) : col.sortable ? (
                      <button
                        type="button"
                        onClick={(ev) => handleSort(ev, col)}
                        className="group inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white select-none"
                        aria-label={`Ordenar por ${col.header}`}
                        title={`Ordenar por ${col.header}`}
                      >

                        <span
                          aria-hidden="true"
                          className={`transition-transform text-gray-400 group-hover:text-gray-700 ${
                            isSorted && dir === 'desc' ? 'rotate-180' : ''
                          }`}
                        >
                          ▲
                        </span>
                      </button>
                    ) : (
                      <span className="inline-block text-gray-700">{col.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
            {columns.some((c) => !!c.filterRender) && (
              <tr role="row" className="bg-gray-50">
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className={`px-4 py-2 text-xs font-normal text-gray-600 ${alignClass(col.align)} ${col.width || ''}`}
                    scope="col"
                  >
                    {col.filterRender ?? null}
                  </th>
                ))}
              </tr>
            )}
          </thead>

          <tbody role="rowgroup" className="select-none">
            {items.length === 0 && !isLoading ? (
              <tr role="row">
                <td role="cell" colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                  {empty ?? 'Nenhum item encontrado.'}
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const id = getRowId(row);
                return (
                  <tr
                    key={id}
                    role="row"
                    tabIndex={0}
                    className="hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    {columns.map((col) => (
                      <td
                        key={String(col.key)}
                        role="cell"
                        className={`border-t border-gray-100 px-4 py-3 text-sm text-gray-800 select-none ${alignClass(
                          col.align
                        )}`}
                      >
                        {col.render ? col.render(row) : String((row as any)[col.key])}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {footer ? <div className="border-t border-gray-100 px-4 py-3">{footer}</div> : null}
    </div>
  );
}

export default DataTable;
