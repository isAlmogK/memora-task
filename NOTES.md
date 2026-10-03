# Notes

**Stacks** is a reading tracker. You search for books, group them into named stacks with a goal
and a deadline, and your progress updates without you typing it in. Progress arrives as events
from sources: an e-reader push, a (simulated) Kindle sync job, or a manual entry. Everything you
see, such as current progress, status, pace, finish date, stack on-track and reading stats, is
derived from those events in SQL.

## How to run it

The README has the details. In short, start Postgres (`docker compose up -d db`, or a local
Postgres 14+ with the role and two databases from the README), then:

```bash
cd backend  && cp .env.example .env && npm install && npm run db:reset && npm run start:dev
cd frontend && npm install && npm run dev        # http://localhost:5173
```

`npm test` in `backend/` runs 61 integration tests against the `stacks_test` database.
`npm run dev:mock` in `frontend/` runs the same UI with no backend.

## Where I got to

Everything in the brief's Core is done. For "something cool", three of the options got real
attention: **derived data computed in SQL, rendered as charts** (the Read page), **an async job
with its status in the UI** (Kindle sync), and **OpenAPI-generated client types** that the
frontend actually uses.

Not done, on purpose: real accounts and sign-up (seeded API keys only), pagination (a personal
library is small), per-user time zones (stats use UTC days), CI, and frontend tests.

## Choices and trade-offs

**Data model** (`backend/src/db/schema.ts`, `backend/drizzle/*.sql`)

- **Progress is an append-only log** (`reading_event`), not a field you overwrite. The canonical
  unit is percent, because that's what e-readers report; the page is kept for display.
- **The latest event that *occurred* wins, not the latest *received*.** A device that syncs late
  can't move you backwards. This rule lives in the `user_book_progress` view and has a test (the
  test fails if the view orders by `received_at`).
- **Status is derived, never stored.** You are reading if there's any event, finished at 100% or
  when you mark it, and put down if you say so. Only "finished" and "put down" are stored, as
  explicit choices.
- **Ownership is enforced by the database too.** Every user-owned row carries `user_id`, and
  references go through composite `(user_id, id)` foreign keys. A stack can't hold someone
  else's book even if the API check were bypassed; a test proves the database rejects it.
- **Ingestion is idempotent.** A partial unique index on `(user_id, source, external_id)` means
  a device resending the same event is a no-op.
- **One active sync per user** is a partial unique index, not application logic.
- **The automatic stacks (Library, Want to read, Read, Put down) aren't stored.** They're the
  library filtered by derived status, so they can't drift out of sync.
- **Drizzle** for the schema and migrations, with every generated migration read by hand. The
  progress view is a hand-written migration, since Drizzle's DSL can't express it.

**API** (`backend/openapi.json`, browsable at `/docs`)

- REST under `/v1`. Every error is `{ error: { code, message, details? } }`, and validation errors
  carry one message per field. Unknown fields are a 400, not silently dropped.
- Auth is an API key (`Authorization: Bearer`), stored as SHA-256. **User** keys call the app;
  **device** keys may only push progress events.
- Someone else's book or stack is always **404**, never 403, so ids don't leak.
- Stack reordering takes the complete new order and rejects anything else (stale, partial or
  repeated ids), rather than half-applying it.
- Moving a book between stacks is one transaction.

**Integrations**

