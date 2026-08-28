# Fase 5 — Design System

**Data:** 28/08/2026
**Direção oficial:** B — Operação, com empréstimos declarados de C (números de primeira classe, `antes → depois`, histórico como extrato) e de A (tabela como região de dados, mais densa, com filetes).
**Escopo:** especificação. Nenhum código, CSS, componente ou token implementado.

---

## 0. Princípio de projeto desta fase

> O sistema existe para **reduzir a liberdade arbitrária** do código atual, não para ampliar o vocabulário disponível.

Métrica de sucesso, medida no código de hoje:

| | Hoje | Depois |
|---|---|---|
| Cores de anel de foco | 7 variantes | **1** |
| Níveis de raio | 6 | **2** |
| Tamanhos de fonte | 11 (incl. `[10px]`, `[11px]`, `[18px]`) | **5** |
| Pesos de fonte | 4 | **3** |
| Níveis de sombra | 5 | **1** |
| Famílias de cor de acento | 2 (`brand` + `indigo`, valores idênticos) | **1** |
| Sistemas de diálogo | 3 | **1** |

Se uma decisão desta fase aumentar algum desses números, ela está errada.

---

## 1. Verificações técnicas executadas

Três verificações reais precederam as decisões. Duas delas mudaram o resultado.

### V1 · Inter e algarismos tabulares — **resultado parcial, não é um "sim"**

Foi pedido explicitamente para não assumir. O que foi verificado:

| Build | Como foi verificado | Resultado |
|---|---|---|
| **TTF** servida pelo Google Fonts (325 KB, UA antigo) | Busca por tags OpenType no binário | `tnum` **PRESENTE** · `pnum` presente · `GSUB`/`GPOS` presentes · `ss01` presente · `onum`/`lnum` ausentes |
| **woff2** — o que o `index.html` realmente carrega (UA moderno) | Mesma busca | **Inconclusivo.** O Google serve **7 arquivos subsetados** por `unicode-range` (~26 KB cada); o stream é comprimido com Brotli, e as tags não aparecem como ASCII |

**Conclusão honesta:** a fonte Inter **tem** `tnum`. Não está confirmado que o **subset woff2** entregue ao navegador o retenha. O risco é concreto: a lista default de `--layout-features` do `pyftsubset` **não** inclui `tnum`, e não foi possível confirmar, sem um navegador, se a configuração do Google Fonts o preserva no subset `latin`.

**Decisão:** `tabular-nums` entra no sistema, com **verificação de runtime obrigatória na Fase 7** e plano B decidido antes, não depois:

```
Teste (Fase 7): medir a largura renderizada de "1111" e "0000" no mesmo
elemento. Se forem iguais → tnum ativo. Se diferirem → subset não retém.
```

**Plano B único:** auto-hospedar a Inter com a build completa (que comprovadamente tem `tnum`). Também elimina duas conexões de terceiros e um CSS render-blocking. Custo: um asset no repositório.

O review considerou "três planos alternativos" superdimensionados para algo verificável uma vez no artefato servido — aceito em parte: **a verificação é mesmo única e simples**, e as alternativas 2 e 3 da primeira versão foram cortadas. Mas ter um plano B decidido **antes** do teste não é excesso: é o que evita a fase parar para decidir se o resultado der negativo.

Nada aqui bloqueia a Fase 6.

### V2 · Contraste — medido, não estimado

Razões de contraste WCAG calculadas sobre branco (`#FFFFFF`):

| Família | Branco sobre preenchimento | Família sobre branco | Veredito |
|---|---|---|---|
| indigo-600 | 6.29 | 6.29 | passa |
| **blue-600** | **5.17** | **5.17** | **passa** |
| blue-700 | 6.70 | 6.70 | passa |
| teal-600 | **3.74** | 3.74 | **reprova AA** (< 4.5) |
| teal-700 | 5.47 | 5.47 | passa |
| cyan-700 | 5.36 | 5.36 | passa |

Semânticos sobre branco: `emerald-700` 5.48 · `amber-700` 5.02 · `red-700` 6.47 · `rose-700` 6.29. Reprovados para texto: `amber-600` 3.19 · `red-600` 4.83 (passa no limite, mas sem margem).

Neutros atuais: **`gray-400` = 2.54 — reprova para texto**, e está em 10 lugares do código (achado M-4). `gray-500` 4.83 (limite) · `gray-600` 7.56 · `gray-700` 10.31 · `gray-900` 17.74.

### V3 · Inventário do código atual

- **Tailwind 3.4.17**; `screens` **não** customizado → breakpoints default (sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536).
- Uso de breakpoints: `sm:` 20× · `md:` 5× · `lg:` 2× · `xl:` 1×. A troca tabela↔cards vive nesses 5 `md:`.
- Sombras: `shadow-sm` 9× · `shadow-2xl` 3× · `shadow-xl` 2× · `shadow` 2× · `shadow-md` 1×.
- Pesos: `font-medium` 59× · `semibold` 14× · `normal` 6× · `bold` 3×.
- Bordas: `border-gray-300` 20× · `border-gray-100` 15× · `border-gray-200` 12×.
- **`prefers-reduced-motion`: nenhuma ocorrência.**
- `animate-fade-in` usada 1× e **nunca definida** no config.

---

## 2. Arquitetura de tokens — dois níveis

```
PRIMITIVO                          SEMÂNTICO
valor bruto, sem significado  →    papel no produto
blue.600 = #2563EB                 accent
gray.900 = #111827                 text-primary
```

**A fronteira, em uma regra:** um primitivo responde *"que valor é este?"*; um semântico responde *"para que serve?"*. **Componente só consome semântico.** Se um componente precisa de um valor que nenhum papel cobre, o erro está na lista de papéis — não é caso de exceção.

**Sem terceiro nível.** Não haverá `button.primary.bg`. A justificativa é empírica: o projeto tem ~4.400 linhas de frontend e 12 primitivos de UI; um nível por componente criaria mais tokens do que componentes. A única exceção admissível seria um componente com necessidade cromática que nenhum papel do produto compartilha — e nenhum caso assim foi encontrado na auditoria.

**Por que isso resolve A-4:** hoje `ring-indigo-600` (13×), `ring-brand` (11×) e `ring-blue-600` (3×) coexistem porque cada componente escolheu um valor. Com papéis, não existe azul para escolher — existe `focus`. A inconsistência deixa de ser algo a policiar em revisão e passa a ser algo que não se consegue escrever.

---

## 3. Color system

### 3.1 · Papéis semânticos

| Papel | Primitivo | Uso | Contraste relevante |
|---|---|---|---|
| `background` | gray-50 | Fundo da aplicação | — |
| `surface` | white | Cartões, modais, linhas de tabela, overlay | — |
| `surface-subtle` | gray-50 | Cabeçalho de tabela, hover de linha, campo desabilitado | — |
| `border` | gray-200 | Separador **decorativo**: filete de tabela, divisor de menu | 1.24 — ver §3.4 |
| `border-strong` | **gray-500** | **Contorno de controle**: campo, select, botão secundário | **4.83 — atende 1.4.11** |
| `border-hover` | gray-600 | Contorno de controle em hover | 7.56 |
| `text-primary` | gray-900 | Conteúdo principal, números | 17.74 |
| `text-secondary` | gray-600 | Rótulos, unidades, metadados | 7.56 |
| `text-muted` | gray-500 | Texto auxiliar, placeholder | 4.83 |
| `accent` | blue-600 | Ação primária, seleção, links | 5.17 |
| `accent-hover` | blue-700 | Hover/active da ação primária | 6.70 |
| `accent-subtle` | blue-50 (+ texto blue-800) | Fundo de linha selecionada, badge informativo | — |
| `success` / `success-subtle` | emerald-700 / emerald-50 | Estado "Em estoque" | 5.48 sobre branco · **5.21** sobre o sutil |
| `warning` / `warning-subtle` | amber-700 / amber-50 | Estado "Estoque baixo", avisos | 5.02 · **4.84** |
| `danger` / `danger-subtle` | red-700 / red-50 | Estado "Sem estoque", erro, ação destrutiva | 6.47 · **5.91** |
| `focus` | alias de `accent` | Anel de foco, em todo controle | 5.17 |

