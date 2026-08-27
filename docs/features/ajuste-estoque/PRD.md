# PRD — Ajuste de Estoque

> Consolida as decisões de `idea.md`, `research.md` e `prototype.md` num contrato de produto verificável. Não define nomes de função, estrutura interna do `StockService`, arquivos a mudar, ordem de implementação ou testes específicos — isso é do `implementation-plan.md`.

## Contexto

O schema já modela `StockMovement.type = ADJUSTMENT` (Fase 1 de estoque auditável, ver `docs/current-state.md`), mas nenhuma rota, serviço ou UI usa esse tipo hoje. As três fases anteriores desta feature já resolveram: o formato do input (saldo alvo), a proteção de concorrência (`expectedPreviousQuantity`), a forma da API (`POST /products/:id/adjustments`, HTTP 409 para conflito), e o comportamento de UX (formulário → confirmação estruturada → conflito tratado explicitamente → histórico com `previousQuantity → newQuantity`).

## Problema

Não existe hoje um mecanismo para corrigir divergência entre o saldo do sistema e a contagem física de um produto que (a) capture a correção como uma movimentação auditável distinta de `IN`/`OUT` normais, (b) exija motivo, e (c) não corra o risco de sobrescrever silenciosamente uma alteração de saldo concorrente.

## Objetivo

Permitir que um usuário autenticado registre uma correção de saldo informando a contagem física observada (saldo alvo), gerando uma `StockMovement` do tipo `ADJUSTMENT` com saldo anterior, saldo posterior, usuário, data e motivo — sem nunca aplicar a correção "por cima" de uma alteração de saldo que aconteceu depois que o usuário viu o saldo na tela.

## Usuários

Qualquer usuário autenticado do sistema. Não há distinção de papel nesta versão (ver "Permissões").

## Escopo

- Registro de um ajuste de estoque (saldo alvo → `StockMovement` tipo `ADJUSTMENT`) para um produto existente.
- Verificação de conflito de concorrência antes de gravar (`expectedPreviousQuantity`).
- Confirmação explícita antes da gravação, mostrando saldo atual, novo saldo, diferença e motivo.
- Exibição de `ADJUSTMENT` no histórico de movimentações do produto (`MovementHistoryModal`), incluindo filtro por tipo, saldo anterior → novo saldo, diferença com sinal, motivo, responsável (quando disponível) e data.
- Ponto de entrada da ação no menu de ações do produto (`ProductActionsMenu`).

## Fora do Escopo

- RBAC / controle de quem pode ajustar — qualquer usuário autenticado pode ajustar nesta versão; introduzir papéis é feature própria e futura.
- Alteração da ação "Zerar Estoque" existente (`ProductActionsMenu` → `useProductMutations.zeroBalance`) — permanece exatamente como está; a inconsistência entre ela (sem motivo obrigatório) e `ADJUSTMENT` (com motivo obrigatório) é uma dívida relacionada já registrada em `idea.md`, não resolvida aqui.
- "Desfazer"/reverter um ajuste já registrado — correção de um ajuste incorreto é um novo `ADJUSTMENT`.
- Edição ou exclusão de qualquer `StockMovement` já criada.
- Generalização do componente `ConfirmDialog`/`useConfirm` — o passo de confirmação desta feature usa o primitivo `Modal` diretamente, dentro do próprio fluxo do formulário de ajuste, para não expandir o escopo de um componente compartilhado por outras ações do sistema. Isto é uma decisão de escopo desta feature, não um detalhe de implementação: o PRD não prescreve como o `AdjustmentFormModal` deve estruturar internamente esse passo, só que ele não deve depender de mudar `ConfirmDialog`/`useConfirm`.
- Migração de tipos para `packages/shared`, decomposição do `ProductDashboard`, soft delete de produto, deploy real — dívidas já registradas em `docs/current-state.md`, não tocadas por esta feature.

## Fluxos

