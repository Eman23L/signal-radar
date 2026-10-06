/**
 * Public Discourse forums (no key). Many SaaS and no-code tools run their community
 * on Discourse, which serves every page as JSON. Their users post exactly what we
 * want: "is there a way to…", "how can I automate…", feature requests, workarounds.
 *
 * Per forum: one request for the newest topics (`/latest.json?order=created`), then
 * one small request per new topic for its opening post (`/raw/{id}/1`, plain text).
 * Only topics whose title or opening post match a demand phrase are kept, so every
 * item here is pre-qualified demand (scored with the same floor as softwarerecs).
 * Pacing: `delayMs` between requests; forums are read once a day.
 */
import type { RadarConfig } from '../config.ts';
import type { Collector, Signal } from '../types.ts';
import { normalize, truncate } from '../util/text.ts';

const MAX_TOPICS_PER_FORUM = 40;

interface Topic {
  id: number;
  title: string;
  slug: string;
  created_at: string;
  posts_count?: number;
  like_count?: number;
  views?: number;
  pinned?: boolean;
  posters?: { user_id: number; description?: string }[];
}
interface Latest {
  users?: { id: number; username: string }[];
  topic_list?: { topics?: Topic[] };
}

export function discourse(config: RadarConfig): Collector {
  const opts = config.sources.discourse;
  const phrases = [...config.painPhrases, ...opts.extraPhrases].map((p) => p.toLowerCase());
  return {
    name: 'discourse',
    unavailable() {
      if (opts.forums.length === 0) return 'no forums listed in config';
    },
    async collect(ctx) {
      const out: Signal[] = [];
      for (const forum of opts.forums) {
        const base = `https://${forum.host}`;
        const res = (await ctx.fetch(`${base}/latest.json?order=created`)) as Latest;
        const users = new Map((res.users ?? []).map((u) => [u.id, u.username]));
        const fresh = (res.topic_list?.topics ?? [])
          .filter((t) => !t.pinned && new Date(t.created_at) >= ctx.since)
          .slice(0, MAX_TOPICS_PER_FORUM);

        for (const t of fresh) {
          await ctx.delay(opts.delayMs);
          const raw = await ctx.fetchText(`${base}/raw/${t.id}/1`);
          const text = normalize(`${t.title} ${raw}`);
          if (!phrases.some((p) => text.includes(p))) continue;
          const op = t.posters?.find((p) => p.description?.includes('Original Poster')) ?? t.posters?.[0];
          out.push({
            id: `discourse:${forum.host}:${t.id}`,
            source: 'discourse',
            kind: 'demand',
            title: t.title,
            body: truncate(raw.replace(/\s+/g, ' ').trim(), 1500),
            url: `${base}/t/${t.slug}/${t.id}`,
            author: op ? users.get(op.user_id) : undefined,
            createdAt: t.created_at,
            engagement: { comments: Math.max(0, (t.posts_count ?? 1) - 1), score: t.like_count, views: t.views },
            tags: [forum.name, 'prequalified'],
          });
        }
        await ctx.delay(opts.delayMs);
      }
      return out;
    },
  };
}
