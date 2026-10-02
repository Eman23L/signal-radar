/**
 * Cheap, deterministic first-pass score (0–100). Runs on everything, free.
 * Its job is to rank and pre-filter so only the promising few go to Claude.
 */
import type { RadarConfig } from '../config.ts';
import type { Signal } from '../types.ts';
import { normalize } from '../util/text.ts';

const EXPLICIT_WTP = ["i'd pay", 'i would pay', 'would happily pay', 'willing to pay', 'take my money', 'happy to pay'];
const isWtpPhrase = (p: string) => EXPLICIT_WTP.some((w) => p.includes(w) || w.includes(p));

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const log2 = (n: number) => Math.log2(1 + Math.max(0, n));

function containsWord(text: string, phrase: string): boolean {
  if (/^[a-z' ]+$/.test(phrase)) {
    return new RegExp(`(^|[^a-z])${phrase}([^a-z]|$)`).test(text);
  }
  return text.includes(phrase);
}

export function scoreSignal(s: Signal, config: RadarConfig): Signal {
  const text = normalize(`${s.title} ${s.body}`);

  if (config.excludePhrases.some((p) => text.includes(p))) {
    return { ...s, painScore: 0, matchedPhrases: [] };
  }

  const matched = config.painPhrases.filter((p) => text.includes(p));
  const e = s.engagement;
  const engagement = Math.min(15, log2((e.score ?? 0) + (e.comments ?? 0) * 2) * 3);
  const niche = config.niches.find((n) => n.keywords.some((k) => containsWord(text, k.toLowerCase())));
  const nicheBonus = niche ? 10 : 0;
  let score = 0;

  switch (s.kind) {
    case 'demand': {
      // Sources where every item is demand by nature get a floor.
      const inherentlyDemand = s.tags.includes('softwarerecs') || s.source === 'appstore';
      // "I would pay for that" on its own is usually chat ("I'd pay for a Star Trek computer"),
      // so willingness to pay only counts in full next to a real problem or tool request,
      // and it's counted once (not again as a pain phrase and a money word).
      const problems = matched.filter((p) => !isWtpPhrase(p));
      const wtp = EXPLICIT_WTP.some((p) => text.includes(p));
      const hasProblem = problems.length > 0 || inherentlyDemand;
      score = problems.length ? 25 + Math.min(15, (problems.length - 1) * 8) : inherentlyDemand ? 30 : matched.length ? 15 : 5;
      const moneyText = EXPLICIT_WTP.reduce((t, p) => t.replaceAll(p, ' '), text);
      if (config.moneyPhrases.some((p) => containsWord(moneyText, p))) score += 10;
      if (wtp) score += hasProblem ? 15 : 5;
      if (s.source === 'appstore' && s.tags.includes('rating:1')) score += 5;
      // No engagement data at all (e.g. HN comments, which carry no points): nothing backs up
      // a stray "too expensive" in a thread about something else.
      if (!inherentlyDemand && Object.values(e).every((v) => v === undefined)) score -= 10;
      score += engagement + nicheBonus;
      break;
    }
    case 'bounty': {
      const amount = s.money?.amount ?? 0;
      score = 35 + Math.min(40, Math.log10(1 + amount) * 12) + nicheBonus;
      break;
    }
    case 'tender': {
      const amount = s.money?.amount ?? 0;
      score = 40 + Math.min(25, Math.log10(1 + amount) * 4) + nicheBonus;
      break;
    }
    case 'launch':
    case 'tool': {
      const traction = (e.stars ?? 0) + (e.score ?? 0);
      score = 20 + Math.min(45, log2(traction) * 5) + nicheBonus;
      break;
    }
  }

  const tags = niche && !s.tags.includes(`niche:${niche.name}`) ? [...s.tags, `niche:${niche.name}`] : s.tags;
  return { ...s, tags, painScore: Math.round(clamp(score)), matchedPhrases: matched };
}

/**
 * Blend in Claude's rubric score when present. The rubric (0–90) is the better judge
 * of intent, the heuristic still carries engagement/recency.
 */
export function finalScore(s: Signal): number {
  const h = s.painScore ?? 0;
  if (!s.ai) return h;
  if (!s.ai.isRealPain) return Math.round(h * 0.3);
  const ai = (s.ai.intentScore / 90) * 100;
  return Math.round(clamp(ai * 0.7 + h * 0.3));
}
