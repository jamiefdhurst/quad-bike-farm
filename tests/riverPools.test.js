import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { createRiver } from '../src/world/river.js';
import { waterEdge } from '../src/world/riverPlaces.js';
import { DEFAULT_ENGINE_PARAMS as P } from '../src/engine/engineParams.js';
import { deepWaterGulp, stepWater, waterGulp } from '../src/engine/water.js';
import { DEFAULT_STREAM_PARAMS } from '../src/world/streamLevel.js';

// The river's pools and riffles (#1000). Everything here is measured on the surface a player sees, the ground at the river's middle (the land less the
// cut) plus the water standing on it, never on the numbers brook.js builds it from: the first pools were a deeper cut with deeper water, which cancel,
// and a test of the numbers passed while the river stayed one steady fall (#565, #1001).

const heights = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
const brook = heights.brook;
const river = createRiver(LAYOUT, brook);
const riffles = brook.riffles?.() ?? [];
const pools = brook.pools?.() ?? [];
/** The water's surface at the river's middle at x, as drawn and as a wheel finds it. */
const surface = (x) => heights.heightAt(x, brook.zAt(x)) + brook.waterDepthAt(x);
/** The land at the river's middle at x, before the river is cut into it. */
const land = (x) => heights.naturalAt(x, brook.zAt(x));
/** Metres of water over the bed at the river's middle at x. */
const water = (x) => surface(x) - heights.heightAt(x, brook.zAt(x));
/** Metres the bed at the river's middle is cut below the land. */
const cut = (x) => land(x) - heights.heightAt(x, brook.zAt(x));
/** The water's width at x, edge to edge. */
const width = (x) => waterEdge(brook, x, -1) + waterEdge(brook, x, 1);

