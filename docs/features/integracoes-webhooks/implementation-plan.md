# IMPLEMENTATION PLAN — Integrações por Webhook

> Transforma `PRD.md` em tarefas executáveis. Nenhum código foi alterado nesta fase — apenas inspeção do código real e este documento. Toda tarefa segue a regra de TDD do `CLAUDE.md` (teste antes/junto, red → green → refactor) e o checklist de saída (lint, typecheck, testes backend/frontend, build).

## 1. Inspeção técnica — o que já existe

**Pontos de gravação de `StockMovement`** (confirmado por busca): só `recordMovementInTx` e `recordAdjustmentInTx` em `packages/backend/src/services/stockService.ts`. Todos os chamadores passam por eles: `routes/movements.ts` e `routes/quick-out.ts` (`recordMovement`), `routes/adjustments.ts` (`recordAdjustment`), `routes/products.ts` (`recordMovementInTx` dentro da transação de criação com `initialStock`). Exceção conhecida: `seed.ts` grava direto via Prisma (aceito na IDEA). **Conclusão: emitir eventos no fim das duas funções `*InTx` cobre 100% das movimentações de negócio**, sem tocar nenhuma rota.

**Lock e dados do produto**: as duas funções fazem `SELECT "id" FROM "Product" ... FOR UPDATE`. O evento precisa de `sku`, `name` e `minStock` — o mesmo `SELECT` pode trazer essas colunas, sem consulta extra.

**Regra de status**: hoje existe em dois lugares com semânticas diferentes — `matchesStatus` (filtro da listagem, **não exclusivo**: saldo 0 com `minStock` 0 casa OK e OUT) e o laço de `GET /products/summary` (exclusivo: OUT → ATTN → OK). Os eventos precisam da versão exclusiva. `StockStatus` está duplicado (`STOCK_STATUSES` no backend, `StatusKey` no frontend).

**Infra de teste**: `test/setup.ts` força `DATABASE_URL_TEST`, `NODE_ENV=test` e preenche `JWT_SECRET`/`CORS_ALLOWED_ORIGINS` — é onde entra a chave de cifragem de teste. `test/helpers/db.ts` (`resetDb`) apaga tabelas em ordem de FK — precisa incluir as novas. `vitest.config.ts` roda arquivos em série contra um único banco. Padrão de teste de rota: supertest + `createTestUser`/`loginAndGetToken`. Concorrência provada com `Promise.all` (`movements.concurrency.test.ts`).

**Config**: `src/shared/env.ts` (Zod, falha na inicialização), `.env.example` em `packages/backend`, CI com `env:` no job (`.github/workflows/ci.yml`). Variável nova obrigatória precisa entrar nos três + `test/setup.ts`.

**Erros e logs**: `HttpError(status, message)` + handler global em `app.ts`; `logger` (`pino`) com `redact` — os campos sensíveis novos entram no `redact`.

**Shared**: `packages/shared/src/index.ts` tem só `ApiError` e `ProductStockSummary`; o pacote compila para `dist` (o CI roda `@simplestock/shared build` antes de tudo). É a fonte de verdade declarada no `CLAUDE.md` — tipos novos de contrato vão para lá.

**Frontend**: sem roteador (`App.tsx` renderiza o `ProductDashboard` direto no `<main>`). Padrões a reutilizar: `api/*.ts` finos sobre `apiFetch`; React Query; `Modal` (único primitivo de diálogo); `ConfirmDialog`/`useConfirm`; `Badge` (variantes `success`/`warning`/`danger`/`info`); `DataTable`; `ToastProvider`; `MovementHistoryModal` como referência de lista paginada com filtro; `MovementFormModal`/`AdjustmentFormModal` como referência de formulário (`react-hook-form` + `zodResolver`, `serverError` local). Design system em `docs/ui-ux/design-system.md`.

