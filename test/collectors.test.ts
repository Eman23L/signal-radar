import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appStore } from '../src/collectors/appstore.ts';
import { bluesky } from '../src/collectors/bluesky.ts';
import { findATender } from '../src/collectors/findatender.ts';
import { github } from '../src/collectors/github.ts';
import { hackerNews } from '../src/collectors/hackernews.ts';
import { reddit } from '../src/collectors/reddit.ts';
import { stackExchange } from '../src/collectors/stackexchange.ts';
import { config, ctx } from './helpers.ts';

test('hackernews keeps only hits that really contain a pain phrase, plus Show HN', async () => {
  const out = await hackerNews(config).collect(ctx());
  const ids = out.map((s) => s.id);
  assert.ok(ids.includes('hackernews:90000002'));
  assert.ok(ids.includes('hackernews:90000101'));
  assert.equal(out.find((s) => s.id === 'hackernews:90000101')?.kind, 'launch');
  const comment = out.find((s) => s.id === 'hackernews:90000001')!;
  assert.match(comment.title, /^Comment on:/);
  assert.equal(new Set(ids).size, ids.length, 'no duplicates across phrases');
});

test('github: repos, bounties above the minimum, feature requests', async () => {
  const out = await github(config).collect(ctx());
  const bounty = out.filter((s) => s.kind === 'bounty');
  assert.equal(bounty.length, 1, '$10 bounty is below minAmountUsd');
  assert.deepEqual(bounty[0].money, { amount: 250, currency: 'USD' });
  assert.ok(out.some((s) => s.kind === 'tool' && s.engagement.stars === 480));
  assert.ok(out.some((s) => s.kind === 'demand' && s.title.includes('recurring invoice reminders')));
});

test('github sends the token when present', async () => {
  let auth: string | undefined;
  const spy = async (_url: string, init?: RequestInit) => {
    auth = (init?.headers as Record<string, string>).Authorization;
    return { items: [] };
  };
  await github(config).collect(ctx({ fetch: spy, env: { GITHUB_TOKEN: 'abc' } }));
  assert.equal(auth, 'Bearer abc');
});

test('stackexchange treats every softwarerecs question as demand', async () => {
  const out = await stackExchange(config).collect(ctx());
  assert.equal(out.length, 2);
  assert.ok(out.every((s) => s.kind === 'demand' && s.tags.includes('softwarerecs')));
});

test('bluesky is skipped without credentials and builds bsky.app links', async () => {
  const c = bluesky(config);
  assert.ok(c.unavailable?.(ctx({ env: {} })));
  const out = await c.collect(ctx());
  assert.equal(out[0].url, 'https://bsky.app/profile/sample9.bsky.social/post/3sample1');
});

test('appstore keeps low-star reviews and skips the metadata entry', async () => {
  const out = await appStore(config).collect(ctx());
  assert.equal(out.length, 1);
  assert.ok(out[0].tags.includes('rating:2'));
});

test('findatender filters by CPV prefix and links to the notice', async () => {
  const out = await findATender(config).collect(ctx());
  assert.equal(out.length, 1, 'catering tender (CPV 15) is filtered out');
  assert.equal(out[0].url, 'https://www.find-tender.service.gov.uk/Notice/099999-2026');
  assert.deepEqual(out[0].money, { amount: 180000, currency: 'GBP' });
});

test('reddit RSS keeps only pain-phrase posts', async () => {
  const cfg = { ...config, sources: { ...config.sources, reddit: { ...config.sources.reddit, subreddits: ['smallbusiness'] } } };
  const out = await reddit(cfg).collect(ctx());
  assert.equal(out.length, 1);
  assert.equal(out[0].author, 'sample_user_12');
});
