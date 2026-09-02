import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchMovements } from '../src/api/movements';
import { fetchProduct } from '../src/api/products';
import { MovementHistoryModal } from '../src/components/MovementHistoryModal';

import { makeMovement, makeProduct, paged } from './helpers/factories';

vi.mock('../src/api/movements', () => ({ fetchMovements: vi.fn() }));
// Task 19: o saldo ancorado do cabeçalho vem de `fetchProduct`, não do
// snapshot da listagem (REV-06) — o diálogo passou a fazer duas consultas.
vi.mock('../src/api/products', () => ({ fetchProduct: vi.fn() }));

const mockedFetchMovements = vi.mocked(fetchMovements);

/**
 * Characterization tests do `MovementHistoryModal` — apenas as **lacunas**
 * (`characterization-plan.md` §5).
 *
 * `MovementHistoryModal.test.tsx` já cobre, e não é duplicado aqui: ADJUSTMENT
 * completo (`previous → new`, delta assinado, motivo, responsável), degradação
 * de registro legado, "Usuário não disponível", o filtro de tipo repassado à
 * API e a não-regressão de IN/OUT.
 *
 * Este componente usa Radix cru: já é acessível. Migrar para o primitivo único
 * **não pode regredir** isso — daí MHM-4.
 *
 * NÃO congelado neste arquivo (§12):
 *   · `INITIAL_STOCK` renderizado cru, em inglês (UF-34), e ausente do filtro
 *     de tipo (F-09) — nenhum teste afirma que o filtro tem só três opções;
 *   · `toLocaleString()` sem locale explícito (M-13) — por isso nenhuma
 *     asserção sobre o formato da data neste arquivo;
 *   · o título não nomear o produto (UF-35) e `antes → depois` valer só para
 *     ADJUSTMENT (UF-33) — ambos ALTERAR INTENCIONALMENTE;
 *   · os três estados (vazio, carregando, erro) serem células sem `role` de
 *     anúncio (A-12ʳ): MHM-6 afirma que o texto existe, não que ele é mudo.
 */

function renderHistory() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onOpenChange = vi.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <MovementHistoryModal
        open
        onOpenChange={onOpenChange}
        product={{ id: 'p1', name: 'Caneta Azul', sku: 'CAN-001' }}
      />
    </QueryClientProvider>,
  );
  return { ...view, onOpenChange, user: userEvent.setup() };
}

/** Argumentos da última consulta: [productId, page, pageSize, filters]. */
function lastQuery() {
  const calls = mockedFetchMovements.mock.calls;
  return calls[calls.length - 1];
}

beforeEach(() => {
  mockedFetchMovements.mockReset();
  mockedFetchMovements.mockResolvedValue(paged([makeMovement()], { total: 30 }));
  vi.mocked(fetchProduct).mockReset();
  vi.mocked(fetchProduct).mockResolvedValue(makeProduct({ id: 'p1', balance: 20 }));
});

describe('MovementHistoryModal — filtros que faltavam (MHM-1, MHM-2)', () => {
  it('MHM-1 · as datas de e até são repassadas à API e voltam para a primeira página', async () => {
    const { user } = renderHistory();
    await screen.findByText(/Página 1 de/);

    await user.click(screen.getByRole('button', { name: 'Próxima →' }));
    await waitFor(() => expect(lastQuery()?.[1]).toBe(2));

    await user.type(screen.getByLabelText('De'), '2026-08-01');
    await waitFor(() => expect(lastQuery()?.[3]).toEqual(expect.objectContaining({ from: '2026-08-01' })));
    expect(lastQuery()?.[1]).toBe(1);

    await user.type(screen.getByLabelText('Até'), '2026-08-31');
    await waitFor(() => expect(lastQuery()?.[3]).toEqual(expect.objectContaining({ to: '2026-08-31' })));
    expect(lastQuery()?.[1]).toBe(1);
  });

  it('MHM-2 · a busca por observação é repassada à API e volta para a primeira página', async () => {
    const { user } = renderHistory();
    await screen.findByText(/Página 1 de/);

    await user.click(screen.getByRole('button', { name: 'Próxima →' }));
    await waitFor(() => expect(lastQuery()?.[1]).toBe(2));

    await user.type(screen.getByLabelText(/Buscar por Observação/i), 'contagem');

    await waitFor(() => expect(lastQuery()?.[3]).toEqual(expect.objectContaining({ q: 'contagem' })));
    expect(lastQuery()?.[1]).toBe(1);
  });
});

describe('MovementHistoryModal — itens por página (MHM-3)', () => {
  it('MHM-3 · escolher 50 por página muda o tamanho e volta para a primeira página', async () => {
    const { user } = renderHistory();
    await screen.findByText(/Página 1 de/);

    await user.click(screen.getByRole('button', { name: 'Próxima →' }));
    await waitFor(() => expect(lastQuery()?.[1]).toBe(2));

    await user.selectOptions(screen.getByLabelText('Itens por página'), '50');

    await waitFor(() => expect(lastQuery()?.[2]).toBe(50));
    expect(lastQuery()?.[1]).toBe(1);
  });
});

describe('MovementHistoryModal — semântica de diálogo já correta (MHM-4)', () => {
  it('MHM-4 · o diálogo se anuncia como tal, com nome acessível', async () => {
    renderHistory();

    // Vem do Radix. A migração para o primitivo único precisa preservar isto —
    // é o contrato que `Modal.test.tsx` já garante para os outros diálogos.
    // Task 19: o título passou a nomear o produto (UF-35), então o nome
    // acessível mudou de texto. O CONTRATO — o diálogo se anuncia COM um nome
    // — é o que MHM-4 trava, e continua valendo.
    expect(await screen.findByRole('dialog', { name: /Caneta Azul/ })).toBeInTheDocument();
  });

  it('MHM-4 · Escape fecha o diálogo', async () => {
    const { onOpenChange, user } = renderHistory();
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('MHM-4 · o foco entra no diálogo ao abrir', async () => {
    const { container } = renderHistory();
    const dialog = await screen.findByRole('dialog');

    // Focus trap do Radix: o foco não pode ficar para trás, na página.
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    expect(container.contains(document.activeElement)).toBe(false);
  });
});

describe('MovementHistoryModal — limites da paginação (MHM-5)', () => {
  it('MHM-5 · a navegação é bloqueada nos limites do resultado', async () => {
    mockedFetchMovements.mockResolvedValue(paged([makeMovement()], { total: 5 }));
    renderHistory();

    await screen.findByText(/Página 1 de 1/);

    expect(screen.getByRole('button', { name: '← Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima →' })).toBeDisabled();
  });
});

describe('MovementHistoryModal — estados de carga e de erro (MHM-6)', () => {
  it('MHM-6 · o carregamento é comunicado', async () => {
    mockedFetchMovements.mockImplementation(() => new Promise(() => {}) as never);
    renderHistory();

    // O redesenho de estados não pode deixar a tabela muda enquanto carrega.
    expect(await screen.findByText('Carregando...')).toBeInTheDocument();
  });

  it('MHM-6 · a falha da consulta é comunicada ao usuário', async () => {
    mockedFetchMovements.mockRejectedValue(new Error('Erro ao carregar movimentações'));
    renderHistory();

    expect(await screen.findByText('Erro ao carregar movimentações')).toBeInTheDocument();
  });

  it('MHM-6 · o resultado vazio é comunicado ao usuário', async () => {
    mockedFetchMovements.mockResolvedValue(paged([], { total: 0 }));
    renderHistory();

    expect(await screen.findByText('Nenhuma movimentação encontrada.')).toBeInTheDocument();
  });
});
