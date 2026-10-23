import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { ZodError } from 'zod';

import routes from './routes';
import { env, corsAllowedOrigins } from './shared/env';
import { HttpError } from './shared/httpError';
import { logger } from './shared/logger';

export function createServer() {
  const app = express();

  app.disable('x-powered-by');

  // Atrás do proxy do Render/Netlify o IP do cliente vem em X-Forwarded-For.
  // Sem isto o rate limit enxerga o IP do proxy e todos os usuários dividem a
  // mesma cota (ou, pior, o limite por IP pode ser burlado).
  if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);

  app.use(helmet());

  const corsOptions: cors.CorsOptions = {
    origin(origin, callback) {
      // Requisições sem header Origin (curl, apps mobile, testes de integração)
      // não têm política de mesma origem para aplicar — não são o alvo do CORS.
      if (!origin) return callback(null, true);

      if (corsAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      logger.warn({ origin }, 'Origem bloqueada por CORS');
      return callback(new HttpError(403, 'Origem não permitida.'));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '100kb' }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
    }),
  );

  // Rate limit global — protege a API inteira de abuso; a rota de login tem
  // um limite adicional, mais restrito, definido em routes/auth.ts.
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get('/health', (_req, res) =>
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    }),
  );

  app.use('/api', routes);

  app.use(
    (err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (err instanceof ZodError) {
        res.status(400).json({ message: 'Dados inválidos.', errors: err.issues });
        return;
      }

      if (err instanceof HttpError) {
        res.status(err.status).json({ message: err.message });
        return;
      }

      // Erros do body-parser (JSON malformado, corpo grande demais) já trazem
      // status 4xx; sem isto virariam 500 e poluiriam o log como falha interna.
      if (typeof err === 'object' && err !== null && 'type' in err && 'status' in err) {
        const { type, status } = err as { type: string; status: number };
        if (type === 'entity.too.large') {
          res.status(413).json({ message: 'Corpo da requisição grande demais.' });
          return;
        }
        if (type === 'entity.parse.failed' && status === 400) {
          res.status(400).json({ message: 'JSON inválido.' });
          return;
        }
      }

      // Erro não esperado: detalhe completo só no log do servidor, nunca na
      // resposta — evita vazar stack trace / mensagem interna do driver do
      // banco para quem chamou a API.
      (req.log ?? logger).error({ err }, 'Erro não tratado');
      res.status(500).json({ message: 'Erro interno do servidor.' });
    },
  );

  return app;
}
