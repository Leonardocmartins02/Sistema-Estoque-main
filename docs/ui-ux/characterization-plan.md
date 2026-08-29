# Task 0 — Plano de Characterization Tests

**Data:** 28/08/2026
**Escopo:** planejamento. **Nenhum teste escrito, nenhum código alterado, nenhum CSS tocado.**
**Baseline:** onda 0/1 do Bugfix Gate concluída — F-06 (`aea7b0e`), F-07 (`23e6b14`), C-3 (`209a98d`), C-2 (`088b717`), F-04+F-08 (`981bf80`), UF-04 (`d3f1ab0`). F-10 registrado (`4f37adb`).
**Fontes:** `audit.md`, `user-flows.md` (§9.3 — contrato de 20 comportamentos), `design-direction.md`, `design-system.md` (§14, §15, §18), `prototype.md` (§14), `bugfix-gate.md` (§4), conferidos **linha a linha contra o código atual**.
**Revisão técnica:** Codex (read-only, sem permissão de alteração). Achados verificados um a um contra o código; incorporados em §14.

---

## 0. O que este plano decide

Um characterization test responde:

> *"Se eu mudar a estrutura visual deste componente amanhã, quais comportamentos precisam continuar funcionando?"*

Não responde *"como o DOM está escrito hoje"*. Essa distinção governa cada linha deste documento e é o que separa as quatro classificações:

| Classificação | Significado | Vira teste? |
|---|---|---|
| **PRESERVAR** | Capacidade real do produto. A migração pode reescrever o DOM inteiro, mas isto tem que continuar verdadeiro | **Sim** — é o characterization |
| **ALTERAR INTENCIONALMENTE** | Vai mudar por decisão registrada nas Fases 4–6. Congelar seria travar o alvo | **Não.** Documentado para que a mudança não seja lida como regressão |
| **BUG — NÃO CONGELAR** | Comportamento atual errado. Escrever teste aqui transformaria bug em contrato | **Não.** Lista fechada em §12 |
| **NÃO RELEVANTE PARA MIGRAÇÃO** | Detalhe de implementação, aparência ou timing sem consequência funcional | **Não** |

**Critério de pronto da Task 0:** a suíte passa **verde contra o código atual, sem alterá-lo**. Um teste que exija mudar o produto para passar não é caracterização — é requisito novo, e pertence à Fase 8.

---

## 1. Rede de testes já existente — o que **não** precisa ser reescrito

`packages/frontend/test/` — 18 arquivos, 90 testes verdes. Parte já cumpre função de characterization e **não deve ser duplicada**:

| Arquivo | Testes | Cobre | Status |
|---|---|---|---|
| `QuickOutModal.test.tsx` | 5 | Contrato de erro da API (F-07); erro renderizado **uma** vez (C-3) | **Reaproveitar** — com um ajuste de fragilidade (§14, A-5) |
| `MovementHistoryModal.test.tsx` | 6 | `ADJUSTMENT` completo (`previous → new`, delta assinado, motivo, responsável); degradação de registro legado; "Usuário não disponível"; filtro repassado à API; não-regressão IN/OUT | **Reaproveitar** — com um ajuste de fragilidade (§14, A-6) |
| `ProductActionsMenu.test.tsx` | 4 | Ordem das ações; `onAdjust`; "Ajustar" com saldo zero; "Zerar" desabilitado e "Excluir" destrutivo | **Reaproveitar** + 1 complemento |
| `ProductDashboard.test.tsx` | 2 | Seleção limpa ao **paginar** (F-04); `mutate` antes de `setPage` (F-08) | **Reaproveitar** — cobre menos do que eu havia afirmado (§14, A-9) |
| `Modal.test.tsx` | 6 | `role="dialog"`, `aria-modal`, id único, foco entra e retorna, Escape, botão fechar acessível | **Reaproveitar como alvo** — é o contrato que os `QuickOut*` passarão a cumprir |
| `MenuPopover.test.tsx` | 7 | Padrão WAI-ARIA de menu completo | **Reaproveitar.** Primitivo MANTER |
| `DataTable.test.tsx` | 2 | Sem paradas de tab vazias; erro/carregando anunciados | **Reaproveitar.** Torna redundante testar erro/carregando em `ProductsTable` |
| `AuthContext.test.tsx` | 3 | Expiração de sessão | Fora do raio da migração visual |
| `AdjustmentFormModal.test.tsx` | 24 | Fluxo de ajuste completo | **ADAPTAR** só por tokens. Cobertura suficiente |

**Consequência:** dos 9 componentes obrigatórios, **4 já têm rede** e **5 têm cobertura zero** — `QuickOutListModal`, `QuickOutHistoryModal`, `ProductsTable`, `ProductCardList`, `StatusFilterMenu`. São exatamente os marcados **MIGRAR** ou **ADAPTAR com mudança estrutural** na §18 do Design System.

---

## 2. `QuickOutModal` — **MIGRAR**

Contrato §9.3 itens 1–10. Após C-2 o componente **não tem nenhum gerenciamento de foco**.

