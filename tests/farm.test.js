import { describe, it, expect } from 'vitest';
import { SAVE_KEY, SAVE_VERSION, DEFAULT_FARM_PARAMS as P, readSave, writeSave, wipeSave, openFarm, continueInfo, fleetFromSave, validSave, describeFarm } from '../src/farm/farmSave.js';
import { captureVehicle, restoreVehicle, overnight, savedFaults, captureGirls, restoreGirls } from '../src/farm/farmState.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { Faults } from '../src/vehicle/faults.js';
import { FuelSystem } from '../src/vehicle/fuelSystem.js';
import { Sump } from '../src/vehicle/sump.js';
import { TyreSet, newTyres } from '../src/vehicle/tyres.js';
import { AirFilter } from '../src/vehicle/airFilter.js';
import { QuirkSet } from '../src/vehicle/quirks.js';
import { BarnFind } from '../src/vehicle/barnFind.js';
import { Favour } from '../src/npc/favour.js';
import { FallingOut } from '../src/npc/fallingOut.js';
import { Skills } from '../src/npc/skills.js';
import { Romance } from '../src/npc/romance.js';
import { Records } from '../src/world/records.js';
import { Logbook, formatWhen } from '../src/workshop/logbook.js';
import { Achievements, ACHIEVEMENTS } from '../src/achievements/achievements.js';

/** A stand-in for localStorage. */
function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

/** A vehicle made of the real pure parts, as the game's QuadUnit holds them. */
function unit() {
  const engine = new EngineModel({ strokes: 2 });
  const fuel = new FuelSystem({ tankCapacity: 10, bowlCapacity: 0.1, startLitres: 6, reserveLitres: 1, startOil: 0.02 });
  return {
    dealtIdle: 1450,
    engine,
    quad: {
      usage: { hours: 120, odoMiles: 800 },
      faults: new Faults(),
      fuel,
      sump: new Sump({ level: 0.8 }),
      tyres: new TyreSet(newTyres(4)),
      filter: new AirFilter(),
      quirks: new QuirkSet([]),
    },
    mud: { state: { body: 0, wheels: 0, wet: 0, washed: 0 } },
  };
}

function girls() {
  const ids = ['amy', 'jess'];
  return { favour: new Favour(ids), fallingOut: new FallingOut(ids), skills: new Skills(ids), romance: new Romance(ids) };
}

const save = (over = {}) => ({ version: SAVE_VERSION, day: 3, farmSeed: 1234, ...over });

