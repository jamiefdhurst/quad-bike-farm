import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { LAYOUT } from '../src/world/layout.js';
import { createFields } from '../src/world/fields.js';
import { inPlace } from '../src/world/jobFields.js';
import { Spraying, DEFAULT_SPRAY_PARAMS, SPRAY_PARAM_RANGES, SPRAY_CELL, UNSPRAYED, SPRAYED, DOUBLED, sprayRuns, sprayWanted } from '../src/world/spraying.js';
import { DEFAULT_HOSE_PARAMS } from '../src/items/hose.js';
import { FARM_JOBS, availableJobs } from '../src/world/farmJobs.js';
import { SprayView } from '../src/world/sprayView.js';

const RECT = { minX: 0, maxX: 24, minZ: 0, maxZ: 20 };
const mk = (over = {}) => new Spraying({ rect: RECT, params: { ...DEFAULT_SPRAY_PARAMS, ...over } });
// The sprayer driving along +z (yaw 0, the boom hangs behind its axle) at x, from z0 to z1 at `speed`, in 0.1 s steps.
const drive = (sp, x, z0, z1, { speed = 2, day = 1, hitched = true, yaw = 0 } = {}) => {
  const events = [];
  const dir = Math.sign(z1 - z0) || 1;
  const step = speed * 0.1;
  for (let z = z0; dir > 0 ? z <= z1 : z >= z1; z += dir * step) events.push(...sp.update(0.1, { x, z, yaw: dir > 0 ? yaw : yaw + Math.PI, speed, hitched, day }));
  return events;
};
const out = (sp) => {
  sp.setBoom(true);
  return sp;
};

describe('the grid', () => {
  it('is a grid of unsprayed cells with a full tank and the boom in', () => {
    const sp = mk();
    expect(sp.cells).toBe(24 * 20);
    expect(sp.count(UNSPRAYED)).toBe(sp.cells);
    expect(sp.tank).toBe(1);
    expect(sp.boom).toBe(0);
    expect(sp.index(0.5, 0.5)).toBe(0);
    expect(sp.index(-1, 5)).toBe(-1);
    const c = sp.centre(sp.index(7.2, 9.1));
    expect(sp.index(c.x, c.z)).toBe(sp.index(7.2, 9.1));
  });
});

describe('the boom', () => {
  it('takes foldSeconds to fold out and back', () => {
    const sp = mk();
    sp.toggleBoom();
    for (let i = 0; i < 20; i++) sp.update(0.1, { x: 0, z: 0, yaw: 0, speed: 0, hitched: true });
    expect(sp.boom).toBeCloseTo(20 * 0.1 / sp.p.foldSeconds, 5);
    for (let i = 0; i < 40; i++) sp.update(0.1, { x: 0, z: 0, yaw: 0, speed: 0, hitched: true });
    expect(sp.out).toBe(true);
    sp.toggleBoom();
    for (let i = 0; i < 40; i++) sp.update(0.1, { x: 0, z: 0, yaw: 0, speed: 0, hitched: true });
    expect(sp.boom).toBe(0);
  });

  it('lays nothing while folded in', () => {
    const sp = mk();
    drive(sp, 12, 2, 18);
    expect(sp.coverage).toBe(0);
    expect(sp.tank).toBe(1);
  });
});

