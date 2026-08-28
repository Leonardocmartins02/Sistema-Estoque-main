# Fase 3 — Visual Research

**Data:** 28/08/2026
**Escopo:** pesquisa de padrões. Nenhum código, CSS ou arquivo de produto alterado.
**Fontes lidas antes de pesquisar:** `docs/ui-ux/audit.md`, `docs/ui-ux/user-flows.md`, `docs/current-state.md`, `AGENTS.md`, `CLAUDE.md`.

---

## 1. Método e limites desta pesquisa

A pesquisa **não** foi "olhar produtos bonitos e listar o que gostei". Ela foi conduzida ao contrário: parti dos 10 problemas já diagnosticados nas Fases 1 e 2, transformei cada um numa pergunta de pesquisa, e fui procurar quem já resolveu aquilo — dando preferência a **diretriz documentada e verificável** sobre lembrança de interface.

### 1.1 · Status epistêmico de cada afirmação

Interface muda; documentação de design system e artigo de pesquisa envelhecem mais devagar. Por isso cada padrão está marcado:

| Marca | Significado |
|---|---|
| **[DOC]** | Vem de documentação ou artigo de pesquisa que **consultei nesta sessão**. Verificável pelos links da seção 8 |
| **[OBS]** | Vem do meu conhecimento dos produtos, formado até maio/2026. **Não verificado agora.** Trate como hipótese de padrão, não como fato sobre o produto hoje |

Essa separação importa: um padrão **[OBS]** descrito errado viraria uma decisão de design apoiada em algo que não existe. Onde a decisão for cara, vale confirmar antes da Fase 4. Sinalizei os casos em que isso é recomendável.

### 1.2 · Regra que a pesquisa seguiu

Nenhuma entrada deste documento diz "o produto X faz assim, logo devemos fazer igual". Toda entrada tem a forma:

> **nosso problema é P** → este padrão reduz P **porque Y** → e **não** serve quando Z.

O bloco **NÃO APLICAR** é obrigatório em todos os padrões, e não é decoração: em vários casos ele é a parte mais importante, porque nosso domínio (estoque auditável, saldo derivado, movimentação permanente) invalida padrões que funcionam muito bem em outros produtos.

---

## 2. As perguntas de pesquisa

Os 10 problemas do brief, traduzidos no que fui procurar:

| # | Problema | Pergunta de pesquisa |
|---|---|---|
| 1 | Cerimônia inconsistente em operações irreversíveis | Como produtos maduros calibram confirmação × velocidade quando a ação não tem volta? |
| 2 | Mobile com capacidades removidas por acidente | Como se **decide** o que sai no mobile, em vez de deixar o layout decidir? |
| 3 | Tabela com baixa densidade informacional útil | Como aumentar informação por linha sem virar ruído? |
| 4 | Histórico que não explica a evolução do saldo | Como um log de auditoria comunica "o que mudou, de quanto para quanto, por quê e por quem"? |
| 5 | Múltiplos sistemas de modal | Como um único primitivo cobre confirmação, formulário e visualização? |
| 6 | Foco/spacing/cor/radius inconsistentes | Como tokens semânticos impedem a inconsistência por construção? |
| 7 | Filtros difíceis de desfazer no mobile | Como tornar o estado de filtro visível e removível em qualquer largura? |
| 8 | Ações destrutivas com risco humano | Como impedir o erro em vez de explicá-lo no último instante? |
| 9 | Seleção múltipla e paginação | Onde vivem as ações em lote e o que acontece com a seleção ao navegar? |
| 10 | Design system fragmentado | Quantos primitivos, quantas variantes, e quando parar de abstrair? |

---

## 3. Perfis das referências

Análise resumida por referência, nos seis eixos pedidos. O detalhamento acionável está no catálogo de padrões (seção 4) — aqui é o mapa de "quem é bom em quê".

### 3.1 · Shopify Admin / Polaris — **a referência mais próxima do nosso domínio**

É literalmente um sistema de gestão de estoque e pedidos, operado por pessoas não-técnicas, em desktop e celular.

- **Navegação** [OBS] — sidebar por objeto de negócio (Orders, Products, Inventory), página com título + ação primária única no topo à direita. Ações secundárias em menu.
- **Tabela operacional** [DOC] — o `IndexTable` é o componente para "lista de objetos que se pode selecionar e agir em lote", distinto de uma tabela de dados puramente tabular. Seleção por linha + barra de ações em lote.
- **Operações críticas** [OBS] — ajuste de inventário mostra a quantidade disponível atual e a resultante antes de salvar; o vocabulário é "available / on hand", não jargão de banco.
- **Histórico** [OBS] — timeline de eventos por objeto, com autor e horário, em linguagem natural.
- **Mobile** [DOC] — **o achado mais valioso desta pesquisa**: o `IndexTable` tem a prop `condensed`, recomendada como `useBreakpoints().smDown` para ocultar ações em lote abaixo de 490px — acompanhada de uma ressalva explícita na documentação: ocultar as ações em lote significa que a pessoa não consegue selecionar vários itens, então **só deve ser usado quando as ações em lote não forem essenciais ao fluxo**.
- **Design system** [OBS] — tokens semânticos versionados, escala de espaçamento fechada.

**Por que importa para nós:** é o único da lista cujo *problema* é o nosso problema. E o item de mobile é a diferença exata entre o que eles fazem e o que nós fazemos: lá, esconder no mobile é **uma prop, uma condição declarada e uma ressalva documentada**. Aqui, é um `hidden md:block` que levou junto ordenação, filtro e baixa rápida sem que ninguém tenha decidido isso (UF-07, UF-23, C-5).

### 3.2 · Linear — hierarquia e densidade

- **Navegação** [OBS] — sidebar estreita, conteúdo dominante, ação primária muito destacada e única por contexto.
- **Tabela operacional** [OBS] — lista densa, linha alta o suficiente para o toque, identificador secundário (ID da issue) embutido na célula primária em peso menor. Ações por linha aparecem no hover; sempre há um menu de overflow como caminho garantido.
- **Operações críticas** [OBS] — pouca cerimônia, porque quase tudo é reversível.
- **Histórico** [OBS] — timeline de atividade por issue, com "campo: antes → depois".
- **Mobile** [OBS] — app próprio, layout repensado, não a lista espremida.
- **Design system** [OBS] — escala tipográfica curta, poucos raios, foco consistente, contraste alto.

**Por que importa:** é a melhor referência de *hierarquia com densidade* — muita informação sem parecer entulhado. **Cuidado:** Linear é ferramenta de uso diário e intenso por gente técnica, com quase tudo reversível. Nosso operador pode usar o sistema esporadicamente e **nada** do que ele faz tem desfazer. Copiar a leveza de cerimônia do Linear seria copiar a conclusão sem a premissa.