describe('the save', () => {
  it('writes, reads back and wipes', () => {
    const s = memoryStorage();
    expect(readSave(s)).toBe(null);
    expect(writeSave(s, save())).toBe(true);
    expect(readSave(s)).toMatchObject({ day: 3, farmSeed: 1234, version: SAVE_VERSION });
    wipeSave(s);
    expect(readSave(s)).toBe(null);
  });

  it('ignores junk and saves from a newer build', () => {
    const s = memoryStorage();
    s.setItem(SAVE_KEY, '{not json');
    expect(readSave(s)).toBe(null);
    s.setItem(SAVE_KEY, JSON.stringify(save({ version: SAVE_VERSION + 1 })));
    expect(readSave(s)).toBe(null);
    expect(validSave(save({ day: 0 }))).toBe(false);
    expect(validSave({ version: 1, day: 2 })).toBe(false);
  });

  it('copes with no storage and a browser that refuses', () => {
    expect(readSave(null)).toBe(null);
    expect(writeSave(null, save())).toBe(false);
    const full = { ...memoryStorage(), setItem: () => { throw new Error('full'); } };
    expect(writeSave(full, save())).toBe(false);
  });

  it('a load with a save is the next day on the same farm', () => {
    const s = memoryStorage();
    writeSave(s, save());
    expect(openFarm({ search: '', storage: s })).toMatchObject({ continuing: true, seeded: false, day: 4, farmSeed: 1234 });
    expect(continueInfo({ search: '', storage: s })).toEqual({ day: 4 });
  });

  it('a load without one is a new farm, day 1, on its own seed', () => {
    expect(openFarm({ search: '', storage: memoryStorage() })).toMatchObject({ continuing: false, seeded: false, day: 1, farmSeed: null });
    expect(continueInfo({ search: '', storage: memoryStorage() })).toBe(null);
  });

  it('?seed= ignores the save altogether', () => {
    const s = memoryStorage();
    writeSave(s, save());
    expect(openFarm({ search: '?seed=42', storage: s })).toMatchObject({ seeded: true, continuing: false, save: null, day: 1 });
    expect(continueInfo({ search: '?seed=42', storage: s })).toBe(null);
  });

  it('keeps the saved fleet in its order, and deals again if a vehicle has gone from the game', () => {
    const specs = [{ id: 'red' }, { id: 'blue' }, { id: 'tractor' }];
    expect(fleetFromSave(['tractor', 'red'], specs).map((s) => s.id)).toEqual(['tractor', 'red']);
    expect(fleetFromSave(['red', 'hovercraft'], specs)).toBe(null);
    expect(fleetFromSave(undefined, specs)).toBe(null);
  });

  it('says what it is doing', () => {
    expect(describeFarm({ day: 1, seeded: true })).toMatch(/seeded/);
    expect(describeFarm({ day: 4, started: false })).toMatch(/day 4.*start playing/);
    expect(describeFarm({ day: 4, started: true, savedAgo: 12.4 })).toBe('day 4, saved 12 s ago');
    expect(describeFarm({ day: 4, started: true, wiped: true })).toMatch(/new farm/);
  });
});

describe('a vehicle from one day to the next', () => {
  it('keeps its condition', () => {
    const a = unit();
    a.engine.params.baseRoughness = 0.07;
    a.engine.wear = 0.4;
    a.engine.scuff = 0.2;
    a.engine.battery = 0.6;
    a.engine.coolantLeak = 1.5;
    a.quad.usage.hours = 130.5;
    a.quad.fuel.setLitres(2.5);
    a.quad.fuel.water = 0.03;
    a.quad.fuel.tap = 'off';
    a.quad.faults.leave('belt', 0.4);
    a.quad.faults.leave('chain', 0.7);
    a.quad.faults.kept.chainLube = 0.2;
    a.quad.faults.kept.chainOff = true;
    a.quad.faults.leave('puncture', 0.2, 0.28);
    a.quad.tyres.psi = [3, 3.5, 4, 5];
    a.quad.sump.level = 0.55;
    a.quad.filter.clog = 0.3;
    a.quad.quirks.tapStiff = 0.2;
    const data = JSON.parse(JSON.stringify(captureVehicle(a, { settings: { idle: 1500 } })));

    const b = unit();
    restoreVehicle(b, data);
    expect(b.engine.params.baseRoughness).toBe(0.07);
    expect(b.engine.wear).toBe(0.4);
    expect(b.engine.scuff).toBe(0.2);
    expect(b.engine.battery).toBe(0.6);
    expect(b.engine.coolantLeak).toBe(1.5);
    expect(b.quad.usage.hours).toBe(130.5);
    expect(b.quad.fuel.litres).toBe(2.5);
    expect(b.quad.fuel.water).toBe(0.03);
    expect(b.quad.fuel.bowlWater).toBe(0.03);
    expect(b.quad.fuel.tap).toBe('off');
    expect(b.quad.faults.has('belt')).toBe(true);
    expect(b.quad.faults.levels.belt).toBe(0.4);
    expect(b.quad.faults.levels.chain).toBe(0.7);
    expect(b.quad.faults.kept).toEqual({ chainLube: 0.2, chainOff: true, valveTight: false });
    expect(b.quad.faults.caps.puncture).toBe(0.28);
    expect(b.quad.faults.tyre).toBe(a.quad.faults.tyre);
    expect(b.quad.faults.has('carb')).toBe(false);
    expect(b.quad.tyres.psi).toEqual([3, 3.5, 4, 5]);
    expect(b.quad.sump.level).toBe(0.55);
    expect(b.engine.clog).toBe(0.3);
    expect(b.quad.filter.clog).toBe(0.3);
    expect(b.quad.quirks.tapStiff).toBe(0.2);
    expect(data.settings).toEqual({ idle: 1500 });
    expect(data.idle).toBe(1450);
  });

  it('a fault put right stays put right', () => {
    const a = unit();
    const b = unit();
    b.quad.faults.leave('carb', 0.5); // dealt this morning
    restoreVehicle(b, captureVehicle(a));
    expect(b.quad.faults.has('carb')).toBe(false);
    expect(b.quad.faults.levels.carb).toBe(0);
  });

  it('lists its faults for what the girls know', () => {
    const a = unit();
    a.quad.faults.leave('cable', 0.35);
    expect(savedFaults(captureVehicle(a))).toEqual([{ kind: 'cable', level: 0.35 }]);
  });

  it('leaves what an older save lacks as it was dealt', () => {
    const b = unit();
    b.engine.wear = 0.25;
    restoreVehicle(b, { hours: 99, engine: { battery: 'flat' } });
    expect(b.quad.usage.hours).toBe(99);
    expect(b.engine.wear).toBe(0.25);
    expect(b.engine.battery).toBe(1);
  });

  it('overnight: a little battery gone, all of it with the key left on, and half the mud dried off', () => {
    const a = unit();
    a.engine.battery = 0.8;
    a.mud.state.body = 0.6;
    a.mud.state.wheels = 1;
    const off = overnight(captureVehicle(a), P);
    expect(off.engine.battery).toBeCloseTo(0.8 - P.overnightDrain);
    expect(off.mud).toEqual({ body: 0.6 * P.mudKept, wheels: P.mudKept });
    a.engine.setIgnition(true);
    const on = captureVehicle(a);
    expect(on.keyOn).toBe(true);
    expect(overnight(on, P).engine.battery).toBe(P.flatOvernight);
    expect(on.engine.battery).toBe(0.8); // the saved copy is left alone
  });
});