**Dependências**: `net.BlockList` disponível no Node do projeto (22.23.2, `.nvmrc`). Biblioteca de referência confirmada: `standardwebhooks` (npm, repositório oficial `standard-webhooks/standard-webhooks`) — entra **só como devDependency** do backend.

### Dívidas pré-existentes encontradas (registradas, fora do escopo)

1. **`node dist/server.js` não sobe**: o build emite imports ESM sem extensão (`import ... from './app'`) e o Node recusa (`ERR_MODULE_NOT_FOUND`). Só `tsx` (dev) funciona hoje. O worker herda o mesmo problema em produção. Deploy está fora do escopo; registrar em `docs/current-state.md`.
2. **Filtro de status não exclusivo** (`matchesStatus`) — ver acima.

## 2. Decisões que fecham as questões em aberto do PRD

**Navegação**: sem introduzir roteador. O shell (`App.tsx`) ganha uma navegação primária com dois itens — "Estoque" e "Integrações" — e alterna a visão do `<main>`. A visão ativa é refletida no hash (`#integracoes`) para recarregar a página no mesmo lugar e permitir link direto. `aria-current="page"` no item ativo. Justificativa: duas telas não justificam uma dependência de roteamento; se surgir uma terceira com sub-rotas, reavaliar.

**Tabelas** (Prisma, uma migration):

| Modelo | Campos principais |
|---|---|
| `WebhookEndpoint` | `id`, `url`, `description?`, `eventTypes String[]`, `active`, `disabledReason?`, `secretCiphertext`, `failingSince?`, `createdById?`, `updatedById?` (FK `User`, `ON DELETE SET NULL`), timestamps |
| `WebhookEvent` | `id` (vira o `webhook-id`, prefixo `evt_`), `type`, `payload Json` (corpo completo já montado), `occurredAt`, `createdAt` |
| `WebhookDelivery` | `id`, `eventId`, `endpointId` (cascata na exclusão do destino), `status` (enum `PENDING`/`SENDING`/`DELIVERED`/`FAILED`/`CANCELLED`), `attemptCount`, `nextAttemptAt`, `lockedUntil?`, `deliveredAt?`, `finishedAt?`, timestamps; `@@unique([eventId, endpointId])`; `@@index([status, nextAttemptAt])` |
| `WebhookAttempt` | `id`, `deliveryId` (cascata), `startedAt`, `durationMs`, `responseStatus?`, `errorCode?` (`TIMEOUT`, `NETWORK`, `BLOCKED_DESTINATION`, `REDIRECT`, `HTTP_ERROR`), `responseSnippet?` (≤ 1 KB) |

"Retentando" não é um status no banco: é `PENDING` com `attemptCount > 0` (derivado no DTO). **Desvio consciente da RESEARCH**: o índice é composto `(status, nextAttemptAt)`, não parcial — Prisma 5 não representa índice parcial no schema e um `migrate dev` futuro tentaria removê-lo. No volume deste projeto a diferença é irrelevante.

**Tipos compartilhados** (`packages/shared/src/webhooks.ts`, reexportados no `index.ts`): `StockStatus`, `deriveStockStatus(balance, minStock)` (versão exclusiva), `WebhookEventType`, payloads de cada evento, `WebhookEndpointDTO`, `WebhookDeliveryDTO`, `WebhookAttemptDTO`, `WebhookDeliveryStatus`. O frontend **não** migra `StatusKey` nesta feature (escopo).

**Módulos novos no backend** — pasta `src/webhooks/` (tudo que é específico do subsistema fica junto; rotas continuam em `src/routes/`):

