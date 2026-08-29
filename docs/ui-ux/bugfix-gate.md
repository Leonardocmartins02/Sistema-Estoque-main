# Bugfix Gate — fronteiras de escopo antes da Fase 7

**Data:** 28/08/2026
**Escopo:** classificação. **Nada foi implementado, nenhum código ou CSS alterado, nenhum teste escrito.**
**Fontes:** achados das Fases 1–6 (`audit.md`, `user-flows.md`, `design-system.md`, `prototype.md`), conferidos contra o código atual.

---

## 0. Por que este gate existe

Sem ele, dois erros previsíveis aconteceriam:

1. **Corrigir duas vezes.** Consertar à mão o foco e o Escape do `QuickOutModal` agora, e reescrever tudo semanas depois ao adotar o primitivo de diálogo.
2. **Congelar bug como contrato.** A Task 0 escreve *characterization tests* — testes que capturam o comportamento **atual**. Se um bug conhecido entrar nessa rede sem marcação, ele vira requisito, e a migração passa a ser obrigada a preservá-lo.

O gate resolve os dois: decide o que se corrige **antes** (para o baseline ficar correto) e marca explicitamente, dentro dos characterization tests, o que **não** deve ser congelado.

---

## 1. Critério aplicado

Duas perguntas por item; a segunda desempata.

**P1 — Sem corrigir antes, consigo preservar e testar corretamente o comportamento atual?**
Se a resposta for *"não, porque o comportamento atual está errado e o teste congelaria o erro"* → candidato a **A**.

**P2 — A correção depende estruturalmente da migração que já faremos?**
Se sim → **B**, ainda que o patch isolado fosse trivial. Corrigir para jogar fora é desperdício, e o item pode ser marcado "não congelar" no characterization sem prejuízo.

### Categorias

| | Significado |
|---|---|
| **A** | Bug independente. Corrigir **antes** da refatoração visual |
| **B** | Migration-bound. Correção acontece **durante** a migração. Exige characterization test antes de tocar |
| **C** | Decisão de produto. Não há "correto" defensável sem escolha explícita |
| **D** | Dívida real, mas desnecessária para esta refatoração |

---

## 2. Duas verificações que mudaram a classificação

O enunciado deste gate trazia exemplos ("`ProductFormModal` vazio → provavelmente A"; "`QuickOutModal` sem Radix → provavelmente B") com a instrução de não aceitá-los automaticamente. Conferi o código. Duas conferências **alteraram** o resultado.

### V-a · O bloco de debug do `QuickOutModal` parece load-bearing — e não é

Além dos nove `console.log`, o `useEffect` de debug executa:

```
const modalElement = document.querySelector('[data-testid="quick-out-modal"]');
if (modalElement) { … (modalElement as HTMLElement).focus(); }   // QuickOutModal.tsx:59
```

À primeira vista, remover o bloco removeria **gerenciamento de foco** — o que tornaria C-2 arriscado e o empurraria para **B**.

**Não é o caso.** O contêiner `[data-testid="quick-out-modal"]` é um `<div>` **sem `tabIndex`**, e `HTMLElement.focus()` em elemento não focável é um *no-op*: o foco não se move.

Duas consequências:
1. Remover o bloco de debug é seguro → **C-2 permanece A**.
2. Fica confirmado que o `QuickOutModal` **não tem nenhum** gerenciamento de foco — não há sequer uma tentativa funcional. Reforça C-1.

### V-b · `ToastProvider` envolve `AuthProvider`

```
<QueryClientProvider>
  <ToastProvider>          ← main.tsx:15
    <AuthProvider>         ← main.tsx:16
      <App />
```

O `AuthContext` **consegue** chamar `useToast()`. Avisar "sua sessão expirou" no handler global de 401 não exige reestruturar providers.

Consequência: UF-04 se divide em duas metades de custo muito diferente — **avisar** (barato, independente → **A**) e **preservar os dados digitados** (feature → **D**). Sem essa conferência, o item inteiro teria sido classificado como dívida.

### Codex não foi acionado

Após V-a e V-b, nenhuma **ambiguidade técnica** restou. As dúvidas remanescentes são de *economia de escopo* — corrigir agora ou durante a migração — que é decisão de projeto, não questão técnica. Acionar um reviewer para isso seria terceirizar uma decisão que cabe a quem conhece o plano.

