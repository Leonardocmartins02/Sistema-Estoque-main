# REVIEW — Ajuste de Estoque

> Registro da revisão final exigida pelo `AGENTS.md` (security-reviewer + accessibility-reviewer), das decisões de produto tomadas sobre os achados, e das dívidas deixadas conscientemente para depois. Data: 28/08/2026. Escopo revisado: `git diff 1a9baa7..HEAD`.

## Resultado

Nenhum dos dois reviewers encontrou achado **bloqueante**.

Os pontos de maior risco intrínseco da feature foram auditados e estão corretos:

- **Conflito 409**: `expectedPreviousQuantity` é obrigatório no schema (não `.optional()` — nenhum cliente consegue omiti-lo para pular a checagem) e é comparado dentro da transação, depois do `SELECT ... FOR UPDATE`. Sem janela de lost-update.
- **Integridade da auditoria**: `previousQuantity`, `newQuantity`, `quantity` e `userId` são todos derivados no servidor. O único campo controlado pelo cliente que toca o registro é `reason` → `note`.
- **Sem bypass do `StockService`**: os quatro caminhos de escrita de `StockMovement` passam pelo serviço.
- **Sem dependência de cor**: o sinal textual `+`/`-` no histórico satisfaz WCAG 1.4.1; contrastes conferidos acima de AA.

## Corrigido antes do push

| Achado | Correção | Onde |
|---|---|---|
| **A2** — passo de conflito sem live region | `role="alert"` na explicação do conflito | `AdjustmentFormModal.tsx` |
| **A3** — envio silencioso e foco perdido | rótulo "Confirmando..." + `aria-disabled` no lugar de `disabled` (mantém o foco no rodapé), com guarda contra envio duplo no handler | `AdjustmentFormModal.tsx` |
| **#9** — `targetQuantity` sem teto → HTTP 500 | `.max(PG_INT4_MAX)` = 2.147.483.647, a fronteira real do `Int` do Prisma sobre `int4` do PostgreSQL | `routes/adjustments.ts` |
| **#12** — `fetchQuery` do 409 sem tratamento de erro | `try/catch` que cai no caminho de erro já existente: volta ao formulário, preserva o motivo, mostra mensagem explícita, baseline inalterada | `AdjustmentFormModal.tsx` |

## Riscos aceitos (decisão de produto)

### #7 — Exposição do e-mail do responsável no histórico

**Aceito conscientemente nesta versão.**

`GET /products/:id/movements` devolve `userEmail` de quem fez cada movimentação. Qualquer usuário autenticado consegue, por consequência, enumerar os e-mails das contas que já movimentaram estoque — o que `routes/auth.ts` fecha deliberadamente no login com mensagem genérica.

