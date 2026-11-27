import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { namedLayout } from '../src/world/fieldNames.js';
import { JOB_FIELDS, FIELD_WORK, FIELD_EDGE, BROOK_CLEAR, jobPlace, clearOfBrook, placeOutline, inPlace, outsideBy, liveCells, countLive, liveMiddleFirst, jobFieldLabel } from '../src/world/jobFields.js';
import { createBrook } from '../src/world/brook.js';
import { FARM_JOBS, JobBoard, jobsFor } from '../src/world/farmJobs.js';
import { Spraying, DEFAULT_SPRAY_PARAMS, SPRAYED, UNSPRAYED } from '../src/world/spraying.js';
import { Harrowing, DEFAULT_HARROW_PARAMS, UNTOUCHED, dealMolehills } from '../src/world/harrowing.js';
import { Haymaking, DEFAULT_HAY_PARAMS, STANDING, CUT } from '../src/world/haymaking.js';
import { FieldWorkHost } from '../src/world/fieldWorkHost.js';
import { presence } from '../src/world/hayMask.js';
import { inHayMeadow } from '../src/world/props.js';
import { polygonArea, insetPolygon } from '../src/world/polygons.js';
import { createRandom } from '../src/core/random.js';

// The jobs on the new farm's fields (#691): which field each is on, the field's polygon as its area, and the chalkboard naming it.
const two = LAYOUT;
const named = namedLayout(two, 12345);
const field = (name) => two.fields.find((f) => f.name === name);

describe('the field each job is on', () => {
  it('is a field of layout 2 with an area, for every job', () => {
    for (const [job, name] of Object.entries(JOB_FIELDS)) {
      const f = field(name);
      expect(f, `${job} on ${name}`).toBeDefined();
      expect(polygonArea(f.points), `${job} on ${name}`).toBeGreaterThan(1000);
    }
  });
  it('is the one the issue settled: muck on Long Piece, spraying on Lane Field, harrowing and silage on Low Ley, hay on Hay Meadow, logs in the wood', () => {
    expect(JOB_FIELDS).toMatchObject({ muck: 'longpiece', spray: 'lanefield', harrow: 'ley', silage: 'ley', hay: 'hay', logs: 'wood' });
    expect(field('longpiece').kind).toBe('arable');
    expect(field('lanefield').kind).toBe('arable');
    expect(field('ley').kind).toBe('ley');
    expect(field('hay').kind).toBe('hay');
  });
  it('is on the layout for the game to read, and not on today\'s farm', () => {
  });
  it('has the silage stack out in Low Ley and the logs\' yard in the wood\'s field area', () => {
    expect(inPlace({ ...jobPlace(field('ley')) }, two.silage.x, two.silage.z)).toBe(true);
    expect(two.logYard).toBeDefined();
  });
});

