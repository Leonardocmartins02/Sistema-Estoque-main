# Fase 6 — Prototype

**Data:** 28/08/2026
**Escopo:** validar a direção **B — Operação** e o Design System da Fase 5 antes da implementação.
**Nenhum arquivo em `packages/` foi alterado.** Nenhum componente migrado, nenhum token implementado no produto, nenhuma regra de negócio tocada, nenhum bug corrigido.

## O que foi criado

| Arquivo | O que é |
|---|---|
| `docs/ui-ux/prototype/dashboard.html` | Protótipo autocontido: HTML + CSS puro, sem framework, sem dependência instalada. Única requisição externa é a Inter do Google Fonts — a mesma origem que o produto já usa |
| `docs/ui-ux/prototype/README.md` | O que é, o que não é, como abrir |
| `docs/ui-ux/prototype.md` | Este documento |

Localização deliberadamente documental. O protótipo não é importado por nada, não entra em build e não deve ser copiado para `packages/`.

---

## 1. Como a evidência foi produzida

Um documento que afirma "a hierarquia funciona" não vale nada. O protótipo foi **aberto no Chrome**, servido em `localhost`, e **medido no DOM**. Toda classificação abaixo cita a medição que a sustenta.

Duas correções de método aconteceram durante a validação, e valem registro porque **ambas quase produziram conclusões falsas**:

1. **A primeira medição de `tnum` mediu a fonte errada.** O protótipo referenciava `Inter` mas não a carregava; o Windows caiu no fallback (Segoe UI). Pior: `document.fonts.check('14px Inter')` retornou `true` mesmo assim — ele responde "consigo renderizar", não "esta fonte está carregada". A medição foi refeita carregando a Inter do Google Fonts e confirmando com um *canary* de largura (128.363px com Inter × 120.037px com `system-ui`) que a fonte ativa era mesmo a certa.
2. **Redimensionar a janela do sistema não funcionou** — a janela estava maximizada, e `resize_window` não alterou `innerWidth` (permaneceu 1536). A validação de breakpoint foi refeita com **`<iframe>` de largura controlada**, que têm viewport próprio e portanto respondem às media queries de forma determinística.

---

## 2. A pendência da Fase 5 está fechada: **Inter tem `tnum`**

Era o risco V1, marcado como "resultado parcial, não é um sim". Medido no navegador, com a Inter carregada exatamente como o produto a carrega:

| Medição (14px, Inter, peso 400) | Largura |
|---|---|
| `1111` com `font-feature-settings:"tnum" 0` | **22,788px** |
| `0000` com `font-feature-settings:"tnum" 0` | **35,338px** |
| `1111` com `tnum 1` | **36,313px** |
| `0000` com `tnum 1` | **36,313px** |

**Conclusão:** o subset woff2 servido pelo Google Fonts **retém `tnum`**, e a feature **altera o rendering**. O plano B (auto-hospedar a Inter) é desnecessário.

E o problema que ela resolve é grande, não cosmético: sem a feature, quatro dígitos variam **55% em largura** conforme os algarismos (22,79 × 35,34px). Numa coluna de saldos, isso é a diferença entre uma escada legível e um serrilhado.

> **Hipótese: "Inter permite alinhamento numérico consistente" — VALIDADA.**
> Evidência: as quatro medições acima. Risco V1 da Fase 5 pode ser encerrado.

---

## 3. Desktop — a linha da tabela

### 3.1 · Medições, variante A (3 controles) × B (2 controles)

Mesma tabela, mesmos dados, mesmos tokens; só muda a coluna de ações.

| Viewport | Coluna de ações A | % da tabela (A) | Coluna de ações B | % da tabela (B) | Coluna do produto (A) |
|---|---|---|---|---|---|
| **900px** | 206px | **24,2%** | 150px | 17,6% | 318px |
| **1024px** | 206px | **21,1%** | 150px | 15,4% | 442px |
| **1440px** | 206px | **16,5%** | 150px | 12,0% | 714px |

Paradas de tabulação, com 8 linhas na página: **A = 32 · B = 24**. Extrapolando para as 10 linhas por página do produto: **A = 40 · B = 30**.

### 3.2 · Leitura

- Em **1440px** a diferença é confortável: 16,5% × 12,0% da largura. Nenhuma das duas variantes prejudica a região de dados.
- Em **900px** — notebook pequeno, tablet em paisagem, janela dividida — a variante A passa a consumir **quase um quarto** da tabela em ações, e a coluna do produto cai para 318px. É aí que a hipótese aprovada começa a doer.
- A economia de B é constante em pixels (56px) e crescente em proporção conforme a tela encolhe.
- Nenhuma das variantes truncou o botão "Movimentar" nem gerou scroll horizontal em nenhuma largura (`overflowH = 0` em 900, 1024 e 1440).

