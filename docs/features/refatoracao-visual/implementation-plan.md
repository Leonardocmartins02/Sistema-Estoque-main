# IMPLEMENTATION PLAN — Refatoração visual (SimpleStock v2)

> Transforma `PRD.md` em tarefas executáveis. Nesta fase nenhum código mudou: só inspeção do código real e este documento. Referências de requisito: **RF n**, **RNF n** e **RT n** (tabelas) do PRD. Atualizado em 19/10/2026 com o complemento de tabelas, acessibilidade e design system (`research.md` Q8, D9–D12): nova Task 5b e mudanças nas Tasks 1, 5, 8, 15–18, 20–22.

## 1. Inspeção técnica — o que existe e o que muda

**Backend**
- `routes/index.ts` monta tudo sob `requireAuth`, menos `/auth`. Os routers novos seguem o mesmo padrão.
- `routes/products.ts`: `balancesFor(ids)` (privado do arquivo) calcula o saldo de vários produtos com um `groupBy` + uma leitura de `ADJUSTMENT`; `GET /summary` conta por status em memória; o filtro `status` aceita lista. **Não muda.**
- `services/stockService.ts`: `currentBalance(tx, productId)` (privado) e `sumAdjustmentDeltas` (exportado) são a regra de saldo. A série de saldo precisa dessa mesma regra para um produto **ou para o estoque inteiro** — ponto de extensão da Task 7.
- `routes/quick-out.ts`: `GET /history` é o modelo para o histórico geral (Zod, pré-filtro sem acento sobre projeção estreita, `orderBy` com `id` de desempate, DTO montado à mão).
- `routes/movements.ts`: `GET /products/:id/movements` espalha o registro cru (`...movement`, dívida #8). O histórico geral **não** repete isso. A rota fica como está (RF 68).
- `prisma/schema.prisma`: `StockMovement.date` é `timestamp(3)` **sem fuso**, gravado em UTC pelo Prisma. Corte por dia local exige `("date" AT TIME ZONE 'UTC') AT TIME ZONE $tz`. Índices `[productId, type]`, `[type, date]`, `[userId]` já existem; a janela de 30 dias do estoque inteiro filtra só por `date` — medir antes de pensar em índice (não há migration nesta feature).
- Testes: integração HTTP (supertest) contra Postgres, `resetDb`/`createTestUser`/`loginAndGetToken` em `test/helpers`.

**Frontend**
- `main.tsx`: `QueryClientProvider` → `ToastProvider` → `AuthProvider` → `App`. `App.tsx` é o shell atual (cabeçalho + `ProductDashboard`), com skip link e `ApiStatusBanner`. Sem roteador.
- `ProductDashboard.tsx` (470 linhas) orquestra lista, filtros, seleção e **sete** diálogos. `useProductsQuery` guarda busca/página/ordem/status em `useState`; `useProductMutations` invalida `['products']`.
- `ui/Modal.tsx`: primitivo único sobre Radix, variantes `dialog` e `sheet`, pilha de diálogos com `aria-hidden` no que não é topo, retorno de foco manual. A variante `drawer` entra aqui.
- `ui/Button.tsx` (`primary · secondary · tertiary · destructive · shortcut`), `ui/Badge.tsx` (`success · warning · danger · info`), `ui/DataTable.tsx`, `ui/MenuPopover.tsx`, `ui/Input|Select|Textarea`, `ToastProvider`, `ConfirmDialog` + `useConfirm`.
- `products/StatusFilterMenu.tsx` (status múltiplo) e `ui/LowStockBanner.tsx` saem (RF 19, 63). `MovementFormModal.tsx` vira o painel de movimentação (RF 38–50). `MovementHistoryModal.tsx` sai (RF 62).
- Query keys: `['products', …]` (lista), `['products', 'summary']`, `['movements', productId, …]`.
- Tabelas: só `ProductsTable` usa `ui/DataTable`; `QuickOutListModal`, `QuickOutHistoryModal` e `MovementHistoryModal` têm `<table>` própria com cabeçalho ordenável, paginação e estados copiados. O `DataTable` usa cinza cru, `role` redundante, "Carregando..." em texto, um estado vazio e dois pares de props de ordenação (`sort` sem chamador; `sorts` usado pelo `ProductsTable`) — inventário completo em `research.md` Q8.
- `index.css`/`tailwind.config.js`: tokens da Fase 5; `body` ainda usa `bg-gray-50 text-gray-900` cru. `eslint.config.js`: 19 utilitários proibidos (Task 27), sem mudança.
- Testes: Vitest + RTL, `renderWithProviders` e `makeSpyActions` em `test/helpers/render.tsx`, fábricas em `test/helpers/factories.ts`, caracterizações `*.characterization.test.tsx` (PD-1…PD-6, MFM-1…MFM-6, MHM-1…MHM-6, QOM).

**Shared**
- `packages/shared/src/index.ts` só tem `ApiError` e `ProductStockSummary`. Os tipos **novos** de resposta entram aqui (Task 6); os antigos ficam onde estão (fora do escopo).

**Deploy**
- `packages/frontend/netlify.toml` só tem o redirect de `/api/*`. Falta o fallback de SPA (RNF 11).

## 2. Decisões que fecham o que o PRD deixou para o plano

| # | Decisão | Motivo |
|---|---|---|
| P-1 | **Ordem das fases difere da do plano visual** (§15 dele): design system → backend → shell → **nova movimentação** → produtos → **movimentações** → **produto** → **dashboard** → restantes | Dependência real: "Repor" (dashboard) e "Movimentar" (lista, produto) precisam do painel novo; "Ver no histórico" (produto) e "Ver histórico" (dashboard) precisam de Movimentações; a página do produto só pode substituir o modal de histórico depois que Movimentações cobre os filtros dele. Nada fica com link para tela que ainda não existe |
| P-2 | Uma **branch** (`feat/refatoracao-visual`), **um commit por task**, cada commit com diff visual aprovado antes. PR quando o usuário decidir (o plano não presume um PR por fase) | Regra do projeto |
| P-3 | Até a Fase 8, `/` **redireciona** para `/produtos`, e a sidebar só ganha um item quando a tela dele existe | Regra da sidebar (só telas reais); cada commit deixa o app utilizável |
| P-17 | **Execução em fatia vertical** (decidido com o usuário em 19/10/2026, depois da Task 2): T5 → T5b → T3 → T10 → T11 → T14 → T15 primeiro, para a sidebar e a tela de Produtos do protótipo aparecerem cedo; depois T12 → T13 → T6–T9 → T16 → T17 → T4 → T18 → T19 → T20 → T21 → T22. A numeração das tasks não muda | Na ordem por fases o visual novo só aparecia na Task 10 e Produtos na 15 — as capturas das Tasks 1–2 mostravam a tela antiga. Ajustes para não quebrar P-3 (nada aponta para o que não existe): até a T12, "Movimentar" abre o modal atual e o botão global "Nova movimentação"/"Movimentar" do celular não aparece; o gráfico (T4) já nasce sobre a Data Table |
| P-4 | Painel de movimentação aberto por um **provider** no shell (`openMovement({ product?, type? })`), não por estado em cada tela | É aberto de 5 lugares (sidebar, barra do celular, linha, página do produto, "Repor"); um provider evita cinco cópias do estado e mantém um único painel montado |
| P-5 | Ações de produto (editar, ajustar, baixa rápida, zerar, excluir) saem do `ProductDashboard` para um hook `useProductActionDialogs()` que devolve `{ actions, dialogs }`, no molde de `useConfirm` (`{ confirm, confirmDialog }`) | A lista e a página do produto precisam das mesmas ações e diálogos; é também a decomposição do componente-deus que o `AGENTS.md` pede |
| P-6 | Invalidação centralizada num `invalidateStock()` que invalida `['products']`, `['movements']` e `['dashboard']`; as chaves novas ficam sob esses prefixos (`['products', 'detail', id]`, `['products', 'trend', id, tz]`, `['movements', 'list', filtros]`, `['dashboard', tz]`) | Qualquer operação muda saldo, contagem, série e histórico ao mesmo tempo (RF 37, 48) |
| P-7 | Navegação móvel abre num `Modal variant="drawer"` com `side="left"`; o painel de movimentação usa `side="right"` (padrão) | Um primitivo, dois lados; foco preso e `Esc` herdados |
| P-8 | Linha clicável (RF 23): `onClick` na `<tr>` só para ponteiro, ignorando cliques que nascem em `a, button, input, label`; o alvo de teclado é o link do nome | Evita um segundo alvo de foco por linha e não rouba o clique dos controles |
| P-9 | URL como fonte do estado de lista: um hook `useListParams(schema)` lê e escreve `useSearchParams` com Zod (`.catch(default)` por campo) e `replace: true` na busca | Valor inválido cai no padrão por construção (contrato de URL do PRD); busca não empilha histórico |
| P-10 | Fuso validado com `new Intl.DateTimeFormat('en-US', { timeZone })` dentro de um `z.string().refine(...)` em `shared/queryParams.ts`; passado ao SQL só como parâmetro do `$queryRaw` | Cobre `UTC` e aliases que `Intl.supportedValuesOf` pode omitir; nunca interpolado (RNF do PRD) |
| P-11 | Gráficos em `components/charts/` (`AreaTrend`, `StatusBar`), escala com "nice ticks", tooltip compartilhado por mouse e teclado, tabela de dados alternável | `research.md` Q3; regras da skill de dataviz (linha 2 px, área 10 %, grade hairline, sem cor sozinha) |
| P-12 | Pastas: `src/app/` para roteador e shell (camada nova, sem equivalente hoje), `src/pages/` com um arquivo por rota, e subcomponentes em `src/components/<área>/`, como `components/products/` já faz | Segue o padrão existente; só cria o que não tem lugar hoje |
| P-13 | **Data Table = `ui/DataTable` estendido**, mantendo a API de colunas (`columns`, `getRowId`, `render`, `align`, `tabularNums`, `sortKeys`). Busca, chips de filtro, barra de seleção e paginação são irmãos compostos pela página, não filhos da tabela | Padrão do projeto; uma tabela que conhece os filtros de cada tela repetiria o componente-deus (`research.md` Q8) |
| P-14 | Cabeçalho fixo com `position: sticky` no `<th>` e a região com `overflow: clip` (Tailwind `overflow-clip`); a prioridade de coluna (`priority`) esconde colunas por classe responsiva antes de faltar largura | `overflow: hidden/auto` cria contêiner de rolagem e o `sticky` deixa de grudar no viewport; sem rolagem lateral não há o que esconder |
| P-15 | Cada componente novo ou estendido do design system (Tasks 2–5b) registra um bloco em `docs/features/refatoracao-visual/components.md`: propósito · anatomia · variantes · tamanhos · estados · acessibilidade · faça · não faça · exemplo | D12 (sem Storybook); o plano de tabelas §51 pede documentação mínima por componente |
| P-16 | Os *gates* do PRD (RNF 7) e as checklists do plano de tabelas (§65–67) entram no "Pronto" de toda task que toca UI, não só no QA final | O plano: "uma tela não pode ser considerada concluída" com falha crítica |

## 3. Impacto no modelo de dados

**Nenhum.** Sem migration, sem coluna nova, sem índice novo. Se a medição da Task 9 mostrar que a janela de 30 dias do estoque inteiro é lenta no seed, o achado é registrado — índice novo seria migration e fica fora desta feature.

## 4. Tarefas

Cada task segue o ciclo do `AGENTS.md`: teste que expõe o requisito (red) → mínimo para passar (green) → refatorar. **Pronto** = `pnpm -r run lint`, `pnpm -r run typecheck`, testes do backend e do frontend e `pnpm -r run build` verdes, mais o diff visual aprovado. Tasks que tocam UI terminam com capturas a 390, 900 e 1440 px comparadas com o protótipo e, além disso (P-16):

- **teste só com teclado** do fluxo principal da tela, recarregando a página e sem tocar no mouse — o foco nunca some nem fica escondido;
- **zoom de 200 %** sem perder função;
- *accessibility gate* e, se houver tabela, *table gate* do PRD (RNF 7) sem falha;
- checklist do plano de tabelas: por Data Table (§65), por componente (§66) e por tela (§67);
- bloco de documentação do componente (P-15), quando a task cria ou estende um.

---

### Fase 0 — Documentação

#### Task 0 — Registrar IDEA, RESEARCH, PROTOTYPE, PRD e este plano
- **Arquivos**: `docs/features/refatoracao-visual/**` (só esta pasta — os arquivos não rastreados de `integracoes-webhooks` ficam fora do commit).
- **Commit**: `docs(refatoracao-visual): registrar ideia, pesquisa, protótipo, PRD e plano`

---

### Fase 1 — Design system v2

#### Task 1 — Tokens v2
- **Requisitos**: RNF 6, 7; D7.
- **Arquivos**: `frontend/src/index.css`, `frontend/tailwind.config.js`.
- **Alterações**: raio `sm` 6 px (novo), `control` 10 px, `surface` 14 px, `pill` novo; `background` um degrau mais escuro; `surface-subtle` deixa de ser alias; `surface-selected` (novo, = `accent-subtle`); `text-disabled` (novo, só controle desabilitado); `info`/`info-subtle`; `sidebar-*` (fundo, texto, texto ativo, item ativo, indicador, separador, rótulo); `success-fill`/`warning-fill`/`danger-fill`; `shadow-card`; papéis tipográficos `kpi` e `display-number`; `body` passa a `bg-background text-text-primary`; `html { scroll-padding-top: 56px }` (WCAG 2.4.11, cabeçalho fixo e barra do celular). Valores exatamente os do protótipo aprovado; os nomes atuais ficam (`research.md` Q8, "Tokens").
- **Testes**: `designSystemLintRule.test.ts` continua verde sem mudança (a lista de 19 não muda). Contraste dos pares novos recalculado e registrado no commit (mesmos números do `prototype.md`).
- **Risco**: tudo que já usa token herda raio e canvas novos — é o objetivo. As capturas antes/depois mostram o efeito em todas as telas atuais.
- **Commit**: `feat(ui): tokens do design system v2`

#### Task 2 — Botão `tonal`, badge em pílula e rótulos de domínio
- **Requisitos**: RF 22 (D4), P5 do research.
- **Arquivos**: `ui/Button.tsx`, `ui/Badge.tsx`, novos `ui/StatusBadge.tsx` (ponto + palavra do vocabulário fechado), `ui/MovementTypeLabel.tsx` (ícone + palavra), `ui/Delta.tsx` (diferença assinada com `formatDelta`, seta de tendência decorativa), `ui/BalanceFlow.tsx` (`antes → depois` com texto "de X para Y" para leitor de tela — separado do `Delta` na execução: são duas leituras diferentes e aparecem lado a lado); blocos de documentação em `components.md` (P-15).
- **Testes**: `Button.test.tsx` (variante `tonal` com classes de token e foco); testes novos para `StatusBadge` (palavra sempre presente, ponto `aria-hidden`), `MovementTypeLabel` (os quatro tipos com palavra) e `Delta.test.tsx` (`+12`, `−5`, `0`, `—` sem dado; `BalanceFlow` com texto acessível "para", sem anterior e legado).
- **Commit**: `feat(ui): botão tonal e rótulos de status, tipo e variação`

#### Task 3 — Variante `drawer` do `Modal`
- **Requisitos**: RF 50, RNF 10; P-7.
- **Arquivos**: `ui/Modal.tsx`, `test/Modal.test.tsx`.
- **Alterações**: `variant: 'dialog' | 'sheet' | 'drawer'` e `side?: 'left' | 'right'` (só para `drawer`); largura fixa no desktop, tela cheia abaixo de 768 px; entrada de 180 ms respeitando `prefers-reduced-motion`. Pilha, `aria-hidden` e retorno de foco **inalterados**.
- **Testes**: drawer se anuncia como `dialog` com nome; foco entra e fica preso; `Esc` fecha e devolve o foco; empilhar `drawer` + `ConfirmDialog` mantém um único diálogo exposto (mesmo teste já existente para `dialog`).
- **Commit**: `feat(ui): variante drawer do Modal`

#### Task 4 — Gráficos em SVG próprio
- **Requisitos**: RF 14, 15, 32; P-11.
- **Arquivos**: `components/charts/AreaTrend.tsx`, `components/charts/StatusBar.tsx`, `lib/niceScale.ts`, testes.
- **Alterações**: `AreaTrend` (série de pontos, linha de referência opcional para o mínimo, crosshair + tooltip por mouse e por teclado, `Home`/`End`, "Ver como tabela" sobre a Data Table (T5b vem antes, P-17), `aria-label` descritivo, rótulos do eixo x espaçados conforme a largura); `StatusBar` (três segmentos com 2 px de separação, legenda com palavra, número e percentual, cada item como link).
- **Testes**: `niceScale` (ticks inteiros "redondos"; série plana em 0); `AreaTrend` (descrição acessível com mínimo/máximo/último; setas movem o tooltip; tabela mostra os 30 valores); `StatusBar` (legenda com os três status e percentuais que somam 100; link de cada item).
- **Commit**: `feat(ui): gráficos de tendência e status em SVG`

#### Task 5 — Peças de página
- **Requisitos**: RF 19, 26, 51, 57; estados do PRD.
- **Arquivos**: `ui/PageHeader.tsx` (trilha opcional, `<h1>` focável, subtítulo, ações), `ui/LinkTabs.tsx` (abas que são links, com contagem e `aria-current`), `ui/Pagination.tsx` (intervalo com o nome do item "1–20 de 209 movimentações", anterior/próxima, **páginas numeradas** — todas até 7, acima disso primeira · vizinhas · última com "…" —, itens por página; RT 6), `ui/RegionState.tsx` (vazio · sem resultado · erro com `role="alert"` e "Tentar de novo"), `ui/Skeleton.tsx`, `ui/StatCard.tsx` (KPI e variante de destaque), `ui/FilterChips.tsx` (chip removível "Remover filtro ‹rótulo›" + "Limpar filtros", alvo 24 × 24; RT 12).
- **Testes**: um arquivo por peça, cobrindo o contrato acessível (`aria-current`, `role="alert"`, rótulos de navegação, limites da paginação, janela numerada com 1, 7, 8 e 11 páginas, reticências fora da árvore de acessibilidade).
- **Commit**: `feat(ui): cabeçalho, abas, paginação e estados de região`

#### Task 5b — Data Table única
- **Requisitos**: RT 1–5, 7–11; RNF 13; P-13, P-14; D9.
- **Arquivos**: `ui/DataTable.tsx`, `test/DataTable.test.tsx`, novo `ui/SelectionBar.tsx` (barra contextual de seleção, saída do `ProductDashboard` sem mudar texto nem comportamento).
- **Alterações**:
  - `caption` obrigatória (aceita `visuallyHidden`); `role` redundante removido (a semântica nativa basta);
  - `priority?: 'P0' | 'P1' | 'P2'` por coluna → classes responsivas (P2 só ≥ 1180 px, P1 só ≥ 768 px);
  - `stickyHeader`, `density: 'single' | 'two-line'` (40/48 px, cabeçalho 36 px);
  - `state: 'loading' | 'empty' | 'no-results' | 'error' | 'content'` — skeleton com a altura e o número de linhas da página, os outros por `RegionState`;
  - `selection` (`selectedIds`, `onToggle`, `onTogglePage`, rótulo por linha) com a receita `surface-selected` + barra de 2 px;
  - `onRowClick` que ignora cliques nascidos em `a, button, input, label` (P-8);
  - `groups` (`{ key, header, rows }[]` → um `<tbody>` por grupo, `<th scope="rowgroup">`) e `renderRowDetail` + `expandedIds` (linha de detalhe controlada por botão com `aria-expanded`);
  - ícone de ordenação ↕ / ↑ / ↓; `aria-sort` só no `<th>` ordenado (comportamento atual mantido);
  - cinza cru trocado por token; o par legado `sort`/`onSortChange`, sem nenhum chamador, sai — fica `sorts`/`onSortsChange`, que o `ProductsTable` usa (só o primeiro critério vale desde a Task 3 da Fase 2).
- **Testes**: `sorting.globalContract.test.tsx` e as suítes de `ProductsTable` verdes **sem alteração de asserção**; novos: `caption` presente; `aria-sort` só na coluna ordenada e ícone correspondente; grupos expõem `rowgroup` com o cabeçalho; detalhe abre pelo botão (`aria-expanded`, `aria-controls`) e pelo clique de ponteiro na linha, mas não por clique em link/checkbox; `state` mostra skeleton com o número de linhas pedido e textos distintos para vazio × sem resultado; erro com `role="alert"`; linha selecionada com a classe da receita; colunas P1/P2 com as classes responsivas.
- **Commit**: `feat(ui): data table única com estados, grupos e prioridade de coluna`

---

### Fase 2 — Backend de leitura (paralelizável com a Fase 1)

#### Task 6 — Tipos compartilhados
- **Requisitos**: contrato da API do PRD.
- **Arquivos**: `shared/src/index.ts`.
- **Alterações**: `MovementType`, `TypeTotals`, `TrendPoint`, `MovementListItem`, `MovementListResponse`, `MovementUser`, `DashboardOverview`, `ProductTrend`.
- **Testes**: só tipo — verificado pelo `typecheck` dos dois pacotes que os consomem nas Tasks 8–9 e 12 em diante.
- **Commit**: `feat(shared): tipos das rotas de leitura`

#### Task 7 — Saldo com escopo, um único cálculo
- **Requisitos**: RNF 3.
- **Arquivos**: `services/stockService.ts`, `test/stockService.test.ts`.
- **Alterações**: `currentBalance` vira exportada como `balanceOf(client, { productId? })` — sem `productId`, soma o estoque inteiro — e `recordMovementInTx`/`recordAdjustmentInTx` passam a chamá-la com `productId` (comportamento idêntico). Nova função pura `movementDelta({ type, quantity, previousQuantity, newQuantity })`, a mesma regra de `sumAdjustmentDeltas`.
- **Testes**: suíte atual do `StockService` e de concorrência **sem alteração**; casos novos para `balanceOf` sem escopo (soma de vários produtos, com ajuste e com ajuste legado) e para `movementDelta` (quatro tipos + legado → `null`).
- **Commit**: `refactor(stock): expor saldo com escopo e efeito por movimentação`

#### Task 8 — `GET /api/movements` e `GET /api/movements/users`
- **Requisitos**: RF 64, 65; RNF 4.
- **Arquivos**: novo `routes/history.ts`, `routes/index.ts` (`router.use('/movements', requireAuth, history)`), `shared/queryParams.ts` (`timezoneParam`, `movementTypesParam`), novo `test/movements.history.test.ts`.
- **Alterações**: Zod para todos os parâmetros (incluindo `order: 'desc' | 'asc'`, padrão `desc` — D10); `where` montado como em `/quick-out/history`; `findMany` com `select` explícito (produto e e-mail), `orderBy [{ date: order }, { id: 'asc' }]`, `skip/take`; `count`; `totalsByType` por `groupBy` de `type` sobre o `where` **sem** `type` (soma de `quantity`; ajuste somado via `sumAdjustmentDeltas`); `days` por `$queryRaw` agrupando por dia local só nos dias presentes na página; DTO com `delta` de `movementDelta`.
- **Testes** (escritos antes):
  - cada filtro isolado e combinados; `type=IN,INITIAL_STOCK`;
  - `q` casa nome, SKU e observação, sem acento ("lapis" → "Lápis");
  - `totalsByType` ignora `type` e respeita os demais filtros; `units` do ajuste com sinal;
  - `days` com virada de dia em `America/Sao_Paulo` (02h30 UTC conta no dia anterior);
  - ordem determinística entre páginas com datas iguais, em `order=desc` e em `order=asc`;
  - DTO **não** contém `userId`, `referenceType`, `referenceId`, `createdAt` nem `passwordHash`;
  - legado: sem usuário → `userEmail: null`; ajuste sem antes/depois → `delta: null`;
  - `users`: só quem tem movimentação, ordenado por e-mail, só `id` e `email`;
  - 401 sem sessão; 400 para `type`, `from`, `tz`, `order` e `pageSize` inválidos.
- **Commit**: `feat(api): histórico geral de movimentações e lista de responsáveis`

#### Task 9 — Série de saldo: `GET /api/dashboard` e `GET /api/products/:id/trend`
- **Requisitos**: RF 66, 67; RNF 3, 5; regras de negócio do PRD.
- **Arquivos**: novo `services/trendService.ts`, novo `routes/dashboard.ts`, `routes/products.ts` (só a rota `/:id/trend`, antes de `/:id`), `routes/index.ts`, novos `test/dashboard.test.ts` e `test/products.trend.test.ts`.
- **Alterações**: `balanceTrend(client, { productId?, tz, days: 30 })` = `balanceOf` + **uma** agregação `$queryRaw` dos deltas por dia local com data posterior ao início da janela (incluindo datas futuras) → anda para trás até hoje − 29. `todayTotals` = `TypeTotals` do dia local de hoje. `units` = `balanceOf` sem escopo.
- **Testes** (escritos antes):
  - exemplo do PRD: saldo 10, entrada 4 hoje, saída 6 ontem → 10 · 6 · 12;
  - ajuste para cima e para baixo no meio da janela; ajuste legado não move a série;
  - movimentação datada no futuro não entra no ponto de hoje;
  - movimentação retroativa (data de 10 dias atrás gravada hoje) entra no dia informado;
  - 30 pontos, datas consecutivas `AAAA-MM-DD` terminando hoje no `tz`;
  - produto sem movimentação → 30 pontos em 0;
  - `today` em `America/Sao_Paulo` exclui 23h30 de ontem (02h30 UTC de hoje);
  - `units` igual à soma dos saldos de `GET /products?pageSize=0`;
  - 404 para produto inexistente; 400 para `tz` inválido; 401 sem sessão.
  - **Medição**: tempo das duas rotas com o seed, registrado no commit (RNF 5).
- **Commit**: `feat(api): série de saldo do estoque e do produto`

---

### Fase 3 — App shell e rotas

#### Task 10 — Roteador, shell e sidebar
- **Requisitos**: RF 1–5, 8–11; RNF 2, 11; P-3.
- **Arquivos**: `frontend/package.json` (`react-router@7.18.x`), `main.tsx`, `App.tsx` (vira o gate de autenticação + `RouterProvider`), novos `app/router.tsx`, `app/AppShell.tsx`, `app/Sidebar.tsx`, `app/useRouteFocus.ts`, `pages/NotFoundPage.tsx`, `netlify.toml` (fallback de SPA), `test/helpers/render.tsx` (`renderWithRouter` com `createMemoryRouter`).
- **Alterações**: rotas `/` (redireciona para `/produtos` até a Fase 8), `/produtos` (renderiza o `ProductDashboard` atual, sem mudança de comportamento), `*`. Sidebar escura com Produtos e os dois atalhos com contadores de `useProductStockSummary`; rodapé com e-mail, recolher (preferência em `localStorage` com `try/catch`) e Sair. `useRouteFocus` move o foco para o `<h1>` e atualiza o título só quando o **pathname** muda.
- **Testes**: `App.test.tsx` (skip link continua o primeiro focável); sidebar (`aria-current` no item certo, inclusive nos atalhos; contador com texto acessível igual ao `summary`; recolher persiste e sobrevive a `localStorage` que lança); `useRouteFocus` (foco no `<h1>` ao trocar de rota, **não** ao trocar só a query); rota inexistente com `<h1>`; sem sessão em `/produtos?status=baixo` → login → volta à mesma URL.
- **Commit**: `feat(app): roteador, shell e sidebar`

#### Task 11 — Shell responsivo
- **Requisitos**: RF 6, 7; RNF 7.
- **Arquivos**: `app/AppShell.tsx`, `app/Sidebar.tsx`, novo `app/MobileTopbar.tsx`.
- **Alterações**: 768–1023 px trilho de ícones (nome acessível por item, contador como ponto + número no nome); < 768 px barra superior escura com menu e marca (o "Movimentar" da barra entra na Task 12, P-17); navegação móvel em `Modal variant="drawer" side="left"`, fechando ao navegar.
- **Testes**: navegação móvel abre como diálogo nomeado, `Esc` fecha e devolve o foco ao botão de menu, navegar fecha; trilho mantém nomes acessíveis. Capturas a 390, 900 e 1440 px.
- **Commit**: `feat(app): sidebar recolhível e navegação no celular`

---

### Fase 4 — Nova movimentação

#### Task 12 — Painel de movimentação
- **Requisitos**: RF 3, 38–50; P-4, P-6.
- **Arquivos**: `MovementFormModal.tsx` → `components/movement/MovementDrawer.tsx`, novos `components/movement/MovementDrawerProvider.tsx` (`useMovementDrawer().openMovement({ product?, type? })`), `components/movement/ProductPicker.tsx` (combobox), `hooks/useInvalidateStock.ts`; `useProductMutations.ts` passa a usar `invalidateStock`; `pages/ProductsPage.tsx` troca o estado `movingProduct` por `openMovement` ("Movimentar" da linha passa a abrir o painel) e o menu da linha ganha "Nova entrada"/"Nova saída"; `AppShell` monta o provider, o botão "Nova movimentação" da sidebar e o "Movimentar" da barra do celular (P-17).
- **Antes de mover**: `MovementFormModal.test.tsx` e `MovementFormModal.characterization.test.tsx` (MFM-1…MFM-6) passam a apontar para o painel **sem mudar nenhuma asserção** — são o contrato. Só depois entram os testes novos.
- **Testes novos**: abrir sem contexto → nenhum tipo, nenhum produto, confirmação indisponível; `type: 'IN'` → "Entrada" marcado e título "Registrar entrada"; combobox (filtra por nome e SKU, setas + `Enter`, mostra saldo, permite trocar); valores rápidos `1 · 5 · 10 · 25 · 50` com `aria-pressed`; preview com status resultante; aviso de abaixo do mínimo sem bloquear; saída = saldo não avisa; bloqueio de saída > saldo; 422 do servidor aparece no painel com dados preservados; sucesso fecha, toast com novo saldo e invalida `['products']`, `['movements']`, `['dashboard']`.
- **Commit**: `feat(stock): painel de nova movimentação`

#### Task 13 — Formulários existentes no painel lateral
- **Requisitos**: RF 59, 61.
- **Arquivos**: `ProductFormModal.tsx`, `AdjustmentFormModal.tsx`, `QuickOutModal.tsx` (só `variant="drawer"` e o tamanho).
- **Testes**: as suítes atuais desses três componentes (incluindo `QuickOutModal.characterization`) passam **sem alteração**. Se alguma asserção quebrar, é regressão a corrigir, não teste a ajustar.
- **Commit**: `refactor(ui): formulários de produto, ajuste e baixa rápida no painel lateral`

---

### Fase 5 — Produtos

#### Task 14 — Estado da lista na URL e ações extraídas
- **Requisitos**: contrato de URL; RF 19–21, 25; P-5, P-9.
- **Arquivos**: novo `hooks/useListParams.ts`; `hooks/useProductsQuery.ts` (lê/escreve URL em vez de `useState`; status vira um só); novo `hooks/useProductActionDialogs.tsx` (editar, ajustar, baixa rápida, zerar, excluir + diálogos, saído do `ProductDashboard`).
- **Testes**: URL → estado (`?status=baixo&ordem=saldo&dir=desc&pagina=2&por=20`); valores inválidos caem no padrão; mudar busca/aba/ordem/tamanho volta à página 1; busca usa `replace`. `ProductDashboard.characterization` PD-1…PD-6 continuam verdes — PD-4 (entrada no filtro de estoque baixo) passa a entrar pela aba/atalho, mudança registrada no commit.
- **Commit**: `refactor(products): estado da lista na URL e ações de produto num hook`

#### Task 15 — Tela de Produtos v2
- **Requisitos**: RF 19–28, 63; RT 1–12; D4, D8, D11.
- **Arquivos**: `ProductDashboard.tsx` → `pages/ProductsPage.tsx`; `products/ProductsTable.tsx`, `products/ProductCardList.tsx`, `products/ProductActionsMenu.tsx`, `products/ProductFiltersSheet.tsx` (vira "Ordenar"); remover `products/StatusFilterMenu.tsx`, `ui/LowStockBanner.tsx` e seus testes.
- **Alterações**: `PageHeader` com as duas ações; `LinkTabs` com contagens do `summary`; `ProductsTable` sobre a Data Table v2 (`caption`, `stickyHeader`, `density="two-line"`, seleção com a receita); linha com iniciais, nome-link, SKU, saldo × mínimo, `StatusBadge`, "Movimentar" `tonal` e `⋯` — **a baixa rápida sai da linha e entra no menu** (D11); menu em três grupos: *Ver histórico* (modal, até a Task 19) · Editar | Baixa rápida · Ajustar estoque | Zerar estoque · Excluir — "Nova entrada"/"Nova saída" entram na Task 12 e "Movimentar" abre o modal atual até lá (P-17); linha clicável (P-8); seleção e regiões destrutivas como hoje, a barra pelo `SelectionBar`; `Pagination` numerada com itens por página. Sidebar passa a mostrar o item "Produtos" como página real (já existia) e os atalhos levam às abas.
- **Testes**: abas (contagem = `summary`, `aria-current`, partição); clique na linha navega, clique em controle não; o link do nome é o alvo de teclado; "Movimentar" abre o modal de movimentação com o produto (o painel e "Nova saída" com "Saída" marcada e foco de volta ao `⋯` são testados na Task 12); nenhuma linha tem botão de baixa rápida e o menu tem; `sorting.globalContract.test.tsx` verde; testes de `ProductsTable`/`ProductCardList`/`ProductActionsMenu` atualizados só onde o PRD muda (botão `tonal`, D11); o item "Ver histórico" continua abrindo o modal até a Task 19.
- **Matriz de paridade**: linhas 2, 19 e o banner atualizadas como mudança declarada; **linha 20** (baixa rápida) passa a "Overflow nas duas larguras" e o teste `o menu do desktop NÃO repete a baixa rápida` vira `a baixa rápida é alcançável pelo menu da linha` — mudança declarada da D11.
- **Commit**: `feat(products): tela de produtos com abas, linha clicável e ação tonal`

---

### Fase 6 — Movimentações

#### Task 16 — Cliente e estado do histórico
- **Requisitos**: RF 51–58; contrato de URL.
- **Arquivos**: `api/movements.ts` (`fetchMovementHistory`, `fetchMovementUsers`), novo `hooks/useMovementHistory.ts` (URL → `from`/`to` pelo período no fuso do navegador; aba → lista de tipos; `dir` → `order`), `lib/dateRanges.ts`.
- **Testes**: período → intervalo (`hoje`, `7d`, `30d`, `tudo`, `personalizado` com de/até inclusivos), cada aba → tipos, `dir=asc` → `order=asc` e volta à página 1, parâmetros inválidos → padrão.
- **Commit**: `feat(history): cliente e estado do histórico geral`

#### Task 17 — Tela de Movimentações
- **Requisitos**: RF 51–58; RT 1–12; D9, D10; item "Movimentações" na sidebar.
- **Arquivos**: novo `pages/MovementsPage.tsx` e `components/history/` (`HistoryFilters`, `HistoryTable` sobre a Data Table v2 com `groups` por dia e `renderRowDetail`, `HistoryCardList` para o celular, no molde de `ProductsTable`/`ProductCardList`), rota `/movimentacoes`, item na sidebar, item "Ver no histórico" no menu da linha de Produtos.
- **Alterações**: colunas Quando (ordenável, P0) · Tipo (P0) · Produto (P0, dois níveis) · Quantidade (P0) · Saldo (P1) · Responsável (P2) · detalhe; `stickyHeader`; `Pagination` numerada; `FilterChips`.
- **Testes**: abas com contagens de `totalsByType`; filtros viram chips removíveis e "Limpar filtros"; resumo (entraram = Entrada + Estoque inicial; saíram = Saída); um `rowgroup` por dia com "Hoje"/"Ontem" e contagem de `days`; "Quando" alterna `aria-sort` e `dir` na URL e volta à página 1; o botão de detalhe tem nome com tipo, produto e hora, alterna `aria-expanded` e mostra o detalhe; clique de ponteiro na linha também abre; legado ("—", "Usuário não disponível"); cinco estados; "Ver no histórico" no menu de Produtos leva a `/movimentacoes?produto=<id>&periodo=tudo`; MHM-1 (de/até), MHM-2 (busca), MHM-3 (itens por página) e MHM-5 (limites) **reescritos contra esta tela** antes de o modal sair na Task 19.
- **Commit**: `feat(history): tela de movimentações com filtros e agrupamento por dia`

---

### Fase 7 — Produto

#### Task 18 — Página do produto
- **Requisitos**: RF 29–37.
- **Arquivos**: novo `pages/ProductPage.tsx` e `components/product/` (`BalanceVsMinimum`, `ProductTrendCard`, `RecentMovements`), `api/products.ts` (`fetchProductTrend`), rota `/produtos/:id`.
- **Alterações**: "Últimas movimentações" na Data Table (`density="single"`, `caption`); cabeçalho com "Movimentar" (primária), "Editar" e `⋯` com os grupos de operar e destrutivo do menu de Produtos (RF 30).
- **Testes**: identidade e trilha; veredito do saldo (acima, faltam, sem estoque; mínimo 0 sem marca); gráfico com linha do mínimo; 8 últimas movimentações e o link "Ver no histórico" com `produto` e `periodo=tudo`; ações via `useProductActionDialogs`; o `⋯` da página não repete "Ver produto", "Ver no histórico" nem "Editar"; excluir navega para `/produtos` com toast; 404 → "Produto não encontrado"; operação no painel atualiza saldo, série e lista sem recarregar.
- **Commit**: `feat(products): página do produto`

#### Task 19 — "Ver produto" no lugar do modal de histórico
- **Requisitos**: RF 24, 62; D5.
- **Arquivos**: `products/ProductActionsMenu.tsx`, `products/types.ts` (`onHistory` → `onOpen`), `pages/ProductsPage.tsx`; remover `MovementHistoryModal.tsx` e seus dois testes (os comportamentos já foram portados na Task 17).
- **Testes**: item "Ver produto" navega para `/produtos/:id`; nenhum import restante do modal (o build prova).
- **Commit**: `refactor(products): abrir a página do produto em vez do modal de histórico`

---

### Fase 8 — Dashboard

#### Task 20 — Dashboard
- **Requisitos**: RF 12–18; D6.
- **Arquivos**: novo `pages/DashboardPage.tsx` e `components/dashboard/` (`KpiRow`, `TrendCard`, `StatusCard`, `ReorderCard`, `RecentActivity`), `api/dashboard.ts`, rota `/` (deixa de redirecionar), item "Dashboard" na sidebar.
- **Alterações**: KPIs de `summary` + `dashboard`; variação de 30 dias = último − primeiro ponto; "Produtos para repor" de `GET /products?status=OUT,ATTN&sortBy=balance&pageSize=6`, na Data Table (`density="two-line"`, `caption`); atividade de `GET /movements?pageSize=6`; "Repor" chama `openMovement({ product, type: 'IN' })`.
- **Testes**: saudação por faixa de horário (relógio fixo); os quatro KPIs com os números do mock e o destaque com os dois links; "Repor" abre o painel em Entrada com o produto; atividade com tipo em palavra e diferença assinada; sem produtos → estado vazio com "Adicionar produto"; erro de uma região não derruba as outras.
- **Commit**: `feat(dashboard): visão geral do estoque`

---

### Fase 9 — Restantes, QA e revisão

#### Task 21 — Diálogos restantes no visual novo
- **Requisitos**: RF 60, 61; RT 1, 6, 8; RNF 13.
- **Arquivos**: `QuickOutListModal.tsx`, `QuickOutHistoryModal.tsx` (as `<table>` próprias saem: Data Table v2 + `Pagination`), `ui/ConfirmDialog.tsx`, `ui/Input|Select|Textarea`, `LoginPage.tsx` (só classes de token).
- **Alterações**: as colunas continuam as de hoje (o contrato §9.3 assina "as cinco colunas presentes"), só ganham prioridade — lista de baixa com `onRowClick` (linha inteira escolhe o produto, como hoje), P0 nome · saldo · status, P1 SKU · mín. estoque; histórico de baixas com P0 produto · qtde · data, P1 SKU · observação; abaixo de 768 px só P0, **sem rolagem lateral** (somem os `min-w-[42rem]`/`min-w-[48rem]`); estado de ordenação e paginação continuam no diálogo (ordenação em memória do histórico, como hoje). Nenhum outro comportamento muda.
- **Testes**: suítes atuais (incluindo `QuickOutModal.characterization`) verdes **sem alteração de asserção**; os 20 comportamentos de `user-flows.md` §9.3 conferidos um a um; novo: nenhum `<table>` fora de `ui/DataTable` no `src/` (teste de varredura, RNF 13); a 390 px os dois diálogos não rolam de lado.
- **Commit**: `refactor(ui): diálogos de baixa na data table e formulários no visual v2`

#### Task 22 — QA, paridade e revisões
- **Requisitos**: critérios de aceite do PRD; RNF 5, 7.
- **Alterações**: só correções pequenas que o QA encontrar, cada uma registrada.
- **Verificação**:
  - checklist completo do `AGENTS.md`;
  - QA manual com o seed em 320, 375, 768, 900, 1024, 1440 e 1920 px, com teclado e leitor de tela nas cinco superfícies, e zoom de 200 % em cada uma;
  - WCAG 2.2 AA: alvos ≥ 24 × 24 medidos, foco nunca encoberto pelo cabeçalho fixo nem pela barra do celular, login aceitando colar e gerenciador de senha (3.3.8);
  - *accessibility gate* e *table gate* (RNF 7) e as checklists §65–67 do plano de tabelas revistas tela a tela, com o resultado registrado;
  - `docs/ui-ux/parity-matrix.md` revalidada (mudanças declaradas do mapa de capacidades);
  - tempos das rotas novas;
  - revisão de segurança (rotas novas, Zod, `tz` como parâmetro, DTO) e de acessibilidade (cada tela);
  - matriz da seção 6 revisitada.
- **README**: capturas novas em `docs/images/` (dashboard, produtos, produto, movimentações, painel de movimentação) no lugar das três atuais; "Funcionalidades" com dashboard, página do produto, histórico geral e painel de movimentação; "Arquitetura" com React Router e as rotas de leitura; acessibilidade (WCAG 2.2 AA); sai o item "refatoração visual em andamento" de "Limites e próximos passos".
- **Commit**: `test(app): QA da refatoração visual` (se houver correção) ou nenhum; o README entra em commit próprio, `docs(readme): refatoração visual`.

## 5. Ordem de execução e dependências

**Ordem de execução (fatia vertical, P-17):**

```text
T0 ✓ → T1 ✓ → T2 ✓
  → T5 → T5b → T3 → T10 → T11 → T14 → T15      ← sidebar e Produtos do protótipo no app
  → T12 → T13                                   ← painel lateral; "Movimentar" passa a usá-lo
  → T6 → T7 → T8 → T9                           ← rotas de leitura (backend)
  → T16 → T17                                   ← Movimentações
  → T4 → T18 → T19                              ← gráficos e página do produto
  → T20                                         ← dashboard (/ deixa de redirecionar)
  → T21 → T22                                   ← diálogos restantes e QA
```

**Dependências reais** (o que obriga a ordem):

- T5 (`RegionState`, `Skeleton`, `Pagination`) antes de T5b; T5b antes de toda task que mostra tabela (4, 15, 17, 18, 20, 21).
- T3 (`drawer`) antes de T11 (navegação no celular) e de T12/T13.
- T10 (roteador) antes de T11 e T14; T14 antes de T15.
- T12 antes de "Nova entrada/Nova saída", do botão global e do "Repor" (T15 usa o modal atual até lá; T20 vem depois).
- T6–T9 (backend) antes de T16–T20, que consomem as rotas novas.
- T17 antes de T19 (o modal de histórico só sai depois que Movimentações cobre os filtros dele).

## 6. Matriz PRD → Task → Teste

| PRD | Task | Evidência |
|---|---|---|
| RF 1–5, 8–11 (shell, URL, foco, título, 404) | 10 | Testes de sidebar, `useRouteFocus`, rota inexistente, login com URL preservada |
| RF 6–7 (responsivo) | 11 | Testes da navegação móvel + capturas |
| RF 12–18 (dashboard) | 4, 9, 20 | `AreaTrend`/`StatusBar`; `dashboard.test.ts`; `DashboardPage` |
| RF 19–28 (produtos) | 2, 5, 14, 15 | `useListParams`, abas, linha clicável, menu da D11, `sorting.globalContract`, PD-1…PD-6 |
| RF 29–37 (produto) | 4, 9, 18 | `products.trend.test.ts`; `ProductPage` |
| RF 38–50 (painel) | 3, 12 | MFM-1…MFM-6 sem alteração + testes novos do painel |
| RF 51–58 (movimentações) | 8, 16, 17 | `movements.history.test.ts`; MHM-1/2/3/5 portados; `MovementsPage` |
| RF 59–61 (demais fluxos) | 13, 21 | Suítes atuais sem alteração; contrato §9.3 |
| RF 62–63 (remoções declaradas) | 15, 19 | Testes de "Ver produto"; matriz de paridade |
| RF 64–68 (API) | 6–9 | Testes de integração contra Postgres |
| RT 1–5, 7–11 (Data Table) | 5b, 15, 17, 18, 20, 21 | `DataTable.test.tsx`; testes de cada tela; varredura "nenhum `<table>` fora da Data Table" |
| RT 6, 12 (paginação, filtros visíveis) | 5, 15, 17 | `Pagination.test.tsx`, `FilterChips.test.tsx` |
| RNF 1 (sem schema) | todas | Nenhum arquivo em `prisma/migrations` no diff |
| RNF 2 (uma dependência) | 10 | `package.json` do frontend |
| RNF 3 (um cálculo de saldo) | 7, 9 | `balanceOf` usado por serviço e série; suíte do `StockService` intacta |
| RNF 4–5 (banco, desempenho) | 8, 9, 22 | Testes + tempos registrados |
| RNF 6 (tokens, lint) | 1, todas | `designSystemLintRule.test.ts`; lint |
| RNF 7–8 (a11y WCAG 2.2, gates, motion) | 1–5b, 10–21, 22 | Testes de contrato acessível + teclado, zoom 200 % e gates em cada task de UI (P-16) + QA com leitor de tela |
| RNF 9–10 (React Query, um diálogo) | 3, 12 | `invalidateStock`; variante `drawer` |
| RNF 11 (SPA no Netlify) | 10 | `netlify.toml` |
| RNF 12 (TDD) | todas | Testes antes, caracterizações antes de mover |
| RNF 13 (uma tabela) | 5b, 21 | Varredura sem `<table>` fora de `ui/DataTable` |

## 7. Fora do escopo (registrado, não vira task)

- Schema: categoria, estoque máximo, foto, nome de usuário, motivo estruturado.
- Usuários, Relatórios, Configurações, Integrações (volta com a branch de webhooks, rebaseada depois desta).
- Unificar Histórico de baixas com Movimentações.
- Migrar os tipos antigos do frontend para `packages/shared`.
- Índice novo para a janela de 30 dias (exigiria migration).
- `unaccent` no Postgres (backlog já existente).
- Do plano de tabelas (`research.md` Q8): categoria, exportar e arquivar em lote, colunas "Criado por"/"Atualizado em", preferência de densidade, tema escuro, Storybook (D12), primitivos sem consumidor (`Stack`, `Inline`, `Container`, `Switch`, `DatePicker`), `role="grid"`.
