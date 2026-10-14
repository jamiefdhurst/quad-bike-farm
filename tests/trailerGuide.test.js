import { describe, it, expect } from 'vitest';
import { TrailerGuide, guideCall, wheelFor, guideSpot, DEFAULT_TRAILER_GUIDE_PARAMS as P, TRAILER_GUIDE_PARAM_RANGES } from '../src/npc/trailerGuide.js';
import { TrailerMotion, pinPosition, DEFAULT_TRAILER_PARAMS as TP } from '../src/vehicle/trailer.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';

const flat = () => 0;
const LIMIT = TP.jackknifeAngle;

// A puller reversing at 1.5 m/s with a bicycle-model steer (positive left, so reversing it swings the back to the left).
function reverseWith(steerFor, seconds, startAngle = 0.5) {
  const t = new TrailerMotion({ ...TP });
  let x = 0;
  let z = 0;
  let yaw = 0;
  const pin0 = pinPosition(x, z, yaw, 1.5);
  t.place(pin0.x, pin0.z - TP.drawLength, 0, flat);
  t.setHitchAngle(startAngle, yaw, pin0);
  for (let i = 0; i < seconds * 60; i++) {
    const steer = steerFor(t);
    yaw += (-1.5 * steer * 0.45 / 60);
    x -= Math.sin(yaw) * 1.5 / 60;
    z -= Math.cos(yaw) * 1.5 / 60;
    const pin = pinPosition(x, z, yaw, 1.5);
    t.update(1 / 60, { ...pin, y: 0 }, flat, yaw);
  }
  return t;
}

describe('what she calls', () => {
  it('calls the lock from how the trailer lies', () => {
    expect(guideCall(0.03, false, LIMIT)).toBe('straight');
    expect(guideCall(0.4, false, LIMIT)).toBe('right');
    expect(guideCall(-0.4, false, LIMIT)).toBe('left');
    expect(guideCall(0.9, false, LIMIT)).toBe('stop');
    expect(guideCall(0.2, true, LIMIT)).toBe('stop');
    expect(wheelFor('left')).toBe(1);
    expect(wheelFor('right')).toBe(-1);
    expect(wheelFor('straight')).toBe(0);
  });

  it('brings the trailer straight if you do as she says', () => {
    const t = reverseWith((m) => wheelFor(guideCall(m.hitchAngle, m.jammed, LIMIT)), 8, 0.5);
    expect(Math.abs(t.hitchAngle)).toBeLessThan(0.15);
    expect(t.jammed).toBe(false);
    const u = reverseWith((m) => wheelFor(guideCall(m.hitchAngle, m.jammed, LIMIT)), 8, -0.5);
    expect(Math.abs(u.hitchAngle)).toBeLessThan(0.15);
  });

  it('folds it if you turn the other way', () => {
    const t = reverseWith((m) => -wheelFor(guideCall(m.hitchAngle, m.jammed, LIMIT)), 12, 0.5);
    expect(t.jammed).toBe(true);
  });
});

describe('where she stands', () => {
  it('goes behind the trailer and off to the side nearer her, facing it', () => {
    const s = guideSpot({ x: 0, z: 0, yaw: 0 }, 1.8, { x: 10, z: -9 });
    expect(s.z).toBeCloseTo(-(1.8 + P.behind));
    expect(Math.abs(s.x)).toBeCloseTo(P.aside);
    expect(Math.sign(s.x)).toBe(1); // trailer facing +z has its left at +x, and she is over that side
    expect(Math.cos(s.facing)).toBeGreaterThan(0);
  });
});

const ride = (over = {}) => ({ hitched: true, speed: -1, angle: 0, jammed: false, limit: LIMIT, steer: 0, ...over });
const girls = [{ id: 'amy', x: 5, z: 5, free: true, weight: 1 }];

describe('the job', () => {
  it('offers only after you have been reversing a few seconds, with her free and near', () => {
    const g = new TrailerGuide({ ...P });
    for (let i = 0; i < 60; i++) g.update(1 / 60, ride());
    expect(g.offers({ ...ride(), girls, you: { x: 0, z: 0 } })).toEqual([]);
    for (let i = 0; i < 180; i++) g.update(1 / 60, ride());
    expect(g.offers({ ...ride(), girls, you: { x: 0, z: 0 } })).toHaveLength(1);
    expect(g.offers({ ...ride(), girls: [{ ...girls[0], free: false }], you: { x: 0, z: 0 } })).toEqual([]);
    expect(g.offers({ ...ride(), girls, you: { x: 100, z: 0 } })).toEqual([]);
    expect(g.offers({ ...ride(), hitched: false, girls, you: { x: 0, z: 0 } })).toEqual([]);
  });

  it('calls a change quickly and does not repeat itself every frame', () => {
    const g = new TrailerGuide({ ...P });
    g.take({ girl: 'amy' });
    const calls = [];
    for (let i = 0; i < 60 * 6; i++) calls.push(...g.update(1 / 60, ride({ angle: 0.4, steer: -0.5 })).filter((e) => e.type === 'call'));
    expect(calls[0].call).toBe('right');
    expect(calls.length).toBeLessThanOrEqual(3);
  });

  it('gets cross when you turn the wrong way, harder each time, and gives up', () => {
    const g = new TrailerGuide({ ...P });
    g.take({ girl: 'amy' });
    const seen = [];
    for (let i = 0; i < 60 * 60 && g.active; i++) for (const e of g.update(1 / 60, ride({ angle: 0.4, steer: 0.6 }))) seen.push(e);
    const cross = seen.filter((e) => e.type === 'cross');
    expect(cross.length).toBe(P.quitAfter - 1);
    expect(cross[0].hard).toBe(false);
    expect(cross.at(-1).hard).toBe(true);
    expect(seen.at(-1)).toMatchObject({ type: 'done', why: 'quit' });
  });

  it('does not tell you off for turning the right way', () => {
    const g = new TrailerGuide({ ...P });
    g.take({ girl: 'amy' });
    for (let i = 0; i < 60 * 20; i++) expect(g.update(1 / 60, ride({ angle: 0.4, steer: -0.6 })).some((e) => e.type === 'cross')).toBe(false);
  });

  it('is finished when you stop reversing for a while, and ends when you unhitch', () => {
    const g = new TrailerGuide({ ...P });
    g.take({ girl: 'amy' });
    let end;
    for (let i = 0; i < 60 * 12 && !end; i++) end = g.update(1 / 60, ride({ speed: 0 })).find((e) => e.type === 'done');
    expect(end.why).toBe('left');
    g.take({ girl: 'amy' });
    expect(g.update(1 / 60, ride({ hitched: false }))[0]).toMatchObject({ type: 'done' });
    expect(g.offers({ ...ride(), girls, you: { x: 0, z: 0 } })).toEqual([]); // cooling down
  });
});

describe('wiring', () => {
  it('has an offer kind, a tuning range for every tunable, and Amy keen but not Jess', () => {
    expect(OFFER_KINDS.trailerGuide).toBeTruthy();
    expect(Object.keys(P).sort()).toEqual(Object.keys(TRAILER_GUIDE_PARAM_RANGES).sort());
    expect(CHARACTERS.find((c) => c.id === 'amy').params.trailerGuideWeight).toBeGreaterThan(0);
    expect(CHARACTERS.find((c) => c.id === 'jess').params.trailerGuideWeight ?? 0).toBe(0);
  });
});
