// Local record of gifts sent, so they can be listed and revoked later.
// Stores only ids and metadata, never the key itself.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const file = () => process.env.LLMGIFT_LEDGER || path.join(os.homedir(), '.llmgift', 'gifts.json');

export function readGifts() {
  try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return []; }
}

export function writeGifts(gifts) {
  fs.mkdirSync(path.dirname(file()), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file(), JSON.stringify(gifts, null, 2) + '\n', { mode: 0o600 });
}

export function addGift(gift) {
  const gifts = readGifts();
  gifts.push(gift);
  writeGifts(gifts);
}

export function findGift(ref) {
  const gifts = readGifts();
  return gifts.find((g) => g.ref === ref || g.id === ref || g.name === ref) || null;
}

export function updateGift(ref, patch) {
  const gifts = readGifts().map((g) => (g.ref === ref ? { ...g, ...patch } : g));
  writeGifts(gifts);
}
