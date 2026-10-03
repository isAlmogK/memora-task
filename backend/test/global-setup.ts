import { runMigrations } from '../src/db/migrate';
import { config } from '../src/config';

/** Once per run: bring the test database to the latest migration. */
export default async function globalSetup(): Promise<void> {
  await runMigrations(config.databaseUrlTest);
}