> **Hipótese D3(a): "três controles por linha funcionam no desktop" — VALIDADA COM RESSALVA.**
> Funciona em ≥1024px. Em 900px a coluna de ações chega a 24,2% da região de dados — o dobro do peso da coluna de status. A ressalva não é estética: é que a decisão aprovada foi tomada pensando em telas largas e degrada exatamente onde o produto ainda usa tabela.

### 3.3 · O achado que só apareceu renderizando

**A altura de linha medida é 65px, não os ~44px especificados na Fase 5.**

Medido em todas as larguras de tabela (900, 1024, 1440): `linhaPadrao = 65px`, inclusive nas linhas com nome longo.

A causa é a colisão de duas decisões aprovadas separadamente:

- **A5 / "veredito + evidência"** exige saldo e mínimo visíveis juntos → a célula ganhou duas linhas de texto.
- **D5 / exceção de densidade** especificou `~44px` de altura de linha.

As duas não cabem juntas. `44px` era compatível com uma célula de uma linha; com o par saldo/mínimo empilhado, o piso real é ~65px. **A especificação está errada, não o protótipo** — e o número certo é o observado.

> **Hipótese: "linha de ~44px na região de dados" — REJEITADA.**
> Evidência: 65px medidos, com o par saldo/mínimo que a própria regra de evidência exige. A Fase 5 precisa corrigir o valor ou mudar o arranjo do par (ver §11, decisão P-2).

---

## 4. Mobile

Todas as capacidades críticas foram verificadas **por visibilidade computada** (`display`, `visibility` e caixa > 0), não por presença no HTML.

| Largura | Layout | Capacidades ausentes | Scroll horizontal | Alvo de toque |
|---|---|---|---|---|
| 375px | CARDS | **nenhuma** | 0 | **44px** |
| 600px | CARDS | **nenhuma** | 0 | 44px |
| 767px | CARDS | **nenhuma** | 0 | 44px |
| 768px | CARDS | **nenhuma** | 0 | 44px |
| 900px | TABELA | **nenhuma** | 0 | — |
| 1024px | TABELA | **nenhuma** | 0 | — |
| 1440px | TABELA | **nenhuma** | 0 | — |

Capacidades conferidas em cada largura: busca · filtros · **limpar filtros** · ordenar · saldo · mínimo · status · movimentar · **baixa rápida** · mais ações · paginação.

> **Hipótese: "o mobile preserva capacidade" — VALIDADA.**
> Evidência: zero capacidades ausentes em 375, 600, 767 e 768px, com alvos de 44px. Isso inverte o achado UF-07/C-5 da Fase 2, em que ordenação, filtro, limpar-filtro e baixa rápida simplesmente não existiam abaixo de `md`.

> **Hipótese: "alvo de toque ≥ 44px" — VALIDADA.** Medido 44×44 em todos os botões de card. Os controles da linha desktop ficam em 32px, acima do piso de 24px e abaixo do alvo de toque — correto, já que ali não há toque.

---

## 5. Baixa rápida no mobile — A (inline) × B (no overflow)

Comparadas lado a lado em largura fixa de 375px.

| Critério | A — inline | B — no overflow |
|---|---|---|
| Toques até concluir | **1** para abrir o diálogo | **2** (abrir menu → escolher) |
| Espaço no card | Consome um alvo de 44×44 e estreita "Movimentar" | Libera a largura para "Movimentar" |
| Risco de toque acidental | **Maior**: fica encostado em "Movimentar", com 8px de separação, num alvo de 44px | Menor: exige um gesto deliberado |
| Discoverability | Alta se o ícone for compreensível — **e aqui está o problema** | Média: o rótulo textual no menu é inequívoco |
| Peso visual repetido | Aparece em **todos** os cards | Aparece zero vezes |

**O que a renderização mostrou e o raciocínio não mostrava:** um botão **só de ícone**, ao lado de um botão com rótulo textual, para uma operação que **subtrai estoque de forma permanente**, não se explica sozinho. No protótipo o glifo é `↓`; com um ícone de biblioteca ele fica mais bonito, não mais claro. A pessoa precisa saber de antemão o que aquilo faz — que é exatamente *recall* em vez de *recognition*.

