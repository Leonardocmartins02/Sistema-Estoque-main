# IDEA — Integrações por Webhook (eventos de estoque)

> Fase 1 do workflow (`IDEA → RESEARCH → PROTOTYPE → PRD → IMPLEMENTATION PLAN → EXECUTION → QA`). Este documento define O PROBLEMA e AS REGRAS DE NEGÓCIO. Não decide forma de endpoint, estrutura de tabela ou biblioteca — isso é RESEARCH/PRD/PLAN.

## Problema

Hoje o SimpleStock é um sistema fechado: nenhum outro sistema (loja virtual, ERP, compras, um canal de mensagens) fica sabendo quando o saldo de um produto muda. A única forma de integrar seria consultar a API periodicamente (polling), o que é atrasado, caro e obriga o outro lado a comparar listas inteiras para descobrir o que mudou.

Além disso, qualquer tentativa ingênua de "avisar outro sistema" dentro da rota — chamar uma URL externa logo depois de gravar a movimentação — cria três falhas reais: (1) se o destino estiver lento ou fora do ar, a operação de estoque do usuário fica lenta ou falha por um motivo que não é dela; (2) se o processo cair entre gravar no banco e chamar a URL, o aviso se perde para sempre; (3) se a chamada acontecer e a transação depois for desfeita, o outro sistema recebe um evento que nunca aconteceu.

## Objetivo

Permitir que sistemas externos se inscrevam para receber **eventos de estoque** por HTTP (webhooks), com entrega **confiável e assíncrona**: todo evento que aconteceu de fato é entregue pelo menos uma vez, nenhum evento que não aconteceu é entregue, e a operação de estoque do usuário nunca depende da disponibilidade do destino.

Objetivo secundário, explícito: este é o projeto de aprendizado de integrações do portfólio — webhooks, fila, retentativa e recuperação de falhas precisam ser **demonstráveis** (ver um destino falhar, o sistema retentar, e a entrega se recuperar).

## Usuários

- **Quem opera o estoque** (usuário autenticado atual): continua movimentando estoque exatamente como hoje, sem perceber diferença de tempo de resposta.
- **Quem configura integrações** (também usuário autenticado — não há papéis hoje): cadastra destinos, escolhe eventos, acompanha entregas e reenvia as que falharam.
- **Sistema receptor** (máquina, não pessoa): recebe os eventos, verifica que vieram do SimpleStock e ignora duplicatas.

## Eventos da primeira versão

| Evento | Quando acontece |
|---|---|
| `stock.movement.created` | Toda `StockMovement` nova gravada pelo `StockService` (`IN`, `OUT`, `ADJUSTMENT`, `INITIAL_STOCK`) |
| `stock.status.changed` | Quando uma movimentação muda o status derivado do produto (`OK` ↔ `ATTN` ↔ `OUT`, mesma regra de `matchesStatus` em `routes/products.ts`) — o caso de uso é "avisar compras quando o estoque ficar baixo ou zerar" |

O conteúdo de cada evento é uma **fotografia do momento** (produto, SKU, tipo, quantidade, saldo anterior → novo, status anterior → novo, quando aconteceu), não uma referência que o receptor precise consultar depois — o produto pode até ser excluído mais tarde e o evento continua fazendo sentido.

## Fluxo Desejado

1. Usuário cadastra um destino: URL, eventos de interesse, ativo/inativo. O sistema gera um **segredo de assinatura** e o mostra uma única vez.
2. Usuário (ou baixa rápida, ajuste, criação com estoque inicial) grava uma movimentação, como hoje.
3. Na **mesma transação** da movimentação, o sistema registra o evento correspondente. Se a transação falhar, o evento não existe; se a transação confirmar, o evento está garantido no banco.
4. Um processo separado de entrega pega eventos pendentes e envia para cada destino inscrito, assinando a requisição.
5. Resposta `2xx` dentro do tempo limite = entregue. Qualquer outra coisa (erro, timeout, `5xx`, `4xx`) = falha registrada e nova tentativa agendada com espera crescente.
6. Depois do número máximo de tentativas, a entrega vai para o estado **"falhou definitivamente"** (dead letter) e fica visível na tela de integrações.
7. Usuário vê o histórico de tentativas de cada entrega (quando, código HTTP, tempo, erro) e pode **reenviar manualmente** uma entrega que falhou definitivamente.

