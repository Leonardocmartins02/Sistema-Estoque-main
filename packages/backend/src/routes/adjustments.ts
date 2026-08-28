import { Router } from 'express';
import { z } from 'zod';

import { recordAdjustment } from '../services/stockService';

const router = Router();

/**
 * `StockMovement.newQuantity`/`quantity` são `Int` no Prisma, que sobre
 * PostgreSQL é `integer` (int4). O teto aqui é exatamente o desse tipo — não é
 * um número escolhido por estética: acima dele o INSERT falha no banco com um
 * erro que não é `HttpError` nem `ZodError`, e o handler global de `app.ts` o
 * classifica como 500 ("erro interno") quando na verdade é entrada inválida.
 * Validando na borda, o mesmo caso vira o 400 que os demais campos já devolvem.
 *
 * `expectedPreviousQuantity` não precisa do teto: ele nunca é persistido — só é
 * comparado com o saldo lido sob lock, e um valor absurdo simplesmente diverge
 * e resulta em 409.
 */
const PG_INT4_MAX = 2_147_483_647;

const adjustmentSchema = z.object({
  targetQuantity: z.number().int().min(0).max(PG_INT4_MAX, 'Quantidade acima do máximo permitido.'),
  expectedPreviousQuantity: z.number().int().min(0),
  reason: z.string().trim().min(1, 'Informe o motivo do ajuste.').max(500, 'Motivo muito longo (máximo de 500 caracteres).'),
});

router.post('/:id/adjustments', async (req, res, next) => {
  try {
    const id = req.params.id;
    const data = adjustmentSchema.parse(req.body);

    const created = await recordAdjustment({
      productId: id,
      targetQuantity: data.targetQuantity,
      expectedPreviousQuantity: data.expectedPreviousQuantity,
      reason: data.reason,
      userId: req.user!.id,
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

export default router;
