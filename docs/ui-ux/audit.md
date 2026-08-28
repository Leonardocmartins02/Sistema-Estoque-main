# Fase 1 — UI/UX Audit

**Data:** 28/08/2026
**Escopo:** `packages/frontend` — diagnóstico apenas. Nenhuma linha de código de produção foi alterada nesta fase.
**Método:** leitura integral dos arquivos de `src/`, contagem de tokens visuais via `grep`, e uma sonda de teste temporária (criada e removida) para confirmar/refutar uma hipótese de bug de hooks.

---

## 1. Inventário do que existe hoje

| Camada | Arquivos |
|---|---|
| Shell | `App.tsx`, `main.tsx`, `index.css`, `index.html`, `tailwind.config.js` |
| Auth | `auth/AuthContext.tsx`, `components/LoginPage.tsx` |
| Tela principal | `ProductDashboard.tsx` (344 linhas, orquestrador) |
| Apresentação de produtos | `products/ProductsTable.tsx`, `products/ProductCardList.tsx`, `products/ProductActionsMenu.tsx`, `products/StatusFilterMenu.tsx`, `products/types.ts` |
| Primitivos de UI | `ui/Button`, `ui/Input`, `ui/Select`, `ui/Badge`, `ui/Card`, `ui/Modal`, `ui/DataTable`, `ui/MenuPopover`, `ui/ConfirmDialog`, `ui/ToastProvider`, `ui/LowStockBanner`, `ui/ApiStatusBanner` |
| Diálogos de fluxo | `ProductFormModal`, `MovementFormModal`, `MovementHistoryModal`, `AdjustmentFormModal`, `QuickOutModal`, `QuickOutListModal`, `QuickOutHistoryModal` |
| Código morto | `FinanceDashboard.tsx`, `SalesDashboard.tsx` (confirmado: zero imports) |
| Testes de UI | 13 arquivos em `test/` — rede de segurança real para a refatoração |

**Pontos genuinamente bons, que devem ser preservados e usados como referência:**

- `ui/MenuPopover.tsx` — implementa o padrão WAI-ARIA de menu completo (setas, Home/End, `aria-haspopup`, `menuitemcheckbox`). É o componente de melhor qualidade do projeto.
- `ui/Modal.tsx` — wrapper fino e correto sobre Radix Dialog, com restauração de foco explícita.
- `ui/ToastProvider.tsx` — duas live regions sempre montadas (polite/assertive). Decisão correta e não óbvia.
- `AdjustmentFormModal.tsx` — o fluxo mais maduro do produto (preview de diferença, confirmação estruturada, tratamento de conflito 409). **É o padrão de qualidade que o resto deve alcançar.**
- Hooks de dados (`useProductsQuery`, `useProductMutations`, `useProductStockSummary`) já isolam estado de apresentação.

O problema não é ausência de qualidade — é **ausência de uniformidade**. O produto tem uma camada moderna e correta (Radix / DataTable / Adjustment) convivendo com uma camada antiga e improvisada (os três `QuickOut*`, `MovementHistoryModal`), e nada as costura.

---

## 2. Resumo por severidade

| Severidade | Qtd | Significado |
|---|---|---|
| **CRÍTICO** | 6 | Quebra acessibilidade básica, perde funcionalidade em algum dispositivo, ou expõe risco operacional real |
| **ALTO** | 12 | Dano claro à eficiência, previsibilidade ou sustentabilidade; o usuário sente |
| **MÉDIO** | 14 | Inconsistência perceptível, atrito acumulado |
| **BAIXO** | 8 | Polimento, ruído visual |

Total: **40 achados**, mais **4 achados funcionais** registrados separadamente (seção 7).

---

## 3. Achados CRÍTICOS

### C-1 · Três sistemas de diálogo paralelos, dois deles inacessíveis
**Categorias:** acessibilidade, consistência, design system, dívida técnica visual

Existem três implementações independentes de modal:

1. `ui/Modal.tsx` (Radix) — usado por `ProductFormModal`, `MovementFormModal`, `AdjustmentFormModal`, `ConfirmDialog`. **Correto.**
2. `MovementHistoryModal.tsx:88-99` — Radix Dialog cru, ignorando o primitivo. Perde o header padronizado, o botão de fechar padronizado e o `size`.
3. `QuickOutModal.tsx:246`, `QuickOutListModal.tsx:184`, `QuickOutHistoryModal.tsx` — `createPortal` manual, **sem `role="dialog"`, sem `aria-modal`, sem `aria-labelledby`, sem focus trap, sem retorno de foco, sem bloqueio de scroll do fundo**.

Consequência concreta: quem usa teclado e abre "Baixa de Produtos" continua tabulando pelo conteúdo atrás do modal; um leitor de tela nunca anuncia que um diálogo abriu. O `QuickOutModal` chega a implementar um listener global de `Escape`/`Enter` à mão (`QuickOutModal.tsx:82-101`) — reimplementando mal o que o Radix já faz.

Isso viola diretamente a regra registrada em `CLAUDE.md`: *"Um único primitivo de modal acessível no projeto — não introduzir um novo sistema de diálogo."*

---

### C-2 · `console.log` de depuração em produção no caminho de baixa de estoque
**Categorias:** dívida técnica visual, feedback

`QuickOutModal.tsx` linhas 33, 49, 50, 53, 55, 58, 114, 142, 145 — nove `console.log`, incluindo o dump do objeto `product` e dos valores do formulário a cada render e a cada submit. A linha 58 chega a logar `window.getComputedStyle` do modal.

Além do ruído, isso contraria a regra do projeto de nunca logar payloads. É o sintoma mais visível de que esse arquivo nunca passou por revisão.

---

### C-3 · Bloco de erro do servidor duplicado no `QuickOutModal`
**Categorias:** feedback, dívida técnica visual

`QuickOutModal.tsx:239-260` e `QuickOutModal.tsx:266-291` renderizam **o mesmo bloco de erro, duas vezes**, quando `serverError` existe. Quem tenta dar baixa com estoque insuficiente vê a mensagem repetida na tela. Há inclusive um comentário `{/* Observação (removida duplicidade) */}` que evidencia uma remoção incompleta.

---

### C-4 · Paginação renderizada acima da lista no mobile
**Categorias:** responsividade, navegação, hierarquia visual

Em `ProductDashboard.tsx`: a tabela desktop está em `hidden md:block` (linha 176), a paginação vem em seguida (linha 216), e a lista de cards mobile só depois (linha 239).

No desktop a ordem lida é tabela → paginação. **No mobile, como a tabela está oculta, a ordem vira paginação → lista de produtos.** Quem abre no celular encontra "Página 1 de 4 / Próxima" antes de ver qualquer produto. É a definição literal de "mobile como desktop espremido": o layout mobile é efeito colateral do desktop, não uma decisão.

---

### C-5 · Perda de funcionalidade no mobile: baixa rápida e estoque mínimo somem
**Categorias:** responsividade, UX, feedback

`ProductCardList.tsx` expõe apenas `onMove` e o menu de mais ações. O botão de **baixa rápida** (`actions.onQuickOut`), que na tabela desktop é um botão dedicado por linha (`ProductsTable.tsx:222-230`), **não existe no card mobile**. O `minStock` também não aparece em nenhum lugar do card.

Ou seja: no celular — justamente o dispositivo de quem está fisicamente no estoque com o produto na mão — a ação mais operacional do sistema está indisponível, sem alternativa. O brief é explícito: *"não esconder informação crítica sem alternativa."*

---

### C-6 · A tabela principal não mostra o estoque mínimo, mas mostra o status derivado dele
**Categorias:** legibilidade, UX, hierarquia visual

`ProductsTable.tsx` tem as colunas: seleção, Nome, SKU, Saldo Atual, Status, Ações. **Não há coluna de estoque mínimo.**

