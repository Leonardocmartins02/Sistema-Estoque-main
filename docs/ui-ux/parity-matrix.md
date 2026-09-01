# Tabela de paridade desktop ↔ mobile — **primeira versão**

Entregável da **Task 16** (`implementation-plan.md`, Definição de pronto). A versão
**assinada e definitiva** é entregável da **Task 28**, que a preenche contra QA
manual em todas as larguras (375, 600, 767, 768, 900, 1024, 1440, 1920px).

- **Especificação** (o que *deve* existir): `design-system.md` §15.1.
- **Este documento** (o que *foi verificado existir*, com evidência): estado após as Tasks 13–16.

## Como ler

**Paridade é de capacidade, não de apresentação.** Desktop usa `ProductsTable`,
mobile usa `ProductCardList` — layouts diferentes com as mesmas capacidades. Uma
diferença de superfície só é regressão quando **remove capacidade sem decisão
registrada**. As diferenças deliberadas aparecem como `DIFERENÇA DECLARADA`, com a
decisão que as autoriza.

| Status | Significado |
|---|---|
| `PASS` | Capacidade presente nas duas superfícies, com evidência concreta |
| `DIFERENÇA DECLARADA` | Superfícies diferem **por decisão explícita do plano** — não é regressão |
| `AUSÊNCIA ASSINADA` | Capacidade deliberadamente ausente numa superfície, com decisão registrada |
| `NÃO PROVADO` | Implementado, mas sem evidência automatizada ou QA que o comprove |

Evidências citam teste, contrato de task, QA manual medido ou componente.

## Matriz

