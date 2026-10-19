# RESEARCH — Refatoração visual (SimpleStock v2)

> Fase 2 do workflow. Responde às questões que o `idea.md` deixou abertas. Cada questão: alternativas, decisão, justificativa, fontes. Valores exatos de token e contrato de endpoint ficam para o PRD.

---

## Questão 1 — O que as referências ensinam (e o que não serve)

As quatro referências foram abertas e examinadas imagem por imagem em 19/10/2026 (a 3 tem 20 imagens carregadas sob demanda; as telas de interface são "Home", "Inventory" e "Shipment"). Nenhuma é template: de cada uma sai **o que funciona**, transformado em **princípio** e adaptado ao nosso domínio (saldo derivado, 4 tipos de movimentação, sem pedidos/receita/armazéns).

### Referência 2 — Warehouse Insights (Creliq) · peso 50% · limpeza, espaçamento, cards, hierarquia

| Funciona | Não serve aqui |
|---|---|
| Canvas cinza claríssimo + superfícies brancas de raio grande: a região se separa pelo **fundo**, não por borda pesada | Ilustração isométrica 3D e mapa — decoração sem dado |
| Número grande com a unidade pequena ao lado (`25,000 units`) | Gradiente laranja no item ativo; badges com contorno coral sem significado |
| O veredito numa linha só, abaixo do número, com marcador colorido **e** texto (`— 67% available storage`) | Perspectiva inclinada (é apresentação de Dribbble, não layout) |
| Título de seção grande + subtítulo de uma linha (`Stay on top of … all in one view`) | |
| Muito respiro **entre** regiões | |

**Princípio:** *número protagonista, unidade coadjuvante, veredito numa linha abaixo.* E: *o canvas separa regiões; uma superfície por região.*

### Referência 3 — Vault / Warehouse Management (Habibur Rahman) · peso 20% · personalidade, contraste, badges, estados

| Funciona | Não serve aqui |
|---|---|
| **Sidebar quase preta + área de trabalho clara.** O contraste é estrutural: ancora a navegação e deixa o conteúdo inteiro para o trabalho | Acento lima `#E1FF01` — contra branco dá ~1,1:1, ilegível como texto ou foco; o plano fixa azul |
| Item ativo com **barra lateral** + cor de acento, não só fundo | Métricas que não temos: receita, picking accuracy, pedidos, receita por país, "AI restock" |
| KPI: ícone num chip tingido · rótulo · número grande · **pílula de variação com sinal e seta** (`+25% ↗`, `−10% ↘`) · "desde o mês passado" | Card "Look for Pro?" (upsell) no meio da navegação |
| **Um** KPI em destaque (fundo escuro) por linha — hierarquia sem depender de cor de status | Raio de 24px em quase tudo — fica com cara de app de consumo |
| Gráfico de área com preenchimento suave e tooltip escuro | |
| Escala de raio declarada (12 · 16 · 24) — "consistência" é um sistema, não um valor | |
| Linha de tabela com miniatura + linha secundária (`25 In Stock`) | |

**Princípio:** *a navegação é escura, o trabalho é claro.* E: *variação sempre com sinal e seta — cor só reforça.* E: *no máximo um destaque por fileira de KPIs.*

### Referência 6 — Samnites / Inventory Management (Rana Basit) · peso 20% · tabelas, produtos, filtros, densidade

| Funciona | Não serve aqui |
|---|---|
| **Uma barra de controle** acima da tabela: abas à esquerda (`Active · Archived`), busca + ações secundárias com contorno + **uma** primária azul à direita | Borda tracejada nos tiles de métrica — lê-se como "área para soltar arquivo" |
| Cabeçalho de tabela em cinza, linhas com zebra muito leve, miniatura, SKU, **menu de ações por linha** (`View · Edits · Config · Archive`) | ID numérico como primeira coluna — dado que não ajuda a decidir nada |
| Breadcrumb no cabeçalho (`Manage Products / Product Details`) | Colunas de largura igual; ícone de "fixar" em toda linha; lupa no botão "Create" |
| **Página de entidade:** voltar · cartão de identidade (imagem, nome, SKU) · tiles de quantidade · abas · tabela filtrável | |

