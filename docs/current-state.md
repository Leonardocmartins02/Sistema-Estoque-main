# Estado Atual do Projeto

> Documento gerado por leitura do repositório em 27/08/2026. Objetivo: mapa confiável do que existe hoje, sem propor correções. Toda afirmação abaixo é rastreável a um arquivo real citado por caminho. Onde algo não pôde ser confirmado com segurança, está listado em "Questões em Aberto" em vez de assumido.

# Visão Geral

`Sistema-Estoque-main` é um sistema de controle de estoque: cadastro de produtos, entrada/saída de quantidade e uma tela de baixa rápida, com histórico de movimentações. O projeto está em transição de um modelo simples (campo de quantidade editado diretamente) para um modelo auditável, onde toda alteração de saldo é uma `StockMovement` registrada (produto, tipo, saldo anterior/posterior, usuário, data) — o saldo em si nunca é armazenado como coluna, é sempre derivado das movimentações. Essa transição já está parcialmente implementada (ver "Banco de Dados" e "Regras de Negócio Existentes").

# Stack

Monorepo `pnpm` (`workspaces: packages/*`), três pacotes:

| Pacote | Papel |
|---|---|
| `packages/backend` | API REST em `/api/*` |
| `packages/frontend` | SPA que consome a API |
| `packages/shared` | Tipos de domínio compartilhados (hoje contém pouco — ver "Dívidas Técnicas") |

| Área | Escolha |
|---|---|
| Backend | Express + TypeScript + Prisma + PostgreSQL |
| Auth | `bcryptjs` (hash de senha) + `jose` (JWT) |
| Segurança HTTP | `helmet`, `express-rate-limit` |
| Log | `pino` + `pino-http` (estruturado) |
| Testes backend | `vitest` + `supertest`, integração contra Postgres real |
| Frontend | React 18 + Vite 5 + Tailwind 3 |
| Dado remoto (frontend) | `@tanstack/react-query` ^5.51 |
| Formulários | `react-hook-form` + `zod` |
| Diálogo acessível | `@radix-ui/react-dialog` |
| Ícones | `lucide-react` |
| Testes frontend | `vitest` + `@testing-library/react` + `jsdom` |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |

Fonte: `AGENTS.md`, `package.json` de cada pacote.

# Estrutura

```
packages/backend/
  prisma/schema.prisma, prisma/migrations/
  src/routes/        auth.ts, products.ts, movements.ts, quick-out.ts, index.ts
  src/services/       stockService.ts
  src/middleware/     requireAuth.ts
  src/shared/         env.ts, httpError.ts, jwt.ts, logger.ts, password.ts, prisma.ts, queryParams.ts, text.ts
  src/app.ts, server.ts, seed.ts
  test/               *.test.ts + helpers/(db.ts, auth.ts)

packages/frontend/
  src/api/            httpClient.ts, products.ts, movements.ts, quickOut.ts, types.ts
  src/auth/           AuthContext.tsx
  src/components/      ProductDashboard.tsx, ProductFormModal.tsx, MovementFormModal.tsx,
                       MovementHistoryModal.tsx, QuickOutModal.tsx, QuickOutListModal.tsx,
                       QuickOutHistoryModal.tsx, LoginPage.tsx, FinanceDashboard.tsx*, SalesDashboard.tsx*
  src/components/products/  ProductsTable.tsx, ProductCardList.tsx, ProductActionsMenu.tsx, StatusFilterMenu.tsx
  src/components/ui/  Modal.tsx, ConfirmDialog.tsx, DataTable.tsx, Badge.tsx, Button.tsx, Card.tsx,
                       Input.tsx, Select.tsx, MenuPopover.tsx, ToastProvider.tsx, ApiStatusBanner.tsx, LowStockBanner.tsx
  src/hooks/           useProductsQuery.ts, useProductMutations.ts, useProductStockSummary.ts,
                       useConfirm.tsx, useDebouncedValue.ts
  App.tsx, main.tsx
  test/                *.test.tsx

packages/shared/src/index.ts   (ApiError, ProductStockSummary)

docker-compose.yml, docker/postgres-init/  (Postgres local de dev)
render.yaml, packages/frontend/netlify.toml  (deploy — ver "Dívidas Técnicas")
.github/workflows/ci.yml
```

