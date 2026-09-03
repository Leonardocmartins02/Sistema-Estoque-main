import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchProducts } from '../src/api/products';
import { fetchQuickOutHistory } from '../src/api/quickOut';
import QuickOutHistoryModal from '../src/components/QuickOutHistoryModal';
import QuickOutListModal from '../src/components/QuickOutListModal';

import { FIXTURE_DATE_ISO, makeProduct, makeQuickOutHistoryItem, paged } from './helpers/factories';
import { renderWithProviders } from './helpers/render';

vi.mock('../src/api/quickOut', () => ({ fetchQuickOutHistory: vi.fn() }));
vi.mock('../src/api/products', () => ({ fetchProducts: vi.fn() }));

const mockedFetchHistory = vi.mocked(fetchQuickOutHistory);
const mockedFetchProducts = vi.mocked(fetchProducts);

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

/**
 * Harness com os providers reais (achado DEP-02, Task 22).
 *
 * Trocado ANTES da migração do componente, com o produto ainda inalterado —
 * mesmo motivo da Task 22.
 *
 * **Por que um componente de casca em vez de `rerender`:** QOH-8 fecha e
 * reabre o diálogo, e o `rerender` do RTL substitui a árvore inteira passada
 * ao `render` — inclusive o `QueryClientProvider`, que renasceria com um cache
 * vazio a cada alternância. O teste passaria a medir a reconstrução do cache,
 * não a preservação do recorte (N-9). Aqui só o `open` muda: o provider, o
 * `QueryClient` e a instância do componente sobrevivem — que é exatamente o
 * que `ProductDashboard` faz.
 */
