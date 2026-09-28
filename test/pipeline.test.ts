import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifySignals, parseJsonArray } from '../src/pipeline/classify.ts';
import { clusterSignals } from '../src/pipeline/cluster.ts';
import { finalScore, scoreSignal } from '../src/pipeline/score.ts';
import { config, signal } from './helpers.ts';

test('explicit willingness to pay outranks a plain question', () => {
  const plain = scoreSignal(signal({ id: 'a', title: 'Is there a tool for tracking mileage?' }), config);
  const paying = scoreSignal(signal({ id: 'b', title: "Is there a tool for tracking mileage? I'd pay for it" }), config);
  assert.ok(paying.painScore! > plain.painScore!);
  assert.deepEqual(plain.matchedPhrases, ['is there a tool']);
});

test('a bare "I would pay" with no problem or engagement stays below the digest cut-off', () => {
  const chat = scoreSignal(signal({ id: 'a', title: 'Comment on: Star Trek computers', body: 'I would pay for that Star Trek computer' }), config);
  assert.ok(chat.painScore! < config.scoring.minScore, `scored ${chat.painScore}`);
  const real = scoreSignal(signal({ id: 'b', title: 'Is there a tool to chase late invoices? I would pay for it' }), config);
  assert.ok(real.painScore! >= chat.painScore! + 20, `real ${real.painScore} vs chat ${chat.painScore}`);
});

test('a lone frustration phrase with no engagement data is cut; the same with engagement is kept', () => {
  const body = 'Building a fab is far too expensive for Europe';
  const bare = scoreSignal(signal({ id: 'a', title: 'Comment on: chips', body }), config);
  const engaged = scoreSignal(signal({ id: 'b', title: 'Ask HN: chips', body, engagement: { score: 3, comments: 1 } }), config);
  assert.ok(bare.painScore! < config.scoring.minScore, `bare scored ${bare.painScore}`);
  assert.ok(engaged.painScore! >= config.scoring.minScore, `engaged scored ${engaged.painScore}`);
});

test('excluded phrases zero the score', () => {
  const s = scoreSignal(signal({ id: 'a', title: 'Is there a tool? Use promo code X' }), config);
  assert.equal(s.painScore, 0);
});

test('money words match whole words only ("paypal" is not "pay")', () => {
  const a = scoreSignal(signal({ id: 'a', title: 'is there a tool for paypal exports' }), config);
  const b = scoreSignal(signal({ id: 'b', title: 'is there a tool for exports, happy to pay' }), config);
  assert.ok(b.painScore! > a.painScore!);
});

test('niche keywords tag and boost', () => {
  const cfg = { ...config, niches: [{ name: 'Trades', keywords: ['plumber'] }] };
  const s = scoreSignal(signal({ id: 'a', title: 'is there a tool for a plumber' }), cfg);
  assert.ok(s.tags.includes('niche:Trades'));
});

test('finalScore demotes posts Claude says are not real pain', () => {
  const base = scoreSignal(signal({ id: 'a', title: "is there a tool, I'd pay" }), config);
  const ai = { problem: '', who: '', willingnessToPay: 'none' as const, niche: '', productIdea: '', intentScore: 80 };
  assert.ok(finalScore({ ...base, ai: { ...ai, isRealPain: false } }) < base.painScore!);
  assert.ok(finalScore({ ...base, ai: { ...ai, isRealPain: true } }) > 50);
});

test('clustering groups the same problem from different people', () => {
  const texts = [
    'Is there a tool to chase late invoices automatically?',
    'I spend hours chasing late invoices from clients',
    'Invoice reminders for late paying clients — any tool?',
    'Offline markdown editor for Linux',
  ];
  const signals = texts.map((t, i) => scoreSignal(signal({ id: `s${i}`, title: t, author: `u${i}`, painScore: 40 }), config));
  const clusters = clusterSignals(
    signals.map((s) => ({ ...s, painScore: 40 })),
    { similarity: 0.2, minSize: 3 },
  );
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].distinctAuthors, 3);
  assert.ok(!clusters[0].signalIds.includes('s3'));
});

test('one person repeating themselves is not a pattern', () => {
  const signals = [1, 2, 3].map((i) => signal({ id: `s${i}`, title: 'chase late invoices tool', author: 'same', painScore: 40 }));
  assert.equal(clusterSignals(signals, { similarity: 0.2, minSize: 3 }).length, 0);
});

test('parseJsonArray tolerates prose around the JSON', () => {
  assert.deepEqual(parseJsonArray('Here you go:\n[{"i":0}]\nDone'), [{ i: 0 }]);
  assert.deepEqual(parseJsonArray('not json'), []);
});

test('classifySignals maps answers back to posts and survives API errors', async () => {
  const signals = [signal({ id: 'x', title: 'is there a tool' }), signal({ id: 'y', title: 'hmm' })];
  const answer = [{ i: 1, isRealPain: true, problem: 'P', who: 'W', willingnessToPay: 'explicit', niche: 'Bookkeeping', productIdea: 'I', intentScore: 999 }];
  const ok = (async () =>
    new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answer) }] }))) as unknown as typeof fetch;
  const res = await classifySignals(signals, { apiKey: 'k', model: 'm', fetchImpl: ok });
  assert.equal(res.size, 1);
  assert.equal(res.get('y')?.intentScore, 90, 'clamped to rubric max');
  assert.equal(res.get('y')?.niche, 'bookkeeping');

  const logs: string[] = [];
  const fail = (async () => new Response('overloaded', { status: 529 })) as unknown as typeof fetch;
  const none = await classifySignals(signals, { apiKey: 'k', model: 'm', fetchImpl: fail, log: (m) => logs.push(m) });
  assert.equal(none.size, 0);
  assert.match(logs[0], /529/);
});
