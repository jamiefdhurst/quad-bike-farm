import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// The worklet runs on the audio thread with its own globals, so load it in a sandbox that provides them.
function loadWorklet(sampleRate) {
  const sandbox = { sampleRate, currentFrame: 0, registerProcessor: () => {}, AudioWorkletProcessor: class {} };
  vm.createContext(sandbox);
  const src = readFileSync('src/audio/engineWorklet.js', 'utf8');
  vm.runInContext(`${src}\n;this.RecordedEngine = RecordedEngine;`, sandbox);
  return sandbox;
}

const PARAMS = {
  engineSound: 'pulse',
  recIdleSource: 'quad',
  pulseCleanUp: 1.3,
  pulseRefRpm: 1800,
  pulseRevLoudness: 0.4,
  pulseLoudnessCap: 2,
  pulsePitchFollow: 0,
  pulseCrossfade: 0.4,
  recVolume: 1,
  recThrottleLoudness: 0,
  recOverlap: 0.05,
  recMinGrainMs: 32,
  recLevelling: 0.5,
  recFollow: 0.08,
  recMisfireBody: 0.3,
  recMisfireAttack: 0.1,
};

// A two-stroke idle cut in lumps of two slices, as the moto's bank is: a bang slice then a quiet one, each 30 ms (4,000 by
// the bank's rpm measure, a two-stroke at 2,000 rpm), back to back in recording order.
function slicedBank() {
  const grains = [];
  for (let i = 0; i < 40; i++) {
    grains.push({ kind: 'idle', start: i * 0.03, dur: 0.03, tail: 0, rpm: 4000, src: 'der', rms: i % 2 ? 0.1 : 0.2, slice: i % 2 });
  }
  return { data: new Float32Array(44100 * 2).fill(0.1), sourceGain: { der: 1 }, crankRpm: 300, grains, oneshots: {}, readThrough: true };
}

function slicesPlayed(rec, rpm, firings) {
  const bySample = new Map(rec.byKind.idle.map((g) => [g.start, g.slice]));
  const out = [];
  for (let i = 0; i < firings; i++) {
    rec.trigger({ type: 'fire', strength: 1, period: 60 / rpm }, PARAMS, rpm, 0);
    out.push(bySample.get(rec.voices[rec.voices.length - 1].start));
  }
  return out;
}

describe('a two-stroke idle cut in slices', () => {
  it('reads through its slices in order at idle, so it bangs every other turn as recorded', () => {
    const { RecordedEngine } = loadWorklet(44100);
    const played = slicesPlayed(new RecordedEngine(slicedBank()), 2000, 12);
    // Wherever it starts, it then alternates bang and quiet.
    for (let i = 1; i < played.length; i++) expect(played[i]).toBe(1 - played[i - 1]);
  });

  it('plays only the bangs once well above the recorded idle, so it fires every turn', () => {
    const { RecordedEngine } = loadWorklet(44100);
    // The engine model's period is one turn for a two-stroke; 3,000 rpm is 6,000 by the bank's measure, past 1.3 x 4,000.
    const played = slicesPlayed(new RecordedEngine(slicedBank()), 3000, 12);
    expect(played.every((s) => s === 0)).toBe(true);
  });
});

// A bank with idle firings at 1,750 rpm and real rev firings at 3,000 to 6,000, as the green's has.
function revBank() {
  const grains = [];
  let t = 0;
  for (let i = 0; i < 20; i++, t += 0.068) grains.push({ kind: 'idle', start: t, dur: 0.068, tail: 0, rpm: 1750, src: 'ten', rms: 0.2 });
  for (let rpm = 3000; rpm <= 6000; rpm += 150) {
    const dur = 120 / rpm;
    grains.push({ kind: 'accel', start: t, dur, tail: 0, rpm, src: 'honda', rms: 0.2 });
    t += dur;
  }
  return { data: new Float32Array(44100 * 4).fill(0.1), sourceGain: { ten: 1, honda: 1 }, crankRpm: 300, grains, oneshots: {} };
}

