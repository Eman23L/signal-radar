# Handover: where this project came from and what's next

_Written 28 Sept 2026 at the end of the first build session (in the Claude app), so a new Claude Code session can pick up without the original chat. Updated the same day after sessions 2 and 3: see **Latest status** just below._

## Latest status (session 3, 28 Sept 2026): read this first

The network allowlist works: Find a Tender, the App Store feed, Stack Exchange and HN Algolia all answer from Claude Code. (`api.github.com` still returns 403 from the sandbox, but GitHub works fine in Actions.) Node's `fetch` needs `NODE_USE_ENV_PROXY=1` here.

**Fixed and live-tested**
- **findatender**: 0 → 5 relevant tenders for the day. The `stages=tender` filter was returning 5 of about 48 tender notices. The collector now fetches every release (paging via `links.next`), keeps `tender` and `planning` tags (planning is shown as *[early engagement]*), matches on the **main** CPV only (big frameworks list hundreds of item codes), and falls back to `amountGross` for the value. The first live find was an HMRC Income Tax Self-Assessment (Making Tax Digital) proof of concept, £292k. The fixture now has the real shape.
- **appstore**: the feed works (50 reviews per app). The 0 was the 26 h window: bad reviews for one app arrive every few days. Now `lookbackHours: 168` for this source (`seen.json` stops repeats), and an empty feed is retried once. Live: 2 Jobber 1★ reviews.
- **stackexchange**: works. softwarerecs gets only ~2 questions a week, so this source also looks back 168 h now. Live: 2 items.
- **Scoring**: the flat 50 is gone. "I would pay" is now counted once, not as a pain phrase *and* a money word *and* WTP. The full WTP bonus needs a real problem or tool-ask as well, and demand items with no engagement data (HN comments) lose 10. On live HN data, the generic chat now scores 10–25, below the cut-off of 30. Two new tests cover this.
- 31 tests pass; typecheck clean; demo works.

**Next steps for session 4, in order**
1. The owner adds `ANTHROPIC_API_KEY` (console.anthropic.com → API keys → Create key; then GitHub repo → Settings → Secrets and variables → Actions → New repository secret). Then a **non**-dry run, to confirm the Telegram message arrives.
2. Check the next scheduled run's report for the App Store line. If it still says "no entries" from Actions, Apple may be emptying the feed for GitHub's IP ranges.
3. Check the Algora bounty label format on github (the last item in the "Not verified" table).
4. Then Phase 1 of the roadmap.

## Session 2 status (28 Sept 2026)

**Done**
- Telegram bot **"Signal Radar"** created. `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` added as repo secrets. The token was verified with `getUpdates`. Sending a message has **not** been tested yet, because a dry run never notifies.
- First Action run: **Daily radar** (`workflow_dispatch`, dry run, run id 36421082377) finished green in about 35 s. Results:

| Source | Result | Diagnosis |
|---|---|---|
| hackernews | ✅ 42 items | Works. |
| github | ✅ 40 items | Works (new repos, feature requests). Bounty label format still unchecked. |
| stackexchange | ⚠️ 0 items, finished in 0.3 s | Possibly genuine (26 h window on softwarerecs, plus the phrase filter), but confirm with a real response. |
| appstore | ❌ 0 items: "no entries for Jobber Field Service" in both gb and us | The empty-feed problem predicted below. The iTunes customer-reviews RSS may be dead or changed; needs a real response. |
| findatender | ❌ 0 items, finished in about 2 s (one page) | Most likely the CPV code location or the `stages`/pagination guess is wrong, so every release gets filtered out. |
| bluesky | ⏭️ skipped | No credentials, as expected. |

**Scoring problem found:** every Hacker News demand item scored exactly **50**. The reason: 25 (phrase) + 10 (money word "pay") + 15 (explicit WTP phrase) + 0 engagement, because Algolia comments have `points: null`. The digest filled up with generic chat like "I would pay for that Star Trek computer". Fixes to make:
1. Get the owner to add `ANTHROPIC_API_KEY`: Claude review is what separates real pain from chat.
2. Tighten the heuristic: stop generic "willing to pay" comments reaching the top on their own (for example, require a tool/problem phrase as well, or down-weight comments that have no engagement data).

**Why session 2 stopped:** the cloud environment's network policy blocked every source host (CONNECT 403 from the egress proxy), so collectors couldn't be live-tested from Claude Code. The owner has switched the environment's Network access to **Custom**, with `itunes.apple.com`, `www.find-tender.service.gov.uk`, `api.stackexchange.com`, `hn.algolia.com` and `api.github.com` allowed. That only takes effect in **new** sessions. If a request still gets a 403, check the proxy status and whether Node's `fetch` honours `HTTPS_PROXY` (try `NODE_USE_ENV_PROXY=1`); curl should work first.

**Next steps for session 3, in order** (all done except item 4; see above)
1. `curl` one real response from Find a Tender and one from the App Store feed. Fix `findatender.ts` and `appstore.ts`, and update their fixtures to the real shapes (keeping the fake content).
2. Check stackexchange with a wider window (for example, temporarily set `lookbackHours` to 168).
3. Fix the flat-50 scoring (above) and add a test for it.
4. Walk the owner through adding `ANTHROPIC_API_KEY` (console.anthropic.com → API keys → repo secret), then a **non**-dry run, to confirm the Telegram message arrives.

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

Status as of session 2:

- [x] Telegram bot created; `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` added as repo secrets (sending not yet confirmed)
- [ ] `ANTHROPIC_API_KEY` secret (optional, recommended, ~£1–5/month)
- [ ] Optional: `STACKEXCHANGE_KEY`, `BLUESKY_HANDLE` + `BLUESKY_APP_PASSWORD`
- [ ] Repo set to **private** (it will fill with market research)
- [x] First manual run: Actions → Daily radar → Run workflow → tick *dry run* (green; see Latest status)
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
