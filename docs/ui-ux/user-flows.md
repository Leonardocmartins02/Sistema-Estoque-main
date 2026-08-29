# Fase 2 — User Flow Audit

**Data:** 28/08/2026
**Escopo:** auditoria dos fluxos reais do sistema do ponto de vista de quem opera. Nenhum arquivo de produto foi alterado, nenhum componente refatorado, nenhum estilo tocado.
**Fontes obrigatórias lidas:** `AGENTS.md`, `CLAUDE.md`, `docs/current-state.md`, `docs/ui-ux/audit.md`, e o código real de cada fluxo (frontend **e** as rotas de backend correspondentes — sem ler o backend não é possível auditar validação, mensagem de erro e reversibilidade).

**Método:** leitura de código dos dois pacotes + duas sondas de teste temporárias (criadas, executadas e removidas) para confirmar ou refutar hipóteses em vez de afirmá-las. Uma delas **confirmou um defeito real** no fluxo 4 (seção 14).

---

## 0. Decisões recebidas, aplicadas neste documento

| # | Decisão | Como foi aplicada |
|---|---|---|
| 1 | Mobile é cenário relevante | Cada fluxo tem seção "Desktop vs Mobile". A ausência de baixa rápida e estoque mínimo no card permanece **CRÍTICO**, e a auditoria de fluxo encontrou um agravante ainda maior (UF-07) |
| 2 | Escala real desconhecida | Nenhum número inventado. Onde a conclusão muda com a escala, há a marca **[escala]** com o comportamento em *dezenas* e em *centenas* |
| 3 | Simultaneidade desconhecida | O 409 é tratado como requisito comprovado do sistema, não como evidência de volume. Nenhuma estimativa de usuários simultâneos |
| 4 | Dark mode fora de escopo | Não aparece como recomendação. Registrado apenas onde um achado de fluxo tem implicação em token semântico |
| 5 | Indigo não confirmado como marca | Nenhuma cor citada como decisão. Cor aparece só como *portadora de significado* (ex.: verde/vermelho no histórico) |

---

## 1. Convenções de leitura

**Severidade** (do ponto de vista do fluxo, não da estética):

- **CRÍTICO** — impede a tarefa, perde trabalho do usuário, ou permite um erro irreversível sem barreira.
- **ALTO** — a tarefa é possível mas custa passos, memória ou confiança desproporcionais.
- **MÉDIO** — atrito perceptível, acumula em uso recorrente.
- **BAIXO** — polimento.

**Taxonomia** (usada no fechamento, seção 16):

- **UI** — o problema está em como algo é mostrado. Resolvido desenhando melhor.
- **UX** — o problema está na estrutura do fluxo (passos, ordem, informação disponível). Resolvido repensando o caminho, não repintando.
- **DÍVIDA TÉCNICA** — o comportamento está errado por causa de como o código foi construído.
- **REGRA DE NEGÓCIO** — comportamento deliberado do domínio. **Não deve ser alterado por esta refatoração.**

---

## 2. Mapa geral dos fluxos

| # | Fluxo | Passos (desktop) | Passos (mobile) | Confirmação? | Reversível? | Severidade |
|---|---|---|---|---|---|---|
| 1 | Login | 3 | 3 | — | — | MÉDIO |
| 2 | Encontrar produto | 2 a 30+ **[escala]** | 2 a 30+, **sem ordenar nem filtrar** | — | — | CRÍTICO |
| 3 | Criar produto | 6 | 6 | Não | Sim (excluir) | ALTO |
| 4 | Editar produto | 3 + **redigitar tudo** | 3 + redigitar tudo | Não | Sim (editar de novo) | CRÍTICO |
| 5 | Entrada de estoque | 4 | 4 | **Não** | **Não** | ALTO |
| 6 | Saída de estoque | 5 | 5 | **Não** | **Não** | CRÍTICO |
| 7 | Baixa rápida | 3 (atalho) ou 5 (lista) | **5 (só lista)** | Sim (botão final) | **Não** | CRÍTICO |
| 8 | Ajuste de estoque | 6 | 6 | **Sim, em 2 passos** | Não | MÉDIO |
| 9 | Histórico | 2 + leitura | 2 + leitura | — | — | ALTO |
| 10 | Estoque baixo | 2 | 2 + **sem saída do filtro** | — | — | CRÍTICO |
| 11 | Exclusão de produto | 3 | 3 (só individual) | Sim | **Não** | ALTO |

Leitura desta tabela: **as três operações que alteram saldo têm graus de cerimônia opostos entre si.** O ajuste (que não pode deixar saldo negativo e é bloqueado por 409) tem dois passos de confirmação. A entrada e a saída manuais — igualmente permanentes — não têm nenhum. A baixa rápida tem um botão de confirmação, mas dentro de um modal que nem sequer é um diálogo acessível. Essa incoerência é o achado estrutural desta fase.

---

## 3. Fluxo 1 — Login

**Objetivo do usuário:** entrar no sistema e chegar à lista de produtos.

**Caminho atual:** `LoginPage` → `POST /auth/login` → token em `localStorage` → `App` renderiza `ProductDashboard`.

**Passos necessários:** 3 (e-mail, senha, Entrar).

**Informação necessária:** credenciais. Nada mais é pedido nem oferecido.

**Fricções:**
- **UF-01 · MÉDIO** — Não há recuperação de senha, nem qualquer texto dizendo a quem pedir acesso. Quem esquece a senha não tem caminho dentro do produto.
- **UF-02 · MÉDIO** — O backend aplica rate limit de 10 tentativas / 15 min no login (`routes/auth.ts`). Quando ele dispara, a tela mostra a mensagem do servidor num parágrafo solto, sem diferenciar "senha errada" de "você está bloqueado por 15 minutos". São situações que exigem ações opostas do usuário — tentar de novo × esperar.
- **UF-03 · MÉDIO** — O estado de restauração de sessão é a string `"Carregando..."` centralizada na tela inteira (`App.tsx:11-17`). Numa rede lenta, a primeira impressão do produto é uma página quase em branco.

**Risco de erro:** baixo. A mensagem de erro é deliberadamente idêntica para "usuário não existe" e "senha errada" — isso é **regra de negócio de segurança** (evita enumeração de contas) e não deve ser "melhorada" tornando-a específica.

**Feedback atual:** botão com spinner e `disabled` durante o envio; erro do servidor em `<p role="alert">`. Correto no essencial.

**Desktop vs Mobile:** equivalente. Cartão `max-w-sm` centralizado funciona nas duas larguras.

**Acessibilidade relevante:** labels persistentes via o primitivo `Input`, `autoComplete="username"/"current-password"` corretos, `noValidate` com validação Zod, erro anunciado por `role="alert"`. **Falta:** o erro do servidor não está ligado aos campos por `aria-describedby`, e o foco não é movido para a mensagem — quem usa leitor de tela ouve o alerta mas continua com o foco no botão.

**Severidade: MÉDIO.**

**Oportunidade:** distinguir os três estados de falha que hoje são um só parágrafo (credencial inválida / bloqueio temporário / API fora do ar) e dar destino ao usuário em cada um.

---

### 3.1 · Achado que atravessa todos os fluxos: expiração de sessão silenciosa

**UF-04 · ALTO — UX + DÍVIDA TÉCNICA**

`AuthContext.tsx` registra `logout` como handler global de 401 no `httpClient`. Qualquer chamada que retorne 401 (token expirado, revogado) **derruba a sessão imediatamente e troca a árvore inteira pela `LoginPage`**.

Consequência concreta: alguém está no `AdjustmentFormModal`, já digitou o motivo do ajuste e a nova quantidade, clica em "Confirmar ajuste" — o token expirou. O modal, o formulário e todo o texto digitado desaparecem, e a tela de login aparece **sem nenhuma mensagem explicando o que houve**. A pessoa reentra e não sabe se o ajuste foi aplicado ou não.

Isso viola *visibility of system status* no ponto mais caro possível: a transição não é anunciada, e o trabalho perdido não é recuperável. Aparece em todos os 11 fluxos, por isso está aqui e não dentro de um deles.

---

## 4. Fluxo 2 — Encontrar produto

**Objetivo do usuário:** localizar um produto específico por nome ou SKU, ou localizar o conjunto de produtos em determinado estado.

**Caminho atual:** campo de busca (debounce 300ms, `useDebouncedValue`) → `GET /products` com `search`/`page`/`sortBy`/`sortDir`/`status` → `ProductsTable` (desktop) ou `ProductCardList` (mobile).

**Passos necessários:** 2 no melhor caso (focar a busca, digitar). Até 30+ cliques no pior caso de paginação. **[escala]**

**Informação necessária para decidir:** nome, SKU, saldo, estoque mínimo, status. **O estoque mínimo não está na tabela** (achado C-6 da Fase 1, confirmado aqui pelo ângulo do fluxo).

**Fricções:**