O badge "Estoque Baixo" é calculado por `balance < minStock` (`products/types.ts`), mas não dá para ver o `minStock` sem abrir o modal de edição. A pessoa vê o *veredito* sem os *dados que o produziram* — não consegue julgar se o alerta faz sentido nem decidir quanto comprar. Ironicamente, o `QuickOutListModal` (um modal secundário) **tem** a coluna "Mín. Estoque". A informação existe, está apenas na tela errada.

---

## 4. Achados ALTOS

### A-1 · A linha da tabela é dominada por ações secundárias
**Categorias:** hierarquia visual, densidade, UX (Lei de Hick)

Cada linha traz três controles fixos: a pílula "Movimentar", um botão de ícone vermelho de baixa rápida, e o menu "⋯". Com 10 linhas por página são **30 paradas de tabulação** antes da paginação, e uma coluna de ações visualmente mais pesada que o próprio saldo — que é o dado que importa.

O botão de baixa rápida é pintado com `text-red-700 hover:bg-red-50` em **toda** linha, repetindo tom destrutivo 10× e diluindo o significado do vermelho no produto inteiro.

### A-2 · Ações em massa perigosas com peso visual de ação comum
**Categorias:** UX, hierarquia de ações, risco de erro

"Zerar página" e "Excluir página" (`ProductDashboard.tsx:181-199`) ficam no rodapé da tabela como botões `size="sm"` comuns. "Excluir página" apaga **todos os produtos da página e suas movimentações**. Há `ConfirmDialog`, o que é bom — mas o alvo é grande, o rótulo é curto e a posição é a mesma de uma ação trivial. Nada na interface sinaliza que essas duas operam sobre um conjunto, nem *qual* conjunto.

### A-3 · Seleção múltipla sem "selecionar todos", sem contador visível e sem persistência
**Categorias:** UX, feedback

Existe checkbox por linha, mas: não há checkbox no cabeçalho; o único retorno da seleção é o número no botão vermelho "Excluir (3)" no topo da toolbar; e `selectedIds` não é limpo ao trocar de página nem ao filtrar — é possível excluir produtos que não estão mais visíveis na tela.

### A-4 · Três cores de foco diferentes no mesmo produto
**Categorias:** consistência, acessibilidade, design system

Contagem real: `ring-indigo-600` (13×), `ring-brand` (11×), `ring-blue-600` (3×), mais `indigo-500`, `indigo-300`, `blue-200`, `amber-700`.

`Button` foca em indigo-600. `Input`/`Select` focam em **blue**-600. Os inputs crus dentro dos modais focam em `brand`. Tabular por um formulário faz o anel de foco mudar de cor entre um campo e o botão que o submete. E `brand.DEFAULT` (`#4F46E5`) é **exatamente** `indigo-600` — dois nomes de token para o mesmo valor.

### A-5 · `select-none` na tabela inteira impede copiar SKU e saldo
**Categorias:** UX, dívida técnica visual

`DataTable.tsx` aplica `select-none` em seis lugares (linhas 95, 115, 132, 142, 178, 198), inclusive nas células de dados. Em um sistema de estoque, **copiar um SKU para colar em outro sistema é tarefa diária**. Isso provavelmente foi adicionado para evitar seleção acidental ao clicar em cabeçalhos, mas o remédio custa mais que a doença.

### A-6 · Números não são comparáveis visualmente
**Categorias:** legibilidade, densidade

`ProductsTable.tsx:186-195` renderiza `{p.balance} un.` alinhado à direita, mas sem `tabular-nums`. Com a Inter em modo proporcional, os dígitos têm larguras diferentes: uma coluna com 9, 120 e 1100 não alinha as ordens de grandeza. Também não há separador de milhar — `toLocaleString('pt-BR')` é usado no `QuickOutModal` mas não na tabela, outra inconsistência.

### A-7 · Duas ações diferentes disparam a mesma expansão, e `aria-controls` aponta para o vazio
**Categorias:** acessibilidade, UX (affordance)

