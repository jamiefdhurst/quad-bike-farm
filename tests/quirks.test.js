import { describe, it, expect } from 'vitest';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';
import { QuirkSet, QUIRK_KINDS, DEFAULT_QUIRK_PARAMS as P, featuresOf, applicableQuirks, pickQuirks, girlKnowsQuirks } from '../src/vehicle/quirks.js';
import { createRandom } from '../src/core/random.js';
import { AMY_QUIRK_LINES, JESS_QUIRK_LINES } from '../src/npc/quirkLines.js';
import { setHeadlights, LENS_GLOW } from '../src/vehicle/quadModel.js';

const all = featuresOf({ dashStyle: 'bruin' });
const many = (n, f) => Array.from({ length: n }, (_, i) => f(createRandom(i + 1)));
const set = (...kinds) => new QuirkSet(kinds, P, createRandom(1));

describe('picking quirks', () => {
  it('gives one to three distinct quirks, never both fuel gauge ones, and repeats for a seed', () => {
    const picks = many(500, (r) => pickQuirks(all, r));
    expect(picks.every((p) => p.length >= 1 && p.length <= 3)).toBe(true);
    expect(picks.some((p) => p.length === 3)).toBe(true);
    expect(picks.some((p) => p.length === 1)).toBe(true);
    for (const p of picks) {
      expect(new Set(p).size).toBe(p.length);
      expect(p.includes('fuelHigh') && p.includes('fuelSticks')).toBe(false);
    }
    expect(pickQuirks(all, createRandom(7))).toEqual(pickQuirks(all, createRandom(7)));
    expect(new Set(picks.flat()).size).toBe(QUIRK_KINDS.length);
  });

  it('only picks what the quad has to act on', () => {
    const red = QUAD_SPECS.find((s) => s.id === 'farm300');
    expect(applicableQuirks(featuresOf(red, false))).not.toContain('fuelHigh'); // no gauge without a pod
    expect(applicableQuirks(featuresOf(red, true))).toContain('fuelHigh');
    const tractor = { tractor: true, fuel: { noTap: true }, dashStyle: 'tractor' };
    const t = applicableQuirks(featuresOf(tractor));
    for (const k of ['tapStiff', 'seatSplit', 'chokeCreeps', 'fuelHigh']) expect(t).not.toContain(k);
    expect(applicableQuirks(featuresOf({ id: 'asp', dashStyle: 'kidsKey' }))).not.toContain('seatSplit');
  });

  it('every real quad can get at least one quirk', () => {
    for (const s of QUAD_SPECS) expect(applicableQuirks(featuresOf(s)).length, s.id).toBeGreaterThan(0);
  });
});

describe('the dash lies', () => {
  const real = { fuelLevel: 0.25, temperature: 0.9, overheat: 0.2 };

  it('shows the truth with no quirks', () => {
    expect(set().dash(real, 0.016)).toEqual(real);
  });

  it('reads high but still reads empty and full', () => {
    const q = set('fuelHigh');
    expect(q.dash(real, 0.016).fuelLevel).toBeGreaterThan(0.25);
    expect(q.dash({ ...real, fuelLevel: 0 }, 0.016).fuelLevel).toBe(0);
    expect(q.dash({ ...real, fuelLevel: 1 }, 0.016).fuelLevel).toBe(1);
  });

  it('sticks, and a knock frees it to the real level', () => {
    const q = set('fuelSticks');
    const stuck = q.dash(real, 0.016).fuelLevel;
    expect(q.dash({ ...real, fuelLevel: 0.9 }, 0.016, false).fuelLevel).toBe(stuck);
    let knocked = false;
    for (let i = 0; i < 20000 && !knocked; i++) knocked = q.dash({ ...real, fuelLevel: 0.9 }, 0.1, true).fuelLevel === 0.9;
    expect(knocked).toBe(true);
  });

  it('holds the temperature needle at cold, with no red zone', () => {
    const d = set('tempCold').dash(real, 0.016);
    expect(d.temperature).toBe(P.tempColdCap);
    expect(d.overheat).toBe(0);
  });
});

