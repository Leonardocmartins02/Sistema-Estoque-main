# PROTOTYPE — SimpleStock v2

> Fase 3 do workflow. Valida, **vendo**, a direção do `research.md` antes do PRD. Nada aqui é código de produção.

## Protótipo executável foi necessário?

**Sim — e navegável.** Diferente das telas isoladas das features anteriores, esta mudança é de **estrutura**: sidebar, rotas, uma página nova por produto, um painel lateral no lugar de modal. Decisões de navegação e hierarquia só se aprovam clicando, não olhando um quadro estático.

`prototype/index.html` — arquivo único, HTML + CSS + JS puro, sem framework e sem CDN de script (só a fonte Inter, mesma origem do `index.html` de produção). Dados fictícios no formato do domínio, gerados com semente fixa: os 50 itens de papelaria do `seed.ts`, `minStock` 3–20, distribuição 20 · 15 · 15, cerca de 200 movimentações nos últimos 30 dias com `antes → depois`. **Não** é referenciado por nenhum arquivo da aplicação e não entra em build.

### Como abrir

Abrir `prototype/index.html` direto no navegador funciona. Parâmetros úteis na URL:

| Parâmetro | Efeito |
|---|---|
| `?sidebar=clara` | começa com a variante clara da sidebar (D2) |
| `?estado=loading` · `empty` · `noresult` · `error` | força o estado das listas |
| `?mov=p12:OUT` | abre o painel de movimentação já com produto/tipo |
| `?andaimes=0` | esconde o painel roxo de validação (para capturas) |

O painel roxo com borda tracejada no canto ("Andaimes de validação") **não faz parte do design** — existe só para alternar as variantes das decisões abaixo.

## O que tem no protótipo

| Tela | Rota | Substitui / origem |
|---|---|---|
| Dashboard | `#/` | **Nova** — não existe visão geral hoje |
| Produtos | `#/produtos` · `?status=em-estoque` · `baixo` · `sem-estoque` | `ProductDashboard` (lista) + `LowStockBanner` |
| Produto | `#/produtos/:id` | **Nova** — absorve o `MovementHistoryModal` |
| Movimentações | `#/movimentacoes` · `?tipo=entradas` · `saidas` · `ajustes` · `?produto=` | **Nova** — histórico geral (hoje só existe por produto e o de baixas) |
| Nova movimentação | painel lateral, de qualquer tela | `MovementFormModal` |

Fluxos que continuam existindo e **não foram redesenhados aqui** (aparecem como um aviso ao clicar): adicionar/editar produto, ajuste de estoque, baixa rápida, baixa de produtos (lista), zerar e excluir. Eles mudam de **container** (modal → painel lateral, mesma variante do D3) e herdam os tokens novos, mas o conteúdo e a cerimônia de cada um ficam como estão — a gramática da Fase 4 já os cobre.

## Decisões — aprovadas em 19/10/2026

| Decisão | Resultado |
|---|---|
| D1 · Movimentações com abas | Aprovada |
| D2 · Sidebar | **Escura** |
| D3 · Painel lateral sem pré-seleção | Aprovada, **com** os valores rápidos |
| D4 · "Movimentar" tonal + linha abre o produto | Aprovada — `tonal` entra no design system |
| D5 · Página do produto no lugar do modal de histórico | Aprovada |
| D6 · KPI em destaque "Precisam de reposição" | Aprovada |
| D7 · Tokens novos + regra do `muted` | Aprovada |
| D8 · Abas como partição + atalhos na sidebar | Aprovada |
| D9 · Movimentações como tabela agrupada por dia | Aprovada (complemento, ver abaixo) |
| D10 · Histórico ordena só por data | Aprovada (complemento) |
| D11 · Linha de Produtos com "Movimentar" + `⋯` | Aprovada (complemento) — **substitui** a parte de D4 que mantinha a baixa rápida visível |
| D12 · Sem Storybook nesta feature | Aprovada (complemento) |

