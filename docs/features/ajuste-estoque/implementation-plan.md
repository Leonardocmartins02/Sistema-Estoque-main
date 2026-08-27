# IMPLEMENTATION PLAN — Ajuste de Estoque

> Transforma `PRD.md` em tarefas executáveis. Nenhum código foi alterado nesta fase — apenas inspeção do código real e este documento.

## 1. Inspeção técnica — o que já existe

**Backend**
- `packages/backend/prisma/schema.prisma`: `StockMovement` já tem `previousQuantity Int?`, `newQuantity Int?`, `userId String?` (FK `User?`, `ON DELETE SET NULL`), `referenceType/referenceId`, e o enum `MovementType` já inclui `ADJUSTMENT` e `INITIAL_STOCK`. `User` só tem `id`, `email`, `passwordHash`, `createdAt`, `updatedAt` — **não existe campo `name`**.
- `packages/backend/src/services/stockService.ts`: `recordMovementInTx`/`recordMovement` cobrem `IN`/`OUT`/`INITIAL_STOCK` via `SIGNED_DIRECTION` (sinal fixo por tipo) + `currentBalance()` (helper interno de `groupBy`). `ADJUSTMENT` está deliberadamente fora do union `RecordableMovementType` (comentário no próprio arquivo explica que a regra de negócio ainda não existia) — este é exatamente o ponto de extensão desta feature.
- `packages/backend/src/routes/movements.ts`: `POST /:id/movements` chama `recordMovement`; `GET /:id/movements` retorna `stockMovement.findMany` **sem** `include` — não traz e-mail do usuário. Filtro de tipo (`movementListQuerySchema`) é `z.enum(['IN', 'OUT'])` — não aceita `ADJUSTMENT`.
- `packages/backend/src/routes/index.ts`: padrão de montagem `router.use('/products', requireAuth, <router>)`, repetido por `products`/`movements`; `quick-out` é montado em `/quick-out`. Um router novo para ajustes segue o mesmo padrão de `movements`.
- `packages/backend/src/shared/httpError.ts`: `HttpError(status, message)`, único mecanismo de erro intencional do projeto — 409 se expressa como `new HttpError(409, '...')`, igual a como 404/422 já são usados em `movements.ts`/`quick-out.ts`.
- Testes: `test/stockService.test.ts` (Fase 1, criado nesta mesma linha de trabalho) já testa `IN`/`OUT`/`INITIAL_STOCK` via HTTP (supertest), não via chamada direta à função do serviço — é o padrão de teste do projeto para o `StockService`, não uma unidade isolada. `test/movements.concurrency.test.ts` prova duas saídas concorrentes com `Promise.all` + lock; é o modelo a seguir para provar que dois ajustes concorrentes nunca aplicam ambos. `test/helpers/db.ts`/`auth.ts` já dão `resetDb()`/`createTestUser`/`loginAndGetToken`.

**Frontend**
- `packages/frontend/src/api/httpClient.ts`: `apiFetch` central, `ApiRequestError` tipado com `status`; todo cliente de API deve passar por aqui.
- `packages/frontend/src/api/movements.ts`/`products.ts`: funções finas por endpoint, sem lógica — `fetchMovements`/`createMovement` são o modelo para um `api/adjustments.ts` novo.
- `packages/frontend/src/api/types.ts`: `Movement` hoje é `{ id, productId, type: 'IN'|'OUT'|'INITIAL_STOCK', quantity, date, note?, createdAt }` — **não tem** `previousQuantity`/`newQuantity`/informação de usuário. Precisa crescer.
- `packages/frontend/src/components/MovementFormModal.tsx`: **usa o primitivo `Modal` real** corretamente (`import Modal from './ui/Modal'`), `useForm` + `zodResolver`, `useMutation` local (não centralizado em `useProductMutations`), `serverError` local para erro de servidor, toast de sucesso/erro. **Este é o padrão de referência para `AdjustmentFormModal`.**
- `packages/frontend/src/components/QuickOutModal.tsx`: **não usa o `Modal` primitivo** — é uma implementação própria com `createPortal` direto num `<div>` fixo, tem `console.log` de debug espalhado, blocos de erro duplicados literalmente. Isso viola a regra do próprio `AGENTS.md` ("um único primitivo de modal acessível... não introduzir um novo sistema de diálogo"). **Registrado como dívida pré-existente, fora do escopo** — não é tocado por esta feature, e `AdjustmentFormModal` **não deve seguir este padrão**, deve seguir `MovementFormModal.tsx`.
- `packages/frontend/src/components/MovementHistoryModal.tsx`: tabela com colunas Data/Tipo/Quantidade/Obs; filtro `type` hoje é `'' | 'IN' | 'OUT'`; célula "Tipo" hoje é texto colorido cru (`m.type === 'OUT' ? 'text-red-700' : 'text-green-700'`); célula "Quantidade" mostra `m.quantity` cru. Precisa de extensão real (não é redesign).
- `packages/frontend/src/components/products/ProductActionsMenu.tsx`: itens hoje, nesta ordem — `Editar`, `Ver Histórico`, `Zerar Estoque` (desabilitado se `balance <= 0`), `Excluir` (destrutivo). `MenuPopover`/`MenuItem` já dão o primitivo de menu acessível.
- `packages/frontend/src/components/ProductDashboard.tsx`: orquestrador — cada diálogo é `useState` + uma instância montada uma vez, todas as props vêm de cá (`movingProductId`, `historyProductId`, `quickOutProduct`, etc.). Um `adjustingProduct: ProductWithBalance | null` novo segue exatamente esse padrão.
- `packages/frontend/src/components/ui/Badge.tsx`: já existe com variantes `success/warning/danger/info/neutral`, sempre com texto — é o componente certo para dar identificação textual (não só cor) a uma linha `ADJUSTMENT` no histórico.
- `packages/frontend/src/hooks/useProductMutations.ts`: mutações centralizadas aqui são as que **múltiplos componentes** disparam (excluir, zerar). O ajuste tem fluxo próprio de conflito que não se parece com as mutações existentes — segue o padrão de `MovementFormModal` (mutação local no próprio modal), não entra neste hook.
- Query keys reais confirmadas por grep: `['products', ...]` (listagem, `useProductsQuery.ts`), `['products', 'summary']` (`useProductStockSummary.ts`), `['movements', productId, ...]` (`MovementHistoryModal.tsx`). `invalidateQueries({ queryKey: ['products'] })` já invalida listagem **e** resumo (prefixo compartilhado) — é o que `invalidateProducts` de `useProductMutations.ts` faz hoje.
- Testes: `test/MovementFormModal.test.tsx` é o modelo de teste de formulário (mocka o módulo de API, `QueryClientProvider` + `ToastProvider` como wrapper, `userEvent`).