## Regras de Negócio

- **Evento nasce na transação do estoque, nunca fora dela.** Toda sequência que grava `StockMovement` já roda em `prisma.$transaction` dentro do `StockService`; o registro do evento entra nessa mesma transação. Nenhuma chamada HTTP externa acontece dentro de transação de estoque, jamais.
- **Entrega é assíncrona e desacoplada.** A latência e o resultado da operação de estoque não dependem de nenhum destino. Um destino fora do ar por horas não afeta nenhum usuário do estoque.
- **Entrega "pelo menos uma vez", não "exatamente uma vez".** Em falhas (processo cai depois de enviar e antes de registrar o sucesso), o mesmo evento pode chegar duas vezes. Todo evento tem um **identificador único e estável**, enviado em toda tentativa, para o receptor descartar duplicatas. Isso é documentado como contrato, não escondido.
- **Ordem não é garantida entre eventos.** Cada evento carrega saldo anterior/novo e o momento em que aconteceu, para o receptor conseguir ignorar um evento mais antigo que chegue depois de um mais novo.
- **Toda requisição é assinada.** Assinatura HMAC com o segredo do destino sobre o corpo + momento do envio, para o receptor provar que veio do SimpleStock e rejeitar reenvio malicioso de uma requisição antiga capturada.
- **O segredo nunca reaparece.** É mostrado só na criação (ou ao gerar um novo); nunca volta em listagem, log ou resposta de API depois disso. Rotacionar o segredo é possível.
- **Retentativa com espera crescente e limite.** Tentativas espaçadas cada vez mais (com uma variação aleatória para não sincronizar picos), até um número máximo. Valores exatos ficam para RESEARCH.
- **Recuperação de queda do processo de entrega.** Se o processo morrer no meio de uma entrega, essa entrega não pode ficar presa para sempre nem ser enviada por dois processos ao mesmo tempo — outro processo (ou o mesmo, ao voltar) retoma depois de um prazo.
- **Destino inativo não recebe nada**, e eventos gerados enquanto ele estava inativo não são acumulados para envio posterior.
- **Reenvio manual reaproveita o mesmo evento** (mesmo identificador, mesmo conteúdo), não cria um evento novo — o receptor deve conseguir deduplicar um reenvio manual também.
- **Auditoria:** cadastro, alteração, rotação de segredo e reenvio manual registram o usuário autenticado (`req.user.id`), mesmo princípio das movimentações.

## Segurança

- **SSRF:** a URL de destino é informada pelo usuário e o servidor fará requisições para ela. Em produção, só `https`, e destinos que resolvem para endereços internos (loopback, rede privada, metadados de nuvem) são recusados — senão o recurso vira uma forma de fazer o servidor acessar a rede interna. Em desenvolvimento, `http://localhost` é permitido para o receptor de demonstração.
- **Nada de segredo ou corpo de resposta completo em log.** O histórico de tentativas guarda código HTTP, tempo e um trecho curto e truncado da resposta/erro — nunca headers de autenticação nem o segredo.
- Toda rota de configuração de integrações exige `requireAuth`, e toda entrada passa por Zod (regras já obrigatórias no `CLAUDE.md`).

## Erros Esperados

| Situação | Resultado |
|---|---|
| URL inválida, não-https em produção, ou resolvendo para endereço interno | 400 na criação/edição do destino |
| Nenhum evento selecionado | 400 |
| Destino não existe | 404 |
| Reenvio de entrega que não falhou definitivamente | Recusado (código exato em RESEARCH) |
| Destino fora do ar / lento / responde erro | Não é erro para o usuário do estoque — vira tentativa falha e retentativa |
| Não autenticado | 401 (já coberto por `requireAuth`) |

