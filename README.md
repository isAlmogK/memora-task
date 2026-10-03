# Stacks

A clean, minimal reading tracker: search for books, group them into named **stacks** (with an
optional target and deadline), and watch your reading progress update **without typing it in**.

Progress is modelled as *events from sources* (your e-reader, a sync job, or a manual entry). The
current progress, reading pace and estimated finish date are all derived from those events in SQL.
There is no public Kindle API, so a **simulated Kindle sync job** stands in for a real integration.
Book data comes from [Open Library](https://openlibrary.org/developers/api) (free, no API key).

> **Status:** the UI is complete and runs on an in-browser **mock API**, so the screens can be
> reviewed before the real backend lands. The NestJS + Postgres API is in progress: the skeleton
> and health check are done, and the schema, endpoints and sync worker are next. Design notes,
> trade-offs and how AI was used will be in `NOTES.md`.

## Run the UI locally (mock data, no backend needed)

You need **Node.js 20+** and npm.

```bash
cd frontend
npm install
npm run dev
```

Then open **http://localhost:5173**.

All data is served from an in-browser mock that behaves like the planned API: the same endpoints,
status codes and derived fields. It is seeded with 32 real books (about a year of reading history) and three stacks.
Reloading the page reseeds it.

Things to try:

- **Sync Kindle** (top right): starts a simulated sync job. Progress bars move one book at a
  time as events arrive.
- **Click a cover**: it expands into the book page, which shows progress, pace, finish date, stacks
  and an activity log. The background glow takes its colours from the book in focus.
- **Search** (nav button, **⌘K** or **/**; try "Ishiguro" or "Le Guin"): opens over the page.
  Pick a stack under *Add to*, then add a book, and the cover flies into that stack.
- **Stacks**: your own stacks sit on top. Below them, *Collected for you* holds the
  automatic ones: **Library** (everything, filterable by status), **Want to read**, **Read**
  and **Put down**. Books sort into these by their reading status. **Read** opens your
  stats: books and pages read, books per month, genres, streaks, and a reading-days
  heatmap. Each chart has a table view.
- **New stack**: give it a target and a due date to see whether you're on track.
- **The `mock · normal` button** (bottom left): switches the mock to **slow**, **error** or
  **empty** so you can see every loading, error and empty state. *Reset mock data* reseeds it.

## Run the backend (work in progress)

The API needs PostgreSQL. Credentials match `docker-compose.yml` (`stacks` / `stacks`), and a
`stacks_test` database is used by the integration tests.

**Option A: Docker**

```bash
docker compose up -d db
```

**Option B: a local Postgres (14+)**

```bash
psql postgres -c "CREATE ROLE stacks LOGIN PASSWORD 'stacks' CREATEDB;"
createdb -O stacks stacks
createdb -O stacks stacks_test
```

Then start the API:

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
curl http://localhost:3000/v1/health
```

## Scripts

| Where | Command | What it does |
|---|---|---|
| `frontend/` | `npm run dev` | Dev server on http://localhost:5173 |
| | `npm run build` | Type-check and production build into `dist/` |
| | `npm run typecheck` / `npm run lint` | TypeScript / oxlint |
| `backend/` | `npm run start:dev` | API on http://localhost:3000 (watch mode) |
| | `npm test` | Jest tests (needs the `stacks_test` database) |
| | `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| | `npm run db:generate` / `npm run db:migrate` | Generate SQL migrations from the Drizzle schema / apply them |

## Project layout

```
backend/            NestJS API: Drizzle ORM + PostgreSQL, OpenAPI via @nestjs/swagger
  src/db/           schema, DB module, seed data (Open Library snapshot)
  scripts/          one-off: refresh the Open Library snapshot
frontend/           React 19 + Vite + TanStack Query + React Router, Tailwind, Motion
  src/api/          API types, query hooks, and the mock server (mock/)
  src/pages/        Home, Book, Stacks, Stack, Library, Read (search is an overlay in components/)
  src/components/   covers, progress bars, stack piles, sync button, …
docker-compose.yml  Postgres 16 (+ creates the test database)
ai-history/         Claude Code session transcripts, in order
```

## Stack

- **Backend:** NestJS 11, PostgreSQL 16, Drizzle ORM (hand-reviewed SQL migrations),
  class-validator DTOs, OpenAPI.
- **Frontend:** React 19, Vite, TanStack Query, React Router, Tailwind CSS 4, Motion. When the
  API is done, the client types will be generated from its OpenAPI spec (`npm run gen:api`).