**Fluxo principal — ajuste bem-sucedido**
1. Usuário abre a ação "Ajustar Estoque" a partir do menu de ações do produto, vendo o saldo atual.
2. Informa o saldo alvo (contagem física) e o motivo.
3. Revisa um preview de saldo atual → novo saldo e a diferença com sinal.
4. Confirma explicitamente, revendo um resumo estruturado (produto, saldo atual, novo saldo, diferença, motivo) antes da gravação.
5. Sistema registra a movimentação `ADJUSTMENT` e atualiza o saldo do produto e seu histórico.

**Fluxo alternativo — conflito de concorrência**
1. Usuário abre o ajuste vendo um saldo X.
2. Antes de confirmar, o saldo real do produto muda por outra operação.
3. Ao confirmar, o sistema rejeita a operação (nenhuma movimentação é criada) e comunica explicitamente que o saldo mudou, mostrando o saldo que o usuário via e o saldo atual real.
4. Usuário reconhece a mudança explicitamente antes de poder tentar novamente; o motivo já digitado é preservado, o valor de saldo alvo anterior não é reaproveitado automaticamente.

**Fluxo alternativo — cancelamento**
1. Usuário inicia o ajuste em qualquer ponto do formulário ou da confirmação e cancela.
2. Nenhuma movimentação é criada; nenhum efeito colateral no saldo do produto.

**Fluxo de consulta — histórico**
1. Usuário abre o histórico de movimentações do produto.
2. Pode filtrar por tipo, incluindo `ADJUSTMENT`.
3. Cada linha de `ADJUSTMENT` mostra saldo anterior → novo saldo, diferença com sinal, motivo, responsável (quando disponível) e data.

## Requisitos Funcionais

1. O sistema deve permitir registrar um ajuste de estoque para um produto existente, a partir de um saldo alvo informado pelo usuário (nunca um delta).
2. O sistema deve calcular a diferença (saldo alvo − saldo atual) no backend — o cliente nunca informa a diferença diretamente.
3. O sistema deve exigir um motivo não vazio para todo ajuste, com limite máximo de 500 caracteres.
4. O sistema deve rejeitar um saldo alvo negativo.
5. O sistema deve rejeitar um ajuste cujo saldo alvo seja igual ao saldo atual do produto, sem criar nenhuma movimentação.
6. O sistema deve permitir saldo alvo igual a zero.
7. O sistema deve verificar, no momento da gravação, se o saldo atual real do produto ainda corresponde ao saldo que o usuário via quando iniciou o ajuste (`expectedPreviousQuantity`); se não corresponder, deve rejeitar a operação como conflito, sem aplicar o ajuste.
8. O sistema nunca deve aplicar um ajuste "por cima" de uma alteração de saldo concorrente não vista pelo usuário — não existe comportamento de "último ajuste vence".
9. O sistema deve exigir uma confirmação explícita do usuário, exibindo produto, saldo atual, novo saldo, diferença e motivo, antes de gravar qualquer ajuste.
10. O sistema deve exibir, durante o preenchimento do formulário, um preview do saldo atual → novo saldo e da diferença com sinal, atualizado conforme o usuário digita.
11. Ao ocorrer um conflito de concorrência, o sistema deve comunicar explicitamente ao usuário o saldo que ele via e o saldo atual real, e exigir uma ação explícita de reconhecimento antes de permitir nova tentativa — nunca fechar o fluxo silenciosamente nem reaplicar automaticamente.
12. Ao ocorrer um conflito de concorrência, o motivo já digitado pelo usuário deve ser preservado para a nova tentativa.
13. Todo ajuste registrado deve gravar o usuário responsável a partir da sessão autenticada, nunca de um valor informado pelo cliente.
14. Uma vez registrada, uma movimentação `ADJUSTMENT` é imutável — não pode ser editada nem excluída. A correção de um ajuste incorreto é feita por meio de outro `ADJUSTMENT`.
15. O histórico de movimentações do produto deve incluir `ADJUSTMENT` como opção no filtro por tipo.
16. O histórico de movimentações deve representar cada `ADJUSTMENT` mostrando saldo anterior → novo saldo e a diferença com sinal — não apenas uma quantidade sem direção.
17. O histórico de movimentações deve exibir o motivo, o responsável (quando disponível) e a data de cada `ADJUSTMENT`.
18. Quando uma movimentação (de qualquer tipo, incluindo registros anteriores à existência dos campos de auditoria) não tiver informação suficiente para identificar o responsável, o histórico deve exibir "Usuário não disponível" — nunca inventar um usuário nem ocultar silenciosamente a ausência dessa informação.
19. O histórico deve continuar funcionando (sem quebrar ou omitir a linha) para movimentações antigas que não possuam `previousQuantity`/`newQuantity`/`userId` preenchidos.
20. A identificação de um `ADJUSTMENT` no histórico não pode depender somente de cor — precisa de identificação textual própria, distinguível de `IN`/`OUT`.
21. A ação de iniciar um ajuste deve estar disponível a partir do menu de ações do produto.