O detalhe de cada uma fica abaixo, como foi apresentado.

### D1 · Entradas, Saídas e Histórico viram **uma** tela: Movimentações, com abas

O plano tem três itens de menu: "Entradas" e "Saídas" em *Operação*, "Histórico" em *Análises*. No nosso domínio são **a mesma lista de `StockMovement`** com filtro diferente — três itens apontando para uma tela fariam o destaque de "item ativo" mentir. Proposta: um item **Movimentações**, com abas `Todas · Entradas · Saídas · Ajustes` (cada aba tem URL própria, então "Entradas" continua sendo um link direto).

### D2 · Sidebar escura (recomendada) ou clara

Alternável nos andaimes. Recomendação e motivo em `research.md` (Questão 4): a escura é a maior fonte de personalidade disponível sem decorar nada, e separa navegação de trabalho pelo próprio contraste. Só a sidebar é escura — o resto continua claro.

### D3 · Nova movimentação num painel lateral, com o tipo **sem pré-seleção**

- O painel é a terceira variante do `Modal` (`dialog` · `sheet` · `drawer`), não um sistema novo: foco preso, `Esc`, foco devolvido para quem abriu — testado no protótipo.
- `[ Entrada ] [ Saída ]` do plano chegam **sem nada marcado** quando a intenção não vem do contexto (botão "Movimentar" da linha, botão global). Isso mantém a D2 da Fase 4: o `<select>` pré-selecionado em `IN` era o maior risco de erro humano do sistema (UF-21). Quando a intenção vem do contexto ("Repor" no dashboard), o painel já chega em **Entrada** e o título afirma "Registrar entrada".
- Contexto do produto (nome, SKU, saldo, mínimo, status), preview `saldo atual → saldo após` com diferença assinada e status resultante, bloqueio quando a saída excede o saldo, aviso quando a saída deixa o produto com estoque baixo, botão que nomeia a consequência (`Confirmar saída de 18 un.`). Continua sendo **N1** — sem passo extra.
- Busca de produto dentro do painel, para quando ele é aberto sem produto (botão global "Nova movimentação").
- Valores rápidos `1 · 5 · 10 · 25 · 50` com `aria-pressed` — **o mesmo conjunto** da baixa rápida (item 4 do contrato de `user-flows.md` §9.3), nunca um segundo conjunto. *(A primeira versão do protótipo tinha `20` no lugar de `25`; corrigido antes da aprovação.)*
- Botão **"Nova movimentação" global** no topo da sidebar (e "Movimentar" na barra do celular), em vez de repetido no cabeçalho de cada página — fica a um clique em qualquer tela sem competir com a ação primária da página.

### D4 · "Movimentar" da linha em tom suave, e a linha inteira abre o produto

Com dez linhas por página, dez botões azuis cheios competem com a ação primária da página ("Adicionar produto"). Proposta: "Movimentar" continua **visível e primeiro** em toda linha (é a ação primária da linha, decisão 2 da Fase 4), mas em estilo **tonal** (fundo azul-claro, texto azul-escuro, 8,0:1). ~~Baixa rápida e o menu `⋯` continuam visíveis (D3-a da Fase 4).~~ *Revisto pela D11: a baixa rápida passa para o `⋯`.* Clicar em qualquer outro ponto da linha abre a página do produto.

Isso é um **estilo novo de botão** (`tonal`) no design system — por isso está aqui para aprovação.

### D5 · A página do produto substitui o modal de histórico por produto

"Ver histórico" no menu da linha passa a abrir `/produtos/:id`: identidade, saldo × mínimo, saldo nos últimos 30 dias (com a linha do mínimo no gráfico), entradas e saídas do período e as últimas movimentações. "Ver no histórico" leva ao histórico geral já filtrado por aquele produto. O `MovementHistoryModal` deixa de existir — capacidade preservada, container diferente.