| # | Comportamento | Classificação | Teste proposto | Por que precisa ser protegido |
|---|---|---|---|---|
| QOM-1 | `Escape` fecha o diálogo | **PRESERVAR** | `Escape` → `onOpenChange(false)` | Único dos três `QuickOut*` em que Escape funciona; a migração generaliza, não pode perder |
| QOM-2 | `Enter` num campo de texto submete | **PRESERVAR** | Enter no input de quantidade → API chamada 1× | Atalho de operação repetitiva |
| QOM-3 | `Enter` **dentro do `<textarea>`** não submete | **PRESERVAR** | Enter no textarea → API não chamada | Sem isso é impossível escrever observação de duas linhas |
| QOM-4 | `Enter` durante `isSubmitting` não re-submete | **PRESERVAR** | Submit lento + Enter → API chamada 1× | Proteção contra **baixa duplicada** — consequência de dados |
| QOM-5 | Interagir fora do diálogo fecha; dentro, não | **PRESERVAR** | Efeito observável apenas — sem depender do nó de overlay nem de `data-testid` | Capacidade de saída; a estrutura do Radix é outra |
| QOM-6 | Atalhos 1 · 5 · 10 · 25 · 50 definem a quantidade, com `aria-pressed` no ativo | **PRESERVAR** | Clicar em "25" → input vale 25 e só esse botão tem `aria-pressed=true` | Atalhos reais de operação; o estado precisa continuar audível |
| QOM-7 | Preview `Saldo Atual → Novo Saldo` recalcula a cada tecla | **PRESERVAR** | Digitar 3 com saldo 10 → preview mostra 7 | "A melhor ideia de interação do produto" (`design-direction.md` §4.2) |
| QOM-8 | Ação primária desabilitada com quantidade ≤ 0 | **PRESERVAR** | Quantidade 0 → botão `disabled` | Impede submit inválido |
| QOM-9 | O payload enviado carrega `productId`, `quantity` e `note` | **PRESERVAR** | Preencher e submeter → API recebe os três campos corretos | **Lacuna do rascunho anterior.** É o dado; toast e fechamento não o protegem |
| QOM-10 | Sucesso fecha o modal, dispara `onSuccess` e anuncia a quantidade | **PRESERVAR** | Três asserts | Invalidação da lista depende do `onSuccess`. O **texto** do toast ganha o novo saldo (§4.2) — o teste afirma a quantidade, não a frase |
| QOM-11 | Falha mantém o modal aberto com os valores digitados | **PRESERVAR** | Erro → modal presente, quantidade preservada, novo submit possível | Sem isso, a pessoa redigita tudo após um 422. Nenhum teste cobre hoje |
| QOM-12 | "Cancelar" fecha sem chamar a API | **PRESERVAR** | Clicar → `onOpenChange(false)`, API não chamada | Backdrop e Escape não substituem o controle explícito |
| — | Mensagem de erro da API chega ao usuário | **PRESERVAR** | *(já coberto — F-07)* | Teste de requisito, sobrevive à migração |
| — | Erro renderizado uma única vez | **PRESERVAR** | *(já coberto — C-3)* | — |
| — | `max` do input = `saldo × 2` | **ALTERAR INTENCIONALMENTE** | — | F-01 **decidido** (29/08/2026, `bugfix-gate.md` §7 G-3): a interface passa a **impedir** — quantidade não pode ultrapassar o saldo; o `max` deixa de permitir o dobro |
| — | Rótulo "Estoque zerado" quando o novo saldo é 0 | **ALTERAR INTENCIONALMENTE** | — | Idem F-01: o rótulo é substituído por impedimento de confirmação com feedback claro. Nunca representar a quantidade impossível apenas como "Estoque zerado" |
| — | Rótulo "Estoque negativo" | **BUG — NÃO CONGELAR** | — | **Código morto (N-4).** `Math.max(0, …)` na linha 53 impede `newBalance < 0`; o ramo nunca renderiza |
| — | Listener de teclado global no `window`, ativo fora do modal | **BUG — NÃO CONGELAR** | — | Intercepta Enter da página inteira. O trap do Radix o torna desnecessário |
| — | Sem `role="dialog"`, `aria-modal`, `aria-labelledby` | **BUG — NÃO CONGELAR** | — | C-1. Alvo = contrato de `Modal.test.tsx` |
| — | Sem focus trap e sem retorno de foco ao gatilho | **BUG — NÃO CONGELAR** | — | C-1 |
| — | Nenhum campo recebe foco ao abrir | **BUG — NÃO CONGELAR** | — | **Não escrever teste que exija ausência de autofoco** |
| — | Campo de quantidade sem `<label>` associado | **BUG — NÃO CONGELAR** | — | Achado do review (N-8) |
| — | Preview e erro não anunciados nem associados ao campo | **BUG — NÃO CONGELAR** | — | Sem `role="status"`/`alert` nem `aria-describedby` |
| — | Ajuda "Máx. 255 caracteres" | **BUG — NÃO CONGELAR** | — | **N-1:** não validado no Zod do frontend, nem no do backend, nem no Prisma |
| — | Realce transitório de 250ms no preview | **NÃO RELEVANTE** | — | Motion re-especificada em §16 do Design System |

**Testes novos: 12.**

> **`Shift+Enter` foi removido do contrato.** O listener apenas *ignora* o atalho — não cancela o submit nativo do `<form>`. Em navegador real, Enter num input de texto submete independentemente do Shift; o jsdom não faz submissão implícita, então um teste aqui afirmaria algo que só é verdade no ambiente de teste. Achado do review (A-3).

---

## 3. `QuickOutListModal` — **MIGRAR**

Contrato §9.3 itens 11–17. Cobertura atual: **zero**.

| # | Comportamento | Classificação | Teste proposto | Por que precisa ser protegido |
|---|---|---|---|---|
| QOL-1 | O campo de busca recebe foco ao abrir | **PRESERVAR** (capacidade) | Ao abrir, a busca tem foco | Testar *"a busca tem foco"*, **não** *"tem atributo `autoFocus`"* — o Radix usará outro mecanismo |
| QOL-2 | Digitar na busca refaz a consulta com o termo | **PRESERVAR** | `fetchProducts` recebe o termo | Caminho principal de localização |
| QOL-3 | Clique na linha seleciona o produto | **PRESERVAR** | Clicar na célula do nome → `onPick(produto)` | Alvo grande e deliberado; a migração não pode reduzi-lo a um botão pequeno |
| QOL-4 | Ordenar por Nome / SKU / Saldo alterna asc↔desc | **PRESERVAR** | 2 cliques → `sortDir` alterna na chamada da API | — |
| QOL-5 | Ordenar reseta para a página 1 | **PRESERVAR** | Ir para página 2, ordenar → API recebe `page=1` | Sem isso a pessoa ordena e cai numa página vazia |
| QOL-6 | Cada produto expõe Nome, SKU, Saldo, **Mín. Estoque** e Status | **PRESERVAR** | Os cinco dados presentes | Hoje é a **única** tela com saldo e mínimo juntos (C-6). Testar os **dados**, nunca a ordem das colunas |
| QOL-7 | Contador de itens reflete o total da API | **PRESERVAR** | `total=42` → texto contém 42 | Noção de escala do resultado |
| QOL-8 | Próxima/Anterior pedem a página certa à API e desabilitam nos limites | **PRESERVAR** | Clicar "Próxima" → API recebe `page=2`; página 1 → "Anterior" desabilitado | Testar a **chamada**, não só o estado `disabled` |
| QOL-9 | "Histórico de Baixas" abre o histórico **sem fechar** a lista | **PRESERVAR** (a capacidade) | `onOpenHistory` chamado e `onOpenChange(false)` **não** chamado | Chegar ao histórico a partir da lista é capacidade. **A forma fica em aberto** — ver ressalva abaixo |
| QOL-10 | Interagir fora fecha; o botão "Fechar" fecha | **PRESERVAR** | Dois asserts | Controle explícito não é substituível por backdrop |
| — | **Escape não fecha** | **ALTERAR INTENCIONALMENTE** | — | Passará a fechar; congelar travaria a inconsistência UF-24 |
| — | Dois overlays irmãos simultâneos | **ALTERAR INTENCIONALMENTE** | — | Ver ressalva |
| — | A linha **não é alcançável por teclado** (`<tr onClick>` sem `role`/`tabIndex`) | **BUG — NÃO CONGELAR** | — | Selecionar produto é impossível sem mouse. Congelar seria assinar a exclusão de quem usa teclado |
| — | Tabela clipada sem rolagem no mobile (`overflow-hidden`) | **BUG — NÃO CONGELAR** | — | UF-29 |
| — | `return null` antes de 8 hooks | **BUG — NÃO CONGELAR** | — | A-12 |
| — | `fetch` manual sem cancelamento | **BUG — NÃO CONGELAR** | — | F-02 |
| — | Falha da consulta é silenciosa (`try/finally` sem `catch`) | **BUG — NÃO CONGELAR** | — | **N-6:** erro de API vira "Nenhum produto disponível.", indistinguível de resultado vazio legítimo |
| — | `balance = 0` e `minStock = 0` renderiza **"Em Estoque" e "Fora de Estoque" juntos** | **BUG — NÃO CONGELAR** | — | **N-5:** `isOut` e `isOk` são ambos verdadeiros. Diverge de `productStatus()`, que prioriza `OUT` |
| — | Busca com `placeholder` e sem label | **BUG — NÃO CONGELAR** | — | B-7 |
| — | `colSpan={4}` numa tabela de **5** colunas | **BUG — NÃO CONGELAR** | — | **N-2** |
| — | Seta `▲` sem `aria-hidden` | **BUG — NÃO CONGELAR** | — | M-5 |
| — | Página fixa em 10 itens | **NÃO RELEVANTE** | — | Configuração interna sem decisão de produto. O contrato é navegar, respeitar limites e refletir o total — não o número |