**Shared**
- `packages/shared/src/index.ts` só tem `ApiError`/`ProductStockSummary`. `Movement`/`Product`/`Paged<T>` continuam duplicados em `packages/frontend/src/api/types.ts` (dívida já registrada em `docs/current-state.md`). **Esta feature não migra tipos para `packages/shared`** — seguimos o padrão atual (tipos locais no frontend), para não expandir escopo.

## 2. Decisões que fecham as questões não bloqueantes do PRD

**Responsável no histórico**: `User` só tem `email` como identificador (não há `name`). A representação do responsável é o **e-mail do usuário** (mesmo campo já exibido no header do app e em `GET /auth/me`), obtido via `include: { user: { select: { email: true } } }` na consulta de `GET /:id/movements`. Quando `userId`/relação ausente: texto fixo **"Usuário não disponível"** (decisão já travada na mensagem do usuário desta fase).

**Representação visual de `ADJUSTMENT` no histórico**: a célula "Tipo" passa a renderizar um `Badge` (componente já existente) com o texto **"AJUSTE"**, variante `info` (cor neutra-azulada, deliberadamente distinta do verde/vermelho binário de `IN`/`OUT` — um ajuste não é semanticamente "entrada" nem "saída" pura). A célula "Quantidade" passa a ter um branch condicional: para `IN`/`OUT`/`INITIAL_STOCK`, comportamento inalterado (`quantity` cru); para `ADJUSTMENT`, mostra `previousQuantity → newQuantity` e a diferença com sinal em texto colorido (verde se positiva, vermelho se negativa) **ao lado** do texto "AJUSTE" do badge — ou seja, a identificação do tipo nunca depende só de cor (tem o texto "AJUSTE"), e a direção da diferença tem cor **e** sinal textual (`+2`/`-2`), não só cor. Isso é uma extensão pontual de duas células existentes, não um redesenho da tabela.

**Posição no `ProductActionsMenu`**: entre `Ver Histórico` e `Zerar Estoque` — agrupa semanticamente as duas ações que alteram saldo (`Ajustar Estoque`, `Zerar Estoque`) uma ao lado da outra, mantendo `Editar`/`Ver Histórico` (ações de metadados/consulta) antes e `Excluir` (destrutiva) por último, exatamente onde já está. Nenhum item existente muda de posição relativa.

## 3. Impacto no modelo de dados

**Sem alteração de schema / sem migration.** `MovementType.ADJUSTMENT` e todos os campos de auditoria (`previousQuantity`, `newQuantity`, `userId`, `note` para o motivo) já existem desde a Fase 1. Esta feature é inteiramente lógica de aplicação (serviço + rota + UI) sobre um schema já pronto.

## 4. Tarefas

### Task 1 — Backend: `StockService.recordAdjustment` + `POST /products/:id/adjustments`

**Objetivo**: registrar um ajuste de estoque (saldo alvo → `ADJUSTMENT` auditável) com verificação de conflito de concorrência, dentro do `StockService`.

**Motivação**: RF1, RF2, RF3, RF4, RF5, RF6, RF7, RF8, RF13, RF14, NFR1–NFR4, NFR6 do PRD.

**Dependências**: nenhuma (fundação).

**Áreas/arquivos afetados**:
- `packages/backend/src/services/stockService.ts` (alterado — nova função, sem tocar `recordMovementInTx`/`SIGNED_DIRECTION` existentes)
- `packages/backend/src/routes/adjustments.ts` (novo)
- `packages/backend/src/routes/index.ts` (alterado — montar o novo router)
- `packages/backend/test/adjustments.test.ts` (novo)

