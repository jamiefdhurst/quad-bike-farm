import { describe, it, expect } from 'vitest';
import { CarGo, Borrowing, mayDriveCar, DEFAULT_CAR_GO_PARAMS } from '../src/npc/carGo.js';
import { FINCH_SPEC, GRIFFIN_SPEC, TOR_SPEC } from '../src/vehicle/quadSpecs.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';

const girls = (over = {}) => ({
  amy: { free: true, car: 'finch', carFree: true, weight: 0.8, ...over.amy },
  jess: { free: true, car: 'griffin', carFree: true, weight: 1.3, ...over.jess },
});

describe('a go in her own car', () => {
  it('is an offer the chooser knows', () => {
    expect(OFFER_KINDS.carGo).toBeTruthy();
  });

  it('waits until a while into the game, then offers each girl her own car', () => {
    const g = new CarGo({ ...DEFAULT_CAR_GO_PARAMS });
    expect(g.offers({ girls: girls() })).toEqual([]);
    g.update(DEFAULT_CAR_GO_PARAMS.firstAfter + 1);
    const offers = g.offers({ girls: girls() });
    expect(offers.map((o) => [o.girl, o.vehicle])).toEqual([['amy', 'finch'], ['jess', 'griffin']]);
  });

  it("never offers a car that isn't free, or a girl who isn't", () => {
    const g = new CarGo();
    g.update(9999);
    expect(g.offers({ girls: girls({ amy: { carFree: false }, jess: { free: false } }) })).toEqual([]);
  });

  it('leaves a girl a while between her goes, but not her friend', () => {
    const g = new CarGo();
    g.update(9999);
    g.started('jess');
    g.update(10);
    expect(g.offers({ girls: girls() }).map((o) => o.girl)).toEqual(['amy']);
    g.update(DEFAULT_CAR_GO_PARAMS.every);
    expect(g.offers({ girls: girls() }).map((o) => o.girl)).toEqual(['amy', 'jess']);
  });

  it('can be forced from the debug panel at any time, and the force is used up once taken', () => {
    const g = new CarGo();
    g.forced = 'amy';
    const [o] = g.offers({ girls: girls() });
    expect(o.girl).toBe('amy');
    expect(g.take(o)).toEqual({ type: 'carGo', girl: 'amy', vehicle: 'finch' });
    expect(g.forced).toBe(null);
  });

  it('has Jess drive harder and faster than Amy', () => {
    const g = new CarGo();
    expect(g.driveFor('jess').speedMax).toBeGreaterThan(g.driveFor('amy').speedMax);
    expect(g.driveFor('jess').maxThrottle).toBeGreaterThan(g.driveFor('amy').maxThrottle);
  });

  it('lets each girl drive only her own car, and any other vehicle as before', () => {
    expect(mayDriveCar('amy', FINCH_SPEC)).toBe(true);
    expect(mayDriveCar('jess', FINCH_SPEC)).toBe(false);
    expect(mayDriveCar('jess', GRIFFIN_SPEC)).toBe(true);
    expect(mayDriveCar('amy', GRIFFIN_SPEC)).toBe(false);
    expect(mayDriveCar('amy', TOR_SPEC)).toBe(true);
  });
});

describe('borrowing her car', () => {
  const at = (o) => ({ driving: false, herIn: false, sees: false, faults: 0, bogged: false, ...o });

  it('minds once when she sees you take it without her, and says so when you bring it back', () => {
    const b = new Borrowing();
    expect(b.update(at({ driving: true }))).toEqual([]);
    const taken = b.update(at({ driving: true, sees: true }));
    expect(taken).toEqual([{ type: 'taken', favour: DEFAULT_CAR_GO_PARAMS.favourTaken }]);
    expect(b.update(at({ driving: true, sees: true }))).toEqual([]); // once a go
    expect(b.update(at({ sees: true }))).toEqual([{ type: 'back', damaged: false, favour: 0 }]);
  });

  it('minds more when it comes back with a new fault or stuck in a bog', () => {
    const b = new Borrowing();
    b.update(at({ driving: true, sees: true }));
    expect(b.update(at({ sees: true, faults: 1 }))).toEqual([{ type: 'back', damaged: true, favour: DEFAULT_CAR_GO_PARAMS.favourDamaged }]);
    b.update(at({ driving: true, sees: true }));
    expect(b.update(at({ sees: true, bogged: true }))[0].damaged).toBe(true);
  });

  it("doesn't mind when she's in it with you, and likes being taken along", () => {
    const b = new Borrowing();
    expect(b.update(at({ driving: true, herIn: true, sees: true }))).toEqual([{ type: 'ridden', favour: DEFAULT_CAR_GO_PARAMS.favourRidden }]);
    expect(b.update(at({ herIn: true, sees: true }))).toEqual([]);
  });

  it("knows nothing about it if she never sees it go or come back", () => {
    const b = new Borrowing();
    b.update(at({ driving: true }));
    expect(b.update(at({}))).toEqual([]);
  });
});

describe('asking a girl to drive a car that is not hers', () => {
  it('gets "it is yours" for your car and "that is hers" for her friend\'s, and nothing for her own', async () => {
    const { refuseCarLine } = await import('../src/npc/carGo.js');
    const { FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC } = await import('../src/vehicle/quadSpecs.js');
    expect(refuseCarLine('amy', VAUCLAIR_SPEC)).toBe('carYours');
    expect(refuseCarLine('jess', VAUCLAIR_SPEC)).toBe('carYours');
    expect(refuseCarLine('amy', GRIFFIN_SPEC)).toBe('carNotMine');
    expect(refuseCarLine('amy', FINCH_SPEC)).toBeNull();
  });
});
