# Handover: where this project came from and what's next

_Written 28 Sept 2026 at the end of the first build session (in the Claude app), so a new Claude Code session can pick up without the original chat._

## Who this is for and why it exists

- The owner (GitHub **Eman23L**) is a solo developer in the **UK** who wants to **start a SaaS business**.
- Their problem, in their words: *"I have the resources to make what people need, but don't know where to find those people."*
- The original idea was a daily routine that watches GitHub for new things. It grew into this: an automated **demand radar** that finds people publicly describing problems they'd pay to solve, and notifies them every morning.
- Longer term they mentioned wanting **an app with notifications**. The agreed approach: run the radar as a daily digest for 1–2 weeks first, learn which signals are useful, *then* build the app (Phase 3 in `ROADMAP.md`). The radar could become the SaaS itself (Phase 4).

## How to work with the owner

- Explain things in **plain language, step by step**. They're comfortable building, but setup details (terminal commands, GitHub secrets, API keys) should be spelled out click by click.
- Give **a clear recommendation**, not a menu of equal options.
- When something needs doing in a browser or app (GitHub settings, Telegram, the Anthropic console), tell them exactly where to click. Only they can do those steps.

## What was built (session 1)

- The full pipeline, 7 collectors, scoring, optional Claude review, repeated-pain grouping, digest, and Telegram/Discord/ntfy notifications. See `ARCHITECTURE.md`.
- `.github/workflows/radar.yml` runs daily at 06:40 UTC and commits `data/` back. `ci.yml` runs typecheck, tests and the demo on push.
- 29 offline tests pass; `npm run demo` works; typecheck is clean.
- Sources were chosen from a research report on 2026 platform access. The summary is in `SOURCES.md`. Key point: **Reddit is off** (API closed to new devs Nov 2025, `.json` blocked May 2026), which is why GummySearch shut down.

## ⚠️ Not verified yet: the most important thing to know

**No collector has been run against the live APIs.** The build environment's network blocked every source site, so each collector was written from the API docs and tested only against the sample fixtures in `test/fixtures/`. Expect some fixes on the first live run. Most likely problem areas:

| Collector | Uncertainty |
|---|---|
| `findatender` | Pagination shape (`links.next` vs `cursor`) and where CPV codes live in real releases were guessed from docs |
| `hackernews` | Whether quoted phrases in the Algolia query behave as phrase search (a local filter makes this safe either way, but recall may be low) |
| `appstore` | The feed has been reported to sometimes return an empty envelope |
| `bluesky` | Calling `searchPosts` through `bsky.social` (PDS proxy) with an app-password session |
| `github` | Bounty amounts are parsed from labels/titles like `$250`; Algora's real label format should be checked |
| `stackexchange` | Throttling returns HTTP 400 `throttle_violation`, which currently surfaces as an error |

The right way to test: `node src/index.ts run --dry-run --sources <name>` locally, one source at a time, and fix each collector and its fixture to match the real response.

## Setup status (what the owner still has to do)

None of these were done at handover:

- [ ] Telegram bot created; `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` added as repo secrets
- [ ] `ANTHROPIC_API_KEY` secret (optional, recommended, ~£1–5/month)
- [ ] Optional: `STACKEXCHANGE_KEY`, `BLUESKY_HANDLE` + `BLUESKY_APP_PASSWORD`
- [ ] Repo set to **private** (it will fill with market research)
- [ ] First manual run: Actions → Daily radar → Run workflow → tick *dry run*
- [ ] The five decisions at the top of `ROADMAP.md`

For local runs, copy `.env.example` to `.env`. Node must be **≥ 22.18** (it runs the `.ts` files directly).

## Suggested next steps, in order

1. Help the owner through the setup above (Telegram first, then `node src/index.ts test-notify`).
2. Live-test each collector locally with `--dry-run --sources X` and fix what breaks. Update fixtures to real response shapes, keeping them clearly fake (`sample_user_N`).
3. First real Action run; check the digest in `data/digests/` and the ⚠️ lines in the run report.
4. Tune `config/radar.config.ts`: trim noisy phrases, and add App Store apps in 3–4 niches the owner is curious about.
5. Then Phase 1 of the roadmap: 👍/👎 feedback buttons on Telegram, instant alerts for scores 85+, and a weekly summary.

## Other repos (leave alone)

The owner's other GitHub repos are separate projects. In particular **`opportunity-ai`** (a UK career/side-hustle recommendation MVP in Next.js) is **not** this project and should not be changed from here.

## Research notes worth keeping

- A full research report was produced in the original chat. Its conclusions are captured in `SOURCES.md` (source matrix, UK sources, competitors, gap) and `PLAYBOOK.md` (Mom Test, sell before you build).
- Competitor gap to remember: post-GummySearch tools are mostly **Reddit-only** and focused on **replying to leads** for existing products. Nobody does **repeated pain over time** across sources that don't need Reddit's permission, or a **UK / regulatory-deadline** angle.
- Promising UK themes to test (a hypothesis, not verified): Making Tax Digital for Income Tax, Procurement Act 2023, landlord compliance, care-sector admin, small-firm payroll.
- Cost model: Claude Haiku 4.5 at $1/$5 per M tokens; ~40 posts/day ≈ $1.50/month (half with the Batch API).
