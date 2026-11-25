import { describe, it, expect } from 'vitest';
import { LORRY, LORRY_LENGTH, MIN_RADIUS, drive, bodies, sweepHits, polygonHitsRect, circleHitsRect, lockedRadius, lorryJourneys } from '../src/world/lorryPath.js';
import { layoutNew, LORRY_PLAN, DRIVE_PLAN, LANE_PLAN, FARMSTEAD_PLAN, PLAN_ORIGIN } from '../src/world/layoutNew.js';
import { filletDistance } from '../src/world/roads.js';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';

const two = LAYOUT;
const plan = (p) => [p.x + PLAN_ORIGIN[0], p.z + PLAN_ORIGIN[1]];
const around = (name, p, halfX, halfZ) => ({ name, rect: [plan(p)[0] - halfX, plan(p)[1] - halfZ, plan(p)[0] + halfX, plan(p)[1] + halfZ] });
const planRect = (k) => [k.minX + PLAN_ORIGIN[0], k.minZ + PLAN_ORIGIN[1], k.maxX + PLAN_ORIGIN[0], k.maxZ + PLAN_ORIGIN[1]];
const DRIVE_Z = DRIVE_PLAN.z;
const BARN = [498, 319, 524, 337]; // the barn's walls on the plan (docs/farm-plan.md)

/** What stands in the farmstead that a lorry cannot drive through, as plan rectangles: buildings, kept-clear places (less the lorry's own circle), the garden and the
 * stackyard, the girls' cars and the yard's trailers and tanks (a trailer as the square that holds it). Vehicles that come and go (the day's quads) are not here. */
const standing = [
  { name: 'the barn', rect: BARN },
  ...two.farmstead.keptClear.filter((k) => k.name !== 'lorry turning circle').map((k) => ({ name: k.name, rect: planRect(k) })),
  { name: 'the garden', rect: planRect(two.farmstead.garden) },
  { name: 'the stackyard', rect: planRect(two.farmstead.stackyard) },
  { name: 'the orchard', rect: planRect(two.farmstead.orchard) },
  ...Object.entries(two.cars).map(([k, c]) => around(`${k}'s car`, c, 1.1, 2.3)),
  ...['trailer', 'tipTrailer', 'sprayer', 'harrows'].map((k) => around(k, two[k], 3.2, 3.2)),
  around('the fuel tank', two.fuelTank, 1.6, 1.4),
  around('the diesel bowser', two.dieselBowser, 1.6, 1.0),
  around('the muck heap', two.muckHeap, two.muckHeap.halfX, two.muckHeap.halfZ),
];
const MARGIN = 0.3; // m of room asked for round every building

const J = lorryJourneys(LORRY_PLAN, DRIVE_Z);
const legs = Object.entries(J).filter(([k]) => k !== 'ends');
/** A bay's drive ends with the trailer's tail on its building's face, so that building is held to the face (1 cm shy) and everything else to `MARGIN`. */
const OWN = { sheepBay: 'sheep pens', grainBay: 'grain store' };
const hits = (name, poses, list = standing) => [
  ...sweepHits(poses, list.filter((f) => f.name !== OWN[name]), MARGIN),
  ...sweepHits(poses, list.filter((f) => f.name === OWN[name]), -0.01),
];
const near = (a, b, m = 0.05) => Math.hypot(a.x - b.x, a.z - b.z) < m;