describe('the river\'s steps (#1000)', () => {
  it('has pools and riffles all down it, the surface stepping down at each riffle: a fall of 0.3 m or more within 3 m, found from the surface alone', () => {
    expect(riffles.length).toBeGreaterThanOrEqual(12);
    expect(pools.length).toBe(riffles.length); // each pool ends in a riffle: the last riffle is where the river narrows into the brook
    for (let i = 0; i < pools.length; i++) expect(pools[i].b).toBeLessThanOrEqual(riffles[i].a);
    expect(brook.tailMeets()).toBeGreaterThan(riffles.at(-1).b); // and below it the surface comes back to the steady fall, inside the stepped reach
    // Every step in the surface a player sees, found without asking brook.js where its riffles are, wherever it is the river (three quarters of its
    // width and more: above that the pasture's stream is still widening into it, and below it narrows into the brook): each is one of its riffles,
    // and each riffle is one.
    const steps = [];
    for (let x = brook.minX + 2; x < LAYOUT.hill.river.toX; x += 0.5) {
      if (brook.riverK(x) < 0.75) continue;
      if (surface(x) - surface(x + 3) >= 0.3 && !steps.some((s) => x - s < 4)) steps.push(x);
    }
    expect(steps.length).toBe(riffles.length);
    for (const s of steps) expect(riffles.some((r) => s > r.a - 3.5 && s < r.b + 0.5), `step at ${s}`).toBe(true);
  });

  it('drops the surface 0.3 to 0.5 m at each riffle', () => {
    for (const r of riffles) {
      const drop = surface(r.a) - surface(r.b);
      expect(drop, `riffle at ${r.x.toFixed(0)}`).toBeGreaterThanOrEqual(0.3);
      expect(drop, `riffle at ${r.x.toFixed(0)}`).toBeLessThanOrEqual(0.52);
    }
  });

  it('lets each pool\'s surface fall under half as fast as the land over it, and level where the land does not fall', () => {
    for (const p of pools) {
      const fell = surface(p.a + 0.25) - surface(p.b - 0.25);
      const landFell = land(p.a + 0.25) - land(p.b - 0.25);
      expect(fell, `pool ${p.a.toFixed(0)} to ${p.b.toFixed(0)}`).toBeGreaterThanOrEqual(-0.005);
      if (landFell > 0.05) expect(fell / landFell, `pool ${p.a.toFixed(0)} to ${p.b.toFixed(0)}`).toBeLessThan(0.5);
      else expect(fell, `pool ${p.a.toFixed(0)} to ${p.b.toFixed(0)}`).toBeLessThan(0.03);
    }
  });

  it('holds each pool up with a cut deeper below the land at its foot than at its head', () => {
    for (const p of pools) expect(cut(p.b - 0.5), `pool ${p.a.toFixed(0)} to ${p.b.toFixed(0)}`).toBeGreaterThan(cut(p.a + 0.5));
  });

  it('has a bed with no ledge along the river: it shelves from a pool\'s deep foot up onto its riffle no steeper than 1 in 1 (the surface alone hid a 0.45 m step)', () => {
    const bed = (x) => heights.heightAt(x, brook.zAt(x));
    for (let x = pools[0].a; x < brook.tailMeets(); x += 0.25) expect(Math.abs(bed(x + 0.25) - bed(x)), `x ${x}`).toBeLessThan(0.27);
  });

  it('never rises downstream, through every pool and riffle', () => {
    for (let x = brook.minX + 1; x < brook.maxX - 8; x += 0.25) expect(surface(x + 0.25) - surface(x), `x ${x}`).toBeLessThan(0.01);
  });

  it('keeps the bank\'s top 0.3 m and more above the water on both sides all along the river, and its walls where the bank is a wall', () => {
    const banks = LAYOUT.hill.river.banks;
    let walls = 0;
    for (let x = brook.minX + 2; x <= LAYOUT.hill.river.toX; x += 0.5) {
      const zc = brook.zAt(x);
      for (const side of [-1, 1]) {
        // The bank's top: where the channel's cut ends and the field begins, however the bank comes down to the water (a wall, a bar, a landing).
        let r = waterEdge(brook, x, side);
        while (brook.cutAt(x, zc + side * r) > 0.001 && r < brook.halfAt(x) + Math.max(banks.landing, banks.bar.reach) + 2) r += 0.1;
        expect(heights.heightAt(x, zc + side * r) - surface(x), `top at ${x}, ${side}`).toBeGreaterThanOrEqual(0.3);
        // A wall: the ground a little back from the water's edge, where no bar, landing or drinking place brings it down.
        const edge = waterEdge(brook, x, side);
        const z = zc + side * (edge + 0.6);
        if (brook.barAt(x, z) > 0.05 || brook.notchAt(x, z).k > 0.05) continue;
        walls++;
        expect(heights.heightAt(x, z) - surface(x), `wall at ${x}, ${side}`).toBeGreaterThanOrEqual(0.3);
      }
    }
    expect(walls).toBeGreaterThan(400);
  });
});

