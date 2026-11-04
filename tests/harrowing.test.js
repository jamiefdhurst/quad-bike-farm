import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createFields } from '../src/world/fields.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { createRandom } from '../src/core/random.js';
import { Harrowing, DEFAULT_HARROW_PARAMS, HARROW_PARAM_RANGES, UNTOUCHED, COMBED_ALONG_Z, COMBED_ALONG_X, harrowRuns, harrowWanted, dealMolehills } from '../src/world/harrowing.js';
import { FARM_JOBS, availableJobs } from '../src/world/farmJobs.js';

const RECT = { minX: 0, maxX: 24, minZ: 0, maxZ: 20 };
const mk = (over = {}) => new Harrowing({ rect: RECT, params: { ...DEFAULT_HARROW_PARAMS, ...over } });
// The carrier driving along +z (yaw 0; the mat drags behind its axle) at x, from z0 to z1 at `speed`, in 0.1 s steps.
const drive = (h, x, z0, z1, { speed = 3, day = 1, hitched = true, yaw = 0 } = {}) => {
  const events = [];
  const dir = Math.sign(z1 - z0) || 1;
  const step = speed * 0.1;
  for (let z = z0; dir > 0 ? z <= z1 : z >= z1; z += dir * step) events.push(...h.update(0.1, { x, z, yaw: dir > 0 ? yaw : yaw + Math.PI, speed, hitched, day }));
  return events;
};
const down = (h) => {
  h.setDown(true);
  return h;
};

describe('the grid', () => {
  it('is a grid of untouched cells with the tines up', () => {
    const h = mk();
    expect(h.cells).toBe(24 * 20);
    expect(h.combed).toBe(0);
    expect(h.down).toBe(0);
    expect(h.index(0.5, 0.5)).toBe(0);
    expect(h.index(-1, 5)).toBe(-1);
  });
});

describe('the tines', () => {
  it('take lowerSeconds to come down and go up', () => {
    const h = mk();
    h.toggleTines();
    for (let i = 0; i < 10; i++) h.update(0.1, { x: 0, z: 0, yaw: 0, speed: 0, hitched: true });
    expect(h.down).toBeCloseTo(1 / h.p.lowerSeconds, 5);
    for (let i = 0; i < 40; i++) h.update(0.1, { x: 0, z: 0, yaw: 0, speed: 0, hitched: true });
    expect(h.isDown).toBe(true);
    h.toggleTines();
    for (let i = 0; i < 40; i++) h.update(0.1, { x: 0, z: 0, yaw: 0, speed: 0, hitched: true });
    expect(h.down).toBe(0);
  });

  it('comb nothing while up', () => {
    const h = mk();
    drive(h, 12, 4, 18);
    expect(h.coverage).toBe(0);
  });
});

