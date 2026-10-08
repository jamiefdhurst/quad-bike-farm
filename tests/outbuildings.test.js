import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createOutbuildings, muckHeapHeight, BALE } from '../src/world/outbuildings.js';
import { createFields } from '../src/world/fields.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { randomiseQuadSpawns } from '../src/world/spawns.js';
import { createRandom } from '../src/core/random.js';

const ob = createOutbuildings(LAYOUT);
const fields = createFields(LAYOUT);
const { barn, shed } = ob;

describe('the buildings in the east fields', () => {
  it('puts the Dutch barn and the shed in the barley field, the heap in the wheat and the trough by a gateway, clear of hedges and tarmac', () => {
    expect(fields.areaOf(LAYOUT.dutchBarn.x, LAYOUT.dutchBarn.z)).toBe('north');
    expect(fields.areaOf(LAYOUT.fieldShed.x, LAYOUT.fieldShed.z)).toBe('north');
    expect(fields.areaOf(LAYOUT.muckHeap.x, LAYOUT.muckHeap.z)).toBe('south');
    expect(fields.areaOf(LAYOUT.trough.x, LAYOUT.trough.z)).toBe('north');
    const gap = LAYOUT.road.gaps.north.find((x) => Math.abs(x - LAYOUT.trough.x) < 10);
    expect(gap).toBeDefined();
    for (const r of ob.footprints) {
      for (const [x, z] of [[r.minX, r.minZ], [r.maxX, r.minZ], [r.minX, r.maxZ], [r.maxX, r.maxZ], [(r.minX + r.maxX) / 2, r.minZ], [(r.minX + r.maxX) / 2, r.maxZ]]) {
        expect(fields.hedgeDistance(x, z)).toBeGreaterThan(1.2);
        expect(fields.tarmacAt(x, z)).toBe(0);
      }
    }
  });

  it('keeps the rain off under the two roofs and nowhere else out there', () => {
    expect(ob.covered(LAYOUT.dutchBarn.x, LAYOUT.dutchBarn.z)).toBe(true);
    expect(ob.covered(barn.outer.minX, barn.outer.maxZ)).toBe(true); // under the overhang at the open corner
    expect(ob.covered(LAYOUT.fieldShed.x, LAYOUT.fieldShed.z)).toBe(true);
    expect(ob.covered(LAYOUT.dutchBarn.x, barn.outer.maxZ + 2)).toBe(false);
    expect(ob.covered(LAYOUT.muckHeap.x, LAYOUT.muckHeap.z)).toBe(false);
    expect(ob.covered(LAYOUT.road.pad.x, LAYOUT.road.z)).toBe(false);
  });

  it('stacks the bales inside the Dutch barn, below the eaves, clear of the open bay and each other', () => {
    expect(barn.bales.length).toBeGreaterThanOrEqual(20);
    const R = BALE.radius;
    for (const b of barn.bales) {
      expect(b.x - R).toBeGreaterThan(barn.outer.minX + barn.bay * LAYOUT.dutchBarn.openBays);
      expect(b.x + R).toBeLessThan(barn.outer.maxX);
      expect(b.z - BALE.length / 2).toBeGreaterThan(barn.outer.minZ);
      expect(b.y + R).toBeLessThan(LAYOUT.dutchBarn.eaves - 0.5);
    }
    for (const a of barn.bales) {
      for (const b of barn.bales) {
        if (a === b || a.z !== b.z) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(2 * R - 1e-6);
      }
    }
  });

  it('gives the girls two seats under the Dutch barn and two dry places to stand in the shed, each with a way in', () => {
    const shelters = LAYOUT.restSpots.filter((s) => s.kind === 'shelter');
    const underBarn = shelters.filter((s) => s.x > barn.outer.minX && s.x < barn.outer.maxX && s.z > barn.outer.minZ && s.z < barn.outer.maxZ);
    expect(underBarn).toHaveLength(2);
    expect(barn.seats).toHaveLength(2);
    for (const s of underBarn) {
      expect(s.seat).toBeDefined();
      // She climbs up from behind, which must be under the roof and clear of the stack.
      const standZ = s.z - Math.cos(s.yaw) * 1.65;
      expect(ob.covered(s.x, standZ)).toBe(true);
      expect(standZ).toBeGreaterThan(barn.stack.maxZ + 0.5);
    }
    const inShed = shelters.filter((s) => s.x > shed.inner.minX && s.x < shed.inner.maxX && s.z > shed.inner.minZ && s.z < shed.inner.maxZ);
    expect(inShed).toHaveLength(2);
    for (const s of inShed) {
      expect(s.seat).toBeUndefined();
      expect(s.door.z).toBeGreaterThan(shed.outer.maxZ + 1); // outside the doorway
      expect(s.door.x).toBeGreaterThan(shed.door.minX);
      expect(s.door.x).toBeLessThan(shed.door.maxX);
    }
    // In between the two seat bales, in front of the stack, so she walks in from the front.
    for (const s of underBarn) {
      expect(ob.covered(s.door.x, s.door.z)).toBe(true);
      for (const o of underBarn) expect(Math.abs(s.door.x - o.x)).toBeGreaterThan(BALE.length / 2 + 0.5);
    }
  });

  it('grows no stubble on them, and levels the ground under the two buildings', () => {
    expect(fields.stubbleAt(LAYOUT.dutchBarn.x, LAYOUT.dutchBarn.z)).toBe(0);
    expect(fields.stubbleAt(LAYOUT.fieldShed.x, LAYOUT.fieldShed.z)).toBe(0);
    expect(fields.stubbleAt(LAYOUT.muckHeap.x, LAYOUT.muckHeap.z)).toBe(0);
    expect(fields.stubbleAt(LAYOUT.dutchBarn.x, barn.outer.maxZ + 1)).toBe(0); // the hardstanding
    expect(fields.stubbleAt(LAYOUT.dutchBarn.x - 20, LAYOUT.dutchBarn.z)).toBe(1);
    const h = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints)).heightAt;
    for (const r of [barn.outer, shed.outer]) {
      const ys = [];
      for (let x = r.minX; x <= r.maxX; x += 0.5) for (let z = r.minZ; z <= r.maxZ; z += 0.5) ys.push(h(x, z));
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.02);
    }
  });

  it('heaps the muck up to its height in the middle and down to nothing at its edge', () => {
    const m = LAYOUT.muckHeap;
    expect(muckHeapHeight(LAYOUT, m.x, m.z)).toBeGreaterThan(m.height * 0.85);
    expect(muckHeapHeight(LAYOUT, m.x + m.halfX + 0.01, m.z)).toBe(0);
    expect(muckHeapHeight(LAYOUT, m.x, m.z - m.halfZ - 0.01)).toBe(0);
    expect(muckHeapHeight(LAYOUT, m.x + m.halfX * 0.9, m.z)).toBeLessThan(m.height * 0.4);
  });
});