**Alterações**:
- Nova função no `StockService` (ex.: `recordAdjustmentInTx(tx, input)` + `recordAdjustment(input)` seguindo o mesmo par que já existe para `recordMovementInTx`/`recordMovement`), com input `{ productId, targetQuantity, expectedPreviousQuantity, reason, userId }`. Dentro da transação: mesmo `SELECT ... FOR UPDATE` + `currentBalance()` já usados; compara `currentBalance` com `expectedPreviousQuantity` — se divergir, lança `HttpError(409, ...)`; se `targetQuantity === currentBalance`, lança `HttpError(400, ...)` (nenhuma movimentação); senão grava `StockMovement` com `type: 'ADJUSTMENT'`, `previousQuantity = currentBalance`, `newQuantity = targetQuantity`, `quantity = Math.abs(targetQuantity - currentBalance)`, `note = reason`, `userId`. Esta função **não** entra no union `RecordableMovementType`/`SIGNED_DIRECTION` existente — é um caminho de cálculo próprio dentro do mesmo arquivo, como já registrado em `idea.md`.
- Novo router `adjustments.ts`: `POST /:id/adjustments`, Zod (`targetQuantity: z.number().int().min(0)`, `expectedPreviousQuantity: z.number().int().min(0)`, `reason: z.string().trim().min(1).max(500)`), chama `recordAdjustment` com `userId: req.user!.id`, responde `201` com o movimento criado.
- `routes/index.ts`: `router.use('/products', requireAuth, adjustments)`, mesmo padrão de `movements`.

**Testes** (TDD — escritos antes/junto, seguindo o estilo HTTP/supertest já usado em `stockService.test.ts`):
- Ajuste para baixo: saldo 20 → alvo 18 ⇒ 201, `previousQuantity=20`, `newQuantity=18`, `quantity=2`.
- Ajuste para cima: saldo 10 → alvo 12 ⇒ 201, valores simétricos.
- Ajuste para zero: saldo 5 → alvo 0 ⇒ 201, `newQuantity=0`.
- Alvo igual ao saldo atual ⇒ 400, nenhuma `StockMovement` criada (assert por `count`).
- Alvo negativo ⇒ 400 (rejeitado na borda Zod).
- Motivo vazio/só espaço ⇒ 400.
- Motivo com 501 caracteres ⇒ 400; com exatamente 500 ⇒ aceito.
- `userId` do corpo é ignorado — movimentação criada usa sempre `req.user.id` (mesmo teste-padrão já usado em `stockService.test.ts` para `IN`).
- Conflito: cria produto com saldo 20; muda saldo real para 15 (nova movimentação `IN`/`OUT` direta); chama o endpoint com `expectedPreviousQuantity: 20`, `targetQuantity: 18` ⇒ 409, nenhuma movimentação nova criada.
- Concorrência real: duas chamadas simultâneas (`Promise.all`, mesmo padrão de `movements.concurrency.test.ts`) com o mesmo `expectedPreviousQuantity` disputando o mesmo produto — no máximo uma pode suceder; a segunda recebe 409 (porque o saldo já mudou quando ela chega no lock) ou 400 se o alvo dela coincidir com o novo saldo — o teste verifica que nunca as duas sucedem.
- Sem autenticação ⇒ 401 (mesmo padrão já coberto para as outras rotas mutáveis).

**Critérios de aceite**: todos os cenários acima passam contra Postgres real; nenhuma alteração de comportamento em `IN`/`OUT`/`INITIAL_STOCK` (suíte existente continua verde, especialmente `movements.concurrency.test.ts` sem modificação).

**Definição de pronto**: `pnpm --filter @simplestock/backend run lint`, `run typecheck`, `test` verdes; `HttpError`/padrão de erro global reaproveitados, nenhum `err.message` cru vazando fora do já existente.

**Commit sugerido**: `feat(stock): registrar ajuste de estoque com verificação de conflito de concorrência`

---

### Task 2 — Backend: histórico inclui `ADJUSTMENT` (filtro + autor)

**Objetivo**: `GET /:id/movements` aceita `ADJUSTMENT` no filtro de tipo e retorna o e-mail do autor da movimentação, quando existir.

**Motivação**: RF15, RF17 (parte backend), NFR6 (parte de exibição de auditoria) do PRD.

**Dependências**: nenhuma — usa dados de `StockMovement` já existentes no schema; não depende da Task 1 (o teste pode criar uma `StockMovement` tipo `ADJUSTMENT` direto via Prisma, sem passar pelo endpoint novo). **Paralelizável com a Task 1.**

**Áreas/arquivos afetados**:
- `packages/backend/src/routes/movements.ts` (alterado)
- `packages/backend/test/movements.query.test.ts` (alterado — casos novos)

**Alterações**:
- `movementListQuerySchema.type`: `z.enum(['IN', 'OUT'])` → `z.enum(['IN', 'OUT', 'ADJUSTMENT', 'INITIAL_STOCK'])` (inclui `INITIAL_STOCK` também, já que ele existe desde a Fase 1 e hoje é inconsistentemente omitido do filtro — pequena correção adjacente, registrada aqui porque é necessária para o mesmo tipo de gap que motiva esta task, não escopo novo inventado).
- `GET /:id/movements`: `stockMovement.findMany` passa a incluir `include: { user: { select: { email: true } } }`; a resposta de cada item ganha um campo com o e-mail do autor (ex.: `userEmail: movement.user?.email ?? null` no mapeamento de resposta, mantendo o restante do objeto como está).

**Testes**:
- `GET /:id/movements?type=ADJUSTMENT` retorna só movimentações desse tipo.
- Uma movimentação com `userId` preenchido retorna o e-mail correto do usuário.
- Uma movimentação com `userId` nulo (simulando registro antigo) retorna o campo de autor como `null`, sem quebrar a resposta.

