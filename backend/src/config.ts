import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Node >= 20.12 reads .env natively; real environment variables still win.
const envFile = resolve(__dirname, '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name} (see backend/.env.example)`);
  return value;
}

const databaseUrlTest = process.env.DATABASE_URL_TEST ?? 'postgres://stacks:stacks@localhost:5432/stacks_test';

export const config = {
  // Jest sets NODE_ENV=test; tests must never touch the dev database.
  databaseUrl: process.env.NODE_ENV === 'test' ? databaseUrlTest : required('DATABASE_URL'),
  databaseUrlTest,
  port: Number(process.env.PORT ?? 3000),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((o) => o.trim()),
};