describe('where things start out east', () => {
  const east = LAYOUT.spawn.away.filter((a) => a.x > LAYOUT.fieldHalf);

  it('has five spots a quad can have been left, each clear of the buildings and hedges by its jitter', () => {
    expect(east).toHaveLength(5);
    for (const a of east) {
      const j = a.jitter ?? LAYOUT.spawn.awayJitter;
      for (const [dx, dz] of [[-j, -j], [j, -j], [-j, j], [j, j], [0, 0]]) {
        const x = a.x + dx;
        const z = a.z + dz;
        expect(fields.inFarm(x, z, 2)).toBe(true);
        expect(fields.hedgeDistance(x, z)).toBeGreaterThan(1.8);
        if (!ob.covered(a.x, a.z)) expect(ob.clearance(x, z)).toBeGreaterThan(1.5);
      }
    }
  });

  it('parks the one in the Dutch barn in its open bay, clear of the stanchions, the seats and the stack', () => {
    const a = east.find((s) => s.where === 'in the Dutch barn');
    const j = a.jitter + 1.1; // and the quad's half length, any way round
    expect(a.x - j).toBeGreaterThan(barn.open.minX + 0.2);
    expect(a.x + j).toBeLessThan(barn.open.maxX - 0.2);
    expect(a.z - j).toBeGreaterThan(barn.outer.minZ + 0.2);
    expect(a.z + j).toBeLessThan(barn.outer.maxZ - 0.2);
    for (const s of barn.seats) expect(s.x - BALE.length / 2).toBeGreaterThan(a.x + j);
  });

  it('uses a spot`s own jitter', () => {
    const spawn = { ...LAYOUT.spawn, awayChance: 1, away: [{ x: 0, z: 0, jitter: 0.1, where: 'here' }] };
    for (let seed = 1; seed < 20; seed++) {
      const { placed, home } = randomiseQuadSpawns(spawn, 2, createRandom(seed));
      const q = placed[1 - home];
      expect(Math.abs(q.x)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(q.z)).toBeLessThanOrEqual(0.1);
    }
  });

  it('can start a jerry can by the Dutch barn or the shed, clear of them', () => {
    for (const where of ['by the Dutch barn', 'by the field shed']) {
      const s = LAYOUT.jerryCanSpots.find((c) => c.where === where);
      expect(s).toBeDefined();
      expect(ob.clearance(s.x, s.z)).toBeGreaterThan(LAYOUT.jerryCanJitter + 0.3);
      expect(ob.clearance(s.x, s.z)).toBeLessThan(3);
      expect(fields.hedgeDistance(s.x, s.z)).toBeGreaterThan(LAYOUT.jerryCanJitter + 1.2);
    }
  });
});
