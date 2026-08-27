# Sistema de Estoque — guia do projeto

Monorepo pnpm (`workspaces: packages/*`):

- `packages/backend` — Express + TypeScript + Prisma + **PostgreSQL**. API REST em `/api/*`.
- `packages/frontend` — React 18 + Vite + Tailwind + React Query + react-hook-form + Zod + Radix UI.
- `packages/shared` — tipos de domínio compartilhados entre backend e frontend (fonte de verdade para `Product`, `Movement`, `Paged<T>`, DTOs — ambos os pacotes devem importar daqui, nunca redefinir localmente).

## Time de agentes

Este projeto usa subagentes especializados em `.Codex/agents/`. Ao pedir uma mudança, o Codex deve delegar para o especialista certo em vez de fazer tudo no mesmo contexto:

| Agente | Responsabilidade |
|---|---|
| `architect` | Planos e decisões estruturais (onde algo deve morar, como um módulo novo se conecta ao domínio atual) — nunca implementa, só documenta a decisão |
| `tech-lead` | Decompõe pedidos multi-pacote, sequencia trabalho, garante o checklist de saída |
| `backend-engineer` | Rotas Express, schema/migrations Prisma, lógica de negócio do backend |
| `frontend-engineer` | Componentes React, formulários, estado, UI |
| `qa-tdd-engineer` | Dono do ciclo red→green→refactor; escreve testes antes da implementação |
| `security-reviewer` | Audita auth, CORS, headers, validação, segredos antes de merge/deploy |
| `accessibility-reviewer` | Audita WCAG 2.1 AA em toda mudança de UI |
| `devops-engineer` | CI, `render.yaml`, `netlify.toml`, variáveis de ambiente, migrations em deploy |

## Regra de TDD obrigatória

**Nenhuma função de negócio nova ou alterada entra sem teste escrito antes/junto da implementação — nunca depois.** Fluxo padrão:

1. `qa-tdd-engineer` (ou o próprio engenheiro, se a mudança for trivial) escreve o teste que expõe o requisito/bug.
2. Confirma que o teste falha pelo motivo certo (red).
3. `backend-engineer`/`frontend-engineer` implementa até o teste passar (green).
4. Refatora com a rede de segurança do teste (refactor).

Uma tarefa só é "pronta" quando:

```
pnpm -r run lint
pnpm -r run typecheck
pnpm --filter @simplestock/backend test
pnpm --filter @simplestock/frontend test
pnpm -r run build
```

passam sem erro, **e** `security-reviewer`/`accessibility-reviewer` revisaram quando a mudança tocou rotas/auth/dados/UI. Isso é verificado automaticamente em CI (`.github/workflows/ci.yml`) em todo PR.

## Regras de arquitetura (não repetir dívidas já identificadas)

**Backend:**
- Toda sequência "ler saldo → decidir → escrever movimentação" fica dentro de `prisma.$transaction(...)`. Nunca check-then-write fora de transação (causou estoque indo negativo antes da correção).
- Toda entrada HTTP (body **e** query params) é validada com Zod.
- Toda rota mutável (POST/PUT/DELETE) exige o middleware `requireAuth`.
- Log estruturado via `pino`, nunca `console.log`; nunca logar body/headers completos (podem conter credenciais).
- Handler de erro global nunca devolve `err.message` cru ao cliente.

**Frontend:**
- Um único primitivo de modal acessível no projeto — não introduzir um novo sistema de diálogo.
- Dado remoto sempre via React Query (`useQuery`/`useMutation`), nunca `useEffect` + `fetch` manual.
- Nenhum `window.confirm()`/`window.alert()` para ações destrutivas.
- Todo `id` usado em `aria-labelledby`/`aria-describedby` vem de `useId()`, nunca hardcoded.
- Conteúdo dinâmico assíncrono (toast, banners) tem `aria-live`/`role="status"`/`role="alert"`.
- Componentes não crescem virando componente-deus — extrair hooks/subcomponentes cedo.

## Stack e por quê

| Área | Escolha | Motivo |
|---|---|---|
| Banco | PostgreSQL via Prisma | Concorrência real de escrita, transações/locks — SQLite não suporta isso bem em produção |
| Auth | `bcryptjs` (hash) + `jose` (JWT) | Puro JS (sem build nativo, portável), sem framework de auth pesado desnecessário para o tamanho do sistema |
| Segurança HTTP | `helmet`, `express-rate-limit` | Headers e rate limit padrão de mercado |
| Log | `pino` + `pino-http` | Log estruturado, substitui `console.log` |
| Testes backend | `vitest` + `supertest` | Testes de integração de rota contra banco de teste isolado |
| Testes frontend | `vitest` + `@testing-library/react` + `jsdom` | Testa comportamento observável, não detalhes de implementação |
| CI | GitHub Actions | Gate obrigatório de lint/typecheck/test/build em todo PR |

## Backlog conhecido (não implementado ainda, ver plano de refactor)

Decomposição de `ProductDashboard.tsx`, remoção de componentes mortos (`FinanceDashboard`/`SalesDashboard`) e duplicações, unificação dos 3 sistemas de modal legados, saldo como coluna computada/cache, paginação real no banco (hoje parcialmente em memória), migração de `packages/shared` para fonte única de tipos, preenchimento de `render.yaml`/`netlify.toml` com valores reais, migração do ESLint para flat config. Ao tocar em código adjacente a esses itens, registre a dívida explicitamente em vez de expandir escopo sem pedir.
