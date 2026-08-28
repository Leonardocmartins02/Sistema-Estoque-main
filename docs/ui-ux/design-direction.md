# Fase 4 — Design Direction

**Data:** 28/08/2026
**Escopo:** definir identidade e princípios de interface **antes** de escolher tokens concretos.
**Não contém:** código, CSS, tokens, hexadecimais finais, classes Tailwind, nomes de arquivo de componente.
**Fontes:** `AGENTS.md`, `CLAUDE.md`, `docs/current-state.md`, `docs/ui-ux/audit.md`, `docs/ui-ux/user-flows.md`, `docs/ui-ux/research.md`.

---

## 1. O que esta fase decide — e o que deliberadamente não decide

| Esta fase decide | Esta fase NÃO decide (fica para a Fase 5) |
|---|---|
| Que tipo de produto isso deve parecer | Valores hexadecimais |
| A **gramática** comum das operações de estoque | Escala numérica de espaçamento |
| A **hierarquia de ações** e onde cada ação vive | Tamanhos de fonte em px/rem |
| A **escada de cerimônia** (consequência → barreira) | Raios em px |
| Princípios de densidade, mobile e semântica | Nome e valor dos tokens |
| Famílias de cor e o **papel** de cada uma | Escolha final da família primária |
| O princípio anti-fragmentação que a Fase 5 tokeniza | Se a Inter expõe `tnum` |

O objetivo desta separação: quando a Fase 5 escolher um valor, ela terá um critério para julgá-lo. Hoje o projeto tem três cores de foco e seis raios porque cada componente decidiu sozinho, sem critério. Direção **é** o critério.

---

## 2. As 10 decisões recebidas e como restringem a direção

Nenhuma direção aqui contradiz estas decisões; várias existem por causa delas.

| # | Decisão | Efeito nesta fase |
|---|---|---|
| 1 | Sem "undo" genérico | A barreira contra erro vem toda de **prevenção** (contexto + preview + cerimônia), nunca de recuperação. Isso eleva o peso da seção 4.2 |
| 2 | **Movimentar** é a operação canônica; **Baixa rápida** é atalho especializado de saída | Define a hierarquia da linha (§4.1) e proíbe promover a baixa rápida a primária sem dado de uso |
| 3 | `tnum` verificado na Fase 5 | Aqui fica só o **requisito conceitual**: valores comparáveis precisam alinhar |
| 4 | Saldo atual permanece visível no histórico mesmo sob filtro de tipo, com a diferença explicada | Vira requisito de layout do histórico (§4.5 e cada direção) |
| 5 | "Excluir página" / "Zerar página" **não** são removidos | Vão para o nível DESTRUCTIVE, fora da hierarquia primária — reposicionados, nunca deletados |
| 6 | Movimentação manual ganha contexto + preview + **confirmação leve**, sem copiar os 2 passos do ajuste | É a origem da escada de 3 níveis (§4.2). O ajuste tem 2 passos por um motivo específico, não por ser "mais perigoso" |
| 7 | Escala desconhecida | A direção precisa funcionar em dezenas **e** centenas. Marcações **[escala]** onde isso pesa |
| 8 | Seleção limpa ao paginar | Torna o escopo das ações em lote sempre verdadeiro: "estes, desta página, agora" |
| 9 | Motivo do ajuste continua livre | Sem taxonomia; o campo permanece como está |
| 10 | Mobile é relevante | Paridade de capacidade vira artefato assinado (§4.4), não consequência de CSS |

---

## 3. O diagnóstico que a direção precisa curar

### 3.1 · Por que hoje parecem "duas aplicações coladas"

Não é por causa de cores diferentes. É porque **existem duas gramáticas** convivendo:

| | Camada madura | Camada improvisada |
|---|---|---|
| Onde | `Modal` (Radix), `DataTable`, `MenuPopover`, `AdjustmentFormModal` | `QuickOutModal`, `QuickOutListModal`, `QuickOutHistoryModal`, `MovementHistoryModal` |
| Contêiner | um primitivo, tamanho declarado | `createPortal` manual, `z-[10000]` |
| Assinatura visual | borda fina, raio médio, sombra de overlay | `rounded-2xl` + `shadow-2xl` + `bg-gradient-to-b` |
| Comportamento | foco preso, Escape, retorno de foco | Escape em 1 de 3; sem foco preso |
| Erro | mensagem específica do backend | mensagem genérica (lê formato de axios) |

Uma pessoa percebe isso antes de saber nomear: os mesmos gestos produzem resultados diferentes. **A cura não é repintar a camada improvisada com as cores da madura — é submeter as duas à mesma gramática.** Se apenas as cores mudarem, continuarão sendo duas aplicações, agora da mesma cor.

### 3.2 · A assimetria central

Três operações gravam movimentação permanente. Suas barreiras não seguem regra nenhuma:

| Operação | Contexto do produto | Preview | Confirmação |
|---|---|---|---|
| Ajuste | nome · SKU · saldo | sim, com sinal textual | 2 passos |
| Baixa rápida | nome · SKU · saldo | sim, em tempo real | 1 botão |
| Entrada / Saída manual | **nenhum** | **nenhum** | **nenhuma** |

A operação **mais** protegida é a que o backend já protege com lock e 409. A **menos** protegida é aquela em que um `<select>` pré-selecionado em `IN` separa duas ações opostas. Corrigir isso é o trabalho central da direção — e é decisão de linguagem, não de componente.

### 3.3 · A informação que falta onde a decisão acontece

A tela principal mostra o veredito (`Estoque Baixo`) e esconde a evidência (`minStock`). O histórico recebe `previousQuantity`/`newQuantity` em toda linha e só exibe em ajustes. Em ambos os casos **o dado existe e não é mostrado**. Nenhuma quantidade de refino estético resolve isso; é decisão de conteúdo, e por isso é decisão de direção.

---