**Critérios de aceite**: filtro e campo de autor funcionam; testes de listagem/paginação/filtro existentes continuam passando sem alteração de contrato para `IN`/`OUT`.

**Definição de pronto**: lint/typecheck/test do backend verdes.

**Commit sugerido**: `feat(stock): incluir ADJUSTMENT no filtro de histórico e retornar autor da movimentação`

---

### Task 3 — Frontend: tipos e cliente de API

**Objetivo**: `Movement` (tipo local do frontend) e os clientes de API refletem o contrato real das Tasks 1 e 2.

**Motivação**: base para RF1, RF9, RF10, RF15–RF20 (frontend depende destes tipos para tudo que segue).

**Dependências**: Task 1 e Task 2 (precisa do contrato real de resposta confirmado, não só do desenhado no PRD/RESEARCH, para não divergir).

**Áreas/arquivos afetados**:
- `packages/frontend/src/api/types.ts` (alterado)
- `packages/frontend/src/api/adjustments.ts` (novo)
- `packages/frontend/src/api/movements.ts` (alterado — filtro de tipo)

**Alterações**:
- `Movement`: `type` passa a incluir `'ADJUSTMENT'`; ganha `previousQuantity?: number | null`, `newQuantity?: number | null`, `userEmail?: string | null` (todos opcionais/nuláveis — refletindo que registros antigos podem não os ter).
- `api/adjustments.ts`: `createAdjustment(productId, { targetQuantity, expectedPreviousQuantity, reason }): Promise<Movement>`, seguindo exatamente a forma de `createMovement` em `api/movements.ts`.
- `fetchMovements`: assinatura de `filters.type` ganha `'ADJUSTMENT'` como valor aceito.

**Testes**: não há comportamento próprio para testar isoladamente aqui (é só tipo + função fina de fetch, mesmo padrão de `createMovement`, que também não tem teste próprio — é exercitado pelos testes de componente das Tasks 4/5/7). Nenhum teste novo dedicado a este arquivo, para não criar teste redundante.

**Critérios de aceite**: `pnpm --filter @simplestock/frontend run typecheck` passa; nenhum consumidor existente de `Movement`/`fetchMovements`/`createMovement` quebra.

**Definição de pronto**: lint/typecheck do frontend verdes.

**Commit sugerido**: `feat(stock): adicionar tipos e cliente de API para ajuste de estoque`

---

### Task 4 — Frontend: `AdjustmentFormModal` (fluxo principal)

**Objetivo**: formulário de ajuste completo — saldo atual, campo "Nova quantidade", motivo, preview ao vivo, confirmação estruturada usando o `Modal` primitivo, envio, sucesso, cancelamento, erros de validação/HTTP genérico. **Sem** o tratamento de conflito 409 ainda (Task 5).

**Motivação**: RF1, RF3 (frontend), RF5 (bloqueio antes da confirmação), RF6, RF9, RF10, NFR5 do PRD.

**Dependências**: Task 3.

**Áreas/arquivos afetados**:
- `packages/frontend/src/components/AdjustmentFormModal.tsx` (novo)
- `packages/frontend/test/AdjustmentFormModal.test.tsx` (novo)

**Alterações**:
- Componente modelado em `MovementFormModal.tsx`: `useForm` + `zodResolver` (schema local: `targetQuantity: z.coerce.number().int().min(0)`, `reason: z.string().trim().min(1).max(500)`), `useMutation` local chamando `createAdjustment`, `useToast` para sucesso/erro, `serverError` local para erro genérico de servidor.
- Recebe `product: { id, name, sku, balance }` como prop (mesmo padrão de dado já disponível em `ProductWithBalance`, evita um fetch extra — mesma decisão já usada por `QuickOutModal` para receber o produto, só que aqui montado sobre o `Modal` primitivo real).
- Estado de dois passos dentro do próprio componente (`'form' | 'confirm'`), sem usar `ConfirmDialog`/`useConfirm` (decisão de escopo do PRD): passo `'confirm'` reaproveita o `Modal` primitivo com um corpo estruturado (produto, saldo atual, novo saldo, diferença, motivo) e os botões de rodapé (`footer` do `ModalProps`).
- Preview ao vivo: computado do valor observado do campo (`watch`) vs. `product.balance`, exibido como `${balance} → ${target}` + `Diferença: ${sinal}${diff}`.
- Bloqueio de "mesmo saldo": erro inline + confirmação desabilitada quando `target === product.balance` (validação de UI; a garantia real continua sendo o backend, RF5).
- Envio só ocorre a partir do passo `'confirm'`, nunca do primeiro submit do formulário.

**Testes** (RTL, mockando `createAdjustment`, mesmo padrão de `MovementFormModal.test.tsx`):
- Preenche saldo alvo + motivo válidos → avança para confirmação → confirmação mostra saldo atual/novo saldo/diferença/motivo corretos.
- Não chama `createAdjustment` antes de confirmar no passo de confirmação.
- Confirmar dispara `createAdjustment` com o payload correto (`targetQuantity`, `expectedPreviousQuantity = product.balance`, `reason`).
- Alvo igual ao saldo atual: confirmação bloqueada, erro inline visível.
- Alvo negativo/motivo vazio/motivo > 500: erro inline, não avança para confirmação.
- Loading: botão de confirmação desabilitado com indicador enquanto a mutação está pendente.
- Sucesso: modal fecha, toast de sucesso, callback `onSuccess` chamado.
- Erro HTTP genérico (não 409): volta para o formulário (não fecha), mostra erro, dados preservados.
- Cancelar em qualquer passo: nenhuma chamada a `createAdjustment`.

