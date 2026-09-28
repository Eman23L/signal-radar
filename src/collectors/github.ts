/**
 * GitHub Search API (REST). Docs: https://docs.github.com/en/rest/search/search
 * Search is limited to 30 requests/min with a token, so requests are paced.
 *
 * Three feeds:
 *  - new repos gaining stars in chosen topics   → 'launch' / 'tool'
 *  - open issues with money on them (bounties)   → 'bounty'
 *  - heavily-upvoted feature requests            → 'demand'
 */
import type { RadarConfig } from '../config.ts';
import type { Collector, CollectorContext, Signal } from '../types.ts';
import { isoDay, parseMoney, stripHtml, truncate } from '../util/text.ts';

const API = 'https://api.github.com';
const PACE_MS = 2500;

interface Repo {
  id: number;
  full_name: string;
  description: string | null;
  html_url: string;
  owner?: { login: string };
  created_at: string;
  stargazers_count: number;
  topics?: string[];
  language?: string | null;
}

interface Issue {
  id: number;
  title: string;
  body: string | null;
  html_url: string;
  user?: { login: string };
  created_at: string;
  comments: number;
  reactions?: { total_count: number };
  labels: ({ name: string } | string)[];
  repository_url: string;
}

interface SearchResponse<T> {
  items: T[];
}

export function github(config: RadarConfig): Collector {
  const opts = config.sources.github;
  return {
    name: 'github',
    async collect(ctx) {
      const out: Signal[] = [];
      const get = async <T>(path: string) => {
        const res = (await ctx.fetch(`${API}${path}`, { headers: headers(ctx) })) as SearchResponse<T>;
        await ctx.delay(PACE_MS);
        return res.items ?? [];
      };

      for (const t of opts.newRepos) {
        const since = isoDay(new Date(ctx.now.getTime() - t.createdWithinDays * 86_400_000));
        const q = `topic:${t.topic} created:>${since} stars:>=${t.minStars}`;
        const repos = await get<Repo>(`/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=15`);
        for (const r of repos) out.push(repoSignal(r, t.kind, t.topic));
      }

      const since = ctx.since.toISOString().slice(0, 19) + 'Z';

      if (opts.bounties.enabled) {
        for (const label of opts.bounties.labels) {
          const q = `label:"${label}" state:open is:issue created:>${since}`;
          const issues = await get<Issue>(`/search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=50`);
          for (const i of issues) {
            const s = issueSignal(i, 'bounty');
            s.money = parseMoney([i.title, ...labelNames(i)].join(' '));
            const usd = s.money?.currency === 'USD' ? s.money.amount : (s.money?.amount ?? 0);
            if (usd >= opts.bounties.minAmountUsd) out.push(s);
          }
        }
      }

      if (opts.featureRequests.enabled) {
        for (const query of opts.featureRequests.queries) {
          const q = `${query} is:issue created:>${since}`;
          const issues = await get<Issue>(`/search/issues?q=${encodeURIComponent(q)}&sort=reactions&order=desc&per_page=30`);
          for (const i of issues) out.push(issueSignal(i, 'demand'));
        }
      }

      // The same repo/issue can match several queries: keep the first (config order = priority).
      const unique = new Map<string, Signal>();
      for (const s of out) if (!unique.has(s.id)) unique.set(s.id, s);
      return [...unique.values()];
    },
  };
}

function headers(ctx: CollectorContext): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (ctx.env.GITHUB_TOKEN) h.Authorization = `Bearer ${ctx.env.GITHUB_TOKEN}`;
  return h;
}

function labelNames(i: Issue): string[] {
  return i.labels.map((l) => (typeof l === 'string' ? l : l.name));
}

function repoSignal(r: Repo, kind: Signal['kind'], topic: string): Signal {
  return {
    id: `github:repo:${r.id}`,
    source: 'github',
    kind,
    title: `${r.full_name} — ${r.stargazers_count}★`,
    body: truncate(r.description ?? '', 500),
    url: r.html_url,
    author: r.owner?.login,
    createdAt: r.created_at,
    engagement: { stars: r.stargazers_count },
    tags: [topic, ...(r.language ? [r.language] : [])],
  };
}

function issueSignal(i: Issue, kind: Signal['kind']): Signal {
  const repo = i.repository_url.replace(`${API}/repos/`, '');
  return {
    id: `github:issue:${i.id}`,
    source: 'github',
    kind,
    title: `[${repo}] ${i.title}`,
    body: truncate(stripHtml(i.body), 1500),
    url: i.html_url,
    author: i.user?.login,
    createdAt: i.created_at,
    engagement: { score: i.reactions?.total_count, comments: i.comments },
    tags: labelNames(i),
  };
}