describe('the girls from one day to the next', () => {
  it('keep half their favour and all you taught them', () => {
    const a = girls();
    a.favour.scores.amy = 10;
    a.favour.scores.jess = -4;
    a.skills.levels.jess.choke = 0.9;
    const b = girls();
    restoreGirls(b, JSON.parse(JSON.stringify(captureGirls(a))), P);
    expect(b.favour.scores.amy).toBe(10 * P.favourKept);
    expect(b.favour.scores.jess).toBe(-4 * P.favourKept);
    expect(b.skills.levels.jess.choke).toBe(0.9);
  });

  it('a falling-out not made up leaves them cool in the morning; ordinary friction carries at half', () => {
    const a = girls();
    a.fallingOut.begin('race', 'jess');
    const b = girls();
    restoreGirls(b, captureGirls(a), P);
    expect(b.fallingOut.active).toBe(false);
    expect(b.fallingOut.friction).toBe(P.frictionFallenOut);
    const c = girls();
    c.fallingOut.friction = 4;
    const d = girls();
    restoreGirls(d, captureGirls(c), P);
    expect(d.fallingOut.friction).toBe(4 * P.frictionKept);
  });

  it('romance carries once she is locked in, trips round the back do not, and a betrayal lasts into the morning', () => {
    const a = girls();
    a.romance.girls.amy.locked = true;
    a.romance.girls.jess.visits = 1;
    const b = girls();
    restoreGirls(b, captureGirls(a), P);
    expect(b.romance.lockedGirl).toBe('amy');
    expect(b.favour.scores.amy).toBe(b.romance.p.lockScore);
    expect('amy' in b.favour.locked).toBe(true);
    expect(b.romance.girls.jess.visits).toBe(0);

    const c = girls();
    c.romance.girls.amy.locked = true;
    c.romance.betray('amy');
    const d = girls();
    restoreGirls(d, captureGirls(c), P);
    expect(d.romance.lockedGirl).toBe(null);
    expect(d.romance.girls.amy.nextInvite).toBe(d.romance.p.betrayedCooldown);
    const e = girls();
    restoreGirls(e, captureGirls(d), P); // the day after that it's forgotten
    expect(e.romance.girls.amy.nextInvite).toBe(0);
  });
});