`*` — `FinanceDashboard.tsx` e `SalesDashboard.tsx` existem mas não são importados por nenhum outro arquivo (confirmado por busca no código-fonte) — código morto.

# Arquitetura Atual

**Backend**: requisição → CORS (allowlist de origem) + `helmet` + rate limit → `express.json()` → rota → validação Zod (body e query) → (rotas que alteram estoque) `StockService` → Prisma → PostgreSQL. `StockService` (`src/services/stockService.ts`) é o único ponto que grava `StockMovement`: abre uma transação (`prisma.$transaction`), executa `SELECT ... FOR UPDATE` na linha do `Product` (lock pessimista), recalcula o saldo atual via `groupBy` sobre as movimentações existentes, valida que o novo saldo não fica negativo, e só então grava a movimentação com `previousQuantity`/`newQuantity`/`userId` preenchidos. As rotas (`movements.ts`, `quick-out.ts`, `products.ts`) chamam esse serviço em vez de duplicar a lógica de lock/saldo; a responsabilidade de cada rota fica restrita a parsing HTTP, formato de resposta e status code. Erros seguem uma classe própria (`HttpError`, `src/shared/httpError.ts`) capturada por um handler global em `app.ts` que nunca expõe `err.message` de um erro inesperado ao cliente (só loga no servidor via `pino`).

**Frontend**: `main.tsx` monta `AuthProvider` (contexto de autenticação) envolvendo `App.tsx`. `AuthContext` guarda o JWT em `localStorage`, expõe `status: loading|authenticated|unauthenticated`, e assina um handler global de 401 no `httpClient` — qualquer chamada de API que retorne 401 derruba a sessão automaticamente. Todo acesso a dado remoto passa por `httpClient.ts` (`apiFetch`, fetch com timeout de 8s via `AbortController`) e por React Query (`useQuery`/`useMutation`) — não há `useEffect` + `fetch` manual em nenhum componente. `App.tsx` é a casca (header, skip-link, banner de status de API) e renderiza `ProductDashboard.tsx` como único componente principal da aplicação autenticada; esse componente (316 linhas) mantém ~9 estados locais (`useState`) e orquestra 8 modais diferentes (criar/editar produto, movimentar estoque, histórico de movimentações, baixa rápida, histórico de baixas, confirmação de ação destrutiva). Parte da lógica já foi extraída para hooks dedicados (`useProductsQuery`, `useProductMutations`, `useProductStockSummary`), mas a orquestração de UI ainda está centralizada nesse componente.

# Banco de Dados

PostgreSQL via Prisma (`packages/backend/prisma/schema.prisma`). Três modelos:

- **`User`**: `id`, `email` (único), `passwordHash`, `createdAt`, `updatedAt`. Relação 1-N com `StockMovement` (autor da movimentação).
- **`Product`**: `id`, `name`, `sku` (único), `description?`, `minStock` (default 0), `createdAt`, `updatedAt`. Não existe `maxStock`/`reorderPoint`. Saldo **não é campo desta tabela** — é sempre derivado de `StockMovement`.
- **`StockMovement`**: `id`, `productId`, `type` (enum `MovementType`), `quantity`, `date`, `note?`, `createdAt`, e campos de auditoria adicionados mais recentemente: `previousQuantity?`, `newQuantity?`, `userId?` (FK `ON DELETE SET NULL`), `referenceType?`, `referenceId?`. Índices: `@@index([productId, type])`, `@@index([type, date])`, `@@index([userId])`.
- **`MovementType`** (enum): `IN`, `OUT`, `ADJUSTMENT`, `INITIAL_STOCK`. `ADJUSTMENT` existe no schema e no banco, mas **nenhuma rota da API o utiliza hoje** — não há endpoint de ajuste de inventário. `INITIAL_STOCK` é usado apenas por `POST /products` quando o produto é criado com saldo inicial.

Cálculo de saldo: sempre via `stockMovement.groupBy({ by: ['productId','type'], _sum: { quantity: true } })`, nunca uma coluna de saldo persistida — ver `routes/products.ts` (`balancesFor`), `services/stockService.ts` (`currentBalance`).

