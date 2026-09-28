/**
 * Apple App Store customer-review RSS (public, no key):
 *   https://itunes.apple.com/{cc}/rss/customerreviews/page=1/id={appId}/sortby=mostrecent/json
 * Returns the ~50 most recent reviews per page (max 10 pages per country).
 * We keep only low-star reviews: paying customers explaining exactly what's broken.
 *
 * Quirks: `feed.entry` can be a single object instead of an array, and the first
 * entry is occasionally app metadata (no rating) — both handled. Some reports say
 * the feed occasionally returns an empty envelope; the run report flags apps with
 * zero entries so you notice.
 */
import type { RadarConfig } from '../config.ts';
import type { Collector, Signal } from '../types.ts';
import { truncate } from '../util/text.ts';

type Label = { label?: string };
interface Entry {
  id?: Label;
  title?: Label;
  content?: Label;
  author?: { name?: Label };
  updated?: Label;
  'im:rating'?: Label;
  'im:version'?: Label;
  'im:voteSum'?: Label;
}

export function appStore(config: RadarConfig): Collector {
  const opts = config.sources.appstore;
  return {
    name: 'appstore',
    unavailable() {
      if (opts.apps.length === 0) return 'no apps listed in config';
    },
    async collect(ctx) {
      const out: Signal[] = [];
      for (const app of opts.apps) {
        for (const cc of opts.countries) {
          const url = `https://itunes.apple.com/${cc}/rss/customerreviews/page=1/id=${app.id}/sortby=mostrecent/json`;
          const res = (await ctx.fetch(url)) as { feed?: { entry?: Entry | Entry[] } };
          const raw = res.feed?.entry;
          const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
          if (entries.length === 0) ctx.log(`appstore: no entries for ${app.name} (${cc}) — feed may be empty`);
          for (const e of entries) {
            const rating = Number(e['im:rating']?.label);
            const id = e.id?.label;
            if (!rating || !id) continue; // metadata entry
            if (rating > opts.maxRating) continue;
            const updated = e.updated?.label ? new Date(e.updated.label) : ctx.now;
            if (updated < ctx.since) continue;
            out.push({
              id: `appstore:${id}`,
              source: 'appstore',
              kind: 'demand',
              title: `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} ${app.name}: ${e.title?.label ?? ''}`,
              body: truncate(e.content?.label ?? '', 1500),
              url: `https://apps.apple.com/${cc}/app/id${app.id}?see-all=reviews`,
              author: e.author?.name?.label,
              createdAt: updated.toISOString(),
              engagement: { score: Number(e['im:voteSum']?.label ?? 0) || undefined },
              tags: [app.name, cc, `rating:${rating}`],
            });
          }
          await ctx.delay(1000);
        }
      }
      // The same review can appear in more than one storefront.
      return [...new Map(out.map((s) => [s.id, s])).values()];
    },
  };
}
