import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { neighbourFarmShape } from '../src/world/neighbourFarm.js';
import { milkingAt, DEFAULT_MILKING_PARAMS } from '../src/world/dairyDay.js';
import { dairySpots, dairyPlan, keepSound, muffleFor, buildingAt, outsideYard, describeDairy, DAIRY_SOUNDS, DAIRY_SOUND_NAMES, DEFAULT_DAIRY_SOUND_PARAMS as P } from '../src/world/dairySound.js';
import { DairyAudio } from '../src/audio/dairyAudio.js';
import { createRandom } from '../src/core/random.js';

// The neighbour's dairy yard, heard (#965): the milking clock, what is going when, where each sound sits, and that none is made beyond its reach.

const S = neighbourFarmShape(LAYOUT);
const spots = dairySpots(S);
const loops = DAIRY_SOUND_NAMES.filter((n) => DAIRY_SOUNDS[n].kind === 'loop');
const onces = DAIRY_SOUND_NAMES.filter((n) => DAIRY_SOUNDS[n].kind === 'once');
const going = (plan) => [...Object.entries(plan.loops).filter(([, v]) => v > 0).map(([k]) => k), ...Object.entries(plan.every).filter(([, v]) => v < Infinity).map(([k]) => k)].sort();

describe('the milking clock', () => {
  it('walks the herd in at 05:30 and 15:30, milks for an hour and a quarter, then walks them back', () => {
    expect(milkingAt(5.4).phase).toBe('none');
    expect(milkingAt(5.6)).toMatchObject({ phase: 'walkIn', which: 'morning' });
    expect(milkingAt(6)).toMatchObject({ phase: 'milking', which: 'morning' });
    expect(milkingAt(5.75 + 1.24).phase).toBe('milking');
    expect(milkingAt(5.75 + 1.26)).toMatchObject({ phase: 'walkOut', which: 'morning' });
    expect(milkingAt(7.3).phase).toBe('none');
    expect(milkingAt(15.6)).toMatchObject({ phase: 'walkIn', which: 'afternoon' });
    expect(milkingAt(16)).toMatchObject({ phase: 'milking', which: 'afternoon', minutes: 15 });
    expect(milkingAt(12).phase).toBe('none');
    expect(milkingAt(24 + 6).phase).toBe('milking'); // past midnight is the next morning
  });

  it('counts the hours since the last milking ended, round midnight too', () => {
    const end = DEFAULT_MILKING_PARAMS.afternoon + (2 * DEFAULT_MILKING_PARAMS.walkMinutes + DEFAULT_MILKING_PARAMS.milkMinutes) / 60 - DEFAULT_MILKING_PARAMS.walkMinutes / 60;
    expect(milkingAt(end + 1).sinceMilking).toBeCloseTo(1, 5);
    expect(milkingAt(2).sinceMilking).toBeCloseTo(24 + 2 - end, 5);
  });
});

