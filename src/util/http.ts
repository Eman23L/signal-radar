import type { Fetcher, TextFetcher } from '../types.ts';

const USER_AGENT = 'signal-radar/0.1 (+https://github.com/Eman23L/signal-radar)';

export class HttpError extends Error {
  status: number;
  constructor(status: number, url: string, body: string) {
    super(`HTTP ${status} for ${redact(url)}: ${body.slice(0, 200)}`);
    this.status = status;
  }
}

/** Hide API keys that live in query strings before anything gets logged. */
export function redact(url: string): string {
  return url.replace(/([?&](key|token|access_token)=)[^&]+/gi, '$1***');
}

/** Fetch with a timeout and one polite retry on 429 / 5xx. Returns the body as text. */
export function createTextFetcher(timeoutMs = 20_000): TextFetcher {
  return async function fetchText(url, init = {}) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, {
        ...init,
        headers: { 'User-Agent': USER_AGENT, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return res.text();
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt === 0) {
        const wait = Math.min(Number(res.headers.get('retry-after') ?? 5) || 5, 30) * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw new HttpError(res.status, url, await res.text().catch(() => ''));
    }
  };
}

export function createHttpFetcher(timeoutMs = 20_000): Fetcher {
  const text = createTextFetcher(timeoutMs);
  return async (url, init = {}) => {
    const body = await text(url, { ...init, headers: { Accept: 'application/json', ...(init.headers ?? {}) } });
    return body ? JSON.parse(body) : null;
  };
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
