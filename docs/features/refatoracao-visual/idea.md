# IDEA — Refatoração visual (SimpleStock v2)

> Fase 1 do workflow (`IDEA → RESEARCH → PROTOTYPE → PRD → IMPLEMENTATION PLAN → EXECUTION → QA`). Este documento define O PROBLEMA, O ESCOPO e AS REGRAS. Não decide biblioteca, valor de token nem forma de endpoint — isso é RESEARCH/PRD/PLAN.
>
> Origem: plano do usuário "Plano de Refatoração Visual — Sistema de Estoque" (19/10/2026), com quatro referências do Dribbble (2, 3, 6 e 7 — análise em `research.md`).

## Problema

A primeira rodada de UI/UX (`docs/ui-ux/`, Fases 1–9) resolveu **coerência**: um primitivo de modal, uma gramática de operação, tokens semânticos com enforcement no lint. O que ela não resolveu — e deliberadamente não tentou — é **estrutura de produto**:

1. **O sistema é uma tela só.** `App.tsx` renderiza `ProductDashboard` e tudo o mais (histórico, ajuste, baixa, edição) vive em modais empilhados sobre a lista. Não há URL para "este produto" nem para "o histórico de hoje"; não dá para compartilhar, voltar ou abrir em outra aba.
2. **Não existe visão geral.** Quem abre o sistema cai direto numa tabela de 50 linhas. Perguntas como "quanto entrou e saiu hoje?", "o estoque está subindo ou caindo?" e "o que precisa de reposição agora?" não têm resposta sem varrer páginas.
3. **O histórico é por produto, nunca do estoque.** Só existe histórico dentro do modal de um produto (`MovementHistoryModal`) e um histórico global de **saídas** (`QuickOutHistoryModal`). Não há como auditar "tudo que aconteceu ontem" nem "tudo que fulano lançou".
4. **A aparência é de ferramenta interna**, não de produto. Para um projeto de portfólio, o primeiro contato visual pesa — e hoje ele é um cabeçalho com e-mail e uma tabela.

## Objetivo

Transformar o SimpleStock num **SaaS empresarial moderno**: navegação persistente por domínio, um dashboard que funciona como central operacional, uma página por produto, uma movimentação guiada e um histórico de auditoria — **sem perder nenhuma capacidade que existe hoje** e sem mudar nenhuma regra de negócio.

Na síntese do plano: *Warehouse Insights na aparência + Inventory Dashboard na operação + ERP Dashboard na arquitetura.*

## Escopo — decidido com o usuário em 19/10/2026

**Dentro:**

- Novo design system (evolução dos tokens da Fase 5: raio, superfícies, sidebar, escala de números, estados).
- App shell com sidebar, cabeçalho e rotas reais (URL por tela).
- Telas: Dashboard, Produtos, Produto (página própria), Nova movimentação, Histórico de movimentações.
- **Endpoints novos somente de leitura** que essas telas exigem: histórico geral de movimentações (todos os produtos, com filtros) e agregados do dashboard/produto (contagens do dia e série de saldo por dia). **Nenhuma mudança de schema, nenhuma migration.**

**Fora (cada item vira feature própria, com IDEA própria, quando for priorizado):**

