import { z } from 'zod';

/**
 * Primitivos Zod para query params.
 *
 * Antes cada rota parseava `req.query` na mão com `String()`/`Number()`, o que
 * engolia silenciosamente entrada inválida (`?page=abc` virava página 1,
 * `?from=amanha` era ignorado). Agora tudo passa por Zod e qualquer valor fora
 * do domínio vira `ZodError` -> 400 no handler de erro global de `app.ts`.
 *
 * Nota: `req.query` pode entregar `string | string[] | ParsedQs`. Nenhum
 * schema aqui aceita array/objeto — um `?page=1&page=2` falha a validação em
 * vez de escolher um dos valores arbitrariamente.
 */

/** Texto opcional, já trimado; ausente vira string vazia. */
export const optionalTextParam = z.string().trim().optional().default('');

/**
 * Data opcional em ISO. Ausente ou string vazia viram `undefined`; qualquer
 * outra coisa precisa ser parseável por `new Date(...)`, senão é 400.
 */
export const optionalDateParam = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .pipe(z.coerce.date().optional());

/** Número de página: inteiro >= 1, default 1. */
export const pageParam = z.coerce.number().int().min(1).default(1);

/**
 * Tamanho de página com limite superior explícito.
 * `min` fica configurável porque `/api/products` aceita `0` como "traga todos"
 * (contrato já consumido pelo frontend) enquanto as demais listagens exigem
 * pelo menos 1.
 */
export function pageSizeParam(options: { min: number; max: number; default: number }) {
  return z.coerce.number().int().min(options.min).max(options.max).default(options.default);
}