**Testes novos: 10.**

> **Ressalva sobre QOL-9 (achado do review, A-7).** Hoje "sem fechar a lista" só significa dois `createPortal` irmãos, sem semântica de diálogo. Depois da migração, o mesmo comportamento produz **dois `aria-modal` ativos, dois focus traps e dois retornos de foco concorrentes** — um problema de acessibilidade, não uma capacidade. O teste protege **chegar ao histórico a partir da lista**; se a migração adotar navegação pai→filho (a lista cede o lugar) ou empilhamento explícito é decisão da Fase 8, e precisa ser declarada.

---

## 4. `QuickOutHistoryModal` — **MIGRAR**

Contrato §9.3 itens 18–20. Cobertura atual: **zero**.

| # | Comportamento | Classificação | Teste proposto | Por que precisa ser protegido |
|---|---|---|---|---|
| QOH-1 | Busca textual filtra e **reseta a página** | **PRESERVAR** | API recebe `q` e `page=1` | — |
| QOH-2 | Datas de/até filtram e resetam a página | **PRESERVAR** | API recebe `from`/`to` e `page=1` | — |
| QOH-3 | Paginação navega pedindo a página certa; contador reflete o total | **PRESERVAR** | `total=25` → contador com 25; "Próxima" → `page=2` | — |
| QOH-4 | Cada linha expõe produto, SKU, quantidade, data e observação | **PRESERVAR** | Um registro → os cinco campos legíveis | São os dados de auditoria; o layout muda, o conteúdo não |
| QOH-5 | A data é apresentada em formato brasileiro legível | **PRESERVAR** (o resultado) | Fixture com data e fuso inequívocos; asserir dia/mês/ano, **não** a string inteira | Este componente já faz certo, ao contrário do `MovementHistoryModal` (M-13). Congelar `toLocaleString('pt-BR')` seria congelar o **mecanismo** — e a string completa varia com o fuso do ambiente |
| QOH-6 | A ausência de observação é comunicada, não silenciada | **PRESERVAR** (o efeito) | `note: null` → célula não fica vazia | O caractere `-` é vocabulário de apresentação e pode virar "Sem observação" |
| QOH-7 | Interagir fora fecha; o botão "Fechar" fecha | **PRESERVAR** | Dois asserts | — |
| — | **Escape não fecha** | **ALTERAR INTENCIONALMENTE** | — | Passará a fechar |
| — | Ordenação **só da página atual**, aparentando global | **BUG — NÃO CONGELAR** | — | F-03. O efeito de busca nem depende de `sortBy` |
| — | `fetch` manual sem cancelamento | **BUG — NÃO CONGELAR** | — | F-02 |
| — | Falha da consulta é silenciosa | **BUG — NÃO CONGELAR** | — | **N-6**, mesma causa do `QuickOutListModal` |
| — | Tabela com `overflow-hidden` + `table-fixed`; busca de largura fixa `w-72` no cabeçalho | **BUG — NÃO CONGELAR** | — | **N-7:** é o **mesmo** clipping do UF-29, registrado até agora só para a lista |
| — | Busca e campos de data sem `<label>` | **BUG — NÃO CONGELAR** | — | **N-8** |
| — | `text-gray-400` no separador "até" (2,5:1) | **BUG — NÃO CONGELAR** | — | M-4, reprova WCAG AA |

**Testes novos: 7.**

> **N-9 — DECIDIDO em 29/08/2026:** o componente **preserva** filtros, busca e página entre aberturas (o estado vive fora do `if (!open)`), e isso passa a ser **PRESERVAR** — reabrir o histórico devolve a pessoa ao recorte que ela deixou, sem obrigar a refiltrar. Coberto por QOH-8, observando o efeito (o que a API recebe e o que a tela mostra), nunca o estado interno do componente.

---

## 5. `MovementHistoryModal` — **MIGRAR**

Já tem 6 testes fortes. Aqui só as **lacunas**.