## Requisitos Não Funcionais

1. A verificação de conflito de concorrência e a gravação da movimentação devem ocorrer dentro da mesma transação de banco com lock de linha no produto, reaproveitando o mecanismo já existente e testado no projeto (não um mecanismo de concorrência novo).
2. Toda entrada HTTP do ajuste (saldo alvo, saldo esperado, motivo) deve ser validada no backend, independentemente de qualquer validação client-side.
3. A resposta de erro de conflito de concorrência deve usar o código HTTP `409 Conflict` (decisão de `research.md`).
4. A API de ajuste deve ser exposta como endpoint dedicado (`POST /products/:id/adjustments`), não como uma variante de contrato de `POST /products/:id/movements` (decisão de `research.md`).
5. O passo de confirmação deve reaproveitar o primitivo de diálogo único do projeto (`Modal`), sem introduzir um novo sistema de diálogo nem depender de generalizar `ConfirmDialog`/`useConfirm`.
6. Nenhum dado de auditoria (usuário, saldo anterior/posterior, motivo, data) pode ficar ausente para um ajuste criado por esta feature — a degradação graciosa (item 19 dos Requisitos Funcionais) se aplica apenas a registros anteriores a esta feature, nunca a um `ADJUSTMENT` novo.

## Regras de Negócio

- O input do usuário é sempre o saldo alvo (contagem física observada), nunca um delta; o backend deriva a diferença.
- Motivo é obrigatório: não vazio/em branco, máximo de 500 caracteres.
- Saldo alvo deve ser um inteiro maior ou igual a zero.
- Saldo alvo igual ao saldo atual não gera movimentação (não há "ajuste de diferença zero").
- Toda gravação de ajuste é condicionada à confirmação de que o saldo atual real, lido no momento da gravação, corresponde ao saldo que o usuário via ao iniciar a operação (`expectedPreviousQuantity`); divergência é sempre um conflito rejeitado, nunca resolvida automaticamente a favor do último pedido.
- `ADJUSTMENT` é imutável após criado; qualquer correção é um novo `ADJUSTMENT`.
- Qualquer usuário autenticado pode registrar um ajuste nesta versão (sem RBAC).

## Modelo Conceitual

Um **Ajuste de Estoque** é uma operação sobre um **Produto** existente que produz, quando aceita, exatamente uma **Movimentação de Estoque** do tipo `ADJUSTMENT`, contendo: o produto ajustado, o saldo anterior (lido no momento da gravação), o saldo posterior (o saldo alvo informado), a diferença entre os dois, o motivo informado pelo usuário, o usuário responsável (da sessão autenticada) e a data/hora do registro. Uma tentativa de ajuste que não altera o saldo, que informa um saldo alvo inválido, ou cujo saldo esperado não corresponde ao saldo real no momento da gravação, não produz nenhuma Movimentação de Estoque.

Este modelo conceitual não prescreve nomes de campo, tipos de dado exatos ou estrutura de tabela — isso já existe no schema atual (ver `docs/current-state.md`) e qualquer ajuste fino de nomenclatura é decisão do `implementation-plan.md`.

## Permissões

Qualquer usuário autenticado pode registrar um ajuste de estoque para qualquer produto. Não há distinção de papel, nível de acesso ou aprovação nesta versão. Isto é uma decisão de escopo consciente, não uma lacuna a ser corrigida por esta feature (ver "Riscos").

## Tratamento de Erros

