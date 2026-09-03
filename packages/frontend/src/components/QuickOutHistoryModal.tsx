import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';

import {
  fetchQuickOutHistory,
  type QuickOutHistoryItem,
  type QuickOutHistorySortBy,
  type QuickOutHistorySortDir,
} from '../api/quickOut';
import type { Paged } from '../api/types';
import { formatQuantity } from '../lib/formatNumber';

import Button from './ui/Button';
import { Modal } from './ui/Modal';

export type QuickOutHistoryModalProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

/** Página fixa — configuração interna, sem decisão de produto. */
const PAGE_SIZE = 10;

/**
 * Cabeçalho ordenável, definido no módulo e não dentro do componente: um
 * componente recriado a cada render é um tipo novo a cada render, e o React
 * remontaria o botão — quem acabou de clicar para ordenar perderia o foco.
 *
 * A seta é `aria-hidden` e quem anuncia a direção é o `aria-sort` do `<th>`,
 * como em `ui/DataTable` e no `QuickOutListModal`. Os dois andam juntos:
 * esconder o glifo sem `aria-sort` deixaria a direção sem nenhum anúncio.
 */
function SortHeader({
  label,
  title,
  active,
  dir,
  onSort,
}: {
  label: string;
  /**
   * Dica de mouse, separada do rótulo visível de propósito: a coluna se chama
   * "Qtde" na tela por espaço, mas a dica diz "Quantidade". Derivar o `title`
   * do `label` encolheria a dica junto com a coluna.
   */
  title: string;
  active: boolean;
  dir: QuickOutHistorySortDir;
  onSort: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      onClick={onSort}
      title={title}
    >
      {label}
      {/*
        `text-text-secondary` (gray-600) e não `text-gray-400`: o glifo é objeto
        gráfico que comunica estado só visualmente, e gray-400 sobre o
        `bg-gray-50` do cabeçalho fica em ~2,4:1 — abaixo dos 3:1 de WCAG
        1.4.11. É o mesmo `text-gray-400` reprovado do M-4, na mesma tela.
      */}
      <span
        aria-hidden="true"
        className={`text-text-secondary ${active && dir === 'desc' ? 'rotate-180' : ''}`}
      >
        ▲
      </span>
    </button>
  );
}

/**
 * Histórico de baixas rápidas, migrado para o primitivo único de diálogo e
 * para React Query (Task 23). É o terceiro e último `createPortal` manual do
 * `src/`.
 *
 * O que saiu daqui, item a item:
 *
 * - o portal montado à mão, sem `role="dialog"`, `aria-modal`,
 *   `aria-labelledby`, focus trap, retorno de foco ou bloqueio de scroll (C-1);
 * - `fetch` manual em `useEffect`, sem cancelamento (F-02): duas consultas em
 *   voo podiam resolver fora de ordem e a mais lenta sobrescrevia a mais nova;
 * - `try/finally` **sem `catch`** (N-6): a promessa rejeitada ficava sem
 *   tratamento e a tela dizia "Nenhuma baixa encontrada." — o erro de API
 *   aparecia como resultado vazio, dois estados com saídas opostas;
 * - `overflow-hidden` + `table-fixed` cortando a tabela no mobile, sem rolagem,
 *   e a busca de largura fixa `w-72` no cabeçalho (N-7 — o mesmo UF-29 da
 *   lista);
 * - busca e campos de data sem `<label>` (N-8);
 * - o separador "até" em `text-gray-400`, 2,5:1 (M-4) — ele deixa de ser texto
 *   decorativo solto e vira o rótulo real do segundo campo de data, o que
 *   resolve M-4 e N-8 no mesmo movimento.
 *
 * **N-9 preservado (QOH-8):** busca, datas e página vivem em `useState` deste
 * componente, que o `ProductDashboard` monta uma única vez e só alterna via
 * `open`. Fechar e reabrir devolve a pessoa ao mesmo recorte.
 *
 * **Empilhamento lista→histórico (ORD-01, REV-15):** este diálogo abre por
 * cima do `QuickOutListModal`, que permanece montado e inerte. Um único
 * `aria-modal` exposto, um único focus trap e o foco voltando ao gatilho
 * dentro da lista ao fechar — tudo vindo do primitivo: o `FocusScope` do Radix
 * mantém uma pilha e pausa o escopo de baixo, o `DismissableLayer` só entrega
 * Escape à camada do topo, e `ui/Modal` restaura o foco no elemento ativo no
 * instante da abertura, que é o botão "Histórico de Baixas" da lista.
 */
