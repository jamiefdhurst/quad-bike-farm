// Fits the per-type rule to real rev recordings: for each engine type, the settings (steadiness, and for several cylinders each
// cylinder's spread of strength and timing) whose built revs repeat like the real ones, by the firing and by the cycle, at five
// rpms across each recording. Two seeds each. Tone change is shown as a guard, not fitted.
//
//   WORKLET=tools/engine-review/prototype/engineWorklet.js node tools/engine-review/calibrate.mjs [type ...]

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DEFAULT_AUDIO_PARAMS } from '../../src/audio/audioParams.js';
import { DEFAULT_ENGINE_PARAMS } from '../../src/engine/engineParams.js';
import { SPECS, bankFor } from './render.mjs';
import { bands, dist, note, play } from './fit.mjs';

const SR = 48000;
// Clicks: samples jumping more than 8 times the clip's typical step (and over 0.01). The note score can't hear pops, so a
// setting with a quarter as many again as today's is rejected whatever its note.
function clicks(x) {
  const steps = [];
  for (let i = 1; i < x.length; i++) steps.push(Math.abs(x[i] - x[i - 1]));
  const typical = [...steps].sort((a, b) => a - b)[steps.length >> 1] || 1e-9;
  let peak = 1e-9;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  return steps.filter((v) => v > typical * 8 && v > 0.01 * peak).length;
}
const CLICK_LIMIT = 1.25;
const singleGrid = [0, 0.2, 0.3, 0.4, 0.5, 0.6].map((st) => ({ pulseSteady: st }));
const multiGrid = [0, 0.3].flatMap((st) => [4, 8].flatMap((g) => [0.1, 0.2].flatMap((t) => [0, 0.05, 0.1].flatMap((fj) => [0, 0.3].map((sj) => ({ pulseSteady: st, pulseCylGain: g, pulseCylTime: t, pulseFireJitter: fj, pulseStrengthJitter: sj }))))));
// Every setting a type isn't fitted on stays at 0, so 'as now' is always scored.
for (const st of [0.85, 0.6, 0.3, 0]) multiGrid.unshift({ pulseSteady: st, pulseCylGain: 0, pulseCylTime: 0, pulseFireJitter: 0, pulseStrengthJitter: 0 });
export const TYPES = {
  'four-stroke single': { grid: singleGrid, sets: [['engine-bank', 'atv', 'farm300'], ['engine-bank', 'quarry', 'farm300'], ['engine-bank-green', 'honda', 'rb300']] },
  'two-stroke single': { grid: singleGrid, sets: [['engine-bank-moto', 'der', 'tz65'], ['engine-bank-2t', 'db', 'adder']] },
  // The petrol fours were fitted (#854) to the rev recordings in the girls' old banks, BBC recordings and a Mini, which went with
  // them in #858 (git show 'ce2c9ac7:public/audio/engine-bank-fiesta.json' and its WAV in source/audio, likewise corsa): a new rev
  // recording of a petrol four goes here to fit them again.
  'diesel, several cylinders': { grid: multiGrid, sets: [['engine-bank-tdi', 'saf', 'crag', 4], ['engine-bank-utv', 'bob', 'yak', 3]] },
};

function realPoints(bankName, src, revsPerCycle, revsPerFiring, cyl) {
  const rb = bankFor(`public/audio/${bankName}.json`);
  const gs = rb.grains.filter((g) => g.kind === 'accel' && g.src === src && g.ok !== false).sort((a, b) => a.rpm - b.rpm);
  return [0.1, 0.3, 0.5, 0.7, 0.9].map((q) => {
    const label = gs[Math.floor(q * (gs.length - 1))].rpm;
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
    const xs = x.subarray(0, n);
    return { rpm, bands: bands(x), firing: note(xs, rpm, revsPerFiring), cycle: cyl > 1 ? note(xs, rpm, revsPerCycle) : null };
  });
}