**Princípio:** *controles da página numa única barra, acima da região de dados.* E: *página de entidade = identidade + números, depois o histórico filtrável.*

### Referência 7 — FlowOps / ERP Dashboard (Ruhcraft) · peso 10% · arquitetura, navegação, escalabilidade

| Funciona | Não serve aqui |
|---|---|
| Sidebar com marca no topo, itens agrupados, **conta + configurações no rodapé** | KPIs com fundo pastel por cor (amarelo, rosa, verde) sem significado — brigam com o sistema de status |
| Cabeçalho da página como bloco: título forte + subtítulo de contexto (`Live systems tracking · Welcome, Annette!`) + ações à direita (busca, primária) | Mapa; primária violeta |
| Micro-gráfico dentro do KPI | Sidebar flutuante com margem: rouba largura da tabela, que é a nossa região mais densa |

**Princípio:** *o cabeçalho diz onde estou e o que se faz aqui; o rodapé da sidebar diz quem sou eu.*

### Síntese — os princípios visuais da v2

| # | Princípio | Origem |
|---|---|---|
| P1 | **Canvas cinza, superfícies brancas.** Toda região (KPI, gráfico, tabela) é uma superfície branca de raio 14 sobre canvas cinza. Linhas de tabela não são cartões (regra anti-card-dentro-de-card da Fase 4 continua) | 2 |
| P2 | **Navegação escura, trabalho claro.** Sidebar quase preta; item ativo com barra azul à esquerda + texto branco | 3 |
| P3 | **Número protagonista.** KPI e saldo em tamanho grande, unidade e rótulo menores, veredito numa linha abaixo. Algarismos **proporcionais** no número isolado (tabular deixa `121` frouxo em tamanho grande) e **tabulares** só onde números se alinham em coluna (tabela, eixo) | 2 · 3 |
| P4 | **Variação com sinal, seta e palavra.** `+12 ↗`, `−5 ↘`; cor reforça, nunca é o único portador (WCAG 1.4.1) | 3 |
| P5 | **Status com vocabulário fechado**, sempre cor + palavra + ponto: `Em estoque` · `Estoque baixo` · `Sem estoque` · `Entrada` · `Saída` · `Ajuste` · `Estoque inicial` | plano §9 · Fase 4 |
| P6 | **Uma barra de controle por região de dados**: abas com contagem, busca, filtros, ação | 6 |
| P7 | **Página de entidade**: identidade → números → evolução → histórico | 6 |
| P8 | **Cabeçalho afirma o lugar**: título + subtítulo + uma ação primária; breadcrumb quando há profundidade | 7 · 6 |
| P9 | **Respiro no canvas, densidade na região de dados** (D5 da Fase 4 continua) | 2 · 6 |
| P10 | **Nada decorativo sem dado.** Sem ilustração, mapa, pastel ou gradiente. Personalidade vem do contraste da sidebar, dos números e da gramática | todas |

O que é **nosso** e não vem de nenhuma referência (é o que torna a interface própria): o **par saldo/mínimo** como uma unidade de leitura, o `antes → depois` com diferença assinada em todo lugar, e o tipo de movimentação expresso por seta + palavra.

---

## Questão 2 — Biblioteca de rotas

O sistema não tem rotas. A v2 precisa de URL para Dashboard, Produtos, Produto e Movimentações.

### Alternativas

| | Prós | Contras |
|---|---|---|
| **React Router 7** (modo biblioteca, `createBrowserRouter`) | Padrão de mercado; `useSearchParams` cobre filtros na URL; `createMemoryRouter` para teste; suporta React ≥ 18 | ~ dependência média |
| React Router 8 | Versão atual | **Exige React ≥ 19.2.7** (`npm view react-router@8.5.0 peerDependencies`, 19/10/2026). Subir o React está fora do escopo |
| TanStack Router | Tipagem forte de rotas e search params | Curva maior; mais uma convenção para um app de 5 rotas |
| wouter | Minúsculo | Sem loaders/erros de rota; menos reconhecível em portfólio |
| Hash router manual | Zero dependência | Reinventa histórico, foco e links acessíveis |

### Decisão

