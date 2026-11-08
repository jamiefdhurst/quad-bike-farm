import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createFields, createFieldShape, outsideRect } from '../src/world/fields.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';

const f = createFields(LAYOUT);
const road = LAYOUT.road;

describe('the farm fields', () => {
  it('names the field a point is in', () => {
    expect(f.areaOf(0, 0)).toBe('grass');
    expect(f.areaOf(LAYOUT.barn.x, LAYOUT.barn.z)).toBe('grass');
    expect(f.areaOf(130, road.z)).toBe('road');
    expect(f.areaOf(130, -40)).toBe('north');
    expect(f.areaOf(130, 40)).toBe('south');
    expect(f.areaOf(road.pad.x, road.z)).toBe('end');
    expect(f.areaOf(-30, 100)).toBe('lane');
    expect(f.areaOf(0, 170)).toBe('hill');
    expect(f.areaOf(0, 100)).toBe('sheep');
    expect(f.areaOf(-60, 100)).toBe('meadow');
    expect(f.areaOf(50, 100)).toBe('out');
    expect(f.areaOf(220, 0)).toBe('out');
  });

  it('makes the farm much bigger than the grass field it grew from', () => {
    const area = (r) => (r.maxX - r.minX) * (r.maxZ - r.minZ);
    expect(area(f.farm) / area(f.grass)).toBeGreaterThan(1.6);
    // The detailed terrain covers it, with room to spare.
    const half = LAYOUT.terrainSize / 2;
    expect(Math.max(-f.farm.minX, f.farm.maxX, -f.farm.minZ, f.farm.maxZ)).toBeLessThan(half - 5);
  });

  it('keeps the road clear of the track and runs it out of the grass field through the east gateway', () => {
    const track = new Track(LAYOUT.trackPoints);
    for (let x = road.fromX; x <= road.toX; x += 1) {
      expect(track.distanceTo(x, road.z, 30)).toBeGreaterThan(LAYOUT.trackHalfWidth + road.halfWidth + 6);
    }
    const east = f.hedges.find((h) => !h.alongX && h.x1 === LAYOUT.fieldHalf);
    expect(f.inGap(east, road.z - east.z1)).toBe(true);
    expect(f.inGap(east, road.z + road.halfWidth - east.z1)).toBe(true);
  });

  it('says where the tarmac and the stubble are', () => {
    expect(f.tarmacAt(130, road.z)).toBe(1);
    expect(f.tarmacAt(road.pad.x, road.z + road.pad.radius - 1)).toBe(1);
    expect(f.tarmacAt(130, road.z + road.halfWidth + 1)).toBe(0);
    expect(f.tarmacAt(0, 0)).toBe(0);
    expect(f.stubbleAt(130, -40)).toBe(1);
    expect(f.stubbleAt(130, 40)).toBe(1);
    expect(f.stubbleAt(130, road.z)).toBe(0); // the road
    expect(f.stubbleAt(130, road.z + road.halfWidth + 1)).toBe(0); // the verge
    expect(f.stubbleAt(0, 0)).toBe(0); // the grass field
    expect(f.stubbleAt(road.pad.x, road.z - road.pad.radius + 1)).toBe(0); // the hardstanding reaches into the field
  });

  it('counts the public lane and the village streets as tarmac too', () => {
    const lane = LAYOUT.publicLane;
    const v = LAYOUT.village;
    expect(f.tarmacAt(lane.x, 100)).toBe(1);
    expect(f.tarmacAt(lane.x, 0)).toBe(1);
    expect(f.tarmacAt(lane.x - lane.halfWidth - 1, 100)).toBe(0); // the verge
    expect(f.tarmacAt(lane.x + lane.halfWidth + 1, 100)).toBe(0);
    expect(f.tarmacAt(166, 183.5)).toBe(1); // the village road
    expect(f.tarmacAt(166, 183.5 + LAYOUT.roads.find((r) => r.id === "street").halfWidth + v.road.pavement - 0.5)).toBe(1); // its pavement
    expect(f.tarmacAt(166, 183.5 + 6)).toBe(0); // behind the pavement
    const cp = v.pub.carPark;
    expect(f.tarmacAt((cp.minX + cp.maxX) / 2, (cp.minZ + cp.maxZ) / 2)).toBe(1);
    expect(f.tarmacAt(v.garage.x, v.garage.z - v.garage.halfZ - 4)).toBe(1); // the forecourt
    expect(f.tarmacAt(120, 170)).toBeLessThan(0.5); // the grass north of the car park
    expect(f.stubbleAt(lane.x, 0)).toBe(0);
  });

  it('measures the way to the hedge ahead, through the gaps', () => {
    expect(f.hedgeAhead(0, 0, 0)).toBeCloseTo(LAYOUT.fieldHalf); // south, to the grass field's hedge
    expect(f.hedgeAhead(0, 30, Math.PI / 2)).toBeCloseTo(LAYOUT.fieldHalf); // east
    // East along the road: out of the gateway, past the road's hedges, to the big gate at its end, which is shut.
    expect(f.hedgeAhead(0, road.z, Math.PI / 2)).toBeCloseTo(LAYOUT.farm.maxX);
    const far = f.hedges.find((h) => !h.alongX && h.x1 === LAYOUT.farm.maxX);
    expect(f.inGap(far, road.z - far.z1)).toBe(true);
    expect(f.tarmacAt(LAYOUT.farm.maxX - 1, road.z)).toBe(1); // the tarmac runs up to it
    // Straight at the south gate: it's tied open, so down the lane and up the hill pasture to its far hedge.
    expect(f.hedgeAhead(LAYOUT.gate.x, 0, 0)).toBeCloseTo(LAYOUT.hill.pasture.maxZ);
    // Beside the gate, the hedge.
    expect(f.hedgeAhead(LAYOUT.gate.x + 6, 0, 0)).toBeCloseTo(LAYOUT.fieldHalf);
    expect(f.hedgeDistance(0, 79)).toBeCloseTo(1);
  });

  it('finds the way round from one field to another through the gateways', () => {
    const barn = { x: -56, z: 60 };
    const north = { x: 130, z: -40 };
    const path = f.route(north, barn);
    expect(path[path.length - 1]).toBe(barn);
    // Out of the north field onto the road, along it and into the grass field.
    const areas = path.map((p) => f.areaOf(p.x, p.z));
    expect(areas[0]).toBe('north');
    expect(areas).toContain('road');
    expect(areas).toContain('grass');
    // No leg crosses a hedge: each straight leg's own hedge distance never hits a hedge away from a gap.
    let at = north;
    for (const p of path) {
      const yaw = Math.atan2(p.x - at.x, p.z - at.z);
      expect(f.hedgeAhead(at.x, at.z, yaw)).toBeGreaterThan(Math.hypot(p.x - at.x, p.z - at.z) - 0.01);
      at = p;
    }
    // North field to south field: across the road through a gap on each side, or round the hardstanding.
    const across = f.route({ x: 150, z: -30 }, { x: 150, z: 30 });
    expect(across.length).toBeGreaterThan(2);
    // The same field: straight there.
    expect(f.route({ x: 0, z: 0 }, { x: 10, z: 10 })).toEqual([{ x: 10, z: 10 }]);
  });

  it('skips a gateway point already reached', () => {
    const to = { x: 0, z: 0 };
    const gw = f.gateways.find((g) => g.a === 'grass' && g.b === 'road');
    expect(f.nextWaypoint({ x: 120, z: road.z }, to)).toEqual(gw.pb);
    expect(f.nextWaypoint({ x: gw.pb.x + 0.5, z: gw.pb.z }, to)).toEqual(gw.pa);
  });

  it('does not turn her back to a gateway point she has walked on past (the cattle grid dither)', () => {
    const to = { x: 188, z: road.z };
    const gw = f.gateways.find((g) => g.a === 'grass' && g.b === 'road');
    // Walking on through the gap from the point before it: at every step she is heading for the point after it, never back.
    for (let x = gw.pa.x; x < gw.pb.x - 1; x += 0.25) expect(f.nextWaypoint({ x, z: gw.pa.z + 0.8 }, to).x, `at x ${x}`).toBeGreaterThanOrEqual(x > gw.pa.x + 1.5 ? gw.pb.x : gw.pa.x);
    // Alongside the hedge but nowhere near the gap she still goes to the gap's point first.
    expect(f.nextWaypoint({ x: gw.pa.x + 1, z: gw.pa.z + 12 }, to)).toEqual(gw.pa);
  });

  it('pulls a point into a field', () => {
    expect(f.clampToArea('north', 130, 10, 6)).toEqual({ x: 130, z: f.areas.north.maxZ - 6 });
    expect(f.inFarm(150, 0, 6)).toBe(true);
    expect(f.inFarm(198, 0, 6)).toBe(false);
    expect(outsideRect(f.farm, 210, 0)).toBeCloseTo(10);
    expect(outsideRect(f.farm, 0, 0)).toBe(0);
  });

  it('gives the two stubble fields their own lie: a wet hollow in the north, a rise to the south', () => {
    const shape = createFieldShape(LAYOUT);
    const h = LAYOUT.stubbleFields.north.hollow;
    expect(shape(h.x, h.z).lift).toBeCloseTo(-h.depth);
    expect(shape(h.x, h.z).soak).toBe(1);
    expect(shape(h.x + h.rx + 1, h.z)).toEqual({ lift: 0, soak: 0 });
    expect(shape(150, LAYOUT.farm.maxZ - 1).lift).toBeGreaterThan(LAYOUT.stubbleFields.south.rise * 0.95);
    expect(shape(150, road.z).lift).toBe(0); // not the road
    expect(shape(0, 60).lift).toBe(0); // nor the grass field
    expect(f.soakAt(h.x, h.z)).toBe(1);
    expect(f.stubbleField('north').crop).toBe('barley');
    expect(f.stubbleField('south').rows).not.toBe(f.stubbleField('north').rows);
  });

  it('leaves no step in the ground at the hedges round the fields, or on the road', () => {
    const heights = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
    // Across the grass field's east hedge and the south field's far hedge, a metre each side.
    for (let z = 10; z < 80; z += 5) expect(Math.abs(heights.heightAt(81, z) - heights.heightAt(79, z))).toBeLessThan(0.3);
    for (let x = 82; x < 200; x += 6) expect(Math.abs(heights.heightAt(x, 81) - heights.heightAt(x, 79))).toBeLessThan(0.3);
    // Steady along the road, and flat across it.
    for (let x = road.fromX; x < road.toX; x += 2) {
      expect(Math.abs(heights.heightAt(x + 2, road.z) - heights.heightAt(x, road.z))).toBeLessThan(0.15);
      expect(Math.abs(heights.heightAt(x, road.z + road.halfWidth) - heights.heightAt(x, road.z - road.halfWidth))).toBeLessThan(0.02);
    }
  });
});

describe('the ground that wears', () => {
  it('covers the farm and the hill, and the lane is the strip down the middle of its hedges', () => {
    const b = f.wearBounds;
    for (const [x, z] of [[0, 0], [190, 70], [-30, 100], [-90, 190], [30, 200]]) {
      expect(x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ).toBe(true);
    }
    const lane = LAYOUT.hill.lane;
    expect(f.laneAt(lane.x, 100)).toBe(1);
    expect(f.laneAt(lane.x + lane.halfWidth + 3, 100)).toBe(0);
    expect(f.laneAt(lane.x, 30)).toBe(0); // inside the grass field
    expect(f.laneAt(lane.x, lane.toZ + 5)).toBe(0); // the pasture beyond
  });
});