| Arquivo | Responsabilidade |
|---|---|
| `secrets.ts` | Gerar `whsec_` (32 bytes), cifrar/decifrar AES-256-GCM |
| `signature.ts` | Montar headers Standard Webhooks para um corpo |
| `destinationGuard.ts` | `BlockList` de faixas internas; validação de URL no cadastro; função `lookup` segura para a conexão |
| `httpSender.ts` | Envio via `node:http`/`node:https` com `lookup` seguro, timeout, sem redirecionamento, trecho de resposta limitado |
| `retryPolicy.ts` | Cronograma, jitter, `Retry-After`, decisão "retentar / falhar / desativar" |
| `events.ts` | `emitStockEventsInTx` (outbox + fan-out) e `emitTestEventInTx` |
| `dispatcher.ts` | `processBatch({ now, sender, random })`: reivindica com `SKIP LOCKED` + lease, envia, registra tentativa e transição |
| `retention.ts` | Varredura de 30 dias |
| `../worker.ts` | Laço de polling, varredura periódica, desligamento gracioso |

**Variáveis de ambiente novas** (`env.ts`, `.env.example`, CI, `test/setup.ts`):
- `WEBHOOK_SECRET_ENCRYPTION_KEY` — obrigatória, base64 de 32 bytes.
- `WEBHOOK_RETRY_SCHEDULE_SECONDS` — opcional, lista separada por vírgula (8 valores); padrão `0,5,300,1800,7200,18000,36000,36000`.
- `WEBHOOK_REQUEST_TIMEOUT_MS` (padrão 15000), `WEBHOOK_POLL_INTERVAL_MS` (padrão 1000), `WEBHOOK_BATCH_SIZE` (padrão 10). Lease fixo = timeout + 45 s.

**API de configuração** (`routes/webhooks.ts`, montada como `router.use('/webhooks', requireAuth, webhooks)`):

| Método e rota | Resultado |
|---|---|
| `GET /webhooks` | Lista de destinos (sem segredo) com situação recente |
| `POST /webhooks` | `201 { endpoint, secret }` |
| `PUT /webhooks/:id` | Edita `url`, `eventTypes`, `description`, `active` (mesmo verbo de `PUT /products/:id`) |
| `DELETE /webhooks/:id` | `204`, cascata |
| `POST /webhooks/:id/rotate-secret` | `200 { secret }` |
| `POST /webhooks/:id/test` | `202 { deliveryId }`; `409` se inativo |
| `GET /webhooks/:id/deliveries` | Paginado (`page`, `pageSize`, `status`), padrão de `queryParams.ts` |
| `GET /webhooks/deliveries/:deliveryId` | Detalhe com evento e tentativas |
| `POST /webhooks/deliveries/:deliveryId/retry` | `202`; `409` se não está `FAILED` ou destino inativo |

**Receptor de demonstração**: `packages/backend/scripts/webhook-receiver.ts` (roda com `tsx`, script `demo:receiver`). Verifica com `standardwebhooks`, imprime cada evento, deduplica por `webhook-id` e aceita modos por variável de ambiente: `FAIL_FIRST=N` (falha as N primeiras tentativas de cada evento), `RESPOND_STATUS=500|410`, `DELAY_MS`.

## 3. Tarefas

Cada tarefa vira **um commit** (tarefas grandes podem virar mais de um, sempre um assunto por commit). Proposta de PRs: **PR 1 = Tarefas 1–6 (backend + receptor)**, **PR 2 = Tarefas 7–9 (UI + docs + demo)**.

### Tarefa 1 — Fundação: schema, migration, tipos compartilhados, regra de status

**Arquivos**: `prisma/schema.prisma`, migration nova, `packages/shared/src/webhooks.ts` + `index.ts`, `routes/products.ts` (só `GET /summary` passa a usar `deriveStockStatus`), `test/helpers/db.ts`.

**Testes**: `deriveStockStatus` (OK/ATTN/OUT, `minStock` 0, fronteira `saldo = minStock`); suíte existente de `products.summary.test.ts` continua verde sem mudança (prova de que o refactor não mudou comportamento).

**Pronto quando**: migration aplica no Postgres de teste; `resetDb` limpa as tabelas novas; checklist verde.

### Tarefa 2 — Segredo, assinatura e guarda de destino (módulos puros)

