# Fase 7 — Implementation Plan

**Data:** 31/08/2026
**Escopo desta fase:** planejamento. **Nenhum arquivo de `packages/` foi alterado**, nenhum CSS, nenhum token, nenhum componente, nenhum teste, nenhuma dependência.
**Baseline verificada:** `988adbc` — 190 testes de frontend, 190 verdes, 0 falhos, working tree limpo, alinhado com `origin/master`.
**Fontes:** `AGENTS.md`, `CLAUDE.md`, `docs/current-state.md`, `docs/ui-ux/{audit,user-flows,research,design-direction,design-system,prototype,bugfix-gate,characterization-plan}.md`, `docs/features/ajuste-estoque/review.md`, e **leitura direta do código atual** — `packages/frontend/src`, `packages/frontend/test`, **`packages/backend/src/routes`**, `tailwind.config.js`, `eslint.config.js`, `.github/workflows/ci.yml`.

> **Regra de precedência aplicada em todo este plano:** quando um documento anterior divergiu do código, o **código atual é a verdade**. As divergências estão registradas em §3 como desatualização temporal do documento — nunca como bug novo a corrigir.

> **Atualização de 31/08/2026 — três decisões bloqueantes fechadas.**
> **D-A** (ordenação), **D-B** (largura do container) e **D-F** (saída manual acima do saldo) foram **RESOLVIDAS** e incorporadas ao plano. Consequências estruturais: duas tasks novas (**Task 3** e **Task 18**), renumeração completa, e o encerramento de **D-D** (UF-08) como efeito direto de D-A. O total passou de 28 para **30 tasks**. O review independente do Codex continua registrado no fim do documento, com a tabela de remapeamento de numeração.

---

## 0. Verificação de estado

| Verificação | Resultado |
|---|---|
| `git status --short` | apenas `docs/ui-ux/implementation-plan.md` |
| `git branch --show-current` | `master` |
| `git log -1 --oneline` | `988adbc test(ui-ux): adicionar characterization tests antes da migracao visual` |
| `git rev-list --left-right --count origin/master...HEAD` | `0 0` (após `git pull --ff-only`, fast-forward limpo) |
| `pnpm --filter @simplestock/frontend test` | **27 arquivos · 190 testes · 190 passed · 0 failed** |

---

## 1. O que este plano decide

Transformar as decisões aprovadas nas Fases 4–6 em uma migração **incremental e verificável**, respondendo:

- **onde o CSS real começa** → Task 1 (`index.css` + `tailwind.config.js`), e em nenhum lugar antes;
- **quais fundações entram primeiro** → tokens, helper de formatação numérica e **a ordenação global (Task 3)**, todos sem consumidor visual no próprio commit;
- **o que depende de token** → todos os primitivos e todas as superfícies;
- **o que é só aparência × o que muda UX** → §7.2 e §7.3;
- **o que depende de characterization test** → cada task cita nominalmente os testes que a protegem;
- **o que exige QA manual** → §7.5, decorrente de Q-1 (sem runner E2E novo);
- **o que paraleliza e o que conflita em arquivo** → §6.2 e §6.3;
- **como evitar big-bang** → §4.6;
- **quando o lint vira gate** → Task 27, no fim, e nunca antes (§4.3).

O que este plano **não** faz: não reabre decisão aprovada, não introduz dependência nova, não toca Prisma schema nem `.env`, e não planeja dark mode, RBAC, regra de negócio nova ou integração logística/17TRACK.

> **Uma exceção declarada quanto ao backend.** A Task 3 (D-A) altera **rotas** de leitura (`GET /products`, `GET /quick-out/history`) para aplicar ordenação no banco antes da paginação. Isso é consequência direta da decisão D-A, é a única task do plano que toca `packages/backend`, e **não altera regra de negócio de estoque** — saldo, saída, ajuste e concorrência permanecem exatamente como estão. Nenhuma outra task toca o backend.

---

## 2. O que a inspeção do código mostrou (números medidos)

| Medição | Valor | Consequência para o plano |
|---|---|---|
| Arquivos em `packages/frontend/src` | **43** (27 componentes `.tsx`) | Raio de mudança conhecido |
| Declarações de anel de foco (`focus-visible:ring-2` / `focus:ring-2`) | **27** | — |
| … em `components/ui/*` (primitivos) | **8** — Button, Input, Select, Modal, MenuPopover, DataTable, ToastProvider, ApiStatusBanner | — |
| … em componentes de feature | **19** — ProductsTable 5 · ProductFormModal 5 · MovementFormModal 4 · StatusFilterMenu, ProductCardList, ProductActionsMenu, MovementHistoryModal, AdjustmentFormModal (1 cada) | **Unificar foco não é uma mudança de primitivo.** 70% dos anéis estão escritos à mão fora de `ui/*`. Por isso **não existe "task de foco"**: cada task converte o foco dos arquivos que já está tocando, e a Task 27 verifica que sobrou zero variante |
| Cores de anel em uso | `indigo-600` 13 · `brand` 11 · `blue-600` 3 (+ `indigo-500`, `indigo-300`, `blue-200`, `amber-700`) | Confirma A-4 |
| Anéis de foco nos três `QuickOut*` | **0** | Ali não há foco a unificar: há foco a **introduzir**, e ele vem do primitivo `Modal` |
| Token `brand` | 21 ocorrências em **4 arquivos**: ProductFormModal (5 linhas), MovementFormModal (4), MovementHistoryModal (1), AdjustmentFormModal (1) | A deprecação do token (Task 27) depende **exatamente** das Tasks 17, 19, 24 e 25 |
| `ui/Modal.tsx` | já oferece `max-h-[90vh]`, `overflow-y-auto` no corpo, `headerActions`, `size`, restauração explícita de foco e ids por `useId` via Radix | Migrar os `QuickOut*` para ele resolve C-1, o achado A-13 e o bloqueio de scroll **sem duplicar implementação**. Faltam-lhe apenas `ring-offset` no botão de fechar e a variante `sheet` |
| Componente próprio de Sheet/Drawer | **não existe** | A sheet do mobile nasce como **variante do `Modal`** (Task 9). **Nenhuma dependência nova** |
| `toLocaleString` solto | 5 usos, sendo **1 sem locale** (`MovementHistoryModal`) | Confirma P-3; o helper único é pré-requisito das tasks que renderizam número |
| `tnum` na Inter | **validado no navegador** (Fase 6 §2) | **Nenhuma task** para trocar fonte, auto-hospedar Inter ou baixar outro subset. Risco encerrado |
| Utilitários fora do sistema | `border-gray-300` 20 · `ring-indigo*` 15 · `ring-brand` 11 · `text-gray-400` 10 · `shadow-sm` 9 · `rounded-lg` 8 · `rounded-full` 6 · `select-none` 6 · `text-[10px/11px/18px]` 6 · `shadow-2xl` 3 · `bg-gradient` 3 · `rounded-2xl` 3 · `text-3xl` 2 · `text-4xl` 1 · `animate-fade-in` 1 | **Uma regra de lint no início reprovaria ~100 usos legados.** Só pode virar erro depois que a migração os remover — Task 27 |
| `eslint.config.js` | flat config, **sem** plugin de Tailwind | O enforcement usa `no-restricted-syntax` sobre literais em JSX — regra **nativa** do ESLint. **Nenhuma dependência nova** |
| Pipeline de CI | `lint → typecheck → testes backend → testes frontend → build`, obrigatório em todo PR | É a Definição de Pronto de toda task |
| `MovementFormModal` | recebe **apenas `productId`**; o schema aceita **qualquer inteiro positivo** em `OUT` | A gramática exige contexto do produto (Task 17) e o impedimento de D-F exige o saldo em mãos (Task 18) |
| `MovementHistoryModal` | recebe **apenas `productId`**; **não tem `max-height`** | O "saldo ancorado imune ao filtro" (decisão 4) tem a mesma dependência (Task 19) |
| Arquitetura de navegação | `App.tsx` renderiza **um único** destino autenticado (`ProductDashboard`) | **Nenhuma sidebar.** O produto não tem destinos para ela. Shell simples preservado — sem inventar navegação e sem tirar largura da região de dados |
| `FinanceDashboard.tsx` / `SalesDashboard.tsx` | zero imports (reconfirmado por busca em `src/`) | Task 26, isolada |
| Testes de formulário | localizam campos por **label e papel acessível**, nunca por `id` interno | Migrar para `ui/Input`/`ui/Select` com `useId()` **não exige** preservar `id="name"`, `id="sku"`, `id="movement-type"` etc. |

### 2.1 · Inventário da ordenação (levantado para fechar D-A)

Levantado lendo `packages/backend/src/routes/products.ts`, `quick-out.ts`, `movements.ts` e `packages/frontend/src/hooks/useProductsQuery.ts`.

| Superfície | Opções expostas hoje | Onde a ordem é decidida | Veredito |
|---|---|---|---|
| `GET /products` — `name` / `sku` | `sortBy` e `sortDir` **já validados por `z.enum`** | `orderBy` do Prisma, **antes de `skip`/`take`** | **Já é global.** O contrato exigido por D-A **já existe aqui** e não deve ser reinventado |
| `GET /products` — `balance` | mesma whitelist | Caminho derivado: carrega o conjunto filtrado, calcula saldo em **uma** agregação, ordena e **só então** fatia | **Global e correto**, porém fora do banco (saldo não é coluna). Não é ordenação enganosa |
| `ProductsTable` (desktop) — clique no cabeçalho | `name`, `sku`, `balance` | vai à API via `togglePrimarySort` | Correto |
| `useProductsQuery.viewItems` — **reordenação local** | `name` com `Intl.Collator('pt-BR')` | **sobre a página já carregada** | **ENGANOSA.** O conjunto de 10 itens é escolhido pela collation do banco e depois reordenado com outra regra: o primeiro item da tela não é necessariamente o primeiro do conjunto |
| `useProductsQuery.viewItems` — **Shift+clique** (UF-08) | qualquer coluna, como critério secundário | **sobre a página já carregada** | **ENGANOSA.** A primária vai ao banco, a secundária não |
| `QuickOutListModal` | `name`, `sku`, `balance` | vai à API (`fetchProducts`) | Correto — herda `GET /products` |
| `QuickOutHistoryModal` | `productName`, `productSku`, `quantity`, `date` | **`viewItems` em memória, só a página** | **ENGANOSA (F-03).** `GET /quick-out/history` tem `orderBy: { date: 'desc' }` **fixo** e não aceita parâmetro de ordenação |
| `MovementHistoryModal` | **nenhuma** | `orderBy: { date: 'desc' }` fixo na rota | Fora do escopo de D-A: não há capacidade exposta, logo não há promessa a cumprir |

**Conclusão que orienta a Task 3:** de cinco superfícies, **duas** exibem ordenação enganosa (a reordenação local da listagem de produtos e a do histórico de baixas) e **uma** capacidade — Shift+clique — é enganosa por construção.

---

## 3. Divergências entre documentos e código (registro temporal)

Nenhuma gera task de correção de bug: todas já foram corrigidas, decididas ou reclassificadas.

| Documento | O que afirma | Estado real | Tratamento |
|---|---|---|---|
| `design-system.md` §13.1 | altura de linha da região de dados **~44px** | O protótipo mediu **65px** com o par saldo/mínimo que A5 exige; **P-2 aprovou ~64px** | O plano usa **~64px**. Correção **documental** na Task 30 |
| `audit.md` F-1 · `user-flows.md` UF-27 · `design-direction.md` §4.2 | a UI "desenha estoque negativo" | **Código morto** (N-4): `Math.max(0, …)` impede `newBalance < 0`; o que ocorre é `0` rotulado "Estoque zerado" | F-01 já foi **redecidida** sobre o comportamento real. Task 21 |
| `current-state.md` | "não há `useEffect` + `fetch` manual em nenhum componente" | Falso: `QuickOutListModal` e `QuickOutHistoryModal` fazem exatamente isso | Corrigido na Task 30, **depois** de a migração tornar a frase verdadeira |
| `current-state.md` | "só existe um primitivo de modal ativo" | Falso: três sistemas | Idem Task 30 |
| `bugfix-gate.md` §7 G-3 / §3.3 | recomendava, para F-03, "remover os controles de ordenação" | **Superado por D-A (31/08/2026):** a ordenação passa a ser implementada de verdade, server-side. A capacidade fica, agora verdadeira | Task 3 |
| `characterization-plan.md` §1 | "18 arquivos, 90 testes verdes" | Hoje **27 arquivos, 190 testes** | Sem ação: diferença esperada entre plano e execução |

**Bugs já corrigidos que este plano NÃO replaneja** (conferidos no código e no histórico): F-06 (`aea7b0e`), F-07 (`23e6b14`), C-3 (`209a98d`), C-2 (`088b717`), F-04 e F-08 (`981bf80`), UF-04 parte 1 (`d3f1ab0`).

---

## 4. Estratégia

### 4.1 · Onde o CSS real começa

Na **Task 1**, e em nenhum lugar antes. Ela adiciona variáveis CSS em `:root` (`src/index.css`) e as expõe como utilitários por `theme.extend` (`tailwind.config.js`). **Nenhum componente as consome no mesmo commit** — o diff é visualmente nulo, e é isso que a torna segura como primeiro passo.

### 4.2 · Por que a ordem não é automaticamente `tokens → primitives → shell → components`

O código impôs quatro desvios:

1. **O helper de formatação numérica (Task 2) não depende de token nenhum** e é pré-requisito de tudo que renderiza número. Entra na onda das fundações, **em paralelo** à Task 1.
2. **A ordenação global (Task 3) é pré-requisito funcional, não visual.** Ela precisa vir **antes** de qualquer task que mexa em controle de ordenação — DataTable, ProductsTable, sheet mobile, `QuickOutList`, `QuickOutHistory` —, senão a migração reembala uma capacidade que mente e depois a conserta. Não depende de token e roda em paralelo às Tasks 1, 2 e 4.
3. **O `Modal` precisa ganhar a variante `sheet` antes do mobile** (Task 9 → Task 16). A sheet é a única peça de UI nova da migração e não pode nascer como quarto sistema de overlay.
4. **Dois diálogos exigem mudança de contrato de props antes de qualquer ganho visual**: `MovementFormModal` e `MovementHistoryModal` recebem só `productId`. Isso mexe em `ProductDashboard`, que também é o arquivo da Task 16 — daí o conflito de §6.3.

### 4.3 · Por que a regra de lint entra por último

`theme.extend` **não** impede escrever `rounded-lg`. E substituir `extend` por override **não** falha o build: o Tailwind apenas deixa de gerar o CSS, produzindo **regressão visual silenciosa** (`design-system.md` §19.1). **Este plano não apresenta o Tailwind como garantia mecânica de nada.**

O enforcement real é uma regra de lint no gate de CI que já existe. Hoje ela reprovaria ~100 usos legados — ligá-la agora pararia a esteira por dívida que a própria migração remove. Portanto:

- **Tasks 1–26:** a lista de utilitários banidos é **documentação** (`design-system.md`), verificada por revisão humana, e **cada task zera os banidos dos arquivos que toca** (critério de aceite dela).
- **Task 27:** removidos os usos legados, a regra entra em `eslint.config.js` como **`error`** e passa a falhar o CI.

**Alternativa progressiva explícita**, caso a Task 27 encontre resíduos: entrar como `warn` com lista nominal fechada, e um commit seguinte a promove a `error`.

### 4.4 · Regra de largura do shell (D-B, resolvida em 31/08/2026)

Vale para as Tasks 10, 11 e 16, e é critério de QA da Task 28.

| Regra | Valor |
|---|---|
| Shell principal | **fluido**: `width: 100%`, centralizado (`margin-inline: auto`) |
| Teto conceitual | **1536px** (`max-w-screen-2xl` do Tailwind — valor que já existe no tema, sem número mágico novo) |
| Gutter mobile (base) | **16px** (`px-4`) |
| Gutter a partir de `md` | **24px** (`px-6`) |
| Gutter a partir de `xl` | **32px** (`px-8`) |
| Região de dados | ocupa **toda a largura disponível dentro do shell** — sem `max-width` próprio |

**O teto do shell não é um teto universal.** Ele **não** se aplica a modais, formulários, blocos de texto corrido nem a superfícies que precisam de largura local menor: essas continuam com sua largura própria (o `Modal` já tem `size`, e o `LoginPage` continua estreito). Aplicar 1536px indiscriminadamente produziria linhas de texto ilegíveis e diálogos gigantes.

Isso substitui o `max-w-5xl` (1024px) de hoje, aplicado igualmente ao header e ao `main` em `App.tsx`.

### 4.5 · Ordenação é pré-requisito funcional, não acabamento (D-A, resolvida em 31/08/2026)

**A ordenação exibida ao usuário é global e server-side.** Nenhuma opção visível pode reorganizar apenas a página já carregada, e nenhuma capacidade pode parecer global sendo local.

Consequência direta: **toda opção de ordenação que permanecer visível depois da migração precisa ter implementação global correta.** Se uma opção não puder ser suportada corretamente sem complexidade desproporcional, ela **não é oferecida** na nova interface até existir suporte real — e a ausência entra na tabela de paridade como linha assinada.

Isso é planejado na **Task 3**, classificada **Pré-requisito funcional / UX intencional**, e não pode ser diluída dentro de nenhuma task visual.

### 4.6 · Como evitar big-bang rewrite

- Uma task = uma unidade coerente e revisável = **um commit**.
- Nenhuma task toca simultaneamente a região de dados, o mobile e um diálogo.
- Os quatro componentes `MIGRAR` migram **um por vez**, cada um atrás dos seus characterization tests.
- Toda mudança de comportamento é **PRESERVAR** (com teste que já existe) ou **ALTERAR INTENCIONALMENTE** (com item próprio, teste novo e critério de aceite). Não há terceira categoria.

---

## 5. Tasks

> **Convenção:** os testes citados existem hoje em `packages/frontend/test/` e estão verdes. "QOM-n", "QOL-n", "QOH-n", "MHM-n", "PT-n", "PCL-n", "SFM-n", "PD-n", "PS-1" são os identificadores usados nos próprios nomes dos testes.

---

### Task 1 — Tokens semânticos e camada base

#### Tipo
Foundation

#### Objetivo
Introduzir os dois níveis de token (primitivo → semântico) e a camada base de CSS, **sem nenhum consumidor**, de modo que o diff seja visualmente nulo.

#### Motivação
Hoje cada componente escolhe o próprio valor: 3 cores de anel de foco, 6 níveis de raio, 11 tamanhos de fonte, 5 níveis de sombra. Enquanto não existir um papel para consumir, a inconsistência continua sendo algo a policiar em revisão em vez de algo que não se consegue escrever.

#### Fontes/decisões atendidas
`design-system.md` §2 (dois níveis, sem terceiro), §3 (papéis e contraste medido), §3.4 (WCAG 1.4.11 para contorno de controle), §4 (acento **blue** — D4), §5.2 (escala 24·18·16·14·12; pesos 400/500/600), §6 (spacing 4·8·12·16·24·32·48), §7 (`radius-control` 6px, `radius-surface` 8px), §8 (uma sombra), §9 (foco único), §16 (motion + `prefers-reduced-motion`), §19 (`extend`); A1, A2, A4, A5; D4.

#### Dependências
Nenhuma.

#### Componentes e arquivos prováveis
`packages/frontend/src/index.css` · `packages/frontend/tailwind.config.js`

#### Mudanças previstas
- `:root` com os papéis em canais RGB (`--color-accent`, `--color-surface`, `--color-surface-subtle`, `--color-background`, `--color-border`, `--color-border-strong` = gray-500, `--color-border-hover`, `--color-text-primary/secondary/muted`, `--color-accent-subtle`, `--color-accent-subtle-text`, `--color-accent-strong`, `--color-success[-subtle]`, `--color-warning[-subtle]`, `--color-danger[-subtle]`, `--color-focus` como alias de accent).
- `theme.extend` referenciando as variáveis com `<alpha-value>`; `borderRadius: { control, surface }`; `fontSize` com os cinco degraus; `boxShadow: { overlay }`; durações de 120ms/180ms.
- Camada base: `@media (prefers-reduced-motion: reduce)` (hoje **zero ocorrências** no projeto).
- **Não** remover `brand` nem `animate-fade-in` — ainda há consumidores (Task 27).
- **Não** alterar `screens` (P-5: `md` mantido).

#### Comportamentos PRESERVAR
Todos. Nenhum componente muda; a suíte inteira (190 testes) é a rede.

#### Comportamentos ALTERAR INTENCIONALMENTE
Nenhum.

#### Bugs que NÃO devem ser congelados
Nenhum aplicável — a task não toca componente.

#### Testes automatizados relevantes
A suíte completa como não-regressão. Nenhum teste novo: não há comportamento novo a afirmar.

#### QA manual
Abrir a aplicação e confirmar que **nada mudou**. Confirmar no DevTools que as variáveis existem e que `bg-accent`/`rounded-control`/`shadow-overlay` geram CSS.

#### Critérios de aceite
- Todo papel de §3 tem token, e nenhum papel extra foi inventado.
- `border-strong` = gray-500 (4.83:1), atendendo 1.4.11.
- Nenhum terceiro nível de token.
- Diff visual nulo, verificado manualmente.

#### Definição de pronto
`pnpm -r run lint` · `typecheck` · testes de backend · testes de frontend · `build` — todos verdes.

#### Commit sugerido
`feat(ui): adicionar tokens semanticos e camada base`

---

### Task 2 — Helper único de formatação numérica

#### Tipo
Foundation

#### Objetivo
Um único módulo responsável por saldo, quantidade e delta — separador de milhar pt-BR e sinal de menos tipográfico (`−`, U+2212).

#### Motivação
A formatação **derivou dentro do próprio protótipo**, em dois lugares do mesmo diálogo (`1250` × `1.250`). Se derivou em 200 linhas, deriva em 4.400. Hoje há 5 `toLocaleString` soltos, um deles **sem locale**.

#### Fontes/decisões atendidas
P-3, P-4; `design-system.md` §5.3 e §14.2 regra 4; `prototype.md` §8.1 e §11; M-13.

#### Dependências
Nenhuma.

#### Componentes e arquivos prováveis
Novo: `packages/frontend/src/lib/formatNumber.ts` · novo teste unitário.

#### Mudanças previstas
- `formatQuantity(n)` → pt-BR com separador de milhar.
- `formatDelta(n)` → sinal explícito, com `+` e **`−` (U+2212)**, nunca hífen-menos.
- `formatBalanceTransition(prev, next)` para `antes → depois`, incluindo `—` quando não há saldo anterior.
- **Escopo fechado:** saldo, quantidade e delta. **Não** criar `formatEverything`.
- Nenhum consumidor neste commit.

