import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseAmount, parseExpiry, parseReset, GiftError } from '../src/util.js';
import { giftCard } from '../src/giftcard.js';
import openrouter from '../src/providers/openrouter.js';
import vercel from '../src/providers/vercel.js';
import { main } from '../src/cli.js';

const NOW = new Date('2026-11-01T00:00:00Z');

test('parses amounts, resets and expiry', () => {
  assert.equal(parseAmount('$20'), 20);
  assert.equal(parseAmount('12.345'), 12.35);
  assert.throws(() => parseAmount('0'), GiftError);
  assert.equal(parseReset(undefined), 'none');
  assert.throws(() => parseReset('hourly'), GiftError);
  assert.equal(parseExpiry('7d', NOW).toISOString(), '2026-11-08T00:00:00.000Z');
  assert.equal(parseExpiry('12h', NOW).toISOString(), '2026-11-01T12:00:00.000Z');
  assert.equal(parseExpiry('never', NOW), null);
  assert.throws(() => parseExpiry('2020-01-01', NOW), GiftError);
});

for (const p of [openrouter, vercel]) {
  test(`gift card for ${p.id} has the key, base URLs and every tool section`, () => {
    const card = giftCard({ provider: p, key: 'sk-test-123', amount: 20, reset: 'none', expiresAt: NOW, to: 'Sam', model: 'some/model' });
    for (const s of ['sk-test-123', p.openaiBaseUrl, p.anthropicBaseUrl, p.codex.baseUrl, '## Claude Code', '## Codex CLI', '## Aider', '$20.00', 'some/model'])
      assert.ok(card.includes(s), `missing ${s}`);
  });
}

function withFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null, auth: init.headers?.Authorization });
    const { status = 200, json } = handler(String(url), init);
    return new Response(JSON.stringify(json), { status });
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('openrouter create sends limit, reset and second-precision expiry', async () => {
  process.env.OPENROUTER_MANAGEMENT_KEY = 'mgmt';
  const f = withFetch(() => ({ status: 201, json: { key: 'sk-or-v1-x', data: { hash: 'h1' } } }));
  try {
    const r = await openrouter.create({ name: 'n', amount: 20, reset: 'weekly', expiresAt: new Date('2026-11-08T00:00:00.123Z') });
    assert.deepEqual(r, { id: 'h1', key: 'sk-or-v1-x' });
    assert.equal(f.calls[0].url, 'https://openrouter.ai/api/v1/keys');
    assert.deepEqual(f.calls[0].body, { name: 'n', limit: 20, limit_reset: 'weekly', expires_at: '2026-11-08T00:00:00Z' });
    assert.equal(f.calls[0].auth, 'Bearer mgmt');
  } finally { f.restore(); }
});

test('vercel create sends an ai-gateway key with a quota and ms expiry', async () => {
  process.env.VERCEL_TOKEN = 'vt'; process.env.VERCEL_TEAM_ID = 'team_1';
  const f = withFetch(() => ({ json: { apiKeyString: 'vck', apiKey: { id: 'k1' } } }));
  try {
    const r = await vercel.create({ name: 'n', amount: 5, reset: 'none', expiresAt: NOW });
    assert.deepEqual(r, { id: 'k1', key: 'vck' });
    assert.equal(f.calls[0].url, 'https://api.vercel.com/v1/api-keys?teamId=team_1');
    assert.deepEqual(f.calls[0].body, { purpose: 'ai-gateway', name: 'n', expiresAt: NOW.getTime(), aiGatewayQuota: { limitAmount: 5, refreshPeriod: 'none' } });
  } finally { f.restore(); }
  await assert.rejects(vercel.create({ name: 'n', amount: 0.5, reset: 'none', expiresAt: null }), GiftError);
});

test('create writes the card to a file and records the gift without the key', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llmgift-'));
  process.env.LLMGIFT_LEDGER = path.join(dir, 'gifts.json');
  process.env.OPENROUTER_MANAGEMENT_KEY = 'mgmt';
  const out = path.join(dir, 'card.md');
  const f = withFetch(() => ({ status: 201, json: { key: 'sk-or-v1-secret', data: { hash: 'h9' } } }));
  const log = console.log; console.log = () => {};
  try {
    await main(['create', '--provider', 'openrouter', '--amount', '10', '--to', 'Sam', '--out', out]);
  } finally { f.restore(); console.log = log; }
  assert.ok(fs.readFileSync(out, 'utf8').includes('sk-or-v1-secret'));
  const ledger = fs.readFileSync(process.env.LLMGIFT_LEDGER, 'utf8');
  assert.ok(ledger.includes('"id": "h9"'));
  assert.ok(!ledger.includes('sk-or-v1-secret'), 'ledger must not store the key');
});