### 3.3 · Stripe Dashboard — números, estados e auditoria

- **Navegação** [OBS] — hierarquia clara, breadcrumb de objeto, página de detalhe rica.
- **Tabela operacional** [OBS] — números tabulares alinhados à direita, moeda e unidade em peso menor que o número, status como badge com vocabulário fixo e pequeno (succeeded/failed/pending).
- **Operações críticas** [OBS] — antes de confirmar, mostra o efeito exato (valor, destino, taxa). Reembolso — operação de dinheiro, irreversível na prática — tem confirmação com resumo estruturado.
- **Histórico** [OBS] — timeline de eventos do objeto com timestamp absoluto **e** relativo, e o payload do que mudou.
- **Mobile** [OBS] — colunas prioritárias; secundárias caem para a linha de baixo ou para a tela de detalhe.
- **Design system** [OBS] — cor semântica disciplinada; cor usada para *estado*, quase nunca para decorar.

**Por que importa:** é a referência de *tratar número como conteúdo de primeira classe* e de *estado como vocabulário fechado* — exatamente nossas lacunas A-6 (números não comparáveis) e UF-34 (quatro tipos, três linguagens visuais).

### 3.4 · GitHub / Primer — ação destrutiva e escopo

- **Navegação** [OBS] — abas por área do repositório, ação primária evidente por contexto.
- **Tabela operacional** [OBS] — listas mais que tabelas; ações por linha em overflow.
- **Operações críticas** [OBS] — a "danger zone": ações destrutivas isoladas numa região visualmente separada, no fim da página, com borda e rótulo próprios. Exclusão de repositório exige **digitar o nome** do repositório.
- **Histórico** [OBS] — o produto inteiro é um log; diffs mostram antes/depois lado a lado.
- **Mobile** [OBS] — web responsivo com redução de colunas + app próprio.
- **Design system** [OBS] — Primer, com tokens semânticos e um único estilo de foco no sistema.

**Por que importa:** a "danger zone" é a materialização do princípio de separação espacial que a NN/g documenta **[DOC]** — e é o remédio direto para UF-45 (três exclusões com rótulos parecidos lado a lado) e UF-16 (Editar ao lado de Excluir no mesmo menu).

### 3.5 · Vercel — clareza de estado e vazio

- **Navegação** [OBS] — enxuta, poucos níveis.
- **Tabela operacional** [OBS] — listas de deploy com status forte (cor + texto + ícone), timestamp relativo.
- **Operações críticas** [OBS] — promoção/rollback de deploy com confirmação que nomeia o alvo.
- **Histórico** [OBS] — lista de deploys é o próprio histórico; cada item diz quem, quando, de qual commit.
- **Mobile** [OBS] — cards.
- **Design system** [OBS] — tipografia contida, muito preto/branco/cinza, cor reservada para estado.

**Por que importa:** disciplina cromática. É a prova de que um produto pode parecer moderno usando cor quase só para significado — o oposto do nosso botão de baixa rápida pintado de vermelho em todas as 10 linhas (A-1).

### 3.6 · Notion — progressive disclosure

- **Navegação** [OBS] — árvore lateral, breadcrumb.
- **Tabela operacional** [OBS] — database views com colunas configuráveis, filtros como chips visíveis acima da tabela, edição inline.
- **Operações críticas** [OBS] — quase tudo reversível, lixeira, histórico de versões.
- **Histórico** [OBS] — versões por página.
- **Mobile** [OBS] — app com layout repensado.
- **Design system** [OBS] — muito espaço em branco, densidade baixa.

**Por que importa:** os **chips de filtro visíveis acima do conteúdo** são a referência direta para UF-06/UF-07. **Cuidado:** a densidade baixa e a edição inline do Notion são inadequadas aqui (seção 5).

### 3.7 · ERP / WMS clássicos (SAP Fiori, NetSuite, Odoo, Katana) — classe de referência

Tratados como classe, não individualmente **[OBS]**.

- **Tabela operacional** — densidade alta, muitas colunas, totalizadores no rodapé, exportação. Frequentemente feias, mas **eficientes para quem usa o dia inteiro**.
- **Inventário** — a coluna "on hand" quase nunca aparece sozinha: vem acompanhada de "reorder point" / "min" / "committed". O veredito nunca aparece sem a evidência.
- **Operações críticas** — cerimônia alta, documento de ajuste com motivo obrigatório e trilha de auditoria.
- **Histórico** — extrato com **saldo corrente por linha**, no formato de extrato bancário.
- **Mobile** — historicamente ruim; os produtos novos (Katana, Sortly) partem do celular para contagem física.
- **Design system** — normalmente fraco/legado.

**Por que importa:** é a única classe que resolve nossos problemas 3 e 4 de frente. O ERP feio acertou uma coisa que o SaaS bonito costuma errar: **quem opera estoque precisa de evidência numérica, não de respiro visual**.

---

## 4. Catálogo de padrões, organizado pelos nossos problemas

### Problema 1 · Operações irreversíveis com cerimônia inconsistente
*(UF-21 saída sem barreira; UF-17/18 movimentação sem contexto nem preview; fluxo 8 com dupla confirmação)*

#### P1.1 · Cerimônia proporcional à reversibilidade

**REFERÊNCIA [DOC]** — A NN/g recomenda diálogo de confirmação **"before committing to actions with serious consequences — such as destroying users' work or costing large amounts of money"**, e adverte que o excesso destrói o mecanismo: **"if you warn people too much, they stop paying attention."**

**INSIGHT** — Confirmação é um recurso finito. Cada confirmação supérflua gasta a atenção que a próxima vai precisar. A calibragem correta não é "confirmar tudo" nem "confirmar nada": é confirmar **na proporção do dano irreversível**.

**APLICAÇÃO POSSÍVEL** — Nosso sistema tem a escada exatamente invertida. As três operações que gravam movimentação permanente têm cerimônias que não seguem nenhuma regra: ajuste (2 passos), baixa rápida (1 botão), entrada/saída manual (**nenhuma**). O padrão não diz "adicione confirmação em tudo" — diz que precisa existir **uma regra explícita** ligando consequência a barreira, e que hoje não existe. Definir essa escada é trabalho da Fase 4.

**NÃO APLICAR** — Não transformar a baixa rápida em fluxo de 2 passos. Ela existe para ser rápida, é usada em repetição, e o padrão da própria NN/g avisa que confirmação repetida vira reflexo automático. Se ela ganhar barreira, tem de ser de outro tipo (preview forte, alvo maior), não um passo a mais.

---

#### P1.2 · Botões que nomeiam a consequência, sem resposta padrão

**REFERÊNCIA [DOC]** — NN/g: usar **"response options that summarize what will happen for each possible response. For example, in the case of file deletion, use buttons labeled Delete file and Keep file"**, e não definir resposta padrão, já que o objetivo é forçar deliberação.

