/**
 * Offline mode: serves canned responses from test/fixtures instead of hitting
 * the network. Used by `npm run demo` and the tests, so the whole pipeline can
 * be exercised with no keys and no internet. Fixture posts are SAMPLE DATA
 * written to look like each API's real response shape — not real posts.
 */
import { readFileSync } from 'node:fs';
import type { Fetcher, TextFetcher } from './types.ts';

const dir = new URL('../test/fixtures/', import.meta.url);
const load = (name: string) => readFileSync(new URL(name, dir), 'utf8');
const json = (name: string) => JSON.parse(load(name));

/** Fixture posts are dated relative to this moment. */
export const FIXTURE_NOW = new Date('2026-09-28T06:45:00Z');

export const fixtureFetcher: Fetcher = async (url, init) => {
  const u = new URL(url);
  switch (u.hostname) {
    case 'hn.algolia.com':
      return u.searchParams.get('tags') === 'show_hn' ? json('hn-show.json') : json('hn-search.json');
    case 'api.github.com':
      if (u.pathname.endsWith('/repositories')) return json('github-repos.json');
      return (u.searchParams.get('q') ?? '').includes('Bounty') ? json('github-bounties.json') : json('github-issues.json');
    case 'api.stackexchange.com':
      return u.searchParams.get('site') === 'softwarerecs' ? json('stackexchange.json') : { items: [], has_more: false };
    case 'bsky.social':
      return u.pathname.endsWith('createSession') ? { accessJwt: 'fixture' } : json('bluesky.json');
    case 'itunes.apple.com':
      return url.includes('/gb/') && url.includes('id=441880705') ? json('appstore.json') : { feed: {} };
    case 'www.find-tender.service.gov.uk':
      return json('findatender.json');
    default:
      throw new Error(`no fixture for ${url} (${init?.method ?? 'GET'})`);
  }
};

export const fixtureTextFetcher: TextFetcher = async (url) => {
  if (new URL(url).hostname === 'www.reddit.com') return load('reddit.xml');
  throw new Error(`no text fixture for ${url}`);
};
