// Marks idle grains whose 2 to 6 kHz tonal peak stands more than OVER dB above the recording's own median as not ok (a whine in a
// stretch of it, not its usual tone), writes the bank to .scratch/engine-review/banks/ and reports how many.
//   node tools/engine-review/dewhine.mjs <bank name> [over]
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [name, over = '5.5'] = process.argv.slice(2);
const out = execFileSync('node', ['tools/engine-review/srcscan.mjs', name, 'idle', '0-999']).toString();
const median = +out.match(/tonal peak median ([\d.-]+) dB/)[1];
const thr = median + +over;
const hot = new Set();
for (const m of out.matchAll(/^\s+([\d.]+) s.*?: \d+ Hz ([\d.-]+) dB/gm)) if (+m[2] > +thr) hot.add(m[1]);
const bank = JSON.parse((await import('node:fs')).readFileSync(`public/audio/${name}.json`, 'utf8'));
let n = 0;
for (const g of bank.grains) if (g.kind === 'idle' && g.ok !== false && hot.has(g.start.toFixed(3))) { g.ok = false; n++; }
mkdirSync('.scratch/engine-review/banks', { recursive: true });
writeFileSync(`.scratch/engine-review/banks/${name}.json`, JSON.stringify(bank));
console.log(`${name}: ${n} of ${bank.grains.filter((g) => g.kind === 'idle').length} idle grains over ${thr.toFixed(1)} dB (median ${median} + ${over}) marked not ok`);