- **UF-05 · ALTO — UX** · *A busca não diz quantos resultados encontrou.* A única pista de volume é "Página 1 de N" na paginação. Buscar "caneta" e receber a página 1 de 4 não responde "são 4 páginas de quê?". Ironicamente o `QuickOutListModal` — um modal secundário — **mostra** "N item(ns)". A informação existe no payload (`total`), está apenas na tela errada. Mesmo padrão de C-6: o dado existe, o lugar é que está trocado.

- **UF-06 · ALTO — UX** · *O filtro de status é uma ação escondida.* `StatusFilterMenu` é renderizado como o **cabeçalho da coluna Status** (`ProductsTable.tsx`, `headerRender`). Não existe nenhuma barra de filtros, nenhum chip de "filtros ativos", nenhum indício fora daquele cabeçalho. Descobrir que se pode filtrar exige clicar num cabeçalho de coluna — algo que a maioria das pessoas espera que **ordene**, não que filtre. E quando o filtro está ativo, o único sinal é um contador pequeno dentro do próprio cabeçalho. Isso é *recognition vs recall* invertido: o sistema esconde a capacidade e depois esconde o estado dela.

- **UF-07 · CRÍTICO — UX** · *No mobile não existe ordenação nem filtro, e é possível ficar preso num estado filtrado.* Ordenação e filtro de status vivem **exclusivamente** nos cabeçalhos da `ProductsTable`, que está dentro de `hidden md:block`. No celular, portanto:
  - não há como ordenar por saldo, nome ou SKU;
  - não há como filtrar por status;
  - **mas há como *entrar* num estado filtrado**: o `LowStockBanner` (visível no mobile) tem o botão "Ver produtos", que chama `showLowStock()` e aplica `statusFilter = ['ATTN','OUT']`.

  O controle de "Limpar filtros" está dentro do `StatusFilterMenu` — oculto no mobile. **Resultado: quem clica em "Ver produtos" no celular fica com a lista filtrada e não tem nenhum controle na interface para voltar a ver todos os produtos**, exceto recarregar a página. É um beco sem saída construído por composição de duas decisões que individualmente pareciam inofensivas.

- **UF-08 · ALTO — UX** · *A ordenação secundária é invisível e enganosa.* `DataTable.handleSort` e `useProductsQuery.togglePrimarySort` suportam Shift+clique para ordenação múltipla. Nada na interface indica isso. Pior: a ordenação secundária é aplicada **em memória, apenas sobre a página atual** (`useProductsQuery.viewItems`), enquanto a primária vai para o banco. O usuário que descobrir o Shift verá uma ordenação que parece global e não é. **[escala]** Em dezenas de produtos (1–3 páginas) a diferença é pouco perceptível; em centenas, a ordenação secundária passa a mentir de forma sistemática.

- **UF-09 · MÉDIO — UI** · *A tabela não mostra que está buscando.* `query.isFetching` só é usado para desabilitar os botões de paginação. Durante o refetch, as linhas antigas continuam na tela sem nenhuma indicação de que estão desatualizadas. Quem digita na busca vê a lista antiga por até 300ms + latência, sem saber se o sistema registrou a digitação.

- **UF-10 · MÉDIO — UX** · *Paginação sem controle de tamanho de página e sem salto direto.* A lista principal é fixa em `PAGE_SIZE = 10` (`useProductsQuery.ts:13`) e só oferece Anterior/Próxima. Os modais de histórico — telas secundárias — **têm** seletor de 10/20/50 por página. De novo: o recurso existe no lugar menos importante. **[escala]** Com dezenas de produtos isso é irrelevante; com centenas, chegar à página 20 custa 19 cliques e não há atalho.

**Risco de erro:** baixo para busca. Moderado para interpretação: com filtro de status ativo e sem indicação clara, é possível concluir "este produto não existe" quando ele apenas não casa com o filtro.

**Feedback atual:** insuficiente — sem contagem de resultados, sem estado de busca em andamento, sem resumo de filtros ativos.

**Desktop vs Mobile:** a maior divergência de todo o sistema. Desktop tem busca + ordenação + filtro + paginação. Mobile tem busca + paginação (posicionada **antes** da lista, achado C-4) e um beco sem saída de filtro.

**Acessibilidade relevante:** `aria-sort` correto nos cabeçalhos; o `<nav aria-label="Paginação de produtos">` tem `aria-live="polite"` no indicador de página (bom). Mas mudanças de resultado da busca **não são anunciadas** — não há live region dizendo "N produtos encontrados", então quem usa leitor de tela não recebe retorno algum ao digitar.

**Severidade: CRÍTICO** (por UF-07).

**Oportunidade:** tornar busca, filtro, ordenação e contagem de resultados uma **região de controle explícita e independente da tabela**, disponível nas duas larguras — em vez de recursos hospedados dentro de cabeçalhos de coluna que só existem no desktop.

---

## 5. Fluxo 3 — Criar produto

**Objetivo do usuário:** cadastrar um produto novo, opcionalmente já com saldo inicial.

**Caminho atual:** "Adicionar Produto" → `ProductFormModal` (mode `create`) → `POST /products`. Se `initialStock > 0`, produto e movimentação `INITIAL_STOCK` são gravados **na mesma transação** (`routes/products.ts`) — decisão correta e que é **regra de negócio, não mexer**.

**Passos necessários:** 6 (abrir, nome, SKU, estoque inicial, estoque mínimo, salvar).

**Informação necessária:** o formulário explica bem os dois campos que geram dúvida — o hint do estoque inicial diz que vira uma Entrada, e o hint do estoque mínimo diz que serve só para alerta e **não altera o saldo**. São os melhores textos de apoio do produto inteiro.

**Fricções:**

- **UF-11 · ALTO — UX + risco de dado** · *O SKU é apenas visualmente maiúsculo.* O input aplica a classe CSS `uppercase` (`ProductFormModal.tsx:121`), que transforma **a exibição**, não o valor. Quem digita `abc123` vê `ABC123` na tela e o sistema grava `abc123`. A unicidade no backend é `@unique` exato (`prisma`) mais uma checagem `findUnique({ where: { sku } })`. Portanto **`abc123` e `ABC123` podem coexistir como dois produtos distintos** — e a tabela também aplica `uppercase` por CSS na coluna SKU, então os dois aparecem idênticos na lista. Dois produtos visualmente indistinguíveis, com saldos separados, em um sistema de estoque.
  Registro do limite de escopo: a **normalização do SKU é regra de negócio** (backend) e não deve ser alterada por esta refatoração. O que é problema de UI/UX aqui é a interface **mentir sobre o valor que está sendo gravado**. Ver F-05 na seção 15.

- **UF-12 · MÉDIO — UX** · *Erro de SKU duplicado não aponta para o campo.* O backend responde 409 `"SKU já cadastrado."`. O modal mostra isso num `<p>` no rodapé do formulário e num toast, mas **não marca o campo SKU** com `aria-invalid` nem posiciona a mensagem ao lado dele. O usuário tem que traduzir a frase de volta para o campo. *Error prevention* e *proximity*: uma mensagem de erro longe do campo que a causou custa uma leitura extra a cada tentativa.

- **UF-13 · MÉDIO — UX** · *Sucesso sem destino.* Ao salvar, o modal fecha, aparece o toast "Produto criado com sucesso." e a lista é invalidada. Se a ordenação atual colocar o produto novo na página 7, **nada muda na tela**. A pessoa recebe a confirmação de que algo aconteceu, mas não vê o resultado — e não tem como pular para ele.

- **UF-14 · MÉDIO — DÍVIDA TÉCNICA** · O formulário não usa o primitivo `ui/Input` (achado A-9 da Fase 1); pelo ângulo do fluxo, a consequência é que estados de erro, hint e foco se comportam de forma diferente aqui e no `AdjustmentFormModal`, que **usa** o primitivo. Dois formulários do mesmo produto reagem a erro de maneiras distintas.

**Risco de erro:** médio — SKU divergente do que foi mostrado (UF-11); confundir estoque inicial com estoque mínimo é mitigado pelos bons hints.

**Feedback atual:** botão mostra "Salvando..." mas **sem spinner** (`disabled` sem `isLoading`, achado M-10) — enquanto o `MovementFormModal` mostra os dois. Toast de sucesso e de erro presentes.

**Desktop vs Mobile:** o modal é `max-w-lg` com `w-[95vw]` e corpo rolável — funciona nas duas larguras. Sem divergência relevante.

**Acessibilidade relevante:** `id` fixos (`id="name"`, `id="sku"`…) violando a regra de `useId()` do projeto; erros com `role="alert"` mas **sem** `aria-describedby` ligando campo ↔ erro (só o primitivo `Input` faz isso, e este formulário não o usa).

**Severidade: ALTO.**

**Oportunidade:** trazer os dois formulários de produto para o mesmo primitivo de campo, e resolver o descompasso entre o SKU exibido e o SKU gravado — decidindo explicitamente qual dos dois é a verdade.

---

## 6. Fluxo 4 — Editar produto

