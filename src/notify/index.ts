/**
 * Notification channels. Set the env vars for any you want; all configured
 * channels get the message. Telegram is the recommended default: free, reliable
 * from GitHub's servers, and supports feedback buttons later (docs/ROADMAP.md).
 * ntfy.sh's free tier is quota'd per IP, and GitHub runners share IPs, so the
 * public ntfy.sh server can silently drop messages from Actions — use a paid
 * ntfy tier or your own ntfy server if you prefer it.
 */
export interface Notifier {
  name: string;
  send(title: string, text: string, clickUrl?: string): Promise<void>;
}

async function post(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
}

export function configuredNotifiers(env: Record<string, string | undefined>): Notifier[] {
  const out: Notifier[] = [];

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    out.push({
      name: 'telegram',
      send: (_title, text) =>
        post(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
        }),
    });
  }

  if (env.DISCORD_WEBHOOK_URL) {
    out.push({
      name: 'discord',
      send: (_title, text) =>
        post(env.DISCORD_WEBHOOK_URL!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Wrap bare URLs in <> so Discord doesn't unfurl a preview for every link.
          body: JSON.stringify({ content: text.replace(/(https?:\/\/\S+)/g, '<$1>').slice(0, 2000) }),
        }),
    });
  }

  if (env.NTFY_TOPIC) {
    const server = (env.NTFY_SERVER ?? 'https://ntfy.sh').replace(/\/$/, '');
    out.push({
      name: 'ntfy',
      send: (title, text, clickUrl) =>
        post(`${server}/${env.NTFY_TOPIC}`, {
          method: 'POST',
          headers: {
            Title: title,
            Tags: 'satellite',
            ...(clickUrl ? { Click: clickUrl } : {}),
            ...(env.NTFY_TOKEN ? { Authorization: `Bearer ${env.NTFY_TOKEN}` } : {}),
          },
          body: text,
        }),
    });
  }

  return out;
}
