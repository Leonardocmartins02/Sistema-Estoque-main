# PRD — Integrações por Webhook

> Consolida as decisões de `idea.md` e `research.md` num contrato de produto verificável. Define o **contrato externo** (eventos, headers, garantias) porque sistemas receptores dependem dele; não define nomes de função, tabelas, arquivos, rotas internas da API de configuração, ordem de implementação ou testes específicos — isso é do `implementation-plan.md`. A fase PROTOTYPE foi conscientemente pulada para o backend; a tela de Integrações ganha protótipo próprio antes da sua tarefa de implementação, se o PLAN julgar necessário.

## Contexto

O `StockService` é o único ponto que grava `StockMovement`, sempre dentro de `prisma.$transaction` com lock de linha no produto (ver `docs/current-state.md`). A RESEARCH decidiu: outbox transacional no PostgreSQL com fan-out na mesma transação, worker separado no pacote `backend`, retentativa no cronograma da Svix com jitter, assinatura no padrão Standard Webhooks, proteção contra SSRF na hora da conexão e segredo cifrado em repouso. Nenhuma dependência de runtime nova.

## Problema

Nenhum sistema externo fica sabendo quando o estoque muda, e a forma ingênua de avisar (chamar uma URL dentro da rota) deixa o estoque refém do destino, perde eventos em queda de processo e pode anunciar eventos que nunca aconteceram.

## Objetivo

Entregar eventos de estoque por webhook com garantia de **pelo menos uma vez**, **somente para eventos confirmados**, **sem afetar** a operação de estoque, com falhas e recuperação visíveis e controláveis por quem configura a integração.

## Usuários

- **Operador de estoque** — não percebe a feature.
- **Configurador de integrações** — qualquer usuário autenticado (sem RBAC).
- **Sistema receptor** — consome o contrato de eventos.

## Escopo

- Cadastro, edição, ativação/desativação, exclusão e rotação de segredo de destinos de webhook.
- Emissão de `stock.movement.created` e `stock.status.changed` a partir de toda movimentação gravada pelo `StockService`.
- Evento de teste disparado manualmente para um destino (`webhook.test`), pela mesma fila e com a mesma assinatura — permite validar a configuração sem mexer no estoque.
- Entrega assíncrona por worker separado, com retentativa, recuperação de queda, dead letter e desativação automática.
- Consulta do histórico de entregas e tentativas; reenvio manual de entrega que falhou definitivamente.
- Área "Integrações" no frontend.
- Receptor de demonstração (fora do app) que verifica a assinatura e pode falhar de propósito.
- Documentação do contrato para receptores (README da feature ou seção do README do projeto).

## Fora do Escopo

- Webhooks de entrada; eventos de cadastro de produto; mudança de status causada só por edição de `minStock`; RBAC; entrega exatamente-uma-vez ou ordenada; fila externa; deploy real; aviso por e-mail de destino desativado; rotação de segredo com período de convivência de duas assinaturas (o formato permite; fica como evolução). Todos já justificados em `idea.md`/`research.md`.

## Contrato de Eventos (externo)

**Requisição:** `POST` para a URL do destino, corpo JSON (`Content-Type: application/json`), headers:

| Header | Conteúdo |
|---|---|
| `webhook-id` | Identificador único do evento — **o mesmo em toda tentativa e no reenvio manual** |
| `webhook-timestamp` | Momento do envio desta tentativa, unix em segundos |
| `webhook-signature` | `v1,<base64>` — HMAC-SHA256 com o segredo do destino sobre `webhook-id.webhook-timestamp.corpo` |
| `user-agent` | Identifica o SimpleStock e a versão do contrato |

**Corpo** (formato Standard Webhooks):

```json
{
  "type": "stock.movement.created",
  "timestamp": "2026-10-19T14:03:11.402Z",
  "data": { "...": "conforme o tipo" }
}
```

`timestamp` é o momento em que o evento **aconteceu** (gravação da movimentação), não o do envio.

**`stock.movement.created` — `data`:**

