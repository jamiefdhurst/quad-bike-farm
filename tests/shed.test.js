import { describe, it, expect } from 'vitest';
import { Shed, SHED_PIECES, SHED_PIECE_IDS, DEFAULT_SHED_PARAMS, inHoseReach } from '../src/farm/shed.js';
import { LAYOUT } from '../src/world/layout.js';
import { barnShape } from '../src/world/barn.js';
import { captureVehicle, restoreVehicle } from '../src/farm/farmState.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { Faults } from '../src/vehicle/faults.js';
import { FuelSystem } from '../src/vehicle/fuelSystem.js';
import { Sump } from '../src/vehicle/sump.js';
import { TyreSet, newTyres } from '../src/vehicle/tyres.js';
import { AirFilter } from '../src/vehicle/airFilter.js';
import { QuirkSet } from '../src/vehicle/quirks.js';
import { SHED_KINDS } from '../src/vehicle/shedFaults.js';

const tin = (purse) => ({ purse, today: { earned: 0, spent: 0, sold: 0 } });

describe('the shed kit', () => {
  it('has the three pieces, with prices', () => {
    expect(SHED_PIECE_IDS).toEqual(['compressor', 'washer', 'pit']);
    const s = new Shed();
    expect(s.price('compressor')).toBe(120);
    expect(s.price('washer')).toBe(200);
    expect(s.price('pit')).toBe(450);
    for (const id of SHED_PIECE_IDS) expect(SHED_PIECES[id].blurb.length).toBeGreaterThan(20);
  });

  it('is bought from the tin and turns up the next morning', () => {
    const s = new Shed();
    const m = tin(500);
    expect(s.buy('washer', m, 3)).toEqual({ piece: 'washer', boughtDay: 3 });
    expect(m.purse).toBe(300);
    expect(m.today.spent).toBe(200);
    expect(s.has('washer', 3)).toBe(false);
    expect(s.onTheWay('washer', 3)).toBe(true);
    expect(s.has('washer', 4)).toBe(true);
    expect(s.onTheWay('washer', 4)).toBe(false);
    expect(s.arrivals(4)).toEqual(['washer']);
    expect(s.arrivals(5)).toEqual([]);
  });

  it('can be bought in any order, but only once each and only with the money', () => {
    const s = new Shed();
    const m = tin(130);
    expect(s.whyNot('pit', m.purse)).toBe('You are £320 short');
    expect(s.buy('pit', m, 1)).toBeNull();
    expect(m.purse).toBe(130);
    expect(s.buy('compressor', m, 1)).not.toBeNull();
    expect(s.whyNot('compressor', m.purse)).toBe('You have this already');
    expect(s.buy('compressor', m, 1)).toBeNull();
    expect(s.whyNot('nonsense', 1e6)).toMatch(/no such/);
  });

  it('is kept in the save, and an odd save is ignored', () => {
    const s = new Shed();
    s.buy('pit', tin(1000), 2);
    s.give('compressor');
    const copy = new Shed();
    copy.restore(JSON.parse(JSON.stringify(s.toJSON())));
    expect(copy.has('pit', 3)).toBe(true);
    expect(copy.has('compressor', 1)).toBe(true); // handed over: no day, so already standing
    const odd = new Shed();
    odd.restore({ bought: [{ piece: 'rocket', boughtDay: 1 }, { piece: 'washer', boughtDay: 'x' }, null] });
    expect(odd.bought).toEqual([]);
    odd.restore(null);
    odd.restore({});
    expect(odd.bought).toEqual([]);
  });

  it('lets the debug panel hand a piece over and take it back', () => {
    const s = new Shed();
    expect(s.give('pit')).toBe(true);
    expect(s.has('pit', 1)).toBe(true);
    s.take('pit');
    expect(s.ordered('pit')).toBe(false);
    expect(s.give('rocket')).toBe(false);
  });

  it('puts the compressor within reach of the barn bays only', () => {
    const c = LAYOUT.shed.compressor;
    for (const bay of [LAYOUT.bay, LAYOUT.bay2]) expect(inHoseReach(c, bay.x, bay.z, DEFAULT_SHED_PARAMS.hoseReach)).toBe(true);
    expect(inHoseReach(c, LAYOUT.yard.x, LAYOUT.yard.z, DEFAULT_SHED_PARAMS.hoseReach)).toBe(false);
  });
});