**Objetivo do usuário:** corrigir nome, SKU, descrição ou estoque mínimo de um produto existente. (Editar **não** altera saldo — `PUT /products/:id` não toca em movimentações. Isso é **regra de negócio**.)

**Caminho atual:** linha/card → menu "⋯" → "Editar" → `ProductFormModal` (mode `edit`) → `PUT /products/:id`.

**Passos necessários:** 3 para abrir. E então, na prática, **redigitar todos os campos**.

### UF-15 · CRÍTICO — DÍVIDA TÉCNICA (verificado por sonda)

**O formulário de edição abre com todos os campos vazios.**

`ProductFormModal` passa `initialValues` para o `defaultValues` do `useForm`. Mas `defaultValues` no react-hook-form só é lido **na montagem do componente**, e a instância de edição é montada uma única vez em `ProductDashboard` (com `open={editing !== null}` e `editing === null` no primeiro render). Não há `reset()` na abertura nem `key` forçando remontagem. Quando o usuário clica em "Editar", a instância já existe — e seu estado de formulário foi criado quando não havia produto nenhum.

**Verificado**, não deduzido: escrevi uma sonda temporária que monta o modal fechado e depois o reabre com `initialValues={{ name: 'Caneta Azul', sku: 'SKU123', minStock: 7 }}`. O campo Nome veio **vazio** (esperado `"Caneta Azul"`, recebido `""`). A sonda foi removida após a execução.

Consequências no fluxo:
- Editar só o estoque mínimo obriga a redigitar nome e SKU corretamente de memória — *recall* puro, exatamente o que uma tela de edição existe para evitar.
- Se a pessoa preencher só o campo que queria mudar e salvar, o Zod bloqueia com "Informe o nome" / "Informe o SKU" — o formulário parece quebrado sem explicar por quê.
- Se ela redigitar o SKU com uma diferença de caixa, cai no cenário de UF-11.

Este é um achado **funcional**, registrado também na seção 15 (F-06). Não deve ser corrigido "de passagem" dentro de uma task visual: merece correção própria, com teste, antes ou fora da refatoração.

**Outras fricções:**

- **UF-16 · MÉDIO — UX** · A edição fica no menu "⋯", ao lado de "Excluir". Uma ação corriqueira e uma irreversível dividem o mesmo menu, com a mesma distância do cursor, separadas só por posição e cor do texto. *Fitts's Law* aplicada ao erro: o custo motor de acertar "Excluir" em vez de "Editar" é praticamente zero.

**Risco de erro:** **alto** — o campo vazio convida a salvar dados incompletos ou divergentes.

**Feedback atual:** toast de sucesso/erro. Nada sinaliza que os campos deveriam ter vindo preenchidos.

**Desktop vs Mobile:** idêntico — o defeito atinge as duas larguras. No mobile é pior, porque redigitar em teclado virtual custa mais.

**Acessibilidade relevante:** mesmos pontos de UF-14 / seção 5.

**Severidade: CRÍTICO.**

**Oportunidade:** o fluxo de edição precisa carregar e exibir o estado atual do produto antes de pedir qualquer decisão ao usuário. Enquanto isso não acontece, qualquer melhoria visual nesta tela é maquiagem sobre um formulário que não funciona.

---

## 7. Fluxo 5 — Entrada de estoque

**Objetivo do usuário:** registrar que entraram N unidades de um produto.

**Caminho atual:** linha/card → "Movimentar" → `MovementFormModal` (tipo default `IN`) → `POST /products/:id/movements` → `StockService.recordMovement` (lock de linha, saldo recalculado, `previousQuantity`/`newQuantity`/`userId` gravados).

**Passos necessários:** 4 (Movimentar, quantidade, Lançar, e o tipo já vem em `IN`).

**Informação necessária para decidir:** qual é o saldo atual e qual será o saldo depois.

**Fricções:**

- **UF-17 · ALTO — UX** · *O modal de movimentação não mostra o saldo atual, nem o nome do produto.* O título é "Movimentar Estoque" e a descrição diz "Lance uma entrada (IN) ou saída (OUT) para este produto" — **"este produto" nunca é nomeado**. Quem abriu o modal a partir de uma tabela de 10 linhas precisa lembrar de qual linha clicou. O `MovementFormModal` recebe apenas `productId: string`, então a informação nem está disponível no componente. Compare com o `AdjustmentFormModal`, que exibe `nome · SKU` na descrição e o saldo atual em destaque. Duas telas do mesmo produto, para operações da mesma família, com níveis opostos de contexto.

- **UF-18 · ALTO — UX** · *Nenhum preview do resultado.* A baixa rápida mostra "Saldo Atual → Novo Saldo" em tempo real; o ajuste mostra a diferença com sinal; a movimentação manual — que faz exatamente a mesma coisa — não mostra nada. A pessoa digita 50 e só descobre o efeito depois de gravar.

- **UF-19 · MÉDIO — UX** · *O campo "Observação (opcional)" é o único registro de causa.* Como não há motivo estruturado, o histórico depende de texto livre que ninguém é obrigado a preencher. Isso volta como problema no fluxo 9 ("por que o estoque mudou?").

- **UF-20 · MÉDIO — UI** · *Rótulos vazam o enum.* As opções são "Entrada (IN)" e "Saída (OUT)". O parêntese técnico existe porque o **histórico** exibe o enum cru (`IN`/`OUT`) — ou seja, o formulário carrega jargão para compensar uma deficiência de outra tela. Ver UF-30.

**Risco de erro:** ver fluxo 6 — o risco real está na direção da movimentação, e é compartilhado.

**Feedback atual:** botão "Lançando..." com spinner, toast de sucesso, toast + parágrafo de erro. Este é, dos formulários antigos, o de melhor tratamento de estado.

**Desktop vs Mobile:** disponível nas duas larguras ("Movimentar" existe no card mobile). Sem divergência.

**Acessibilidade relevante:** `id` fixos (`movement-type`, `movement-quantity`…) contra a regra de `useId()`; erros com `role="alert"` e `aria-describedby` corretos; `<select>` nativo (bom para mobile). Um detalhe já resolvido e que **deve ser preservado**: o schema aceita o formato de `datetime-local` e converte para ISO no envio — antes disso o campo "opcional" era impossível de usar.

**Severidade: ALTO.**

**Oportunidade:** o modal de movimentação precisa dizer *sobre qual produto* e *qual será o efeito* antes de aceitar a decisão — como o ajuste já faz.

---

## 8. Fluxo 6 — Saída de estoque

**Objetivo do usuário:** registrar que saíram N unidades.

**Caminho atual:** o **mesmo** `MovementFormModal` do fluxo 5, trocando o select de `IN` para `OUT`.

**Passos necessários:** 5 (um a mais que a entrada: trocar o tipo).

**Informação necessária:** saldo atual — indisponível (UF-17) — e o efeito da saída — indisponível (UF-18).

**Fricções (além das herdadas do fluxo 5):**

- **UF-21 · CRÍTICO — UX** · *A direção da movimentação é o único campo que separa duas operações opostas, ela vem pré-selecionada em `IN`, não há preview, não há confirmação, e a operação é irreversível.*

  Detalhando cada elo, porque é a soma que torna isso crítico:
  1. O tipo é um `<select>` cujo valor inicial é `IN` (`defaultValues: { type: 'IN', ... }`).
  2. Não há passo de confirmação — "Lançar" grava direto.
  3. Não há preview de saldo resultante que denuncie o engano antes do envio.
  4. Uma saída registrada como entrada **não é detectada por nenhuma validação**: o backend só recusa saída que deixaria o saldo negativo (`newQuantity < 0` → 422). Uma entrada indevida sempre passa.
  5. Não existe desfazer, editar nem estornar movimentação em lugar nenhum do sistema. A correção exige lançar uma movimentação compensatória ou um ajuste — e ambas ficam **permanentemente** no histórico, junto com o erro.

  Ou seja: um clique a menos no lugar errado grava um dado de estoque incorreto, permanente e auditado. É o maior risco de erro humano do sistema. *Error prevention*: quando a ação é irreversível, a barreira tem que ser proporcional — e aqui ela é menor que a do ajuste, que é a operação **mais** protegida das três.

- **UF-22 · MÉDIO — UX** · *A mensagem de saldo insuficiente é boa e chega tarde.* O backend responde 422 `"Saída maior que o saldo atual do produto."` — mensagem clara, específica da rota, repassada pelo `httpClient` como `ApiRequestError.message` e exibida em toast + parágrafo. O problema é que ela só existe **depois** do envio; a interface não tinha mostrado o saldo que tornaria o erro previsível.

**Risco de erro:** **o mais alto do sistema.** Ver UF-21.

**Feedback atual:** correto no envio e no erro. Ausente na prevenção.

**Desktop vs Mobile:** idêntico.

**Acessibilidade relevante:** igual ao fluxo 5.

**Severidade: CRÍTICO.**

**Oportunidade:** tornar a direção da movimentação uma escolha **explícita e visualmente inequívoca**, e dar à operação uma barreira proporcional à sua irreversibilidade. Sem propor ainda a forma — o ponto é que hoje entrada e saída são a mesma tela com um campo trocado, e o sistema não sabe distinguir engano de intenção.

