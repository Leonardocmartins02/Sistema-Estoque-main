# PRD — Refatoração visual (SimpleStock v2)

> Consolida `idea.md`, `research.md` e `prototype.md` (D1–D8 aprovadas em 19/10/2026) num contrato de produto verificável. Define **o que** cada tela faz, os contratos de URL e de API e o que não pode se perder. Não define nomes de componente, arquivos, ordem de implementação nem testes específicos — isso é do `implementation-plan.md`.

## Contexto

O SimpleStock é uma tela só: `App.tsx` renderiza `ProductDashboard` e todo o resto vive em modais empilhados sobre a lista. A primeira rodada de UI/UX (`docs/ui-ux/`, Fases 1–9) resolveu coerência (primitivo único de diálogo, gramática de operação, tokens com enforcement no lint). Esta feature resolve **estrutura de produto**: navegação persistente, URL por tela, visão geral, página por produto, histórico do estoque inteiro — e troca a aparência de ferramenta interna pela de um SaaS empresarial.

O escopo foi fechado com o usuário em 19/10/2026: **visual + navegação sobre o que existe + endpoints novos somente de leitura**. Nenhuma mudança de schema.

## Problema

1. Não há URL para "este produto", "o histórico de hoje" ou "o que está sem estoque" — não dá para voltar, recarregar, compartilhar nem abrir em outra aba.
2. Não há visão geral: "quanto entrou e saiu hoje?", "o estoque está subindo ou caindo?" e "o que precisa de reposição?" exigem varrer páginas.
3. O histórico só existe por produto (e o de baixas, só `OUT`). Não há como auditar "tudo de ontem" ou "tudo que fulano lançou".
4. A primeira impressão é de ferramenta interna — pesa num projeto de portfólio.

## Objetivo

Entregar o shell com sidebar, cinco superfícies (Dashboard, Produtos, Produto, Nova movimentação, Movimentações) e o design system v2, **sem perder nenhuma capacidade que existe hoje** (mapa na seção "Mapa de capacidades") e **sem mudar nenhuma regra de negócio**.

## Usuários

- **Operação** (desktop, várias vezes por dia): localizar produto, lançar entrada/saída, confirmar o efeito.
- **Acompanhamento** (gestor, esporádico): dashboard para saber se há algo a resolver; histórico quando um número não bate.
- **Estoque físico** (celular): baixa rápida e consulta de saldo.

Sem papéis: todo usuário autenticado vê e faz tudo (inalterado).

## Escopo

- Design system v2: tokens novos e revistos (`research.md` Q5), botão `tonal` (D4), variante `drawer` do `Modal` (D3), dois gráficos em SVG próprio (`research.md` Q3).
- App shell: sidebar escura (D2), barra superior no celular, rotas reais, foco e título por rota.
- Telas: Dashboard, Produtos, Produto, Movimentações; painel "Nova movimentação".
- Quatro endpoints **de leitura**: histórico geral, responsáveis, visão geral do dashboard, tendência do produto.
- Troca de container dos formulários existentes (produto, ajuste, baixa rápida) para o painel lateral, sem mudar conteúdo nem cerimônia.

## Fora do Escopo

- Qualquer mudança de schema ou migration — categoria, estoque máximo, foto, nome de usuário e motivo estruturado ficam para features próprias (`idea.md`, tabela "Fora").
- Telas de Usuários, Relatórios, Configurações e Integrações (Integrações volta com a branch de webhooks, em *Administração*).
- Exportação do histórico, tema escuro da aplicação inteira, i18n, PWA, tempo real.
- Mudança no conteúdo ou na cerimônia de ajuste, baixa rápida, baixa de produtos, histórico de baixas, zerar e excluir.
- Unificar o "Histórico de baixas" com Movimentações (ver "Questões em aberto").
- Migrar os tipos que já existem no frontend para `packages/shared` (dívida registrada em `current-state.md`). Os tipos **novos** desta feature nascem em `packages/shared`, como manda o `AGENTS.md`.
- Subir React para 19.

## Arquitetura de informação

```text
SimpleStock                       [ + Nova movimentação ]
VISÃO GERAL
  Dashboard                       /
OPERAÇÃO
  Produtos                        /produtos
  Movimentações                   /movimentacoes
ESTOQUE
  Estoque baixo   (contador)      /produtos?status=baixo
  Sem estoque     (contador)      /produtos?status=sem-estoque
────────
e-mail do usuário · recolher · Sair
```

- `/produtos/:id` não é item da sidebar; o item ativo continua "Produtos".
- O item ativo de "Estoque baixo"/"Sem estoque" é o atalho, não "Produtos", quando a URL é exatamente aquele recorte.
- A sidebar só mostra telas que existem. Nenhum "em breve".

