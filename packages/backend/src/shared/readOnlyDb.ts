/**
 * Acesso somente-leitura de verdade ao banco SQLite do projeto.
 *
 * Diferente de uma convenção ("essa skill só deve rodar SELECT"), esta conexão é
 * aberta em modo read-only nativo do próprio motor SQLite (`readOnly: true`).
 * Qualquer tentativa de escrita (INSERT/UPDATE/DELETE/DDL) falha com um erro real
 * do SQLite, não com uma checagem que o código de quem chama poderia esquecer de
 * fazer. É o canal indicado para o papel "query-database" (mapeamento de schema,
 * inspeção de dados para embasar o design de uma feature) — nunca para servir
 * requisições da aplicação, que continuam usando o Prisma normalmente em
 * `./prisma.ts`.
 *
 * Equivalente para quando a consulta precisar passar pelo Prisma (ex.: usar os
 * mesmos helpers de tipagem gerados) em vez do SQL cru: aponte um PrismaClient
 * separado para uma URL com o parâmetro de modo somente-leitura do SQLite, ex.:
 *
 *   const readOnlyPrisma = new PrismaClient({
 *     datasourceUrl: (process.env.DATABASE_URL ?? 'file:./dev.db') + '?mode=ro',
 *   });
 *
 * Esse trecho específico não foi testado neste projeto porque o ambiente onde
 * isso foi implementado não tem acesso à internet para rodar `prisma generate`
 * (o Prisma Client não pôde nem ser gerado aqui). Antes de confiar nele, rode a
 * verificação da seção "Como confirmar" do PR/patch na sua máquina.
 */
import { DatabaseSync } from 'node:sqlite';

export interface ReadOnlyDb {
  /** Executa uma consulta de leitura e retorna todas as linhas. */
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  /** Executa uma consulta de leitura e retorna a primeira linha (ou undefined). */
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  close(): void;
}

/**
 * Abre o banco em `dbPath` em modo somente-leitura. Lança se o arquivo não
 * existir (não cria um banco novo — essa função nunca deveria ter permissão
 * de criar/alterar estrutura).
 */
export function openReadOnlyDb(dbPath: string): ReadOnlyDb {
  const db = new DatabaseSync(dbPath, { readOnly: true });

  return {
    all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      return db.prepare(sql).all(...params) as T[];
    },
    get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
      return db.prepare(sql).get(...params) as T | undefined;
    },
    close(): void {
      db.close();
    },
  };
}