const only = process.argv.slice(2);
// STEADY_ONLY=1 scores steadiness alone (every other setting 0), and writes nothing.
const STEADY_ONLY = !!process.env.STEADY_ONLY;
const fitted = {};
for (const [type, def] of Object.entries(TYPES)) {
  if (only.length && !only.includes(type)) continue;
  const prepared = def.sets.map(([bankName, src, vehicle, splitOver]) => {
    const spec = SPECS.find((s) => s.id === vehicle);
    const eng = { ...DEFAULT_ENGINE_PARAMS, ...spec.engine };
    const revsPerCycle = eng.strokes === 2 ? 1 : 2;
    const split = splitOver ?? def.split ?? 1;
    const cyl = split > 1 ? split : Math.max(1, eng.cylinders ?? 1);
    const revsPerFiring = revsPerCycle / cyl;
    const params = { ...DEFAULT_AUDIO_PARAMS, ...spec.audio, pulseRevLo: 0, pulseRevHi: 0, pulsePitchFollow: 0, ...(split > 1 ? { pulseSplit: split, pulseDivide: 1, pulseCylinders: split } : {}) };
    return { src, vehicle, revsPerFiring, revsPerCycle, cyl, params, bank: bankFor(`public/audio/${params.recBank}.json`), real: realPoints(bankName, src, revsPerCycle, revsPerFiring, cyl) };
  });
  const grid = STEADY_ONLY ? def.grid.filter((c) => Object.entries(c).every(([k, v]) => k === 'pulseSteady' || v === 0)) : def.grid;
  const scored = grid.map((sets) => {
    let noteErr = 0, toneErr = 0, n = 0, nt = 0, clk = 0;
    const detail = [];
    for (const s of prepared) {
      const built = s.real.map((p) => {
        const runs = [1, 2].map((seed) => play(s.bank, { ...s.params, ...sets }, s.revsPerFiring, p.rpm, 1.6, seed));
        clk += runs.reduce((a, y) => a + clicks(y), 0);
        return {
          bands: bands(runs[0]),
          firing: runs.reduce((a, y) => a + note(y, p.rpm, s.revsPerFiring), 0) / 2,
          cycle: s.cyl > 1 ? runs.reduce((a, y) => a + note(y, p.rpm, s.revsPerCycle), 0) / 2 : null,
        };
      });
      built.forEach((b, i) => {
        const r = s.real[i];
        noteErr += Math.abs(b.firing - r.firing) + (r.cycle != null ? Math.abs(b.cycle - r.cycle) : 0);
        n += r.cycle != null ? 2 : 1;
        if (i > 0) {
          toneErr += dist(b.bands.map((v, k) => v - built[0].bands[k]), r.bands.map((v, k) => v - s.real[0].bands[k]));
          nt++;
        }
      });
      detail.push({ src: s.src, built });
    }
    return { sets, note: noteErr / n, tone: toneErr / nt, clicks: clk, detail };
  });
  const none = scored.find((c) => Object.values(c.sets).every((v) => v === 0));
  for (const c of scored) c.ok = c.clicks <= none.clicks * CLICK_LIMIT;
  scored.sort((a, b) => (a.ok === b.ok ? a.note - b.note : a.ok ? -1 : 1));
  console.log(`\n${type}: real ${prepared.map((s) => `${s.src} firing ${s.real.map((p) => p.firing.toFixed(2)).join(' ')}${s.cyl > 1 ? ` / cycle ${s.real.map((p) => p.cycle.toFixed(2)).join(' ')}` : ''}`).join('; ')}`);
  console.log(`  as now (all 0): note off by ${none.note.toFixed(3)}, tone change off by ${none.tone.toFixed(2)} dB, clicks ${none.clicks}`);
  for (const c of scored.slice(0, STEADY_ONLY ? 99 : 5)) console.log(`  ${JSON.stringify(c.sets).padEnd(62)} note off by ${c.note.toFixed(3)}, tone change off by ${c.tone.toFixed(2)} dB, clicks ${c.clicks}${c.ok ? '' : ' (rejected)'}`);
  const unguarded = [...scored].sort((a, b) => a.note - b.note)[0];
  if (unguarded !== scored[0]) console.log(`  (best without the click guard: ${JSON.stringify(unguarded.sets)}, note ${unguarded.note.toFixed(3)}, clicks ${unguarded.clicks})`);
  const best = scored[0];
  console.log(`  best built: ${best.detail.map((d) => `${d.src} firing ${d.built.map((b) => b.firing.toFixed(2)).join(' ')}${d.built[0].cycle != null ? ` / cycle ${d.built.map((b) => b.cycle.toFixed(2)).join(' ')}` : ''}`).join('; ')}`);
  fitted[type] = { best: best.sets, note: best.note, asNow: none.note, clicks: best.clicks, clicksAsNow: none.clicks };
}
// Fitted values are kept in .scratch/engine-review/calibrated.json as types are fitted; prototype/calibrated.json is the reference they started from.
const KEPT = '.scratch/engine-review/calibrated.json';
const kept = JSON.parse(readFileSync(existsSync(KEPT) ? KEPT : new URL('./prototype/calibrated.json', import.meta.url), 'utf8'));
if (!STEADY_ONLY) writeFileSync(KEPT, JSON.stringify({ ...kept, ...fitted }, null, 1));
