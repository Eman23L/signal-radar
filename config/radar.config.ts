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
        // UK accounting
        { id: '975591071', name: 'FreeAgent', countries: ['gb'] },
        // trades & field service
        { id: '984378901', name: 'Tradify' },
        { id: '378062736', name: 'ServiceM8' },
        // construction (close to your engineering background)
        { id: '374930542', name: 'Procore' },
        { id: '780165517', name: 'Fieldwire' },
        // care sector admin
        { id: '1254394392', name: 'Birdie Care', countries: ['gb'] },
        // staff rotas / shift work
        { id: '477070330', name: 'Deputy' },
        // salons & bookings
        { id: '1455346253', name: 'Fresha for Business' },
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

  // Who the ideas are for. Used by Claude to rank fit, not to filter by current skills.
  founder: {
    about:
      'Solo UK software engineer (React/Next.js, TypeScript, Python, SQL, dashboards, automation) working ' +
      'in civil engineering. Builds with AI help, so new stacks are fine. Wants a SaaS with monthly revenue.',
    advantages: [
      'UK-based: understands UK rules, public sector and councils',
      'engineering, construction and infrastructure workflows',
      'data pipelines, reporting dashboards and workflow automation',
      'has shipped live platforms (payments, admin dashboards, PWAs with push notifications)',
    ],
    constraints: [
      'part-time and solo: a first version must be buildable in about 4 weeks',
      'small starting budget: no hardware, no large upfront spend',
      'must be sellable online without a sales team',
    ],
    avoid: [
      'regulated advice products (medical, legal, financial advice)',
      'two-sided marketplaces that need both sides at launch',
      'consumer apps that need millions of users to make money',
    ],
  },

  ai: { enabled: true, model: 'claude-haiku-4-5', maxSignals: 40 },

  clustering: { windowDays: 30, similarity: 0.25, minSize: 3 },

  digest: { maxDemand: 8, maxBounties: 5, maxTenders: 5, maxLaunches: 5, maxPatterns: 5 },
});