## 4. Decisões estruturais comuns às três direções

Isto **não** é questão de gosto: deriva das Fases 1–3 e vale qualquer que seja a direção escolhida. As três direções da §5 se diferenciam em *como expressam* estas regras, nunca em *se* as seguem.

---

### 4.1 · Hierarquia de ações

#### Os cinco níveis

| Nível | Definição | Quantidade permitida | Peso visual |
|---|---|---|---|
| **PRIMARY** | A ação que o contexto existe para permitir | **Exatamente uma** por contexto (página, linha, diálogo) | Máximo do contexto: preenchida, cor de ação |
| **SECONDARY** | Ação legítima e frequente, mas não a razão do contexto | Poucas | Contorno/neutra, mesmo tamanho da primária |
| **TERTIARY** | Navegação, controle de visualização, disclosure | Livre | Sem contorno, peso de texto |
| **DESTRUCTIVE** | Perde dado ou saldo de forma irreversível | Mínima | Distinta **por posição e forma**, não só por cor; cor plena só no momento da decisão |
| **SPECIALIZED SHORTCUT** | Caminho curto para um caso particular de uma operação canônica | Uma por contexto | Menor que a primária, **neutra**, sempre com rótulo acessível |

> **PROBLEMA** → na linha da tabela, "Movimentar", baixa rápida e "⋯" competem, e a baixa rápida é pintada de vermelho em todas as 10 linhas (A-1).
> **PRINCÍPIO** → hierarquia de ação e economia de cor semântica: quando tudo é vermelho, nada é urgente.
> **DECISÃO** → uma primária por contexto; o atalho especializado perde a cor destrutiva e vira neutro; vermelho pleno fica reservado para o instante da decisão destrutiva.
> **BENEFÍCIO** → menos micro-decisões por linha (Hick), o saldo volta a ser o elemento mais pesado da linha, e o vermelho recupera poder de alerta.

#### Onde cada ação se encaixa

| Ação | Nível | Onde vive | Justificativa |
|---|---|---|---|
| **Adicionar Produto** | PRIMARY (página) | Cabeçalho da página, única ação preenchida da tela | É a ação que a página de cadastro existe para permitir |
| **Movimentar** | PRIMARY (linha/card) | Visível em toda linha e todo card | Decisão 2: operação canônica de estoque |
| **Baixa rápida** | SPECIALIZED SHORTCUT | Visível na linha (neutra) **e presente no card mobile** | Decisão 2 a mantém como atalho; C-5/UF-23 exigem que exista no mobile |
| **Baixa de Produtos** (toolbar) | SECONDARY | Zona de controle da página | Caminho alternativo por lista; não é a razão da página |
| **Ajustar Estoque** | SECONDARY | Menu de ações da linha | Operação legítima, menos frequente, com cerimônia própria |
| **Ver Histórico** | TERTIARY | Menu de ações da linha | Consulta, não alteração |
| **Editar** | SECONDARY | Menu de ações da linha, **separado do bloco destrutivo** | UF-16: hoje divide vizinhança com "Excluir" |
| **Zerar Estoque** | DESTRUCTIVE | Bloco destrutivo do menu, após separador | Gera saída igual ao saldo inteiro |
| **Excluir** (produto) | DESTRUCTIVE | Bloco destrutivo do menu, após separador | Apaga produto **e** histórico |
| **Excluir selecionados** | DESTRUCTIVE, escopo declarado | Barra contextual de seleção, que só existe quando há seleção | Escopo = "esta página, agora" (decisão 8) |
| **Zerar página** / **Excluir página** | DESTRUCTIVE, escopo declarado | Fora da hierarquia primária, em região destrutiva separada e rotulada | Decisão 5: reposicionados, não removidos |

> **PROBLEMA** → "Excluir (N)" e "Excluir página" são irmãos visuais no mesmo canto com escopos opostos (UF-45); "Editar" e "Excluir" dividem menu plano (UF-16).
> **PRINCÍPIO** → separação espacial + sinais redundantes; prevenir é melhor que recuperar.
> **DECISÃO** → destrutivas saem do fluxo das ações comuns: separador no menu, e as de página numa região destrutiva rotulada, distante das ações de seleção.
> **BENEFÍCIO** → o clique errado deixa de ser plausível, em vez de ser explicado no último instante.

#### A tensão que permanece aberta

Mesmo com a baixa rápida neutralizada, a linha continua com **três** controles. Reduzir para dois exige decidir se o atalho perde a visibilidade permanente — o que é **redução de capacidade**, e a decisão 2 proíbe presumir sem dado de uso. Opções levadas para aprovação em §9.

---

### 4.2 · Gramática das operações de estoque

Uma sequência única, seis momentos, obrigatória em toda operação que altera saldo:

```
CONTEXTO  →  INTENÇÃO  →  QUANTIDADE ou NOVO SALDO  →  PREVIEW  →  CONFIRMAÇÃO  →  FEEDBACK
```

O que **não** varia entre operações:

1. **CONTEXTO** — nome do produto, SKU, saldo atual e estoque mínimo, sempre presentes. Nunca "este produto".
2. **PREVIEW** — sempre `saldo atual → novo saldo`, com a diferença **assinada em texto** (`+12`, `−5`), nunca só colorida.
3. **FEEDBACK** — o resultado nomeia produto, direção, quantidade e **novo saldo**. Erro é específico, persistente até dispensa, e nunca substituído por texto genérico.

O que **varia**, por razão de domínio e não de estética:

4. **INTENÇÃO** — em entrada e saída ela é uma escolha do usuário; na baixa rápida é fixa (`OUT`); no ajuste é implícita (fixar um saldo).
5. **ENTRADA DE DADO** — entrada/saída/baixa recebem uma **quantidade**; o ajuste recebe um **saldo alvo**. Esta assimetria é verdade do domínio (o `StockService` a documenta) e deve ficar **visível**, não disfarçada.
6. **CONFIRMAÇÃO** — proporcional, pela escada abaixo.

