import { describe, it, expect } from 'vitest';
import { SPECS, renderLadder } from '../tools/engine-review/ladder.mjs';
import { dropouts, tickRate, toneChange } from '../tools/engine-review/measures.mjs';

// Every vehicle's engine held at 500 rpm steps from idle to its top, rendered offline through the real engine model and worklet, and
// listened to for the faults the engine review found only by ear (#856): cutting out (the diesels with one cylinder playing a cycle
// cut in four), ticking (the Griffin's firings starting mid-bang and its level driving the clipper) and the tone that stopped changing
// above about 3k. The render is seeded, so a run repeats; a change to the sound that moves a figure means measuring it again.

// 0.7 throttle, not the review sweep's 0.35: part throttle never reaches the output's soft clipper, so the Griffin at its old
// recVolume ticked no more than now. 0.8 s a step keeps all 19 vehicles at about 12 s for the file.
const LADDER = { stepSeconds: 0.8, throttle: 0.7, seed: 7 };
const SETTLE = 0.4; // seconds of each step left out of its tone, while the revs settle

// Ticks a second over the whole ladder: each vehicle's worst of five seeds (7, 11, 13, 17, 23) on main after #855 (2026-11-27), 25% over
// and rounded up to 0.1, so what is there today passes, a change that only moves the random stream passes too, and a fault that adds
// ticks fails. A zero stays zero: an engine that never ticked shouldn't start. The bikes' and the Griffin's come with their recordings
// (the review: the Carlton's, and the TZ65's rasp at 160 firings a second). The test renders seed 7.
const TICK_BUDGET = {
  farm300: 0.8, bruin: 2.9, hornet: 7.3, rb300: 0, adder: 0.2, asp: 9.3, tz65: 5.3, t185: 0.1, ursa: 0.3, shepherd: 4.7, clipper: 1.9,
  plover: 0.2, hartley: 0, yak: 0.3, tor: 0.2, crag: 0.2, finch: 0, griffin: 2.4, vauclair: 0.9,
};

// The tone at the top step against the step nearest half the top (mean third-octave difference in dB, level taken out): each
// vehicle's least of the same five seeds, less 25% and rounded down to 0.1. Under it, the top sounds too like half way: it has
// stopped changing as it revs.
const TONE_FLOOR = {
  farm300: 2.8, bruin: 2.5, hornet: 3.2, rb300: 2.6, adder: 2.1, asp: 1.7, tz65: 1.9, t185: 2, ursa: 2.5, shepherd: 2.5, clipper: 1.8,
  plover: 3.1, hartley: 1.7, yak: 2.1, tor: 3, crag: 1.6, finch: 4.1, griffin: 2.7, vauclair: 2.6,
};

// A vehicle not in the tables yet is held to the loosest of them, so it is covered with nothing added; measure it and add its own.
const budgetFor = (id) => TICK_BUDGET[id] ?? Math.max(...Object.values(TICK_BUDGET));
const floorFor = (id) => TONE_FLOOR[id] ?? Math.min(...Object.values(TONE_FLOOR));

// The step nearest half the top.
function halfStep(steps) {
  const top = steps.at(-1);
  return steps.reduce((best, r, i) => (Math.abs(r - top / 2) < Math.abs(steps[best] - top / 2) ? i : best), 0);
}

// Renders a vehicle's ladder and returns what is wrong with it, each naming the vehicle and the measure; none means it passes.
function faults(spec) {
  const ladder = renderLadder(spec, LADDER);
  const out = [];
  const gaps = dropouts(ladder.pcm);
  if (gaps.count > 0) out.push(`${spec.id}: dropouts: ${gaps.count} 5 ms windows 20 dB under the median, first at ${gaps.at.slice(0, 5).join(', ')} s`);
  const ticks = tickRate(ladder.pcm);
  if (ticks > budgetFor(spec.id)) out.push(`${spec.id}: ticks: ${ticks.toFixed(2)} a second, over its budget of ${budgetFor(spec.id)}`);
  const top = ladder.steps.length - 1;
  const half = halfStep(ladder.steps);
  const tone = toneChange(ladder.segment(top, SETTLE), ladder.segment(half, SETTLE));
  if (tone < floorFor(spec.id)) {
    out.push(`${spec.id}: tone: the top (${ladder.steps[top]} rpm) is ${tone.toFixed(2)} dB from half way (${ladder.steps[half]}), under its floor of ${floorFor(spec.id)}`);
  }
  return out;
}

const spec = (id) => SPECS.find((s) => s.id === id);

describe('every engine as it revs', () => {
  // A new vehicle needs nothing here (it gets the loosest figures), but one renamed or gone leaves a figure that holds nothing.
  it('has no budget or floor for a vehicle that has gone', () => {
    const ids = new Set(SPECS.map((s) => s.id));
    expect(Object.keys(TICK_BUDGET).filter((id) => !ids.has(id))).toEqual([]);
    expect(Object.keys(TONE_FLOOR).filter((id) => !ids.has(id))).toEqual([]);
  });

  it.each(SPECS.map((s) => [s.id, s]))('%s never cuts out, ticks under its budget and changes to the top', (id, s) => {
    expect(faults(s)).toEqual([]);
  });

  it('renders the same twice, so a figure means the same each run', () => {
    const a = renderLadder(spec('clipper'), LADDER).pcm;
    const b = renderLadder(spec('clipper'), LADDER).pcm;
    expect(a.length).toBe(b.length);
    expect(a.every((v, i) => v === b[i])).toBe(true);
  });
});

describe('a planted fault fails it', () => {
  it('the Crag with one cylinder, playing a cycle cut in four, cuts out', () => {
    const crag = spec('crag');
    const found = faults({ ...crag, engine: { ...crag.engine, cylinders: 1 } });
    expect(found).toContainEqual(expect.stringMatching(/^crag: dropouts: \d+ 5 ms windows/));
  });

  it('the Griffin back at recVolume 1.1 ticks over its budget', () => {
    const griffin = spec('griffin');
    const found = faults({ ...griffin, audio: { ...griffin.audio, recVolume: 1.1 } });
    expect(found).toContainEqual(expect.stringMatching(/^griffin: ticks: [\d.]+ a second, over its budget/));
  });
});
