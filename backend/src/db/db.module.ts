import { Global, Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;
export const DB = Symbol('DB');
const POOL = Symbol('PG_POOL');

/**
 * Sessions run in UTC so `::date` casts (stack deadlines, stats buckets) mean the same day
 * whatever the server's local zone is.
 */
export function createPool(url: string): Pool {
  return new Pool({ connectionString: url, options: '-c timezone=UTC' });
}

/** Inject the Drizzle client with `@InjectDb() db: Db`. */
export const InjectDb = () => Inject(DB);

@Injectable()
class PoolCloser implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly pool: Pool) {}
  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    { provide: POOL, useFactory: () => createPool(config.databaseUrl) },
    { provide: DB, inject: [POOL], useFactory: (pool: Pool): Db => drizzle(pool, { schema }) },
    PoolCloser,
  ],
  exports: [DB],
})
export class DbModule {}
