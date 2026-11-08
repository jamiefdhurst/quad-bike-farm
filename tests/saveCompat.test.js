// Old saves keep loading (#219, was TODO 328): a fixture save from each SAVE_VERSION in tests/fixtures/saves/, loaded into today's code
// without losing anything. Raising SAVE_VERSION fails the first test until the new version's fixture (a real save, copied with `save copy`) is added.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { SAVE_KEY, SAVE_VERSION, readSave, openFarm, validSave, fleetFromSave } from '../src/farm/farmSave.js';
import { captureVehicle, restoreVehicle, overnight, captureGirls, restoreGirls } from '../src/farm/farmState.js';
import { MotWear } from '../src/farm/mot.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { Faults } from '../src/vehicle/faults.js';
import { FuelSystem } from '../src/vehicle/fuelSystem.js';
import { Sump } from '../src/vehicle/sump.js';
import { TyreSet, newTyres } from '../src/vehicle/tyres.js';
import { AirFilter } from '../src/vehicle/airFilter.js';
import { QuirkSet } from '../src/vehicle/quirks.js';
import { Favour } from '../src/npc/favour.js';
import { QuadCare } from '../src/npc/quadCare.js';
import { FallingOut } from '../src/npc/fallingOut.js';
import { Skills } from '../src/npc/skills.js';
import { Romance } from '../src/npc/romance.js';
import { Lessons } from '../src/npc/lessons.js';
import { Achievements } from '../src/achievements/achievements.js';
import { Discoveries } from '../src/achievements/discoveries.js';
import { Records } from '../src/world/records.js';
import { Challenges } from '../src/world/challenges.js';
import { Shed } from '../src/farm/shed.js';
import { Market } from '../src/farm/classifieds.js';
import { Spares } from '../src/workshop/spares.js';
import { Generator } from '../src/items/generator.js';
import { LostThings } from '../src/items/lostThings.js';
import { Logbook } from '../src/workshop/logbook.js';
import { PhotoWall } from '../src/photos/photos.js';
import { ShowKeeper } from '../src/farm/showDay.js';
import { RoadLog } from '../src/farm/rollingRoad.js';
import { MotLog } from '../src/farm/mot.js';

const DIR = new URL('./fixtures/saves/', import.meta.url);
const fixtures = readdirSync(DIR)
  .filter((f) => /^v\d+\.json$/.test(f))
  .map((f) => ({ version: Number(f.slice(1, -5)), save: JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) }));

/** A stand-in for localStorage holding one save. */
function storageWith(save) {
  return { getItem: (k) => (k === SAVE_KEY ? JSON.stringify(save) : null), setItem() {}, removeItem() {} };
}

function unit() {
  return {
    dealtIdle: 1450,
    engine: new EngineModel({ strokes: 2 }),
    quad: {
      usage: { hours: 0, odoMiles: 0 },
      faults: new Faults(),
      fuel: new FuelSystem({ tankCapacity: 10, bowlCapacity: 0.1, startLitres: 1, reserveLitres: 1, startOil: 0 }),
      sump: new Sump({ level: 0.5 }),
      tyres: new TyreSet(newTyres(4)),
      filter: new AirFilter(),
      quirks: new QuirkSet([]),
      motWear: new MotWear(),
    },
    mud: { state: { body: 0, wheels: 0, wet: 0, washed: 0 } },
  };
}

/** The top-level keys game.js's captureFarm writes, read from the source so a new one can't be added without a fixture to show it. */
function capturedKeys() {
  const src = readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('  captureFarm() {'));
  const ret = body.slice(body.indexOf('    return {'), body.indexOf('\n    };'));
  return [...ret.matchAll(/^ {6}(\w+):/gm)].map((m) => m[1]);
}