`focus` é um alias **deliberado**: nomeá-lo é o que torna a regra "uma única semântica de foco" auditável — dá para procurar por `ring-focus` e encontrar toda exceção. Se os componentes referenciarem `accent` diretamente, foco e ação primária ficam indistinguíveis numa busca. O review sugeriu cortá-lo (§22); mantido com esta justificativa.

**`selected` não é token** — é uma **receita de estado** (fundo `accent-subtle` + barra lateral `accent`), especificada em §13.3. Um token de cor não representa uma composição; correção aceita do review.

**`gray-400` é banido do sistema para texto** (2.54 — reprova). Permanece aceitável apenas para ícones decorativos com `aria-hidden` sobre fundo claro, e mesmo assim o padrão passa a ser `text-secondary`.

**Não existe papel `info` separado.** É servido por `accent-subtle`. Ver §4.

**Cada papel de estado é um par**, não uma cor: o token base é a cor do texto/ícone, o `-subtle` é o fundo. Um único token não pode representar os dois — foi um erro da primeira versão desta spec, corrigido após o review técnico (§22).

**`background` e `surface-subtle` compartilham `gray-50` hoje.** Isso é um **alias declarado**, não um acidente: os papéis são distintos (fundo da aplicação × superfície recuada dentro de uma região branca) e divergiriam num tema escuro. É diferente do caso `brand` = `indigo-600`, que eram dois nomes para o **mesmo papel** (foco), usados de forma intercambiável — essa é a duplicação que o sistema elimina.

### 3.4 · Onde a WCAG 1.4.11 se aplica — e onde não

Distinção que a primeira versão desta spec errou:

- **Contorno de controle** (campo, select, botão secundário) precisa de **≥ 3:1** contra a superfície adjacente, porque é o que permite identificar que ali existe um controle. Medição: o fundo da página (`gray-50`) contra a superfície do campo (branco) dá **1.045** — praticamente nulo. **A borda é, de fato, o único delimitador**, então a regra se aplica integralmente.
- **Separador decorativo** (filete entre linhas da tabela, divisor de menu) **não** identifica um componente nem um estado, e portanto não está sujeito a 1.4.11. Pode continuar claro.

Consequência: `gray-300` (**1.47**) e `gray-400` (**2.54**) estão **banidos como contorno de controle**. O degrau mais claro do Tailwind que atende é `gray-500` (**4.83**). O mínimo teórico seria ≈ `#939393` (3.07), que exigiria um primitivo fora da paleta — não vale o custo.

### 3.2 · Estados de estoque — cor nunca é o único portador

| Estado | Papel de cor | Palavra | Regra |
|---|---|---|---|
| Normal | `success` | "Em estoque" | Cor + palavra, sempre |
| Baixo | `warning` | "Estoque baixo" | Cor + palavra + **a evidência numérica ao lado** (§13) |
| Zerado | `danger` | "Sem estoque" | Cor + palavra |

Os três estados são derivados de `balance` vs `minStock` no backend (`matchesStatus`) — **regra de negócio, não alterada aqui**. O sistema só define como são apresentados.

### 3.3 · A colisão vermelho-estado × vermelho-ação

O mesmo `danger` serve a "Sem estoque" (estado) e a ação destrutiva. Isso é aceitável **desde que separado por forma e por momento**:

- **Estado** → sempre em forma de *badge*: fundo `danger` sutil, texto `danger`, sem borda de controle.
- **Ação destrutiva** → `danger` **pleno só no momento da decisão** (o botão de confirmação dentro do diálogo). Em repouso, a ação destrutiva é texto `danger` sobre superfície neutra.

> **PROBLEMA** → o botão de baixa rápida é pintado `text-red-700 hover:bg-red-50` em **todas** as 10 linhas (A-1), e o estado "Sem estoque" usa a mesma família. Quando tudo é vermelho, nada é urgente.
> **DECISÃO** → o atalho de baixa rápida perde a cor destrutiva e passa a neutro; vermelho pleno fica reservado ao instante da decisão.
> **BENEFÍCIO** → o alerta volta a alertar; a ação destrutiva volta a parecer excepcional.

---

## 4. Família de acento: **blue** — decidida

Teal e cyan foram **descartados por medição**: `teal-600` reprova em AA (3.74), e teal/emerald são hue-adjacentes — o acento ficaria confundível com o verde de "Em estoque" num produto onde verde é informação operacional.

Entre indigo e blue, o argumento decisivo é **economia de família**:

| | Com acento indigo | Com acento blue |
|---|---|---|
| Ação primária | indigo-600 | blue-600 |
| Foco | indigo-600 | blue-600 |
| Link | indigo-700 | blue-700 |
| Papel `info` (badge "Ajuste") | precisa de **blue-700** → duas famílias azuis adjacentes e confundíveis | **= a própria família de acento** |
| Total de famílias | 6 | **5** |

Blue é também a cor convencional de link, o que dispensa outra família ainda.

**Contrapartida registrada:** indigo-600 tem contraste melhor (6.29 vs 5.17) e já está em 13 lugares do código. Blue-600 passa AA com folga nos três papéis exigidos (preenchimento com texto branco 5.17; contra fundo ≥ 3:1 para componente não textual; estado selecionado). O desempate final — registro institucional vs. registro de SaaS de consumo — é **julgamento, não medição**, e está marcado como tal.

### Valores concretos necessários — cinco tons, não uma paleta inteira

| Token | Valor | Onde |
|---|---|---|
| `accent-subtle` | blue-50 `#EFF6FF` | Fundo de seleção, badge informativo |
| `accent-subtle-text` | blue-800 `#1E40AF` | Texto sobre `accent-subtle` |
| `accent` | blue-600 `#2563EB` | Preenchimento primário, foco, barra de seleção |
| `accent-strong` | blue-700 `#1D4ED8` | Hover/active **e** links sobre superfície clara |

**Quatro tons.** A primeira versão tinha `accent-hover` e `accent-text`, ambos blue-700, sem divergência prevista — duplicata apontada no review (§22) e colapsada em `accent-strong`.

---

## 5. Tipografia

### 5.1 · Fonte

Mantida a **Inter**, já carregada. Duas mudanças:

1. O peso **700 é eliminado** do sistema (3 usos hoje) — o `index.html` pode parar de baixá-lo, reduzindo um arquivo por subset.
2. `tnum` pendente de verificação de runtime (§1, V1).

### 5.2 · Escala — cinco tamanhos

| Papel | Tamanho | Peso | Line-height | Onde |
|---|---|---|---|---|
| `page-title` | 24px | 600 | 1.25 | Título da tela ("Produtos") |
| `section-title` | 18px | 600 | 1.35 | Título de seção, título de modal grande |
| `component-title` | 16px | 600 | 1.40 | Título de modal, título de card |
| `body` | 14px | 400 | 1.55 | Texto corrente, descrições |
| `label` | 14px | 500 | 1.40 | Rótulo de campo, botão |
| `table-cell` | 14px | 400 | **1.40** | Célula de tabela — mesmo tamanho do body, entrelinha menor (densidade, D5) |
| `caption` | 12px | 400 | 1.40 | Texto auxiliar, hint, timestamp |
| `table-header` | 12px | 600 | 1.40 | Cabeçalho de coluna, com `letter-spacing` leve |

**Tamanhos distintos: 24 · 18 · 16 · 14 · 12.** Pesos: 400 · 500 · 600.

**Apenas cinco utilitários são materializados** — um por tamanho. Os oito papéis acima são o **mapa de uso** (documentação), não oito classes: materializar um utilitário por papel criaria uma API maior que a escala real. Correção vinda do review (§22).

Eliminados: `text-3xl`, `text-4xl`, `text-xl`, `text-[18px]`, `text-[11px]`, `text-[10px]`.

