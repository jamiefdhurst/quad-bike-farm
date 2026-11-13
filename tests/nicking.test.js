import { describe, it, expect } from 'vitest';
import { Nicking, DEFAULT_NICK_PARAMS } from '../src/npc/nicking.js';

const p = { ...DEFAULT_NICK_PARAMS, startAfter: 0 };
/** A step, taking what she's offered (as a chooser that always says yes). */
const step = (n, dt, c) => {
  const events = n.update(dt, c);
  const offer = n.offers(c)[0];
  if (offer) events.push(n.take(offer));
  return events;
};
const quad = { id: 'farm300', x: 10, z: 0, running: true, free: true };
const jess = { id: 'jess', x: 14, z: 3, free: true, chance: 1 };
const amy = { id: 'amy', x: 14, z: 3, free: true, chance: 0 };
const ctx = (over = {}) => ({ riding: null, you: { x: 0, z: 0 }, quads: [quad], girls: [jess, amy], ...over });

/** You ride for a moment, get off, and `seconds` go by (one step a second). */
function getOff(n, seconds, over = {}) {
  n.update(0.1, ctx({ riding: 'farm300' }));
  const events = [];
  for (let t = 0; t < seconds; t++) events.push(...step(n, 1, ctx(over)));
  return events.flat();
}

describe('nicking your quad', () => {
  it('never takes it on its own: that is the chooser\'s', () => {
    const n = new Nicking(p, () => 0);
    n.update(0.1, ctx({ riding: 'farm300' }));
    for (let t = 0; t < 10; t++) expect(n.update(1, ctx())).toEqual([]);
    expect(n.offers(ctx())).toEqual([{ key: 'nick', girl: 'jess', spec: 'farm300', weight: p.weight }]);
  });

  it('has Jess take the quad you got off with still running', () => {
    const n = new Nicking(p, () => 0);
    expect(getOff(n, 5)).toEqual([{ type: 'nick', girl: 'jess', spec: 'farm300' }]);
  });

  it('never has Amy do it', () => {
    const n = new Nicking(p, () => 0);
    expect(getOff(n, 5, { girls: [amy] })).toEqual([]);
  });

  it('leaves it alone if the engine is off, it is attended, or you are right beside it or far away', () => {
    for (const over of [
      { quads: [{ ...quad, running: false }] },
      { quads: [{ ...quad, free: false }] },
      { you: { x: 9, z: 0 } },
      { you: { x: -80, z: 0 } },
    ]) expect(getOff(new Nicking(p, () => 0), 5, over)).toEqual([]);
  });

  it('gives you a few seconds first, and only once per getting off', () => {
    const n = new Nicking(p, () => 0);
    n.update(0.1, ctx({ riding: 'farm300' }));
    expect(step(n, 1, ctx())).toEqual([]);
    expect(step(n, 3.5, ctx())).toHaveLength(1);
    expect(step(n, 1, ctx())).toEqual([]);
  });

  it('lets the moment pass if you leave it a while', () => {
    const n = new Nicking(p, () => 0.5);
    n.update(0.1, ctx({ riding: 'farm300' }));
    for (let t = 0; t < 40; t++) n.update(1, ctx()); // nobody takes it up
    expect(step(n, 1, ctx())).toEqual([]);
  });

  it('waits out its cooldown, and the start of the game', () => {
    const n = new Nicking(p, () => 0);
    expect(getOff(n, 5)).toHaveLength(1);
    expect(getOff(n, 5)).toEqual([]);
    expect(getOff(new Nicking({ ...p, startAfter: 100 }, () => 0), 5)).toEqual([]);
  });

  it('picks how long she keeps it between the limits', () => {
    expect(new Nicking(p, () => 0).awayFor()).toBe(p.awayMin);
    expect(new Nicking(p, () => 1).awayFor()).toBe(p.awayMax);
  });
});
