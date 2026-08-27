# Backend — permissões de ferramentas e diretrizes de leitura/escrita

Este arquivo define o que o Claude pode executar e tocar dentro de `packages/backend`
sem pedir confirmação, o que exige confirmação, e o que nunca deve fazer. As regras de
negócio (transação, validação, auth) já estão em `CLAUDE.md` e em
`.claude/agents/backend-engineer.md` — este arquivo não repete o "o quê", define o
"até onde pode ir sozinho".

## Permissões de execução (Bash)

### Sempre permitido, sem confirmar
- `pnpm --filter @simplestock/backend run typecheck|lint|test|build`
- `pnpm -r run typecheck|lint|test|build` (roda os três pacotes)
- `git status`, `git diff`, `git log`, `git show`
- `npx prisma generate`
- `npx prisma studio` (inspeção visual, não altera dados)
- Leitura de logs, `node scripts/prepare-test-db.mjs` (só aplica migrations já commitadas no banco de teste)

### Exige confirmação explícita antes de rodar
- `npx prisma migrate dev` — cria migration nova E aplica no banco apontado por `DATABASE_URL`. Confirmar qual banco está ativo antes (`echo $DATABASE_URL` sem imprimir a senha) — nunca assumir que é o de teste.
- `npx prisma migrate deploy` fora do script de preparo de teste
- `npx prisma db seed` / `pnpm run seed` — popula dados, pode duplicar se rodado 2x
- `git add` amplo (`-A`, `.`) — sempre revisar `git status` antes
- `git commit`, `git push`
- Qualquer `rm`/`Remove-Item` dentro de `packages/backend`
- Editar `.env` (nunca ler o conteúdo dele em voz alta/log — pode ter segredos reais)

### Nunca executar
- `npx prisma migrate reset` — dropa e recria o banco inteiro; só o usuário decide isso
- SQL manual (`psql`, `prisma db execute`) que faça `DROP`/`DELETE`/`UPDATE` fora de uma migration versionada — schema muda **só** via `prisma migrate dev` gerando arquivo em `prisma/migrations/`, nunca por comando solto
- Qualquer comando usando a `DATABASE_URL` de produção a partir da máquina local (não deve nem existir configurada aqui)
- `git push --force`, `git reset --hard`, `git clean -f` sem pedido explícito do usuário

## Acesso a dados (query_database)

- Leitura ad hoc (`SELECT` via `prisma studio`, script `.ts` com `prisma.$queryRaw` só de leitura) é livre para investigar bug — não precisa pedir permissão pra **ler**.
- Escrita de dados de teste/seed só em `DATABASE_URL_TEST` (banco `simplestock_test`), nunca no banco de dev (`simplestock`) a menos que o usuário peça explicitamente.
- Este projeto não tem banco de produção configurado localmente — se em algum momento `DATABASE_URL` apontar para algo que não seja `localhost`, pare e confirme com o usuário antes de rodar qualquer migration ou seed.
- Mudança de schema sempre passa por: editar `prisma/schema.prisma` → `prisma migrate dev --name <nome>` → migration gerada entra no commit junto com o código que a usa. Nunca editar uma migration já aplicada/commitada (crie uma nova).

## Limites de leitura/escrita em arquivos

| Caminho | Pode editar livremente? |
|---|---|
| `src/routes/*.ts`, `src/shared/*.ts`, `src/middleware/*.ts` | Sim |
| `test/**` | Sim — TDD é obrigatório neste projeto (ver `CLAUDE.md`) |
| `prisma/schema.prisma` | Sim, mas sempre seguido de `migrate dev` (não editar schema sem gerar migration) |
| `prisma/migrations/**` | Não editar migrations existentes; só criar novas via CLI |
| `dist/**` | Nunca editar à mão — é build gerado, seria sobrescrito |
| `.env` | Não editar/ler conteúdo para exibir; só `.env.example` é seguro de mostrar/editar |
| `node_modules/**` | Nunca |

## Antes de considerar uma mudança de backend pronta

```
pnpm --filter @simplestock/backend run typecheck
pnpm --filter @simplestock/backend run lint
pnpm --filter @simplestock/backend run test
```

Testes de backend exigem Postgres rodando (`docker compose up -d` na raiz) e
`DATABASE_URL_TEST` configurado em `packages/backend/.env`. Se o banco não estiver
disponível, isso deve ser reportado ao usuário como bloqueio de ambiente — nunca
pular o teste silenciosamente ou assumir que passou.