describe('where the kit stands', () => {
  const shape = barnShape(LAYOUT);
  const inside = (x, z, m = 0) => x > shape.innerAll.minX + m && x < shape.innerAll.maxX - m && z > shape.innerAll.minZ + m && z < shape.innerAll.maxZ - m;
  const rect = (x, z, hx, hz) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
  const overlap = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

  it('keeps every piece inside the barn', () => {
    const { compressor, washer, pit } = LAYOUT.shed;
    expect(inside(compressor.x, compressor.z, 0.3)).toBe(true);
    expect(inside(washer.x, washer.z, 0.3)).toBe(true);
    expect(inside(pit.x - pit.halfX, pit.z - pit.halfZ)).toBe(true);
    expect(inside(pit.x + pit.halfX, pit.z + pit.halfZ)).toBe(true);
  });

  it('keeps the pit in the big bay and clear of the jack and stands', () => {
    const { pit } = LAYOUT.shed;
    const bay = LAYOUT.bay2;
    expect(pit.x - pit.halfX).toBeGreaterThan(bay.x - bay.halfX);
    expect(pit.x + pit.halfX).toBeLessThan(bay.x + bay.halfX);
    expect(Math.abs(pit.z - bay.z)).toBeLessThan(0.5);
    const hole = rect(pit.x, pit.z, pit.halfX + 0.1, pit.halfZ + 0.1);
    for (const o of [LAYOUT.jack, ...LAYOUT.axleStands]) expect(overlap(hole, rect(o.x, o.z, 0.4, 0.4))).toBe(false);
  });

  it('does not stand a piece in a bay, on the barn find, on the bales or in the doorway', () => {
    const { compressor, washer } = LAYOUT.shed;
    const pieces = { compressor: rect(compressor.x, compressor.z, 0.3, 0.5), washer: rect(washer.x, washer.z, 0.5, 0.35) };
    const obstacles = [
      rect(LAYOUT.bay.x, LAYOUT.bay.z, LAYOUT.bay.halfX, LAYOUT.bay.halfZ),
      rect(LAYOUT.rusty.x, LAYOUT.rusty.z, 1.1, 0.7),
      ...LAYOUT.barnBaleSpots.map(([x, z]) => rect(x, z, 0.5, 0.5)),
      rect(LAYOUT.bench.x, LAYOUT.bench.z, LAYOUT.bench.length / 2 - 0.05, LAYOUT.bench.depth / 2 - 0.05),
      rect(shape.inner.maxX - 0.4, LAYOUT.barn.z, 0.4, LAYOUT.barn.door.halfWidth),
    ];
    for (const [id, r] of Object.entries(pieces)) for (const o of obstacles) expect(overlap(r, o), id).toBe(false);
  });
});

describe('the shed faults in the farm save', () => {
  const unit = () => ({
    dealtIdle: 1450,
    engine: new EngineModel({ strokes: 4 }),
    quad: {
      usage: { hours: 1, odoMiles: 1 },
      faults: new Faults(),
      fuel: new FuelSystem({ tankCapacity: 10, bowlCapacity: 0.1, startLitres: 6, reserveLitres: 1, startOil: 0 }),
      sump: new Sump({ level: 0.8 }),
      tyres: new TyreSet(newTyres(4)),
      filter: new AirFilter(),
      quirks: new QuirkSet([]),
    },
    mud: { state: { body: 0, wheels: 0, wet: 0, washed: 0 } },
  });

  it('are kept with their levels and wheels, so they are still there tomorrow', () => {
    const a = unit();
    for (const k of SHED_KINDS) a.quad.faults.leave(k, 0.4);
    const data = JSON.parse(JSON.stringify(captureVehicle(a)));
    const b = unit();
    restoreVehicle(b, data);
    for (const k of SHED_KINDS) {
      expect(b.quad.faults.has(k), k).toBe(true);
      expect(b.quad.faults.levels[k], k).toBe(0.4);
    }
    expect(b.quad.faults.wheelOf).toEqual(a.quad.faults.wheelOf);
    expect(b.quad.faults.wheelOf.bearing).toBeGreaterThanOrEqual(0);
  });

  it('load from an older save that has none of them', () => {
    const a = unit();
    const data = JSON.parse(JSON.stringify(captureVehicle(a)));
    for (const k of ['levels', 'started', 'caps']) for (const s of SHED_KINDS) delete data.faults[k][s];
    delete data.faults.wheelOf;
    const b = unit();
    restoreVehicle(b, data);
    for (const k of SHED_KINDS) expect(b.quad.faults.has(k)).toBe(false);
  });
});

describe('the toolbox pump', () => {
  const c = LAYOUT.shed.compressor;
  const bay = LAYOUT.bay;
  it('is gone until there is a compressor in the barn, and says where to get one', async () => {
    const { pressureWhyNot } = await import('../src/farm/shed.js');
    const s = new Shed();
    expect(pressureWhyNot(s, 1, c, bay.x, bay.z)).toMatch(/catalogue/);
    s.buy('compressor', { purse: 500, today: { spent: 0 } }, 1);
    expect(pressureWhyNot(s, 1, c, bay.x, bay.z)).toMatch(/tomorrow/);
    expect(pressureWhyNot(s, 2, c, bay.x, bay.z)).toBeNull();
  });
  it('only reaches as far as the hose', async () => {
    const { pressureWhyNot } = await import('../src/farm/shed.js');
    const s = new Shed();
    s.give('compressor');
    expect(pressureWhyNot(s, 2, c, LAYOUT.yard.x, LAYOUT.yard.z)).toMatch(/hose/);
    expect(pressureWhyNot(s, 2, c, LAYOUT.bay2.x, LAYOUT.bay2.z)).toBeNull();
  });
});