| # | Comportamento | Classificação | Teste proposto | Por que precisa ser protegido |
|---|---|---|---|---|
| — | `ADJUSTMENT` com `previous → new`, delta assinado, motivo e responsável | **PRESERVAR** | *(já coberto)* | — |
| — | Registro legado sem `previous/new` degrada para quantidade crua com nota | **PRESERVAR** | *(já coberto)* | Comportamento **correto e deliberado** (§14.2 regra 5) |
| — | "Usuário não disponível" quando falta autor | **PRESERVAR** | *(já coberto)* | — |
| — | Filtro de tipo repassa o valor à API | **PRESERVAR** | *(já coberto para `ADJUSTMENT`)* | — |
| MHM-1 | Filtros **de/até** repassam à API e resetam a página | **PRESERVAR** | `fetchMovements` recebe `from`/`to` e `page=1` | Lacuna real |
| MHM-2 | Busca por observação repassa à API e reseta a página | **PRESERVAR** | Idem para `q` | Lacuna real |
| MHM-3 | Seletor de itens por página (10/20/50) muda `pageSize` e reseta a página | **PRESERVAR** | Escolher 50 → API recebe `pageSize=50`, `page=1` | Lacuna real |
| MHM-4 | Escape fecha e o foco retorna ao gatilho | **PRESERVAR** | Escape → `onOpenChange(false)`; foco de volta | Este já é acessível (Radix cru); migrar para o primitivo **não pode regredir** |
| MHM-5 | Paginação desabilitada nos limites e durante `isFetching` | **PRESERVAR** | — | — |
| MHM-6 | Estados de carregando e de erro são renderizados | **PRESERVAR** | Dois asserts | O redesenho de estados não pode deixar a tabela muda |
| — | Título não nomeia o produto | **ALTERAR INTENCIONALMENTE** | — | UF-35 |
| — | `antes → depois` só em `ADJUSTMENT` | **ALTERAR INTENCIONALMENTE** | — | UF-33: passará a valer para os 4 tipos; o dado **já chega** no payload |
| — | Saldo atual do produto ancorado no cabeçalho, imune ao filtro | *(não existe hoje)* | — | Decisão 4 — **requisito novo**, não caracterização. Pertence à Fase 8 |
| — | `INITIAL_STOCK` renderizado cru, em inglês | **BUG — NÃO CONGELAR** | — | UF-34 |
| — | Filtro de tipo não oferece `INITIAL_STOCK` | **BUG — NÃO CONGELAR** | — | F-09 |
| — | `toLocaleString()` sem locale | **BUG — NÃO CONGELAR** | — | M-13 |
| — | Estado vazio sem `role` de anúncio | **BUG — NÃO CONGELAR** | — | Os três estados são células silenciosas; só o **texto** existe |
| — | `animate-fade-in` nunca definida | **NÃO RELEVANTE** | — | M-7, sem efeito ao usuário |

**Testes novos: 6.**

---

## 6. `ProductsTable` — **ADAPTAR**

Cobertura direta: **zero**. É a tela principal do produto.

> **Regra desta seção:** proteger **capacidades**, não layout. Nenhum teste toca `className`, largura de coluna, `rounded`, ordem visual ou estrutura de `div`.

| # | Comportamento | Classificação | Teste proposto | Por que precisa ser protegido |
|---|---|---|---|---|
| PT-1 | Nome, SKU e saldo de cada produto são legíveis | **PRESERVAR** | Um produto → os três dados presentes | O redesenho funde SKU sob o nome; os **dados** permanecem |
| PT-2 | Os três status são traduzidos em rótulos distintos | **PRESERVAR** | Três fixtures → três rótulos | A **regra** é testada em PS-1; aqui se testa a **tradução em tela** |
| PT-3 | O cabeçalho ativo declara a direção da ordenação em `aria-sort` | **PRESERVAR** | Ordenar por SKU → esse cabeçalho tem `aria-sort="ascending"` | **Asserir só o cabeçalho ativo.** O `DataTable` aplica `aria-sort="none"` a *todos* os demais — ver §12 |
| PT-4 | Clicar no cabeçalho torna a coluna primária e alterna asc↔desc | **PRESERVAR** | 2 cliques → `onTogglePrimarySort` com a chave certa | — |
| PT-5 | Checkbox por linha com nome acessível dispara a seleção | **PRESERVAR** | Marcar → `onToggleSelected(id, true)` | Ação em lote depende disso; o nome acessível é o que distingue linhas |
| PT-6 | A descrição do produto pode ser revelada e recolhida, com `aria-expanded` | **PRESERVAR** (o efeito) | Acionar → descrição visível e `aria-expanded=true`; acionar de novo → recolhe | **Não** congelar "dois gatilhos, nome e SKU": o redesenho funde os dois. O contrato é *poder revelar*, não *por onde* |
| PT-7 | Movimentar e baixa rápida disparam a ação com o produto; a baixa rápida tem nome acessível | **PRESERVAR** | Dois asserts | É um botão só de ícone — sem rótulo vira controle mudo. As ações do overflow pertencem a `ProductActionsMenu` |
| PT-8 | O estado vazio customizado é renderizado | **PRESERVAR** (que exista) | Lista vazia → mensagem presente | O **texto** muda (A-10). Erro e carregando **não** entram aqui — já cobertos em `DataTable.test.tsx`, e a tabela só repassa as props |
| — | Texto exato "Nenhum produto encontrado." | **ALTERAR INTENCIONALMENTE** | — | A-10: distinguir "sem cadastro" de "filtro sem resultado" |
| — | Baixa rápida pintada de vermelho em toda linha | **ALTERAR INTENCIONALMENTE** | — | A-1: vira atalho neutro |
| — | Ordenação secundária por Shift+clique só na página atual | **ALTERAR INTENCIONALMENTE** — **e continua em aberto** | — | UF-08 |
| — | `aria-controls` aponta para id que só existe quando expandido | **BUG — NÃO CONGELAR** | — | A-7 |
| — | `aria-sort="none"` em **todos** os cabeçalhos não ordenados | **BUG — NÃO CONGELAR** | — | Achado do review (A-8). Ruído para leitor de tela |
| — | Ausência de coluna de estoque mínimo | **BUG — NÃO CONGELAR** | — | C-6: o veredito sem a evidência |
| — | Estado vazio sem `role` de anúncio | **BUG — NÃO CONGELAR** | — | Só erro e carregando têm `role` no `DataTable` |
| — | `select-none` nas células de dados | **BUG — NÃO CONGELAR** | — | A-5: impede copiar SKU |
| — | Números sem `tabular-nums` e sem separador de milhar | **BUG — NÃO CONGELAR** | — | A-6 / P-3 |
| — | Erro e carregando anunciados | **NÃO RELEVANTE aqui** | — | Já em `DataTable.test.tsx`; duplicar é redundância |
| — | Larguras percentuais, `table-fixed`, `colgroup` | **NÃO RELEVANTE** | — | Implementação |

**Testes novos: 8.**

### 6.1 · `products/types.ts` — a regra, isolada

| # | Comportamento | Classificação | Teste proposto | Por que |
|---|---|---|---|---|
| PS-1 | `productStatus()` devolve `OUT` / `ATTN` / `OK` conforme `balance` × `minStock`, **incluindo o limite `balance=0, minStock=0` → `OUT`** | **PRESERVAR** | Teste unitário puro, sem render | É **regra de negócio**. Testá-la uma vez aqui evita duplicá-la em três superfícies — e o caso-limite é exatamente onde o `QuickOutListModal` diverge (N-5) |

**Testes novos: 1.**

---

## 7. `ProductCardList` (mobile) — **ADAPTAR**

Cobertura atual: **zero**. É onde a migração mais **adiciona** — o plano precisa deixar explícito o que falta, para que a ausência não seja congelada.