## UX

- Uma área **"Integrações"** acessível pelo app autenticado: lista de destinos (URL, eventos, ativo, saúde recente), criar/editar/desativar, rotacionar segredo (com confirmação via `ConfirmDialog`/`useConfirm`, padrão do projeto).
- Histórico de entregas com status textual (não só cor — `Badge` existente): pendente, entregue, retentando, falhou definitivamente; detalhe das tentativas; botão de reenviar nas que falharam definitivamente.
- Segredo exibido uma única vez, com aviso claro e botão de copiar.
- Um **receptor de demonstração** (fora do app, só para dev/demo) que mostra os eventos recebidos, valida a assinatura e pode ser configurado para falhar de propósito — é o que torna retentativa e recuperação visíveis no vídeo.

## Fora do Escopo (nesta feature)

- **Webhooks de entrada** (sistemas externos alterando estoque no SimpleStock) — direção oposta, com outras regras (idempotência de escrita, autenticação de máquina). Candidato natural para uma fase futura.
- **Eventos de cadastro** (`product.created/updated/deleted`) e mudança de status causada por edição de `minStock` sem movimentação — anotados como evolução; a primeira versão cobre só o que nasce no `StockService`.
- **RBAC** — qualquer usuário autenticado configura integrações, mesmo risco aceito em "Ajuste de Estoque".
- **Entrega exatamente-uma-vez e ordenação garantida** — conscientemente trocadas por pelo menos uma vez + id estável + fotografia de saldo.
- **Infraestrutura de fila externa** (Redis, RabbitMQ, SQS) — decisão de RESEARCH, mas a premissa é não adicionar infraestrutura que o projeto não tem hoje sem justificativa forte.
- **Deploy real** — dívida já registrada; a feature tem que funcionar e ser demonstrável localmente e em CI.

## Questões Deliberadamente Deixadas para RESEARCH

1. **Onde fica a fila:** tabela no próprio PostgreSQL (outbox transacional + processo de entrega usando `FOR UPDATE SKIP LOCKED`) vs. fila externa (BullMQ/Redis). Hipótese a validar: Postgres, porque o evento precisa nascer na mesma transação da movimentação de qualquer forma, e uma fila externa reintroduziria o problema de "gravar em dois lugares".
2. **Processo de entrega:** processo separado (`worker`) vs. laço dentro do processo da API — e como cada opção se comporta no CI, no `docker-compose` e num deploy futuro.
3. **Política de retentativa:** número máximo de tentativas, intervalos, tempo limite por requisição, se algum `4xx` (ex.: `410 Gone`) deve parar retentativas ou desativar o destino.
4. **Formato da assinatura e dos headers:** seguir um padrão conhecido (ex.: Standard Webhooks) vs. formato próprio.
5. **Desativação automática:** desativar um destino depois de N entregas consecutivas falhando definitivamente? Com aviso?
6. **Retenção:** por quanto tempo manter eventos/tentativas entregues; o que acontece com o histórico ao excluir um destino (soft delete do destino vs. cascata).
7. **Código HTTP de "reenvio não permitido"** (`409` vs. `422`), alinhado ao uso atual de `HttpError`.

## Riscos Registrados

- **Duplicatas no receptor** são inerentes à escolha "pelo menos uma vez" — mitigadas por id estável e documentação do contrato, não eliminadas.
- **Crescimento da tabela de eventos/tentativas** sem política de retenção.
- **SSRF** se a validação de destino for incompleta (ex.: DNS que muda de IP entre a validação e o envio).
- **Ausência de RBAC**: qualquer usuário autenticado pode apontar eventos de estoque para qualquer URL externa — vazamento de dado de negócio é possível por uso indevido; mitigação nesta fase é só auditoria.
- **`seed.ts` grava movimentações direto via Prisma** (fora do `StockService`) e, portanto, não gera eventos — aceitável para seed, mas é mais um motivo para nenhum código de negócio gravar `StockMovement` fora do serviço.
