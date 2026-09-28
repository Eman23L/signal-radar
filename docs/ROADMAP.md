# Roadmap

## Where things stand (28 Sept 2026)

**Phase 0: the radar (done, needs its first live run)**
- 7 sources, scoring, optional Claude review, repeated-pain grouping, daily digest, Telegram/Discord/ntfy, daily GitHub schedule, 29 offline tests.
- ⚠️ Not yet run against the live APIs (the build machine couldn't reach them). The first manual run will show which collectors need fixing.

## Decisions for you

1. **Which notification channel?** Telegram recommended (see README).
2. **Claude review on or off?** On costs about £1–5/month and makes the digest much sharper (plain-English problem, who has it, product idea). Off is free.
3. **Which apps' reviews to watch?** The config starts with Xero and Jobber as examples. Swap in paid apps in industries you're curious about.
4. **Keep the repo private?** Recommended: `data/` becomes your market research.
5. **Wide net or a niche?** Start wide for 1–2 weeks, then pick (see [PLAYBOOK.md](PLAYBOOK.md#picking-a-niche)).

## Phase 1: tune (weeks 1–2)

- [ ] First live run, then fix whatever the run report shows as ⚠️
- [ ] Trim pain phrases that bring noise; add phrases from real posts you liked
- [ ] Add 10–20 App Store apps across 3–4 candidate niches
- [ ] **Feedback buttons**: 👍/👎 on each Telegram item, stored in `data/feedback.json` and used to reweight phrases and sources. This is what makes the radar learn *your* taste.
- [ ] **Instant alerts**: anything scoring 85+ gets pushed immediately instead of waiting for the morning
- [ ] Weekly summary (Sunday): the biggest repeated-pain groups and whether they're growing

## Phase 2: more sources and smarter grouping (weeks 3–6)

- [ ] UK Contracts Finder (awards show who's already selling what, at what price)
- [ ] WordPress.org plugin support threads for popular paid plugins
- [ ] 3–5 hand-picked Discourse forums in chosen niches
- [ ] Companies House: size a niche (active companies by SIC code, new ones per month)
- [ ] **Embeddings for grouping** once there are 2–4 weeks of data: embed Claude's one-line problem statements (a free local model, or a hosted embedding API at cents per month; Anthropic doesn't offer an embeddings model) and track how each group grows week to week
- [ ] Message Batches API for Claude (halves the cost; fine for a morning digest)
- [ ] Optional: X (Twitter) with a hard £10/month cap for a few high-intent searches

## Phase 3: the app (only if Phase 1–2 prove useful)

This is the "app with notifications" you described. By this point you'll know exactly what it needs.

- Next.js dashboard (your usual stack) on Vercel, Supabase for storage and login
- Browse, search and filter signals; mark them *interesting / contacted / customer*
- Each repeated-pain group as a page: timeline, sources, example posts, growth
- Radar settings editable in the UI instead of the config file
- The GitHub Action becomes a scheduled job writing to Supabase

## Phase 4: is the radar itself the SaaS?

The research found a real gap (see [SOURCES.md](SOURCES.md#competitors-and-the-gap)): tools after GummySearch are mostly Reddit-only and focused on replying to leads, not on **finding what to build** from **sources that don't depend on Reddit's permission**, and nobody does a **UK / regulatory-deadline** angle.

Test it the same way as any idea: if your own radar finds you customers, other founders will want it. Before building for them, check each source's terms for commercial use (Product Hunt, for example, is non-commercial by default), and get UK GDPR advice before storing anything about the people in posts.
