# llmgift

Gift someone a **spending-capped, expiring LLM API key**, with a card that tells them exactly how to use it in Claude Code, Codex, Cline, Aider and other tools.

```bash
npx llmgift create --provider openrouter --amount 20 --expires 7d --to "Sam" --out sam.gift.md
```

Sam gets a key that can spend at most $20 and stops working in 7 days. They don't need an account anywhere: your account pays, up to the cap. You can see what they've spent and revoke it early.

## What it is (and isn't)

- **It is** a capped API key on *your* provider account, plus ready-to-paste setup for the recipient.
- **It isn't** a way to top up someone's ChatGPT, Claude.ai or Cursor subscription limits. Those can't be transferred. A gift key works in tools that accept an API key and base URL.

## Providers

| Provider | Create capped key | Expiry | Revoke | Recipient can check balance |
|---|---|---|---|---|
| [OpenRouter](https://openrouter.ai) | ✅ | ✅ | ✅ deletes the key | ✅ `llmgift balance` |
| [Vercel AI Gateway](https://vercel.com/ai-gateway) | ✅ ($1 minimum) | ✅ | ⚠️ shrinks the budget to what's spent* | ❌ giver only (`llmgift list`) |

\* Vercel has no public API to delete a key, so revoking sets the budget to what's already been spent (Vercel's minimum budget is $1). To stop a key completely, delete it in the Vercel dashboard.

More providers are welcome. The one requirement is an API that creates keys with a per-key spending cap. See [Contributing](#contributing).

## Setup (for the giver)

Requires Node.js 18 or later.

**OpenRouter.** Create a management key at <https://openrouter.ai/settings/management-keys> (normal API keys can't create other keys), then:

```bash
export OPENROUTER_MANAGEMENT_KEY="sk-or-v1-..."
```

**Vercel AI Gateway.** Create an access token at <https://vercel.com/account/tokens> and find your team ID in the team settings, then:

```bash
export VERCEL_TOKEN="..."
export VERCEL_TEAM_ID="team_..."
```

Your account needs credit (or a payment method). The cap limits what the gift can spend; it doesn't reserve money.

## Usage

```bash
# Create a gift: $20, one-time budget, expires in 7 days, card written to a file
npx llmgift create -p openrouter -a 20 -e 7d --to "Sam" --note "Happy hacking!" -m <model-id> -o sam.gift.md

# A $10 budget that refills weekly, for a month
npx llmgift create -p vercel -a 10 --reset weekly -e 30d --to "Alex" -o alex.gift.md

npx llmgift list            # gifts you've sent, with live spend
npx llmgift revoke 3fa9c1   # stop one early
npx llmgift sweep           # revoke every expired gift

# Recipient: what's left on an OpenRouter gift key
npx llmgift balance --provider openrouter --key sk-or-v1-...
```

| Option | Meaning |
|---|---|
| `-p, --provider` | `openrouter` or `vercel` |
| `-a, --amount` | Spending cap in US dollars |
| `-e, --expires` | `12h`, `7d`, `2w`, an ISO date, or `never` (default `7d`) |
| `--reset` | `none` (default), `daily`, `weekly` or `monthly`: refill the cap on that schedule |
| `--to` | Who it's for, shown on the card |
| `--note` | A message for the card |
| `-m, --model` | Model id to fill into the setup snippets |
| `-o, --out` | Write the card to this file instead of printing it |

The gift card includes setup for Claude Code, Codex CLI, OpenAI-compatible tools (Cline, Roo Code, Continue, Open WebUI, LibreChat), Aider, and a `curl` test.

## Claude Code skill

`skills/llmgift/SKILL.md` lets you just ask Claude Code: *"gift Sam $20 of OpenRouter credit for a week"*. To install it:

```bash
git clone https://github.com/llmgift/llmgift
mkdir -p ~/.claude/skills && cp -r llmgift/skills/llmgift ~/.claude/skills/
```

## Security

- The key is shown **once**, on the card. llmgift keeps a local record of gifts in `~/.llmgift/gifts.json` (ids, amounts, recipients, expiry) but **never stores the key**.
- Send cards privately. Anyone with the key can spend the gift.
- Budgets are checked at the start of each request, so the final request can go slightly over the cap.
- Gifting your own usage to people you know is the intended use. Reselling keys may break your provider's terms.

## Contributing

Issues and pull requests are welcome. A provider is one file in `src/providers/` that implements `create`, `status`, `revoke` and `balance`, plus its base URLs for the gift card. Run `npm test` before opening a PR.

## License

[MIT](LICENSE)