---

## 3. Matriz de classificação

### 3.1 · Categoria A — corrigir antes da Fase 7

| Item | Class. | Evidência | Por quê | Ação | Quando | Teste necessário |
|---|---|---|---|---|---|---|
| **F-06 / UF-15** — `ProductFormModal` em `edit` abre vazio | **A** | Sonda na Fase 2: esperado `"Caneta Azul"`, recebido `""`. `defaultValues` lido só na montagem; a instância monta uma vez com `editing===null`; `reset()` só existe pós-submit (`:90`); sem `key` | Inutiliza uma tela inteira: editar o mínimo obriga a redigitar nome e SKU de memória. `ProductFormModal` é **ADAPTAR**, não MIGRAR — nada na migração conserta. Ainda quebra o único caminho hoje disponível para consultar `minStock` (C-6) | Sincronizar o form ao abrir (`reset` no efeito de abertura **ou** `key` por produto) | **Onda 0** | Unit: abrir em `edit` → campos preenchidos; abrir para outro produto → valores do novo, não do anterior |
| **F-07 / UF-26** — mensagem de erro da baixa rápida nunca chega | **A** | `QuickOutModal.tsx:134` lê `e.response?.data?.message` — formato do **axios**, biblioteca que o projeto não usa. `apiFetch` lança `ApiRequestError` com `.message`; backend responde 422 `"Estoque insuficiente."` | A extração de erro não tem relação com Radix. **P1 falha**: sem corrigir, o characterization congelaria `"Falha ao registrar baixa"` como contrato. Viola regra explícita de `frontend.md` | Ler `ApiRequestError.message` | **Onda 0** | Unit: 422 do backend → mensagem do backend visível ao usuário |
| **C-2** — nove `console.log` em produção | **A** | Linhas 33, 49, 50, 53, 55, 58, 114, 142, 145; inclui dump de `product` e dos valores do formulário; `:58` loga `getComputedStyle` | Viola regra do projeto e loga payload. Remoção é segura — o aparente `focus()` é inerte (**V-a**) | Remover o bloco de debug inteiro | **Onda 0** | Nenhum teste novo; a cobertura vem de F-07 |
| **C-3** — bloco de erro duplicado | **A** | `:239-260` e `:266-291` renderizam o mesmo erro; há comentário `{/* Observação (removida duplicidade) */}` de remoção incompleta | Duplicação de JSX, sem relação com o sistema de diálogo. Visível ao usuário hoje | Remover a cópia | **Onda 0** | Assert: a mensagem aparece **uma** vez |
| **F-04** — seleção não limpa ao paginar/filtrar | **A** | `selectedIds` em `ProductDashboard` sobrevive a mudança de página, busca e filtro | **Risco de dado**: permite excluir itens que não estão na tela; o diálogo informa a quantidade, nunca quais. Comportamento correto **já decidido** (decisão 8) e independente do visual. Congelá-lo seria congelar um bug | Limpar a seleção em página/busca/filtro | **Onda 1** | Unit: selecionar → paginar → seleção vazia |
| **F-08 / UF-49** — `setPage(1)` antes da mutação | **A** | `ProductDashboard.tsx:129`, em `handleDeletePage` | A tela salta para a página 1 enquanto exclui os itens da página N; o que se vê deixa de corresponder ao que está sendo apagado. Independente do visual | Inverter a ordem | **Onda 1** | Unit: ordem das chamadas |
| **UF-04 (parte 1)** — expiração de sessão silenciosa | **A** | 401 → `logout()` troca a árvore pela `LoginPage` sem mensagem; modal aberto e dados digitados somem sem explicação | Barato e independente: `ToastProvider` envolve `AuthProvider` (**V-b**). Hoje a pessoa não sabe se a operação foi gravada | Anunciar a expiração ao derrubar a sessão | **Onda 1** | Unit: 401 → mensagem anunciada em live region |

### 3.2 · Categoria B — migration-bound

Todos exigem **characterization test antes** de qualquer alteração (§4).