describe('when each sound plays', () => {
  it('runs the machine, the pump, the compressor, the radio and the herd while she milks, and the trough fills more often', () => {
    const plan = dairyPlan(16, { wind: 0.6 });
    expect(going(plan)).toEqual(['bark', 'compressor', 'hooves', 'moo', 'pulse', 'radio', 'trough', 'vacuum']);
    expect(plan.every.trough).toBe(P.troughEvery / 4);
    expect(plan.every.moo).toBe(P.mooEvery);
  });

  it('has a cow or two calling on the walk in, but no machine yet', () => {
    const plan = dairyPlan(15.6, { wind: 0.6 });
    expect(plan.loops.pulse).toBe(0);
    expect(plan.every.moo).toBe(P.mooEvery * 3);
    expect(plan.every.hooves).toBe(Infinity);
    expect(plan.loops.radio).toBe(1);
  });

  it('stops the machine, the pump and the radio while she is out calling at the farm, with the herd still waiting', () => {
    const plan = dairyPlan(16, { away: true });
    expect(plan.loops.pulse).toBe(0);
    expect(plan.loops.vacuum).toBe(0);
    expect(plan.loops.radio).toBe(0);
    expect(plan.every.moo).toBe(P.mooEvery);
  });

  it('ticks her tractor over while she feeds after milking, and not while she is out calling at the farm', () => {
    const after = 17.3; // the afternoon milking is over at 17:15
    expect(milkingAt(after).phase).toBe('none');
    expect(dairyPlan(after).every.tractor).toBe(9);
    expect(dairyPlan(after, { away: true }).every.tractor).toBe(Infinity);
    expect(dairyPlan(12).every.tractor).toBe(Infinity);
  });

  it('keeps the compressor cooling for an hour after milking, then cycling a few minutes in each twenty by day', () => {
    expect(dairyPlan(17.3 + 0.5).loops.compressor).toBe(1);
    const day = Array.from({ length: 120 }, (_, i) => dairyPlan(11 + (i + 0.5) / 60).loops.compressor); // the middle of each minute
    expect(day.filter(Boolean).length).toBe((120 / P.compressorCycle) * P.compressorRun);
  });

  it('is quiet at night: no machine, no compressor, no radio, no dog, no trough, no herd', () => {
    for (const hour of [22.5, 23, 1, 3, 5.25]) {
      const plan = dairyPlan(hour, { wind: 0.6 });
      expect(going(plan), `at ${hour}`).toEqual([]);
    }
  });

  it('has the barn sheeting heard only in a wind, louder the stronger it blows', () => {
    expect(dairyPlan(12, { wind: 0.5 }).loops.wind).toBe(0);
    expect(dairyPlan(12, { wind: 1 }).loops.wind).toBeGreaterThan(0);
    expect(dairyPlan(12, { wind: 1.9 }).loops.wind).toBeGreaterThan(dairyPlan(12, { wind: 1 }).loops.wind);
    expect(dairyPlan(23, { wind: 1.5 }).loops.wind).toBeGreaterThan(0); // the wind blows at night as well
  });

  it('starts any sound the panel or the console asks for, whatever the hour', () => {
    const forced = Object.fromEntries(DAIRY_SOUND_NAMES.map((n) => [n, true]));
    expect(going(dairyPlan(3, { forced }))).toEqual([...DAIRY_SOUND_NAMES].sort());
    expect(describeDairy(dairyPlan(16))).toMatch(/^afternoon milking, milking \(15 min\); going: pulse/);
    expect(describeDairy(dairyPlan(3))).toBe('no milking now; going: nothing');
  });
});

describe('where each sound sits', () => {
  it('places all ten from the yard\'s shapes: the milking sounds in the parlour, the wind in the barn, the herd in the collecting yard', () => {
    expect(Object.keys(spots).sort()).toEqual([...DAIRY_SOUND_NAMES].sort());
    for (const n of ['pulse', 'vacuum', 'radio']) expect(buildingAt(S, spots[n].x, spots[n].z), n).toBe('parlour');
    expect(buildingAt(S, spots.wind.x, spots.wind.z)).toBe('barn');
    expect(buildingAt(S, spots.compressor.x, spots.compressor.z)).toBe(null);
    expect(Math.abs(spots.compressor.x - S.tankRoom.x)).toBeLessThan(S.tankRoom.halfX + 1);
    const c = S.collecting;
    for (const n of ['moo', 'hooves']) {
      expect(spots[n].x - spots[n].spread.x).toBeGreaterThanOrEqual(c.minX);
      expect(spots[n].x + spots[n].spread.x).toBeLessThanOrEqual(c.maxX);
    }
  });

  it('is heard within 80 m of her yard and no further: every sound is in or by the yard, and nothing is kept beyond the range', () => {
    expect(P.range).toBe(80);
    for (const n of DAIRY_SOUND_NAMES) expect(outsideYard(S, spots[n].x, spots[n].z), n).toBe(0);
    for (const n of DAIRY_SOUND_NAMES) expect(keepSound(true, 10, DAIRY_SOUNDS[n].within, 80.5), n).toBe(false);
  });

  it('carries the compressor and the milking machine to her gateway, and the radio only near the parlour', () => {
    const gate = { x: S.gateway.x, z: S.gateway.z };
    const d = (n) => Math.hypot(spots[n].x - gate.x, spots[n].z - gate.z);
    for (const n of ['pulse', 'vacuum', 'compressor']) expect(keepSound(false, d(n), DAIRY_SOUNDS[n].within, 0), n).toBe(true);
    expect(keepSound(false, d('radio'), DAIRY_SOUNDS.radio.within, 0)).toBe(false);
  });

  it('dulls a sound through a wall: most from a building you are not in, less from the yard while you are indoors, none in the same place', () => {
    expect(muffleFor('parlour', 'parlour')).toBe(0);
    expect(muffleFor(null, null)).toBe(0);
    expect(muffleFor('parlour', null)).toBe(1);
    expect(muffleFor('parlour', 'barn')).toBe(1);
    expect(muffleFor(null, 'house')).toBe(0.7);
    expect(muffleFor('barn', null)).toBeLessThan(0.5);
  });

  it('starts a sound only within its reach and drops it a few metres past it, never past the range', () => {
    expect(keepSound(false, 59, 60)).toBe(true);
    expect(keepSound(false, 61, 60)).toBe(false);
    expect(keepSound(true, 63, 60)).toBe(true);
    expect(keepSound(true, 66, 60)).toBe(false);
    expect(keepSound(false, 30, 60, 76)).toBe(true);
    expect(keepSound(false, 30, 60, 78)).toBe(false); // not started in the last few metres of the range
    expect(keepSound(true, 30, 60, 79)).toBe(true);
    expect(keepSound(true, 30, 60, 80)).toBe(false);
    expect(keepSound(false, 30, 60, 30, { ...P, range: 25 })).toBe(false);
  });
});