#### Comportamentos PRESERVAR
Nenhum comportamento existente é tocado. **O valor enviado à API não muda** — a formatação é de apresentação.

#### Comportamentos ALTERAR INTENCIONALMENTE
Nenhum ainda; a aplicação acontece nas Tasks 13, 15, 18, 19, 20 e 21.

#### Bugs que NÃO devem ser congelados
M-13 (`toLocaleString()` sem locale).

#### Testes automatizados relevantes
Testes unitários novos: milhar, zero, negativo com `−` (verificado por code point), ausência de saldo anterior.

#### QA manual
Nenhum (módulo puro).

#### Critérios de aceite
- Nenhum consumidor no commit; API mínima e fechada.
- O sinal negativo é `U+2212`, afirmado por teste.
- Nenhuma função converte valor para envio à API.

#### Definição de pronto
Checklist completo verde.

#### Commit sugerido
`feat(ui): criar helper unico de formatacao numerica`

---

### Task 3 — Ordenação global server-side

#### Tipo
**PRÉ-REQUISITO FUNCIONAL / UX INTENCIONAL**

> Esta task **não é visual** e **não pode ser diluída** dentro de nenhuma task de estilo. Ela precede toda task que mexe em controle de ordenação (11, 13, 16, 22, 23).

#### Objetivo
Toda ordenação exibida ao usuário passa a ser **global**, aplicada sobre o conjunto filtrado inteiro **antes da paginação**, com contrato de query validado e whitelist. Nenhuma opção visível reorganiza apenas a página já carregada.

#### Motivação
O inventário de §2.1 encontrou **duas superfícies que mentem** e **uma capacidade enganosa por construção**:

- `useProductsQuery.viewItems` **reordena a página já carregada**: o banco escolhe 10 itens por uma collation e o cliente os reexibe em outra ordem (`Intl.Collator('pt-BR')`). O primeiro item da tela não é necessariamente o primeiro do conjunto — e paginar revela a incoerência.
- `QuickOutHistoryModal.viewItems` ordena produto/SKU/quantidade/data **só sobre a página**, enquanto `GET /quick-out/history` tem `orderBy: { date: 'desc' }` **fixo** (F-03). A interface oferece quatro critérios; a API não conhece nenhum.
- Shift+clique (UF-08) aplica a ordenação secundária **só na página**, enquanto a primária vai ao banco.

Ordenar é como se encontra um produto num estoque com centenas de itens. Uma ordenação que só reorganiza dez linhas não é um detalhe de acabamento: é uma resposta errada a uma pergunta operacional.

#### Fontes/decisões atendidas
**D-A (resolvida em 31/08/2026)**; **D-D / UF-08 (resolvida por consequência)**; F-03; `bugfix-gate.md` §3.2 (F-03 migration-bound); `characterization-plan.md` §4 e §12 (F-03 e UF-08 marcados **não congelar**); `design-system.md` §13.3 (`aria-sort` só na primária; ordenação múltipla deliberadamente subespecificada); `design-direction.md` §4.4 (paridade mobile: ordenação **precisa existir** no mobile); regras de backend do `AGENTS.md` (Zod em body **e** query).

#### Dependências
Nenhuma. Não depende de token. **Roda em paralelo às Tasks 1, 2 e 4** e **bloqueia** 11, 13, 16, 22 e 23.

#### Componentes e arquivos prováveis
**Backend:** `packages/backend/src/routes/quick-out.ts` (schema de query + `orderBy`), `packages/backend/src/routes/products.ts` (desempate estável e, conforme a sub-decisão de collation, a ordem alfabética), `packages/backend/test/*`.
**Frontend:** `packages/frontend/src/hooks/useProductsQuery.ts` (fim do `viewItems`), `packages/frontend/src/api/quickOut.ts` (novos parâmetros), `packages/frontend/src/components/QuickOutHistoryModal.tsx` (**apenas a camada de dados** — layout e diálogo continuam sendo da Task 23), `packages/frontend/src/components/products/ProductsTable.tsx` e `ui/DataTable.tsx` (**apenas a remoção do Shift+clique**).

#### Mudanças previstas

**(a) Inventário assinado.** A tabela de §2.1 entra no PR com um veredito por opção: *já global* · *passa a ser global* · *não é oferecida até haver suporte real*.

**(b) Contrato de query com whitelist.** `sortBy` e `sortDir` como `z.enum` em **toda** rota que ordena; valor fora do domínio vira **400**, nunca um default silencioso. `GET /products` **já faz isso** (`z.enum(['name','sku','balance'])` + `z.enum(['asc','desc'])`) — o contrato existente é reaproveitado, não reinventado. `GET /quick-out/history` ganha o mesmo, com `z.enum(['productName','productSku','quantity','date'])`.

**(c) Ordenação antes da paginação, sobre o conjunto filtrado inteiro.** No banco quando o critério é coluna real (`name`, `sku`, `date`, `quantity`, e `product.name`/`product.sku` por relação, que o Prisma expressa em `orderBy`); em **uma única agregação no serviço** quando o critério é derivado (`balance`), como já acontece hoje. **Nunca sobre a página já carregada.**
> **Nuance registrada, não escondida:** `sortBy=balance` já é global hoje — carrega o conjunto filtrado, agrega saldo uma vez, ordena e só então fatia. O que ele **não** é é "no banco". Levar saldo para o banco exige coluna computada/materializada, que é item de backlog próprio (`AGENTS.md`) e **desproporcional** para esta task. Critério adotado: a promessa ao usuário é *global antes da paginação*, e `balance` a cumpre. A migração para coluna computada fica registrada como follow-up, com o teto de volume medido no PR.

**(d) Desempate estável obrigatório.** Todo `orderBy` recebe `id` como último critério. Sem isso, `OFFSET` sobre valores repetidos (dois produtos com o mesmo saldo, duas baixas no mesmo instante) **duplica ou salta linhas entre páginas** — uma ordenação "global" instável continua mentindo, só que de forma mais difícil de perceber.

**(e) Collation — SD-1, RESOLVIDA em 31/08/2026.** Ver §9.3 para a política aprovada e o risco residual aceito. Em resumo: **nenhuma coluna normalizada, nenhuma migration, nenhum ICU nesta versão.** A ordenação é global e no banco, e **aceita-se a collation nativa do PostgreSQL de cada ambiente**. Ordenação linguística pt-BR idêntica entre local, CI e produção **não é requisito do produto nesta versão**; se virar, entra como task funcional própria.

Consequência para os testes desta task: as asserções de ordenação global usam **valores ASCII inequívocos** (letras sem acento, números, datas) e **nunca** dependem de acento, caixa ou locale — do contrário o mesmo teste passaria num ambiente e falharia noutro, medindo a collation em vez da regra.

**(f) Histórico de baixas ganha ordenação real.** `productName`/`productSku` via `orderBy: { product: { name: … } }`, `quantity` e `date` diretos. Complexidade **baixa** — a rota já pagina e conta no banco. Portanto os quatro critérios **permanecem visíveis**, agora verdadeiros. Isso **supera** a recomendação anterior do `bugfix-gate.md` de simplesmente remover os controles.

**(g) Shift+clique (UF-08) não é oferecido.** Ordenação multi-coluna server-side, com precedência comunicada, é desproporcional para um recurso que a Fase 2 já descreveu como **invisível e enganoso** e cuja permanência nunca foi decidida. O ramo `event.shiftKey` do `DataTable` sai, e a capacidade entra no backlog com a condição de retorno: *só volta com suporte server-side e precedência visível*. **É uma ausência declarada**, e entra na tabela de paridade.

**(h) Query keys e paridade.** A chave do React Query de produtos **já** inclui `sortBy`/`sortDir`; o histórico de baixas passa a incluí-los quando migrar (Task 23). A superfície mobile usa **o mesmo contrato** — é o que torna possível a sheet de ordenação da Task 16 sem inventar um segundo caminho.

**(i) Busca, filtros e paginação preservados.** Ordenação combina com `search`, `status`, `q`, `from`/`to` sem alterar o significado de nenhum deles; mudar a ordenação continua voltando para a página 1.

#### Comportamentos PRESERVAR
- PT-3 (`aria-sort` no cabeçalho **primário**) e PT-4 (clicar no cabeçalho troca a ordenação primária com a chave certa) — `ProductsTable.test.tsx`.
- QOL-4 (ordenar alterna a direção **na consulta**) e QOL-5 (ordenar volta à página 1) — `QuickOutListModal.test.tsx`.
- QOH-1..QOH-3 (busca e datas resetam a página; contador e navegação) e **QOH-8** (o recorte sobrevive ao reabrir — N-9) — `QuickOutHistoryModal.test.tsx`.
- PD-6 (busca com debounce chega à API e reseta a página) — `ProductDashboard.characterization.test.tsx`.
- `DataTable.test.tsx` (sem paradas de tab vazias; erro e carregando anunciados).
- **Regras de negócio intocadas:** saldo derivado, saída que não negativa, ajuste com 409, concorrência com lock de linha. Esta task lê; não escreve estoque.

#### Comportamentos ALTERAR INTENCIONALMENTE
- Fim da reordenação local em `useProductsQuery.viewItems` — a ordem exibida passa a ser a ordem do conjunto.
- Fim do Shift+clique (UF-08), com ausência declarada.
- O histórico de baixas passa a ordenar de verdade (F-03).
- A ordem alfabética passa a ser a do banco (collation nativa do ambiente), sem a reordenação client-side que a disfarçava. SD-1 (§9.3.1) aceita essa variação como risco residual; o QA manual documenta, não bloqueia.

#### Bugs que NÃO devem ser congelados
F-03 (ordenação só da página aparentando global), UF-08 (secundária enganosa), e a reordenação local de `name`. **Nenhum characterization test os afirma** — os dois primeiros estão na lista fechada de "não congelar" de `characterization-plan.md` §12.

#### Testes automatizados relevantes
Existentes que a task não pode quebrar: PT-3, PT-4, QOL-4, QOL-5, QOH-1..QOH-3, QOH-8, PD-6, `DataTable.test.tsx`.

**Testes novos — backend** (`vitest` + `supertest` contra Postgres real, como o resto da suíte):
- `sortBy`/`sortDir` fora da whitelist → **400** (não default silencioso), em `/products` e em `/quick-out/history`;
- **ordenação global atravessa páginas**: pedir página 1 e página 2 e afirmar que a concatenação é exatamente a sequência ordenada do conjunto — o teste que falha hoje para o histórico de baixas;
- desempate estável: com valores repetidos, nenhuma linha aparece duas vezes nem some entre páginas;
- `asc` e `desc` em cada critério;
- ordenação combinada com busca, com filtro de status e com intervalo de datas;
- histórico de baixas ordenado por produto, SKU, quantidade e data.

**Testes novos — frontend:**
- o controle de ordenação envia `sortBy`/`sortDir` corretos à API, em cada superfície;
- **nenhuma reordenação local**: dada uma resposta da API numa ordem, a tela exibe **essa** ordem;
- a sheet/menu de ordenação do mobile usa o mesmo contrato do desktop (preparado aqui, aplicado na Task 16).

#### QA manual
Com mais de uma página de produtos: ordenar por saldo e por nome e conferir que a **página 2 continua a sequência** da página 1. Repetir no histórico de baixas, ordenando por produto e por quantidade.

**Verificação de acentuação — não bloqueante (SD-1, §9.3.1).** Conferir `Ábaco`, `abacaxi`, `Álcool`, `Zebra` no ambiente local e, quando houver acesso, no CI e em produção. O objetivo é **documentar** a ordem que cada ambiente produz, não aprovar ou reprovar a task: ordenação pt-BR idêntica entre ambientes não é requisito desta versão. Divergências encontradas são registradas como evidência para a eventual task funcional futura de collation.

#### Critérios de aceite
- **Nenhuma opção de ordenação visível reorganiza apenas a página carregada.**
- Toda opção visível tem implementação global; a que não tem **não é oferecida**, e a ausência está declarada.
- Query params validados por whitelist; valor inválido → 400.
- Ordenação aplicada antes da paginação, sobre o conjunto filtrado inteiro.
- Desempate estável em todo critério.
- Busca, filtros e paginação preservados; trocar a ordenação volta à página 1.
- A ordem alfabética exibida é a do banco, coerente entre páginas. Diferença entre ambientes é risco residual aceito (SD-1, §9.3.1), não critério de reprovação.

#### Definição de pronto
Checklist completo verde (**inclui os testes de backend, que rodam contra Postgres real no CI**) + revisão de `security-reviewer` (entrada de query nova em rota autenticada) e de `accessibility-reviewer` (os controles de ordenação continuam nomeados e com `aria-sort` na primária).

#### Commit sugerido
`feat(api): aplicar ordenacao global antes da paginacao`

---

### Task 4 — Characterization tests do `MovementFormModal`

#### Tipo
QA/Gate

#### Objetivo
Cobrir, **antes** de mudar o componente, os comportamentos que as Tasks 17 e 18 vão reescrever.

#### Motivação
**Achado REV-04 do review, aceito e verificado.** A Task 17 é a maior mudança de UX do plano e a Task 18 muda uma regra de operação — e o rascunho afirmava que "tipo, quantidade, observação, erro do servidor e estado de envio" estavam protegidos pelos 6 testes existentes. **Não estão.** `MovementFormModal.test.tsx` tem 6 testes e **todos** tratam do campo **Data** (três pela UI, três do schema Zod). Não há teste de payload `IN`/`OUT`, de `note`, de erro do servidor, de valores preservados após falha, nem de submissão duplicada.

O componente **não estava** na lista de nove da Task 0 — foi classificado ADAPTAR, e a escolha era defensável então. Deixou de ser quando D2/P-4 e D-F passaram a reescrever o formulário inteiro.

#### Fontes/decisões atendidas
`characterization-plan.md` §0 (critério de pronto: verde contra o código atual) e §12 (padrões de teste proibidos); risco 1 de `audit.md` §9; regra de TDD do `AGENTS.md`.

#### Dependências
Nenhuma. Roda em paralelo às Tasks 1, 2 e 3.

#### Componentes e arquivos prováveis
`packages/frontend/test/MovementFormModal.characterization.test.tsx`. **Nenhum arquivo de `src/`.**

#### Mudanças previstas
Testes novos, afirmando o comportamento **atual**:
- **MFM-1** — payload com tipo, quantidade e observação corretos, para `IN` **e** para `OUT`.
- **MFM-2** — falha do servidor mantém o diálogo aberto, com os valores digitados, e permite tentar de novo.
- **MFM-3** — a mensagem de erro do servidor chega ao usuário.
- **MFM-4** — durante o envio, uma segunda submissão não dispara segunda movimentação.
- **MFM-5** — sucesso fecha o diálogo, dispara `onSuccess` e anuncia o resultado.
- **MFM-6** — o diálogo se anuncia como tal e o foco retorna ao gatilho.

#### Comportamentos PRESERVAR
Todos os acima. **O tipo default `IN` NÃO entra como contrato** (ALTERAR INTENCIONALMENTE por D2/P-4), e **o `max` livre da quantidade em `OUT` também não** (ALTERAR INTENCIONALMENTE por D-F) — congelar qualquer um dos dois travaria o alvo.

#### Comportamentos ALTERAR INTENCIONALMENTE
Nenhum nesta task — ela não toca o produto.

#### Bugs que NÃO devem ser congelados
UF-20 (rótulo "Entrada (IN)"), UF-21 (default perigoso) e a ausência de limite em `OUT` (D-F): **nenhum teste desta task pode afirmá-los**.

#### Testes automatizados relevantes
Os 6 testes existentes permanecem intocados. **Critério de pronto: a suíte nova passa verde contra o código atual, sem alterar uma linha de `src/`.**

#### QA manual
Nenhum.

#### Critérios de aceite
- Nenhum arquivo de `src/` alterado.
- Nenhum assert sobre `className`, estrutura de DOM, valor default do tipo ou limite de quantidade.

#### Definição de pronto
Checklist completo verde.

#### Commit sugerido
`test(movements): caracterizar o formulario de movimentacao antes da migracao`

---

### Task 5 — `Button`: níveis de ação, dois tamanhos e loading acessível

#### Tipo
Visual + Acessibilidade

#### Objetivo
Alinhar o `Button` à hierarquia de ações e ao estado `loading` correto.

#### Motivação
`isLoading` mostra spinner mas **não** desabilita; cada chamador precisa lembrar de passar `disabled` também — e os chamadores divergem (M-10). O tamanho `lg` existe e nunca é usado. O foco é `indigo-600`.

#### Fontes/decisões atendidas
`design-system.md` §10.1 (níveis), §10.3 (dois tamanhos, `lg` eliminado), §11.2 (`aria-disabled` + `aria-busy` + guarda no handler + rótulo no gerúndio), §9 (foco), §7 (`radius-control`); A-1; M-10; D3.

#### Dependências
Task 1.

#### Componentes e arquivos prováveis
`src/components/ui/Button.tsx` · **e os chamadores que hoje passam `disabled` junto com `isLoading`**: `src/components/MovementFormModal.tsx`, `src/components/ui/ConfirmDialog.tsx`, `src/components/QuickOutModal.tsx`, `src/components/ProductFormModal.tsx`.

#### Mudanças previstas
- Variantes por nível: `primary`, `secondary`, `tertiary`, `destructive`, e o nível **SPECIALIZED SHORTCUT** (neutro). Manter `ghost` como **alias de `tertiary`** para não espalhar um rename por 7 chamadas — o rename é cosmético e pode sair depois (D-E).
- Remover o tamanho `lg` (**verificado: zero usos hoje**).
- `loading`: `aria-disabled` + `aria-busy` + guarda no `onClick` (o botão continua focável) — não `disabled`.
- **Separar "pendente" de "inválido" nos chamadores** (achado REV-12): hoje `MovementFormModal` passa `disabled={mutation.isPending}` **e** `isLoading`; `ConfirmDialog` idem; e o `QuickOutModal` usa `disabled={isSubmitting || quantity <= 0}`, misturando **dois motivos diferentes** no mesmo atributo. "Pendente" passa a ser `loading` (focável, ativação bloqueada); "inválido" continua em `disabled` (não focável).
- Foco único (2px accent + offset 2px, `focus-visible`), `rounded-control`.

#### Comportamentos PRESERVAR
- Spinner visível durante o envio — `MovementFormModal.test.tsx`, `ConfirmDialog.test.tsx`, `AdjustmentFormModal.test.tsx`.
- **QOM-4** (Enter durante o envio não dispara segunda baixa) — o teste que protege contra regressão de submit duplo.
- Toda ativação por clique e por teclado nos chamadores atuais.

#### Comportamentos ALTERAR INTENCIONALMENTE
- `loading` passa a **impedir** a ativação (hoje não impede).
- Anel de foco muda de `indigo-600` para `accent`.

#### Bugs que NÃO devem ser congelados
M-10.

#### Testes automatizados relevantes
`MovementFormModal.test.tsx`, `ConfirmDialog.test.tsx`, `AdjustmentFormModal.test.tsx`, `QuickOutModal.characterization.test.tsx` (QOM-4).
**Testes novos:** botão em `loading` não dispara `onClick`, expõe `aria-busy` e **continua focável**; botão `disabled` (motivo "inválido") não é focável; com `loading` ativo, nem clique nem `Enter` disparam segunda submissão.

#### QA manual
Nenhum obrigatório.

#### Critérios de aceite
- Exatamente dois tamanhos.
- `loading` não remove o foco e impede a ativação.
- Um único tratamento de foco no arquivo.

#### Definição de pronto
Checklist completo verde.

#### Commit sugerido
`refactor(ui): alinhar Button aos niveis de acao do design system`

---

### Task 6 — `Input` e `Select`: estados, contraste de contorno e nome acessível obrigatório

#### Tipo
Acessibilidade + Visual

#### Objetivo
Tornar a regra de rótulo aplicável **pelo tipo**, dar estado `disabled` ao `Input` e corrigir o contraste do contorno de controle.

#### Motivação
`label` é opcional na API, o que torna a regra aspiracional; `border-gray-300` dá **1.47:1** contra a superfície, reprovando a WCAG 1.4.11 — e como o fundo da página contra o campo dá 1.045:1, a borda é de fato o único delimitador; o `Input` não tem estado `disabled` (M-9); a mensagem de erro diverge de outros campos do mesmo formulário (dívida **A6**).

#### Fontes/decisões atendidas
`design-system.md` §3.4, §11, §11.0 (anúncio de erro), §11.1; A5, A6; M-9; M-4; dívida A6 de `docs/features/ajuste-estoque/review.md`.

#### Dependências
Task 1.

#### Componentes e arquivos prováveis
`src/components/ui/Input.tsx` · `src/components/ui/Select.tsx` · **um** chamador não conforme: `src/components/QuickOutModal.tsx`.

#### Mudanças previstas
- Tipo passa a exigir **`label` OU `aria-label`**. Isso quebra o typecheck em exatamente um chamador — o campo de quantidade do `QuickOutModal`, que recebe `aria-label` **no mesmo commit** (correção mínima de N-8; a migração completa é a Task 20).
- `border-strong` (gray-500) como contorno padrão; `border-hover`; foco único; `radius-control`; sem `shadow-sm`.
- Estado `disabled` (fundo `surface-subtle`, texto `text-muted`, `cursor-not-allowed`).
- Erro: `aria-invalid` + `aria-describedby`, **sem** `role="alert"` por campo (§11.0).

#### Comportamentos PRESERVAR
- Associação label↔campo e `aria-describedby` (exercitados por `ProductFormModal.test.tsx`, `MovementFormModal.test.tsx`, `AdjustmentFormModal.test.tsx`, `LoginPage.test.tsx`, e por toda busca por `getByLabelText`).
- `useId()` como origem dos ids.

#### Comportamentos ALTERAR INTENCIONALMENTE
- Campos ficam **visivelmente mais marcados**. É correção de acessibilidade, não escolha estética (A5).
- Erro de campo deixa de ser anunciado assertivamente por campo.

#### Bugs que NÃO devem ser congelados
M-9, M-4, N-8, dívida A6.

#### Testes automatizados relevantes
Toda a suíte de formulários (`AdjustmentFormModal.test.tsx` 24 testes, `ProductFormModal.test.tsx`, `MovementFormModal.test.tsx`, `LoginPage.test.tsx`).
**Testes novos:** campo desabilitado é comunicado; erro associado por `aria-describedby` com o campo `aria-invalid`.

#### QA manual
Comparar formulários antes/depois em 375px e 1440px: a borda mais escura não pode "pesar" a ponto de o formulário virar uma grade.

