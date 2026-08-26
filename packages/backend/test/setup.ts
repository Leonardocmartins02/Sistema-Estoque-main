import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST não definido. Configure packages/backend/.env (ver .env.example) e rode ' +
      '`docker compose up -d` na raiz do repo antes de rodar os testes de integração.',
  );
}

// Redireciona a app inteira (via env.ts) para o banco de teste antes de
// qualquer módulo da aplicação ser importado pelos arquivos de teste.
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.NODE_ENV = 'test';
process.env.CORS_ALLOWED_ORIGINS ||= 'http://localhost:5173';
process.env.JWT_SECRET ||= 'chave-de-teste-nao-usar-em-producao-0000000000';
