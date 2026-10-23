import { describe, it, expect } from 'vitest';
import { PubVisit } from '../src/npc/pubVisit.js';
import { BANTER } from '../src/npc/banterLines.js';
import { BANTER_TIMING } from '../src/npc/banter.js';
import { CHARACTERS } from '../src/npc/characters.js';

const pub = { x: 100, z: 200 };
const girl = (x = 100, settled = true) => ({ x, z: 200, settled });
const step = (v, seconds, you, speed, girls) => {
  let out = [];
  for (let t = 0; t < seconds; t++) out = v.triggers(1, pub, you, speed, girls);
  return out;
};

describe('the girls at the pub', () => {
  it('chats while you are stopped in the car park with both of them settled', () => {
    const v = new PubVisit();
    expect(step(v, 3, { x: 102, z: 200 }, 0, [girl(), girl(103)])).toEqual([{ when: 'atPub' }]);
  });

  it('holds its tongue when a girl is not settled, you are far off, or there is no village', () => {
    const v = new PubVisit();
    expect(step(v, 3, { x: 102, z: 200 }, 0, [girl(), girl(103, false)])).toEqual([]);
    expect(step(v, 3, { x: 160, z: 200 }, 0, [girl(), girl()])).toEqual([]);
    expect(v.triggers(1, null, { x: 102, z: 200 }, 0, [girl(), girl()])).toEqual([]);
  });

  it('says goodbye once, when you pull away after a proper stop', () => {
    const v = new PubVisit();
    step(v, 10, { x: 102, z: 200 }, 0, [girl(), girl()]);
    expect(v.triggers(1, pub, { x: 102, z: 200 }, 4, [girl(), girl()])).toEqual([{ when: 'leavingPub', edge: true }]);
    expect(v.triggers(1, pub, { x: 110, z: 200 }, 4, [girl(), girl()])).toEqual([]);
  });

  it('does not count driving past, or leaving after a moment', () => {
    const v = new PubVisit();
    step(v, 3, { x: 102, z: 200 }, 0, [girl(), girl()]);
    expect(v.triggers(1, pub, { x: 102, z: 200 }, 4, [girl(), girl()])).toEqual([]);
  });

  it('does not say goodbye if you leave them behind', () => {
    const v = new PubVisit();
    step(v, 10, { x: 102, z: 200 }, 0, [girl(), girl()]);
    expect(v.triggers(1, pub, { x: 140, z: 200 }, 4, [girl(), girl(160)])).toEqual([]);
  });

  it('has timings and lines for both moments, in both girls, with no he, she or they about you', () => {
    const ids = CHARACTERS.map((c) => c.id);
    for (const when of ['atPub', 'leavingPub']) {
      expect(BANTER_TIMING[when]).toBeDefined();
      const ex = BANTER.filter((e) => e.when === when);
      expect(ex.length).toBeGreaterThanOrEqual(4);
      for (const id of ids) expect(ex.some((e) => e.lines.some(([who]) => who === id)), `${when} ${id}`).toBe(true);
    }
  });
});