**Critérios de aceite**: todos os testes acima passam; componente usa `Modal` (import verificável no arquivo), não `ConfirmDialog`/`useConfirm`.

**Definição de pronto**: lint/typecheck/test do frontend verdes.

**Commit sugerido**: `feat(stock): criar AdjustmentFormModal com preview e confirmação`

---

### Task 5 — Frontend: `AdjustmentFormModal` (conflito 409)

**Objetivo**: estender o componente da Task 4 com o estado de conflito — mensagem explícita, atualização de baseline, limpeza do campo numérico, preservação do motivo, exigência de reconhecimento explícito.

**Motivação**: RF7 (reação ao 409), RF11, RF12 do PRD.

**Dependências**: Task 4 (mesmo arquivo/componente).

**Áreas/arquivos afetados**:
- `packages/frontend/src/components/AdjustmentFormModal.tsx` (alterado)
- `packages/frontend/test/AdjustmentFormModal.test.tsx` (alterado — casos novos)

**Alterações**:
- Captura de erro da mutação verifica `error instanceof ApiRequestError && error.status === 409`; nesse caso, entra num terceiro estado (`'conflict'`) em vez do tratamento de erro genérico da Task 4.
- Estado `'conflict'` mostra o saldo que o usuário via (`expectedPreviousQuantity` local) e o saldo atual real (obtido re-buscando o produto — reaproveita a query de produto já existente, ex. invalidando/reobtendo via `queryClient`, ou usando o corpo do erro se o backend o incluir; a forma exata de obter o saldo atualizado sem duplicar lógica de fetch é decisão de execução, não de contrato).
- Botão "Revisar" (única ação além de cancelar): atualiza a baseline interna (`expectedPreviousQuantity` = saldo real novo), limpa o campo `targetQuantity`, **preserva** o campo `reason`, volta para o passo `'form'`.

**Testes**:
- Mutação retorna 409 → estado de conflito exibido com os dois saldos (visto vs. real).
- Clicar "Revisar" volta ao formulário com campo de quantidade vazio e motivo preservado.
- Novo envio após "Revisar" usa o `expectedPreviousQuantity` atualizado (não o original).
- Conflito não fecha o modal nem chama `onSuccess`.

**Critérios de aceite**: cenário completo de conflito (idêntico ao critério de aceite "Conflito concorrente" do PRD) reproduzido em teste de componente.

**Definição de pronto**: lint/typecheck/test do frontend verdes.

**Commit sugerido**: `feat(stock): tratar conflito de concorrência no AdjustmentFormModal`

---

### Task 6 — Frontend: integração no menu e no orquestrador

**Objetivo**: ação "Ajustar Estoque" disponível e funcional a partir da tela de produtos.

**Motivação**: RF21 do PRD; fecha o fluxo ponta a ponta do usuário.

**Dependências**: Task 5.

**Áreas/arquivos afetados**:
- `packages/frontend/src/components/products/ProductActionsMenu.tsx` (alterado)
- `packages/frontend/src/components/products/types.ts` (alterado — `ProductActions` ganha `onAdjust`)
- `packages/frontend/src/components/ProductDashboard.tsx` (alterado)
- `packages/frontend/test/ProductActionsMenu.test.tsx` (novo, se não existir — verificar durante a execução; caso já exista teste equivalente, estender)

**Alterações**:
- `ProductActionsMenu.tsx`: novo `MenuItem` "Ajustar Estoque" entre "Ver Histórico" e "Zerar Estoque" (decisão da seção 2), chamando `actions.onAdjust(product)`.
- `ProductActionsMenu`'s `Props.actions` (`Pick<ProductActions, ...>`) ganha `'onAdjust'`.
- `ProductDashboard.tsx`: novo estado `adjustingProduct: ProductWithBalance | null`; `actions.onAdjust = (p) => setAdjustingProduct(p)`; nova instância de `<AdjustmentFormModal>` montada uma vez (mesmo padrão de `MovementFormModal`), com `onSuccess` invalidando `['products']` **e** `['movements', adjustingProduct.id]` (cobre saldo/listagem/resumo e histórico do produto ajustado).
- Aceita-se que `ProductDashboard.tsx` ganha mais um bloco de estado/orquestração (mais um `useState`, mais uma instância de modal) — é a mesma dívida de "componente-deus" já registrada em `docs/current-state.md`; **não é objetivo desta feature reduzi-la nem evitá-la às custas de uma abstração nova**, só reconhecê-la.

**Testes**:
- `ProductActionsMenu`: item "Ajustar Estoque" presente e na posição esperada (entre os dois já existentes); clique chama `actions.onAdjust`.
- Teste de integração leve em `ProductDashboard` (se o padrão de teste existente cobrir esse nível — verificar `test/App.test.tsx` como referência) ou cobertura via os testes já existentes de `AdjustmentFormModal` sendo suficiente — decidir durante a execução para não duplicar cobertura.

**Critérios de aceite**: fluxo completo clicável (menu → modal → confirmação → sucesso → saldo/histórico atualizados) funcional manualmente; testes automatizados cobrindo a integração do menu.