| Item | Class. | Evidência | Por quê | Ação | Quando | Teste necessário |
|---|---|---|---|---|---|---|
| **C-1** — três sistemas de diálogo paralelos | **B** | `ui/Modal` (Radix, correto); `MovementHistoryModal` com Radix cru; `QuickOut*` com `createPortal` manual, `z-[10000]`, sem `role="dialog"`, `aria-modal`, foco preso ou retorno de foco | É *a* migração. Foco, Escape, `aria-modal` e bloqueio de scroll vêm do primitivo. Corrigir à mão agora é escrever duas vezes o mesmo comportamento | Migrar os quatro para o primitivo único | Fase 8 | Characterization completo (§4) + a11y do diálogo |
| **A-12** — regras de hooks no `QuickOutListModal` | **B** | `:27` — `if (!open) return null` antes de 8 hooks. Sonda na Fase 2: **não** quebra; emite `Warning: Internal React error: Expected static flag was missing` | Some por construção ao adotar o primitivo (o Radix controla montagem). Sem efeito ao usuário | Resolvido pela migração | Fase 8 | Coberto pelo characterization |
| **UF-29** — tabela cortada no mobile | **B** | `QuickOutListModal.tsx:85` usa `overflow-hidden` sem `overflow-x-auto`; 5 colunas `table-fixed` num celular ficam clipadas **sem rolagem** | O contêiner é reescrito na migração. **Mitigação opcional de 1 palavra** existe — ver G-2 | Corrigir ao migrar | Fase 8 | Assert: conteúdo alcançável em 375px |
| **F-02** — `fetch` manual em `useEffect`, sem cancelamento | **B** | `QuickOutListModal` e `QuickOutHistoryModal`; digitar rápido pode aplicar resposta antiga | A migração para React Query **é** a correção; separá-la é reescrever a camada de dados dos mesmos componentes duas vezes | Migrar para React Query | Fase 8 | Race: resposta antiga não sobrescreve a nova |
| **F-03** — ordenação só da página atual | **B** | `QuickOutHistoryModal.viewItems` ordena em memória, aparentando ordenação global | Mesmo backlog de paginação real, mesmos componentes | Corrigir ao migrar | Fase 8 | Characterization marca como **não congelar** |
| **F-09** — `INITIAL_STOCK` ausente do filtro de tipo | **B** | Backend aceita os 4 valores (`movementListQuerySchema`); o `<select>` oferece 3 | Mesma tela e mesmo vocabulário da migração do histórico | Incluir na migração | Fase 8 | Assert: filtro cobre os 4 tipos |
| **UF-34** — `INITIAL_STOCK` exibido cru | **B** | Ternário trata `ADJUSTMENT` e joga o resto no ramo `IN`/`OUT`; o enum em inglês com underscore vaza para a tela | O vocabulário aprovado (Design System §14) é aplicado na migração. Corrigir antes seria criar um mapeamento que a migração substitui | Aplicar vocabulário único | Fase 8 | Assert: nenhum enum cru renderizado |
| **UF-33** — `antes → depois` ausente fora de `ADJUSTMENT` | **B** | `StockService` grava `previousQuantity`/`newQuantity` em **toda** movimentação e a rota devolve os dois; a UI só exibe em ajustes | O dado já chega no payload; exibi-lo é a gramática aprovada, aplicada na migração. Mudança de **exibição**, sem backend | Aplicar a gramática | Fase 8 | Assert: os 4 tipos mostram antes→depois |
| **UF-07 / UF-41** — filtro mobile sem saída | **B** | `showLowStock()` aplica filtro; "Limpar filtros" vive no `StatusFilterMenu`, dentro de `hidden md:block` | A correção correta é a sheet de filtros + chips (validada no protótipo). **Mitigação opcional** existe — ver G-2 | Sheet + chips | Fase 8 | Paridade: limpar filtro alcançável em 375px |
| **C-5 / UF-23** — capacidades ausentes no card mobile | **B** | `ProductCardList` não expõe `onQuickOut` nem `minStock` | É o redesign do card; P-1 já decidiu que a baixa rápida vai para o overflow | Redesenhar o card | Fase 8 | Paridade de capacidades |
| **P-3** — divergência de formatação numérica | **B** | Tabela sem separador de milhar; `QuickOutModal` com `toLocaleString('pt-BR')`. Derivou até **dentro do protótipo** (`1250` × `1.250` no mesmo diálogo) | Política aprovada; aplicada componente a componente conforme cada um é adaptado | Helper compartilhado + aplicação | Fase 8 | Assert: mesma quantidade, mesma representação |
| **Excluir/Zerar página** | **B** | `ProductDashboard` rodapé da tabela | **Não é defeito.** Capacidade aprovada para manter (decisão 5); o que muda é posição e escopo nomeado | Reposicionar fora da hierarquia primária | Fase 8 | Assert: escopo nomeado no rótulo |

