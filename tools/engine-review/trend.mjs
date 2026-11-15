// How the sound changes as the revs rise, real against built. Each long rev recording in the banks (a machine of a type, not
// necessarily the one the vehicle idles on) gives the change in tone (third-octave bands, level taken out) and in note from its
// lowest revs to each higher step. Each way of building revs from a vehicle of that type's idle is played at the same rpms, and its
// change compared. Lower is closer.
//
//   WORKLET=tools/engine-review/prototype/engineWorklet.js node tools/engine-review/trend.mjs

import { DEFAULT_AUDIO_PARAMS } from '../../src/audio/audioParams.js';
import { DEFAULT_ENGINE_PARAMS } from '../../src/engine/engineParams.js';
import { SPECS, bankFor } from './render.mjs';
import { modelBank } from './model.mjs';
import { bands, dist, note, play } from './fit.mjs';

const SR = 48000;
// A rev recording, and the vehicle (with its idle) whose built revs are judged against it.
const SETS = [
  { real: ['engine-bank', 'atv'], vehicle: 'farm300', type: 'four-stroke single quad' },
  { real: ['engine-bank', 'quarry'], vehicle: 'farm300', type: 'four-stroke single quad' },
  { real: ['engine-bank-green', 'honda'], vehicle: 'rb300', type: 'four-stroke single' },
  { real: ['engine-bank-fiesta', 'mini'], vehicle: 'finch', type: 'petrol four', split: 4 },
  { real: ['engine-bank-corsa', 'cc'], vehicle: 'griffin', type: 'petrol four', split: 4 },
  { real: ['engine-bank-utv', 'bob'], vehicle: 'yak', type: 'diesel' },
  { real: ['engine-bank-tdi', 'saf'], vehicle: 'crag', type: 'diesel four' },
  { real: ['engine-bank-moto', 'der'], vehicle: 'tz65', type: 'two-stroke single' },
  { real: ['engine-bank-2t', 'db'], vehicle: 'adder', type: 'two-stroke single' },
];
const CANDIDATES = [
  { id: 'now', label: 'As now (each firing at its own speed)', sets: { pulsePitchFollow: 0 } },
  { id: 'p50', label: 'Pitch beyond 0.5 (the earlier try)', sets: { pulsePitchFollow: 0, pulseHighFollow: 0.5 } },
  { id: 'resample', label: 'Resampled to fit (follow 1)', sets: { pulsePitchFollow: 1 } },
  ...[0.5, 0.7, 1].flatMap((f) => [2, 4].map((o) => ({ id: `m${f}-${o}`, label: `Model, follow ${f}, slope ${o} oct`, sets: { pulsePitchFollow: f }, model: { slopeOct: o } }))),
  ...[0.3, 0.5, 0.7, 0.85].map((st) => ({ id: `st${st}`, label: `As now, steady ${st}`, sets: { pulsePitchFollow: 0, pulseSteady: st } })),
];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
if (ONLY) CANDIDATES.splice(0, CANDIDATES.length, ...CANDIDATES.filter((c) => ONLY.includes(c.id)));

const tally = Object.fromEntries(CANDIDATES.map((c) => [c.id, { tone: [], note: [] }]));
for (const set of SETS) {
  const [bankName, src] = set.real;
  const rb = bankFor(`public/audio/${bankName}.json`);
  const spec = SPECS.find((s) => s.id === set.vehicle);
  const eng = { ...DEFAULT_ENGINE_PARAMS, ...spec.engine };
  const revsPerCycle = eng.strokes === 2 ? 1 : 2;
  const split = set.split ?? 1;
  const cyl = split > 1 ? split : Math.max(1, eng.cylinders ?? 1);
  const revsPerFiring = revsPerCycle / cyl;
  // The real recording's rev grains, at five rpms from its 10th to 90th percentile, each ±8% joined in recording order.
  const gs = rb.grains.filter((g) => g.kind === 'accel' && g.src === src && g.ok !== false).sort((a, b) => a.rpm - b.rpm);
  const labels = [0.1, 0.3, 0.5, 0.7, 0.9].map((q) => gs[Math.floor(q * (gs.length - 1))].rpm);
  const realPts = labels.map((label) => {
    const near = gs.filter((g) => Math.abs(Math.log(g.rpm / label)) < 0.08).sort((a, b) => a.start - b.start);
    const n = near.reduce((s, g) => s + Math.round(g.dur * SR), 0);
    const x = new Float32Array(Math.max(n, 8192));
    let o = 0;
    for (const g of near) {
      const a = Math.round(g.start * SR), len = Math.round(g.dur * SR);
      x.set(rb.data.subarray(a, a + len), o);
      o += len;
    }
    const rpm = (label * revsPerCycle) / 2;
    return { rpm, bands: bands(x), note: note(x.subarray(0, n), rpm, revsPerFiring) };
  });
  // The vehicle's own idle bank, with the rev blend off: revs built from idle only.
  const params0 = { ...DEFAULT_AUDIO_PARAMS, ...spec.audio, pulseRevLo: 0, pulseRevHi: 0, ...(split > 1 ? { pulseSplit: split, pulseDivide: 1 } : {}) };
  const vb = bankFor(`public/audio/${params0.recBank}.json`);
  const kind = { rev: 'idle2', third: 'idle3' }[params0.recIdleSource] ?? 'idle';
  console.log(`\n${set.type}: ${src} revs (${bankName}) at ${realPts.map((p) => Math.round(p.rpm)).join(', ')} rpm; built from the ${set.vehicle}'s idle`);
  console.log(`  ${'real: tone change from the first step (dB)'.padEnd(42)} ${realPts.slice(1).map((p) => dist(p.bands, realPts[0].bands).toFixed(1).padStart(5)).join(' ')}   note ${realPts.map((p) => p.note.toFixed(2)).join(' ')}`);
  const models = new Map();
  for (const c of CANDIDATES) {
    let msg = vb;
    if (c.model) {
      const key = JSON.stringify(c.model);
      if (!models.has(key)) models.set(key, modelBank(vb, vb.data, kind, { split, ...c.model }));
      msg = models.get(key);
    }
    const pts = realPts.map((p) => {
      const y = play(msg, { ...params0, ...c.sets }, revsPerFiring, p.rpm);
      return { bands: bands(y), note: note(y, p.rpm, revsPerFiring) };
    });
    // Compare the change: each step's bands minus the first step's, real against built; and the note at each step.
    const toneErr = pts.slice(1).map((p, i) => dist(p.bands.map((v, k) => v - pts[0].bands[k]), realPts[i + 1].bands.map((v, k) => v - realPts[0].bands[k])));
    const noteErr = pts.map((p, i) => Math.abs(p.note - realPts[i].note));
    tally[c.id].tone.push(...toneErr);
    tally[c.id].note.push(...noteErr);
    console.log(`  ${c.label.padEnd(42)} ${toneErr.map((d) => d.toFixed(1).padStart(5)).join(' ')}   note ${pts.map((p) => p.note.toFixed(2)).join(' ')}`);
  }
}
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
console.log('\nOver every recording and step (lower is closer to how real revs change):');
for (const c of CANDIDATES) console.log(`  ${c.label.padEnd(42)} tone change off by ${mean(tally[c.id].tone).toFixed(2)} dB   note off by ${mean(tally[c.id].note).toFixed(2)}`);
