# Stacks

A clean, minimal reading tracker: search for books, group them into named **stacks** (with an
optional target and deadline), and watch your reading progress update **without typing it in**.

Progress is modelled as *events from sources* (your e-reader, a sync job, or a manual entry). The
current progress, reading pace and estimated finish date are all derived from those events in SQL.
There is no public Kindle API, so a **simulated Kindle sync job** stands in for a real integration.
Book data comes from [Open Library](https://openlibrary.org/developers/api) (free, no API key).

> **Status:** the API serves the library, stacks, progress and book search, and the UI runs
> on it. Reading stats (the **Read** page) and the Kindle sync job are the next backend step:
> until then they show their error state against the real API, and work fully in mock mode.
> Design notes, trade-offs and how AI was used will be in `NOTES.md`.

## Run it locally

You need **Node.js 20+**, npm, and PostgreSQL. Credentials match `docker-compose.yml`
(`stacks` / `stacks`); a separate `stacks_test` database is used by the integration tests.

**1. Database.** Either Docker:

```bash
docker compose up -d db
```

or a local Postgres (14+):

```bash
psql postgres -c "CREATE ROLE stacks LOGIN PASSWORD 'stacks' CREATEDB;"
createdb -O stacks stacks
createdb -O stacks stacks_test
```

**2. API** (http://localhost:3000, interactive docs at http://localhost:3000/docs):

```bash
cd backend
cp .env.example .env
npm install
npm run db:reset      # migrate + seed (two users, 32 books, a year of reading)
npm run start:dev
```

**3. UI** (http://localhost:5173, in another terminal):

```bash
cd frontend
npm install
npm run dev
```

The UI proxies `/v1` to the API and signs in as the seeded user Alice. To see the other seeded
user, set `VITE_API_KEY=dev-bob-user-key` in `frontend/.env.local`.

**UI only, no backend:** `npm run dev:mock` runs the same UI on an in-browser mock of the API
(same endpoints, status codes and derived fields), seeded like the database.

### Things to try

- **Search** (nav button, **⌘K** or **/**; try "Ishiguro" or "Le Guin"): searches Open Library.
  Pick a stack under *Add to*, then add a book, and the cover flies into that stack.
- **Click a cover**: it expands into the book page: progress, pace, finish date, stacks and an
  activity log. Log progress by page or percent, mark it finished, or remove it.
- **Stacks**: your own stacks sit on top. Below them, *Collected for you* holds the
  automatic ones: **Library** (everything, filterable by status), **Want to read**, **Read**
  and **Put down**. Books sort into these by their reading status.
- **New stack**: give it a target and a due date to see whether you're on track.
- **Read** (mock mode for now): your stats: books and pages read, books per month, genres,
  streaks, and a reading-days heatmap. Each chart has a table view.
- **Sync Kindle** (mock mode for now): a simulated sync job; progress bars move one book at a
  time as events arrive.
- **The `mock · normal` button** (mock mode, bottom left): switches the mock to **slow**,
  **error** or **empty** to see every loading, error and empty state.

### Calling the API directly

```bash
curl -H "Authorization: Bearer dev-alice-user-key" "localhost:3000/v1/library?status=reading"
curl -H "Authorization: Bearer dev-alice-user-key" "localhost:3000/v1/catalog/search?q=le%20guin"
```

Seeded keys: `dev-alice-user-key`, `dev-bob-user-key`, and `dev-alice-kindle-key` (a device key:
it may only `POST /v1/progress-events`).

## Scripts

| Where | Command | What it does |
|---|---|---|
| `frontend/` | `npm run dev` | UI on http://localhost:5173, against the API |
| | `npm run dev:mock` | Same UI on the in-browser mock, no backend needed |
| | `npm run gen:api` | Regenerate `src/api/schema.d.ts` from `backend/openapi.json` |
| | `npm run build` | Type-check and production build into `dist/` |
| | `npm run typecheck` / `npm run lint` | TypeScript / oxlint |
| `backend/` | `npm run start:dev` | API on http://localhost:3000 (watch mode) |
| | `npm test` | Jest tests (needs the `stacks_test` database) |
| | `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| | `npm run db:reset` | Migrate and reseed the dev database |
| | `npm run db:generate` / `npm run db:migrate` | Generate SQL migrations from the Drizzle schema / apply them |
| | `npm run openapi` | Write `openapi.json` (then `npm run gen:api` in `frontend/`) |

## Project layout

```
backend/            NestJS API: Drizzle ORM + PostgreSQL, OpenAPI via @nestjs/swagger
  src/              auth, catalog (Open Library), library, progress, stacks
  src/db/           schema, DB module, migrate + seed scripts, Open Library snapshot
  drizzle/          SQL migrations (generated, then reviewed; the progress view is hand-written)
  test/             integration tests against a real Postgres
  openapi.json      the API contract, emitted from the code
  scripts/          one-off: refresh the Open Library snapshot
frontend/           React 19 + Vite + TanStack Query + React Router, Tailwind, Motion
  src/api/          generated API types, typed client, query hooks, and the mock (mock/)
  src/pages/        Home, Book, Stacks, Stack, Library, Read (search is an overlay in components/)
  src/components/   covers, progress bars, stack fans, charts, search overlay, sync button, …
docker-compose.yml  Postgres 16 (+ creates the test database)
ai-history/         Claude Code session transcripts, in order
```

## Stack

- **Backend:** NestJS 11, PostgreSQL 16, Drizzle ORM (hand-reviewed SQL migrations),
  class-validator DTOs, OpenAPI.
- **Frontend:** React 19, Vite, TanStack Query, React Router, Tailwind CSS 4, Motion. API types
  are generated from the backend's OpenAPI spec and used through `openapi-fetch`.