#### A escada de cerimônia

A regra que hoje não existe:

> **Cerimônia = f(ambiguidade da intenção, natureza da entrada, escopo)** — não de "quão perigoso parece".

| Nível | Quando se aplica | Forma |
|---|---|---|
| **N1 — Confirmação embutida** | Item único · intenção declarada e não ambígua · entrada é **quantidade** | O preview **é** a confirmação. Botão nomeia a consequência. Sem passo extra |
| **N2 — Resumo antes de gravar** | A entrada é um **destino**, não um efeito — o sistema derivou algo que o usuário não digitou | Segundo passo dentro do mesmo diálogo, listando o efeito derivado |
| **N3 — Diálogo dedicado com escopo nomeado** | Destrutivo ou em lote | Diálogo separado, escopo no rótulo do botão |

**Por que o ajuste tem dois passos e a saída não terá:** não é porque o ajuste é mais perigoso. É porque no ajuste a pessoa digita *"o saldo é 47"* e o sistema deriva *"então isto é uma saída de 8"* — o efeito precisa ser mostrado antes de gravar, porque não foi digitado. Numa saída, a pessoa digita o próprio efeito. Esta é a resposta à decisão 6: confirmação leve para movimentação, sem copiar o ajuste, **com um critério articulável**.

#### As quatro operações na mesma gramática

| | **ENTRADA** | **SAÍDA** | **BAIXA RÁPIDA** | **AJUSTE** |
|---|---|---|---|---|
| **Contexto** | produto · SKU · saldo · mínimo | idem | idem | idem |
| **Intenção** | declarada antes de abrir o formulário; o título afirma "Registrar entrada" | declarada; título afirma "Registrar saída" | fixa (`OUT`), afirmada no título | fixa (fixar saldo), afirmada no título |
| **Entrada de dado** | quantidade a somar | quantidade a subtrair | quantidade a subtrair (+ valores frequentes) | **saldo alvo** + motivo obrigatório |
| **Preview** | `120 → 132` · `+12` | `120 → 115` · `−5` | `120 → 115` · `−5` | `120 → 47` · `−73` |
| **Confirmação** | **N1** | **N1** | **N1** | **N2** |
| **Feedback** | "Entrada de 12 un. em Caneta Azul. Novo saldo: 132." | idem, saída | idem | "Estoque de Caneta Azul ajustado para 47 (−73)." |
| **Diferença legítima** | — | — | valores frequentes; caminho curto | motivo obrigatório; resumo estruturado; caminho de conflito 409 |

> **PROBLEMA** → o tipo de movimentação é um `<select>` pré-selecionado em `IN`, sem preview e sem confirmação; uma entrada lançada no lugar de uma saída não é detectada por nada e é permanente (UF-21).
> **PRINCÍPIO** → prevenção de erro por eliminação de ambiguidade: a intenção deixa de ser um campo default e passa a ser uma afirmação do contexto.
> **DECISÃO** → a direção é escolhida **antes** do formulário e afirmada no título; o preview mostra o efeito antes da gravação; o botão nomeia a consequência.
> **BENEFÍCIO** → o maior risco de erro humano do sistema deixa de depender de a pessoa notar um `<select>`, sem adicionar nenhum passo ao fluxo.

> **PROBLEMA** → o `QuickOutModal` desenha "Estoque negativo" — estado que o domínio sempre recusa (UF-27).
> **PRINCÍPIO** → o preview mostra resultados **possíveis**; o impossível é bloqueio, não destino.
> **DECISÃO** → quando a quantidade excede o saldo, a interface comunica **impedimento** e desabilita a confirmação, em vez de renderizar um saldo negativo como se fosse um futuro plausível.
> **BENEFÍCIO** → o erro é evitado antes do envio, e a mensagem do backend deixa de ser a primeira notícia.

#### A ideia que sobrevive, a embalagem que não

O `QuickOutModal` contém **a melhor ideia de interação do produto** — o saldo resultante recalculado a cada tecla — dentro do pior invólucro técnico (portal manual, sem foco preso, com nove `console.log`). A direção separa as duas coisas: **o preview vivo é promovido a elemento do sistema**, presente nas quatro operações; o gradiente, o `rounded-2xl`, a `shadow-2xl` e o número gigante centralizado são descartados.

---

### 4.3 · Princípios de densidade

> Clean ≠ remover informação operacional. Clean = remover o que **não** ajuda a decidir.

**Sempre visível numa linha/card de produto** — o conjunto mínimo para responder *"preciso agir neste produto?"* sem abrir nada:

`nome` · `SKU` · `saldo atual` · `estoque mínimo` · `status` · `ação primária`

**Progressive disclosure** (existe, sob um gesto): descrição do produto · histórico · campos de edição · detalhe de cada movimentação.

**No menu de ações:** ajustar · histórico · editar · e, após separador, zerar e excluir.

**Nunca escondido atrás de largura:** busca · filtro · **limpar filtro** · status · saldo · mínimo · ação primária · baixa rápida (§4.4).

> **PROBLEMA** → a tabela mostra o badge derivado de `balance < minStock` e não mostra `minStock`; a única tela que exibe os dois lado a lado é um modal secundário (C-6, UF-40).
> **PRINCÍPIO** → o veredito nunca aparece sem a evidência; comparação deve ser visual, não mental.
> **DECISÃO** → saldo e mínimo formam **um par visual** na linha, lidos como uma unidade.
> **BENEFÍCIO** → "quanto comprar" passa a ser respondível na lista, sem abrir formulário — o que também remove a dependência do fluxo de edição (hoje quebrado por outro motivo, ver §8).

**Regra anti-card-dentro-de-card:** um nível de contenção por região. A tabela é uma **região**, não um card; as linhas não são cards; o card do mobile **é** a linha, não um invólucro em volta dela. Nada que já está dentro de uma região ganha borda e sombra próprias.