| Campo | Significado |
|---|---|
| `movementId` | Id da movimentação |
| `product` | `{ id, sku, name }` no momento do evento |
| `type` | `IN` · `OUT` · `ADJUSTMENT` · `INITIAL_STOCK` |
| `quantity` | Quantidade movimentada (sempre positiva) |
| `previousQuantity` / `newQuantity` | Saldo antes e depois |
| `movementDate` | Data informada da movimentação (pode ser retroativa em `IN`/`OUT`) |
| `note` | Observação/motivo, ou `null` |

**`stock.status.changed` — `data`:**

| Campo | Significado |
|---|---|
| `movementId` | Movimentação que causou a mudança |
| `product` | `{ id, sku, name, minStock }` no momento do evento |
| `previousStatus` / `newStatus` | `OK` · `ATTN` · `OUT` — mesma precedência do resumo de produtos (`GET /products/summary`): `OUT` se saldo 0, senão `ATTN` se abaixo de `minStock`, senão `OK` |
| `previousQuantity` / `newQuantity` | Saldo antes e depois |

**`webhook.test` — `data`:** `{ endpointId, message }`. Só é gerado pelo botão de teste e só vai para aquele destino, independentemente dos eventos inscritos.

O payload **não contém dado de usuário** (id ou e-mail de quem movimentou) — minimiza dado pessoal enviado para fora, já que qualquer usuário pode cadastrar destinos.

## Fluxos

**Cadastro de destino**
1. Usuário abre Integrações → "Novo destino", informa URL, eventos (pelo menos um) e descrição opcional.
2. Sistema valida a URL (formato, `https` em produção, endereço não interno) e cria o destino ativo.
3. Sistema mostra o segredo `whsec_...` **uma única vez**, com botão de copiar e aviso de que não será exibido de novo.

**Entrega com sucesso**
1. Movimentação é gravada; na mesma transação nasce o evento e uma entrega pendente por destino ativo inscrito.
2. Worker reivindica a entrega, envia assinada, recebe `2xx`; entrega fica "Entregue" com a tentativa registrada.

**Entrega com falha e recuperação**
1. Destino responde erro / não responde / redireciona.
2. Tentativa registrada (código, duração, trecho do erro); entrega fica "Retentando" com a próxima tentativa agendada.
3. Destino volta; na próxima tentativa recebe o evento com o **mesmo** `webhook-id`; entrega fica "Entregue".

**Falha definitiva e reenvio**
1. Tentativas esgotadas → "Falhou definitivamente".
2. Usuário abre a entrega, vê as tentativas, clica em "Reenviar".
3. Entrega volta para a fila com o mesmo evento e o mesmo `webhook-id`; o contador de tentativas recomeça.

**Queda do worker**
1. Worker morre com entregas reivindicadas e não concluídas.
2. Depois do prazo de reivindicação, outro worker (ou o mesmo, ao reiniciar) retoma essas entregas. Nenhuma entrega fica presa; nenhuma é enviada por dois workers ao mesmo tempo.

## Requisitos Funcionais

