/**
 * Bluesky post search. Since mid-2026 `app.bsky.feed.searchPosts` refuses
 * unauthenticated calls, so this logs in with an app password (free, made in
 * Settings → Privacy and security → App passwords) and calls search through
 * the account's PDS, which proxies to the Bluesky AppView.
 * Logging in is rate-limited (~30 per 5 min), so we log in once per run.
 */
import type { RadarConfig } from '../config.ts';
import type { Collector, Signal } from '../types.ts';
import { normalize, truncate } from '../util/text.ts';

const PDS = 'https://bsky.social/xrpc';

interface Session {
  accessJwt: string;
}

interface Post {
  uri: string;
  author: { handle: string };
  record: { text?: string; createdAt?: string };
  indexedAt: string;
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
}

export function bluesky(config: RadarConfig): Collector {
  return {
    name: 'bluesky',
    unavailable(ctx) {
      if (!ctx.env.BLUESKY_HANDLE || !ctx.env.BLUESKY_APP_PASSWORD) {
        return 'set BLUESKY_HANDLE and BLUESKY_APP_PASSWORD to enable';
      }
    },
    async collect(ctx) {
      const session = (await ctx.fetch(`${PDS}/com.atproto.server.createSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: ctx.env.BLUESKY_HANDLE, password: ctx.env.BLUESKY_APP_PASSWORD }),
      })) as Session;
      const auth = { Authorization: `Bearer ${session.accessJwt}` };

      const found = new Map<string, Signal>();
      for (const phrase of config.painPhrases) {
        const url =
          `${PDS}/app.bsky.feed.searchPosts?q=${encodeURIComponent(`"${phrase}"`)}` +
          `&sort=latest&since=${encodeURIComponent(ctx.since.toISOString())}&limit=50`;
        const res = (await ctx.fetch(url, { headers: auth })) as { posts?: Post[] };
        for (const p of res.posts ?? []) {
          const text = p.record.text ?? '';
          if (!normalize(text).includes(phrase)) continue;
          const s = toSignal(p);
          found.set(s.id, s);
        }
        await ctx.delay(400);
      }
      return [...found.values()];
    },
  };
}

function toSignal(p: Post): Signal {
  const rkey = p.uri.split('/').pop();
  const text = p.record.text ?? '';
  return {
    id: `bluesky:${p.uri}`,
    source: 'bluesky',
    kind: 'demand',
    title: truncate(text.split('\n')[0], 120),
    body: truncate(text, 1000),
    url: `https://bsky.app/profile/${p.author.handle}/post/${rkey}`,
    author: p.author.handle,
    createdAt: p.record.createdAt ?? p.indexedAt,
    engagement: { score: p.likeCount, comments: p.replyCount },
    tags: [],
  };
}
