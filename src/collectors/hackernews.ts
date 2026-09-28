/**
 * Hacker News via the free Algolia search API (no key needed).
 * Docs: https://hn.algolia.com/api
 *
 * - Searches stories AND comments for each pain phrase (a lot of the best
 *   "I'd pay for X" lines are buried in comments).
 * - Optionally pulls "Show HN" launches that are getting traction.
 */
import type { RadarConfig } from '../config.ts';
import type { Collector, Signal } from '../types.ts';
import { normalize, stripHtml, truncate } from '../util/text.ts';

const API = 'https://hn.algolia.com/api/v1/search_by_date';

interface HnHit {
  objectID: string;
  created_at: string;
  created_at_i: number;
  author?: string;
  title?: string | null;
  story_title?: string | null;
  story_text?: string | null;
  comment_text?: string | null;
  url?: string | null;
  points?: number | null;
  num_comments?: number | null;
  story_id?: number | null;
  _tags?: string[];
}

interface HnResponse {
  hits: HnHit[];
}

export function hackerNews(config: RadarConfig): Collector {
  const opts = config.sources.hackernews;
  return {
    name: 'hackernews',
    async collect(ctx) {
      const since = Math.floor(ctx.since.getTime() / 1000);
      const found = new Map<string, Signal>();

      for (const phrase of config.painPhrases) {
        const url =
          `${API}?query=${encodeURIComponent(`"${phrase}"`)}` +
          `&tags=(story,comment)&numericFilters=created_at_i>${since}&hitsPerPage=50`;
        const res = (await ctx.fetch(url)) as HnResponse;
        for (const hit of res.hits ?? []) {
          const signal = toSignal(hit, 'demand');
          // Algolia matches loosely; only keep hits that really contain the phrase.
          if (!normalize(`${signal.title} ${signal.body}`).includes(phrase)) continue;
          found.set(signal.id, signal);
        }
      }

      if (opts.showHnMinPoints > 0) {
        const url =
          `${API}?tags=show_hn&numericFilters=created_at_i>${since},points>=${opts.showHnMinPoints}` +
          `&hitsPerPage=50`;
        const res = (await ctx.fetch(url)) as HnResponse;
        for (const hit of res.hits ?? []) {
          const s = toSignal(hit, 'launch');
          if (!found.has(s.id)) found.set(s.id, s);
        }
      }

      return [...found.values()];
    },
  };
}

function toSignal(hit: HnHit, kind: Signal['kind']): Signal {
  const isComment = hit._tags?.includes('comment') ?? Boolean(hit.comment_text);
  const title = isComment ? `Comment on: ${hit.story_title ?? 'HN thread'}` : (hit.title ?? '(untitled)');
  const body = stripHtml(isComment ? hit.comment_text : hit.story_text);
  return {
    id: `hackernews:${hit.objectID}`,
    source: 'hackernews',
    kind,
    title,
    body: truncate(body, 2000),
    url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
    author: hit.author,
    createdAt: new Date(hit.created_at_i * 1000).toISOString(),
    engagement: { score: hit.points ?? undefined, comments: hit.num_comments ?? undefined },
    tags: isComment ? ['comment'] : (hit._tags ?? []).filter((t) => ['ask_hn', 'show_hn'].includes(t)),
  };
}
