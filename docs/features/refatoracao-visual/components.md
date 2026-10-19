# Componentes do design system v2

> Um bloco por componente novo ou estendido na refatoração visual (decisão P-15 do `implementation-plan.md`; D12 — sem Storybook). O catálogo visual é o protótipo (`prototype/index.html`) e o contrato é o teste de cada componente. Formato: propósito · anatomia · variantes · estados · acessibilidade · faça · não faça · exemplo.

## Button — variante `tonal` (Task 2)

- **Propósito**: ação primária que se repete em lista ("Movimentar" em cada linha, "Repor" no dashboard). Mantém a hierarquia sem competir com a primária da página (D4).
- **Anatomia**: rótulo (+ ícone opcional) sobre `accent-subtle`, texto `accent-subtle-text`, raio `control`.
- **Variantes**: `primary` · `secondary` · **`tonal`** · `tertiary` (`ghost`) · `destructive` · `shortcut`. Tamanhos `sm` e `md`.
- **Estados**: hover `accent-subtle-hover` (7,15:1); foco = anel `accent` de 2 px em `focus-visible` (o mesmo de todo botão); `disabled` e `isLoading` como nas outras variantes.
- **Acessibilidade**: 8,01:1 em repouso; rótulo sempre em texto.
- **Faça**: uma ação tonal por linha. **Não faça**: tonal como ação principal da página (é `primary`); tonal ao lado de outro tonal na mesma linha.
- **Exemplo**: `<Button variant="tonal" size="sm">Movimentar</Button>`

## Badge (Task 2)

- **Propósito**: rótulo de estado, não interativo.
- **Anatomia**: pílula (`rounded-pill`) de 24 px, 12 px peso 600, fundo `*-subtle` + texto do estado; `gap` para um ponto opcional.
- **Variantes**: `success` · `warning` · `danger` · `info` (`info` tem token próprio desde a v2).
- **Estados**: nenhum — não muda no hover (M-6).
- **Acessibilidade**: 4,84–8,01:1; a palavra é o conteúdo.
- **Faça**: usar pelo `StatusBadge` quando o assunto é estado de estoque. **Não faça**: badge clicável (vira botão ou link); cor sem palavra.
- **Exemplo**: `<Badge variant="info">Ajuste</Badge>`

## StatusBadge (Task 2)

- **Propósito**: estado de estoque com vocabulário fechado — `Em estoque` · `Estoque baixo` · `Sem estoque` (P5).
- **Anatomia**: `Badge` + ponto de 6 px no preenchimento do estado (`*-fill`) + palavra.
- **Variantes**: `status`: `OK` · `ATTN` · `OUT` (de `productStatus()`, a regra canônica PS-1).
- **Estados**: —
- **Acessibilidade**: ponto `aria-hidden`; o leitor de tela ouve só a palavra; nunca só cor (1.4.1).
- **Faça**: `productStatus(p)` → `StatusBadge`. **Não faça**: recalcular o estado na tela; inventar sinônimo ("Crítico", "Atenção").
- **Exemplo**: `<StatusBadge status={productStatus(p)} />`

## MovementTypeLabel (Task 2)

- **Propósito**: tipo de movimentação em forma única — tabela, lista, cartão e painel.
- **Anatomia**: quadro de 24 px (raio `sm`) com ícone de 14 px + palavra peso 500.
- **Variantes**: `IN` Entrada (↙, verde) · `OUT` Saída (↗, vermelho) · `ADJUSTMENT` Ajuste (controles, `info`) · `INITIAL_STOCK` Estoque inicial (pacote, neutro).
- **Estados**: —
- **Acessibilidade**: ícone `aria-hidden`; a palavra carrega o tipo.
- **Faça**: usar `MOVEMENT_TYPE_LABEL` quando só o texto couber (filtros, abas). **Não faça**: mostrar `INITIAL_STOCK` cru; ícone sem palavra.
- **Exemplo**: `<MovementTypeLabel type={m.type} />`

## Delta (Task 2)

- **Propósito**: efeito no saldo com sinal (P4) — histórico, atividade, painel, indicadores.
- **Anatomia**: `+12 un.` / `−5 un.` / `0 un.`, peso 600, algarismos tabulares; seta ↗/↘ opcional.
- **Variantes**: `unit` (padrão `un.`; `false` omite), `trend` (seta).
- **Estados**: positivo `success` · negativo `danger` · zero `text-secondary` · sem dado `—`.
- **Acessibilidade**: sinal sempre em texto, com o `−` tipográfico (`formatDelta`); seta `aria-hidden`; sem dado → "variação não registrada" para o leitor de tela.
- **Faça**: passar `null` quando o ajuste legado não tem antes/depois. **Não faça**: passar `0` no lugar de `null`; formatar o número na tela.
- **Exemplo**: `<Delta value={item.delta} />` · `<Delta value={124} unit={false} trend />`

## BalanceFlow (Task 2)

- **Propósito**: `antes → depois` com o saldo final em destaque — a leitura própria do produto (research.md, "o que é nosso").
- **Anatomia**: anterior em `text-secondary`, seta, final em `text-primary` peso 600; algarismos tabulares.
- **Variantes**: —
- **Estados**: sem anterior (estoque inicial) → `— → 50`; sem final (legado) → `—`.
- **Acessibilidade**: a parte visível é `aria-hidden`; o texto para leitor de tela diz "de 20 para 15" / "sem saldo anterior, saldo final 50" / "saldos não registrados".
- **Faça**: usar junto do `Delta` na mesma linha. **Não faça**: inventar `0` como saldo anterior.
- **Exemplo**: `<BalanceFlow previous={m.previousQuantity} next={m.newQuantity} />`