**Recomendação: variante B — baixa rápida no overflow, no mobile.**

Justificativa, e o que ela custa: um toque a mais numa operação cuja frequência **não conhecemos**. A decisão 2 do brief é explícita em não tratar a baixa rápida como dominante sem dado de uso. Diante de frequência desconhecida, o custo assimétrico manda: um toque a mais é reversível e barato; uma subtração de estoque acidental é permanente e não tem desfazer (decisão 1). **B é a escolha conservadora enquanto não houver dado**, e é trivial promovê-la a inline depois — o inverso, não.

> **Hipótese D3-mobile — decidida como B, aguardando sua aprovação (§12, P-1).**

---

## 6. Breakpoint `md` — e um achado prático sobre 768px

| Largura da moldura | Viewport CSS real | Layout |
|---|---|---|
| 767px | 766px | CARDS |
| **768px** | **766px** | **CARDS** |
| 900px | 898px | TABELA |

**A moldura de 768px não virou tabela.** A barra de rolagem consumiu 2px do viewport (766px), e a media query `min-width: 768px` não disparou.

Isso não é artefato do protótipo — é o comportamento real. Uma janela de desktop com **768px nominais e barra de rolagem clássica** (Windows/Linux) tem viewport CSS de ~751–766px e **fica em cards**. Já um iPad em retrato, com 768 CSS px e barra de rolagem sobreposta, **vira tabela**. O mesmo número nominal produz layouts diferentes conforme o sistema.

**Isso não reprova `md`**, porque a falha é segura: quando o breakpoint não dispara, cai-se em cards — e os cards preservam 100% das capacidades (§4). Nunca se cai numa tabela espremida.

> **Hipótese A4: "`md` (768px) satisfaz o critério de paridade" — VALIDADA.**
> Evidência: em 375, 600, 767, 768, 900, 1024 e 1440px, **zero capacidades ausentes e zero scroll horizontal**. O critério declarado na Fase 5 — *nenhuma capacidade crítica desaparece e nenhuma composição fica inutilizável em torno da transição* — foi satisfeito em todas as larguras.
> **Ressalva registrada:** 768px é a fronteira exata do iPad em retrato, e o resultado ali depende do tipo de barra de rolagem. Um produto que queira comportamento previsível nesse aparelho específico deveria trocar para `lg` (1024px). Não recomendo trocar: a tabela é confortável em 900px (`overflowH = 0`, nada truncado), e adiar a tabela até 1024px desperdiçaria as telas entre 768 e 1024.

---

## 7. Região de dados

| Regra | Resultado | Evidência |
|---|---|---|
| Tabela como **região**, não card | **VALIDADA** | Sem sombra; borda de 1px define a região; sem card externo, portanto sem card-dentro-de-card |
| Par saldo/mínimo comparável | **VALIDADA** | Alinhados à direita, `tabular-nums` ativo (§2), mínimo em `caption` logo abaixo do saldo — lidos como uma razão |
| Veredito nunca sem evidência | **VALIDADA** | "Estoque baixo" aparece sempre ao lado de `8 un. / mín. 15`. O achado C-6 fica resolvido *na tela em que a decisão acontece* |
| Estado por cor + palavra | **VALIDADA** | Badge com ponto colorido **e** texto. Legível em escala de cinza |
| Densidade da região > resto do produto | **VALIDADA COM RESSALVA** | Padding de 12px vertical contra 16px no resto, mas a altura real é 65px (§3.3) |
| Ações destrutivas fora da hierarquia primária | **VALIDADA** | Nenhuma ação vermelha na linha. As destrutivas aparecem no menu, depois de separador, e na barra de seleção — em contorno, não preenchidas |
| Vermelho só no momento destrutivo | **VALIDADA** | Na tabela inteira, o único vermelho é o do estado "Sem estoque". Contraste com hoje, em que o botão de baixa rápida é vermelho nas 10 linhas (A-1) |
| Barra contextual substitui a zona de controle | **VALIDADA** | Aparece com seleção, nomeia o escopo ("3 selecionados nesta página", "Excluir 3 produtos"), some sem seleção |

---

## 8. Gramática das operações

As quatro operações foram renderizadas lado a lado. Todas respondem às seis perguntas:

| | Entrada | Saída | Baixa rápida | Ajuste |
|---|---|---|---|---|
| 1. Qual produto? | ✅ contexto | ✅ | ✅ | ✅ |
| 2. Qual intenção? | ✅ no título | ✅ | ✅ | ✅ |
| 3. Quantidade/destino? | quantidade a somar | quantidade a subtrair | quantidade + atalhos | **saldo alvo** |
| 4. Saldo antes? | ✅ 1.250 | ✅ | ✅ | ✅ |
| 5. Saldo depois? | ✅ 1.370 | ✅ 1.205 | ✅ 1.245 | ✅ 1.180 |
| 6. Vou gravar o quê? | "Registrar entrada de 120 un." | "Registrar saída de 45 un." | "Confirmar baixa de 5 un." | "Revisar ajuste →" |
| **Cerimônia** | N1 | N1 | N1 | **N2** |

> **Hipótese: "uma gramática comum com cerimônia variável" — VALIDADA.**
> As quatro compartilham o mesmo esqueleto (contexto → campo → preview → rodapé que nomeia a consequência) e diferem só onde o domínio exige. O ajuste é visivelmente o único de dois passos, e o próprio diálogo explica por quê: *"Você informou um destino, não um efeito"*. A assimetria da Fase 2 — ajuste com dupla confirmação e movimentação manual sem nada — desaparece sem nivelar tudo por cima.

### 8.1 · Duas inconsistências que só a renderização revelou

1. **Separador de milhar aplicado de forma desigual.** No bloco de contexto o saldo aparece como `1250`; no preview, como `1.250`. O Design System manda `pt-BR` em toda quantidade — e eu mesmo violei isso em dois lugares do mesmo diálogo, sem perceber, ao escrever o protótipo. É a prova prática de que **formatação numérica precisa de um único helper**, não de disciplina: se derivou em 200 linhas de protótipo, vai derivar em 4.400 linhas de produto.
2. **Sinal de menos com hífen.** O delta renderiza `-45` com hífen-menos (`U+002D`), que é mais estreito que o sinal de menos tipográfico (`U+2212`) e desalinha justamente numa coluna que existe para alinhar. Detalhe pequeno, consequência direta do requisito numérico.

Ambos entram como decisões a aprovar (§12, P-3).

---

## 9. Histórico — direção C (Registro)

Renderizado com os quatro tipos:

```
28/08/2026 09:02   Ajuste            127 → 125    −2    Contagem física       ana@…
27/08/2026 16:40   Saída             132 → 127    −5    Requisição setor B    joao@…
26/08/2026 11:15   Entrada           120 → 132   +12    Compra NF 4471        ana@…
01/08/2026 08:00   Estoque inicial     — →  50   +50    Estoque inicial       ana@…
```

| Regra | Resultado |
|---|---|
| Responde "o que aconteceu com este estoque?" por leitura | **VALIDADA** — nenhuma linha exige aritmética mental |
| `antes → depois` nos quatro tipos | **VALIDADA** — inclusive `INITIAL_STOCK`, que hoje vaza como enum cru em inglês |
| `Estoque inicial` honesto quanto à ausência de saldo anterior | **VALIDADA** — `— → 50`, não um zero inventado |
| Delta assinado em texto, não só cor | **VALIDADA** — `+12` / `−2` legíveis em escala de cinza |
| Alternativa acessível para a seta (dívida A5) | **VALIDADA** — cada célula carrega `sr-only` "de 127 para 125"; `Estoque inicial` anuncia "saldo inicial 50" |
| Vocabulário único em português | **VALIDADA** — Entrada · Saída · Ajuste · Estoque inicial. O parêntese técnico "Entrada (IN)" some do formulário |
| Saldo atual ancorado fora da lista filtrada (decisão 4) | **VALIDADA** — cabeçalho com saldo e mínimo, e a frase "O saldo acima não muda com o filtro" ao lado do chip de filtro |

> A direção C **funciona melhor aqui do que a B funcionaria** — o extrato tipográfico é a forma natural desse conteúdo. O empréstimo declarado na Fase 4 (D6) se confirma.

---

## 10. Decisões do Design System que funcionaram