**Arquivos**: `webhooks/secrets.ts`, `webhooks/signature.ts`, `webhooks/destinationGuard.ts`, `shared/env.ts`, `.env.example`, `test/setup.ts`, `.github/workflows/ci.yml`, `logger.ts` (`redact`), `package.json` (devDependency `standardwebhooks`).

**Testes (red primeiro)**:
- Segredo gerado começa com `whsec_` e decodifica para 32 bytes; cifrar → decifrar devolve o original; o texto cifrado não contém o segredo; chave errada falha.
- Headers gerados são aceitos por `new Webhook(secret).verify(body, headers)` da biblioteca de referência; corpo alterado em 1 byte é rejeitado.
- Guarda: bloqueia `127.0.0.1`, `10.x`, `172.16.x`, `192.168.x`, `169.254.169.254`, `100.64.x`, `0.0.0.0`, `::1`, `fc00::/7`, `fe80::/10`, `::ffff:127.0.0.1`; libera IP público; em produção recusa `http:`; fora de produção libera loopback.
- `env.ts` recusa chave ausente ou com tamanho diferente de 32 bytes.

### Tarefa 3 — Outbox: eventos nascem na transação do estoque

**Arquivos**: `webhooks/events.ts`, `services/stockService.ts` (o `SELECT ... FOR UPDATE` passa a trazer `name`, `sku`, `minStock`; chamada a `emitStockEventsInTx` no fim de `recordMovementInTx` e `recordAdjustmentInTx`).

**Testes** (HTTP/supertest, padrão de `stockService.test.ts`): critérios de aceite do PRD "Evento nasce com a movimentação", "Sem evento quando a transação falha" (saída sem saldo → 422; ajuste em conflito → 409), "Mudança de status" (OK → ATTN; ATTN → ATTN não gera); `INITIAL_STOCK` na criação gera só `stock.movement.created`; destino inativo e destino não inscrito não recebem entrega; payload sem dado de usuário; `timestamp` vs. `movementDate` em movimentação retroativa. Suítes existentes (inclusive `movements.concurrency.test.ts`) verdes sem alteração.

### Tarefa 4 — API de configuração de destinos

**Arquivos**: `routes/webhooks.ts`, `routes/index.ts`, `webhooks/events.ts` (`emitTestEventInTx`).

**Testes**: 401 sem token em todas as rotas; criação devolve segredo uma vez e listagem/detalhe nunca devolvem; valor no banco ≠ segredo; URL inválida, sem eventos, `http:` com `NODE_ENV=production` simulado e IP interno → 400; editar e desativar (entregas pendentes viram `CANCELLED`); rotação troca o segredo; exclusão em cascata; teste em destino inativo → 409; reenvio de entrega não-`FAILED` → 409; reenvio de `FAILED` volta para `PENDING` com `attemptCount` 0 e o **mesmo** `eventId`; `createdById`/`updatedById` vêm da sessão, nunca do corpo.

### Tarefa 5 — Worker: entrega, retentativa, recuperação

**Arquivos**: `webhooks/httpSender.ts`, `webhooks/retryPolicy.ts`, `webhooks/dispatcher.ts`, `webhooks/retention.ts`, `src/worker.ts`, scripts `worker`/`dev:worker`.

**Como testar sem timers nem rede externa**: os testes sobem um servidor `node:http` em `127.0.0.1` porta aleatória (loopback é liberado fora de produção) e chamam `processBatch({ now })` diretamente, avançando `now` manualmente. `random` injetável para tornar o jitter determinístico. Para o caso de DNS que resolve para IP interno, o `lookup` é injetável no `httpSender`.

