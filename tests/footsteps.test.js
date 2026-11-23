import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createSurfaceSampler } from '../src/audio/rideEvents.js';
import { Footsteps, surfaceName, stepGain } from '../src/audio/footsteps.js';
import { FootstepWalkers } from '../src/audio/footstepWalkers.js';
import { stepSamples, STEP_KINDS } from '../src/audio/footstepSamples.js';
import { DEFAULT_SOUND_PARAMS, SOUND_PARAM_RANGES } from '../src/audio/audioParams.js';

const P = DEFAULT_SOUND_PARAMS;
const sum = (s) => Object.values(s).reduce((a, b) => a + b, 0);
// The real layout, dry ground, with a stone track along z = 10 (x from 200 to 300) and no puddles.
const world = { layout: LAYOUT, heights: { puddles: [] }, mudAt: () => 0, tarmacAt: () => 0, stoneAt: (x, z) => (x > 200 && x < 300 && Math.abs(z - 10) < 2 ? 1 : 0) };
const at = createSurfaceSampler(world);

describe('what is underfoot', () => {
  it('is concrete in the yard, stone on a track, concrete on the barn floor and straw in the Dutch barn', () => {
    const slab = LAYOUT.farmstead.slab;
    const yard = [slab.maxX - 3, slab.maxZ - 3];
    expect(surfaceName(at(...yard))).toBe('concrete');
    expect(surfaceName(at(250, 10))).toBe('stone');
    expect(surfaceName(at(LAYOUT.barn.x, LAYOUT.barn.z))).toBe('concrete');
    expect(surfaceName(at(LAYOUT.dutchBarn.x, LAYOUT.dutchBarn.z))).toBe('straw');
    expect(surfaceName(at(400, 400))).toBe('grass');
  });

  it('keeps the shares adding up to 1, wherever it is', () => {
    const b = LAYOUT.barn;
    for (const [x, z] of [[0, 0], [250, 10], [b.x, b.z], [LAYOUT.dutchBarn.x, LAYOUT.dutchBarn.z], [400, 400], [b.x + 8, b.z]]) expect(sum(at(x, z))).toBeCloseTo(1);
  });

  it('turns the barn with its yaw: a point 12 m along its long side is inside, 12 m across it is not', () => {
    const b = LAYOUT.barn; // halfX 9, halfZ 13, turned a quarter
    const along = [b.x - Math.sin(b.yaw) * 12, b.z + Math.cos(b.yaw) * 12];
    expect(at(...along).concrete).toBeCloseTo(1);
    const out = [b.x + Math.cos(b.yaw) * 30, b.z + Math.sin(b.yaw) * 30];
    expect(at(...out).concrete).toBeLessThan(1);
  });

  it('still squelches in the mud and the puddle in the yard', () => {
    const slab = LAYOUT.farmstead.slab;
    const x = slab.maxX - 3;
    const z = slab.maxZ - 3;
    const wet = createSurfaceSampler({ ...world, heights: { puddles: [{ x, z }] } });
    expect(surfaceName(wet(x, z))).toBe('mud'); // a puddle is a splash through mud
    const muddy = createSurfaceSampler({ ...world, mudAt: () => 1, heights: { puddles: [{ x, z: z - 1.2 }] } });
    expect(surfaceName(muddy(x, z))).toBe('mud');
  });

  it('has a step sound for every surface it can name', () => {
    for (const k of ['grass', 'dirt', 'mud', 'tarmac', 'concrete', 'stone', 'straw']) expect(STEP_KINDS).toContain(k);
    for (const k of STEP_KINDS) {
      const s = stepSamples(k, 44100);
      expect(s.length).toBeGreaterThan(1000);
      expect(s.some((v) => Math.abs(v) > 0.02)).toBe(true);
      expect(s.every(Number.isFinite)).toBe(true);
    }
  });
});