1. Toda `StockMovement` gravada pelo `StockService` gera um `stock.movement.created`.
2. Uma movimentação que muda o status derivado do produto gera também um `stock.status.changed`. `INITIAL_STOCK` na criação do produto **não** gera mudança de status (o produto não tinha status anterior).
3. Eventos e entregas são gravados na **mesma transação** da movimentação; se ela for desfeita (saldo insuficiente, conflito de ajuste, erro), nenhum evento existe.
4. Uma entrega é criada só para destinos **ativos** e **inscritos** no tipo do evento **no momento** em que ele aconteceu.
5. O destino exige URL válida e pelo menos um tipo de evento; em produção, só `https`; em qualquer ambiente, URL que resolve para endereço interno é recusada (exceto loopback fora de produção).
6. O segredo é gerado pelo servidor, exibido só na criação e na rotação, e nunca mais retornado por nenhuma operação.
7. Rotacionar o segredo invalida o anterior imediatamente, após confirmação explícita do usuário.
8. Desativar um destino impede novas entregas para ele; entregas já pendentes dele são canceladas (não enviadas), sem apagar o histórico.
9. Excluir um destino exige confirmação explícita que avisa da perda do histórico, e remove destino, entregas e tentativas.
10. O usuário pode disparar um evento de teste para um destino ativo.
11. Toda requisição de entrega segue o Contrato de Eventos (headers, assinatura, corpo).
12. Sucesso = resposta `2xx` em até 15 s. Qualquer outra resposta, timeout ou erro de rede é falha.
13. Redirecionamentos não são seguidos e contam como falha.
14. Após falha, a próxima tentativa segue o cronograma imediato, 5 s, 5 min, 30 min, 2 h, 5 h, 10 h, 10 h, com variação aleatória de ±20% em cada intervalo; em `429`/`503` com `Retry-After`, espera o maior dos dois, limitado a 24 h.
15. Esgotadas as 8 tentativas, a entrega vai para "Falhou definitivamente".
16. `410 Gone` encerra a entrega como "Falhou definitivamente" e desativa o destino com o motivo registrado.
17. Um destino que está falhando continuamente há 5 dias ou mais é desativado automaticamente quando uma entrega dele falha definitivamente, com o motivo registrado.
18. O cronograma de retentativa pode ser substituído por configuração de ambiente (para demo e testes); o padrão é o do item 14.
19. O usuário vê a lista de destinos com URL, eventos, ativo/inativo, motivo de desativação (se houver) e situação recente (última entrega, falhando desde quando).
20. O usuário vê as entregas de um destino, filtráveis por situação e paginadas, e o detalhe de cada uma: tipo e conteúdo do evento, `webhook-id`, e cada tentativa com data, código HTTP, duração e trecho do erro/resposta.
21. O usuário pode reenviar uma entrega em "Falhou definitivamente"; reenviar uma entrega em qualquer outra situação é recusado com `409`. Reenviar para destino desativado é recusado.
22. Entregas finalizadas há mais de 30 dias são apagadas automaticamente, junto com suas tentativas.
23. Cadastro, edição, ativação/desativação, rotação, exclusão, teste e reenvio registram o usuário autenticado (no destino ou em log estruturado), nunca um valor vindo do cliente.

## Requisitos Não Funcionais

1. **Nenhuma chamada HTTP externa dentro de transação de banco** — nem na transação do estoque, nem na reivindicação do worker.
2. O tempo de resposta das operações de estoque não depende de destinos: o custo adicional na transação é limitado à gravação de eventos/entregas e a uma consulta de destinos ativos.
3. Vários workers podem rodar ao mesmo tempo sem enviar a mesma entrega em paralelo; o prazo de reivindicação é maior que o tempo limite da requisição.
4. A validação contra endereço interno acontece **no momento da conexão**, sobre o IP efetivamente usado (não só no cadastro) — resistente a DNS rebinding.
5. O segredo é guardado cifrado (AES-256-GCM); a chave vem de variável de ambiente validada na inicialização da API e do worker; sem ela, nenhum dos dois sobe.
6. Nenhum log ou tentativa registrada contém o segredo, a assinatura completa ou o corpo inteiro da resposta do destino — trecho da resposta/erro limitado (ex.: 1 KB).
7. A assinatura é verificável por uma implementação de referência da Standard Webhooks (compatibilidade provada em teste automatizado).
8. Toda entrada HTTP da área de integrações é validada com Zod; toda rota exige `requireAuth`; erros seguem `HttpError` e o handler global (regras do `CLAUDE.md`).
9. Worker encerra graciosamente em `SIGTERM`/`SIGINT` (termina o lote atual, não reivindica novos).
10. O CI continua rodando lint, typecheck, testes e build; os testes do worker rodam contra o Postgres real de teste, sem depender de timers reais nem de rede externa.
11. UI: status sempre textual (não só cor), conteúdo assíncrono anunciado (`aria-live`), confirmações via `ConfirmDialog`/`useConfirm`, dado remoto via React Query, mesmo primitivo de `Modal` — regras do `CLAUDE.md`.

## Regras de Negócio

- Evento existe se e somente se a movimentação foi confirmada.
- Entrega pelo menos uma vez; `webhook-id` estável é a chave de deduplicação do receptor.
- Ordem entre eventos não é garantida; `previousQuantity`/`newQuantity` e `timestamp` permitem ao receptor descartar evento antigo.
- Destino inativo não acumula eventos.
- Reenvio manual não cria evento novo.
- Desativação automática: `410` imediatamente; senão, falhando há ≥ 5 dias.
- Qualquer usuário autenticado configura integrações (sem RBAC).

## Modelo Conceitual