> **PROBLEMA** → `SimpleStock` é `text-3xl md:text-4xl font-bold` e `Produtos` é `text-3xl font-semibold` (A-8): a marca, que a pessoa já sabe, tem mais peso que o nome da tela, que é o que ela precisa ler.
> **DECISÃO** → a marca passa a `label` (14/600). `page-title` (24/600) fica reservado ao nome da tela.
> **BENEFÍCIO** → em três segundos a pessoa lê "onde estou" antes de "de quem é o produto".

### 5.3 · Números — onde usar tabular e onde não

**Usar `tabular-nums`:**
- Coluna de saldo e de estoque mínimo.
- Quantidades e saldos no histórico (`anterior → novo`, delta).
- Preview de saldo nos diálogos de operação.
- Contadores e totais de paginação.

**Não usar:**
- Texto corrente e rótulos — figuras tabulares em prosa produzem espaçamento irregular.
- SKU: **não é número**, é identificador. Recebe tratamento próprio (§13).

**Formatação:** separador de milhar pt-BR (`toLocaleString('pt-BR')`) em toda quantidade. Hoje isso existe no `QuickOutModal` e **não** na tabela — inconsistência a eliminar. A unidade ("un.") é `text-secondary`, no mesmo tamanho, nunca menor: ela alinha com o número e não deve criar um segundo ritmo.

---

## 6. Spacing

Escala única, sete degraus: **4 · 8 · 12 · 16 · 24 · 32 · 48**. Mapeia direto para `1 · 2 · 3 · 4 · 6 · 8 · 12` do Tailwind — nenhum valor arbitrário, nenhum `p-[13px]`.

| Relação | Valor | Princípio |
|---|---|---|
| Dentro de um controle (padding) | 8 vertical · 12 horizontal | Área de toque sem inchar o controle |
| Rótulo → campo | 4 | Proximidade: pertencem ao mesmo objeto |
| Entre campos relacionados | 12 | Próximos, mas distintos |
| Entre grupos de campos | 24 | Separação percebida como "outro assunto" |
| Entre seções da página | 32–48 | Separação de região |
| Dentro da região de dados | 12 vertical · 16 horizontal | **Exceção de densidade (D5)** |

**A lei da proximidade faz o agrupamento, não a caixa.** Se dois elementos precisam parecer relacionados, a resposta é reduzir o espaço entre eles — não envolvê-los numa borda. É isso que evita o "card dentro de card": hoje o projeto agrupa desenhando caixas, e caixas dentro de caixas deixam de significar qualquer coisa.

---

## 7. Border radius — **dois níveis**

| Token | Valor | Aplica a |
|---|---|---|
| `radius-control` | 6px | Botão, campo, select, badge, item de menu, checkbox |
| `radius-surface` | 8px | Região de dados, modal, sheet, popover, banner |

**`rounded-full` é eliminado.** Duas razões, ambas funcionais:

1. Os badges de status viram retângulos de canto suave, coerentes com os controles. Pílula lê como "tag/chip"; aqui o badge é **estado de dado**, não um elemento removível.
2. O botão "Movimentar" é hoje `rounded-full` — uma forma que compete com a ação primária da página sem ser a ação primária. Igualando o raio, a hierarquia passa a ser comunicada por preenchimento e cor (§10), que é onde ela deve estar.

Eliminados: `rounded`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full`. Dois níveis bastam porque só existem duas categorias reais de objeto no produto: **coisas que se clica** e **coisas que contêm**.

---

## 8. Borders e elevation — estrutura antes de sombra

### Quando usar borda
- Delimitar a **região de dados** (a tabela).
- Separar linhas dentro da região (filete horizontal `border`).
- Contornar controles (`border-strong`).
- Delimitar banners e blocos de aviso.

### Quando NÃO usar borda
- Em torno de algo que já está dentro de uma região delimitada.
- Para agrupar elementos que a proximidade já agrupa (§6).

### Elevation — três estados, um deles é "nenhum"

| Nível | Sombra | Uso |
|---|---|---|
| *(padrão, sem token)* | nenhuma | **Padrão de tudo.** Página, região de dados, banners, cards |
| `shadow-overlay` | uma sombra média definida | **Apenas** modal, sheet, popover de menu, toast |
| `scrim` | véu escuro translúcido | Fundo do modal/sheet |

**Um único token de sombra.** A ausência de sombra é o default do CSS e não precisa de nome — `elevation-flat` foi cortado após o review (§22).

> **PROBLEMA** → `shadow-sm` em 9 lugares (cards, tabela, campos), `shadow-2xl` e `shadow-xl` isolados nos `QuickOut*`. Elevação virou textura, não camada.
> **PRINCÍPIO** → sombra comunica **camada Z**. Se o elemento não está acima do plano da página, não tem sombra.
> **DECISÃO** → a tabela perde a sombra e vira região com borda. Campos perdem `shadow-sm`. Sombra só onde há de fato uma camada sobreposta.
> **BENEFÍCIO** → quando algo tiver sombra, isso significará alguma coisa; e o dashboard deixa de ser uma coleção de cartões flutuantes.

---

## 9. Focus — **uma** semântica

```
focus-visible → anel de 2px em `accent`
              + offset de 2px na cor da superfície subjacente