O nome do produto **e** o SKU são dois `<button>` distintos, ambos com `aria-expanded` e ambos com `aria-controls={describeRow(p)}` apontando para o mesmo id (`ProductsTable.tsx:120-160`). O elemento referenciado **só existe quando expandido** — `aria-controls` para id inexistente é inválido. Além disso, nada indica visualmente que o nome é clicável (sem chevron; só `hover:underline`).

### A-8 · Dois títulos de mesmo peso competindo pela atenção
**Categorias:** hierarquia visual, information architecture

- `App.tsx:38` — `<h1 class="text-3xl md:text-4xl font-bold">SimpleStock</h1>`
- `ProductDashboard.tsx:132` — `<h2 class="text-3xl font-semibold">Produtos</h2>`

A marca (que já se sabe, todo dia) recebe **mais** peso tipográfico que o nome da tela (que é o que precisa ser lido). Em um app interno, a marca deve encolher; o contexto deve crescer.

### A-9 · Formulários com `id` fixo e sem uso do primitivo `Input`
**Categorias:** design system, acessibilidade, consistência

`ProductFormModal` usa `id="name"`, `id="sku"`, `id="minStock"`, `id="description"`; `MovementFormModal` usa `id="movement-type"` etc. O `CLAUDE.md` exige `useId()`. Duas instâncias de `ProductFormModal` (criar e editar) são montadas ao mesmo tempo em `ProductDashboard` — hoje o Radix desmonta o conteúdo fechado, o que salva o projeto por acidente, não por design.

Pior: esses dois modais **não usam `ui/Input`**. Reescrevem label + input + `<p>` de erro à mão, com classes ligeiramente diferentes (`p-2` em vez de `py-2 px-3`, `focus:ring-brand` em vez de `focus:ring-blue-600`). O primitivo existe e é ignorado nos dois formulários mais usados do sistema.

### A-10 · Estados vazios sem saída
**Categorias:** UX, feedback

`ProductsTable.tsx:241` e `ProductCardList.tsx:37`: `"Nenhum produto encontrado."` — exatamente o antipadrão que o brief cita. Não distingue *"você ainda não cadastrou nada"* de *"seu filtro não retornou nada"*, e não oferece ação (limpar filtros / cadastrar produto).

### A-11 · Toast de erro desaparece em 3,5s
**Categorias:** feedback, acessibilidade

`ToastProvider.tsx:59` aplica `durationMs: 3500` como padrão para **todos** os tipos. Uma mensagem como "Estoque insuficiente" — a única informação sobre por que a operação falhou — some sozinha antes de muita gente terminar de ler. Erros devem persistir até dispensa manual.

### A-12 · Violação de regras de hooks no `QuickOutListModal`
**Categorias:** dívida técnica visual

`QuickOutListModal.tsx:27` — `if (!open) return null;` está **antes** de oito chamadas de `useState`/`useEffect`. Verifiquei com uma sonda de teste temporária: **não quebra hoje** (React não lança), mas emite `Warning: Internal React error: Expected static flag was missing. Please notify the React team.` ao abrir. É uma bomba-relógio que a refatoração desarma naturalmente ao migrar o componente para o primitivo `Modal`.

---

## 5. Achados MÉDIOS