**[escala]** Em dezenas de produtos, densidade é conforto. Em centenas, é o que decide se a tarefa é possível — e a paginação passa a precisar de total de itens e tamanho de página (hoje ausentes na lista principal e, ironicamente, presentes nos modais de histórico).

---

### 4.4 · Princípios de mobile

> **PROBLEMA** → um `hidden md:block` levou junto ordenação, filtro, limpar-filtro, baixa rápida, seleção e ações em lote; e o `LowStockBanner` aplica um filtro do qual não há como sair no celular (UF-07, UF-23, C-4, C-5).
> **PRINCÍPIO** → esconder no mobile é uma **decisão declarada, com condição e ressalva** — nunca efeito colateral de layout.
> **DECISÃO** → a Fase 8 produz uma **tabela de paridade assinada** (capacidade × desktop × mobile × decisão × justificativa). Toda ausência é uma linha assinada.
> **BENEFÍCIO** → a perda de capacidade deixa de ser invisível; vira algo que alguém escolheu e pode ser revisto.

Regras de reorganização:

| Elemento | No mobile |
|---|---|
| Busca | **Inline**, sempre visível — é o caminho principal de localização |
| Filtro e ordenação | **Sheet** (variante do primitivo único de diálogo, jamais um novo sistema de overlay), acionada por um controle persistente que **carrega o contador de filtros ativos** |
| Filtros ativos | Visíveis e removíveis fora da sheet; onde não couberem em chips, o contador no controle cumpre o papel |
| Saldo · mínimo · status | **Inline no card**, sempre |
| Ação primária (Movimentar) | **Inline no card** |
| Baixa rápida | **Presente no card** — é o dispositivo de quem está no estoque físico |
| Demais ações | Menu de overflow |
| Seleção múltipla / ações em lote | Podem legitimamente **não existir** no mobile — mas como linha assinada na tabela de paridade |
| Paginação | **Depois** da lista, com total de itens |
| Qualquer ação | **Nunca** revelada só por hover |

---

### 4.5 · Semântica de estoque e de auditoria

**Estado de estoque** — três estados, vocabulário fechado, sempre **cor + palavra**, com ícone quando o espaço permitir:

`Em estoque` · `Estoque baixo` · `Sem estoque`

**Tipos de movimentação** — quatro tipos, **um único vocabulário em português**, uma única forma visual:

`Entrada` · `Saída` · `Ajuste` · `Estoque inicial`

> **PROBLEMA** → quatro tipos, três linguagens visuais e dois idiomas: `IN` verde, `OUT` vermelho, badge "AJUSTE", e `INITIAL_STOCK` cru em inglês com underscore, porque caiu no ramo `else` do ternário (UF-34). O formulário compensa isso escrevendo "Entrada (IN)" (UF-20).
> **PRINCÍPIO** → enum de banco não é vocabulário de produto; direção nunca depende só de cor (WCAG 1.4.1).
> **DECISÃO** → um vocabulário traduzido e fechado, uma forma visual única, direção sempre expressa por **sinal textual** (`+`/`−`) além de cor.
> **BENEFÍCIO** → aprende-se o vocabulário uma vez; o parêntese técnico desaparece do formulário; e a leitura funciona para daltônicos.

**Auditoria** — toda mudança se comunica como `antes → depois`, com a diferença assinada:

> **PROBLEMA** → o `StockService` grava `previousQuantity`/`newQuantity` em **toda** movimentação e a rota devolve os dois, mas a interface só exibe em ajustes; reconstruir o saldo exige aritmética mental entre páginas (UF-33).
> **PRINCÍPIO** → o log de auditoria responde *o quê, de quanto para quanto, quando, por quem e por quê* — sem exigir cálculo.
> **DECISÃO** → o formato `antes → depois` vale para os quatro tipos, e o histórico ganha o saldo resultante por linha.
> **BENEFÍCIO** → "por que o estoque caiu?" passa a ser respondível por leitura. E é mudança de **exibição**: o dado já chega no payload.

**O saldo do produto × a lista filtrada** (decisão 4):

> **PROBLEMA** → filtrar o histórico por tipo esconde linhas, e uma coluna de saldo corrente passa a "saltar" — parecendo inconsistente.
> **PRINCÍPIO** → separar o **fato** (saldo atual do produto) do **recorte** (as movimentações que você escolheu ver).
> **DECISÃO** → o saldo atual vive no **contexto do histórico**, ancorado ao produto e imune ao filtro; a lista abaixo é explicitamente um recorte, e o estado do filtro é visível junto dela.
> **BENEFÍCIO** → o número que a pessoa confere nunca muda por causa de um filtro, e a distinção fica evidente em vez de precisar ser deduzida.

---

### 4.6 · Princípios anti-fragmentação (o que a Fase 5 vai tokenizar)

> **PROBLEMA** → três cores de anel de foco (13× indigo-600, 11× `brand`, 3× blue-600 + quatro variantes), seis níveis de raio, gradiente e sombra pesada isolados em três arquivos, e `brand.DEFAULT` sendo *exatamente* `indigo-600` — dois nomes para o mesmo valor (A-4, M-1, M-2).
> **PRINCÍPIO** → componente consome **papel**, nunca valor bruto. Não existe "cada componente escolheu seu azul" quando não há azul para escolher, apenas "cor de foco".
> **DECISÃO** → seis regras que a Fase 5 traduz em tokens:

1. **Um único tratamento de foco** em todo o produto, um token, sem exceção por componente.
2. **Raio por papel, não por componente** — no máximo três degraus (controle · contêiner · pílula).
3. **Elevação com três estados apenas** — plano (padrão), suspenso (só overlay, menu, sheet) e véu de overlay. Nada mais recebe sombra.
4. **Nenhum gradiente** como decoração de superfície.
5. **Escala tipográfica fechada**, cada degrau com papel nomeado; sem tamanhos arbitrários.
6. **Uma escala de espaçamento**, sem valores fora dela.