---

## 9. Fluxo 7 — Baixa rápida

Analisado à parte, como pedido, por conter a camada legada. **Não proponho migração aqui** — mapeio o comportamento e registro o que precisa sobreviver a uma eventual refatoração.

**Objetivo do usuário:** dar baixa de N unidades de um produto, rápido, sem passar pelo formulário completo de movimentação.

### 9.1 · Dois caminhos com custos muito diferentes

| Caminho | Como | Passos |
|---|---|---|
| **A — atalho da linha** | Botão de ícone vermelho na linha da tabela → `QuickOutModal` | 3 |
| **B — pela lista** | Toolbar "Baixa de Produtos" → `QuickOutListModal` → escolher produto → `QuickOutModal` | 5+ |

**UF-23 · ALTO — UX** · O caminho A **não existe no mobile** (`ProductCardList` não expõe `onQuickOut` — achado C-5 da Fase 1). No celular só resta o caminho B, que é o mais longo e o que tem os piores problemas técnicos. A ação mais operacional do sistema é a mais cara justamente no dispositivo onde ela faz mais sentido.

### 9.2 · Mapa dos três componentes

| Componente | Papel | Como é montado | Escape | Backdrop | autoFocus | Focus trap | `role="dialog"` |
|---|---|---|---|---|---|---|---|
| `QuickOutModal` | Confirmar a baixa de um produto | `createPortal` manual | **Sim** — listener global em `window` (`:82-101`) | Sim (`:157`) | Não | **Não** | **Não** |
| `QuickOutListModal` | Escolher o produto | `createPortal` manual | **Não** — nenhum handler | Sim (`:56`) | **Sim** — no campo de busca (`:79`) | **Não** | **Não** |
| `QuickOutHistoryModal` | Ver o histórico de baixas | `createPortal` manual | **Não** | Sim (`:65`) | Não | **Não** | **Não** |

**UF-24 · CRÍTICO — UX + DÍVIDA TÉCNICA** · **Escape fecha um dos três modais e não fecha os outros dois.** É pior do que não ter Escape em lugar nenhum: o usuário aprende o atalho num modal e ele falha silenciosamente nos outros. *Consistency* quebrada dentro da mesma feature.

**UF-25 · ALTO — UX** · **Dois modais empilhados.** `onOpenHistory` (`ProductDashboard.tsx`) abre o histórico de baixas **sem fechar** a lista. Os dois usam `z-[10000]`, então a ordem visual depende da ordem no JSX, não de uma decisão. Sem focus trap em nenhum dos dois, o teclado pode caminhar livremente entre as duas camadas e o conteúdo do dashboard atrás delas.

**UF-26 · CRÍTICO — UX + DÍVIDA TÉCNICA (verificado por leitura cruzada frontend/backend)** · **A mensagem de erro real da baixa rápida nunca chega ao usuário.**

O backend responde 422 com `"Estoque insuficiente."` (`routes/quick-out.ts`, via `insufficientStockMessage`). O `httpClient` empacota isso em `ApiRequestError` com a mensagem em `.message`. Mas o `QuickOutModal` lê o erro assim:

```
const errorMessage = e.response?.data?.message || 'Falha ao registrar baixa';
```

`e.response.data` é o formato do **axios** — biblioteca que este projeto não usa. A expressão é sempre `undefined`, então o usuário **sempre** vê o texto genérico `"Falha ao registrar baixa"`, nunca `"Estoque insuficiente."`.

Isso contraria diretamente a regra registrada em `frontend.md`: *"Erros de API chegam com `.message` vindo do backend (ex. 'Estoque insuficiente') — repassar ao usuário via toast, nunca esconder atrás de uma mensagem genérica."* E é justamente o fluxo onde a pessoa mais precisa saber a causa: ela tentou tirar mais do que existe.

**UF-27 · MÉDIO — UX** · **O campo permite mais do que o backend aceita.** O input tem `max = currentBalance * 2` e o preview pinta "Estoque negativo" em vermelho quando a quantidade excede o saldo. Ou seja, a interface **desenha** um estado que o domínio proíbe, deixa enviar, e o erro que volta é genérico (UF-26). Três decisões em sequência, cada uma piorando a anterior. Registrado também como F-01 na seção 15 (a regra de "não deixar negativo" é do negócio e não muda).

**UF-28 · MÉDIO — UX** · **Nove `console.log` no caminho crítico** (achado C-2), incluindo o dump do produto e dos valores do formulário. Do ponto de vista de fluxo: o console de produção fica poluído justamente onde alguém precisaria investigar uma baixa indevida.

**UF-29 · MÉDIO — UI** · **A lista de produtos do modal é cortada no mobile.** O wrapper da tabela em `QuickOutListModal:83` é `overflow-hidden`, sem `overflow-x-auto`. Uma tabela de 5 colunas (`table-fixed`, `min-w-full`) num celular tem as colunas finais — inclusive **Status** — clipadas, **sem possibilidade de rolagem horizontal**. Como o caminho B é o único disponível no mobile (UF-23), essa é a experiência padrão de baixa rápida no celular.

### 9.3 · Comportamentos a preservar numa eventual refatoração

Lista fechada, para servir de contrato à Task 0 da Fase 8:

**`QuickOutModal`**
1. `Escape` fecha o modal.
2. `Enter` submete **de qualquer campo**, exceto dentro do `<textarea>`, e exceto com `Shift` pressionado; bloqueado enquanto `isSubmitting`.
3. Clique no backdrop (e apenas no backdrop) fecha.
4. Botões de quantidade rápida **1, 5, 10, 25, 50**, com `aria-pressed` refletindo o valor atual.
5. Preview "Saldo Atual → Novo Saldo" recalculado a cada digitação, com realce transitório de 250ms.
6. Rótulos de estado do preview: "Estoque negativo" (< 0) e "Estoque zerado" (= 0).
7. `max` do input = `currentBalance * 2` quando há saldo; sem máximo quando o saldo é 0.
8. Ação primária rotulada "Confirmar Baixa" / "Processando...", desabilitada quando `quantity <= 0`.
9. Toast de sucesso com a quantidade: `"Baixa de N unidade(s) registrada com sucesso!"`.
10. Fechar após sucesso e disparar `onSuccess` (invalidação da lista).

**`QuickOutListModal`**
11. `autoFocus` no campo de busca ao abrir.
12. Backdrop fecha; **Escape não fecha** (registrar a mudança como intencional se passar a fechar).
13. Clique em **qualquer ponto da linha** seleciona o produto (a linha inteira é o alvo, não um botão).
14. Ordenação por Nome / SKU / Saldo, alternando asc/desc, resetando para a página 1.
15. Colunas exibidas: Nome, SKU, Saldo, **Mín. Estoque**, Status — esta é a única tela que mostra o estoque mínimo ao lado do saldo.
16. Contador "N item(ns)" e paginação de 10 por página.
17. Botão "Histórico de Baixas" abre o histórico **sem fechar** a lista.

**`QuickOutHistoryModal`**
18. Filtros: busca textual, data de/até; paginação de 10.
19. Ordenação por produto / SKU / quantidade / data — **em memória, só sobre a página atual** (comportamento atual; se virar ordenação global, é mudança intencional e deve ser declarada).
20. Backdrop fecha; Escape não fecha.

**Fricções, risco, feedback e severidade do fluxo**

