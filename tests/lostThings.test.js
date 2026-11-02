import { describe, it, expect } from 'vitest';
import { LostThings, DEFAULT_LOST_PARAMS, LOST_PARAM_RANGES, LOSABLE, coverAt, sightRange, sinkFor, seen, noticeFrom } from '../src/items/lostThings.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';

const girls = (over = {}) => [
  { id: 'amy', free: true, x: 10, z: 0, weight: 1 },
  { id: 'jess', free: true, x: 12, z: 0, weight: 0.5 },
].map((g) => ({ ...g, ...over }));
const open = () => 0;
const ready = (p = {}) => {
  const m = new LostThings({ ...DEFAULT_LOST_PARAMS, ...p }, () => 0);
  m.update(m.p.firstDelay + 1);
  return m;
};

describe('how much grass is over a spot', () => {
  it('is none on tarmac and the yard, full in the grass field, some in stubble', () => {
    expect(coverAt('grass', 1, 0)).toBe(0);
    expect(coverAt('road', 0, 0)).toBe(0);
    expect(coverAt('grass', 0, 0)).toBe(1);
    expect(coverAt('north', 0, 0.9)).toBe(DEFAULT_LOST_PARAMS.stubbleCover);
  });
  it('hides a thing from further off the more grass there is', () => {
    expect(sightRange(0)).toBe(DEFAULT_LOST_PARAMS.clearSight);
    expect(sightRange(1)).toBe(DEFAULT_LOST_PARAMS.grassSight);
    expect(seen(1, 5)).toBe(false);
    expect(seen(1, 1.5)).toBe(true);
    expect(seen(0, 30)).toBe(true);
  });
  it('sinks a thing in by its height times the cover', () => {
    expect(sinkFor('oilBottle', 0)).toBe(0);
    expect(sinkFor('oilBottle', 1)).toBeCloseTo(LOSABLE.oilBottle.height * DEFAULT_LOST_PARAMS.sink);
  });
  it('lets a girl notice one only as far as she could see it', () => {
    expect(noticeFrom(0)).toBe(DEFAULT_LOST_PARAMS.noticeRange);
    expect(noticeFrom(1)).toBe(DEFAULT_LOST_PARAMS.grassSight);
  });
});

describe('a girl coming across one', () => {
  it('remembers only what is out, and forgets it once it is back', () => {
    const m = ready();
    m.sync([{ kind: 'leads', x: 5, z: 0, yaw: 1, out: true }, { kind: 'oilBottle', x: 0, z: 0, yaw: 0, out: false }]);
    expect(Object.keys(m.lying)).toEqual(['leads']);
    m.sync([{ kind: 'leads', x: 5, z: 0, yaw: 1, out: false }]);
    expect(m.lying).toEqual({});
  });
  it('offers the nearest thing she notices, to each free girl', () => {
    const m = ready();
    m.sync([{ kind: 'leads', x: 5, z: 0, yaw: 0, out: true }, { kind: 'oilBottle', x: 30, z: 0, yaw: 0, out: true }]);
    const offers = m.offers({ girls: girls(), cover: open });
    expect(offers.map((o) => [o.girl, o.kind])).toEqual([['amy', 'leads'], ['jess', 'leads']]);
    expect(offers.every((o) => OFFER_KINDS[o.key])).toBe(true);
  });
  it('misses one hidden in long grass until she is nearly on it', () => {
    const m = ready();
    m.sync([{ kind: 'leads', x: 0, z: 0, yaw: 0, out: true }]);
    expect(m.offers({ girls: girls(), cover: () => 1 })).toEqual([]);
    expect(m.offers({ girls: girls({ x: 1 }), cover: () => 1 }).length).toBe(2);
  });
  it('waits for the first delay, a free girl, a weight, and the cooldown', () => {
    const m = new LostThings();
    m.sync([{ kind: 'leads', x: 5, z: 0, yaw: 0, out: true }]);
    expect(m.offers({ girls: girls(), cover: open })).toEqual([]);
    m.update(m.p.firstDelay + 1);
    expect(m.offers({ girls: girls({ free: false }), cover: open })).toEqual([]);
    expect(m.offers({ girls: girls({ weight: 0 }), cover: open })).toEqual([]);
    expect(m.offers({ girls: girls(), cover: open }).length).toBe(2);
    m.take({ girl: 'amy', kind: 'leads' });
    m.finish();
    expect(m.offers({ girls: girls(), cover: open })).toEqual([]);
    m.update(m.p.cooldown + 1);
    expect(m.offers({ girls: girls(), cover: open }).length).toBe(2);
  });
  it('lets only one job run at a time and lapses it', () => {
    const m = ready();
    m.sync([{ kind: 'leads', x: 5, z: 0, yaw: 0, out: true }]);
    m.take({ girl: 'amy', kind: 'leads' });
    expect(m.offers({ girls: girls(), cover: open })).toEqual([]);
    m.update(m.p.jobTimeout + 1);
    expect(m.job).toBe(null);
  });
  it('has Amy always bring it back and Jess sometimes keep it', () => {
    const m = new LostThings({ ...DEFAULT_LOST_PARAMS }, () => 0.1);
    expect(m.take({ girl: 'amy', kind: 'leads' }).keep).toBe(false);
    expect(m.take({ girl: 'jess', kind: 'leads' }).keep).toBe(true);
    const never = new LostThings({ ...DEFAULT_LOST_PARAMS }, () => 0.99);
    expect(never.take({ girl: 'jess', kind: 'leads' }).keep).toBe(false);
  });
});

describe('Jess keeping one', () => {
  it('hands it over when asked, and only to the right asking', () => {
    const m = ready();
    m.keep('oilBottle', 'jess');
    expect(m.keeping('jess')).toEqual(['oilBottle']);
    expect(m.askFor('oilBottle', 'amy')).toBe(false);
    expect(m.askFor('oilBottle', 'jess')).toBe(true);
    expect(m.keeping('jess')).toEqual([]);
  });
  it('gives in after a while', () => {
    const m = ready();
    m.keep('oilBottle', 'jess');
    expect(m.update(m.p.keepFor - 1)).toEqual([]);
    expect(m.update(2)).toEqual([{ type: 'giveIn', kind: 'oilBottle', girl: 'jess' }]);
  });
});

describe('what the farm keeps', () => {
  it('round-trips, and loads an old save or a bad one', () => {
    const m = ready();
    m.sync([{ kind: 'leads', x: 5, z: -3, yaw: 1.2, out: true }]);
    const back = new LostThings();
    back.restore(JSON.parse(JSON.stringify(m.toJSON())));
    expect(back.lying).toEqual({ leads: { x: 5, z: -3, yaw: 1.2 } });
    back.restore(undefined);
    expect(back.lying).toEqual({});
    back.restore({ lying: { toaster: { x: 1, z: 1 }, leads: { x: 'a', z: 2 }, oilBottle: { x: 1, z: 2 } } });
    expect(back.lying).toEqual({ oilBottle: { x: 1, z: 2, yaw: 0 } });
  });
});

describe('tuning', () => {
  it('has a range for every param', () => {
    expect(Object.keys(LOST_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_LOST_PARAMS).sort());
  });
});