### D6 · Um KPI em destaque: "Precisam de reposição"

A ref. 3 destaca um KPI por fileira com fundo escuro. Proposta: o destaque é o único número **acionável** — produtos sem estoque + estoque baixo — com a divisão explícita (`15 sem estoque · 15 estoque baixo`), cada parte levando à aba correspondente.

### D7 · Tokens novos

Raio `10px` (controle) · `14px` (superfície) · pílula (badge, chip, contador); canvas um degrau mais escuro que hoje; sombra de cartão quase imperceptível; preenchimentos de status próprios para gráfico (validados lado a lado — `research.md`, Questão 5). Regra nova: **texto `muted` só sobre superfície branca** (4,83:1); sobre o canvas ele cai para 4,39:1 e reprova AA, então ali o tom mínimo é o secundário (6,86:1).

### D8 · Abas de Produtos como partição + dois atalhos na sidebar

`Todos · Em estoque · Estoque baixo · Sem estoque` — nenhuma aba contém outra. A sidebar ganha "Estoque baixo" e "Sem estoque" com contador, cada um **exatamente** uma aba. "Precisam de reposição" (as duas juntas) só existe no dashboard, com a divisão à mostra.

## Complemento — tabelas, acessibilidade e design system (19/10/2026)

O usuário trouxe um segundo plano, "Plano de Tabelas, Acessibilidade e Design System" (inventário, Data Table única, WCAG 2.2 AA, tokens e gates de aprovação; referências W3C APG Table/Grid/Sortable Table, IBM Carbon Data Table e Atlassian). A análise contra este protótipo, o PRD e o código está em `research.md` (Questão 8). Quatro pontos mudavam coisas já aprovadas e foram decididos com o usuário; o resto entrou direto no protótipo e no PRD.

### D9 · Movimentações vira tabela, agrupada por dia

O protótipo aprovado mostrava o histórico como linhas soltas (`div` com `role="button"`), sem cabeçalho de colunas. O plano pede que todas as listas usem a mesma arquitetura de tabela. Agora é **uma `<table>`**, com:

- cabeçalho de colunas (Quando · Tipo · Produto · Quantidade · Saldo · Responsável);
- **um `<tbody>` por dia**, aberto por uma linha `<th colspan scope="rowgroup">` ("Ontem · domingo, 18 de outubro" · "5 movimentações");
- o detalhe numa linha seguinte, aberta por um **botão** com `aria-expanded` e nome que identifica a movimentação ("Detalhes: Saída de Caneta Azul às 14:20"); o clique de ponteiro em qualquer ponto da linha também abre (mesma regra da linha clicável de Produtos — o alvo de teclado é o botão).

No celular a tabela vira cartões com o mesmo agrupamento, como Produtos já faz.

### D10 · O histórico ordena só por data

O PRD fixava "mais recente primeiro" e o agrupamento por dia depende disso. O cabeçalho "Quando" alterna **mais recentes ↔ mais antigas**; as outras colunas não ordenam (ordenar por quantidade desfaria os grupos). `aria-sort` fica sempre no `<th>` "Quando".

### D11 · Na linha de Produtos, só "Movimentar" + `⋯`

O plano pede para evitar vários botões por linha. A baixa rápida sai da linha e entra no `⋯` — no celular ela já morava no overflow, então desktop e celular passam a ter o mesmo caminho. O menu ganha três grupos:

```text
Ver produto · Ver no histórico · Editar
──────
Nova entrada · Nova saída · Baixa rápida · Ajustar estoque
──────
Zerar estoque · Excluir
```

"Nova entrada"/"Nova saída" abrem o painel com o tipo marcado e o título afirmando a intenção, como "Repor" — a intenção veio de um clique explícito, então a regra da D3 (sem pré-seleção) não se aplica. Na página do produto, os três primeiros itens saem do menu (já estão na tela). **Mudança declarada** na matriz de paridade, linha 20: o teste "o menu do desktop NÃO repete a baixa rápida" se inverte.