## Contrato de URL

Parâmetros em português, porque aparecem para quem usa. Valor desconhecido ou inválido é **ignorado** (cai no padrão), nunca quebra a tela nem gera erro.

| Rota | Parâmetro | Valores | Padrão |
|---|---|---|---|
| `/produtos` | `status` | `em-estoque` · `baixo` · `sem-estoque` | todos |
| | `q` | texto | — |
| | `ordem` | `nome` · `sku` · `saldo` | `nome` |
| | `dir` | `asc` · `desc` | `asc` |
| | `pagina` | inteiro ≥ 1 | 1 |
| | `por` | `10` · `20` · `50` | 10 |
| `/produtos/:id` | — | — | — |
| `/movimentacoes` | `tipo` | `entradas` · `saidas` · `ajustes` · `inicial` | todas |
| | `produto` | id de produto | — |
| | `responsavel` | id de usuário | — |
| | `periodo` | `hoje` · `7d` · `30d` · `tudo` · `personalizado` | `30d` |
| | `de`, `ate` | `AAAA-MM-DD` (só com `periodo=personalizado`) | — |
| | `q` | texto | — |
| | `pagina` | inteiro ≥ 1 | 1 |
| | `por` | `10` · `20` · `50` | 20 |

Mudar busca, filtro, aba, ordem ou tamanho de página volta para a página 1. A busca atualiza a URL sem empilhar uma entrada de histórico a cada tecla.

## Fluxos

**1 · Abrir o sistema** → Dashboard. Sem sessão, qualquer URL mostra o login; depois do login, a pessoa chega na URL que pediu.

**2 · Repor a partir do dashboard** → "Repor" na linha de "Produtos para repor" → painel já em **Entrada**, com o produto escolhido e o título "Registrar entrada".

**3 · Encontrar um produto** → Produtos → aba, busca, ordenação, paginação. Clique na linha (ou no nome) abre a página do produto.

**4 · Ver um produto** → página do produto: saldo × mínimo, saldo em 30 dias, entradas e saídas do período, últimas movimentações e todas as ações.

**5 · Movimentar** → "Nova movimentação" (sidebar), "Movimentar" (linha, card ou página do produto) ou "Repor" → painel lateral → tipo → produto (se não veio do contexto) → quantidade → preview → confirmar → toast com o novo saldo.

**6 · Auditar** → Movimentações → aba de tipo, filtros, agrupado por dia → expandir a linha para ver o detalhe.

## Requisitos Funcionais

### Shell e navegação

1. A sidebar deve exibir os grupos e itens da arquitetura de informação acima, com o item ativo marcado visualmente **e** por `aria-current="page"`.
2. "Estoque baixo" e "Sem estoque" devem exibir o número de produtos naquele status, com texto acessível ("Estoque baixo, 15 produtos"); o número deve ser **o mesmo** da aba correspondente em Produtos.
3. O botão "Nova movimentação" deve estar no topo da sidebar, acessível de qualquer tela; no celular, como "Movimentar" na barra superior.
4. O rodapé da sidebar deve mostrar o e-mail do usuário e a ação "Sair".
5. No desktop (≥ 1024 px) a sidebar deve poder ser recolhida para um trilho de ícones; a preferência é lembrada no navegador e, se o armazenamento falhar, a sidebar abre expandida.
6. Entre 768 e 1023 px a sidebar deve aparecer como trilho de ícones, com nome acessível em cada item; os contadores viram um ponto colorido **acompanhado** do número no nome acessível.
7. Abaixo de 768 px deve existir uma barra superior com menu, marca e "Movimentar"; a sidebar abre por cima do conteúdo, prende o foco e fecha com `Esc`, com clique fora e ao navegar.
8. Cada tela deve ter URL própria; voltar, avançar e recarregar devem preservar tela e recorte (contrato de URL).
9. Ao trocar de rota, o foco deve ir para o `<h1>` da página e o título do documento deve virar `<Tela> · SimpleStock` (na página do produto, `<Nome do produto> · SimpleStock`). Re-renderização na **mesma** rota (filtro, aba, página) não move o foco.
10. O skip link "Pular para o conteúdo principal" e o `ApiStatusBanner` devem continuar existindo.
11. Rota inexistente deve mostrar "Página não encontrada", com `<h1>` e link para o Dashboard.

### Dashboard