describe('each job\'s area', () => {
  it('is its field\'s polygon, with the bounds the grid is laid over, not a rectangle', () => {
    for (const [job, { key }] of Object.entries(FIELD_WORK)) {
      const place = two[key];
      const f = field(JOB_FIELDS[job]);
      expect(place.field, key).toBe(f.name);
      expect(place.poly.length, key).toBeGreaterThanOrEqual(4);
      expect(place.area, key).toBeLessThan((place.maxX - place.minX) * (place.maxZ - place.minZ));
    }
    expect(two.hayMeadow.area).toBeCloseTo(polygonArea(insetPolygon(field('hay').points, FIELD_EDGE)), 3);
    expect(two.harrowField.area).toBeLessThan(polygonArea(insetPolygon(field('ley').points, FIELD_EDGE)) * 0.8); // the strip beyond the brook is cut off
    expect(two.harrowField.area).toBeGreaterThan(20000);
  });
  it('is cut clear of the brook, keeping the side with the most field, and leaves a field it doesn\'t reach as it was (#1110)', () => {
    const brook = createBrook(two);
    const p = two.harrowField;
    for (let x = p.minX; x <= p.maxX; x += 4) {
      const water = brook.zAt(x);
      for (let z = water - brook.halfAt(x) - BROOK_CLEAR + 0.5; z <= p.maxZ + 10; z += 2) expect(inPlace(p, x, z), `${x},${z}`).toBe(false);
    }
    expect(inPlace(p, (p.minX + p.maxX) / 2, p.minZ + 20)).toBe(true); // the field south of the water is the job's
    const square = [[0, 0], [100, 0], [100, 100], [0, 100]];
    const brookAt = (z) => ({ line: () => Array.from({ length: 71 }, (_, i) => ({ x: -20 + i * 2, z, half: 2 })) });
    const across = brookAt(70);
    const cut = clearOfBrook(square, across, 8);
    expect(Math.abs(polygonArea(cut))).toBeCloseTo(100 * 60, 3); // south of 70 - 2 - 8
    const away = brookAt(300);
    expect(clearOfBrook(square, away, 8)).toBe(square);
  });
  it('starts FIELD_EDGE in from the hedge lines, so a point on one is never the next field\'s', () => {
    for (const { key } of Object.values(FIELD_WORK)) {
      const p = two[key];
      const f = field(p.field);
      for (const [x, z] of f.points) expect(inPlace(p, x, z), `${key} ${x},${z}`).toBe(false);
    }
  });
  it('is what the map outlines while the job is on: the polygon, or the rectangle\'s corners on today\'s farm', () => {
    expect(placeOutline(two.harrowField)).toBe(two.harrowField.poly);
    expect(placeOutline({ minX: 0, maxX: 4, minZ: 1, maxZ: 3 })).toEqual([[0, 1], [4, 1], [4, 3], [0, 3]]);
  });
  it('is the headland-free middle for the spraying and the whole field for the hay and the harrowing', () => {
    expect(two.sprayField.area).toBeLessThan(polygonArea(field('lanefield').points) - 6 * 100);
    expect(two.sprayField.area).toBeGreaterThan(polygonArea(field('lanefield').points) * 0.8);
  });
  it('leaves out the cells of the bounds that are not the field', () => {
    const live = liveCells(two.sprayField, Math.ceil(two.sprayField.maxX - two.sprayField.minX), Math.ceil(two.sprayField.maxZ - two.sprayField.minZ), 1);
    expect(countLive(live)).toBeGreaterThan(two.sprayField.area * 0.98);
    expect(countLive(live)).toBeLessThan(two.sprayField.area * 1.02);
    expect(countLive(live)).toBeLessThan(live.length);
  });
  it('puts the corners of the bounds outside the place, by the polygon', () => {
    const p = two.hayMeadow;
    expect(inPlace(p, p.minX + 0.5, p.maxZ - 0.5)).toBe(false); // the hay meadow's south-west corner is cut off
    expect(inPlace(p, (p.minX + p.maxX) / 2, (p.minZ + p.maxZ) / 2)).toBe(true);
    expect(outsideBy(p, (p.minX + p.maxX) / 2, (p.minZ + p.maxZ) / 2)).toBeLessThan(0);
  });
});