describe('the articulated lorry', () => {
  it('is 16.5 m long and 2.55 m wide, as long as the road allows an artic', () => {
    expect(LORRY_LENGTH).toBeCloseTo(16.5, 6);
    expect(LORRY.width).toBe(2.55);
    expect(LORRY.trailer.ahead + LORRY.trailer.behind).toBeGreaterThan(13); // a 13.6 m semi-trailer
  });

  it('draws the trailer in line behind a tractor that goes straight', () => {
    const poses = drive({ x: 0, z: 0, heading: 0 }, [{ line: 50 }]);
    expect(poses.at(-1).x).toBeCloseTo(50, 6);
    expect(poses.at(-1).trailer).toBeCloseTo(0, 9);
  });

  it('has the trailer cut inside the tractor\'s track on a turn, and lag behind it', () => {
    const r = 12;
    const poses = drive({ x: 0, z: 0, heading: 0 }, [{ arc: { r, turn: Math.PI * 4 } }]); // two circles: steady
    const p = poses.at(-1);
    const middle = [0, r]; // the circle's middle: the rear axle is r from it
    const axle = [p.x - Math.cos(p.trailer) * LORRY.trailer.axle, p.z - Math.sin(p.trailer) * LORRY.trailer.axle]; // the trailer's axle, 10.2 m behind the pin
    expect(Math.hypot(axle[0] - middle[0], axle[1] - middle[1])).toBeLessThan(Math.hypot(p.x - middle[0], p.z - middle[1]) - 2); // well inside
    expect(Math.abs(Math.sin(p.heading - p.trailer))).toBeGreaterThan(0.2); // and its heading trails the tractor's
  });

  it('cannot be driven round a turn tighter than its steering lock', () => {
    expect(MIN_RADIUS).toBeGreaterThan(3);
    expect(() => drive({ x: 0, z: 0, heading: 0 }, [{ arc: { r: 2, turn: 1 } }])).toThrow(/tighter/);
  });

  it('knows when a body meets a rectangle: a hit, a miss, and a touch that is not one', () => {
    const [tractor] = bodies({ x: 10, z: 0, heading: 0, trailer: 0 });
    expect(polygonHitsRect(tractor, [14, -1, 20, 1])).toBe(true);
    expect(polygonHitsRect(tractor, [15, -1, 20, 1])).toBe(false); // the nose is at 14.5
    expect(polygonHitsRect(tractor, [14.5, -1, 20, 1])).toBe(false); // touching
    expect(polygonHitsRect(tractor, [14.5, -1, 20, 1], 0.3)).toBe(true); // within the room asked for
    const turned = bodies({ x: 0, z: 0, heading: Math.PI / 4, trailer: Math.PI / 4 })[0]; // a corner of the rotated body stands out past its square
    expect(polygonHitsRect(turned, [3, 3, 6, 6])).toBe(true);
    expect(polygonHitsRect(turned, [-6, 3.5, -3.5, 6])).toBe(false);
  });

  it('sweeps a circle with its outer front corner when it is driven round on full lock, the 25 m a lorry needs', () => {
    const r = lockedRadius(25);
    const poses = drive({ x: 0, z: 0, heading: 0 }, [{ arc: { r, turn: Math.PI * 3 } }]);
    let reach = 0;
    for (const p of poses.slice(poses.length / 2)) for (const poly of [bodies(p)[0]]) for (const [x, z] of poly) reach = Math.max(reach, Math.hypot(x, z - r));
    expect(reach).toBeCloseTo(12.5, 1);
  });
});

describe('the drive and its bellmouth', () => {
  it('is at least 4 m wide', () => {
    expect(DRIVE_PLAN.halfWidth * 2).toBeGreaterThanOrEqual(4);
    expect(two.road.halfWidth * 2).toBeGreaterThanOrEqual(4);
  });

  it('rounds its two corners at the lane with a 12 m radius, in the road the ground is painted from', () => {
    expect(DRIVE_PLAN.bellmouth).toBe(12);
    const farm = two.roads.find((r) => r.id === 'farm');
    expect(farm.fillets).toHaveLength(2);
    for (const f of farm.fillets) {
      expect(f.r).toBe(12);
      const [x, z] = plan(f);
      expect(x).toBeCloseTo(DRIVE_PLAN.toX - LANE_PLAN.halfWidth, 6); // at the lane's edge
      expect(Math.abs(z - DRIVE_Z)).toBeCloseTo(DRIVE_PLAN.halfWidth, 6); // and the drive's
    }
    // Hard standing in the corner between the arc and the edges, and none beyond the arc.
    const f = farm.fillets.find((q) => q.vz < 0);
    const at = (a, b) => [f.x + f.ux * a + f.vx * b, f.z + f.uz * a + f.vz * b];
    expect(filletDistance(f, ...at(1, 1))).toBeLessThan(0);
    expect(filletDistance(f, ...at(11, 11))).toBeGreaterThan(0);
    expect(filletDistance(f, ...at(13, 1))).toBeGreaterThan(0);
  });

  it('lets the lorry\'s wheels stay within 1.5 m of the tarmac as it turns in off the lane', () => {
    const lane = DRIVE_PLAN.toX;
    const R = DRIVE_PLAN.bellmouth;
    const edge = lane - LANE_PLAN.halfWidth;
    const hd = DRIVE_PLAN.halfWidth;
    const paved = (x, z) => {
      if (Math.abs(x - lane) <= LANE_PLAN.halfWidth) return true;
      const a = edge - x;
      const d = Math.abs(z - DRIVE_Z);
      if (a >= 0 && d <= hd) return true;
      const b = d - hd;
      return a >= 0 && a <= R && b >= 0 && b <= R && Math.hypot(R - a, R - b) >= R;
    };
    const tarmac = [];
    for (let x = edge - 30; x <= lane + 5; x += 0.25) for (let z = DRIVE_Z - 45; z <= DRIVE_Z + 55; z += 0.25) if (paved(x, z)) tarmac.push([x, z]);
    const off = (x, z) => (paved(x, z) ? 0 : Math.min(...tarmac.map(([px, pz]) => Math.hypot(px - x, pz - z))));
    let worst = 0;
    J.turnIn.forEach((p, i) => {
      if (i % 4) return;
      const f = [Math.cos(p.heading), Math.sin(p.heading)];
      const s = [-f[1], f[0]];
      for (const along of [0, LORRY.wheelbase]) for (const side of [1, -1]) worst = Math.max(worst, off(p.x + f[0] * along + s[0] * side * 1.1, p.z + f[1] * along + s[1] * side * 1.1));
      const t = [Math.cos(p.trailer), Math.sin(p.trailer)];
      const ts = [-t[1], t[0]];
      for (const side of [1, -1]) worst = Math.max(worst, off(p.x - t[0] * LORRY.trailer.axle + ts[0] * side * 1.1, p.z - t[1] * LORRY.trailer.axle + ts[1] * side * 1.1));
    });
    expect(worst).toBeLessThan(1.5);
  });
});