**Definição de pronto**: lint/typecheck/test/build do frontend verdes (build valida que nada quebrou na árvore de import).

**Commit sugerido**: `feat(stock): adicionar Ajustar Estoque ao menu de ações do produto`

---

### Task 7 — Frontend: `MovementHistoryModal` exibe `ADJUSTMENT`

**Objetivo**: histórico mostra ajustes com identificação textual, saldo anterior→novo saldo, diferença, motivo, responsável (ou "Usuário não disponível"), com filtro por tipo incluindo `ADJUSTMENT`, e degradação graciosa para registros antigos.

**Motivação**: RF15, RF16, RF17, RF18, RF19, RF20 do PRD.

**Dependências**: Task 3 (tipos) e Task 2 (dado real do backend). **Independente das Tasks 4–6 — paralelizável com elas** (arquivo/componente diferente, mesma origem de dados já definida pela Task 3).

**Áreas/arquivos afetados**:
- `packages/frontend/src/components/MovementHistoryModal.tsx` (alterado)
- `packages/frontend/test/MovementHistoryModal.test.tsx` (novo, se não existir — verificar durante a execução)

**Alterações**:
- `select` de filtro de tipo: adiciona `<option value="ADJUSTMENT">Ajuste</option>` (e opcionalmente `INITIAL_STOCK`, mas isso é opcional/observação — o requisito do PRD é só `ADJUSTMENT`); tipo do `useState` local (`'' | 'IN' | 'OUT'`) precisa ampliar para incluir `'ADJUSTMENT'`.
- Célula "Tipo": para `m.type === 'ADJUSTMENT'`, renderiza `<Badge variant="info">AJUSTE</Badge>` em vez do texto colorido cru atual; `IN`/`OUT` continuam como estão (não mexe no que já funciona).
- Célula "Quantidade": branch condicional — `ADJUSTMENT` com `previousQuantity`/`newQuantity` presentes mostra `${previousQuantity} → ${newQuantity}` + diferença com sinal colorida; `ADJUSTMENT` **sem** esses campos (registro antigo) mostra `m.quantity` cru + indicação textual curta de dado incompleto (mesma ideia do wireframe do `prototype.md`); `IN`/`OUT`/`INITIAL_STOCK` inalterados.
- Nova célula/coluna "Responsável" (ou reaproveitar a coluna "Obs" ampliando o cabeçalho, decisão de execução): `m.userEmail` quando presente, **"Usuário não disponível"** quando ausente — nunca vazio/omitido silenciosamente.

**Testes**:
- Lista contendo um `ADJUSTMENT` completo: mostra "AJUSTE" (texto), `20 → 18`, `-2`, motivo, e-mail do responsável, data.
- `ADJUSTMENT` sem `previousQuantity`/`newQuantity`/`userEmail` (simulando registro antigo): não quebra a renderização; mostra "Usuário não disponível"; mostra alguma indicação de dado incompleto em vez de `undefined`.
- Filtro por `type=ADJUSTMENT` envia o parâmetro correto para `fetchMovements` e a UI reflete a seleção.
- `IN`/`OUT` continuam renderizando exatamente como antes (teste de não-regressão).

**Critérios de aceite**: os quatro testes acima passam; nenhuma mudança visual/funcional em linhas `IN`/`OUT` existentes.

**Definição de pronto**: lint/typecheck/test do frontend verdes.

**Commit sugerido**: `feat(stock): exibir ADJUSTMENT no histórico de movimentações`

---

### Task 8 — Integração final

**Objetivo**: confirmar que o conjunto (backend + frontend) funciona ponta a ponta e que a suíte completa do monorepo continua verde.

**Motivação**: checklist de "pronto" do `AGENTS.md`; nenhum requisito novo — é a integração das Tasks 1–7.

**Dependências**: Task 6 e Task 7.

**Áreas/arquivos afetados**: nenhum arquivo novo esperado; possíveis ajustes pontuais de integração encontrados só nesta etapa (ex.: um tipo que não bateu entre backend real e o que a Task 3 assumiu).

**Alterações**: nenhuma planejada de antemão — esta task é verificação, não implementação nova. Se a verificação encontrar uma divergência, ela é corrigida aqui como um ajuste pequeno e registrado, não uma nova feature.

**Testes**: execução completa de `pnpm -r run lint`, `pnpm -r run typecheck`, `pnpm --filter @simplestock/backend test`, `pnpm --filter @simplestock/frontend test`, `pnpm -r run build` (checklist exato do `AGENTS.md`). Revisão manual do fluxo completo (produto com saldo → ajustar → confirmar → ver no histórico; e o cenário de conflito, se possível simular manualmente).

**Critérios de aceite**: checklist completo verde; todos os critérios de aceite do PRD revisitados um a um contra o comportamento real (matriz da seção 6 abaixo).

**Definição de pronto**: checklist do `AGENTS.md` completo, incluindo revisão de `security-reviewer` (rota nova mutável, autenticação, validação) e `accessibility-reviewer` (modal novo, badge, mensagens de erro) conforme a própria regra do `AGENTS.md` para mudanças que tocam rotas/auth/dados/UI.

**Commit sugerido**: `test(stock): validar integração ponta a ponta do ajuste de estoque` (se algo for corrigido) ou nenhum commit de código (se for só verificação).

## 5. TDD — onde o teste entra

