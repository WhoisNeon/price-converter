// Run: node check.mjs
// Guards the contract this app now depends on: currency labels come from the
// Chand API, not from a local map. Fails loudly if that API shape regresses.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const src = await readFile(new URL('./src/script.js', import.meta.url), 'utf8');

// 1. The hardcoded maps must stay gone.
assert.ok(!/CURRENCY_NAMES|CURRENCY_EN/.test(src), 'hardcoded currency map reintroduced');

// 2. esc() is load-bearing for remote strings — exercise the real one from source.
const esc = eval('(' + src.match(/const esc = \(s\) =>[\s\S]*?\)\);/)[0].replace('const esc = ', '').trim().replace(/;$/, '') + ')');
assert.equal(esc('<img onerror=x>'), '&lt;img onerror=x&gt;');
assert.equal(esc('a"b\'c&d'), 'a&quot;b&#39;c&amp;d');
assert.equal(esc(null), '');
assert.equal(esc('دلار آمریکا'), 'دلار آمریکا', 'persian labels must pass through intact');

// 3. Live API must supply every field the renderer reads.
const api = await fetch('https://chand.clf.dpdns.org/api').then((r) => r.json());
assert.ok(api.success, 'API reported failure');
for (const [code, info] of Object.entries(api.fiat)) {
    assert.ok(info.fa, `${code} missing fa`);
    assert.ok(info.en, `${code} missing en`);
    assert.equal(typeof info.sell, 'number', `${code} sell not numeric`);
}
assert.ok(api.fiat.AED, 'default currency AED missing');
assert.ok(api.updated_iso, 'updated_iso missing');

console.log(`OK — ${Object.keys(api.fiat).length} currencies, all fa/en/sell present`);