| Situação | Comportamento esperado |
|---|---|
| Produto não existe | Operação rejeitada; nenhuma movimentação criada |
| Motivo vazio/em branco | Operação rejeitada antes da gravação; usuário permanece no formulário com o erro indicado |
| Motivo acima de 500 caracteres | Operação rejeitada antes da gravação; usuário permanece no formulário com o erro indicado |
| Saldo alvo negativo | Operação rejeitada antes da gravação |
| Saldo alvo igual ao saldo atual | Operação rejeitada antes mesmo da etapa de confirmação; nenhuma movimentação criada |
| Saldo atual real diverge de `expectedPreviousQuantity` no momento da gravação | Operação rejeitada com HTTP 409; nenhuma movimentação criada; usuário é informado do saldo que via e do saldo atual real, e precisa reconhecer explicitamente antes de tentar de novo; motivo já digitado é preservado |
| Usuário não autenticado | Operação rejeitada (mesmo padrão já aplicado a toda rota mutável do sistema) |
| Erro inesperado (rede, erro interno do servidor) | Operação não é considerada concluída; usuário permanece no formulário com uma mensagem de erro; nenhum estado de saldo é presumido alterado sem confirmação do servidor |

## Edge Cases

- Ajuste para cima (saldo alvo > saldo atual).
- Ajuste para baixo (saldo alvo < saldo atual).
- Ajuste para exatamente zero.
- Ajuste para o mesmo saldo atual (rejeitado, sem movimentação).
- Saldo alvo negativo (rejeitado).
- Motivo vazio/em branco (rejeitado).
- Motivo no limite exato de 500 caracteres (aceito) e acima do limite (rejeitado).
- Conflito de concorrência: saldo mudou entre abertura do formulário e confirmação.
- Cancelamento em qualquer ponto do fluxo (formulário ou confirmação) — nenhum efeito colateral.
- Histórico consultando movimentações antigas sem `previousQuantity`/`newQuantity`/`userId` preenchidos — deve continuar funcionando, com "Usuário não disponível" quando aplicável.
- Erro inesperado durante o envio — usuário não deve ficar sem saber se o ajuste foi ou não aplicado.

## Critérios de Aceite

**Ajuste para baixo**
```
DADO um produto com saldo 20
E o usuário abriu o ajuste vendo saldo 20
QUANDO informar saldo alvo 18
E motivo "Contagem física mensal"
E confirmar
ENTÃO deve ser registrada uma movimentação ADJUSTMENT
COM previousQuantity = 20
E newQuantity = 18
E quantity = 2
E responsável = usuário autenticado
E motivo = "Contagem física mensal"
```

**Ajuste para cima**
```
DADO um produto com saldo 10
E o usuário abriu o ajuste vendo saldo 10
QUANDO informar saldo alvo 12
E motivo válido
E confirmar
ENTÃO deve ser registrada uma movimentação ADJUSTMENT
COM previousQuantity = 10
E newQuantity = 12
E quantity = 2
```

**Ajuste para zero**
```
DADO um produto com saldo 5
QUANDO informar saldo alvo 0
E motivo válido
E confirmar
ENTÃO deve ser registrada uma movimentação ADJUSTMENT
COM previousQuantity = 5
E newQuantity = 0
```

**Mesmo saldo**
```
DADO um produto com saldo 20
QUANDO informar saldo alvo 20
ENTÃO a operação deve ser rejeitada
E nenhuma movimentação deve ser criada
```

**Saldo negativo**
```
DADO um produto com saldo 20
QUANDO informar saldo alvo -1
ENTÃO a operação deve ser rejeitada
E nenhuma movimentação deve ser criada
```

**Motivo vazio**
```
DADO um produto com saldo 20
QUANDO informar saldo alvo 18
E motivo vazio ou só espaços em branco
ENTÃO a operação deve ser rejeitada
E nenhuma movimentação deve ser criada
```

**Motivo acima do limite**
```
DADO um produto com saldo 20
QUANDO informar saldo alvo 18
E motivo com mais de 500 caracteres
ENTÃO a operação deve ser rejeitada
E nenhuma movimentação deve ser criada
```

