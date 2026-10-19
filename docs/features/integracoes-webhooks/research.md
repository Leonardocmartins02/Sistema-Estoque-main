# RESEARCH — Integrações por Webhook

> Escopo: resolver as questões deixadas em aberto no `idea.md` (e uma que apareceu durante a pesquisa: como guardar o segredo). Premissa herdada da IDEA: não adicionar infraestrutura que o projeto não tem sem justificativa forte. Resultado: **nenhuma dependência de runtime nova** — tudo sai de PostgreSQL, Prisma e módulos nativos do Node (`node:crypto`, `node:https`, `node:net`).

## Questão 1 — Onde fica a fila

### Alternativas

**A. Outbox transacional no PostgreSQL.** O evento (e uma linha de entrega por destino inscrito) é gravado pela mesma `prisma.$transaction` que grava a `StockMovement`. Um processo de entrega lê as entregas pendentes com `SELECT ... FOR UPDATE SKIP LOCKED`.

**B. Fila externa (BullMQ + Redis).** A rota grava a movimentação e, depois do commit, enfileira um job no Redis.

### Vantagens / Desvantagens

| | A — outbox no Postgres | B — BullMQ/Redis |
|---|---|---|
| Vantagens | Atomicidade de graça: evento existe se e somente se a movimentação existe; nenhum serviço novo no `docker-compose`, no CI ou num deploy futuro; reaproveita o padrão de lock já usado no `StockService` (`$queryRaw` com `FOR UPDATE`) | Biblioteca madura com retentativa, painel e agendamento prontos |
| Desvantagens | Retentativa, lease e limpeza são código nosso (é justamente o objetivo de aprendizado); a tabela cresce e precisa de política de retenção (Questão 6) | **Gravação dupla:** se o processo cair entre o commit no Postgres e o `add` no Redis, o evento se perde — exatamente a falha (2) descrita na IDEA. Resolver isso exige… um outbox no Postgres na frente do Redis. Mais um serviço para subir no CI e manter |

### Riscos

- **A:** dois processos de entrega pegarem a mesma linha, ou uma linha "reivindicada" por um processo que morreu ficar presa para sempre. Mitigação: reivindicação com `SKIP LOCKED` numa transação curta que já marca a linha como `SENDING` com um prazo (`lockedUntil`); a chamada HTTP acontece **fora** da transação; linhas `SENDING` com prazo vencido voltam a ser elegíveis. É a armadilha que o 2ndQuadrant aponta em filas SQL caseiras ("o mesmo job para vários workers" ou "marcar como feito no despacho e perder o job se o worker falhar").
- **A:** carga de polling no banco. Mitigação: intervalo de polling configurável (1 s por padrão) e índice parcial em `(status, nextAttemptAt)` só nas linhas pendentes. `LISTEN/NOTIFY` para acordar o worker na hora fica como otimização futura, não necessária.

### Decisão

**A — outbox transacional no PostgreSQL**, com o *fan-out* (uma entrega por destino ativo inscrito naquele tipo de evento) feito **dentro da mesma transação** da movimentação.

### Justificativa

1. O padrão *Transactional Outbox* (microservices.io) existe exatamente para "atualizar o banco e publicar uma mensagem atomicamente" sem transação distribuída — é o problema da IDEA.
2. Fazer o fan-out na transação (em vez de o worker descobrir os destinos depois) implementa de graça a regra "destino inativo não acumula eventos": quem não estava ativo no momento do evento não ganha linha de entrega. Custo: uma consulta pequena a destinos ativos por movimentação, dentro de uma transação que já faz `groupBy`.
3. `SKIP LOCKED` foi criado (PostgreSQL 9.5) para filas concorrentes; o projeto está em PostgreSQL 16.

### Fontes

