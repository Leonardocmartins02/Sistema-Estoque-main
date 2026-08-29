import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchQuickOutHistory } from '../src/api/quickOut';
import QuickOutHistoryModal from '../src/components/QuickOutHistoryModal';

import { FIXTURE_DATE_ISO, makeQuickOutHistoryItem, paged } from './helpers/factories';

vi.mock('../src/api/quickOut', () => ({ fetchQuickOutHistory: vi.fn() }));

const mockedFetchHistory = vi.mocked(fetchQuickOutHistory);

/**
 * Characterization tests do `QuickOutHistoryModal` (`characterization-plan.md` §4).
 *
 * Contrato de `user-flows.md` §9.3, itens 18–20. Cobertura anterior: zero.
 *
 * NÃO congelado neste arquivo (§12):
 *   · `Escape` não fechar (ALTERAR INTENCIONALMENTE — passará a fechar);
 *   · a ordenação, que é feita **em memória e só sobre a página atual**,
 *     aparentando ser global (F-03) — por isso nenhum teste aqui aciona os
 *     cabeçalhos ordenáveis nem afirma qualquer ordem de linhas;
 *   · o `fetch` manual sem cancelamento (F-02) e a falha de consulta
 *     silenciosa, que vira "Nenhuma baixa encontrada." (N-6);
 *   · o clipping da tabela e a busca de largura fixa no cabeçalho (N-7);
 *   · busca e campos de data sem `<label>` (N-8) — daí o acesso por papel;
 *   · o contraste reprovado do separador "até" (M-4).
 *
 * N-9 — DECIDIDO: o componente **preserva** filtros, busca e página entre
 * fechamento e reabertura (o estado vive fora do `if (!open)`, então persiste
 * enquanto a instância continua montada — é o caso de uso real, já que
 * `ProductDashboard` monta `QuickOutHistoryModal` uma única vez e só alterna a
 * prop `open`). Passa a ser **PRESERVAR**: reabrir o histórico deve devolver a
 * pessoa exatamente ao recorte que ela deixou, sem obrigá-la a refiltrar.
 * Coberto por QOH-8 abaixo, observando o efeito (o que a tela mostra e o que
 * é pedido à API), nunca o estado interno do componente.
 */

function renderHistory() {
  const onOpenChange = vi.fn();
  const view = render(<QuickOutHistoryModal open onOpenChange={onOpenChange} />);
  return {
    onOpenChange,
    user: userEvent.setup(),
    close: () => view.rerender(<QuickOutHistoryModal open={false} onOpenChange={onOpenChange} />),
    reopen: () => view.rerender(<QuickOutHistoryModal open onOpenChange={onOpenChange} />),
  };
}

const searchField = () => screen.getByRole('searchbox');

/** Os dois campos de data não têm `<label>` (N-8); `type="date"` não expõe papel. */
function dateFields() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
}

/** Último objeto de parâmetros passado à consulta. */
function lastQuery() {
  const calls = mockedFetchHistory.mock.calls;
  return calls[calls.length - 1]?.[0];
}

beforeEach(() => {
  mockedFetchHistory.mockReset();
  mockedFetchHistory.mockResolvedValue(paged([makeQuickOutHistoryItem()], { total: 1 }));
});

describe('QuickOutHistoryModal — filtros (QOH-1, QOH-2)', () => {
  it('QOH-1 · a busca textual é repassada à API e volta para a primeira página', async () => {
    mockedFetchHistory.mockResolvedValue(paged([makeQuickOutHistoryItem()], { total: 25 }));
    const { user } = renderHistory();
    await screen.findByText('Caneta Azul');

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(lastQuery()?.page).toBe(2));

    await user.type(searchField(), 'caneta');

    await waitFor(() => expect(lastQuery()?.q).toBe('caneta'));
    expect(lastQuery()?.page).toBe(1);
  });

  it('QOH-2 · as datas de e até são repassadas à API e voltam para a primeira página', async () => {
    mockedFetchHistory.mockResolvedValue(paged([makeQuickOutHistoryItem()], { total: 25 }));
    const { user } = renderHistory();
    await screen.findByText('Caneta Azul');

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(lastQuery()?.page).toBe(2));

    const [fromField, toField] = dateFields();
    await user.type(fromField, '2026-08-01');
    await waitFor(() => expect(lastQuery()?.from).toBe('2026-08-01'));
    expect(lastQuery()?.page).toBe(1);

    await user.type(toField, '2026-08-31');
    await waitFor(() => expect(lastQuery()?.to).toBe('2026-08-31'));
    expect(lastQuery()?.page).toBe(1);
  });
});

describe('QuickOutHistoryModal — paginação (QOH-3)', () => {
  it('QOH-3 · o contador reflete o total da API e a navegação pede a página certa', async () => {
    mockedFetchHistory.mockResolvedValue(paged([makeQuickOutHistoryItem()], { total: 25 }));
    const { user } = renderHistory();

    // O total é exibido em mais de um ponto da tela hoje; quantos são é
    // layout, não contrato. O que se protege é o número refletir a API.
    expect((await screen.findAllByText(/25 registro\(s\)/)).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(lastQuery()?.page).toBe(2));

    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    await waitFor(() => expect(lastQuery()?.page).toBe(1));
  });

  it('QOH-3 · a navegação é bloqueada nos limites do resultado', async () => {
    mockedFetchHistory.mockResolvedValue(paged([makeQuickOutHistoryItem()], { total: 5 }));
    renderHistory();

    await screen.findByText('Caneta Azul');

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
  });
});