- **Book data comes from Open Library**, which is free and needs no key. Amazon's Product
  Advertising API needs an Associates account with sales, so a reviewer couldn't run it. Search
  results are cached in the `book` table (first-seen wins, so curated rows aren't overwritten).
  An unsearchable query (Open Library answers 422 to "the") means no results, not an outage.
- **There is no public Kindle API.** Sync is modelled honestly: a `ProgressSource` interface,
  a `SimulatedKindleSource` behind it, and a worker that claims jobs with
  `FOR UPDATE SKIP LOCKED` and ingests through the same write path as manual entry. A real
  adapter (KOReader sync, Kobo, a Kindle session) would replace one provider. There's also a
  push endpoint for devices.

**Frontend**

- React, TanStack Query and React Router. API types are **generated from the backend's OpenAPI
  spec** and called through `openapi-fetch`, so an API change is a compile error in the UI.
- I built the UI first against an **in-browser mock of the API**, to review the experience
  before writing the backend. The mock stays: it has slow, error and empty modes for checking
  every loading, error and empty state. It follows the same rules as the API (the same derived
  numbers, the same error shapes).
- Motion is presentation only. I measured it: a drifting background behind blurred panels cost
  a third of the frame budget while scrolling, so the background now moves only with the cursor.

**Local setup.** Postgres ran from Homebrew rather than Docker on my machine, so
**`docker compose up` was never actually run here**. The compose file is standard (Postgres 16,
plus an init script that creates the test database), but it is untested.

## What I'd do next

1. Real accounts (sign-up, key rotation and revocation in the UI) and per-user time zones for
   stats and streaks.
2. A real progress source: KOReader's sync protocol is open and fits `ProgressSource` directly.
3. A `user_book_progress` index check under load, and a materialised stats table if the
   one-query stats ever got slow (they're one query per page view today).
4. CI running lint, typecheck, the integration tests and an OpenAPI drift check (regenerate
   the spec and fail on a diff).
5. Frontend tests for the trickier client logic: optimistic reorder rollback and the sync
   polling.

## Dev diary

Times are local, 2–3 October.

- **03:00 Brief and plan.** I chose books because I use Goodreads and dislike it. My first idea,
  Kindle auto-tracking plus Amazon search, hit two walls: there's no Kindle API and Amazon's API
  is gated. That reframed the product as "progress is events from sources", which is a better
  data model anyway.
- **03:15 Scaffold.** No Docker locally (my Mac was already loaded), so I switched to Homebrew
  Postgres and shipped the compose file anyway.
- **03:30 to 04:40 UI on a mock API, with three design reviews.** The first pass felt too
  "booky" (paper and serif), which became a cover-tinted glow and a grotesk font. Stacks went from
  a pile of book spines to a fanned hand of covers, then an automatic Read stack with stats, then
  "Library" became one automatic stack among several. Search moved into an overlay.
- **04:40 Schema, migrations, seed.** I caught the NULLS LAST index (see below) by reading the
  generated SQL before applying it.
- **04:50 Auth, errors, CRUD, tests.** Everything passed on the first run, which made me
  suspicious, so I swapped in a deliberately wrong view: exactly the right test failed.
- **05:00 to 05:50 Search, then the UI on the real API.** The API log from my own clicking showed
  Open Library rejecting "the" while I typed. Added moving and reordering.
- **06:20 Stats in SQL and the sync worker.**
- **A decision I reversed:** the first plan used Kysely with hand-written SQL migrations. It
  felt heavier than I wanted, so I switched to Drizzle before writing any code: simpler, still
  SQL-first, with every generated migration read and the view written by hand.

## AI usage

Most of the code was written by Claude (Claude Code), directed and reviewed in conversation.
The full transcripts are in [`ai-history/`](ai-history/README.md), one file per session.

**What I used it for:** the plan and design options, scaffolding, the schema and migrations,
every endpoint and test, the whole UI, and headless-browser checks of each screen (screenshots
plus console and network errors) after every change.

**What wasn't taken on trust:**

- **Generated SQL** was read before it was applied, and query plans were checked with `EXPLAIN`.
- **Access control** was proved by tests, and by the composite foreign keys underneath it.
- **The risky queries** were checked against independent computations. The stats query's
  streaks and day totals match a separate recomputation from raw events. Two tests were shown to
  fail on purpose, against a progress view and a streak rule that were deliberately broken.
- **"It works"** meant a browser run against the real API with network errors logged, not a
  passing typecheck.

**Where it was wrong, and how it was caught:**

| What went wrong | How it was caught |
|---|---|
| Drizzle's `.desc()` index came out as `DESC NULLS LAST`, which Postgres can't use for the latest-event `ORDER BY … DESC` | reading the generated migration, then `EXPLAIN` |
| `useEffect(() => window.scrollTo(…))` crashed the app: newer Chrome returns a Promise from `scrollTo`, which React took as a cleanup function. tsc and lint both passed | the first headless screenshot showed the crash |
| The stack summary query cast `due_on` to text, then did date arithmetic on it (a 500) | a curl smoke test, before the tests were written |
| The genre heuristic called Ishiguro novels "Nonfiction"; the fix then called *Sapiens* fiction ("Nonfiction" contains "fiction", plus a "graphic novels" tag) | searching for real, then diffing the regenerated snapshot |
| Open Library's 422 on "the" and "it" was reported as an outage, mid-typing | the API log from a real session |
| `tsx` doesn't emit decorator metadata, so Nest's dependency injection failed at boot | the first server start |
| The Now reading carousel tracked a position, so a sync re-sorting the list swapped the book on screen | a browser check after wiring sync |
| The Read card showed "0 books · 0 pages" when stats failed to load, which looks like real data | a review of the API-mode screenshots |
| A drifting, blurred background made scrolling drop frames | measured fps with each layer turned off |
