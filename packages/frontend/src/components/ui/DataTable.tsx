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
  /** Algarismos tabulares (design-system.md §5.3) — colunas numéricas comparáveis. */
  tabularNums?: boolean;
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
  /**
   * Ordenação de coluna única.
   *
   * O ramo `event.shiftKey`, que acumulava critérios secundários (UF-08), saiu
   * na Task 3 (D-D): a secundária era aplicada **só sobre a página carregada**
   * enquanto a primária ia ao banco — invisível e enganosa. Ordenação
   * multi-coluna server-side, com precedência comunicada, é desproporcional
   * agora; a capacidade volta ao backlog com a condição de só retornar com
   * suporte real e precedência visível.
   */
  const handleSort = (_e: React.MouseEvent, col: Column<T>) => {
    if (!col.sortable) return;
    const colKey = String(col.key);
    if (onSortsChange) {
      const current = sorts ?? [];
      const existing = current.find((s) => s.by === colKey);
      const dir: Sort['dir'] = existing?.dir === 'asc' ? 'desc' : 'asc';
      onSortsChange([{ by: colKey, dir }]);
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
    // Região de dados, não card (design-system.md §13): borda, sem sombra,
    // radius-surface. Sem `max-width` próprio — ocupa a largura do shell (D-B).
    <div className={`overflow-hidden rounded-surface border bg-white ${className}`}>
      {error && (
        <div role="alert" className="border-b border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {isLoading && (
        <div role="status" className="border-b border-gray-100 p-3 text-sm text-gray-700">
          Carregando...
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed border-separate border-spacing-0" role="table">
          {/* Colgroup mantém larguras estáveis entre thead/tbody */}
          <colgroup>
            {columns.map((col) => (
              <col key={String(col.key)} className={col.width || ''} />
            ))}
          </colgroup>
          <thead className="bg-gray-50" role="rowgroup">
            <tr role="row">
              {columns.map((col) => {
                // Somente a ordenação PRIMÁRIA (`sorts[0]`) pode anunciar
                // aria-sort. Um chamador pode, em tese, passar mais de um
                // critério em `sorts` (a prop ainda aceita `Sort[]`) — mesmo
                // assim, só o índice 0 é tratado como ativo aqui. Ordenação
                // múltipla não existe mais no produto (Task 3 / UF-08 / D-D):
                // anunciar mais de um cabeçalho como ordenado contradiz o
                // que de fato chega ao backend (só `sorts[0]`).
                const primary = sorts?.[0];
                const isSorted = sorts ? primary?.by === String(col.key) : sort?.by === String(col.key);
                const dir = sorts ? (isSorted ? primary?.dir : undefined) : isSorted ? sort?.dir : undefined;
                return (
                  <th
                    key={String(col.key)}
                    scope="col"
                    role="columnheader"
                    // A-8ʳ: aria-sort só existe na ordenação PRIMÁRIA. Nos demais
                    // cabeçalhos o atributo é omitido — "none" em todo cabeçalho
                    // não ordenado virava ruído (§13.3).
                    {...(isSorted ? { 'aria-sort': dir === 'asc' ? 'ascending' : 'descending' } : {})}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 first:rounded-tl-surface last:rounded-tr-surface whitespace-nowrap ${
                      alignClass(col.align)
                    } ${col.width || ''}`}
                  >
                    {col.headerRender ? (
                      col.headerRender
                    ) : col.sortable ? (
                      <button
                        type="button"
                        onClick={(ev) => handleSort(ev, col)}
                        // select-none fica restrito ao cabeçalho CLICÁVEL (§13.2/A-5) —
                        // as células de dados abaixo voltaram a ser selecionáveis.
                        className="group inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-white select-none"
                        aria-label={`Ordenar por ${col.header}`}
                        title={`Ordenar por ${col.header}`}
                      >
                        {/* M-8: rótulo sempre visível — o indicador acompanha, nunca substitui. */}
                        <span>{col.header}</span>
                        <span
                          aria-hidden="true"
                          className={`transition-transform text-text-secondary group-hover:text-gray-700 ${
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

          <tbody role="rowgroup">
            {items.length === 0 && !isLoading ? (
              <tr role="row">
                <td role="cell" colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                  {/* A-12ʳ: erro e carregando já eram anunciados; vazio ficava mudo. */}
                  <span role="status">{empty ?? 'Nenhum item encontrado.'}</span>
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const id = getRowId(row);
                return (
                  // A linha NÃO é acionável: todas as ações (selecionar, expandir
                  // descrição, movimentar, menu) são controles nativos dentro das
                  // células. Um `tabIndex={0}` aqui só criava uma parada de tab
                  // que não faz nada — por isso foi removido.
                  //
                  // Receita de linha selecionada, reservada para a Task 13
                  // (design-system.md §13.3): fundo `accent-subtle` + barra
                  // lateral `accent` de 2px — dois sinais, nunca só cor. Esta
                  // task não introduz o prop de seleção (nenhum critério de
                  // aceite ou teste exige a API ainda); só documenta o padrão.
                  <tr key={id} role="row" className="hover:bg-gray-50">
                    {columns.map((col) => (
                      <td
                        key={String(col.key)}
                        role="cell"
                        // Célula de dados voltou a ser selecionável (A-5) — copiar
                        // um SKU com o mouse é tarefa diária em estoque.
                        className={`border-t border-gray-100 px-4 py-3 text-sm text-gray-800 ${alignClass(
                          col.align
                        )} ${col.tabularNums ? 'tabular-nums' : ''}`}
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
