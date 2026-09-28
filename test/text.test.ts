import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAtom } from '../src/util/feed.ts';
import { normalize, parseMoney, stripHtml, tokenize, truncate } from '../src/util/text.ts';

test('stripHtml removes tags and decodes entities', () => {
  assert.equal(stripHtml('<p>I&#x27;d pay &amp; <i>more</i></p>'), "I'd pay & more");
  assert.equal(stripHtml(null), '');
});

test('normalize straightens curly quotes so phrases match', () => {
  assert.ok(normalize('I’d pay for this').includes("i'd pay"));
});

test('parseMoney understands $, £, commas and k', () => {
  assert.deepEqual(parseMoney('bounty $1,500'), { amount: 1500, currency: 'USD' });
  assert.deepEqual(parseMoney('budget £2k'), { amount: 2000, currency: 'GBP' });
  assert.equal(parseMoney('no money here'), undefined);
});

test('tokenize drops stopwords and short words', () => {
  assert.deepEqual(tokenize('Is there a tool for chasing invoices?'), ['chasing', 'invoice']);
});

test('truncate adds an ellipsis only when needed', () => {
  assert.equal(truncate('short', 10), 'short');
  assert.equal(truncate('a long sentence here', 8), 'a long…');
});

test('parseAtom reads Reddit-style entries', () => {
  const xml = `<feed><entry><author><name>/u/x</name></author><content type="html">&lt;p&gt;Hi &amp;amp; bye&lt;/p&gt;</content><id>t3_a</id><link href="https://r/a"/><published>2026-09-27T12:00:00+00:00</published><title>T</title></entry></feed>`;
  const [e] = parseAtom(xml);
  assert.equal(e.id, 't3_a');
  assert.equal(e.author, '/u/x');
  assert.equal(e.link, 'https://r/a');
  assert.equal(e.content, 'Hi & bye');
});
