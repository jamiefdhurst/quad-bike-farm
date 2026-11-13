import { describe, it, expect } from 'vitest';
import { pickFleet, DEFAULT_FLEET_PARAMS } from '../src/vehicle/fleet.js';
import { QUAD_SPECS, EXTRA_SPECS, TRACTOR_SPEC, UTV_SPEC, TOR_SPEC } from '../src/vehicle/quadSpecs.js';
import { BODY_STYLES } from '../src/vehicle/quadModel.js';
import { DASH_STYLES } from '../src/vehicle/dash.js';
import { createRandom } from '../src/core/random.js';
import { randomiseQuadSpawns, spawnKeepOut, spawnBlocked } from '../src/world/spawns.js';
import { LAYOUT } from '../src/world/layout.js';
import { Track } from '../src/world/track.js';
import { createFields } from '../src/world/fields.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';

describe('the fleet', () => {
  const big = [TRACTOR_SPEC, UTV_SPEC, TOR_SPEC];
  const others = [...EXTRA_SPECS, ...big];
  const pool = [...QUAD_SPECS, ...others];
  const games = Array.from({ length: 600 }, (_, i) => pickFleet(QUAD_SPECS, others, createRandom(i)));

  it('is the same for the same seed', () => {
    expect(pickFleet(QUAD_SPECS, others, createRandom(7)).map((s) => s.id)).toEqual(pickFleet(QUAD_SPECS, others, createRandom(7)).map((s) => s.id));
  });

  it('has between four and every vehicle, and every count turns up', () => {
    const counts = new Set(games.map((f) => f.length));
    for (const f of games) {
      expect(f.length).toBeGreaterThanOrEqual(4);
      expect(f.length).toBeLessThanOrEqual(pool.length);
    }
    expect(Math.min(...counts)).toBe(4);
    expect(Math.max(...counts)).toBe(pool.length);
    expect(counts.size).toBe(pool.length - 3);
  });

  it('is usually somewhere in the middle', () => {
    const mean = games.reduce((n, f) => n + f.length, 0) / games.length;
    expect(mean).toBeGreaterThan(7);
    expect(mean).toBeLessThan(9);
  });

  it('has every vehicle in the pool turn up, the tractor, UTV and Land Rover included, and be missing sometimes', () => {
    for (const spec of pool) {
      expect(games.some((f) => f.includes(spec)), `${spec.id} turns up`).toBe(true);
      expect(games.some((f) => !f.includes(spec)), `${spec.id} is away`).toBe(true);
    }
    expect(games.some((f) => big.every((s) => f.includes(s)))).toBe(true);
    expect(games.some((f) => big.every((s) => !f.includes(s)))).toBe(true);
  });

  it('always keeps a quad for each girl', () => {
    for (const f of games) expect(f.filter((s) => QUAD_SPECS.includes(s)).length).toBeGreaterThanOrEqual(2);
    const f = pickFleet(QUAD_SPECS, others, () => 0.99, { ...DEFAULT_FLEET_PARAMS, minVehicles: 4 });
    expect(f.filter((s) => QUAD_SPECS.includes(s)).length).toBeGreaterThanOrEqual(2);
  });

  it('has no duplicates, and keeps the pool order', () => {
    for (const f of games) {
      expect(new Set(f).size).toBe(f.length);
      expect(f.map((s) => pool.indexOf(s))).toEqual(f.map((s) => pool.indexOf(s)).sort((a, b) => a - b));
    }
  });

  it('copes with a pool smaller than the minimum', () => {
    expect(pickFleet(QUAD_SPECS.slice(0, 2), [], createRandom(1))).toHaveLength(2);
  });
});

