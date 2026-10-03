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

export const config = {
  databaseUrl: required('DATABASE_URL'),
  databaseUrlTest: process.env.DATABASE_URL_TEST ?? 'postgres://stacks:stacks@localhost:5432/stacks_test',
  port: Number(process.env.PORT ?? 3000),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((o) => o.trim()),
};
