/**
 * Optional Claude review. Sends the top N demand signals (by heuristic score) to
 * Claude in small batches and asks for a structured judgement per post, using a
 * fixed rubric so scores are comparable day to day.
 *
 * Cost: ~700 input + ~300 output tokens per post (scores, ideas, competitors, a draft
 * reply). 40 posts/day on Haiku 4.5 ($1 / $5 per million tokens) ≈ $0.09/day, under
 * £3/month. The Message Batches API would halve it.
 */
import type { RadarConfig } from '../config.ts';
import type { AiAssessment, Signal } from '../types.ts';
import { truncate } from '../util/text.ts';

const API = 'https://api.anthropic.com/v1/messages';
const BATCH = 10;

const RUBRIC = `For each post, judge whether it describes a real, specific problem that a person or business has, and how likely they are to pay to solve it.

Score intentScore (0-90) with this rubric, adding the parts:
- pain intensity 0-25 (mild wish → costly, recurring, urgent; "every week", "hours", lost money or clients)
- willingness to pay 0-25 (none → implied → explicit budget / "I'd pay" / already paying for a worse tool)
- specificity of the workflow 0-15 (vague → concrete steps, tools, volumes)
- author is a business/professional rather than a hobbyist 0-15
- names an existing product they're unhappy with 0-10 (proves a market exists)

Score buildFit (0-10) for THIS founder: could they ship a first paid version in about 4 weeks with AI help,
reach these buyers online, and charge monthly? Their current skills are NOT a limit (they can learn any stack);
their advantages raise fit, their constraints and avoid-list lower it.

isRealPain is false for ads, self-promotion, jokes, news, pure rants with no problem, and questions already fully answered by a free built-in feature.
Keep problem, who and niche short (under 15 words each). niche is a 1–3 word industry label like "bookkeeping" or "trades".
ideas: 2-3 distinct product ideas, under 15 words each.
competitors: up to 3 existing products you know address this; [] if unsure. Never invent names.
outreach: a reply the founder could post under the original post, under 60 words. Plain and honest: acknowledge
the specific problem, say they're looking into building something for it, and ask ONE question about how they
handle it today (Mom Test style). No links, no selling, no fake claims. Empty string if isRealPain is false.

Reply with ONLY a JSON array, one object per post, in the same order:
[{"i":0,"isRealPain":true,"problem":"...","who":"...","willingnessToPay":"none|implied|explicit","niche":"...","productIdea":"...","intentScore":0,"buildFit":0,"ideas":["..."],"competitors":["..."],"outreach":"..."}]`;

export function systemPrompt(founder?: RadarConfig['founder']): string {
  const who = founder
    ? `You review public posts for this founder, who is looking for problems worth building a product for:
${founder.about}
Advantages: ${founder.advantages.join('; ')}
Constraints: ${founder.constraints.join('; ')}
Avoid: ${founder.avoid.join('; ')}`
    : 'You review public posts for a solo software founder looking for problems worth building a product for.';
  return `${who}\n\n${RUBRIC}`;
}

interface RawAssessment extends Partial<AiAssessment> {
  i?: number;
}

export interface ClassifyOptions {
  apiKey: string;
  model: string;
  founder?: RadarConfig['founder'];
  fetchImpl?: typeof fetch;
  log?: (msg: string) => void;
}

export async function classifySignals(signals: Signal[], opts: ClassifyOptions): Promise<Map<string, AiAssessment>> {
  const results = new Map<string, AiAssessment>();
  const doFetch = opts.fetchImpl ?? fetch;

  for (let start = 0; start < signals.length; start += BATCH) {
    const batch = signals.slice(start, start + BATCH);
    const posts = batch
      .map((s, i) => `<post i="${i}" source="${s.source}">\n${truncate(s.title, 200)}\n${truncate(s.body, 1200)}\n</post>`)
      .join('\n');

    try {
      const res = await doFetch(API, {
        method: 'POST',
        headers: {
          'x-api-key': opts.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: 8000,
          system: systemPrompt(opts.founder),
          messages: [{ role: 'user', content: posts }],
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
      for (const raw of parseJsonArray(text)) {
        const s = typeof raw.i === 'number' ? batch[raw.i] : undefined;
        const a = s && normaliseAssessment(raw);
        if (s && a) results.set(s.id, a);
      }
    } catch (err) {
      // AI is an enhancement: if it fails, the heuristic ranking still ships.
      opts.log?.(`classify: batch ${start / BATCH + 1} failed — ${(err as Error).message}`);
    }
  }
  return results;
}

export function parseJsonArray(text: string): RawAssessment[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normaliseAssessment(r: RawAssessment): AiAssessment | undefined {
  if (typeof r.isRealPain !== 'boolean') return undefined;
  const wtp = r.willingnessToPay === 'explicit' || r.willingnessToPay === 'implied' ? r.willingnessToPay : 'none';
  return {
    isRealPain: r.isRealPain,
    problem: String(r.problem ?? '').slice(0, 200),
    who: String(r.who ?? '').slice(0, 100),
    willingnessToPay: wtp,
    niche: String(r.niche ?? '').toLowerCase().slice(0, 40),
    productIdea: String(r.productIdea ?? '').slice(0, 200),
    intentScore: Math.max(0, Math.min(90, Number(r.intentScore) || 0)),
    buildFit: r.buildFit === undefined ? undefined : Math.max(0, Math.min(10, Number(r.buildFit) || 0)),
    ideas: strings(r.ideas, 3, 120),
    competitors: strings(r.competitors, 3, 60),
    outreach: String(r.outreach ?? '').slice(0, 500),
  };
}

function strings(v: unknown, max: number, len: number): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, max).map((x) => x.trim().slice(0, len)) : [];
}
