import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { configuredNotifiers } from '../src/notify/index.ts';
import { hashAuthor, runRadar } from '../src/run.ts';
import { JsonStore } from '../src/store/jsonStore.ts';
import { config, ctx, tempDir } from './helpers.ts';

function options(dir: string, extra: object = {}) {
  const { since: _since, ...c } = ctx();
  return { config, ctx: c, store: new JsonStore(dir), notifiers: [], ...extra };
}

test('end-to-end: stores signals, writes a digest, finds the repeated pain, dedupes next run', async () => {
  const dir = await tempDir();
  const sent: string[] = [];
  const first = await runRadar(
    options(dir, { notifiers: [{ name: 'spy', send: async (_t: string, text: string) => void sent.push(text) }] }),
  );

  assert.ok(first.digest.demand.length > 0);
  assert.ok(first.digest.patterns.length >= 1, 'invoice-chasing posts form a pattern');
  assert.equal(sent.length, 1);
  assert.match(sent[0], /Signal Radar 2026-09-28/);

  const latest = await readFile(join(dir, 'latest.md'), 'utf8');
  assert.match(latest, /Repeated pain/);
  const stored = JSON.parse(await readFile(join(dir, 'signals', '2026-09-28.json'), 'utf8'));
  assert.ok(stored.every((s: { author?: string }) => !s.author || /^[0-9a-f]{12}$/.test(s.author)), 'usernames are hashed');

  const second = await runRadar(options(dir));
  assert.equal(second.newSignals.length, 0, 'everything already seen');
});

test('a failing source is reported, not fatal', async () => {
  const dir = await tempDir();
  const { since: _since, ...c } = ctx();
  const broken = async (url: string, init?: RequestInit) => {
    if (url.includes('stackexchange')) throw new Error('boom');
    return c.fetch(url, init);
  };
  const res = await runRadar({ ...options(dir), ctx: { ...c, fetch: broken }, dryRun: true });
  const se = res.digest.report.find((r) => r.source === 'stackexchange');
  assert.equal(se?.status, 'error');
  assert.ok(res.digest.demand.length > 0);
});

test('dry run writes nothing', async () => {
  const dir = await tempDir();
  await runRadar({ ...options(dir), dryRun: true });
  await assert.rejects(readFile(join(dir, 'latest.md'), 'utf8'));
});

test('push text stays under Discord limit', async () => {
  const dir = await tempDir();
  const res = await runRadar({ ...options(dir), dryRun: true });
  assert.ok(res.push.length <= 2000);
});

test('hashAuthor is stable and anonymous', () => {
  assert.equal(hashAuthor('hn', 'Alice'), hashAuthor('hn', 'alice'));
  assert.notEqual(hashAuthor('hn', 'alice'), hashAuthor('reddit', 'alice'));
  assert.equal(hashAuthor('hn', undefined), undefined);
});

test('notifiers are created only for configured channels', () => {
  assert.equal(configuredNotifiers({}).length, 0);
  const n = configuredNotifiers({ TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: 'c', DISCORD_WEBHOOK_URL: 'https://d' });
  assert.deepEqual(n.map((x) => x.name), ['telegram', 'discord']);
});