- **Risco de erro:** alto — a mensagem que explicaria a falha é substituída por texto genérico (UF-26), e a interface sugere ser possível o que o domínio proíbe (UF-27).
- **Feedback atual:** o preview em tempo real é o melhor do sistema; o tratamento de erro é o pior.
- **Desktop vs Mobile:** o atalho de um clique só existe no desktop; no mobile o único caminho é o mais longo e é o que tem a tabela cortada.
- **Acessibilidade relevante:** os três modais não são diálogos para tecnologia assistiva — sem `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap ou retorno de foco. O `Enter` global do `QuickOutModal` também intercepta a tecla fora do modal enquanto ele está aberto.
- **Severidade: CRÍTICO.**

**Oportunidade:** unificar os três sob o primitivo já existente resolve acessibilidade, Escape, empilhamento e foco de uma vez — mas o contrato acima precisa ser preservado item a item, e a diferença de custo entre os caminhos A e B (especialmente no mobile) é uma decisão de fluxo, não de componente.

---

## 10. Fluxo 8 — Ajuste de estoque

**Objetivo do usuário:** corrigir o saldo do sistema para bater com a contagem física.

**Caminho atual:** "⋯" → "Ajustar Estoque" → `AdjustmentFormModal` passo `form` → passo `confirm` → `POST /products/:id/adjustments` → `StockService.recordAdjustment`.

**Passos necessários:** 6.

**Informação necessária:** saldo atual (exibido), nova quantidade (informada), diferença (calculada e exibida), motivo (obrigatório). **Está tudo lá.** Este é o único fluxo do sistema em que o usuário tem toda a informação necessária no momento da decisão.

**O que este fluxo acerta e serve de referência para os outros:**
- Nomeia o produto (`nome · SKU` na descrição).
- Mostra o saldo atual em destaque.
- Mostra preview `anterior → novo` com a diferença **assinada em texto**, não apenas colorida — atende WCAG 1.4.1 por construção.
- Exige motivo (`min(1)`, `max(500)`).
- Rejeita alvo igual ao saldo atual, com mensagem específica, evitando poluir o histórico com ajuste sem efeito (**regra de negócio**).
- Confirmação estruturada listando Produto / Saldo → Novo / Diferença / Motivo antes de gravar.
- Reabrir sempre volta ao passo `form` — ninguém fica preso numa tela de uma tentativa anterior.

**Fluxo de conflito (409), como pedido:**

`POST` → 409 → o `onError` **não confia no corpo do erro** (que só traz `message`); busca o saldo real via `GET /products/:id`, a mesma fonte de verdade do resto do app. Então:
- **Se a busca funciona:** passo `conflict`, mostrando "Saldo que você visualizou" × "Saldo atual". A única ação além de cancelar é "Revisar", que atualiza a baseline (`expectedPreviousQuantity`), **limpa apenas a quantidade**, **preserva o motivo já digitado** e volta ao formulário para uma nova decisão. **Nunca reenvia sozinho.**
- **Se a busca falha** (rede, timeout de 8s, sessão caída): não entra no passo de conflito fingindo que a revisão aconteceu — volta ao formulário com mensagem explícita e a baseline original intacta.

Isso é desenho de fluxo de conflito de qualidade alta e **deve ser preservado integralmente**.

**Fricções:**

- **UF-30 · MÉDIO — UX** · *O motivo é texto livre.* Funciona para o registro individual, mas o histórico depois só permite busca textual sobre essa nota (`where.note = { contains: q }`). **[escala]** Com dezenas de ajustes, ler o texto livre resolve; com centenas, não há como agrupar "quebra", "perda", "recontagem" — cada pessoa escreve de um jeito e a auditoria vira leitura linha a linha. Não é problema hoje; é uma consequência de escala a registrar.

- **UF-31 · MÉDIO — UX** · *Depois de "Revisar", a mudança de baseline é discreta.* O número do "Saldo atual" no formulário muda de valor, mas nada chama atenção para o fato de que **aquele número é diferente do que estava lá antes** — que é exatamente a informação que motivou o passo de conflito. Somado à dívida A4 já registrada (a região `aria-live` do preview é montada junto com o conteúdo e por isso não anuncia no fluxo de revisão), quem usa leitor de tela recebe ainda menos sinal.

- **UF-32 · BAIXO — UX** · *O ajuste está no menu "⋯", ao lado de Excluir e Zerar Estoque.* Três operações de peso muito diferente no mesmo menu plano, sem separação nem agrupamento.

- Dívidas já registradas na revisão da feature e reconfirmadas aqui pelo ângulo do fluxo: **A1** (o foco não é gerenciado explicitamente na troca entre `form`/`confirm`/`conflict`), **A5** (a seta `→` pode não ser anunciada), **A6** (`role="alert"` inconsistente entre campos, porque vem do primitivo `Input`).

**Risco de erro:** baixo — é o fluxo mais protegido do sistema. Aqui a proteção é adequada; o problema é que os fluxos 5, 6 e 7 têm **menos** proteção para operações igualmente permanentes.

**Feedback atual:** o melhor do sistema.

**Desktop vs Mobile:** disponível nas duas larguras via o menu do card. Sem divergência.

**Acessibilidade relevante:** usa o primitivo `Modal` (Radix), `useId()` correto, `aria-disabled` em vez de `disabled` no botão de confirmação para não perder o foco durante o envio — decisão deliberada e bem documentada no código, **a preservar**.

**Severidade: MÉDIO** (apenas pelas fricções acima; a estrutura do fluxo está correta).

**Oportunidade:** usar este fluxo como **modelo de cerimônia** para as demais operações que alteram saldo, em vez de nivelá-lo por baixo.

---

## 11. Fluxo 9 — Histórico de movimentações

**Objetivo do usuário:** responder *"por que o estoque deste produto está neste número?"*

**Caminho atual:** "⋯" → "Ver Histórico" → `MovementHistoryModal` → `GET /products/:id/movements` (paginado; filtros `type`, `from`, `to`, `q` sobre a nota).

**Passos necessários:** 2 para abrir, mais leitura e interpretação.

**Informação necessária para responder à pergunta:** data, tipo, quantidade, **saldo antes e depois**, motivo, responsável.

### O teste da pergunta: "por que o estoque caiu?"

**UF-33 · ALTO — UI** · *A tabela mostra a quantidade movimentada, mas não o saldo resultante — exceto para ajustes.*

O `StockService` grava `previousQuantity` e `newQuantity` em **toda** movimentação (`IN`, `OUT`, `INITIAL_STOCK`, `ADJUSTMENT`), e a rota devolve o registro inteiro. **O dado chega no payload e a interface o descarta**, exibindo `previousQuantity → newQuantity` apenas quando `type === 'ADJUSTMENT'` (`QuantityCell`).

Consequência: para reconstruir o saldo ao longo do tempo, a pessoa precisa somar e subtrair mentalmente as linhas, de baixo para cima, numa lista paginada em ordem decrescente de data. Com uma página de 10 movimentações isso já é trabalhoso; entre páginas, é inviável. *Cognitive load* evitável: o número que responde à pergunta já foi calculado, gravado e transmitido — só não está sendo mostrado.

**UF-34 · ALTO — UI** · *Quatro tipos de movimentação, três linguagens visuais e dois idiomas.*

| Tipo | Como aparece hoje |
|---|---|
| `IN` | texto `IN` em verde |
| `OUT` | texto `OUT` em vermelho |
| `ADJUSTMENT` | badge com o texto `AJUSTE` |
| `INITIAL_STOCK` | texto `INITIAL_STOCK` em verde — **o enum cru do banco, em inglês, com underscore** |

O `INITIAL_STOCK` não foi previsto no render (o ternário trata `ADJUSTMENT` e joga todo o resto no ramo `IN`/`OUT`), então o nome interno do banco vaza direto para a tela. É o primeiro registro de todo produto criado com saldo inicial — ou seja, aparece com frequência.

Além disso, `IN`/`OUT` em verde/vermelho **dependem só da cor + do enum em inglês** para comunicar direção. É o mesmo produto que, no `AdjustmentFormModal`, acerta isso com sinal textual explícito.

**UF-35 · ALTO — UX** · *O modal não diz de qual produto é o histórico.* O título é apenas "Histórico de Movimentações". O componente recebe só `productId`. Quem abriu a partir de uma tabela de 10 linhas precisa lembrar em qual clicou — e se fechar e abrir outro, nada na tela distingue os dois. Mesmo problema de UF-17, na tela onde ele custa mais: a de investigação.

**UF-36 · MÉDIO — UX** · *O filtro de tipo não oferece `INITIAL_STOCK`.* O backend aceita os quatro valores (`movementListQuerySchema`); o `<select>` do frontend oferece três (Todos / IN / OUT / Ajuste). Não há como isolar nem excluir os lançamentos de estoque inicial.

**UF-37 · MÉDIO — UX** · *Nenhum resumo do período.* Não há totalizador de entradas × saídas × ajustes no recorte filtrado. Para responder "quanto saiu neste mês?", só somando linha a linha.

**UF-38 · MÉDIO — UI** · *Datas com `toLocaleString()` sem locale* — o formato depende da configuração do navegador de cada pessoa, num sistema cujo público é pt-BR.

**UF-39 · BAIXO — UX** · *Sem ordenação.* A ordem é fixa (`date desc`). Razoável como padrão, mas as colunas parecem ordenáveis por serem uma tabela e não são.

**Risco de erro:** o risco aqui é de **interpretação**, não de gravação: concluir errado por que o estoque mudou, e a partir disso lançar um ajuste indevido — que é permanente. O histórico alimenta o fluxo 8.

**Feedback atual:** loading, erro e vazio existem e estão em linhas próprias da tabela. Adequado.

**Desktop vs Mobile:** o wrapper tem `overflow-x-auto` (melhor que o `QuickOutListModal`), então a tabela rola. Ainda são 5 colunas num celular, e os filtros ocupam um grid de 5 colunas que colapsa para 1 — funcional, longo.

**Acessibilidade relevante:** usa Radix Dialog cru — mantém `role="dialog"`, focus trap e Escape (isso vem do Radix), mas perde o header padronizado do primitivo. `aria-describedby={undefined}` explícito, correto. A direção da movimentação depende de cor + enum (UF-34) — ponto de WCAG 1.4.1. Dívida **A5** já registrada sobre a seta `→`.

**Severidade: ALTO.**

**Oportunidade:** o histórico já tem, no payload, tudo o que precisa para responder "por que o estoque mudou" — saldo antes, saldo depois, tipo, motivo e autor. A oportunidade é de **exposição e vocabulário**, não de dado novo: nomear o produto, traduzir os quatro tipos para uma linguagem única, e mostrar o saldo resultante que já existe.

---

## 12. Fluxo 10 — Estoque baixo

**Objetivo do usuário:** descobrir o que está acabando e agir antes de faltar.

**Caminho atual:** `LowStockBanner` (alimentado por `useProductStockSummary`, `GET /products/summary`, refetch a cada 60s) → botão "Ver produtos" → `showLowStock()` aplica `statusFilter = ['ATTN','OUT']` → tabela filtrada.

**Passos necessários:** 2 para chegar à lista filtrada.

**Informação necessária para agir:** qual produto, qual o saldo, **qual o mínimo** e quanto falta para atingi-lo.

**Fricções:**

- **UF-40 · CRÍTICO — UI** · *A tabela mostra o veredito sem a evidência.* (Confirmação, pelo ângulo do fluxo, do achado C-6.) O badge "Estoque Baixo" vem de `balance < minStock`, e `minStock` não está em nenhuma coluna. Para decidir **quanto comprar**, a pessoa precisa: abrir o menu "⋯" → "Editar" → ler o campo Estoque mínimo → fechar → voltar. E, por causa de UF-15, o formulário de edição abre vazio — **então esse caminho de consulta também está quebrado**. Na prática, hoje, a única tela do sistema que mostra saldo e mínimo lado a lado é o `QuickOutListModal`.

- **UF-41 · CRÍTICO — UX** · *No mobile, entra-se no filtro e não se sai.* Já descrito em UF-07: o banner que aplica o filtro é visível no celular; o controle "Limpar filtros" vive no menu do cabeçalho da coluna Status, que só existe no desktop.

- **UF-42 · MÉDIO — UX** · *O banner e a lista podem discordar.* O banner vem de uma query separada (`['products','summary']`, `staleTime` 30s, refetch 60s); a lista vem de `['products', ...]` (`staleTime` 15s). Depois de uma baixa, os dois números se atualizam em momentos diferentes — o banner pode anunciar "3 produtos com estoque baixo" enquanto a lista filtrada mostra 2. Duas fontes para o mesmo fato.

- **UF-43 · MÉDIO — UX** · *"Ver produtos" não leva a lugar nenhum visível.* O clique aplica o filtro, mas não rola até a lista, não muda o cabeçalho da seção e não anuncia o resultado. Em tela pequena, ou com a lista abaixo da dobra, o retorno visível da ação é quase nulo — a pessoa clica e parece que nada aconteceu.

- **UF-44 · BAIXO — UI** · *Os três estados de estoque são comunicados por cor + texto* ("Em Estoque" / "Estoque Baixo" / "Fora de Estoque") — o que **já atende** WCAG 1.4.1. Não há ícone, então a distinção rápida em varredura depende da leitura do texto. Registro como oportunidade, não como falha.

**Risco de erro:** comprar a quantidade errada por não ver o mínimo; ou concluir que "não há produtos" estando num filtro que não se sabe estar ativo (UF-06 + UF-41).

**Feedback atual:** o banner está numa live region `role="status"` sempre montada — decisão correta, a preservar.

**Desktop vs Mobile:** o banner funciona igual nas duas; a **consequência** de usá-lo é radicalmente diferente.

**Acessibilidade relevante:** live region correta no banner. A ausência de anúncio ao aplicar o filtro (UF-43) deixa quem usa leitor de tela sem confirmação da ação.

**Severidade: CRÍTICO.**

**Oportunidade:** aproximar a evidência (mínimo) do veredito (badge), e garantir que todo estado de filtro aplicável seja também **visível e removível** na mesma largura em que foi aplicado.

---

## 13. Fluxo 11 — Exclusão de produto

**Objetivo do usuário:** remover um produto do sistema.

**Caminho atual:** "⋯" → "Excluir" → `ConfirmDialog` (via `useConfirm`) → `DELETE /products/:id` → o backend apaga **todas as movimentações** do produto e depois o produto (hard delete com cascata manual). **Regra de negócio — não alterar.**

**Passos necessários:** 3.

**Informação necessária:** que a exclusão é permanente e leva o histórico junto. **O diálogo diz exatamente isso:** *"Esta ação não pode ser desfeita e remove também as movimentações deste produto."* É o melhor texto de confirmação do sistema.

**Fricções:**

- **UF-45 · ALTO — UX** · *Três exclusões diferentes, rótulos parecidos, escopos opostos.*

  | Controle | Onde | O que apaga |
  |---|---|---|
  | "Excluir" (menu ⋯) | linha/card | **um** produto |
  | "Excluir (N)" | toolbar, canto direito | os **selecionados** |
  | "Excluir página" | rodapé da tabela | **todos os da página**, selecionados ou não |

  Os dois últimos ficam alinhados à direita, com o mesmo estilo destrutivo e tamanho `sm`. Quem selecionou 3 produtos e clica em "Excluir página" apaga os 10 da página. O diálogo diz "todos os 10 produtos desta página", o que salva quem lê — mas a interface criou a ambiguidade que o texto precisa desfazer. *Error prevention*: a barreira certa é não deixar o engano ser plausível, não explicá-lo no último instante.

- **UF-46 · ALTO — UX** · *A seleção não acompanha a navegação.* `selectedIds` (`ProductDashboard`) não é limpa ao paginar, buscar ou filtrar. É possível selecionar 3 produtos na página 1, ir para a página 4, e clicar em "Excluir (3)" — apagando itens que **não estão na tela**. O diálogo informa a quantidade, nunca **quais**.

- **UF-47 · ALTO — UX** · *A confirmação fecha antes de a exclusão acontecer.* `useConfirm` nunca passa `isPending` ao `ConfirmDialog` (a prop existe e é suportada, mas o hook não a usa). O diálogo fecha assim que se clica em "Excluir" e a mutação corre em segundo plano. Numa exclusão em lote de 10 produtos — 10 requisições via `Promise.allSettled` — não há **nenhuma** indicação de progresso; a única evidência é o toast que chega no fim. *Visibility of system status* ausente exatamente durante a operação mais destrutiva.

- **UF-48 · MÉDIO — UX** · *Falha parcial informa o número, não os nomes.* `"Falha ao excluir 3 de 10 produto(s)."` — não há como saber **quais** três falharam sem conferir a lista manualmente. (O lote não é atômico por decisão já registrada em `docs/current-state.md`: `Promise.allSettled` por item. **Regra de negócio / arquitetura — não alterar aqui.**)

- **UF-49 · MÉDIO — DÍVIDA TÉCNICA** · *"Excluir página" muda a página antes de excluir.* `handleDeletePage` chama `products.setPage(1)` **antes** de `removeProducts.mutate(items)` — a lista salta para a página 1 enquanto a exclusão de outra página ainda está em andamento, e o que se vê na tela deixa de corresponder ao que está sendo apagado.

- **UF-50 · BAIXO — UI** · *O corpo do diálogo é texto de enchimento.* Abaixo da descrição específica (que é boa), o `ConfirmDialog` renderiza sempre a mesma frase genérica: *"Confirme para continuar. Esta ação afeta os dados do estoque."* Texto que se aprende a ignorar reduz a atenção também sobre o que está acima dele.

**Risco de erro:** **alto** — três controles com rótulos semelhantes e escopos diferentes (UF-45) + seleção invisível persistindo entre páginas (UF-46).

**Feedback atual:** confirmação boa, execução silenciosa, resultado por toast.

**Desktop vs Mobile:** no mobile não há checkbox nem rodapé de tabela — portanto **não há exclusão em massa**, apenas a individual pelo menu. Isso é mais seguro, mas é uma divergência de capacidade não declarada.

**Acessibilidade relevante:** `ConfirmDialog` é construído sobre o primitivo `Modal` — herda focus trap, Escape e retorno de foco. Não há `window.confirm` em lugar nenhum, conforme a regra do projeto.

**Severidade: ALTO.**

**Oportunidade:** tornar o **escopo** de cada ação destrutiva evidente antes do clique (o que exatamente será apagado, e quais itens), e dar visibilidade ao processo enquanto ele corre.

---

## 14. Achados verificados por sonda

Duas hipóteses desta auditoria não foram deduzidas, e sim **testadas** com arquivos de teste temporários, executados e removidos em seguida. Nenhum arquivo do projeto foi mantido alterado.

| Hipótese | Resultado | Onde entra |
|---|---|---|
| O modal de edição não pré-preenche os campos do produto | **Confirmada.** Montando fechado e reabrindo com `initialValues={{ name: 'Caneta Azul', ... }}`, o campo Nome vem vazio (esperado `"Caneta Azul"`, recebido `""`) | UF-15 · CRÍTICO |
| `QuickOutListModal` quebra ao abrir por violar as regras de hooks (`return null` antes dos `useState`) | **Refutada como crash.** Não lança; emite `Warning: Internal React error: Expected static flag was missing` no console. Continua sendo violação a corrigir, mas não é falha em produção hoje | A-12 (Fase 1), reclassificado |

O segundo caso é a razão de a Fase 1 ter registrado A-12 como dívida e não como bug: a sonda impediu uma afirmação forte e errada.

---

## 15. Achados funcionais (registrados separadamente — regra de escopo)

Conforme a regra do brief, o que a auditoria de fluxo revelou de **comportamento**, e que **não deve ser corrigido de passagem** dentro de uma task visual:

| ID | Achado | Fluxo | Encaminhamento |
|---|---|---|---|
| **F-01** | `QuickOutModal` permite quantidade até `currentBalance * 2`; o ramo "Estoque negativo" é código morto (`Math.max(0, …)`, achado N-4 de `characterization-plan.md` §13) — o que de fato acontece é o preview mostrar `0` com "Estoque zerado" sem sinalizar que a quantidade é impossível | 7 | **Decidido em 29/08/2026** (`bugfix-gate.md` §7 G-3): a interface vai **impedir** — quantidade não pode ultrapassar o saldo, confirmação desabilitada, feedback claro, nunca representar a quantidade impossível como "Estoque zerado". A regra do backend não muda. Aplicado durante a migração do `QuickOutModal` (Fase 8) |
| **F-02** | `QuickOutListModal` / `QuickOutHistoryModal` usam `fetch` manual em `useEffect`, sem cancelamento — digitar rápido na busca pode aplicar resposta antiga | 7 | Backlog do `CLAUDE.md`. Corrigir junto da migração para React Query, com commit próprio |
| **F-03** | `QuickOutHistoryModal` ordena só a página atual em memória, aparentando ordenação global | 7 | Mesmo backlog de paginação real |
| **F-04** | Seleção múltipla não é limpa ao paginar/filtrar — permite excluir itens fora da tela | 11 (UF-46) | Precisa de decisão antes da Fase 8: limpar ao navegar, ou mostrar e permitir gerenciar a seleção acumulada? |
| **F-05** | SKU é maiúsculo só por CSS; o valor gravado mantém a caixa digitada, e a unicidade é exata — `abc123` e `ABC123` coexistem parecendo idênticos | 3 (UF-11) | Correção de dado, não de estilo. A normalização é decisão de backend. Registrar e decidir fora desta refatoração |
| **F-06** | **`ProductFormModal` em modo `edit` abre com os campos vazios** (verificado) | 4 (UF-15) | **Defeito funcional confirmado.** Merece correção própria com teste. Bloqueia o valor de qualquer trabalho visual nesta tela |
| **F-07** | `QuickOutModal` lê o erro no formato do axios (`e.response.data.message`), biblioteca que o projeto não usa — a mensagem real do backend nunca chega ao usuário | 7 (UF-26) | Correção pequena e de alto impacto; contraria regra explícita de `frontend.md`. Commit próprio |
| **F-08** | `handleDeletePage` chama `setPage(1)` antes de disparar a exclusão | 11 (UF-49) | Ordem de operações; corrigir junto da task de ações em massa, declarando a mudança |
| **F-09** | `MovementHistoryModal` não oferece `INITIAL_STOCK` no filtro de tipo, embora o backend aceite | 9 (UF-36) | Lacuna de paridade entre UI e API |

### Divergências encontradas em `docs/current-state.md`

Registrando porque o documento é usado como mapa de referência do projeto e hoje afirma duas coisas que o código contradiz:

1. *"não há `useEffect` + `fetch` manual em nenhum componente"* — `QuickOutListModal` e `QuickOutHistoryModal` fazem exatamente isso.
2. *"a análise atual só encontrou um primitivo de modal ativo"* e a questão em aberto *"a menção a 3 sistemas de modal legados ainda é válida?"* — **é válida**: há o primitivo `Modal`, o Radix cru do `MovementHistoryModal`, e os três `createPortal` manuais dos `QuickOut*`. A dívida do `AGENTS.md` não estava desatualizada.

Sugiro atualizar `docs/current-state.md` numa task própria, fora do redesign.

---

## 16. Fechamento

### 16.1 · Os 5 fluxos com maior fricção

1. **Fluxo 4 — Editar produto** · o formulário abre vazio (UF-15, verificado). A tarefa "mudar o estoque mínimo" vira "redigitar o produto inteiro de memória".
2. **Fluxo 2 — Encontrar produto (mobile)** · sem ordenação, sem filtro, com paginação renderizada antes da lista e um estado de filtro do qual não se sai (UF-07).
3. **Fluxo 7 — Baixa rápida (mobile)** · o atalho de um clique não existe; sobra o caminho de 5 passos, cuja tabela é cortada sem rolagem (UF-23, UF-29).
4. **Fluxo 9 — Histórico** · responder "por que o estoque mudou" exige aritmética mental, num modal que não diz de qual produto se trata (UF-33, UF-35).
5. **Fluxo 10 — Estoque baixo** · o alerta não traz o número que o gerou, e o caminho alternativo para consultá-lo passa pelo formulário quebrado do fluxo 4 (UF-40).

### 16.2 · Os 5 maiores riscos de erro humano

1. **Lançar entrada quando se queria saída** (UF-21) · default `IN`, sem preview, sem confirmação, sem desfazer, e nenhuma validação detecta o engano. Correção só por movimentação compensatória — permanente no histórico.
2. **"Excluir página" quando se queria "Excluir (N) selecionados"** (UF-45) · rótulos parecidos, mesma estética destrutiva, escopos opostos.
3. **Excluir itens selecionados em outra página** (UF-46) · a seleção sobrevive à navegação e o diálogo informa a quantidade, nunca quais.
4. **Criar dois produtos com o mesmo SKU em caixas diferentes** (UF-11) · a interface exibe maiúsculo e grava o que foi digitado; os dois ficam visualmente idênticos na lista.
5. **Ajustar o estoque com base numa leitura errada do histórico** (UF-33, UF-34) · sem saldo corrente por linha e com `INITIAL_STOCK` aparecendo como enum cru, a conclusão errada vira um ajuste permanente.

### 16.3 · Diferenças mais importantes entre desktop e mobile

| Capacidade | Desktop | Mobile |
|---|---|---|
| Ordenar a lista | Sim (cabeçalhos) | **Não existe** |
| Filtrar por status | Sim (menu no cabeçalho) | **Só entrar, nunca sair** (UF-07) |
| Ver quantos resultados | Não (nenhum dos dois) | Não |
| Estoque mínimo na listagem | Não | Não |
| Baixa rápida em 1 clique | Sim | **Não existe** (UF-23) |
| Escolher produto para baixa | Tabela legível | **Tabela cortada, sem rolagem** (UF-29) |
| Ações em massa | Sim | Não existe |
| Ordem de leitura da lista | Tabela → paginação | **Paginação → lista** (C-4) |
| Ajuste de estoque | Sim | Sim |
| Histórico | Sim | Sim (com rolagem horizontal) |

Conclusão: hoje o mobile não é uma versão adaptada do desktop — é uma versão **com capacidades removidas por acidente de layout**, não por decisão. Nenhuma das ausências acima aparenta ter sido escolhida; todas são efeito colateral de recursos hospedados dentro de `hidden md:block`.

### 16.4 · Comportamentos que precisam ser preservados numa futura refatoração

**Contrato dos `QuickOut*`:** os 20 itens listados na seção 9.3 (Escape/Enter/backdrop/autoFocus, botões 1·5·10·25·50 com `aria-pressed`, preview de saldo com realce, `max = saldo × 2`, linha inteira clicável, colunas incluindo Mín. Estoque, contador de itens, histórico abrindo sobre a lista, ordenação em memória do histórico).

**Fluxo de ajuste (fluxo 8), integralmente:** dois passos com confirmação estruturada; preview com diferença assinada **em texto**; motivo obrigatório; rejeição de alvo igual ao saldo; caminho de conflito 409 que busca o saldo real na fonte de verdade, preserva o motivo, limpa só a quantidade e nunca reenvia sozinho; degradação segura quando a busca do saldo falha; `aria-disabled` em vez de `disabled` no botão de confirmação; reabrir sempre no passo `form`.

**Infra de acessibilidade já correta:** as duas live regions sempre montadas do `ToastProvider` (polite/assertive); as live regions do `LowStockBanner` e do `ApiStatusBanner`; o skip link do `App`; o padrão WAI-ARIA completo do `MenuPopover`; a restauração de foco do primitivo `Modal`; `aria-sort` nos cabeçalhos do `DataTable`.

**Comportamentos de formulário:** a aceitação de `datetime-local` com conversão para ISO no `MovementFormModal` (correção deliberada de um campo que era impossível de usar); os textos de apoio de estoque inicial e estoque mínimo no `ProductFormModal`; o texto de confirmação de exclusão que menciona a perda das movimentações.

### 16.5 · Quais problemas são UI

Resolvidos mostrando melhor o que já existe — sem mudar o caminho nem o dado.

UF-09 (sem indicação de busca em andamento) · UF-20 (rótulos com enum) · UF-33 (saldo resultante existe no payload e não é exibido) · UF-34 (quatro tipos, três linguagens visuais, `INITIAL_STOCK` cru) · UF-38 (data sem locale) · UF-40 (estoque mínimo ausente da tabela) · UF-44 (status sem ícone) · UF-50 (texto de enchimento no diálogo) · e, da Fase 1, A-1, A-6, A-8, M-1 a M-14.

### 16.6 · Quais problemas são UX

Exigem repensar o caminho, a ordem ou a informação disponível — repintar não resolve.

UF-01, UF-02 (login sem destino em caso de falha) · UF-05 (sem contagem de resultados) · UF-06 (filtro escondido em cabeçalho de coluna) · UF-07 / UF-41 (beco sem saída de filtro no mobile) · UF-08 (ordenação secundária invisível e enganosa) · UF-10 (paginação sem controles) · UF-12 (erro longe do campo) · UF-13 (sucesso sem destino) · UF-16 (editar ao lado de excluir) · UF-17, UF-18 (movimentação sem contexto nem preview) · UF-21 (direção da movimentação sem barreira) · UF-23 (baixa rápida ausente no mobile) · UF-24 (Escape inconsistente) · UF-25 (modais empilhados) · UF-27 (interface sugere o que o domínio proíbe) · UF-30, UF-31 (motivo livre; baseline revisada discreta) · UF-35 (histórico sem produto) · UF-36, UF-37 (filtro e resumo ausentes) · UF-42, UF-43 (banner e lista discordando; ação sem retorno) · UF-45, UF-46, UF-47, UF-48 (escopo, seleção, progresso e resultado das exclusões) · UF-04 (sessão expirando em silêncio).

### 16.7 · Quais problemas são dívida técnica

O comportamento está errado por causa de como o código foi construído.

UF-15 / F-06 (`defaultValues` capturado na montagem — formulário de edição vazio) · UF-26 / F-07 (leitura de erro no formato do axios) · UF-28 (nove `console.log` no caminho crítico) · UF-29 (`overflow-hidden` onde deveria haver rolagem) · UF-49 / F-08 (`setPage` antes da mutação) · F-02, F-03 (fetch manual sem cancelamento; ordenação em memória) · A-12 (regras de hooks no `QuickOutListModal`) · UF-14 (formulários que ignoram o primitivo `Input`) · C-1, C-3 (três sistemas de modal; bloco de erro duplicado) · M-7, M-8 (classe de animação inexistente; cabeçalho ordenável sem rótulo).

### 16.8 · O que é regra de negócio e NÃO deve ser alterado por esta refatoração

- Saldo nunca é armazenado — é sempre derivado das movimentações (`IN`/`INITIAL_STOCK` somam, `OUT` subtrai, `ADJUSTMENT` entra pelo delta `newQuantity - previousQuantity`).
- Uma saída nunca pode deixar o saldo negativo; validado **dentro** da transação, com lock de linha (`SELECT ... FOR UPDATE`), com teste de concorrência dedicado no backend.
- Ajuste é por **saldo alvo** (contagem física), nunca por delta; exige motivo; rejeita alvo igual ao saldo atual (400); e falha com **409** quando o saldo real diverge do que o usuário viu — jamais aplica por cima de uma alteração não vista.
- `SKU` é único por produto. A normalização (ou não) da caixa é decisão de backend — a UI não deve "consertar" isso sozinha.
- Produto + `INITIAL_STOCK` são gravados na mesma transação na criação.
- Toda movimentação grava o `userId` do usuário autenticado, nunca um valor vindo do corpo da requisição.
- `DELETE /products/:id` é hard delete com cascata manual das movimentações — o histórico do produto excluído é perdido por decisão, não por descuido.
- Operações em lote não são atômicas (`Promise.allSettled` por item), com relato de falha parcial.
- A mensagem de login é deliberadamente idêntica para "usuário não existe" e "senha errada", para evitar enumeração de contas.
- Status do produto é derivado: `OUT` se saldo = 0, `ATTN` se `0 < saldo < minStock`, `OK` caso contrário.
- Estoque mínimo serve **apenas** para alerta e nunca altera saldo.

### 16.9 · Recomendação registrada para a Fase 8 — Task 0: Characterization Tests

**Nenhum teste foi criado nesta fase**, conforme instruído. Fica registrada a recomendação:

> **Task 0 — Characterization Tests.** Antes de tocar em qualquer componente frágil, escrever testes que capturem o comportamento **atual** (não o desejado), de modo que qualquer divergência posterior seja lida como *mudança visual intencional* ou como *regressão acidental* — e não como opinião.

**Cobertura mínima proposta:**

*`QuickOutModal`* — abre/fecha por `open`; `Escape` fecha; `Enter` submete fora do textarea; `Shift+Enter` no textarea **não** submete; `Enter` não submete durante o envio; clique no backdrop fecha e clique no conteúdo não fecha; os cinco botões de quantidade (1/5/10/25/50) definem o valor e refletem `aria-pressed`; o preview recalcula "Novo Saldo" e mostra "Estoque zerado"/"Estoque negativo"; `max` = saldo × 2; ação primária desabilitada com quantidade ≤ 0; toast de sucesso com a quantidade; `onSuccess` disparado.

*`QuickOutListModal`* — `autoFocus` no campo de busca; **`Escape` não fecha** (comportamento atual, deliberadamente capturado); backdrop fecha; clique em qualquer ponto da linha seleciona; ordenação por Nome/SKU/Saldo alternando e resetando a página; as cinco colunas presentes, incluindo **Mín. Estoque**; contador "N item(ns)"; "Histórico de Baixas" abre sem fechar a lista.

*`QuickOutHistoryModal`* — filtros de busca e de data resetam a página; paginação; ordenação por produto/SKU/quantidade/data; backdrop fecha; Escape não fecha.

*`ProductsTable`* — as seis colunas e sua ordem; `aria-sort` acompanhando a ordenação; clique no cabeçalho alterna asc/desc; Shift+clique acrescenta ordenação secundária; nome e SKU expandem a descrição com `aria-expanded`; checkbox de linha com rótulo acessível; os três controles de ação por linha e o que cada um dispara; renderização dos três status; estado vazio; estado de erro; rodapé.

*`ProductCardList`* — **capturar explicitamente as ausências** de hoje (sem baixa rápida, sem estoque mínimo, sem checkbox), para que preenchê-las apareça como mudança deliberada no diff de testes, e não passe despercebido.

*`ProductDashboard` (integração)* — a ordem de renderização tabela → paginação → cards (o que expõe C-4); a seleção sobrevivendo à troca de página (UF-46); "Excluir página" agindo sobre a página inteira e não sobre a seleção (UF-45).

**Critério de pronto da Task 0:** a suíte passa **verde contra o código atual, sem alterá-lo**. Um teste que precise de mudança no produto para passar não é caracterização — é requisito novo, e pertence a outra task.

---

## 17. Dúvidas a responder antes da Fase 3

Só as que mudam o trabalho seguinte. As cinco da Fase 1 continuam abertas nos itens de escala e simultaneidade (decisões 2 e 3 me pedem para não inventá-las); estas são novas e específicas desta fase.

1. **F-06 (formulário de edição vazio) entra como correção agora, ou fica registrado como defeito à parte?** Recomendo corrigir **antes** da Fase 8, com teste próprio: é o único achado que torna uma tela inteira inútil, e qualquer melhoria visual nela seria trabalho sobre algo que não funciona. Não é uma refatoração visual e não deveria virar uma.
2. **Existe algum caso de uso real para "Excluir página" e "Zerar página"?** São as duas ações mais destrutivas do sistema, aplicadas a um recorte arbitrário (a página atual, que muda com busca, filtro e ordenação). Se forem restos de teste, removê-las elimina de uma vez os riscos 2 e 3 da seção 16.2 — mas remover funcionalidade não é decisão minha.
3. **Movimentação de estoque deveria ter confirmação, como o ajuste tem?** Isso adiciona um passo a uma operação frequente, em troca de barrar o maior risco de erro do sistema (UF-21). É uma troca real entre velocidade e segurança, e a resposta depende de quem opera e com que frequência — informação que eu não tenho.
4. **Sobre a seleção múltipla (F-04):** limpar ao paginar/filtrar, ou mostrar a seleção acumulada e permitir gerenciá-la? A primeira é mais segura, a segunda é mais poderosa em lote. Muda o desenho da toolbar.
5. **O motivo do ajuste deve continuar 100% livre, ou ganhar motivos frequentes pré-definidos** (com texto livre ainda disponível)? Só faz diferença com volume de ajustes — e a escala real é justamente o que não sabemos.

---

## Estado da Fase 2

**Concluída.** Nenhum arquivo de produto alterado, nenhum componente refatorado, nenhum estilo tocado, nenhum teste criado. Duas sondas temporárias foram executadas e removidas.

Aguardando aprovação para a **Fase 3 — Visual Research**.