**React Router 7.18.x**, modo biblioteca (sem framework mode, sem SSR). Filtros de lista ficam **na URL** (`?status=baixo&q=caneta&page=2`) — é isso que torna "Estoque baixo" um link de verdade e permite voltar sem perder o recorte.

### Consequências registradas

- O Netlify precisa de fallback de SPA (`/* → /index.html 200`) **depois** do redirect de `/api/*` em `packages/frontend/netlify.toml`, senão qualquer recarga em `/produtos/123` dá 404. O Vite dev já faz isso sozinho.
- Testes de componente com rota usam `createMemoryRouter`; nenhum teste existente depende de URL hoje.
- Troca de rota move o foco para o `<h1>` da página e anuncia o título (padrão de SPA acessível) — requisito do PRD.

### Fontes

- `npm view react-router@8.5.0 peerDependencies` → `react: '>=19.2.7'`; `npm view react-router@7 peerDependencies` → `react: '>=18'` (consultado em 19/10/2026).

---

## Questão 3 — Gráficos: biblioteca ou SVG próprio

A v2 tem **dois** gráficos: evolução do saldo em 30 dias (área, no dashboard e na página do produto) e distribuição por status (barra empilhada única com legenda). Mais uma barra-bala saldo × mínimo, que é desenho, não gráfico.

### Alternativas

| | Prós | Contras |
|---|---|---|
| **SVG próprio** (2 componentes) | Zero dependência; consome os tokens direto; controle total de acessibilidade (tabela de dados equivalente, `role="img"` + descrição) | Tooltip e eixo escritos à mão (~150 linhas no total) |
| Recharts 3 | API declarativa; tooltip pronto | Dependência grande para dois gráficos; acessibilidade e tema precisam ser reconstruídos por cima dela |
| Chart.js | Maduro | Canvas: texto não é DOM, leitor de tela não alcança; tema fora do Tailwind |

### Decisão

**SVG próprio**, com dois componentes (`AreaTrend`, `StatusBar`) em `components/charts/`. Cada gráfico tem um equivalente textual (tabela visualmente oculta ou a legenda numérica visível) e nunca depende só de cor. Se aparecer um terceiro tipo de gráfico com interação real (zoom, séries múltiplas), reavaliar Recharts — e medir o peso no bundle antes.

### Justificativa

O projeto já mostrou a preferência por resolver com o que existe antes de importar (a Task 27 fez o enforcement com regra nativa do ESLint justamente para não trazer plugin). Dois gráficos de uma série não justificam uma biblioteca, e o SVG próprio é o único caminho em que o tema (tokens) e a acessibilidade ficam sob controle do design system.

---

## Questão 4 — Sidebar clara ou escura

O plano deixa em aberto ("sidebar clara ou quase preta").

| | Clara (ref. 2, 6, 7) | Escura (ref. 3) |
|---|---|---|
| Identidade | Genérica — é o padrão de 9 em 10 SaaS | **Distinta**; é a maior fonte de personalidade disponível sem decorar nada |
| Separação navegação × trabalho | Depende de borda/sombra | Pelo próprio contraste |
| Hierarquia do conteúdo | A sidebar compete com cartões brancos | Os cartões brancos ficam sendo a coisa mais clara da tela |
| Acessibilidade | Fácil | Fácil desde que o texto inativo tenha ≥ 4,5:1 sobre o fundo (zinc-400 sobre zinc-950 passa com folga) |
| Risco | — | Parecer "dark mode pela metade" se o resto tiver tons escuros soltos: a regra é **só a sidebar** é escura |

### Decisão

**Escura**, só a sidebar — recomendada aqui e **aprovada em 19/10/2026** depois de ver as duas no protótipo (D2 em `prototype.md`).

---

## Questão 5 — Como os tokens da Fase 5 evoluem

A Fase 5 (`docs/ui-ux/design-system.md`) e o enforcement da Task 27 (`eslint.config.js`) continuam sendo **o mecanismo**. O que muda são **valores** e **papéis novos** — não a arquitetura de dois níveis.