describe('what else the farm keeps', () => {
  it('the records keep their bests and mark those set today', () => {
    const a = new Records(2);
    a.submit('climb', 'jess', 50, 'red');
    const b = new Records(3);
    b.restore(JSON.parse(JSON.stringify(a.toJSON())));
    expect(b.best('climb')).toMatchObject({ who: 'jess', value: 50, day: 2 });
    expect(b.bestOn('climb', 'red').value).toBe(50);
    expect(b.lines().find((l) => l.kind === 'climb').today).toBe(false);
    b.submit('climb', 'you', 44, 'red');
    const line = b.lines().find((l) => l.kind === 'climb');
    expect(line.today).toBe(true);
    expect(line.text).toMatch(/\(today\)/);
    expect(new Records(1).lines().every((l) => !l.today)).toBe(true);
  });

  it('the records ignore junk', () => {
    const r = new Records(2);
    r.restore({ bests: { climb: { who: 'you', value: -3 }, warp: { who: 'you', value: 3 } } });
    expect(r.best('climb')).toBe(null);
    expect(r.bests.warp).toBeUndefined();
  });

  it('the logbook keeps its page, by day', () => {
    const a = new Logbook();
    a.day = 2;
    a.write({ quad: 'Red', what: { kind: 'oil' } });
    const b = new Logbook();
    b.day = 3;
    b.restore(JSON.parse(JSON.stringify(a.toJSON())));
    b.write({ quad: 'Blue', what: { kind: 'oil' } });
    expect(b.lines()[0]).toMatch(/^Yesterday {2}Red/);
    expect(b.lines()[1]).toMatch(/^0:00 {2}Blue/);
    b.day = 5;
    expect(b.lines()[0]).toMatch(/^Day 2 {2}Red/);
    expect(formatWhen({ day: 0, time: -1 }, 2)).toBe('Before');
    expect(formatWhen({ day: 0, time: -1 }, 1)).toBe('Yesterday');
  });

  it('the logbook keeps no more than its page holds', () => {
    const b = new Logbook({ ...new Logbook().params, maxEntries: 3 });
    b.restore([1, 2, 3, 4, 5].map((i) => ({ time: i, quad: 'Red', text: `t${i}`, day: 1 })));
    expect(b.entries.map((e) => e.text)).toEqual(['t3', 't4', 't5']);
  });

  it('the bucket list keeps its ticks, quietly', () => {
    const a = new Achievements({ fleet: ['red'] });
    const id = ACHIEVEMENTS[0].id;
    a.unlocked.set(id, 12);
    const b = new Achievements({ fleet: ['red'] });
    let heard = 0;
    b.onUnlock(() => heard++);
    b.restore([...a.toJSON(), 'not-a-thing']);
    expect(b.unlocked.has(id)).toBe(true);
    expect(b.unlocked.has('not-a-thing')).toBe(false);
    expect(heard).toBe(0);
  });

  it('the barn find keeps its progress', () => {
    const a = new BarnFind({ jobs: ['plug', 'battery'] });
    a.finish('tarp');
    a.finish('plug');
    a.finish('battery');
    a.update(100);
    const b = new BarnFind({ jobs: ['plug', 'battery'] });
    b.restore(JSON.parse(JSON.stringify(a.toJSON())));
    expect(b.tarpOff).toBe(true);
    expect(b.isDone('plug')).toBe(true);
    expect(b.charging).toBe(true);
    expect(b.charge).toBe(100);
    expect(b.startBlocked).toBe(a.startBlocked);
    const c = new BarnFind({ jobs: ['brake'] });
    c.restore({ finished: ['plug', 'brake'] });
    expect([...c.finished]).toEqual(['brake']);
  });
});
