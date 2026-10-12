import { describe, it, expect } from 'vitest';
import { Dares, DARE_KINDS, DEFAULT_DARE_PARAMS, DARE_PARAM_RANGES, steepestBank } from '../src/npc/dares.js';
import { LAYOUT } from '../src/world/layout.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';
import { AMY_DARE_LINES, JESS_DARE_LINES } from '../src/npc/dareLines.js';
import { ACHIEVEMENTS } from '../src/achievements/achievements.js';

const bank = { minX: -96, maxX: -12, minZ: 170, maxZ: 190, rise: 5.5 };
const make = () => new Dares(bank, { ...DEFAULT_DARE_PARAMS }, () => 0);
const ctx = (over = {}) => ({ kinds: ['ramp', 'ford', 'fence', 'bank'], girls: [{ id: 'jess', free: true, distance: 10, weight: 1 }, { id: 'amy', free: true, distance: 10, weight: 0 }], ...over });
const ride = (over = {}) => ({ rider: true, moto: false, speed: 5, airborne: false, tipped: false, nearRamp: 100, atFord: false, x: 0, y: 0, z: 0, ...over });
const later = (d) => d.update(DEFAULT_DARE_PARAMS.startAfter + 1, null);

describe('offers', () => {
  it('waits for the start, then only Jess (weight > 0) in earshot who is free', () => {
    const d = make();
    expect(d.offers(ctx())).toEqual([]);
    later(d);
    const o = d.offers(ctx());
    expect(o.map((x) => x.girl)).toEqual(['jess']);
    expect(o[0].key).toBe('dare');
    expect(d.offers(ctx({ girls: [{ id: 'jess', free: true, distance: 60, weight: 1 }] }))).toEqual([]);
    expect(d.offers(ctx({ girls: [{ id: 'jess', free: false, distance: 5, weight: 1 }] }))).toEqual([]);
  });

  it('does not repeat the last kind and offers nothing when none could be done', () => {
    const d = make();
    later(d);
    d.last = 'ramp';
    expect(d.offers(ctx())[0].kind).not.toBe('ramp');
    expect(d.offers(ctx({ kinds: [] }))).toEqual([]);
  });

  it('is not offered while one is on, nor in the cooldown after', () => {
    const d = make();
    later(d);
    d.begin('jess', 'ford');
    expect(d.offers(ctx())).toEqual([]);
    d.update(1, ride({ atFord: true, speed: 9 }));
    expect(d.offers(ctx())).toEqual([]);
  });
});