Cada task acima já descreve o teste **antes/junto** da implementação (ciclo red→green descrito na seção "Testes" de cada task, seguindo o padrão HTTP/RTL já usado no projeto — não testes unitários isolados de função, que não é o padrão deste código-base). Nenhuma task tem "implementar tudo, testar depois": a ordem dentro de cada task é sempre escrever o teste que expõe o requisito (falha pelo motivo certo) → implementar o mínimo para passar → refatorar se necessário, exatamente como o `AGENTS.md` exige.

## 6. Concorrência — onde a responsabilidade vive

A verificação `expectedPreviousQuantity → lock → leitura do saldo real → comparação → 409 OU gravação` vive **inteiramente dentro de `recordAdjustmentInTx`, no `StockService`** (Task 1) — não na rota `adjustments.ts`. A rota só faz parsing HTTP (Zod) e repassa `req.user.id`; toda a decisão de negócio (lock, comparação, rejeição) fica no serviço. Isso significa que, se no futuro outro chamador (ex.: um processo de importação em lote, uma Fase 4/5 de compras) precisar registrar um ajuste sem passar pela rota HTTP, a proteção de concorrência continua valendo — não há duplicação de regra entre camada HTTP e camada de serviço. Mesma decisão arquitetural que já vale para `recordMovementInTx`/`recordMovement` desde a Fase 1.

## 7. Contrato da API (Task 1)

**Requisição**
```
POST /api/products/:id/adjustments
Authorization: Bearer <token>

{
  "targetQuantity": 18,
  "expectedPreviousQuantity": 20,
  "reason": "Contagem física mensal"
}
```

**Resposta de sucesso** — `201`, corpo é a `StockMovement` criada (mesmo formato que `POST /:id/movements` já retorna hoje — sem envelope adicional, consistente com o restante da API):
```
{
  "id": "...",
  "productId": "...",
  "type": "ADJUSTMENT",
  "quantity": 2,
  "previousQuantity": 20,
  "newQuantity": 18,
  "userId": "...",
  "note": "Contagem física mensal",
  "date": "...",
  "createdAt": "..."
}
```

**Resposta de conflito** — `409`, mesmo formato de erro já usado em todo o backend (`HttpError` → `{ message: string }` pelo handler global de `app.ts`), sem campo estruturado adicional além da mensagem — consistente com como 404/422 já se comportam em `movements.ts`/`quick-out.ts`.

**Resposta de validação inválida** (motivo vazio, alvo negativo, alvo igual ao atual) — `400`, mesmo padrão (`ZodError` → `{ message, errors }` para erros de schema; `HttpError(400, ...)` para a regra "alvo igual ao atual", que não é um erro de shape e sim de regra de negócio, decidida dentro do serviço).

## 8. Fluxo frontend (Tasks 4–6)

```
ProductActionsMenu ("Ajustar Estoque")
  → ProductDashboard.setAdjustingProduct(product)
  → AdjustmentFormModal aberto, passo 'form'
      → usuário preenche targetQuantity + reason
      → preview ao vivo (balance → target, diferença)
      → avança para passo 'confirm' (mesmo Modal, conteúdo trocado)
      → usuário confirma
      → mutation POST /adjustments
          → sucesso: fecha modal, toast, invalida ['products'] + ['movements', productId]
          → erro 409: passo 'conflict' (saldo visto vs. real, botão "Revisar")
              → "Revisar": atualiza baseline, limpa targetQuantity, preserva reason, volta a 'form'
          → outro erro: permanece em 'form'/'confirm' conforme onde ocorreu, com erro inline
```

## 9. Cache / React Query

- `['products']` (prefixo) — invalidado no sucesso do ajuste, cobre listagem (`useProductsQuery`) **e** resumo (`useProductStockSummary`), como já acontece hoje para `IN`/`OUT`/exclusão/zerar (mesmo padrão de `invalidateProducts`).
- `['movements', productId, ...]` — invalidado no sucesso do ajuste **para o produto ajustado**, para que o histórico (se aberto) reflita o novo ajuste imediatamente.
- Nenhuma outra query é tocada — não há necessidade de invalidar `['products', 'summary']` separadamente (o prefixo `['products']` já cobre) nem qualquer query de outro produto.

## 10. Fora do escopo (registrado, não vira task)

- RBAC, mudança de autenticação.
- Alteração de "Zerar Estoque".
- Refatoração geral do `ProductDashboard` (a dívida de componente-deus é reconhecida, não resolvida).
- Migração de tipos para `packages/shared`.
- Redesign do histórico além do necessário para `ADJUSTMENT`.
- Mudança em `ConfirmDialog`/`useConfirm` compartilhados.
- **Observação registrada, não corrigida**: `QuickOutModal.tsx` não usa o primitivo `Modal` (implementação própria com `createPortal`, `console.log` de debug, blocos de erro duplicados) — viola a regra de "primitivo único de modal" do próprio `AGENTS.md`. É uma dívida pré-existente e não relacionada a esta feature; não deve ser copiada como padrão para `AdjustmentFormModal`.
- Dependências novas: nenhuma necessária em nenhuma task.

## 11. Grafo de dependências

```
Task 1 (backend: endpoint de ajuste)      Task 2 (backend: histórico + autor)
        │                                          │
        └─────────────────┬────────────────────────┘
                           ▼
                  Task 3 (frontend: tipos/API)
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
   Task 4 (form — fluxo principal)   Task 7 (histórico exibe ADJUSTMENT)
              │
              ▼
   Task 5 (form — conflito 409)
              │
              ▼
   Task 6 (menu + orquestrador)
              │
              └────────────┬────────────┘
                           ▼
                  Task 8 (integração final)
```

