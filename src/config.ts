import type { SignalKind } from './types.ts';

export interface Niche {
  name: string;
  /** Any of these words in a post marks it as belonging to this niche (and boosts its score). */
  keywords: string[];
}

export interface RadarConfig {
  /** Phrases people use when they have a problem worth solving. Matching is case-insensitive. */
  painPhrases: string[];
  /** Phrases that suggest money is on the table. */
  moneyPhrases: string[];
  /** Posts containing any of these are dropped (spam, hiring posts, etc.). */
  excludePhrases: string[];
  /** Optional focus areas. Empty = cast a wide net. */
  niches: Niche[];
  /** How far back each run looks. Slightly over 24h so a late run doesn't leave gaps; dedupe handles overlap. */
  lookbackHours: number;

  sources: {
    hackernews: {
      enabled: boolean;
      /** Also include "Show HN" launches with at least this many points. 0 = off. */
      showHnMinPoints: number;
    };
    github: {
      enabled: boolean;
      /** New repos in these topics that are picking up stars fast. */
      newRepos: { topic: string; kind: SignalKind; minStars: number; createdWithinDays: number }[];
      /** Open issues with money on them. Algora's bot labels them "💎 Bounty". */
      bounties: { enabled: boolean; labels: string[]; minAmountUsd: number };
      /**
       * Feature requests on popular repos = unmet needs. Each entry is a raw GitHub issue
       * search query; the collector adds `is:issue created:>DATE` for you.
       */
      featureRequests: { enabled: boolean; queries: string[] };
    };
    stackexchange: {
      enabled: boolean;
      /**
       * `everyQuestion: true` treats every new question as demand (softwarerecs is literally
       * "please recommend software for X"). Otherwise only questions matching pain phrases count.
       */
      sites: { site: string; everyQuestion: boolean }[];
    };
    bluesky: { enabled: boolean };
    /** 1–2 star reviews of paid apps = people telling you exactly what's broken. */
    appstore: {
      enabled: boolean;
      /** Storefronts to read, e.g. ['gb', 'us']. */
      countries: string[];
      maxRating: number;
      /** Numeric App Store IDs (the digits in apps.apple.com/.../id123456789). */
      apps: { id: string; name: string }[];
    };
    /** UK public-sector tenders (Find a Tender, OCDS API, Open Government Licence). */
    findatender: {
      enabled: boolean;
      /** CPV code prefixes, e.g. 48 = software packages, 72 = IT services. */
      cpvPrefixes: string[];
      /** Optional: only keep tenders whose title/description mention one of these. Empty = every matching CPV. */
      keywords: string[];
    };
    /** Personal use only — public RSS, not an approved API. Off by default. See docs/SOURCES.md. */
    reddit: { enabled: boolean; subreddits: string[]; delaySeconds: number };
  };

  scoring: {
    /** Signals below this never reach the digest. */
    minScore: number;
  };

  ai: {
    /** Uses Claude only if ANTHROPIC_API_KEY is set. */
    enabled: boolean;
    model: string;
    /** Only the top N by heuristic score get sent to Claude each day (keeps cost ~pennies). */
    maxSignals: number;
  };

  clustering: {
    /** Look back this many days of stored signals when hunting for repeated pain. */
    windowDays: number;
    /** 0..1 — how similar two posts must be to count as "the same problem". */
    similarity: number;
    /** A cluster needs this many posts before it's called a pattern. */
    minSize: number;
  };

  digest: {
    maxDemand: number;
    maxBounties: number;
    maxTenders: number;
    maxLaunches: number;
    maxPatterns: number;
  };
}

export function defineConfig(c: RadarConfig): RadarConfig {
  return c;
}

export async function loadConfig(path = new URL('../config/radar.config.ts', import.meta.url)): Promise<RadarConfig> {
  const mod = (await import(path.href)) as { default: RadarConfig };
  return mod.default;
}