function renderHistory() {
  const onOpenChange = vi.fn();
  let setOpen!: (v: boolean) => void;

  function Harness() {
    const [open, setOpenState] = useState(true);
    setOpen = setOpenState;
    return <QuickOutHistoryModal open={open} onOpenChange={onOpenChange} />;
  }

  const view = renderWithProviders(<Harness />);
  return {
    onOpenChange,
    client: view.client,
    user: userEvent.setup(),
    close: () => act(() => setOpen(false)),
    reopen: () => act(() => setOpen(true)),
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
  mockedFetchProducts.mockReset();
  mockedFetchProducts.mockResolvedValue(
    paged([makeProduct({ id: 'p1', name: 'Caneta Azul', sku: 'CAN-001' })], { total: 1 }),
  );
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
    //
    // Escopado à célula de estado da tabela: este teste é sobre o conteúdo
    // VISUAL. A live region `role="status"` (WCAG 4.1.3) diz a mesma ideia com
    // outra frase ("...para o filtro atual."), e uma regex global casaria as
    // duas. Quem prova o anúncio falado é o bloco de live regions.
    const table = await screen.findByRole('table');
    expect(
      await within(table).findByRole('cell', { name: 'Nenhuma baixa encontrada.' }),
    ).toBeInTheDocument();
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

/**
 * Requisitos da Task 23 — o que a migração **corrige**.
 *
 * Os casos acima congelam o que precisa sobreviver; estes descrevem o que
 * precisa mudar. Nenhum deles passava antes da migração: o componente não era
 * um diálogo (C-1), a falha de consulta virava "Nenhuma baixa encontrada."
 * (N-6), e busca e datas não tinham rótulo (N-8).
 */
describe('QuickOutHistoryModal — requisitos da migração (Task 23)', () => {
  it('se anuncia como diálogo modal rotulado pelo título (C-1)', async () => {
    renderHistory();

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Histórico de Baixas');
  });

  it('Escape fecha o diálogo (ALTERAR INTENCIONALMENTE — §9.3 item 20)', async () => {
    const { onOpenChange, user } = renderHistory();
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('falha de consulta é comunicada e não se confunde com lista vazia (N-6)', async () => {
    mockedFetchHistory.mockRejectedValue(new Error('Servidor indisponível'));
    renderHistory();

    // Escopado à tabela: o alerta assistivo repete a mensagem como
    // "Erro: Servidor indisponível", então a regex global passou a casar dois
    // nós. Aqui interessa a célula que a pessoa vidente lê.
    const table = await screen.findByRole('table');
    expect(
      await within(table).findByRole('cell', { name: 'Servidor indisponível' }),
    ).toBeInTheDocument();
    // O texto de vazio afirmaria "não há baixas" — conclusão oposta à real.
    expect(within(table).queryByText(/Nenhuma baixa/i)).not.toBeInTheDocument();
  });

  it('no erro, o contador não afirma "0 registro(s)" (N-6)', async () => {
    mockedFetchHistory.mockRejectedValue(new Error('Servidor indisponível'));
    renderHistory();

    // Só a espera é escopada à célula (o alerta assistivo também contém a
    // mensagem). A asserção do contador segue GLOBAL de propósito: o contador
    // vive fora da tabela e é exatamente ele que não pode dizer "0 registro(s)".
    const table = await screen.findByRole('table');
    await within(table).findByRole('cell', { name: 'Servidor indisponível' });
    expect(screen.queryByText(/0 registro\(s\)/)).not.toBeInTheDocument();
  });

  it('a busca tem rótulo associado, não só placeholder (N-8)', async () => {
    renderHistory();

    expect(await screen.findByRole('searchbox')).toHaveAccessibleName(/buscar/i);
  });

  it('os campos de data têm rótulo associado (N-8)', async () => {
    renderHistory();
    await screen.findByText('Caneta Azul');

    const [fromField, toField] = dateFields();
    expect(fromField).toHaveAccessibleName(/de/i);
    expect(toField).toHaveAccessibleName(/até/i);
  });

  it('ordenar envia o critério à consulta e volta para a primeira página (contrato da Task 3)', async () => {
    mockedFetchHistory.mockResolvedValue(paged([makeQuickOutHistoryItem()], { total: 25 }));
    const { user } = renderHistory();
    await screen.findByText('Caneta Azul');

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(lastQuery()?.page).toBe(2));

    await user.click(screen.getByRole('button', { name: /Produto/ }));

    // A ordenação é global e server-side desde a Task 3: o critério viaja na
    // consulta, e a página volta a 1 para não cair num recorte vazio.
    await waitFor(() => expect(lastQuery()?.sortBy).toBe('productName'));
    expect(lastQuery()?.page).toBe(1);
  });
});

/**
 * Empilhamento lista→histórico (achados ORD-01 e REV-15), decidido na Task 23.
 *
 * O teste vive aqui, e não em `QuickOutListModal.test.tsx`, porque o critério
 * só existe com os **dois** lados migrados — foi exatamente por isso que a
 * Task 22 o adiou. `ProductDashboard` mantém dois estados `open` irmãos e as
 * duas instâncias montadas o tempo todo; o harness abaixo reproduz essa fiação
 * sem arrastar o dashboard inteiro para o teste.
 */
function renderStack() {
  const onPick = vi.fn();

  function Harness() {
    const [listOpen, setListOpen] = useState(true);
    const [historyOpen, setHistoryOpen] = useState(false);
    return (
      <>
        <QuickOutListModal
          open={listOpen}
          onOpenChange={setListOpen}
          onPick={onPick}
          onOpenHistory={() => setHistoryOpen(true)}
        />
        <QuickOutHistoryModal open={historyOpen} onOpenChange={setHistoryOpen} />
      </>
    );
  }

  renderWithProviders(<Harness />);
  return { onPick, user: userEvent.setup() };
}

describe('Empilhamento lista→histórico (Task 23)', () => {
  it('com o histórico aberto, só ele é exposto e o foco fica preso nele', async () => {
    const { user } = renderStack();
    const trigger = await screen.findByRole('button', { name: 'Histórico de Baixas' });

    await user.click(trigger);
    await screen.findByText(/Consulte todas as baixas/);

    // Um único diálogo na árvore de acessibilidade: a lista continua montada,
    // mas inerte. Dois aria-modal ativos seriam dois traps concorrentes.
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAccessibleName('Histórico de Baixas');

    // O foco entrou no diálogo do topo e não escapa por Tab.
    expect(dialogs[0].contains(document.activeElement)).toBe(true);
    await user.tab();
    await user.tab();
    expect(dialogs[0].contains(document.activeElement)).toBe(true);
  });

  it('ao fechar o histórico, o foco volta ao gatilho dentro da lista', async () => {
    const { user } = renderStack();
    const trigger = await screen.findByRole('button', { name: 'Histórico de Baixas' });

    await user.click(trigger);
    await screen.findByText(/Consulte todas as baixas/);

    await user.keyboard('{Escape}');

    // A lista volta a ser o único diálogo exposto, e o foco reaparece no
    // controle de onde a pessoa saiu — não no <body>.
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Selecionar Produto para Baixa');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Histórico de Baixas' }),
      ),
    );
  });
});

