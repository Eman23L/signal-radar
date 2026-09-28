#!/usr/bin/env node
/**
 * CLI
 *   node src/index.ts run                  real run: collect, store, notify
 *   node src/index.ts run --dry-run        print the digest, write nothing, notify no one
 *   node src/index.ts run --fixtures       use offline sample data (implies a fixed "now")
 *   node src/index.ts run --no-ai          skip Claude even if a key is set
 *   node src/index.ts run --sources hackernews,github
 *   node src/index.ts test-notify          send a test message to every configured channel
 */
import { parseArgs } from 'node:util';
import { loadConfig } from './config.ts';
import { FIXTURE_NOW, fixtureFetcher, fixtureTextFetcher } from './fixtures.ts';
import { configuredNotifiers } from './notify/index.ts';
import { runRadar } from './run.ts';
import { JsonStore } from './store/jsonStore.ts';
import { createHttpFetcher, createTextFetcher, sleep } from './util/http.ts';

try {
  process.loadEnvFile();
} catch {
  // no .env file — fine in CI
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    'dry-run': { type: 'boolean', default: false },
    fixtures: { type: 'boolean', default: false },
    'no-ai': { type: 'boolean', default: false },
    'no-notify': { type: 'boolean', default: false },
    sources: { type: 'string' },
    'data-dir': { type: 'string', default: 'data' },
  },
});

const command = positionals[0] ?? 'run';
// In fixture mode, pretend optional credentials exist so every sample source shows up.
const env = values.fixtures
  ? { ...process.env, BLUESKY_HANDLE: 'demo.bsky.social', BLUESKY_APP_PASSWORD: 'demo' }
  : process.env;
const log = (msg: string) => console.error(`[radar] ${msg}`);

if (command === 'test-notify') {
  const notifiers = configuredNotifiers(env);
  if (!notifiers.length) {
    log('No notification channel configured. Set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (or DISCORD_WEBHOOK_URL / NTFY_TOPIC).');
    process.exit(1);
  }
  for (const n of notifiers) {
    await n.send('Signal Radar test', '📡 Signal Radar is connected. Your daily digest will arrive here.');
    log(`sent test via ${n.name}`);
  }
  process.exit(0);
}

if (command !== 'run') {
  log(`unknown command "${command}"`);
  process.exit(1);
}

const config = await loadConfig();
const fixtures = values.fixtures;
const dryRun = values['dry-run'];
const aiKey = env.ANTHROPIC_API_KEY;

const result = await runRadar({
  config,
  ctx: {
    fetch: fixtures ? fixtureFetcher : createHttpFetcher(),
    fetchText: fixtures ? fixtureTextFetcher : createTextFetcher(),
    env,
    now: fixtures ? FIXTURE_NOW : new Date(),
    log,
    delay: fixtures ? async () => {} : sleep,
  },
  store: new JsonStore(values['data-dir']!),
  notifiers: values['no-notify'] ? [] : configuredNotifiers(env),
  ai: aiKey && !values['no-ai'] ? { apiKey: aiKey, model: env.ANTHROPIC_MODEL ?? config.ai.model } : undefined,
  dryRun,
  onlySources: values.sources?.split(',').map((s) => s.trim()),
});

if (dryRun) {
  console.log(result.markdown);
  console.log('\n──── push notification preview ────\n');
  console.log(result.push);
}

// Fail the GitHub Action (so you get GitHub's email) only if every source failed.
const ran = result.digest.report.filter((r) => r.status !== 'skipped');
if (ran.length > 0 && ran.every((r) => r.status === 'error')) {
  log('every source failed');
  process.exit(2);
}
