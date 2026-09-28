/**
 * ─────────────────────────────────────────────────────────────
 *  This is the file you tune. Everything the radar listens for
 *  lives here. Change it, commit, and tomorrow's run uses it.
 * ─────────────────────────────────────────────────────────────
 */
import { defineConfig } from '../src/config.ts';

export default defineConfig({
  painPhrases: [
    // asking for a tool
    'is there a tool',
    'is there an app',
    'is there any software',
    'is there a service',
    'is there a way to automate',
    'does anyone know a tool',
    'any tool that',
    'any app that',
    'looking for a tool',
    'looking for software',
    'looking for an app',
    'recommend a tool',
    'what do you use for',
    'how do you guys handle',
    'how do you all manage',
    'how do you keep track',
    'alternative to',
    // pain / frustration
    'wish there was',
    'wish there were',
    'tired of manually',
    'spend hours',
    'waste so much time',
    'still using spreadsheets',
    'spreadsheet hell',
    'drives me crazy',
    'sick of',
    'frustrated with',
    'too expensive',
    'overpriced',
    // willingness to pay
    "i'd pay for",
    'i would pay',
    'would happily pay',
    'willing to pay',
    'shut up and take my money',
    'someone should build',
    'someone please build',
  ],

  moneyPhrases: ['pay', 'paid', 'paying', 'budget', 'subscription', 'per month', '/mo', 'invoice', 'pricing', 'would buy'],

  excludePhrases: ["we're hiring", 'we are hiring', 'airdrop', 'giveaway', 'promo code', 'onlyfans', 'casino'],

  // Start wide. After a week or two of digests, add the niches that keep showing up.
  // Example:
  // niches: [
  //   { name: 'Trades & field services', keywords: ['plumber', 'electrician', 'hvac', 'contractor', 'quote', 'job sheet'] },
  //   { name: 'Bookkeeping', keywords: ['bookkeeper', 'invoices', 'reconcile', 'xero', 'quickbooks', 'receipts'] },
  // ],
  niches: [],

  lookbackHours: 26,

  sources: {
    hackernews: { enabled: true, showHnMinPoints: 30 },
    github: {
      enabled: true,
      newRepos: [
        { topic: 'claude-code', kind: 'tool', minStars: 15, createdWithinDays: 14 },
        { topic: 'mcp', kind: 'tool', minStars: 30, createdWithinDays: 14 },
        { topic: 'saas', kind: 'launch', minStars: 25, createdWithinDays: 14 },
        { topic: 'ai-agents', kind: 'launch', minStars: 50, createdWithinDays: 14 },
      ],
      bounties: { enabled: true, labels: ['💎 Bounty'], minAmountUsd: 50 },
      featureRequests: {
        enabled: true,
        queries: [
          // Highly-upvoted feature requests: many people want the same thing.
          'label:"feature request" state:open reactions:>=10',
          'label:enhancement state:open reactions:>=25',
        ],
      },
    },
    stackexchange: {
      enabled: true,
      sites: [
        { site: 'softwarerecs', everyQuestion: true },
        { site: 'webapps', everyQuestion: false },
        { site: 'superuser', everyQuestion: false },
      ],
      lookbackHours: 168, // slow sites: look back a week; seen.json stops repeats
    },
    bluesky: { enabled: true }, // runs only if BLUESKY_HANDLE + BLUESKY_APP_PASSWORD are set
    appstore: {
      enabled: true,
      countries: ['gb', 'us'],
      maxRating: 2,
      lookbackHours: 168, // reviews trickle in: look back a week; seen.json stops repeats
      // Pick paid apps in niches you're curious about. Their unhappy customers are your leads.
      // Find the ID in the App Store URL: apps.apple.com/gb/app/xero-accounting-for-business/id441880705
      apps: [
        { id: '441880705', name: 'Xero Accounting' },
        { id: '1014146758', name: 'Jobber Field Service' },
      ],
    },
    findatender: {
      enabled: true,
      cpvPrefixes: ['48', '72'],
      keywords: [],
    },
    reddit: {
      // Reddit closed self-service API access (Nov 2025) and .json endpoints (May 2026).
      // Public RSS still answers but is not an approved route: personal use only, few subs, slow.
      enabled: false,
      subreddits: ['smallbusiness', 'SaaS', 'Entrepreneur', 'UKPersonalFinance', 'sysadmin'],
      delaySeconds: 20,
    },
  },

  scoring: { minScore: 30 },

  ai: { enabled: true, model: 'claude-haiku-4-5', maxSignals: 40 },

  clustering: { windowDays: 30, similarity: 0.25, minSize: 3 },

  digest: { maxDemand: 8, maxBounties: 5, maxTenders: 5, maxLaunches: 5, maxPatterns: 5 },
});