12. O cabeçalho deve mostrar a saudação pelo horário local ("Bom dia" · "Boa tarde" · "Boa noite"), **sem nome**, e a data por extenso.
13. Quatro indicadores:
    - **Produtos**: total cadastrado e "N em estoque".
    - **Unidades em estoque**: soma dos saldos e a variação nos últimos 30 dias, com sinal textual e seta (`+124 ↗`).
    - **Precisam de reposição** (destaque, D6): estoque baixo + sem estoque, com a divisão explícita — cada parte é um link para a aba correspondente.
    - **Movimentações hoje**: total do dia e, separadamente, entradas (quantidade de lançamentos e unidades) e saídas (idem).
14. "Evolução do estoque": gráfico de área com o total de unidades no fim de cada um dos últimos 30 dias; tooltip no mouse **e** no teclado (setas, `Home`, `End`); "Ver como tabela" mostra os 30 valores.
15. "Status do estoque": barra empilhada com os três status e legenda com palavra, quantidade e percentual; cada item da legenda leva à aba correspondente; texto curto explicando a regra de status.
16. "Produtos para repor": até 6 produtos, sem estoque primeiro e depois do menor saldo para o maior; cada linha com nome (link para o produto), saldo × mínimo, status e "Repor".
17. "Atividade recente": as 6 movimentações mais recentes de todos os produtos, com tipo (ícone + palavra), produto (link), tempo relativo, responsável e diferença assinada; link "Ver histórico" para Movimentações.
18. Sem nenhum produto cadastrado, o dashboard deve mostrar um estado vazio com "Adicionar produto", em vez de indicadores zerados e gráficos vazios.

### Produtos

19. Abas `Todos · Em estoque · Estoque baixo · Sem estoque`, cada uma com contagem; as abas são uma **partição** (nenhuma contém outra) e as contagens não dependem da busca (D8).
20. Busca por nome ou SKU, insensível a acento e caixa (comportamento atual).
21. Ordenação por nome, SKU e saldo: no cabeçalho da tabela (desktop) e na sheet "Ordenar" (celular); um critério por vez; ordenação global no backend (comportamento atual).
22. Cada linha deve mostrar: iniciais do produto, nome (link para a página do produto), SKU, saldo pareado ao mínimo, status (cor + palavra + ponto) e as ações "Movimentar" (botão `tonal`, D4), "Baixa rápida" e o menu `⋯`.
23. Clicar em qualquer ponto da linha fora de um controle deve abrir a página do produto; pelo teclado o caminho é o link do nome (a linha não vira um segundo alvo de foco).
24. O menu `⋯` deve conter: Editar, Ver produto, Ajustar estoque e, após o separador, Zerar estoque (desabilitado sem saldo) e Excluir.
25. Seleção múltipla, barra contextual "N selecionados nesta página" com "Excluir selecionados", e a região "Zerar página" / "Excluir página" devem continuar existindo no desktop; a seleção limpa ao mudar de página, aba, busca ou ordenação (decisão 8 da Fase 4).
26. A paginação vem depois da lista, com "1–10 de 50" e seletor de itens por página (10 · 20 · 50).
27. O cabeçalho da página deve ter "Adicionar produto" (primária) e "Baixa de produtos" (secundária).
28. No celular a lista vira cartões com nome, SKU, saldo × mínimo, status, "Movimentar", baixa rápida (no overflow) e o menu — sem seleção múltipla nem ações em lote (ausências já assinadas na matriz de paridade).

### Produto

29. Trilha "Produtos › Nome"; `<h1>` com o nome; status ao lado; SKU e descrição.
30. Ações: "Movimentar" (primária), "Baixa rápida" e `⋯` (Editar, Ajustar estoque, Zerar estoque, Excluir).
31. Saldo atual em destaque, pareado ao mínimo, com uma barra que marca o mínimo e um veredito em texto: "N acima do mínimo", "Faltam N para o mínimo" ou "Sem estoque".
32. "Saldo nos últimos 30 dias": gráfico de área do produto com a linha do mínimo, com a mesma interação e alternativa em tabela do RF 14.
33. Entradas e saídas do produto nos últimos 30 dias, em unidades.
34. "Últimas movimentações": as 8 mais recentes, com o total, e "Ver no histórico" levando a Movimentações já filtrado por este produto e por **todo o período**.
35. Produto inexistente (excluído, link velho) deve mostrar "Produto não encontrado" com link para Produtos — nunca tela em branco.
36. Excluir o produto a partir da página deve levar a Produtos, com o toast de confirmação.
37. Depois de qualquer operação (movimentar, ajustar, zerar, editar, baixa rápida), saldo, status, gráfico e últimas movimentações devem refletir o novo estado sem recarregar a página.

### Nova movimentação (painel lateral)