```

Regras, sem exceção:

1. **`focus-visible`, nunca `focus`.** O anel aparece para navegação por teclado, não a cada clique de mouse.
2. **A mesma cor em todos os controles**, inclusive os destrutivos. Um anel azul sobre um botão vermelho, com offset, é claramente visível — e um foco que muda de cor conforme o controle obriga a reaprender o sinal em cada tela.
3. **O offset é obrigatório**: sem ele, o anel some sobre controles preenchidos com o próprio acento.
4. **Nunca remover `outline` sem substituição.** O `focus:outline-none` só é aceito acompanhado, na mesma classe, do anel de foco.
5. Contraste do anel contra a superfície adjacente ≥ 3:1 — atendido por `blue-600` (5.17 sobre branco).

Isto substitui `ring-indigo-600` (13×), `ring-brand` (11×), `ring-blue-600` (3×), `ring-indigo-500`, `ring-indigo-300`, `ring-blue-200` e `ring-amber-700`.

---

## 10. Action hierarchy

### 10.1 · Formalização visual

| Nível | Preenchimento | Borda | Cor do texto | Peso |
|---|---|---|---|---|
| **PRIMARY** | `accent` | — | branco | 500 |
| **SECONDARY** | `surface` | `border-strong` | `text-primary` | 500 |
| **TERTIARY** | — | — | `text-secondary` | 500 |
| **DESTRUCTIVE (repouso)** | — | — | `danger` | 500 |
| **DESTRUCTIVE (decisão)** | `danger` | — | branco | 500 |
| **SPECIALIZED SHORTCUT** | — | — | `text-secondary` | — |

**Todos compartilham o mesmo raio e o mesmo foco.** A hierarquia é comunicada por **preenchimento**, não por forma — e não por dar uma cor diferente a cada ação.

**Exatamente uma PRIMARY por contexto** (página, linha, diálogo).

### 10.3 · Tamanhos de botão — dois, não três

| Tamanho | Altura alvo | Onde |
|---|---|---|
| `md` (padrão) | 36px desktop · **44px em contexto de toque** | Cabeçalho de página, diálogos, formulários |
| `sm` | 32px | **Somente** dentro da região de dados (a exceção de densidade, D5) |

O tamanho `lg` é **eliminado**. Hoje o `Button` tem três tamanhos e o `ProductDashboard` mistura `md` e `sm` no mesmo contexto — inconsistência apontada no review (§22). A regra passa a ser: um contexto, um tamanho.

### 10.2 · Mapeamento das ações do produto

| Ação | Nível | Onde vive |
|---|---|---|
| **Adicionar Produto** | PRIMARY (página) | Cabeçalho da tela — único botão preenchido |
| **Movimentar** | PRIMARY (linha/card) | Visível em toda linha e todo card |
| **Baixa rápida** | SPECIALIZED SHORTCUT | Ícone neutro na linha; **presente no card mobile** |
| **Baixa de Produtos** | SECONDARY | Zona de controle da página |
| **Ajustar Estoque** | SECONDARY | Menu de ações |
| **Ver Histórico** | TERTIARY | Menu de ações |
| **Editar** | SECONDARY | Menu de ações, **antes do separador** |
| **Zerar Estoque** | DESTRUCTIVE | Menu de ações, **depois do separador** |
| **Excluir** | DESTRUCTIVE | Menu de ações, **depois do separador** |
| **Excluir selecionados** | DESTRUCTIVE, escopo nomeado | Barra contextual de seleção |
| **Zerar página** / **Excluir página** | DESTRUCTIVE, escopo nomeado | Região destrutiva separada e rotulada |

**Separador semântico no overflow (D3):** as ações destrutivas ficam num bloco próprio, após um separador visual. Hoje "Editar" e "Excluir" são vizinhos no mesmo menu plano, à mesma distância do cursor (UF-16) — separação espacial é prevenção de erro, não decoração.

**Split button descartado** conforme D3.

---

## 11. Form controls

**Regras invioláveis:** rótulo persistente (placeholder **nunca** substitui rótulo); erro ligado ao campo por `aria-describedby` **e** `aria-invalid`.

**Rótulo acessível é obrigatório no tipo, não na convenção.** Hoje `label` é opcional nas props de `Input` e `Select`, o que torna a regra inaplicável. A API deve exigir **`label` ou `aria-label`** — um dos dois, nunca nenhum. Apontado no review (§22).

### 11.0 · Como o erro é anunciado — revisto após o review

A primeira versão exigia `role="alert"` em **todo** erro de campo. O review apontou o efeito colateral: um formulário com cinco campos inválidos dispara cinco anúncios assertivos simultâneos, que se atropelam. Está certo. A regra passa a ser:

| Situação | Mecanismo |
|---|---|
| Erro de validação de campo | `aria-invalid` + `aria-describedby` apontando para a mensagem. **Sem `role="alert"`** — é anunciado quando o campo recebe foco |
| Submissão com múltiplos campos inválidos | **Um** resumo com `role="alert"`, e o foco movido para o primeiro campo inválido |
| Erro assíncrono do servidor (um por vez) | `role="alert"` na mensagem — é a única forma de a pessoa saber que algo voltou |

A dívida **A6** continua paga, mas pela via correta: o problema era o primitivo `Input` divergir dos outros campos do mesmo formulário, e a unificação agora acontece em torno de `aria-describedby`, com `role="alert"` reservado aos dois casos em que ele de fato ajuda.

### 11.1 · Estados — Input, Textarea, Select

| Estado | Borda | Fundo | Texto | Extra |
|---|---|---|---|---|
| `default` | `border-strong` | `surface` | `text-primary` | — |
| `hover` | `border-hover` | `surface` | `text-primary` | Papel semântico, não o primitivo `gray-400` — correção do review (§22) |
| `focus-visible` | `accent` | `surface` | `text-primary` | Anel de foco (§9) |
| `filled` | = default | = default | = default | Sem estado próprio — o conteúdo é o sinal |
| `disabled` | `border` | `surface-subtle` | `text-muted` | `cursor: not-allowed`; **hoje o `Input` não tem este estado** (M-9) |
| `invalid` | `danger` | `surface` | `text-primary` | `aria-invalid` + `aria-describedby`; mensagem `danger` abaixo (anúncio conforme §11.0) |

> **PROBLEMA** → `ui/Input.tsx` renderiza a mensagem de erro **sem** `role="alert"`, divergindo de outros campos do mesmo formulário (dívida **A6**, já registrada na revisão do Ajuste de Estoque).
> **DECISÃO** → `role="alert"` passa a ser responsabilidade do primitivo, não de quem o consome.
> **BENEFÍCIO** → paga uma dívida conhecida e torna impossível reintroduzi-la campo a campo.

### 11.2 · Estados — Button

| Estado | Comportamento |
|---|---|
| `default` / `hover` / `active` | Por nível (§10.1); hover escurece um degrau |
| `focus-visible` | Anel de foco (§9), idêntico em todos os níveis |
| `disabled` | Opacidade reduzida + `cursor: not-allowed`, sem alterar o layout |
| `loading` | Spinner + `aria-disabled` + `aria-busy` + ativação suprimida + rótulo no gerúndio |

> **PROBLEMA** → `isLoading` mostra o spinner mas **não desabilita** o botão; cada chamador precisa lembrar de passar `disabled` também. `ProductFormModal` passa `disabled` sem `isLoading` (sem spinner); `MovementFormModal` passa os dois (M-10).
> **DECISÃO** → o estado `loading` é responsabilidade do primitivo e usa **`aria-disabled`, não `disabled`**.
> **BENEFÍCIO** → um estado, um comportamento, em todos os botões do produto.

**Por que `aria-disabled` e não `disabled` — correção vinda do review (§22).** A primeira versão desta spec dizia "`loading` implica `disabled`" e tratava o `AdjustmentFormModal` como exceção. O review apontou, corretamente, que **o problema é geral**: `disabled` remove o foco do controle que a pessoa acabou de acionar, e o foco cai no `<body>`. Passa a ser a regra, não a exceção.

O review também apontou, com razão, que **`aria-disabled` sozinho não bloqueia clique nem teclado**. Portanto o primitivo precisa, no estado `loading`, das quatro coisas juntas:

1. `aria-disabled="true"` — anuncia o estado sem perder o foco;
2. **guarda no handler** — a ativação é ignorada enquanto carrega (é o que hoje o `AdjustmentFormModal` faz à mão em `confirmAdjustment`);
3. `aria-busy="true"` — anuncia que há operação em curso;
4. **rótulo textual no gerúndio** — o spinner é `aria-hidden`, então sem isso o envio é silencioso para leitor de tela.

Nenhum dos quatro é opcional: sozinho, cada um deixa um buraco.

---

## 12. Modal — gramática única

Baseada no primitivo `ui/Modal.tsx` (Radix), que já está correto. **Nenhum sistema paralelo.** A sheet de filtros do mobile (§15) é uma **variante deste primitivo**, jamais um quarto sistema de overlay.

### Estrutura

| Região | Conteúdo | Regra |
|---|---|---|
| `header` | Título (`component-title`) + descrição opcional (`body`, `text-secondary`) + fechar | **O título sempre nomeia o objeto**: "Registrar saída · Caneta Azul" |
| `body` | Conteúdo, rolável | Padding da escala; sem card interno |
| `footer` | Secundária à esquerda, primária à direita | Botão primário **nomeia a consequência** |

### Estados

| Estado | Especificação |
|---|---|
| `normal` | Ação primária habilitada |
| `loading` | Primária em `loading`; secundária permanece focável quando o cancelamento for seguro |
| `error` | Bloco `danger` inline, `role="alert"`, **persistente até ação do usuário** |
| `confirmation` | Corpo = resumo estruturado (lista de definição), sem texto de enchimento |
| `conflict` | Dois valores comparados lado a lado + ação de revisão |

> **PROBLEMA** → o `ConfirmDialog` renderiza sempre a frase genérica "Confirme para continuar. Esta ação afeta os dados do estoque." **abaixo** da descrição específica (M-14).
> **PRINCÍPIO** → texto que nunca varia é texto que se aprende a ignorar — e a desatenção contamina o que está ao redor.
> **DECISÃO** → o corpo do diálogo de confirmação é o resumo do que vai acontecer, ou nada.

**`QuickOut*` e `MovementHistoryModal` não migram nesta fase** — a classificação está em §18.

---

## 13. Data region — a exceção de densidade (D5)

A tabela **não é um card**: é uma região delimitada por borda, sem sombra, ocupando a largura disponível.

### 13.1 · Métricas

| Elemento | Valor | Justificativa |
|---|---|---|
| Altura de linha | ~44px | Mais densa que o resto do produto, ainda confortável para toque |
| Altura do cabeçalho | ~36px | Menor que a linha: é rótulo, não dado |
| Padding de célula | 12 vertical · 16 horizontal | A exceção de densidade — 12 contra 16 no resto |
| Separadores | Filete horizontal `border` | **Sem filetes verticais** — o alinhamento já cria as colunas |

### 13.2 · Colunas e alinhamento

| Coluna | Alinhamento | Tratamento |
|---|---|---|
| Seleção | centro | Checkbox com rótulo acessível |
| Produto | esquerda | Nome (`table-cell`, peso 500) com **SKU logo abaixo** (`caption`, `text-secondary`, maiúsculas por conteúdo — não por CSS) |
| Saldo / Mínimo | **direita** | **Par adjacente**: saldo em peso 600 `text-primary`, `mín. N` em `caption` `text-secondary` imediatamente abaixo. Ambos `tabular-nums` |
| Status | esquerda | Badge: cor + palavra |
| Ações | direita | PRIMARY "Movimentar" · atalho neutro · overflow |

> **PROBLEMA** → a tabela mostra o badge derivado de `balance < minStock` e **não mostra `minStock`** (C-6, UF-40). A única tela que exibe os dois lado a lado é o `QuickOutListModal`, um modal secundário. E o caminho alternativo de consulta — Editar — está quebrado por outro motivo (§17).
> **PRINCÍPIO** → o veredito nunca aparece sem a evidência; comparação deve ser visual, não mental.
> **DECISÃO** → saldo e mínimo formam **um par visual** lido como razão, na mesma célula, ambos com algarismos tabulares.
> **BENEFÍCIO** → "quanto comprar" passa a ser respondível na lista, sem abrir nada.

**Fundir SKU sob o nome** libera a coluna de 20% que ele ocupa hoje, sem perder o dado — mas o SKU **precisa continuar ordenável e copiável**.

> **PROBLEMA** → `select-none` é aplicado em 6 lugares do `DataTable`, inclusive nas células de dados (A-5). Copiar um SKU para colar em outro sistema é tarefa diária em estoque.
> **DECISÃO** → `select-none` fica restrito aos cabeçalhos clicáveis. Células de dados são selecionáveis.

### 13.3 · Interação

| Estado | Tratamento |
|---|---|
| `hover` de linha | Fundo `surface-subtle` |
| `selected` | **Receita**, não token: fundo `accent-subtle` **+ barra lateral `accent` de 2px** — dois sinais, nunca só cor |
| Cabeçalho ordenável | Rótulo **sempre visível** + indicador de direção + `aria-sort` **apenas na ordenação primária** |
| Seleção em lote | Barra contextual que **substitui a zona de controle** ao existir seleção; some quando não há |

> **PROBLEMA** → o `DataTable` com `sortable: true` e sem `headerRender` renderiza **só a seta**, sem o rótulo da coluna (M-8). Hoje não afeta ninguém porque `ProductsTable` sempre passa `headerRender` — é armadilha latente.
> **DECISÃO** → o rótulo é obrigatório; o indicador de ordenação o acompanha, nunca o substitui.

**Ordenação múltipla — escopo limitado deliberadamente.** O `DataTable` aceita vários critérios e hoje atribui `aria-sort` a **cada** coluna ordenada, sem comunicar precedência. O review apontou a subespecificação (§22), com razão. Esta spec define apenas que **só a ordenação primária carrega `aria-sort`**. O resto fica em aberto de propósito: a Fase 2 registrou (UF-08) que a ordenação secundária por Shift+clique é invisível e **enganosa** — aplicada só à página atual enquanto a primária vai ao banco. Especificar a apresentação de um recurso cuja permanência ainda não foi decidida seria trabalho perdido.

**Escopo da seleção:** "estes, desta página, agora". A seleção limpa ao paginar, buscar ou filtrar (decisão 8) — o que torna o rótulo "Excluir 3" sempre verdadeiro e elimina a possibilidade de excluir itens fora da tela (UF-46).

---

## 14. Movement grammar

### 14.1 · Vocabulário — quatro tipos, um idioma, uma forma

| Enum do banco | Rótulo no produto | Sinal | Papel de cor |
|---|---|---|---|
| `IN` | **Entrada** | `+` | `success` |
| `OUT` | **Saída** | `−` | `danger` |
| `ADJUSTMENT` | **Ajuste** | `±` conforme o delta | `accent-subtle` |
| `INITIAL_STOCK` | **Estoque inicial** | `+` | `success` |

> **PROBLEMA** → quatro tipos, três linguagens visuais, dois idiomas: `IN` verde, `OUT` vermelho, badge "AJUSTE", e `INITIAL_STOCK` **cru, em inglês, com underscore** — porque o ternário trata `ADJUSTMENT` e joga todo o resto no ramo `IN`/`OUT` (UF-34). O formulário compensa isso escrevendo "Entrada (IN)" (UF-20).
> **DECISÃO** → vocabulário único traduzido, uma forma visual (badge), direção sempre por **sinal textual** além da cor.
> **BENEFÍCIO** → aprende-se o vocabulário uma vez; o parêntese técnico some do formulário; a leitura funciona sem depender de cor (WCAG 1.4.1).

### 14.2 · Representação de uma movimentação

```
Entrada        +12        120 → 132        "Compra NF 4471"     ana@…      12/08 14:32
Saída           −5        120 → 115        "Requisição setor B"  jo@…       12/08 15:10
Ajuste         −73        120 →  47        "Contagem física"     ana@…      13/08 09:02
Estoque inicial +50         — →  50        "Estoque inicial"     ana@…      01/08 08:00
```

Campos, quando existirem: `tipo` · `quantidade` · `saldo anterior` · `saldo posterior` · `motivo` · `responsável` · `timestamp`.

**Regras:**
1. `Estoque inicial` mostra `—` como saldo anterior: é honesto quanto à ausência, em vez de fingir zero.
2. O delta é **sempre textual e assinado**. Cor apenas reforça.
3. A seta `→` recebe texto `sr-only` no formato "de 120 para 132" — **paga a dívida A5**, registrada na revisão do Ajuste de Estoque.
4. Timestamp com locale explícito `pt-BR` — hoje `MovementHistoryModal` usa `toLocaleString()` sem locale, dependendo da configuração do navegador (M-13).
5. **Linhas legadas** sem `previousQuantity`/`newQuantity` (geradas pelo `seed.ts`, que grava direto via Prisma) degradam para a quantidade crua com nota — comportamento **já implementado e a preservar**.

> **PROBLEMA** → o `StockService` grava `previousQuantity`/`newQuantity` em **toda** movimentação e a rota devolve os dois, mas a UI só exibe em ajustes (UF-33). O dado chega no payload e é descartado.
> **BENEFÍCIO** → "por que o estoque caiu?" passa a ser respondível por leitura. É mudança de **exibição**, sem tocar em backend.

### 14.3 · Saldo do produto × lista filtrada (decisão 4)

O **saldo atual do produto** vive no cabeçalho do histórico, ancorado ao produto e **imune ao filtro**. A lista abaixo é explicitamente um recorte, com o estado do filtro visível junto dela. A interface precisa deixar essa diferença explícita em texto — não deduzível.

---

## 15. Mobile

**Breakpoints: mantidos os defaults do Tailwind** (sm 640 · md 768 · lg 1024). Nenhum `screens` customizado — o sistema não introduz configuração onde a existente serve. A troca tabela↔cards permanece em `md` (768px).

**A validação em 768px é critério de aceite, não ressalva aberta** — ajuste aceito do review (§22). O risco é concreto e verificável no código: o `DataTable` é `table-fixed` com larguras percentuais somando 100%, e a coluna de ações carrega três controles. Mesmo com **cinco** colunas depois das fusões (seleção · produto · saldo/mínimo · status · ações), 768px é apertado. Critério: se a linha quebrar, truncar dado ou reduzir alvo abaixo do mínimo de §15.2, a troca sobe para `lg` (1024px) — decisão tomada no protótipo, com dados reais, não por antecipação.

### 15.1 · Tabela de paridade

| Capacidade | Desktop | Mobile | Decisão |
|---|---|---|---|
| Busca | Inline na zona de controle | **Inline** | Caminho principal de localização; nunca escondida |
| Filtro por status | Menu na zona de controle | **Sheet** com contador de ativos | Hoje só existe no cabeçalho da tabela (UF-06) |
| **Limpar filtro** | Chip removível + "Limpar" | **Chip removível + "Limpar" na sheet e fora dela** | Corrige o beco sem saída (UF-07): hoje só se entra no filtro |
| Ordenar | Cabeçalho de coluna | **Sheet** | Hoje **não existe** no mobile |
| Saldo | Coluna | **Inline no card** | — |
| Estoque mínimo | Par com o saldo | **Inline no card, pareado** | Hoje ausente no card (C-5) |
| Status | Coluna | **Inline no card** | — |
| Movimentar | Botão na linha | **Botão no card** | PRIMARY da linha |
| **Baixa rápida** | Ícone neutro na linha | **Presente no card** | Hoje **ausente** (C-5). Um vs. dois toques a validar no protótipo (D3) |
| Histórico | Overflow | **Overflow** | — |
| Ajustar | Overflow | **Overflow** | — |
| Editar | Overflow | **Overflow** | — |
| Ações destrutivas (item) | Overflow, após separador | **Overflow, após separador** | — |
| Ações destrutivas (lote) | Barra contextual / região destrutiva | **Ausentes — não renderizadas** | Ausência **declarada**. Hoje "Excluir selecionados" fica **visível e desabilitado** no mobile enquanto os cards nem oferecem seleção: um controle permanentemente morto. Correção do review (§22) |
| Paginação | Após a tabela | **Após a lista** | Corrige C-4: hoje a paginação é renderizada **antes** dos cards |

### 15.2 · Princípios

1. **Nenhuma capacidade crítica desaparece por `hidden md:*` sem alternativa.** Toda ausência é uma linha assinada nesta tabela.
2. **Nada revelado apenas por hover.**
3. O card **é** a linha com mais respiro vertical — não um card envolvendo uma linha.
4. **Alvo de toque: mínimo 44×44 CSS px** para toda ação do card, e **24×24 como piso absoluto** em qualquer controle, em qualquer largura. A densidade da região de dados (D5) é do desktop; no mobile ela cede para o alvo.
   *"Alvos confortáveis" não é verificável* — observação aceita do review (§22). Os atalhos atuais ficam entre ~28 e ~32px, ou seja, reprovam o critério de 44px que passa a valer.
5. O cabeçalho da página tem duas ações com rótulos longos ("Adicionar Produto", "Baixa de Produtos") e **nenhuma regra de quebra**. Abaixo de `sm`, elas empilham em largura total — a alternativa (truncar rótulo de ação) é pior.

---

## 16. Motion — política mínima

| Uso | Duração | Propriedade |
|---|---|---|
| Transição de estado (hover, foco, cor) | 120ms | `color`, `background-color`, `border-color` |
| Entrada/saída de overlay (modal, sheet, menu, toast) | 180ms | `opacity`, `transform` discreto |
| Tudo o mais | **nenhuma** | — |

**Proibido:** animação decorativa, transformação em elemento não interativo, animação de layout.

> **PROBLEMA** → o `Badge` tem `hover:scale-[1.02] transition-transform will-change-transform` (M-6) — animação num elemento **não interativo**, que reage ao mouse sem oferecer nada. É affordance falsa.
> **DECISÃO** → removida.

**`prefers-reduced-motion: reduce`** desativa toda transição não essencial. Hoje **não há nenhuma ocorrência** disso no projeto.

**`animate-fade-in`** é usada em `MovementHistoryModal` e **nunca foi definida** no `tailwind.config.js` (M-7) — a animação simplesmente não acontece. Definir ou remover; não deixar como está.

---

## 17. Estados do sistema

| Estado | Texto | Ícone | Cor | Live region | Nota |
|---|---|---|---|---|---|
| `loading` | Obrigatório | Spinner `aria-hidden` | Neutra | `role="status"` | Deve **preservar o layout** — sem salto quando o dado chega |
| `empty` | **Obrigatório e específico** | Opcional | Neutra | — | Distinguir "nada cadastrado" de "filtro não retornou nada", e oferecer ação |
| `error` | Obrigatório, **específico** | Opcional | `danger` | `role="alert"` | **Persistente até dispensa** |
| `success` | Obrigatório | Opcional | `success` | `role="status"` | Deve declarar o novo saldo |
| `warning` | Obrigatório | Opcional | `warning` | `role="status"` | — |
| `conflict` | Obrigatório | — | `warning` | `role="alert"` | Mostra os dois valores comparados |
| `disabled` | — | — | `text-muted` | — | Nunca o único sinal; o motivo deve ser inferível |

> **PROBLEMA** → o `ToastProvider` aplica `durationMs: 3500` como padrão para **todos** os tipos (A-11). "Estoque insuficiente" — a única informação sobre por que a operação falhou — some sozinha antes de muita gente terminar de ler.
> **DECISÃO** → toasts de erro não auto-dispensam.

> **PROBLEMA** → estado vazio é literalmente `"Nenhum produto encontrado."` (A-10), sem distinguir causa nem oferecer saída.
> **DECISÃO** → estado vazio nomeia a causa e oferece a ação correspondente (limpar filtros / cadastrar produto).

**A infraestrutura de live regions do projeto está correta e deve ser preservada:** as duas regiões sempre montadas do `ToastProvider` (polite/assertive), e as do `LowStockBanner` e `ApiStatusBanner`.

---

## 18. Migração — classificação (sem implementar)

| Componente / artefato | Classe | O que muda |
|---|---|---|
| `ui/Modal.tsx` (Radix) | **MANTER + 1 ajuste** | É o primitivo único. Ganha variante `sheet` para o mobile. **Não está 100% correto como afirmei antes**: o botão de fechar usa `focus-visible:ring-2 ring-blue-600` **sem `ring-offset`**, violando a regra de §9 que declarei "sem exceção". Apontado no review (§22) |
| `ui/MenuPopover.tsx` | **MANTER** | Melhor componente do projeto (WAI-ARIA completo). Ganha separador semântico |
| `ui/ToastProvider.tsx` | **MANTER** | Live regions corretas. Só muda a duração de erro |
| `ui/ConfirmDialog.tsx` | **MANTER** | Remover o texto genérico do corpo |
| `hooks/useConfirm.tsx` | **MANTER** | Passar a repassar `isPending` (hoje não repassa — UF-47) |
| `ui/LowStockBanner`, `ui/ApiStatusBanner` | **MANTER** | Só tokens |
| `ui/Button.tsx` | **ADAPTAR** | Variantes por nível (§10); `loading` implica `disabled`; suportar `aria-disabled` |
| `ui/Input.tsx`, `ui/Select.tsx` | **ADAPTAR** | Estado `disabled`; `role="alert"` no erro (dívida A6); foco unificado |
| `ui/Badge.tsx` | **ADAPTAR** | Remover `hover:scale`; `radius-control`; variantes = estados de estoque + `accent-subtle` |
| `ui/Card.tsx` | **ADAPTAR** | Sem sombra; **proibido** envolver a região de dados |
| `ui/DataTable.tsx` | **ADAPTAR** | Região em vez de card; densidade; `tabular-nums`; `select-none` só no cabeçalho; rótulo obrigatório no cabeçalho ordenável |
| `products/ProductsTable.tsx` | **ADAPTAR** | Par saldo/mínimo; SKU sob o nome; hierarquia de ações |
| `products/ProductCardList.tsx` | **ADAPTAR** | Mínimo, baixa rápida, paridade (§15) |
| `products/ProductActionsMenu.tsx` | **ADAPTAR** | Separador antes do bloco destrutivo |
| `products/StatusFilterMenu.tsx` | **ADAPTAR** | **Faltava na primeira versão** (achado do review, §22). Usa um **terceiro** vocabulário — "OK / Atenção / Em falta" — enquanto a tabela diz "Em estoque / Estoque baixo / Sem estoque" e o backend usa `OK/ATTN/OUT`. Filtrar e ler passam a usar as mesmas palavras |
| `ProductDashboard.tsx` | **ADAPTAR** | Zonas; barra contextual; ordem paginação/cards |
| `MovementFormModal.tsx` | **ADAPTAR** | Gramática de operação (contexto, intenção, preview) |
| `ProductFormModal.tsx` | **ADAPTAR** | Usar o primitivo `Input`; `useId()` |
| `AdjustmentFormModal.tsx` | **ADAPTAR** | Só tokens + dívidas A1/A4. **A estrutura é referência, não alvo** |
| `QuickOutModal.tsx` | **MIGRAR** | Para o primitivo `Modal`, preservando os 20 comportamentos do contrato |
| `QuickOutListModal.tsx` | **MIGRAR** | Idem + `overflow-x-auto` (hoje `overflow-hidden` corta a tabela no mobile) |
| `QuickOutHistoryModal.tsx` | **MIGRAR** | Idem |
| `MovementHistoryModal.tsx` | **MIGRAR** | Para o primitivo + lógica de extrato (D6) |
| Token `brand` no `tailwind.config.js` | **DEPRECAR** | `#4F46E5` é literalmente `indigo-600` — dois nomes para o mesmo valor |
| `animate-fade-in` | **DEPRECAR** | Usada e nunca definida |
| `rounded-full`, gradientes, `shadow-2xl`/`xl` | **DEPRECAR** | Fora do sistema |
| `select-none` em células | **DEPRECAR** | Impede copiar SKU |
| `FinanceDashboard.tsx`, `SalesDashboard.tsx` | **DEPRECAR** | Código morto confirmado (zero imports) |