### 3.3 · Categoria C — decisão de produto

| Item | Class. | Evidência | Por quê | Ação | Quando | Teste |
|---|---|---|---|---|---|---|
| **F-01** — UI desenha "Estoque negativo" | **C** — **DECIDIDO em 29/08/2026** | `QuickOutModal:225` permite `max = saldo × 2` e pinta o preview de vermelho; o backend sempre recusa (422). Redecidida à luz de N-4 (`characterization-plan.md` §13): o ramo "Estoque negativo" é código morto (`Math.max(0, …)`), então o que acontece hoje não é o que os documentos anteriores descreviam — exceder o saldo mostra `0` com "Estoque zerado", sem nenhum sinal de que a quantidade é impossível | **Decisão: impedir.** A quantidade de saída não pode ultrapassar o saldo disponível. Confirmação desabilitada quando `quantidade > saldo`; feedback claro no momento do impedimento; nunca representar a quantidade impossível apenas como "Estoque zerado"; nunca permitir estoque negativo | Aplicar durante a migração do `QuickOutModal` (Fase 8) — a UI a bloquear é a mesma tela que muda de sistema de diálogo | **Antes** de migrar `QuickOutModal` | Requisito novo da migração, não characterization. O comportamento atual (`max = saldo × 2`, rótulo "Estoque zerado" sem impedimento) está classificado **ALTERAR INTENCIONALMENTE** em §4 — nenhum characterization test o força a continuar |
| **F-05** — SKU maiúsculo só por CSS | **C** | Input e coluna aplicam `uppercase` (transformação visual); o valor gravado mantém a caixa digitada; unicidade é exata → `abc123` e `ABC123` coexistem parecendo idênticos | É decisão de **dado/backend** (normalizar na escrita? unicidade case-insensitive?), não de UI. A UI só não pode continuar mentindo sobre o valor gravado | Decidir a política de SKU | **Antes** de migrar `ProductFormModal` | Depende da decisão |

### 3.4 · Categoria D — dívida fora de escopo

| Item | Class. | Evidência | Por quê | Ação | Quando |
|---|---|---|---|---|---|
| **UF-47** — `useConfirm` não passa `isPending` | **D** | `confirm()` devolve `Promise<boolean>`; `settle()` resolve e faz `setPending(null)`, **desmontando** o diálogo | **Reclassificado após verificar.** Não é fiação de prop: manter o diálogo aberto durante a mutação exige **mudar o contrato** do hook (aceitar a ação assíncrona). É redesenho de API, não bugfix | Registrar; decidir depois | Follow-up |
| **UF-04 (parte 2)** — preservar dados digitados na expiração | **D** | Ver A/UF-04 parte 1 | Feature (rascunho/restauração), não correção | Registrar | Follow-up |
| **M-7** — `animate-fade-in` nunca definida | **D** | Usada em `MovementHistoryModal:90`, ausente do config | Sem efeito ao usuário — a animação só não acontece. A classe sai na migração | Remover ao migrar | Fase 8 |
| **M-8** — cabeçalho ordenável sem rótulo | **D** | `DataTable:138-156` renderiza só a seta quando `sortable` e sem `headerRender` | Latente: `ProductsTable` sempre passa `headerRender` | Corrigir ao adaptar o `DataTable` | Fase 8 |
| Código morto `FinanceDashboard`/`SalesDashboard` | **D** | Zero imports (confirmado na Fase 1) | Remoção exige OK explícito por `frontend.md` | Ver G-4 | — |
| **F-10** — `ProductFormModal` mantém `serverError` ao fechar e reabrir | **D** | `ProductFormModal.tsx:93` — `setServerError(null)` só ocorre no início de um novo submit; o efeito de abertura (`:70-78`) faz `reset()` do formulário mas não limpa o erro | Achado adjacente identificado durante F-06, **não corrigido**. Sem efeito de dado: a mensagem antiga reaparece até o próximo submit. Fora do escopo de F-06 e de F-07 | Registrar; limpar o erro no efeito de abertura quando for decidido | Follow-up |
| Desvio em `docs/current-state.md` | **D** | Afirma que não há `useEffect`+`fetch` manual e que só existe um primitivo de modal ativo — **ambas falsas** | Documento é usado como mapa de referência do projeto | Atualizar em task própria | Follow-up |

