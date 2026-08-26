import { RequestHandler } from 'express';

import { verifyAuthToken } from '../shared/jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Não autenticado.' });
    return;
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = await verifyAuthToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
};
