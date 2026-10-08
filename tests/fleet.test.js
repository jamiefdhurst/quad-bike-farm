import { describe, it, expect } from 'vitest';
import { pickFleet, DEFAULT_FLEET_PARAMS } from '../src/vehicle/fleet.js';
import { QUAD_SPECS, EXTRA_SPECS, TRACTOR_SPEC, UTV_SPEC, LAND_ROVER_SPEC } from '../src/vehicle/quadSpecs.js';
import { BODY_STYLES } from '../src/vehicle/quadModel.js';
import { DASH_STYLES } from '../src/vehicle/dash.js';
import { createRandom } from '../src/core/random.js';
import { randomiseQuadSpawns } from '../src/world/spawns.js';
import { LAYOUT } from '../src/world/layout.js';

describe('the fleet', () => {
  const big = [TRACTOR_SPEC, UTV_SPEC, LAND_ROVER_SPEC];
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
    const kids = EXTRA_SPECS.find((s) => s.id === 'kids');
    const loan = EXTRA_SPECS.find((s) => s.id === 'loan');
    expect(kids.scale).toBeLessThan(1);
    expect(kids.solo).toBe(true);
    expect(kids.vehicle.wheelRadius).toBeCloseTo(0.3 * kids.scale, 3);
    expect(kids.idleRange[1]).toBeLessThan(QUAD_SPECS.find((q) => q.id === 'yellow').idleRange[0]); // a lower tickover than either two-stroke
    for (const s of QUAD_SPECS) expect(kids.vehicle.maxSpeed).toBeLessThan(s.vehicle.maxSpeed ?? 17);
    for (const s of QUAD_SPECS) expect(loan.engine.wearPerMinute).toBeLessThan((s.engine?.wearPerMinute ?? 0.012) / 5);
    for (const s of QUAD_SPECS) expect(loan.roughnessRange[1]).toBeLessThanOrEqual(s.roughnessRange[0] + 0.001);
  });

  it('makes the mini moto a solo two-stroke with a pull-start, anyone may ride, and hidden outriggers that never go flat', async () => {
    const moto = EXTRA_SPECS.find((s) => s.id === 'moto');
    expect(moto.solo).toBe(true);
    expect(moto.owner).toBeUndefined();
    expect(moto.engine.strokes).toBe(2);
    expect(moto.engine.pullStart).toBe(true);
    expect(moto.engine.noStarter).toBe(true);
    expect(moto.vehicle.fourWheelDrive).toBe(0);
    for (const s of QUAD_SPECS) expect(moto.vehicle.maxSpeed).toBeLessThan(s.vehicle.maxSpeed ?? 17);
    const { MOTO_LAYOUT } = await import('../src/vehicle/miniMotoModel.js');
    const out = MOTO_LAYOUT.wheels.filter((w) => w.outrigger);
    expect(out).toHaveLength(2);
    for (const w of out) expect(w.driven).toBe(false);
    for (const w of MOTO_LAYOUT.wheels.filter((w) => !w.outrigger)) expect(w.x).toBe(0);
  });

  it('makes the old three-wheeler a worn, solo, cord-start two-stroke with a manual box and three wheels that can tip', async () => {
    const atc = EXTRA_SPECS.find((s) => s.id === 'atc');
    const yellow = QUAD_SPECS.find((s) => s.id === 'yellow');
    expect(atc.solo).toBe(true);
    expect(atc.manual).toBe(true);
    expect(atc.engine.strokes).toBe(2);
    expect(atc.engine.pullStart).toBe(true);
    expect(atc.engine.noStarter).toBe(true);
    expect(atc.wearRange[0]).toBeGreaterThanOrEqual(yellow.wearRange[1]);
    expect(atc.audio.recBank).toBe('engine-bank-atc'); // its own sound, a Piaggio Ape's tickover
    expect(atc.idleRange[0]).toBeGreaterThanOrEqual(1300); // a realistic two-stroke tickover
    expect(atc.idleRange[1]).toBeLessThanOrEqual(1800);
    const { ATC_LAYOUT } = await import('../src/vehicle/atcModel.js');
    expect(ATC_LAYOUT.wheels).toHaveLength(3);
    expect(ATC_LAYOUT.wheels.filter((w) => w.front)).toHaveLength(1);
    expect(atc.vehicle.centreOfMassY).toBeGreaterThan(-0.08); // higher than a quad's default, so it can tip
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
          if (i < j) expect(Math.hypot(a.x - b.x, a.z - b.z), `seed ${seed}: ${i} and ${j}`).toBeGreaterThanOrEqual(big[i] || big[j] ? 4.6 : 2.8);
        }),
      );
    }
  });

  it('leaves the extras out on the farm when there are more vehicles than parking slots', () => {
    const { placed } = randomiseQuadSpawns({ ...spawn, awayChance: 0 }, 12, createRandom(3));
    expect(placed.filter((p) => p.where === 'in the yard')).toHaveLength(spawn.quads.length);
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