#### Critérios de aceite
- É impossível, **pelo tipo**, montar `Input`/`Select` sem nome acessível.
- Nenhum `border-gray-300` restante nestes dois arquivos.
- Nenhum `role="alert"` por campo.

#### Definição de pronto
Checklist completo verde + revisão de `accessibility-reviewer`.

#### Commit sugerido
`refactor(ui): exigir nome acessivel e corrigir contraste de Input e Select`

---

### Task 7 — Superfícies: `Badge`, `Card` e `LoginPage`

#### Tipo
Visual

#### Objetivo
Remover affordance falsa e sombra sem camada, e trazer a tela de login — **esquecida em todas as classificações anteriores** — para dentro do sistema.

#### Motivação
O `Badge` reage ao mouse sem oferecer nada (M-6); `shadow-sm` virou textura em 9 lugares; e `LoginPage.tsx` usa `rounded-lg`, `shadow-sm` e `text-xl` — exatamente o vocabulário que a Task 27 vai banir. **`LoginPage` não aparece na classificação MANTER/ADAPTAR/DEPRECAR do `design-system.md` §18** (achado LINT-01 do review): sem esta atribuição, o gate de lint viraria uma migração visual tardia.

#### Fontes/decisões atendidas
`design-system.md` §7, §8, §5.2, §16; A1; A2; M-6; B-4; **lacuna de escopo encontrada no review**.

#### Dependências
Task 1.

#### Componentes e arquivos prováveis
`src/components/ui/Badge.tsx` · `src/components/ui/Card.tsx` · `src/components/LoginPage.tsx`

#### Mudanças previstas
- `Badge`: remover `hover:scale`/`will-change`; `rounded-control` no lugar de `rounded-full`; variantes = estados de estoque + `accent-subtle`.
- `Card`: sem sombra; `radius-surface`; documentar no arquivo que **é proibido envolver a região de dados**.
- `LoginPage`: tokens, escala tipográfica (o `text-xl` sai), `radius-surface`, sem `shadow-sm`, foco único. **A largura local estreita é preservada** — o teto de 1536px do shell (D-B) **não** se aplica a esta superfície (§4.4).

#### Comportamentos PRESERVAR
Login, validação e mensagem de erro — `LoginPage.test.tsx` (3 testes).

#### Comportamentos ALTERAR INTENCIONALMENTE
Badges deixam de ser pílulas (A1) — a mudança visual mais perceptível do sistema.

#### Bugs que NÃO devem ser congelados
M-6.

#### Testes automatizados relevantes
`LoginPage.test.tsx`, e toda a suíte como não-regressão.

#### QA manual
1440px: a página deixou de parecer uma coleção de cartões flutuantes. 375px: login utilizável. Badge legível em escala de cinza.

#### Critérios de aceite
- Zero `rounded-full` e zero `shadow-sm` nestes três arquivos.
- Nenhum tamanho de fonte fora da escala em `LoginPage`.
- O login **não** herda o teto do shell.

#### Definição de pronto
Checklist completo verde.

#### Commit sugerido
`refactor(ui): alinhar superficies e tela de login ao design system`

---

### Task 8 — Feedback: `ConfirmDialog`, `ToastProvider` e banners

#### Tipo
UX intencional

#### Objetivo
Fazer o erro persistir e eliminar o texto de enchimento na confirmação.

#### Motivação
O toast de erro some em 3,5s levando junto a única explicação da falha (A-11) — "Estoque insuficiente" desaparece antes de muita gente terminar de ler. O `ConfirmDialog` repete uma frase genérica abaixo da descrição específica, e texto que nunca varia é texto que se aprende a ignorar (M-14).

#### Fontes/decisões atendidas
`design-system.md` §12, §17; A-11; M-14; B-3.

#### Dependências
Task 1. Independente da Task 7 (arquivos disjuntos).

#### Componentes e arquivos prováveis
`src/components/ui/ConfirmDialog.tsx` · `ToastProvider.tsx` · `LowStockBanner.tsx` · `ApiStatusBanner.tsx`

#### Mudanças previstas
- `ConfirmDialog`: remover a frase genérica; corpo = resumo do que vai acontecer, ou nada.
- `ToastProvider`: toasts de **erro** não auto-dispensam; as **duas live regions sempre montadas continuam exatamente como estão**.
- Banners: tokens; severidades deixam de compartilhar o mesmo âmbar (B-3).

#### Comportamentos PRESERVAR
- Duas live regions (polite/assertive) sempre montadas — `ToastProvider.test.tsx` (3).
- `role="status"` do `LowStockBanner` e do `ApiStatusBanner` — `LowStockBanner.test.tsx` (4), `ApiStatusBanner.test.tsx` (2).
- Confirmação, cancelamento e `isPending` do `ConfirmDialog` — `ConfirmDialog.test.tsx` (5).

#### Comportamentos ALTERAR INTENCIONALMENTE
- Toast de erro passa a exigir dispensa manual.
- O corpo genérico do `ConfirmDialog` desaparece.

#### Bugs que NÃO devem ser congelados
Nenhum.

#### Testes automatizados relevantes
`ToastProvider.test.tsx`, `ConfirmDialog.test.tsx`, `LowStockBanner.test.tsx`, `ApiStatusBanner.test.tsx`.
**Teste novo:** toast de erro permanece após o tempo padrão (fake timers) e é dispensável manualmente.

#### QA manual
Provocar um erro real de baixa e confirmar que a mensagem espera pela pessoa.

#### Critérios de aceite
- Toast de erro não desaparece sozinho; os de sucesso continuam desaparecendo.
- Nenhum texto fixo genérico no corpo de confirmação.

#### Definição de pronto
Checklist completo verde.

#### Commit sugerido
`feat(ui): manter erros visiveis ate a dispensa do usuario`

---

### Task 9 — `Modal` (variante `sheet`) e `MenuPopover` (separador semântico)

#### Tipo
Migração estrutural (habilitadora) + Acessibilidade

#### Objetivo
Preparar o primitivo único para receber os quatro diálogos e a sheet do mobile, e dar ao menu a separação semântica que a hierarquia de ações exige.

#### Motivação
O `Modal` já é o alvo correto — mas não tem variante de sheet, e seu botão de fechar viola a própria regra de foco (sem `ring-offset`). O `MenuPopover` é o melhor componente do projeto e **não tem separador**: "Editar" e "Excluir" são vizinhos à mesma distância do cursor (UF-16).

#### Fontes/decisões atendidas
`design-system.md` §12, §15 (a sheet é **variante do primitivo**), §18, §10.2; D3; UF-16; C-1; B-1.

#### Dependências
Task 1.

#### Componentes e arquivos prováveis
`src/components/ui/Modal.tsx` · `src/components/ui/MenuPopover.tsx` · `packages/frontend/test/Modal.test.tsx` (um assert, ver abaixo)

#### Mudanças previstas
- `Modal`: `ring-offset` no botão de fechar; ícone `lucide-react` no lugar do glifo `✕` (B-1); tokens; **nova prop `variant: 'dialog' | 'sheet'`**, com a sheet ancorada na base em telas pequenas, `max-height` e rolagem interna. **Mesmo Radix, mesma semântica, mesmo focus trap** — só a caixa muda. **A largura do modal continua sendo a do `size`**: o teto de 1536px do shell (D-B) **não** se aplica a diálogos (§4.4).
- **Ajuste de um teste existente, declarado (achado REV-19):** `Modal.test.tsx` afirma hoje `expect(glyph?.textContent).toBe('✕')` — acopla o contrato ao **caractere**. No mesmo commit, o assert passa a afirmar o que importa: botão com nome acessível "Fechar" **e** conteúdo gráfico decorativo (`aria-hidden`), sem citar o glifo. Mudança **declarada**, não silenciosa.
- `MenuPopover`: exportar `MenuSeparator` com `role="separator"` (não é `menuitem`, portanto **não altera** a navegação por setas).

#### Comportamentos PRESERVAR
- Contrato completo de diálogo: `role="dialog"`, `aria-modal`, id único, foco entra e retorna, Escape, botão de fechar acessível — `Modal.test.tsx`. **É o contrato-alvo dos `QuickOut*`.**
- Padrão WAI-ARIA de menu — `MenuPopover.test.tsx` (7).

#### Comportamentos ALTERAR INTENCIONALMENTE
Nenhum comportamento de fluxo. É adição de capacidade.

#### Bugs que NÃO devem ser congelados
Botão de fechar sem `ring-offset`.

#### Testes automatizados relevantes
`Modal.test.tsx`, `MenuPopover.test.tsx`, `ConfirmDialog.test.tsx`, `ProductActionsMenu.test.tsx`, `StatusFilterMenu.test.tsx`, `AdjustmentFormModal.test.tsx`.
**Testes novos:** a variante `sheet` mantém `role="dialog"`, `aria-modal`, focus trap e retorno de foco; o separador não é anunciado como item de menu e não entra na navegação por setas.

#### QA manual
Sheet em 320px, 375px e viewport baixo (375×568): não pode cortar conteúdo, precisa rolar internamente e manter o botão de confirmação alcançável com teclado virtual aberto.

#### Critérios de aceite
- A sheet é variante do `Modal`; nenhum novo `createPortal` e nenhuma biblioteca nova.
- `MenuPopover.test.tsx` (7) passa **sem alteração**; de `Modal.test.tsx` (6), **cinco** passam sem alteração e **um** é reescrito conforme acima.
- Separador com `role="separator"`.

#### Definição de pronto
Checklist completo verde + revisão de `accessibility-reviewer`.

#### Commit sugerido
`feat(ui): adicionar variante sheet ao Modal e separador ao MenuPopover`

---

### Task 10 — App shell: cabeçalho, hierarquia tipográfica e **largura fluida (D-B)**

#### Tipo
Visual

#### Objetivo
Inverter a hierarquia entre marca e contexto, remover o glassmorphism e **implantar a regra de largura de D-B** no shell.

#### Motivação
A marca (`text-3xl md:text-4xl font-bold`) tem **mais** peso que o nome da tela; o header usa `backdrop-blur` + `bg-white/60`, reduzindo contraste sobre conteúdo rolando; e `max-w-5xl` (1024px), aplicado igualmente ao header e ao `main`, deixa metade de um monitor de operação vazia. A auditoria registra que a mudança de largura **deve ser task isolada, com avaliação antes/depois** — esta é essa task.

#### Fontes/decisões atendidas
**D-B (resolvida em 31/08/2026)**, §4.4 deste plano; `design-system.md` §5.2, §8, §15.2 regra 5; A2; A-8; M-11; B-6; direção B (zonas: identidade · alerta · controle · dados).

#### Dependências
Tasks 1 e 5.

#### Componentes e arquivos prováveis
`src/App.tsx` · o bloco de título/ações de `src/components/ProductDashboard.tsx` (apenas o cabeçalho, não a orquestração)

#### Mudanças previstas
- **Largura (D-B):** o container do header e o do `main` passam a `w-full`, centralizados, com teto de **1536px** e gutters **16 / 24 / 32px** (`px-4 md:px-6 xl:px-8`). Um único container compartilhado, para que header, toolbar e região de dados fiquem **alinhados na mesma calha**.
- `SimpleStock` → `label` (14/600). `Produtos` → `page-title` (24/600).
- Remover `backdrop-blur` e `bg-white/60`; header sólido com borda.
- Ações do cabeçalho empilham em largura total abaixo de `sm`.
- **Nada mais muda nesta task** — é a task isolada de largura.

#### Comportamentos PRESERVAR
- Skip link funcional e `main` focável — `App.test.tsx`.
- `ApiStatusBanner` no lugar e anunciado — `ApiStatusBanner.test.tsx`.
- Logout no cabeçalho.

#### Comportamentos ALTERAR INTENCIONALMENTE
- O topo fica visivelmente mais discreto (A2).
- **A densidade percebida de todas as telas muda com a largura** — motivo da isolação.

#### Bugs que NÃO devem ser congelados
B-6 (glassmorphism reduzindo contraste), M-11 (container estreito).

#### Testes automatizados relevantes
`App.test.tsx`, `ApiStatusBanner.test.tsx`, `LoginPage.test.tsx`.
Nenhum teste novo: **largura e peso tipográfico não são contrato de comportamento**, e a Task 0 proíbe asserção sobre `className`.

#### QA manual
**Obrigatório, e é o principal desta task.**
- **1024px:** o shell usa o espaço disponível respeitando o gutter de 24px; nenhuma faixa vazia lateral.
- **1440px:** idem, gutter de 32px; header, toolbar e região de dados **alinhados na mesma calha**.
- **>1536px** (1920px): conteúdo **centralizado**, com o teto respeitado.
- **375px e 320px:** gutter de 16px; as duas ações do cabeçalho empilham sem truncar rótulo.
- **Nenhum scroll horizontal causado pelo container**, em nenhuma dessas larguras.
- Skip link visível ao receber foco.

#### Critérios de aceite
- Abaixo de 1536px o shell é fluido e respeita os gutters; acima, centraliza.
- Header, toolbar e região de dados compartilham a mesma calha.
- Nenhum tamanho de fonte acima de 24px em toda a aplicação.
- Nenhum `backdrop-blur` restante.
- Nenhum scroll horizontal causado pelo container.

#### Definição de pronto
Checklist completo verde + registro do antes/depois nas quatro larguras no PR.

#### Commit sugerido
`refactor(ui): tornar o shell fluido e ajustar a hierarquia do cabecalho`

---

### Task 11 — `DataTable` como região de dados

#### Tipo
Visual + Acessibilidade

#### Objetivo
Transformar a tabela de "card com sombra" em **região delimitada e densa**, corrigir três defeitos de semântica e **garantir que a região ocupe toda a largura do shell (D-B)**.

#### Motivação
A tabela é hoje um card (`rounded-lg border shadow-sm`) contendo linhas — card dentro de card. `select-none` está em 6 lugares, **inclusive nas células de dados**, impedindo copiar SKU. `aria-sort="none"` é aplicado a **todos** os cabeçalhos, virando ruído. Um cabeçalho `sortable` sem `headerRender` renderiza **só a seta**, sem rótulo.

#### Fontes/decisões atendidas
`design-system.md` §13.1 (métricas; altura corrigida para **~64px** por P-2), §13.2, §13.3, §8; **D-B** (§4.4: a região de dados ocupa toda a largura disponível, sem `max-width` próprio); D5; P-2; A-5; M-8; achados A-8ʳ e A-12ʳ.

#### Dependências
Tasks 1, 7 e **3** (o `aria-sort` e os cabeçalhos passam a refletir uma ordenação que já é global, e o ramo `shiftKey` já saiu).

#### Componentes e arquivos prováveis
`src/components/ui/DataTable.tsx`

#### Mudanças previstas
- Região com borda, **sem sombra**, `radius-surface`; cabeçalho sem `backdrop-blur`.
- **D-B:** a região ocupa **100% da largura do shell**; **nenhum `max-width` adicional menor que o do shell**.
- `select-none` **apenas** nos cabeçalhos clicáveis; células de dados selecionáveis.
- `aria-sort` **somente** na coluna de ordenação primária.
- Cabeçalho ordenável sem `headerRender` passa a renderizar **rótulo + indicador** (M-8).
- Estado vazio ganha `role` de anúncio.
- Densidade: célula 12 vertical · 16 horizontal; filetes horizontais; suporte a `tabular-nums` por coluna.
- Receita de linha selecionada (fundo `accent-subtle` + barra lateral `accent` de 2px) disponível para a Task 13.

#### Comportamentos PRESERVAR
- Sem paradas de tabulação vazias; erro e carregando anunciados — `DataTable.test.tsx`.
- `aria-sort` na ordenação **primária** — PT-3.
- Troca de ordenação primária ao clicar no cabeçalho — PT-4.

#### Comportamentos ALTERAR INTENCIONALMENTE
- Cabeçalhos não ordenados deixam de expor `aria-sort="none"`.
- A tabela deixa de ser um card e passa a ocupar toda a largura do shell.

#### Bugs que NÃO devem ser congelados
A-5, M-8, A-8ʳ, A-12ʳ.

#### Testes automatizados relevantes
`DataTable.test.tsx`, `ProductsTable.test.tsx` (PT-1..PT-8).
**Testes novos:** célula de dados é selecionável; cabeçalho ordenável sem `headerRender` expõe o rótulo; estado vazio é anunciado.

#### QA manual
**Obrigatório.** Copiar um SKU com o mouse em 1440px. Tabela cheia (10 linhas) em **1024px, 1440px e 1920px**: a região acompanha o shell, **sem `max-width` próprio menor**, sem scroll horizontal e sem truncamento.

#### Critérios de aceite
- Copiar SKU funciona.
- Apenas a coluna primária tem `aria-sort`.
- Nenhuma sombra na tabela.
- **A tabela não recebe `max-width` adicional menor que o do shell.**

#### Definição de pronto
Checklist completo verde + revisão de `accessibility-reviewer`.

#### Commit sugerido
`refactor(products): transformar a tabela em regiao de dados`

---

### Task 12 — `ProductActionsMenu`: bloco destrutivo separado

#### Tipo
Acessibilidade + UX intencional

#### Objetivo
Afastar "Excluir" e "Zerar Estoque" das ações comuns.

#### Motivação
Hoje as cinco ações formam um menu plano: a ação irreversível está à mesma distância do cursor que a mais banal (UF-16). Separação espacial é prevenção de erro, não decoração.

#### Fontes/decisões atendidas
D3; `design-system.md` §10.2, §18; UF-16.

#### Dependências
Task 9.

#### Componentes e arquivos prováveis
`src/components/products/ProductActionsMenu.tsx`

#### Mudanças previstas
- `MenuSeparator` antes do bloco destrutivo; "Zerar Estoque" e "Excluir" abaixo dele.
- Ordem dos itens não destrutivos preservada.

#### Comportamentos PRESERVAR
- Ordem das ações com "Ajustar Estoque" entre "Ver Histórico" e "Zerar Estoque"; `onAdjust`; "Ajustar" disponível com saldo zero; "Zerar" desabilitado sem saldo; "Excluir" destrutivo; fiação de `onEdit`, `onHistory`, `onZeroBalance` — `ProductActionsMenu.test.tsx` (7).
- Gatilho com nome acessível por produto.
- Comportamento de teclado do menu — `MenuPopover.test.tsx`.

#### Comportamentos ALTERAR INTENCIONALMENTE
Ausência de separador (UF-16).

#### Bugs que NÃO devem ser congelados
Nenhum.

#### Testes automatizados relevantes
`ProductActionsMenu.test.tsx`, `MenuPopover.test.tsx`.

#### QA manual
Navegar o menu só com teclado: o separador não pode virar parada.

#### Critérios de aceite
- Separador com `role="separator"`, fora da navegação por setas.
- Os 7 testes existentes passam sem alteração.

#### Definição de pronto
Checklist completo verde.

#### Commit sugerido
`refactor(products): separar o bloco destrutivo no menu de acoes`

---

### Task 13 — `ProductsTable`: par saldo/mínimo, SKU sob o nome e hierarquia de ações

#### Tipo
Visual + UX intencional

#### Objetivo
Colocar a evidência ao lado do veredito e devolver o saldo ao papel de elemento dominante da linha.

#### Motivação
A tabela mostra "Estoque Baixo" e **esconde o `minStock` que produziu o status** (C-6/UF-40) — a única tela que mostra os dois juntos é um modal secundário. Cada linha traz três controles, um deles vermelho em todas as 10 linhas (A-1). Números sem `tabular-nums` e sem separador de milhar não são comparáveis (A-6). `aria-controls` aponta para id que só existe quando expandido (A-7).

#### Fontes/decisões atendidas
`design-system.md` §13.2, §14.1, §10.2; D5; A5 ("veredito + evidência"); P-2 (~64px); P-3; A-1; A-6; A-7; A-10; C-6; UF-40; empréstimos de A e de C.

#### Dependências
Tasks 2, 3, 5, 7, 11 e 12.

#### Componentes e arquivos prováveis
`src/components/products/ProductsTable.tsx` · `src/components/products/types.ts` (se o vocabulário migrar para lá)

#### Mudanças previstas
- **Par saldo/mínimo** na mesma célula, à direita, ambos `tabular-nums`, `mín. N` em `caption` logo abaixo. Altura de linha ~64px (P-2).
- **SKU fundido sob o nome** (`caption`, `text-secondary`), liberando a coluna de 20% — continuando **ordenável e copiável**.
  **Onde vive o controle de ordenação por SKU** (achado REV-16; hoje é o cabeçalho próprio da coluna, que deixa de existir): o cabeçalho da coluna "Produto" passa a oferecer **dois controles nomeados** — "Ordenar por nome" e "Ordenar por SKU". Ambos disparam a ordenação **global** já implementada na Task 3. Alternativa rejeitada: mover a ordenação por SKU para a sheet/menu, o que a esconderia no desktop, onde hoje custa um clique.
- Um **único** gatilho de disclosure para a descrição, com `aria-controls` válido (região sempre presente, apenas oculta) — corrige A-7 sem perder a capacidade.
- Ações: "Movimentar" PRIMARY; baixa rápida como **atalho neutro** (perde o vermelho); overflow.
- Vocabulário: "Em estoque" / "Estoque baixo" / "Sem estoque".
- Estados vazios distintos: "nada cadastrado" × "filtro sem resultado", cada um com sua ação.
- Aplicar o helper da Task 2 a saldo e mínimo.
- **Ordenação da coluna "Produto":** ver a decisão **T13-SD1** abaixo.

#### Decisão T13-SD1 — coluna "Produto" e `aria-sort`

Fundir o SKU sob o nome elimina o `<th>` que hoje ordena por SKU (REV-16). O `DataTable` amarra `aria-sort` a **uma** chave por coluna, então uma coluna "Produto" com `key: 'name'` deixaria a tabela **sem nenhum** `aria-sort` ao ordenar por SKU — contradizendo §13.3 e PT-3. Esta decisão fecha o ponto.

1. Depois da fusão existe **uma** coluna visual e semântica: **"Produto"**.
2. Essa coluna representa **dois critérios ordenáveis**: `name` e `sku`.
3. O `DataTable` passa a aceitar aliases de ordenação por coluna, por uma capacidade **aditiva**:

   ```ts
   sortKeys?: string[]
   ```