describe('spraying', () => {
  it('sprays a strip as wide as the boom, centred on it, behind the axle', () => {
    const sp = out(mk());
    drive(sp, 12, 4, 16);
    const row = (z) => Array.from({ length: sp.cols }, (_, c) => sp.state[sp.index(c + 0.5, z)]);
    const sprayed = row(10).map((s, c) => (s ? c : -1)).filter((c) => c >= 0);
    expect(sprayed[0]).toBe(9);
    expect(sprayed[sprayed.length - 1]).toBe(14);
    expect(sprayed.length).toBe(6);
    // The boom is behind the axle: nothing ahead of where it started
    expect(sp.state[sp.index(12, 4 - sp.p.boomBehind - 1)]).toBe(UNSPRAYED);
  });

  it('puts about one dose on a cell in one pass', () => {
    const sp = out(mk());
    drive(sp, 12, 4, 16);
    const d = sp.dose[sp.index(11.5, 10.5)];
    expect(d).toBeGreaterThan(0.8);
    expect(d).toBeLessThan(1.3);
    expect(sp.state[sp.index(11.5, 10.5)]).toBe(SPRAYED);
  });

  it('shows the overlap of two passes as doubled', () => {
    const sp = out(mk());
    drive(sp, 8, 4, 16);
    drive(sp, 13, 16, 4); // 5 m across: one metre overlapped
    const overlap = [];
    for (let c = 0; c < sp.cols; c++) if (sp.state[sp.index(c + 0.5, 10.5)] === DOUBLED) overlap.push(c);
    expect(overlap.length).toBeGreaterThanOrEqual(1);
    expect(overlap.length).toBeLessThanOrEqual(2);
    expect(sp.overlap).toBeGreaterThan(0);
  });

  it('does not lay spray too slowly or too fast', () => {
    const slow = out(mk());
    drive(slow, 12, 4, 10, { speed: 0.3 });
    expect(slow.coverage).toBe(0);
    const fast = out(mk());
    drive(fast, 12, 4, 16, { speed: 6 });
    expect(fast.coverage).toBe(0);
    expect(fast.tank).toBe(1);
  });

  it('needs the sprayer hitched', () => {
    const sp = out(mk());
    drive(sp, 12, 4, 16, { hitched: false });
    expect(sp.coverage).toBe(0);
  });

  it('works backwards too', () => {
    const sp = out(mk());
    drive(sp, 12, 16, 4);
    expect(sp.coverage).toBeGreaterThan(0.1);
  });

  it('ignores a jump (being placed) rather than spraying across it', () => {
    const sp = out(mk());
    sp.update(0.1, { x: 12, z: 2, yaw: 0, speed: 2, hitched: true });
    sp.update(0.1, { x: 12, z: 19, yaw: 0, speed: 2, hitched: true });
    expect(sp.coverage).toBe(0);
  });

  it('uses the tank by distance, runs dry once and then stops', () => {
    const sp = out(mk({ tankMetres: 10 }));
    const events = drive(sp, 12, 2, 18);
    expect(events.filter((e) => e.type === 'empty')).toHaveLength(1);
    expect(sp.tank).toBe(0);
    expect(sp.phase).toBe('fill');
    const before = sp.coverage;
    drive(sp, 18, 2, 18);
    expect(sp.coverage).toBe(before);
  });

  it('is filled by the hose over fillSeconds', () => {
    const sp = mk();
    sp.tank = 0;
    let said = null;
    for (let t = 0; t < sp.p.fillSeconds + 1; t += 0.1) said = sp.fill(0.1) ?? said;
    expect(sp.tank).toBe(1);
    expect(said).toBe('full');
    expect(sp.fill(0.1)).toBe(null);
  });
});

describe('the job', () => {
  const sweep = (sp, from = 1, step = 5) => {
    const events = [];
    let up = true;
    for (let x = from; x < RECT.maxX + 3; x += step) {
      events.push(...(up ? drive(sp, x, 2.5, 20 + sp.p.boomBehind) : drive(sp, x, 20 + sp.p.boomBehind, 2.5)));
      up = !up;
    }
    return events;
  };

  it('is done when enough of the field is covered, once, and records the day', () => {
    const sp = out(mk({ tankMetres: 2000 }));
    const events = sweep(sp);
    expect(sp.coverage).toBeGreaterThanOrEqual(sp.p.coverNeeded);
    expect(events.filter((e) => e.type === 'done')).toHaveLength(1);
    expect(sp.done).toBe(true);
    expect(sp.doneDay).toBe(1);
    expect(sp.phase).toBe('done');
  });

  it('is not done by half the field', () => {
    const sp = out(mk({ tankMetres: 2000 }));
    drive(sp, 4, 2.5, 20);
    drive(sp, 10, 20, 2.5);
    expect(sp.coverage).toBeLessThan(sp.p.coverNeeded);
    expect(sp.done).toBe(false);
  });

  it('wants spraying until done, then not for lastsDays', () => {
    const sp = out(mk({ tankMetres: 2000, lastsDays: 5 }));
    expect(sp.needsSpraying(3)).toBe(true);
    sweep(sp);
    expect(sp.needsSpraying(1)).toBe(false);
    expect(sp.needsSpraying(5)).toBe(false);
    expect(sp.needsSpraying(6)).toBe(true);
  });

  it('sprays outside the field into nothing but still uses the tank', () => {
    const sp = out(mk());
    drive(sp, 60, 2, 16);
    expect(sp.coverage).toBe(0);
    expect(sp.tank).toBeLessThan(1);
  });
});