describe('a riffle (#1000)', () => {
  it('is a wade of about 0.4 m at its middle, where the pools either side are 0.85 m and more', () => {
    for (const r of riffles) {
      if (r.crossing) continue; // the crossing's own shallows are its 0.2 m (river.test.js)
      expect(water(r.x), `riffle at ${r.x.toFixed(0)}`).toBeGreaterThan(0.3);
      expect(water(r.x), `riffle at ${r.x.toFixed(0)}`).toBeLessThan(0.42);
    }
    for (const p of pools) expect(water((p.a + p.b) / 2), `pool ${p.a.toFixed(0)} to ${p.b.toFixed(0)}`).toBeGreaterThan(0.85);
  });

  it('is narrower than the pools either side of it, where they meet it', () => {
    for (let i = 0; i < riffles.length; i++) {
      const r = riffles[i];
      // The pool's water a metre into it from the riffle's (the crossing's own shallows are its, so the middle of each pool beside it).
      // The last riffle has its pool above it only: below it the river narrows into the brook.
      const either = r.crossing ? [pools[i], pools[i + 1]].map((p) => width((p.a + p.b) / 2)) : [width(pools[i].b - 1), ...(pools[i + 1] ? [width(pools[i + 1].a + 1)] : [])];
      expect(width(r.x), `riffle at ${r.x.toFixed(0)}`).toBeLessThan(Math.min(...either) * 0.92);
    }
  });

  it('has a gravel bar showing: a shelf out of the water, at most 0.3 m above it for 1.5 m and more, painted as gravel', () => {
    for (const r of riffles) {
      let best = 0;
      for (let x = r.barFrom; x <= r.barTo; x += 0.5) {
        const zc = brook.zAt(x);
        let run = 0;
        for (let u = 0; u < brook.halfAt(x) + 6; u += 0.1) {
          const z = zc + r.side * u;
          const h = heights.heightAt(x, z) - surface(x);
          if (h >= -0.02 && h <= 0.3 && brook.barAt(x, z) > 0.5) best = Math.max(best, (run += 0.1));
          else run = 0;
        }
      }
      expect(best, `riffle at ${r.x.toFixed(0)}`).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('is a wade an engine takes at a walk, even with the stream full; a pool drowns it at any speed', () => {
    const gulpFull = DEFAULT_STREAM_PARAMS.gulpHigh;
    for (const r of riffles) {
      let w = 0;
      for (const x of [r.a + 0.3, r.x, r.b - 0.3]) {
        for (let dz = -brook.halfAt(x); dz <= brook.halfAt(x); dz += 0.5) {
          const z = brook.zAt(x) + dz;
          expect(brook.deepAt(x, z), `${x}, ${z}`).toBe(0);
          for (let t = 0; t < 2; t += 0.1) w = stepWater(w, 0.1, { gulp: waterGulp(heights.puddleAt(x, z), P.waterSafeSpeed - 0.5, P) * gulpFull, running: true }, P);
        }
      }
      expect(w, `riffle at ${r.x.toFixed(0)}`).toBeLessThan(P.waterStallAt);
      if (r.x < LAYOUT.hill.riverside.maxX) expect(river.zoneAt(r.x, brook.zAt(r.x)), `riffle at ${r.x.toFixed(0)}`).toBe(r.crossing ? 'crossing' : 'riffle'); // past the meadow's river gate there are no zones
    }
    for (const p of pools) {
      const x = (p.a + p.b) / 2;
      expect(brook.deepAt(x, brook.zAt(x)), `pool ${p.a.toFixed(0)} to ${p.b.toFixed(0)}`).toBeCloseTo(1, 5);
      let w = 0;
      for (let t = 0; t < 1; t += 0.05) w = stepWater(w, 0.05, { gulp: deepWaterGulp(brook.deepAt(x, brook.zAt(x)), P), running: true }, P);
      expect(w, `pool ${p.a.toFixed(0)} to ${p.b.toFixed(0)}`).toBeGreaterThan(P.waterStallAt);
      if (x < LAYOUT.hill.riverside.maxX) expect(river.zoneAt(x, brook.zAt(x))).toBe('deep');
    }
  });
});

describe('the crossing is the first riffle (#1000)', () => {
  it('is laid from the crossing\'s one anchor, with no riffle above it, and stays a wade', () => {
    const anchor = brook.crossing();
    expect(riffles[0].crossing).toBe(true);
    expect(riffles[0].x).toBe(anchor.x);
    expect(riffles.filter((r) => r.crossing)).toHaveLength(1);
    expect(pools[0].b).toBeLessThanOrEqual(anchor.x);
    expect(brook.waterDepthAt(anchor.x)).toBeCloseTo(LAYOUT.hill.river.crossing.water, 2);
    expect(surface(anchor.x - LAYOUT.hill.river.crossing.half) - surface(anchor.x + LAYOUT.hill.river.crossing.half)).toBeGreaterThanOrEqual(0.3);
  });

  it('places the same riffles, and the same crossing, without the ground: the map, the paint and the budget\'s spot read a brook made from the layout alone', async () => {
    const { createBrook } = await import('../src/world/brook.js');
    const plain = createBrook(LAYOUT);
    expect(plain.riffles().map((r) => r.x)).toEqual(riffles.map((r) => r.x));
    for (const r of riffles) expect(plain.halfAt(r.x)).toBeCloseTo(brook.halfAt(r.x), 9);
    expect(plain.crossing().half).toBeCloseTo(brook.crossing().half, 9);
  });
});

describe('where you are at the river, in words (#1000)', () => {
  it('says a riffle and a deep pool for the console\'s `river.now` and the panel', async () => {
    const { describeRiverZone } = await import('../src/world/river.js');
    const r = riffles[3];
    expect(describeRiverZone(river.zoneAt(r.x, brook.zAt(r.x)), 0.5)).toBe('you are on a riffle; the river is 50% up');
    const p = pools[1];
    expect(describeRiverZone(river.zoneAt((p.a + p.b) / 2, brook.zAt((p.a + p.b) / 2)), 0)).toBe('you are in a deep pool; the river is 0% up');
    expect(describeRiverZone(null, 1)).toBe('you are away from it; the river is 100% up');
  });

  it('has `tp me to riffle`: on the gravel bar beside the first riffle below the crossing, out of the water', async () => {
    const { riffleSpot } = await import('../src/console/gameHost.js');
    const p = riffleSpot(brook);
    expect(p.x).toBe(riffles[1].x);
    expect(brook.waterAt(p.x, p.z)).toBe(0);
    expect(brook.barAt(p.x, p.z)).toBeGreaterThan(0.5);
    expect(Math.abs(p.z - brook.zAt(p.x)) - waterEdge(brook, p.x, riffles[1].side)).toBeLessThan(3);
  });
});

describe('the river\'s sound at its riffles (#1000)', () => {
  it('babbles over each riffle more than over the long still pool, and loudest at the crossing', async () => {
    const { riverHeard } = await import('../src/world/riverBed.js');
    const near = (x) => riverHeard(brook, x, brook.zAt(x) - brook.halfAt(x) - 3).babble;
    const long = pools.reduce((a, p) => (p.b - p.a > a.b - a.a ? p : a));
    const still = near((long.a + long.b) / 2);
    for (const r of riffles) {
      if (r.crossing) continue;
      expect(near(r.x), `riffle at ${r.x.toFixed(0)}`).toBeGreaterThan(still * 1.15);
      expect(near(r.x), `riffle at ${r.x.toFixed(0)}`).toBeLessThan(near(brook.crossing().x));
    }
  });
});

describe('how the water is drawn over pools and riffles (#1000)', () => {
  it('shades a pool darker and a riffle paler than the river\'s plain water, and lays broken water on every riffle, on its surface and inside its edges', async () => {
    const { waterShade, riffleFoam } = await import('../src/world/riverPlaces.js');
    for (const p of pools) expect(waterShade(brook, (p.a + p.b) / 2)).toBeLessThan(0.85);
    for (const r of riffles) expect(waterShade(brook, r.x)).toBeGreaterThan(1.2);
    const foam = riffleFoam(brook, heights.heightAt);
    expect(foam).toHaveLength(riffles.length);
    foam.forEach((run, i) => {
      const r = riffles[i];
      expect(run[0].x).toBeLessThan(r.a);
      expect(run.at(-1).x).toBeGreaterThan(r.b);
      expect(run[0].a + run.at(-1).a).toBeLessThan(0.01); // nothing at its ends, so it fades into the pools
      for (const c of run) {
        expect(c.y - surface(c.x)).toBeGreaterThan(0);
        expect(c.y - surface(c.x)).toBeLessThan(0.05);
        for (const [side, h] of [[-1, c.hn], [1, c.hs]]) expect(h).toBeLessThanOrEqual(Math.max(0.2, waterEdge(brook, c.x, side)));
      }
    });
    expect(waterShade(createTerrainHeight({ ...LAYOUT, hill: { ...LAYOUT.hill, river: { ...LAYOUT.hill.river, steps: undefined } } }, new Track(LAYOUT.trackPoints)).brook, 0)).toBe(1);
  });
});

describe('the drinking places, with pools and riffles (#1000)', () => {
  it('still bring a cow down to water standing 0.3 m and more deep at each', () => {
    for (const d of brook.drinks) {
      expect(water(d.x), `drink at ${d.x.toFixed(0)}`).toBeGreaterThan(0.3);
      const edge = waterEdge(brook, d.x, d.side);
      expect(edge, `drink at ${d.x.toFixed(0)}`).toBeGreaterThan(1);
    }
  });
});
