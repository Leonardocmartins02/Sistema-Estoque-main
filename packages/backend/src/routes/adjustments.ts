import { Router } from 'express';
import { z } from 'zod';

import { recordAdjustment } from '../services/stockService';

const router = Router();

const adjustmentSchema = z.object({
  targetQuantity: z.number().int().min(0),
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