**INSIGHT** — "Confirmar/Cancelar" obriga a reconstruir mentalmente o que está sendo confirmado. Botão que nomeia a consequência permite decidir lendo **só o botão** — o que é o que a pessoa apressada de fato faz.

**APLICAÇÃO POSSÍVEL** — Nossos rótulos de confirmação já são razoavelmente bons ("Zerar estoque", "Excluir página"). O que falta é o **escopo** dentro do rótulo (P8.2) e a coerência do par: hoje o botão de cancelar é sempre "Cancelar", genérico.

**NÃO APLICAR** — Não inflar rótulos com frase inteira. "Excluir 3 produtos selecionados" é bom; "Sim, eu entendo que esta ação removerá permanentemente…" é ruído que ninguém lê.

---

#### P1.3 · Preview do estado resultante antes de confirmar

**REFERÊNCIA [OBS]** — Stripe mostra o valor exato resultante antes de confirmar um reembolso; o ajuste de inventário do Shopify mostra a quantidade disponível resultante.

**INSIGHT** — Preview transforma verificação em **reconhecimento** em vez de **cálculo**. A pessoa não precisa simular o efeito de cabeça; ela confere um número já pronto. Erros de direção e de ordem de grandeza aparecem sozinhos.

**APLICAÇÃO POSSÍVEL** — Esta é a maior oportunidade barata do sistema. Já **temos** o padrão implementado duas vezes — `AdjustmentFormModal` (com diferença assinada em texto) e `QuickOutModal` (com "Saldo Atual → Novo Saldo" em tempo real) — e ele está ausente exatamente onde o risco é maior: `MovementFormModal` (UF-18). Não é padrão novo a importar: é padrão **interno** a estender. Isso reduz a chance de erro de UF-21 sem adicionar nenhum passo.

**NÃO APLICAR** — O preview não pode desenhar estado que o domínio proíbe. É o erro atual do `QuickOutModal`, que pinta "Estoque negativo" para uma condição que o backend sempre recusa (UF-27/F-01). Preview mostra o **resultado válido**; o inválido tem de ser barrado ou avisado como bloqueio, não renderizado como se fosse um destino possível.

---

#### P1.4 · Contexto do objeto dentro da operação

**REFERÊNCIA [OBS]** — Em Stripe/Shopify/Linear, um diálogo de ação sobre um objeto praticamente sempre nomeia o objeto no título ou logo abaixo dele.

**INSIGHT** — Elimina *recall*. Quem abriu um modal a partir de uma lista de 10 linhas parecidas não deveria precisar lembrar em qual clicou — e, se errou o clique, o nome é a única chance de perceber **antes** de gravar.

**APLICAÇÃO POSSÍVEL** — `MovementFormModal` (UF-17) e `MovementHistoryModal` (UF-35) não nomeiam o produto; o `MovementFormModal` sequer recebe o nome (só `productId`). O `AdjustmentFormModal` já faz certo (`nome · SKU`). Padronizar isso é trivial e ataca dois achados ALTOS de uma vez.

**NÃO APLICAR** — Nada a ressalvar. É custo próximo de zero e benefício direto.

---

### Problema 2 · Mobile com capacidades removidas por acidente
*(UF-07, UF-23, UF-29, C-4, C-5)*

#### P2.1 · Esconder no mobile precisa ser uma decisão declarada, com condição e ressalva

**REFERÊNCIA [DOC]** — Polaris expõe `condensed` no `IndexTable`, com recomendação de uso `condensed={useBreakpoints().smDown}` para ocultar ações em lote abaixo de 490px — e documenta a ressalva: ocultar significa que não se pode selecionar vários itens, então **só deve ser usado quando as ações em lote não forem essenciais ao fluxo**.

**INSIGHT** — O valor não está no breakpoint; está em o esconder ser **explícito, condicional e acompanhado do critério que o justifica**. O padrão obriga quem escreve o código a responder "isto é essencial no mobile?" antes de sumir com a funcionalidade.

**APLICAÇÃO POSSÍVEL** — É o remédio direto do nosso pior achado de fluxo. Hoje `hidden md:block` no `ProductDashboard` levou junto, sem nenhuma decisão registrada: ordenação, filtro de status, limpar filtros, baixa rápida, seleção e ações em lote. A Fase 8 deveria produzir uma **tabela explícita de paridade** — capacidade × desktop × mobile × decisão — em que cada ausência no mobile é uma linha assinada, e não um efeito colateral. Note que o próprio Polaris **conscientemente** abre mão das ações em lote no mobile: isso é precedente relevante para a nossa decisão sobre seleção múltipla no celular (que hoje não existe, e talvez deva mesmo não existir — mas por escolha).

**NÃO APLICAR** — Não copiar o número 490px. Nosso breakpoint atual é `md` (768px) e a decisão de largura depende do nosso conteúdo, não do deles.

---

#### P2.2 · Filtro e ordenação em bottom sheet no mobile

**REFERÊNCIA [DOC]** — O padrão mais eficaz de filtro no mobile usa overlay em tela cheia ou gaveta inferior: toca-se em "Filtros", uma folha sobe e ocupa o espaço todo. Como os chips normalmente não cabem no mobile, mostra-se um contador no próprio botão — "Filtros (3)".

**INSIGHT** — Resolve o conflito real: filtro precisa de espaço para ser usado e de presença permanente para ser desfeito. A gaveta dá o espaço; o contador no botão dá a presença.

**APLICAÇÃO POSSÍVEL** — Ataca UF-07 diretamente. Hoje, no celular, dá para **entrar** num estado filtrado (pelo `LowStockBanner`) e não existe controle nenhum para sair. Um botão "Filtros" persistente, com contador, resolve entrada, visibilidade e saída ao mesmo tempo — e, de quebra, devolve a ordenação ao mobile, que hoje não existe.

**NÃO APLICAR** — Não introduzir um novo primitivo de overlay para isso. `CLAUDE.md` é explícito: um único primitivo de diálogo. A gaveta, se vier, tem de nascer como variante do `Modal` (Radix) já existente — nunca como um quarto sistema de portal, que é exatamente a dívida que estamos aqui para pagar (C-1).

---

#### P2.3 · Card mobile preserva a ação primária da linha

**REFERÊNCIA [OBS]** — Nas listas mobile do Shopify Admin e do Linear, o card carrega os mesmos dados de decisão da linha e mantém acessível a ação principal daquele objeto.

**INSIGHT** — O card não é um resumo decorativo da linha; é a **mesma unidade operacional** em outra forma. Se a ação principal sumiu, não houve adaptação — houve perda.

