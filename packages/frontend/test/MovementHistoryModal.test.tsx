import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchMovements } from '../src/api/movements';
import type { Movement, Paged } from '../src/api/types';
import { MovementHistoryModal } from '../src/components/MovementHistoryModal';

vi.mock('../src/api/movements', () => ({ fetchMovements: vi.fn() }));

const mockedFetchMovements = vi.mocked(fetchMovements);

function makeMovement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: 'm1',
    productId: 'p1',
    type: 'IN',
    quantity: 5,
    date: '2026-08-01T12:00:00.000Z',
    note: null,
    createdAt: '2026-08-01T12:00:00.000Z',
    ...overrides,
  };
}

function paged(items: Movement[]): Paged<Movement> {
  return { items, total: items.length, page: 1, pageSize: 10 };
}

function renderHistory() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MovementHistoryModal open onOpenChange={vi.fn()} productId="p1" />
    </QueryClientProvider>,
  );
}

/** Localiza a linha da tabela que contém um texto, para asserts por linha. */
async function findRowContaining(text: string | RegExp) {
  const cell = await screen.findByText(text);
  const row = cell.closest('tr');
  if (!row) throw new Error('célula fora de uma linha de tabela');
  return row;
}

describe('MovementHistoryModal — movimentações de ajuste', () => {
  beforeEach(() => {
    mockedFetchMovements.mockReset();
  });

  it('renderiza um ADJUSTMENT completo com rótulo textual, saldo anterior → novo, diferença com sinal, motivo e responsável', async () => {
    mockedFetchMovements.mockResolvedValue(
      paged([
        makeMovement({
          id: 'adj1',
          type: 'ADJUSTMENT',
          quantity: 2,
          previousQuantity: 20,
          newQuantity: 18,
          note: 'Contagem física mensal',
          userEmail: 'admin@simplestock.dev',
        }),
      ]),
    );

    renderHistory();

    const row = await findRowContaining('AJUSTE');
    expect(within(row).getByText('20 → 18')).toBeInTheDocument();
    expect(within(row).getByText('-2')).toBeInTheDocument();
    expect(within(row).getByText('Contagem física mensal')).toBeInTheDocument();
    expect(within(row).getByText('admin@simplestock.dev')).toBeInTheDocument();
  });

  it('mostra a diferença de um ajuste para cima com sinal positivo explícito', async () => {
    mockedFetchMovements.mockResolvedValue(
      paged([
        makeMovement({
          id: 'adj2',
          type: 'ADJUSTMENT',
          quantity: 2,
          previousQuantity: 10,
          newQuantity: 12,
          note: 'Recontagem',
          userEmail: 'admin@simplestock.dev',
        }),
      ]),
    );

    renderHistory();

    const row = await findRowContaining('AJUSTE');
    expect(within(row).getByText('10 → 12')).toBeInTheDocument();
    expect(within(row).getByText('+2')).toBeInTheDocument();
  });

  it('degrada graciosamente em ADJUSTMENT antigo sem saldos nem autor, sem renderizar undefined', async () => {
    mockedFetchMovements.mockResolvedValue(
      paged([
        makeMovement({
          id: 'adj3',
          type: 'ADJUSTMENT',
          quantity: 7,
          previousQuantity: null,
          newQuantity: null,
          note: null,
          userEmail: null,
        }),
      ]),
    );

    renderHistory();

    const row = await findRowContaining('AJUSTE');
    expect(within(row).getByText('7')).toBeInTheDocument();
    expect(within(row).getByText(/saldos não registrados/i)).toBeInTheDocument();
    expect(within(row).getByText('Usuário não disponível')).toBeInTheDocument();
    expect(row.textContent).not.toMatch(/undefined|null/);
  });

  it('mostra "Usuário não disponível" também em movimentações IN/OUT sem autor', async () => {
    mockedFetchMovements.mockResolvedValue(paged([makeMovement({ type: 'OUT', quantity: 3, userEmail: null })]));

    renderHistory();

    const row = await findRowContaining('OUT');
    expect(within(row).getByText('Usuário não disponível')).toBeInTheDocument();
  });

  it('selecionar o filtro "Ajuste" repassa type=ADJUSTMENT para fetchMovements', async () => {
    mockedFetchMovements.mockResolvedValue(paged([]));
    const user = userEvent.setup();
    renderHistory();

    await screen.findByText('Nenhuma movimentação encontrada.');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'ADJUSTMENT');

    await vi.waitFor(() => {
      expect(mockedFetchMovements).toHaveBeenLastCalledWith(
        'p1',
        1,
        10,
        expect.objectContaining({ type: 'ADJUSTMENT' }),
      );
    });
  });

  it('não regride a renderização de IN e OUT', async () => {
    mockedFetchMovements.mockResolvedValue(
      paged([
        makeMovement({ id: 'in1', type: 'IN', quantity: 5, note: 'Compra', userEmail: 'admin@simplestock.dev' }),
        makeMovement({ id: 'out1', type: 'OUT', quantity: 3, note: 'Venda', userEmail: 'admin@simplestock.dev' }),
      ]),
    );

    renderHistory();

    const inRow = await findRowContaining('IN');
    expect(within(inRow).getByText('5')).toBeInTheDocument();
    expect(within(inRow).getByText('Compra')).toBeInTheDocument();

    const outRow = await findRowContaining('OUT');
    expect(within(outRow).getByText('3')).toBeInTheDocument();
    expect(within(outRow).getByText('Venda')).toBeInTheDocument();

    expect(screen.queryByText('AJUSTE')).not.toBeInTheDocument();
  });
});