export default function QuickOutHistoryModal({ open, onOpenChange }: QuickOutHistoryModalProps) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortBy, setSortBy] = useState<QuickOutHistorySortBy>('date');
  const [sortDir, setSortDir] = useState<QuickOutHistorySortDir>('desc');
  const searchId = useId();
  const fromId = useId();
  const toId = useId();

  /**
   * Chave por termo/datas/página/ordenação — trocar qualquer um deles é uma
   * consulta nova, e o React Query cancela/descarta a anterior: fim do F-02.
   * `sortBy`/`sortDir` entram na chave porque desde a Task 3 (D-A) a ordenação
   * é global e resolvida no banco, antes da paginação — duas direções são dois
   * recursos distintos, não a mesma página reordenada em memória.
   *
   * **Sem `staleTime`** (default 0): voltar a uma página já vista precisa
   * pedi-la de novo, senão "Anterior" exibiria dados velhos sem consultar. É
   * também o que faz QOH-8 continuar observável — ao reabrir, o recorte
   * preservado vira uma consulta real com os mesmos parâmetros.
   *
   * `enabled: open` porque `ProductDashboard` mantém este componente montado o
   * tempo todo: sem isso o histórico seria buscado com o diálogo fechado, o
   * que o `if (!open) return` anterior impedia por acidente.
   */
  const historyQuery = useQuery<Paged<QuickOutHistoryItem>>({
    queryKey: ['quick-out-history', q, from, to, page, PAGE_SIZE, sortBy, sortDir],
    queryFn: () =>
      fetchQuickOutHistory({
        page,
        pageSize: PAGE_SIZE,
        q,
        from: from || undefined,
        to: to || undefined,
        sortBy,
        sortDir,
      }),
    enabled: open,
  });

  const rows = historyQuery.data?.items ?? [];
  const total = historyQuery.data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const isLoading = historyQuery.isLoading;
  const isError = historyQuery.isError;
  const errorMessage = (historyQuery.error as Error)?.message || 'Erro ao carregar o histórico';

  function sortByColumn(key: QuickOutHistorySortBy) {
    // Ordenar volta para a primeira página — sem isso a pessoa ordena e cai
    // numa página vazia.
    setPage(1);
    setSortDir((d) => (sortBy === key ? (d === 'asc' ? 'desc' : 'asc') : key === 'date' ? 'desc' : 'asc'));
    setSortBy(key);
  }

  const ariaSort = (column: QuickOutHistorySortBy) =>
    sortBy === column ? ({ 'aria-sort': sortDir === 'asc' ? 'ascending' : 'descending' } as const) : {};

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Histórico de Baixas"
      description="Consulte todas as baixas (OUT) registradas no sistema."
      size="4xl"
    >
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          {/* Rótulo visível e associado (N-8). O `placeholder` sozinho some ao
              digitar e não é nome acessível confiável. */}
          <label htmlFor={searchId} className="block text-xs font-medium text-gray-700">
            Buscar por Nome, SKU ou Observação
          </label>
          <input
            id={searchId}
            type="search"
            placeholder="Ex.: caneta, CAN-001, setor B"
            className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <label htmlFor={fromId} className="block text-xs font-medium text-gray-700">
            De
          </label>
          <input
            id={fromId}
            type="date"
            className="mt-1 rounded-control border border-border-strong px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          {/*
            M-4: o "até" era um `<span className="text-gray-400">` solto entre
            os dois campos — 2,5:1, e sem função semântica. Como rótulo do
            segundo campo ele passa a `text-gray-700`, ganha alvo de clique e
            nome acessível.
          */}
          <label htmlFor={toId} className="block text-xs font-medium text-gray-700">
            Até
          </label>
          <input
            id={toId}
            type="date"
            className="mt-1 rounded-control border border-border-strong px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {/*
          No erro o total é DESCONHECIDO, não zero. "0 registro(s)" é a mesma
          leitura "não há nada aqui" que N-6 acabou de tirar da célula da
          tabela. `—` é a convenção de ausência do projeto.
        */}
        <div className="whitespace-nowrap pb-2 text-xs text-gray-500">
          {isLoading ? '...' : isError ? '—' : `${total} registro(s)`}
        </div>
      </div>

      {/*
        Live regions SEMPRE montadas — mesmo padrão do `QuickOutListModal` e do
        `MovementHistoryModal`: uma região criada no mesmo instante do conteúdo
        costuma não ser anunciada. Sem elas, filtrar, ordenar e paginar são
        operações inteiramente silenciosas para quem usa leitor de tela.

        Ficam FORA da `<table>`: pendurar o `role` na célula de estado
        substituiria o papel implícito `cell` e deixaria a `<tr>` com um filho
        inválido para `row`. O texto visível da tabela não leva `role`: quem
        anuncia é esta região, e não as duas ao mesmo tempo.
      */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
        data-testid="quick-out-history-status"
      >
        {isLoading
          ? 'Carregando histórico.'
          : isError
            ? ''
            : rows.length === 0
              ? 'Nenhuma baixa encontrada para o filtro atual.'
              : /* Número CRU, sem `formatQuantity`: "1.250" é lido como "um ponto
                   duzentos e cinquenta" por alguns sintetizadores. O separador de
                   milhar é decisão tipográfica da tabela, não da fala. */
                `${total} ${total === 1 ? 'baixa encontrada' : 'baixas encontradas'}, exibindo a página ${page} de ${totalPages}.`}
      </div>
      {/* No erro o status cala: consulta que falhou não tem total conhecido, e
          repetir a falha nos dois canais faria o leitor dizer tudo duas vezes. */}
      <div
        role="alert"
        aria-live="assertive"
        className="sr-only"
        data-testid="quick-out-history-alert"
      >
        {isError ? `Erro: ${errorMessage}` : ''}
      </div>

      {/* N-7: a tabela rola na horizontal em vez de ser cortada. O
          `overflow-hidden` anterior escondia Data e Observação no mobile — é o
          mesmo clipping do UF-29, que estava registrado só para a lista. */}
      <div className="overflow-x-auto rounded-surface border bg-white">
        {/* `w-full` para ocupar a região no desktop; `min-w-[48rem]` para que em
            375px a tabela seja MAIOR que o contêiner e a rolagem horizontal de
            fato exista. */}
        <table className="w-full min-w-[48rem] table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                {...ariaSort('productName')}
                className="w-[32%] px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600"
              >
                <SortHeader
                  label="Produto"
                  title="Ordenar por Produto"
                  active={sortBy === 'productName'}
                  dir={sortDir}
                  onSort={() => sortByColumn('productName')}
                />
              </th>
              <th
                scope="col"
                {...ariaSort('productSku')}
                className="w-[18%] px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600"
              >
                <SortHeader
                  label="SKU"
                  title="Ordenar por SKU"
                  active={sortBy === 'productSku'}
                  dir={sortDir}
                  onSort={() => sortByColumn('productSku')}
                />
              </th>
              <th
                scope="col"
                {...ariaSort('quantity')}
                className="w-[10%] px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-600"
              >
                <SortHeader
                  label="Qtde"
                  title="Ordenar por Quantidade"
                  active={sortBy === 'quantity'}
                  dir={sortDir}
                  onSort={() => sortByColumn('quantity')}
                />
              </th>
              <th
                scope="col"
                {...ariaSort('date')}
                className="w-[20%] px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600"
              >
                <SortHeader
                  label="Data"
                  title="Ordenar por Data"
                  active={sortBy === 'date'}
                  dir={sortDir}
                  onSort={() => sortByColumn('date')}
                />
              </th>
              <th
                scope="col"
                className="w-[20%] px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600"
              >
                Observação
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                  Carregando histórico...
                </td>
              </tr>
            ) : isError ? (
              // N-6: o erro tem texto próprio, cor própria e a mensagem que a
              // API devolveu. Nunca mais confundido com "não há nada aqui".
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-danger">
                  {errorMessage}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                  Nenhuma baixa encontrada.
                </td>
              </tr>
            ) : (
              rows.map((m) => (
                <tr key={m.id}>
                  <td className="border-t border-gray-100 px-4 py-3 text-sm text-gray-800">
                    {m.productName}
                  </td>
                  <td className="border-t border-gray-100 px-4 py-3 text-sm uppercase text-gray-600">
                    {m.productSku}
                  </td>
                  <td className="border-t border-gray-100 px-4 py-3 text-right text-sm tabular-nums text-gray-800">
                    {formatQuantity(m.quantity)}
                  </td>
                  <td className="border-t border-gray-100 px-4 py-3 text-sm text-gray-700">
                    {m.date ? new Date(m.date).toLocaleString('pt-BR') : '—'}
                  </td>
                  {/* QOH-6: a célula nunca fica muda — `—` é a convenção de
                      ausência do projeto. */}
                  <td className="border-t border-gray-100 px-4 py-3 text-sm text-gray-700">
                    {m.note || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Consulta falhada não tem paginação: `totalPages` cairia para 1 e a
          barra afirmaria "Página 1 de 1", inventando um resultado que não
          existe. Mesma razão do contador acima. */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {isError ? 'Página indisponível' : `Página ${page} de ${totalPages}`}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={isError || page <= 1}
          >
            Anterior
          </Button>
          <Button
            variant="ghost"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={isError || page >= totalPages}
          >
            Próxima
          </Button>
        </div>
      </div>
    </Modal>
  );
}
