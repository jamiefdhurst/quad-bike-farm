import { describe, it, expect } from 'vitest';
import { dealPonytail, BAND_COLOURS, tailRadius, tailPath, buildTail, swingStep, STILL, TAIL, DEFAULT_PONYTAIL_PARAMS, PONYTAIL_PARAM_RANGES } from '../src/npc/ponytail.js';
import { completeStyle, describeOutfit } from '../src/npc/outfits.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { createRandom } from '../src/core/random.js';

const girl = (id) => CHARACTERS.find((c) => c.id === id);

describe('dealing a ponytail', () => {
  it('ties Amy\'s hair back about a third of the time and Jess\'s about one day in seven', () => {
    const share = (id) => {
      const random = createRandom(11);
      let n = 0;
      for (let i = 0; i < 4000; i++) if (dealPonytail(random, girl(id).ponytailChance).ponytail) n++;
      return n / 4000;
    };
    expect(share('amy')).toBeCloseTo(0.35, 1);
    expect(share('jess')).toBeCloseTo(0.15, 1);
  });

  it('draws the same randoms whatever the chance, so one girl\'s deal never moves the other\'s', () => {
    for (const chance of [0, 0.35, 1]) {
      const a = createRandom(5);
      dealPonytail(a, chance);
      const b = createRandom(5);
      b();
      b();
      expect(a()).toBe(b());
    }
  });

  it('mostly gives a black band, now and then a colour', () => {
    const random = createRandom(3);
    let black = 0;
    for (let i = 0; i < 3000; i++) {
      const { band } = dealPonytail(random, 1);
      expect(BAND_COLOURS).toContain(band);
      if (band === '#151515') black++;
    }
    expect(black / 3000).toBeGreaterThan(0.4);
    expect(black / 3000).toBeLessThan(0.65);
  });

  it('is off unless dealt, and the panel and console say when it is on', () => {
    expect(completeStyle({}).ponytail).toBe(false);
    expect(describeOutfit({ kind: 'polo' })).toBe('her polo');
    expect(describeOutfit({ kind: 'polo', ponytail: true })).toBe('her polo, her hair in a ponytail');
  });
});

describe('the tail\'s shape', () => {
  it('is gathered thin under the band, thick just past it and tapers to a thin end', () => {
    expect(tailRadius(0)).toBeCloseTo(TAIL.gathered, 4);
    expect(tailRadius(0.16)).toBeCloseTo(TAIL.full, 4);
    expect(tailRadius(1)).toBeCloseTo(TAIL.end, 4);
    for (let u = 0.2; u < 0.95; u += 0.1) expect(tailRadius(u + 0.05)).toBeLessThan(tailRadius(u));
    expect(tailRadius(1.02)).toBeCloseTo(TAIL.end, 4);
  });

  it('rises back out of the band before it falls, and ends the drop below it', () => {
    const path = tailPath(0.3);
    expect(Math.max(...path.map((p) => p[1]))).toBeGreaterThan(0.004);
    expect(path[3][2]).toBeGreaterThan(0);
    expect(path.at(-1)[1]).toBeCloseTo(-0.3, 5);
  });

  it('lies on her back rather than through it', () => {
    // A back 3 cm behind the band from 6 cm down, leaning out further lower down.
    const backAt = (d) => (d < 0.06 ? null : 0.03 + 0.1 * (d - 0.06));
    const path = tailPath(0.3, backAt);
    path.forEach(([, y, z], i) => {
      const b = backAt(-y);
      if (b != null) expect(z).toBeGreaterThanOrEqual(b + tailRadius(i / TAIL.rings) * TAIL.deep + TAIL.clear - 1e-9);
    });
    // And without one in the way, it hangs close in: no further back than where it leaves the band.
    expect(tailPath(0.3).at(-1)[2]).toBeLessThan(0.01);
  });

  it('builds the tail, its wisps and a band round it from closed tubes', () => {
    const { hair, band } = buildTail(0.3, () => null);
    for (const part of [hair, band]) {
      expect(part.points.length).toBe(part.shade.length);
      for (const t of part.tris) for (const i of t) expect(i).toBeLessThan(part.points.length);
      for (const p of part.points) for (const x of p) expect(Number.isFinite(x)).toBe(true);
    }
    // The wisps run on past the end of the tail.
    expect(Math.min(...hair.points.map((p) => p[1]))).toBeLessThan(-0.31);
    // The band sits within a few centimetres of where the tail leaves her head.
    expect(Math.max(...band.points.map((p) => Math.hypot(...p)))).toBeLessThan(0.03);
  });
});

describe('the swing', () => {
  const run = (accel, seconds, s = { ...STILL }, p = DEFAULT_PONYTAIL_PARAMS) => {
    for (let t = 0; t < seconds; t += 1 / 60) s = swingStep(s, accel, 1 / 60, p);
    return s;
  };

  it('swings out behind her when her head is thrown forward, and settles once she is still', () => {
    const thrown = run([0, -6], 0.15);
    expect(thrown.pitch).toBeGreaterThan(0.02);
    const settled = run([0, 0], 4, thrown);
    expect(Math.abs(settled.pitch)).toBeLessThan(0.005);
    expect(Math.abs(settled.vPitch)).toBeLessThan(0.01);
  });

  it('swings to the side away from a sideways jolt', () => {
    expect(run([5, 0], 0.15).roll).toBeLessThan(-0.02);
    expect(run([-5, 0], 0.15).roll).toBeGreaterThan(0.02);
  });

  it('stops against her back, and never swings past its limit', () => {
    const into = run([0, 30], 1);
    expect(into.pitch).toBeGreaterThanOrEqual(-DEFAULT_PONYTAIL_PARAMS.intoBack - 1e-9);
    const out = run([0, -200], 1);
    expect(out.pitch).toBeLessThanOrEqual(DEFAULT_PONYTAIL_PARAMS.maxSwing + 1e-9);
    expect(Math.abs(run([200, 0], 1).roll)).toBeLessThanOrEqual(DEFAULT_PONYTAIL_PARAMS.maxSwing + 1e-9);
  });

  it('stays steady on a long frame', () => {
    const s = swingStep({ ...STILL, pitch: 0.3 }, [0, 0], 0.5);
    expect(Number.isFinite(s.pitch)).toBe(true);
    expect(Math.abs(s.pitch)).toBeLessThan(0.6);
  });

  it('has a range for every tunable', () => {
    for (const [k, v] of Object.entries(DEFAULT_PONYTAIL_PARAMS)) {
      const [lo, hi] = PONYTAIL_PARAM_RANGES[k];
      expect(v).toBeGreaterThanOrEqual(lo);
      expect(v).toBeLessThanOrEqual(hi);
    }
  });
});
