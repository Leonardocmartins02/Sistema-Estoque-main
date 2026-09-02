import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';

import { fetchProducts } from '../api/products';
import type { Paged, ProductWithBalance } from '../api/types';

import { productStatus } from './products/types';
import Badge from './ui/Badge';
import Button from './ui/Button';
import { Modal } from './ui/Modal';

export type QuickOutListModalProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (p: ProductWithBalance) => void;
  onOpenHistory?: () => void;
};

type SortBy = 'name' | 'sku' | 'balance';
type SortDir = 'asc' | 'desc';

/** Página fixa — configuração interna, sem decisão de produto (§9.3 item 16). */
const PAGE_SIZE = 10;

/**
 * Cabeçalho ordenável. A seta é `aria-hidden` (M-5): "▲" era lido como
 * "triângulo apontando para cima" no meio do nome do controle. Quem anuncia a
 * direção passa a ser o `aria-sort` do `<th>`, como em `ui/DataTable`.
 *
 * Definido no módulo, não dentro do componente: um componente recriado a cada
 * render é um tipo novo a cada render, e o React remontaria o botão — quem
 * acabou de clicar para ordenar perderia o foco.
 */
function SortHeader({
  label,
  active,
  dir,
  onSort,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onSort: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      onClick={onSort}
      // `title` mantido do código anterior: não altera o nome acessível (o
      // conteúdo tem precedência), e é a única dica de que o cabeçalho ordena
      // para quem usa mouse.
      title={`Ordenar por ${label}`}
    >
      {label}
      {/*
        `text-text-secondary` (gray-600) e não `text-gray-400`: com a seta agora
        `aria-hidden`, ela é objeto gráfico que comunica estado só visualmente, e
        gray-400 sobre o `bg-gray-50` do cabeçalho fica em ~2,4:1 — abaixo dos
        3:1 de WCAG 1.4.11. Mesmo token de `ui/DataTable`.
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
 * Seleção de produto para a baixa rápida, migrada para o primitivo único de
 * diálogo e para React Query (Task 22).
 *
 * O que saiu daqui, item a item:
 *
 * - o portal montado à mão, sem `role="dialog"`, `aria-modal`,
 *   `aria-labelledby`, focus trap, retorno de foco ou bloqueio de scroll (C-1);
 * - `if (!open) return null` **antes de oito hooks** (A-12) — os hooks agora são
 *   incondicionais por construção, e quem decide montar ou não é o `Modal`;
 * - `fetch` manual em `useEffect`, sem cancelamento (F-02): duas consultas em
 *   voo podiam resolver fora de ordem e a mais lenta sobrescrevia a mais nova;
 * - `try/finally` **sem `catch`** (N-6): a promessa rejeitada ficava sem
 *   tratamento e a tela dizia "Nenhum produto disponível." — o erro de API
 *   aparecia como resultado vazio, dois estados com saídas opostas;
 * - `colSpan={4}` numa tabela de cinco colunas (N-2);
 * - `overflow-hidden` cortando a tabela no mobile, sem rolagem (UF-29);
 * - a segunda implementação da regra de estoque, que divergia da canônica no
 *   limite `balance=0, minStock=0` e renderizava dois badges contraditórios
 *   (N-5) — agora o status vem de `productStatus()`, fixado em PS-1;
 * - a busca sem `<label>`, só com `placeholder` (B-7);
 * - a linha alcançável apenas pelo mouse.
 *
 * **Empilhamento (QOL-9):** "Histórico de Baixas" continua abrindo o histórico
 * **sem fechar** esta lista. O critério completo — um único `aria-modal`
 * exposto, um único trap, foco voltando ao gatilho daqui — pertence à Task 23:
 * enquanto o histórico ainda for um portal manual sem trap, um teste de foco
 * falharia por um motivo que só aquela task resolve (achado ORD-01).
 */
export default function QuickOutListModal({
  open,
  onOpenChange,
  onPick,
  onOpenHistory,
}: QuickOutListModalProps) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement | null>(null);

  /**
   * Chave por termo/página/ordenação: trocar qualquer um deles é uma consulta
   * nova, e o React Query cancela/descarta a anterior — fim do F-02.
   *
   * O prefixo `products` é deliberado: `useProductMutations` invalida
   * `['products']`, e a lista daqui é o mesmo recurso. O segundo segmento a
   * mantém separada da listagem do dashboard, que tem filtro de status próprio
   * e `staleTime` de 15s.
   *
   * **Sem `staleTime`** (default 0): voltar para uma página já visitada precisa
   * pedi-la à API de novo. Com cache fresco, "Anterior" exibiria dados velhos
   * sem consultar — que é exatamente o que QOL-8 afirma não acontecer.
   *
   * `enabled: open` porque `ProductDashboard` mantém este componente montado o
   * tempo todo: sem isso a lista de produtos seria buscada com o diálogo
   * fechado, o que o `return null` anterior impedia por acidente.
   */
  const productsQuery = useQuery<Paged<ProductWithBalance>>({
    queryKey: ['products', 'quick-out-list', query, page, PAGE_SIZE, sortBy, sortDir],
    queryFn: () => fetchProducts(query, page, PAGE_SIZE, sortBy, sortDir),
    enabled: open,
  });

  const rows = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const isLoading = productsQuery.isLoading;
  const isError = productsQuery.isError;
  const errorMessage = (productsQuery.error as Error)?.message || 'Erro ao carregar produtos';

  // Foco inicial declarado (QOL-1): o Radix focaria o primeiro tabulável do
  // diálogo — "Histórico de Baixas", no cabeçalho. O que a pessoa veio fazer
  // aqui é procurar um produto. O `setTimeout` roda depois do foco automático
  // do Radix, já dentro do trap.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  function sortByColumn(key: SortBy) {
    // Ordenar volta para a primeira página (QOL-5) — sem isso a pessoa ordena e
    // cai numa página vazia.
    setPage(1);
    setSortDir((d) => (sortBy === key ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortBy(key);
  }

  const ariaSort = (column: SortBy) =>
    sortBy === column ? ({ 'aria-sort': sortDir === 'asc' ? 'ascending' : 'descending' } as const) : {};

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Selecionar Produto para Baixa"
      description="Escolha um produto da lista abaixo para realizar a Baixa Rápida ou visualize o histórico de baixas."
      size="3xl"
      // O "Fechar" explícito (QOL-10) passa a ser o do primitivo, com nome
      // acessível "Fechar" e glifo decorativo. Um segundo controle com o mesmo
      // nome no cabeçalho seria dois caminhos idênticos para a mesma saída.
      headerActions={
        onOpenHistory && (
          <Button variant="secondary" onClick={() => onOpenHistory()}>
            Histórico de Baixas
          </Button>
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[12rem] flex-1">
          {/* Rótulo visível e associado (B-7). O `placeholder` sozinho some ao
              digitar e não é nome acessível confiável. */}
          <label htmlFor={searchId} className="block text-xs font-medium text-gray-700">
            Buscar por Nome ou SKU
          </label>
          <input
            id={searchId}
            ref={searchRef}
            type="search"
            placeholder="Ex.: caneta, CAN-001"
            className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {/*
          No erro o total é DESCONHECIDO, não zero. "0 item(ns)" ao lado da
          busca é a mesma leitura "não há nada aqui" que N-6 acabou de tirar da
          célula da tabela — o texto secundário não pode desdizer o principal.
          `—` é a convenção de ausência do projeto (`formatBalanceTransition`).
        */}
        <div className="whitespace-nowrap text-xs text-gray-500">
          {isLoading ? '...' : isError ? '—' : `${total} item(ns)`}
        </div>
      </div>

      {/*
        Live regions SEMPRE montadas — mesmo padrão de `ui/ApiStatusBanner` e do
        `MovementHistoryModal`: uma região criada no mesmo instante do conteúdo
        costuma não ser anunciada. Sem elas, buscar, ordenar e paginar são
        operações inteiramente silenciosas para quem usa leitor de tela.

        O texto visível na tabela não leva `role`: quem anuncia é esta região, e
        não as duas ao mesmo tempo.
      */}
      <div role="status" aria-live="polite" className="sr-only" data-testid="quick-out-list-status">
        {isLoading
          ? 'Carregando produtos.'
          : isError
            ? ''
            : rows.length === 0
              ? 'Nenhum produto disponível para a busca atual.'
              : `${total} ${total === 1 ? 'produto encontrado' : 'produtos encontrados'}, exibindo a página ${page} de ${totalPages}.`}
      </div>
      <div role="alert" aria-live="assertive" className="sr-only" data-testid="quick-out-list-alert">
        {isError ? `Erro: ${errorMessage}` : ''}
      </div>

      {/* UF-29: a tabela rola na horizontal em vez de ser cortada. O
          `overflow-hidden` anterior escondia Mín. Estoque e Status no mobile —
          e esta é a única tela que mostra saldo e mínimo juntos (C-6). */}
      <div className="overflow-x-auto rounded-surface border bg-white">
        {/*
          `w-full` para ocupar a região no desktop; `min-w-[42rem]` para que em
          375px a tabela seja MAIOR que o contêiner e a rolagem horizontal de
          fato exista. Só `min-w-full` com larguras percentuais não resolve
          UF-29: a tabela caberia sempre, e as cinco colunas se espremeriam até
          ficarem ilegíveis em vez de rolarem.
        */}
        <table className="w-full min-w-[42rem] table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                {...ariaSort('name')}
                className="w-[40%] px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600"
              >
                <SortHeader
                  label="Nome do Produto"
                  active={sortBy === 'name'}
                  dir={sortDir}
                  onSort={() => sortByColumn('name')}
                />
              </th>
              <th
                scope="col"
                {...ariaSort('sku')}
                className="w-[20%] px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600"
              >
                <SortHeader
                  label="SKU"
                  active={sortBy === 'sku'}
                  dir={sortDir}
                  onSort={() => sortByColumn('sku')}
                />
              </th>
              <th
                scope="col"
                {...ariaSort('balance')}
                className="w-[12%] px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-600"
              >
                <SortHeader
                  label="Saldo"
                  active={sortBy === 'balance'}
                  dir={sortDir}
                  onSort={() => sortByColumn('balance')}
                />
              </th>
              <th
                scope="col"
                className="w-[13%] px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-600"
              >
                Mín. Estoque
              </th>
              <th
                scope="col"
                className="w-[20%] px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600"
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {/* N-2: cinco colunas, `colSpan={5}`. Com 4 a célula de estado não
                cobria a linha inteira. */}
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                  Carregando produtos...
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
                  Nenhum produto disponível.
                </td>
              </tr>
            ) : (
              rows.map((p) => {
                // Regra canônica (`products/types.ts`, PS-1) — uma única
                // implementação para as três superfícies que exibem estoque.
                const status = productStatus(p);
                return (
                  <tr key={p.id} className="cursor-pointer hover:bg-gray-50" onClick={() => onPick(p)}>
                    <td className="border-t border-gray-100 px-4 py-3 text-sm text-gray-800">
                      {/*
                        A linha inteira continua sendo o alvo do mouse (QOL-3),
                        deliberadamente grande. O botão é o mesmo alvo para o
                        teclado: antes, quem não usava mouse não tinha como
                        escolher um produto aqui.

                        `stopPropagation` porque o clique no botão também
                        borbulharia até o `onClick` da linha — a mesma baixa
                        seria iniciada duas vezes.
                      */}
                      <button
                        type="button"
                        className="rounded text-left font-medium text-gray-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPick(p);
                        }}
                      >
                        {p.name}
                      </button>
                    </td>
                    <td className="border-t border-gray-100 px-4 py-3 text-sm uppercase text-gray-600">
                      {p.sku}
                    </td>
                    <td className="border-t border-gray-100 px-4 py-3 text-right text-sm tabular-nums text-gray-800">
                      {p.balance} <span className="text-gray-500">un.</span>
                    </td>
                    <td className="border-t border-gray-100 px-4 py-3 text-right text-sm tabular-nums text-gray-800">
                      {p.minStock} <span className="text-gray-500">un.</span>
                    </td>
                    <td className="border-t border-gray-100 px-4 py-3 text-sm">
                      {status === 'OK' && <Badge variant="success">Em Estoque</Badge>}
                      {status === 'ATTN' && <Badge variant="warning">Estoque Baixo</Badge>}
                      {status === 'OUT' && <Badge variant="danger">Fora de Estoque</Badge>}
                    </td>
                  </tr>
                );
              })
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