---

## 4. Characterization tests obrigatórios

**Characterization não é aprovação.** Cada comportamento entra classificado, para que a rede de testes não transforme bug conhecido em requisito.

Critério de pronto da Task 0: a suíte passa **verde contra o código atual, sem alterá-lo**. Um teste que exija mudança no produto para passar não é caracterização — é requisito novo, e pertence a outra task.

### `QuickOutModal`

| Comportamento | Classificação |
|---|---|
| `Escape` fecha | PRESERVAR |
| `Enter` submete de qualquer campo, exceto no `<textarea>` e exceto com `Shift`; bloqueado durante envio | PRESERVAR |
| Clique no backdrop fecha; no conteúdo, não | PRESERVAR |
| Atalhos 1 · 5 · 10 · 25 · 50 com `aria-pressed` | PRESERVAR |
| Preview "Saldo Atual → Novo Saldo" recalculado a cada tecla | PRESERVAR |
| Rótulos "Estoque zerado" / "Estoque negativo" | ALTERAR INTENCIONALMENTE — F-01 decidido: rótulo será substituído por impedimento de confirmação com feedback claro, nunca representando a quantidade impossível como "Estoque zerado" |
| Ação primária desabilitada com quantidade ≤ 0 | PRESERVAR |
| Toast de sucesso com a quantidade; `onSuccess` dispara | PRESERVAR |
| Sem `role="dialog"`, sem foco preso, sem retorno de foco | ALTERAR INTENCIONALMENTE |
| `max = saldo × 2` | ALTERAR INTENCIONALMENTE — F-01 decidido: a quantidade não pode ultrapassar o saldo; o `max` deixa de permitir o dobro |
| **Mensagem de erro genérica** | **BUG — NÃO CONGELAR** (F-07, corrigido na onda 0) |
| **Erro renderizado duas vezes** | **BUG — NÃO CONGELAR** (C-3, onda 0) |
| **`console.log` no caminho crítico** | **BUG — NÃO CONGELAR** (C-2, onda 0) |

### `QuickOutListModal`

| Comportamento | Classificação |
|---|---|
| `autoFocus` no campo de busca ao abrir | PRESERVAR |
| Clique em qualquer ponto da linha seleciona o produto | PRESERVAR |
| Ordenação por Nome/SKU/Saldo alternando e resetando para página 1 | PRESERVAR |
| Colunas incluindo **Mín. Estoque** | PRESERVAR — é a única tela que hoje mostra saldo e mínimo juntos |
| Contador "N item(ns)"; paginação de 10 | PRESERVAR |
| "Histórico de Baixas" abre **sem fechar** a lista | PRESERVAR |
| Backdrop fecha | PRESERVAR |
| **Escape não fecha** | ALTERAR INTENCIONALMENTE — passará a fechar |
| **Tabela clipada sem rolagem no mobile** | **BUG — NÃO CONGELAR** (UF-29) |
| **`return null` antes dos hooks** | **BUG — NÃO CONGELAR** (A-12) |
| **`fetch` manual sem cancelamento** | **BUG — NÃO CONGELAR** (F-02) |

### `QuickOutHistoryModal`

| Comportamento | Classificação |
|---|---|
| Filtros de busca e data resetam a página; paginação de 10 | PRESERVAR |
| Backdrop fecha | PRESERVAR |
| **Escape não fecha** | ALTERAR INTENCIONALMENTE |
| **Ordenação só da página atual, aparentando global** | **BUG — NÃO CONGELAR** (F-03) |
| **`fetch` manual sem cancelamento** | **BUG — NÃO CONGELAR** (F-02) |

### `MovementHistoryModal`