| Token | Fase 5 | v2 | Por quê |
|---|---|---|---|
| `rounded-control` | 6px | **10px** | Plano §2 (10–14px) |
| `rounded-surface` | 8px | **14px** | Plano §2; ref. 3 mostra que raio é uma escala, não um valor |
| `rounded-pill` | — (`rounded-full` proibido salvo o dot) | **novo**, 9999px | Badges, chips de filtro, pílula de variação. `rounded-full` continua proibido no lint — a pílula entra por token, não por utilitário cru |
| `background` | gray-50 `#F9FAFB` | cinza um degrau mais escuro | Com canvas quase branco, a superfície branca não se separa (P1) |
| `surface-subtle` | alias de `background` | **deixa de ser alias** | Passa a ser o cinza de dentro da superfície (cabeçalho de tabela, hover de linha) |
| `info` / `info-subtle` | — | **novo** | Plano §9 (azul = informação); hoje "Ajuste" usa o par de acento |
| `sidebar-*` | — | **novo** (fundo, texto, texto ativo, item ativo, separador) | Q4 |
| `shadow-card` | — (só `shadow-overlay`) | **novo**, quase imperceptível | Plano: "sombras mínimas"; separa superfície do canvas junto com a borda. Overlay continua sendo o único nível suspenso |
| `success-fill` · `warning-fill` · `danger-fill` | — | **novos**: `#059669` · `#F59E0B` · `#EF4444` | Preenchimento de gráfico e ponto de status. Os tons de texto da Fase 5 (`-700`) como preenchimento lado a lado **reprovam** no validador de paleta (âmbar×vermelho ΔE 4,9 em deuteranopia); estes passam (pior par ΔE 13,0 em protanopia, 19,8 em visão normal). O âmbar fica abaixo de 3:1 sobre branco, por isso todo uso tem rótulo e número visíveis ao lado — nunca só a cor |
| Escala tipográfica | 5 tamanhos | **+2 papéis numéricos**: `kpi` e `display-number` | P3 |
| `accent`, estados, foco, espaçamento, motion | — | **mantidos** | Contraste já medido na Fase 5 (V2); nada no plano pede mudança |

**Nomes:** o plano lista `surface-muted` e `primary`; no projeto eles já existem como `surface-subtle` e `accent`. Os nomes atuais ficam — renomear não muda nada para quem usa e mexeria em todos os consumidores.

**Enforcement:** a lista fechada de 19 utilitários da Task 27 não muda. Os valores novos entram pelos tokens do `tailwind.config.js`/`index.css`, então tudo que já respeita o lint herda o visual novo sem tocar no componente — é o que a Fase 5 prometeu ("a inconsistência deixa de ser algo a policiar").

**Fonte:** Inter fica (o plano aceita Inter ou Geist). Já está carregada no `index.html` e a verificação de algarismos tabulares da Fase 5 (V1) vale para ela; Geist exigiria nova origem de fonte e refazer a verificação, sem ganho de leitura.

---

## Questão 6 — O painel de "Nova movimentação"

O plano pede que fluxos maiores usem página ou drawer (§11), e o `AGENTS.md` proíbe um segundo sistema de diálogo.

### Decisão

**Drawer como terceira variante do `Modal`** (`dialog` · `sheet` · `drawer`), exatamente como a `sheet` já é (`ProductFiltersSheet` usa `variant="sheet"`). Ancorado à direita, largura fixa no desktop, tela cheia no celular; foco preso, Escape, retorno de foco — tudo herdado do Radix Dialog que o `Modal` já usa.

A nova movimentação **substitui** o `MovementFormModal`: o mesmo fluxo (IN/OUT com contexto + preview + N1), num container maior e com busca de produto quando aberto sem produto. Ajuste e baixa rápida mantêm os próprios fluxos, que também passam para o drawer, cada um com a cerimônia que já tem.

---

## Questão 7 — Endpoints de leitura e a série de saldo

### O que já existe e serve

- `GET /products` (busca, status, ordenação por saldo, paginação) → lista e "produtos para repor".
- `GET /products/summary` → contagens `ok / attn / out` → abas com contagem e barra de status.
- `GET /products/:id` e `GET /products/:id/movements` → página do produto e as últimas movimentações.

### O que falta

