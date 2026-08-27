import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';

import adjustments from './adjustments';
import auth from './auth';
import movements from './movements';
import products from './products';
import quickOut from './quick-out';

const router = Router();

// /auth/login fica de fora do requireAuth por definição (é como o token é
// obtido). Todo o resto da API é dado de negócio (estoque) e exige sessão
// autenticada mesmo para leitura — não há decisão de "GET pode ficar aberto"
// aqui: é uma ferramenta interna, não há rota pública.
router.use('/auth', auth);
router.use('/products', requireAuth, products);
router.use('/products', requireAuth, movements); // nested under /products/:id/movements
router.use('/products', requireAuth, adjustments); // nested under /products/:id/adjustments
router.use('/quick-out', requireAuth, quickOut); // rota para baixa rápida

export default router;