4. **Compatibilidade:** quando `sortKeys` não é informado, vale `sortKeys = [String(column.key)]`. **Nenhuma coluna existente muda de comportamento.**
5. `ProductsTable` declara na coluna "Produto": `sortKeys: ['name', 'sku']`.
6. O `<th>` de "Produto" recebe `aria-sort` quando o sort primário for **`name` OU `sku`**.
7. Continua existindo **exatamente um** `aria-sort` na tabela: o contrato de ordenação primária única da Task 3 permanece intacto.
8. Dentro do cabeçalho "Produto" existem **dois controles separados e acessivelmente nomeados**: "Ordenar por Nome" e "Ordenar por SKU".
9. O controle do critério **ativo** fornece contexto acessível suficiente para identificar também a **direção** atual — o nome acessível do botão precisa cobrir **critério + direção** (ex.: "Ordenar por SKU (ordenado crescente)"), já que o `aria-sort` do `<th>` anuncia só "Produto, crescente" e não distingue o subcritério. `aria-sort` continua pertencendo ao `columnheader`, **não** aos botões.
10. **Proibido:** manter coluna SKU escondida; criar `<th>` invisível; tornar `column.key` dinâmico; remover `aria-sort` quando a ordenação for SKU; transformar a `table` em `grid`; criar seleção ou estado novo.

**Escopo da API.** A alteração em `DataTable.tsx` está autorizada **somente** para suportar `sortKeys`. Nenhuma outra API nova do primitivo é autorizada por esta decisão — em particular **não** criar agora `selectedIds`, `selectedRow`, context, reducer, nova abstração de ordenação, multi-sort ou semântica de `grid`.

**PT-3.** Permanece contrato **PRESERVAR**, mas a **implementação do teste pode ser adaptada**, porque a Task 13 ALTERA INTENCIONALMENTE a estrutura de colunas. O contrato preservado é: ao ordenar por SKU, a coluna "Produto" (que contém nome + SKU) anuncia `aria-sort`; **somente** ela anuncia; e o controle "Ordenar por SKU" continua acessivelmente identificável. **Não** é requisito preservar um `<th>` independente chamado "SKU" — essa estrutura é exatamente o que a Task 13 remove. Não desenhar produção apenas para manter o seletor antigo do teste.

**Saldo.** O cabeçalho continua **"Saldo Atual"**. A task aproxima saldo + mínimo **dentro da célula**, e **não** exige renomear o cabeçalho. PT-4 permanece sem alteração conceitual.

#### Comportamentos PRESERVAR
- PT-1 (nome, SKU e saldo legíveis), PT-2 (três status traduzidos), PT-3 (`aria-sort` na primária — **conforme T13-SD1**), PT-4 (troca de ordenação), PT-5 (checkbox com nome acessível por linha), PT-6 (**a capacidade** de revelar/recolher a descrição — não a via), PT-7 (Movimentar e baixa rápida com nome acessível), PT-8 (estado vazio renderizado) — `ProductsTable.test.tsx`.
- PS-1: a regra de status permanece em `products/types.ts` — `productStatus.test.ts` (6 testes, incluindo o limite `0/0 → OUT`).

#### Comportamentos ALTERAR INTENCIONALMENTE
- Texto exato do estado vazio (A-10) — PT-8 afirma que **existe** estado vazio, não a frase.
- Cor destrutiva do atalho de baixa rápida (A-1).
- Fusão do SKU sob o nome e o par saldo/mínimo.
- **Estrutura de colunas: o `<th>` próprio do SKU deixa de existir** — a ordenação por SKU passa ao cabeçalho "Produto" (T13-SD1).
- Dois gatilhos de disclosure passam a um só — PT-6 protege o efeito.

#### Bugs que NÃO devem ser congelados
C-6, A-6, A-7.

#### Testes automatizados relevantes
`ProductsTable.test.tsx` (PT-1..PT-8), `productStatus.test.ts` (PS-1), `DataTable.test.tsx`.
**Testes novos:** o estoque mínimo é legível na linha; os dois estados vazios são distinguíveis; `aria-controls` aponta para elemento existente; **a ordenação por SKU continua acionável por um controle nomeado e dispara `onTogglePrimarySort('sku')`**.

#### QA manual
**Obrigatório.** 1024px, 1440px e 1920px com 10 linhas: altura ~64px, coluna de ações sem dominar, sem scroll horizontal, números alinhados por ordem de grandeza. Em 1920px, com o shell fluido (D-B), confirmar que a linha não fica "esticada e vazia".

#### Critérios de aceite
- Saldo e mínimo aparecem juntos, ambos tabulares, sem abrir nada.
- Nenhum vermelho na linha exceto o estado "Sem estoque".
- Estado vazio nomeia a causa e oferece a ação.
- Ordenar por SKU continua possível em um clique no desktop.

#### Definição de pronto
Checklist completo verde + revisão de `accessibility-reviewer`.

#### Commit sugerido
`refactor(products): aproximar saldo e minimo na regiao de dados`

---

### Task 14 — `StatusFilterMenu`: vocabulário único e contador legível

#### Tipo
Visual + Acessibilidade

#### Objetivo
Eliminar o **terceiro** vocabulário de status do produto e o texto de 10px.

#### Motivação
O filtro diz "OK / Atenção / Em falta", a tabela diz "Em Estoque / Estoque Baixo / Fora de Estoque" e o backend usa `OK/ATTN/OUT`. Filtrar e ler usam palavras diferentes para a mesma coisa. O contador está em `text-[10px]` (M-3).

#### Fontes/decisões atendidas
`design-system.md` §14.1, §18 (achado 13 do review da Fase 5), §5.2; M-3; C-1.

#### Dependências
Tasks 1 e 9.

#### Componentes e arquivos prováveis
`src/components/products/StatusFilterMenu.tsx`

#### Mudanças previstas
- Rótulos alinhados ao vocabulário único.
- Contador em `caption` (12px), com tokens.
- Foco único; `radius-control`.

#### Comportamentos PRESERVAR
SFM-1 (três opções marcáveis, múltipla seleção, `aria-checked`), SFM-2 (**"Limpar filtros" dispara `onClear`** — é a saída do beco sem saída UF-07), SFM-3 (desabilitado sem filtro ativo), SFM-4 (o gatilho anuncia a contagem — a sheet mobile depende dele) — `StatusFilterMenu.test.tsx` (7).

#### Comportamentos ALTERAR INTENCIONALMENTE
O vocabulário dos três estados. SFM-1 e SFM-4 asseguram capacidade e contagem, não palavras — se algum assert citar o rótulo antigo, o ajuste é declarado no mesmo commit.

#### Bugs que NÃO devem ser congelados
Terceiro vocabulário; M-3.

#### Testes automatizados relevantes
`StatusFilterMenu.test.tsx`, `MenuPopover.test.tsx`.

#### QA manual
Contador legível em 375px.

#### Critérios de aceite
- As mesmas três palavras em tabela, card e filtro.
- Nenhum tamanho de fonte fora da escala.

#### Definição de pronto
Checklist completo verde.

#### Commit sugerido
`refactor(products): unificar o vocabulario de status no filtro`

---

### Task 15 — `ProductCardList`: o card **é** a linha

#### Tipo
Visual + UX intencional

#### Objetivo
Devolver ao mobile as capacidades que um `hidden md:*` levou embora, e o dado que falta para decidir.

#### Motivação
No celular — o dispositivo de quem está fisicamente no estoque — **não existe baixa rápida** e o **estoque mínimo não aparece** (C-5/UF-23). O card é um `ui/Card` com sombra envolvendo uma linha. O estado vazio é um `Card` mudo, sem `role`.

#### Fontes/decisões atendidas
`design-system.md` §15.1, §15.2, §13.2; D5; **P-1** (baixa rápida no overflow no mobile); C-5; UF-23; A-12ʳ.

#### Dependências
Tasks 2, 5, 7, 9, 14 e **12 (obrigatória, mesmo arquivo)**.

#### Componentes e arquivos prováveis
`src/components/products/ProductCardList.tsx` · **`src/components/products/ProductActionsMenu.tsx`** · `src/components/products/types.ts`

> **Dependência de contrato (achado DUP-01).** "Baixa rápida no overflow" não é mudança de `ProductCardList`: o overflow **é** o `ProductActionsMenu`, cujo tipo hoje é `Pick<ProductActions, 'onEdit' | 'onHistory' | 'onAdjust' | 'onZeroBalance' | 'onDelete'>` — **`onQuickOut` não está lá**. Esta task abre o mesmo arquivo da Task 12 e vem depois dela (§6.3).

#### Mudanças previstas
- Estoque **mínimo** pareado ao saldo, ambos tabulares, via helper da Task 2.
- **Baixa rápida presente, no overflow** (P-1). Exige ampliar o contrato do `ProductActionsMenu` para aceitar `onQuickOut` e renderizar o item **antes do separador destrutivo** (é atalho de operação, não ação destrutiva).
- **Decisão de superfície declarada:** o item de baixa rápida no menu aparece **apenas na superfície de cards**. No desktop duplicaria o atalho da linha. O menu recebe a ação como opcional; sem ela, o item não existe.
- "Movimentar" como PRIMARY do card, alvo ≥ 44×44.
- O card deixa de ser `ui/Card` com sombra: passa a ser a linha com mais respiro vertical.
- **D-B:** os cards continuam usando **toda a largura disponível** dentro do shell, respeitando o gutter de 16px.
- Estado vazio com `role` de anúncio e texto que distingue a causa.

#### Comportamentos PRESERVAR
- PCL-1 (nome, SKU, saldo e status legíveis), PCL-2 (status **idêntico** ao da tabela), PCL-3 (`onMove` com o produto), PCL-4 (menu integrado e localizável pelo produto), PCL-5 (`role="status"` no carregando e `role="alert"` no erro) — `ProductCardList.test.tsx` (9).
- `ProductActionsMenu.test.tsx` (7): a ordem e a fiação das cinco ações atuais **não podem mudar** com a inserção da sexta.
- `productStatus` continua a fonte única da regra.

#### Comportamentos ALTERAR INTENCIONALMENTE
- **Ausência de seleção múltipla no card** permanece — ausência **declarada** na tabela de paridade.
- Texto do estado vazio.

#### Bugs que NÃO devem ser congelados
C-5 — **um teste afirmando que a baixa rápida não existe no mobile seria o pior congelamento possível deste plano**; A-12ʳ.

#### Testes automatizados relevantes
`ProductCardList.test.tsx`, `ProductActionsMenu.test.tsx`, `productStatus.test.ts`.
**Testes novos:** a baixa rápida é alcançável a partir do card e dispara `onQuickOut` com o produto (afirma **que existe e é alcançável**, não **onde** vive); o mínimo é legível no card; sem `onQuickOut`, o menu não renderiza o item.

#### QA manual
**Obrigatório.** 320px, 375px e viewport baixo: alvos ≥ 44×44 medidos, sem clipping, sem scroll horizontal; overflow abrindo sem cortar; **cards ocupando a largura disponível** com gutter de 16px.

#### Critérios de aceite
- Toda capacidade da tabela de paridade está presente no card ou no overflow.
- Nenhum alvo de ação abaixo de 44×44.
- Saldo e mínimo lado a lado.
- Cards usam a largura disponível.

#### Definição de pronto
Checklist completo verde + revisão de `accessibility-reviewer`.

#### Commit sugerido
`refactor(products): redesenhar o card mobile com paridade de capacidades`

---

### Task 16 — Zona de controle e paridade mobile: sheet, chips, ordem e ações em lote

#### Tipo
UX intencional + Migração estrutural

#### Objetivo
Fechar o beco sem saída do filtro no mobile, levar a ordenação ao mobile, corrigir a ordem paginação/lista e remover o controle morto.

#### Motivação
`LowStockBanner` aplica um filtro no celular, e "Limpar filtros" vive dentro de `hidden md:block` — **entra-se no filtro e não se sai** (UF-07/UF-41). A paginação é renderizada **antes** dos cards (C-4). "Excluir selecionados" fica **visível e permanentemente desabilitado** no mobile (N-3). Ordenação simplesmente **não existe** abaixo de `md` — e agora existe uma ordenação global de verdade (Task 3) para oferecer ali.

#### Fontes/decisões atendidas
`design-system.md` §15.1 (paridade **assinada**), §15.2, §13.3, §10.2; **D-A** (a sheet de ordenação só é honesta porque a Task 3 a tornou global); **D-B** (§4.4: a zona de controle compartilha a calha do shell); D3; P-5; UF-07; UF-41; C-4; N-3; A-2; A-3; decisão 8.

#### Dependências
Tasks 3, 5, 7, 9, 10, 14, 15.

#### Componentes e arquivos prováveis
`src/components/ProductDashboard.tsx` · possivelmente `src/components/products/ProductFiltersSheet.tsx` (composto **com o `Modal` variante `sheet`**, sem dependência nova)

#### Mudanças previstas
- **Sheet de filtro e ordenação no mobile**, acionada por um controle persistente com o contador de filtros ativos. A ordenação oferecida ali é **a mesma da Task 3** — mesmos critérios, mesmo contrato, sem um segundo caminho.
- **Chips de filtro ativo, removíveis, + "Limpar filtros" visíveis em qualquer largura**, dentro e fora da sheet.
- Busca **inline** em todas as larguras.
- **Ordem corrigida:** tabela (desktop) / cards (mobile) → **depois** a paginação, com total de itens (o hook já expõe `total`).
- Ações em lote **ausentes** na superfície de cards, em vez de renderizadas e permanentemente desabilitadas.
  **Como isso é obtido e verificado (achado DEP-03):** o produto **não tem estado de viewport** — tabela e cards coexistem no DOM e a troca é só `hidden md:block` / `md:hidden`; o botão "Excluir" de hoje está **fora** desses wrappers. Introduzir `matchMedia` ou um hook de breakpoint só para satisfazer um teste seria dependência e complexidade sem requisito. Portanto: as ações em lote passam a viver **dentro do wrapper da superfície de tabela**, e o critério é *"ocultas por CSS e fora da árvore de acessibilidade abaixo de `md`"*, verificado por **QA manual** (Task 28). O teste automatizado afirma só o verificável: que o controle está no ramo da tabela e não no dos cards.
- Barra contextual de seleção que substitui a zona de controle, com escopo nomeado ("3 selecionados nesta página").
- "Zerar página"/"Excluir página" numa região destrutiva rotulada, fora da hierarquia primária.
- **D-B:** a zona de controle usa o **mesmo container do shell**, para ficar alinhada ao header e à região de dados.

#### Comportamentos PRESERVAR
- PD-1 (seleção limpa ao buscar **e** ao filtrar), PD-2 (cada ação de linha abre o diálogo correspondente), PD-3 ("Baixa de Produtos" abre a lista; escolher um produto fecha a lista e abre a baixa), PD-4 ("Ver produtos" aplica `status=ATTN,OUT` e volta à página 1), PD-5 (ações em lote operam **exatamente** sobre os itens correntes), PD-6 (busca com debounce chega à API e reseta a página) — `ProductDashboard.characterization.test.tsx` (11).
- Seleção limpa ao paginar e `mutate` **antes** de `setPage` — `ProductDashboard.test.tsx` (F-04, F-08 — **já corrigidos, não replanejar**).

#### Comportamentos ALTERAR INTENCIONALMENTE
- Ações em lote deixam de existir na superfície de cards.
- Ordem visual paginação/lista.
- Novo caminho de filtro **e ordenação** no mobile.

#### Bugs que NÃO devem ser congelados
UF-07/UF-41, C-4, N-3.

#### Testes automatizados relevantes
`ProductDashboard.characterization.test.tsx` (PD-1..PD-6), `ProductDashboard.test.tsx`, `StatusFilterMenu.test.tsx` (SFM-2, SFM-4), `LowStockBanner.test.tsx`.
**Testes novos:** limpar filtro é alcançável sem depender da largura (jsdom não avalia media query, então o teste afirma **existência e ação**); a ordenação da sheet envia os mesmos `sortBy`/`sortDir` do desktop; as ações em lote pertencem ao ramo da tabela e não ao dos cards; **PD-2 ganha verificação de identidade** — acionar "Movimentar" e "Ver Histórico" no **segundo** produto abre o diálogo **daquele** produto (achado REV-05).

#### QA manual
**Obrigatório e central.** 320px, 375px, viewport baixo, transição em torno de 768px (inclusive a janela de desktop com barra de rolagem clássica, que cai em cards — falha segura, P-5): entrar no filtro pelo banner e **sair dele**; **ordenar e conferir que a ordem atravessa as páginas**; paginar; conferir que a paginação aparece depois da lista; confirmar ausência (não desabilitação) das ações em lote. Em 1440px e 1920px, conferir o alinhamento da zona de controle com o header e a tabela (D-B).

#### Critérios de aceite
- Em 375px é possível aplicar **e remover** filtro sem sair da tela.
- Ordenação disponível no mobile, com o mesmo contrato global do desktop.
- Nenhum controle permanentemente desabilitado visível.
- Paginação depois da lista, com total de itens.
- Zona de controle alinhada ao header e à região de dados.

#### Definição de pronto
Checklist completo verde + revisão de `accessibility-reviewer` + **primeira versão da tabela de paridade assinada** anexada ao PR.

#### Commit sugerido
`feat(products): dar paridade de filtro e ordenacao ao mobile`

---

### Task 17 — `MovementFormModal`: gramática de operação e declaração de intenção (D2/P-4)

#### Tipo
UX intencional + Migração estrutural

#### Objetivo
Eliminar o `<select>` pré-selecionado em `IN` e dar ao diálogo contexto, intenção explícita e preview.

#### Motivação
Hoje o tipo é um `<select>` com default `IN`, sem contexto do produto, sem preview e sem confirmação: **uma entrada lançada no lugar de uma saída não é detectada por nada e é permanente** (UF-21). É o maior risco de erro humano do sistema. O diálogo sequer sabe o nome do produto — recebe só `productId`.

#### Fontes/decisões atendidas
**D1** (cerimônia N1), **D2/P-4** (segmentado **sem opção default**, campos dependentes **inertes**), `design-direction.md` §4.2, `design-system.md` §12, §14.1; UF-20; UF-21.

#### Dependências
Tasks 1–9, **4 (obrigatória — é a rede desta task)** e **16 (obrigatória)**. T16, T17 e T19 alteram o **mesmo arquivo** (`ProductDashboard.tsx`, que guarda `movingProductId`/`historyProductId` e passa só `productId`). Ordem: **T16 → T17 → T19**, serializadas (§6.3).

#### Componentes e arquivos prováveis
`src/components/MovementFormModal.tsx` · `src/components/ProductDashboard.tsx` (troca de `movingProductId` por `movingProduct`)

#### Mudanças previstas
- **Contexto** no topo: nome, SKU, saldo atual e mínimo.
- **Intenção** por controle segmentado **sem opção pré-selecionada**; quantidade e demais campos **realmente inertes** até a escolha.
  **Semântica exigida (achado REV-08):** hoje é um `<select>` **nativo**, que entrega nome, estado e teclado de graça. Botões soltos perderiam tudo isso. O controle é implementado como **`radiogroup`** (com rótulo, itens `role="radio"` com `aria-checked`, navegação por setas, um único ponto de tabulação) — ou `<input type="radio">` estilizados. **Sem `aria-checked="true"` no estado inicial.**
- **Preview** `saldo atual → novo saldo` com delta assinado, usando o helper da Task 2.
- Título afirma a intenção; botão primário nomeia a consequência ("Registrar entrada de 12 un.").
- Toast de sucesso declara o **novo saldo**, lido da **resposta do backend**, nunca de cálculo sobre o snapshot da listagem (`staleTime` 15s). Se a resposta não trouxer o saldo, o toast declara quantidade e direção e **omite** o saldo em vez de inventá-lo.
- Rótulos sem parêntese técnico: "Entrada" / "Saída".
- Adoção de `ui/Input`/`ui/Select`, `useId()`, tokens, foco único; fim de `ring-brand` neste arquivo.
- **O impedimento de saída acima do saldo NÃO entra aqui** — é a Task 18 (D-F). O preview desta task, porém, **já não pode** representar saldo negativo como futuro plausível.

#### Comportamentos PRESERVAR
- MFM-1..MFM-6 da **Task 4** — payload `IN`/`OUT`, erro do servidor, valores preservados após falha, ausência de submissão duplicada, sucesso, contrato de diálogo.
- Data opcional convertida para ISO e o schema em pt-BR — `MovementFormModal.test.tsx` (os 6 testes existentes).
- PD-2: "Movimentar" abre este diálogo, **para o produto certo**.
- **Regra de negócio intocada:** o backend continua sendo a autoridade.

#### Comportamentos ALTERAR INTENCIONALMENTE
- **Não existe mais tipo pré-selecionado.** Os testes da Task 4 **não** congelam o default `IN`; os 6 testes de data podem precisar passar a escolher a intenção primeiro — ajuste declarado no mesmo commit.
- Novos campos de contexto e preview.
- O `<select>` nativo dá lugar a um `radiogroup`.

#### Bugs que NÃO devem ser congelados
UF-20, UF-21.

#### Testes automatizados relevantes
Task 4 (MFM-1..MFM-6), `MovementFormModal.test.tsx`, `ProductDashboard.characterization.test.tsx` (PD-2).
**Testes novos (requisito):** (a) ao abrir, **nenhuma** intenção está selecionada — nenhum `role="radio"` com `aria-checked="true"`; (b) sem intenção escolhida, a quantidade **não aceita entrada** e o envio é impossível — verificado por comportamento, não por atributo cosmético; (c) escolhida a intenção, o preview mostra o saldo resultante correto nos dois sentidos; (d) o `radiogroup` é operável por setas e tem nome acessível; (e) o diálogo abre com o produto **acionado**.

#### QA manual
375px e 1440px: o segmentado não pode parecer "já escolhido"; o preview precisa caber sem empurrar o rodapé para fora (viewport baixo).

#### Critérios de aceite
- É impossível submeter sem declarar a intenção.
- Campos dependentes inertes **de fato** (D2-B só funciona se a inércia for funcional, não estética — ressalva de `prototype.md` §13).
- Preview presente e correto nos dois sentidos.

#### Definição de pronto
Checklist completo verde + revisão de `accessibility-reviewer`.

#### Commit sugerido
`feat(movements): declarar a intencao antes da quantidade`

---

### Task 18 — Impedir saída manual acima do saldo (D-F)

#### Tipo
**UX intencional**

> Item próprio, com teste e critério de aceite, exatamente como F-01. **Não pode ser diluído** em "aplicar novo estilo ao formulário" nem em "migrar formulário para primitives".

#### Objetivo
Em **qualquer** fluxo de `OUT`, quantidade maior que o saldo disponível impede a confirmação, com feedback inline claro e acessível.