| # | Comportamento | Classificação | Teste proposto | Por que precisa ser protegido |
|---|---|---|---|---|
| PCL-1 | Nome, SKU, saldo e status de cada produto | **PRESERVAR** | Um produto → os quatro dados legíveis | Conjunto mínimo para decidir sem abrir nada |
| PCL-2 | O status do card coincide com o da tabela | **PRESERVAR** | Um caso representativo (`ATTN`) | Divergir entre desktop e mobile seria pior que a ausência. Os três ramos já estão em PS-1 |
| PCL-3 | "Movimentar" dispara `onMove` com o produto | **PRESERVAR** | — | Ação PRIMARY do card (decisão 2) |
| PCL-4 | O menu de ações está presente e integrado ao card | **PRESERVAR** | Menu localizável pelo nome acessível do produto | Os callbacks internos pertencem a `ProductActionsMenu.test.tsx` |
| PCL-5 | Estados de erro e carregando têm `role` correto | **PRESERVAR** | `role="status"` e `role="alert"` | Já corretos hoje; não podem regredir |
| — | **Ausência** de baixa rápida no card | **BUG — NÃO CONGELAR** | — | C-5 / UF-23. Um teste de "não há baixa rápida no mobile" seria o pior congelamento possível deste plano |
| — | **Ausência** de estoque mínimo no card | **BUG — NÃO CONGELAR** | — | C-5. Passará a existir, pareado ao saldo |
| — | Estado vazio sem `role` de anúncio | **BUG — NÃO CONGELAR** | — | Diferente de erro/carregando, o vazio é um `Card` mudo |
| — | **Ausência** de seleção múltipla no card | **ALTERAR INTENCIONALMENTE** | — | Ausência **declarada** na tabela de paridade (§15.1) — decisão, não defeito |
| — | Card envolto em `ui/Card` com sombra | **NÃO RELEVANTE** | — | O card **passa a ser** a linha (§4.3) |

**Testes novos: 5.**

> **Nota de paridade:** PCL-1..5 + PT-1..8 formam a base contra a qual a **tabela de paridade assinada** (§15.1) será verificada na Fase 8. A paridade é o entregável; estes testes são a evidência.

---

## 8. `ProductActionsMenu` — **ADAPTAR**

Já tem 4 testes. Só a lacuna.

| # | Comportamento | Classificação | Teste proposto | Por que |
|---|---|---|---|---|
| — | Ordem/conjunto das ações; "Zerar" desabilitado sem saldo; "Excluir" destrutivo; `onAdjust` dispara | **PRESERVAR** | *(já coberto)* | O separador que a migração adiciona não quebra estes testes — separador não é `menuitem` |
| — | Gatilho com nome acessível por produto | **PRESERVAR** | *(já exercitado)* | Todos os testes existentes localizam o gatilho por `Mais ações para <produto>` |
| PAM-1 | `onEdit`, `onHistory` e `onZeroBalance` disparam com o produto | **PRESERVAR** | Um teste parametrizado | Lacuna real. `onDelete` já está coberto; a fiação é o que a migração quebra em silêncio |
| — | Ausência de separador antes do bloco destrutivo | **ALTERAR INTENCIONALMENTE** | — | UF-16 / §10 |
| — | Comportamento de teclado do menu (setas, Home/End, Escape) | **NÃO RELEVANTE aqui** | — | Já em `MenuPopover.test.tsx` |

**Testes novos: 1.**

---

## 9. `StatusFilterMenu` — **ADAPTAR**

Cobertura direta: **zero**. Entrou na migração por achado do review da Fase 5 (§22).

| # | Comportamento | Classificação | Teste proposto | Por que precisa ser protegido |
|---|---|---|---|---|
| SFM-1 | Três opções de status, múltipla seleção, estado marcado | **PRESERVAR** | Marcar duas → `onToggle` com cada valor; `aria-checked` reflete | Filtro é capacidade central; no mobile vira **sheet** e precisa continuar valendo |
| SFM-2 | "Limpar filtros" dispara `onClear` | **PRESERVAR** | Acionar → `onClear` | **É a saída do beco sem saída (UF-07).** Precisa existir depois da migração, em qualquer largura |
| SFM-3 | "Limpar filtros" desabilitado quando não há filtro ativo | **PRESERVAR** | Sem seleção → item desabilitado | — |
| SFM-4 | O gatilho anuncia a contagem de filtros ativos | **PRESERVAR** | 2 selecionados → nome acessível contém "2 ativo(s)" | A sheet mobile depende deste contador (§15.1) |
| — | Vocabulário "OK / Atenção / Em falta" | **BUG — NÃO CONGELAR** | — | **Terceiro vocabulário** para os mesmos três estados, divergente da tabela |
| — | `text-[10px]` no contador | **BUG — NÃO CONGELAR** | — | M-3 |
| — | Só existir dentro do cabeçalho da tabela (`hidden md:block`) | **BUG — NÃO CONGELAR** | — | UF-07 |

**Testes novos: 4.**

---

## 10. `ProductDashboard` — **ADAPTAR**, só o que protege a migração

Já tem 2 testes. O risco aqui é **duplicar** o que pertence aos filhos: o dashboard testa **fiação e orquestração**, nunca renderização de linha ou card.

| # | Comportamento | Classificação | Teste proposto | Por que precisa ser protegido |
|---|---|---|---|---|
| — | Seleção limpa ao **paginar** | **PRESERVAR** | *(já coberto)* | Decisão 8 |
| — | `mutate` antes de `setPage(1)` | **PRESERVAR** | *(já coberto)* | F-08 |
| PD-1 | Seleção limpa também ao **buscar** e ao **filtrar** | **PRESERVAR** | Selecionar → buscar → seleção vazia; idem filtrando | O teste atual cobre **só paginação** — eu havia afirmado cobertura maior do que existe |
| PD-2 | Cada ação de linha abre o diálogo correspondente | **PRESERVAR** | **Pelo fluxo do usuário**: acionar na tela → o diálogo certo aparece. Não invocar callbacks de filhos mockados | **O teste mais valioso do dashboard.** A migração troca os quatro modais; a fiação quebra em silêncio |
| PD-3 | "Baixa de Produtos" abre a lista; escolher um produto fecha a lista e abre o modal de baixa | **PRESERVAR** | Fluxo completo | Caminho B inteiro — o único disponível no mobile hoje |
| PD-4 | "Ver produtos" do `LowStockBanner` aplica o filtro de estoque baixo | **PRESERVAR** | API recebe `status=ATTN,OUT` e `page=1` | Metade do UF-07: hoje só se **entra** no filtro. A saída é responsabilidade do `StatusFilterMenu` (SFM-2) |
| PD-5 | Ações em lote operam sobre os itens da página visível | **PRESERVAR** | "Excluir página" → `mutate` recebe exatamente os itens correntes | Consequência de dados |
| PD-6 | Busca é repassada (com debounce) e reseta a página | **PRESERVAR** | Digitar → API recebe o termo e `page=1` | — |
| — | Paginação renderizada **antes** dos cards no mobile | **BUG — NÃO CONGELAR** | — | C-4 |
| — | "Excluir selecionados" visível e permanentemente desabilitado no mobile | **BUG — NÃO CONGELAR** | — | **N-3:** controle morto; §15.1 decide não renderizar ações em lote no mobile |
| — | `serverError` do `ProductFormModal` persiste ao reabrir | **BUG — NÃO CONGELAR** | — | F-10 |
| — | Duas instâncias de `ProductFormModal` montadas simultaneamente | **NÃO RELEVANTE** | — | Implementação; A-9 |

