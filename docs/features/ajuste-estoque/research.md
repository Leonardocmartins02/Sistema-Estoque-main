# RESEARCH — Ajuste de Estoque (ADJUSTMENT)

> Escopo: resolver só as duas questões deixadas em aberto no `idea.md` — forma da API e código HTTP do conflito de concorrência. Nenhuma tecnologia nova é necessária; a stack atual (Express, Zod, Prisma) resolve os dois pontos.

## Questão 1 — Endpoint dedicado vs. contrato discriminado em `/movements`

### Alternativas

**A. Endpoint dedicado**: `POST /products/:id/adjustments`, novo router (`routes/adjustments.ts`), montado em `routes/index.ts` no mesmo padrão que `movements.ts` já usa hoje (`router.use('/products', requireAuth, adjustments)`).

**B. Contrato discriminado no endpoint existente**: manter `POST /products/:id/movements`, e usar `z.discriminatedUnion('type', [...])` para aceitar dois formatos de body sob o mesmo `type`: o atual (`IN`/`OUT` → `quantity` + `note` opcional) e um novo (`ADJUSTMENT` → `targetQuantity` + `expectedPreviousQuantity` + motivo obrigatório).

### Vantagens / Desvantagens

| | A — dedicado | B — discriminado |
|---|---|---|
| Vantagens | Path comunica a intenção (`/adjustments` vs. genérico `/movements`); schema Zod de cada rota fica simples, sem branches condicionais; erro de conflito (409) fica isolado num endpoint onde ele sempre faz sentido, em vez de "às vezes aparece" em `/movements`; segue o padrão que o próprio projeto já usa (`movements.ts` já é uma sub-rota dedicada sob `/products/:id`, não um parâmetro dentro de `products.ts`) | Um único lugar para "toda escrita de movimentação"; reaproveita 100% o router e a montagem existentes |
| Desvantagens | Mais um arquivo de rota e mais uma linha de montagem em `routes/index.ts` (mitigado: é reaproveitar um padrão já existente, não inventar um novo) | `movementSchema` (hoje simples: `type`, `quantity`, `date?`, `note?`) precisa virar uma union com dois formatos de body completamente diferentes — nenhum schema do projeto hoje usa `discriminatedUnion`; a resposta de erro 409 fica "escondida" dentro de um endpoint cujo nome (`/movements`) não sugere que ele pode rejeitar por conflito de concorrência; `GET /:id/movements` já filtra por `type: z.enum(['IN','OUT'])` — incluir `ADJUSTMENT` ali exige revisar esse filtro de qualquer forma, então a "economia" de reaproveitar o endpoint é menor do que parece |

### Riscos

- **A**: esquecer de proteger a rota nova com `requireAuth` — mitigado porque a montagem replica literalmente o padrão já usado por `movements`/`quick-out` em `routes/index.ts`, e a suíte de testes de integração cobre 401 em toda rota mutável.
- **B**: o contrato de `POST /movements` muda de forma visível para quem já consome a API (inclusive o frontend atual, `MovementFormModal.tsx`, que assume `type: IN|OUT` fixo) — risco de acoplar uma mudança de contrato existente a uma feature nova, contrariando a regra do projeto de "não altere contratos existentes sem verificar consumidores" (`AGENTS.md`).

### Decisão

**A — endpoint dedicado `POST /products/:id/adjustments`.**

### Justificativa

1. **Google AIP-136** (guia de design de API amplamente referenciado para casos que não são CRUD padrão) recomenda explicitamente um método/endpoint dedicado quando a operação "não cabe facilmente nos métodos padrão", e desaconselha "contorcer" um método existente para caber uma semântica diferente. `ADJUSTMENT` — saldo alvo, verificação de conflito, motivo obrigatório — é estruturalmente diferente de `IN`/`OUT`, não uma variação pequena.
2. **Consistência com o próprio código do projeto**: `movements.ts` já é uma sub-rota dedicada sob `/products/:id` (não um branch dentro de `products.ts`); `/adjustments` segue exatamente o mesmo padrão de nesting já estabelecido, mesma forma de montagem em `routes/index.ts`.
3. **Nenhum schema do projeto usa `discriminatedUnion` hoje** — introduzir o primeiro exemplo disso especificamente para acomodar um contrato tão diferente é mais complexidade de leitura do que abrir um arquivo de rota novo, que é um padrão já familiar no código.
4. Isola a semântica de erro 409 (exclusiva de `ADJUSTMENT`) num endpoint onde ela sempre se aplica, em vez de um endpoint (`/movements`) onde ela só apareceria condicionalmente.