describe('doing it', () => {
  it('the ford needs the speed', () => {
    const d = make();
    d.begin('jess', 'ford');
    expect(d.update(1, ride({ atFord: true, speed: 4 }))).toEqual([]);
    expect(d.update(1, ride({ atFord: false, speed: 12 }))).toEqual([]);
    expect(d.update(1, ride({ atFord: true, speed: 9 }))[0]).toMatchObject({ type: 'done', kind: 'ford' });
    expect(d.active).toBe(null);
  });

  it('the ramp needs a long enough jump near the ramp, counted on landing', () => {
    const d = make();
    d.begin('jess', 'ramp');
    for (let i = 0; i < 4; i++) expect(d.update(0.1, ride({ airborne: true, nearRamp: 80 }))).toEqual([]);
    expect(d.update(0.1, ride({ airborne: false }))).toEqual([]); // far from the ramp
    for (let i = 0; i < 4; i++) d.update(0.1, ride({ airborne: true, nearRamp: 3 }));
    expect(d.update(0.1, ride({ airborne: false }))).toEqual([]); // 0.4 s: a bump
    for (let i = 0; i < 7; i++) d.update(0.1, ride({ airborne: true, nearRamp: 3 }));
    expect(d.update(0.1, ride({ airborne: false }))[0]).toMatchObject({ type: 'done', kind: 'ramp', fell: false });
  });

  it('the fence counts when it zaps you, on foot too', () => {
    const d = make();
    d.begin('jess', 'fence');
    expect(d.update(1, null)).toEqual([]);
    d.zap();
    expect(d.update(1, null)[0]).toMatchObject({ type: 'done', kind: 'fence' });
  });

  it('a zap with no dare on does nothing later', () => {
    const d = make();
    d.zap();
    d.update(1, null);
    d.begin('jess', 'fence');
    expect(d.update(1, null)).toEqual([]);
  });

  it('the bank needs the moto, inside the bank, coming down far enough, upright', () => {
    const d = make();
    d.begin('jess', 'bank');
    expect(d.update(1, ride({ moto: false, x: -40, z: 180, y: 10 }))).toEqual([]);
    expect(d.update(1, ride({ moto: false, x: -40, z: 180, y: 4 }))).toEqual([]);
    expect(d.update(1, ride({ moto: true, x: -40, z: 180, y: 10 }))).toEqual([]);
    expect(d.update(1, ride({ moto: true, x: -40, z: 180, y: 8 }))).toEqual([]);
    expect(d.update(1, ride({ moto: true, x: -40, z: 180, y: 5.9, tipped: true }))).toEqual([]);
    expect(d.update(1, ride({ moto: true, x: -40, z: 180, y: 5.9 }))[0]).toMatchObject({ type: 'done', kind: 'bank' });
  });

  it('the bank starts afresh when you leave it', () => {
    const d = make();
    d.begin('jess', 'bank');
    d.update(1, ride({ moto: true, x: -40, z: 180, y: 10 }));
    d.update(1, ride({ moto: true, x: 20, z: 180, y: 10 })); // out of the box (the gentle end)
    expect(d.update(1, ride({ moto: true, x: -40, z: 180, y: 5 }))).toEqual([]);
  });

  it('a tumble on the landing is reported with the win; one just after, as a fall', () => {
    const d = make();
    d.begin('jess', 'ford');
    expect(d.update(1, ride({ atFord: true, speed: 9, tipped: true }))[0]).toMatchObject({ type: 'done', fell: true });
    const e = make();
    e.begin('jess', 'ford');
    e.update(1, ride({ atFord: true, speed: 9 }));
    expect(e.update(2, ride({ tipped: true }))[0]).toMatchObject({ type: 'fell' });
    expect(e.update(2, ride({ tipped: true }))).toEqual([]);
  });

  it('a tumble long after is not mentioned', () => {
    const d = make();
    d.begin('jess', 'ford');
    d.update(1, ride({ atFord: true, speed: 9 }));
    expect(d.update(DEFAULT_DARE_PARAMS.fellWithin + 1, ride())).toEqual([]);
    expect(d.update(1, ride({ tipped: true }))).toEqual([]);
  });
});

describe('backing out', () => {
  it('lapses into a tease and the cooldown starts', () => {
    const d = make();
    d.begin('jess', 'ramp');
    expect(d.update(DEFAULT_DARE_PARAMS.dareSeconds - 1, ride())).toEqual([]);
    expect(d.update(2, ride())[0]).toMatchObject({ type: 'chicken', girl: 'jess', kind: 'ramp' });
    expect(d.active).toBe(null);
    expect(d.offers(ctx())).toEqual([]);
  });

  it('only one at a time', () => {
    const d = make();
    expect(d.begin('jess', 'ramp')).toMatchObject({ type: 'dared' });
    expect(d.begin('jess', 'ford')).toBe(null);
    expect(d.begin('jess', 'nonsense')).toBe(null);
  });
});

describe('the steepest bank', () => {
  it('is the one that rises most for its width, on the real layout, and clear of the gentle end', () => {
    const b = steepestBank(LAYOUT.hill);
    expect(b.rise).toBe(5.5);
    expect(b.maxX).toBe(LAYOUT.hill.gentle.fromX);
    const base = LAYOUT.hill.stream.z + LAYOUT.hill.stream.halfWidth + 35;
    expect(b.minZ).toBeLessThan(base - 6);
    expect(b.maxZ).toBeGreaterThan(base + 6);
  });
});

describe('wiring', () => {
  it('has a chooser entry, lines for every kind, ranges for every param and a bucket-list entry each', () => {
    expect(OFFER_KINDS.dare).toBeTruthy();
    for (const k of Object.keys(DARE_KINDS)) {
      const K = k[0].toUpperCase() + k.slice(1);
      expect(JESS_DARE_LINES[`dare${K}`]?.length, k).toBeGreaterThan(0);
      expect(AMY_DARE_LINES[`dareAmy${K}`], k).toBeTruthy();
      expect(ACHIEVEMENTS.some((a) => a.group === 'Dares' && a.test({ n: (key) => (key === `dare${K}` ? 1 : 0), p: {} })), k).toBe(true);
    }
    for (const k of ['dareWon', 'dareChicken']) expect(JESS_DARE_LINES[k].length).toBeGreaterThan(0);
    expect(AMY_DARE_LINES.dareFell).toBeTruthy();
    for (const k of Object.keys(DEFAULT_DARE_PARAMS)) expect(DARE_PARAM_RANGES[k], k).toBeTruthy();
  });
});