/**
 * Live regions do histórico (Task 23 — blocker do `accessibility-reviewer`,
 * WCAG 2.1 AA 4.1.3 Status Messages).
 *
 * O que o diálogo faz hoje: carregar, buscar, filtrar por data, ordenar e
 * paginar — **tudo** trocando texto dentro da tabela, sem nenhuma região viva.
 * Para quem usa leitor de tela, apertar "Próxima" ou digitar na busca é uma
 * operação inteiramente silenciosa: o foco não se move, nada é anunciado, e
 * não há como saber se a consulta trouxe 3 linhas, zero linhas ou um erro.
 *
 * O contrato é o mesmo já implantado em `MovementHistoryModal` e
 * `QuickOutListModal` — deliberadamente, para que os três diálogos de consulta
 * falem a mesma língua:
 *
 *   · UMA região `role="status"`/`aria-live="polite"` SEMPRE montada, que
 *     carrega carregando / vazio / resultado;
 *   · UMA região `role="alert"`/`aria-live="assertive"` SEMPRE montada, que
 *     carrega só o erro.
 *
 * **Por que "sempre montada" é o núcleo destes testes:** NVDA e JAWS não
 * anunciam uma live region que nasce junto com o seu conteúdo — o nó precisa
 * existir ANTES da mudança. Um `{isLoading && <div role="status">…</div>}`
 * passaria em qualquer teste que só procure o papel depois do fetch, e ainda
 * assim ficaria mudo na vida real. Por isso cada caso abaixo captura o nó
 * ANTES da resolução da promessa e prova, por identidade de referência
 * (`toBe`), que é o MESMO nó depois.
 *
 * As regiões são consultadas por PAPEL, escopadas ao diálogo: é o papel que o
 * leitor de tela enxerga, e o escopo evita colidir com as regiões do
 * `ToastProvider`, que ficam fora do diálogo.
 */
