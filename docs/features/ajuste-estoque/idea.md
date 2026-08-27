# IDEA — Ajuste de Estoque (ADJUSTMENT)

> Fase 1 do workflow (`IDEA → RESEARCH → PROTOTYPE → PRD → IMPLEMENTATION PLAN → EXECUTION → QA`). Este documento define O PROBLEMA e AS REGRAS DE NEGÓCIO. Não decide forma de endpoint, estrutura de arquivo ou detalhe de implementação — isso é RESEARCH/PRD/PLAN.

## Problema

O sistema já modela `StockMovement.type = ADJUSTMENT` no schema Prisma (`packages/backend/prisma/schema.prisma`), mas nenhuma rota, serviço ou UI usa esse tipo. Hoje, quando o saldo do sistema diverge do estoque físico (perda, avaria, erro de contagem anterior), não existe um mecanismo correto para corrigir — a única forma de mexer no saldo é via `IN`/`OUT` manuais, que não capturam a semântica "isto é uma correção de contagem", não exigem motivo, e misturam ajustes com movimentação operacional normal no histórico.

## Objetivo

Permitir que um usuário autenticado corrija o saldo de um produto informando o **saldo real observado na contagem física**, gerando uma `StockMovement` do tipo `ADJUSTMENT` auditável (saldo anterior, saldo posterior, usuário, data, motivo obrigatório) — sem nunca sobrescrever silenciosamente uma alteração de saldo concorrente.

## Usuários

Qualquer usuário autenticado do sistema (não há papéis/permissões hoje — ver "Permissões" e "Fora do Escopo").

## Fluxo Desejado

1. Usuário abre um modal dedicado de ajuste (`AdjustmentFormModal`) a partir da ação de um produto — vê o saldo atual já carregado.
2. Informa o **saldo alvo** (não um delta) — o número que contou fisicamente.
3. Informa o **motivo** (obrigatório).
4. Sistema mostra uma confirmação explícita antes de gravar, no formato:
   ```
   Saldo atual: 20 → Novo saldo: 18 (diferença: -2)
   ```
5. Usuário confirma → requisição é enviada.
6. Backend recalcula o saldo atual **dentro do lock de linha da transação** e compara com o saldo que a tela mostrava quando o formulário foi aberto (`expectedPreviousQuantity`). Se divergir, rejeita como conflito — nunca aplica "por cima".
7. Se não houver conflito e a diferença for real (≠ 0), grava a `StockMovement` tipo `ADJUSTMENT` com `previousQuantity`/`newQuantity`/`userId`/motivo/data.
8. Histórico do produto passa a exibir a linha do ajuste com saldo anterior → novo saldo, diferença com sinal, motivo, usuário e data.

## Regras de Negócio

- **Input é saldo alvo, não delta.** O usuário informa o número que a contagem física encontrou; o sistema calcula a diferença internamente. Motivo: contagem física é sempre um número absoluto — pedir para o usuário calcular mentalmente "+2"/"-2" introduz uma classe de erro de sinal evitável.
- **`ADJUSTMENT` não usa o mapa de sinal fixo por tipo** que `IN`/`OUT`/`INITIAL_STOCK` usam hoje em `stockService.ts` (`SIGNED_DIRECTION`). Para `IN`/`OUT`/`INITIAL_STOCK`, `newQuantity` é *derivado* de `quantity` + sinal fixo do tipo. Para `ADJUSTMENT`, é o inverso: `newQuantity` é o **dado de entrada** (o saldo alvo), e `quantity`/o sentido da variação são *derivados* dele (`quantity = abs(newQuantity - previousQuantity)`). Não existe (e não deve existir) um campo de "sinal" separado — qualquer necessidade futura de saber se um ajuste foi para cima ou para baixo se resolve comparando `newQuantity` com `previousQuantity`, nunca inspecionando `type` sozinho.
- **Motivo é obrigatório.** Validação: não vazio/em branco após `trim()`, e um limite máximo de 500 caracteres. Não existe precedente de `.max()` em nenhum schema Zod do projeto hoje (`name`, `sku`, `note` de `IN`/`OUT` não têm limite) — este é o primeiro campo do projeto a definir um teto explícito, decisão desta feature, não uma convenção herdada. Exemplos de motivo válido: "Inventário físico", "Produto avariado", "Correção de contagem".
- **Saldo alvo = 0 é permitido** (perda total é um caso real de negócio).
- **Saldo alvo negativo é rejeitado** (validação de entrada, antes mesmo de tocar o banco — mesmo princípio que já vale para saída comum: saldo nunca fica negativo).
- **Saldo alvo igual ao saldo atual é rejeitado.** Se `previousQuantity === targetQuantity`, não há ajuste real a registrar — não cria `StockMovement`. Evita poluir o histórico de auditoria com "ajustes" que não mudaram nada.
- **Concorrência: verificação otimista dentro do lock pessimista existente.** O lock de linha (`SELECT ... FOR UPDATE`) que já protege `IN`/`OUT`/`INITIAL_STOCK` evita corrupção de escrita simultânea, mas sozinho não evita que um ajuste baseado em saldo-alvo sobrescreva silenciosamente uma movimentação concorrente que a tela do usuário não viu (ex.: uma baixa rápida aconteceu entre o usuário abrir o formulário e confirmar). Por isso a requisição carrega `expectedPreviousQuantity` (o saldo que a tela mostrava); dentro da transação, o serviço compara com o saldo real recém-lido e **rejeita como conflito** se divergirem — nunca aplica "o último ajuste vence".
- **Imutabilidade.** Uma `StockMovement` de `ADJUSTMENT` nunca é editada nem excluída depois de criada — mesmo princípio de livro-razão contábil que já vale implicitamente para `IN`/`OUT` hoje (não existe endpoint de edição/exclusão de movimentação). Um ajuste incorreto se corrige lançando **um novo ajuste**, nunca alterando o anterior. Não há "desfazer" dedicado nesta feature.
- **Auditoria obrigatória.** Toda `ADJUSTMENT` grava `userId` a partir da sessão autenticada (`req.user.id`) — nunca de um valor vindo do corpo da requisição, mesmo princípio já aplicado a `IN`/`OUT`/`INITIAL_STOCK`.