### D12 · Storybook fica fora

O catálogo continua sendo este protótipo + os testes de componente. Cada componente novo do design system ganha um bloco curto de documentação (propósito, anatomia, variantes, estados, acessibilidade, faça/não faça) — formato no `implementation-plan.md`.

### O que mudou no protótipo sem precisar de decisão

| Item | Antes | Agora | Origem |
|---|---|---|---|
| Altura de linha | ~56 px (quadro 36 + 10 px de respiro) | **40 px** uma linha · **48 px** dois níveis; cabeçalho 36 px; quadro de iniciais 32 px na tabela | Plano de tabelas §6 |
| Cabeçalho da tabela | Rola junto | **Fixo** em Produtos e Movimentações; a região usa `overflow: clip` (com `hidden` o `sticky` não gruda) | §16 |
| Colunas em tela menor | Responsável sumia por CSS solto | **Prioridade de coluna** P0/P1/P2: P2 some abaixo de 1180 px, nunca rolagem lateral | §49–50 |
| Ordenação | `aria-sort` estava no **botão** (errado) e o ícone era sempre ↕ | `aria-sort` no **`<th>`**; ícone ↕ sem ordem, ↑/↓ com ordem — a forma muda, não só a cor | §9, §36; W3C Sortable Table |
| Paginação | Produtos numerada; Movimentações "Página X de Y" | **Numerada nas duas** (até 7 páginas todas; acima, primeira · vizinhas · última com "…"); Movimentações com itens por página 10 · 20 · 50 | §15 |
| Linha selecionada | Só o checkbox | Fundo `surface-selected` (`#F4F8FF`, não `accent-subtle`: o SKU cairia para 4,44:1) + barra de 2 px em `accent` (receita da Fase 5, dois sinais) | §11 |
| Raio | 8 px solto em menu, paginação, tooltip, ícone de tipo | Token **`radius-sm` 6 px** | §24 |
| "×" do chip de filtro | 20 × 20 | **24 × 24** (WCAG 2.5.8) | §45 |
| Foco sob cabeçalho fixo | — | `scroll-padding-top: 56px` (WCAG 2.4.11) | §31 |
| Detalhe do histórico no celular | "Observação" com 3 colunas numa grade de 2 vazava para a direita | Ocupa a linha inteira | Achado da revisão |

## Onde o protótipo se afasta do plano — e por quê

| Plano | Protótipo | Motivo |
|---|---|---|
| "Bom dia, Leonardo" | "Boa tarde" (pelo horário) + data | `User` não tem nome (escopo: sem schema) |
| Categoria (filtro, coluna) | — | `Product` não tem categoria |
| Foto ou ícone do produto | Quadro com as iniciais | Sem foto no domínio; as iniciais ancoram a linha |
| Estoque máximo + barra de capacidade | Barra **saldo × mínimo**, com o mínimo marcado | Só existe `minStock`; a barra não inventa um teto |
| Motivo fixo (Compra / Devolução / …) | Observação livre | `note` é texto livre; motivo estruturado é feature própria |
| "Movimentações nos últimos 30 dias" (gráfico do produto) | "Saldo nos últimos 30 dias" + entradas e saídas do período em números | Saldo por dia é o que responde "por que caiu?"; volume vira número, não segundo gráfico |
| Estados Saudável · Atenção · Crítico | Em estoque · Estoque baixo · Sem estoque | Vocabulário fechado da Fase 4 — um nome por estado no produto inteiro |
| Usuários, Relatórios, Configurações | Fora da sidebar | Nenhum tem backend (escopo) |
| Período personalizado no histórico | Opção visível e desabilitada | O PRD decide o seletor de intervalo |

## O que as telas exigem do backend (entra no PRD)

Tudo **leitura**, sem schema novo:

