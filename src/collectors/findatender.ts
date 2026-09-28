/**
 * UK Find a Tender service — OCDS release packages (Open Government Licence).
 * Docs: https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages
 * Params: updatedFrom/updatedTo (YYYY-MM-DDTHH:MM:SS), stages (planning,tender,award),
 * limit (≤100), cursor. 429/503 come with Retry-After (handled by the HTTP fetcher).
 *
 * Public bodies buying software/IT services = proven demand with a budget attached,
 * and a list of what the public sector keeps paying for.
 */
import type { RadarConfig } from '../config.ts';
import type { Collector, Signal } from '../types.ts';
import { normalize, stripHtml, truncate } from '../util/text.ts';

const API = 'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages';
const MAX_PAGES = 5;

interface Classification {
  id?: string;
  description?: string;
}
interface Release {
  id: string;
  ocid: string;
  date?: string;
  buyer?: { name?: string };
  tender?: {
    title?: string;
    description?: string;
    value?: { amount?: number; currency?: string };
    classification?: Classification;
    items?: { classification?: Classification; additionalClassifications?: Classification[] }[];
    tenderPeriod?: { endDate?: string };
  };
}
interface Package {
  releases?: Release[];
  links?: { next?: string };
  cursor?: string;
}

export function findATender(config: RadarConfig): Collector {
  const opts = config.sources.findatender;
  return {
    name: 'findatender',
    async collect(ctx) {
      const from = ctx.since.toISOString().slice(0, 19);
      let url: string | undefined = `${API}?updatedFrom=${from}&stages=tender&limit=100`;
      const out = new Map<string, Signal>();

      for (let page = 0; url && page < MAX_PAGES; page++) {
        const res = (await ctx.fetch(url)) as Package;
        for (const r of res.releases ?? []) {
          const cpvs = cpvCodes(r);
          if (!cpvs.some((c) => opts.cpvPrefixes.some((p) => c.startsWith(p)))) continue;
          const title = r.tender?.title ?? '(untitled tender)';
          const description = stripHtml(r.tender?.description);
          if (opts.keywords.length) {
            const text = normalize(`${title} ${description}`);
            if (!opts.keywords.some((k) => text.includes(k.toLowerCase()))) continue;
          }
          const noticeId = r.id.match(/\d{6}-\d{4}/)?.[0];
          const value = r.tender?.value;
          out.set(r.ocid, {
            id: `findatender:${r.ocid}`,
            source: 'findatender',
            kind: 'tender',
            title: `${r.buyer?.name ?? 'UK public body'}: ${title}`,
            body: truncate(description, 1500),
            url: noticeId
              ? `https://www.find-tender.service.gov.uk/Notice/${noticeId}`
              : `https://www.find-tender.service.gov.uk/Search/Results?keywords=${encodeURIComponent(r.ocid)}`,
            author: r.buyer?.name,
            createdAt: r.date ?? ctx.now.toISOString(),
            engagement: {},
            money: value?.amount ? { amount: value.amount, currency: value.currency ?? 'GBP' } : undefined,
            tags: [...new Set(cpvs.map((c) => `cpv:${c}`))].slice(0, 5),
          });
        }
        url = res.links?.next ?? (res.cursor ? `${API}?updatedFrom=${from}&stages=tender&limit=100&cursor=${encodeURIComponent(res.cursor)}` : undefined);
        await ctx.delay(1000);
      }
      return [...out.values()];
    },
  };
}

function cpvCodes(r: Release): string[] {
  const t = r.tender;
  if (!t) return [];
  const codes = [t.classification?.id];
  for (const item of t.items ?? []) {
    codes.push(item.classification?.id);
    for (const c of item.additionalClassifications ?? []) codes.push(c.id);
  }
  return codes.filter((c): c is string => Boolean(c));
}