describe('extra vehicles', () => {
  it('name body and dash styles that exist, and have what the tuning needs', () => {
    for (const spec of EXTRA_SPECS) {
      expect(BODY_STYLES, spec.name).toContain(spec.style);
      expect(DASH_STYLES, spec.name).toContain(spec.dashStyle);
      expect(spec.idleRange[0], spec.name).toBeGreaterThanOrEqual(spec.safeIdle);
      expect(spec.engine.strokes === 2 ? spec.engine.popProne : 0.7, spec.name).toBe(0.7);
    }
  });

  it('have ids and names unlike the regulars', () => {
    const all = [...QUAD_SPECS, ...EXTRA_SPECS];
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    expect(new Set(all.map((s) => s.name)).size).toBe(all.length);
  });

  it("make the kids' quad small, slow and solo, and the loan quad smooth", () => {
    const kids = EXTRA_SPECS.find((s) => s.id === 'asp');
    const loan = EXTRA_SPECS.find((s) => s.id === 'ursa');
    expect(kids.scale).toBeLessThan(1);
    expect(kids.solo).toBe(true);
    expect(kids.vehicle.wheelRadius).toBeCloseTo(0.3 * kids.scale, 3);
    expect(kids.idleRange[1]).toBeLessThan(QUAD_SPECS.find((q) => q.id === 'hornet').idleRange[0]); // a lower tickover than either two-stroke
    for (const s of QUAD_SPECS) expect(kids.vehicle.maxSpeed).toBeLessThan(s.vehicle.maxSpeed ?? 17);
    for (const s of QUAD_SPECS) expect(loan.engine.wearPerMinute).toBeLessThan((s.engine?.wearPerMinute ?? 0.012) / 5);
    for (const s of QUAD_SPECS) expect(loan.roughnessRange[1]).toBeLessThanOrEqual(s.roughnessRange[0] + 0.001);
  });

  it('makes the mini moto a solo two-stroke with a pull-start, anyone may ride, and two wheels in a line', async () => {
    const moto = EXTRA_SPECS.find((s) => s.id === 'tz65');
    expect(moto.solo).toBe(true);
    expect(moto.owner).toBeUndefined();
    expect(moto.engine.strokes).toBe(2);
    expect(moto.engine.pullStart).toBe(true);
    expect(moto.engine.noStarter).toBe(true);
    expect(moto.vehicle.fourWheelDrive).toBe(0);
    for (const s of QUAD_SPECS) expect(moto.vehicle.maxSpeed).toBeLessThan(s.vehicle.maxSpeed ?? 17);
    const { MOTO_LAYOUT } = await import('../src/vehicle/miniMotoModel.js');
    expect(MOTO_LAYOUT.wheels).toHaveLength(2);
    for (const w of MOTO_LAYOUT.wheels) expect(w.x).toBe(0);
  });

  it('makes the old three-wheeler a worn, solo, cord-start two-stroke with a manual box and three wheels that can tip', async () => {
    const t185 = EXTRA_SPECS.find((s) => s.id === 't185');
    const yellow = QUAD_SPECS.find((s) => s.id === 'hornet');
    expect(t185.solo).toBe(true);
    expect(t185.manual).toBe(true);
    expect(t185.engine.strokes).toBe(2);
    expect(t185.engine.pullStart).toBe(true);
    expect(t185.engine.noStarter).toBe(true);
    expect(t185.wearRange[0]).toBeGreaterThanOrEqual(yellow.wearRange[0]); // worn, but not so much that build roughness plus wear dealt it erratic (startingCondition.test.js)
    expect(t185.audio.recBank).toBe('engine-bank-atc'); // its own sound, a Piaggio Ape's tickover
    expect(t185.idleRange[0]).toBeGreaterThanOrEqual(1300); // a realistic two-stroke tickover
    expect(t185.idleRange[1]).toBeLessThanOrEqual(1800);
    const { T185_LAYOUT } = await import('../src/vehicle/t185Model.js');
    expect(T185_LAYOUT.wheels).toHaveLength(3);
    expect(T185_LAYOUT.wheels.filter((w) => w.front)).toHaveLength(1);
    expect(t185.vehicle.centreOfMassY).toBeGreaterThan(-0.08); // higher than a quad's default, so it can tip
  });
});

