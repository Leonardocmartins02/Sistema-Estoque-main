import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchMovements } from '../src/api/movements';
import { fetchProduct } from '../src/api/products';
import type { Movement, Paged } from '../src/api/types';
import { MovementHistoryModal } from '../src/components/MovementHistoryModal';

import { makeProduct } from './helpers/factories';

vi.mock('../src/api/movements', () => ({ fetchMovements: vi.fn() }));
vi.mock('../src/api/products', () => ({ fetchProduct: vi.fn() }));

const mockedFetchMovements = vi.mocked(fetchMovements);
const mockedFetchProduct = vi.mocked(fetchProduct);

const PRODUCT = { id: 'p1', name: 'Caneta Azul', sku: 'CAN-001' };

function makeMovement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: 'm1',
    productId: 'p1',
    type: 'IN',
    quantity: 5,
    // 12:00Z cai no mesmo dia do calendário em qualquer fuso entre UTC−11 e
    // UTC+11 — asserção de data não depende do TZ da máquina.
    date: '2026-08-14T12:00:00.000Z',
    note: null,
    createdAt: '2026-08-14T12:00:00.000Z',
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
      <MovementHistoryModal open onOpenChange={vi.fn()} product={PRODUCT} />
    </QueryClientProvider>,
  );
}

/**
 * Localiza a linha da tabela que contém um texto, para asserts por linha.
 *
 * Escopado à tabela de propósito: com o vocabulário unificado da Task 19
 * (§14.1), "Entrada"/"Saída"/"Ajuste"/"Estoque inicial" aparecem **duas vezes**
 * na tela — como opção do filtro de tipo e como rótulo da linha. Buscar na
 * tela inteira acharia as duas.
 */
async function findRowContaining(text: string | RegExp) {
  const table = await screen.findByRole('table');
  const cell = await within(table).findByText(text);
  const row = cell.closest('tr');
  if (!row) throw new Error('célula fora de uma linha de tabela');
  return row;
}

beforeEach(() => {
  mockedFetchMovements.mockReset();
  mockedFetchProduct.mockReset();
  mockedFetchProduct.mockResolvedValue(makeProduct({ id: 'p1', name: 'Caneta Azul', sku: 'CAN-001', balance: 20 }));
});

describe('MovementHistoryModal — movimentações de ajuste', () => {
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

    // Task 19: o rótulo passou a ser "Ajuste" (§14.1) — o CONTRATO preservado
    // é o conteúdo da linha, não o texto em caixa alta de antes.
    const row = await findRowContaining('Ajuste');
    expect(within(row).getByText('20 → 18')).toBeInTheDocument();
    // Task 19: números pelo helper da Task 2 — menos tipográfico (−), não hífen.
    expect(within(row).getByText('−2')).toBeInTheDocument();
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

    const row = await findRowContaining('Ajuste');
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

    const row = await findRowContaining('Ajuste');
    expect(within(row).getByText('7')).toBeInTheDocument();
    expect(within(row).getByText(/saldos não registrados/i)).toBeInTheDocument();
    expect(within(row).getByText('Usuário não disponível')).toBeInTheDocument();
    expect(row.textContent).not.toMatch(/undefined|null/);
  });

  it('mostra "Usuário não disponível" também em movimentações IN/OUT sem autor', async () => {
    mockedFetchMovements.mockResolvedValue(paged([makeMovement({ type: 'OUT', quantity: 3, userEmail: null })]));

    renderHistory();

    const row = await findRowContaining('Saída');
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

    const inRow = await findRowContaining('Entrada');
    expect(within(inRow).getByText('Compra')).toBeInTheDocument();

    const outRow = await findRowContaining('Saída');
    expect(within(outRow).getByText('Venda')).toBeInTheDocument();

    // Escopado à tabela: "Ajuste" também é uma opção do filtro de tipo.
    expect(within(screen.getByRole('table')).queryByText('Ajuste')).not.toBeInTheDocument();
  });
});

/**
 * Task 19 — o histórico vira um EXTRATO que responde "por que o estoque caiu?"
 * por leitura (D6; `design-system.md` §14.1, §14.2, §14.3).
 *
 * `previousQuantity`/`newQuantity` já chegavam no payload de TODA movimentação
 * e eram descartados fora de `ADJUSTMENT` (UF-33). O dado estava lá; a tela é
 * que não o mostrava.
 */
