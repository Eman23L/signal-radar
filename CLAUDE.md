# Signal Radar: notes for Claude

Daily scanner that finds demand signals (people asking for tools, willing to pay, bad reviews of paid apps, UK tenders, bounties, launches), scores them, groups repeated pain, and sends a digest. Runs on GitHub Actions; results are committed to `data/`.

**Start here:** the project's background, the owner's goals, what's unverified, and the next steps are in the handover note:

@docs/HANDOVER.md

## Rules of the codebase

- **Zero runtime dependencies.** Node ≥ 22.18 runs the TypeScript directly (type stripping). Use `fetch`, `node:*` modules only. Dev deps (typescript, @types/node) are for type-checking only.
- **Erasable TypeScript only**: no `enum`, no `namespace`, no constructor parameter properties. Import local files with the `.ts` extension. `tsconfig.json` enforces this (`erasableSyntaxOnly`).
- **Every source is one collector** in `src/collectors/` returning `Signal[]` (see `src/types.ts`), registered in `src/collectors/index.ts`, with a config block in `src/config.ts` + `config/radar.config.ts`, a fixture in `test/fixtures/`, a branch in `src/fixtures.ts`, and a test in `test/collectors.test.ts`.
- Collectors use `ctx.fetch` / `ctx.fetchText` (never global fetch) and `ctx.delay` for pacing, so fixtures and tests run offline.
- A collector may throw; `run.ts` catches it and reports it. Don't swallow errors inside collectors.
- Never store usernames: `run.ts` hashes `author` before anything is saved.
- Fixture data must be clearly fake (`sample_user_N`, `sample-org`) and carry the `_note` field.
- Reddit stays **off by default** (see docs/SOURCES.md). Don't add unlicensed Reddit proxy APIs.

## Commands

```bash
npm run demo        # offline full run, prints digest
npm test            # node --test, offline
npm run typecheck   # needs `npm install` first
node src/index.ts run --dry-run --sources hackernews   # live, one source, prints only
```

## Where things are

- Tune behaviour: `config/radar.config.ts`
- Pipeline order: `src/run.ts`
- Scoring rubric: `src/pipeline/score.ts` (heuristic), `src/pipeline/classify.ts` (Claude)
- Plan: `docs/ROADMAP.md`. Source access rules: `docs/SOURCES.md`