describe('the yard\'s turning circle', () => {
  const circle = LORRY_PLAN.circle;
  it('is 25 m across, with its middle one circle\'s width off the drive\'s line, so the lorry turns on it without leaving the drive\'s edge', () => {
    expect(circle.diameter).toBe(25);
    expect(circle.at[1] - DRIVE_Z).toBeCloseTo(lockedRadius(25), 1);
    expect(plan(two.anchors.yard)[0]).toBeGreaterThan(circle.at[0] + 12.5); // west of the yard's middle, away from the barn's doors
  });

  it('has nothing standing in it', () => {
    for (const f of standing) expect(circleHitsRect(circle, f.rect), f.name).toBe(false);
    for (const s of two.restSpots) expect(Math.hypot(plan(s)[0] - circle.at[0], plan(s)[1] - circle.at[1]), s.id).toBeGreaterThan(12.5);
  });

  it('is kept clear in the plan as a square round it', () => {
    const k = two.farmstead.keptClear.find((c) => c.name === 'lorry turning circle');
    const [x0, z0, x1, z1] = planRect(k);
    expect([x0, z0, x1, z1].map(Math.round)).toEqual([circle.at[0] - 12.5, circle.at[1] - 12.5, circle.at[0] + 12.5, circle.at[1] + 12.5].map(Math.round));
  });

  it('holds the turn: the lorry going round it reaches no further than a trailer\'s tail swings out as it comes into the turn', () => {
    let reach = 0;
    const [cx, cz] = circle.at;
    for (const p of J.uTurn) for (const poly of bodies(p)) for (const [x, z] of poly) reach = Math.max(reach, Math.hypot(x - cx, z - cz));
    expect(reach).toBeLessThan(17);
    // the tractor's own track, once the trailer has settled, is inside the circle
    let tractor = 0;
    for (const p of J.uTurn.slice(J.uTurn.length / 2)) for (const [x, z] of bodies(p)[0]) tractor = Math.max(tractor, Math.hypot(x - cx, z - cz));
    expect(tractor).toBeLessThan(12.6);
  });
});