### Fontes

- [Google AIP-136 — Custom Methods](https://google.aip.dev/136)
- `packages/backend/src/routes/index.ts` (padrão de montagem de sub-rotas já usado no projeto)
- [Zod — Discriminated Unions](https://zod.dev/api?id=discriminated-unions) (alternativa considerada, não escolhida)

---

## Questão 2 — Código HTTP do conflito de concorrência: 409 vs. 412

### Alternativas

**409 Conflict** — segundo a MDN, indica que "a requisição conflita com o estado atual do recurso alvo"; a própria MDN cita como um dos usos legítimos "para propósitos específicos da implementação, como indicar que o servidor recebeu múltiplas requisições para atualizar o mesmo recurso" — cenário que bate exatamente com o nosso.

**412 Precondition Failed** — segundo a MDN, é retornado especificamente quando uma requisição condicional (`If-Match`/`If-Unmodified-Since`) falha porque a condição não foi satisfeita; o exemplo canônico da própria MDN é prevenção de "mid-air collision" via `ETag` + `If-Match` — tecnicamente o cenário mais "preciso" pro que estamos resolvendo.

### Vantagens / Desvantagens

| | 409 | 412 |
|---|---|---|
| Vantagens | Não exige adotar o protocolo de requisição condicional do HTTP (geração de `ETag`, parsing de `If-Match`) — nosso `expectedPreviousQuantity` viaja no corpo JSON, não em um header condicional; a própria MDN já enquadra esse uso (conflito de estado por escrita concorrente) como aplicação válida de 409 | É o código "livro-texto" para exatamente este cenário (optimistic concurrency / mid-air collision) |
| Desvantagens | Menos "formalmente preciso" que 412 dentro do ecossistema HTTP maduro, para quem espera o padrão `ETag`/`If-Match` | A definição da MDN amarra 412 aos headers condicionais (`If-Match`/`If-Unmodified-Since`); usar 412 sem implementar esse mecanismo real seria emprestar o código fora do contrato que a própria spec define pra ele — e a API do projeto não usa headers condicionais em nenhum outro lugar hoje |

### Riscos

- Escolher 412 sem implementar `ETag`/`If-Match` de verdade cria uma inconsistência: o código HTTP promete um mecanismo (cabeçalhos condicionais) que a API não oferece em lugar nenhum — um cliente HTTP genérico que conhece a semântica formal de 412 esperaria poder reenviar com `If-Match` atualizado, o que não existe aqui.
- 409 é mais genérico — alguém lendo só o código, sem a mensagem, pode confundir com outro tipo de conflito (ex.: SKU duplicado, que já usa 409 hoje em `POST /products`). Mitigação: a mensagem de erro (`err.message`, já como texto explicativo no `HttpError`) deixa claro que é conflito de saldo/concorrência, não SKU.

### Decisão

**409 Conflict.**

### Justificativa

O mecanismo de proteção desta feature (`expectedPreviousQuantity` no corpo da requisição, comparado dentro da transação) é uma checagem de aplicação, não o protocolo HTTP de requisição condicional formal que 412 pressupõe. Adotar 412 sem os headers `ETag`/`If-Match` seria usar o código fora do contrato que a própria MDN define para ele. 409 já é explicitamente enquadrado pela MDN como cabendo em "propósitos específicos da implementação" para indicar que o servidor recebeu requisições conflitantes para o mesmo recurso — cobre o cenário sem exigir que o projeto adote um mecanismo HTTP adicional que não usa em nenhum outro lugar. Também é consistente com o `HttpError(status, message)` simples já usado em todo o backend, sem qualquer suporte a cabeçalhos condicionais hoje.

### Fontes

- [MDN — 409 Conflict](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/409)
- [MDN — 412 Precondition Failed](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/412)
- `packages/backend/src/shared/httpError.ts` (padrão de erro já usado no projeto)

---

## Resultado

Nenhuma decisão pendente de `idea.md` continua em aberto. As duas questões desta fase foram resolvidas:

1. API: endpoint dedicado `POST /products/:id/adjustments`.
2. Conflito de concorrência: `409 Conflict`.

Nenhuma dependência nova é necessária para nenhuma das duas decisões.
