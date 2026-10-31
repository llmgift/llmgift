import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { randomBytes } from 'node:crypto';
import openrouter from './providers/openrouter.js';
import vercel from './providers/vercel.js';
import { giftCard } from './giftcard.js';
import { addGift, findGift, readGifts, updateGift } from './ledger.js';
import { GiftError, money, parseAmount, parseExpiry, parseReset } from './util.js';

export const PROVIDERS = { openrouter, vercel };

const HELP = `llmgift — gift someone a spending-capped, expiring LLM API key

Usage
  llmgift create --provider <openrouter|vercel> --amount <dollars> [options]
      --expires <12h|7d|2w|ISO date|never>   default 7d
      --reset <none|daily|weekly|monthly>     default none (one-time budget)
      --to <name or email>                    who it's for (shown on the card)
      --note <text>                           a message for the card
      --model <model-id>                      fill the setup snippets with this model
      --out <file>                            write the gift card to a file instead of printing it
  llmgift list                                gifts you've sent, with live spend
  llmgift revoke <ref>                        stop a gift early
  llmgift sweep                               revoke every gift that has expired
  llmgift balance --provider openrouter --key <key>   recipient: see what's left

Environment
  OpenRouter: OPENROUTER_MANAGEMENT_KEY
  Vercel AI Gateway: VERCEL_TOKEN and VERCEL_TEAM_ID
`;

function provider(id) {
  const p = PROVIDERS[String(id || '').toLowerCase()];
  if (!p) throw new GiftError(`Choose a provider: ${Object.keys(PROVIDERS).join(' or ')} (--provider).`);
  return p;
}

async function create(o) {
  const p = provider(o.provider);
  const amount = parseAmount(o.amount);
  const reset = parseReset(o.reset);
  const expiresAt = parseExpiry(o.expires ?? '7d');
  const ref = randomBytes(3).toString('hex');
  const name = `llmgift-${ref}${o.to ? `-${String(o.to).replace(/[^a-z0-9@._-]/gi, '').slice(0, 40)}` : ''}`;
  const { id, key } = await p.create({ name, amount, reset, expiresAt });
  addGift({ ref, provider: p.id, id, name, to: o.to || null, amount, reset, expiresAt: expiresAt?.toISOString() ?? null,
    createdAt: new Date().toISOString(), revoked: false });
  const card = giftCard({ provider: p, key, amount, reset, expiresAt, to: o.to, note: o.note, model: o.model });
  if (o.out) {
    fs.writeFileSync(o.out, card, { mode: 0o600 });
    console.log(`Gift ${ref} created: ${money(amount)} on ${p.name}${expiresAt ? `, expires ${expiresAt.toISOString()}` : ''}.`);
    console.log(`Gift card written to ${o.out}. Send it privately; the key is not stored anywhere else.`);
  } else {
    process.stdout.write(card);
    console.error(`\nGift ${ref} created. The key above is shown only once; send the card privately.`);
  }
}

async function list() {
  const gifts = readGifts();
  if (!gifts.length) return console.log('No gifts yet. Create one with "llmgift create".');
  for (const g of gifts) {
    let live = '';
    if (!g.revoked) {
      try {
        const s = await PROVIDERS[g.provider].status(g.id);
        live = ` spent ${money(s.spent)} of ${money(s.limit ?? g.amount)}${s.disabled ? ' (disabled)' : ''}`;
      } catch (e) { live = ` (status unavailable: ${e.message})`; }
    }
    const expired = g.expiresAt && Date.parse(g.expiresAt) < Date.now();
    console.log(`${g.ref}  ${g.provider.padEnd(10)} ${money(g.amount).padStart(8)}  ${(g.to || '').padEnd(24)} ` +
      `${g.revoked ? 'revoked' : expired ? 'expired' : `until ${g.expiresAt ?? 'never'}`}${live}`);
  }
}

async function revoke(ref) {
  const g = findGift(ref);
  if (!g) throw new GiftError(`No gift "${ref}". See "llmgift list".`);
  if (g.revoked) return console.log(`Gift ${g.ref} is already revoked.`);
  const r = await PROVIDERS[g.provider].revoke(g.id);
  if (r.revoked) updateGift(g.ref, { revoked: true, revokedAt: new Date().toISOString() });
  console.log(`Gift ${g.ref}: ${r.note}`);
}

async function sweep() {
  const due = readGifts().filter((g) => !g.revoked && g.expiresAt && Date.parse(g.expiresAt) < Date.now());
  if (!due.length) return console.log('Nothing to sweep.');
  for (const g of due) await revoke(g.ref).catch((e) => console.error(`Gift ${g.ref}: ${e.message}`));
}

async function balance(o) {
  if (!o.key) throw new GiftError('Pass the gift key with --key.');
  const b = await provider(o.provider || 'openrouter').balance(o.key);
  console.log(`Spent ${money(b.spent)} of ${money(b.limit)} — ${money(b.remaining)} left` +
    `${b.reset ? ` (resets ${b.reset})` : ''}${b.expiresAt ? `, expires ${b.expiresAt}` : ''}.`);
}

export async function main(argv) {
  const { values: o, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      provider: { type: 'string', short: 'p' }, amount: { type: 'string', short: 'a' },
      expires: { type: 'string', short: 'e' }, reset: { type: 'string' }, to: { type: 'string' },
      note: { type: 'string' }, model: { type: 'string', short: 'm' }, out: { type: 'string', short: 'o' },
      key: { type: 'string', short: 'k' }, help: { type: 'boolean', short: 'h' },
    },
  });
  const [cmd, arg] = positionals;
  if (o.help || !cmd) return console.log(HELP);
  try {
    if (cmd === 'create') return await create(o);
    if (cmd === 'list') return await list();
    if (cmd === 'revoke') return await revoke(arg);
    if (cmd === 'sweep') return await sweep();
    if (cmd === 'balance') return await balance(o);
    throw new GiftError(`Unknown command "${cmd}".\n\n${HELP}`);
  } catch (e) {
    if (!(e instanceof GiftError)) throw e;
    console.error(`llmgift: ${e.message}`);
    process.exitCode = 1;
  }
}
