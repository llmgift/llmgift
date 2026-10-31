// OpenRouter: capped keys through the key-management API.
// Docs: https://openrouter.ai/docs/api/api-reference/api-keys/create-keys.md
import { request, requireEnv } from '../util.js';

const API = 'https://openrouter.ai/api/v1';
const managementKey = () =>
  requireEnv('OPENROUTER_MANAGEMENT_KEY', 'Create a management key at https://openrouter.ai/settings/management-keys.');

/** OpenRouter wants ISO 8601 UTC with seconds and no milliseconds. */
const isoSeconds = (date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

export default {
  id: 'openrouter',
  name: 'OpenRouter',
  openaiBaseUrl: `${API}`,
  anthropicBaseUrl: 'https://openrouter.ai/api',
  codex: { name: 'OpenRouter', baseUrl: API, envKey: 'OPENROUTER_API_KEY' },
  keyEnv: 'OPENROUTER_API_KEY',
  modelsUrl: 'https://openrouter.ai/models',
  recipientBalance: true,

  async create({ name, amount, reset, expiresAt }) {
    const res = await request(`${API}/keys`, {
      method: 'POST',
      token: managementKey(),
      body: {
        name,
        limit: amount,
        limit_reset: reset === 'none' ? null : reset,
        expires_at: expiresAt ? isoSeconds(expiresAt) : null,
      },
    });
    return { id: res.data.hash, key: res.key };
  },

  async status(id) {
    const { data } = await request(`${API}/keys/${encodeURIComponent(id)}`, { token: managementKey() });
    return { spent: data.usage, limit: data.limit, remaining: data.limit_remaining, disabled: data.disabled, expiresAt: data.expires_at };
  },

  async revoke(id) {
    await request(`${API}/keys/${encodeURIComponent(id)}`, { method: 'DELETE', token: managementKey() });
    return { revoked: true, note: 'Key deleted.' };
  },

  /** Recipient-side: what's left on a key, using the key itself. */
  async balance(key) {
    const { data } = await request(`${API}/key`, { token: key });
    return { spent: data.usage, limit: data.limit, remaining: data.limit_remaining, reset: data.limit_reset, expiresAt: data.expires_at };
  },
};