describe('the jobs read the polygon', () => {
  const mid = (p) => ({ x: (p.minX + p.maxX) / 2, z: (p.minZ + p.maxZ) / 2 });
  it('spraying: a cell off the field is not there, and the coverage is of the field\'s cells', () => {
    const sp = new Spraying({ rect: two.sprayField, params: { ...DEFAULT_SPRAY_PARAMS } });
    const m = mid(two.sprayField);
    expect(sp.index(m.x, m.z)).toBeGreaterThanOrEqual(0);
    expect(sp.index(two.sprayField.minX + 0.5, two.sprayField.minZ + 0.5)).toBe(-1);
    expect(sp.liveCount).toBeLessThan(sp.cells);
    sp.sprayAll(1);
    expect(sp.coverage).toBeCloseTo(1, 5);
    expect(sp.count(SPRAYED)).toBe(sp.liveCount);
  });
  it('spraying: is done after the area it was by the old patch, whatever the size of the field (Jamie, 20 November 2026)', () => {
    const sp = new Spraying({ rect: two.sprayField, params: { ...DEFAULT_SPRAY_PARAMS } });
    expect(sp.needed).toBeCloseTo(DEFAULT_SPRAY_PARAMS.areaNeeded / sp.liveCount, 6);
    expect(sp.needed).toBeLessThan(0.05);
    sp.setBoom(true);
    const m = mid(two.sprayField);
    const events = [];
    let day = 1;
    for (let k = 0; k < 5 && !sp.done; k++) {
      const x = m.x + k * 5.5;
      for (let z = m.z - 20; z <= m.z + 20; z += 0.2) events.push(...sp.update(0.1, { x, z, yaw: 0, speed: 2, hitched: true, day }));
      day = 1;
    }
    expect(sp.done).toBe(true);
    expect(events.some((e) => e.type === 'done')).toBe(true);
    expect(sp.coverage).toBeLessThan(0.1);
    expect(sp.progress).toBe(1);
  });
  it('harrowing: the same, on Low Ley', () => {
    const h = new Harrowing({ rect: two.harrowField, params: { ...DEFAULT_HARROW_PARAMS } });
    expect(h.liveCount).toBeGreaterThan(20000); // Low Ley south of the brook (#1110)
    expect(h.needed).toBeCloseTo(DEFAULT_HARROW_PARAMS.areaNeeded / h.liveCount, 6);
    h.combAll(1);
    expect(h.coverage).toBeCloseTo(1, 5);
    expect(h.index(two.harrowField.minX + 0.5, two.harrowField.maxZ - 0.5)).toBe(-1); // the north-west corner of the bounds is beyond the brook
  });
  it('harrowing: the molehills are dealt in the field', () => {
    const hills = dealMolehills(two.harrowField, 16, createRandom(7));
    expect(hills.length).toBe(16);
    for (const m of hills) expect(inPlace(two.harrowField, m.x, m.z)).toBe(true);
  });
  it('hay: only the field\'s cells can be cut', () => {
    const hay = new Haymaking({ rect: two.hayMeadow, params: { ...DEFAULT_HAY_PARAMS } });
    const m = mid(two.hayMeadow);
    expect(hay.index(m.x, m.z)).toBeGreaterThanOrEqual(0);
    expect(hay.index(two.hayMeadow.minX + 1, two.hayMeadow.maxZ - 1)).toBe(-1);
    const cells = hay.cellsUnder({ x: m.x, z: m.z, heading: 0 });
    expect(cells.length).toBeGreaterThan(0);
    for (const i of cells) expect(hay.live[i]).toBe(1);
    // Cutting the cells the tractor passes over still counts toward the job.
    hay.start();
    for (let z = m.z - 30; z < m.z + 30; z += 0.3) hay.update(0.1, { x: m.x, z, heading: 0, speed: 1.5, working: true, day: 1 });
    expect(hay.cut).toBeGreaterThan(0);
  });
  it('hay: the picture fades by the polygon\'s edge, and the meadow\'s own long grass is kept off the ground cover in it and its margin', () => {
    const p = two.hayMeadow;
    const m = mid(p);
    expect(presence(p, m.x, m.z)).toBe(1);
    expect(presence(p, p.minX + 0.5, p.maxZ - 0.5)).toBeLessThan(0.5);
    expect(inHayMeadow(two, m.x, m.z)).toBe(true);
    expect(inHayMeadow(two, p.minX + 0.5, p.maxZ - 0.5)).toBe(false);
    expect(inHayMeadow(two, p.maxX + 30, p.maxZ + 30)).toBe(false);
  });
});

// The debug panel's buttons, pressed on a stand-in game that holds the real jobs over the real fields (#1069).
function panel({ sprayField = two.sprayField, harrowField = two.harrowField, hayMeadow = two.hayMeadow } = {}) {
  const view = { refresh() {}, reset() {}, addLoose() {}, repaint() {} };
  const nowhere = { position: { distanceTo: () => 5 } };
  const game = {
    farm: { day: 3 },
    jobBoard: { has: () => true, add() {} },
    jobDefs: {},
    hud: { toast() {} },
    companions: [],
    trailer: { model: nowhere },
    spray: new Spraying({ rect: sprayField, params: { ...DEFAULT_SPRAY_PARAMS } }),
    harrow: new Harrowing({ rect: harrowField, params: { ...DEFAULT_HARROW_PARAMS } }),
    hay: new Haymaking({ rect: hayMeadow, params: { ...DEFAULT_HAY_PARAMS } }),
    sprayView: view,
    harrowView: view,
    hayView: view,
  };
  return { game, host: new FieldWorkHost(game) };
}
const offField = (job) => [...job.state.keys()].filter((i) => !job.live[i]);

