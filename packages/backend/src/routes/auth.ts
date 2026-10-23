import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { requireAuth } from '../middleware/requireAuth';
import { signAuthToken } from '../shared/jwt';
import { DUMMY_PASSWORD_HASH, verifyPassword } from '../shared/password';
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
  email: z.string().email().max(254),
  // Teto também protege o servidor: bcrypt é caro de propósito e uma senha
  // gigante repetida seria um vetor barato de DoS.
  password: z.string().min(1).max(128),
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    // Mensagem genérica idêntica para "usuário não existe" e "senha errada" —
    // não dar pista a quem está tentando enumerar e-mails válidos.
    // Sempre roda o bcrypt (contra um hash descartável quando o usuário não
    // existe) para que o tempo de resposta não revele e-mails cadastrados.
    const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordOk) {
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

// --- Direitos do titular (LGPD, art. 18) -----------------------------------

// Acesso/portabilidade: devolve tudo que o sistema guarda sobre o PRÓPRIO
// usuário autenticado. Nunca inclui `passwordHash`.
router.get('/me/data', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, createdAt: true, updatedAt: true },
    });
    if (!user) {
      res.status(404).json({ message: 'Usuário não encontrado.' });
      return;
    }
    const movements = await prisma.stockMovement.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      select: { id: true, productId: true, type: true, quantity: true, date: true, note: true },
    });
    res.json({ user, movements, exportedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

const deleteAccountSchema = z.object({ password: z.string().min(1).max(128) });

// Eliminação: exige a senha (reautenticação — o token sozinho pode ter sido
// roubado). As movimentações de estoque são preservadas por integridade do
// inventário, mas ficam anonimizadas: a FK `userId` é ON DELETE SET NULL.
router.delete('/me', requireAuth, async (req, res, next) => {
  try {
    const { password } = deleteAccountSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(403).json({ message: 'Senha incorreta.' });
      return;
    }
    await prisma.user.delete({ where: { id: user.id } });
    req.log.info({ userId: user.id }, 'Conta excluída a pedido do titular');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
