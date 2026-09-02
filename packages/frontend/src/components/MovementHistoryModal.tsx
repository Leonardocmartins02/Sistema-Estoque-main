import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';

import { fetchMovements } from '../api/movements';
import { fetchProduct } from '../api/products';
import type { Movement, Paged } from '../api/types';
import { formatBalanceTransition, formatDelta, formatQuantity } from '../lib/formatNumber';

import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

/**
 * Identidade do produto acionado (Task 19). O diálogo recebia só `productId` e
 * por isso não sabia nomear o produto no título (UF-35). O **saldo** não vem
 * daqui de propósito — ver `balanceQuery` abaixo.
 */
export type HistoryProduct = {
  id: string;
  name: string;
  sku: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: HistoryProduct;
};

type MovementType = Movement['type'];
type TypeFilter = '' | MovementType;

/**
 * Vocabulário único dos quatro tipos (design-system.md §14.1).
 *
 * Antes, um ternário tratava `ADJUSTMENT` e jogava todo o resto no ramo
 * `IN`/`OUT` — `INITIAL_STOCK` vazava cru, em inglês, com underscore (UF-34).
 * A cor apenas reforça: a direção é sempre legível em texto (WCAG 1.4.1).
 */
const TYPE_LABEL: Record<MovementType, string> = {
  IN: 'Entrada',
  OUT: 'Saída',
  ADJUSTMENT: 'Ajuste',
  INITIAL_STOCK: 'Estoque inicial',
};

const TYPE_VARIANT: Record<MovementType, 'success' | 'danger' | 'info'> = {
  IN: 'success',
  OUT: 'danger',
  ADJUSTMENT: 'info',
  INITIAL_STOCK: 'success',
};

/** Data com locale explícito — `toLocaleString()` sem locale seguia a configuração do navegador (M-13). */
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

/**
 * A célula que transforma a lista num extrato: `antes → depois` com delta
 * assinado, para os **quatro** tipos (UF-33) — o `StockService` grava
 * `previousQuantity`/`newQuantity` em toda movimentação e a rota devolve os
 * dois; era a tela que descartava fora de `ADJUSTMENT`.
 */
function MovementAmount({ movement }: { movement: Movement }) {
  const { previousQuantity, newQuantity, type, quantity } = movement;

  // Linhas legadas (o `seed.ts` grava direto via Prisma, sem esses campos)
  // degradam para a quantidade crua — nunca `undefined`, nunca uma transição
  // inventada, nunca um zero fictício (REV-11). Estender `antes → depois` aos
  // quatro tipos é justamente o que expõe essas linhas.
  if (previousQuantity == null || newQuantity == null) {
    return (
      <>
        {formatQuantity(quantity)} <span className="text-xs text-gray-500">(saldos não registrados)</span>
      </>
    );
  }

  const delta = newQuantity - previousQuantity;
  // `Estoque inicial` mostra `—` como saldo anterior: honesto quanto à
  // ausência, em vez de fingir zero (§14.2 regra 1). O delta continua vindo do
  // saldo real gravado, então "— → 50" acompanha "+50".
  const previousForDisplay = type === 'INITIAL_STOCK' ? null : previousQuantity;

  return (
    <>
      {/* A seta é decorativa para AT; o texto `sr-only` ao lado diz a mesma
          transição em palavras — paga a dívida A5 (§14.2 regra 3). */}
      <span aria-hidden="true">{formatBalanceTransition(previousForDisplay, newQuantity)}</span>
      <span className="sr-only">
        {previousForDisplay == null
          ? `sem saldo anterior, saldo final ${formatQuantity(newQuantity)}`
          : `de ${formatQuantity(previousQuantity)} para ${formatQuantity(newQuantity)}`}
      </span>{' '}
      <span className={`font-medium ${delta < 0 ? 'text-danger' : 'text-success'}`}>{formatDelta(delta)}</span>
    </>
  );
}