| Item do plano | Por que fica fora |
|---|---|
| Categorias (filtro, coluna, tela) | `Product` não tem categoria — exige schema |
| Estoque máximo (barra de capacidade) | `Product` só tem `minStock` — exige schema |
| Foto do produto | Exige upload/armazenamento |
| Nome do usuário ("Bom dia, Leonardo", "João Silva") | `User` só tem e-mail — exige schema. Saudação fica sem nome; responsável aparece por e-mail (risco #7 já aceito) |
| Motivo fixo (Compra / Devolução / Transferência) | `StockMovement.note` é texto livre — exige schema. A observação continua livre |
| Telas de Usuários, Relatórios e Configurações | Não existe backend para nenhuma; RBAC inexiste (ver `current-state.md`) |
| Exportação do histórico | O próprio plano marca como "futura" |

**Regra da sidebar:** ela mostra **só telas que existem**. Nenhum item "em breve", nenhum link morto. Quando Integrações (webhooks, branch pausada) ganhar UI, ela entra em **Administração** — é a primeira tela desse grupo.

## Usuários

- **Quem opera o estoque no dia a dia** (desktop, várias vezes por dia): precisa localizar produto, lançar entrada/saída e confirmar o efeito — rápido e sem erro.
- **Quem acompanha** (gestor, uso esporádico): abre o dashboard para saber se há algo a resolver, e o histórico quando um número não bate.
- **Quem está no estoque físico** (celular): baixa rápida e consulta de saldo continuam sendo o caso de uso móvel (paridade da Fase 8 permanece válida).

Não há papéis hoje: todos veem e fazem tudo.

## Arquitetura de informação proposta

```text
SimpleStock                          [ + Nova movimentação ]

VISÃO GERAL
  Dashboard                          /
OPERAÇÃO
  Produtos                           /produtos
  Movimentações                      /movimentacoes   (Todas · Entradas · Saídas · Ajustes)
ESTOQUE
  Estoque baixo  (contador)          /produtos?status=baixo
  Sem estoque    (contador)          /produtos?status=sem-estoque
──────────────
admin@simplestock.local   [Sair]
```

- **Página de produto** (`/produtos/:id`) não é item da sidebar: chega-se a ela pela lista, pelo dashboard e pelo histórico. O item ativo continua "Produtos".
- **Entradas e Saídas viram abas de Movimentações**, não itens próprios. No plano elas aparecem em "Operação" e o Histórico em "Análises"; no nosso domínio as três são **a mesma lista de `StockMovement` com filtro diferente**. Três itens de menu para uma tela só fariam o "item ativo" mentir. *Decisão para aprovação (D1 em `prototype.md`).*
- **"Estoque atual"** do plano é a própria lista de Produtos (saldo é coluna) — não ganha item separado.
- **"Estoque baixo"** e **"Sem estoque"** ficam: são recortes com contador, os atalhos mais acionáveis do sistema. Cada um é exatamente uma aba da lista de Produtos (`Todos · Em estoque · Estoque baixo · Sem estoque`, uma partição — nenhuma aba contém outra), então o contador da sidebar e o da aba são sempre o mesmo número. O termo guarda-chuva **"Precisam de reposição"** (baixo + sem estoque) existe só no dashboard, onde aparece com a divisão explícita.

## Fluxos desejados

1. **Abrir o sistema** → Dashboard: KPIs (produtos, unidades, precisam de reposição, movimentações hoje), evolução do saldo em 30 dias, distribuição por status, produtos para repor e atividade recente.
2. **Repor um produto a partir do dashboard** → "Repor" na linha → Nova movimentação já em *Entrada* e com o produto escolhido.
3. **Encontrar um produto** → Produtos: busca, abas com contagem (Todos · Estoque baixo · Sem estoque), ordenação, paginação com total.
4. **Ver um produto** → clique na linha → página do produto: saldo atual × mínimo, evolução em 30 dias, últimas movimentações, ações (editar, movimentar, ajustar, baixa rápida, zerar, excluir).
5. **Movimentar** → Nova movimentação (painel lateral): tipo *Entrada/Saída* **sem pré-seleção** quando a intenção não vem do contexto, produto, quantidade, `saldo atual → saldo após`, observação, botão que nomeia a consequência.
6. **Auditar** → Movimentações: filtros por busca, produto, responsável, tipo e período; agrupado por dia; cada linha com `antes → depois`.

## Regras

- **Nenhuma regra de negócio muda.** Saldo derivado de movimentações, saída nunca negativa (lock + transação no `StockService`), ajuste por saldo alvo com 409, hard delete com cascata, lote não atômico — a interface **expressa** essas regras, nunca as altera.
- **Nenhuma capacidade some.** Toda ação que existe hoje (ver `docs/ui-ux/parity-matrix.md` e o contrato de 20 comportamentos de `user-flows.md` §9.3) continua acessível, em desktop e no celular. O que mudar de lugar é registrado.
- **Gramática de operação da Fase 4 continua valendo** (`design-direction.md` §4.2): contexto → intenção → quantidade → preview → confirmação → feedback; escada de cerimônia N1/N2/N3; vermelho pleno só no instante da decisão destrutiva; direção sempre com sinal textual (`+12`, `−5`), nunca só cor.
- **D2 da Fase 4 é preservada no novo formato:** o seletor `[ Entrada ] [ Saída ]` do plano não nasce com uma opção marcada quando a pessoa chega sem intenção declarada — a ambiguidade que a D2 eliminou (UF-21) não volta. Quando a intenção vem do contexto ("Repor" → Entrada), ela já chega marcada e o título afirma.
- **Um único primitivo de diálogo.** O painel lateral (drawer) é uma terceira variante do `Modal` (`dialog` · `sheet` · `drawer`), como a `sheet` já é. Nada de segundo sistema de overlay.
- **Dado remoto só via React Query**; rotas novas do backend com Zod em query params e `requireAuth`, testadas antes (TDD).
- **Acessibilidade como gate de aprovação de cada tela** (checklist do plano §14): contraste AA, teclado, foco visível, labels, estados não dependentes só de cor, erros anunciados.

## Erros e estados esperados

- Toda tela nova tem os cinco estados: **carregando** (skeleton com a mesma altura), **vazio** (com próxima ação), **erro** (específico, com tentar de novo), **sem resultado para o filtro** (com limpar filtro) e **conteúdo**.
- API fora do ar continua com o `ApiStatusBanner`.
- Produto inexistente em `/produtos/:id` (excluído, link velho) → estado "produto não encontrado" com volta para a lista, nunca tela em branco.

## Fora do escopo (nesta feature)

Além da tabela de escopo acima: tema escuro completo da aplicação (a sidebar escura não é "dark mode"), internacionalização, PWA/offline, notificações em tempo real, qualquer otimização de performance do backend além do necessário para os endpoints novos responderem rápido no volume atual.

## Questões deliberadamente deixadas para RESEARCH

1. Como as quatro referências se traduzem em princípios — o que cada uma tem que funciona e o que não serve para o nosso domínio.
2. Biblioteca de rotas.
3. Gráficos: biblioteca ou SVG próprio.
4. Sidebar clara ou escura (o plano deixa em aberto).
5. Como os tokens da Fase 5 evoluem (o que muda, o que fica, e o que acontece com o enforcement do lint da Task 27).
6. Forma dos endpoints de leitura (um endpoint de histórico geral + agregados) e como calcular a série de saldo por dia sem coluna de saldo.

## Riscos registrados

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Refatoração visual arrastar mudança de regra de negócio | Média | Regras acima são intocáveis; testes de backend existentes como rede |
| Perder capacidade ao trocar modais por páginas | **Alta** | Matriz de paridade atualizada é entregável do PRD; testes de caracterização antes de mover cada fluxo |
| "Moderno" sem identidade — SaaS genérico | Média | Identidade vem de gramática + números + contraste da sidebar, não de ornamento (ver `research.md`) |
| Escopo crescer com itens "só visuais" que exigem dado | **Alta** | Tabela "Fora" acima; qualquer item novo precisa dizer de onde vem o dado |
| Série de saldo por dia ser cara de calcular | Baixa no volume atual | Decisão de cálculo em RESEARCH; medir com o seed de 50 produtos |
| Webhooks pausado divergir do master | Média | A branch de webhooks é rebaseada depois do merge desta; Integrações nasce no shell novo |
