import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { riverHeard, nearestRiver, dayBirds, DEFAULT_RIVER_SOUND_PARAMS as P, RIVER_SOUND_RANGES } from '../src/world/riverBed.js';
import { RiverAudio } from '../src/audio/riverAudio.js';
import { DEFAULT_SOUND_PARAMS, SOUND_PARAM_RANGES } from '../src/audio/audioParams.js';
import { TUNE_CATEGORIES } from '../src/debug/tuneCategories.js';

// The river's sound (#999): from its nearest point, loudest at the crossing, louder when the stream is up and in rain, nothing from 40 m; and by day the
// rooks, the wagtail, the moorhen and the willows. Nothing here makes a sound: the audio is a stand-in that only counts what it was asked to start.

const brook = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints)).brook;
const cross = brook.crossing();
/** A point `d` m out from the river's water on its north bank at x. */
const off = (x, d) => ({ x, z: brook.zAt(x) - brook.halfAt(x) - d });
const at = (p, weather) => riverHeard(brook, p.x, p.z, weather);

describe('where the river is heard from (#999)', () => {
  it('finds the nearest point of the river, and how far its water is', () => {
    const p = off(60, 12);
    const n = nearestRiver(brook, p.x, p.z);
    expect(n.d).toBeGreaterThan(10);
    expect(n.d).toBeLessThan(12.5);
    expect(Math.abs(n.x - 60)).toBeLessThan(6);
    expect(nearestRiver(brook, 60, brook.zAt(60)).d).toBe(0);
  });

  it('falls to nothing 40 m from the river, and is nothing further off', () => {
    for (const x of [-60, 20, 100]) {
      expect(at(off(x, 5)).level, `x ${x}`).toBeGreaterThan(0.5);
      expect(at(off(x, 20)).level).toBeLessThan(at(off(x, 5)).level);
      // Measured from the nearest point of the river's water, which a bend may bring nearer than the bank straight across.
      let silent = 0;
      for (let d = 30; d <= 300; d += d < 60 ? 0.5 : 20) {
        const p = off(x, d);
        const h = at(p, { wind: 1 });
        const n = nearestRiver(brook, p.x, p.z, 400);
        if (n.d >= 40) {
          silent++;
          expect(h.level, `x ${x}, ${n.d.toFixed(1)} m`).toBe(0);
          expect(h.babble + h.murmur + h.willows).toBe(0);
        } else {
          expect(h.level, `x ${x}, ${n.d.toFixed(1)} m`).toBeGreaterThan(0);
          if (n.d > 38) expect(h.level, 'fading to nothing at 40 m').toBeLessThan(0.01);
        }
      }
      expect(silent).toBeGreaterThan(10);
    }
    expect(P.heardFrom).toBe(40);
  });

  it('rises with the stream\'s level: the fuller the river, the louder its water', () => {
    const p = off(40, 6);
    let last = -1;
    for (const streamLevel of [0, 0.25, 0.5, 0.75, 1]) {
      const h = at(p, { streamLevel });
      expect(h.babble + h.murmur, `level ${streamLevel}`).toBeGreaterThan(last);
      last = h.babble + h.murmur;
    }
    expect(at(p, { streamLevel: 1 }).murmur / at(p, { streamLevel: 0 }).murmur).toBeCloseTo(1 + P.upBoost, 5);
  });

  it('is louder in the rain', () => {
    const p = off(40, 6);
    expect(at(p, { rain: 1 }).murmur).toBeGreaterThan(at(p, { rain: 0 }).murmur);
  });

  it('is loudest at the crossing: more babble over its stones than at a deep reach as near', () => {
    const atCrossing = at(off(cross.x, 3));
    for (const x of [20, 60, 100]) expect(atCrossing.babble, `x ${x}`).toBeGreaterThan(at(off(x, 3)).babble * 1.5);
    expect(atCrossing.babble).toBeGreaterThan(atCrossing.murmur);
  });

  it('pans to the nearest point of the river', () => {
    const p = off(80, 10);
    const h = at(p);
    expect(Math.abs(h.at.x - 80)).toBeLessThan(6);
    expect(h.at.z).toBeGreaterThan(p.z);
  });

  it('has the birds by day and not at night, and the willows rustle only in a wind', () => {
    const p = off(40, 6);
    expect(at(p, { darkness: 0 }).birdsEvery).toBeLessThan(Infinity);
    expect(at(p, { darkness: 1 }).birdsEvery).toBe(Infinity);
    expect(at(off(40, 45), { darkness: 0 }).birdsEvery).toBe(Infinity);
    expect(at(p, { wind: 0 }).willows).toBe(0);
    expect(at(p, { wind: 1 }).willows).toBeGreaterThan(0);
    expect(at(p, { wind: 1, darkness: 1 }).willows).toBe(0);
    expect(dayBirds(0.5)).toBeLessThan(1);
  });

  it('has its tunables with ranges, in the Tune tab, and its volumes in the sound\'s', () => {
    for (const k of Object.keys(P)) expect(RIVER_SOUND_RANGES[k], k).toHaveLength(3);
    expect(Object.values(TUNE_CATEGORIES).flat()).toContain('River sound');
    for (const k of ['riverVolume', 'riverBirdVolume']) {
      expect(DEFAULT_SOUND_PARAMS[k]).toBeGreaterThan(0);
      expect(SOUND_PARAM_RANGES[k]).toHaveLength(3);
    }
  });
});