describe('keeping it', () => {
  const sprayed = (day = 2) => {
    const sp = out(mk({ tankMetres: 2000 }));
    drive(sp, 12, 3, 17, { day });
    return sp;
  };

  it('keeps the tank, the doses and the days, and puts them back', () => {
    const sp = sprayed();
    const save = JSON.parse(JSON.stringify(sp.toJSON()));
    const back = mk();
    back.restore(save, 3);
    expect(back.tank).toBeCloseTo(sp.tank, 2);
    expect(back.since).toBe(2);
    for (let i = 0; i < sp.cells; i++) expect(back.state[i], `cell ${i}`).toBe(sp.state[i]);
    expect(back.coverage).toBeCloseTo(sp.coverage, 5);
  });

  it('keeps a doubled cell doubled', () => {
    const sp = out(mk({ tankMetres: 2000 }));
    drive(sp, 8, 4, 16);
    drive(sp, 13, 16, 4);
    const back = mk();
    back.restore(JSON.parse(JSON.stringify(sp.toJSON())), 1);
    expect(back.count(DOUBLED)).toBe(sp.count(DOUBLED));
  });

  it('lets a partly sprayed field wear off after lastsDays', () => {
    const save = sprayed(2).toJSON();
    const back = mk();
    back.restore(save, 2 + back.p.lastsDays - 1);
    expect(back.coverage).toBeGreaterThan(0);
    back.restore(save, 2 + back.p.lastsDays);
    expect(back.coverage).toBe(0);
    expect(back.tank).toBeCloseTo(save.tank, 2); // the tank is kept either way
  });

  it('keeps a done field done for lastsDays from the day it was done', () => {
    const sp = out(mk({ tankMetres: 2000 }));
    sp.sprayAll(4);
    const save = sp.toJSON();
    const back = mk();
    back.restore(save, 4 + back.p.lastsDays - 1);
    expect(back.done).toBe(true);
    expect(back.needsSpraying(4 + back.p.lastsDays - 1)).toBe(false);
    back.restore(save, 4 + back.p.lastsDays);
    expect(back.done).toBe(false);
    expect(back.needsSpraying(4 + back.p.lastsDays)).toBe(true);
  });

  it('reads a save without it, or a damaged one, as a fresh field', () => {
    for (const bad of [undefined, null, {}, { cells: 5 }, { cells: 'x', since: 1 }, { tank: 'lots' }]) {
      const sp = mk();
      sp.restore(bad, 3);
      expect(sp.coverage).toBe(0);
      expect(sp.tank).toBeGreaterThanOrEqual(0);
      expect(sp.tank).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the farm\'s big field in no more characters than it has cells of its own, and the job\'s progress through capture and restore (#1072)', () => {
    const sp = new Spraying({ rect: LAYOUT.sprayField }); // what the game's captureFarm keeps is this toJSON, and its restore this restore
    expect(sp.cells).toBeGreaterThan(sp.liveCount); // the field's bounds reach past its corners
    expect(sp.toJSON().cells.length).toBeLessThan(10); // nothing sprayed: one run
    sp.sprayHalf(3);
    sp.tank = 0.4;
    const save = JSON.parse(JSON.stringify(sp.toJSON()));
    expect(save.cells.length).toBeLessThan(1000); // half a day's job, where a digit a cell was 32,640
    const back = new Spraying({ rect: LAYOUT.sprayField });
    back.restore(save, 4);
    expect(back.progress).toBeCloseTo(0.5, 2);
    expect(back.progress).toBe(sp.progress);
    expect(back.coverage).toBe(sp.coverage);
    expect([...back.state]).toEqual([...sp.state]);
    expect(back.tank).toBeCloseTo(0.4, 3);
    expect(back.since).toBe(3);
    // The worst there could be: every cell of the field different from the one before it.
    for (let i = 0; i < sp.cells; i++) sp.dose[i] = sp.live[i] ? (i % 3) * 0.75 : 0;
    const worst = sp.toJSON().cells;
    expect(worst.length).toBeLessThanOrEqual(sp.liveCount);
    back.restore({ ...save, cells: worst }, 4);
    for (let i = 0; i < sp.cells; i++) expect(back.dose[i]).toBe(sp.dose[i]);
  });

  it('still reads a save from before, a digit for every cell of the grid', () => {
    const sp = new Spraying({ rect: LAYOUT.sprayField });
    sp.sprayHalf(3);
    let digits = '';
    for (let i = 0; i < sp.cells; i++) digits += Math.min(9, Math.ceil(sp.dose[i] * 4 - 1e-9));
    const back = new Spraying({ rect: LAYOUT.sprayField });
    back.restore({ tank: 1, since: 3, doneDay: null, cells: digits }, 4);
    expect([...back.state]).toEqual([...sp.state]);
    expect(back.progress).toBe(sp.progress);
  });

  it('tells the board from the save alone whether the field wants spraying', () => {
    expect(sprayWanted(undefined, 3)).toBe(true);
    expect(sprayWanted({ doneDay: 2 }, 3)).toBe(false);
    expect(sprayWanted({ doneDay: 2 }, 2 + DEFAULT_SPRAY_PARAMS.lastsDays)).toBe(true);
    expect(sprayWanted({ doneDay: null }, 3)).toBe(true);
  });
});

describe('the sprayed ground on the farm\'s big field (#1072)', () => {
  const rect = LAYOUT.sprayField;
  const midX = Math.round((rect.minX + rect.maxX) / 2);
  const midZ = Math.round((rect.minZ + rect.maxZ) / 2);
  const field = () => out(new Spraying({ rect, params: { ...DEFAULT_SPRAY_PARAMS, tankMetres: 1e6, areaNeeded: 1e9 } }));
  const viewOf = (sp) => new SprayView({ scene: new THREE.Scene(), spraying: sp, heightAt: (x, z) => 0.01 * x + 0.02 * z });
  const colours = (mesh) => mesh.geometry.attributes.color;
  /** What drawing a chunk does: its marked colours go to the graphics card and the marks are forgotten. */
  const draw = (view) => {
    for (const mesh of view.parts) {
      if (!mesh) continue;
      colours(mesh).onUploadCallback();
      colours(mesh).clearUpdateRanges();
    }
  };
  /** A pass of the boom up the field at `x`, each event's cells repainted as the game does. Returns every cell that changed. */
  const pass = (sp, view, x, z0 = midZ - 30, z1 = midZ + 30) => {
    const changed = new Set();
    for (const e of drive(sp, x, z0, z1)) {
      if (e.type !== 'sprayed') continue;
      view.repaint(e.cells);
      for (const cell of e.cells) changed.add(cell);
    }
    return changed;
  };
  const triangles = (view) => view.parts.reduce((n, mesh) => n + (mesh ? mesh.geometry.index.count / 3 : 0), 0);

  it('draws nothing over a field with no spray on it', () => {
    const sp = field();
    expect(sp.index(midX, midZ)).toBeGreaterThanOrEqual(0); // the passes below are in the field
    const view = viewOf(sp);
    expect(view.parts.every((mesh) => mesh === null)).toBe(true);
    expect(view.ground.children).toEqual([view.primer]); // the one cell the shader is built from, never shown
    expect(view.primer.visible).toBe(false);
  });

  it('builds only the chunks a pass goes through', () => {
    const sp = field();
    const view = viewOf(sp);
    const changed = pass(sp, view, midX);
    expect(changed.size).toBeGreaterThan(300);
    const touched = new Set([...changed].map((cell) => view.grid.chunkOf[cell]));
    expect(view.parts.flatMap((mesh, k) => (mesh ? [k] : [])).sort()).toEqual([...touched].sort());
    expect(touched.size).toBeLessThanOrEqual(10); // 60 m of a 6 m boom, in 16 m chunks
    expect(triangles(view)).toBeLessThan((sp.liveCount * 2) / 10); // where one mesh of the field drew all of it
  });

  it('sends only the changed cells\' colours after a pass', () => {
    const sp = field();
    const view = viewOf(sp);
    pass(sp, view, midX);
    draw(view);
    const before = view.parts.map((mesh) => (mesh ? colours(mesh).version : null));
    const changed = pass(sp, view, midX + 4, midZ - 30, midZ - 10); // beside the first, lapping it: cells in chunks already drawn, and perhaps new ones
    expect(changed.size).toBeGreaterThan(50);
    let sent = 0;
    view.parts.forEach((mesh, k) => {
      const mine = [...changed].filter((cell) => view.grid.chunkOf[cell] === k);
      if (!mesh) return expect(mine).toEqual([]);
      const col = colours(mesh);
      if (!mine.length) {
        expect(col.version, `chunk ${k} was left alone`).toBe(before[k]);
        expect(col.updateRanges).toEqual([]);
        return;
      }
      expect(col.version).toBeGreaterThan(before[k] ?? 0);
      if (before[k] === null) return expect(mesh.userData.whole).toBe(true); // a new chunk goes whole, once
      const slots = new Set();
      for (const { start, count } of col.updateRanges) {
        expect(start % 16).toBe(0);
        for (let s = start / 16; s < (start + count) / 16; s++) slots.add(s);
        sent += count;
      }
      expect([...slots].sort((a, b) => a - b)).toEqual(mine.map((cell) => view.grid.slotOf[cell]).sort((a, b) => a - b));
    });
    expect(sent).toBeGreaterThan(0);
    expect(sent * 4).toBeLessThan(40000); // bytes: a fiftieth of the 2.1 MB that went each time a cell changed
  });

  it('sends a chunk whole rather than keep more than a few dozen runs for one out of sight', () => {
    const sp = field();
    const view = viewOf(sp);
    pass(sp, view, midX);
    draw(view);
    const mesh = view.parts.find(Boolean);
    const chunk = view.grid.chunks[view.parts.indexOf(mesh)];
    for (let n = 0; n < 40; n++) view.repaint([chunk.cells[(n * 2) % chunk.cells.length]]); // every other cell: no two join into a run
    expect(colours(mesh).updateRanges).toEqual([]);
    expect(mesh.userData.whole).toBe(true);
  });

  it('paints a pass and a loaded field the same, and clears away what is cleared', () => {
    const sp = field();
    const view = viewOf(sp);
    pass(sp, view, midX);
    pass(sp, view, midX + 4);
    const back = new Spraying({ rect });
    back.restore(JSON.parse(JSON.stringify(sp.toJSON())), 1);
    const loaded = viewOf(back);
    expect(loaded.parts.map(Boolean)).toEqual(view.parts.map(Boolean));
    view.parts.forEach((mesh, k) => {
      if (!mesh) return;
      const want = Array.from(colours(mesh).array);
      expect(want.some((v) => v > 0)).toBe(true);
      expect(Array.from(colours(loaded.parts[k]).array), `chunk ${k}`).toEqual(want);
    });
    sp.clear();
    view.refresh();
    expect(view.parts.every((mesh) => mesh === null)).toBe(true);
    expect(view.ground.children).toEqual([view.primer]);
  });

  it('is the field\'s own cells and no more when all of it is sprayed', () => {
    const sp = field();
    const view = viewOf(sp);
    sp.sprayAll(1);
    view.refresh();
    expect(triangles(view)).toBe(sp.liveCount * 2);
    const y = view.parts.find(Boolean).geometry.attributes.position;
    expect(y.getY(0)).toBeCloseTo(0.01 * y.getX(0) + 0.02 * y.getZ(0) + 0.05, 4); // on the ground, lifted clear of it
  });
});

describe('the map lines', () => {
  it('are runs of sprayed cells along each row, doubled ones apart', () => {
    const sp = out(mk());
    drive(sp, 8, 4, 16);
    const runs = sprayRuns(sp);
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) {
      expect(r.x1).toBeGreaterThan(r.x0);
      expect(r.state).not.toBe(UNSPRAYED);
    }
    const width = runs.filter((r) => r.z === 10).reduce((a, r) => a + r.x1 - r.x0, 0);
    expect(width).toBe(6);
  });
});

describe('the field in the farm', () => {
  const fields = createFields(LAYOUT);
  const f = LAYOUT.sprayField;

  it('puts the sprayer where the hose reaches (with a metre to spare)', () => {
    const s = LAYOUT.sprayer;
    expect(Math.hypot(s.x - LAYOUT.hose.x, s.z - LAYOUT.hose.z)).toBeLessThan(DEFAULT_HOSE_PARAMS.reach - 1);
  });

  it('is stubble, as far as the eye goes, with nothing built on it', () => {
    let n = 0;
    let stubble = 0;
    for (let x = f.minX; x <= f.maxX; x += 2) for (let z = f.minZ; z <= f.maxZ; z += 2) {
      if (!inPlace(f, x, z)) continue;
      n++;
      if (fields.stubbleAt(x, z) > 0.5) stubble++;
    }
    expect(stubble / n).toBeGreaterThan(0.9); // the headland's strip round it is grass, not stubble
  });

});

describe('on the board', () => {
  it('is a farm job that needs the field', () => {
    expect(FARM_JOBS.spray.needs).toBe('sprayField');
    expect(availableJobs(LAYOUT)).toContain('spray');
    expect(availableJobs({ ...LAYOUT, sprayField: undefined })).not.toContain('spray');
    expect(FARM_JOBS.spray.chalk.length).toBeGreaterThan(5);
  });

  it('has a range for every tunable', () => {
    for (const k of Object.keys(DEFAULT_SPRAY_PARAMS)) expect(SPRAY_PARAM_RANGES[k], k).toBeTruthy();
    expect(SPRAY_CELL).toBe(1);
  });
});
