import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createWoods } from '../src/world/woods.js';
import { woodsHeard, owlCalls, pondEdge, travelSpeed, DEFAULT_WOODS_SOUND_PARAMS as P, WOODS_SOUND_RANGES } from '../src/world/woodsBed.js';
import { WoodsAudio } from '../src/audio/woodsAudio.js';
import { DEFAULT_SOUND_PARAMS, SOUND_PARAM_RANGES } from '../src/audio/audioParams.js';
import { TUNE_CATEGORIES } from '../src/debug/tuneCategories.js';
import { registerTuning } from '../src/core/tuning.js';
import { buildGameTree } from '../src/console/gameTree.js';
import { resolve } from '../src/console/shell.js';

const woods = createWoods(LAYOUT);
const pond = woods.pond;
const SPRING = 3; // April
const deep = { x: pond.x + pond.rx + 20, z: pond.z }; // well in among the trees, 20 m off the pond
const at = (p, state = {}) => woodsHeard(woods, p.x, p.z, { month: SPRING, ...state });

/** A point on the line from deep in the wood out through its gate, `t` 0 deep in to 1 far out in the open. */
const outward = (t) => {
  const g = woods.gate;
  const gz = g.z ?? woods.rect.maxZ;
  return { x: deep.x + (g.x - deep.x) * t * 3, z: deep.z + (gz - deep.z) * t * 3 };
};

describe('Hollow Wood\'s sound (#980)', () => {
  it('is nothing out in the open, and comes in with the wood\'s ground', () => {
    const open = outward(1);
    expect(woods.weight(open.x, open.z)).toBe(0);
    expect(at(open)).toMatchObject({ level: 0, canopy: 0, birdsEvery: Infinity, owlEvery: Infinity, dripEvery: Infinity });
    expect(at(open, { darkness: 0.6, autumn: true, speed: 6 }).leaves).toBe(0);
    expect(at(deep).level).toBe(1);
    // Walking in from the open, the level is the wood's weight all the way and never falls.
    let before = 0;
    let between = 0;
    for (let t = 1; t >= 0; t -= 0.02) {
      const p = outward(t);
      const h = at(p);
      expect(h.level).toBeCloseTo(woods.weight(p.x, p.z), 6);
      expect(h.level).toBeGreaterThanOrEqual(before - 1e-9);
      if (h.level > 0.05 && h.level < 0.95) between++;
      before = h.level;
    }
    expect(between).toBeGreaterThan(2); // it fades in over the 40 m, not all at once
  });

  it('has its birds by day, fewer in winter and in rain, and none at night', () => {
    expect(at(deep, { darkness: 0 }).birdsEvery).toBeLessThan(Infinity);
    expect(at(deep, { darkness: 1 }).birdsEvery).toBe(Infinity);
    expect(at(deep, { month: 0 }).birds).toBeLessThan(at(deep).birds);
    expect(at(deep, { rain: 1 }).birds).toBeLessThan(at(deep).birds);
  });

  it('has the owl from dusk and not by day', () => {
    expect(at(deep, { darkness: 0 }).owlEvery).toBe(Infinity);
    expect(at(deep, { darkness: 0.4 }).owlEvery).toBe(Infinity); // not before the sun is down
    expect(at(deep, { darkness: 0.7 }).owlEvery).toBeLessThan(Infinity);
    expect(at(deep, { darkness: 1 }).owl).toBeLessThan(at(deep, { darkness: 0.7 }).owl); // thinner in the full dark
    expect(owlCalls(0)).toBe(0);
  });

  it('rustles the autumn leaves only in autumn, and only as you move', () => {
    expect(at(deep, { autumn: false, speed: 6 }).leaves).toBe(0);
    expect(at(deep, { autumn: true, speed: 0 }).leaves).toBe(0);
    expect(at(deep, { autumn: true, speed: 3 }).leaves).toBeGreaterThan(0);
    expect(at(deep, { autumn: true, speed: 6 }).leaves).toBeGreaterThan(at(deep, { autumn: true, speed: 3 }).leaves);
  });

  it('reads your speed for the leaves from how far you moved, and a jump as standing still', () => {
    expect(travelSpeed(0.1, 1 / 60)).toBeCloseTo(6, 5);
    expect(travelSpeed(12, 1 / 60)).toBe(0); // got on a quad, or a tp
    expect(travelSpeed(0.1, 0)).toBe(0);
  });

  it('sighs in the canopy even in a calm, and more in a wind', () => {
    expect(at(deep, { wind: 0 }).canopy).toBeGreaterThan(0);
    expect(at(deep, { wind: 1 }).canopy).toBeGreaterThan(at(deep, { wind: 0 }).canopy);
  });

  it('drips at the pond, with frogs in spring and summer, and neither far from it', () => {
    const edge = { x: pond.x + pond.rx + 1, z: pond.z };
    expect(pondEdge(pond, pond.x, pond.z)).toBe(0);
    expect(pondEdge(pond, edge.x, edge.z)).toBeCloseTo(1, 5);
    expect(at(edge).dripEvery).toBeLessThan(Infinity);
    expect(at(edge).frogsEvery).toBeLessThan(Infinity);
    expect(at(edge, { month: 11 }).frogsEvery).toBe(Infinity);
    expect(at(edge, { darkness: 0.5 }).frogsEvery).toBeLessThan(at(edge).frogsEvery); // more at dusk
    expect(at(edge).pondAt).toEqual({ x: pond.x, z: pond.z });
    const away = { x: pond.x + pond.rx + P.pondReach + 2, z: pond.z };
    expect(at(away).dripEvery).toBe(Infinity);
    expect(at(away).frogsEvery).toBe(Infinity);
  });

  it('has its tunables with ranges in the Tune tab, and its level in the sound\'s', () => {
    for (const k of Object.keys(P)) expect(WOODS_SOUND_RANGES[k], k).toHaveLength(3);
    expect(Object.values(TUNE_CATEGORIES).flat()).toContain('Woods sound');
    expect(DEFAULT_SOUND_PARAMS.woodsVolume).toBeGreaterThan(0);
    expect(SOUND_PARAM_RANGES.woodsVolume).toEqual([0, 0.4, 0.005]);
  });

  it('is on the console: its level as tune.sound.woodsVolume and the rest under tune.woods-sound', () => {
    const sound = { ...DEFAULT_SOUND_PARAMS };
    const bed = { ...P };
    registerTuning('Sound', sound, SOUND_PARAM_RANGES);
    registerTuning('Woods sound', bed, WOODS_SOUND_RANGES);
    const tree = buildGameTree({ units: [], companions: [], weather: {} }, {});
    const level = resolve(tree, 'tune.sound.woodsVolume');
    expect(level.error).toBeUndefined();
    expect([level.node.min, level.node.max]).toEqual([0, 0.4]);
    level.node.set(0.2);
    expect(sound.woodsVolume).toBe(0.2);
    const owl = resolve(tree, 'tune.woods-sound.owlEvery');
    expect(owl.error).toBeUndefined();
    owl.node.set(30);
    expect(bed.owlEvery).toBe(30);
  });
});

