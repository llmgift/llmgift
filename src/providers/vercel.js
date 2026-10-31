// Vercel AI Gateway: keys with an aiGatewayQuota budget through the Vercel REST API.
// Docs: https://vercel.com/docs/ai-gateway/observability-and-spend/api-key-budgets
import { GiftError, request, requireEnv } from '../util.js';

const API = 'https://api.vercel.com';
const token = () => requireEnv('VERCEL_TOKEN', 'Create a Vercel access token at https://vercel.com/account/tokens.');
const team = () => requireEnv('VERCEL_TEAM_ID', 'Set it to the team that holds your AI Gateway credits.');
const q = () => `teamId=${encodeURIComponent(team())}`;

export default {
  id: 'vercel',
  name: 'Vercel AI Gateway',
  openaiBaseUrl: 'https://ai-gateway.vercel.sh/v1',
  anthropicBaseUrl: 'https://ai-gateway.vercel.sh/claude-code',
  codex: { name: 'Vercel AI Gateway', baseUrl: 'https://ai-gateway.vercel.sh/codex/v1', envKey: 'AI_GATEWAY_API_KEY' },
  keyEnv: 'AI_GATEWAY_API_KEY',
  modelsUrl: 'https://vercel.com/ai-gateway/models',
  recipientBalance: false,

  async create({ name, amount, reset, expiresAt }) {
    if (amount < 1) throw new GiftError('Vercel AI Gateway budgets start at $1.');
    const res = await request(`${API}/v1/api-keys?${q()}`, {
      method: 'POST',
      token: token(),
      body: {
        purpose: 'ai-gateway',
        name,
        ...(expiresAt ? { expiresAt: expiresAt.getTime() } : {}),
        aiGatewayQuota: { limitAmount: amount, refreshPeriod: reset },
      },
    });
    return { id: res.apiKey.id, key: res.apiKeyString };
  },

  async status(id) {
    const res = await request(`${API}/ai-gateway/budgets/list?${q()}&scopeType=api-key`, { token: token() });
    const rows = res.budgets || res.data || res.items || [];
    const row = rows.find((b) => [b.apiKeyId, b.scopeId, b.id, b.quotaEntityId].includes(id) || b.scope?.id === id);
    if (!row) return { spent: null, limit: null, remaining: null };
    const spent = Number(row.currentSpend ?? row.spent ?? 0), limit = Number(row.limitAmount ?? row.limit);
    return { spent, limit, remaining: Number.isFinite(limit) ? Math.max(0, limit - spent) : null };
  },

  /**
   * Vercel has no public delete-key endpoint, so revoking shrinks the budget to what's already spent
   * (budgets have a $1 minimum). The key also stops at its expiry date.
   */
  async revoke(id) {
    const { spent } = await this.status(id);
    const limitAmount = Math.max(1, Math.ceil((spent ?? 0) * 100) / 100);
    await request(`${API}/v1/api-keys/${encodeURIComponent(id)}/quota?${q()}`, {
      method: 'PATCH',
      token: token(),
      body: { limitAmount, refreshPeriod: 'none' },
    });
    const left = Math.max(0, limitAmount - (spent ?? 0));
    return {
      revoked: left === 0,
      note: left === 0
        ? 'Budget shrunk to what was already spent; the key can no longer spend.'
        : `Budget shrunk to Vercel's $1 minimum; up to $${left.toFixed(2)} can still be spent. Delete the key in the Vercel dashboard to stop it completely.`,
    };
  },

  async balance() {
    throw new GiftError('Vercel AI Gateway keys can only be checked by the giver: run "llmgift list".');
  },
};
