// Where a cycle's even cut into firings lands: the level in the 1 ms at each cut against the firing's own RMS (high means it
// starts mid-sound), and where in each slice its loudest moment falls (0 the start, 1 the end).
//   node tools/engine-review/cuts.mjs <bank> <split> [kind]
import { bankFor } from './render.mjs';
const SR = 48000;
const [name, split, kind = 'idle'] = process.argv.slice(2);
const b = bankFor(`public/audio/${name}.json`);
const n = +split;
const edge = [], peakAt = [];
for (const g of b.grains) {
  if (g.kind !== kind || g.ok === false) continue;
  const a = Math.round(g.start * SR), len = Math.round(g.dur * SR), each = Math.floor(len / n);
  for (let s = 0; s < n; s++) {
    const o = a + s * each;
    let e = 0, pk = 0, pi = 0;
    for (let i = 0; i < each; i++) { const v = b.data[o + i]; e += v * v; if (Math.abs(v) > pk) { pk = Math.abs(v); pi = i; } }
    const rms = Math.sqrt(e / each);
    let e1 = 0;
    for (let i = 0; i < 48; i++) e1 += b.data[o + i] ** 2;
    edge.push(Math.sqrt(e1 / 48) / rms);
    peakAt.push(pi / each);
  }
}
const med = (x) => [...x].sort((p, q) => p - q)[x.length >> 1];
const hist = [0, 0.2, 0.4, 0.6, 0.8, 1.01].slice(0, -1).map((lo, i, arr) => peakAt.filter((p) => p >= lo && p < (arr[i + 1] ?? 1.01)).length);
console.log(`${name} cut in ${n}: level at the cut ${med(edge).toFixed(2)} of the firing's RMS (median); loudest moment by fifths of the slice ${hist.join(' / ')}`);