| Comportamento | Classificação |
|---|---|
| Filtros (tipo, de/até, busca em observação) resetam a página | PRESERVAR |
| Seletor de itens por página (10/20/50) | PRESERVAR |
| Linhas legadas sem `previous/new` degradam para quantidade crua com nota | **PRESERVAR** — comportamento correto e deliberado |
| Foco preso, Escape, retorno de foco (vindos do Radix cru) | PRESERVAR |
| Título não nomeia o produto | ALTERAR INTENCIONALMENTE (UF-35) |
| `antes → depois` só em `ADJUSTMENT` | ALTERAR INTENCIONALMENTE (UF-33) |
| **`INITIAL_STOCK` renderizado cru** | **BUG — NÃO CONGELAR** (UF-34) |
| **`toLocaleString()` sem locale** | **BUG — NÃO CONGELAR** (M-13) |
| **Filtro não oferece `INITIAL_STOCK`** | **BUG — NÃO CONGELAR** (F-09) |

### `ProductsTable` / `ProductCardList`

| Comportamento | Classificação |
|---|---|
| Três status derivados de `balance` vs `minStock` | PRESERVAR — regra de negócio |
| `aria-sort` acompanhando a ordenação primária | PRESERVAR |
| Expandir descrição por nome e por SKU | PRESERVAR o efeito; ALTERAR o `aria-controls` para id inexistente (UF-07/A-7) |
| Ações da linha e o que cada uma dispara | PRESERVAR o conjunto; ALTERAR a disposição |
| Estados vazio e de erro | ALTERAR INTENCIONALMENTE (A-10) |
| Ordenação secundária por Shift+clique aplicada só à página atual | ALTERAR INTENCIONALMENTE — **e permanece em aberto** (UF-08) |
| Fusão do SKU sob o nome; par saldo/mínimo | ALTERAR INTENCIONALMENTE |
| **Card sem baixa rápida e sem estoque mínimo** | **BUG — NÃO CONGELAR** (C-5) |
| **`select-none` nas células de dados** | **BUG — NÃO CONGELAR** (A-5) |
| **Paginação renderizada antes dos cards no mobile** | **BUG — NÃO CONGELAR** (C-4) |

---

## 5. Ordem recomendada e paralelismo

### Onda 0 — bloqueia a Fase 7

`F-06` → `F-07` → `C-3` → `C-2`

Os quatro estão no caminho direto do usuário. F-07, C-3 e C-2 vivem no **mesmo arquivo** (`QuickOutModal.tsx`): um commit por bug, mas leitura compartilhada, então rodam em sequência e pela mesma pessoa. F-06 é em arquivo distinto e pode começar em paralelo.

### Onda 1 — paralelizável, arquivos disjuntos

| Trilha | Itens | Arquivo |
|---|---|---|
| 1 | F-04 + F-08 | `ProductDashboard.tsx` |
| 2 | UF-04 parte 1 | `auth/AuthContext.tsx` |

As duas trilhas não se tocam e podem correr simultaneamente. **Não paralelizar** F-07/C-3/C-2 entre si: mesmo arquivo, conflito garantido.

### Depois

1. Decisões **C** (F-01, F-05) — precisam estar fechadas **antes** de a migração tocar `QuickOutModal` e `ProductFormModal`, porque mudam o que o characterization deve congelar.
2. **Task 0** — characterization tests, com a classificação da §4.
3. Migração (Fase 8).

### Guardrails para a execução da onda 0/1

- **TDD obrigatório** (`AGENTS.md`): teste escrito antes/junto, nunca depois.
- Um commit por bug, Conventional Commits.
- Checklist de pronto verde: `pnpm -r run lint`, `typecheck`, testes de frontend e backend, `build`.
- **Sem expansão de escopo**: nenhuma mudança visual, nenhum token, nenhuma migração de modal. Se o arquivo "pedir" refatoração, registrar — não fazer.

---

## 6. Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| **Characterization congelar bug como contrato** | **Alta** se a §4 for ignorada | A classificação por comportamento é parte da Task 0, não anexo. Todo item "NÃO CONGELAR" tem o achado correspondente citado |
| **Onda 0 virar refatoração visual** — `QuickOutModal` é o arquivo mais degradado do projeto e convida a arrumar tudo | **Alta** | Escopo explícito por bug; o resto do arquivo é migração (B), não onda 0 |
| Corrigir F-07 e depois a migração reintroduzir o padrão errado | Média | O teste de F-07 é de **requisito**, não de caracterização: sobrevive à migração e falha se ela regredir |
| Decisões C ficarem pendentes e bloquearem a Task 0 | Média | F-01 e F-05 estão isoladas em G-3; nenhuma outra frente depende delas |
| UF-07 e UF-29 causarem dano ao usuário até a Fase 8 | Média | G-2 oferece as mitigações mínimas para decisão |
| F-06 ser "consertado" com `key` sem teste, quebrando o modo `create` | Baixa | O teste cobre os dois modos e a troca de produto |