## Permissões

Qualquer usuário autenticado pode realizar um ajuste — não há distinção de papel (o sistema não tem RBAC hoje, confirmado em `docs/current-state.md`). **Isto é um risco conhecido e conscientemente aceito para esta feature, não um problema resolvido**: a única proteção contra uso indevido é a auditoria (saber quem fez o quê, depois), não uma barreira de acesso (impedir a ação, antes). Introduzir controle de acesso é uma decisão maior, de escopo próprio — ver "Fora do Escopo".

## Integridade dos Dados

- Toda a sequência ler-saldo → validar-conflito → decidir → gravar roda dentro da mesma transação Prisma com lock de linha no produto — reaproveita exatamente o mecanismo já existente e testado em `stockService.ts`/`movements.concurrency.test.ts`, sem inventar um mecanismo de concorrência novo.
- `previousQuantity` e `newQuantity` são sempre preenchidos no momento da gravação (nunca `null` para um `ADJUSTMENT` novo).
- O histórico deve exibir `previousQuantity → newQuantity` e a diferença com sinal explicitamente — não apenas `quantity`, que sozinho não comunica direção para este tipo (diferente de `IN`/`OUT`, onde o tipo já implica o sentido).

## Erros Esperados

| Situação | Resultado |
|---|---|
| Produto não existe | 404 (mesmo padrão já usado por `IN`/`OUT`) |
| Motivo vazio/em branco ou > 500 caracteres | 400 (validação Zod) |
| Saldo alvo negativo | 400 (validação Zod) |
| Saldo alvo igual ao saldo atual | 400 (nenhuma alteração real) |
| Saldo real (lido no lock) ≠ `expectedPreviousQuantity` enviado | Conflito — rejeita a operação (código HTTP exato: ver "Questões para RESEARCH") |
| Usuário não autenticado | 401 (já coberto por `requireAuth`, sem mudança) |

## UX

- Modal dedicado `AdjustmentFormModal` (não reaproveita `MovementFormModal`, cujo contrato — `type: IN|OUT`, delta, motivo opcional — é conceitualmente diferente).
- Passo de confirmação explícita antes de gravar, mostrando saldo atual, novo saldo e a diferença com sinal (ex.: `Saldo atual: 20 → Novo saldo: 18 (diferença: -2)`), seguindo o padrão de confirmação já usado no projeto para ações sensíveis (`ConfirmDialog`/`useConfirm`).
- Histórico de movimentações do produto passa a exibir, para linhas `ADJUSTMENT`: saldo anterior → novo saldo, diferença com sinal, motivo, usuário e data — quando essas informações estiverem disponíveis (movimentações antigas gravadas antes da Fase 1 de auditoria, ou pelo `seed.ts`, podem não ter `previousQuantity`/`newQuantity`/`userId` preenchidos; a UI deve degradar de forma legível nesse caso, não quebrar).

## Fora do Escopo (nesta feature)

- **RBAC / controle de quem pode ajustar** — permissão irrestrita a qualquer usuário autenticado é aceita conscientemente; introduzir papéis é uma feature própria, futura.
- **"Zerar Estoque"** (`ProductActionsMenu.tsx` → `useProductMutations.zeroBalance`) permanece como está (cria `OUT` do saldo total, sem motivo obrigatório). Depois que `ADJUSTMENT` existir, essa ação fica inconsistente com a nova regra (duas formas de zerar estoque, uma auditada com motivo e outra não) — **registrado aqui como dívida/questão relacionada**, não resolvido nesta feature.
- **Undo/reversão dedicada de um ajuste** — correção é feita lançando um novo ajuste, não revertendo o anterior.
- **Edição/exclusão de uma `StockMovement` já criada** — continua não existindo, para nenhum tipo.
- **Migração de tipos para `packages/shared`**, **decomposição do `ProductDashboard`**, **soft delete de produto**, **deploy real** — dívidas já registradas em `docs/current-state.md`, não tocadas por esta feature.

## Questões Deliberadamente Deixadas para RESEARCH

1. **Forma da API**: endpoint dedicado (`POST /products/:id/adjustments`) vs. manter `POST /products/:id/movements` com um contrato discriminado por `type` (payload de `ADJUSTMENT` tem campos diferentes de `IN`/`OUT`: `targetQuantity` + `expectedPreviousQuantity` + motivo obrigatório, em vez de `quantity` + motivo opcional). Não fixado aqui por conveniência de implementação, conforme pedido.
2. **Código HTTP do conflito de concorrência** (item de "Erros Esperados" acima): `409 Conflict` vs. `412 Precondition Failed` — qual se alinha melhor com o padrão de erro já usado no projeto (`HttpError`, `app.ts`).

## Riscos Registrados

- Ausência de RBAC (aceito conscientemente, ver "Permissões").
- Inconsistência futura entre `ADJUSTMENT` (com motivo obrigatório) e "Zerar Estoque" (sem motivo) até que essa dívida relacionada seja endereçada.
- Movimentações históricas sem `previousQuantity`/`newQuantity`/`userId` (pré-Fase-1 ou geradas por `seed.ts`) exigem que a UI do histórico trate esses campos como potencialmente ausentes.