describe('the choke creeping on', () => {
  it('creeps a step at a time with the shake, up to its cap, and not at all when off or still', () => {
    const q = set('chokeCreeps');
    let choke = 0;
    for (let i = 0; i < 6000; i++) choke += q.chokeCreep(0.016, { running: true, shake: 1, choke });
    expect(choke).toBeCloseTo(P.chokeCreepMax, 5);
    expect(P.chokeCreepMax).toBeLessThan(0.25); // a warm engine must still idle: under the engine's default richTolerance
    const still = set('chokeCreeps');
    let total = 0;
    for (let i = 0; i < 3000; i++) total += still.chokeCreep(0.016, { running: false, shake: 1, choke: 0 }) + still.chokeCreep(0.016, { running: true, shake: 0, choke: 0 });
    expect(total).toBe(0);
    expect(set().chokeCreep(5, { running: true, shake: 1, choke: 0 })).toBe(0);
  });
});

describe('the stiff fuel tap', () => {
  it('takes repeated presses at first and frees up with use', () => {
    const q = set('tapStiff');
    const presses = [];
    for (let turn = 0; turn < 5; turn++) {
      let n = 0;
      do n++;
      while (!q.pressTap());
      presses.push(n);
    }
    expect(presses[0]).toBe(P.tapStiffPresses);
    expect(presses[presses.length - 1]).toBe(1);
    expect(presses).toEqual([...presses].sort((a, b) => b - a));
  });

  it('forgets half-done presses after a pause', () => {
    const q = set('tapStiff');
    expect(q.pressTap()).toBe(false);
    q.update(P.tapStiffWindow + 0.1);
    expect(q.pressTap()).toBe(false);
    expect(q.pressTap()).toBe(false);
    expect(q.pressTap()).toBe(true);
  });

  it('always turns on a normal tap', () => {
    expect(set().pressTap()).toBe(true);
  });
});

describe('the split seat', () => {
  it('soaks up rain in the open, not under cover, and dries', () => {
    const q = set('seatSplit');
    for (let i = 0; i < 600; i++) q.seatStep(0.1, { raining: true, covered: true });
    expect(q.seatWet).toBe(0);
    for (let i = 0; i < 600; i++) q.seatStep(0.1, { raining: true, covered: false });
    expect(q.seatSoaks).toBe(true);
    const wet = q.seatWet;
    for (let i = 0; i < 600; i++) q.seatStep(0.1, { raining: false, covered: false });
    expect(q.seatWet).toBeLessThan(wet);
  });

  it('soaks you once, then is less wet', () => {
    const q = set('seatSplit');
    q.seatWet = 0.5;
    expect(q.sitOn()).toBe(true);
    expect(q.seatWet).toBeCloseTo(0.2);
    expect(q.sitOn()).toBe(false);
    expect(set('seatSplit').sitOn()).toBe(false); // dry
  });

  it('is never wet on a quad without the quirk', () => {
    const q = set();
    for (let i = 0; i < 600; i++) q.seatStep(0.1, { raining: true, covered: false });
    expect(q.seatWet).toBe(0);
  });
});

describe('the flaky horn', () => {
  it('passes the button straight through without the quirk', () => {
    const q = set();
    expect(q.horn(0.016, true)).toBe(true);
    expect(q.horn(0.016, false)).toBe(false);
  });

  it('is silent when released, sometimes works, sometimes cuts out', () => {
    let sounded = 0;
    let silentPresses = 0;
    for (let press = 0; press < 200; press++) {
      const q = new QuirkSet(['hornFlaky'], P, createRandom(press + 1));
      let heard = 0;
      for (let i = 0; i < 60; i++) heard += q.horn(0.016, true) ? 1 : 0;
      if (heard === 0) silentPresses++;
      else sounded++;
      expect(q.horn(0.016, false)).toBe(false);
    }
    expect(sounded).toBeGreaterThan(40);
    expect(silentPresses).toBeGreaterThan(20);
  });
});

describe('brakes', () => {
  it('pull to the left only under braking', () => {
    const q = set('brakesPull');
    expect(q.brakePull(0)).toBe(0);
    expect(q.brakePull(1)).toBe(P.brakePull);
    expect(set().brakePull(1)).toBe(0);
  });

  it('squeal under braking at speed, and not slowly or without the quirk', () => {
    const q = set('brakeSqueal');
    expect(q.squeal(1, 6)).toBeGreaterThan(0.5);
    expect(q.squeal(0.1, 6)).toBe(0);
    expect(q.squeal(1, 0.5)).toBe(0);
    expect(set().squeal(1, 6)).toBe(0);
  });
});

