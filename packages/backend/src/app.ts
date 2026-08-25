import express from 'express';
import cors from 'cors';
import routes from './routes';

export function createServer() {
  const app = express();

  // Configuração detalhada do CORS
  const corsOptions = {
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      // Permite requisições sem origem (como aplicativos móveis ou curl)
      if (!origin) return callback(null, true);
      
      // Lista de origens permitidas
      const allowedOrigins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:4000',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175'
      ];
      
      // Verifica se a origem está na lista de permitidas
      if (allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      
      // Para desenvolvimento, permitir qualquer origem
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Aviso: Permitindo origem não autorizada em desenvolvimento:', origin);
        return callback(null, true);
      }
      
      // Em produção, negar origens não listadas
      return callback(new Error('Not allowed by CORS'));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 204,
    preflightContinue: false
  };
  
  // Aplica o CORS a todas as rotas
  app.use(cors(corsOptions));
  
  // Habilita pre-flight para todas as rotas
  app.options('*', cors(corsOptions));
  app.use(express.json());

  // Rota de health check
  app.get('/health', (_req, res) => res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  }));

  // Log de requisições para debug
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });

  // Rotas da API
  app.use('/api', routes);

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Internal Server Error' });
  });

  return app;
}