1. **Histórico geral**: movimentações de todos os produtos, com filtro por tipo, produto, responsável, período e texto, paginado no banco. Hoje só existe por produto e o de baixas (só `OUT`, sem `previousQuantity/newQuantity`, sem responsável).
2. **Agregados**: unidades totais, contagem e soma de entradas/saídas do dia, e **saldo por dia** nos últimos N dias (do estoque inteiro e de um produto).

### Como calcular o saldo por dia sem coluna de saldo

Não há saldo persistido — e não vai haver nesta feature. Três caminhos:

| | Como | Problema |
|---|---|---|
| Usar `newQuantity` da última movimentação de cada dia | Lê o "retrato" gravado | Movimentações do seed e anteriores à Fase 1 de auditoria **não têm** `newQuantity`; a série sairia furada |
| Recalcular do zero somando tudo até cada dia | Correto | Varre o histórico inteiro N vezes |
| **Andar para trás a partir do saldo atual** | `saldo(fim do dia D) = saldo atual − Σ deltas com data > D`, onde o delta é `+q` para `IN`/`INITIAL_STOCK`, `−q` para `OUT` e `newQuantity − previousQuantity` para `ADJUSTMENT` | — |

**Decisão:** andar para trás. O saldo atual já é calculado pelo mesmo código do `StockService` (`currentBalance`/`balancesFor`), os deltas por dia saem de **uma** agregação no banco limitada à janela (`date >= início da janela`), e a regra de sinal do `ADJUSTMENT` é a mesma já documentada em `sumAdjustmentDeltas`. Funciona com o histórico legado porque só depende de `type`/`quantity` (e de `previous/newQuantity` só nos ajustes, que sempre os têm — ver decisão registrada em `stockService.ts`).

**"Dia" depende de fuso.** O corte de dia é feito no fuso de quem usa (`America/Sao_Paulo` como padrão), não em UTC — senão "movimentações hoje" vira "desde as 21h de ontem". O fuso entra como parâmetro validado (lista IANA do próprio runtime), nunca interpolado em SQL.