#### Motivação
F-01 decidiu que a interface deve **impedir** — e essa decisão foi tomada olhando a baixa rápida. **A movimentação manual tem exatamente o mesmo problema em outra tela**: `movementSchema` aceita `quantity: z.coerce.number().int().positive()` sem teto, para `IN` **e** para `OUT`. Uma saída de 500 num produto com saldo 30 é digitada, submetida, e só então recusada pelo backend com 422 — o erro do servidor é a primeira notícia de algo que a interface sabia desde a primeira tecla. Com o preview da Task 17 no lugar, deixar o impedimento de fora seria mostrar um resultado impossível e deixar a pessoa enviá-lo mesmo assim.

Duas saídas do mesmo sistema não podem ter regras diferentes sobre a mesma quantidade.

#### Fontes/decisões atendidas
**D-F (resolvida em 31/08/2026)**; **F-01** (`bugfix-gate.md` §3.3 e §7 G-3), do qual D-F é a extensão coerente; `design-direction.md` §4.2 ("o preview mostra resultados possíveis; o impossível é bloqueio, não destino"); `design-system.md` §17 (erro específico e persistente), §11.0 (erro assíncrono do servidor com `role="alert"`); regra de negócio de `current-state.md` (uma saída nunca pode deixar o saldo negativo).

#### Dependências
**Task 17** (mesmo arquivo; o contexto do produto e o preview vêm de lá) e **Task 4** (a rede). **T17 + T18 = entrega atômica**: dois commits, uma entrega. A migração do formulário **não é declarada pronta** com a Task 17 sozinha, porque isso deixaria em produção um formulário reescrito que ainda aceita o impossível.

#### Componentes e arquivos prováveis
`src/components/MovementFormModal.tsx` (schema e UI). **Nenhuma mudança de backend.**

#### Mudanças previstas
- Validação condicional ao tipo: quando a intenção é **`OUT`**, `quantity` não pode exceder o saldo disponível do produto. Quando é **`IN`**, **nada muda** — entrada não tem teto.
- **Quantidade igual ao saldo é permitida**, e resulta em saldo zero. O preview mostra `30 → 0`; "Estoque zerado" continua sendo um rótulo legítimo **para esse caso**.
- **Quantidade maior que o saldo é bloqueada**: confirmação indisponível enquanto inválido, e **a quantidade impossível nunca é representada apenas como "Estoque zerado"** — a mensagem diz que a quantidade excede o saldo disponível e informa qual é ele.
- Mensagem **inline, associada ao campo** por `aria-describedby`, com o campo em `aria-invalid` (§11.0 — sem `role="alert"` por campo).
- **Saldo que muda durante o preenchimento:** o backend continua sendo a autoridade final. Se outra pessoa der baixa enquanto o formulário está aberto, o envio pode voltar 422 mesmo com a validação de cliente satisfeita. Nesse caso: a **mensagem real do backend** é exibida (nunca um texto genérico), o diálogo **permanece aberto**, **o valor digitado é preservado** para correção, e o contexto/preview é reconciliado com o saldo real devolvido pelo erro quando ele estiver disponível.
- Nenhum caminho da UI produz saldo negativo.

#### Comportamentos PRESERVAR
- MFM-1 (payload `IN` **e** `OUT`), MFM-2 (falha preserva os valores digitados), MFM-3 (mensagem real do servidor), MFM-4 (sem submissão duplicada), MFM-5, MFM-6 — Task 4.
- O preview e o contexto introduzidos na Task 17.
- **Regra de negócio intocada:** a validação de saldo negativo permanece no `StockService`, dentro da transação com lock de linha. A UI **previne**; o backend **decide**.

#### Comportamentos ALTERAR INTENCIONALMENTE
- `OUT` passa a ter teto igual ao saldo disponível.
- A confirmação fica indisponível enquanto a quantidade for impossível.
- **Nenhum characterization test congela o comportamento atual** — a Task 4 é explicitamente proibida de afirmar o `max` livre em `OUT`.

#### Bugs que NÃO devem ser congelados
A ausência de limite em `OUT`; e o mesmo vício de vocabulário que F-01 corrige na baixa rápida (representar o impossível como "Estoque zerado").

#### Testes automatizados relevantes
Task 4 (MFM-1..MFM-6) e `MovementFormModal.test.tsx` como não-regressão.

**Testes novos — escritos RED, antes da implementação (regra de TDD do `AGENTS.md`):**
1. **RED principal** — `OUT` com quantidade = saldo + 1: a confirmação fica **indisponível**, **a API não é chamada**, e a mensagem de impedimento é **visível e associada ao campo** (`aria-describedby` + `aria-invalid`).
2. **`IN` não é afetado** — `IN` com quantidade muito acima do saldo continua submetendo normalmente.
3. **Limite inclusivo** — `OUT` com quantidade **igual** ao saldo: confirmação **disponível**, preview mostra **zero**, envio ocorre.
4. **Saldo muda durante o preenchimento** — quantidade válida no cliente, backend devolve 422: a **mensagem real** aparece, o diálogo continua aberto e **o valor digitado é preservado**.
5. **Nunca negativo** — nenhum caminho da UI (digitação, colar, seta do `number`) produz preview ou payload que resulte em saldo negativo.
6. **Vocabulário** — com quantidade impossível, a tela **não** comunica apenas "Estoque zerado".

#### QA manual
375px e 1440px: digitar acima do saldo e confirmar que o impedimento aparece **sem** precisar submeter; que a mensagem não some sozinha; e que corrigir a quantidade reabilita a confirmação sem perder o resto do formulário. Percorrer o campo e a mensagem com leitor de tela.

#### Critérios de aceite
- **É impossível submeter uma saída manual maior que o saldo.**
- `IN` permanece sem teto.
- Quantidade igual ao saldo é permitida e resulta em zero.
- O impedimento tem explicação inline, acessível, no momento em que ocorre.
- O 422 do backend continua tratado, com valor preservado.
- Nunca se representa a quantidade impossível apenas como "Estoque zerado".

#### Definição de pronto
Checklist completo verde + revisão de `accessibility-reviewer` (mensagem associada e anunciada) e de `security-reviewer` (a regra de saldo **continua no backend**; a UI não vira a autoridade).

#### Commit sugerido
`feat(movements): impedir saida manual acima do saldo`

---

### Task 19 — `MovementHistoryModal`: primitivo + gramática de extrato (D6)

#### Tipo
Migração estrutural + UX intencional

#### Objetivo
Trocar o Radix cru pelo primitivo e transformar a tabela num extrato que responde "por que o estoque caiu?" por leitura.

#### Motivação
`previousQuantity`/`newQuantity` **já chegam no payload de toda movimentação** e são descartados fora de `ADJUSTMENT` (UF-33). `INITIAL_STOCK` **vaza cru, em inglês** (UF-34) e não é oferecido no filtro, embora o backend o aceite (F-09). A data usa `toLocaleString()` **sem locale** (M-13). O título não nomeia o produto (UF-35). O diálogo não tem `max-height`.

#### Fontes/decisões atendidas
**D6**; `design-system.md` §14.1, §14.2 (incl. `sr-only` na seta — paga a dívida **A5**), §14.3 (saldo ancorado — decisão 4); UF-33; UF-34; UF-35; F-09; M-13; M-7; P-3.

#### Dependências
Tasks 1–9, 2, **16 e 17** (mesmo arquivo `ProductDashboard.tsx`; ordem **T16 → T17 → T19**).

#### Componentes e arquivos prováveis
`src/components/MovementHistoryModal.tsx` · `src/components/ProductDashboard.tsx`

#### Mudanças previstas
- `ui/Modal` (ganha `max-h`, rolagem, `headerActions`, botão de fechar padronizado); remover `animate-fade-in`.
- Título nomeia o produto (UF-35).
- **Saldo atual ancorado no cabeçalho, imune ao filtro**, com o texto que declara essa diferença — **requisito novo**.
  **Fonte do número (achado REV-06):** o saldo **não** vem do snapshot da listagem (`staleTime` 15s). O cabeçalho consulta `fetchProduct(productId)` — que já existe em `api/products.ts` — via React Query ao abrir. Alternativa aceitável: **rotular** o valor como "saldo na abertura". Nunca chamá-lo de atual sem sê-lo.
- `antes → depois` + delta assinado nos **quatro** tipos, com `sr-only` "de 120 para 132"; `Estoque inicial` mostra `—` como saldo anterior.
  **Degradação obrigatória para registros legados (achado REV-11):** hoje o fallback existe **só para `ADJUSTMENT`**. Estender aos quatro tipos os expõe a linhas legadas sem esses campos — e elas existem: o `seed.ts` grava direto via Prisma, sem `previousQuantity`/`newQuantity`/`userId`. A degradação para quantidade crua com nota passa a valer para os quatro. **Nunca renderizar `undefined`, transição inventada, nem zero fictício.**
- Vocabulário traduzido; `INITIAL_STOCK` incluído no filtro de tipo.
- Datas com locale explícito pt-BR; números pelo helper da Task 2.
- Estados de carregando/vazio/erro anunciados.
- **Ordenação:** este diálogo **não expõe controle de ordenação** hoje e **continua sem expor** — a ordem é a da rota (`date desc`). Nada a corrigir por D-A, e nada a inventar aqui.

#### Comportamentos PRESERVAR
- `ADJUSTMENT` completo; **degradação de registro legado** (comportamento **correto e deliberado**); "Usuário não disponível"; filtro repassado à API — `MovementHistoryModal.test.tsx` (6).
- MHM-1 (de/até resetam a página) · MHM-2 (busca por observação) · MHM-3 (itens por página 10/20/50) · MHM-4 (**diálogo se anuncia, Escape fecha, foco entra**) · MHM-5 (paginação bloqueada nos limites) · MHM-6 (carregando, erro e vazio comunicados) — `MovementHistoryModal.characterization.test.tsx` (10).

> MHM-4 é o teste que garante que **migrar do Radix cru para o primitivo não regride acessibilidade** — este componente já é acessível hoje.

#### Comportamentos ALTERAR INTENCIONALMENTE
- Título passa a nomear o produto.
- `antes → depois` deixa de ser exclusivo de `ADJUSTMENT`.
- Vocabulário dos quatro tipos.

#### Bugs que NÃO devem ser congelados
UF-34, F-09, M-13, estados sem `role`, M-7.

#### Testes automatizados relevantes
`MovementHistoryModal.test.tsx`, `MovementHistoryModal.characterization.test.tsx` (MHM-1..MHM-6), `Modal.test.tsx`.
**Testes novos:** os quatro tipos exibem `antes → depois`; **`IN`, `OUT` e `INITIAL_STOCK` sem `previous`/`new` degradam para quantidade crua**, sem `undefined`, transição inventada ou zero fictício; nenhum enum cru renderizado; o filtro oferece os quatro tipos; a data é legível em pt-BR independentemente do fuso; o saldo do cabeçalho **não muda** ao aplicar filtro; o histórico abre para o produto **acionado**.

#### QA manual
**Obrigatório.** Viewport baixo: cabeçalho com o saldo, corpo rolando, rodapé alcançável. 375px: extrato legível sem clipping.

#### Critérios de aceite
- Nenhum enum de banco visível na tela.
- Saldo do cabeçalho imune ao filtro, e a interface **diz** isso.
- Os 16 testes existentes deste componente passam.

#### Definição de pronto
Checklist completo verde + revisão de `accessibility-reviewer`.

#### Commit sugerido
`refactor(movements): transformar o historico em extrato auditavel`

---

### Task 20 — `QuickOutModal` → primitivo `Modal`

#### Tipo
Migração estrutural

#### Objetivo
Trocar o `createPortal` manual pelo primitivo único, sem perder nenhum dos comportamentos do contrato §9.3.

