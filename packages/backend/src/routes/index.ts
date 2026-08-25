import { Router } from 'express';
import products from './products';
import movements from './movements';
import quickOut from './quick-out';

const router = Router();

router.use('/products', products);
router.use('/products', movements); // nested under /products/:id/movements
router.use('/quick-out', quickOut); // rota para baixa rápida

export default router;
