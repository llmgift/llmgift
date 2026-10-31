// Builds the gift card the recipient receives: key, limits and ready-to-paste setup per tool.
import { money } from './util.js';

const fence = (lang, body) => '```' + lang + '\n' + body.trim() + '\n```';

export function giftCard({ provider: p, key, amount, reset, expiresAt, to, note, model }) {
  const m = model || '<model-id>';
  const expires = expiresAt ? expiresAt.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : 'never';
  const lines = [
    `# 🎁 You've been gifted ${money(amount)} of AI credit${to ? ` — for ${to}` : ''}`,
    '',
    note ? `> ${note}\n` : '',
    `| | |`,
    `|---|---|`,
    `| Provider | ${p.name} |`,
    `| Spending cap | ${money(amount)}${reset !== 'none' ? `, refreshed ${reset}` : ''} |`,
    `| Expires | ${expires} |`,
    `| API base URL (OpenAI-compatible) | \`${p.openaiBaseUrl}\` |`,
    `| Your key | \`${key}\` |`,
    '',
    'Keep the key private: anyone holding it can spend your gift. No account or signup is needed.',
    `Pick any model from ${p.modelsUrl} and use its id where you see \`${m}\`.`,
    '',
    '## Claude Code',
    fence('bash', `
export ANTHROPIC_BASE_URL="${p.anthropicBaseUrl}"
export ANTHROPIC_AUTH_TOKEN="${key}"
export ANTHROPIC_API_KEY=""   # must be empty
export CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1
claude   # then /model to pick a model`),
    '',
    '## Codex CLI',
    `Add to \`~/.codex/config.toml\`, then \`export ${p.codex.envKey}="${key}"\` and run \`codex\`:`,
    fence('toml', `
model_provider = "${p.id}"
model = "${m}"

[model_providers.${p.id}]
name = "${p.codex.name}"
base_url = "${p.codex.baseUrl}"
env_key = "${p.codex.envKey}"
wire_api = "responses"`),
    '',
    '## Cline, Roo Code, Continue, Open WebUI, LibreChat and other "OpenAI compatible" tools',
    `Choose the **OpenAI Compatible** provider, set Base URL to \`${p.openaiBaseUrl}\`, paste the key, and enter \`${m}\` as the model.`,
    '',
    '## Aider',
    fence('bash', p.id === 'openrouter'
      ? `export OPENROUTER_API_KEY="${key}"\naider --model openrouter/${m}`
      : `export OPENAI_API_BASE="${p.openaiBaseUrl}"\nexport OPENAI_API_KEY="${key}"\naider --model openai/${m}`),
    '',
    '## Quick test',
    fence('bash', `
curl ${p.openaiBaseUrl}/chat/completions \\
  -H "Authorization: Bearer ${key}" -H "Content-Type: application/json" \\
  -d '{"model":"${m}","messages":[{"role":"user","content":"Say hi"}]}'`),
    '',
    '## How much is left?',
    p.recipientBalance
      ? fence('bash', `npx llmgift balance --provider ${p.id} --key ${key}`)
      : 'Ask the person who gifted it. They can see your remaining balance with `llmgift list`.',
    '',
    '---',
    'Sent with [llmgift](https://github.com/llmgift/llmgift).',
  ];
  return lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n') + '\n';
}