describe('a 16.5 m lorry up the drive, round the yard and back to the sheep pens and the grain store', () => {
  it('meets nothing: no building, kept-clear place, garden, car or trailer, with 0.3 m to spare', () => {
    for (const [name, poses] of legs) expect(hits(name, poses), name).toEqual([]);
  });

  it('is one journey: each leg ends where the next begins, heading the same way', () => {
    const E = J.ends;
    const start = (leg) => J[leg][0];
    const end = (leg) => J[leg].at(-1);
    const sameWay = (a, b) => Math.abs(Math.sin(a.heading - b.heading)) < 0.01;
    expect(near(end('turnIn'), start('along'))).toBe(true);
    expect(near(end('along'), start('uTurn'))).toBe(true);
    expect(near(end('uTurn'), start('settle'))).toBe(true);
    expect(sameWay(end('uTurn'), start('settle'))).toBe(true);
    expect(near(end('settle'), end('sheepBay'))).toBe(true); // the drive out of the ramp meets where the turn leaves it
    expect(sameWay(end('settle'), end('sheepBay'))).toBe(true);
    expect(Math.abs(end('sheepBay').trailer - end('settle').trailer)).toBeLessThan(0.1); // and the trailer is lined up in both
    expect(near(end('grainBay'), start('grainOn'))).toBe(true);
    expect(near(end('grainOn'), start('uTurn'))).toBe(true); // out of the grain bay the lorry is on the drive's line heading west, where the turn begins
    expect(sameWay(end('grainOn'), start('uTurn'))).toBe(true);
    expect(near(end('settle'), start('leave'))).toBe(true);
    expect(E.uEnd.z).toBeCloseTo(DRIVE_Z + 2 * lockedRadius(25), 6);
  });

  it('comes in along the drive within its edges and leaves along it the same', () => {
    for (const leg of ['along', 'grainOn']) for (const p of J[leg]) for (const poly of bodies(p)) for (const [, z] of poly) expect(Math.abs(z - DRIVE_Z), leg).toBeLessThan(DRIVE_PLAN.halfWidth);
    for (const p of J.leave.slice(-100)) for (const poly of bodies(p)) for (const [, z] of poly) expect(Math.abs(z - DRIVE_Z)).toBeLessThan(DRIVE_PLAN.halfWidth + 0.5);
  });

  it('backs to the ramp with the tail on its north face and the grain store\'s door on its west, the lorry facing away', () => {
    const sheep = J.sheepBay[0]; // where it stands backed in: the pin 12 m up the line from the tail
    const [tailX, tailZ] = LORRY_PLAN.sheep.tail;
    const tail = [sheep.x + Math.cos(sheep.trailer) * -LORRY.trailer.behind * 0 - 0, sheep.z + LORRY.trailer.behind];
    expect(tail[0]).toBeCloseTo(tailX, 6);
    expect(tail[1]).toBeCloseTo(tailZ, 6);
    const pens = two.farmstead.keptClear.find((k) => k.name === 'sheep pens');
    expect(tailZ).toBeCloseTo(planRect(pens)[1], 6); // the pens' north face
    expect(tailX).toBeGreaterThan(planRect(pens)[0]);
    expect(tailX).toBeLessThan(planRect(pens)[2]);
    const grain = two.farmstead.keptClear.find((k) => k.name === 'grain store');
    expect(LORRY_PLAN.grain.tail[0]).toBeCloseTo(planRect(grain)[0], 6); // the store's west face
    expect(LORRY_PLAN.grain.tail[1]).toBeGreaterThan(planRect(grain)[1]);
    expect(LORRY_PLAN.grain.tail[1]).toBeLessThan(planRect(grain)[3]);
  });

  it('needed the tipping trailer moved: where it stood, the grain store\'s bay swept over it', () => {
    const old = { name: 'the tipping trailer where it was', rect: [562 - 3.2, 366 - 3.2, 562 + 3.2, 366 + 3.2] };
    expect(sweepHits(J.grainBay, [old], MARGIN)).toEqual([old.name]);
    expect(plan(two.tipTrailer)).toEqual(FARMSTEAD_PLAN.trailers.tipTrailer.at);
  });

  it('fails on a building put in its way: a throwaway shed on each leg is found', () => {
    for (const [name, poses] of legs) {
      const mid = poses[Math.floor(poses.length / 2)];
      const shed = { name: `a shed on ${name}`, rect: [mid.x - 1, mid.z - 1, mid.x + 1, mid.z + 1] };
      expect(sweepHits(poses, [shed]), name).toEqual([shed.name]);
    }
  });

  it('keeps the scrap corner and the last 11 kV pole clear, and the places the other items build on', () => {
    const names = ['scrap corner', '11 kV pole', 'machinery shed', 'grain store', 'cattle shed and clamp', 'sheep pens'];
    const kept = standing.filter((f) => names.includes(f.name));
    expect(kept.map((f) => f.name).sort()).toEqual([...names].sort());
    for (const [name, poses] of legs) expect(hits(name, poses, kept), name).toEqual([]);
    const scrap = kept.find((f) => f.name === 'scrap corner').rect;
    expect(scrap[3] - scrap[1]).toBeGreaterThanOrEqual(40);
    const pole = kept.find((f) => f.name === '11 kV pole').rect;
    expect([(pole[0] + pole[2]) / 2, (pole[1] + pole[3]) / 2]).toEqual([566, 274]);
  });
});
