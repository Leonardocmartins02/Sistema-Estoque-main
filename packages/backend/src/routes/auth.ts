import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { requireAuth } from '../middleware/requireAuth';
import { signAuthToken } from '../shared/jwt';
import { verifyPassword } from '../shared/password';
import { prisma } from '../shared/prisma';

const router = Router();

// Rota de autenticação é o alvo natural de força bruta — limite mais
// restritivo que o rate limit global aplicado ao resto da API.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas tentativas de login. Tente novamente mais tarde.' },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    // Mensagem genérica idêntica para "usuário não existe" e "senha errada" —
    // não dar pista a quem está tentando enumerar e-mails válidos.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ message: 'E-mail ou senha inválidos.' });
      return;
    }

    const token = await signAuthToken({ sub: user.id, email: user.email });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