describe('real rev firings in the pulse sound', () => {
  const params = { ...PARAMS, pulseStretch: 1, pulseRevLo: 1600, pulseRevHi: 2600, pulseRevGain: 1 };
  const kindsAt = (rec, rpm, p) => {
    rec.voices = [];
    rec.trigger({ type: 'fire', strength: 1, period: 120 / rpm }, p, rpm, 1);
    return rec.voices.map((v) => rec.byKind.idle.some((g) => g.start === v.start) ? 'idle' : 'accel').sort();
  };

  it('plays only idle firings below pulseRevLo, only rev firings above pulseRevHi, and both between', () => {
    const { RecordedEngine } = loadWorklet(44100);
    const rec = new RecordedEngine(revBank());
    expect(kindsAt(rec, 1000, params)).toEqual(['idle']);
    expect(kindsAt(rec, 4000, params)).toEqual(['accel']);
    expect(kindsAt(rec, 2100, params)).toEqual(['accel', 'idle']);
  });

  it('stays on idle firings when the quad sets no range, however high the revs', () => {
    const { RecordedEngine } = loadWorklet(44100);
    const rec = new RecordedEngine(revBank());
    expect(kindsAt(rec, 5000, { ...params, pulseRevLo: 0, pulseRevHi: 0 })).toEqual(['idle']);
  });

  it('stretches a quick idle firing only part way with pulseStretch below 1, leaving a gap', () => {
    const { RecordedEngine } = loadWorklet(44100);
    const rec = new RecordedEngine(revBank());
    const rateAt = (stretch) => {
      rec.voices = [];
      rec.trigger({ type: 'fire', strength: 1, period: 120 / 850 }, { ...params, pulseStretch: stretch }, 850, 0);
      return rec.voices[0].rate;
    };
    // 1,750 rpm firings at 850 rpm: filling the cycle plays them at about half speed (an octave down); half way, about 0.7.
    expect(rateAt(1)).toBeLessThan(0.5);
    expect(rateAt(0.5)).toBeGreaterThan(0.65);
    expect(rateAt(0.5)).toBeLessThan(0.75);
    expect(rateAt(0)).toBe(1);
  });
});

describe('reading on through the rev recording', () => {
  const params = { ...PARAMS, pulseStretch: 1, pulseRevLo: 1600, pulseRevHi: 2600, pulseRevGain: 1 };
  // The start of each rev firing played over a run of firings at a steady rpm.
  const played = (rec, p, rpm, firings) => {
    const starts = [];
    for (let i = 0; i < firings; i++) {
      rec.trigger({ type: 'fire', strength: 1, period: 120 / rpm }, p, rpm, 1);
      starts.push(rec.voices[rec.voices.length - 1].start);
    }
    return starts;
  };

  it('plays the firing after the last one while it is near the revs, with pulseRevFollow', () => {
    const { RecordedEngine } = loadWorklet(44100);
    const rec = new RecordedEngine(revBank());
    const accel = rec.byKind.accel.map((g) => g.start);
    // The bank's rev firings step up 150 rpm at a time from 3,000 to 6,000; within 0.3 (log) of 4,500 it reads on through them.
    const starts = played(rec, { ...params, pulseRevFollow: 0.3 }, 4500, 3);
    expect(accel.indexOf(starts[1])).toBe(accel.indexOf(starts[0]) + 1);
    expect(accel.indexOf(starts[2])).toBe(accel.indexOf(starts[1]) + 1);
  });

  it('picks each firing afresh without it, as the yellow does', () => {
    const { RecordedEngine } = loadWorklet(44100);
    const rec = new RecordedEngine(revBank());
    const accel = rec.byKind.accel.map((g) => g.start);
    const starts = played(rec, { ...params, pulseRevFollow: 0 }, 4500, 12);
    const onwards = starts.slice(1).filter((s, i) => accel.indexOf(s) === accel.indexOf(starts[i]) + 1).length;
    expect(onwards).toBeLessThan(8);
  });
});

describe('pulseDivide', () => {
  it('sounds every other firing at 2, each given two firings\' time, so the recording plays at about half its pace', () => {
    const { RecordedEngine } = loadWorklet(44100);
    const rec = new RecordedEngine(slicedBank());
    const params = { ...PARAMS, pulseDivide: 2, pulseStretch: 1 };
    let played = 0;
    for (let i = 0; i < 12; i++) {
      const before = rec.voices.length;
      rec.trigger({ type: 'fire', strength: 1, period: 0.03 }, params, 2000, 0);
      if (rec.voices.length > before) played++;
    }
    expect(played).toBe(6);
    // A 30 ms slice given 60 ms is stretched to fill it: about half speed.
    const v = rec.voices[rec.voices.length - 1];
    expect(v.rate).toBeGreaterThan(0.45);
    expect(v.rate).toBeLessThan(0.55);
  });
});

describe('pulseSlowest', () => {
  it('lets a beat stretch far enough to fill a slow third-pace slot, rather than stopping short and leaving a gap', () => {
    const { RecordedEngine } = loadWorklet(44100);
    const rec = new RecordedEngine(slicedBank());
    // A 30 ms slice given three 32 ms firings: about 0.3 of its speed fills the slot.
    for (const [slowest, expected] of [[0.45, 0.45], [0.25, 0.3]]) {
      const params = { ...PARAMS, pulseDivide: 3, pulseStretch: 1, pulseSlowest: slowest };
      for (let i = 0; i < 3; i++) rec.trigger({ type: 'fire', strength: 1, period: 0.032 }, params, 2000, 0);
      expect(rec.voices[rec.voices.length - 1].rate).toBeCloseTo(expected, 1);
    }
  });
});