/** A stand-in audio hub that makes nothing: it records each gain's target and each oscillator and noise source started. */
function fakeHub(now = 100) {
  const started = [];
  const targets = [];
  const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime: (v) => targets.push(v), linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect: (n) => n, frequency: param(), gain: param(), pan: param(), Q: param(), positionX: param(), positionY: param(), positionZ: param() });
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
  return { hub: { ctx, ready: true, paused: false, master: node(), listenerPosition: { x: 0, y: 0, z: 0 } }, started, targets, ctx };
}

describe('the river\'s audio (#999)', () => {
  it('makes nothing until the river is first heard, then its beds from one noise source', () => {
    const { hub, started } = fakeHub();
    const a = new RiverAudio(hub);
    a.update(at(off(40, 200)), 0.06, 0.05);
    expect(started).toEqual([]);
    a.update(at(off(40, 5)), 0.06, 0.05);
    expect(started.filter((s) => s === 'noise')).toHaveLength(1);
  });

  it('turns its water up near the river and down to nothing out of earshot', () => {
    const { hub, targets } = fakeHub();
    const a = new RiverAudio(hub);
    a.update(at(off(cross.x, 3)), 0.06, 0.05);
    expect(Math.max(...targets)).toBeGreaterThan(0);
    targets.length = 0;
    a.update(at(off(cross.x, 60)), 0.06, 0.05);
    expect(targets.filter((v) => typeof v === 'number' && v > 0 && v < 0.5 && v !== hub.listenerPosition.y).some((v) => v > 0.001)).toBe(false);
  });

  it('calls a bird by day when one is due, and none at night', () => {
    const day = fakeHub();
    const a = new RiverAudio(day.hub);
    a.update(at(off(40, 5), { darkness: 0 }), 0.06, 0.05);
    day.ctx.currentTime += 1000;
    const before = day.started.length;
    a.update(at(off(40, 5), { darkness: 0 }), 0.06, 0.05);
    expect(day.started.length).toBeGreaterThan(before);
    const night = fakeHub();
    const b = new RiverAudio(night.hub);
    b.update(at(off(40, 5), { darkness: 1 }), 0.06, 0.05);
    const made = night.started.length;
    night.ctx.currentTime += 1000;
    b.update(at(off(40, 5), { darkness: 1 }), 0.06, 0.05);
    expect(night.started.length).toBe(made);
  });
});