**Pré-requisito registrado:** a migração dos quatro componentes marcados **MIGRAR** exige a Task 0 de testes de caracterização, e o contrato de 20 comportamentos da §9.3 do `user-flows.md`.

---

## 19. Compatibilidade com Tailwind

**Nada novo é introduzido.** Sem CSS-in-JS, sem biblioteca de tokens, sem component library, sem plugin. Tailwind 3.4.17 + PostCSS + Autoprefixer já instalados bastam.

### Mapeamento conceitual

**Nível primitivo:** já existe — é a paleta default do Tailwind. Não é redefinida.

**Nível semântico:** variáveis CSS em `:root` no `index.css`, referenciadas pelo `theme.extend` do config:

```
:root  →  --color-accent: 37 99 235;   (canais RGB, sem função)
          --color-surface: 255 255 255;
          ...

config →  colors: { accent: 'rgb(var(--color-accent) / <alpha-value>)', ... }
          borderRadius: { control: '6px', surface: '8px' }
          fontSize:  { 'page-title': ['24px', { lineHeight: '1.25', fontWeight: '600' }], ... }
          boxShadow: { overlay: '<uma sombra>' }
```

Uso no componente: `bg-accent`, `text-secondary`, `rounded-control`, `shadow-overlay`.

**Três propriedades desta abordagem, todas relevantes:**
1. É o padrão nativo do Tailwind 3 — nenhuma dependência nova.
2. `<alpha-value>` preserva `bg-accent/10`, então opacidade continua funcionando.
3. Trocar os valores em `:root` troca o tema inteiro **sem tocar em nenhum componente** — o que mantém dark mode viável no futuro sem retrabalho, exatamente como decidido na Fase 4, sem implementá-lo agora.

