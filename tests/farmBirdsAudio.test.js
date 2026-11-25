import { describe, it, expect } from 'vitest';
import { blackbirdSong, robinSong, wrenSong, rookCaw, FarmBirdsAudio } from '../src/audio/farmBirdsAudio.js';
import { WildlifeAudio } from '../src/audio/wildlifeAudio.js';
import { DEFAULT_FARM_BIRD_PARAMS } from '../src/world/farmBirds.js';
import { createRandom } from '../src/core/random.js';

// The farm's birds' voices (#124), through a stand-in audio context that makes nothing: it keeps each oscillator's pitches and each ramp's target.

function fakeCtx(now = 50) {
  const oscs = [];
  const panners = [];
  const ramps = [];
  const param = (value = 0) => ({
    value,
    setValueAtTime(v) { ramps.push(v); },
    linearRampToValueAtTime(v) { ramps.push(v); },
    exponentialRampToValueAtTime(v) { if (!(v > 0)) throw new Error(`an exponential ramp to ${v}`); ramps.push(v); },
  });
  const node = () => ({ connect: (n) => n, frequency: param(), gain: param(), Q: param() });
  const ctx = {
    currentTime: now,
    sampleRate: 8000,
    createOscillator() {
      const pitches = [];
      const o = { ...node(), type: 'sine', pitches, start(t) { o.at = t; }, stop(t) { o.end = t; } };
      o.frequency = { value: 0, setValueAtTime: (v) => pitches.push(v), linearRampToValueAtTime: (v) => pitches.push(v), exponentialRampToValueAtTime: (v) => { if (!(v > 0)) throw new Error('ramp to 0'); pitches.push(v); } };
      oscs.push(o);
      return o;
    },
    createGain: node,
    createBiquadFilter: node,
    createBufferSource: () => ({ ...node(), start() {}, stop() {} }),
    createBuffer: (ch, n) => ({ getChannelData: () => new Float32Array(n) }),
    createPanner() {
      const p = { ...node(), positionX: param(), positionY: param(), positionZ: param() };
      panners.push(p);
      return p;
    },
  };
  return { ctx, oscs, panners, ramps };
}

const spread = (oscs) => {
  const all = oscs.flatMap((o) => o.pitches);
  return { lo: Math.min(...all), hi: Math.max(...all) };
};

describe('the songs', () => {
  it('runs each for its length, in its own pitch: a low fluted blackbird, a high robin, a higher wren, a hoarse low rook', () => {
    const random = createRandom(3);
    const sing = (fn, ...args) => {
      const f = fakeCtx();
      const end = fn(f.ctx, {}, 10, 1, ...args);
      return { end, ...spread(f.oscs), oscs: f.oscs };
    };
    const bb = sing(blackbirdSong, 2.5, random);
    expect(bb.end).toBe(12.5);
    expect(bb.lo).toBeGreaterThan(1100);
    const fluted = bb.oscs[0].pitches.slice(0, 8);
    expect(Math.max(...fluted)).toBeLessThan(3200); // the fluting is low; only the twitter at its end goes high
    expect(bb.hi).toBeGreaterThan(4000);
    const robin = sing(robinSong, 2, random);
    expect(robin.end).toBe(12);
    expect(robin.lo).toBeGreaterThan(1700);
    expect(robin.hi).toBeLessThan(7500);
    const wren = sing(wrenSong, 4, random);
    expect(wren.end).toBe(14);
    expect(wren.lo).toBeGreaterThan(3500);
    const f = fakeCtx();
    rookCaw(f.ctx, {}, 10, 1, {}, true, random);
    expect(f.oscs).toHaveLength(2); // a double caw
    expect(f.oscs.every((o) => o.type === 'sawtooth')).toBe(true);
    const rook = spread(f.oscs);
    expect(rook.lo).toBeGreaterThan(200);
    expect(rook.hi).toBeLessThan(650);
  });
});

describe('FarmBirdsAudio', () => {
  const hub = (ctx, at = { x: 0, y: 1.6, z: 0 }) => ({ ready: true, paused: false, ctx, master: { connect: (n) => n }, listenerPosition: at });

  it('plays a song from its spot in the hedge, and a flock\'s caws high up along its line, each from where it is', () => {
    const f = fakeCtx();
    const birds = new FarmBirdsAudio(new WildlifeAudio(hub(f.ctx)), { ...DEFAULT_FARM_BIRD_PARAMS });
    birds.play({ kind: 'song', species: 'robin', x: 20, z: -10, len: 2 }, () => 3);
    expect(f.panners).toHaveLength(1);
    expect([f.panners[0].positionX.value, f.panners[0].positionY.value, f.panners[0].positionZ.value]).toEqual([20, 5.5, -10]);
    const caws = [{ at: 0, x: -60, z: 20, double: false }, { at: 5, x: 0, z: 20, double: true }, { at: 10, x: 60, z: 20, double: false }];
    birds.play({ kind: 'flock', species: 'rook', heading: 0, height: 40, len: 16, caws }, () => 0);
    expect(f.panners.slice(1).map((p) => [p.positionX.value, p.positionY.value])).toEqual([[-60, 40], [0, 40], [60, 40]]);
    expect(f.oscs.slice(1).map((o) => o.at - f.ctx.currentTime)).toEqual([0, 5, expect.any(Number), 10]); // each caw at its own time; the double's second after the first
  });

  it('makes nothing beyond earshot, with the volume at nothing, or for a bird it doesn\'t know', () => {
    const f = fakeCtx();
    const params = { ...DEFAULT_FARM_BIRD_PARAMS };
    const birds = new FarmBirdsAudio(new WildlifeAudio(hub(f.ctx)), params);
    birds.play({ kind: 'song', species: 'wren', x: 400, z: 0, len: 4 }, () => 0);
    birds.play({ kind: 'song', species: 'owl', x: 4, z: 0, len: 4 }, () => 0);
    params.volume = 0;
    birds.play({ kind: 'song', species: 'wren', x: 4, z: 0, len: 4 }, () => 0);
    expect(f.oscs).toHaveLength(0);
  });
});
