import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.ts';
import { FIXTURE_NOW, fixtureFetcher, fixtureTextFetcher } from '../src/fixtures.ts';
import type { CollectorContext, Signal } from '../src/types.ts';

export const config = await loadConfig();

export function ctx(overrides: Partial<CollectorContext> = {}): CollectorContext {
  return {
    fetch: fixtureFetcher,
    fetchText: fixtureTextFetcher,
    env: { BLUESKY_HANDLE: 'demo', BLUESKY_APP_PASSWORD: 'demo' },
    now: FIXTURE_NOW,
    since: new Date(FIXTURE_NOW.getTime() - config.lookbackHours * 3_600_000),
    log: () => {},
    delay: async () => {},
    ...overrides,
  };
}

export const tempDir = () => mkdtemp(join(tmpdir(), 'radar-'));

export function signal(partial: Partial<Signal> & { id: string }): Signal {
  return {
    source: 'test',
    kind: 'demand',
    title: '',
    body: '',
    url: 'https://example.com',
    createdAt: FIXTURE_NOW.toISOString(),
    engagement: {},
    tags: [],
    ...partial,
  };
}