### 19.1 · Como o sistema é imposto — corrigido após o review

A primeira versão desta spec afirmava que substituir `extend` por **override** daria "garantia mecânica", quebrando o build em qualquer uso fora do sistema. **Isso é falso**, e o review derrubou a afirmação com razão:

> Tailwind não emite erro quando uma classe não existe no tema. Ele simplesmente **não gera o CSS**. `rounded-lg` num JSX vira uma classe sem regra — o build passa, o CI passa, e a interface fica silenciosamente sem estilo.

Ou seja, override não é enforcement: é **regressão visual silenciosa**, que é pior que o problema que eu queria resolver. Isso afetaria usos reais hoje (`text-3xl` no `ProductDashboard`, `shadow-sm` no `Card` e no `DataTable`, os três tamanhos do `Button`).

**O mecanismo correto é lint, não tema.** Uma regra que falha o CI de verdade:

| Camada | Papel |
|---|---|
| `theme.extend` | **Adiciona** os utilitários semânticos. Nada é removido, nada quebra em silêncio |
| **Regra de lint** com lista de utilitários proibidos (`rounded-full`, `rounded-2xl`, `text-3xl`, `shadow-2xl`, `ring-indigo-*`, `text-gray-400`, …) | **Falha o CI** com mensagem apontando o token correto |
| Revisão humana | Última linha, não a primeira |

