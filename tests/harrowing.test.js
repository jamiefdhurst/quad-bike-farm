import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { LAYOUT } from '../src/world/layout.js';
import { createFields } from '../src/world/fields.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { inPlace } from '../src/world/jobFields.js';
import { createRandom } from '../src/core/random.js';
import { Harrowing, DEFAULT_HARROW_PARAMS, HARROW_PARAM_RANGES, UNTOUCHED, COMBED_ALONG_Z, COMBED_ALONG_X, harrowRuns, harrowWanted, dealMolehills } from '../src/world/harrowing.js';
import { FARM_JOBS, availableJobs } from '../src/world/farmJobs.js';
import { HarrowView } from '../src/world/harrowView.js';

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

  it('keeps the farm\'s big field in no more characters than it has cells of its own, and the job\'s progress through capture and restore (#1072)', () => {
    const h = new Harrowing({ rect: LAYOUT.harrowField }); // what the game's captureFarm keeps is this toJSON, and its restore this restore
    expect(h.cells).toBeGreaterThan(h.liveCount); // the field's bounds reach past its corners
    expect(h.toJSON().cells.length).toBeLessThan(10); // nothing combed: one run
    h.combHalf(3);
    const save = JSON.parse(JSON.stringify(h.toJSON()));
    expect(save.cells.length).toBeLessThan(1000); // half a day's job, where a digit a cell was 34,300
    const back = new Harrowing({ rect: LAYOUT.harrowField });
    back.restore(save, 4);
    expect(back.progress).toBeCloseTo(0.5, 2);
    expect(back.progress).toBe(h.progress);
    expect(back.combed).toBe(h.combed);
    expect([...back.state]).toEqual([...h.state]);
    expect(back.since).toBe(3);
    // The worst there could be: every cell of the field different from the one before it.
    for (let i = 0; i < h.cells; i++) h.state[i] = h.live[i] ? i % 3 : UNTOUCHED;
    const worst = h.toJSON().cells;
    expect(worst.length).toBeLessThanOrEqual(h.liveCount);
    back.restore({ ...save, cells: worst }, 4);
    expect([...back.state]).toEqual([...h.state]);
  });

  it('still reads a save from before, a digit for every cell of the grid', () => {
    const h = new Harrowing({ rect: LAYOUT.harrowField });
    h.combHalf(3);
    const back = new Harrowing({ rect: LAYOUT.harrowField });
    back.restore({ since: 3, doneDay: null, cells: [...h.state].join('') }, 4);
    expect([...back.state]).toEqual([...h.state]);
    expect(back.combed).toBe(h.combed);
    expect(back.progress).toBe(h.progress);
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

describe('the combed ground on the farm\'s big field (#1072)', () => {
  const rect = LAYOUT.harrowField;
  const midX = Math.round((rect.minX + rect.maxX) / 2);
  const midZ = Math.round((rect.minZ + rect.maxZ) / 2);
  const field = () => down(new Harrowing({ rect, params: { ...DEFAULT_HARROW_PARAMS, areaNeeded: 1e9 } }));
  const ground = (x, z) => 0.01 * x + 0.02 * z;
  const viewOf = (h, hills = []) => new HarrowView({ scene: new THREE.Scene(), harrowing: h, heightAt: ground, molehills: hills });
  /** A pull of the harrows up the field at `x`, each event's cells repainted as the game does. Returns every cell that changed. */
  const pull = (h, view, x, z0 = midZ - 30, z1 = midZ + 30, opts) => {
    const changed = new Set();
    for (const e of drive(h, x, z0, z1, opts)) {
      if (e.type !== 'combed') continue;
      view.repaint(e.cells);
      for (const cell of e.cells) changed.add(cell);
    }
    return changed;
  };
  const built = (view) => view.parts.flatMap((part, k) => (part ? [k] : []));

  it('draws nothing over a field with nothing combed', () => {
    const h = field();
    expect(h.index(midX, midZ)).toBeGreaterThanOrEqual(0); // the pulls below are in the field
    const view = viewOf(h);
    expect(built(view)).toEqual([]);
    expect(view.skin.children).toEqual([view.primer.mesh]); // the one cell the shader is built from, never shown
    expect(view.primer.mesh.visible).toBe(false);
  });

  it('builds only the chunks a pull goes through, each with a small picture of its own', () => {
    const h = field();
    const view = viewOf(h);
    const changed = pull(h, view, midX);
    expect(changed.size).toBeGreaterThan(150);
    const touched = new Set([...changed].map((cell) => view.grid.chunkOf[cell]));
    expect(built(view).sort()).toEqual([...touched].sort());
    expect(touched.size).toBeLessThanOrEqual(10); // 60 m of a 3.4 m mat, in 16 m chunks
    for (const k of built(view)) {
      const part = view.parts[k];
      expect(part.data.length).toBeLessThanOrEqual(128 * 128 * 4); // 64 KB, where the one picture of the field was 8.8 MB
      expect(part.mesh.geometry.index.count / 3).toBeLessThanOrEqual(2048);
    }
  });

  it('sends only the pictures of the chunks whose cells changed, and changes only those cells in them', () => {
    const h = field();
    const view = viewOf(h);
    pull(h, view, midX);
    const versions = view.parts.map((part) => (part ? part.texture.version : null));
    const pictures = view.parts.map((part) => (part ? part.data.slice() : null));
    const changed = pull(h, view, midX + 3, midZ - 30, midZ - 10); // beside the first: cells in chunks already there, and perhaps new ones
    expect(changed.size).toBeGreaterThan(30);
    let sent = 0;
    view.parts.forEach((part, k) => {
      const mine = new Set([...changed].filter((cell) => view.grid.chunkOf[cell] === k));
      if (!part) return expect(mine.size).toBe(0);
      if (!mine.size) {
        expect(part.texture.version, `chunk ${k} was left alone`).toBe(versions[k]);
        expect(part.data).toEqual(pictures[k]);
        return;
      }
      expect(part.texture.version).toBeGreaterThan(versions[k] ?? 0);
      sent += part.data.length;
      const was = pictures[k] ?? new Uint8Array(part.data.length);
      for (let o = 0; o < part.data.length; o += 4) {
        if (part.data[o + 3] === was[o + 3] && part.data[o] === was[o]) continue;
        const texel = o / 4;
        const cell = (part.chunk.r0 + Math.floor(Math.floor(texel / part.w) / 8)) * h.cols + part.chunk.c0 + Math.floor((texel % part.w) / 8);
        expect(mine.has(cell), `texel ${texel} of chunk ${k} is cell ${cell}`).toBe(true);
      }
    });
    expect(sent).toBeGreaterThan(0);
    expect(sent).toBeLessThan(8.8e6 / 20); // bytes over the whole pull, against 8.8 MB each time a cell changed
  });

  it('carries the stripes on across a join, and paints a pull and a loaded field the same', () => {
    const h = field();
    const view = viewOf(h);
    pull(h, view, midX);
    pull(h, view, 0, 0, 0); // nothing: outside the field
    const z = midZ; // across the field, over the first pull and a chunk's edge
    for (const e of h.update(0.1, { x: midX - 20, z, yaw: Math.PI / 2, speed: 3, hitched: true, day: 1 })) if (e.type === 'combed') view.repaint(e.cells);
    for (let x = midX - 20; x <= midX + 20; x += 0.3) for (const e of h.update(0.1, { x, z, yaw: Math.PI / 2, speed: 3, hitched: true, day: 1 })) if (e.type === 'combed') view.repaint(e.cells);
    expect(built(view).length).toBeGreaterThan(2);
    const back = new Harrowing({ rect });
    back.restore(JSON.parse(JSON.stringify(h.toJSON())), 1);
    const loaded = viewOf(back);
    expect(built(loaded)).toEqual(built(view));
    for (const k of built(view)) expect(loaded.parts[k].data, `chunk ${k}`).toEqual(view.parts[k].data);
    // A cell combed along z is light and dark by the texel's column counted across the whole field, whichever chunk it is in.
    for (const k of built(view)) {
      const part = view.parts[k];
      for (const cell of part.chunk.cells) {
        if (h.state[cell] !== COMBED_ALONG_Z) continue;
        const px = ((cell % h.cols) - part.chunk.c0) * 8;
        const py = (Math.floor(cell / h.cols) - part.chunk.r0) * 8;
        const red = (tx) => part.data[(py * part.w + px + tx) * 4];
        expect(((cell % h.cols) * 8) % 2).toBe(px % 2);
        expect([red(0), red(1)]).toEqual([196, 52]);
      }
    }
    h.clear();
    view.refresh();
    expect(built(view)).toEqual([]);
    expect(view.skin.children).toEqual([view.primer.mesh]);
  });

  it('lies on the ground and leans with it the same either side of a join', () => {
    const h = field();
    const view = viewOf(h);
    h.combAll(1);
    view.refresh();
    const texels = view.parts.reduce((n, part) => n + (part ? part.data.length / 4 : 0), 0);
    expect(texels).toBeLessThanOrEqual(h.cells * 64); // no more picture than the field's grid, however it is cut
    const part = view.parts.find(Boolean);
    const { position, normal } = part.mesh.geometry.attributes;
    const len = Math.hypot(0.01, 1, 0.02);
    for (const v of [0, position.count - 1]) {
      expect(position.getY(v)).toBeCloseTo(ground(position.getX(v), position.getZ(v)) + 0.04, 3);
      expect(normal.getX(v)).toBeCloseTo(-0.01 / len, 4);
      expect(normal.getY(v)).toBeCloseTo(1 / len, 4);
      expect(normal.getZ(v)).toBeCloseTo(-0.02 / len, 4);
    }
    // Next door's first column of vertices is this chunk's last.
    const next = view.parts[view.parts.indexOf(part) + 1];
    expect(next.mesh.geometry.attributes.position.getX(0)).toBeCloseTo(position.getX(part.chunk.cols * 2), 4);
  });

  it('takes a molehill down when its cell is combed, and not before', () => {
    const h = field();
    const hill = { x: midX + 0.5, z: midZ + 0.5, size: 1 };
    const view = viewOf(h, [hill, { x: midX + 40.5, z: midZ + 0.5, size: 1 }]);
    expect(view.shown).toEqual([true, true]);
    const version = view.hillMesh.instanceMatrix.version;
    pull(h, view, midX + 20, midZ - 5, midZ + 5); // between the two
    expect(view.shown).toEqual([true, true]);
    expect(view.hillMesh.instanceMatrix.version).toBe(version); // nothing sent while none has gone
    pull(h, view, midX);
    expect(view.shown).toEqual([false, true]);
    expect(view.hillMesh.instanceMatrix.version).toBeGreaterThan(version);
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

  // The field is a polygon on the new farm (`inPlace`), so only the points inside it are sampled; its bounds reach past its corners.
  const inside = (pad, each) => { for (let x = m.minX - pad; x <= m.maxX + pad; x += 2) for (let z = m.minZ - pad; z <= m.maxZ + pad; z += 2) if (inPlace(m, x, z)) each(x, z); };

  it('is all one field', () => {
    let n = 0;
    let own = 0;
    inside(0, (x, z) => {
      n++;
      if (fields.areaOf(x, z) === 'ley') own++;
    });
    expect(own / n).toBeGreaterThan(0.95); // the brook clips a corner of Low Ley
  });

  it('is clear of the track and bogs, and not a steep hillside', () => {
    let lo = Infinity;
    let hi = -Infinity;
    inside(1, (x, z) => {
      const y = heights.heightAt(x, z);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
      expect(track.distanceTo(x, z), `track ${x},${z}`).toBeGreaterThan(LAYOUT.trackHalfWidth + 3);
      expect(heights.bogAt(x, z), `bog ${x},${z}`).toBe(0);
    });
    expect(hi - lo).toBeLessThan(20);
  });

  it('has the harrows left at its edge, on the grass and off the track', () => {
    const at = LAYOUT.harrows;
    expect(track.distanceTo(at.x, at.z)).toBeGreaterThan(LAYOUT.trackHalfWidth + 3);
    expect(Number.isFinite(at.x) && Number.isFinite(at.z)).toBe(true);
  });
});