- [microservices.io — Pattern: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox)
- [PostgreSQL — SELECT, cláusula de locking (`SKIP LOCKED`)](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)
- [2ndQuadrant — What is SKIP LOCKED for in PostgreSQL 9.5?](https://www.2ndquadrant.com/en/?p=9279)
- `packages/backend/src/services/stockService.ts` (transação + `$queryRaw ... FOR UPDATE` já usados)

---

## Questão 2 — Processo de entrega: worker separado vs. laço dentro da API

### Alternativas

**A. Entrypoint separado** no mesmo pacote: `packages/backend/src/worker.ts`, script `worker`/`dev:worker`, mesmo `PrismaClient`, mesmo `env`.

**B. Laço (`setInterval`) dentro do processo da API** (`server.ts`).

### Vantagens / Desvantagens

| | A — worker separado | B — dentro da API |
|---|---|---|
| Vantagens | Isolamento: um destino lento ou um bug no envio não disputa CPU/event loop com as requisições do estoque; escala independente; **torna a recuperação demonstrável** (matar o worker no meio do envio, subir de novo, ver a entrega retomada) | Um processo só para subir e implantar |
| Desvantagens | Mais um processo no `dev` e num deploy futuro (num plano gratuito de hospedagem, worker dedicado costuma ser pago) | Toda réplica da API vira um worker; queda da API derruba as entregas e vice-versa; mistura responsabilidades em `server.ts` |

### Decisão

**A — entrypoint separado no pacote `backend`** (não um pacote novo do monorepo: reaproveita Prisma, `env`, `logger` e o domínio). O núcleo do worker é uma função pura de "processar um lote" chamada pelo laço; os testes chamam essa função diretamente, sem timers, contra o Postgres de teste real (padrão atual dos testes do backend). Desligamento gracioso igual ao de `server.ts` (SIGTERM → termina o lote atual → desconecta).

### Justificativa

O objetivo secundário da IDEA é tornar falha e recuperação visíveis; um processo que pode ser derrubado independentemente é o que permite isso. A preocupação de custo de deploy não se aplica agora (deploy está fora do escopo) e, se um dia se aplicar, o mesmo módulo pode ser iniciado dentro da API com uma linha — o inverso (separar um laço embutido) é mais caro.

---

## Questão 3 — Política de retentativa

### Decisão (seguindo a especificação Standard Webhooks e o cronograma publicado pela Svix)

| Item | Valor |
|---|---|
| Sucesso | Qualquer `2xx` (200–299) |
| Tempo limite por requisição | 15 s (limite inferior da faixa 15–30 s da Standard Webhooks) |
| Redirecionamento `3xx` | **Falha, não segue** — a spec manda o destino atualizar a URL em vez de seguir; também fecha um desvio clássico de SSRF (Questão 8) |
| Cronograma | Imediato, 5 s, 5 min, 30 min, 2 h, 5 h, 10 h, 10 h → **8 tentativas, ~27 h** (cronograma da Svix) |
| Jitter | Cada intervalo multiplicado por um fator aleatório em [0,8; 1,2] — evita que muitas entregas falhadas ao mesmo tempo retentem todas no mesmo segundo |
| `429`/`503` com `Retry-After` | Próxima tentativa = o maior entre o cronograma e o `Retry-After`, limitado a 24 h |
| `410 Gone` | Para de retentar essa entrega **e desativa o destino** (regra explícita da spec) |
| Esgotou tentativas | Entrega vai para `FAILED` (dead letter), reenviável manualmente |
| Demo/testes | Cronograma sobrescrevível por variável de ambiente validada em `env.ts` (ex.: `0,2,4,8` segundos), para o vídeo mostrar a retentativa em tempo real |

### Justificativa

A Standard Webhooks recomenda backoff exponencial com jitter "ao longo de vários dias", tempo limite de 15–30 s, tratar 3xx como falha e desativar em `410`. O cronograma da Svix (autora da spec) é uma instância concreta e conhecida dessa recomendação — adotá-lo evita inventar números. O texto da AWS sobre backoff mostra que backoff sem jitter ainda gera rajadas sincronizadas de retentativa.

### Fontes

- [Standard Webhooks — especificação](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md)
- [Svix — Retry Schedule](https://docs.svix.com/retries)
- [AWS Architecture Blog — Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)

---

## Questão 4 — Formato da assinatura, headers e corpo

### Alternativas

**A. Standard Webhooks.** Headers `webhook-id`, `webhook-timestamp` (unix, segundos), `webhook-signature: v1,<base64>`; conteúdo assinado `id.timestamp.corpo`; HMAC-SHA256; segredo `whsec_<base64>`.

**B. Formato próprio** (ex.: `X-SimpleStock-Signature: <hex>`).

### Decisão

**A — Standard Webhooks**, implementado com `node:crypto` (sem biblioteca no envio). Corpo JSON no formato recomendado pela spec: `{ "type": "stock.movement.created", "timestamp": "<ISO 8601>", "data": { ... } }`, *payload* completo (fotografia, como decidido na IDEA), bem abaixo dos ~20 KB que a spec cita como usual.

### Justificativa

1. É uma especificação aberta já usada por Svix, OpenAI e Anthropic, entre outros — o receptor pode usar uma biblioteca pronta em vez de reimplementar a verificação, e no portfólio isso mostra escolha de padrão de mercado em vez de formato inventado.
2. O `webhook-id` "permanece o mesmo não importa quantas vezes um webhook que falhou seja retentado" — é exatamente a chave de deduplicação que a IDEA exige, inclusive no reenvio manual.
3. O header aceita várias assinaturas separadas por espaço, o que deixa a rotação de segredo sem janela de quebra como evolução possível.
4. Para provar compatibilidade, os testes (e o receptor de demonstração) verificam a assinatura com a biblioteca oficial de referência como **devDependency** — se nossa implementação divergir da spec, o teste quebra. Confirmação do pacote exato fica para o PLAN.

### Fontes

- [Standard Webhooks — especificação](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md)
- [Svix — glossário: webhook signature](https://www.svix.com/resources/glossary/webhook-signature/)

---

## Questão 5 — Desativação automática de destino

### Decisão

- `410 Gone` → desativa na hora (Questão 3).
- Caso geral: o destino guarda **desde quando está falhando** (`failingSince`, preenchido na primeira falha depois de um sucesso, limpo no próximo sucesso). Quando uma entrega vai para `FAILED` e o destino está falhando há **5 dias ou mais**, ele é desativado com o motivo registrado. Mesma janela da Svix.
- O destino desativado aparece na tela de Integrações com status textual e motivo ("Desativado automaticamente: falhando desde …"). Aviso por e-mail, que a spec sugere, fica fora do escopo (o projeto não envia e-mail).

### Justificativa

Continuar mandando para um destino morto gasta tentativas e polui o histórico; desativar na primeira falha seria agressivo demais para uma instabilidade de minutos. A janela de 5 dias da Svix é um meio-termo publicado.

### Fontes

- [Svix — Retry Schedule (seção sobre desativação)](https://docs.svix.com/retries)

---

## Questão 6 — Retenção e exclusão de destino

### Decisão

- **Retenção:** entregas finalizadas (`DELIVERED` ou `FAILED`) e suas tentativas são apagadas depois de **30 dias**, pelo próprio worker, numa varredura periódica de baixa frequência. Entregas pendentes nunca são apagadas. Eventos sem nenhuma entrega restante são apagados junto.
- **Exclusão de destino:** exclusão definitiva com cascata das entregas/tentativas, **depois de confirmação explícita** na UI (`ConfirmDialog`), avisando que o histórico será perdido. Quem quer manter o histórico **desativa** em vez de excluir. A exclusão é registrada em log estruturado (`pino`) com o `userId`.

### Alternativa descartada

*Soft delete* do destino (`deletedAt`): preserva histórico, mas exige filtrar `deletedAt` em toda consulta e convive mal com a retenção de 30 dias (o histórico some de qualquer jeito). Já existe "desativar" com o mesmo efeito prático — duas formas de "tirar de uso" seria redundância.

---

## Questão 7 — Código HTTP do reenvio não permitido

### Decisão

**`409 Conflict`** — reenviar uma entrega que não está em `FAILED` conflita com o estado atual do recurso. Mesmo raciocínio já registrado em `docs/features/ajuste-estoque/research.md` (409 para conflito de estado verificado pela aplicação; `HttpError(409, ...)`).

### Fontes

- [MDN — 409 Conflict](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/409)
- `docs/features/ajuste-estoque/research.md`, Questão 2

---

## Questão 8 (nova) — SSRF na prática

A spec chama webhooks de "especialmente vulneráveis a SSRF" e sugere um proxy de saída que filtra IPs internos (ex.: *smokescreen*) e workers numa sub-rede isolada. As duas são infraestrutura de rede, fora do alcance deste projeto hoje. O equivalente em nível de aplicação:

### Decisão

1. **Validação no cadastro** (Zod): URL absoluta; `https` obrigatório em produção; `http://localhost` aceito só fora de produção (receptor de demonstração).
2. **Validação na hora da conexão, não só no cadastro.** O envio usa `node:https`/`node:http` com uma função `lookup` própria: o DNS é resolvido, cada IP resolvido é checado contra uma lista de faixas bloqueadas (`net.BlockList` nativo: loopback, redes privadas, link-local/metadados de nuvem `169.254.0.0/16`, CGNAT, `0.0.0.0/8`, e equivalentes IPv6 incluindo IPv4 mapeado), e a conexão é feita **nesse mesmo IP**. Isso fecha o *DNS rebinding* — o desvio relatado em vários sistemas que validam o nome no cadastro mas conectam depois a um IP diferente.
3. **Nunca segue redirecionamento** (Questão 3).
4. Fora de produção, a lista de bloqueio libera só loopback, para o receptor local funcionar.

### Alternativa descartada

`fetch` global do Node: não aceita uma função `lookup` sem instalar o pacote `undici` para criar um `Agent` próprio. `node:https` aceita `lookup` nativamente — zero dependência.

### Fontes

- [Standard Webhooks — seção de segurança (SSRF)](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md)
- [OWASP — Server-Side Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Node.js — `http.request` (opção `lookup`)](https://nodejs.org/api/http.html#httprequestoptions-callback) · [Node.js — `net.BlockList`](https://nodejs.org/api/net.html#class-netblocklist)

---

## Questão 9 (nova) — Como guardar o segredo de assinatura

HMAC exige o segredo **em claro** na hora de assinar, então ele não pode ser guardado como hash (diferente da senha de usuário). Guardar em claro significa que um vazamento do banco permite forjar eventos para todos os receptores.

### Decisão

Segredo cifrado em repouso com **AES-256-GCM** (`node:crypto`), chave de 32 bytes em uma variável de ambiente nova validada em `env.ts` (mesmo padrão de `JWT_SECRET`). O segredo em claro só existe na memória do worker na hora de assinar e na resposta da criação/rotação.

### Justificativa

Separa as duas coisas que um atacante precisaria (o banco **e** a variável de ambiente). Custo: uma variável nova no `.env.example`, no CI e no README — e uma chave de teste fixa no ambiente de testes.

---

## Resultado

| Questão | Decisão |
|---|---|
| 1. Fila | Outbox transacional no PostgreSQL, fan-out na transação, reivindicação com `SKIP LOCKED` + lease |
| 2. Processo | Worker separado no pacote `backend`, núcleo testável sem timers |
| 3. Retentativa | 2xx = sucesso; 15 s; 3xx = falha; cronograma Svix (8 tentativas, ~27 h) com jitter; `Retry-After`; `410` desativa |
| 4. Assinatura | Standard Webhooks (`webhook-id`/`-timestamp`/`-signature`, HMAC-SHA256, `whsec_`) |
| 5. Desativação | `410` na hora; senão falhando há ≥ 5 dias |
| 6. Retenção/exclusão | 30 dias para finalizadas; exclusão definitiva com confirmação, desativar preserva histórico |
| 7. Reenvio não permitido | `409 Conflict` |
| 8. SSRF | Bloqueio de faixas internas na hora da conexão (`lookup` + `net.BlockList`), sem redirecionamento, `https` em produção |
| 9. Segredo | AES-256-GCM com chave em variável de ambiente |

**Dependências novas de runtime: nenhuma.** DevDependency candidata: biblioteca de referência da Standard Webhooks, só para provar a compatibilidade nos testes e no receptor de demonstração (confirmar no PLAN).
