# AI chat history

One Markdown file per Claude Code session, numbered in the order they happened.
Each file is exported with Claude Code's built-in `/export` command and committed
with the code from that session, so the transcripts line up with the git history.

Before committing, every export gets a manual scan for secrets and personal data.
The only keys in this repo are the fixed **dev** keys from the seed, and those are public on purpose.

| # | Session | Covers |
|---|---------|--------|
| 01 | `01-design-brainstorm.md` | Reading the brief, product idea, data-layer choice (Kysely → Drizzle), UI direction, the plan |
| 02 | `02-build.md` | Implementation: scaffold → schema → API → frontend |