O `eslint.config.js` e o gate de CI (`.github/workflows/ci.yml`) já existem e já são obrigatórios em todo PR — é o ponto natural para isso, sem introduzir ferramenta nova.

**Consequência honesta para a promessa de tema:** enquanto os defaults do Tailwind continuarem disponíveis, "trocar o tema inteiro mudando `:root`" só vale para o que **usa** os tokens. A garantia é do lint, não do CSS. O review está certo nesse ponto e a promessa foi reescrita.

---

## 20. Decisões que precisam de aprovação

**A1 · Raio: eliminar `rounded-full`.** Badges e o botão "Movimentar" passam a `radius-control`. É a mudança visualmente mais perceptível do sistema.

**A2 · Escala tipográfica com máximo de 24px.** O título da página cai de 30/36px para 24px, e a marca cai para 14px. Deixa o topo bem mais discreto do que é hoje.

**A3 · Rigor do Tailwind — recomendação REESCRITA após o review.** Mantém-se `theme.extend` (nada quebra em silêncio) **e adiciona-se uma regra de lint** com lista de utilitários proibidos, ligada ao gate de CI que já existe. Minha recomendação anterior — override de tema — estava tecnicamente errada e foi retirada: override não falha o build, só apaga o estilo.

**A4 · Breakpoint da troca tabela↔cards.** Mantido em `md` (768px), com **critério de aceite explícito** no protótipo (§15). Mover para `lg` se o critério falhar.

**A5 · `gray-400` banido para texto** (2.54) **e `gray-300`/`gray-400` banidos como contorno de controle** (1.47 e 2.54 — reprovam a WCAG 1.4.11, que exige 3:1). Borda de campo passa a `gray-500`. Isso deixa os campos visivelmente mais marcados do que hoje — é a mudança de aparência mais direta vinda do review.

**A6 · Rótulo acessível obrigatório no tipo.** `Input` e `Select` passam a exigir `label` **ou** `aria-label`. Torna a regra de rótulo persistente aplicável em vez de aspiracional, ao custo de tocar em todas as chamadas.

---

## 21. Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| **`tnum` ausente no subset woff2** — a comparação numérica é premissa da direção | Média | Verificação de runtime na Fase 7; plano B já escolhido (auto-hospedar Inter) |
| **`extend` não impedir o uso de utilitários fora do sistema** | Alta | Regra de lint no gate de CI que já existe (§19.1) — **não** override de tema, que só apagaria o estilo em silêncio |
| **Borda de controle mais escura mudar a aparência dos formulários** | Alta | Consequência direta da WCAG 1.4.11; validar no protótipo. É correção de acessibilidade, não escolha estética |
| **Adoção de tokens ficar acoplada a mudanças funcionais grandes** (sheet, barra contextual, migração de 4 modais) | Média | §13/§15 descrevem o **alvo**; o **sequenciamento** é da Fase 8. A camada de tokens pode entrar sozinha, antes de qualquer mudança de fluxo |
| **Migração dos `QuickOut*` perder comportamento** | Alta | Task 0 + contrato de 20 comportamentos como pré-requisito |
| **Densidade da região de dados não ser respeitada**, nivelando tudo | Média | Verificar no protótipo com a tabela cheia, não com três linhas |
| **Blue-600 (5.17) ter menos margem que indigo-600 (6.29)** | Baixa | Passa AA nos três papéis; `accent-hover` (6.70) disponível onde precisar de mais margem |
| **Bug funcional ser corrigido dentro de task visual** | Alta | §17 do `user-flows.md` mantém a fronteira; F-06 e F-07 saem em tasks próprias |

