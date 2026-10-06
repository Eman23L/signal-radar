import type { RadarConfig } from '../config.ts';
import type { Collector } from '../types.ts';
import { appStore } from './appstore.ts';
import { bluesky } from './bluesky.ts';
import { contractsFinder } from './contractsfinder.ts';
import { discourse } from './discourse.ts';
import { findATender } from './findatender.ts';
import { github } from './github.ts';
import { hackerNews } from './hackernews.ts';
import { reddit } from './reddit.ts';
import { stackExchange } from './stackexchange.ts';

/** All collectors switched on in config. Add a new source by writing a collector and listing it here. */
export function enabledCollectors(config: RadarConfig): Collector[] {
  const s = config.sources;
  const all: [boolean, Collector][] = [
    [s.hackernews.enabled, hackerNews(config)],
    [s.github.enabled, github(config)],
    [s.stackexchange.enabled, stackExchange(config)],
    [s.bluesky.enabled, bluesky(config)],
    [s.appstore.enabled, appStore(config)],
    [s.findatender.enabled, findATender(config)],
    [s.contractsfinder.enabled, contractsFinder(config)],
    [s.discourse.enabled, discourse(config)],
    [s.reddit.enabled, reddit(config)],
  ];
  return all.filter(([on]) => on).map(([, c]) => c);
}
