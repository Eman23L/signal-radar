import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appStore } from '../src/collectors/appstore.ts';
import { bluesky } from '../src/collectors/bluesky.ts';
import { contractsFinder } from '../src/collectors/contractsfinder.ts';
import { discourse } from '../src/collectors/discourse.ts';
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

test('appstore reads only the storefronts an app lists', async () => {
  const urls: string[] = [];
  const c = ctx();
  const cfg = { ...config, sources: { ...config.sources, appstore: { ...config.sources.appstore, apps: [{ id: '441880705', name: 'Xero', countries: ['gb'] }] } } };
  await appStore(cfg).collect({ ...c, fetch: (url, init) => (urls.push(url), c.fetch(url, init)) });
  assert.ok(urls.length > 0 && urls.every((u) => u.includes('/gb/')));
});

test('findatender keeps new tenders and planning notices with an IT main CPV, and follows links.next', async () => {
  const urls: string[] = [];
  const c = ctx();
  const fetch = c.fetch;
  const out = await findATender(config).collect({ ...c, fetch: (url, init) => (urls.push(url), fetch(url, init)) });
  // Dropped: catering (CPV 15), award notice, tender update, equipment framework whose only IT codes are item-level.
  assert.deepEqual(out.map((s) => s.id).sort(), ['findatender:ocds-h6vhtk-0sample1', 'findatender:ocds-h6vhtk-0sample3']);
  assert.equal(urls.length, 2, 'fetched the page behind links.next');
  assert.ok(!urls[0].includes('stages='), 'the stages filter drops most tenders, so we filter on tags');
  const tender = out.find((s) => s.id.endsWith('sample1'))!;
  assert.equal(tender.url, 'https://www.find-tender.service.gov.uk/Notice/099991-2026');
  assert.deepEqual(tender.money, { amount: 180000, currency: 'GBP' });
  const planning = out.find((s) => s.id.endsWith('sample3'))!;
  assert.match(planning.title, /^\[early engagement\]/);
  assert.deepEqual(planning.money, { amount: 600000, currency: 'GBP' }, 'falls back to amountGross');
});

test('contractsfinder keeps IT tenders and planning notices, skips amendments and other CPVs', async () => {
  const out = await contractsFinder(config).collect(ctx());
  assert.deepEqual(out.map((s) => s.id).sort(), ['contractsfinder:ocds-b5fd17-sample-1', 'contractsfinder:ocds-b5fd17-sample-4']);
  const t = out.find((s) => s.id.endsWith('sample-1'))!;
  assert.equal(t.url, 'https://www.contractsfinder.service.gov.uk/notice/00000001-aaaa-bbbb-cccc-sample000001');
  assert.deepEqual(t.money, { amount: 50000, currency: 'GBP' });
  assert.match(out.find((s) => s.id.endsWith('sample-4'))!.title, /^\[early engagement\]/);
});

test('discourse keeps new, unpinned topics that ask for something, with author and engagement', async () => {
  const cfg = { ...config, sources: { ...config.sources, discourse: { ...config.sources.discourse, forums: [{ host: 'forum.sample.test', name: 'Sample' }] } } };
  const out = await discourse(cfg).collect(ctx());
  assert.equal(out.length, 1, 'challenge post has no ask; pinned and old topics skipped');
  const s = out[0];
  assert.equal(s.url, 'https://forum.sample.test/t/invoice-reminders/900001');
  assert.equal(s.author, 'sample_user_31');
  assert.deepEqual(s.engagement, { comments: 3, score: 3, views: 80 });
  assert.match(s.body, /chasing unpaid invoices/);
  assert.ok(s.tags.includes('prequalified'));
});

test('reddit RSS keeps only pain-phrase posts', async () => {
  const cfg = { ...config, sources: { ...config.sources, reddit: { ...config.sources.reddit, subreddits: ['smallbusiness'] } } };
  const out = await reddit(cfg).collect(ctx());
  assert.equal(out.length, 1);
  assert.equal(out[0].author, 'sample_user_12');
});
