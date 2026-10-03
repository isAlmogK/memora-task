# AI chat history

Every Claude Code session for this project, in order, converted from the session logs by
[`scripts/export-ai-history.mjs`](../scripts/export-ai-history.mjs) (`node scripts/export-ai-history.mjs`).

Each file keeps the prompts, Claude's replies, one line per tool call (what it ran or
edited), and every failed tool call in full. It leaves out the model's private reasoning,
text the tool injected (system reminders, skill instructions), and the output of successful
commands; the git history shows what those produced. Emails and the home directory are
redacted. The only keys anywhere are the seeded **dev** API keys, which are public on purpose.

| # | Session | Covers |
|---|---------|--------|
| 01 | [Design brainstorm](01-design-brainstorm.md) | Reading the brief, the product idea, data-layer choice (Kysely → Drizzle), UI direction, the plan |
| 02 | [Scaffold and UI](02-scaffold-and-ui.md) | Repo scaffold, no local Docker (Homebrew Postgres instead), Open Library snapshot, the UI on a mock API |
| 03 | [UI review, backend and wiring](03-ui-review-backend-and-wiring.md) | Design review rounds, schema/migrations/seed, auth and CRUD, search, stats and the sync job, wiring the UI to the real API |

How AI was used, what wasn't trusted to it, and where it was wrong is summarised in
[NOTES.md](../NOTES.md#ai-usage).
