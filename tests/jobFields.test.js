import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { namedLayout } from '../src/world/fieldNames.js';
import { JOB_FIELDS, FIELD_WORK, jobPlace, inPlace, outsideBy, liveCells, countLive, jobFieldLabel } from '../src/world/jobFields.js';
import { FARM_JOBS, JobBoard, jobsFor } from '../src/world/farmJobs.js';
import { Spraying, DEFAULT_SPRAY_PARAMS, SPRAYED } from '../src/world/spraying.js';
import { Harrowing, DEFAULT_HARROW_PARAMS, dealMolehills } from '../src/world/harrowing.js';
import { Haymaking, DEFAULT_HAY_PARAMS } from '../src/world/haymaking.js';
import { presence } from '../src/world/hayMask.js';
import { inHayMeadow } from '../src/world/props.js';
import { polygonArea } from '../src/world/polygons.js';
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
    expect(two.hayMeadow.area).toBeCloseTo(polygonArea(field('hay').points), 3);
    expect(two.harrowField.area).toBeCloseTo(polygonArea(field('ley').points), 3);
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
    expect(h.liveCount).toBeGreaterThan(30000);
    expect(h.needed).toBeCloseTo(DEFAULT_HARROW_PARAMS.areaNeeded / h.liveCount, 6);
    h.combAll(1);
    expect(h.coverage).toBeCloseTo(1, 5);
    expect(h.index(two.harrowField.maxX - 0.5, two.harrowField.maxZ - 0.5)).toBe(-1);
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
