// Applies drizzle/*.sql in order (tracked in drizzle.__drizzle_migrations).
//   npm run db:migrate            -> DATABASE_URL
//   npm run db:migrate -- --test  -> DATABASE_URL_TEST
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { config } from '../config';

export async function runMigrations(url: string): Promise<void> {
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: resolve(__dirname, '../../drizzle') });
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  const url = process.argv.includes('--test') ? config.databaseUrlTest : config.databaseUrl;
  runMigrations(url)
    .then(() => console.log(`migrated ${new URL(url).pathname.slice(1)}`))
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
