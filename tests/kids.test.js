import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createRandom } from '../src/core/random.js';
import { visitPlaces } from '../src/world/traffic.js';
import { Kids, KidsGroup, DEFAULT_KIDS_PARAMS, KIDS_PARAM_RANGES, SHOWY_OFFERS, showOffBoost } from '../src/world/kids.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';
import { NOTICE_KINDS } from '../src/npc/attention.js';
import { NOTICE_REACTIONS } from '../src/npc/reactions.js';
import { AMY_TRAFFIC_LINES, JESS_TRAFFIC_LINES } from '../src/npc/trafficLines.js';

const places = visitPlaces(LAYOUT);
const P = { ...DEFAULT_KIDS_PARAMS };
const nearGate = [{ x: places.gate.x - 10, z: places.gate.z }];
const farAway = [{ x: places.gate.x - 150, z: places.gate.z + 90 }];

function run(group, ctx, limit = 400) {
  const events = [];
  for (let t = 0; t < limit && !group.done; t += 0.1) events.push(...group.update(0.1, ctx));
  return events;
}

const group = (count = 3, dir = 1) => new KidsGroup({ places, params: P, dir, count, random: createRandom(5) });

describe('the kids on the lane', () => {
  it('stop at the gate and watch when someone is near, then ride on', () => {
    const g = group();
    const types = run(g, { watchers: nearGate }).map((e) => e.type);
    expect(types).toEqual(['kidsComing', 'kidsWatch', 'kidsLeave', 'kidsGone']);
    expect(g.done).toBe(true);
  });

  it('stop level with the gate in single file, the leader first', () => {
    const g = group(3, 1);
    let watching = false;
    for (let t = 0; t < 300 && !watching; t += 0.1) {
      g.update(0.1, { watchers: nearGate });
      watching = g.watching;
    }
    expect(watching).toBe(true);
    const [a, b, c] = g.riders.map((r) => r.drive);
    expect(Math.abs(a.z - places.gate.z)).toBeLessThan(1);
    expect(b.z).toBeLessThan(a.z);
    expect(c.z).toBeLessThan(b.z);
    expect(g.riders.every((r) => r.drive.speed === 0)).toBe(true);
  });

  it('just ride by when nobody is near the gate', () => {
    const types = run(group(), { watchers: farAway }).map((e) => e.type);
    expect(types).toEqual(['kidsComing', 'kidsPass', 'kidsGone']);
  });

  it('give up watching a while after the last of you has gone', () => {
    const g = group(1);
    let t = 0;
    for (; t < 300 && !g.watching; t += 0.1) g.update(0.1, { watchers: nearGate });
    expect(g.watching).toBe(true);
    let left = 0;
    while (g.phase === 'watching' && left < 60) {
      g.update(0.1, { watchers: farAway });
      left += 0.1;
    }
    expect(g.phase).toBe('leaving');
    expect(left).toBeLessThan(P.watchGrace + 1);
  });

  it('stop watching after watchSeconds however long you stay', () => {
    const g = group(2);
    let watched = 0;
    while (!g.done && watched < 300) {
      g.update(0.1, { watchers: nearGate });
      if (g.watching) watched += 0.1;
    }
    expect(watched).toBeGreaterThan(P.watchSeconds - 1);
    expect(watched).toBeLessThan(P.watchSeconds + 1);
  });

  it('go along the lane both ways', () => {
    for (const dir of [1, -1]) expect(run(group(2, dir), { watchers: farAway }).at(-1).type).toBe('kidsGone');
  });
});

describe('Kids (the schedule)', () => {
  const ctx = (extra = {}) => ({ darkness: 0, fine: true, watchers: farAway, ...extra });
  const wait = (kids, c, secs = 4000) => {
    for (let t = 0; t < secs && !kids.group; t += 1) kids.update(1, c);
    return kids.group;
  };

  it('sets a group out after a while on a fine day', () => {
    const kids = new Kids({ places, params: P, random: createRandom(3) });
    expect(wait(kids, ctx())).toBeTruthy();
  });

  it('never sets out in the dark, in the rain or the frost', () => {
    for (const c of [ctx({ darkness: 0.9 }), ctx({ fine: false })]) {
      const kids = new Kids({ places, params: P, random: createRandom(3) });
      expect(wait(kids, c, 6000)).toBeFalsy();
    }
  });

  it('is off when kidsEvery is 0, and only one group is out at a time', () => {
    const off = new Kids({ places, params: { ...P, kidsEvery: 0 }, random: createRandom(3) });
    expect(wait(off, ctx(), 6000)).toBeFalsy();
    const kids = new Kids({ places, params: P, random: createRandom(3) });
    expect(kids.start(2)).toBeTruthy();
    expect(kids.start(1)).toBe(null);
  });

  it('deals one to kidsMax riders', () => {
    const kids = new Kids({ places, params: P, random: createRandom(9) });
    kids.start();
    expect(kids.group.riders.length).toBeGreaterThanOrEqual(1);
    expect(kids.group.riders.length).toBeLessThanOrEqual(P.kidsMax);
  });

  it('says it is watching only while they watch', () => {
    const kids = new Kids({ places, params: P, random: createRandom(3) });
    expect(kids.watching).toBe(false);
    kids.start(1);
    let watching = false;
    for (let t = 0; t < 400 && !watching; t += 0.1) {
      kids.update(0.1, ctx({ watchers: nearGate }));
      watching = kids.watching;
    }
    expect(watching).toBe(true);
  });
});

describe('the girls and the kids', () => {
  it('are keener on what shows off only while they watch', () => {
    expect(showOffBoost('jumps', true, P)).toBe(P.kidsShowOff);
    expect(showOffBoost('jumps', false, P)).toBe(1);
    expect(showOffBoost('tea', true, P)).toBe(1);
  });

  it('only boost real offers', () => {
    for (const key of SHOWY_OFFERS) expect(OFFER_KINDS[key], key).toBeTruthy();
  });

  it('notice them, wave, and have lines for it', () => {
    expect(NOTICE_KINDS.kids).toBeTruthy();
    expect(NOTICE_REACTIONS.kids.reaction).toBe('wave');
    for (const key of ['kidsPass', 'kidsWatch', 'kidsShowOff', 'kidsLeave']) {
      expect(AMY_TRAFFIC_LINES[key].lines.length, key).toBeGreaterThan(0);
      expect(JESS_TRAFFIC_LINES[key].length, key).toBeGreaterThan(0);
    }
  });

  it('have a range for every tunable', () => {
    for (const key of Object.keys(DEFAULT_KIDS_PARAMS)) expect(KIDS_PARAM_RANGES[key], key).toHaveLength(3);
  });
});