#### Motivação
O componente **não tem `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, retorno de foco nem bloqueio de scroll**; e implementa à mão um listener de teclado **global no `window`**, que intercepta Enter da página inteira. Ao mesmo tempo, contém a melhor ideia de interação do produto — o preview vivo. A ideia sobrevive; a embalagem, não.

#### Fontes/decisões atendidas
C-1; `design-system.md` §12, §18; `user-flows.md` §9.3 itens 1–10; D1; `design-direction.md` §4.2; M-1; M-2; A-13.

#### Dependências
Tasks 1–9.

#### Componentes e arquivos prováveis
`src/components/QuickOutModal.tsx`

#### Mudanças previstas
- Usar `ui/Modal`; **remover** `createPortal`, `z-[10000]`, gradiente, `rounded-2xl`, `shadow-2xl` e os `text-[18px]`.
- **Remover o listener global de `window`**: Escape e o trap vêm do Radix; Enter passa a ser submissão nativa do `<form>`.
- Grade dos cinco atalhos com alvos ≥ 44×44 em 320–375px.
- Rótulo associado ao campo de quantidade (se não vier da Task 6); preview e erro **anunciados** e associados por `aria-describedby` (A-14ʳ).
- **Foco inicial declarado (achado REV-14):** ao abrir, o foco vai para o **campo de quantidade**. Sem isso o Radix pode focar o "Fechar" (que precede o corpo), e um teste que só exija "foco dentro do diálogo" passaria sem melhorar nada.
- Toast de sucesso declara o **novo saldo**, lido de **`newBalance` na resposta da API** (`api/quickOut.ts` já o expõe), nunca de cálculo sobre cache.
- Remover a ajuda "Máx. 255 caracteres", não validada em lugar nenhum (N-1).
- Tokens e foco único.

#### Comportamentos PRESERVAR
Todos os 12 casos de `QuickOutModal.characterization.test.tsx` (15 testes): QOM-1 Escape fecha · QOM-2 Enter submete uma única vez · QOM-3 Enter no textarea **não** submete · QOM-4 Enter durante o envio **não** duplica a baixa · QOM-5 interagir fora fecha, dentro não · QOM-6 atalhos 1·5·10·25·50 com `aria-pressed` · QOM-7 preview recalculado a cada tecla · QOM-8 primária desabilitada com quantidade ≤ 0 · QOM-9 **payload com `productId`, `quantity` e `note`** · QOM-10 sucesso fecha, dispara `onSuccess` e anuncia a quantidade · QOM-11 falha mantém o diálogo aberto com os valores digitados · QOM-12 "Cancelar" fecha sem chamar a API.
Mais `QuickOutModal.test.tsx` (5): mensagem real da API (F-07) e erro renderizado **uma única vez** (C-3).

#### Comportamentos ALTERAR INTENCIONALMENTE
- Ganha semântica de diálogo, focus trap e retorno de foco.
- Ordem de foco muda (consequência do trap) — melhoria declarada.
- Layout legado descartado.
- **F-01 não entra aqui** — é a Task 21, pelo motivo já registrado: a mudança de produto precisa de item próprio. **Mas T20 e T21 formam uma unidade atômica de entrega**: a migração não é declarada pronta com T20 sozinha, porque deixaria o `max = saldo × 2` sobre um componente já reescrito.

#### Bugs que NÃO devem ser congelados
C-1, listener global de teclado, nenhum campo focado ao abrir (**não escrever teste que exija ausência de autofoco**), N-1, N-4, A-14ʳ, A-13.
**Não reintroduzir:** os nove `console.log` (C-2) nem o bloco de erro duplicado (C-3), ambos já corrigidos.

#### Testes automatizados relevantes
`QuickOutModal.characterization.test.tsx`, `QuickOutModal.test.tsx`, `Modal.test.tsx` (contrato-alvo).
**Testes novos:** o diálogo se anuncia como tal; o foco entra **no campo de quantidade** e retorna ao gatilho; o toast declara o saldo **vindo da resposta da API** — o mock precisa devolver `newBalance` realista, e não o `{}` de hoje.

#### QA manual
**Obrigatório.** 320px e 375px: grade dos cinco atalhos sem quebra, alvos de 44px; viewport baixo com teclado virtual: rodapé alcançável, corpo rolando.

#### Critérios de aceite
- Os 20 testes existentes deste componente passam.
- Zero `createPortal` no arquivo.
- O diálogo cumpre o contrato de `Modal.test.tsx`.

#### Definição de pronto
Checklist completo verde + revisão de `accessibility-reviewer`.

#### Commit sugerido
`refactor(quick-out): migrar o modal de baixa para o primitivo acessivel`

---

### Task 21 — F-01: impedir baixa rápida maior que o saldo disponível

#### Tipo
UX intencional

#### Objetivo
Na baixa rápida, a quantidade não pode ultrapassar o saldo disponível — impedimento com feedback claro, nunca uma quantidade impossível representada como "Estoque zerado".

#### Motivação
Hoje o `max` do campo permite **o dobro do saldo**, e o ramo "Estoque negativo" é **código morto** (`Math.max(0, …)`): o que a pessoa vê ao exceder é `0` com "Estoque zerado", **sem nenhum sinal de que a quantidade é impossível**. O backend recusa com 422 — e esse 422 é a primeira notícia.

#### Fontes/decisões atendidas
**F-01 — decidido em 29/08/2026** (`bugfix-gate.md` §3.3 e §7 G-3; `characterization-plan.md` §2 e §15); `design-direction.md` §4.2; N-4; `design-system.md` §17. **Simétrica à Task 18 (D-F)**, que aplica a mesma regra à saída manual.

#### Dependências
Task 20 (mesmo arquivo, imediatamente depois). **T20 + T21 = entrega atômica.**

#### Componentes e arquivos prováveis
`src/components/QuickOutModal.tsx`

#### Mudanças previstas
- `max` do campo = **saldo disponível** (fim do `saldo × 2`).
- Confirmação **desabilitada** quando `quantidade > saldo`, com mensagem explicando o impedimento no momento em que ele ocorre.
- Vocabulário do preview revisto: nunca representar a quantidade impossível apenas como "Estoque zerado". "Estoque zerado" continua legítimo quando a saída **é** igual ao saldo.
- Remover o ramo morto "Estoque negativo".
- **A regra do backend não muda.**

#### Comportamentos PRESERVAR
- QOM-7, QOM-8, QOM-9, QOM-11 — `QuickOutModal.characterization.test.tsx`.
- Mensagem real da API quando o 422 ainda ocorrer (corrida entre duas baixas) — `QuickOutModal.test.tsx` (F-07).

#### Comportamentos ALTERAR INTENCIONALMENTE
- `max = saldo × 2` → `max = saldo`.
- Rótulos do preview. **Nenhum characterization test congela o comportamento atual.**

#### Bugs que NÃO devem ser congelados
N-4 (ramo morto).

#### Testes automatizados relevantes
Os 20 testes do componente como não-regressão.
**Testes novos (requisito):** (a) com quantidade > saldo, a confirmação fica indisponível **e** a API não é chamada; (b) a razão do impedimento é comunicada; (c) com quantidade = saldo, a confirmação continua disponível e o preview mostra zero; (d) nenhum caminho produz saldo negativo.

#### QA manual
375px e 1440px: digitar acima do saldo e confirmar o impedimento **sem** submeter; a mensagem não some sozinha.

#### Critérios de aceite
- É impossível submeter uma baixa maior que o saldo.
- O impedimento tem explicação no momento em que ocorre.
- Nunca se representa a quantidade impossível apenas como "Estoque zerado".

#### Definição de pronto
Checklist completo verde + revisão de `accessibility-reviewer` e de `security-reviewer` (a regra de saldo continua no backend).

#### Commit sugerido
`feat(quick-out): impedir saida maior que o saldo disponivel`

---

### Task 22 — `QuickOutListModal` → `Modal` + React Query

#### Tipo
Migração estrutural

#### Objetivo
Migrar o segundo `createPortal` manual para o primitivo e substituir o `fetch` em `useEffect` por React Query.

#### Motivação
Além da ausência total de semântica de diálogo, este componente tem `if (!open) return null` **antes de oito hooks** (A-12), `fetch` manual **sem cancelamento** (F-02), falha de consulta **silenciosa** (`try/finally` sem `catch` — erro de API vira "Nenhum produto disponível", N-6), tabela **clipada sem rolagem no mobile** (UF-29), `colSpan={4}` numa tabela de 5 colunas (N-2), busca **sem label** (B-7), linha **inalcançável por teclado** e dois badges contraditórios quando `balance=0, minStock=0` (N-5).

#### Fontes/decisões atendidas
C-1; A-12; F-02; N-2; N-5; N-6; B-7; UF-29; M-5; `design-system.md` §18; `user-flows.md` §9.3 itens 11–17; regra do `CLAUDE.md` (dado remoto sempre via React Query).

#### Dependências
Tasks 1–9, 20, **e 3** (os controles de ordenação daqui já enviam parâmetros globais desde a Task 3; esta task não altera a semântica da ordenação, só o invólucro).

#### Componentes e arquivos prováveis
`src/components/QuickOutListModal.tsx` · `packages/frontend/test/QuickOutListModal.test.tsx` (harness)

#### Mudanças previstas
- **Troca do harness de teste, antes de tudo (achado DEP-02).** `QuickOutListModal.test.tsx` usa `render` puro — **não há `QueryClientProvider`** (ele só existe em `test/helpers/render.tsx`). No instante em que o componente usar `useQuery`, os **14 testes quebram em bloco**. O primeiro passo é migrar o arquivo para `renderWithProviders`, **com o produto ainda inalterado** e a suíte verde; só então migrar o componente.
- `ui/Modal`; hooks **antes** de qualquer retorno (A-12 desaparece por construção); Escape passa a fechar.
- `useQuery` com chave por termo/página/ordenação — cancelamento e estado de erro de graça.
- **Estado de erro visível e distinto de resultado vazio** (N-6).
- Linha selecionável por teclado (mantendo o alvo grande do clique).
- `overflow-x-auto` na região da tabela (UF-29); `colSpan` correto (N-2).
- Busca com rótulo (B-7); setas `▲` com `aria-hidden` (M-5).
- Status derivado de `productStatus()` — elimina a segunda implementação divergente (N-5).
- **Empilhamento — apenas a preparação.** Esta task mantém a lista montada quando o histórico abre (QOL-9). **O critério completo de empilhamento e foco pertence à Task 23** (achado ORD-01): aqui o histórico ainda é um `createPortal` sem focus trap, e um teste de foco falharia por um motivo que só a Task 23 resolve.

#### Comportamentos PRESERVAR
QOL-1 (busca recebe foco ao abrir — testar **que tem foco**, não que tem `autoFocus`) · QOL-2 · QOL-3 (acionar a linha seleciona o produto) · QOL-4 (ordenar alterna a direção na consulta) · QOL-5 (ordenar volta à página 1) · QOL-6 (nome, SKU, saldo, **mínimo** e status) · QOL-7 · QOL-8 · QOL-9 (**histórico abre sem fechar a lista**) · QOL-10 — `QuickOutListModal.test.tsx` (14).

#### Comportamentos ALTERAR INTENCIONALMENTE
- **Escape passa a fechar.**
- A forma do empilhamento (QOL-9 protege a **capacidade**; a forma é decidida na Task 23).

#### Bugs que NÃO devem ser congelados
A-12, F-02, N-2, N-5, N-6, B-7, UF-29, M-5, linha inalcançável por teclado, C-1.

#### Testes automatizados relevantes
`QuickOutListModal.test.tsx` (QOL-1..QOL-10, após a troca de harness), `Modal.test.tsx`, `productStatus.test.ts` (PS-1 cobre o limite que hoje diverge).
**Testes novos:** Escape fecha; a linha é acionável por teclado; falha de consulta é comunicada e **não** se confunde com lista vazia.

#### QA manual
**Obrigatório.** 375px: as cinco colunas alcançáveis por rolagem horizontal, sem clipping. Viewport baixo: corpo rolando, rodapé alcançável.

#### Critérios de aceite
- Zero `createPortal` **neste arquivo**; hooks incondicionais.
- Erro de API distinguível de resultado vazio.
- Os 14 testes existentes passam, agora sobre `renderWithProviders`.

#### Definição de pronto
Checklist completo verde + revisão de `accessibility-reviewer`.

#### Commit sugerido
`refactor(quick-out): migrar a lista de baixa para o primitivo e React Query`

---

### Task 23 — `QuickOutHistoryModal` → `Modal` + React Query

#### Tipo
Migração estrutural

#### Objetivo
Terceiro e último `createPortal` manual; e a decisão de empilhamento, agora que os dois lados são diálogos de verdade.

#### Motivação
Mesmo diagnóstico da Task 22: `fetch` manual sem cancelamento (F-02), falha silenciosa (N-6), o mesmo clipping do UF-29 (N-7), busca e datas sem rótulo (N-8), `text-gray-400` a 2,5:1 no separador "até" (M-4).

> **F-03 já foi resolvida na Task 3.** A ordenação deste histórico é global e server-side desde lá; esta task **não** reintroduz ordenação local nem remove capacidade. É a diferença entre o plano de antes de D-A — que recomendava tirar os controles — e o de agora.

#### Fontes/decisões atendidas
C-1; F-02; N-6; N-7; N-8; M-4; **N-9 — PRESERVAR**; **D-A** (já aplicada na Task 3); `design-system.md` §18; `user-flows.md` §9.3 itens 18–20.

#### Dependências
Tasks 1–9, **3**, 22.

#### Componentes e arquivos prováveis
`src/components/QuickOutHistoryModal.tsx` · `packages/frontend/test/QuickOutHistoryModal.test.tsx` (harness)

#### Mudanças previstas
- **Troca do harness antes da migração**, pelo mesmo motivo da Task 22: os 11 testes usam `render` puro. **Cuidado específico com QOH-8** (N-9): ele fecha e reabre o diálogo para provar que o recorte sobrevive — o `rerender` precisa manter **a mesma instância de `QueryClient`**, senão o teste passa a medir o cache, não o estado do componente.
- `ui/Modal`; Escape passa a fechar; `useQuery` com a chave incluindo `sortBy`/`sortDir` (contrato da Task 3).
- Estado de erro visível e distinto de vazio (N-6); `overflow-x-auto` (N-7); rótulos em busca e datas (N-8); separador "até" com contraste adequado (M-4).
- Vocabulário e formatação numérica pelo helper da Task 2.
- **Empilhamento lista→histórico, decidido aqui (achados ORD-01 e REV-15):** com os dois já migrados, o histórico abre **por cima** da lista, que permanece montada e **inerte** — um único diálogo exposto à tecnologia assistiva por vez, um único focus trap ativo, e o foco retornando ao gatilho **dentro da lista** ao fechar. É o oposto do que aconteceria por omissão: `ProductDashboard.tsx` mantém dois estados `open` irmãos, e migrar os dois sem decidir produziria **dois `aria-modal` ativos, dois traps e dois retornos de foco concorrentes** — exatamente o que a ressalva de QOL-9 antecipou.

#### Comportamentos PRESERVAR
QOH-1 (busca reseta a página) · QOH-2 (datas resetam a página) · QOH-3 (contador e navegação) · QOH-4 (produto, SKU, quantidade, data e observação legíveis) · QOH-5 (data em formato brasileiro — asserir dia/mês/ano, nunca a string inteira) · QOH-6 (ausência de observação comunicada) · QOH-7 · **QOH-8 (N-9: busca, página e datas continuam aplicadas ao reabrir)** — `QuickOutHistoryModal.test.tsx` (11).

#### Comportamentos ALTERAR INTENCIONALMENTE
Escape passa a fechar.

#### Bugs que NÃO devem ser congelados
F-02, N-6, N-7, N-8, M-4, C-1.

#### Testes automatizados relevantes
`QuickOutHistoryModal.test.tsx` (QOH-1..QOH-8, após a troca de harness), `QuickOutListModal.test.tsx` (QOL-9), `Modal.test.tsx`.
**Testes novos:** Escape fecha; falha de consulta comunicada; **apenas um diálogo exposto e com foco preso enquanto o histórico está aberto, com o foco retornando ao gatilho dentro da lista ao fechá-lo** (movido da Task 22).

#### QA manual
**Obrigatório.** 375px: colunas alcançáveis; campos de data utilizáveis; sem clipping. Reabrir o histórico e confirmar que o recorte anterior continua aplicado (N-9). **Empilhamento lista→histórico percorrido só com teclado**, ida e volta.

#### Critérios de aceite
- Zero `createPortal` em todo o `src/` (esta é a terceira e última remoção).
- QOH-8 verde — nenhuma reinicialização de estado introduzida pela migração.
- Com o histórico aberto, **um** `aria-modal` ativo, **um** focus trap.

#### Definição de pronto
Checklist completo verde + revisão de `accessibility-reviewer`.

#### Commit sugerido
`refactor(quick-out): migrar o historico de baixas para o primitivo e React Query`

---

### Task 24 — `ProductFormModal`: adoção dos primitivos

#### Tipo
UX intencional + Acessibilidade

> **Reclassificada após o review (REV-17):** a task corrige F-10 — o `serverError` que sobrevive ao fechar e reabrir — e isso é **mudança de comportamento**, não aparência.

#### Objetivo
Parar de reescrever label + input + erro à mão no formulário mais usado do sistema.

#### Motivação
O modal usa `id="name"`, `id="sku"`, `id="minStock"`, `id="description"` — o `CLAUDE.md` exige `useId()` — e **não usa `ui/Input`**, reescrevendo tudo com classes ligeiramente diferentes. É a origem de 5 dos 11 usos do token `brand`.

#### Fontes/decisões atendidas
A-9; `design-system.md` §11, §18; A6; regra de `useId()` do `CLAUDE.md`; F-10.

#### Dependências
Tasks 1, 5, 6, 9.

#### Componentes e arquivos prováveis
`src/components/ProductFormModal.tsx` · **`src/components/ui/Textarea.tsx` (novo)** · **`test/Textarea.test.tsx` (novo)** · `test/ProductFormModal.test.tsx`

> **Escopo de arquivos ampliado em 03/09/2026 por SD-3 (§9.3.2).** O rascunho listava só o
> `ProductFormModal.tsx`. O campo Descrição é um `<textarea>` e **não existe primitivo `ui/Textarea`
> no projeto** — o "textarea equivalente" das Mudanças previstas passa a ser um primitivo próprio,
> criado nesta task e consumido **apenas aqui**. Nenhum outro arquivo de produção é tocado.

#### Mudanças previstas
- Substituir os campos manuais por `ui/Input` / `ui/Textarea` (SD-3, §9.3.2), com `useId()`.
- Foco único; tokens; fim de `ring-brand`/`border-brand` neste arquivo.
- **F-10:** limpar `serverError` no efeito de abertura.
- **F-05 não é decidida aqui:** a exibição em maiúsculas do SKU (`uppercase` por CSS) fica **exatamente como está**, e a política de dado segue pendente (§9, D-C). Nada nesta task depende dela.

#### Comportamentos PRESERVAR
- Abrir em `edit` com os campos preenchidos, trocar de produto trazendo os valores do novo, e preservar a edição enviando os valores do produto certo (**F-06, já corrigido — não replanejar**) — `ProductFormModal.test.tsx` (3).
- PD-2 ("Adicionar Produto" abre o formulário).

> **Lacuna de cobertura declarada (achado REV-17).** Os 3 testes existentes cobrem **apenas** o carregamento em modo edição. **Criação, validação e erro do servidor não têm teste** — o rascunho anterior afirmava que tinham. Como esta task substitui todos os campos pelos primitivos, esses três caminhos são escritos **junto** com a mudança, e não presumidos protegidos.

#### Comportamentos ALTERAR INTENCIONALMENTE
Ids passam a ser gerados. **Os testes localizam campos por label, não por id** (verificado), então nada quebra por isso.

#### Bugs que NÃO devem ser congelados
A-9, F-10.

#### Testes automatizados relevantes
`ProductFormModal.test.tsx` (3), `ProductDashboard.characterization.test.tsx` (PD-2).
**Testes novos:** criação envia o payload correto; validação bloqueia obrigatórios vazios com mensagem associada ao campo; erro do servidor chega ao usuário; **reabrir após uma falha não mostra o erro anterior** (F-10).

#### QA manual
375px: formulário completo utilizável, rodapé alcançável com teclado virtual.

#### Critérios de aceite
- Nenhum `id` hardcoded.
- Nenhum campo escrito à mão.
- Zero `brand` no arquivo.

#### Definição de pronto
Checklist completo verde.

#### Commit sugerido
`refactor(products): adotar os primitivos de formulario no cadastro`

---

### Task 25 — `AdjustmentFormModal`: tokens e dívidas A1/A4

#### Tipo
Acessibilidade + Visual

#### Objetivo
Alinhar aos tokens **sem redesenhar** — a estrutura é a referência de qualidade, não o alvo — e pagar duas dívidas registradas.

#### Motivação
É o fluxo mais maduro do produto. Ficaram registradas as dívidas **A1** (foco não gerenciado na troca entre `form`/`confirm`/`conflict`) e **A4** (a região `aria-live` do preview é montada junto com o conteúdo, deixando de anunciar no fluxo pós-conflito).

#### Fontes/decisões atendidas
`design-system.md` §18 ("a estrutura é referência, não alvo"); dívidas **A1**, **A4**, **A5**, **A6** de `docs/features/ajuste-estoque/review.md`; D1 (cerimônia N2 mantida).

#### Dependências
Tasks 1, 5, 6, 7, 9. (A6 foi paga na Task 6; A5 é compartilhada com a Task 19.)

#### Componentes e arquivos prováveis
`src/components/AdjustmentFormModal.tsx`

#### Mudanças previstas
- Tokens, foco único, `radius`, fim de `ring-brand`.
- **A1:** mover o foco deliberadamente a cada troca de passo.
- **A4:** live region **sempre montada**, atualizando o conteúdo.
- **A5:** `sr-only` na seta `→`, coerente com a Task 19.
- **A cerimônia N2 (dois passos) permanece.**

#### Comportamentos PRESERVAR
Os 24 testes de `AdjustmentFormModal.test.tsx`: fluxo completo, preview de diferença, confirmação estruturada, conflito 409, motivo obrigatório.

#### Comportamentos ALTERAR INTENCIONALMENTE
Nenhum comportamento de fluxo. Só foco, anúncio e tokens.

#### Bugs que NÃO devem ser congelados
A1, A4, A5.

#### Testes automatizados relevantes
`AdjustmentFormModal.test.tsx` (24), `Modal.test.tsx`.
**Testes novos:** o foco vai para o passo recém-exibido; o preview é anunciado também no fluxo pós-conflito.

#### QA manual
Percorrer o fluxo inteiro só com teclado + leitor de tela, incluindo o caminho de conflito.

#### Critérios de aceite
- Os 24 testes passam sem alteração.
- Nenhuma troca de passo deixa o foco no `<body>`.

#### Definição de pronto
Checklist completo verde + revisão de `accessibility-reviewer`.

#### Commit sugerido
`refactor(adjustments): alinhar o ajuste aos tokens e pagar dividas de foco`

---

### Task 26 — Remover código morto

#### Tipo
Cleanup

#### Objetivo
Apagar `FinanceDashboard.tsx` e `SalesDashboard.tsx`.

#### Motivação
Zero imports, confirmado na Fase 1 e **reconfirmado** por busca em `src/`. `frontend.md` exige confirmação explícita antes de apagar; ela foi dada (G-4).

#### Fontes/decisões atendidas
B-5; `design-system.md` §18 (DEPRECAR); `bugfix-gate.md` §7 G-4; backlog do `CLAUDE.md`/`AGENTS.md`.

#### Dependências
Nenhuma. **Pode rodar em qualquer momento** — junto com as Tasks 2, 3 e 4, é independente da camada visual.

#### Componentes e arquivos prováveis
`src/components/FinanceDashboard.tsx` · `src/components/SalesDashboard.tsx`

#### Mudanças previstas
Remoção dos dois arquivos. **Nada mais no mesmo commit.**

#### Comportamentos PRESERVAR
Todos. Nenhum comportamento depende destes arquivos.

#### Comportamentos ALTERAR INTENCIONALMENTE
Nenhum.

#### Bugs que NÃO devem ser congelados
Nenhum.

#### Testes automatizados relevantes
A suíte completa como não-regressão. `build` e `typecheck` são a prova de que nada os importava.

#### QA manual
Nenhum.

#### Critérios de aceite
- Busca por `FinanceDashboard` e `SalesDashboard` em `src/` e `test/` retorna **zero** ocorrências antes da remoção (reconfirmar na execução).
- `pnpm -r run build` verde.

#### Definição de pronto
Checklist completo verde.

#### Commit sugerido
`chore(frontend): remover dashboards sem uso`

---

### Task 27 — Enforcement: deprecar tokens legados e ligar a regra de lint

#### Tipo
QA/Gate

#### Objetivo
Remover o que sobrou do vocabulário antigo e transformar o sistema em algo que **não se consegue mais violar sem falhar o CI**.

#### Motivação
`theme.extend` adiciona, não proíbe. Override não é enforcement — apenas apaga o estilo em silêncio. O único mecanismo que falha o CI é uma regra de lint, e ela só pode ligar **depois** que os ~100 usos legados tiverem sido removidos pelas Tasks 5–25.

#### Fontes/decisões atendidas
**A3** (reescrita após o review da Fase 5); `design-system.md` §19.1, §21; §18 (DEPRECAR `brand`, `animate-fade-in`, `rounded-full`, gradientes, `shadow-2xl/xl`, `select-none` em células).

#### Dependências
**Todas as Tasks 5–25.** Remover o token `brand` exige as Tasks 17, 19, 24 e 25 (os únicos 4 arquivos que o usam).

#### Componentes e arquivos prováveis
`tailwind.config.js` · `eslint.config.js` · **e nada mais, por desenho**

> **Escopo apertado (achado REV-21).** Permitir "resíduos pontuais em qualquer arquivo" transformaria o gate numa **segunda migração transversal**, duplicando o trabalho das tasks donas. **Cada task zera os utilitários banidos dos arquivos que toca**, e isso é critério de aceite dela. A Task 27 apenas (a) remove os tokens legados do config, (b) adiciona a regra de lint e (c) **falha com lista nominal** se encontrar resíduo — que volta para a task dona.

#### Mudanças previstas
- Remover `colors.brand` do `tailwind.config.js`; remover `animate-fade-in` (usada 1×, **nunca definida**).
- Remover o peso 700 da Inter no `index.html` — **só se** os 3 usos de `font-bold` já tiverem saído (Tasks 10 e 20). Verificar antes.
- Adicionar ao `eslint.config.js` uma regra `no-restricted-syntax` sobre literais de `className` em JSX, com lista fechada: `rounded-full`, `rounded-2xl`, `rounded-xl`, `rounded-lg`, `shadow-2xl`, `shadow-xl`, `shadow-md`, `shadow-sm`, `text-3xl`, `text-4xl`, `text-xl`, `text-\[\d+px\]`, `ring-indigo-*`, `ring-brand`, `ring-blue-*`, `text-gray-400`, `border-gray-300`, `bg-gradient-*`, `animate-fade-in` — cada uma com mensagem apontando o token correto. **Regra nativa do ESLint: nenhuma dependência nova.**
- Varredura final: **zero** variantes de anel de foco além de `focus`.

#### Comportamentos PRESERVAR
Todos. É mudança de configuração.

#### Comportamentos ALTERAR INTENCIONALMENTE
Nenhum comportamento de usuário. Muda o que o CI aceita.

#### Bugs que NÃO devem ser congelados
Não aplicável.

#### Testes automatizados relevantes
A suíte completa.
**Teste novo, versionado (achado REV-22):** validar a regra com uma violação temporária prova que ela funcionava **naquele minuto**; depois, uma regressão no seletor deixaria o lint verde sem ninguém notar. Entra um teste de configuração usando a **API do ESLint já instalada** (`RuleTester`/`Linter`), com um literal proibido (deve acusar) e um permitido (não deve). **Nenhuma dependência nova.**

#### QA manual
Varredura visual completa (desktop e mobile) depois de remover `brand` — última chance de um resíduo passar despercebido.

#### Critérios de aceite
- Introduzir `class="rounded-full"` em qualquer arquivo **falha o `pnpm -r run lint`**, e existe teste versionado provando isso.
- `grep -r "brand\|animate-fade-in" packages/frontend/src` retorna zero.
- Uma única semântica de foco em todo o `src/`.
- **A varredura não encontra resíduo.** Se encontrar, ele volta à task dona; se isso for inviável, a regra entra como `warn` com lista nominal e um commit seguinte a promove a `error` (§4.3).

#### Definição de pronto
Checklist completo verde, com o lint reprovando o vocabulário banido.

#### Commit sugerido
`chore(ui): proibir utilitarios fora do design system no lint`

---

### Task 28 — QA manual de paridade responsiva e tabela de paridade assinada (Q-1)

#### Tipo
QA/Gate

#### Objetivo
Verificar no navegador tudo que o jsdom não pode ver, e entregar a tabela de paridade **assinada**.

#### Motivação
`vitest + jsdom` não calcula layout, não aplica breakpoints do Tailwind e não tem viewport real. Clipping, transição em `md`, alvos de 44px, `max-height`, largura do shell e a grade de atalhos **não são detectáveis** pela stack de teste. **Q-1 decidiu: verificação manual, sem introduzir Playwright, Cypress, Selenium ou qualquer runner E2E novo.**

#### Fontes/decisões atendidas
**Q-1**; `characterization-plan.md` §11; `design-system.md` §15.1 (a tabela de paridade é **entregável assinado**), §15.2; **P-5**; **D-B** (§4.4); `design-direction.md` §4.4; A-13.

#### Dependências
Tasks 10–25.

#### Componentes e arquivos prováveis
Nenhum arquivo de `src/`. Entregável: a tabela de paridade preenchida.

#### Mudanças previstas
Nenhuma mudança de código, exceto correções pontuais que o QA revelar — cada uma em commit próprio, nunca dentro deste.

#### Comportamentos PRESERVAR
Toda a suíte permanece verde.

#### Comportamentos ALTERAR INTENCIONALMENTE
Nenhum.

#### Bugs que NÃO devem ser congelados
Não aplicável.

#### Testes automatizados relevantes
Nenhum novo. **Nenhum runner E2E é introduzido.**

#### QA manual
Cobertura mínima, contra §15.1 do Design System:
- **320px** (quando relevante), **375px**, **viewport baixo** (375×568), **transição em torno de `md`** (767/768/769 e uma janela de desktop com barra de rolagem clássica), **900px**, **1024px**, **1440px** e **1920px**.
- Verificar em cada um: clipping horizontal · rolagem · `max-height` dos diálogos · alvos ≈ 44×44 · grade dos cinco atalhos do `QuickOutModal` · paridade de capacidades desktop↔mobile.
- **Largura (D-B):** em 1024px e 1440px o shell usa o espaço disponível respeitando os gutters (16/24/32px); acima de 1536px o conteúdo centraliza; a região de dados acompanha o shell **sem `max-width` próprio**; header, toolbar e tabela **alinhados na mesma calha**; **nenhum scroll horizontal causado pelo container**; cards mobile usando a largura disponível.
- **Ordenação (D-A):** em cada superfície, ordenar e conferir que a **página 2 continua a sequência** da página 1 — a verificação que hoje falharia no histórico de baixas.
- Capacidades a conferir uma a uma: busca · filtro · **limpar filtros** · **ordenação** · saldo · estoque mínimo · status · movimentar · **baixa rápida** · histórico · ajustar · editar · paginação · ações destrutivas de item · ausência **declarada** das ações em lote no mobile · ausência **declarada** do Shift+clique (D-A).

#### Critérios de aceite
- **Zero capacidades ausentes** em 375, 600, 767, 768, 900, 1024, 1440 e 1920px, exceto as ausências assinadas na tabela.
- Zero scroll horizontal.
- Nenhum alvo de toque abaixo de 44×44 no mobile, nem abaixo de 24×24 em qualquer largura.
- Tabela de paridade assinada, com uma linha por ausência (incluindo Shift+clique e ações em lote no mobile).

#### Definição de pronto
Checklist completo verde + tabela de paridade anexada.

#### Commit sugerido
`test(ui): registrar a validacao manual de paridade responsiva`

---

### Task 29 — Review final de segurança e acessibilidade

#### Tipo
QA/Gate

#### Objetivo
Fechar a migração com as duas revisões que o `AGENTS.md` exige quando a mudança toca UI, dados ou rotas.

#### Motivação
A migração tocou toda a UI, três diálogos que não eram diálogos, a semântica de foco de todo o produto, **dois impedimentos de operação** (F-01 e D-F) e **duas rotas de leitura** (D-A).

#### Fontes/decisões atendidas
`AGENTS.md` / `CLAUDE.md` (regra de pronto); `design-system.md` §9, §11, §15.2, §17; risco aceito #7 de `docs/features/ajuste-estoque/review.md`.

#### Dependências
Tasks 1–28.

#### Componentes e arquivos prováveis
Nenhum. Entregável: documento de revisão.

#### Mudanças previstas
Nenhuma; achados viram tasks próprias.

#### Comportamentos PRESERVAR
Todos.

#### Comportamentos ALTERAR INTENCIONALMENTE
Nenhum.

#### Bugs que NÃO devem ser congelados
Não aplicável.

#### Testes automatizados relevantes
A suíte completa.

#### QA manual
Percurso completo por teclado e leitor de tela: tabela, card, os cinco diálogos, sheet, menus, toasts e banners.

#### Critérios de aceite
- Nenhum achado bloqueante em aberto.
- Confirmado que **nenhuma regra de negócio migrou para o frontend**: o backend continua sendo a autoridade sobre saldo negativo — F-01 e D-F são **prevenção** de UI, não substituição da regra.
- Confirmado que **os novos parâmetros de query da Task 3 são validados por whitelist** e não abrem caminho para entrada não validada.
- Confirmado que nenhum dado novo passou a ser exibido.

#### Definição de pronto
Checklist completo verde + as duas revisões registradas.

#### Commit sugerido
`docs(ui-ux): registrar review final de seguranca e acessibilidade`

---

### Task 30 — Atualizar a documentação ao estado real

#### Tipo
Cleanup

#### Objetivo
Fazer os documentos de referência voltarem a descrever o produto.

#### Motivação
Depois da migração, `current-state.md` fica **certo por acidente** em duas afirmações que hoje são falsas (§3) — e continua errado em outras. A spec da Fase 5 registra 44px de altura de linha onde o protótipo mediu 65 e P-2 aprovou ~64. E o `bugfix-gate.md` recomenda, para F-03, uma remoção de controles que D-A tornou desnecessária.

#### Fontes/decisões atendidas
Divergências de `user-flows.md` §15; `bugfix-gate.md` §3.4 (categoria D, follow-up); **P-2**; **D-A**.

#### Dependências
Tasks 1–29.

#### Componentes e arquivos prováveis
`docs/current-state.md` · `docs/ui-ux/design-system.md` (§13.1) · `docs/ui-ux/bugfix-gate.md` (F-03) · `AGENTS.md` e `CLAUDE.md` (backlog)

#### Mudanças previstas
- Corrigir as duas afirmações falsas e a questão em aberto sobre os "3 sistemas de modal".
- Corrigir §13.1 de 44px para ~64px, com a nota de que o número veio de medição (P-2).
- Registrar em `bugfix-gate.md` que F-03 foi resolvida por implementação (D-A), não por remoção.
- Riscar do backlog o que a migração resolveu; **manter** o que ela não tocou (paginação real no banco para o caminho de busca, `packages/shared` como fonte única, **saldo como coluna computada**, `render.yaml`/`netlify.toml`).
- Registrar os follow-ups criados por esta migração: ordenação por saldo no banco, ordenação multi-coluna server-side (UF-08), política de SKU (F-05).

#### Comportamentos PRESERVAR
Todos — nenhuma linha de `packages/` é tocada.

#### Comportamentos ALTERAR INTENCIONALMENTE
Nenhum.

#### Bugs que NÃO devem ser congelados
Não aplicável.

#### Testes automatizados relevantes
Nenhum.

#### QA manual
Nenhum.

#### Critérios de aceite
- Nenhuma afirmação de `current-state.md` contradiz o código.
- Backlog reflete só o que continua pendente, mais os follow-ups novos.

#### Definição de pronto
Checklist completo verde.

#### Commit sugerido
`docs(ui-ux): atualizar o estado do projeto apos a migracao visual`

---

## 6. Ordem, dependências e paralelismo

### 6.1 · Grafo

```
FUNDAÇÕES (paralelas entre si)
  T1 tokens ◄── CSS REAL COMEÇA AQUI
  T2 helper numérico
  T3 ordenação global server-side (D-A) ◄── PRÉ-REQUISITO FUNCIONAL
  T4 characterization do MovementForm
  T26 código morto (independente de tudo)

