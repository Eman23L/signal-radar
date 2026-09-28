---
description: Live-test one radar source against its real API and fix the collector if it breaks
argument-hint: <source name, e.g. hackernews | github | stackexchange | appstore | findatender | bluesky>
---

Live-test the `$ARGUMENTS` collector against the real API. See "Not verified yet" in docs/HANDOVER.md for what's most likely wrong with each source.

1. Run `node src/index.ts run --dry-run --no-ai --no-notify --sources $ARGUMENTS` and read the log and run report.
2. If it failed or returned 0 items, fetch one real response for the same URL the collector builds (curl, or a tiny script) and compare its shape with `test/fixtures/` and the interfaces in `src/collectors/$ARGUMENTS.ts`.
3. Fix the collector to match reality. Update the fixture to the real response shape, keeping the content clearly fake (`sample_user_N`, `sample-org`, `_note` field).
4. Run `npm test` and `npm run demo`, and `npm run typecheck` if dependencies are installed.
5. Explain to the owner in plain language what was wrong and what changed, then offer to commit.