| Decisão | Resultado observado |
|---|---|
| **A1** — sem `rounded-full` | Badges de estado leem como **dado**, não como chip removível. Os chips de filtro, que **são** removíveis, se distinguem pelo "✕". A distinção que a pílula apagava voltou |
| **A2** — teto de 24px | O topo ficou discreto. A marca em 14px e "Produtos" em 24px inverte a hierarquia de hoje (marca em 30–36px, maior que o nome da tela) |
| **A5** — contraste | Bordas de campo em `gray-500` são claramente visíveis sem parecerem pesadas. Nenhum texto em `gray-400` |
| **A6** — nome acessível | Todos os controles de ícone têm `aria-label`; nenhum ícone sem nome |
| Foco único | Um único anel em toda a página, com offset, inclusive sobre botões preenchidos |
| Sombra só em overlay | O dashboard deixou de ser uma coleção de cartões flutuantes; a única sombra é a dos diálogos |
| Cor semântica escassa | Na tabela inteira, o único vermelho é o estado "Sem estoque" |
| Zonas (identidade · alerta · controle · dados) | A leitura de cima para baixo é previsível; a barra de seleção ocupa a zona de controle sem deslocar nada |

---

## 11. Decisões que precisaram ser revistas

| # | Decisão original | O que a evidência mostrou | Proposta |
|---|---|---|---|
| **P-2** | Fase 5, §13.1: "altura de linha ~44px" | **65px medidos** em todas as larguras. O par saldo/mínimo (exigido por A5) e a altura de 44px (exigida por D5) não cabem juntos | Corrigir a spec para **~64px** com o par empilhado. Alternativa: par em linha única (`8 / mín. 15`), que caberia em ~48px mas piora a comparação numérica. **Recomendo corrigir o número, não o arranjo** |
| **P-3** | Fase 5, §5.3: "separador de milhar em toda quantidade" | Violado em 2 de 4 diálogos do próprio protótipo, sem intenção | Elevar de convenção para **um único helper de formatação**, e proibir `toLocaleString` solto |
| **P-4** | — | Delta usa hífen (`-45`) onde o correto tipográfico é o sinal de menos (`−45`) | Padronizar `U+2212` no helper de P-3 |
| **P-1** | D3-mobile em aberto | Ícone sozinho não comunica subtração permanente de estoque | **Baixa rápida no overflow** no mobile (§5) |

Nenhuma delas invalida a direção B. Três são correções de valor dentro do sistema; uma é a decisão que estava explicitamente aberta.

---

## 12. Hipóteses ainda não validáveis

| Hipótese | Por que não |
|---|---|
| "A densidade funciona com centenas de produtos" | **AINDA NÃO VALIDÁVEL.** O protótipo tem 8 linhas. A escala real continua desconhecida (decisão 7) e não foi inventada. O que **é** verificável: a paginação e a contagem de resultados existem, e a região de dados não tem largura fixa que impeça mais linhas |
| "A frequência da baixa rápida justifica um toque a menos" | **AINDA NÃO VALIDÁVEL.** Não há dado de uso. A recomendação de §5 é explicitamente a escolha conservadora diante disso, não uma conclusão sobre frequência |
| "D2-A × D2-B: qual custa menos ao usuário" | **AINDA NÃO VALIDÁVEL por protótipo estático.** Ambas eliminam o `<select>` com default perigoso, que era o requisito. Escolher entre elas exige ver alguém usando. Ver §13 |
| "A escada de cerimônia reduz erro de direção" | **AINDA NÃO VALIDÁVEL.** O protótipo mostra que a intenção fica inequívoca; que isso reduza erro real só se mede com uso |
| "Ordenação secundária" | **NÃO VALIDÁVEL AQUI** — permanece em aberto desde UF-08, e o Design System deliberadamente não a especificou |

---

## 13. D2 — declaração de intenção

Ambas as formas foram renderizadas:

- **D2-A** — dois botões, "Registrar entrada" e "Registrar saída", que abrem o diálogo já com a intenção fixada no título. Um clique a mais na navegação, um campo a menos no formulário.
- **D2-B** — um único "Movimentar", com um par segmentado **sem opção pré-selecionada**, e os campos abaixo inertes até a escolha. Mesmo número de cliques de hoje.

**Recomendação: D2-B.**

Três razões:

1. **Satisfaz o requisito sem custo de navegação.** D2 exige intenção inequívoca *antes* de digitar a quantidade — e um segmentado sem default entrega isso, porque não existe estado inicial em que o formulário esteja utilizável com a direção errada.
2. **Preserva "Movimentar" como operação canônica** (decisão 2). D2-A fragmenta a ação canônica em duas ações na linha, o que também recoloca pressão sobre a coluna de ações que §3 já mostrou apertada em 900px.
3. **Menor raio de mudança.** D2-A muda a linha da tabela, o card e o menu; D2-B muda apenas o interior de um diálogo.

Ressalva honesta: D2-B depende de os campos ficarem **realmente** inertes até a escolha. Se isso for implementado como um simples `disabled` visual, a proteção evapora. É requisito funcional, não estético.

