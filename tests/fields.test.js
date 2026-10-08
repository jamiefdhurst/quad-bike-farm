import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createFields, outsideRect } from '../src/world/fields.js';
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
    expect(f.areaOf(-30, 100)).toBe('out');
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
    expect(f.inGap(east, road.z)).toBe(true);
    expect(f.inGap(east, road.z + road.halfWidth)).toBe(true);
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

  it('measures the way to the hedge ahead, through the gaps', () => {
    expect(f.hedgeAhead(0, 0, 0)).toBeCloseTo(LAYOUT.fieldHalf); // south, to the grass field's hedge
    expect(f.hedgeAhead(0, 30, Math.PI / 2)).toBeCloseTo(LAYOUT.fieldHalf); // east
    // East along the road: out of the gateway, past the road's hedges, to the far hedge.
    expect(f.hedgeAhead(0, road.z, Math.PI / 2)).toBeCloseTo(LAYOUT.farm.maxX);
    // Straight at the south gate: on through it.
    expect(f.hedgeAhead(LAYOUT.gate.x, 0, 0)).toBe(Infinity);
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

  it('pulls a point into a field', () => {
    expect(f.clampToArea('north', 130, 10, 6)).toEqual({ x: 130, z: f.areas.north.maxZ - 6 });
    expect(f.inFarm(150, 0, 6)).toBe(true);
    expect(f.inFarm(198, 0, 6)).toBe(false);
    expect(outsideRect(f.farm, 210, 0)).toBeCloseTo(10);
    expect(outsideRect(f.farm, 0, 0)).toBe(0);
  });
});