Um **Destino** (URL, tipos de evento inscritos, ativo/inativo, motivo de desativação, segredo cifrado, desde quando está falhando, quem criou/alterou) recebe **Entregas**. Um **Evento** (id estável, tipo, momento, conteúdo fotografado) nasce de uma **Movimentação de Estoque** (ou do botão de teste) e gera zero ou mais Entregas, uma por Destino ativo inscrito. Uma **Entrega** tem situação (Pendente, Enviando, Retentando, Entregue, Falhou definitivamente, Cancelada), número de tentativas, próxima tentativa e prazo de reivindicação, e acumula **Tentativas** (momento, código HTTP ou erro, duração, trecho da resposta). Nomes de campo e tabelas são decisão do `implementation-plan.md`.

## Permissões

Qualquer usuário autenticado acessa toda a área de integrações. Risco aceito (ver "Riscos").

## Tratamento de Erros

| Situação | Comportamento |
|---|---|
| URL inválida, não-https em produção, ou resolvendo para endereço interno | 400 com mensagem explicando o motivo; nada é criado |
| Nenhum tipo de evento selecionado | 400 |
| Destino ou entrega inexistente | 404 |
| Reenvio de entrega que não está em "Falhou definitivamente", ou de destino desativado | 409 |
| Teste para destino desativado | 409 |
| Destino fora do ar, lento, `3xx`, `4xx`, `5xx` | Não é erro para nenhum usuário; vira tentativa falha + retentativa |
| DNS do destino passa a resolver para endereço interno depois do cadastro | Tentativa falha com erro de destino bloqueado (sem conexão feita); segue a retentativa normal |
| Chave de cifragem ausente/ inválida | API e worker não sobem (falha na validação do `env`) |
| Não autenticado | 401 |

## Edge Cases

- Saída recusada por saldo insuficiente / ajuste em conflito → nenhum evento.
- Produto excluído depois do evento → entregas pendentes continuam e o conteúdo continua válido (é fotografia).
- Movimentação retroativa (`date` no passado) → `timestamp` é o da gravação; `movementDate` carrega a data informada.
- Mudança de status OK → OUT direto (sem passar por ATTN) → um único `stock.status.changed` com `OK → OUT`.
- `minStock = 0`: saldo > 0 é OK, saldo 0 é OUT — nunca ATTN. (Observação pré-existente: o **filtro** de status da listagem, `matchesStatus` em `routes/products.ts`, não é mutuamente exclusivo — um produto com saldo 0 e `minStock` 0 aparece tanto em OK quanto em OUT. O evento segue a precedência do resumo, que é exclusiva; o filtro fica como dívida registrada, fora do escopo.)
- "Zerar saldos" em lote → um par de eventos por produto, em transações independentes.
- Destino desativado e reativado → eventos do período inativo não são enviados.
- Destino inscrito só em `stock.status.changed` → movimentações que não mudam status não geram entrega para ele.
- Worker morto no meio de um envio que o destino **recebeu** → reenvio após o prazo; o destino recebe duplicata com o mesmo `webhook-id` (comportamento esperado do contrato).
- Dois workers simultâneos → nenhuma entrega enviada pelos dois.
- Resposta enorme do destino → só o trecho limitado é guardado.
- Destino responde `2xx` depois de 15 s → conta como falha (timeout).

## Critérios de Aceite

**Evento nasce com a movimentação**
```
DADO um destino ativo inscrito em stock.movement.created
QUANDO o usuário registra uma entrada de 5 unidades num produto com saldo 10
ENTÃO existe um evento stock.movement.created com previousQuantity 10 e newQuantity 15
E existe uma entrega pendente desse evento para o destino
```

**Sem evento quando a transação falha**
```
DADO um destino ativo inscrito em todos os eventos
E um produto com saldo 2
QUANDO o usuário tenta uma saída de 5
ENTÃO a operação é recusada como hoje (422)
E nenhum evento nem entrega é criado
```

**Mudança de status**
```
DADO um produto com minStock 10 e saldo 12 (OK)
E um destino inscrito em stock.status.changed
QUANDO o usuário registra uma saída de 5
ENTÃO é criado um stock.status.changed com previousStatus OK e newStatus ATTN
QUANDO o usuário registra outra saída de 1 (saldo 6, continua ATTN)
ENTÃO nenhum novo stock.status.changed é criado
```