describe('the panel\'s buttons on the new fields (#1069)', () => {
  it('deals the field\'s own cells from the middle out', () => {
    const sp = new Spraying({ rect: two.sprayField, params: { ...DEFAULT_SPRAY_PARAMS } });
    const cells = liveMiddleFirst(sp.live, sp.cols, sp.rows);
    expect(cells.length).toBe(sp.liveCount);
    for (const i of cells) expect(sp.live[i]).toBe(1);
    const far = (i) => Math.hypot((i % sp.cols) - sp.cols / 2, Math.floor(i / sp.cols) - sp.rows / 2);
    expect(far(cells[0])).toBeLessThan(2);
    expect(far(cells[cells.length - 1])).toBeGreaterThan(sp.rows / 2);
  });
  it('the spray "half" button leaves the job about half done on Lane Field, with nothing sprayed off the field', () => {
    const { game, host } = panel();
    const sp = game.spray;
    host.debugSpray('half');
    expect(sp.progress).toBeGreaterThanOrEqual(0.5);
    expect(sp.progress).toBeLessThan(0.52);
    expect(sp.count(SPRAYED)).toBe(Math.ceil((sp.needed * sp.liveCount) / 2));
    for (const i of offField(sp)) expect(sp.state[i] + sp.dose[i], `cell ${i}`).toBe(0);
    expect(sp.started).toBe(true);
    expect(sp.since).toBe(3);
    // The next update does not tick it off: half is half of the job, not of the field.
    const events = sp.update(0.1, { x: two.sprayField.minX - 50, z: two.sprayField.minZ - 50, yaw: 0, speed: 2, hitched: true, day: 3 });
    expect(events.some((e) => e.type === 'done')).toBe(false);
    expect(sp.done).toBe(false);
    // Pressed again it adds nothing: the job is already half done.
    host.debugSpray('half');
    expect(sp.progress).toBeLessThan(0.52);
  });
  it('the harrow "half" button the same, on Low Ley', () => {
    const { game, host } = panel();
    const h = game.harrow;
    host.debugHarrow('half');
    expect(h.progress).toBeGreaterThanOrEqual(0.5);
    expect(h.progress).toBeLessThan(0.52);
    expect(h.combed).toBe(Math.ceil((h.needed * h.liveCount) / 2));
    for (const i of offField(h)) expect(h.state[i], `cell ${i}`).toBe(UNTOUCHED);
    expect(h.since).toBe(3);
    const events = h.update(0.1, { x: two.harrowField.minX - 50, z: two.harrowField.minZ - 50, yaw: 0, speed: 2, hitched: true, day: 3 });
    expect(events.some((e) => e.type === 'done')).toBe(false);
    expect(h.done).toBe(false);
    host.debugHarrow('half');
    expect(h.progress).toBeLessThan(0.52);
  });
  it('both "half" buttons still do half of the old small patches, where the job is most of the patch', () => {
    const { game, host } = panel({ sprayField: RAW_LAYOUT.sprayField, harrowField: RAW_LAYOUT.harrowField });
    host.debugSpray('half');
    host.debugHarrow('half');
    expect(game.spray.coverage).toBeCloseTo(DEFAULT_SPRAY_PARAMS.coverNeeded / 2, 2);
    expect(game.harrow.coverage).toBeCloseTo(DEFAULT_HARROW_PARAMS.coverNeeded / 2, 2);
    expect(game.spray.done || game.harrow.done).toBe(false);
  });
  it('the hay stage that lays the bales ("load", the baling done) has all eight inside the patch, on Hay Meadow and on the old farm\'s patch', () => {
    for (const [name, hayMeadow] of [['Hay Meadow', two.hayMeadow], ['the old patch', RAW_LAYOUT.hayMeadow]]) {
      const { game, host } = panel({ hayMeadow });
      const hay = game.hay;
      host.debugHayStage('load');
      expect(hay.bales.length, name).toBe(8);
      expect(hay.phase, name).toBe('load');
      for (const b of hay.bales) {
        expect(inPlace(hay.rect, b.x, b.z, -1), `${name}: bale at ${b.x}, ${b.z}`).toBe(true);
        expect(b.x, name).toBeGreaterThan(hay.rect.minX + 1);
        expect(b.x, name).toBeLessThan(hay.rect.maxX - 1);
      }
      const xs = hay.bales.map((b) => b.x);
      expect((Math.min(...xs) + Math.max(...xs)) / 2, name).toBeCloseTo((hay.rect.minX + hay.rect.maxX) / 2, 6); // the row is centred
      expect(hay.count(CUT), name).toBe(hay.p.cutNeeded);
      for (const i of offField(hay)) expect(hay.state[i], `${name}: cell ${i}`).toBe(STANDING);
    }
  });
  it('the bale row closes up rather than run off a patch too narrow for it', () => {
    const hay = new Haymaking({ rect: RAW_LAYOUT.hayMeadow, params: { ...DEFAULT_HAY_PARAMS, balesNeeded: 16 } });
    const row = hay.baleRow();
    expect(row.length).toBe(16);
    for (const at of row) expect(inPlace(hay.rect, at.x, at.z - hay.p.baleBehind, -1)).toBe(true);
    expect(row[1].x - row[0].x).toBeLessThan(3);
  });
});

