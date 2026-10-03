/**
 * The Stacks domain. `npm run db:generate` turns this into SQL in ../../drizzle; every
 * generated migration is read and committed by hand. Anything the DSL can't express (the
 * user_book_progress view) lives in a hand-written custom migration.
 *
 * Ownership is enforced by the database, not just the API: every user-owned row carries
 * user_id, and cross-table references go through composite (user_id, id) foreign keys, so
 * a stack can only ever contain its owner's books and an event its owner's book.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  customType,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const apiKeyScope = pgEnum('api_key_scope', ['user', 'device']);
export const progressSource = pgEnum('progress_source', ['manual', 'device', 'kindle_sim']);

export const appUser = pgTable('app_user', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull(),
  createdAt: createdAt(),
});

/**
 * Only the SHA-256 of a key is stored. `user` keys call the app API; `device` keys may
 * only push progress events (an e-reader shouldn't be able to read your stacks).
 */
export const apiKey = pgTable('api_key', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => appUser.id, { onDelete: 'cascade' }),
  keyHash: bytea('key_hash').notNull().unique(),
  scope: apiKeyScope('scope').notNull(),
  label: text('label').notNull(),
  createdAt: createdAt(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

/** Shared catalog cache of Open Library works; not user-owned. */
export const book = pgTable(
  'book',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    olWorkKey: text('ol_work_key').notNull().unique(),
    title: text('title').notNull(),
    authors: text('authors').array().notNull().default(sql`'{}'::text[]`),
    coverId: integer('cover_id'),
    pageCount: integer('page_count'),
    firstPublishedYear: integer('first_published_year'),
    genre: text('genre'),
    createdAt: createdAt(),
  },
  (t) => [
    check('book_page_count_positive', sql`${t.pageCount} > 0`),
    check('book_ol_work_key_format', sql`${t.olWorkKey} ~ '^OL[0-9]+W$'`),
  ],
);

/**
 * A book in someone's library. Status is never stored: it's derived from progress events
 * plus these two explicit choices (see the user_book_progress view).
 */
export const userBook = pgTable(
  'user_book',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id')
      .notNull()
      .references(() => book.id, { onDelete: 'restrict' }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    abandonedAt: timestamp('abandoned_at', { withTimezone: true }),
  },
  (t) => [
    unique('user_book_user_book_unique').on(t.userId, t.bookId),
    // target for composite FKs from reading_event and stack_book
    unique('user_book_user_id_id_unique').on(t.userId, t.id),
  ],
);

/**
 * Append-only progress log from any source. Current progress = the event that *occurred*
 * last (not the one received last), so a late-arriving device event can't regress you.
 */
export const readingEvent = pgTable(
  'reading_event',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid('user_id').notNull(),
    userBookId: uuid('user_book_id').notNull(),
    source: progressSource('source').notNull(),
    /** The source's own id for the event; makes device/sync ingestion idempotent. */
    externalId: text('external_id'),
    percent: numeric('percent', { precision: 5, scale: 2, mode: 'number' }).notNull(),
    page: integer('page'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: 'reading_event_user_book_fk',
      columns: [t.userId, t.userBookId],
      foreignColumns: [userBook.userId, userBook.id],
    }).onDelete('cascade'),
    uniqueIndex('reading_event_external_id_unique')
      .on(t.userId, t.source, t.externalId)
      .where(sql`${t.externalId} is not null`),
    // "Latest event per book" lookups. Plain DESC is NULLS FIRST in Postgres; Drizzle's
    // .desc() alone emits NULLS LAST, which the planner can't use for ORDER BY ... DESC.
    index('reading_event_latest_idx').on(t.userBookId, t.occurredAt.desc().nullsFirst(), t.id.desc().nullsFirst()),
    check('reading_event_percent_range', sql`${t.percent} between 0 and 100`),
    check('reading_event_page_nonnegative', sql`${t.page} >= 0`),
  ],
);

export const stack = pgTable(
  'stack',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    targetCount: integer('target_count'),
    dueOn: date('due_on', { mode: 'string' }),
    createdAt: createdAt(),
  },
  (t) => [
    // "Sci-fi" and "sci-fi" are the same stack name for one user
    uniqueIndex('stack_user_name_unique').on(t.userId, sql`lower(${t.name})`),
    unique('stack_user_id_id_unique').on(t.userId, t.id),
    check('stack_name_length', sql`char_length(${t.name}) between 1 and 80`),
    check('stack_target_count_range', sql`${t.targetCount} between 1 and 500`),
  ],
);

export const stackBook = pgTable(
  'stack_book',
  {
    userId: uuid('user_id').notNull(),
    stackId: uuid('stack_id').notNull(),
    userBookId: uuid('user_book_id').notNull(),
    position: integer('position').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'stack_book_pk', columns: [t.stackId, t.userBookId] }),
    // Both FKs include user_id: a stack can only hold books from its owner's library.
    foreignKey({
      name: 'stack_book_stack_fk',
      columns: [t.userId, t.stackId],
      foreignColumns: [stack.userId, stack.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'stack_book_user_book_fk',
      columns: [t.userId, t.userBookId],
      foreignColumns: [userBook.userId, userBook.id],
    }).onDelete('cascade'),
    index('stack_book_user_book_idx').on(t.userBookId),
  ],
);