describe('QuickOutHistoryModal — o registro de auditoria (QOH-4, QOH-5, QOH-6)', () => {
  it('QOH-4 · cada baixa expõe produto, SKU, quantidade, data e observação', async () => {
    mockedFetchHistory.mockResolvedValue(
      paged(
        [
          makeQuickOutHistoryItem({
            productName: 'Caneta Azul',
            productSku: 'CAN-001',
            quantity: 7,
            note: 'Requisição setor B',
          }),
        ],
        { total: 1 },
      ),
    );
    renderHistory();

    // São os dados de auditoria: o layout muda na migração, o conteúdo não.
    const row = await screen.findByRole('row', { name: /Caneta Azul/ });
    expect(within(row).getByText('Caneta Azul')).toBeInTheDocument();
    expect(within(row).getByText('CAN-001')).toBeInTheDocument();
    expect(within(row).getByText('7')).toBeInTheDocument();
    expect(within(row).getByText('Requisição setor B')).toBeInTheDocument();
  });

  it('QOH-5 · a data é apresentada em formato brasileiro legível', async () => {
    mockedFetchHistory.mockResolvedValue(
      paged([makeQuickOutHistoryItem({ date: FIXTURE_DATE_ISO })], { total: 1 }),
    );
    renderHistory();

    // Afirma dia/mês/ano — não a string inteira, que varia com o fuso da
    // máquina, nem o mecanismo (`toLocaleString('pt-BR')`), que é substituível.
    // A fixture usa 12:00Z justamente para cair no mesmo dia em qualquer fuso.
    expect(await screen.findByText(/14\/08\/2026/)).toBeInTheDocument();
  });

  it('QOH-6 · a ausência de observação é comunicada, não deixada em branco', async () => {
    mockedFetchHistory.mockResolvedValue(
      paged([makeQuickOutHistoryItem({ note: null })], { total: 1 }),
    );
    renderHistory();

    const row = await screen.findByRole('row', { name: /Caneta Azul/ });

    // O caractere usado hoje é vocabulário de apresentação e pode virar "Sem
    // observação" na migração. O contrato é a célula não ficar muda.
    for (const cell of within(row).getAllByRole('cell')) {
      expect(cell.textContent?.trim()).not.toBe('');
    }
  });
});

describe('QuickOutHistoryModal — estados e saída do diálogo (QOH-7)', () => {
  it('QOH-7 · o controle explícito "Fechar" fecha o diálogo', async () => {
    const { onOpenChange, user } = renderHistory();

    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('QOH-7 · interagir dentro do diálogo não o fecha', async () => {
    const { onOpenChange, user } = renderHistory();

    await user.click(screen.getByText('Histórico de Baixas'));
    await user.click(searchField());

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('QOH-7 · um resultado vazio é comunicado ao usuário', async () => {
    mockedFetchHistory.mockResolvedValue(paged([], { total: 0 }));
    renderHistory();

    // Afirma apenas que o estado vazio é legível. Não afirma que ele distingue
    // "sem baixas" de "consulta falhou" — hoje não distingue, e isso é o N-6.
    expect(await screen.findByText(/Nenhuma baixa/i)).toBeInTheDocument();
  });
});

describe('QuickOutHistoryModal — o recorte sobrevive a fechar e reabrir (QOH-8, N-9)', () => {
  it('QOH-8 · busca, página e datas continuam aplicadas ao reabrir o histórico', async () => {
    mockedFetchHistory.mockResolvedValue(paged([makeQuickOutHistoryItem()], { total: 25 }));
    const { user, close, reopen } = renderHistory();
    await screen.findByText('Caneta Azul');

    // 1–2. Abrir (já feito por renderHistory) e alterar busca, datas e página.
    await user.type(searchField(), 'caneta');
    await waitFor(() => expect(lastQuery()?.q).toBe('caneta'));

    const [fromField] = dateFields();
    await user.type(fromField, '2026-08-01');
    await waitFor(() => expect(lastQuery()?.from).toBe('2026-08-01'));

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(lastQuery()?.page).toBe(2));

    mockedFetchHistory.mockClear();

    // 3. Fechar.
    close();

    // 4. Reabrir.
    reopen();

    // 5. O mesmo recorte continua aplicado — verificado pelo efeito observável
    // (o que a tela mostra e o que é pedido à API), nunca pelo estado interno
    // do componente.
    await waitFor(() =>
      expect(lastQuery()).toEqual(
        expect.objectContaining({ q: 'caneta', from: '2026-08-01', page: 2 }),
      ),
    );
    expect(searchField()).toHaveValue('caneta');
    expect(dateFields()[0]).toHaveValue('2026-08-01');
  });
});
