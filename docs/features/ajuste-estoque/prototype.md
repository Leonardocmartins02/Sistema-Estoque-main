# PROTOTYPE — Ajuste de Estoque (ADJUSTMENT)

> Fase de validação de UX/integração antes do PRD. Nenhum componente foi criado ou alterado nesta fase — só leitura dos componentes reais e este documento.

## Protótipo executável foi necessário?

**Não.** As seis hipóteses do usuário são todas sobre conteúdo, cópia e composição de componentes já existentes — não sobre performance, timing de animação ou uma interação que só se percebe rodando o app. Cada uma foi validada por leitura direta do código real:

- `packages/frontend/src/components/ui/Modal.tsx` — primitivo único de diálogo (Radix), `size`/`footer`/`children` livres.
- `packages/frontend/src/components/ui/ConfirmDialog.tsx` + `packages/frontend/src/hooks/useConfirm.tsx` — padrão de confirmação já usado em ações destrutivas.
- `packages/frontend/src/components/MovementHistoryModal.tsx` — tabela de histórico atual.
- `packages/frontend/src/components/MovementFormModal.tsx` — formulário de `IN`/`OUT` atual, referência de estilo de campo/erro.
- `packages/frontend/src/components/products/ProductActionsMenu.tsx` — ponto de entrada da ação (menu "Mais ações" do produto).

Achado relevante desta leitura: **`ConfirmDialog`/`useConfirm` não servem como estão** para esta feature (ver "Decisões que viram requisito de PRD"). Isso só foi possível descobrir lendo a API real dos componentes — exatamente o tipo de incerteza que esta fase deveria eliminar, e foi eliminada sem precisar rodar nada.

## 1. Hipóteses avaliadas

| # | Hipótese | Veredito |
|---|---|---|
| 1 | Formulário mostra produto, saldo atual, campo "Nova quantidade", motivo obrigatório; usuário informa contagem física, nunca delta | Confirmado — wireframe abaixo |
| 2 | Interface comunica a diferença sem induzir o usuário a pensar em `+2`/`-2` como input | Confirmado — mostrar as duas formas juntas (ver §3) |
| 3 | Confirmação explícita antes de gravar | Confirmado, mas **não cabe no `ConfirmDialog` atual sem mudança** — vira requisito de PRD |
| 4 | Conflito 409 tem uma experiência própria, não fecha modal nem sobrescreve | Confirmado — máquina de estados em §5 |
| 5 | Cobertura dos 11 estados de interface | Todos mapeados em §6 |
| 6 | Histórico distingue `ADJUSTMENT` de `IN`/`OUT` claramente | Confirmado, mas **exige mudança em `MovementHistoryModal.tsx`** (filtro de tipo e coluna "Quantidade" hoje não contemplam `ADJUSTMENT`) — vira requisito de PRD |

## 2. Fluxo principal (estados nomeados)

```
[Fechado]
   │  usuário clica "Ajustar Estoque" no ProductActionsMenu
   ▼
[Formulário aberto] ── saldo atual carregado, campo vazio ──┐
   │  usuário digita nova quantidade + motivo                │
   ▼                                                          │
[Preview ao vivo] ── mostra 20 → 18 / Diferença: -2 ──────────┘
   │  usuário clica "Ajustar"
   ▼
[Confirmação] ── mostra resumo estruturado, pede confirmação final
   │  usuário confirma
   ▼
[Enviando] ── loading, botão desabilitado
   ├── sucesso ──────────────► [Fechado] + toast "Estoque ajustado com sucesso" + histórico/saldo invalidados (React Query)
   ├── erro de validação/HTTP ─► [Formulário aberto] com erro inline, dados preservados
   └── conflito 409 ──────────► [Conflito] (ver §5, não volta direto ao formulário)
```

## 3. Wireframe — Formulário de ajuste

```
┌─────────────────────────────────────────────┐
│ Ajustar Estoque                          ✕  │
│ Borracha Branca · BORRACHA_BRANCA_012        │
├─────────────────────────────────────────────┤
│ Saldo atual: 20 un.                          │  ← somente leitura
│                                               │
│ Nova quantidade*                             │
│ [        18        ]                         │  ← número, nunca "+/-"
│                                               │
│ 20 → 18                                       │
│ Diferença: -2 un.                             │  ← preview ao vivo, atualiza a cada tecla
│                                               │
│ Motivo*                                      │
│ [ Contagem física mensal              ]      │
│                                               │
│              [Cancelar]  [Ajustar]           │
└─────────────────────────────────────────────┘
```

**Decisão de apresentação da diferença (hipótese 2)**: mostrar **as duas formas juntas** — `20 → 18` (contexto absoluto) **e** `Diferença: -2` (leitura rápida do sentido) — não uma ou outra isoladamente:

- só `20 → 18` obriga quem lê rápido a fazer a subtração de cabeça pra saber se caiu ou subiu;
- só `Diferença: -2` sem o `20 →` força lembrar o saldo atual de memória, e um número solto com sinal é o mesmo formato mental de "o que eu deveria digitar" — risco de o usuário achar que o campo aceita `-2` como entrada;
- o rótulo do campo continua **"Nova quantidade"**, nunca "diferença"/"ajuste" — reforça visualmente, pelo nome do campo, que o valor esperado é sempre absoluto.

O preview só aparece depois que o campo tem um valor numérico válido (antes disso, mostra só o saldo atual, sem inventar um "0 → 0").

## 4. Wireframe — Confirmação

```
┌─────────────────────────────────────────────┐
│ Ajustar estoque?                         ✕  │
├─────────────────────────────────────────────┤
│ Produto:      Borracha Branca                │
│ Saldo atual:  20                             │
│ Novo saldo:   18                             │
│ Diferença:    -2                             │
│ Motivo:       Contagem física mensal         │
│                                               │
│              [Cancelar]  [Confirmar ajuste]  │
└─────────────────────────────────────────────┘
```

Semanticamente é o mesmo padrão que `ConfirmDialog` já resolve para "excluir produto"/"zerar estoque" (Modal + par de botões Cancelar/Confirmar), mas com um corpo estruturado em vez de uma frase única.

## 5. Wireframe — Conflito 409

O gatilho: usuário abriu o formulário vendo saldo 20 (`expectedPreviousQuantity: 20`); antes de confirmar, outra operação mudou o saldo real para 15; o backend recalcula dentro do lock, compara com `expectedPreviousQuantity` e rejeita com 409.

```
┌─────────────────────────────────────────────┐
│ Ajustar Estoque                          ✕  │
│ Borracha Branca                              │
├─────────────────────────────────────────────┤
│ ⚠ O estoque deste produto mudou enquanto     │
│   você fazia o ajuste.                       │
│                                               │
│   Saldo que você visualizou: 20              │
│   Saldo atual agora:         15              │
│                                               │
│   Revise a nova quantidade antes de          │
│   continuar.                                 │
│                                               │
│              [Cancelar]  [Revisar]           │
└─────────────────────────────────────────────┘
```

**Máquina de estados do conflito** (respondendo explicitamente "atualiza sozinho ou exige ação?"):

```
[Enviando] ──409──► [Conflito exibido]
                          │
                          │  usuário clica "Revisar" (única ação disponível além de Cancelar)
                          ▼
                 [Formulário reaberto]
                 - saldo atual agora mostra 15 (valor real, buscado de novo)
                 - expectedPreviousQuantity interno atualizado para 15
                 - campo "Nova quantidade" É LIMPO (não fica com "18" parado ali,
                   porque 18 foi calculado em cima do 20 que não existe mais)
                 - motivo é preservado (não faz sentido perder um texto que o
                   usuário já escreveu por causa de um conflito de saldo)
```

Não há atualização automática silenciosa do saldo com reenvio automático — o usuário precisa clicar em "Revisar" para reconhecer explicitamente a mudança antes de poder tentar de novo, e o valor numérico anterior é descartado de propósito (mantê-lo correria o risco de o usuário confirmar sem perceber que 18 não faz mais sentido em cima de um saldo de 15).

## 6. Estados da interface

| Estado | O que a tela mostra |
|---|---|
| Saldo alvo maior que o atual | Preview `20 → 25`, `Diferença: +5` (verde/neutro, não vermelho) |
| Saldo alvo menor que o atual | Preview `20 → 18`, `Diferença: -2` (âmbar/vermelho, sinaliza queda) |
| Saldo alvo zero | Preview `20 → 0`, `Diferença: -20` — permitido, sem aviso especial além do preview normal |
| Saldo alvo igual ao atual | Botão "Ajustar" desabilitado ou erro inline imediato ("Informe um valor diferente do saldo atual") — não deixa nem chegar à confirmação, já que `idea.md` define isso como rejeitado |
| Valor inválido (não numérico, negativo, decimal) | Erro inline no campo, mesmo padrão visual de `MovementFormModal.tsx` (`role="alert"`, `aria-describedby`) |
| Motivo vazio | Erro inline no campo motivo ("Informe o motivo do ajuste") |
| Motivo > limite (500 caracteres, decidido em `idea.md`) | Erro inline + contador de caracteres próximo do limite (ex.: "480/500") |
| Loading (enviando) | Botão de confirmação com spinner + label "Ajustando...", ambos os botões desabilitados — mesmo padrão de `mutation.isPending` já usado em `MovementFormModal.tsx` |
| Erro HTTP genérico (500, rede) | Volta para `[Formulário aberto]` (não para confirmação) com mensagem de erro server-side visível, dados preservados — mesmo padrão de `serverError` de `MovementFormModal.tsx` |
| Conflito 409 | Estado dedicado, ver §5 |
| Sucesso | Modal fecha, toast de sucesso ("Estoque ajustado com sucesso."), lista de produtos e histórico invalidados via React Query (mesmo padrão de `useProductMutations.ts`) |

