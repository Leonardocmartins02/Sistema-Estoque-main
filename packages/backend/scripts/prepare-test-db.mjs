import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL_TEST;
if (!databaseUrl) {
  console.error(
    'DATABASE_URL_TEST não definido em packages/backend/.env — configure (ver .env.example) e rode ' +
      '`docker compose up -d` na raiz do repo antes de preparar o banco de teste.',
  );
  process.exit(1);
}

const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: databaseUrl },
  shell: true,
});

process.exit(result.status ?? 1);