| ID | Achado | Categorias | Evidência |
|---|---|---|---|
| M-1 | Seis níveis de border-radius em uso (`rounded-md` 40×, `rounded-lg` 8×, `rounded` 8×, `rounded-full` 6×, `rounded-2xl` 3×, `rounded-xl` 2×). Os `2xl`/`xl` estão só nos `QuickOut*`, que também usam `shadow-2xl` e `bg-gradient-to-b` — uma linguagem visual estranha ao resto | consistência, design system | `QuickOutModal.tsx:157-161` |
| M-2 | Tamanhos de fonte arbitrários fora da escala: `text-[18px]` (3×), `text-[11px]` (2×), `text-[10px]` (1×) | design system, legibilidade | `QuickOutModal.tsx:160`, `StatusFilterMenu.tsx:44` |
| M-3 | `text-[10px]` no contador do filtro de status é pequeno demais para leitura confortável | legibilidade, acessibilidade | `StatusFilterMenu.tsx:44` |
| M-4 | `text-gray-400` (#9CA3AF sobre branco = **2,5:1**) reprova em WCAG AA. Usado como texto real no SKU do `QuickOutModal:164` e no separador "até" do `QuickOutHistoryModal:87` | acessibilidade | 10 ocorrências |
| M-5 | Setas de ordenação `▲` dos `QuickOut*` não têm `aria-hidden` — o leitor de tela anuncia o glifo | acessibilidade | `QuickOutListModal.tsx:101,116,131` |
| M-6 | `Badge` tem `hover:scale-[1.02]` — animação em elemento **não interativo**, que reage ao mouse sem oferecer nada | UX (affordance falsa), design system | `Badge.tsx:20` |
| M-7 | Classe `animate-fade-in` usada mas **não definida** em `tailwind.config.js` — a animação simplesmente não acontece | dívida técnica visual | `MovementHistoryModal.tsx:90` |
| M-8 | `DataTable` com `sortable: true` e sem `headerRender` renderiza **só a seta**, sem o rótulo da coluna. Hoje não afeta ninguém porque `ProductsTable` sempre passa `headerRender` — armadilha latente | dívida técnica visual, legibilidade | `DataTable.tsx:138-156` |
| M-9 | `Input` não tem estilo de `disabled` nem de `readonly` | design system, estados | `Input.tsx` |
| M-10 | `isLoading` no `Button` mostra spinner mas **não desabilita** o botão; cada chamador precisa lembrar de passar `disabled` também — e `ProductFormModal:196` passa `disabled` sem `isLoading` (sem spinner), enquanto `MovementFormModal:172` passa os dois | estados, consistência | `Button.tsx:28-32` |
| M-11 | Container `max-w-5xl` (1024px) limita a tabela em telas grandes; monitores de operação ficam com metade da largura vazia | responsividade, densidade | `App.tsx:52` |
| M-12 | Carregamento é sempre a string "Carregando..." (cinco lugares distintos, três estilos diferentes). Sem skeleton, sem preservação de layout — a página salta quando os dados chegam | feedback, consistência | `App.tsx:13`, `DataTable.tsx:106`, `ProductCardList.tsx:21` |
| M-13 | Datas formatadas com `toLocaleString()` sem locale explícito — depende da configuração do navegador | consistência, legibilidade | `MovementHistoryModal.tsx:252` |
| M-14 | `ConfirmDialog` renderiza um corpo genérico fixo ("Confirme para continuar. Esta ação afeta os dados do estoque.") **abaixo** da descrição específica — texto de enchimento que se aprende a ignorar | UX, feedback | `ConfirmDialog.tsx:63` |

---

## 6. Achados BAIXOS

| ID | Achado | Categorias |
|---|---|---|
| B-1 | Botão de fechar do `Modal` usa o caractere `✕` em vez de um ícone `lucide-react` (que já é dependência) — peso e alinhamento ópticos inconsistentes com o resto |	consistência |
| B-2 | Paginação usa "← Anterior" / "Próxima →" com setas em texto; o resto do app usa ícones `lucide` | consistência |
| B-3 | `LowStockBanner` e `ApiStatusBanner` usam a mesma cor âmbar para severidades muito diferentes (aviso de negócio × sistema fora do ar) | hierarquia visual, feedback |
| B-4 | `Card` aceita `interactive` que só troca a sombra — affordance fraca demais para comunicar clicabilidade | affordance |
| B-5 | `FinanceDashboard.tsx` e `SalesDashboard.tsx` continuam no repositório sem nenhum import | dívida técnica visual |
| B-6 | Header usa `backdrop-blur` + `bg-white/60` — glassmorphism sem propósito num app operacional; reduz contraste do texto sobre conteúdo rolando | legibilidade |
| B-7 | Placeholders no padrão "Ex.: ..." são bons, mas `QuickOutListModal:75` usa placeholder **sem label** — o único caso do projeto | acessibilidade |
| B-8 | Sem dark mode e sem `color-scheme` além de `light` — decisão a tomar conscientemente na Fase 4, não a herdar por omissão | design system |

---

## 7. Achados funcionais (registrados separadamente, fora do escopo do redesign)

Conforme a **regra de escopo** do brief, o que a auditoria revelou de comportamento — não de aparência:

| ID | Achado | Observação |
|---|---|---|
| F-1 | `QuickOutModal.tsx:225` permite quantidade até `currentBalance * 2` e o preview exibe "Estoque negativo" em vermelho — a UI **antecipa** saldo negativo. Se o backend rejeita (deve rejeitar, por `CLAUDE.md`), o usuário só descobre depois de submeter | Não alterar nesta refatoração. Precisa de decisão de produto: a UI deve impedir ou apenas avisar? |
| F-2 | `QuickOutListModal` e `QuickOutHistoryModal` fazem `fetch` manual em `useEffect` em vez de React Query — já está no backlog do `CLAUDE.md`. Sem cancelamento de requisição: digitar rápido na busca pode aplicar uma resposta antiga (race condition) | Corrigir junto com a migração para o primitivo `Modal`, mas registrar como correção funcional no commit |
| F-3 | `QuickOutHistoryModal` ordena **apenas a página atual** em memória (`viewItems`), dando a impressão de ordenação global | Mesmo backlog de paginação real |
| F-4 | Seleção múltipla não é limpa ao paginar/filtrar (ver A-3) — tem consequência de dados, não só de UI | Precisa de decisão antes da Fase 8 |

---

## 8. Conceitos de UX aplicados neste diagnóstico

**Hierarquia visual** — *o que é:* a ordem em que os elementos capturam a atenção, criada por tamanho, peso, cor, contraste e posição. *Que problema resolve:* sem ela o olho não sabe por onde começar e lê tudo sequencialmente, o que é lento. *No nosso sistema:* A-8 (marca maior que o contexto) e A-1 (ações secundárias mais pesadas que o saldo). *Exemplo ruim:* nossa linha de tabela hoje, onde três controles competem com o número que a pessoa veio consultar. *Como vamos aplicar:* um único elemento dominante por região — o saldo domina a linha, a ação primária domina o cabeçalho da página.

**Carga cognitiva** — *o que é:* a quantidade de informação que a memória de trabalho precisa segurar para realizar uma tarefa. *Que problema resolve:* limita erros e fadiga em uso recorrente. *No nosso sistema:* C-6 é carga cognitiva pura — vê-se "Estoque Baixo" e é preciso abrir um modal para lembrar qual era o mínimo. *Exemplo ruim:* obrigar alguém a manter um número na cabeça enquanto navega. *Como vamos aplicar:* colocar mínimo e saldo lado a lado, para que a comparação seja **visual**, não mental.

**Reconhecimento em vez de recordação** — *o que é:* mostrar as opções em vez de exigir que a pessoa se lembre delas. *No nosso sistema:* A-3 — é preciso lembrar quais itens foram selecionados em páginas anteriores, porque a interface não mostra.

**Affordance** — *o que é:* a propriedade visual que sugere como um elemento pode ser usado. *No nosso sistema:* A-7 (o nome do produto expande mas não parece expansível) e M-6 (o badge não faz nada mas reage ao mouse). Ambos são falhas de affordance, em direções opostas: uma esconde, a outra mente.

**Lei de Hick** — *o que é:* o tempo de decisão cresce com o número de opções simultâneas. *No nosso sistema:* A-1 — três controles por linha × 10 linhas obrigam a uma micro-decisão em cada uma.

**Lei de Fitts** — *o que é:* o tempo para atingir um alvo depende do tamanho dele e da distância até ele. *No nosso sistema:* botões `text-xs px-2.5 py-1.5` (~26px de altura) ficam abaixo do alvo mínimo confortável, e o botão de ícone da baixa rápida tem ~28px — pequeno demais para uma ação executada dezenas de vezes por dia.

**Design tokens** — *o que é:* nomear valores de design (cor, espaço, raio) e referenciá-los em vez de escrever o valor literal. *Que problema resolve:* torna a mudança global barata e a inconsistência impossível por construção. *Exemplo ruim:* nosso A-4 — três cores de foco porque cada componente escolheu a sua. *Como vamos aplicar:* Fase 5, tokens semânticos antes de qualquer estilização de componente.

**Cor semântica** — *o que é:* cor que carrega significado estável no produto inteiro. *Exemplo ruim:* A-1, onde o vermelho aparece em toda linha para uma ação rotineira — quando tudo é vermelho, nada é urgente. *Como vamos aplicar:* reservar vermelho para destrutivo/erro, e sempre acompanhado de texto e ícone (o brief exige, e o WCAG 1.4.1 também).

---

## 9. Riscos identificados para as fases seguintes

1. **A rede de testes cobre bem os primitivos, mal os fluxos.** Há testes para `Modal`, `DataTable`, `MenuPopover`, `ConfirmDialog`, `ProductActionsMenu` — mas **nenhum** para `QuickOutModal`, `QuickOutListModal`, `QuickOutHistoryModal` ou `ProductsTable`. São exatamente os arquivos que mais precisam mudar. **Recomendação: escrever testes de caracterização desses componentes ANTES de tocá-los**, como Task 0 da Fase 8. Sem isso, "preservar comportamento" vira promessa, não garantia.
2. **Migrar os `QuickOut*` para o primitivo `Modal` altera comportamento de teclado** (o `Enter` global do `QuickOutModal` desaparece; o trap do Radix muda a ordem de foco). É uma melhoria, mas precisa ser comunicada — a regra de preservação exige listar atalhos existentes antes de mudar. Já mapeado: `Escape` fecha, `Enter` submete de qualquer lugar exceto textarea, clique no backdrop fecha, `autoFocus` na busca do `QuickOutListModal`.
3. **Mudar o container de `max-w-5xl` para largura maior** altera a densidade de todas as telas de uma vez. Deve ser task isolada, com avaliação visual antes/depois.
4. **`brand` no `tailwind.config.js` é usado em 11 lugares.** Removê-lo em favor de tokens semânticos é seguro, mas precisa ser feito em uma única task, não espalhado.

---

## 10. Dúvidas a resolver antes da Fase 4

Nenhuma delas bloqueia a Fase 2 — mas todas mudam a direção visual.

1. **Contexto de uso:** o sistema é usado majoritariamente em desktop de escritório, ou também no celular dentro do estoque físico? A resposta define se o mobile é caso secundário ou co-primário (e a gravidade real de C-5).
2. **Volume:** o brief cita "300 produtos". É a ordem de grandeza real? Isso decide se 10 itens por página bastam ou se precisamos de densidade alta e busca mais forte.
3. **Multiusuário:** quantas pessoas usam simultaneamente? O `AdjustmentFormModal` já trata conflito 409, o que sugere que sim — isso influencia quanto o design precisa comunicar "o dado pode ter mudado".
4. **Escopo do dark mode:** entra nesta refatoração ou fica registrado como trabalho futuro? Decidir agora é barato; decidir depois custa retrabalho em todos os tokens.
5. **Marca:** o indigo atual (`#4F46E5`) é escolha deliberada ou o padrão do Tailwind que ficou? Isso define se a Fase 4 pode propor outra cor primária.

---

## Estado da Fase 1

**Concluída.** Nenhum código de produção alterado. Aguardando aprovação para iniciar a **Fase 2 — User Flow Audit**.