describe('where the vehicles start', () => {
  const spawn = LAYOUT.spawn;
  const kinds = (n, bigAt) => Array.from({ length: n }, (_, i) => bigAt.includes(i));

  it('finds a place for a full twelve, hers in the yard, none on top of another', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const big = kinds(12, [9, 10, 11]);
      const { placed, home } = randomiseQuadSpawns(spawn, 12, createRandom(seed), { homeCount: 9, big });
      expect(placed).toHaveLength(12);
      expect(home).toBeLessThan(9);
      expect(placed[home].where).toBe('in the yard');
      placed.forEach((a, i) =>
        placed.forEach((b, j) => {
          if (i < j) expect(Math.hypot(a.x - b.x, a.z - b.z), `seed ${seed}: ${i} and ${j}`).toBeGreaterThanOrEqual(big[i] || big[j] ? 6 : 4.5);
        }),
      );
    }
  });

  it('puts no more than yardMax in the yard, and leaves the rest out on the farm', () => {
    const { placed } = randomiseQuadSpawns({ ...spawn, awayChance: 0 }, 12, createRandom(3));
    expect(placed.filter((p) => p.where === 'in the yard')).toHaveLength(spawn.yardMax);
  });

  it('never parks the tractor, UTV or a Land Rover in the yard', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const big = kinds(10, [7, 8, 9]);
      const { placed } = randomiseQuadSpawns({ ...spawn, awayChance: 0 }, 10, createRandom(seed), { homeCount: 7, big });
      for (const i of [7, 8, 9]) expect(placed[i].where).not.toBe('in the yard');
    }
  });

  const track = new Track(LAYOUT.trackPoints);
  const keepOut = spawnKeepOut(LAYOUT);
  const blocked = (x, z) => spawnBlocked(keepOut, x, z, { track, trackHalfWidth: LAYOUT.trackHalfWidth });

  it('has every spot clear of the trailers, the tank, the barn, the bales, the jump, the drag strip and the track, nudged any way', () => {
    const fields = createFields(LAYOUT);
    const heights = createTerrainHeight(LAYOUT, track);
    const spots = [...spawn.quads.map((q) => ({ ...q, jitter: spawn.quadJitter, where: 'yard' })), ...spawn.away.map((a) => ({ ...a, jitter: a.jitter ?? spawn.awayJitter }))];
    for (const a of spots) {
      const j = a.jitter;
      for (const [dx, dz] of [[0, 0], [-j, -j], [j, -j], [-j, j], [j, j]]) {
        const x = a.x + dx;
        const z = a.z + dz;
        expect(blocked(x, z), `${a.where} (${a.x}, ${a.z})`).toBe(null);
        expect(fields.hedgeDistance(x, z), `${a.where} (${a.x}, ${a.z}) is near a hedge`).toBeGreaterThan(3.3);
        const e = 1.5;
        const slope = Math.hypot(heights.heightAt(x + e, z) - heights.heightAt(x - e, z), heights.heightAt(x, z + e) - heights.heightAt(x, z - e)) / (2 * e);
        expect(slope, `${a.where} (${a.x}, ${a.z}) is steep`).toBeLessThan(0.15);
      }
    }
  });

  it('keeps the yard slots well apart', () => {
    for (const a of spawn.quads) for (const b of spawn.quads) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(8);
  });

  it('never starts a vehicle on anything, over many deals, with the yard spread out', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const big = kinds(12, [9, 10, 11]);
      const { placed } = randomiseQuadSpawns(spawn, 12, createRandom(seed), { homeCount: 9, big, blocked });
      for (const p of placed) expect(blocked(p.x, p.z), `seed ${seed}: ${p.where}`).toBe(null);
      const yard = placed.filter((p) => p.where === 'in the yard');
      expect(yard.length).toBeLessThanOrEqual(spawn.yardMax);
      for (const a of yard) for (const b of yard) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('nudges a vehicle again when the nudge lands on something, and at worst uses the middle of its spot', () => {
    const nowhere = () => 'everything';
    const { placed } = randomiseQuadSpawns({ ...spawn, awayChance: 0 }, 3, createRandom(5), { blocked: nowhere });
    for (const p of placed) expect(spawn.quads.some((q) => q.x === p.x && q.z === p.z)).toBe(true);
  });

  it('keeps out of the tipping trailer, which a quad left by the paddock used to start on', () => {
    const t = LAYOUT.tipTrailer;
    expect(spawnBlocked(keepOut, t.x + 2, t.z)).toBe('the tipping trailer');
    expect(spawnBlocked(keepOut, LAYOUT.trailer.x, LAYOUT.trailer.z + 3)).toBe('the bale trailer');
  });

  it('never leaves the tractor, UTV or Land Rover in a tight spot, but does leave them away', () => {
    let away = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const big = kinds(12, [9, 10, 11]);
      const { placed } = randomiseQuadSpawns({ ...spawn, awayChance: 0.8 }, 12, createRandom(seed), { homeCount: 9, big });
      for (const i of [9, 10, 11]) {
        const w = placed[i].where;
        if (w !== 'in the yard') away++;
        expect(['in the Dutch barn', 'along the road']).not.toContain(w);
      }
    }
    expect(away).toBeGreaterThan(100);
  });
});