> **BENEFÍCIO** → a inconsistência deixa de ser algo a policiar em revisão e passa a ser algo que não se consegue escrever.

**Cor — famílias e papéis** (sem hexadecimal, conforme o escopo):

| Papel | Família | Regra de uso |
|---|---|---|
| Neutros | uma família neutra com degraus suficientes para superfície, borda, texto primário/secundário/terciário | Faz 90% da interface |
| Ação e foco | **uma** família de acento | Ação primária, foco, item selecionado. **Nunca** status |
| Estado positivo | verde | "Em estoque" |
| Estado de atenção | âmbar | "Estoque baixo" |
| Estado crítico | vermelho | "Sem estoque" |
| Informação / ajuste | neutro-acento | "Ajuste", avisos informativos |
| Destrutivo | compartilha a família crítica | **Só no momento da decisão** — diálogo e botão de confirmação. Nunca como decoração ambiente de linha |

> **PROBLEMA** → vermelho significa hoje, ao mesmo tempo, "sem estoque" (estado) e "ação destrutiva" (ação), e aparece em toda linha da tabela.
> **PRINCÍPIO** → uma cor, um significado por contexto; cor semântica é recurso escasso.
> **DECISÃO** → vermelho pleno só no instante da decisão destrutiva; o estado "sem estoque" usa a família crítica em tratamento de **badge**, formalmente distinto de botão.
> **BENEFÍCIO** → o alerta volta a alertar, e a ação destrutiva volta a parecer excepcional.

**A família de acento pode mudar** (decisão do usuário). Critério para a Fase 5 escolher: precisa garantir contraste suficiente como **foco**, como **preenchimento de ação primária** e como **estado selecionado**, e conviver com verde/âmbar/vermelho sem competir. É um critério funcional, não de gosto.

---

## 5. As três direções

As três obedecem integralmente à §4. Diferem na **lógica de organização** — o que é o herói da tela.

---

### 5.1 · Direção A — **BANCADA**

#### Conceito
*Um instrumento de trabalho: a grade é o produto, e tudo mais serve a ela.*

#### Princípios visuais
- **Densidade** — alta. Linhas compactas, mais colunas, ritmo vertical curto.
- **Whitespace** — econômico e regular; respiro entre regiões, quase nenhum dentro delas.
- **Bordas** — estruturais e visíveis: a grade é desenhada, com filetes finos separando colunas e linhas.
- **Radius** — pequeno, quase reto. Sensação de instrumento, não de aplicativo.
- **Elevation** — praticamente ausente; só overlay.
- **Tipografia** — base pequena, muitos pesos, micro-rótulos em caixa alta para cabeçalhos.
- **Cor** — quase monocromática; acento único e discreto; cor concentrada nos estados.
- **Iconografia** — pequena, funcional, sempre com rótulo acessível.
- **Hierarquia** — por peso e alinhamento, não por tamanho.

#### Dashboard
Título compacto e a ação primária na mesma linha. Resumo de estoque baixo como faixa fina e permanente, não como card. Busca e filtros numa barra de controle densa, imediatamente acima da grade. A grade ocupa toda a largura disponível.

#### Tabela
Favorece **comparação numérica acima de tudo**: colunas numéricas alinhadas à direita, com alinhamento consistente entre ordens de grandeza; saldo e mínimo adjacentes formando o par de evidência; status em badge compacto; ações da linha reduzidas ao mínimo visual. Cabeçalho fixo ao rolar. Scanning por régua vertical: as colunas guiam o olho.

#### Operações de estoque
Diálogos compactos, sem ilustração e sem número gigante. O preview `antes → depois` é uma linha de dados, não um painel. A diferença entre as quatro operações aparece no título e no campo, não em ornamento.

#### Histórico
Formato **extrato**: uma linha por movimentação, saldo resultante à direita, tipo em rótulo curto, motivo truncado com disclosure. O saldo atual do produto fica ancorado no topo, fora do recorte filtrado.

#### Mobile
Lista densa de linhas — **não** cards com borda. Cada item traz nome, SKU, saldo e mínimo pareados, status e a ação primária. Filtro e ordenação em sheet.

#### Feedback
Discreto e textual: faixas finas, sem animação. Loading preserva o layout com placeholders da mesma altura da linha.

#### Acessibilidade
Risco concentrado no **tamanho de alvo**: densidade alta empurra botões para baixo do confortável. Exige compensação deliberada — área clicável maior que o desenho visível, especialmente no toque. Contraste tende a ser bom pela paleta quase monocromática.

#### Vantagens
Máxima informação por tela; excelente para uso diário e intenso; envelhece bem; **[escala]** é a única das três que continua confortável em centenas de produtos sem mudanças.

#### Riscos
Intimidante para uso esporádico; se a hierarquia falhar, vira "muro de dados"; conflito direto com Fitts no mobile; a estética de instrumento pode ser lida como "sistema legado" — exatamente o oposto de um dos objetivos do brief.

#### Onde NÃO usar
Se o público for majoritariamente esporádico, ou se o mobile for cenário primário de operação.

---

### 5.2 · Direção B — **OPERAÇÃO**

#### Conceito
*A tela é organizada por tarefas e decisões: cada zona tem um propósito e uma ação principal.*

#### Princípios visuais
- **Densidade** — média, com uma exceção deliberada: **a região de dados é mais densa que o resto do produto**.
- **Whitespace** — usado para **separar zonas**, não para diluir conteúdo.
- **Bordas** — discretas; delimitam regiões, não elementos.
- **Radius** — médio e uniforme, três degraus por papel.
- **Elevation** — só overlay, menu e sheet. Nada mais é suspenso.
- **Tipografia** — escala curta e clara, com degraus perceptíveis; hierarquia por tamanho **e** peso.
- **Cor** — superfície neutra; um acento reservado para ação primária, foco e seleção; trio semântico para estoque.
- **Iconografia** — presente e consistente, sempre acompanhada de texto em ações.
- **Hierarquia** — explícita: cada zona declara sua ação principal.