**Entrega assinada e verificável**
```
DADO uma entrega pendente para um destino com segredo S
QUANDO o worker processa a entrega
ENTÃO o destino recebe POST com webhook-id, webhook-timestamp e webhook-signature
E a assinatura é válida segundo a implementação de referência da Standard Webhooks com o segredo S
E a entrega fica Entregue com uma tentativa registrada
```

**Retentativa com o mesmo id**
```
DADO um destino que responde 500 na primeira tentativa e 200 na segunda
QUANDO o worker processa a entrega duas vezes (respeitando o agendamento)
ENTÃO as duas requisições têm o mesmo webhook-id
E a entrega termina Entregue com duas tentativas registradas
```

**Falha definitiva e reenvio**
```
DADO uma entrega que falhou nas 8 tentativas
ENTÃO ela está em Falhou definitivamente
QUANDO o usuário reenvia
ENTÃO ela volta para a fila com o mesmo webhook-id
QUANDO o usuário tenta reenviar uma entrega Entregue
ENTÃO recebe 409
```

**410 desativa**
```
DADO um destino que responde 410
QUANDO o worker processa uma entrega dele
ENTÃO a entrega fica Falhou definitivamente sem novas tentativas
E o destino fica desativado com o motivo registrado
```

**Recuperação de queda**
```
DADO uma entrega reivindicada por um worker cujo prazo de reivindicação venceu sem conclusão
QUANDO outro worker processa um lote
ENTÃO ele reivindica e envia essa entrega
```

**Concorrência entre workers**
```
DADO 20 entregas pendentes
QUANDO dois workers processam lotes ao mesmo tempo
ENTÃO cada entrega é enviada exatamente uma vez
```

**SSRF**
```
DADO o ambiente de produção
QUANDO o usuário cadastra http://exemplo.com, https://127.0.0.1 ou https://169.254.169.254
ENTÃO recebe 400 e nada é criado
DADO um destino cujo nome passa a resolver para 10.0.0.5
QUANDO o worker tenta entregar
ENTÃO nenhuma conexão é aberta e a tentativa é registrada como destino bloqueado
```

**Segredo**
```
QUANDO o usuário cria um destino
ENTÃO a resposta contém o segredo whsec_...
E nenhuma listagem, detalhe ou log posterior contém esse segredo
E o valor guardado no banco não é o segredo em claro
```

**Operação de estoque não depende do destino**
```
DADO um destino que demora 30 s para responder
QUANDO o usuário registra uma movimentação
ENTÃO a resposta da movimentação não espera o destino
```

**Desativado não acumula**
```
DADO um destino desativado
QUANDO movimentações acontecem
E o destino é reativado
ENTÃO nenhuma entrega existe para os eventos do período inativo
```

## Riscos

- Duplicatas no receptor (inerente ao "pelo menos uma vez"; mitigado por `webhook-id` e documentação).
- Sem RBAC, qualquer usuário autenticado pode enviar dado de estoque para fora (mitigação: auditoria e payload sem dado pessoal).
- Polling do worker gera carga constante no banco (mitigado por índice parcial e intervalo configurável).
- Validação SSRF em nível de aplicação não substitui isolamento de rede num deploy futuro (registrar no README como recomendação).
- Perda da chave de cifragem torna todos os segredos inutilizáveis (todos os destinos precisariam rotacionar).

## Questões em Aberto (para o `implementation-plan.md`)

- Navegação até a área de Integrações: o frontend não tem roteador hoje (`App.tsx` renderiza só o `ProductDashboard`); decidir entre introduzir roteamento ou alternar a visão no shell, seguindo o padrão do projeto.
- Nomes de tabelas/campos, índices e migration.
- Pacote exato da implementação de referência da Standard Webhooks usada nos testes e no receptor de demonstração.
- Onde ficam os tipos do contrato de eventos e dos DTOs de integração: `packages/shared` é a fonte de verdade declarada no `CLAUDE.md` — confirmar e seguir.
- Tamanho do lote, intervalo de polling e prazo de reivindicação padrão.
- Forma do receptor de demonstração (script em `scripts/` vs. pacote) e como ele entra no roteiro do vídeo.