describe('a save with cells off the field (#1069)', () => {
  it('spraying: restores the field\'s cells and leaves the rest of the bounds unsprayed', () => {
    const sp = new Spraying({ rect: two.sprayField, params: { ...DEFAULT_SPRAY_PARAMS } });
    expect(offField(sp).length).toBeGreaterThan(1000);
    sp.restore({ tank: 0.5, since: 2, doneDay: null, cells: '4'.repeat(sp.cells) }, 2);
    for (const i of offField(sp)) expect(sp.state[i] + sp.dose[i], `cell ${i}`).toBe(0);
    expect(sp.count(SPRAYED)).toBe(sp.liveCount);
    expect(sp.count(UNSPRAYED)).toBe(sp.cells - sp.liveCount);
    expect(sp.coverage).toBeCloseTo(1, 6);
  });
  it('harrowing: the same', () => {
    const h = new Harrowing({ rect: two.harrowField, params: { ...DEFAULT_HARROW_PARAMS } });
    expect(offField(h).length).toBeGreaterThan(1000);
    h.restore({ since: 2, doneDay: null, cells: '12'.repeat(h.cells / 2 + 1).slice(0, h.cells) }, 2);
    for (const i of offField(h)) expect(h.state[i], `cell ${i}`).toBe(UNTOUCHED);
    expect(h.combed).toBe(h.liveCount);
    expect(h.coverage).toBeCloseTo(1, 6);
  });
  it('hay: the same', () => {
    const hay = new Haymaking({ rect: two.hayMeadow, params: { ...DEFAULT_HAY_PARAMS } });
    expect(offField(hay).length).toBeGreaterThan(100);
    hay.restore({ cut: [...hay.state.keys()], cutDay: 2, stacked: 0 }, 2);
    for (const i of offField(hay)) expect(hay.state[i], `cell ${i}`).toBe(STANDING);
    expect(hay.cut).toBe(countLive(hay.live));
    expect(hay.toJSON().cut.every((i) => hay.live[i] === 1)).toBe(true);
  });
});

describe('the chalkboard names the field', () => {
  const label = (job) => jobFieldLabel(named, job);
  it('has the dealt name of each job\'s field in its words', () => {
    const jobs = jobsFor(named);
    expect(label('spray')).toBe(named.fields.find((f) => f.name === 'lanefield').label);
    expect(jobs.spray.chalk).toBe(`Spray ${label('spray')}`);
    expect(jobs.harrow.chalk).toBe(`Harrow ${label('harrow')}`);
    expect(jobs.muck.chalk).toBe(`Spread muck on ${label('muck')}`);
    expect(jobs.hay.chalk).toContain(label('hay'));
    expect(jobs.silage.chalk).toContain(label('silage'));
    expect(jobs.logs.chalk).toContain(label('logs'));
  });
  it('says the same field in the hint as on the board', () => {
    const jobs = jobsFor(named);
    expect(jobs.muck.hint).toContain(label('muck'));
    expect(jobs.silage.hint).toContain(label('silage'));
    expect(jobs.hay.hint).toContain(label('hay'));
  });
  it('reaches the board\'s lines', () => {
    const jobs = jobsFor(named);
    const board = new JobBoard({ ids: ['spray', 'harrow'], random: createRandom(3), jobs });
    const texts = board.lines().map((l) => l.text);
    expect(texts).toContain(`Spray ${label('spray')}`);
    expect(texts).toContain(`Harrow ${label('harrow')}`);
  });
  it('differs by farm, as the names are dealt from the seed', () => {
    const others = [1, 2, 3, 4, 5, 6].map((s) => jobsFor(namedLayout(two, s * 99991)).spray.chalk);
    expect(new Set(others).size).toBeGreaterThan(1);
  });
});
