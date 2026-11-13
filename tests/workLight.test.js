import { describe, it, expect } from 'vitest';
import { WorkLight, DEFAULT_WORK_LIGHT_PARAMS as P, lightSpot, pickVehicle } from '../src/npc/workLight.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';
import { CHARACTERS } from '../src/npc/characters.js';

const vehicles = [
  { id: 'farm300', x: 10, z: 0, cab: false, lights: true, free: true },
  { id: 'landy', x: 30, z: 0, cab: true, lights: true, free: true },
  { id: 'adder', x: 2, z: 0, cab: false, lights: false, free: true },
];
const girls = [
  { id: 'amy', x: 5, z: 5, free: true, weight: 1.2 },
  { id: 'jess', x: 5, z: -5, free: true, weight: 0 },
];
const ctx = (o = {}) => ({ dark: 1, you: { x: 0, z: 0, onFoot: true }, workAt: { x: 0.5, z: 0 }, girls, vehicles, ...o });

describe('Lights to work by', () => {
  it('stops a few metres off on the side it comes from, facing you', () => {
    const s = lightSpot({ x: 0, z: 0 }, { x: 20, z: 0 });
    expect(s.x).toBeCloseTo(P.stand);
    expect(s.z).toBeCloseTo(0);
    expect(s.yaw).toBeCloseTo(-Math.PI / 2); // facing -x, back at you
  });

  it('brings a cab before a quad, never one without lights or with someone on it', () => {
    expect(pickVehicle({ x: 0, z: 0 }, vehicles).id).toBe('landy');
    expect(pickVehicle({ x: 0, z: 0 }, vehicles.filter((v) => !v.cab)).id).toBe('farm300');
    expect(pickVehicle({ x: 0, z: 0 }, [{ ...vehicles[0], free: false }, vehicles[2]])).toBeNull();
    expect(pickVehicle({ x: 0, z: 0 }, [{ ...vehicles[1], x: P.vehicleRange + 50 }])).toBeNull();
  });

  it('has Amy offer once you have been at something in the dark a while, not Jess, and not by day', () => {
    const w = new WorkLight();
    w.update(1, ctx());
    expect(w.offers(ctx())).toEqual([]); // not long enough yet
    w.update(P.workFor + 1, ctx());
    const out = w.offers(ctx());
    expect(out.map((o) => `${o.girl}:${o.key}`)).toEqual(['amy:workLight']);
    expect(OFFER_KINDS.workLight).toBeTruthy();
    expect(w.offers(ctx({ dark: 0.2 }))).toEqual([]);
    expect(CHARACTERS.find((c) => c.id === 'amy').params.workLightWeight).toBeGreaterThan(0);
  });

  it('forgets what you were at when you ride off or move on to something else', () => {
    const w = new WorkLight();
    w.update(P.workFor + 1, ctx());
    w.update(1, ctx({ workAt: { x: 20, z: 20 } }));
    expect(w.offers(ctx({ workAt: { x: 20, z: 20 } }))).toEqual([]);
  });

  it('never starts on its own: that is the chooser\'s, or yours from her wheel', () => {
    const w = new WorkLight();
    expect(w.update(P.workFor + 10, ctx())).toEqual([]);
    expect(w.active).toBe(false);
  });

  it('when you ask, lights where you stand, or says why not', () => {
    const w = new WorkLight();
    const plan = w.ask(girls[0], ctx({ workAt: null }));
    expect(plan.vehicle).toBe('landy');
    expect(plan.target).toEqual({ x: 0, z: 0 });
    expect(w.ask(girls[0], ctx({ dark: 0 })).why).toMatch(/light enough/);
    expect(w.ask(girls[0], ctx({ vehicles: [] })).why).toMatch(/nothing/);
  });

  it('moves over to the passenger side most of the time, and otherwise stands by it', () => {
    let r = 0.1;
    const w = new WorkLight({ ...P }, () => r);
    expect(w.take({ girl: 'amy', vehicle: 'landy', cab: true, spot: { x: 6, z: 0, yaw: 0 }, target: { x: 0, z: 0 } }).passenger).toBe(true);
    w.finish('asked');
    r = 0.9;
    expect(w.take({ girl: 'amy', vehicle: 'landy', cab: true, spot: { x: 6, z: 0, yaw: 0 }, target: { x: 0, z: 0 } }).passenger).toBe(false);
  });

  it('is over when you ride off or walk away once it is lit, and then waits a while before offering again', () => {
    const w = new WorkLight();
    w.take({ girl: 'amy', vehicle: 'landy', spot: { x: 6, z: 0, yaw: 0 }, target: { x: 0, z: 0 } });
    expect(w.update(1, ctx({ you: { x: 0, z: 0, onFoot: false } }))).toEqual([]); // still bringing it
    w.arrived();
    expect(w.update(1, ctx())).toEqual([]);
    expect(w.update(1, ctx({ you: { x: 0, z: 0, onFoot: false } }))).toEqual([{ type: 'done', girl: 'amy', vehicle: 'landy', why: 'rode' }]);
    w.update(P.workFor + 1, ctx());
    expect(w.offers(ctx())).toEqual([]); // cooling down
    w.take({ girl: 'amy', vehicle: 'landy', spot: { x: 6, z: 0, yaw: 0 }, target: { x: 0, z: 0 } });
    w.arrived();
    expect(w.update(1, ctx({ you: { x: 100, z: 0, onFoot: true } }))[0].why).toBe('walked');
  });

  it('says what is going on', () => {
    const w = new WorkLight();
    expect(w.describe()).toBe('no');
    w.take({ girl: 'amy', vehicle: 'landy', spot: { x: 6, z: 0, yaw: 0 }, target: { x: 0, z: 0 } });
    expect(w.describe()).toMatch(/amy bringing the landy/);
  });
});