## 7. Wireframe — Histórico

Como `IN`/`OUT` já aparecem hoje em `MovementHistoryModal.tsx` (colunas: Data, Tipo, Quantidade, Obs):

```
Data              Tipo    Quantidade   Obs
27/08 14:02       IN      10           Compra fornecedor
27/08 12:40       OUT     2            Baixa rápida
```

Como uma linha `ADJUSTMENT` precisaria aparecer (a coluna "Quantidade" sozinha não comunica direção — é preciso mostrar o par saldo-anterior/saldo-novo):

```
Data              Tipo      Quantidade              Obs
27/08 15:10       AJUSTE    20 → 18 (-2)             Contagem física mensal
26/08 09:00       AJUSTE    10 → 12 (+2)             Correção de contagem
```

Degradação graciosa (registro sem `previousQuantity`/`newQuantity`/`userId` — movimentações antigas, ou geradas por `seed.ts`):

```
Data              Tipo      Quantidade              Obs
20/08 08:00       AJUSTE    2 (dados incompletos)   Ajuste antigo
```

— mostra o `quantity` bruto (sempre existiu) com uma indicação textual curta de que o registro é anterior à auditoria completa, em vez de quebrar renderizando `undefined → undefined` ou omitir a linha inteira.

Sobre usuário/data: `date` já está sempre presente (nunca nulo). `userId`/nome do usuário só aparece quando existir — quando ausente, a linha simplesmente não mostra a coluna de autor para aquele registro (não inventa "Sistema" ou "Desconhecido" sem confirmar com o PRD se isso é aceitável).

## 8. Decisões de UX tomadas nesta fase

1. Preview da diferença sempre nas duas formas (`saldo→saldo` + `diferença com sinal`), nunca só uma.
2. Campo de entrada rotulado "Nova quantidade" (nunca "diferença"/"ajuste"), reforçando que o valor é sempre absoluto.
3. Confirmação final mostra resumo estruturado (produto, saldo atual, novo saldo, diferença, motivo) antes de gravar.
4. Conflito 409 não fecha o modal nem reenvia sozinho — exige clique explícito em "Revisar", que busca o saldo real de novo, limpa o campo numérico (mas preserva o motivo já digitado) e atualiza a referência de conflito interna.
5. Saldo alvo igual ao atual é bloqueado o quanto antes (erro inline, nem chega à tela de confirmação).
6. Histórico mostra `previousQuantity → newQuantity (diferença)` na coluna "Quantidade" para `ADJUSTMENT`, com degradação textual explícita quando os campos de auditoria não existem.

## 9. Questões que viram requisito de PRD

1. **`ConfirmDialog`/`useConfirm` não comportam o corpo estruturado da confirmação como estão hoje** (`description` é `string` simples; corpo do modal é uma frase fixa). O PRD precisa decidir explicitamente entre: (a) estender `ConfirmDialogProps` com um `body?: ReactNode` opcional (mudança pequena, mas é uma mudança em componente compartilhado por outras 3 ações destrutivas — precisa avaliar impacto), ou (b) montar o passo de confirmação com o `Modal` primitivo diretamente dentro do próprio `AdjustmentFormModal`, sem passar por `useConfirm`. Esta fase não decide — só constata que a reutilização direta não é possível.
2. **`MovementHistoryModal.tsx` precisa de mudança de escopo real** (não é só criar `AdjustmentFormModal`): o filtro `type` (`'' | 'IN' | 'OUT'`) precisa aceitar `ADJUSTMENT`, e a renderização da coluna "Quantidade" precisa de um branch condicional por tipo. Isso precisa entrar explicitamente nos requisitos funcionais do PRD, não ficar implícito.
3. Formato exato de exibição quando `userId` está ausente (linha sem coluna de autor vs. um rótulo tipo "—") — mencionado aqui, decisão final cabe ao PRD.
4. Cor/ênfase visual da linha de ajuste no histórico (hoje `IN`/`OUT` usam verde/vermelho; `AJUSTE` precisa de uma decisão própria — verde/vermelho conforme o sinal da diferença, ou uma cor neutra própria de "ajuste" independente do sinal) — não decidido aqui, fica para o PRD.
5. Onde exatamente o botão "Ajustar Estoque" entra no `ProductActionsMenu.tsx` (ordem dos itens, se fica perto de "Zerar Estoque" ou separado) — decisão de PRD/PLAN, não de prototype.

## 10. Se protótipo executável fosse necessário (não foi, mas registrando o critério usado)

Teria sido necessário se alguma hipótese dependesse de: tempo de resposta percebido do preview ao vivo digitando rápido, comportamento de foco/teclado ao transicionar formulário→confirmação→conflito, ou reação de layout a nomes de produto muito longos truncando o resumo da confirmação. Nenhuma das hipóteses desta rodada caiu nessas categorias — todas foram sobre conteúdo e composição de componentes com API já conhecida, resolvíveis por leitura + wireframe.