| # | Capacidade | Desktop | Mobile | Paridade esperada (§15.1) | Evidência | Status | Observação |
|---|---|---|---|---|---|---|---|
| 1 | Busca | Inline na zona de controle | Inline, mesma zona | Inline nas duas | PD-6 (`ProductDashboard.characterization`) | `PASS` | Um único campo serve as duas superfícies |
| 2 | Filtro por status | `StatusFilterMenu` no cabeçalho da coluna | Sheet "Filtrar e ordenar" com contador | Menu / Sheet com contador | SFM-1 (3 opções, `aria-checked`); QA 320px: sheet com 3 status | `DIFERENÇA DECLARADA` | Task 16: superfícies distintas, mesma capacidade |
| 3 | Remover filtro individual | Chip removível | Chip removível (mesmo componente) | Chip nas duas | QA 320px: chips "Estoque baixo" e "Sem estoque" com `sr-only` "Remover filtro X" | `PASS` | Chips vivem fora de qualquer wrapper de largura |
| 4 | Limpar filtros | Chip + "Limpar filtros" + item no menu | "Limpar filtros" fora **e** dentro da sheet | "na sheet e fora dela" | Teste `limpar o filtro é alcançável e realmente limpa, sem depender da largura`; SFM-2; QA 320px round-trip completo | `PASS` | Fecha UF-07/UF-41 |
| 5 | Ordenação por Nome | Controle no cabeçalho "Produto" | Sheet | Cabeçalho / Sheet | PT-4; T13-SD1; QA 320px (sheet lista "Ordenar por Nome") | `DIFERENÇA DECLARADA` | T13-SD1 |
| 6 | Ordenação por SKU | Controle no cabeçalho "Produto" | Sheet | Cabeçalho / Sheet | PT-4 (`onTogglePrimarySort('sku')`); T13-SD1 | `DIFERENÇA DECLARADA` | SKU perdeu coluna própria (Task 13) |
| 7 | Ordenação por Saldo | Cabeçalho "Saldo Atual" | Sheet | Cabeçalho / Sheet | Teste `a ordenação do mobile envia os mesmos sortBy/sortDir do desktop`; QA 320px | `PASS` | — |
| 8 | Direção da ordenação | Indicador + `sr-only` no controle ativo | Texto "crescente/decrescente" no critério ativo | Direção legível | Teste `o controle ativo identifica critério E direção`; QA: "Ordenar por Saldo crescente" | `PASS` | Não depende só de cor/ícone |
| 9 | Contrato de ordenação global | Server-side, antes da paginação | **O mesmo** — sem segundo caminho | Mesmo contrato | `sorting.globalContract.test.tsx` (13); **QA 320px: pág. 2 continua `0,0,0,0,1,1,3,3,3,5`** | `PASS` | D-A: a ordenação do mobile é honesta |
| 10 | `aria-sort` único | `<th>` da coluna primária | n/a (sem tabela) | Só primária | Teste `aria-sort só na coluna primária`; T13-SD1 | `DIFERENÇA DECLARADA` | Semântica de tabela não existe em cards |
| 11 | Paginação | Depois da tabela | Depois da lista | Depois da lista | Teste `a paginação é renderizada depois da lista e informa o total`; QA 320/375/767px | `PASS` | Corrige C-4 |
| 12 | Total de produtos | "Página X de Y · N produtos" | Idem (mesmo `<nav>`) | — (novo na Task 16) | QA: "Página 1 de 6 · 51 produtos" | `PASS` | `formatQuantity` (Task 2) |
| 13 | Nome | Coluna Produto | Card | Presente nas duas | PT-1; PCL-1 | `PASS` | — |
| 14 | SKU | Sob o nome | Sob o nome | Presente nas duas | PT-1; PCL-1; Task 13 (SKU copiável, `user-select: auto`) | `PASS` | — |
| 15 | Saldo atual | Coluna, tabular | Card, tabular | Inline no card | PT-1; PCL-1; QA `tabular-nums` medido | `PASS` | — |
| 16 | Estoque mínimo | Pareado ao saldo | Pareado ao saldo | Inline no card, pareado | Teste `o estoque mínimo é legível na linha`; teste `o estoque mínimo é legível no card` | `PASS` | Fecha C-5/UF-23 |
| 17 | Status | Badge na coluna | Badge no card | Inline no card | PT-2; PCL-2 | `PASS` | Vocabulário único (Task 14) |
| 18 | Vocabulário de status | Em estoque / Estoque baixo / Sem estoque | Idênticos | Mesmas palavras | PT-2; PCL-2; SFM (filtro) | `PASS` | Tabela + card + filtro alinhados |
| 19 | Movimentar | Botão PRIMARY na linha | Botão PRIMARY no card | PRIMARY nas duas | PT-7; PCL-3 | `PASS` | — |
| 20 | Baixa rápida | Atalho neutro na linha | **Overflow** do card | Presente no card | PT-7 (desktop); teste `a baixa rápida é alcançável a partir do card`; teste `o menu do desktop NÃO repete a baixa rápida` | `DIFERENÇA DECLARADA` | P-1 + decisão de superfície (Task 15): `onQuickOut` opcional |
| 21 | Editar | Overflow | Overflow | Overflow nas duas | `ProductActionsMenu.test.tsx` (PAM-1) | `PASS` | — |
| 22 | Ver Histórico | Overflow | Overflow | Overflow nas duas | PAM-1; teste de identidade `fetchMovements('p2')` | `PASS` | — |
| 23 | Ajustar Estoque | Overflow | Overflow | Overflow nas duas | `ProductActionsMenu.test.tsx` | `PASS` | Habilitado mesmo com saldo zero |
| 24 | Zerar Estoque | Overflow, após separador | Overflow, após separador | Após separador | `ProductActionsMenu.test.tsx`; Task 12 | `PASS` | Desabilitado sem saldo |
| 25 | Excluir (item) | Overflow, após separador | Overflow, após separador | Após separador | `ProductActionsMenu.test.tsx`; Task 12 | `PASS` | — |
| 26 | Separador destrutivo | `role="separator"`, fora da navegação | Idem (mesmo componente) | — | `MenuPopover.test.tsx`; QA Task 12 (3× ArrowDown não para nele) | `PASS` | — |
| 27 | Seleção múltipla | Checkbox por linha | **Ausente** | Ausente no mobile | PT-5 (desktop); `ProductCardList` não renderiza checkbox | `AUSÊNCIA ASSINADA` | §15.1 + Task 15: decisão, não defeito |
| 28 | Ações em lote | Barra contextual dentro do ramo da tabela | **Ausentes — não renderizadas** | Ausentes no mobile | Teste `as ações em lote pertencem ao ramo da tabela, não ao dos cards`; QA 320/375/767px: `[data-surface="table"]` com `display:none` | `AUSÊNCIA ASSINADA` | Fecha N-3: ausência, não desabilitação |
| 29 | Ações destrutivas de página | Região rotulada no rodapé da tabela | Ausentes (seguem a tabela) | — | `role="region"` + `aria-label="Ações destrutivas da página"` | `AUSÊNCIA ASSINADA` | Acompanham a superfície de seleção |
| 30 | Ordenação secundária (Shift+clique) | **Não oferecida** | **Não oferecida** | Não oferecida | `sorting.globalContract.test.tsx` — "Shift+clique não é mais oferecido" | `AUSÊNCIA ASSINADA` | D-D/UF-08: era invisível e enganosa; retorna só com suporte server-side e precedência visível |
| 31 | Estado vazio — "nada cadastrado" | Texto + "Adicionar Produto" | Texto + "Adicionar Produto" | Distingue a causa | Desktop: teste `sem filtro ativo, o vazio nomeia "nada cadastrado"`. Mobile: **código** (`ProductCardList`), sem teste | `NÃO PROVADO` (mobile) | Ver Lacunas |
| 32 | Estado vazio — "filtro sem resultado" | Texto + "Limpar filtros" | Texto + "Limpar filtros" | Distingue a causa | Desktop: teste `com filtro ativo, o vazio nomeia a busca/filtro`. Mobile: **código**, sem teste | `NÃO PROVADO` (mobile) | Ver Lacunas |
| 33 | Estado vazio anunciado | `role="status"` (DataTable) | `role="status"` (card) | A-12ʳ | Desktop: teste `estado vazio é anunciado`. Mobile: `ProductCardList.tsx:59`, sem teste | `NÃO PROVADO` (mobile) | Ver Lacunas |
| 34 | Erro / carregando anunciados | `role="alert"` / `role="status"` | `role="alert"` / `role="status"` | Nas duas | `DataTable.test.tsx`; PCL-5 | `PASS` | — |
| 35 | Alvos de toque ≥ 44×44 | n/a (densidade D5) | Card e overflow a 44×44 | 44×44 no mobile | QA 320px: "Movimentar" 187×44, overflow 44×44; 375px: 242×44 e 44×44 | `DIFERENÇA DECLARADA` | §15.2 regra 4: densidade é do desktop |
| 36 | Sem scroll horizontal | — | — | Nenhuma largura | QA medido: 320px `305/305`; 375px `360/360`; 767px `752/752` | `PASS` | Bug de 320px do card resolvido na Task 15 |
| 37 | Cards usam a largura disponível | n/a | Largura do shell, gutter 16px | D-B | QA 320px: card 272,8 = conteúdo do `main`; 375px: 328 = 328 | `PASS` | — |
| 38 | Zona de controle na calha do shell | Alinhada a header e tabela | Mesmo container | D-B | QA 1536px: header/controle/dados todos em **32px** | `PASS` | — |
| 39 | Transição em `md` (falha segura) | Tabela ≥768px | Cards <768px | P-5 | QA 767px: tabela `display:none`, cards `block`, sheet disponível | `PASS` | Janela de desktop com barra clássica cai em cards |
| 40 | Sheet acessível | n/a | `role="dialog"`, `aria-modal`, nome, ancorada na base | Variante do `Modal` | QA 320px medido; Task 9 (focus trap/Escape do Radix) | `PASS` | Sem segundo sistema de overlay |