38. O painel deve abrir a partir de: "Nova movimentação" na sidebar (sem produto, sem tipo); "Movimentar" na linha, no cartão ou na página do produto (com produto, sem tipo); "Repor" no dashboard (com produto e tipo **Entrada**).
39. O tipo é um grupo de rádio `Entrada` / `Saída` que **não nasce marcado** quando a intenção não veio do contexto (D2 da Fase 4, UF-21). O título começa neutro ("Nova movimentação") e afirma a intenção quando ela existe ("Registrar entrada").
40. Aberto sem produto, o painel deve oferecer uma busca de produto (nome ou SKU) operável por teclado (setas, `Enter`, `Esc`), mostrando o saldo de cada resultado; é possível trocar o produto escolhido.
41. Com o produto escolhido, o painel mostra nome, SKU, saldo, mínimo e status.
42. Quantidade: campo numérico com botões de diminuir/aumentar e valores rápidos `1 · 5 · 10 · 25 · 50` — o mesmo conjunto da baixa rápida — com `aria-pressed` refletindo o valor atual.
43. Preview `saldo atual → saldo após`, com a diferença assinada e o status resultante, em região `aria-live`, recalculado a cada mudança.
44. Saída maior que o saldo deve bloquear a confirmação com uma mensagem que diz quanto há disponível; o backend continua sendo a autoridade (422).
45. Saída que deixa o produto abaixo do mínimo (sem zerar) deve mostrar um aviso **antes** de confirmar, sem bloquear.
46. Data (opcional, padrão "agora") e observação livre continuam disponíveis.
47. O botão de confirmação deve nomear a consequência (`Confirmar saída de 18 un.`), ficar indisponível até haver tipo, produto e quantidade válidos, e mostrar carregamento durante o envio. Continua sendo **N1** — sem passo extra de confirmação.
48. Sucesso: o painel fecha, o toast informa a operação e o novo saldo, e todas as telas abertas refletem o novo estado (lista, contadores, dashboard, página do produto, histórico).
49. Erro: o painel continua aberto, com a mensagem específica do servidor e os dados preservados.
50. Foco preso no painel, `Esc` fecha, o foco volta para o botão que abriu; no celular o painel ocupa a tela inteira.

### Movimentações

51. Abas `Todas · Entradas · Saídas · Ajustes · Estoque inicial`, uma por tipo do vocabulário fechado, cada uma com a contagem sob os demais filtros ativos. *(O protótipo tinha quatro abas, com Estoque inicial dentro de Entradas; a quinta preserva o filtro só de Estoque inicial que o histórico por produto já oferece — F-09.)*
52. Filtros: busca (nome do produto, SKU ou observação, insensível a acento), produto, responsável e período (`Hoje`, `Últimos 7 dias`, `Últimos 30 dias`, `Todo o período`, `Personalizado` com datas de/até). Cada filtro ativo aparece como chip removível, com "Limpar filtros".
53. Resumo do recorte: quantidade de movimentações, unidades que entraram (`+N un.`, Entrada + Estoque inicial) e unidades que saíram (`−N un.`).
54. Lista agrupada por dia no fuso local ("Hoje", "Ontem", data por extenso), com a contagem de movimentações daquele dia no recorte.
55. Cada linha: hora, tipo (ícone + palavra), produto (com observação ou SKU), diferença assinada, `antes → depois` e responsável; a linha expande (botão com `aria-expanded`) para mostrar data e hora completas, produto (link), SKU, saldo, responsável e observação.
56. Dados legados: sem `antes/depois`, mostrar `—` (nunca zero inventado); sem responsável, "Usuário não disponível"; ajuste legado sem `antes/depois` aparece com a quantidade e a indicação de dado incompleto.
57. Paginação com intervalo ("1–20 de 209") e seletor de itens por página (10 · 20 · 50).
58. Ordem: mais recente primeiro, determinística entre páginas.

### Demais fluxos

59. Cadastro/edição de produto, ajuste de estoque e baixa rápida passam a abrir no painel lateral; campos, validações, passos, mensagens e cerimônia continuam iguais.
60. "Baixa de produtos" (lista) e "Histórico de baixas" continuam como diálogos, com o visual novo; os 20 comportamentos de `user-flows.md` §9.3 continuam valendo.
61. Zerar e excluir (item, seleção e página) continuam usando o diálogo de confirmação atual.
62. O modal de histórico por produto deixa de existir; "Ver histórico" passa a ser "Ver produto" e abre a página do produto (D5).
63. O banner de estoque baixo deixa de existir; sua função passa para os contadores da sidebar e para o destaque "Precisam de reposição" (declarado no mapa de capacidades).

### API (somente leitura)

