import { createServer } from './app';
import { env } from './shared/env';
import { logger } from './shared/logger';
import { prisma } from './shared/prisma';

const app = createServer();

const server = app.listen(env.PORT, () => {
  logger.info(`SimpleStock API rodando em http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`Recebido ${signal}, encerrando graciosamente...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