#### Dashboard
Quatro zonas legíveis de cima para baixo:

1. **Identidade e contexto** — nome da tela dominante; a marca recua (hoje `SimpleStock` é maior que `Produtos`, A-8).
2. **Alerta** — estoque baixo como faixa acionável; ao acionar, produz um **estado de filtro visível e removível**, não um filtro invisível (UF-43).
3. **Controle** — busca, filtros, filtros ativos, contagem de resultados e a ação primária da página. Quando há seleção, esta zona **é substituída pela barra contextual** com contagem e ações de escopo declarado.
4. **Dados** — a tabela como região, não como card.

#### Tabela
Leitura horizontal guiada: coluna primária com nome e SKU pareados; bloco numérico `saldo / mínimo` alinhado e comparável; status em badge; ação primária visível e o restante em menu. Cabeçalho com ordenação evidente e filtro **fora** do cabeçalho — porque cabeçalho de coluna sugere ordenar, não filtrar (UF-06).

#### Operações de estoque
A gramática da §4.2 é expressa como um **layout comum de diálogo**: faixa de contexto no topo (produto · SKU · saldo · mínimo), campo de intenção afirmado no título, campo de valor, painel de preview, rodapé com a ação nomeando a consequência. As quatro operações compartilham esse esqueleto e diferem só no que o domínio exige: valores frequentes na baixa rápida; motivo e segundo passo no ajuste.

#### Histórico
Cabeçalho com o **saldo atual do produto** ancorado (imune ao filtro), seguido do recorte filtrado com estado de filtro visível. Cada linha: quando · tipo (vocabulário único) · `antes → depois` com sinal · motivo · responsável. Um resumo do período pode ocupar a faixa entre o cabeçalho e a lista.

#### Mobile
As **mesmas quatro zonas**, reordenadas: contexto, alerta, controle (busca inline + botão de filtros com contador), dados como cards, paginação ao final. O card é a linha com mais respiro vertical: saldo e mínimo pareados, status, ação primária, baixa rápida e overflow.

#### Feedback
Estados nomeados e consistentes: loading que preserva layout; sucesso que declara o novo saldo; erro específico e **persistente**; conflito com as duas quantidades lado a lado; destrutivo com escopo no rótulo.

#### Acessibilidade
A direção mais fácil de acertar: densidade média mantém alvos confortáveis; zonas dão pontos de referência naturais para navegação por teclado e leitor de tela; um único tratamento de foco visível sobre superfície neutra.

#### Vantagens
Ataca diretamente o "duas aplicações coladas", porque a unidade vem da **estrutura repetida**, não do acabamento. Menor risco de regressão: aproveita o que já existe e está correto. Funciona para uso diário e esporádico.

#### Riscos
Se executada sem convicção, resulta em SaaS genérico — "moderno" sem identidade. **[escala]** com centenas de produtos, a densidade média pode ficar folgada na tabela: por isso a exceção declarada de densidade na região de dados não é detalhe, é o que impede a direção de falhar.

#### Onde NÃO usar
Se o objetivo fosse identidade visual marcante e diferenciação de marca. Não é o objetivo aqui.

---

### 5.3 · Direção C — **REGISTRO**

#### Conceito
*Um livro-razão: cada número carrega visivelmente sua origem, e a tipografia — não a moldura — cria a estrutura.*

#### Princípios visuais
- **Densidade** — média-alta, organizada por ritmo tipográfico.
- **Whitespace** — é o **principal** instrumento de agrupamento (proximidade no lugar de moldura).
- **Bordas** — quase ausentes; separação por alinhamento e espaço.
- **Radius** — pequeno; poucas superfícies para arredondar.
- **Elevation** — só overlay.
- **Tipografia** — protagonista: escala real, contraste forte de peso, números tratados como conteúdo de primeira classe.
- **Cor** — a mais contida das três: cor quase só para estado e sinal de variação.
- **Iconografia** — mínima.
- **Hierarquia** — por peso, tamanho e alinhamento — não por caixa.

#### Dashboard
Título editorial com respiro. Estoque baixo como uma **afirmação em texto** com ação inline, não como faixa colorida. Controles discretos, alinhados à mesma régua do conteúdo. Sem molduras: a tabela nasce direto do fundo da página.

#### Tabela
Scanning por **régua e peso**: nome em peso forte, SKU em peso fraco logo abaixo; bloco numérico com saldo dominante e mínimo em peso menor, imediatamente ao lado — a relação entre os dois é lida como uma fração, não como duas colunas. Status por palavra com marca sutil. Ações reveladas com contenção, sem contornos.

#### Operações de estoque
Cada diálogo é lido como um **lançamento**: contexto em cabeçalho tipográfico, valor em destaque, e o `antes → depois` como a frase central da tela. O ajuste, com motivo obrigatório, é o caso mais natural desta direção.

#### Histórico
Onde a direção brilha: extrato tipográfico com saldo corrente, colunas alinhadas por régua, tipos como palavras, deltas assinados, timestamps consistentes. Responde "o que aconteceu com este estoque?" por leitura contínua.

#### Mobile
A que degrada melhor: sem molduras, o layout já é linear. Cada movimentação vira um parágrafo estruturado.

#### Feedback
Textual e sóbrio; sem cor como recurso principal.

#### Acessibilidade
Boa em contraste e independência de cor. **Risco real:** com poucas bordas, a estrutura depende inteiramente de alinhamento — que **não** é percebido por leitor de tela e se degrada com zoom ou fonte aumentada. Exige semântica de tabela impecável para compensar o que a visão obtinha da régua.