**Testes novos: 6.**

---

## 11. O limite do jsdom — decisão necessária

Vários riscos de mobile deste plano **não são detectáveis** pela stack de teste atual (vitest + jsdom + Testing Library), que não calcula layout, não aplica breakpoints do Tailwind e não tem viewport real:

- clipping horizontal (`overflow-hidden` — UF-29 e N-7);
- troca tabela↔cards em `md` (768px), incluindo o critério de aceite de §15 do Design System;
- alvo de toque de 44×44 px (§15.2), que os atalhos atuais (~28–32px) reprovam;
- ausência de `max-height`/rolagem vertical nos quatro modais — em viewport curta ou com teclado virtual, os botões de confirmação podem ficar inalcançáveis (achado do review, A-13);
- a grade fixa de cinco atalhos do `QuickOutModal` em larguras de 320–375px.

**Nenhum destes vira characterization test nesta Task 0** — seria escrever um teste que não testa. O projeto não tem runner de navegador (sem Playwright/Cypress).

> **Q-1 — DECIDIDO em 29/08/2026:** a paridade responsiva/mobile da primeira etapa da migração visual será verificada **manualmente** no navegador, contra a tabela de §15.1. Nenhum runner E2E (Playwright, Cypress, Selenium ou equivalente) é introduzido — nem nesta fase, nem como dependência nova do projeto. Characterization tests continuam responsáveis pelo comportamento funcional; a verificação manual cobre o que o jsdom não pode ver: 320px quando relevante, 375px, viewport baixo, a transição em torno de `md`, clipping, rolagem, `max-height`, alvos de toque de ~44px, a grade de atalhos e a paridade de capacidades entre desktop e mobile.

---

## 12. O que **não** vira contrato — lista fechada

Nenhum teste desta Task 0 pode afirmar qualquer um destes. É a lista que a revisão de código da Fase 8 usa para recusar um teste.

### Bugs conhecidos (não congelar)