---

## 14. Diferenças intencionais entre protótipo e produto atual

**Nenhum bug foi corrigido.** Onde o protótipo mostra comportamento melhor, isso é o **alvo**, não o estado atual:

| No protótipo | No produto hoje | Rastreado como |
|---|---|---|
| Filtros com chips removíveis e "Limpar filtros" visível em qualquer largura | No mobile entra-se no filtro e **não há como sair** | UF-07 / UF-41 — **em aberto** |
| Mensagem de erro específica e persistente | Erro da baixa rápida lido em formato do axios; a mensagem real do backend nunca chega | **F-07 — em aberto** |
| Formulário de edição preenchido | `ProductFormModal` em modo `edit` abre **vazio** (verificado por sonda na Fase 2) | **F-06 — em aberto** |
| Um único primitivo de diálogo | Três sistemas paralelos; Escape fecha 1 de 3 | **C-1 — em aberto** |
| Sem logs no caminho crítico | Nove `console.log` no `QuickOutModal` | **C-2 — em aberto** |
| Saldo e mínimo na tabela | A tabela mostra o veredito e esconde a evidência | C-6 — alvo desta refatoração |
| `Estoque inicial` como palavra | Vaza como `INITIAL_STOCK`, enum cru em inglês | UF-34 — alvo desta refatoração |

Outras diferenças, deliberadas e sem relação com bug:

- A barra contextual de seleção é renderizada em todas as larguras no protótipo, **para poder ser vista**. Na especificação, ações em lote **não são renderizadas** no mobile (Fase 5, §15.1).
- Ícones são glifos de texto (`↓`, `⋯`). Em produção seriam `lucide-react`, que já é dependência do projeto — nenhuma biblioteca nova.
- O protótipo tem 8 produtos fixos, sem paginação funcional, sem busca funcional e sem backend.

**Task 0 (testes de caracterização) continua sendo pré-requisito da Fase 8** e não foi escrita aqui. Nada no protótipo sugere que comportamentos existentes possam simplesmente desaparecer: o contrato de 20 comportamentos dos `QuickOut*` (§9.3 do `user-flows.md`) permanece válido e intocado.

---

## 15. Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| A altura real de 65px por linha reduzir a densidade percebida em telas baixas | Média | Revisar o número na spec (P-2). Com 10 linhas por página, a região ocupa ~650px + cabeçalho — cabe em 900×600 sem scroll interno |
| Formatação numérica derivar de novo na implementação | **Alta** — já derivou no protótipo | Helper único (P-3), verificável por lint |
| D2-B ser implementado com `disabled` cosmético, anulando a proteção | Média | Tratar como requisito funcional com teste, não como estilo |
| A variante A da linha ser mantida e apertar telas de ~900px | Média | Decisão P-1/§3 explicitada para aprovação, com a medição de 24,2% |
| O protótipo ser usado como fonte de CSS para a implementação | Média | `README.md` do diretório declara explicitamente que não é código de produção |

---

## 16. Decisões que precisam da sua aprovação

**P-1 · Baixa rápida no mobile vai para o overflow** (variante B). Um toque a mais numa operação de frequência desconhecida, em troca de eliminar um ícone mudo que subtrai estoque de forma permanente. No desktop, a variante A (três controles) continua — com a ressalva medida de 24,2% em 900px.

**P-2 · Corrigir a altura de linha na spec de ~44px para ~64px.** É a medição real do par saldo/mínimo que a própria regra de evidência exige. A alternativa (par em linha única) caberia em ~48px e piora a comparação numérica — não recomendo.

**P-3 · Formatação numérica vira helper único**, não convenção: separador pt-BR e sinal de menos tipográfico (`−`, U+2212) em um só lugar. Derivou dentro do próprio protótipo.

**P-4 · D2-B** — intenção declarada dentro do diálogo, com segmentado sem default e campos inertes até a escolha. Preserva "Movimentar" como ação canônica e tem o menor raio de mudança.

**P-5 · Manter `md` (768px)** como breakpoint, com a ressalva registrada de que 768px nominais em desktop com barra de rolagem clássica caem em cards — falha segura, porque cards preservam 100% das capacidades.

---

## Estado da Fase 6

**Concluída.** Nenhum arquivo em `packages/` alterado; nenhum componente migrado; nenhum token implementado no produto; nenhum bug corrigido; nenhum teste de caracterização escrito.

Aguardando aprovação de **P-1 a P-5** antes da **Fase 7 — Implementation Plan**.