T1 ──┬── T5  Button (+ chamadores)
     ├── T6  Input/Select
     ├── T7  Badge/Card/LoginPage
     ├── T8  Confirm/Toast/banners
     └── T9  Modal(sheet) + MenuPopover(separador)
                    │
        ┌───────────┴───────────┐
        │                       │
  T10 shell (D-B)         T12 ActionsMenu
        │                       │
  T11 DataTable (D-B) ◄── T3    │
        │                       │
  T13 ProductsTable ◄── T3 ─────┤
        │                       │
  T14 StatusFilterMenu          │
        │                       │
  T15 ProductCardList ◄─────────┘   (T15 também edita ProductActionsMenu)
        │
  T16 zona de controle + paridade mobile (D-A, D-B)
        │
  ┌─────┼──────────────────┬──────────────────┐
  │     │                  │                  │
T17 MovementForm      T20 QuickOutModal   T24 ProductForm
  │                        │                  │
T18 D-F (saída > saldo)  T21 F-01           T25 Adjustment
  │   (T17+T18 atômicas)   │  (T20+T21 atômicas)
T19 MovementHistory      T22 QuickOutList ◄── T3
  (T16→T17→T19,             │
   serializadas)          T23 QuickOutHistory ◄── T3
                            │  (dona do empilhamento e do foco)
                            │
                      T27 enforcement de lint
                            │
                      T28 QA responsivo (Q-1, D-A, D-B)
                            │
                      T29 review final
                            │
                      T30 documentação
