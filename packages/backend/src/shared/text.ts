/** Marcas de combinação Unicode (acentos) separadas pela normalização NFD. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Normaliza um texto para comparação de busca: caixa baixa e sem diacríticos
 * ("Lápis" -> "lapis"), de modo que buscar "lapis" encontre "Lápis".
 *
 * Isto roda em Node, não no Postgres. O `contains` do Prisma com
 * `mode: 'insensitive'` resolve apenas maiúscula/minúscula (ILIKE); acento é
 * uma questão de collation e exigiria a extensão `unaccent` no banco. Ver o
 * comentário sobre a decisão em `routes/products.ts`.
 */
export function normalizeForSearch(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '');
}