describe('harrowing', () => {
  it('combs a strip as wide as the mat, centred on it and behind the axle', () => {
    const h = down(mk());
    drive(h, 12, 8, 18);
    expect(h.index(12, 6.5)).toBeGreaterThanOrEqual(0);
    expect(h.state[h.index(12, 8)]).toBe(COMBED_ALONG_Z); // the mat lags 2.2 m behind the axle, so z 8 is reached from z 10.2
    expect(h.state[h.index(12 + 1.5, 12)]).toBe(COMBED_ALONG_Z);
    expect(h.state[h.index(12 + 2.5, 12)]).toBe(UNTOUCHED);
    expect(h.state[h.index(12, 17)]).toBe(UNTOUCHED); // the mat has not got that far yet
    expect(h.harrowing).toBe(true);
  });

  it('does nothing when unhitched, too slow or too fast', () => {
    for (const o of [{ hitched: false }, { speed: 0.3 }, { speed: 9 }]) {
      const h = down(mk());
      drive(h, 12, 4, 18, o);
      expect(h.coverage, JSON.stringify(o)).toBe(0);
    }
  });

  it('ignores a jump of more than 5 m between frames', () => {
    const h = down(mk());
    h.update(0.1, { x: 5, z: 5, yaw: 0, speed: 3, hitched: true });
    h.update(0.1, { x: 5, z: 18, yaw: 0, speed: 3, hitched: true });
    expect(h.coverage).toBe(0);
  });

  it('works backwards as well as forwards', () => {
    const h = down(mk());
    drive(h, 12, 18, 4);
    expect(h.state[h.index(12, 10)]).toBe(COMBED_ALONG_Z);
  });

  it('marks a pass across the field differently, and going back over it the other way changes it', () => {
    const h = down(mk());
    const first = drive(h, 12, 8, 20);
    expect(first.some((e) => e.type === 'combed')).toBe(true);
    const i = h.index(12, 13.5);
    const combed = h.combed;
    expect(h.state[i]).toBe(COMBED_ALONG_Z);
    for (let x = 4; x <= 20; x += 0.3) h.update(0.1, { x, z: 14, yaw: Math.PI / 2, speed: 3, hitched: true });
    expect(h.state[i]).toBe(COMBED_ALONG_X);
    expect(h.combed).toBeGreaterThan(combed); // new cells count once, the ones changed over do not count again
  });

  it('is done once enough of the field is combed, with a done event, once', () => {
    const h = down(mk());
    let events = [];
    for (let x = 1.7; x < 24; x += 3.0) events.push(...drive(h, x, 0, 20 + 3));
    expect(h.coverage).toBeGreaterThanOrEqual(h.p.coverNeeded);
    expect(events.filter((e) => e.type === 'done')).toHaveLength(1);
    expect(h.done).toBe(true);
    expect(h.phase).toBe('done');
  });

  it('forgives a few missed edges but not a stripe down the middle', () => {
    const h = down(mk());
    for (let x = 1.7; x < 24; x += 6.5) drive(h, x, 0, 23);
    expect(h.done).toBe(false);
  });

  it('needs harrowing again after lastsDays', () => {
    const h = mk();
    expect(h.needsHarrowing(3)).toBe(true);
    h.combAll(3);
    expect(h.needsHarrowing(3 + h.p.lastsDays - 1)).toBe(false);
    expect(h.needsHarrowing(3 + h.p.lastsDays)).toBe(true);
  });
});

describe('keeping it', () => {
  it('keeps the combing and the days through a save', () => {
    const h = down(mk());
    drive(h, 12, 0, 20);
    const save = JSON.parse(JSON.stringify(h.toJSON()));
    const next = mk();
    next.restore(save, 2);
    expect(next.combed).toBe(h.combed);
    expect([...next.state]).toEqual([...h.state]);
    expect(next.down).toBe(0);
  });

  it('lets the combing grow out after lastsDays, from the day it was done', () => {
    const h = mk();
    h.combAll(2);
    const save = JSON.parse(JSON.stringify(h.toJSON()));
    const soon = mk();
    soon.restore(save, 2 + soon.p.lastsDays - 1);
    expect(soon.done).toBe(true);
    const later = mk();
    later.restore(save, 2 + later.p.lastsDays);
    expect(later.combed).toBe(0);
    expect(later.done).toBe(false);
  });

  it('reads a save without it, or a broken one, as an untouched field', () => {
    for (const save of [undefined, null, {}, { since: 1, cells: 5 }, { since: 1.5, cells: '11' }]) {
      const h = mk();
      h.restore(save, 3);
      expect(h.combed).toBe(0);
    }
  });

  it('says whether the field wants doing from the save alone', () => {
    expect(harrowWanted(undefined, 5)).toBe(true);
    expect(harrowWanted({ doneDay: 3 }, 5)).toBe(false);
    expect(harrowWanted({ doneDay: 3 }, 3 + DEFAULT_HARROW_PARAMS.lastsDays)).toBe(true);
    expect(harrowWanted({ since: 3 }, 4)).toBe(true); // part-done does not keep it off the board
  });
});

describe('the map and the molehills', () => {
  it('runs the combed cells along each row by state', () => {
    const h = mk();
    h.state[0] = h.state[1] = COMBED_ALONG_Z;
    h.state[2] = COMBED_ALONG_X;
    expect(harrowRuns(h)).toEqual([
      { z: 0, x0: 0, x1: 2, state: COMBED_ALONG_Z },
      { z: 0, x0: 2, x1: 3, state: COMBED_ALONG_X },
    ]);
  });

  it('deals the same molehills for the same farm, inside the field and apart', () => {
    const a = dealMolehills(RECT, 16, createRandom(5));
    const b = dealMolehills(RECT, 16, createRandom(5));
    expect(a).toEqual(b);
    expect(a).toHaveLength(16);
    for (const m of a) {
      expect(m.x).toBeGreaterThan(RECT.minX + 0.5);
      expect(m.x).toBeLessThan(RECT.maxX - 0.5);
      expect(m.z).toBeGreaterThan(RECT.minZ + 0.5);
      expect(m.z).toBeLessThan(RECT.maxZ - 0.5);
    }
    expect(dealMolehills(RECT, 0, createRandom(5))).toEqual([]);
  });
});

