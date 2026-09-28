/**
 * Stack Exchange API v2.3. Docs: https://api.stackexchange.com/docs
 * softwarerecs.stackexchange.com is the purest "please recommend software for X" feed there is.
 * Quota: ~300 requests/day without a key, ~10,000 with a free key (STACKEXCHANGE_KEY).
 * Throttling comes back as HTTP 400 `throttle_violation`, and responses may carry a
 * `backoff` field (seconds) that must be honoured.
 */
import type { RadarConfig } from '../config.ts';
import type { Collector, Signal } from '../types.ts';
import { normalize, stripHtml, truncate } from '../util/text.ts';

const API = 'https://api.stackexchange.com/2.3';

interface Question {
  question_id: number;
  title: string;
  body?: string;
  link: string;
  owner?: { display_name?: string };
  creation_date: number;
  score: number;
  answer_count: number;
  view_count: number;
  tags: string[];
}

interface Response {
  items: Question[];
  has_more?: boolean;
  backoff?: number;
  quota_remaining?: number;
}

export function stackExchange(config: RadarConfig): Collector {
  return {
    name: 'stackexchange',
    async collect(ctx) {
      const out: Signal[] = [];
      const from = Math.floor(ctx.since.getTime() / 1000);
      const key = ctx.env.STACKEXCHANGE_KEY ? `&key=${ctx.env.STACKEXCHANGE_KEY}` : '';

      for (const { site, everyQuestion } of config.sources.stackexchange.sites) {
        for (let page = 1; page <= 3; page++) {
          const url =
            `${API}/questions?order=desc&sort=creation&site=${site}&fromdate=${from}` +
            `&filter=withbody&pagesize=100&page=${page}${key}`;
          const res = (await ctx.fetch(url)) as Response;
          for (const q of res.items ?? []) {
            const s = toSignal(q, site);
            if (!everyQuestion) {
              const text = normalize(`${s.title} ${s.body}`);
              if (!config.painPhrases.some((p) => text.includes(p))) continue;
            }
            out.push(s);
          }
          if (res.backoff) await ctx.delay(res.backoff * 1000);
          if (!res.has_more) break;
        }
      }
      return out;
    },
  };
}

function toSignal(q: Question, site: string): Signal {
  return {
    id: `stackexchange:${site}:${q.question_id}`,
    source: 'stackexchange',
    kind: 'demand',
    title: stripHtml(q.title),
    body: truncate(stripHtml(q.body), 1500),
    url: q.link,
    author: q.owner?.display_name ? stripHtml(q.owner.display_name) : undefined,
    createdAt: new Date(q.creation_date * 1000).toISOString(),
    engagement: { score: q.score, comments: q.answer_count, views: q.view_count },
    tags: [site, ...q.tags],
  };
}
