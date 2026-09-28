/**
 * Reddit — PERSONAL USE ONLY, OFF BY DEFAULT.
 *
 * Status (Sept 2026): self-service API keys ended Nov 2025 (Responsible Builder
 * Policy: approval required, commercial use needs written permission), and the
 * unauthenticated .json endpoints return 403 since late May 2026. Public RSS feeds
 * still answer but throttle after a handful of quick requests and are not an
 * approved access path. So: a few subreddits, slow, never resold or redistributed.
 * If Reddit closes RSS, this collector will just start reporting errors — the rest
 * of the radar carries on.
 */
import type { RadarConfig } from '../config.ts';
import type { Collector, Signal } from '../types.ts';
import { parseAtom } from '../util/feed.ts';
import { normalize, truncate } from '../util/text.ts';

export function reddit(config: RadarConfig): Collector {
  const opts = config.sources.reddit;
  return {
    name: 'reddit',
    async collect(ctx) {
      const out: Signal[] = [];
      for (const sub of opts.subreddits) {
        const xml = await ctx.fetchText(`https://www.reddit.com/r/${sub}/new.rss?limit=100`);
        for (const e of parseAtom(xml)) {
          const created = e.updated ? new Date(e.updated) : ctx.now;
          if (created < ctx.since) continue;
          const text = normalize(`${e.title} ${e.content}`);
          if (!config.painPhrases.some((p) => text.includes(p))) continue;
          out.push({
            id: `reddit:${e.id}`,
            source: 'reddit',
            kind: 'demand',
            title: e.title,
            body: truncate(e.content, 1500),
            url: e.link ?? `https://www.reddit.com/r/${sub}/`,
            author: e.author?.replace(/^\/u\//, ''),
            createdAt: created.toISOString(),
            engagement: {},
            tags: [`r/${sub}`],
          });
        }
        await ctx.delay(opts.delaySeconds * 1000);
      }
      return out;
    },
  };
}
