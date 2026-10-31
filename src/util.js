// Small helpers shared by the CLI and providers. No dependencies.

export class GiftError extends Error {}

const DURATION = /^(\d+)\s*(h|d|w)$/i;

/** Parse "7d", "12h", "2w", an ISO date, or "never" into a Date (or null for never). */
export function parseExpiry(value, now = new Date()) {
  if (value == null || value === '' || /^(never|none)$/i.test(value)) return null;
  const m = String(value).match(DURATION);
  if (m) {
    const hours = { h: 1, d: 24, w: 168 }[m[2].toLowerCase()] * Number(m[1]);
    return new Date(now.getTime() + hours * 3600_000);
  }
  const t = Date.parse(value);
  if (Number.isNaN(t)) throw new GiftError(`Can't read expiry "${value}". Use 12h, 7d, 2w, an ISO date, or "never".`);
  if (t <= now.getTime()) throw new GiftError(`Expiry "${value}" is in the past.`);
  return new Date(t);
}

/** Parse "$20", "20", "12.50" into a positive number of US dollars. */
export function parseAmount(value) {
  const n = Number(String(value ?? '').replace(/^\$/, ''));
  if (!Number.isFinite(n) || n <= 0) throw new GiftError(`Amount must be a positive dollar value, got "${value}".`);
  return Math.round(n * 100) / 100;
}

export const RESETS = ['none', 'daily', 'weekly', 'monthly'];

export function parseReset(value) {
  const v = String(value ?? 'none').toLowerCase();
  if (!RESETS.includes(v)) throw new GiftError(`Reset must be one of ${RESETS.join(', ')}.`);
  return v;
}

export function requireEnv(name, hint) {
  const v = process.env[name];
  if (!v) throw new GiftError(`${name} is not set. ${hint}`);
  return v;
}

/** fetch wrapper that turns non-2xx responses into readable errors without echoing secrets. */
export async function request(url, { method = 'GET', token, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 300) }; }
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || data?.raw || res.statusText;
    throw new GiftError(`${method} ${new URL(url).pathname} failed (${res.status}): ${msg}`);
  }
  return data;
}

export const money = (n) => (n == null ? '—' : `$${Number(n).toFixed(2)}`);