`DELETE /products/:id` (`routes/products.ts`) apaga todas as `StockMovement` do produto (`deleteMany`) e em seguida o `Product` — é hard-delete com cascata manual, não soft delete.

`seed.ts` cria um usuário admin e 50 produtos de papelaria com movimentações de estoque inicial gravadas **diretamente via `PrismaClient`** (`prisma.stockMovement.create({ type: 'IN', ... })`), sem passar pelo `StockService` — essas linhas não têm `previousQuantity`/`newQuantity`/`userId` preenchidos.

Ambiente local: Postgres via `docker-compose.yml` (imagem `postgres:16-alpine`), com um banco de dev (`simplestock`) e um banco de teste separado (`simplestock_test`, ver `.env.example` e `docker/postgres-init/01-create-test-db.sql`).

# Autenticação e Autorização

**Autenticação**: `POST /api/auth/login` (`routes/auth.ts`) verifica e-mail/senha (`bcryptjs`), retorna um JWT assinado (`jose`, segredo em `JWT_SECRET`). Mensagem de erro idêntica para "usuário não existe" e "senha errada" (evita enumeração de e-mail). Rate limit dedicado no login: 10 tentativas / 15 min por origem (além do rate limit global de 300/15min em `/api`). `GET /api/auth/me` retorna o usuário autenticado. O middleware `requireAuth` (`middleware/requireAuth.ts`) valida o JWT do header `Authorization: Bearer <token>` e popula `req.user = { id, email }`; está aplicado a **todas** as rotas de `products`, `movements` e `quick-out` (leitura e escrita) em `routes/index.ts` — não há endpoint de negócio público.

No frontend, o token fica em `localStorage` (`AuthContext.tsx`, chave `simplestock.auth.token`) e é anexado pelo `httpClient` em toda chamada.

**Autorização**: não existe modelo de papéis/permissões. Todo usuário autenticado tem acesso irrestrito a todas as operações (criar, editar, excluir produto, movimentar estoque). Não há distinção entre, por exemplo, um usuário que só deveria visualizar e um que pode excluir produtos.

# Fluxos Principais

1. **Login**: `LoginPage` → `POST /auth/login` → token salvo → `ProductDashboard` renderizado.
2. **Criar produto**: `ProductFormModal` → `POST /products` (Zod valida `name`, `sku`, `minStock`, `description?`, `initialStock?`). Se `initialStock > 0`, a criação do produto e a movimentação `INITIAL_STOCK` acontecem na mesma transação Prisma (via `StockService.recordMovementInTx`).
3. **Editar produto**: `PUT /products/:id` — não altera saldo, só `name`/`sku`/`description`/`minStock`.
4. **Excluir produto**: `DELETE /products/:id` — hard-delete com cascata manual das movimentações (ver "Banco de Dados"). Existe também exclusão em lote (`useProductMutations.removeProducts`, `Promise.allSettled` por item).
5. **Movimentar estoque (entrada/saída manual)**: `MovementFormModal` → `POST /products/:id/movements` (`type: IN|OUT`, `quantity`, `date?`, `note?`) → `StockService.recordMovement` (lock + saldo + gravação).
6. **Baixa rápida**: `QuickOutModal`/`QuickOutListModal` → `POST /quick-out` (mesmo mecanismo de `StockService`, `type: OUT` fixo). Existe também "zerar saldo" em massa (`useProductMutations.zeroBalances`), que dispara uma saída igual ao saldo atual de cada produto selecionado.
7. **Histórico de movimentações**: `MovementHistoryModal` → `GET /products/:id/movements` (paginado, filtrável por `type`, `from`/`to`, `q`). `QuickOutHistoryModal` → `GET /quick-out/history` (só saídas, com o mesmo padrão de filtro/paginação).
8. **Listagem/busca de produtos**: `GET /products` — busca por nome/SKU (diacritic-insensitive, resolvida em memória — ver comentário em `routes/products.ts`), paginação, ordenação (`name`/`sku`/`balance`), filtro por status (`OK`/`ATTN`/`OUT`, derivado do saldo vs. `minStock`).

# Regras de Negócio Existentes