64. **Histórico geral** — `GET /api/movements`: movimentações de todos os produtos, paginadas no banco, filtráveis por tipo (um ou mais), produto, responsável, intervalo de datas e texto; com totais por tipo sob os demais filtros e a contagem por dia dos dias presentes na página (contrato abaixo).
65. **Responsáveis** — `GET /api/movements/users`: usuários que já lançaram ao menos uma movimentação (id e e-mail), ordenados por e-mail.
66. **Visão geral** — `GET /api/dashboard`: unidades totais, totais de hoje por tipo e a série de 30 dias do estoque inteiro.
67. **Tendência do produto** — `GET /api/products/:id/trend`: série de 30 dias do produto e totais por tipo na janela; 404 se o produto não existe.
68. Contagens por status (sidebar, abas, dashboard) continuam vindo de `GET /api/products/summary`; lista e "Produtos para repor" de `GET /api/products`; produto de `GET /api/products/:id`. `GET /api/products/:id/movements` continua existindo e funcionando, mesmo sem consumidor no frontend.

## Contrato da API

Todas as rotas exigem sessão (`requireAuth`), validam query com Zod (valor fora do domínio → 400) e devolvem DTO **explícito** — nunca o registro do banco espalhado (dívida #8 da revisão de Ajuste de Estoque não se repete). Os tipos de resposta ficam em `packages/shared`.

**Fuso (`tz`)** — nas rotas que cortam por dia. Nome IANA (`America/Sao_Paulo`); padrão `America/Sao_Paulo`; inválido → 400. O frontend envia o fuso do navegador. O valor nunca é interpolado em SQL.

**Totais por tipo** — forma única, usada nas três rotas que agregam:

```ts
type TypeTotals = Record<'IN' | 'OUT' | 'ADJUSTMENT' | 'INITIAL_STOCK', { count: number; units: number }>;
// units: soma de `quantity` para IN, OUT e INITIAL_STOCK (sem sinal);
//        soma de `newQuantity − previousQuantity` para ADJUSTMENT (com sinal; legado incompleto conta 0).
```

**`GET /api/movements`**

| Parâmetro | Regra |
|---|---|
| `page` | inteiro ≥ 1, padrão 1 |
| `pageSize` | 1–100, padrão 20 |
| `type` | um ou mais de `IN,OUT,ADJUSTMENT,INITIAL_STOCK`, separados por vírgula |
| `productId`, `userId` | texto opcional |
| `from`, `to` | data/hora ISO, opcionais, inclusivos |
| `q` | texto; casa nome do produto, SKU ou observação, sem acento e sem caixa |
| `tz` | fuso (ver acima) |

```ts
{
  items: Array<{
    id: string;
    type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'INITIAL_STOCK';
    quantity: number;
    delta: number | null;            // efeito no saldo, com sinal; null em ajuste legado incompleto
    previousQuantity: number | null;
    newQuantity: number | null;
    date: string;                    // ISO
    note: string | null;
    product: { id: string; name: string; sku: string };
    userEmail: string | null;
  }>;
  total: number; page: number; pageSize: number;
  totalsByType: TypeTotals;          // com todos os filtros, MENOS `type` (abas e resumo)
  days: Array<{ date: string; count: number }>; // AAAA-MM-DD no `tz`; só os dias presentes em `items`, contando o recorte inteiro
}
```

Ordem fixa: `date` decrescente, `id` como desempate.

**`GET /api/movements/users`** → `{ items: Array<{ id: string; email: string }> }`.

**`GET /api/dashboard?tz=`**

```ts
{
  timezone: string;
  units: number;                     // soma dos saldos atuais
  today: TypeTotals;                 // movimentações com data no dia de hoje, no `tz`
  trend: Array<{ date: string; balance: number }>; // 30 pontos, de hoje − 29 até hoje
}
```

**`GET /api/products/:id/trend?tz=`**

```ts
{
  timezone: string;
  trend: Array<{ date: string; balance: number }>; // 30 pontos
  totals: TypeTotals;                // movimentações do produto dentro da janela
}
```

## Requisitos Não Funcionais

1. **Sem schema novo, sem migration.** As rotas novas leem o que já existe.
2. **Uma dependência de runtime nova**: `react-router` 7.18.x em modo biblioteca. Gráficos em SVG próprio; nenhuma outra biblioteca.
3. **Saldo diário calculado andando para trás a partir do saldo atual** (`research.md` Q7), com o mesmo cálculo de saldo do `StockService` e a mesma regra de `ADJUSTMENT` de `sumAdjustmentDeltas` — nunca uma segunda fórmula de saldo. A série deve sair de uma agregação limitada à janela, não de uma consulta por dia.
4. **Paginação, filtro e contagem no banco** no histórico geral; a busca textual pode usar o mesmo pré-filtro sem acento já usado em `/quick-out/history` (risco registrado).
5. **Desempenho**: cada rota nova responde em menos de 300 ms no ambiente local com o seed (50 produtos), medido no QA.
6. **Design system**: tokens v2 conforme `research.md` Q5; a lista de 19 utilitários proibidos da Task 27 não muda; todo valor novo entra por token, não por utilitário cru; `rounded-full` continua proibido fora do ponto decorativo (a pílula entra como `rounded-pill`).
7. **Acessibilidade WCAG 2.1 AA** como gate de cada tela: contraste dos pares novos medido (`prototype.md`), texto `muted` só sobre superfície branca, teclado em tudo, foco visível único, status e tipo nunca só por cor, mensagens assíncronas em `aria-live`/`role="status"`/`role="alert"`, alvos de toque ≥ 44 × 44 no celular.
8. **Motion**: só a política atual (120 ms estado, 180 ms overlay), respeitando `prefers-reduced-motion`; nenhuma animação atrasa uma operação.
9. **Dado remoto só via React Query**; toda mutação invalida as consultas que mostram saldo, contagem, série ou histórico.
10. **Um único primitivo de diálogo**: o painel lateral é a variante `drawer` do `Modal`, ao lado de `dialog` e `sheet`.
11. **Deploy**: o Netlify precisa do fallback de SPA (`/*  /index.html  200`) depois do redirect de `/api/*`, para que recarregar `/produtos/123` funcione.
12. **TDD** (`AGENTS.md`): rota nova com teste de integração contra Postgres antes da implementação; fluxo que muda de container com teste de caracterização antes de mover.

## Regras de Negócio

Todas as regras atuais continuam **exatamente** como estão — saldo derivado de movimentações, saída nunca negativa (lock + transação), ajuste por saldo alvo com 409, hard delete com cascata, lote não atômico. Esta feature **expressa** regras; as únicas definições novas são de leitura:

- **Status**: sem estoque = saldo 0; estoque baixo = 0 < saldo < mínimo; em estoque = saldo ≥ mínimo (regra atual, agora explicada na tela).
- **Efeito de uma movimentação no saldo (`delta`)**: `+quantity` para Entrada e Estoque inicial; `−quantity` para Saída; `newQuantity − previousQuantity` para Ajuste (ajuste legado sem esses campos tem efeito 0, como hoje no cálculo de saldo).
- **Saldo no fim do dia D** = saldo atual − soma dos `delta` das movimentações com data posterior ao fim de D. Movimentações com data no futuro só entram na série a partir do próprio dia.
- **"Dia"** é o dia do calendário no fuso de quem usa, pela **data informada** da movimentação (`date`), não pela data de gravação.
- **"Entraram"** (resumo do histórico) soma Entrada + Estoque inicial; **"Entradas"** (aba e indicador de hoje) é só o tipo Entrada — uma palavra, um tipo.
- **Precisam de reposição** = estoque baixo + sem estoque. O termo existe só no dashboard.

## Mapa de capacidades — de onde para onde

Toda capacidade de hoje e onde ela fica. Complementa `docs/ui-ux/parity-matrix.md` (desktop × celular), que será revalidada no QA desta feature.

| Capacidade hoje | Onde está hoje | Onde fica | Status |
|---|---|---|---|
| Lista de produtos | `ProductDashboard` | `/produtos` | Mantida |
| Busca por nome/SKU | Campo acima da tabela | `/produtos`, na URL (`q`) | Mantida |
| Filtro por status | Menu de múltipla escolha no cabeçalho / sheet | Abas exclusivas (D8) + atalhos na sidebar | **Mudança declarada**: combinar dois status na mesma lista deixa de existir; "baixo + sem estoque" juntos vira o card "Produtos para repor" (os 6 primeiros) e as duas abas |
| Banner de estoque baixo | Acima da lista | Contadores da sidebar + destaque do dashboard | **Mudança declarada** (RF 63) |
| Remover filtro / limpar filtros | Chips + "Limpar filtros" | Aba "Todos" + chips da busca | Mantida |
| Ordenação por nome, SKU, saldo | Cabeçalho / sheet "Filtrar e ordenar" | Cabeçalho / sheet "Ordenar" | Mantida |
| Paginação com total | Abaixo da lista | Abaixo da lista, com itens por página | Mantida (+ itens por página) |
| Seleção, excluir selecionados | Barra contextual | Idem | Mantida |
| Zerar página, excluir página | Região rotulada no rodapé | Idem | Mantida |
| Movimentar (IN/OUT) | `MovementFormModal` | Painel lateral (D3); botão `tonal` na linha (D4) | Mantida — container e estilo mudam |
| Baixa rápida | `QuickOutModal` | Mesmo fluxo, no painel lateral | Mantida |
| Adicionar / editar produto | `ProductFormModal` | Mesmo formulário, no painel lateral | Mantida |
| Ajustar estoque | `AdjustmentFormModal` | Mesmo fluxo (form → confirmação → conflito), no painel lateral | Mantida |
| Zerar estoque / Excluir | `ConfirmDialog` | Idem, também na página do produto | Mantida |
| Ver histórico do produto (tipo, de/até, busca na observação, itens por página) | `MovementHistoryModal` | Página do produto (últimas 8) + Movimentações filtrado pelo produto (todos os filtros) | Mantida (D5); a busca passa a casar também nome e SKU |
| Filtrar só "Estoque inicial" (F-09) | Select do histórico | Aba "Estoque inicial" | Mantida |
| Baixa de produtos (lista) + Histórico de baixas | `QuickOutListModal` + `QuickOutHistoryModal` | Mesmos diálogos | Mantida |
| E-mail do usuário + Sair | Cabeçalho | Rodapé da sidebar / menu no celular | Mantida |
| Skip link, `ApiStatusBanner` | Shell | Shell | Mantida |

## Permissões

Inalteradas: qualquer usuário autenticado acessa todas as telas e rotas. As rotas novas exigem sessão como todo o resto da API. O histórico geral e a lista de responsáveis expõem e-mails a qualquer usuário autenticado — mesma exposição já aceita no histórico por produto (risco #7).

## Tratamento de Erros

| Situação | Comportamento esperado |
|---|---|
| Sessão expirada em qualquer tela | Mesmo tratamento de hoje (volta ao login); a URL é preservada |
| Falha ao carregar uma região (lista, gráfico, KPI, histórico) | Só aquela região mostra erro específico com "Tentar de novo" (`role="alert"`); o resto da tela continua utilizável |
| API fora do ar | `ApiStatusBanner`, como hoje |
| Produto inexistente em `/produtos/:id` | "Produto não encontrado" + link para Produtos |
| Rota inexistente | "Página não encontrada" + link para o Dashboard |
| Parâmetro de URL inválido | Ignorado; a tela abre no padrão |
| Query inválida na API (tipo, data, fuso, página) | 400, sem executar a consulta |
| Saída maior que o saldo | Confirmação bloqueada no painel; se passar (concorrência), o 422 do servidor aparece no painel, com os dados preservados |
| Erro inesperado ao movimentar | Painel aberto, mensagem, nada presumido gravado |

## Estados

Toda região de dados tem cinco estados: **carregando** (skeleton com a altura final), **vazio** (com a próxima ação), **sem resultado para o filtro** (com limpar filtros), **erro** (específico, com tentar de novo) e **conteúdo**.

## Edge Cases

- Nenhum produto cadastrado (dashboard, produtos, histórico vazios — cada um com a sua próxima ação).
- Produto sem nenhuma movimentação (série plana em 0, "Nenhuma movimentação ainda").
- Produto com mínimo 0 (nunca fica "Estoque baixo"; a barra não mostra marca de mínimo).
- Movimentação com data no futuro ou retroativa (série pela data informada).
- Ajuste legado sem `antes/depois` e movimentação sem responsável.
- Virada do dia no fuso local (movimentação às 23h50 e às 00h10 em dias diferentes; "hoje" não é "desde as 21h de ontem").
- Página da URL além do total (`?pagina=99`) → última página válida.
- Produto excluído enquanto a página dele está aberta em outra aba.
- Busca com acento ("lápis" × "lapis") nas duas listas.
- Saída exatamente igual ao saldo (zera; sem aviso de "abaixo do mínimo", status vira "Sem estoque").
- Painel aberto pelo botão global e fechado sem escolher nada (nenhum efeito).

## Critérios de Aceite

**Navegação e URL**
```
DADO que o usuário está em /produtos?status=baixo&pagina=2
QUANDO recarregar a página
ENTÃO deve ver a aba "Estoque baixo", página 2
E o foco deve estar no título "Produtos"
E o título do documento deve ser "Produtos · SimpleStock"
```

```
DADO um usuário sem sessão
QUANDO abrir /movimentacoes?tipo=saidas
E fizer login
ENTÃO deve chegar em Movimentações, na aba "Saídas"
```

**Contadores coerentes**
```
DADO 15 produtos com estoque baixo
ENTÃO o item "Estoque baixo" da sidebar deve anunciar 15
E a aba "Estoque baixo" de Produtos deve mostrar 15
E o destaque do dashboard deve mostrar "15 estoque baixo"
```

**Repor**
```
DADO o produto "Caneta Azul" sem estoque no card "Produtos para repor"
QUANDO o usuário acionar "Repor"
ENTÃO o painel deve abrir com "Caneta Azul" escolhido
E com o tipo "Entrada" marcado
E com o título "Registrar entrada"
```

**Sem pré-seleção**
```
DADO que o usuário aciona "Nova movimentação" na sidebar
ENTÃO nenhum tipo deve estar marcado
E nenhum produto deve estar escolhido
E o botão de confirmação deve estar indisponível
```

**Preview e bloqueio**
```
DADO um produto com saldo 12 e mínimo 10
QUANDO o usuário escolher "Saída" e quantidade 5
ENTÃO o preview deve mostrar "12 → 7", "−5" e "Estoque baixo"
E deve haver um aviso de que o produto ficará abaixo do mínimo
E o botão deve dizer "Confirmar saída de 5 un."
QUANDO a quantidade for 13
ENTÃO a confirmação deve ficar bloqueada com a mensagem de saldo disponível
```

**Sucesso propaga**
```
DADO a página do produto "Caneta Azul" com saldo 20
QUANDO o usuário registrar uma saída de 5 pelo painel
ENTÃO o toast deve informar o novo saldo 15
E a página deve mostrar saldo 15, a nova movimentação no topo e o último ponto do gráfico em 15
E o contador da sidebar deve refletir o novo status, se mudou
```

**Histórico geral**
```
DADO movimentações de vários produtos e usuários
QUANDO o usuário abrir /movimentacoes?tipo=ajustes&periodo=7d
ENTÃO deve ver só ajustes dos últimos 7 dias, agrupados por dia, do mais recente para o mais antigo
E cada linha deve mostrar "antes → depois", a diferença assinada e o responsável
E as abas devem mostrar as contagens de cada tipo no mesmo período
```

```
DADO uma movimentação sem responsável e sem antes/depois
ENTÃO a linha deve mostrar "Usuário não disponível" e "—"
E a tela não deve quebrar
```

**Página do produto**
```
DADO o produto "Caneta Azul" com movimentações nos últimos 30 dias
QUANDO o usuário abrir /produtos/<id>
ENTÃO deve ver saldo × mínimo com o veredito em texto
E o gráfico de 30 dias com a linha do mínimo, operável por teclado
E as 8 últimas movimentações
QUANDO acionar "Ver no histórico"
ENTÃO deve chegar em /movimentacoes?produto=<id>&periodo=tudo
```

```
DADO um id de produto que não existe
QUANDO o usuário abrir /produtos/<id>
ENTÃO deve ver "Produto não encontrado" com link para Produtos
```

**Série de saldo (API)**
```
DADO um produto com saldo atual 10
E uma entrada de 4 hoje e uma saída de 6 ontem
QUANDO consultar GET /api/products/:id/trend
ENTÃO o ponto de hoje deve ser 10
E o de ontem deve ser 6
E o de anteontem deve ser 12
```

```
DADO uma movimentação às 23h30 de ontem no horário de Brasília (02h30 UTC de hoje)
QUANDO consultar GET /api/dashboard?tz=America/Sao_Paulo
ENTÃO ela NÃO deve contar em "today"
```

```
DADO tz=Marte/Base
QUANDO consultar GET /api/dashboard
ENTÃO a resposta deve ser 400
```

**Nenhuma capacidade some**
```
DADO o mapa de capacidades deste PRD
ENTÃO cada linha "Mantida" deve ser alcançável na tela indicada, em desktop e no celular
E cada "Mudança declarada" deve estar registrada na matriz de paridade revalidada
```

## Riscos

| Risco | Mitigação |
|---|---|
| Perder capacidade ao trocar modais por páginas | Mapa de capacidades acima + testes de caracterização antes de mover cada fluxo |
| Regressão nos fluxos que só mudam de container | A troca é de variante do `Modal`; os testes atuais desses fluxos continuam passando sem alteração de asserção |
| Pré-filtro de busca em memória no histórico geral não escalar | Mesmo padrão aceito em `/quick-out/history`; volume atual pequeno; item de backlog (`unaccent`) já existe |
| Série errada por fuso ou por movimentação retroativa | Regras explícitas acima + critérios de aceite de virada de dia |
| Visual "SaaS genérico" | Princípios P1–P10 (`research.md`); revisão visual contra o protótipo aprovado em cada fase |
| `ProductDashboard` crescer ainda mais | A refatoração **reduz** o container: rotas e páginas distribuem o estado; a decomposição é parte do plano, não dívida nova |

## Questões em Aberto

- **Histórico de baixas × Movimentações**: as baixas também aparecem em Movimentações → Saídas. Manter os dois agora preserva os comportamentos 17–20 do contrato; unificar é decisão de uma próxima rodada.
- **Volume**: o critério de 300 ms vale para o seed. Se o volume real crescer muito, a série de saldo e o pré-filtro de busca são os primeiros candidatos a otimização (fora desta feature).