**APLICAÇÃO POSSÍVEL** — Nosso `ProductCardList` perdeu a baixa rápida e o estoque mínimo (C-5, UF-23). Como o celular é plausivelmente o dispositivo de quem está **fisicamente no estoque**, é defensável que a baixa rápida seja *mais* proeminente no card do que na linha, não menos.

**NÃO APLICAR** — Não empilhar no card as três ações da linha desktop. O card tem menos espaço e mais dedo: uma primária clara + overflow é melhor que três alvos pequenos competindo (Fitts).

---

### Problema 3 · Tabela com baixa densidade informacional útil
*(C-6, UF-40, A-1, A-6)*

#### P3.1 · O veredito nunca aparece sem a evidência

**REFERÊNCIA [OBS]** — Em sistemas de inventário, a quantidade em mãos raramente aparece sozinha: vem ao lado do ponto de reposição / mínimo / comprometido.

**INSIGHT** — Um status calculado ("Estoque Baixo") responde *se* há problema, mas não *quanto*. Quem precisa decidir **quanto comprar** precisa dos dois números na mesma linha de visão — senão a comparação vira memória de trabalho, e memória de trabalho é onde os erros nascem.

**APLICAÇÃO POSSÍVEL** — É a resposta direta a C-6/UF-40. Nossa tabela mostra o badge derivado de `balance < minStock` e **não mostra `minStock`**. Hoje, a única tela do sistema que mostra saldo e mínimo lado a lado é o `QuickOutListModal` — um modal secundário. O dado existe, o lugar é que está errado. E o caminho alternativo de consulta (Editar) está quebrado por UF-15.

**NÃO APLICAR** — Não resolver isso adicionando cinco colunas "porque ERP tem". Uma coluna a mais que responde uma pergunta real é densidade; cinco que ninguém lê é ruído.

---

#### P3.2 · Números tabulares alinhados à direita

**REFERÊNCIA [DOC]** — Algarismos tabulares (`font-variant-numeric: tabular-nums`) dão a todo dígito a mesma largura, para que as colunas alinhem verticalmente. Dado numérico deve ser alinhado à direita porque **números se comparam da direita para a esquerda** — unidade, dezena, centena.

**INSIGHT** — Sem isso, a coluna alinha o texto mas não as **ordens de grandeza**: 9, 120 e 1100 não formam a escada visual que permite comparar sem ler. É o tipo de detalhe que ninguém sabe nomear e todo mundo sente.

**APLICAÇÃO POSSÍVEL** — Ataca A-6. Nossa coluna "Saldo Atual" já é `text-right`, mas sem `tabular-nums` e sem separador de milhar (que existe no `QuickOutModal` via `toLocaleString('pt-BR')` e não na tabela). Custo baixíssimo, ganho direto de legibilidade operacional.

**NÃO APLICAR** — Não aplicar `tabular-nums` a texto corrido; ele existe para colunas comparáveis. **A verificar na Fase 5:** confirmar que a nossa Inter (via Google Fonts) expõe o recurso `tnum` — segundo o levantamento consultado, boa parte das fontes web não o faz. Se não expuser, a escolha tipográfica precisa mudar ou a fonte precisa ser servida com o recurso.

---

#### P3.3 · Célula primária com identificador secundário embutido

**REFERÊNCIA [OBS]** — Linear embute o ID da issue junto ao título, em peso e cor menores. Shopify faz o mesmo com SKU/variante sob o nome do produto.

**INSIGHT** — Libera uma coluna inteira sem perder o dado, e agrupa por **proximidade** o que a pessoa lê junto: "que produto é este" é uma pergunta só, respondida por nome + SKU.

**APLICAÇÃO POSSÍVEL** — Nossa tabela gasta uma coluna de 20% com SKU. Fundir SKU sob o nome libera espaço para a coluna de estoque mínimo (P3.1) **sem aumentar a largura total** — o que é especialmente relevante enquanto o container for `max-w-5xl` (M-11).

**NÃO APLICAR** — Só funciona se o SKU continuar **ordenável e copiável**. Hoje ele é ordenável (cabeçalho) e não copiável (`select-none`, A-5). Fundir a coluna sem resolver a ordenação seria trocar um problema por outro; e copiar SKU é tarefa diária em estoque.

---

#### P3.4 · Uma ação primária por linha, o resto em overflow

**REFERÊNCIA [OBS]** — GitHub e Linear mantêm no máximo uma ação visível por linha (frequentemente só no hover) e um menu de overflow com o restante.

**INSIGHT** — Reduz o número de decisões por linha (Hick) e devolve o peso visual ao dado. Numa lista de 10 linhas, 3 controles por linha são 30 micro-decisões e 30 paradas de tabulação.

**APLICAÇÃO POSSÍVEL** — Ataca A-1. Nossa linha tem "Movimentar" + botão vermelho de baixa rápida + menu "⋯". A pergunta que a Fase 4 precisa responder não é estética: **qual é a ação primária de uma linha de produto?** Se for "Movimentar", a baixa rápida desce para o menu; se for a baixa rápida, o inverso. Hoje há duas primárias competindo, e uma delas está pintada de destrutivo em todas as linhas.

**NÃO APLICAR** — **Nunca revelar ação só no hover.** Isso quebra no toque e para teclado — e a diretriz consultada é explícita em evitar, no mobile, ações que dependam de hover. Se adotarmos "uma primária + overflow", ambas ficam sempre visíveis.

---

### Problema 4 · Histórico que não explica a evolução do saldo
*(UF-33, UF-34, UF-35, UF-37)*

#### P4.1 · Entrada de auditoria = quem · o quê · quando · **antes → depois** · por quê

**REFERÊNCIA [DOC]** — Padrões de log de auditoria convergem em registrar quem fez, o que foi afetado, o que mudou, quando e de onde; e em exibir a mudança no formato **antes → depois** por campo (ex.: `Status: Pending → Approved`), guardando só o que mudou.

**INSIGHT** — "Antes → depois" responde à pergunta sem exigir cálculo. É a diferença entre "houve uma saída de 5" (exige saber o saldo anterior) e "120 → 115" (não exige nada).

**APLICAÇÃO POSSÍVEL** — Aqui está o achado mais frustrante da Fase 2: o `StockService` **já grava** `previousQuantity`/`newQuantity` em toda movimentação, e a rota **já devolve** os dois — mas a UI só exibe isso quando `type === 'ADJUSTMENT'` (UF-33). O dado chega no payload e é descartado. Estender o formato antes→depois a todos os tipos é mudança de **exibição**, não de dado nem de API — e resolve "por que o estoque caiu?" sem nenhum trabalho de backend.

**NÃO APLICAR** — Não inventar antes/depois para registros legados que não têm os campos (o seed grava direto via Prisma, sem passar pelo `StockService`). O `QuantityCell` já trata esse caso degradando para a quantidade crua com uma nota — comportamento correto, a preservar.