**Testes** (critérios de aceite do PRD): entrega assinada e verificável pela biblioteca de referência; 500 → 200 com o mesmo `webhook-id` e duas tentativas; 8 falhas → `FAILED`; `410` → `FAILED` + destino desativado com motivo; `Retry-After` respeitado e limitado a 24 h; timeout (configurado curto no teste) → falha; `3xx` → falha sem seguir; resposta grande → trecho ≤ 1 KB; lease vencido → outra execução reivindica; **dois `processBatch` simultâneos com 20 entregas → servidor recebe exatamente 20 requisições distintas**; destino falhando há ≥ 5 dias → desativado quando uma entrega falha definitivamente; sucesso limpa `failingSince`; retenção apaga só finalizadas com mais de 30 dias e eventos órfãos; `retryPolicy` testado como função pura (cronograma, jitter dentro de ±20%, `Retry-After`).

**Pronto quando**: além do checklist, rodar manualmente API + worker + receptor (Tarefa 6) e matar o worker no meio de um envio lento para ver a retomada.

### Tarefa 6 — Receptor de demonstração

**Arquivos**: `packages/backend/scripts/webhook-receiver.ts`, script `demo:receiver`.

**Teste**: um teste de integração que sobe o receptor como função (não como processo), envia uma entrega real pelo `httpSender` e confere que o receptor validou a assinatura e respondeu conforme o modo (`FAIL_FIRST`).

### Tarefa 7 — Protótipo da tela de Integrações

**Saída**: `docs/features/integracoes-webhooks/prototype.md` + protótipo HTML estático (padrão de `docs/ui-ux/prototype/`) com: navegação do shell, lista de destinos (vazia, com itens, desativado automaticamente), formulário de destino, revelação única do segredo, lista de entregas com filtro de situação, detalhe de entrega com tentativas e botão de reenviar. Seguindo `docs/ui-ux/design-system.md`. **Revisão visual do usuário antes da Tarefa 8.**

### Tarefa 8 — Frontend: área de Integrações

**Arquivos**: `App.tsx` (navegação + hash), `api/webhooks.ts`, `hooks/useWebhooks*.ts`, `components/integrations/` (`IntegrationsPage`, `WebhookEndpointFormModal`, `WebhookSecretDialog`, `WebhookDeliveriesPanel`, `WebhookDeliveryDetailModal`), testes em `packages/frontend/test/`.

**Testes** (padrão de `MovementFormModal.test.tsx`: mock do módulo de API, `QueryClientProvider` + `ToastProvider`, `userEvent`): navegação troca a visão e respeita o hash; formulário valida URL e eventos; segredo aparece uma vez e some ao fechar; rotação e exclusão pedem confirmação; situação sempre em texto; reenviar só aparece em "Falhou definitivamente"; anúncio `aria-live` em sucesso/erro. Revisão de acessibilidade (`accessibility-reviewer`).

### Tarefa 9 — Documentação e demonstração

**Arquivos**: `README.md` (seção "Integrações por webhook": contrato, verificação no receptor com exemplo, como rodar worker e receptor, variáveis novas), `docs/current-state.md` (subsistema novo + dívidas encontradas), `docs/demo/roteiro.md` e novo vídeo curto (destino falha → retentativa → recuperação → reenvio manual), `review.md` da feature (revisão de segurança e QA, padrão de `ajuste-estoque/review.md`).

## 4. Ordem e dependências

```
1 ─► 2 ─► 3 ─► 4 ─► 5 ─► 6        (PR 1: backend)
                         └─► 7 ─► 8 ─► 9   (PR 2: UI, docs, demo)
```

## 5. Riscos de execução

- **Testes de worker com rede**: servidor local em loopback evita rede externa, mas porta/timeout mal configurados deixam a suíte lenta ou instável — manter timeouts de teste curtos e fechar servidores no `afterEach`.
- **Variável obrigatória nova** quebra o `.env` local de quem já tem o projeto: README e `.env.example` precisam explicar como gerar a chave; a mensagem de erro do `env.ts` também.
- **Transação do estoque fica um pouco maior** (insert do evento + consulta de destinos + insert das entregas): os testes de concorrência existentes são a rede de segurança.
- **Dívida do build de produção** (seção 1) impede rodar `worker` a partir de `dist` — demo e CI usam `tsx`/testes, então não bloqueia esta feature.