## Lacunas desta primeira versão

| # | Lacuna | Por que ficou aberta |
|---|---|---|
| 31–33 | Estados vazios do **card** (duas causas + `role="status"`) sem teste automatizado | A Task 15 implementou as duas ramificações e o `role`, mas os testes novos que ela lista não incluíam estado vazio; a Task 16 não os lista. Implementação existe (`ProductCardList.tsx`), evidência automatizada não. Candidata natural à Task 28 ou a um teste próprio |
| — | QA em **600px, 900px, 1024px** e **viewport baixo (375×568)** | Fora do escopo de QA da Task 16 (que pede 320/375/baixo/~768/1440/1920). Cobertura completa é critério da **Task 28** |
| — | Inspeção **visual** (screenshot) das superfícies mobile | Captura via iframe vem dando timeout de renderer neste ambiente; as medições acima são de DOM real (geometria), não de olhar a tela |
| — | Botão "Fechar" do `Modal` a 24px de altura | Atende o piso absoluto de 24×24, não os 44×44 do mobile. É o primitivo da Task 9, compartilhado com o desktop — fora do escopo da Task 16 |

## Método das evidências

- **Testes**: suíte frontend em `d424fed` — 33 arquivos, 268 testes, 0 falhas.
- **QA manual**: navegador real, aplicação autenticada. `resize_window` está inoperante
  neste ambiente, então as larguras foram obtidas por **iframe same-origin** — técnica
  já usada nas Tasks 10, 11 e 15. Medições por `getBoundingClientRect`/`getComputedStyle`,
  não por leitura de `className`.
- **Não** foram marcados `PASS` por inferência: onde só existe código, o status é `NÃO PROVADO`.

## Revisão

Escopo desta versão: estado após as Tasks 13–16, no commit `d424fed`.

**Status da revisão:** AGUARDANDO REVISÃO DO RESPONSÁVEL

**Responsável pela aprovação:** Leonardo

**Assinatura/aprovação:** PENDENTE

**Data da aprovação:** —

**Anexo ao PR:** PENDENTE — nenhum PR existe neste checkpoint; o projeto vem sendo
enviado diretamente para `master`. Este documento fica pronto para ser anexado ou
referenciado caso o responsável decida abrir PR.