---

## 7. Decisões que precisam da sua aprovação

**G-1 · A onda 0 bloqueia a Fase 7?** Recomendo que sim para F-06 e F-07 — o primeiro inutiliza uma tela, o segundo esconde do usuário a causa real de uma falha de estoque, e ambos poluiriam o baseline dos characterization tests. C-2 e C-3 vão junto por estarem no mesmo arquivo.

**G-2 · Mitigações interinas.** Dois itens **B** causam dano real hoje:
- **UF-29** — trocar `overflow-hidden` por `overflow-x-auto` (uma palavra) devolve o acesso às colunas cortadas no mobile.
- **UF-07** — expor "Limpar filtros" fora do cabeçalho da tabela (~10 linhas) tira o usuário do beco sem saída no celular.

Ambas são descartadas na migração. Aplicar agora, ou aguentar até a Fase 8?

**G-3 · Decisões de produto (categoria C).**
- **F-01 — DECIDIDO em 29/08/2026.** A interface deve **impedir**: a quantidade de saída não pode ultrapassar o saldo disponível. Confirmação desabilitada quando `quantidade > saldo`, feedback claro no momento do impedimento, nunca representar a quantidade impossível apenas como "Estoque zerado", nunca permitir estoque negativo. A regra do backend não muda — a UI passa a impedir **antes** de submeter, em vez de deixar o 422 ser a primeira notícia. Aplicado **durante** a migração do `QuickOutModal` (Fase 8), não antes: é a mesma tela que muda de sistema de diálogo, e o comportamento atual está classificado ALTERAR INTENCIONALMENTE em §4 — nenhum characterization test o congela.
- **F-05** — política de SKU: normalizar na escrita, unicidade case-insensitive, ou manter como está e parar de exibir em maiúsculas? **Segue pendente.**

**G-4 · Remover `FinanceDashboard.tsx` e `SalesDashboard.tsx`?** Zero imports confirmados; `frontend.md` exige confirmação explícita antes de apagar.

---

## Estado do gate

**Concluído.** Nenhum código, CSS ou teste alterado. 31 itens classificados: **7 em A**, **12 em B**, **2 em C**, **7 em D** (F-10 registrado durante a onda 0), mais os 3 itens de housekeeping.

Aguardando **G-1 a G-4** antes da **Fase 7 — Implementation Plan**.

---

## Atualização — 29/08/2026

A Task 0 (characterization tests, `characterization-plan.md`) foi implementada: 189 testes na suíte de frontend, todos verdes, nenhum código de produção alterado.

**F-01 decidido** (registrado em §3.3 e §7 acima): a interface vai **impedir** quantidade maior que o saldo. Nenhum characterization test força o comportamento atual (`max = saldo × 2`, "Estoque zerado" sem impedimento) a continuar — está marcado ALTERAR INTENCIONALMENTE.

**N-9 decidido** (ver `characterization-plan.md` §4 e §15): o `QuickOutHistoryModal` **preserva** filtros, busca e página entre fechamento e reabertura. Passa a ser PRESERVAR. Coberto por characterization test (QOH-8, em `QuickOutHistoryModal.test.tsx`).

**Q-1 decidido** (ver `characterization-plan.md` §11): a paridade responsiva/mobile da Fase 8 será validada **manualmente** no navegador — 320px quando relevante, 375px, viewport baixo, transição em torno de `md`, clipping, rolagem, `max-height`, alvos de ~44px, grade de atalhos, paridade de capacidades desktop/mobile. Nenhum runner E2E (Playwright/Cypress/Selenium) é introduzido. Characterization tests continuam responsáveis pelo comportamento funcional; a verificação manual cobre apenas o que o jsdom não pode ver (§11).

**F-05 continua pendente** — não bloqueia a Task 0 nem a migração do `QuickOutModal`/`QuickOutHistoryModal`; bloqueia especificamente a migração do `ProductFormModal`.
