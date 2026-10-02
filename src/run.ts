/**
 * One radar run: collect → dedupe → score → (Claude review) → store →
 * spot repeated pain → digest → notify. Every source is isolated: one failing
 * source shows up as a warning in the run report, the rest still ship.
 */
import { createHash } from 'node:crypto';
import { enabledCollectors } from './collectors/index.ts';
import type { RadarConfig } from './config.ts';
import { renderMarkdown, renderPush, type DigestInput, type SourceReport } from './digest/render.ts';
import type { Notifier } from './notify/index.ts';
import { classifySignals } from './pipeline/classify.ts';
import { clusterSignals } from './pipeline/cluster.ts';
import { finalScore, scoreSignal } from './pipeline/score.ts';
import type { JsonStore } from './store/jsonStore.ts';
import type { CollectorContext, Signal } from './types.ts';
import { isoDay } from './util/text.ts';

export interface RunOptions {
  config: RadarConfig;
  ctx: Omit<CollectorContext, 'since'>;
  store: JsonStore;
  notifiers: Notifier[];
  ai?: { apiKey: string; model: string; fetchImpl?: typeof fetch };
  dryRun?: boolean;
  onlySources?: string[];
}

export interface RunResult {
  digest: DigestInput;
  markdown: string;
  push: string;
  newSignals: Signal[];
}

/** Store a short one-way hash instead of usernames: enough to count distinct people, nothing more (UK GDPR data minimisation). */
export function hashAuthor(source: string, author?: string): string | undefined {
  if (!author) return undefined;
  return createHash('sha256').update(`${source}:${author.toLowerCase()}`).digest('hex').slice(0, 12);
}

export async function runRadar(o: RunOptions): Promise<RunResult> {
  const { config, store, dryRun } = o;
  const now = o.ctx.now;
  const day = isoDay(now);
  const ctx: CollectorContext = { ...o.ctx, since: new Date(now.getTime() - config.lookbackHours * 3_600_000) };
  const log = ctx.log;

  // 1. Collect
  const report: SourceReport[] = [];
  const collected: Signal[] = [];
  let collectors = enabledCollectors(config);
  if (o.onlySources?.length) collectors = collectors.filter((c) => o.onlySources!.includes(c.name));

  for (const c of collectors) {
    const reason = c.unavailable?.(ctx);
    if (reason) {
      report.push({ source: c.name, status: 'skipped', count: 0, note: reason });
      continue;
    }
    try {
      // Slow sources can look further back; seen.json keeps them from repeating.
      const hours = (config.sources as Record<string, { lookbackHours?: number }>)[c.name]?.lookbackHours;
      const items = await c.collect(hours ? { ...ctx, since: new Date(now.getTime() - hours * 3_600_000) } : ctx);
      collected.push(...items);
      report.push({ source: c.name, status: 'ok', count: items.length });
      log(`${c.name}: ${items.length} items`);
    } catch (err) {
      report.push({ source: c.name, status: 'error', count: 0, note: (err as Error).message.slice(0, 160) });
      log(`${c.name}: FAILED — ${(err as Error).message}`);
    }
  }

  // 2. Dedupe against earlier runs, minimise personal data, score
  const seen = await store.loadSeen();
  const fresh = new Map<string, Signal>();
  for (const s of collected) {
    if (seen[s.id] || fresh.has(s.id)) continue;
    fresh.set(s.id, scoreSignal({ ...s, author: hashAuthor(s.source, s.author) }, config));
  }
  for (const r of report) r.count = [...fresh.values()].filter((s) => s.source === r.source).length;
  let newSignals = [...fresh.values()];

  // 3. Claude review of the most promising demand signals
  let aiUsed = false;
  if (o.ai && config.ai.enabled) {
    const candidates = newSignals
      .filter((s) => s.kind === 'demand' && (s.painScore ?? 0) >= config.scoring.minScore)
      .sort((a, b) => (b.painScore ?? 0) - (a.painScore ?? 0))
      .slice(0, config.ai.maxSignals);
    if (candidates.length) {
      const verdicts = await classifySignals(candidates, { ...o.ai, log });
      aiUsed = verdicts.size > 0;
      newSignals = newSignals.map((s) => (verdicts.has(s.id) ? { ...s, ai: verdicts.get(s.id) } : s));
      log(`claude: reviewed ${verdicts.size}/${candidates.length}`);
    }
  }

  // 4. Store (keep anything with a little signal so patterns can form over time)
  const worthKeeping = newSignals.filter((s) => (s.painScore ?? 0) >= 10);
  if (!dryRun) {
    await store.saveSignals(day, worthKeeping);
    for (const s of newSignals) seen[s.id] = day;
    await store.saveSeen(seen, day);
  }

  // 5. Repeated pain across the whole window
  const history = await store.loadWindow(day, config.clustering.windowDays);
  const windowSignals = [...new Map([...history, ...worthKeeping].map((s) => [s.id, s])).values()];
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const patterns = clusterSignals(windowSignals, config.clustering)
    .filter((c) => c.lastSeen >= weekAgo)
    .slice(0, config.digest.maxPatterns);

  // 6. Digest
  const pick = (kinds: Signal['kind'][], max: number) =>
    newSignals
      .filter((s) => kinds.includes(s.kind) && finalScore(s) >= config.scoring.minScore)
      .sort((a, b) => finalScore(b) - finalScore(a))
      .slice(0, max);

  const base = o.ctx.env.DIGEST_BASE_URL?.replace(/\/$/, '');
  const digest: DigestInput = {
    day,
    demand: pick(['demand'], config.digest.maxDemand),
    bounties: pick(['bounty'], config.digest.maxBounties),
    tenders: pick(['tender'], config.digest.maxTenders),
    launches: pick(['launch', 'tool'], config.digest.maxLaunches),
    patterns,
    report,
    aiUsed,
    digestUrl: base ? `${base}/${day}.md` : undefined,
  };
  const markdown = renderMarkdown(digest);
  const push = renderPush(digest);

  if (!dryRun) {
    await store.saveDigest(day, markdown);
    for (const n of o.notifiers) {
      try {
        await n.send(`Signal Radar ${day}`, push, digest.digestUrl);
        log(`notified via ${n.name}`);
      } catch (err) {
        log(`notify ${n.name} FAILED — ${(err as Error).message}`);
      }
    }
  }

  return { digest, markdown, push, newSignals };
}