- Saldo de um produto nunca é escrito diretamente — só resulta da soma de `StockMovement` (`IN`/`INITIAL_STOCK` somam, `OUT` subtrai).
- Uma saída (`OUT`) nunca pode deixar o saldo negativo — validado dentro da mesma transação que lê o saldo (lock de linha evita corrida entre duas saídas concorrentes; há teste dedicado provando isso, `test/movements.concurrency.test.ts`).
- `sku` é único por produto (`@unique` no schema + checagem explícita em `POST`/`PUT /products`).
- Toda `StockMovement` criada pelas rotas atuais grava o `userId` do usuário autenticado (`req.user.id`), nunca um valor vindo do corpo da requisição.
- Status de estoque de um produto é derivado, não armazenado: `OUT` se saldo = 0, `ATTN` se `0 < saldo < minStock`, `OK` caso contrário (`routes/products.ts`, `matchesStatus`).
- Toda entrada HTTP (body e query string) é validada com Zod antes de tocar o banco.

# Convenções do Projeto

Documentadas em `AGENTS.md` (arquivo de guia do projeto para agentes de IA):

- **TDD obrigatório**: nenhuma função de negócio nova ou alterada entra sem teste escrito antes/junto da implementação.
- Checklist de "pronto": `pnpm -r run lint`, `pnpm -r run typecheck`, `pnpm --filter @simplestock/backend test`, `pnpm --filter @simplestock/frontend test`, `pnpm -r run build` — todos sem erro, e revisão de `security-reviewer`/`accessibility-reviewer` quando a mudança toca rotas/auth/dados/UI. Verificado automaticamente em CI a cada PR.
- Backend: sequência "ler saldo → decidir → escrever" sempre dentro de `prisma.$transaction`; toda entrada HTTP validada com Zod; toda rota mutável exige `requireAuth`; log estruturado via `pino` (nunca `console.log` — exceção observada: `seed.ts`, que é um script standalone rodado fora do servidor, usa `console.log`); handler de erro global nunca devolve `err.message` cru.
- Frontend: um único primitivo de modal acessível no projeto (`components/ui/Modal.tsx`, usado via Radix Dialog); dado remoto sempre via React Query; nenhum `window.confirm()`/`window.alert()` para ações destrutivas (usa `ConfirmDialog`/`useConfirm`); todo `id` usado em `aria-labelledby`/`aria-describedby` vem de `useId()`; conteúdo dinâmico assíncrono (toast, banners) tem `aria-live`/`role="status"`/`role="alert"`; componentes não devem crescer virando componente-deus — extrair hooks/subcomponentes cedo (regra já violada por `ProductDashboard.tsx`, ver "Dívidas Técnicas").
- Time de subagentes especializados descrito em `AGENTS.md` (`architect`, `tech-lead`, `backend-engineer`, `frontend-engineer`, `qa-tdd-engineer`, `security-reviewer`, `accessibility-reviewer`, `devops-engineer`) para dividir trabalho por responsabilidade em vez de fazer tudo no mesmo contexto.

# Testes

**Backend** (`packages/backend/test/`): testes de integração via `supertest` contra um Postgres real (não mocks) — `test/helpers/db.ts` faz `resetDb()` entre suites, `test/helpers/auth.ts` cria usuário e obtém token. Cobrem: login/auth, listagem/paginação/resumo de produtos, CRUD de produto, query/filtro de movimentações, histórico de baixa rápida, e um teste de concorrência dedicado (`movements.concurrency.test.ts`) que dispara duas saídas simultâneas para o mesmo produto e garante que só uma é aceita e o saldo nunca fica negativo.

**Frontend** (`packages/frontend/test/`): `vitest` + `@testing-library/react` + `jsdom`, testando componentes isolados por comportamento observável — `Modal`, `ConfirmDialog`, `MenuPopover`, `ToastProvider`, `DataTable`, `LoginPage`, `ApiStatusBanner`, `LowStockBanner`, `MovementFormModal`, `httpClient`, e um teste de `App`.

**CI** (`.github/workflows/ci.yml`): roda em todo PR e push para `main`/`master`; sobe um serviço Postgres real (justificado no próprio workflow pela dependência do teste de concorrência em locks de linha reais); executa lint, typecheck, testes de backend e frontend, e build — todos como gate obrigatório, nessa ordem.

# Pontos Fortes