**Motivo da aceitação**: o objetivo da feature é auditoria operacional, e o modelo `User` não possui hoje nenhum outro identificador humano além do e-mail. Mascarar ou substituir por dado inventado degradaria a auditoria sem eliminar o risco (o `userId` continua na resposta — ver dívida #8).

**Reavaliar quando**: o modelo `User` ganhar `name`/`displayName`, ou passar a existir uma política de privacidade/RBAC diferente da atual (single-tenant interno, todos os usuários operadores).

### #10 — Crescimento do cálculo de saldo

**Aceito como dívida técnica não bloqueante.**

`routes/products.ts` e `services/stockService.ts` carregam para a memória do Node uma linha por `ADJUSTMENT` (`findMany`), em vez de agregar no banco como o `groupBy` ao lado faz para `IN`/`OUT`. Em `GET /products/summary` isso significa carregar todas as linhas `ADJUSTMENT` da tabela a cada dashboard. Funcionalmente correto; escala mal conforme o volume crescer.

**Dívida registrada**: *a agregação de `ADJUSTMENT` deve migrar para cálculo no banco quando o volume justificar* — `SUM("newQuantity" - "previousQuantity")` agrupado por `productId`, com índice em `(type, productId)`.

**Não otimizar agora.**

## Dívidas registradas (não corrigir agora)

Nenhuma bloqueia merge ou push. Ordem aproximada de retorno.

### A1 — Foco não gerenciado na troca de passo (`importante`)

`AdjustmentFormModal.tsx` — os três passos (`form`/`confirm`/`conflict`) retornam `<Modal>` como raiz, então o `Dialog.Content` do Radix não remonta; mas o botão que tinha o foco é desmontado junto com o conteúdo. Quem recupera o foco é o fallback do `FocusScope` do Radix, não o desenho do componente. Não há armadilha de teclado — é previsibilidade.

**Correção futura**: `ref` + `tabIndex={-1}` no corpo de cada passo, com `.focus()` num `useEffect([step])`, seguindo o padrão de foco manual já usado em `ui/Modal.tsx` (`lastActiveRef` / `onCloseAutoFocus`).

> Com A2 e A3 corrigidos, o pior desfecho deste achado (o usuário não perceber que o ajuste foi recusado) já está coberto por live region e por rótulo de estado.

### A4 — Região `aria-live` do preview desmonta após "Revisar" (`recomendação`)

`AdjustmentFormModal.tsx` — o preview (`{saldo} → {alvo}` / `Diferença`) só é montado quando `hasValidPreview`. No caminho normal funciona (o campo inicia preenchido com o saldo atual, então a região já nasce montada). Depois de "Revisar" o campo é limpo, a região desmonta, e a primeira digitação seguinte remonta o nó junto com o conteúdo — cenário que o próprio `ui/ToastProvider.tsx` documenta como não anunciado.

**Correção futura**: manter o `<p aria-live="polite">` sempre montado e alternar só o conteúdo interno, como o `ToastProvider` já faz. Opcionalmente ligar o preview ao campo por `aria-describedby`.

### A5 — `→` como único conector entre saldos (`recomendação`)

`AdjustmentFormModal.tsx` e `MovementHistoryModal.tsx` — U+2192 normalmente não é falado no nível de pontuação padrão do NVDA/VoiceOver; "20 → 18" vira "20 18". O significado não se perde de vez porque há sempre uma "Diferença" com sinal ao lado.

**Correção futura**: `<span aria-hidden="true">→</span>` mais um texto só para AT (`para`), ou `aria-label` no wrapper — padrão já usado em `ui/Modal.tsx` no botão de fechar.

### A6 — `role="alert"` inconsistente entre campos do mesmo formulário (`recomendação`)

`ui/Input.tsx` renderiza a mensagem de erro com `aria-describedby` mas sem `role="alert"`, enquanto o textarea de Motivo em `AdjustmentFormModal.tsx` usa `role="alert"`. Na prática o usuário não fica sem informação (o `shouldFocusError` do react-hook-form move o foco para o campo inválido, e o leitor de tela lê a descrição junto).

**Correção futura**: é dívida do primitivo `ui/Input.tsx`, não desta feature — corrigir lá, não divergir o padrão localmente.

### #8 — Resposta do histórico devolve o registro cru (`recomendação`)

`routes/movements.ts` — o `...movement` do mapeamento não é allow-list: além de `userEmail`, expõe `userId`, `referenceType` e `referenceId`. O comentário ao lado diz "exposição mínima", o que hoje não é verdade. `referenceType`/`referenceId` são sempre `null` no estado atual, mas serão preenchidos numa fase futura com dados que ninguém revisou para exposição.

**Correção futura**: projeção explícita dos campos que a UI consome, ou `select` no `findMany` — `routes/quick-out.ts` (`/history`) já projeta campo a campo e é o padrão a seguir. Isto é pré-requisito de qualquer decisão futura sobre o achado #7: mascarar o e-mail sem corrigir isto não adianta, porque o `userId` continua identificando o autor.

### #11 — `ON DELETE SET NULL` no `userId` (`recomendação`)

`prisma/migrations/20260827000000_stock_movement_audit_fields/migration.sql` — apagar um usuário anonimizaria silenciosamente todos os ajustes que ele fez, e a UI mostraria "Usuário não disponível" sem distinguir "registro legado" de "autor apagado". **Inalcançável hoje**: não existe rota de exclusão de usuário na API.

**Correção futura**: quando houver gestão de usuários, usar soft delete / `ON DELETE RESTRICT`, ou desnormalizar o e-mail do autor no momento da gravação.