describe('MovementHistoryModal — extrato auditável (D6)', () => {
  const COMPLETO: Movement[] = [
    makeMovement({ id: 'in1', type: 'IN', quantity: 12, previousQuantity: 120, newQuantity: 132 }),
    makeMovement({ id: 'out1', type: 'OUT', quantity: 5, previousQuantity: 120, newQuantity: 115 }),
    makeMovement({ id: 'adj1', type: 'ADJUSTMENT', quantity: 73, previousQuantity: 120, newQuantity: 47 }),
    makeMovement({ id: 'ini1', type: 'INITIAL_STOCK', quantity: 50, previousQuantity: 0, newQuantity: 50 }),
  ];

  it('os quatro tipos exibem antes → depois com delta assinado (UF-33)', async () => {
    mockedFetchMovements.mockResolvedValue(paged(COMPLETO));
    renderHistory();

    const entrada = await findRowContaining('Entrada');
    expect(within(entrada).getByText('120 → 132')).toBeInTheDocument();
    expect(within(entrada).getByText('+12')).toBeInTheDocument();

    const saida = await findRowContaining('Saída');
    expect(within(saida).getByText('120 → 115')).toBeInTheDocument();
    expect(within(saida).getByText('−5')).toBeInTheDocument();

    const ajuste = await findRowContaining('Ajuste');
    expect(within(ajuste).getByText('120 → 47')).toBeInTheDocument();
    expect(within(ajuste).getByText('−73')).toBeInTheDocument();

    // `Estoque inicial` mostra `—` como saldo anterior: honesto quanto à
    // ausência, em vez de fingir zero (§14.2 regra 1).
    const inicial = await findRowContaining('Estoque inicial');
    expect(within(inicial).getByText('— → 50')).toBeInTheDocument();
    expect(within(inicial).getByText('+50')).toBeInTheDocument();
  });

  it('a seta recebe texto sr-only, pagando a dívida A5 (§14.2 regra 3)', async () => {
    mockedFetchMovements.mockResolvedValue(paged([COMPLETO[0]]));
    renderHistory();

    const row = await findRowContaining('Entrada');
    expect(within(row).getByText('de 120 para 132')).toBeInTheDocument();
  });

  it('IN, OUT e INITIAL_STOCK sem saldos degradam para quantidade crua, sem undefined nem zero fictício (REV-11)', async () => {
    // O `seed.ts` grava direto via Prisma, sem previousQuantity/newQuantity —
    // estender `antes → depois` aos quatro tipos expõe essas linhas legadas.
    mockedFetchMovements.mockResolvedValue(
      paged([
        makeMovement({ id: 'l1', type: 'IN', quantity: 5, previousQuantity: null, newQuantity: null }),
        makeMovement({ id: 'l2', type: 'OUT', quantity: 3, previousQuantity: null, newQuantity: null }),
        makeMovement({ id: 'l3', type: 'INITIAL_STOCK', quantity: 9, previousQuantity: null, newQuantity: null }),
      ]),
    );
    renderHistory();

    for (const [rotulo, quantidade] of [
      ['Entrada', '5'],
      ['Saída', '3'],
      ['Estoque inicial', '9'],
    ] as const) {
      const row = await findRowContaining(rotulo);
      expect(within(row).getByText(quantidade)).toBeInTheDocument();
      expect(within(row).getByText(/saldos não registrados/i)).toBeInTheDocument();
      // Nunca `undefined`, nem transição inventada, nem zero fictício.
      expect(row.textContent).not.toMatch(/undefined|null/);
      expect(row.textContent).not.toMatch(/→/);
      expect(within(row).queryByText(/^0 →/)).not.toBeInTheDocument();
    }
  });

  it('nenhum enum cru do banco aparece na tela (UF-34)', async () => {
    mockedFetchMovements.mockResolvedValue(paged(COMPLETO));
    renderHistory();

    await findRowContaining('Estoque inicial');

    const tela = document.body.textContent ?? '';
    expect(tela).not.toMatch(/INITIAL_STOCK/);
    expect(tela).not.toMatch(/ADJUSTMENT/);
    // `IN`/`OUT` como palavra isolada — o enum cru que o ternário deixava passar.
    expect(tela).not.toMatch(/\bIN\b/);
    expect(tela).not.toMatch(/\bOUT\b/);
  });

  it('o filtro de tipo oferece os quatro tipos, incluindo Estoque inicial (F-09)', async () => {
    mockedFetchMovements.mockResolvedValue(paged([]));
    renderHistory();

    const filtro = await screen.findByLabelText('Tipo');
    const rotulos = within(filtro)
      .getAllByRole('option')
      .map((o) => o.textContent);

    expect(rotulos).toEqual(['Todos', 'Entrada', 'Saída', 'Ajuste', 'Estoque inicial']);
  });

  it('o filtro de Estoque inicial é repassado à API (F-09)', async () => {
    mockedFetchMovements.mockResolvedValue(paged([]));
    const user = userEvent.setup();
    renderHistory();

    await screen.findByText('Nenhuma movimentação encontrada.');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'INITIAL_STOCK');

    await waitFor(() =>
      expect(mockedFetchMovements).toHaveBeenLastCalledWith(
        'p1',
        1,
        10,
        expect.objectContaining({ type: 'INITIAL_STOCK' }),
      ),
    );
  });

  it('a data é legível em pt-BR, independentemente do fuso da máquina (M-13)', async () => {
    mockedFetchMovements.mockResolvedValue(paged([makeMovement({ id: 'd1', type: 'IN' })]));
    renderHistory();

    const row = await findRowContaining('Entrada');
    // dd/mm/aaaa — nunca o mm/dd/yyyy que `toLocaleString()` sem locale produz
    // numa máquina en-US.
    expect(row.textContent).toMatch(/14\/08\/2026/);
  });
});