---

## 22. Technical Review

**Reviewer:** Codex (`codex-cli 0.150.1`), executado em `--sandbox read-only`, sem permissão de escrita, com instrução explícita de **não redesenhar** o sistema.
**Veredito do reviewer:** **REPROVADO** — *"a base é tecnicamente implementável, mas a falsa garantia de CI, o contrato incompleto de tokens e o contraste insuficiente dos controles impedem aprovar a especificação como está."*

O veredito foi **aceito**. Dois achados eram erros factuais meus, e um deles derrubava uma recomendação que eu havia marcado como preferida. A spec foi revisada; o que segue registra cada ponto e o que foi feito com ele.

### 22.1 · Aceitos — corrigidos na spec

| # | Achado | Verificação | O que mudou |
|---|---|---|---|
| 1 | **Override de tema não falha o build.** Tailwind apenas deixa de gerar o CSS: o CI passa com a interface sem estilo | Correto. Meu erro | **A3 reescrita** (§19.1): mantém `extend` + regra de lint no gate de CI existente. Recomendação anterior retirada |
| 2 | **`border-strong = gray-300` dá ~1.47:1**, abaixo dos 3:1 da WCAG 1.4.11 para contorno de controle | **Verificado por cálculo próprio:** gray-300 = 1.47 · gray-400 = 2.54 · gray-500 = 4.83. E `gray-50` vs branco = **1.045**, confirmando que a borda é o único delimitador | `border-strong` → **gray-500**; novo papel `border-hover`; nova §3.4 separando contorno de controle (sujeito a 1.4.11) de separador decorativo (não sujeito) |
| 3 | `success`/`warning`/`danger` representavam fundo e texto num token só | Correto | Viraram pares `X` / `X-subtle`, com contraste medido do texto sobre o fundo sutil (5.21 · 4.84 · 5.91) |
| 4 | `surface` e `surface-elevated` são ambos `white` | Correto | `surface-elevated` **cortado**; elevação fica por conta da sombra |
| 5 | `accent-hover` e `accent-text` são ambos blue-700 | Correto | Colapsados em `accent-strong` |
| 6 | `elevation-flat` não precisa de token | Correto | Cortado; sobra **um** token de sombra |
| 7 | `selected` é receita composta, não cor | Correto | Rebaixado de token para receita de estado (§13.3) |
| 8 | Spec usava o primitivo `gray-400` no hover, contrariando a própria regra | Correto | Virou o papel `border-hover` |
| 9 | "Mesma altura" não resolvia os três tamanhos de `Button`; o dashboard mistura `md` e `sm` | Correto | Nova §10.3: **dois** tamanhos, `lg` eliminado, um contexto = um tamanho |
| 10 | `loading → disabled` remove o foco — problema **geral**, não exceção do `AdjustmentFormModal`; e `aria-disabled` sozinho não bloqueia ativação; falta `aria-busy` | Correto nos três | §11.2 reescrita: `aria-disabled` + guarda no handler + `aria-busy` + rótulo no gerúndio, os quatro obrigatórios |
| 11 | `role="alert"` em todo erro de campo gera anúncios assertivos simultâneos | Correto | Nova §11.0: `aria-describedby` por campo; `role="alert"` só em resumo de submissão e em erro assíncrono do servidor |
| 12 | `label` opcional na API torna a regra de rótulo inaplicável | Correto | Nova decisão **A6**: exigir `label` ou `aria-label` no tipo |
| 13 | `StatusFilterMenu` usa um **terceiro** vocabulário ("OK / Atenção / Em falta") e não estava na classificação de migração | **Verificado no código.** Correto, e eu havia perdido | Adicionado a ADAPTAR (§18) |
| 14 | Modal declarado "já correto", mas o botão de fechar não tem `ring-offset` | **Verificado.** Correto | Reclassificado como MANTER **+ 1 ajuste** |
| 15 | Inconsistência interna: §15 dizia "seis colunas", a tabela tem cinco após as fusões | Correto | Corrigido |
| 16 | `aria-sort` em toda coluna ordenada, sem precedência | Correto | Só a primária carrega `aria-sort`; secundária deliberadamente fora de escopo (depende da decisão de UF-08) |
| 17 | "Alvos confortáveis" não é verificável | Correto | **44×44 px** no card, **24×24** como piso absoluto. Os atalhos atuais (28–32px) reprovam |
| 18 | Ações em lote "podem não existir" era frouxo: hoje o botão fica **visível e desabilitado** no mobile | **Verificado.** Correto | Passa a **ausente, não renderizado** |
| 19 | Validação em 768px precisa ser critério de aceite, não ressalva | Correto | Virou critério com condição de falha explícita (§15) |
| 20 | Ações do cabeçalho sem regra de quebra | Correto | Empilham em largura total abaixo de `sm` |
| 21 | Oito papéis tipográficos materializados criariam API maior que a escala | Correto | **Cinco** utilitários; os oito papéis são mapa de uso |
| 22 | Três planos B para `tnum` é excesso | Parcial | Cortados os planos 2 e 3; mantido o auto-hosting |

### 22.2 · Rejeitados, com justificativa

| # | Achado | Por que não foi aceito |
|---|---|---|
| A | **Cortar `focus` por ser alias de `accent`** | Tecnicamente é alias. Mas nomeá-lo é o que torna auditável a regra "uma única semântica de foco": dá para procurar por `ring-focus` e achar toda exceção. Se os componentes usarem `accent` direto, foco e ação primária ficam indistinguíveis numa busca — e foi exatamente a impossibilidade de auditar que produziu as 7 variantes de anel de foco de hoje. **Mantido, com a justificativa registrada na spec** |
| B | **Colapsar `background` e `surface-subtle`** (ambos gray-50) | São papéis distintos que hoje compartilham valor e divergiriam num tema escuro. Diferente do caso `brand` = `indigo-600`, que eram dois nomes para o **mesmo papel** (foco), usados de forma intercambiável. **Mantidos, agora com o alias declarado explicitamente** em vez de implícito |
| C | **"O documento mistura tokens com mudanças funcionais grandes"** | Rejeito o enquadramento: a classificação MANTER/ADAPTAR/DEPRECAR/MIGRAR foi pedida explicitamente nesta fase, e descrever o alvo não é sequenciar a entrega. **Aceito o risco subjacente**: acrescentado a §21 que a camada de tokens pode entrar sozinha, antes de qualquer mudança de fluxo, e que o sequenciamento é da Fase 8 |
| D | **Ordenação múltipla subespecificada** (aceito só em parte) | Aceita a parte de `aria-sort`. Rejeitada a expectativa de especificar a apresentação completa: a Fase 2 registrou que a ordenação secundária é invisível e **enganosa** (aplicada só à página atual enquanto a primária vai ao banco). Especificar a apresentação de um recurso cuja permanência não foi decidida é trabalho perdido |

### 22.3 · Avaliação do review

O review pagou seu custo em dois achados que eu não teria encontrado sozinho: **a falsa garantia de CI** (eu havia recomendado ativamente uma solução que não funciona) e **o contraste de borda** (medi `gray-400` para texto e não apliquei 1.4.11 a contornos de controle). Ambos foram verificados de forma independente antes de aceitos — o de contraste, recalculando as razões; os de código, lendo os arquivos citados.

Nem tudo foi aceito: quatro pontos foram rejeitados ou aceitos só em parte, dois deles porque o reviewer otimizou contagem de tokens onde o objetivo real era **auditabilidade**, e um porque cobrava especificação de um recurso cuja permanência ainda está em aberto.

**Estado após a revisão:** os três motivos citados no veredito de reprovação — falsa garantia de CI, contrato incompleto de tokens e contraste insuficiente de controles — estão corrigidos. Um segundo ciclo de review, se desejado, deve rodar sobre esta versão.