1. **Histórico geral** — movimentações de todos os produtos, paginadas no banco, filtráveis por tipo, produto, responsável, período e texto (produto, SKU, observação); cada item com produto (nome, SKU), `previousQuantity`/`newQuantity`, e-mail do responsável e observação. Mais as contagens por tipo para as abas.
2. **Lista de responsáveis** para o filtro (quem já lançou movimentação).
3. **Agregados do dashboard** — unidades totais, movimentações de hoje (contagem e soma por tipo), série de saldo por dia nos últimos 30 dias.
4. **Agregados do produto** — série de saldo por dia do produto e entradas/saídas do período.

Já existe e é reaproveitado: `GET /products` (lista, busca, status, ordenação), `GET /products/summary` (contagens por status), `GET /products/:id` e `GET /products/:id/movements`.

## Estados cobertos

Conteúdo · carregando (skeleton com a altura da linha) · vazio (com a próxima ação) · sem resultado (com limpar) · erro (específico, com tentar de novo, `role="alert"`) · produto não encontrado · rota inexistente · seleção (barra contextual com escopo "desta página") · menu de ações (destrutivas separadas) · preview bloqueado (saída > saldo) · aviso de estoque baixo antes de confirmar · toast de sucesso com o novo saldo.

## Larguras

| Largura | Comportamento |
|---|---|
| ≥ 1024 | Sidebar completa (recolhível pelo botão do rodapé); abaixo de 1180 px as colunas P2 das tabelas somem |
| 768–1023 | Sidebar como **trilho de ícones** (contadores viram ponto colorido); conteúdo com margem menor |
| < 768 | Barra superior escura com menu, marca e "Movimentar"; sidebar abre por cima; tabelas viram cartões; painel lateral em tela cheia; KPIs em 2 × 2 |

Busca, abas, status, saldo, mínimo, "Movimentar" e baixa rápida continuam visíveis no celular (paridade da Fase 8).

## Acessibilidade verificada no protótipo

- Troca de rota leva o foco ao `<h1>` da página e atualiza o `<title>`; re-render na mesma rota devolve o foco para onde estava.
- Painel: foco preso, `Esc` fecha, foco volta para o botão que abriu; tipo como `radiogroup`; busca de produto como `combobox` com setas e `Enter`; preview em região `aria-live`.
- Gráfico navegável por teclado (setas, `Home`, `End`) com o mesmo tooltip do mouse; "Ver como tabela" mostra os 30 valores; descrição em `aria-label`.
- Status e tipo de movimentação sempre **cor + palavra + ponto/ícone**; variação sempre com sinal textual (`+12`, `−5`); a seta `→` tem equivalente "para" para leitor de tela (dívida A5 da revisão de Ajuste de Estoque).
- Tabelas: `<caption>` (visualmente oculta) descrevendo recorte, ordem e página; `<th scope>`; `aria-sort` só no `<th>` da coluna ordenada; checkbox "Selecionar ‹nome›"; `⋯` "Mais ações para ‹nome›"; botão de detalhe do histórico com nome próprio; grupos de dia como `scope="rowgroup"`.
- WCAG 2.2: alvos ≥ 24 × 24 (2.5.8); foco levado à vista nunca fica atrás do cabeçalho fixo nem da barra do celular (2.4.11, `scroll-padding-top`).
- Contrastes medidos dos pares novos: texto da sidebar 7,37:1, rótulo de grupo 5,60:1, indicador ativo 5,14:1, botão tonal 8,01:1, badges 4,84–5,91:1, KPI em destaque 11,46:1. O âmbar de gráfico (2,15:1 sobre branco) nunca aparece sem rótulo e número ao lado.

## Fora do escopo deste protótipo

Conteúdo dos fluxos de cadastro, ajuste, baixa rápida, baixa em lote, zerar e excluir (só mudam de container); login; tela de Integrações (entra em *Administração* quando a branch de webhooks voltar).