/** A stand-in audio hub that makes nothing: it records each gain's target, each oscillator and noise source started, and what reaches the master. */
function fakeHub(now = 100) {
  const started = [];
  const targets = [];
  const toMaster = [];
  const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime: (v) => targets.push(v), linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const master = { connect: (n) => n };
  const node = () => ({ connect: (n) => { if (n === master) toMaster.push(n); return n; }, frequency: param(), gain: param(), pan: param(), Q: param(), positionX: param(), positionY: param(), positionZ: param() });
  const ctx = {
    currentTime: now,
    sampleRate: 8000,
    createOscillator: () => ({ ...node(), start: () => started.push('osc'), stop() {} }),
    createGain: node,
    createStereoPanner: node,
    createBiquadFilter: node,
    createPanner: node,
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => ({ ...node(), start: () => started.push('noise') }),
  };
  return { hub: { ctx, ready: true, paused: false, master, listenerPosition: { x: 0, y: 0, z: 0 } }, started, targets, toMaster, ctx };
}

describe('WoodsAudio', () => {
  it('makes nothing until the wood is first heard, nor while the sound is not ready or paused', () => {
    const f = fakeHub();
    const a = new WoodsAudio(f.hub);
    a.update(at(outward(1)), 0.06);
    a.update(null, 0.06);
    expect(f.started).toEqual([]);
    f.hub.paused = true;
    a.update(at(deep), 0.06);
    f.hub.ready = false;
    a.update(at(deep), 0.06);
    expect(f.started).toEqual([]);
  });

  it('plays everything through the hub\'s master, so its volume and muted hold for it', () => {
    const f = fakeHub();
    const a = new WoodsAudio(f.hub);
    a.update(at(deep, { autumn: true, speed: 5, darkness: 0.7 }), 0.06);
    expect(f.started).toContain('noise');
    expect(f.toMaster.length).toBeGreaterThan(0);
    // Every call: clocks run, then each one due plays.
    f.ctx.currentTime = 1000;
    a.update(at({ x: pond.x + pond.rx + 1, z: pond.z }, { darkness: 0.7 }), 0.06);
    expect(f.started.filter((s) => s === 'osc').length).toBeGreaterThan(0);
    // Out again, the beds fall to nothing.
    f.targets.length = 0;
    a.update(at(outward(1)), 0.06);
    expect(f.targets.slice(0, 3)).toEqual([0, 0, 0]);
  });
});