// A stand-in audio context that makes nothing, counting what is built.
function fakeHub() {
  const made = { panners: 0, oscillators: 0, sources: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(v) { if (!(v > 0)) throw new Error(`an exponential ramp to ${v}`); }, setTargetAtTime() {} });
  const node = () => ({ connect: (n) => n, disconnect() {}, frequency: param(), gain: param(), Q: param() });
  const ctx = {
    currentTime: 10,
    sampleRate: 8000,
    createGain: node,
    createBiquadFilter: node,
    createOscillator: () => (made.oscillators++, { ...node(), start() {}, stop() {} }),
    createBufferSource: () => (made.sources++, { ...node(), playbackRate: param(), start() {}, stop() {} }),
    createBuffer: (ch, n) => ({ getChannelData: () => new Float32Array(n) }),
    createPanner: () => (made.panners++, { ...node(), positionX: param(), positionY: param(), positionZ: param() }),
  };
  return { hub: { ctx, ready: true, paused: false, master: node(), listenerPosition: { x: 0, y: 0, z: 0 } }, made };
}

describe('the sounds made', () => {
  const every = Object.fromEntries(DAIRY_SOUND_NAMES.map((n) => [n, true]));
  const plan = dairyPlan(3, { forced: every, wind: 1.5 });
  const run = (audio, hub, at, seconds = 30) => {
    hub.listenerPosition = at;
    const random = createRandom(5);
    for (let t = 0; t < seconds; t += 0.1) {
      hub.ctx.currentTime += 0.1;
      audio.update(0.1, { spots, plan, listenerIn: buildingAt(S, at.x, at.z), outside: outsideYard(S, at.x, at.z), random });
    }
  };

  it('makes nothing at all from across the lane and beyond, however long you stand there', () => {
    const { hub, made } = fakeHub();
    const audio = new DairyAudio(hub, { ...P });
    run(audio, hub, { x: S.outline.minX - 85, y: 1.6, z: S.gateway.z }, 120);
    expect(audio.madeCount).toBe(0);
    expect(made).toEqual({ panners: 0, oscillators: 0, sources: 0 });
    expect(audio.played).toEqual({});
  });

  it('makes every loop and plays every one-shot in the middle of her yard, and drops the loops again as you walk away', () => {
    const { hub } = fakeHub();
    const audio = new DairyAudio(hub, { ...P });
    run(audio, hub, { x: (S.outline.minX + S.outline.maxX) / 2, y: 1.6, z: (S.outline.minZ + S.outline.maxZ) / 2 - 8 }, 60);
    for (const n of loops) expect(audio.loops[n], n).toBeTruthy();
    for (const n of onces) expect(audio.played[n] ?? 0, n).toBeGreaterThan(0);
    run(audio, hub, { x: S.outline.minX - 100, y: 1.6, z: S.gateway.z }, 1);
    expect(audio.madeCount).toBe(0);
  });

  it('makes only what is in reach: the radio, heard within 35 m, is not made from the far side of the yard', () => {
    const { hub } = fakeHub();
    const audio = new DairyAudio(hub, { ...P });
    const at = { x: spots.radio.x, y: 1.6, z: spots.radio.z + 50 };
    run(audio, hub, at, 2);
    expect(audio.loops.radio).toBeUndefined();
    expect(audio.loops.pulse).toBeTruthy();
  });

  it('makes nothing while the game is paused', () => {
    const { hub, made } = fakeHub();
    hub.paused = true;
    const audio = new DairyAudio(hub, { ...P });
    run(audio, hub, { x: S.gateway.x + 20, y: 1.6, z: S.gateway.z }, 30);
    expect(made.panners).toBe(0);
  });
});