---

#### P4.2 · Saldo corrente por linha (formato extrato)

**REFERÊNCIA [OBS]** — Extratos bancários e o razão de estoque de ERPs mostram, por linha, o movimento **e** o saldo resultante.

**INSIGHT** — Permite auditar sem somar. Com paginação em ordem decrescente de data, reconstruir o saldo mentalmente entre páginas é inviável — e é exatamente o que hoje pedimos da pessoa.

**APLICAÇÃO POSSÍVEL** — É a mesma informação de P4.1 vista como coluna em vez de célula. Como já temos `newQuantity` por linha, a coluna "Saldo após" é factível hoje.

**NÃO APLICAR** — Só é honesto se a ordem e o recorte estiverem claros. Com filtro de tipo ativo (só `OUT`, por exemplo), a coluna de saldo **salta** — porque as linhas intermediárias foram escondidas, não deixaram de existir. Isso precisa ser explicado na interface, ou a coluna mente. É um risco real do padrão, não um detalhe.

---

#### P4.3 · Vocabulário fechado e traduzido para tipos de evento

**REFERÊNCIA [OBS]** — Stripe e Vercel usam um conjunto pequeno e fixo de rótulos de estado, sempre no idioma do produto, sempre com a mesma representação visual.

**INSIGHT** — Quem lê aprende o vocabulário uma vez. Enum cru do banco não é vocabulário de produto: é implementação vazando.

**APLICAÇÃO POSSÍVEL** — Ataca UF-34: hoje temos quatro tipos, três linguagens visuais e dois idiomas — `IN` verde, `OUT` vermelho, badge "AJUSTE", e `INITIAL_STOCK` cru, em inglês, com underscore (porque caiu no ramo `else` do ternário). Um vocabulário único — quatro rótulos em português, uma forma visual, sempre cor **+** texto — resolve isso e mata o parêntese técnico "Entrada (IN)" do formulário, que só existe para compensar o histórico (UF-20).

**NÃO APLICAR** — Não comunicar direção só por cor. O `AdjustmentFormModal` já acerta isso com sinal textual (`+5` / `-5`); o histórico deve seguir o mesmo caminho. Cor sozinha reprova em WCAG 1.4.1 e falha para daltônicos — e é o brief que exige combinar cor + texto + ícone.

---

### Problema 5 · Múltiplos sistemas de modal
*(C-1, UF-24, UF-25)*

#### P5.1 · Um primitivo, variantes declaradas

**REFERÊNCIA [OBS]** — Polaris, Primer e Atlassian expõem **um** componente de diálogo com variantes de tamanho e de tom (incluindo destrutivo), em vez de implementações paralelas.

**INSIGHT** — Acessibilidade de diálogo (foco preso, Escape, retorno de foco, `aria-modal`, rótulo) é difícil e fácil de errar. Centralizar significa acertar uma vez.

**APLICAÇÃO POSSÍVEL** — Confirma o que `CLAUDE.md` já manda e que o código viola em quatro lugares. Nosso `ui/Modal.tsx` (Radix) **já é** esse primitivo e já está correto; a pesquisa não traz padrão novo aqui, ela **remove a dúvida** sobre se vale unificar. Vale, e o destino já existe.

**NÃO APLICAR** — Unificar não pode virar um `Modal` gigante cheio de props condicionais para atender aos casos dos `QuickOut*` — o brief veta explicitamente o componente universal. O caminho é o primitivo fino + composição, com o contrato de 20 comportamentos da seção 9.3 do `user-flows.md` preservado item a item.

---

### Problema 6 · Foco, spacing, cor e radius inconsistentes
*(A-4, M-1, M-2)*

#### P6.1 · Token semântico em camadas

**REFERÊNCIA [OBS]** — Carbon, Polaris e Primer separam token **primitivo** (a paleta bruta) de token **semântico** (o papel: superfície, borda, texto secundário, perigo) e proíbem componente de consumir o primitivo diretamente.

**INSIGHT** — Componente que consome papel, e não cor, torna a inconsistência **impossível por construção**: não existe "cada componente escolheu seu azul" quando não há azul para escolher, só "cor de foco".

**APLICAÇÃO POSSÍVEL** — Ataca A-4 na raiz. Hoje: `ring-indigo-600` (13×), `ring-brand` (11×), `ring-blue-600` (3×), mais quatro variantes — e `brand.DEFAULT` é *exatamente* `indigo-600`, dois nomes para o mesmo valor. Um token `focus` único elimina a classe inteira de problema. Isso também atende à decisão já tomada de manter tokens semânticos para não inviabilizar dark mode no futuro — sem implementá-lo agora.

**NÃO APLICAR** — Não criar uma pirâmide de tokens de três níveis para um sistema deste tamanho. Dois níveis (primitivo → semântico) bastam; um terceiro nível por componente vira burocracia sem retorno.

---

### Problema 7 · Filtros difíceis de desfazer no mobile
*(UF-06, UF-07, UF-41, UF-43)*

#### P7.1 · Chips de filtro removíveis + "Limpar tudo" sempre visível

**REFERÊNCIA [DOC]** — Chips indicam quais filtros estão ativos e confirmam o que está sendo exibido; cada chip tem um "×" individual e há um "Limpar tudo" quando há mais de um filtro ativo — e o "Limpar tudo" deve estar **imediatamente visível, não escondido em configurações**.

**INSIGHT** — Separa duas funções que hoje confundimos numa só: *aplicar* filtro (pode viver num menu) e *ver/desfazer* filtro (tem de viver ao lado dos resultados). Um estado que altera o que a pessoa vê precisa ser visível no lugar onde ela olha.

**APLICAÇÃO POSSÍVEL** — Remédio direto de UF-06 (filtro escondido em cabeçalho de coluna) e UF-07 (impossível sair do filtro no mobile). Também torna o `LowStockBanner` honesto: hoje "Ver produtos" aplica um filtro **invisível** e a pessoa não recebe retorno nenhum (UF-43); com chips, a ação passa a produzir um estado que se vê e se desfaz.

**NÃO APLICAR** — Não migrar o filtro para fora do cabeçalho e deixá-lo só nos chips: chip mostra e remove, mas não é bom lugar para **escolher**. Os dois são complementares, não substitutos.

---

### Problema 8 · Ações destrutivas com risco de erro humano
*(UF-45, UF-46, UF-16, A-2)*

#### P8.1 · Separação espacial + sinais redundantes

**REFERÊNCIA [DOC]** — A NN/g documenta que colocar opções consequentes ao lado de benignas é perigoso, sobretudo em tarefas repetitivas feitas no automático, e recomenda **distância física** entre elas (invocando Fitts) mais **"additional space and redundant visual signals to indicate which options are different"** — cor, ícone, tamanho, alinhamento. O princípio-mestre: **"Preventing errors is better than helping users recover from them."** A "danger zone" do GitHub **[OBS]** é a materialização disso.

