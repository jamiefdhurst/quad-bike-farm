import { describe, it, expect, vi } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { moorHeard, moorBirds, moorBed, MOOR_FADE } from '../src/world/moorBed.js';
import { MoorAudio } from '../src/audio/moorAudio.js';
import { AudioHub } from '../src/audio/engineAudio.js';
import { DEFAULT_SOUND_PARAMS, SOUND_PARAM_RANGES } from '../src/audio/audioParams.js';

// The Moor's sound (#821): wind always, curlews and larks in spring, only on the common and by day. Nothing here makes a sound.
const two = LAYOUT;
const moor = createTerrainHeight(two, new Track(two.trackPoints)).moor;
const z = (two.moor.bounds.minZ + two.moor.bounds.maxZ) / 2;
const edge = moor.laneEdge(z);

describe('where the Moor is heard', () => {
  it('is full on the common, fades over `MOOR_FADE` m east of the lane and is gone on the farm', () => {
    expect(moorHeard(moor, edge - 50, z)).toBe(1);
    expect(moorHeard(moor, edge + MOOR_FADE / 2, z)).toBeCloseTo(0.5);
    expect(moorHeard(moor, edge + MOOR_FADE, z)).toBe(0);
    expect(moorHeard(moor, edge + 300, z)).toBe(0);
  });
  it('is gone past the common\'s north and south ends and on today\'s farm, which has no Moor', () => {
    expect(moorHeard(moor, edge - 50, two.moor.bounds.maxZ + MOOR_FADE + 1)).toBe(0);
    expect(moorHeard(null, 0, 0)).toBe(0);
  });
});

describe('the birds', () => {
  const month = (m, darkness = 0) => moorBirds({ month: m }, darkness);
  it('call from March to June and are quiet the rest of the year, the larks singing on into July', () => {
    expect([2, 3, 4, 5].every((m) => month(m).curlew > 0)).toBe(true);
    expect([0, 1, 6, 7, 8, 9, 10, 11].every((m) => month(m).curlew === 0)).toBe(true);
    expect(month(6).lark).toBeGreaterThan(0);
    expect(month(7).lark).toBe(0);
  });
  it('are quiet at night and fewer at dusk', () => {
    expect(month(4, 1).curlew).toBe(0);
    expect(month(4, 0.4).curlew).toBeLessThan(month(4, 0).curlew);
  });
});

describe('the Moor\'s bed', () => {
  const spring = moorBirds({ month: 4 }, 0);
  it('always has some extra wind on the common, more of it in a blow, and none off it', () => {
    expect(moorBed(1, moorBirds({ month: 10 }, 0), 0).wind).toBeGreaterThan(0.4);
    expect(moorBed(1, spring, 1).wind).toBeGreaterThan(moorBed(1, spring, 0).wind);
    expect(moorBed(0, spring, 1).wind).toBe(0);
  });
  it('calls curlews and larks in spring on the common, never in winter or out of earshot', () => {
    expect(moorBed(1, spring, 0.5).curlewEvery).toBeLessThan(Infinity);
    expect(moorBed(1, spring, 0.5).larkEvery).toBeLessThan(Infinity);
    expect(moorBed(1, moorBirds({ month: 0 }, 0), 0.5).curlewEvery).toBe(Infinity);
    expect(moorBed(0.02, spring, 0.5).curlewEvery).toBe(Infinity);
  });
  it('has its volume and its extra wind tunable', () => {
    expect(DEFAULT_SOUND_PARAMS.moorVolume).toBeGreaterThan(0);
    expect(SOUND_PARAM_RANGES.moorVolume).toEqual([0, 0.3, 0.005]);
    expect(SOUND_PARAM_RANGES.moorWind).toEqual([0, 4, 0.05]);
  });
});

/** A stand-in audio context that makes nothing: it counts the oscillators started, each with the pitches it was given. */
function fakeHub(now = 100) {
  const started = [];
  const node = () => ({ connect: (n) => n, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} }, pan: { value: 0 }, Q: { value: 0 } });
  const ctx = {
    currentTime: now,
    createOscillator: () => ({ ...node(), start: (t) => started.push(t), stop() {} }),
    createGain: node,
    createStereoPanner: node,
    createBiquadFilter: node,
  };
  return { ctx, started, hub: { ready: true, paused: false, ctx, master: node() } };
}

describe('MoorAudio', () => {
  const spring = moorBed(1, moorBirds({ month: 4 }, 0), 0.5);
  it('calls a bird now and then in spring, never the first moment you arrive, and nothing in winter', () => {
    const { hub, ctx, started } = fakeHub();
    const birds = new MoorAudio(hub);
    birds.update(spring, 0.05);
    expect(started).toHaveLength(0); // it only schedules the first call
    ctx.currentTime += 200;
    birds.update(spring, 0.05);
    expect(started.length).toBeGreaterThan(0);
    const before = started.length;
    ctx.currentTime += 1000;
    birds.update(moorBed(1, moorBirds({ month: 0 }, 0), 0.5), 0.05);
    expect(started.length).toBe(before);
  });
  it('is not driven by the hub until it is ready, and is silent on a farm with no Moor', () => {
    const { hub, ctx, started } = fakeHub();
    hub.ready = false;
    const birds = new MoorAudio(hub);
    ctx.currentTime += 500;
    birds.update(spring, 0.05);
    expect(started).toHaveLength(0);
    const off = { ready: true, moorWind: 0, params: DEFAULT_SOUND_PARAMS, ctx, master: hub.master };
    AudioHub.prototype.setMoor.call(off, null, 0);
    expect(off.moorWind).toBe(0);
  });
});
