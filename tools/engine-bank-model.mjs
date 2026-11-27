// Measures each engine bank's idle for the pulse model (#855): the resonances standing on its firings (pipe, silencer, body), fitted
// as up to 12 peaking filters, and its firing's burst (the time to 80% of a firing's energy, on the bare pulses: the recording with
// those resonances divided out). Writes them into the bank's JSON as `model["<idle kind>/<cut>"]`, one for each way a vehicle plays
// the bank: its idle kind (recIdleSource) and how many firings each idle grain is cut into (pulseSplit). The worklet divides the
// peaks out of the idle once at load, plays firings from that, shortens each firing's burst to fit the gap once firings meet, and
// puts the peaks back on its output (`pulseModel`).
//
//   node tools/engine-bank-model.mjs [bank name ...]      # every bank a vehicle plays, or the ones named
//
// Re-run it for a bank whenever the bank is sliced again (tools/slice_engine_audio.py writes the JSON afresh, without `model`);
// tests/engineBanks.test.js fails a vehicle whose bank has no model for how it plays it.

import { readFileSync, writeFileSync } from 'node:fs';
import { bankFor } from './engine-review/render.mjs';
import * as ALL_SPECS from '../src/vehicle/quadSpecs.js';
import { DEFAULT_AUDIO_PARAMS } from '../src/audio/audioParams.js';
import { firingSpectrum, toGridDb, smooth, fitPeaks, runPeaks, burstSeconds } from './engine-review/model.mjs';

/** The model's key for how a vehicle plays its bank's idle, as the worklet reads it. */
export function modelKey(audio) {
  const kind = { rev: 'idle2', third: 'idle3' }[audio.recIdleSource] ?? 'idle';
  return `${kind}/${Math.max(1, Math.round(audio.pulseSplit ?? 1))}`;
}

// Every spec quadSpecs.js exports, as tests/engineBanks.test.js reads them, so a new vehicle is measured without being added here.
const SPECS = Object.values(ALL_SPECS).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((s) => s?.id && s?.audio);

/** Every bank a vehicle plays, with the keys its vehicles play it by. */
export function banksInUse(specs = SPECS) {
  const out = new Map();
  for (const spec of specs) {
    const audio = { ...DEFAULT_AUDIO_PARAMS, ...spec.audio };
    if (!out.has(audio.recBank)) out.set(audio.recBank, new Set());
    out.get(audio.recBank).add(modelKey(audio));
  }
  return out;
}

/**
 * The model of one idle kind, cut into `split` firings: peaks fitted from 1.5 times its firing rate up over a 4-octave slope, from
 * single firings so the idle's rhythm stays out, and the burst measured on the bare pulses.
 */
export function measure(bank, data, kind, split) {
  const rpms = bank.grains.filter((g) => g.kind === kind && g.ok !== false).map((g) => g.rpm).sort((a, b) => a - b);
  const firingHz = ((rpms[rpms.length >> 1] ?? 1000) / 120) * split;
  const detail = toGridDb(firingSpectrum(bank, data, kind, split), 8192, 1 / 6);
  const slope = smooth(detail, 4);
  const peaks = fitPeaks(detail.map((d, i) => d - slope[i]), { max: 12, from: Math.max(50, 1.5 * firingHz) });
  const bare = runPeaks(data, peaks, -1);
  const burst = burstSeconds(bank, bare, kind, split);
  return { peaks, burst: +burst.toFixed(5) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.slice(2);
  for (const [name, keys] of banksInUse()) {
    if (only.length && !only.includes(name)) continue;
    const path = `public/audio/${name}.json`;
    const { data, ...bank } = bankFor(path);
    const model = {};
    for (const key of [...keys].sort()) {
      const [kind, split] = key.split('/');
      model[key] = measure(bank, data, kind, +split);
      const m = model[key];
      console.log(`${name.padEnd(20)} ${key.padEnd(8)} ${m.peaks.length} peaks, burst ${(m.burst * 1000).toFixed(1)} ms`);
    }
    const json = JSON.parse(readFileSync(path, 'utf8'));
    json.model = model;
    writeFileSync(path, JSON.stringify(json));
  }
}