describe('strides', () => {
  const walk = (feet, metres, speed, walking = true) => {
    let steps = 0;
    const dt = 1 / 60;
    let x = 0;
    for (let t = 0; t < metres / speed; t += dt) {
      x += speed * dt;
      if (feet.step({ x, z: 0 }, { walking, speed }, P)) steps++;
    }
    return steps;
  };

  it('puts a foot down every stride of ground at a walk, and sooner at a jog', () => {
    // The first frame only learns where the feet are, so a step can be missed at the very start or end.
    const near = (n, want) => expect(Math.abs(n - want)).toBeLessThanOrEqual(1);
    near(walk(new Footsteps(), 17, 2.2), 17 / P.footstepStride);
    near(walk(new Footsteps(), 26, 4.4), 26 / P.footstepJogStride);
    expect(walk(new Footsteps(), 26, 4.4)).toBeLessThan(walk(new Footsteps(), 26, 2.2)); // fewer, longer strides when jogging
  });

  it('makes none standing still or riding', () => {
    expect(walk(new Footsteps(), 10, 0.1)).toBe(0);
    expect(walk(new Footsteps(), 10, 5, false)).toBe(0);
    const f = new Footsteps();
    for (let i = 0; i < 100; i++) expect(f.step({ x: 3, z: 3 }, { walking: true, speed: 0 }, P)).toBeNull();
  });

  it('alternates feet and does not count a teleport as a stride', () => {
    const f = new Footsteps();
    const out = [];
    let x = 0;
    for (let i = 0; i < 200; i++) {
      x += 0.05;
      const s = f.step({ x, z: 0 }, { walking: true, speed: 3 }, P);
      if (s) out.push(s.left);
    }
    expect(out.length).toBeGreaterThan(5);
    out.forEach((l, i) => i && expect(l).toBe(!out[i - 1]));
    expect(f.step({ x: 500, z: 0 }, { walking: true, speed: 3 }, P)).toBeNull();
  });

  it('has tunables with ranges', () => {
    for (const k of ['footstepVolume', 'footstepGirlGain', 'footstepRange', 'footstepStride', 'footstepJogStride', 'footstepJogSpeed']) expect(SOUND_PARAM_RANGES[k]).toBeTruthy();
  });
});

describe("a girl's steps", () => {
  it('are quieter than yours, fall with distance and are gone past 6 m', () => {
    expect(stepGain(0, false, P)).toBe(1);
    expect(stepGain(1, true, P)).toBeLessThan(stepGain(0, false, P));
    expect(stepGain(3, true, P)).toBeLessThan(stepGain(1, true, P));
    expect(stepGain(P.footstepRange, true, P)).toBe(0);
    expect(stepGain(P.footstepRange - 0.5, true, P)).toBeGreaterThan(0);
    expect(stepGain(2, true, P)).toBeGreaterThan(0.1); // close behind you she is plainly there
  });

  it('are heard from where she is, and only inside the range', () => {
    const played = [];
    const hub = { listenerPosition: { x: 0, z: 0 }, footstep: (kind, level, pos) => played.push({ kind, level, pos }) };
    let girl = { id: 'amy', x: 40, z: 0, walking: true };
    const you = { x: 0, z: 0, walking: false };
    const w = new FootstepWalkers({ hub, surfaceAt: at, params: P, you: () => you, girls: () => [girl] });
    const dt = 1 / 30;
    // Walking in from 40 m to 2 m at 2 m/s, 1 m a stride: nothing heard until 6 m, then louder as she comes.
    for (let i = 0; i < 700 && girl.x > 2; i++) {
      girl = { ...girl, x: girl.x - 2 * dt };
      w.update(dt);
    }
    expect(played.length).toBeGreaterThan(2);
    expect(played.every((p) => p.pos && p.pos.x < P.footstepRange)).toBe(true);
    expect(played.at(-1).level).toBeGreaterThan(played[0].level);
    expect(played.at(-1).level).toBeLessThan(1);
  });

  it('play yours at the listener, full, and none while you ride', () => {
    const played = [];
    const hub = { listenerPosition: { x: 0, z: 0 }, footstep: (kind, level, pos) => played.push({ kind, level, pos }) };
    const you = { x: 250, z: 10, walking: true };
    const w = new FootstepWalkers({ hub, surfaceAt: at, params: P, you: () => you, girls: () => [] });
    for (let i = 0; i < 120; i++) {
      you.x += 2.2 / 60;
      w.update(1 / 60);
    }
    expect(played.length).toBeGreaterThan(3);
    expect(played.every((p) => p.kind === 'stone' && p.pos === null && p.level >= 0.6)).toBe(true);
    played.length = 0;
    you.walking = false;
    for (let i = 0; i < 120; i++) {
      you.x += 5 / 60;
      w.update(1 / 60);
    }
    expect(played.length).toBe(0);
  });
});