**INSIGHT** — Explicar o perigo no diálogo é recuperação, não prevenção — e chega depois de a pessoa já ter clicado. Prevenção é fazer com que o clique errado seja **motoramente mais caro** e **visualmente distinto**, antes de qualquer texto.

**APLICAÇÃO POSSÍVEL** — Ataca UF-45 e UF-16 diretamente. Hoje "Excluir (N)" (selecionados) e "Excluir página" (todos os 10) são irmãos visuais no mesmo canto, com o mesmo tom destrutivo e tamanho `sm`, e escopos opostos. E "Editar" divide um menu plano com "Excluir", à mesma distância do cursor. Distância + sinal redundante + agrupamento resolvem os dois sem remover nada.

**NÃO APLICAR** — Não usar confirmação por digitação (o "digite o nome do repositório" do GitHub) em operações diárias. Cabe, no máximo, na exclusão de produto — que destrói o histórico permanentemente e é rara. Em movimentação, viraria fricção diária que as pessoas aprendem a vencer no automático, e a NN/g avisa exatamente contra isso.

---

#### P8.2 · A ação declara seu escopo antes do clique

**REFERÊNCIA [OBS]** — Barras de ação em lote de Gmail/Shopify/Carbon nomeiam a contagem do alvo na própria ação ("Excluir 3"), e distinguem "selecionados nesta página" de "todos os N que casam com o filtro".

**INSIGHT** — Escopo é a informação que decide se a ação é certa ou catastrófica, e hoje ela só aparece **depois** do clique, dentro do diálogo. O diálogo está desfazendo uma ambiguidade que a interface criou.

**APLICAÇÃO POSSÍVEL** — Ataca UF-45/UF-46. Com a decisão já tomada de **limpar a seleção ao paginar**, o escopo fica simples e verdadeiro: a seleção é sempre "desta página, agora". Isso remove a possibilidade de excluir itens fora da tela e torna o rótulo honesto sem trabalho adicional.

**NÃO APLICAR** — Não introduzir "selecionar todos os N resultados do filtro" agora. É poderoso e é exatamente o tipo de recurso que transforma um clique em exclusão em massa não intencional — e contraria a decisão de limpar a seleção ao paginar.

---

### Problema 9 · Seleção múltipla e paginação
*(A-3, UF-46, UF-47, M-11, UF-10)*

#### P9.1 · Barra contextual que aparece na primeira seleção, no lugar da toolbar

**REFERÊNCIA [DOC]** — O padrão mais limpo é uma barra contextual que surge no momento da primeira seleção e **substitui a toolbar padrão no lugar dela**, mostrando a contagem ("3 selecionados") e as ações aplicáveis. Deve aparecer só na primeira seleção, e ficar no slot da toolbar acima da tabela, onde o olho já espera controles — uma barra flutuando sobre as linhas **cobre justamente os dados sobre os quais a pessoa está decidindo**. E a barra precisa se ligar visualmente aos itens selecionados: se parecer desconectada, as pessoas hesitam.

**INSIGHT** — Resolve três coisas de uma vez: revela ações em lote só quando são aplicáveis (progressive disclosure), torna a contagem impossível de ignorar, e tira a ação destrutiva da tela quando não há seleção — que é o estado em que ela hoje fica visível e clicável no nosso rodapé.

**APLICAÇÃO POSSÍVEL** — Ataca A-3 (sem contador visível, sem selecionar-todos) e UF-45 (escopo ambíguo). Hoje o único retorno da seleção é o número dentro de um botão vermelho no canto da toolbar, e as ações de página vivem permanentemente no rodapé, ao lado de nada.

**NÃO APLICAR** — Não usar barra flutuante sobre as linhas — a própria fonte adverte que ela cobre o dado da decisão. E, como a seleção não existe no mobile hoje, esta barra é padrão de desktop; se um dia a seleção chegar ao mobile, o Polaris é precedente de que abrir mão dela em telas pequenas é escolha legítima **[DOC]**.

---

#### P9.2 · Paginação como controle completo

**REFERÊNCIA [OBS]** — Tabelas operacionais expõem tamanho de página, total de itens e posição atual; frequentemente salto direto.

**INSIGHT** — Sem total, a paginação informa posição mas não **magnitude**: "Página 1 de 4" não diz se são 35 ou 400 produtos.

**APLICAÇÃO POSSÍVEL** — Ataca UF-05 e UF-10. Curiosidade que a pesquisa deixou evidente: os nossos **modais de histórico já têm** seletor de 10/20/50 por página, e a lista principal — a tela mais usada — está fixa em 10 e sem total. O recurso já existe no lugar menos importante. **[escala]** com dezenas de produtos isso é irrelevante; com centenas, é o gargalo do fluxo 2.

**NÃO APLICAR** — Não trocar por scroll infinito. Em tarefa operacional, perder a noção de posição e não conseguir voltar ao mesmo ponto é pior que clicar "Próxima". Paginação também mantém o DOM pequeno **[DOC]**.

---

### Problema 10 · Design system fragmentado
*(A-9, M-9, M-10, C-1)*

#### P10.1 · Poucos primitivos, variantes explícitas, composição para o resto

**REFERÊNCIA [OBS]** — Design systems maduros mantêm um número pequeno de primitivos com variantes nomeadas, e resolvem o caso específico por **composição**, não por mais uma prop booleana.

**INSIGHT** — O custo da fragmentação não é estético: é que cada nova tela reimplementa estado de erro, foco e loading de um jeito ligeiramente diferente, e a acessibilidade se perde em cada reimplementação.

**APLICAÇÃO POSSÍVEL** — Nossos dois formulários mais usados (`ProductFormModal`, `MovementFormModal`) **ignoram** o primitivo `Input` e reescrevem label + campo + erro à mão, com classes divergentes (A-9). O trabalho aqui não é criar componentes novos — é fazer o que existe ser usado, e corrigir as lacunas que motivaram o desvio (`Input` sem estado `disabled`, M-9; `Button` com `isLoading` que não desabilita, M-10).

**NÃO APLICAR** — Não abstrair antes da terceira repetição. O brief é explícito, e vale especialmente para o `DataTable`, que já carrega complexidade não usada (ordenação simples legada + múltipla, `filterRender` sem uso, e um cabeçalho ordenável que renderiza só a seta sem o rótulo — M-8).

---

## 5. Padrões que parecem bons e seriam inadequados aqui

Seção deliberada: metade do valor de uma pesquisa é o que ela **descarta**.

