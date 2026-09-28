# 📡 Signal Radar

**Finds people who have a problem worth building for, and tells you every morning.**

Every day it scans public sources for people saying things like *"is there a tool that…"*, *"I'd pay for…"* or *"I spend hours every week on…"*. It also looks at bad reviews of paid apps, UK public-sector tenders for software, paid GitHub bounties, and new projects people are launching. It scores each find, can have Claude read the best ones, and spots **the same problem coming up from different people**, which is the strongest sign there's a business in it. Then it sends a short digest to your phone.

It runs free on GitHub Actions, has **zero runtime dependencies**, and keeps its history as plain files in this repo.

```
📡 Signal Radar 2026-09-28: 1 repeated, 8 asks, 1 tenders, 1 bounties, 2 launches

🔥 Chasing late invoices automatically (6 people)
https://news.ycombinator.com/item?id=...

💬 Freelancers want invoice follow-ups that escalate [80]
https://news.ycombinator.com/item?id=...
```
<sub>(Example with Claude review switched on. Run `npm run demo` to see a full digest built from the included sample data.)</sub>

---

## What it watches

| Source | What it finds | Needs |
|---|---|---|
| **Hacker News** | "Is there a tool…" / "I'd pay…" in posts *and comments*, plus Show HN launches | nothing |
| **GitHub** | New repos taking off (Claude Code, MCP, SaaS, agents), paid 💎 bounties, heavily upvoted feature requests | nothing (Actions supplies a token) |
| **Stack Exchange** | Every new question on *Software Recommendations*; pain-phrase questions on Web Apps and Super User | optional free key |
| **Apple App Store** | 1–2★ reviews of paid apps you choose: unhappy customers explaining what's missing | nothing |
| **UK Find a Tender** | Public bodies buying software and IT services, with the budget attached | nothing |
| **Bluesky** | Pain phrases in posts | free app password |
| **Reddit** | Pain phrases in a few subreddits, via RSS. **Off by default, personal use only.** [Why](docs/SOURCES.md#reddit) | nothing |

The full source audit (what's open, what's closed, and why) is in [docs/SOURCES.md](docs/SOURCES.md).

---

## Setup (about 10 minutes)

### 1. Get notifications on your phone (Telegram, recommended)

1. In Telegram, message **@BotFather** → send `/newbot` → pick any name → copy the **bot token** it gives you.
2. Send any message (e.g. "hi") to your new bot.
3. Open `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser and copy the number after `"chat":{"id":`. That's your **chat ID**.

<details><summary>Prefer Discord or ntfy?</summary>

- **Discord:** Server settings → Integrations → Webhooks → New webhook → copy URL → secret `DISCORD_WEBHOOK_URL`.
- **ntfy:** install the ntfy app, subscribe to a hard-to-guess topic name → secret `NTFY_TOPIC`. ⚠️ The free public ntfy.sh server limits messages per IP address, and GitHub's servers share IPs, so free ntfy can silently drop your digest. Use a paid ntfy plan or your own server (`NTFY_SERVER`) if you go this way.
</details>

### 2. Add your secrets to GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Required? | Where to get it |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | yes (or another channel) | step 1 |
| `TELEGRAM_CHAT_ID` | yes (or another channel) | step 1 |
| `ANTHROPIC_API_KEY` | recommended | [console.anthropic.com](https://console.anthropic.com). Lets Claude judge each post (≈ £1–5/month) |
| `STACKEXCHANGE_KEY` | optional | [stackapps.com/apps/oauth/register](https://stackapps.com/apps/oauth/register): raises quota from 300 to 10,000/day |
| `BLUESKY_HANDLE` + `BLUESKY_APP_PASSWORD` | optional | bsky.app → Settings → Privacy and security → App passwords |

### 3. Run it

**Actions** tab → **Daily radar** → **Run workflow**. Tick *dry run* the first time to see the digest in the log without saving anything. After that it runs by itself every morning at about **07:40 UK time**.

### 4. Tune it

Everything it listens for is in **[`config/radar.config.ts`](config/radar.config.ts)**: pain phrases, which apps' reviews to read, GitHub topics, tender categories, and **niches**. After a week or two of digests, add the industries that keep appearing as niches and the radar will boost them.

---

## Run it locally

Needs Node 22.18+ (runs TypeScript directly, no build step).

```bash
npm run demo          # offline sample data, prints the digest, touches nothing
npm test              # 29 tests, all offline
cp .env.example .env  # fill in keys, then:
node src/index.ts run --dry-run            # real sources, print only
node src/index.ts run --sources hackernews  # just one source
node src/index.ts test-notify               # check your phone gets a message
```

---

## How it works

```
collect (7 sources) → dedupe → score → Claude review (top 40) → store → find repeated pain → digest → notify
```

Details, design decisions and costs are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). What to do with what it finds is in [docs/PLAYBOOK.md](docs/PLAYBOOK.md), and what's next is in [docs/ROADMAP.md](docs/ROADMAP.md).

## Data & privacy

Results are committed to `data/` (a daily digest in `data/digests/`, raw scored signals in `data/signals/`). Usernames are **not** stored: each author is replaced with a one-way hash, which is just enough to count how many *different* people share a problem. Keep this repo **private**, since it will fill up with your market research.
