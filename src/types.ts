/**
 * Core data shapes. Every source is normalised into a `Signal` so the rest of
 * the pipeline (scoring, AI review, clustering, digest) never cares where a
 * post came from.
 */

/** What kind of opportunity a signal points at. */
export type SignalKind =
  | 'demand' // someone describing a problem or asking for a tool (the gold)
  | 'bounty' // someone has put money on a specific piece of work
  | 'launch' // something new people are building / shipping
  | 'tool' // something you could add to your own dev workflow
  | 'tender'; // a UK public-sector buyer asking for software/services

export interface Engagement {
  score?: number; // upvotes / points / likes
  comments?: number;
  stars?: number;
  views?: number;
}

export interface Money {
  amount: number;
  currency: string;
}

export interface AiAssessment {
  /** Is this a real, specific problem someone has (not a rant, ad or joke)? */
  isRealPain: boolean;
  /** One sentence: the problem in plain words. */
  problem: string;
  /** Who has it, e.g. "solo bookkeepers", "Shopify store owners". */
  who: string;
  willingnessToPay: 'none' | 'implied' | 'explicit';
  /** Short industry / niche label, used for grouping. */
  niche: string;
  /** One-line product idea that would solve it. */
  productIdea: string;
  /**
   * 0..90 rubric score: pain intensity (0–25) + willingness to pay (0–25) +
   * specificity of the workflow (0–15) + business/professional author (0–15) +
   * names an incumbent they're unhappy with (0–10).
   */
  intentScore: number;
}

export interface Signal {
  /** Globally unique: `${source}:${nativeId}` */
  id: string;
  source: string;
  kind: SignalKind;
  title: string;
  body: string;
  url: string;
  author?: string;
  /** ISO timestamp of the original post. */
  createdAt: string;
  engagement: Engagement;
  money?: Money;
  tags: string[];

  // ---- filled in by the pipeline ----
  painScore?: number;
  matchedPhrases?: string[];
  ai?: AiAssessment;
}

export interface Cluster {
  id: string;
  label: string;
  signalIds: string[];
  size: number;
  distinctAuthors: number;
  sources: string[];
  firstSeen: string;
  lastSeen: string;
  /** Highest scoring member, used as the example in the digest. */
  top: Signal;
}

/** Fetches a URL and returns parsed JSON. Swappable so tests/fixtures run offline. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<unknown>;
/** Same idea, but returns raw text (RSS/Atom feeds). */
export type TextFetcher = (url: string, init?: RequestInit) => Promise<string>;

export interface CollectorContext {
  fetch: Fetcher;
  fetchText: TextFetcher;
  env: Record<string, string | undefined>;
  /** Only return things created after this moment. */
  since: Date;
  now: Date;
  log: (msg: string) => void;
  /** Politeness pause between requests (a no-op in fixture/test mode). */
  delay: (ms: number) => Promise<void>;
}

export interface Collector {
  name: string;
  /** Returns a reason string if the collector can't run (e.g. missing credentials). */
  unavailable?(ctx: CollectorContext): string | undefined;
  collect(ctx: CollectorContext): Promise<Signal[]>;
}
