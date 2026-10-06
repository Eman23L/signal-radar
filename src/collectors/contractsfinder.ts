/**
 * UK Contracts Finder — OCDS search API (no key, Open Government Licence).
 * Docs: https://www.contractsfinder.service.gov.uk/apidocumentation/Notices/1/GET-Published-Notice-OCDS-Search
 *
 * Covers lower-value public contracts (from about £12k, £30k for local government)
 * that never reach Find a Tender: the size a small SaaS can actually win.
 *
 * Checked live (Oct 2026): `stages=tender` / `stages=planning` filter correctly here
 * (unlike Find a Tender), `size` ≤ 100, and there is no paging: about 5 tender notices
 * a day, so one page per stage is plenty. Notice pages block non-browser clients
 * (403), which is fine: the link is for a person to open.
 */
import type { RadarConfig } from '../config.ts';
import type { Collector, Signal } from '../types.ts';
import { normalize, stripHtml, truncate } from '../util/text.ts';

const API = 'https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search';
const STAGES = ['tender', 'planning'] as const;

interface Release {
  id: string;
  ocid: string;
  date?: string;
  tag?: string[];
  buyer?: { name?: string };
  tender?: {
    title?: string;
    description?: string;
    datePublished?: string;
    value?: { amount?: number; currency?: string };
    minValue?: { amount?: number; currency?: string };
    classification?: { id?: string };
  };
}

export function contractsFinder(config: RadarConfig): Collector {
  const opts = config.sources.contractsfinder;
  return {
    name: 'contractsfinder',
    async collect(ctx) {
      const from = ctx.since.toISOString().slice(0, 19);
      const out = new Map<string, Signal>();
      for (const stage of STAGES) {
        const res = (await ctx.fetch(`${API}?publishedFrom=${from}&stages=${stage}&size=100`)) as { releases?: Release[] };
        for (const r of res.releases ?? []) {
          if (!r.tag?.includes(stage)) continue; // amendments repeat the same notice
          const cpv = r.tender?.classification?.id ?? '';
          if (!opts.cpvPrefixes.some((p) => cpv.startsWith(p))) continue;
          const title = r.tender?.title ?? '(untitled notice)';
          const description = stripHtml(r.tender?.description);
          if (opts.keywords.length) {
            const text = normalize(`${title} ${description}`);
            if (!opts.keywords.some((k) => text.includes(k.toLowerCase()))) continue;
          }
          const value = r.tender?.value ?? r.tender?.minValue;
          const guid = r.id.replace(/-\d+$/, '');
          out.set(r.ocid, {
            id: `contractsfinder:${r.ocid}`,
            source: 'contractsfinder',
            kind: 'tender',
            title: `${stage === 'planning' ? '[early engagement] ' : ''}${r.buyer?.name ?? 'UK public body'}: ${title}`,
            body: truncate(description, 1500),
            url: `https://www.contractsfinder.service.gov.uk/notice/${guid}`,
            author: r.buyer?.name,
            createdAt: r.tender?.datePublished ?? r.date ?? ctx.now.toISOString(),
            engagement: {},
            money: value?.amount ? { amount: value.amount, currency: value.currency ?? 'GBP' } : undefined,
            tags: [`stage:${stage}`, `cpv:${cpv}`],
          });
        }
        await ctx.delay(1000);
      }
      return [...out.values()];
    },
  };
}
