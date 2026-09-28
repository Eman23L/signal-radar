/** Small, dependency-free text helpers. */

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
  '&#x2F;': '/',
  '&nbsp;': ' ',
};

/** Strip HTML tags and decode the common entities. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<(br|\/p|p)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (m, n: string) => ENTITIES[m] ?? String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Lowercase, straighten quotes, collapse whitespace — for phrase matching. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ');
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

const STOPWORDS = new Set(
  (
    'a an the and or but if then so of to in on at by for with from as is are was were be been being it its ' +
    'this that these those i me my we our you your he she they them their what which who whom how why when where ' +
    'there here do does did doing have has had having can could would should will shall may might must not no ' +
    'any all some more most other such only own same than too very just also about into over after before again ' +
    'up down out off once each few both nor s t don now im ive id dont cant wont isnt get got use using used ' +
    'like want need looking look anyone someone something anything thing things way ways know tool tools app ' +
    'apps software there help thanks please really good best one new make made work works working lot lots'
  ).split(' '),
);

/** Content words for similarity: lowercase, no stopwords, crude plural stripping. */
export function tokenize(text: string): string[] {
  return normalize(text)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .map((w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

/** Pull the first money amount out of text like "$500", "£1,200", "USD 50". */
export function parseMoney(text: string): { amount: number; currency: string } | undefined {
  const m = text.match(/([$£€])\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s?(k)?/i);
  if (!m) return undefined;
  const symbol = m[1] as '$' | '£' | '€';
  let amount = Number(m[2].replace(/,/g, ''));
  if (m[3]) amount *= 1000;
  const currency = { $: 'USD', '£': 'GBP', '€': 'EUR' }[symbol];
  return { amount, currency };
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