**Conflito concorrente**
```
DADO um produto com saldo 20
E o usuário abriu o ajuste vendo saldo 20
E, antes da confirmação, o saldo real do produto muda para 15 por outra operação
QUANDO o usuário confirmar o ajuste para saldo alvo 18
ENTÃO a operação deve ser rejeitada com conflito (HTTP 409)
E nenhuma movimentação deve ser criada
E o usuário deve ser informado do saldo que via (20) e do saldo atual real (15)
E o motivo já digitado deve ser preservado
E o sistema não deve permitir nova tentativa sem reconhecimento explícito do usuário
```

**Confirmação**
```
DADO que o usuário preencheu saldo alvo e motivo válidos
QUANDO avançar para a etapa de confirmação
ENTÃO deve ser exibido produto, saldo atual, novo saldo, diferença e motivo
E nenhuma movimentação deve ser criada antes da confirmação explícita
```

**Cancelamento**
```
DADO que o usuário iniciou um ajuste (formulário ou confirmação)
QUANDO cancelar em qualquer ponto antes da confirmação final
ENTÃO nenhuma movimentação deve ser criada
E o saldo do produto deve permanecer inalterado
```

**Histórico exibe ADJUSTMENT corretamente**
```
DADO um produto com uma movimentação ADJUSTMENT registrada
E previousQuantity = 20, newQuantity = 18, motivo = "Contagem física mensal"
QUANDO o usuário abrir o histórico de movimentações do produto
ENTÃO a movimentação deve ser identificável como ajuste por texto (não apenas cor)
E deve exibir "20 → 18" e a diferença "-2"
E deve exibir o motivo, o responsável e a data
E deve ser possível filtrar o histórico para mostrar apenas ADJUSTMENT
```

**Dados antigos incompletos**
```
DADO uma movimentação registrada antes da existência dos campos de auditoria
E previousQuantity, newQuantity e/ou userId ausentes
QUANDO o usuário abrir o histórico de movimentações do produto
ENTÃO a movimentação deve continuar sendo exibida sem quebrar a tela
E o responsável ausente deve ser exibido como "Usuário não disponível"
```

**Erro inesperado**
```
DADO que o usuário confirmou um ajuste válido
QUANDO ocorrer um erro inesperado (rede ou erro interno do servidor) durante o envio
ENTÃO nenhuma movimentação deve ser considerada criada sem confirmação do servidor
E o usuário deve ser informado do erro
E o usuário deve poder tentar novamente sem perder os dados já preenchidos
```

## Riscos

- **Ausência de RBAC**: qualquer usuário autenticado pode ajustar qualquer produto sem nenhuma barreira de acesso — risco conhecido e conscientemente aceito para esta versão (já registrado em `idea.md`).
- **Inconsistência com "Zerar Estoque"**: após esta feature, existirão duas formas de zerar o saldo de um produto — uma auditada com motivo obrigatório (`ADJUSTMENT` para saldo 0) e uma sem motivo (`Zerar Estoque` existente) — dívida relacionada, deliberadamente fora do escopo.
- **Dados de auditoria incompletos em registros antigos**: histórico precisa lidar com movimentações sem `previousQuantity`/`newQuantity`/`userId`, o que aumenta a superfície de casos que a interface de histórico precisa cobrir corretamente.

## Questões em Aberto

- Formato exato de exibição do responsável quando disponível (nome completo, e-mail, ou outro identificador) — não definido em nenhum documento anterior; a única decisão fixada é o texto para quando **não** está disponível ("Usuário não disponível").
- Tratamento visual exato (cores/classes) da linha `ADJUSTMENT` no histórico — deliberadamente deixado para `implementation-plan`/`EXECUTION`, respeitando os padrões visuais e de acessibilidade já existentes.
- Posição exata do item "Ajustar Estoque" dentro do `ProductActionsMenu` — deliberadamente deixada para `implementation-plan`, após inspeção do componente, sem reorganizar as demais ações sem necessidade.
- Como o `AdjustmentFormModal` deve estruturar internamente a transição formulário → confirmação → conflito usando o `Modal` primitivo — decisão de escopo já fixada (não generalizar `ConfirmDialog`), mas a estrutura interna exata é implementação, não produto.