/**
 * Decisão 4 (`design-system.md` §14.3): o saldo do produto vive no cabeçalho,
 * ancorado ao produto e imune ao filtro. A lista abaixo é um recorte — e a
 * interface precisa DIZER isso, não deixar deduzir.
 */
describe('MovementHistoryModal — saldo ancorado no cabeçalho (decisão 4)', () => {
  it('o título nomeia o produto (UF-35)', async () => {
    mockedFetchMovements.mockResolvedValue(paged([]));
    renderHistory();

    expect(await screen.findByRole('dialog', { name: /Caneta Azul/ })).toBeInTheDocument();
  });

  it('o saldo do cabeçalho vem da API do produto, não do snapshot da listagem (REV-06)', async () => {
    mockedFetchMovements.mockResolvedValue(paged([]));
    renderHistory();

    await waitFor(() => expect(mockedFetchProduct).toHaveBeenCalledWith('p1'));
    expect(await screen.findByText(/20/)).toBeInTheDocument();
  });

  /**
   * N3 (achado do accessibility-reviewer na Task 19): antes do fetch resolver
   * e quando `fetchProduct` falha, o readout mostrava o mesmo "—" — carregando,
   * erro e "sem saldo" eram visualmente indistinguíveis. Como o saldo é a
   * âncora do extrato (§14.3), uma falha de rede podia passar por informação
   * legítima.
   */
  describe('MovementHistoryModal — saldo indistinguível entre loading/erro (N3)', () => {
    it('mostra "Carregando saldo…" antes do fetchProduct resolver', async () => {
      mockedFetchMovements.mockResolvedValue(paged([]));
      // Nunca resolve dentro deste teste — mantém o estado de loading.
      mockedFetchProduct.mockImplementation(() => new Promise(() => {}));
      renderHistory();

      const saldo = await screen.findByTestId('history-balance');
      expect(saldo).toHaveTextContent('Carregando saldo…');
    });

    it('mostra o saldo formatado quando o fetchProduct resolve', async () => {
      mockedFetchMovements.mockResolvedValue(paged([]));
      mockedFetchProduct.mockResolvedValue(makeProduct({ id: 'p1', balance: 24 }));
      renderHistory();

      await waitFor(() => expect(screen.getByTestId('history-balance')).toHaveTextContent('24 un.'));
    });

    it('mostra "Saldo indisponível" quando o fetchProduct falha — nunca apenas "—"', async () => {
      mockedFetchMovements.mockResolvedValue(paged([]));
      mockedFetchProduct.mockRejectedValue(new Error('Falha de rede'));
      renderHistory();

      const saldo = await screen.findByTestId('history-balance');
      await waitFor(() => expect(saldo).toHaveTextContent('Saldo indisponível'));
      // O erro nunca é apresentado como um dado legítimo — nem em silêncio,
      // nem disfarçado de traço neutro.
      expect(saldo.textContent).not.toBe('Saldo atual—');
      expect(saldo.textContent).not.toMatch(/^Saldo atual—$/);
    });

    it('a região do saldo é role="status" e persiste como o MESMO nó entre loading e sucesso', async () => {
      mockedFetchMovements.mockResolvedValue(paged([]));
      let resolveFetch: (value: ReturnType<typeof makeProduct>) => void = () => {};
      mockedFetchProduct.mockImplementation(
        () => new Promise((resolve) => { resolveFetch = resolve; }),
      );
      renderHistory();

      const saldo = await screen.findByTestId('history-balance');
      expect(saldo).toHaveAttribute('role', 'status');
      expect(saldo).toHaveAttribute('aria-live', 'polite');
      expect(saldo).toHaveTextContent('Carregando saldo…');

      resolveFetch(makeProduct({ id: 'p1', balance: 24 }));

      // Mesma referência de nó — não é uma região recriada, é a mesma
      // montada desde o início. Recriar quebraria o anúncio (NVDA/JAWS não
      // anunciam uma live region criada junto com seu conteúdo).
      await waitFor(() => expect(saldo).toHaveTextContent('24 un.'));
      expect(screen.getByTestId('history-balance')).toBe(saldo);
    });

    it('a região do saldo é a MESMA entre loading e erro', async () => {
      mockedFetchMovements.mockResolvedValue(paged([]));
      let rejectFetch: (err: Error) => void = () => {};
      mockedFetchProduct.mockImplementation(
        () => new Promise((_resolve, reject) => { rejectFetch = reject; }),
      );
      renderHistory();

      const saldo = await screen.findByTestId('history-balance');
      expect(saldo).toHaveTextContent('Carregando saldo…');

      rejectFetch(new Error('Falha de rede'));

      await waitFor(() => expect(saldo).toHaveTextContent('Saldo indisponível'));
      expect(screen.getByTestId('history-balance')).toBe(saldo);
    });
  });

  it('o saldo do cabeçalho NÃO muda ao aplicar filtro', async () => {
    mockedFetchMovements.mockResolvedValue(paged([]));
    const user = userEvent.setup();
    renderHistory();

    // Espera o saldo chegar da API antes de comparar — senão compararíamos o
    // placeholder de carregamento com ele mesmo, e o teste passaria por engano.
    await waitFor(() => expect(screen.getByTestId('history-balance').textContent).toMatch(/20/));
    const antes = screen.getByTestId('history-balance').textContent;

    await user.selectOptions(screen.getByLabelText('Tipo'), 'OUT');
    await waitFor(() =>
      expect(mockedFetchMovements).toHaveBeenLastCalledWith('p1', 1, 10, expect.objectContaining({ type: 'OUT' })),
    );

    // O recorte da lista mudou; o saldo do produto não.
    expect(screen.getByTestId('history-balance').textContent).toBe(antes);
    expect(mockedFetchProduct).toHaveBeenCalledTimes(1);
  });

  it('a live region está SEMPRE montada e anuncia o resultado do filtro', async () => {
    mockedFetchMovements.mockResolvedValue(paged([]));
    const user = userEvent.setup();
    renderHistory();

    // Montada desde o primeiro render: uma região criada junto com o conteúdo
    // não é anunciada por NVDA/JAWS — era o defeito que deixava os três
    // estados mudos (A-12ʳ). O diálogo vive num portal, fora do `container`.
    //
    // N3 introduziu uma SEGUNDA região `[role="status"][aria-live="polite"]`
    // (o readout de saldo, `[data-testid="history-balance"]`) — o seletor
    // exclui essa para continuar mirando a região de resultados da tabela.
    const live = [...document.querySelectorAll('[role="status"][aria-live="polite"]')].find(
      (el) => el.getAttribute('data-testid') !== 'history-balance',
    );
    expect(live).toBeInTheDocument();

    await waitFor(() => expect(live).toHaveTextContent(/nenhuma movimentação encontrada para o filtro atual/i));

    // O resultado de filtrar deixa de ser silencioso.
    mockedFetchMovements.mockResolvedValue(paged([makeMovement({ id: 'x1', type: 'OUT' })]));
    await user.selectOptions(screen.getByLabelText('Tipo'), 'OUT');

    // Plural correto: a frase é ouvida, não vista — "1 movimentações" só
    // incomoda quem usa leitor de tela.
    await waitFor(() => expect(live).toHaveTextContent(/1 movimentação encontrada/i));
  });

  it('a linha de estado continua sendo uma célula de tabela válida', async () => {
    mockedFetchMovements.mockResolvedValue(paged([]));
    renderHistory();

    // `role` no próprio `<td>` substituiria o papel implícito `cell`, e a
    // `<tr>` passaria a conter um filho inválido para `row`.
    const vazio = await screen.findByText('Nenhuma movimentação encontrada.');
    expect(vazio.tagName).toBe('TD');
    expect(vazio).toHaveAttribute('role', 'cell');
  });

  it('a interface declara em texto que o saldo não acompanha o filtro (§14.3)', async () => {
    mockedFetchMovements.mockResolvedValue(paged([]));
    renderHistory();

    expect(await screen.findByText(/não muda com os filtros/i)).toBeInTheDocument();
  });
});