describe('QuickOutHistoryModal — live regions de estado assíncrono (WCAG 4.1.3)', () => {
  type HistoryPage = Awaited<ReturnType<typeof fetchQuickOutHistory>>;

  /**
   * Consulta suspensa: devolve o controle da promessa ao teste, para observar
   * o estado de carregamento antes de decidir como ele termina. Sem isso o
   * mock resolveria no mesmo tick e "carregando → X" seria só "X" — e o nó
   * capturado "antes" já seria o de depois.
   */
  function deferHistory() {
    let resolveWith!: (value: HistoryPage) => void;
    let rejectWith!: (error: Error) => void;
    mockedFetchHistory.mockImplementation(
      () =>
        new Promise<HistoryPage>((resolve, reject) => {
          resolveWith = resolve;
          rejectWith = reject;
        }),
    );
    return {
      resolve: (value: HistoryPage) => resolveWith(value),
      reject: (error: Error) => rejectWith(error),
    };
  }

  const historyDialog = () => screen.getByRole('dialog', { name: 'Histórico de Baixas' });
  const statusRegion = () => within(historyDialog()).getByRole('status');
  const alertRegion = () => within(historyDialog()).getByRole('alert');
  /** A frase é para ser OUVIDA: comparada inteira, não por pedaço. */
  const spoken = (el: HTMLElement) => el.textContent?.trim();

  it('A · a região de status já existe durante o carregamento e o anuncia', async () => {
    deferHistory();
    renderHistory();
    await screen.findByRole('dialog');

    // Ainda não houve resposta da API: as duas regiões já precisam estar na
    // árvore, senão a primeira mudança de conteúdo nasce junto com a região e
    // não chega a ser anunciada.
    const status = statusRegion();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(spoken(status)).toBe('Carregando histórico.');

    const alert = alertRegion();
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    // Assertivo interrompe a leitura em curso: fora do erro ele fica calado.
    expect(spoken(alert)).toBe('');
  });

  it('B · carregando → sucesso: o MESMO nó anuncia contagem, plural e página', async () => {
    const deferred = deferHistory();
    renderHistory();
    await screen.findByRole('dialog');

    const status = statusRegion();
    expect(spoken(status)).toBe('Carregando histórico.');

    // 1250 registros em 125 páginas: contagem, plural e paginação numa frase só.
    deferred.resolve(paged([makeQuickOutHistoryItem()], { total: 1250 }));

    await waitFor(() =>
      expect(spoken(statusRegion())).toBe('1250 baixas encontradas, exibindo a página 1 de 125.'),
    );
    // Identidade de referência: a região não foi recriada ao trocar de estado.
    expect(statusRegion()).toBe(status);

    // Número CRU, sem `formatQuantity`: "1.250" vira "um ponto duzentos e
    // cinquenta" em alguns sintetizadores. O separador de milhar é decisão
    // tipográfica da tabela (P-4), não da fala.
    expect(statusRegion()).not.toHaveTextContent('1.250');
    // Sucesso não dispara o canal assertivo.
    expect(spoken(alertRegion())).toBe('');
  });

  it('B · uma única baixa é anunciada no singular', async () => {
    mockedFetchHistory.mockResolvedValue(paged([makeQuickOutHistoryItem()], { total: 1 }));
    renderHistory();
    await screen.findByRole('dialog');

    // "1 baixas encontradas" só incomoda quem depende da fala — o único
    // público desta frase.
    await waitFor(() =>
      expect(spoken(statusRegion())).toBe('1 baixa encontrada, exibindo a página 1 de 1.'),
    );
  });

  it('C · carregando → vazio: o MESMO nó anuncia que nada foi encontrado', async () => {
    const deferred = deferHistory();
    renderHistory();
    await screen.findByRole('dialog');

    const status = statusRegion();
    expect(spoken(status)).toBe('Carregando histórico.');

    deferred.resolve(paged([], { total: 0 }));

    // "para o filtro atual" diz à pessoa o que fazer a seguir: o recorte é
    // dela: não é o sistema inteiro que está vazio.
    await waitFor(() =>
      expect(spoken(statusRegion())).toBe('Nenhuma baixa encontrada para o filtro atual.'),
    );
    expect(statusRegion()).toBe(status);
    expect(spoken(alertRegion())).toBe('');
  });

  it('D · carregando → erro: o alert anuncia a falha e o status silencia', async () => {
    const deferred = deferHistory();
    renderHistory();
    await screen.findByRole('dialog');

    // O alert é o canal primário deste estado, e vem primeiro de propósito: no
    // vermelho, a falha aponta a ausência da região assertiva, não só a da
    // polida — as duas faltam, e as duas precisam aparecer no diagnóstico.
    const alert = alertRegion();
    const status = statusRegion();

    deferred.reject(new Error('Servidor indisponível'));

    await waitFor(() => expect(spoken(alertRegion())).toBe('Erro: Servidor indisponível'));
    // As duas regiões atravessam a falha sem serem recriadas.
    expect(alertRegion()).toBe(alert);
    expect(statusRegion()).toBe(status);

    // O status cala para não dizer a mesma coisa em dois canais — e, sobretudo,
    // para não afirmar "nada encontrado": é o N-6 outra vez, agora na fala.
    // Consulta que falhou não tem total conhecido.
    expect(spoken(statusRegion())).toBe('');
    expect(statusRegion()).not.toHaveTextContent(/nenhuma baixa/i);
  });

  it('E · paginar muda o que a região de status anuncia, na mesma região', async () => {
    mockedFetchHistory.mockResolvedValue(paged([makeQuickOutHistoryItem()], { total: 25 }));
    const { user } = renderHistory();
    await screen.findByRole('dialog');

    await waitFor(() =>
      expect(spoken(statusRegion())).toBe('25 baixas encontradas, exibindo a página 1 de 3.'),
    );
    const status = statusRegion();

    // Interação real do componente: "Próxima" dispara uma consulta nova. Hoje
    // o foco continua no botão e nada é dito — a pessoa não sabe se mudou de
    // página nem quantos resultados existem.
    await user.click(screen.getByRole('button', { name: 'Próxima' }));

    await waitFor(() =>
      expect(spoken(statusRegion())).toBe('25 baixas encontradas, exibindo a página 2 de 3.'),
    );
    expect(statusRegion()).toBe(status);
  });

  it('as regiões vivem fora da tabela, não sobre um <td>', async () => {
    deferHistory();
    renderHistory();
    await screen.findByRole('dialog');

    // Atalho tentador: pendurar `role="status"` na célula de estado que já
    // existe. Isso substituiria o papel implícito `cell`, deixaria a `<tr>`
    // com um filho inválido para `row` (o mesmo defeito já barrado em
    // `MovementHistoryModal`) e amarraria o anúncio a um nó que só existe em
    // alguns estados — exatamente o que "sempre montada" proíbe.
    for (const region of [statusRegion(), alertRegion()]) {
      expect(region.tagName).not.toBe('TD');
      expect(region.closest('table')).toBeNull();
    }
  });
});