**Sequencial obrigatória**: 1→3, 2→3, 3→4, 4→5, 5→6, (6 e 7)→8.
**Paralelizável**: Task 1 com Task 2 (arquivos e testes diferentes, nenhum contrato compartilhado entre elas). Task 7 com Tasks 4/5/6 (componentes diferentes, ambos só dependem da Task 3 já fechada).
**Não paralelizado de propósito**: Tasks 4 e 5 modificam o mesmo arquivo (`AdjustmentFormModal.tsx`) — sequenciais para evitar conflito de merge, mesmo sendo tecnicamente duas responsabilidades separáveis.
**Integração final**: Task 8, só depois de tudo convergir.

## 12. Matriz PRD → Task → Teste

| Requisito/Critério do PRD | Task | Teste |
|---|---|---|
| RF1 — saldo alvo, nunca delta | 1, 4 | Task 1: HTTP asserts `previousQuantity`/`newQuantity` a partir de `targetQuantity`. Task 4: RTL assert campo rotulado "Nova quantidade". |
| RF2 — backend deriva diferença | 1 | Task 1: `quantity = abs(diff)` calculado server-side. |
| RF3 — motivo obrigatório, ≤500 | 1, 4 | Task 1: vazio/501 chars → 400; 500 chars → aceito. Task 4: erro inline equivalente. |
| RF4 — rejeita alvo negativo | 1 | Task 1: alvo negativo → 400. |
| RF5 — mesmo saldo não gera movimentação | 1, 4 | Task 1: alvo=atual → 400, count inalterado. Task 4: confirmação bloqueada antes do envio. |
| RF6 — permite alvo zero | 1 | Task 1: alvo=0 → 201. |
| RF7 — verificação `expectedPreviousQuantity` | 1 | Task 1: cenário de conflito → 409. |
| RF8 — nunca "último vence" | 1 | Task 1: teste de concorrência real (`Promise.all`). |
| RF9 — confirmação explícita antes de gravar | 4 | Task 4: mutação só dispara a partir do passo de confirmação. |
| RF10 — preview saldo→saldo + diferença | 4 | Task 4: preview reflete valores digitados. |
| RF11 — conflito comunica saldo visto vs. real | 5 | Task 5: estado de conflito exibe os dois saldos. |
| RF12 — motivo preservado no conflito | 5 | Task 5: campo `reason` intacto após "Revisar". |
| RF13 — `userId` da sessão, nunca do body | 1 | Task 1: `userId` forjado no corpo é ignorado. |
| RF14 — `ADJUSTMENT` imutável | 1 | Garantido por ausência de rota de edição/exclusão — verificado por revisão de código, sem teste automatizado dedicado (não há o que testar sobre uma capacidade que não existe). |
| RF15 — filtro de tipo inclui `ADJUSTMENT` | 2, 7 | Task 2: `?type=ADJUSTMENT` filtra corretamente. Task 7: opção presente no seletor. |
| RF16 — histórico mostra `previousQuantity → newQuantity` + diferença | 7 | Task 7: linha renderiza os três valores. |
| RF17 — motivo/responsável/data no histórico | 2, 7 | Task 2: resposta inclui e-mail do autor. Task 7: renderização inclui os três campos. |
| RF18 — "Usuário não disponível" quando ausente | 7 | Task 7: movimentação sem `userEmail` renderiza o texto fixo. |
| RF19 — histórico funciona com registros antigos incompletos | 2, 7 | Task 2: resposta não quebra com `userId` nulo. Task 7: renderização não quebra sem `previousQuantity`/`newQuantity`. |
| RF20 — identificação textual, não só cor | 7 | Task 7: assert de conteúdo textual "AJUSTE", não só classe CSS. |
| RF21 — ação no menu do produto | 6 | Task 6: item presente e funcional no `ProductActionsMenu`. |
| NFR1 — transação + lock | 1 | Reaproveita mecanismo já testado (`movements.concurrency.test.ts`); Task 1 tem seu próprio teste de concorrência. |
| NFR2 — validação backend independente do cliente | 1 | Task 1: testes batem diretamente na API, sem passar pela UI. |
| NFR3 — HTTP 409 | 1 | Task 1: cenário de conflito. |
| NFR4 — endpoint dedicado | 1 | Estrutural — o próprio path da rota criada. |
| NFR5 — `Modal` primitivo, não `ConfirmDialog` | 4 | Verificado por revisão de código (import de `Modal`, ausência de `ConfirmDialog`/`useConfirm` no arquivo). |
| NFR6 — nenhum dado de auditoria ausente em ajuste novo | 1 | Mesmo teste de RF1/RF2 — todos os campos sempre preenchidos. |

Todos os critérios de aceite Given/When/Then do PRD (ajuste pra cima/baixo/zero, mesmo saldo, negativo, motivo vazio/acima do limite, conflito, confirmação, cancelamento, histórico, dados antigos, erro inesperado) têm task e teste correspondentes na tabela acima ou nas seções de teste das Tasks 1, 4, 5 e 7. Nenhuma task da lista existe sem satisfazer pelo menos um requisito — Task 8 é a exceção esperada (integração, não requisito novo).