- Mecanismo de concorrência de estoque já correto e coberto por teste específico (lock de linha + transação, não apenas validação em memória).
- Validação de entrada HTTP consistente (Zod em body e query, em todas as rotas) — nenhuma rota confia em `String()`/`Number()` manual.
- Handler de erro global disciplinado: nunca vaza detalhe interno (stack, mensagem de driver) para o cliente.
- CI já é gate real (roda contra Postgres de verdade, não pula os testes de integração que dependem de banco).
- Convenções documentadas em `AGENTS.md` são específicas e verificáveis (não genéricas), com justificativa ("por quê") registrada — inclusive dívidas já auto-identificadas pelo próprio time do projeto.
- `StockService` centraliza a escrita de saldo (lock, cálculo, validação, gravação de auditoria) em vez de duplicar essa lógica por rota.

# Dívidas Técnicas

Listadas em `AGENTS.md` como backlog conhecido, mais achados desta análise:

- `ProductDashboard.tsx` como componente-deus (316 linhas, ~9 estados locais, 8 modais orquestrados) — decomposição pendente.
- `FinanceDashboard.tsx` e `SalesDashboard.tsx` são código morto (não importados em lugar nenhum) — confirmado nesta análise.
- `AGENTS.md` menciona "unificação dos 3 sistemas de modal legados" como dívida; a análise atual só encontrou um primitivo de modal ativo (`components/ui/Modal.tsx`) sendo usado — não foi possível confirmar se essa dívida específica já foi resolvida ou se a menção está desatualizada (ver "Questões em Aberto").
- Saldo como coluna computada/cache: hoje todo cálculo de saldo é `groupBy` em tempo real; funciona, mas é uma dívida de performance já sinalizada pelo próprio time para quando o volume de movimentações crescer.
- Paginação "parcialmente em memória": `routes/products.ts` e `routes/quick-out.ts` só empurram filtro/ordenação/paginação inteiramente para o banco no caminho "sem busca textual e sem filtro de status/ordenação por saldo"; busca por nome/SKU sem acento e filtro por status/ordenação por saldo ainda carregam candidatos em memória antes de filtrar (decisão documentada nos comentários do próprio código, não um descuido).
- `packages/shared` deveria ser fonte única dos tipos de domínio (`Product`, `Movement`, `Paged<T>`, DTOs) segundo `AGENTS.md`, mas hoje só contém `ApiError` e `ProductStockSummary` — a maior parte dos tipos ainda está duplicada em `packages/frontend/src/api/types.ts`.
- `render.yaml` está vazio (`services: []`) e `packages/frontend/netlify.toml` tem um placeholder literal não substituído (`https://SUA-API-RENDER.aqui`) — configuração de deploy não está pronta para produção real.
- Migração do ESLint para flat config ainda pendente (mencionada em `AGENTS.md`; não verificado nesta análise se `eslint.config.js` já é flat config ou não).
- `seed.ts` grava movimentações de estoque inicial diretamente via `PrismaClient`, sem passar pelo `StockService` — dados gerados pelo seed não têm `previousQuantity`/`newQuantity`/`userId` como os dados criados via API.
- `DELETE /products/:id` é hard-delete com cascata manual das movimentações — qualquer histórico de auditoria de um produto excluído é perdido permanentemente.
- `MovementType.ADJUSTMENT` existe no schema/banco mas não tem nenhuma rota, UI ou regra de negócio associada — é uma capacidade do banco sem uso definido ainda. **(Resolvido em 28/08/2026 pela feature Ajuste de Estoque; a linha fica aqui porque o restante deste documento reflete o repositório em 27/08/2026.)**

Da revisão final de Ajuste de Estoque (28/08/2026) — detalhe de cada item em `docs/features/ajuste-estoque/review.md`, nenhum é bug atual e nenhum tem prioridade atribuída:

- **A1** — `AdjustmentFormModal` não gerencia o foco explicitamente na troca entre os passos `form`/`confirm`/`conflict`; hoje o foco é recuperado por um fallback do Radix, não por desenho.
- **A4** — a região `aria-live` do preview de saldo é montada junto com o próprio conteúdo, então deixa de anunciar no fluxo de revisão pós-conflito.
- **A5** — a seta `→` usada entre saldo anterior e novo saldo pode não ser anunciada por leitor de tela; o significado hoje se apoia na coluna de diferença ao lado.
- **A6** — `ui/Input.tsx` renderiza a mensagem de erro sem `role="alert"`, divergindo de outros campos do mesmo formulário. Dívida do primitivo, não de quem o consome.
- **#8** — `GET /products/:id/movements` espalha o registro cru da movimentação (inclui `userId`, `referenceType`, `referenceId`) em vez de projetar um DTO mínimo explícito, como `quick-out.ts` já faz.
- **#11** — `StockMovement.userId` usa `ON DELETE SET NULL`: se exclusão de usuário for introduzida no futuro, a autoria dos ajustes já gravados some silenciosamente.

# Riscos

- **Token JWT em `localStorage`**: acessível a qualquer script executando no mesmo documento — se surgir uma vulnerabilidade de XSS em algum componente, o token pode ser exfiltrado. Não há evidência de tal vulnerabilidade hoje; é um risco estrutural da escolha de armazenamento, não um bug encontrado.
- **Ausência de RBAC**: qualquer conta comprometida (ou qualquer usuário legítimo) tem acesso irrestrito a todas as operações, incluindo exclusão de produtos e movimentação de estoque.
- **Deploy não configurado de fato**: `render.yaml` vazio e `netlify.toml` com placeholder significam que não há garantia de que um deploy real funcione sem intervenção manual adicional — não verificado nesta análise se existe um ambiente de produção já funcionando por fora desses arquivos.
- **Dependência de Postgres real para validar mudanças de schema/estoque**: sem um Postgres acessível, não é possível rodar `prisma migrate`, a suíte de testes de backend, nem confirmar em CI local que uma mudança de concorrência/transação está correta — só lint, typecheck e build de schema são verificáveis sem banco.
- **Exposição do e-mail do responsável (risco aceito, 28/08/2026)**: o histórico de movimentações devolve o e-mail de quem fez cada movimentação, o que permite a qualquer usuário autenticado enumerar contas válidas — algo que a rota de login evita de propósito. Aceito conscientemente porque a feature existe para auditoria operacional e `User` não tem outro identificador humano hoje; reavaliar se surgir `name`/`displayName` ou uma política de privacidade diferente. Ver `docs/features/ajuste-estoque/review.md` (#7).
- **Agregação de `ADJUSTMENT` em memória (risco aceito, 28/08/2026)**: o cálculo de saldo carrega uma linha por ajuste para a memória do Node em vez de agregar no banco. Funcionalmente correto; pode não escalar conforme o volume de ajustes crescer. Aceito como dívida de performance, sem otimização agora. Ver `docs/features/ajuste-estoque/review.md` (#10).
- **Exclusão em massa e "zerar saldo em massa"** (`useProductMutations.removeProducts`, `zeroBalances`) usam `Promise.allSettled` por item — uma falha parcial é reportada ("falhou X de Y"), mas não há transação atômica cobrindo o lote inteiro; um lote pode terminar parcialmente aplicado.

# Questões em Aberto

- É necessário introduzir um modelo de papéis/permissões (`ADMIN`/`MANAGER`/`OPERATOR`/`VIEWER`) a curto prazo, ou a ausência de RBAC é aceitável para o estágio atual do projeto?
- `packages/shared` deve se tornar a fonte única de tipos agora, ou essa migração fica para quando o próximo pacote (ex.: um cliente mobile) precisar reusar os mesmos tipos?
- A menção em `AGENTS.md` a "3 sistemas de modal legados" ainda é válida, ou já foi resolvida e o texto do backlog ficou desatualizado?
- Vale a pena definir a semântica de `ADJUSTMENT` (sinal, motivo obrigatório, quem pode ajustar) antes de qualquer outra evolução do domínio, já que o tipo já existe no banco sem uso?
- O seed (`seed.ts`) deveria passar a usar o `StockService` para manter os dados de desenvolvimento consistentes com o que a API real produz, ou seu propósito (dados de demonstração rápidos) não justifica esse custo?
- Existe algum ambiente de produção real hoje (Render/Netlify) apesar de `render.yaml`/`netlify.toml` não estarem preenchidos, ou o projeto roda só localmente até este momento? Não foi possível confirmar por leitura do repositório.