#### Vantagens
A mais adequada ao histórico e à auditoria; a mais elegante; a que envelhece melhor; disciplina cromática natural.

#### Riscos
Depende de execução tipográfica excelente e sustentada — em um código com fragmentação documentada, é a direção **mais fácil de degradar** com o tempo. Tabelas largas sem filete custam mais para varrer horizontalmente. E há risco de parecer "documento", não "ferramenta operacional".

#### Onde NÃO usar
Em telas de varredura horizontal larga com muitas colunas — exatamente a nossa tabela principal.

---

## 6. Matriz comparativa

Escala: ●●● forte · ●●○ adequado · ●○○ fraco.

| Critério | A — Bancada | B — Operação | C — Registro |
|---|---|---|---|
| **Clareza** (entender em 3s onde estou, o que vejo, o que fazer) | ●●○ | ●●● | ●●○ |
| **Densidade útil** | ●●● | ●●○ | ●●○ |
| **Eficiência operacional** (uso diário e repetitivo) | ●●● | ●●● | ●●○ |
| **Mobile** | ●○○ | ●●● | ●●○ |
| **Acessibilidade** | ●●○ (alvos) | ●●● | ●●○ (estrutura sem borda) |
| **Personalidade** | ●●○ (instrumento) | ●○○ (risco de genérico) | ●●● |
| **Complexidade de implementação** | ●●○ | ●●● (menor) | ●○○ (maior) |
| **Risco de regressão** | ●●○ | ●●● (menor) | ●○○ (maior) |

Nota sobre as duas últimas linhas: ●●● significa **melhor** (menos complexidade, menos risco).

---

## 7. Recomendação

### 7.1 · A direção recomendada

**Direção B — OPERAÇÃO**, com dois empréstimos declarados (§7.3).

### 7.2 · Por quê

**1. O problema real não é falta de personalidade — é incoerência.** As Fases 1 e 2 encontraram 40 achados de UI e 50 de fluxo, e o que os une é ausência de regra: três cores de foco, seis raios, três sistemas de modal, três níveis incoerentes de cerimônia. A direção B é a única cuja **lógica organizadora** ataca isso de frente: a unidade vem da estrutura repetida (zonas, gramática, hierarquia), não do acabamento. As direções A e C dariam ao produto um acabamento novo — e ele continuaria sendo duas aplicações, agora com o mesmo verniz.

**2. Mobile é decisão fechada, e A o inviabiliza.** Com o mobile declarado relevante, uma direção que aposta em densidade alta e alvos pequenos entra em conflito com Fitts logo no primeiro card. Não é um ajuste: é a premissa de A.

**3. Risco de regressão é uma restrição real, não uma preferência.** O brief proíbe reescrever o produto; `AGENTS.md` impõe TDD, lint, typecheck, testes e build como portão obrigatório em CI; e a Fase 2 mostrou que quatro dos componentes mais frágeis **não têm nenhum teste**. B é a direção que mais aproveita o que já existe e está correto — `Modal` (Radix), `MenuPopover`, `DataTable`, e a estrutura do `AdjustmentFormModal`, que já é praticamente a gramática da §4.2 implementada. Escolher B transforma boa parte do trabalho em **estender um padrão interno** em vez de importar um externo.

**4. A tabela precisa de densidade, mas o produto inteiro não.** A tensão registrada na Fase 3 (ERP × SaaS) não se resolve com meio-termo tímido: resolve-se aplicando densidade **onde há comparação numérica** e respiro onde há leitura e decisão. B é a única direção que comporta essa exceção como princípio explícito, em vez de escolher um dos lados para a tela inteira.

**5. C é a melhor direção para uma tela que não é a principal.** Ela é superior no histórico — e é exatamente por isso que ela entra como empréstimo, não como direção geral: a tela mais usada do sistema é uma tabela larga de varredura horizontal, que é onde C é explicitamente fraca.

### 7.3 · O que incorporar das outras — e o que não

**De C (Registro), incorporar:**
- **Tratamento numérico de primeira classe**: alinhamento consistente entre ordens de grandeza, saldo e mínimo lidos como um par, unidade em peso menor que o número.
- **`antes → depois` com sinal textual como forma canônica** de comunicar qualquer alteração, em toda a interface.
- **Disciplina cromática**: cor como recurso escasso, gasta em significado.
- **Layout do histórico**: é a tela em que C vence, e a única em que a lógica de C deve prevalecer sobre a de B.

**De A (Bancada), incorporar:**
- **A tabela como região, não como card** — resolve o "card dentro de card" e devolve largura útil.
- **Filetes internos discretos na região de dados**, que é o que C não teria e do que a varredura horizontal precisa.
- **Densidade maior na região de dados** que no resto do produto — a exceção declarada.

**Deliberadamente NÃO incorporar, para não criar híbrido incoerente:**
- O raio quase reto e a tipografia miúda de A — brigariam com o conforto que é a premissa de B e reintroduziriam o problema de alvo no mobile.
- O agrupamento sem bordas de C **na tabela principal** — custa varredura horizontal e depende de alinhamento, que não chega ao leitor de tela.
- A sobriedade cromática total de C nos **estados de estoque** — aqui a cor é informação operacional legítima e precisa ser vista de longe.

---

## 8. Fronteira com os problemas funcionais e técnicos

Registrado para que nenhum bug seja convertido em decisão estética. A direção descreve **como a experiência deve ser depois de corrigidos** — não os corrige, e não depende de reescrevê-los.

