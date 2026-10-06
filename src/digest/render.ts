import type { Cluster, Signal } from '../types.ts';
import { finalScore } from '../pipeline/score.ts';
import { truncate } from '../util/text.ts';

export interface DigestInput {
  day: string;
  demand: Signal[];
  bounties: Signal[];
  tenders: Signal[];
  launches: Signal[];
  patterns: Cluster[];
  report: SourceReport[];
  aiUsed: boolean;
  digestUrl?: string;
}

export interface SourceReport {
  source: string;
  status: 'ok' | 'skipped' | 'error';
  count: number;
  note?: string;
}

const SOURCE_LABEL: Record<string, string> = {
  hackernews: 'Hacker News',
  github: 'GitHub',
  stackexchange: 'Stack Exchange',
  bluesky: 'Bluesky',
  appstore: 'App Store',
  findatender: 'Find a Tender',
  contractsfinder: 'Contracts Finder',
  discourse: 'Forums',
  reddit: 'Reddit',
};

const label = (s: string) => SOURCE_LABEL[s] ?? s;
const money = (s: Signal) =>
  s.money ? ` · ${s.money.currency === 'GBP' ? '£' : s.money.currency === 'EUR' ? '€' : '$'}${Math.round(s.money.amount).toLocaleString('en-GB')}` : '';

function demandLine(s: Signal): string {
  const lines = [`- **[${truncate(s.title, 110)}](${s.url})** — ${label(s.source)} · score ${finalScore(s)}${money(s)}`];
  if (s.ai) {
    const wtp = s.ai.willingnessToPay === 'explicit' ? ' 💷 says they’d pay' : s.ai.willingnessToPay === 'implied' ? ' 💷 implied budget' : '';
    const fit = s.ai.buildFit === undefined ? '' : ` · fit ${s.ai.buildFit}/10`;
    lines.push(`  - _${s.ai.problem}_ (${s.ai.who})${wtp}${fit}`);
    const ideas = s.ai.ideas?.length ? s.ai.ideas : s.ai.productIdea ? [s.ai.productIdea] : [];
    if (ideas.length) lines.push(`  - 💡 ${ideas.join(' · ')}`);
    if (s.ai.competitors?.length) lines.push(`  - 🏷️ Existing: ${s.ai.competitors.join(', ')} (unverified)`);
    if (s.ai.outreach) lines.push(`  - ✉️ Draft reply: “${s.ai.outreach}”`);
  } else if (s.body) {
    lines.push(`  - ${truncate(s.body.replace(/\s+/g, ' '), 220)}`);
  }
  return lines.join('\n');
}

const simpleLine = (s: Signal) => `- [${truncate(s.title, 110)}](${s.url}) — ${label(s.source)}${money(s)}`;

export function renderMarkdown(d: DigestInput): string {
  const out: string[] = [`# Signal Radar — ${d.day}`, ''];
  const total = d.demand.length + d.bounties.length + d.tenders.length + d.launches.length;
  if (total === 0 && d.patterns.length === 0) out.push('_Nothing new cleared the bar today._', '');

  if (d.patterns.length) {
    out.push('## 🔥 Repeated pain (same problem, different people)', '');
    for (const c of d.patterns) {
      out.push(
        `- **${c.top.ai?.problem ?? c.label}** — ${c.distinctAuthors} people, ${c.size} posts across ${c.sources.map(label).join(', ')} (since ${c.firstSeen.slice(0, 10)})`,
        `  - Example: [${truncate(c.top.title, 90)}](${c.top.url})`,
      );
    }
    out.push('');
  }
  if (d.demand.length) out.push('## 💬 People asking for something', '', ...d.demand.map(demandLine), '');
  if (d.tenders.length) out.push('## 🏛️ UK public-sector tenders', '', ...d.tenders.map(simpleLine), '');
  if (d.bounties.length) out.push('## 💰 Paid bounties', '', ...d.bounties.map(simpleLine), '');
  if (d.launches.length) out.push('## 🚀 New things people are building', '', ...d.launches.map(simpleLine), '');

  out.push('---', '', '<details><summary>Run report</summary>', '');
  for (const r of d.report) {
    const icon = r.status === 'ok' ? '✅' : r.status === 'skipped' ? '⏭️' : '⚠️';
    out.push(`- ${icon} ${label(r.source)}: ${r.count} new${r.note ? ` — ${r.note}` : ''}`);
  }
  out.push(`- AI review: ${d.aiUsed ? 'on' : 'off (heuristic scores only)'}`, '', '</details>', '');
  return out.join('\n');
}

/** Short version for phone notifications (Telegram ≤4096 chars, Discord ≤2000). */
export function renderPush(d: DigestInput, maxLen = 1900): string {
  const lines: string[] = [];
  const counts = [
    d.patterns.length && `${d.patterns.length} repeated`,
    d.demand.length && `${d.demand.length} asks`,
    d.tenders.length && `${d.tenders.length} tenders`,
    d.bounties.length && `${d.bounties.length} bounties`,
    d.launches.length && `${d.launches.length} launches`,
  ].filter(Boolean);
  lines.push(`📡 Signal Radar ${d.day}: ${counts.length ? counts.join(', ') : 'quiet day'}`);

  for (const c of d.patterns.slice(0, 2)) {
    lines.push('', `🔥 ${truncate(c.top.ai?.problem ?? c.label, 90)} (${c.distinctAuthors} people)`, c.top.url);
  }
  for (const s of d.demand.slice(0, 3)) {
    lines.push('', `💬 ${truncate(s.ai?.problem ?? s.title, 110)} [${finalScore(s)}]`, s.url);
  }
  if (d.tenders[0]) lines.push('', `🏛️ ${truncate(d.tenders[0].title, 110)}${money(d.tenders[0])}`, d.tenders[0].url);
  if (d.digestUrl) lines.push('', `Full digest: ${d.digestUrl}`);

  const errors = d.report.filter((r) => r.status === 'error');
  if (errors.length) lines.push('', `⚠️ ${errors.map((r) => label(r.source)).join(', ')} failed — see run report`);

  const text = lines.join('\n');
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}
