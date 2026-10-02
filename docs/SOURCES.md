# Sources: what's open, what's closed (September 2026)

This comes from the research done while building the radar. Platform rules change often, so re-check anything before building a *product* on it. "Unverified" means it wasn't re-confirmed against 2026 sources.

## In the radar now

| Source | Access | Limits | Why it's here |
|---|---|---|---|
| **Hacker News** (Algolia) | `hn.algolia.com/api/v1/search_by_date`, no key | 10,000 requests/hour per IP | Ask HN posts and comments full of "is there a tool"; Show HN shows what's being built. [Docs](https://hn.algolia.com/api) |
| **GitHub Search** | REST, `GITHUB_TOKEN` | Search: 30 requests/min authenticated; 1,000 results per query | Upvoted feature requests = many people wanting the same thing. New repos by topic = what's being built. [Rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) |
| **GitHub bounties** (Algora's 💎 label) | GitHub issue search | as above | Money attached to work. **Weak demand signal**: a 2026 census found 99% of open Algora bounty money sat in 3 repos ([bounty-census](https://github.com/AsherKasper/bounty-census)). Kept, low priority. |
| **Stack Exchange** | `api.stackexchange.com/2.3`, optional free key | ~300/day without a key, ~10,000/day with one (third-party docs); throttling returns HTTP 400 `throttle_violation` and a `backoff` field that must be obeyed | Software Recommendations is literally "please recommend software for X". |
| **Apple App Store reviews** | `itunes.apple.com/{cc}/rss/customerreviews/page=1/id={id}/sortby=mostrecent/json`, no key | ~50 per page, 10 pages per country | 1–2★ reviews of paid apps = paying customers listing what's broken. Verified live Sept 2026. The feed occasionally returns empty; the collector retries once, then logs it. Looks back 7 days (`lookbackHours: 168`) because one app gets a bad review every few days. [Format](https://dev.to/antonio_fernandorincond/how-to-pull-app-store-reviews-via-apples-official-rss-feed-no-api-key-1hkk) |
| **UK Find a Tender** | OCDS API, no key, Open Government Licence | `limit` ≤ 100, next page in `links.next`; 429/503 include Retry-After | UK public bodies buying software, with budgets. Verified live Sept 2026: `stages=tender` drops most tenders, so we fetch all releases (~300–400/day) and keep `tender` + `planning` tags whose main CPV starts 48/72. [API docs](https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages) |
| **Bluesky** | `app.bsky.feed.searchPosts` **with login** (app password) | Login ~30 per 5 min, so once per run | Since mid-2026 search returns 403 without auth ([issue](https://github.com/cyanheads/bluesky-mcp-server/issues/32)). Indie/dev-heavy crowd. |

## Reddit

**Status:** effectively closed to new small builders.

- **Nov 2025:** self-service API keys ended. Reddit's [Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy) requires "explicit approval before accessing any Reddit data through our API", and commercial use needs written approval. Approvals for small/commercial projects are reported as rare.
- **Late May 2026:** unauthenticated `.json` endpoints started returning 403 ([FetchLayer](https://fetchlayer.dev/blog/reddit-api-closed-2026), [DEV](https://dev.to/listwright/reddits-json-returns-403-in-2026-the-rss-feeds-still-answer-1gg5)). One vendor says they're "rate-limited, not gone"; treat as dead.
- **RSS** (`/r/{sub}/new.rss`) still answered as of 20 Sept 2026 but throttles after ~5 quick requests, isn't an approved access route, and is reportedly next in line to close.
- **This is why GummySearch shut down** (Nov 2025): it couldn't get a commercial Reddit licence ([their post](https://gummysearch.com/final-chapter/)).

**What the radar does:** a Reddit RSS collector exists but is **off**. If you switch it on (`sources.reddit.enabled` in the config): use it for your own research only, keep it to a handful of subreddits, leave the 20-second delay, and never resell or republish the data. For Reddit alerts in the meantime, [F5Bot](https://f5bot.com) is free and emails you keyword mentions.

**Never** use third-party "Reddit API" proxy services for anything you sell: they resell data Reddit hasn't licensed.

## Next to add (open, free)

| Source | Notes |
|---|---|
| **UK Contracts Finder** | OCDS API; below-threshold English tenders, and awards show who already sells to whom. [Docs](https://www.contractsfinder.service.gov.uk/apidocumentation) |
| **WordPress.org plugin support forums / reviews** | Repeated, specific pain from small-business site owners. Feed URLs need testing first. |
| **Hand-picked Discourse forums** | Most expose `/latest.json` and `/search.json`. Check each forum's terms. |
| **Companies House** | Free key, 600 requests / 5 min. Not for signals: for **sizing a niche** (how many active companies by SIC code, new ones per month). [Guidelines](https://developer.company-information.service.gov.uk/developer-guidelines) |
| Lobsters, Dev.to, Lemmy, Mastodon hashtags | Cheap to add, lower volume (unverified). |
| YouTube comments | Data API, 10,000 units/day free; tutorial comments are full of "how do I…" (unverified). |

## Gated or paid (maybe later)

| Source | Situation |
|---|---|
| **X / Twitter** | Pay-per-use only since Feb 2026, no free tier: ~$0.005 per post read ([X pricing](https://docs.x.com/x-api/getting-started/pricing)). Affordable with a hard monthly cap for a few high-intent searches. |
| **Product Hunt** | API is free but **non-commercial by default** ([docs](https://api.producthunt.com/v2/docs)). Fine for personal tracking. |
| **Upwork** | RSS feeds removed Aug 2024 ([Upwork](https://support.upwork.com/hc/en-us/articles/52052528243731-RSS-deprecation)). The official API needs an approved key. Never scrape. |
| Freelancer.com | Has a public developer API with project search (unverified). |

## Avoid

G2 / Capterra / Trustpilot (terms prohibit scraping; mine them **by hand**, since 2–3★ reviews are gold), Facebook groups, LinkedIn, Quora, Fiverr, Discord/Slack servers you don't run, Google Play review scrapers, and any unlicensed Reddit data.

## UK-specific ideas

Regulatory deadlines create **forced demand**, the best kind for a small SaaS. Worth seeding niches and searches with: Making Tax Digital for Income Tax (sole traders and landlords, phasing in from April 2026), Procurement Act 2023 supplier registration, landlord/letting compliance, care-sector (CQC) admin, and small-firm payroll/pensions. (These themes are a starting hypothesis, not verified demand. Let the radar confirm or kill them.)

UK forums to **read by hand** first: UKBusinessForums, AccountingWEB "Any Answers", MoneySavingExpert, Mumsnet business boards.

## Competitors (and the gap)

After GummySearch closed, most replacements are **Reddit-only** and focused on **replying to leads for a product you already have**: F5Bot (free, keyword emails), Syften (~$20–100/mo, multi-source keywords), RedShip, Prowlo, RedNudge, SubredditSignals, Linkeddit, Octolens (dev brands), GigRadar (Upwork, for agencies). Most won't say how they get Reddit data, which is itself a warning about their platform risk. Prices come mostly from competitors' own comparison blogs, so treat them as rough.

**What almost nobody does:**

1. Demand discovery that **doesn't depend on Reddit** (app reviews, feature requests, Software Recommendations, tenders).
2. **Repeated pain over time**: "this complaint appeared 37 times from 5 sources in 90 days and it's rising", instead of single-post alerts.
3. Help deciding **what to build**, for founders who don't have a product yet.
4. A **UK / regulatory-deadline** angle.

That gap is what this radar does for you, and it could become the SaaS itself if your own use proves it works. See [ROADMAP.md](ROADMAP.md).
