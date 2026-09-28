/** A tiny Atom parser — just enough for Reddit's RSS. No dependencies. */
import { stripHtml } from './text.ts';

export interface FeedEntry {
  id: string;
  title: string;
  content: string;
  author?: string;
  link?: string;
  updated?: string;
}

function tag(xml: string, name: string): string | undefined {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m?.[1];
}

function decode(s: string): string {
  return s
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export function parseAtom(xml: string): FeedEntry[] {
  const entries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) ?? [];
  return entries.map((e) => ({
    id: decode(tag(e, 'id') ?? '').trim(),
    title: stripHtml(decode(tag(e, 'title') ?? '')),
    content: stripHtml(decode(tag(e, 'content') ?? '')),
    author: tag(tag(e, 'author') ?? '', 'name')?.trim(),
    link: e.match(/<link[^>]*href="([^"]+)"/)?.[1],
    updated: (tag(e, 'published') ?? tag(e, 'updated'))?.trim(),
  }));
}