| Padrão | Onde brilha | Por que **não** aqui |
|---|---|---|
| **Undo toast em vez de confirmação** (Gmail, Linear) **[DOC/OBS]** — a NN/g inclusive **prefere** undo a confirmação | Domínios com lixeira e estado reversível | **Nosso domínio não tem desfazer.** Toda movimentação é registro de auditoria permanente; "desfazer" só pode ser uma movimentação compensatória, que **também** fica no histórico. Um botão "Desfazer" que na verdade grava um segundo registro mentiria sobre a natureza do sistema e poluiria a trilha. Isso merece decisão explícita — está na seção 7 |
| **Command palette ⌘K como caminho principal** (Linear, Raycast, Vercel) | Uso diário e intenso, por gente técnica, que memoriza | Inverte *recognition vs recall* para quem usa o sistema esporadicamente. Como caminho **secundário** é inofensivo; como principal, esconde a funcionalidade — e o brief veta "esconder para deixar clean" |
| **Edição inline na tabela** (Notion, Airtable) | Dados livres, sem regra de derivação | **Colide com regra de negócio.** Saldo é derivado de movimentações e nunca escrito direto; editar um número numa célula sugere exatamente o que o domínio proíbe. Nome/SKU seriam editáveis, mas criar edição inline só para eles ensinaria a expectativa errada |
| **Ações de linha só no hover** (GitHub, Linear) | Desktop, mouse, listas longas | Quebra no toque e para teclado; a diretriz de mobile consultada é explícita em evitar dependência de hover **[DOC]**. Com mobile relevante por decisão, está descartado |
| **Densidade configurável / seletor de altura de linha** (Carbon, GitHub) | Produtos com base grande e usos divergentes | Configuração antes de acertar o padrão. Nosso problema não é "a densidade não agrada": é que **falta informação útil na linha** (C-6). Um seletor de densidade não coloca `minStock` na tabela |
| **Sidebar de navegação global** | Produtos com muitas áreas | Temos **uma** tela autenticada. Sidebar criaria moldura vazia e roubaria largura — que já falta, com o container em `max-w-5xl` |
| **Glassmorphism, gradientes, sombras fortes, cards dentro de cards** | Marketing, landing pages | Vetado pelo brief, e já presente como dívida: `backdrop-blur` no header (B-6) e `rounded-2xl` + `shadow-2xl` + `bg-gradient-to-b` isolados nos `QuickOut*` (M-1) |
| **Confirmação por digitação do nome** (GitHub, deletar repositório) | Ação rara e catastrófica | Cabe, no máximo, em excluir produto (destrói o histórico). Em movimentação diária vira reflexo automático — o efeito que a NN/g documenta como o que **anula** o mecanismo **[DOC]** |

---

## 6. Tensões entre referências (onde elas discordam)

Registrar isso importa porque a Fase 4 vai ter de escolher um lado.

1. **Densidade: SaaS moderno × ERP.** Linear/Vercel/Notion respiram; ERP empilha. Nosso usuário decide reposição comparando números — **inclino-me para o lado do ERP na tabela** (mais dado por linha) e para o lado do SaaS no resto (hierarquia, tipografia, foco). Não é meio-termo tímido: é aplicar densidade **onde há comparação numérica** e respiro onde há leitura.

2. **Cerimônia: Linear × Stripe.** Linear é leve porque quase tudo volta atrás; Stripe é pesado porque mexe com dinheiro. Estoque irreversível está mais perto de Stripe — mas com frequência de uso mais alta, o que proíbe copiar a cerimônia de Stripe linearmente em todas as operações.

3. **Mobile: esconder × repensar.** Polaris **[DOC]** aceita esconder ações em lote no mobile, com ressalva. Shopify/Linear **[OBS]** repensam a lista inteira. Para nós, a lição não é qual escolher — é que **ambos decidem**, e nós não decidimos.

---

## 7. Fechamento

### 7.1 · Os 5 padrões mais úteis para o nosso produto

1. **P4.1 — antes → depois em toda linha do histórico.** Maior ganho pelo menor custo do documento inteiro: o dado já é gravado, já trafega no payload e é descartado na renderização. Resolve "por que o estoque mudou?" sem tocar em backend.
2. **P1.3 — preview do saldo resultante em toda operação que altera saldo.** Já implementado duas vezes internamente (ajuste, baixa rápida) e ausente onde o risco é maior (movimentação manual, UF-21). Reduz o principal risco de erro humano **sem adicionar passo**.
3. **P2.1 — esconder no mobile como decisão declarada, com condição e ressalva** (Polaris `condensed`). Ataca a raiz de UF-07/UF-23/C-5: nossas ausências no mobile não foram escolhidas, foram herdadas de um `hidden md:block`.
4. **P3.1 + P3.2 — evidência ao lado do veredito, com números tabulares.** `minStock` na tabela, alinhado e comparável ao saldo. Resolve C-6 e A-6, que juntos são a razão de a tela principal não servir para a decisão que ela existe para apoiar.
5. **P8.1 + P9.1 — separação espacial das ações destrutivas + barra contextual de seleção.** Ataca os riscos 2 e 3 da Fase 2 por **prevenção** (distância, sinal redundante, escopo declarado), não por mais texto no diálogo.

### 7.2 · Os 5 padrões que parecem bonitos e seriam inadequados

1. **Undo toast como substituto de confirmação** — o domínio não permite desfazer; só compensar, e a compensação também é permanente.
2. **Command palette como caminho principal** — inverte recognition/recall para uso esporádico.
3. **Edição inline de célula** — colide com a regra de que saldo é derivado e nunca escrito direto.
4. **Ações de linha só no hover** — quebra no toque e no teclado, com mobile declarado relevante.
5. **Densidade configurável** — configuração antes de acertar o padrão; não resolve a falta de informação útil, que é o problema real.

### 7.3 · Referências para tabela

Shopify `IndexTable` **[DOC]** (lista de objetos selecionáveis com ação em lote — modelo mais próximo do nosso caso); classe ERP/WMS **[OBS]** (evidência ao lado do veredito, totalizadores, saldo corrente); Stripe **[OBS]** (número como conteúdo de primeira classe, status com vocabulário fechado); Linear **[OBS]** (célula primária com identificador embutido, uma ação por linha); e as diretrizes de algarismos tabulares e alinhamento à direita **[DOC]**.

### 7.4 · Referências para mobile

Polaris `condensed` **[DOC]** — o padrão central, por transformar "esconder" em decisão declarada com critério. Padrão de gaveta inferior / tela cheia para filtros, com contador no botão **[DOC]**. Diretriz de evitar dependência de hover e garantir alvos de toque confortáveis **[DOC]**. Listas mobile de Shopify Admin e Linear **[OBS]** para card que preserva a ação primária.

### 7.5 · Referências para operações críticas