```

### 6.2 · Tasks paralelizáveis

| Grupo | Tasks | Por quê |
|---|---|---|
| Fundações | **T1 ‖ T2 ‖ T3 ‖ T4 ‖ T26** | Nenhuma delas depende de token nem uma da outra. T3 é backend + camada de dados; T4 só escreve teste; T26 só apaga arquivo |
| Primitivos | **T5 ‖ T6 ‖ T7 ‖ T8 ‖ T9** | Arquivos disjuntos em `ui/` (T7 também toca `LoginPage`), todos dependendo só de T1 |
| Shell e menu | **T10 ‖ T12** | `App.tsx` e `ProductActionsMenu` não se tocam |
| Diálogos independentes | **T24 ‖ T25** | Arquivos distintos, sem estado compartilhado |

### 6.3 · Tasks que conflitam nos mesmos arquivos (**não paralelizar**)

| Arquivo | Tasks que o tocam | Ordem obrigatória |
|---|---|---|
| `MovementFormModal.tsx` | **T4 → T17 → T18** | A rede antes da mudança (TDD); depois a gramática; depois o impedimento de D-F. **T17+T18 = entrega atômica** |
| `QuickOutModal.tsx` | **T5 → T6 → T20 → T21** | Ajustes pontuais nos primitivos; depois migração; depois F-01. **T20+T21 = entrega atômica** |
| `ProductDashboard.tsx` | **T10 (cabeçalho) → T16 (zona de controle) → T17 → T19** | **Serializadas.** T16 reestrutura o arquivo; T17 e T19 mudam, cada uma, o que ele passa a um diálogo |
| `ProductActionsMenu.tsx` | **T12 → T15** | T12 insere o separador; **T15 acrescenta `onQuickOut` ao contrato** — o overflow do card É este arquivo |
| `DataTable.tsx` → `ProductsTable.tsx` | **T3 → T11 → T13** | T3 remove o ramo `shiftKey` e torna a ordenação global; depois a região; depois a tabela |
| `MenuPopover.tsx` → `ProductActionsMenu.tsx` | **T9 → T12** | O separador precisa existir antes de ser usado |
| `Modal.tsx` → diálogos e sheet | **T9 → T16, T17, T19, T20, T22, T23** | Primitivo antes dos consumidores |
| `useProductsQuery.ts` | **T3** (única) | O fim do `viewItems` é de T3; nenhuma outra task mexe no hook |
| `QuickOutHistoryModal.tsx` | **T3 (camada de dados) → T23 (invólucro)** | T3 troca a origem da ordenação; T23 troca o diálogo. Escopos deliberadamente disjuntos para limitar retrabalho |
| `QuickOutListModal.tsx` + `QuickOutHistoryModal.tsx` | **T22 → T23** | T22 prepara o empilhamento; **T23 é a dona do critério de foco** |
| Harness de teste (`test/helpers/render.tsx`) | **dentro de T22 e T23, antes da migração do componente** | Os dois arquivos de teste usam `render` puro; introduzir `useQuery` sem `QueryClientProvider` quebra 25 testes de uma vez |
| `Input.tsx` → `QuickOutModal.tsx` | **T6 → T20** | T6 aperta o tipo e corrige o único chamador não conforme |
| `tailwind.config.js` | **T1 → T27** | Adiciona, depois remove o legado |

### 6.4 · Ponto exato em que o CSS real começa

**Task 1.** Antes dela, nenhum arquivo de estilo é tocado. As Tasks 2, 3, 4 e 26 rodam em paralelo **sem tocar CSS**.

### 6.5 · Ponto exato em que o lint vira erro

**Task 27**, depois de T5–T25. Ver §4.3 para a alternativa progressiva.

### 6.6 · Ponto em que o backend é tocado

**Somente na Task 3.** Nenhuma outra task altera `packages/backend`.

---

## 7. Classificação das tasks

### 7.1 · Por tipo

| Tipo | Tasks |
|---|---|
| Foundation | 1, 2 |
| **Pré-requisito funcional / UX intencional** | **3** |
| Visual | 7, 10, 11*, 13*, 14, 15* (*mistas) |
| UX intencional | 3, 8, 12, 13, 15, 16, 17, **18**, 19, 21, 24 |
| Migração estrutural | 9, 16, 17, 19, 20, 22, 23 |
| Acessibilidade | 6, 9, 11, 12, 14, 24, 25 |
| Cleanup | 26, 30 |
| QA/Gate | 4, 27, 28, 29 |

### 7.2 · Tasks puramente visuais (nenhuma mudança de comportamento)

**7** (Badge, Card, LoginPage), **10** (shell, tipografia, largura), **14** (vocabulário e contador).

> A **Task 25** não está aqui (altera foco entre passos e anúncio em live region), nem a **Task 24** (corrige F-10). Ambas foram reclassificadas após o review.

### 7.3 · Tasks com alteração de UX intencional

| Task | O que muda para o usuário |
|---|---|
| **3** | **A ordenação passa a valer para o conjunto inteiro, não para a página.** O histórico de baixas ganha ordenação real. O Shift+clique deixa de ser oferecido |
| 8 | Toast de erro deixa de sumir sozinho; corpo genérico do confirm desaparece |
| 12 | Ações destrutivas ficam separadas no menu |
| 13 | Estoque mínimo passa a aparecer; baixa rápida perde o vermelho; estados vazios ganham causa e ação |
| 15 | Baixa rápida e mínimo passam a existir no mobile |
| 16 | Filtro **e ordenação** no mobile; ordem paginação/lista; ações em lote somem da superfície mobile |
| 17 | **Não existe mais tipo de movimentação pré-selecionado**; `<select>` vira `radiogroup` |
| **18** | **É impossível submeter saída manual maior que o saldo** |
| 19 | Histórico vira extrato; saldo ancorado imune ao filtro (e consultado, não herdado do cache) |
| **21** | **É impossível submeter baixa rápida maior que o saldo** |
| 22, 23 | **Escape passa a fechar** os dois diálogos |
| 24 | Erro antigo deixa de reaparecer ao reabrir o formulário (F-10) |

### 7.4 · Tasks que dependem de characterization test

**3, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24** — todas citam nominalmente os testes que as protegem.

**Duas lacunas de cobertura, encontradas no review e tratadas:**

| Componente | O que os testes existentes realmente cobrem | Tratamento |
|---|---|---|
| `MovementFormModal` | **Só o campo Data** — 3 testes de UI e 3 do schema Zod | **Task 4**, antes das Tasks 17 e 18 |
| `ProductFormModal` | **Só o carregamento em modo edição** (F-06) — 3 testes | Testes escritos **junto** com a Task 24 |

Os 5 componentes que estavam com cobertura zero (`QuickOutListModal`, `QuickOutHistoryModal`, `ProductsTable`, `ProductCardList`, `StatusFilterMenu`) foram cobertos pela Task 0 e continuam sendo a rede das Tasks 13, 15, 22 e 23.

### 7.5 · Tasks com QA manual obrigatório

**3** (a ordem atravessa as páginas; acentuação não piorou) · **6** (contraste de campos) · **7** (login em 375px) · **8** (erro que espera pela pessoa) · **9** (sheet em viewport baixo) · **10** (**largura D-B em 1024/1440/1920/375/320**) · **11** (copiar SKU; região acompanha o shell) · **13** (altura de linha; linha não "esticada" em 1920px) · **15** (alvos 44px, 320/375px; cards usando a largura) · **16** (**o QA central de paridade**, incl. ordenação no mobile e alinhamento de calha) · **17** (segmentado e preview) · **18** (impedimento inline visível) · **20** (grade de atalhos, viewport baixo) · **21** (impedimento visível) · **22** (clipping) · **23** (clipping e **empilhamento por teclado**) · **25** (teclado e leitor de tela no fluxo de conflito) · **27** (varredura visual final) · **28** (gate consolidado) · **29** (teclado e leitor de tela).

---

## 8. Matriz de rastreabilidade

`DECISÃO / ACHADO → TASK → TESTE AUTOMATIZADO → QA MANUAL`

| Decisão / Achado | Task | Teste automatizado | QA manual |
|---|---|---|---|
| **D-A** ordenação global server-side (**RESOLVIDA 31/08/2026**) | **3** (+ 11, 13, 16, 22, 23 como consumidoras) | **backend:** whitelist → 400; ordem atravessa páginas; desempate estável; asc/desc; combinada com busca/filtro/datas. **frontend:** controle envia `sortBy`/`sortDir`; nenhuma reordenação local | Página 2 continua a sequência da página 1, em produtos e no histórico; acentuação não piorou |
| **D-B** shell fluido, teto 1536px, gutters 16/24/32 (**RESOLVIDA 31/08/2026**) | **10** (shell), **11** (região de dados sem `max-width` próprio), **15** (cards usam a largura), **16** (zona de controle na mesma calha) | — (largura não é contrato de comportamento; a Task 0 proíbe asserção de `className`) | **1024px, 1440px, >1536px**, 375px e 320px; calha alinhada; sem scroll horizontal do container |
| **D-F** saída manual acima do saldo (**RESOLVIDA 31/08/2026**) | **18** (task própria) | **6 testes novos, escritos RED:** OUT > saldo bloqueia e não chama a API; IN não afetado; OUT = saldo permitido → zero; 422 com valor preservado; nunca negativo; vocabulário | Digitar acima do saldo em 375/1440; corrigir reabilita a confirmação |
| **F-01** baixa rápida acima do saldo | **21** (task própria) | 4 testes novos + os 20 do componente | Idem, na baixa rápida |
| **D1** escada de cerimônia | 4, 17, 18, 21, 25 | MFM-1..MFM-6; `AdjustmentFormModal.test.tsx` (24, N2 preservado); testes de preview | Fluxos lado a lado em 375/1440 |
| **D2 / P-4** intenção declarada, segmentado sem default | 17 | **novos:** nenhuma intenção ao abrir; campos inertes; preview nos dois sentidos; `radiogroup` operável por setas | 375/1440: o segmentado não pode parecer escolhido |
| **D3** hierarquia de ações | 13, 15, 12 | PT-7, PCL-3, PCL-4, `ProductActionsMenu.test.tsx` (7) | 900px: coluna de ações sem dominar |
| **D4** família de acento **blue** | 1 (+ consumidoras) | suíte completa como não-regressão | Varredura visual (27) |
| **D5** exceção de densidade | 11, 13 | `DataTable.test.tsx`, PT-1..PT-8 | 1024/1440/1920 com 10 linhas |
| **D6** histórico como extrato | 19 | MHM-1..MHM-6 + `MovementHistoryModal.test.tsx` (6) + novos (4 tipos, legados) | Viewport baixo |
| **A1** fim de `rounded-full` | 7, 13, 15 | suíte (nenhum teste assere classe) | Varredura visual |
| **A2** teto tipográfico de 24px | 10 | — | Antes/depois nas quatro larguras |
| **A3** enforcement por lint, não por override | 27 | **teste de configuração do ESLint, versionado** | Varredura visual final |
| **A4** breakpoint `md` mantido | — (nenhuma mudança de config) | — | 767/768/769 + janela com barra de rolagem (28) |
| **A5** `gray-400`/`gray-300` banidos; borda `gray-500` | 1, 6, 11 | **novos:** campo desabilitado comunicado; erro associado | Formulários em 375/1440 |
| **A6** nome acessível obrigatório no tipo | 6 (+ 20 corrigindo o único chamador) | typecheck é o gate; `getByLabelText` em toda a suíte | — |
| **`LoginPage` fora de toda classificação** (lacuna do review) | **7** | `LoginPage.test.tsx` (3) | 375px |
| **P-1** baixa rápida no overflow no mobile | 15 | **novo:** alcançável a partir do card (afirma que existe, não onde) | 320/375: dois toques, sem toque acidental |
| **P-2** altura de linha ~64px | 13 (+ 30 corrige a spec) | — | 1024/1440/1920 com 10 linhas |
| **P-3 / P-4** helper único, `−` U+2212 | 2 → 13, 15, 18, 19, 20, 21 | testes unitários do helper (code point) | Mesma quantidade, mesma representação |
| **P-5** `md` como breakpoint | 16, 28 | — (jsdom não avalia media query) | Transição em torno de 768px |
| **N-9** estado do histórico preservado | 23 | **QOH-8** — deve passar **sem alteração**, com a mesma instância de `QueryClient` no `rerender` | Reabrir e conferir o recorte |
| **Q-1** QA mobile manual, sem runner E2E | 28 (+ QA distribuído) | **nenhum** — nenhum Playwright/Cypress/Selenium | Cobertura mínima da Task 28 |
| **C-1** três sistemas de diálogo | 20, 22, 23, 19 | `Modal.test.tsx` (contrato-alvo) + os 4 conjuntos de characterization | Empilhamento e foco por teclado |
| **C-4** paginação antes dos cards | 16 | PD-1..PD-6 como não-regressão | 375: lista antes da paginação |
| **C-5 / UF-23** capacidades ausentes no card | 15 | PCL-1..PCL-5 + novos (baixa rápida e mínimo) | 320/375 |
| **C-6 / UF-40** veredito sem evidência | 13 | **novo:** mínimo legível na linha | 1024/1440/1920 |
| **UF-07 / UF-41** filtro sem saída no mobile | 14, 16 | **SFM-2** (`onClear`), SFM-4, PD-4 + novo (limpar alcançável) | **375: entrar pelo banner e sair** |
| **UF-08** ordenação secundária (**RESOLVIDA por D-A**) | **3** | nenhum — a capacidade **deixa de ser oferecida**; ausência declarada na tabela de paridade | Confirmar que Shift+clique não promete nada (28) |
| **F-03** ordenação só da página (**RESOLVIDA por D-A**) | **3** | **backend:** histórico ordenado por produto/SKU/quantidade/data, global | Ordenar o histórico e paginar |
| **UF-16** menu plano com destrutivas | 12 | `ProductActionsMenu.test.tsx` (7) | Teclado |
| **UF-29 / N-7** clipping no mobile | 22, 23 | **novos:** conteúdo alcançável | 375px |
| **UF-33 / UF-34 / F-09 / M-13** histórico | 19 | MHM-* + novos | Viewport baixo |
| **UF-35** título sem o produto | 19 | **novo:** título nomeia o produto | — |
| **F-02** fetch sem cancelamento | 22, 23 | QOL-2, QOH-1 + novo de erro visível | Digitar rápido na busca |
| **F-05** política de SKU | — | — | **Pendente** (§9, D-C) — não bloqueia a Task 24 |
| **F-10** `serverError` persistente | 24 | **novo:** reabrir não mostra o erro anterior | — |
| **A-5** `select-none` em dados | 11 | **novo:** célula selecionável | Copiar SKU com o mouse |
| **A-6** números não comparáveis | 2, 13 | testes do helper | Coluna de saldos alinhada |
| **A-7** `aria-controls` inválido | 13 | **novo:** aponta para elemento existente; PT-6 preserva o efeito | — |
| **A-9** ids fixos e primitivo ignorado | 24 | `ProductFormModal.test.tsx` (busca por label) | — |
| **A-10** estados vazios sem saída | 13, 15 | PT-8 + novo (dois estados distinguíveis) | — |
| **A-11** toast de erro efêmero | 8 | **novo:** erro não auto-dispensa | Erro real de baixa |
| **A-12** hooks após `return null` | 22 | QOL-1..QOL-10 (some por construção) | — |
| **M-3 / M-4** 10px e 2,5:1 | 14, 23 | — | Legibilidade em 375 |
| **M-6** animação em elemento não interativo | 7 | — | — |
| **M-7** `animate-fade-in` | 19, 27 | build | — |
| **M-8** cabeçalho sem rótulo | 11 | **novo** | — |
| **M-9** `Input` sem `disabled` | 6 | **novo** | — |
| **M-10** loading sem bloqueio; `disabled` com dois motivos | 5 | **novos:** `loading` focável e não ativável; `disabled` não focável; sem segunda submissão. Mais **QOM-4** | — |
| **M-11** container estreito | 10 | — | 1024/1440/1920 |
| **M-14** corpo genérico do confirm | 8 | `ConfirmDialog.test.tsx` (5) | — |
| **N-1..N-8** achados da Task 0 | 20, 22, 23 | os characterization dos respectivos componentes | 375 |
| **A1/A4/A5/A6** dívidas do Ajuste | 6, 19, 25 | `AdjustmentFormModal.test.tsx` (24) + novos de foco e anúncio | Teclado + leitor de tela |
| **Código morto** | **26 (isolada)** | build/typecheck | — |
| **Enforcement final** | **27** | lint reprovando violação deliberada + teste de configuração | Varredura visual |

### 8.1 · Comportamentos `PRESERVAR` que serão tocados, e o teste de cada um

| Comportamento | Teste | Task que o toca |
|---|---|---|
| Ordenação primária: `aria-sort`, troca ao clicar, reset de página | PT-3, PT-4, QOL-4, QOL-5 | 3, 11, 13, 22 |
| Escape / Enter / backdrop / atalhos / preview / payload / sucesso / falha do `QuickOutModal` | QOM-1..QOM-12 | 20, 21 |
| Erro real da API e erro renderizado uma vez | `QuickOutModal.test.tsx` (F-07, C-3) | 20, 21 |
| Payload `IN`/`OUT`, erro do servidor, valores preservados, sem duplicação | **MFM-1..MFM-6 (Task 4)** | 17, 18 |
| Foco na busca, seleção por linha, ordenação, mínimo, contador, paginação, histórico sem fechar a lista | QOL-1..QOL-10 | 22 |
| Filtros, datas, paginação, campos, data legível, **estado preservado entre aberturas** | QOH-1..QOH-8 | 3, 23 |
| Filtros, page size, diálogo acessível, limites, estados | MHM-1..MHM-6 + `MovementHistoryModal.test.tsx` | 19 |
| Dados, status, ordenação, seleção, disclosure, ações, vazio | PT-1..PT-8 | 13 |
| Dados, status, `onMove`, menu, `role` de estados | PCL-1..PCL-5 | 15 |
| Regra de status (incl. limite 0/0) | PS-1 (`productStatus.test.ts`) | 13, 15, 22 |
| Três opções, limpar, desabilitado, contador | SFM-1..SFM-4 | 14, 16 |
| Fiação de todas as ações do menu | `ProductActionsMenu.test.tsx` (7) | 12, 15 |
| Seleção limpa, diálogos, lote, busca | PD-1..PD-6 + `ProductDashboard.test.tsx` | 16, 17, 19, 24 |
| Contrato de diálogo | `Modal.test.tsx` (6) | 9, 19, 20, 22, 23 |
| Padrão WAI-ARIA de menu | `MenuPopover.test.tsx` (7) | 9, 12 |
| Live regions do toast e dos banners | `ToastProvider.test.tsx`, `LowStockBanner.test.tsx`, `ApiStatusBanner.test.tsx` | 8 |
| Fluxo de ajuste completo, incl. 409 | `AdjustmentFormModal.test.tsx` (24) | 25 |
| Regras de negócio de estoque (saldo derivado, saída não negativa, 409 do ajuste, lock de linha) | suíte de backend | **nenhuma task as altera** — 3 só lê; 18 e 21 previnem na UI |

---

## 9. Decisões

### 9.1 · Resolvidas

| # | Decisão | Data | Onde vive no plano |
|---|---|---|---|
| **D-A** | **A ordenação exibida é global e server-side.** Nenhuma opção visível reorganiza apenas a página carregada. Toda opção que permanecer visível precisa ter implementação global correta; a que não puder ser suportada sem complexidade desproporcional **não é oferecida** até haver suporte real | **31/08/2026** | §4.5 e **Task 3**; consumidoras: 11, 13, 16, 22, 23; QA em 28 |
| **D-B** | **Shell fluido**, `width: 100%`, teto conceitual de **1536px**, centralizado, gutters **16 / 24 / 32px**. Região de dados ocupa toda a largura disponível dentro do shell. O teto **não** se aplica a modais, formulários, blocos textuais nem superfícies de largura local menor | **31/08/2026** | §4.4 e **Tasks 10, 11, 15, 16**; QA em 10, 11, 13, 15, 16 e 28 |
| **D-F** | **A regra de F-01 vale para a saída manual.** Em qualquer fluxo de `OUT`: quantidade acima do saldo impede a confirmação, com feedback inline; quantidade igual ao saldo é permitida; `IN` não é afetado; estoque negativo nunca é permitido; o frontend previne, o backend decide | **31/08/2026** | **Task 18** (própria), simétrica à Task 21 (F-01) |
| **D-D** | **UF-08 — ordenação secundária por Shift+clique.** Resolvida **por consequência de D-A**: multi-coluna server-side é desproporcional para um recurso que a Fase 2 descreveu como invisível e enganoso. **Não é oferecida** na nova interface; ausência declarada na tabela de paridade, com condição de retorno registrada no backlog | **31/08/2026** | **Task 3**, item (g) |
| **F-01** | A baixa rápida impede quantidade acima do saldo | 29/08/2026 | **Task 21** |
| **N-9** | O `QuickOutHistoryModal` preserva filtros, busca e página entre aberturas | 29/08/2026 | **Task 23** (QOH-8) |
| **Q-1** | Paridade responsiva validada manualmente, sem runner E2E novo | 29/08/2026 | **Task 28** |

### 9.2 · Ainda em aberto

| # | Decisão | Bloqueia | Recomendação |
|---|---|---|---|
| **D-C** | **F-05 — política de SKU** (normalizar na escrita? unicidade case-insensitive? parar de exibir em maiúsculas?). É decisão de **dado/backend**, não de UI | **Nada neste plano.** A Task 24 preserva a exibição atual verbatim | Decidir fora desta refatoração. Registrada como follow-up na Task 30 |
| **D-E** | **Rename de `ghost` para `tertiary`** no `Button` | Nada. A Task 5 mantém `ghost` como alias | Cosmético; commit próprio depois da Task 27 |

### 9.3 · Sub-decisões que a execução precisa fechar dentro da própria task

Não são bloqueadores do plano — são escolhas técnicas que só fazem sentido com o código na mão, e cada uma tem critério de fechamento:

| # | Sub-decisão | Task | Critério que a fecha |
|---|---|---|---|
| **SD-1** | Collation da ordenação alfabética | **3** | **RESOLVIDA em 31/08/2026** — ver §9.3.1 |
| **SD-2** | `sortBy=balance` continua global no serviço ou migra para coluna computada no banco | **3** | Mantido no serviço, com o teto de volume medido no PR; a coluna computada fica como follow-up |
| **SD-3** | Campo Descrição do `ProductFormModal`: o "textarea equivalente" é primitivo novo ou markup local? | **24** | **RESOLVIDA em 03/09/2026** — ver §9.3.2 |
| **SD-4** | A Task 24 implementa o resumo de múltiplos erros do `design-system.md` §11.0? | **24** | **RESOLVIDA em 03/09/2026** — ver §9.3.2 |

#### 9.3.1 · SD-1 — política de collation da ordenação (RESOLVIDA em 31/08/2026)

**Decisão aprovada:**

- a ordenação é **global** e executada **no banco, antes da paginação**;
- toda entrada externa é validada por **whitelist**;
- empates usam **desempate secundário estável**, conforme item (d) da Task 3;
- **aceita-se a collation nativa do PostgreSQL de cada ambiente**;
- **ordenação linguística pt-BR idêntica entre local, CI e produção não é requisito do produto nesta versão**;
- diferenças de acentuação, caixa ou collation entre ambientes ficam registradas como **risco residual aceito**;
- se ordenação pt-BR idêntica entre ambientes virar requisito real, será implementada **posteriormente, em task funcional própria**, avaliando ICU ou chave normalizada.

**O que fica explicitamente fora desta versão:** colunas `nameSort`/`skuSort`, alteração de schema Prisma, migration, collation ICU, e raw SQL para forçar collation.

**Risco residual aceito.** O ambiente de desenvolvimento medido em 31/08/2026 é um PostgreSQL nativo Windows com collation `Portuguese_Brazil.1252`, cujo `ORDER BY` coincidiu com `Intl.Collator('pt-BR')` na amostra testada (`abacaxi · Ábaco · Álcool · banana · Zebra`). **Essa medição não é prova de equivalência** com o `postgres:16-alpine` usado no `docker-compose.yml` e no CI (`.github/workflows/ci.yml`), nem com o ambiente de produção futuro — são collations diferentes e podem ordenar acentuados e caixa de forma distinta. A medição serve para dimensionar o risco, não para eliminá-lo.

**Consequência para os testes automatizados:** nenhuma asserção de ordenação pode depender de acento, caixa ou locale. Os testes de ordenação global usam valores ASCII inequívocos. A verificação com nomes acentuados é **QA manual não bloqueante**, que **documenta** a diferença entre ambientes em vez de afirmar uma garantia que não existe.

#### 9.3.2 · SD-3 e SD-4 — sub-decisões da Task 24 (RESOLVIDAS em 03/09/2026)

**SD-3 · campo Descrição — decisão aprovada:**

- criar `packages/frontend/src/components/ui/Textarea.tsx`;
- espelhar o contrato de `ui/Input`: `useId`, `label` **ou** `aria-label` obrigatório pelo tipo,
  `hint`/`error`, `aria-describedby`, `aria-invalid` e `forwardRef`;
- usar o primitivo **somente no `ProductFormModal`** nesta task;
- **não** migrar os outros textareas existentes.

**Follow-up registrado, sem owner atribuído:** `AdjustmentFormModal.tsx`, `MovementFormModal.tsx` e
`QuickOutModal.tsx` continuam com `<textarea>` manual. A Task 25 é a dona do `AdjustmentFormModal`;
migrar o primitivo para lá é decisão dela, não desta task.

**SD-4 · resumo de múltiplos erros (§11.0) — decisão aprovada:**

- a Task 24 **não** implementa o resumo global de múltiplos campos inválidos do `design-system.md` §11.0;
- nesta task, cada campo usa `aria-invalid` + `aria-describedby` **através dos primitivos**;
- o `serverError` global **continua com `role="alert"`** — §11.0 o exige para erro assíncrono do servidor;
- o resumo de múltiplos erros fica registrado como **follow-up explícito**.

**Follow-up registrado, sem owner atribuído.** A lista de follow-ups da Task 30 é **fechada em três
itens** (ordenação por saldo no banco, UF-08, política de SKU/F-05) e este plano não tem seção
genérica de follow-ups — cada um é registrado na task que o origina. Atribuir o resumo §11.0 a uma
task existente, ou criar task própria para ele, é decisão de quem assumir essa etapa; **não é da
Task 24** e nenhuma task atual o herda por omissão.

### 9.4 · Gate executável das decisões

- **Nenhuma task inicia com uma decisão bloqueante sua ainda aberta.** A escolha aprovada é escrita **neste arquivo**, com data — como D-A, D-B, D-F, F-01, N-9 e Q-1 estão.
- **Nenhuma decisão bloqueante permanece.** As três que travavam a execução foram fechadas em 31/08/2026; D-C e D-E não bloqueiam nenhuma task.
- As sub-decisões de §9.3 são fechadas **dentro** da task dona de cada uma e registradas junto à execução correspondente. **SD-1 foi fechada antecipadamente em 31/08/2026** (§9.3.1), por decisão explícita do usuário, para preservar a política de collation mesmo que a sessão de execução seja interrompida.

---

## 10. Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| **A Task 3 crescer**: mexe em duas rotas, um hook e três componentes | **Alta** | Escopo fechado por §2.1 (inventário assinado) e por escopos disjuntos declarados em §6.3: nos `QuickOut*`, a Task 3 toca **só a camada de dados**; o invólucro é das Tasks 22/23 |
| **A ordem alfabética variar entre ambientes** (collation nativa difere entre o Postgres local, o `alpine` do CI e a produção) | **Média** | **Risco residual aceito** por SD-1 (§9.3.1, 31/08/2026): ordenação pt-BR idêntica entre ambientes não é requisito desta versão. Mitigação: nenhum teste automatizado depende de acento/caixa/locale; a diferença é documentada em QA manual não bloqueante. Se virar requisito, entra como task funcional própria (ICU ou chave normalizada) |
| **Ordenação instável duplicar ou perder linhas entre páginas** | Média | Desempate por `id` obrigatório em todo `orderBy` (Task 3, item d), com teste de backend dedicado |
| **A largura fluida (D-B) esticar a linha da tabela em 1920px** | Média | QA obrigatório em 1920px nas Tasks 10 e 13; o teto de 1536px existe exatamente para isso |
| **`ProductDashboard` como ponto de conflito** — 4 tasks o tocam | **Alta** | §6.3 fixa T10 → T16 → T17 → T19, serializadas |
| **Formatação numérica derivar de novo** — já derivou no protótipo | **Alta** | Task 2 antes de qualquer consumidor |
| **Migração dos `QuickOut*` perder comportamento** | Alta | 40 characterization tests dedicados, citados nominalmente nas Tasks 20–23 |
| **Empilhamento lista→histórico produzir dois focus traps** | Média | Forma declarada na Task 23 + teste + QA por teclado |
| **D2-B implementado como `disabled` cosmético** | Média | Task 17 exige teste de **comportamento** (envio impossível), não de atributo |
| **D-F ser implementada só na UI e alguém concluir que o backend pode relaxar** | Média | Critério de aceite da Task 18 e da Task 29: a regra permanece no `StockService`, dentro da transação com lock. A UI **previne**; o backend **decide** |
| **Bug funcional corrigido dentro de task visual** | Alta | Toda correção funcional tem item próprio: 3, 17, 18, 19, 21, 22, 23, 24 |
| **QA manual virar formalidade** | Média | A tabela de paridade é **entregável assinado** da Task 16 e gate da Task 28 |
| **Borda de controle mais escura mudar a aparência dos formulários** | Alta (esperado) | Consequência da WCAG 1.4.11; QA na Task 6 |
| **Regressão silenciosa por classe inexistente** | Média | O plano **não** usa override de tema; `extend` + lint (§4.3) |
| **Retirar o Shift+clique ser lido como perda de capacidade** | Média | Ausência **declarada** na tabela de paridade, com condição de retorno; a capacidade atual é enganosa (aplica-se só à página) |

---

## 11. Números

| | |
|---|---|
| **Tasks** | **30** |
| Evolução | ~27 (draft da sessão interrompida) → 26 (draft desta sessão) → 28 (após o review do Codex) → **30 (após D-A e D-F)** |
| Foundation | 2 |
| **Pré-requisito funcional** | **1** (Task 3) |
| Migração estrutural | 7 |
| UX intencional | 11 |
| Puramente visuais | 3 |
| Acessibilidade | 7 |
| Cleanup | 2 |
| QA/Gate | 4 |
| Com QA manual obrigatório | **20** |
| Tasks que tocam o backend | **1** (Task 3) |
| Decisões bloqueantes em aberto | **0** — D-A, D-B e D-F resolvidas em 31/08/2026; D-D resolvida por consequência; D-C e D-E não bloqueiam |
| Sub-decisões a fechar dentro da execução | 2 (SD-1, SD-2, ambas na Task 3) |
| Testes existentes que protegem a migração | 190 (27 arquivos), verdes na baseline |
| Dependências novas introduzidas | **0** |
| Arquivos de `packages/` alterados nesta fase | **0** |

---

## Independent Technical Review

> **Nota de 31/08/2026:** **nenhum review novo foi executado** nesta etapa. O que segue é o registro do review que produziu a versão anterior deste plano. Os números de task citados abaixo são os da numeração antiga; a §"Remapeamento" no fim faz a correspondência, para que nenhuma referência fique quebrada.

### Método

**Reviewer:** Codex (`codex-cli 0.150.1`), executado em `--sandbox read-only`, **sem permissão de escrita**, com instrução explícita de não redesenhar o plano. Duas passagens: uma ampla sobre os 12 eixos pedidos, e uma segunda focada em ordem/dependências e em enforcement/duplicação.

O draft foi **salvo em disco antes** do review, e o reviewer leu o arquivo salvo junto do código real.

**Verificação:** nenhum achado foi aceito pela autoridade do reviewer. Cada um foi conferido contra o código antes de ser aceito — e quatro dessas verificações mudaram o plano de forma material.

### Limitações

1. O reviewer **não executou a suíte de testes** nem abriu o navegador — leu código. Os achados sobre cobertura foram reconferidos lendo os arquivos de teste citados.
2. Achados sobre layout, clipping e alvos de toque continuam sendo território do QA manual (Q-1).
3. O reviewer emitiu **REPROVADO** sobre a versão salva. O veredito foi **aceito**: os motivos — dependências inexequíveis e comportamentos `PRESERVAR` sem teste real — eram verdadeiros e verificáveis. Um segundo ciclo, se desejado, deve rodar sobre a versão atual.
4. **O review é anterior a D-A, D-B e D-F.** Ele não avaliou a Task 3 nem a Task 18, que não existiam. As duas nasceram de decisões do usuário, não de achados do reviewer.

### Achados aceitos e o que mudou no plano

| ID | Achado | Verificação | Mudança (numeração atual) |
|---|---|---|---|
| **REV-04** | `MovementFormModal` marcado `PRESERVAR` sem cobertura: os 6 testes são **todos** sobre o campo Data | **Confirmado** — 3 testes de UI de data + 3 do schema Zod. Zero de payload, erro, pending ou duplicação | **Task 4 criada**: characterization antes das Tasks 17 e 18 |
| **REV-17** | `ProductFormModal` idem: os 3 testes cobrem só o carregamento em modo edição | **Confirmado** | Task 24 declara a lacuna e escreve os testes junto; **reclassificada** para UX intencional |
| **DEP-02** | Migrar para React Query quebra 25 testes: os dois arquivos usam `render` puro; o `QueryClientProvider` só existe no helper | **Confirmado** | Tasks 22 e 23 começam pela **troca de harness**. QOH-8 ganha a ressalva da **mesma instância de `QueryClient`** |
| **ORD-01** | A Task de lista exigia testar focus trap do histórico, que só vira diálogo depois | **Confirmado** | O teste e o critério de empilhamento migraram para a **Task 23** |
| **DEP-01** | "Coordenar" com a task do dashboard, enquanto o grafo exigia ordem | **Confirmado** — três tasks editam `ProductDashboard.tsx` | **T16 → T17 → T19**, serializadas |
| **DUP-01** | "Baixa rápida no overflow" não é mudança do card: o overflow é o `ProductActionsMenu`, cujo tipo **não aceita `onQuickOut`** | **Confirmado** | Task 15 lista `ProductActionsMenu.tsx`; conflito **T12 → T15** |
| **LINT-01** | `LoginPage.tsx` não pertence a task nenhuma e usa `rounded-lg`, `shadow-sm`, `text-xl` | **Confirmado** — e **`LoginPage` não aparece na classificação §18 do `design-system.md`**, lacuna que atravessou seis fases | Atribuído à **Task 7** |
| **REV-12** | "Botão focável durante o envio" não se realiza: os chamadores passam `disabled` junto com `isLoading` | **Confirmado** em três arquivos | Task 5 inclui os chamadores e separa os dois motivos |
| **REV-19** | Trocar o glifo por ícone **e** exigir `Modal.test.tsx` "sem alteração" | **Confirmado** — o teste assere `textContent === '✕'` | Ajuste do teste virou **item declarado** da Task 9 |
| **REV-11** | Estender `antes → depois` aos quatro tipos expõe linhas legadas sem `previous/new` | **Confirmado**; o `seed.ts` grava direto via Prisma | Task 19 exige degradação nos quatro tipos + testes |
| **REV-06** | O saldo "atual" do histórico viria do snapshot da listagem (`staleTime` 15s) | **Confirmado**; `fetchProduct(id)` já existe | Task 19 consulta o produto ao abrir, ou rotula o valor |
| **REV-07** | O "novo saldo" no toast não tinha fonte definida | **Confirmado**; `api/quickOut.ts` expõe `newBalance` | Tasks 17 e 20 leem o saldo **da resposta da API** |
| **REV-08** | O segmentado substituiria um `<select>` **nativo** sem especificar papel, estado ou teclado | **Confirmado** | Task 17 especifica `radiogroup` e testa por papel |
| **REV-14** | O foco inicial do QuickOut ficaria a cargo do Radix | **Confirmado** — o "Fechar" precede o corpo | Task 20 declara e testa o **campo de quantidade** |
| **REV-05** | PD-2 não verifica **qual** produto abriu o diálogo | **Confirmado** | Identidade acrescentada às Tasks 16, 17 e 19 |
| **DEP-03** | "Ações em lote não renderizadas no mobile" não é verificável em jsdom | **Confirmado** — sem estado de viewport, sem `matchMedia` no setup | Critério reescrito; **nenhum `matchMedia` introduzido** |
| **REV-16** | Fundir o SKU sob o nome elimina o cabeçalho que ordena por SKU | **Confirmado** | Task 13 declara onde o controle passa a viver e o testa |
| **REV-10** | UF-08 preservada sem teste, com proteção atribuída falsamente a PT-3/PT-4 | **Confirmado** | **Superado por D-A:** a capacidade **deixa de ser oferecida** (Task 3), em vez de virar dívida |
| **REV-18** | Task do ajuste listada como "puramente visual" embora mude foco e anúncio | **Confirmado** | Reclassificada (Task 25) |
| **REV-20** | Task de superfícies grande demais: seis componentes | Procede | **Dividida** em Tasks 7 e 8 |
| **REV-21** | O gate de lint permitiria editar "resíduos em qualquer arquivo" | Procede | Escopo apertado na Task 27 |
| **REV-22** | Validar a regra com violação temporária não protege contra regressão futura | Procede | Teste de configuração versionado |
| **REV-23** | Decisões bloqueantes sem gate executável | Procede | §9.4 |
| **REV-09** | Saída manual acima do saldo não tratada; F-01 cobre só a baixa rápida | **Confirmado** — o schema aceita qualquer inteiro positivo | Registrada como **D-F** e, em 31/08/2026, **decidida e transformada na Task 18** |

### Achados parcialmente aceitos

| ID | O que foi aceito | O que foi rejeitado, e por quê |
|---|---|---|
| **REV-24** | "As duas tasks do QuickOut formam uma unidade de entrega" — declarado | **Rejeitada a fusão em uma task só.** F-01 precisa de item próprio, com teste e critério de aceite. Dois commits, uma entrega. **O mesmo padrão foi aplicado a D-F** (Tasks 17+18) |
| **REV-21** | O gate não faz migração transversal | **Rejeitado** que a Task 27 não toque arquivo nenhum: ela ainda remove `brand` e `animate-fade-in` do config |
| **REV-06** | A correção (consultar o produto ou rotular o valor) | Registrado o enquadramento: a concorrência real é hipótese; o que está provado é a possibilidade de snapshot obsoleto |

### Achados rejeitados

Nenhum achado foi rejeitado integralmente. As três rejeições parciais acima são onde o reviewer otimizava algo diferente do que o plano precisa entregar — em dois casos, contagem de tasks; num terceiro, a fronteira de escopo fixada pelo briefing.

### Avaliação do review

O review pagou seu custo em **quatro achados** que não teriam aparecido de outro modo: **REV-04/REV-17** (cobertura de teste afirmada e inexistente nos dois formulários), **DEP-02** (25 testes quebrariam por falta de provider), **ORD-01** (um teste colocado numa task que não pode fazê-lo passar) e **LINT-01** (`LoginPage` atravessou seis fases sem classificação).

Um quinto achado — **REV-09** — apontou que F-01 cobria só metade do problema. Ele foi registrado como decisão em aberto e, com D-F, virou a **Task 18**.

### Remapeamento de numeração (review → plano atual)

| Numeração no review | Agora | | Numeração no review | Agora |
|---|---|---|---|---|
| 1, 2 | 1, 2 | | 14 | 17 |
| 14A | **4** | | 19 | 19 |
| 3 | 5 | | 15, 16 | 20, 21 |
| 4 | 6 | | 17, 18 | 22, 23 |
| 5 | 7 | | 20, 21 | 24, 25 |
| 5B | 8 | | 22 | 26 |
| 6 | 9 | | 23 | 27 |
| 7, 8 | 10, 11 | | 24 | 28 |
| 13 | 12 | | 25 | 29 |
| 9, 10, 11, 12 | 13, 14, 15, 16 | | 26 | 30 |
| — | **3** (D-A, nova) | | — | **18** (D-F, nova) |