describe('old saves keep loading', () => {
  it('has a fixture for every save version, and the oldest is 1', () => {
    expect(fixtures.map((f) => f.version).sort((a, b) => a - b)).toEqual(Array.from({ length: SAVE_VERSION }, (_, i) => i + 1));
    for (const f of fixtures) expect(f.save.version).toBe(f.version);
  });

  for (const { version, save } of fixtures) {
    describe(`a version ${version} save`, () => {
      it('is accepted and continues on the day after', () => {
        expect(validSave(save)).toBe(true);
        expect(readSave(storageWith(save))).toEqual(save);
        const farm = openFarm({ storage: storageWith(save) });
        expect(farm).toMatchObject({ continuing: true, day: save.day + 1, farmSeed: save.farmSeed });
      });

      it('has every key the game saves today (so the fixture is a whole save)', () => {
        for (const key of capturedKeys()) expect(save, `${key} is missing from the fixture`).toHaveProperty(key);
      });

      it('still deals the saved fleet', () => {
        const specs = save.fleet.map((id) => ({ id }));
        expect(fleetFromSave(save.fleet, specs)?.map((s) => s.id)).toEqual(save.fleet);
      });

      it('keeps what each vehicle kept', () => {
        for (const saved of Object.values(save.vehicles)) {
          const u = unit();
          restoreVehicle(u, overnight(saved));
          const back = captureVehicle(u, {});
          expect(back.hours).toBe(saved.hours);
          expect(back.odo).toBe(saved.odo);
          expect(back.fuel.litres).toBe(saved.fuel.litres);
          expect(back.faults).toEqual(saved.faults);
          expect(back.tyres).toEqual(saved.tyres);
          expect(back.engine.wear).toBe(saved.engine.wear);
        }
      });

      it('keeps what the girls kept', () => {
        const ids = ['amy', 'jess'];
        const host = { favour: new Favour(ids), fallingOut: new FallingOut(ids), skills: new Skills(ids), romance: new Romance(ids), lessons: new Lessons(), quadCare: new QuadCare(ids) };
        restoreGirls(host, save.girls, { favourKept: 1, memoryKept: 1, frictionKept: 1, frictionFallenOut: 6 });
        const back = captureGirls(host);
        expect(back.favour).toEqual(save.girls.favour);
        expect(back.skills).toEqual(save.girls.skills);
        expect(back.romance).toEqual(save.girls.romance);
      });

      it('keeps the lists, records and stock', () => {
        const ach = new Achievements();
        ach.restore(save.bucket);
        expect(ach.toJSON()).toEqual(save.bucket);

        const disc = new Discoveries();
        disc.restore(save.learnt);
        expect(disc.toJSON()).toEqual(save.learnt);

        const rec = new Records();
        rec.restore(save.records);
        expect(rec.toJSON()).toEqual(save.records);

        const ch = new Challenges();
        ch.restore(save.challenges);
        expect(ch.toJSON()).toEqual(save.challenges);

        const shed = new Shed();
        shed.restore(save.shed);
        expect(shed.toJSON()).toEqual(save.shed);

        const market = new Market();
        market.restore(save.market);
        expect(market.toJSON()).toEqual(save.market);

        const spares = new Spares();
        spares.restore(save.spares);
        for (const [kind, n] of Object.entries(save.spares.counts)) expect(spares.count(kind)).toBe(n);
        expect(spares.toJSON().ordered).toMatchObject(save.spares.ordered);

        const gen = new Generator();
        gen.restore(save.generator);
        expect(gen.toJSON()).toEqual(save.generator);

        const lost = new LostThings();
        lost.restore(save.lostThings);
        expect(lost.toJSON()).toEqual(save.lostThings);

        const book = new Logbook();
        book.restore(save.logbook);
        expect(book.toJSON().map((e) => e.text)).toEqual(save.logbook.map((e) => e.text));

        const shows = new ShowKeeper();
        shows.restore(save.shows);
        expect(shows.toJSON()).toEqual(save.shows);

        const road = new RoadLog();
        road.restore(save.road);
        expect(road.toJSON()).toEqual(save.road);

        const mot = new MotLog();
        mot.restore(save.mot);
        expect(mot.toJSON()).toMatchObject({ last: save.mot.last, certificate: save.mot.certificate });

        const wall = new PhotoWall();
        wall.restore(save.photos);
        expect(wall.toJSON()).toMatchObject(save.photos);
      });
    });
  }
});