export function MovementHistoryModal({ open, onOpenChange, product }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [type, setType] = useState<TypeFilter>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [q, setQ] = useState<string>('');

  const typeId = useId();
  const fromId = useId();
  const toId = useId();
  const qId = useId();

  const productId = product.id;

  // Resetar paginação ao abrir para um produto
  useEffect(() => {
    if (open) {
      setPage(1);
    }
  }, [open, productId]);

  /**
   * Saldo ancorado do cabeçalho (decisão 4, §14.3) — **imune ao filtro**.
   *
   * REV-06: não pode vir do snapshot da listagem (`staleTime` 15s), senão o
   * número anunciado como "atual" pode já estar errado. Vem da rota do produto,
   * numa consulta própria que **não** depende de `type`/`from`/`to`/`q` — é
   * exatamente essa independência que torna o saldo imune ao recorte da lista.
   */
  const balanceQuery = useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProduct(productId),
    enabled: open && !!productId,
  });

  const query = useQuery<Paged<Movement>>({
    queryKey: ['movements', productId, page, pageSize, type, from, to, q],
    queryFn: () => fetchMovements(productId, page, pageSize, { type, from, to, q }),
    enabled: open && !!productId,
    staleTime: 5_000,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      // O título nomeia o produto (UF-35) — antes dizia só "Histórico de
      // Movimentações", e duas janelas de produtos diferentes eram idênticas.
      title={`Histórico · ${product.name}`}
      // §14.3 exige que a diferença entre o saldo do produto e o recorte da
      // lista seja explícita em TEXTO, não deduzível.
      description={`SKU ${product.sku} · o saldo do produto não muda com os filtros abaixo.`}
      size="3xl"
      headerActions={
        <div className="text-right" data-testid="history-balance">
          <div className="text-xs text-gray-600">Saldo atual</div>
          <div className="text-base font-semibold tabular-nums text-gray-900">
            {balanceQuery.data ? `${formatQuantity(balanceQuery.data.balance)} un.` : '—'}
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      }
    >
      {/* Filtros */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        <div className="sm:col-span-1">
          <label htmlFor={typeId} className="block text-xs font-medium text-gray-700">
            Tipo
          </label>
          <select
            id={typeId}
            className="mt-1 w-full rounded-control border border-border-strong px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            value={type}
            onChange={(e) => {
              setType(e.target.value as TypeFilter);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {/* `INITIAL_STOCK` passa a ser oferecido — o backend sempre o
                aceitou, só o filtro não o expunha (F-09). */}
            {(['IN', 'OUT', 'ADJUSTMENT', 'INITIAL_STOCK'] as const).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={fromId} className="block text-xs font-medium text-gray-700">
            De
          </label>
          <input
            id={fromId}
            type="date"
            className="mt-1 w-full rounded-control border border-border-strong px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={toId} className="block text-xs font-medium text-gray-700">
            Até
          </label>
          <input
            id={toId}
            type="date"
            className="mt-1 w-full rounded-control border border-border-strong px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="sm:col-span-5">
          <label htmlFor={qId} className="block text-xs font-medium text-gray-700">
            Buscar por Observação
          </label>
          <input
            id={qId}
            type="search"
            placeholder="Ex.: ajuste, nota, motivo"
            className="mt-1 w-full rounded-control border border-border-strong px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">
          Total: <span className="font-medium">{formatQuantity(total)}</span>{' '}
          {total > 0 && (
            <span>
              (Página {page} de {totalPages})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={page <= 1 || query.isFetching}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
          >
            ← Anterior
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={page >= totalPages || query.isFetching}
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
          >
            Próxima →
          </Button>
          <select
            aria-label="Itens por página"
            className="rounded-control border border-border-strong px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}/página
              </option>
            ))}
          </select>
        </div>
      </div>

      {/*
        Live regions SEMPRE montadas — padrão de `ui/ApiStatusBanner`, que
        documenta o motivo: "uma região criada no mesmo instante do conteúdo
        normalmente não é anunciada". Montar o `role` junto com a linha de
        estado deixaria carregando/vazio/erro mudos, que é justamente o que
        esta task se propôs a corrigir (A-12ʳ).

        Daqui sai também o RESULTADO de filtrar e paginar — sem isso, mexer
        nos filtros deste diálogo é uma operação inteiramente silenciosa para
        quem usa leitor de tela.

        O texto visível na tabela é texto comum, sem `role`: quem anuncia é
        esta região, e não as duas ao mesmo tempo.
      */}
      <div role="status" aria-live="polite" className="sr-only">
        {query.isLoading
          ? 'Carregando movimentações.'
          : query.isError
            ? ''
            : items.length === 0
              ? 'Nenhuma movimentação encontrada para o filtro atual.'
              : // Número CRU e plural correto: esta frase é para ser ouvida, não
                // vista. O separador de milhar de `formatQuantity` é decisão
                // tipográfica (P-4) — na fala, "1.250" vira "um ponto duzentos
                // e cinquenta" em alguns sintetizadores.
                `${total} ${total === 1 ? 'movimentação encontrada' : 'movimentações encontradas'}, exibindo a página ${page} de ${totalPages}.`}
      </div>
      <div role="alert" aria-live="assertive" className="sr-only">
        {query.isError ? `Erro: ${(query.error as Error)?.message || 'Erro ao carregar movimentações'}` : ''}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-subtle">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Data</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tipo</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Saldo</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Obs</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Responsável
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {/*
              O `role` NÃO vai no `<td>`: um `role` explícito substitui o papel
              implícito, e a célula deixaria de ser célula — a linha passaria a
              conter um filho inválido para `row`, quebrando a navegação por
              tabela. Mesma estrutura de `ui/DataTable`: papéis nativos
              preservados, anúncio delegado à live region acima.
            */}
            {query.isLoading && (
              <tr role="row">
                <td role="cell" colSpan={5} className="px-4 py-6 text-sm text-gray-500">
                  Carregando...
                </td>
              </tr>
            )}
            {query.isError && (
              <tr role="row">
                <td role="cell" colSpan={5} className="px-4 py-6 text-sm text-danger">
                  {(query.error as Error)?.message || 'Erro ao carregar movimentações'}
                </td>
              </tr>
            )}
            {!query.isLoading && !query.isError && items.length === 0 && (
              <tr role="row">
                <td role="cell" colSpan={5} className="px-4 py-6 text-sm text-gray-500">
                  Nenhuma movimentação encontrada.
                </td>
              </tr>
            )}
            {items.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2 text-sm text-gray-800">{formatWhen(m.date)}</td>
                <td className="px-4 py-2 text-sm">
                  <Badge variant={TYPE_VARIANT[m.type]}>{TYPE_LABEL[m.type]}</Badge>
                </td>
                <td className="px-4 py-2 text-sm tabular-nums text-gray-800">
                  <MovementAmount movement={m} />
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">{m.note || '-'}</td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  {m.userEmail || <span className="text-gray-500">Usuário não disponível</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export default MovementHistoryModal;
