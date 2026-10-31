---
name: llmgift
description: Gift someone a spending-capped, expiring LLM API key on OpenRouter or Vercel AI Gateway, and hand them a card with ready-to-paste setup for Claude Code, Codex, Cline, Aider and other tools. Use when the user wants to give, gift, send or share API credit, tokens or a capped key with a friend or teammate; list or check gifts they've sent; revoke a gift; or (as a recipient) check what's left on a gift key.
---

# llmgift

Creates a capped, expiring API key on the user's own provider account and produces a gift card for the recipient. The recipient needs no account; the giver's account pays, up to the cap.

## Before creating a gift

1. Confirm four things with the user, asking only for what they haven't said:
   - **Provider**: `openrouter` or `vercel`.
   - **Amount** in US dollars (Vercel's minimum is $1).
   - **Expiry**: default `7d`; accepts `12h`, `7d`, `2w`, an ISO date, or `never`.
   - **Who it's for** (name or email, shown on the card). Optional: a note, a model to fill into the snippets, and a reset period (`daily`, `weekly`, `monthly`) if the cap should refill.
2. Check the credentials are set, without printing them:
   - OpenRouter: `OPENROUTER_MANAGEMENT_KEY` (a management key, not a normal API key).
   - Vercel: `VERCEL_TOKEN` and `VERCEL_TEAM_ID`.
   If one is missing, tell the user where to create it (in the README) and stop.
3. Repeat the gift back in one line (provider, amount, expiry, recipient) and get a yes. Creating a gift spends the user's money.

## Creating it

```bash
npx -y llmgift create --provider <openrouter|vercel> --amount <dollars> --expires <7d> --to "<recipient>" --out <ref>.gift.md [--note "<text>"] [--model <model-id>] [--reset <period>]
```

Always use `--out` so the key goes to a file rather than into the conversation. Tell the user the file path, and that they should send the card privately: the key is shown only once and isn't stored anywhere else. Don't paste the key into chat, commits, issues or logs.

## Other commands

- `npx -y llmgift list`: gifts sent, with live spend.
- `npx -y llmgift revoke <ref>`: stop a gift early. On OpenRouter the key is deleted. Vercel has no delete API, so revoking shrinks the budget to what's been spent ($1 minimum); report the tool's message as written.
- `npx -y llmgift sweep`: revoke every expired gift.
- Recipient side: `npx -y llmgift balance --provider openrouter --key <key>` shows what's left. Vercel keys can only be checked by the giver.

## Limits to state plainly when relevant

- A gift key works in tools that accept an API key and base URL. It can't top up someone's ChatGPT, Claude.ai or Cursor subscription limits.
- Budgets are checked at the start of each request, so the last request can go slightly over the cap.
- Gifting your own usage to people you know is the intended use. Reselling keys may break provider terms.