NN/g sobre diálogos de confirmação **[DOC]** — quando usar, rótulos que nomeiam a consequência, sem resposta padrão, e o alerta sobre excesso. NN/g sobre proximidade de opções consequentes **[DOC]** — separação espacial e sinais redundantes, com o princípio "prevenir é melhor que recuperar". Stripe **[OBS]** para preview do efeito exato antes de confirmar. GitHub danger zone **[OBS]** para isolamento espacial do destrutivo. E, internamente, o nosso próprio `AdjustmentFormModal` — que já é a melhor referência disponível para o restante do sistema.

### 7.6 · Referências para histórico / auditoria

Padrões documentados de log de auditoria **[DOC]** — quem, o quê, quando, antes→depois por campo, e por quê; e o formato `Campo: antes → depois`. Extrato bancário / razão de estoque de ERP **[OBS]** — saldo corrente por linha. Stripe **[OBS]** — timeline com timestamp absoluto e relativo. Vercel **[OBS]** — vocabulário de estado curto e fixo.

### 7.7 · Implicações para a Fase 4 — Design Direction

O que esta pesquisa **entrega como insumo** (sem ainda decidir):

1. **A direção precisa resolver uma tensão declarada, não escolher um humor.** Densidade de ERP na tabela × respiro de SaaS no resto. Qualquer direção que não responda isso será decoração.
2. **Cor terá orçamento apertado.** Se cor vai carregar significado (status de estoque, direção de movimentação, destrutivo), ela não pode ser gasta em enfeite — nem em pintar de vermelho um botão que aparece em todas as linhas. Isso restringe as direções possíveis, e é bom que restrinja.
3. **A escada de cerimônia é decisão de direção, não de componente.** Definir a regra "consequência X → barreira Y" antes de desenhar qualquer modal, senão cada tela volta a decidir sozinha — que é como chegamos a três níveis incoerentes.
4. **Tipografia terá requisito funcional, não só estético:** algarismos tabulares. Isso pode eliminar candidatas a fonte, e precisa ser verificado antes da escolha, não depois **[DOC]**.
5. **Paridade desktop/mobile vira artefato da direção**, não consequência do CSS: uma tabela capacidade × largura × decisão, assinada.
6. **A cor primária pode mudar** (decisão já tomada). A pesquisa reforça que ela deve ser escolhida pelo **contraste que garante em foco, ação primária e estado**, não pelo tom — e que precisa conviver com verde/âmbar/vermelho de status sem competir.
7. **Tokens semânticos desde o primeiro dia**, conforme decidido — sem implementar dark mode, mas sem impedir.

### 7.8 · Perguntas ainda abertas

**Novas, geradas por esta pesquisa:**

1. **"Desfazer" deve existir como conceito no produto?** A NN/g prefere undo a confirmação **[DOC]**, mas nosso domínio só permite compensação — que também é registro permanente. Um "Desfazer última movimentação" que gera um movimento contrário rotulado como estorno é uma decisão de **produto e de auditoria**, não de UI. Se a resposta for não, a barreira precisa vir toda da prevenção (P1.3, P8.1).
2. **Qual é a ação primária de uma linha de produto?** "Movimentar" ou "Baixa rápida"? A resposta reorganiza a coluna de ações, o card mobile e a hierarquia de cor. Depende de qual operação é a mais frequente — e isso ainda não sabemos.
3. **A Inter servida pelo Google Fonts expõe algarismos tabulares (`tnum`)?** **[DOC]** indica que boa parte das fontes web não expõe. Precisa ser verificado na Fase 5 antes de a escolha tipográfica ser considerada fechada.
4. **A coluna de saldo corrente no histórico deve continuar visível com filtro de tipo ativo?** Ela salta quando linhas são escondidas (P4.2). Mostrar com aviso, ou ocultar sob filtro?

**Da Fase 1 e 2, ainda em aberto e ainda relevantes para a Fase 4:**

5. **"Excluir página" e "Zerar página" têm caso de uso real?** Continua sendo a decisão que mais barato remove risco — e continua não sendo minha para tomar.
6. **Movimentação manual deve ganhar confirmação?** Agora com o insumo da pesquisa: talvez não precise de **passo** — talvez precise de **preview** (P1.3), que custa zero clique. Mas a escolha entre as duas é da direção.
7. **Escala e frequência de uso.** Continuam desconhecidas por decisão, e continuam sendo o que separa "10 por página está bom" de "é o gargalo do fluxo 2".

---

## 8. Fontes consultadas nesta sessão

Marcadas como **[DOC]** ao longo do documento. Tudo o mais é **[OBS]** — conhecimento dos produtos até maio/2026, não verificado agora.

- [Confirmation Dialogs Can Prevent User Errors — Nielsen Norman Group](https://www.nngroup.com/articles/confirmation-dialog/)
- [Dangerous UX: Consequential Options Close to Benign Options — Nielsen Norman Group](https://www.nngroup.com/articles/proximity-consequential-options/)
- [Preventing User Errors: Avoiding Conscious Mistakes — Nielsen Norman Group](https://www.nngroup.com/articles/user-mistakes/)
- [Index table — Shopify Polaris React](https://polaris-react.shopify.com/components/tables/index-table)
- [Index table — Shopify App Home patterns](https://shopify.dev/docs/api/app-home/patterns/compositions/index-table)
- [Bulk action UX: 8 design guidelines with examples for SaaS — Eleken](https://www.eleken.co/blog-posts/bulk-actions-ux)
- [Data table UI design reference guide — Setproduct](https://www.setproduct.com/blog/data-table-ui-design)
- [Best Practices for Providing Actions in Data Tables — UX Design World](https://uxdworld.com/best-practices-for-providing-actions-in-data-tables/)
- [Design Better Data Tables — Matthew Ström](https://medium.com/mission-log/design-better-data-tables-430a30a00d8c)
- [font-variant-numeric — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-numeric)
- [Align Numbers Perfectly with CSS tabular-nums](https://theosoti.com/short/tabular-nums/)
- [Audit logging for internal tools: clean change history patterns — AppMaster](https://appmaster.io/blog/audit-logging-internal-tools-activity-feed)
- [PatternFly — Filters](https://v4-archive.patternfly.org/v4/design-guidelines/usage-and-behavior/filters/)
- [Filter UI and UX Design: Best Practices, Patterns, and Examples — UXPin](https://www.uxpin.com/studio/blog/filter-ui-and-ux/)
- [Mobile Filter and Sort UX: A Practical Guide — Osvira](https://osvira.com/mobile-filter-and-sort-ux-a-practical-guide-to-faster-clearer-results/)

---

## Estado da Fase 3

**Concluída.** Nenhum código, CSS ou arquivo de produto alterado. Aguardando aprovação para a **Fase 4 — Design Direction**.