| ID | Problema | Natureza | O que a direção pressupõe |
|---|---|---|---|
| **F-06** | `ProductFormModal` em modo `edit` abre vazio (verificado por sonda) | Bug funcional | A direção pressupõe um formulário de edição que **mostra o estado atual** antes de pedir decisão. Corrigir é task própria, com teste |
| **F-07** | `QuickOutModal` lê o erro em formato de axios; a mensagem real do backend nunca chega | Bug funcional | A gramática exige feedback específico e persistente — impossível enquanto o erro for substituído por texto genérico |
| **C-1** | Três sistemas de diálogo paralelos | Dívida técnica | A direção pressupõe **um** primitivo; sheet de filtros nasce como variante dele, nunca como quarto sistema |
| **C-2** | Nove `console.log` no caminho da baixa rápida | Dívida técnica | Sem relação com direção visual |
| **C-3** | Bloco de erro duplicado no `QuickOutModal` | Dívida técnica | Idem |
| **F-01** | Interface desenha "Estoque negativo", estado que o domínio proíbe | Produto + UI | §4.2 decide o comportamento **de interface** (bloqueio em vez de destino); a regra do backend não muda |
| **F-04** | Seleção não limpa ao paginar | Produto | Decidido (decisão 8); a direção assume o escopo "esta página, agora" |
| **F-05** | SKU maiúsculo só por CSS; valor gravado mantém a caixa digitada | Dado | A direção pressupõe que o exibido é o gravado. A normalização é decisão de backend |
| **Regras de negócio** | Saldo derivado; saída não pode negativar; ajuste por saldo alvo com 409; hard delete com cascata; lote não atômico | **Não alterar** | A direção as **expressa** com mais clareza; nunca as modifica |

---

## 9. Decisões que precisam da sua aprovação antes da Fase 5

**D1 · A escada de cerimônia de três níveis (§4.2)** — com o critério "cerimônia = f(ambiguidade, natureza da entrada, escopo)", que mantém o ajuste em dois passos, coloca entrada/saída/baixa rápida em confirmação embutida, e leva destrutivas e lotes a diálogo com escopo nomeado. É a decisão mais estruturante desta fase.

**D2 · A intenção da movimentação passa a ser declarada antes do formulário**, com o título afirmando "Registrar entrada" ou "Registrar saída", em vez de um `<select>` pré-selecionado em `IN`. Isso **muda o caminho** de um fluxo existente (um passo antes, um campo a menos dentro) — e por isso não é decisão minha.

**D3 · Quantos controles ficam visíveis na linha da tabela.** Três opções, com recomendação:
- **(a) Recomendada** — manter os três, **neutralizando** a cor destrutiva da baixa rápida. Preserva capacidade integralmente; resolve o problema de cor; não resolve a contagem de alvos.
- **(b)** Duas visíveis: Movimentar + menu; a baixa rápida vira o primeiro item do menu. Reduz a densidade de ações, mas **degrada o atalho de 1 para 2 cliques** — redução de capacidade, que a decisão 2 manda não presumir.
- **(c)** Um controle: botão dividido "Movimentar ▾". Mais limpo, e o mais arriscado: esconde tudo atrás de um gesto que a maioria não descobre sozinha.

**D4 · A família de acento pode mudar** (você já autorizou). Confirma-se que a escolha da Fase 5 será feita por **critério funcional** — contraste garantido como foco, como preenchimento de primária e como estado selecionado, convivendo com verde/âmbar/vermelho — e não por preferência de tom?

**D5 · A exceção de densidade** — o produto tem densidade média, **exceto** a região de dados, que é mais densa. É o que impede a direção B de ficar folgada em centenas de produtos, e é uma decisão consciente de incoerência aparente.

**D6 · Empréstimo da lógica de C no histórico** — o histórico segue a lógica de extrato tipográfico, ainda que o resto do produto siga a lógica de zonas. É a única tela onde deliberadamente se aplica outra direção.

---

## 10. O que ficou deliberadamente para a Fase 5

- Todos os valores: hexadecimais, escala de espaçamento, tamanhos de fonte, raios, sombras.
- A escolha concreta da família de acento e a definição das rampas neutra e semânticas.
- Verificação de `tnum` na Inter e, se necessário, a decisão tipográfica decorrente.
- Nomes dos tokens e a fronteira entre token primitivo e semântico (dois níveis, não três).
- Definição formal dos estados de cada componente interativo (default, hover, active, focus-visible, disabled, loading, error).
- Breakpoints concretos e a tabela de paridade preenchida (a **regra** está em §4.4; os **valores**, não).
- Especificação de ícones.

---

## 11. Riscos desta direção

| Risco | Probabilidade | Mitigação proposta |
|---|---|---|
| **B executada sem convicção vira SaaS genérico** | Média | A identidade vem da §4.2 e da §4.5 — gramática e semântica — não do acabamento. Se a gramática for aplicada, a personalidade aparece no comportamento |
| **A exceção de densidade não ser respeitada**, deixando a tabela folgada | Média | D5 aprovado explicitamente e verificado no protótipo da Fase 7, com a tela cheia de dados — não com três linhas |
| **Declarar a intenção antes do formulário (D2) ser sentida como passo a mais** | Média | Validar no protótipo antes de propagar. É um passo a mais na navegação e um campo a menos no formulário — o saldo líquido precisa ser observado, não presumido |
| **Refatoração visual arrastar correção de bug funcional** | **Alta** | §8 mantém a fronteira; F-06 e F-07 saem em tasks próprias, com teste, antes ou fora do redesign |
| **Perder comportamento ao unificar os `QuickOut*`** | **Alta** | O contrato de 20 comportamentos da §9.3 do `user-flows.md` é pré-requisito, e a Task 0 de caracterização precede qualquer alteração |
| **A tabela de paridade mobile virar formalidade** | Média | Ela é entregável assinado da Fase 8, verificado no QA da Fase 9 — não um parágrafo de intenção |
| **A direção decidir algo que o domínio proíbe** | Baixa | §8 lista as regras de negócio intocáveis; a direção as expressa, nunca as altera |

---

## Estado da Fase 4

**Concluída.** Nenhum código, CSS, componente ou token criado ou alterado. Aguardando aprovação — em especial dos itens **D1 a D6** — para iniciar a **Fase 5 — Design System**.
