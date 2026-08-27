# Frontend — permissões de ferramentas e diretrizes de leitura/escrita

Equivalente a `backend.md`, mas para `packages/frontend`. As regras de negócio/UX
(React Query, modal único, acessibilidade) já estão em `CLAUDE.md` e em
`.claude/agents/frontend-engineer.md` — aqui só o que pode ser executado sozinho
e os limites de arquivo.

## Permissões de execução (Bash)

### Sempre permitido, sem confirmar
- `pnpm --filter @simplestock/frontend run typecheck|lint|test|build`
- `pnpm -r run typecheck|lint|test|build`
- `git status`, `git diff`, `git log`, `git show`
- `pnpm --filter @simplestock/frontend run dev` / `vite preview` — só sobe servidor local, não afeta nada externo

### Exige confirmação explícita antes de rodar
- `git add` amplo (`-A`, `.`) — revisar `git status` antes
- `git commit`, `git push`
- Qualquer `rm`/`Remove-Item` dentro de `packages/frontend`, especialmente ao remover os componentes mortos já mapeados no backlog (`FinanceDashboard.tsx`, `SalesDashboard.tsx`) — confirmar que não há import ativo antes de apagar
- `pnpm add`/`pnpm remove` (dependência nova ou removida) — some passa por `security-reviewer` depois (ver checklist de dependências em `CLAUDE.md`)
- Editar `netlify.toml` (afeta build/deploy real)

### Nunca executar
- Qualquer comando que aponte para a API de produção a partir de testes locais (`VITE_API_BASE` de produção não deve estar em `.env` local)
- `git push --force`, `git reset --hard`, `git clean -f` sem pedido explícito do usuário

## Acesso a dados

Frontend não tem acesso direto a banco — toda leitura/escrita passa pela API do
backend via `src/api/httpClient.ts` (`apiFetch`). Nunca introduza um segundo client
HTTP nem chamada `fetch` direta fora de `src/api/*.ts`.

- Erros de API (`ApiRequestError`) chegam com `.message` vindo do backend (ex.
  "Estoque insuficiente") — repassar ao usuário via toast, nunca esconder atrás
  de uma mensagem genérica nem expor via `console.log`/`alert()`.
- Token de auth só é lido/escrito através de `AuthContext`/`httpClient`
  (`setAuthToken`) — nunca ler `localStorage`/`sessionStorage` direto em um componente novo.

## Limites de leitura/escrita em arquivos

| Caminho | Pode editar livremente? |
|---|---|
| `src/components/**`, `src/hooks/**`, `src/api/**` | Sim |
| `test/**` | Sim — TDD é obrigatório neste projeto (ver `CLAUDE.md`) |
| `src/components/FinanceDashboard.tsx`, `src/components/SalesDashboard.tsx` | Componentes mortos (backlog). Não editar como se estivessem em uso; se a tarefa for removê-los, confirmar ausência de import antes de apagar |
| `vite.config.ts`, `tailwind.config.js`, `tsconfig.json` | Editar só quando a tarefa exigir explicitamente — mudança aqui afeta build inteiro |
| `netlify.toml` | Só com confirmação (afeta deploy) |
| `dist/**` | Nunca editar à mão — build gerado |
| `node_modules/**` | Nunca |

## Antes de considerar uma mudança de frontend pronta

```
pnpm --filter @simplestock/frontend run typecheck
pnpm --filter @simplestock/frontend run lint
pnpm --filter @simplestock/frontend run test
```

Testes de frontend usam `jsdom` e não dependem de nenhum serviço externo — rodam
sempre, sem bloqueio de ambiente. Se algum falhar, isso é regressão real, nunca
"ambiente indisponível".