describe('tunables', () => {
  it('have a range each that holds the default', () => {
    for (const [k, v] of Object.entries(DEFAULT_HARROW_PARAMS)) {
      const r = HARROW_PARAM_RANGES[k];
      expect(r, k).toBeTruthy();
      expect(v).toBeGreaterThanOrEqual(r[0]);
      expect(v).toBeLessThanOrEqual(r[1]);
    }
  });
});

describe('the job', () => {
  it('is on the chalkboard pool when the farm has the field', () => {
    expect(FARM_JOBS.harrow.needs).toBe('harrowField');
    expect(availableJobs(LAYOUT)).toContain('harrow');
    expect(availableJobs({ ...LAYOUT, harrowField: undefined })).not.toContain('harrow');
  });
});

describe('the field in the farm', () => {
  const fields = createFields(LAYOUT);
  const m = LAYOUT.harrowField;
  const track = new Track(LAYOUT.trackPoints);
  const heights = createTerrainHeight(LAYOUT, track);

  it('is all grass field, clear of the hedges', () => {
    for (let x = m.minX; x <= m.maxX; x += 2) for (let z = m.minZ; z <= m.maxZ; z += 2) {
      expect(fields.areaOf(x, z), `${x},${z}`).toBe('grass');
      expect(fields.hedgeDistance(x, z), `${x},${z}`).toBeGreaterThan(3);
    }
  });

  it('is level enough and clear of the track, bogs, puddles, bales, the ramp and the drag strip', () => {
    let lo = Infinity;
    let hi = -Infinity;
    const ds = LAYOUT.dragStrip;
    for (let x = m.minX - 1; x <= m.maxX + 1; x += 2) for (let z = m.minZ - 1; z <= m.maxZ + 1; z += 2) {
      const y = heights.heightAt(x, z);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
      expect(track.distanceTo(x, z), `track ${x},${z}`).toBeGreaterThan(LAYOUT.trackHalfWidth + 3);
      expect(heights.bogAt(x, z), `bog ${x},${z}`).toBe(0);
      expect(heights.puddleAt(x, z), `puddle ${x},${z}`).toBe(0);
      for (const [bx, bz] of LAYOUT.strawBaleSpots) expect(Math.hypot(bx - x, bz - z), `bale ${bx},${bz}`).toBeGreaterThan(8);
      // The jump's line (run-up behind the ramp, landing in front of it) stays clear.
      const j = LAYOUT.jumpRamp;
      const along = (x - j.x) * Math.sin(j.yaw) + (z - j.z) * Math.cos(j.yaw);
      const across = (x - j.x) * Math.cos(j.yaw) - (z - j.z) * Math.sin(j.yaw);
      if (Math.abs(along) < 45) expect(Math.abs(across), `jump ${x},${z}`).toBeGreaterThan(12);
    }
    expect(hi - lo).toBeLessThan(1.6);
    expect(m.minX).toBeGreaterThan(ds.x + ds.length / 2 + ds.runOff + 10); // the strip runs along x from its middle, with its run-off past the end
  });

  it('leaves the hay patch and the spray field alone', () => {
    const h = LAYOUT.hayMeadow;
    expect(m.maxZ).toBeLessThan(h.minZ - 8);
    expect(m.maxX).toBeLessThan(LAYOUT.sprayField.minX);
  });

  it('has the harrows left at its edge, on the grass and off the track', () => {
    const at = LAYOUT.harrows;
    expect(Math.hypot(at.x - m.minX, 0)).toBeLessThan(12);
    expect(track.distanceTo(at.x, at.z)).toBeGreaterThan(LAYOUT.trackHalfWidth + 3);
    expect(fields.areaOf(at.x, at.z)).toBe('grass');
  });
});
