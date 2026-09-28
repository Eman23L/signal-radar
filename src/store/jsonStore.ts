/**
 * Plain JSON files in /data, committed back to the repo by the GitHub Action.
 * That gives free persistence, a browsable history on GitHub, and a commit
 * every day — which also stops GitHub disabling the schedule after 60 idle days.
 *
 *   data/seen.json                 id → first-seen day (dedupe across runs)
 *   data/signals/YYYY-MM-DD.json   everything new that day, scored
 *   data/digests/YYYY-MM-DD.md     the human-readable digest
 *   data/latest.md                 copy of the newest digest
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Signal } from '../types.ts';

const SEEN_TTL_DAYS = 60;

export class JsonStore {
  dir: string;
  constructor(dir: string) {
    this.dir = dir;
  }

  async loadSeen(): Promise<Record<string, string>> {
    try {
      return JSON.parse(await readFile(join(this.dir, 'seen.json'), 'utf8'));
    } catch {
      return {};
    }
  }

  async saveSeen(seen: Record<string, string>, today: string): Promise<void> {
    const cutoff = new Date(Date.parse(today) - SEEN_TTL_DAYS * 86_400_000).toISOString().slice(0, 10);
    const pruned = Object.fromEntries(Object.entries(seen).filter(([, day]) => day >= cutoff).sort());
    await this.write('seen.json', JSON.stringify(pruned, null, 0));
  }

  async saveSignals(day: string, signals: Signal[]): Promise<void> {
    // Merge with anything already saved today (e.g. a manual re-run).
    const existing = await this.loadDay(day);
    const merged = new Map([...existing, ...signals].map((s) => [s.id, s]));
    await this.write(join('signals', `${day}.json`), JSON.stringify([...merged.values()], null, 1));
  }

  async loadDay(day: string): Promise<Signal[]> {
    try {
      return JSON.parse(await readFile(join(this.dir, 'signals', `${day}.json`), 'utf8'));
    } catch {
      return [];
    }
  }

  /** All stored signals from the last `days` days (for spotting repeated pain). */
  async loadWindow(today: string, days: number): Promise<Signal[]> {
    const cutoff = new Date(Date.parse(today) - days * 86_400_000).toISOString().slice(0, 10);
    let files: string[] = [];
    try {
      files = await readdir(join(this.dir, 'signals'));
    } catch {
      return [];
    }
    const out: Signal[] = [];
    for (const f of files.filter((f) => f.endsWith('.json') && f.slice(0, 10) >= cutoff).sort()) {
      out.push(...(await this.loadDay(f.slice(0, 10))));
    }
    return out;
  }

  async saveDigest(day: string, markdown: string): Promise<void> {
    await this.write(join('digests', `${day}.md`), markdown);
    await this.write('latest.md', markdown);
  }

  private async write(rel: string, content: string) {
    const path = join(this.dir, rel);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, content.endsWith('\n') ? content : content + '\n');
  }
}