| ID | Comportamento atual errado | Onde |
|---|---|---|
| **C-1** | Sem `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, retorno de foco ou bloqueio de scroll | os três `QuickOut*` |
| **C-1** | Listener de teclado global no `window` em vez de trap de diálogo | `QuickOutModal` |
| **C-1** | Nenhum campo recebe foco ao abrir | `QuickOutModal` |
| **C-4** | Paginação renderizada antes dos cards no mobile | `ProductDashboard` |
| **C-5** | Card mobile sem baixa rápida e sem estoque mínimo | `ProductCardList` |
| **C-6** | Tabela mostra o status derivado e esconde o `minStock` | `ProductsTable` |
| **A-5** | `select-none` nas células de dados | `DataTable` |
| **A-6** | Números sem `tabular-nums` e sem separador de milhar | `ProductsTable` |
| **A-7** | `aria-controls` apontando para id que só existe quando expandido | `ProductsTable` |
| **A-12** | `return null` antes dos hooks | `QuickOutListModal` |
| **F-02** | `fetch` manual sem cancelamento | `QuickOutListModal`, `QuickOutHistoryModal` |
| **F-03** | Ordenação só da página atual, aparentando global | `QuickOutHistoryModal` |
| **F-09** | Filtro de tipo sem `INITIAL_STOCK` | `MovementHistoryModal` |
| **F-10** | `serverError` persiste ao fechar e reabrir | `ProductFormModal` |
| **UF-07** | Filtro sem saída no mobile | `StatusFilterMenu` / `ProductDashboard` |
| **UF-29** | Tabela clipada sem rolagem no mobile | `QuickOutListModal` |
| **UF-34** | `INITIAL_STOCK` renderizado cru | `MovementHistoryModal` |
| **M-3 / M-4** | `text-[10px]`; `text-gray-400` a 2,5:1 | `StatusFilterMenu`, `QuickOutHistoryModal` |
| **M-5** | Seta `▲` sem `aria-hidden` | `QuickOut*` |
| **M-13** | `toLocaleString()` sem locale | `MovementHistoryModal` |
| **B-7** | Busca com placeholder e sem label | `QuickOutListModal` |
| **N-1** | "Máx. 255 caracteres" não validado em lugar nenhum | `QuickOutModal` |
| **N-2** | `colSpan={4}` numa tabela de 5 colunas | `QuickOutListModal` |
| **N-3** | "Excluir selecionados" visível e morto no mobile | `ProductDashboard` |
| **N-4** | Ramo "Estoque negativo" é código morto | `QuickOutModal` |
| **N-5** | `balance=0, minStock=0` renderiza dois badges contraditórios | `QuickOutListModal` |
| **N-6** | Falha de consulta silenciosa (`try/finally` sem `catch`) | `QuickOutListModal`, `QuickOutHistoryModal` |
| **N-7** | Mesmo clipping do UF-29, não registrado antes | `QuickOutHistoryModal` |
| **N-8** | Campos sem `<label>`: quantidade; busca e datas do histórico | `QuickOutModal`, `QuickOutHistoryModal` |
| **A-8ʳ** | `aria-sort="none"` em todos os cabeçalhos não ordenados | `DataTable` |
| **A-12ʳ** | Estado vazio sem `role` de anúncio (erro e carregando têm) | `DataTable`, `ProductCardList`, `MovementHistoryModal` |
| **A-14ʳ** | Preview e erro do QuickOut não anunciados nem associados ao campo | `QuickOutModal` |

*(sufixo ʳ = achado da revisão técnica desta fase)*

### Mudanças intencionais já decididas (não congelar)

`Escape` passa a fechar os três `QuickOut*` · `max = saldo × 2` e o vocabulário de estado do preview (F-01/P-4) · empilhamento de dois overlays (QOL-9) · texto exato dos estados vazios (A-10) · cor destrutiva da baixa rápida (A-1) · título do histórico sem nome do produto (UF-35) · `antes → depois` restrito a `ADJUSTMENT` (UF-33) · ordenação secundária por Shift+clique (UF-08, **em aberto**) · ausência de seleção no mobile (§15.1) · ausência de separador no menu destrutivo (UF-16) · texto do toast de sucesso (§4.2).

### Padrões de teste proibidos nesta Task 0

1. Asserção sobre `className`, `rounded`, largura, cor ou sombra.
2. `toMatchSnapshot()` de árvore inteira.
3. `container.querySelector('div > div > span')` ou qualquer travessia de estrutura — **inclui `closest('tr')` e `{ selector: 'h3' }`**, que quebram se a tabela virar lista ou a tag mudar.
4. Contagem de elementos como proxy de layout.
5. Asserção sobre **ordem visual**, salvo quando a ordem for funcional (ordenação de dados). A ordem paginação/cards é justamente um **bug**.
6. Asserção sobre o mecanismo (*"tem `autoFocus`"*, *"chama `toLocaleString('pt-BR')`"*) onde o comportamento é o que importa (*"o campo tem foco"*, *"a data é legível em formato brasileiro"*).
7. Congelar o texto integral de mensagens que o vocabulário único vai reescrever — afirmar o **dado**, não a frase.
8. Comparar strings de data completas: dependem do fuso do ambiente. Fixture com data inequívoca e asserção sobre os componentes.

---

## 13. Achados novos desta análise

Encontrados ao conferir o código. **Nenhum foi corrigido.**

| # | Achado | Evidência | Impacto |
|---|---|---|---|
| **N-1** | "Máx. 255 caracteres" não é validado: `z.string().optional()` no frontend e no backend, `note String?` no Prisma | `QuickOutModal.tsx`, `routes/quick-out.ts:20`, `schema.prisma:52` | Baixo. A ajuda mente. Validar ou remover o texto |
| **N-2** | `colSpan={4}` numa tabela de 5 colunas | `QuickOutListModal.tsx:145,149` | Baixo, visual. Sai na migração |
| **N-3** | "Excluir selecionados" renderizado e permanentemente desabilitado no mobile | `ProductDashboard.tsx` + `ProductCardList` sem checkbox | Médio. Já endereçado por §15.1 |
| **N-4** | **O ramo "Estoque negativo" é código morto.** `newBalance = Math.max(0, …)` na linha 53 impede `newBalance < 0`; as linhas 154/157 nunca executam | `QuickOutModal.tsx:53,154,157` | **Alto para a decisão F-01.** `audit.md` (F-1), `user-flows.md` (UF-27) e `bugfix-gate.md` (§3.3) descrevem a UI "pintando estoque negativo" — **isso não acontece**. O que acontece é pior de outra forma: exceder o saldo mostra **0** com "Estoque zerado", sem nenhum sinal de que a quantidade é impossível. **F-01 precisa ser redecidida sobre o comportamento real** |
| **N-5** | `balance = 0` e `minStock = 0` renderiza "Em Estoque" **e** "Fora de Estoque" simultaneamente; `isOut` e `isOk` são ambos verdadeiros | `QuickOutListModal.tsx:153-165` vs. `products/types.ts:16-19` | Médio. Segunda implementação da regra de status, divergente da canônica |
| **N-6** | Falha de consulta silenciosa: `try/finally` sem `catch`. Erro de API vira estado vazio, indistinguível de resultado legítimo | `QuickOutListModal.tsx:39-50`, `QuickOutHistoryModal.tsx:28-39` | Médio. A pessoa conclui "não há produtos" quando a API caiu |
| **N-7** | O mesmo clipping do UF-29 existe no histórico (`overflow-hidden` + `table-fixed`), além de busca `w-72` fixa no cabeçalho | `QuickOutHistoryModal.tsx:67-80,92-93` | Médio. UF-29 estava registrado só para a lista |
| **N-8** | Campos sem `<label>`: quantidade do `QuickOutModal`; busca e datas do `QuickOutHistoryModal` | `QuickOutModal.tsx`, `QuickOutHistoryModal.tsx:73-88` | Médio, acessibilidade. B-7 registrava só a busca da lista |
| **N-9** | `QuickOutHistoryModal` preserva filtros, busca e página entre aberturas | `QuickOutHistoryModal.tsx:14-25,62` | **Decidido (29/08/2026): PRESERVAR.** Coberto por QOH-8 |

---

## 14. Revisão técnica — o que foi incorporado e o que não

Codex atuou como reviewer read-only. **Verifiquei cada achado contra o código antes de aceitar.**

### Aceitos e incorporados

| Achado | Verificação | Efeito no plano |
|---|---|---|
| **A-1** · `Math.max(0,…)` torna "Estoque negativo" inalcançável | **Confirmado** (`QuickOutModal.tsx:53` vs `:157`) | Reclassificado de ALTERAR para **BUG/N-4**; corrige o baseline de três documentos e reabre F-01 |
| **A-2** · `aria-sort` é aplicado a todos os `<th>`, inclusive `"none"` | **Confirmado** (`DataTable.tsx:131`) | PT-3 reescrito: asserir só o cabeçalho ativo. O teste original **falharia** contra o código atual |
| **A-3** · `Shift+Enter` não é contrato verificável | **Confirmado** — o listener só ignora; o submit nativo do form não é cancelado, e o jsdom não faz submissão implícita | Removido do contrato |
| **A-4** · `balance=0, minStock=0` renderiza dois badges | **Confirmado** (`QuickOutListModal.tsx:153-155`) | Novo N-5; caso-limite passa a ser exigido em PS-1 |
| **A-5/A-6** · Testes existentes frágeis (`{selector:'h3'}`, `closest('tr')`) | **Confirmado** — eu escrevi o primeiro | Registrados como ajuste na Fase 8; regra 3 dos padrões proibidos |
| **A-7** · "Histórico sem fechar a lista" vira dois `aria-modal` após migração | **Confirmado** por leitura de `ProductDashboard.tsx` + `Modal.tsx` | QOL-9 passa a proteger a **capacidade**, com a forma declarada em aberto |
| **A-8** · Erros de consulta sem `catch` | **Confirmado** nos dois componentes | Novo N-6 |
| **A-9** · `ProductDashboard.test.tsx` cobre só paginação | **Confirmado** — eu havia afirmado cobertura maior | Novo PD-1 |
| **A-10** · Estado vazio sem live role | **Confirmado** (`DataTable`, `ProductCardList`, `MovementHistoryModal`) | Separado de erro/carregando; vira bug, não PRESERVAR |
| **A-11** · Cobertura insuficiente: payload, falha de submit, botões explícitos de saída, navegação de página | **Confirmado** | +QOM-9, QOM-11, QOM-12, QOL-8, QOL-10, QOH-3, QOH-7 |
| **A-12** · Redundâncias (`ProductsTable` × `DataTable`; `productStatus` em três superfícies; nome do gatilho e `onDelete` já cobertos) | **Confirmado** | Erro/carregando saíram de PT; regra extraída para PS-1; `ProductActionsMenu` caiu de 2 para 1 teste |
| **A-13** · Modais sem `max-height`/rolagem vertical | **Confirmado** nos quatro | §11 (limite do jsdom) |
| **A-14** · Clipping também no `QuickOutHistoryModal`; labels ausentes | **Confirmado** | Novos N-7 e N-8 |
| **A-15** · `pageSize=10`, locale e `-` são mecanismo, não contrato | **Procede** | QOL/QOH reescritos para afirmar o efeito |
| **A-16** · Contagem inconsistente | **Procede** | Todos os casos numerados (QOM-n, QOL-n, …) |

### Aceitos com ajuste

| Achado | Ajuste |
|---|---|
| **"Testar `productStatus` só em `types.ts`"** | Adotado para a **regra** (PS-1), mas mantida a **tradução em tela** em PT-2 — é onde o vocabulário divergente (`StatusFilterMenu`) e o badge duplo (N-5) aparecem |
| **"Consolidar todas as fábricas antes de começar"** | **Reduzido.** Passo 0 cria helpers para os testes novos; reescrever os três `makeProduct`/`makeMovement` existentes e estáveis é oportunismo, não pré-requisito |
| **"Adicionar teste de focus trap em `Modal.test.tsx`"** | **Reclassificado.** É requisito **pós-migração** (Fase 8), não caracterização — o baseline não tem trap para caracterizar |

### Não adotado agora

| Achado | Motivo |
|---|---|
| **"Acrescentar verificação em navegador a 375px"** | Concordo com o diagnóstico, mas introduzir Playwright/Cypress é **dependência nova**. Registrado como decisão pendente **Q-1** (§11), para aprovação — não presumida |

---

## 15. Ordem recomendada, dependências e paralelismo

### Passo 0 — helpers dos testes novos (bloqueia tudo)

Um módulo `test/helpers/` com fábricas de `ProductWithBalance`, `Movement` e `QuickOutHistoryItem`, e um `renderWithProviders` (QueryClient + ToastProvider). **Escopo:** servir os testes novos. Os arquivos existentes só migram para os helpers se já forem tocados por outro motivo.

### Trilhas

| Trilha | Componentes | Testes | Depende de | Paralelizável com |
|---|---|---|---|---|
| **T1** | `QuickOutModal`, `QuickOutListModal`, `QuickOutHistoryModal` | 12 + 10 + 7 = **29** | Passo 0; **N-9 decidido** | T2, T3 |
| **T2** | `MovementHistoryModal` | **6** | Passo 0 | T1, T3 |
| **T3** | `products/types`, `ProductsTable`, `ProductCardList`, `StatusFilterMenu`, `ProductActionsMenu` | 1 + 8 + 5 + 4 + 1 = **19** | Passo 0 (PS-1 primeiro) | T1, T2 |
| **T4** | `ProductDashboard` | **6** | Passo 0, **T1 e T3** | — |

**Por que T4 depende de T1 e T3:** o dashboard só testa fiação. Escrevê-lo antes dos filhos leva a duplicar asserts de renderização — exatamente a redundância que este plano evita.

**Por que os três `QuickOut*` ficam na mesma trilha:** compartilham o contrato §9.3 e as mesmas armadilhas. São arquivos distintos e **podem** ser escritos em paralelo, mas por quem já leu o contrato inteiro — a leitura é que não paraleliza.

**Por que PS-1 vem antes do resto de T3:** PT-2 e PCL-2 testam a *tradução* da regra; a regra em si precisa estar fixada primeiro.

### Dependências externas

| Dependência | Bloqueia | Situação |
|---|---|---|
| **N-9** (estado do histórico preservado entre aberturas) | QOH-1..3 | **Decidido: PRESERVAR** (29/08/2026) — coberto por QOH-8 |
| **F-01** (impedir × avisar) | Nada do que será escrito — determina apenas que `max` e o vocabulário do preview não viram teste | **Decidido: impedir** (29/08/2026, `bugfix-gate.md` §7 G-3) — aplicado na migração do `QuickOutModal` (Fase 8), não na Task 0 |
| **Q-1** (verificação em navegador) | Nada da Task 0; define como a paridade mobile é verificada na Fase 8 | **Decidido: verificação manual**, sem runner E2E (29/08/2026) |
| **UF-08** (ordenação secundária) | Mantém Shift+clique fora do contrato | Em aberto |
| **P-1** (baixa rápida no mobile) | Não bloqueia: o teste afirma *"existe baixa rápida alcançável no card"*, não onde ela vive | Pendente |

Só **N-9** bloqueia o início de uma trilha.

---

## 16. Números

| | |
|---|---|
| **Characterization tests novos planejados** | **60** |
| Testes existentes reaproveitados como caracterização | 17 |
| Total protegendo a migração | **77** |
| Componentes com cobertura zero hoje | 5 |
| Comportamentos classificados | 135 |
| **PRESERVAR** | 73 |
| **ALTERAR INTENCIONALMENTE** | 12 |
| **BUG — NÃO CONGELAR** | 42 |
| **NÃO RELEVANTE** | 8 |
| Achados novos registrados | 9 (N-1 a N-9) |

> O rascunho anterior à revisão previa 47 testes. A revisão **aumentou** o número: removeu 5 redundâncias e acrescentou 18 casos de cobertura que faltavam (payload, falha de submissão, controles explícitos de saída, navegação de página, seleção limpa ao buscar/filtrar).

**Componentes prioritários** (maior risco × menor cobertura): `QuickOutListModal` e `QuickOutHistoryModal` — MIGRAR, cobertura zero, `fetch` manual sem cancelamento nem tratamento de erro, e sem nenhuma semântica de diálogo. Depois `ProductsTable`/`ProductCardList`, onde a paridade mobile se decide.

---

## Estado

**Plano concluído e revisado.**

**Atualização — 29/08/2026.** As três dependências que bloqueavam a implementação foram decididas:
- **N-9** → PRESERVAR (coberto por QOH-8 em `QuickOutHistoryModal.test.tsx`);
- **F-01** → impedir (redecidido à luz de N-4; aplicado durante a migração do `QuickOutModal`, não na Task 0 — ver `bugfix-gate.md` §7 G-3);
- **Q-1** → verificação manual da paridade responsiva, sem runner E2E.

A Task 0 foi implementada: 189 testes na suíte de frontend (90 pré-existentes + 99 novos), todos verdes, `pnpm -r run lint`/`typecheck`/`build` sem erro, nenhum arquivo de `src/`, CSS ou token alterado. Nenhum comportamento classificado BUG — NÃO CONGELAR ou ALTERAR INTENCIONALMENTE (incluindo o alvo agora decidido de F-01) foi transformado em characterization test.