A forma dos endpoints (um ou dois, nomes, campos) é decisão do PRD. Restrições que já valem: Zod em query params, `requireAuth`, paginação no banco, DTO explícito (sem espalhar o registro cru — dívida #8 da revisão de Ajuste de Estoque não se repete), testes de integração contra Postgres antes da implementação.

---

## Questão 8 — Tabelas, acessibilidade e design system (complemento de 19/10/2026)

O usuário trouxe um segundo plano, **"Plano de Tabelas, Acessibilidade e Design System"**: uma Data Table única para todas as listas, WCAG 2.2 AA, tokens semânticos, um sistema de componentes e gates de aprovação. As referências visuais são as mesmas (Dribbble 2, 3, 6, 7); as de comportamento são novas: W3C APG (Table, Grid, Sortable Table), IBM Carbon (Data Table e acessibilidade para desenvolvedores) e Atlassian (acessibilidade). Esta questão cruza o plano com o código, o protótipo e o PRD. As decisões que mudavam algo aprovado (D9–D12) estão em `prototype.md`.

### Inventário (fase T1 do plano)

Quatro tabelas existem hoje; só uma usa o componente compartilhado.

| | `ProductsTable` | `QuickOutListModal` | `QuickOutHistoryModal` | `MovementHistoryModal` |
|---|---|---|---|---|
| Componente | `ui/DataTable` | `<table>` própria | `<table>` própria | `<table>` própria |
| Colunas | seleção · produto (nome + SKU) · saldo/mín. · status · ações | nome · SKU · saldo · mín. estoque · status | produto · SKU · qtde · data · observação | data · tipo · saldo · observação |
| Ordenação | nome, SKU, saldo — no banco; `aria-sort` no `<th>` | nome, SKU, saldo — em memória; `aria-sort` no `<th>` | produto, SKU, qtde, data — em memória; `aria-sort` no `<th>` | — |
| Busca | nome ou SKU, sem acento | nome ou SKU | produto, SKU ou observação | observação |
| Filtros | status (menu múltiplo) | — | de/até (data) | tipo · de/até |
| Paginação | numerada + total | Anterior/Próxima, 10 fixo | Anterior/Próxima, 10 fixo | Anterior/Próxima + itens por página |
| Seleção | sim (página) + zerar/excluir em lote | linha inteira escolhe o produto para a baixa | — | — |
| Ações por linha | Movimentar · baixa rápida · `⋯` | clique na linha | — | — |
| Responsivo | cartões abaixo de `md` | rolagem lateral (`min-w-[42rem]`) | rolagem lateral (`min-w-[48rem]`) | rolagem lateral |
| Vazio | dois textos (sem cadastro × sem resultado) | um texto | um texto | um texto |
| Carregando | texto "Carregando..." | texto | texto | texto |
| Erro | faixa `role="alert"` | `role="alert"` | `role="alert"` | `role="alert"` |

Depois da refatoração serão seis listas: Produtos, Movimentações, "Últimas movimentações" (produto), "Produtos para repor" (dashboard) e as duas de baixa. O `MovementHistoryModal` sai (D5).

### Auditoria (fase T2)

- **Duplicação.** Cabeçalho ordenável, paginação Anterior/Próxima e estados estão escritos três vezes. Os comentários dos dois modais de baixa dizem "como em `ui/DataTable`" — o padrão foi copiado, não reusado.
- **`ui/DataTable` fora do design system.** Usa cinza cru (`bg-gray-50`, `text-gray-600`, `border-gray-100`, `bg-white`), `role` redundante em elementos nativos (`role="table"`, `role="row"`…), um único estado vazio, "Carregando..." em texto (layout pula quando os dados chegam), e ainda carrega dois pares de props de ordenação: `sort`/`onSortChange`, sem nenhum chamador, e `sorts`/`onSortsChange`, usado pelo `ProductsTable` mas só com o primeiro critério desde a Task 3 da Fase 2.
- **Rolagem lateral.** Os dois modais de baixa forçam largura mínima e rolam de lado no celular — corta informação essencial (gate do plano, §58).
- **Densidade.** `ui/DataTable` usa 12 px de respiro (~44 px); o protótipo v2 subiu para ~56 px. O plano pede 40/48 px.
- **Contrato a preservar.** Os modais de baixa têm comportamentos assinados em `docs/ui-ux/user-flows.md` §9.3 (linha inteira clicável na lista, `Escape` não fecha a lista, coluna "Mín. Estoque", contador de itens, ordenação em memória do histórico). Migrar para a tabela única **não** muda nenhum deles — a tabela é apresentação; o estado continua no chamador.

### Data Table única — como

O plano sugere uma API composta (`<DataTable.Toolbar/>`, `<DataTable.Body/>`…) e diz que ela não é obrigatória. **Fica a API de colunas que o `ui/DataTable` já tem** (padrão do projeto: `columns`, `getRowId`, `render`, `align`, `tabularNums`, `sortKeys`), estendida com o que falta:

| O que entra | Por quê |
|---|---|
| `caption` (obrigatória, pode ser visualmente oculta) | §34; leitor de tela anuncia o recorte |
| `priority: 'P0' \| 'P1' \| 'P2'` por coluna | §49–50; P2 some abaixo de 1180 px; P1 fica no tablet; abaixo de 768 px a tabela vira cartões — nunca rolagem lateral |
| `stickyHeader` | §16; só funciona sem rolagem lateral e sem `overflow: hidden` no contêiner (vira `overflow: clip`) |
| `density: 'single' \| 'two-line'` | §6; 40/48 px |
| `state: 'loading' \| 'empty' \| 'no-results' \| 'error' \| 'content'` | §17–19; skeleton com a altura final da linha, os outros via `RegionState` |
| `selection` (ids, alternar um, alternar a página) | §11; receita de linha selecionada da Fase 5 |
| `onRowClick` | P-8; ignora cliques que nascem em `a, button, input, label` |
| `groups` (cabeçalho por grupo de linhas) | D9; um `<tbody>` por grupo com `<th scope="rowgroup">` |
| `renderRowDetail` + `expandedIds` | D9; linha de detalhe controlada por botão com `aria-expanded` |

Barra de ferramentas, busca, chips de filtro, barra de seleção e paginação ficam como **componentes irmãos** (`TableToolbar`, `FilterChips`, `SelectionBar`, `Pagination`), compostos pela página — cada tela já tem filtros diferentes, e uma tabela que conhece todos eles vira o componente-deus que o `ProductDashboard` é hoje.

**Table, não Grid** (§35): nenhuma lista é editável célula a célula nem precisa de setas entre células. `role="grid"` fica fora.

### WCAG 2.2 AA no lugar de 2.1 AA

O PRD pedia 2.1 AA. A 2.2 acrescenta poucos critérios de nível A/AA, e só três tocam esta feature:

| Critério | O que muda aqui |
|---|---|
| 2.4.11 Foco não encoberto (mínimo) | Cabeçalho fixo da tabela e barra do celular não podem esconder o elemento focado → `scroll-padding-top` no documento |
| 2.5.8 Tamanho do alvo (mínimo, 24 × 24) | "×" do chip de filtro tinha 20 px (protótipo) → 24 px. Checkbox de 18 px passa pela exceção de espaçamento, mas a célula inteira vira o rótulo |
| 3.3.8 Autenticação acessível | Login já usa `autocomplete="username"`/`"current-password"` e aceita colar — registrar como verificado, sem mudança |

2.4.12/2.4.13 são AAA; 3.2.6 (ajuda consistente) e 3.3.7 (entrada redundante) não têm caso no produto.

### Tokens

Os nomes atuais ficam (mesmo raciocínio da Questão 5): `accent` cumpre o papel de `primary`, `surface-subtle` o de `surface-hover`, `border`/`border-strong` os de `border-default`/`border-strong`. Entram só os papéis que faltam:

| Token | Valor | Uso |
|---|---|---|
| `rounded-sm` (`--radius-sm`) | 6 px | item de menu, botão de paginação, tooltip, ícone do tipo de movimentação |
| `text-disabled` | gray-400 | só controle desabilitado (isento de contraste, 1.4.3); nunca texto informativo |
| `surface-selected` | = `accent-subtle` | fundo de linha selecionada, sempre com a barra de 2 px |

Espaçamentos fora da escala no protótipo (18, 14, 10, 9 px) viram valores da escala 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 ao virar código.

### Fora do escopo — e por quê

| Item do plano | Motivo |
|---|---|
| Categoria (filtro, coluna, ação em lote) | `Product` não tem categoria — exige schema |
| Exportar, Arquivar (ações em lote) | Exportação está fora do PRD; arquivar exige estado novo (hoje é exclusão definitiva) |
| Colunas "Criado por" / "Atualizado em" | "Criado por" não existe; `updatedAt` existe, mas só muda ao editar o cadastro — numa tabela de estoque leria como "última movimentação" e enganaria |
| Telas de Usuários e Relatórios | Sem backend (escopo do PRD) |
| Preferência de densidade | O próprio plano: "não implementar sem necessidade real" |
| Tema escuro | O próprio plano: "não priorizar" |
| Storybook | D12 |
| Primitivos `Stack`, `Inline`, `Container`, `Switch`, `DatePicker`, `Radio` isolado | Nenhuma tela desta feature usa; entram quando houver o primeiro consumidor |

---

## Resultado

| Questão | Decisão |
|---|---|
| Referências | 10 princípios (P1–P10); nada copiado; lima, mapas, pastéis e ilustração descartados |
| Rotas | React Router 7.18 (v8 exige React 19); filtros na URL; fallback de SPA no Netlify |
| Gráficos | SVG próprio, 2 componentes, com equivalente textual |
| Sidebar | Escura — aprovada no protótipo (D2) |
| Tokens | Mesma arquitetura e mesmo lint; valores novos (raio 10/14, pílula, canvas, sidebar, info, preenchimentos de status validados, sombra de cartão, 2 papéis numéricos) |
| Nova movimentação | Drawer = terceira variante do `Modal` |
| Endpoints | Histórico geral + agregados; saldo por dia andando para trás a partir do saldo atual; corte de dia por fuso |
| Tabelas, a11y, DS (complemento) | Uma Data Table (API de colunas estendida, irmãos para toolbar/filtros/paginação); Table, não Grid; WCAG 2.2 AA; densidade 40/48; 3 tokens novos; D9–D12 |