describe('the headlight', () => {
  it('flickers now and then and is steady without the quirk', () => {
    const q = set('headlightFlicker');
    const levels = [];
    for (let i = 0; i < 6000; i++) levels.push(q.headlight(0.016));
    expect(Math.min(...levels)).toBeLessThan(0.5);
    expect(levels.filter((l) => l === 1).length).toBeGreaterThan(5000);
    expect(set().headlight(0.016)).toBe(1);
  });

  it('dims the lamp lens by the level', () => {
    const lens = { emissive: { setHex() {} }, emissiveIntensity: 0 };
    const model = { userData: { lensMaterial: lens } };
    setHeadlights(model, true, 0.5);
    expect(lens.emissiveIntensity).toBeCloseTo(LENS_GLOW / 2);
    setHeadlights(model, true);
    expect(lens.emissiveIntensity).toBeCloseTo(LENS_GLOW);
    setHeadlights(model, false, 1);
    expect(lens.emissiveIntensity).toBe(0);
  });
});

describe('what the girls know', () => {
  const real = ['tapStiff', 'hornFlaky'];
  const applicable = applicableQuirks(all);

  it('knows them all at accuracy 1, and none (but perhaps a wrong one) at 0', () => {
    expect(girlKnowsQuirks(real, applicable, 1, () => 0.5)).toEqual(real);
    expect(girlKnowsQuirks(real, applicable, 0, () => 0.9)).toEqual([]);
    const wrong = girlKnowsQuirks(real, applicable, 0, createRandom(2));
    for (const k of wrong) expect(real).not.toContain(k);
  });

  it('is right more often as Amy than as Jess', () => {
    const hits = (acc) => many(1000, (r) => girlKnowsQuirks(real, applicable, acc, r).filter((k) => real.includes(k)).length).reduce((a, b) => a + b);
    expect(hits(0.9)).toBeGreaterThan(hits(0.5) + 400);
  });
});

describe('quirk lines', () => {
  it('has a warning for every quirk and the seat, for both girls, with no em dashes', () => {
    const kinds = [...QUIRK_KINDS.map((k) => `quirk${k[0].toUpperCase()}${k.slice(1)}`), 'seatSoaked'];
    for (const k of kinds) {
      expect(AMY_QUIRK_LINES[k].lines.length, k).toBeGreaterThan(0);
      expect(JESS_QUIRK_LINES[k].length, k).toBeGreaterThan(0);
      for (const l of [...AMY_QUIRK_LINES[k].lines, ...JESS_QUIRK_LINES[k]]) expect(l).not.toMatch(/—|\b(he|she)\b/i);
    }
  });
});

describe('the lit headlight beam', () => {
  it('shows only while the lamp is lit, in its colour', () => {
    const mat = () => ({ color: { setHex(h) { this.hex = h; } }, opacity: 0 });
    const beam = mat();
    const halo = mat();
    const shaft = { visible: false, scale: { set(x, y, z) { Object.assign(this, { x, y, z }); } } };
    const bloom = { visible: false, isSprite: true, scale: { setScalar(v) { this.v = v; } } };
    const parts = [shaft, bloom];
    const model = { userData: { lensMaterial: { emissive: { setHex() {} }, emissiveIntensity: 0 }, beamMaterial: beam, haloMaterial: halo, beams: parts } };
    setHeadlights(model, true, 1, 0xabcdef);
    expect(beam.opacity).toBeGreaterThan(0);
    expect(beam.color.hex).toBe(0xabcdef);
    expect(parts.every((p) => p.visible)).toBe(true);
    expect([shaft.scale.z, bloom.scale.v]).toEqual([1, 0.5]); // the usual beam
    setHeadlights(model, true, 1, 0xabcdef, { reach: 2, spread: 1.5, glare: 2, halo: 1.6 });
    expect(shaft.scale.z).toBe(2);
    expect(shaft.scale.x).toBe(1.5);
    expect(bloom.scale.v).toBeCloseTo(0.8);
    expect(beam.opacity).toBeCloseTo(0.2); // a main beam is brighter than the dipped one's 0.1
    setHeadlights(model, true, 0);
    expect(beam.opacity).toBe(0);
    expect(parts.some((p) => p.visible)).toBe(false);
    setHeadlights(model, false, 1);
    expect(halo.opacity).toBe(0);
  });
});
