import { describe, it, expect } from 'vitest';
import { NoticeWatch } from '../src/npc/noticeWatch.js';
import { DEFAULT_NOTICE_PARAMS as P, NOTICE_KINDS } from '../src/npc/attention.js';

const dt = 1 / 30;
const quad = (o = {}) => ({ id: 'farm300', x: 1, y: 0.8, z: 2, events: [], rpm: 1200, running: true, speed: 0, horn: false, tipped: false, airborne: false, ...o });
const kinds = (out) => out.map((n) => n.kind);

describe('NoticeWatch', () => {
  it('turns engine events into notices, once each per frame, at the vehicle', () => {
    const w = new NoticeWatch(P);
    const out = w.update(dt, [quad({ events: ['caught', 'backfire', 'backfire', 'starterClick'] })]);
    expect(kinds(out)).toEqual(['engineStart', 'backfire']);
    expect(out[0]).toMatchObject({ key: 'farm300', x: 1, y: 0.8, z: 2 });
  });

  it('only makes notices of kinds attention knows', () => {
    const w = new NoticeWatch(P);
    const out = w.update(dt, [quad({ events: ['caught', 'stalled', 'seized', 'backfire', 'overrunPop', 'spitBack', 'boilOver'], horn: true, tipped: true })]);
    for (const n of out) expect(NOTICE_KINDS[n.kind]).toBeTruthy();
  });

  it('notices the horn and a tip as they start, not while they last', () => {
    const w = new NoticeWatch(P);
    w.update(dt, [quad()]);
    expect(kinds(w.update(dt, [quad({ horn: true, tipped: true })]))).toEqual(['horn', 'tipped']);
    expect(w.update(dt, [quad({ horn: true, tipped: true })])).toEqual([]);
  });

  // A quad idling at 1200 with a 6200 top: a rev has to get up past 2200 with the throttle open.
  const idling = (o = {}) => quad({ idleRpm: 1200, maxRpm: 6200, throttle: 0, ...o });
  const blip = (w, rpms, o = {}) => rpms.flatMap((rpm) => kinds(w.update(dt, [idling({ rpm, throttle: 0.6, ...o })])));

  it('notices a stood engine being revved, at the top of the blip, once, and not too often', () => {
    const w = new NoticeWatch(P);
    w.update(dt, [idling()]);
    expect(blip(w, [2000, 3000, 4000])).toEqual([]); // still climbing
    expect(blip(w, [3500])).toEqual(['rev']); // and over the top
    expect(blip(w, [3200, 3000])).toEqual([]); // the same blip
    for (const rpm of [2500, 1800, 1300]) w.update(dt, [idling({ rpm })]);
    expect(blip(w, [3000, 4000, 3500])).toEqual([]); // too soon after the last
  });

  it('counts a blip as stronger the further up the range it goes', () => {
    const strength = (peak) => {
      const w = new NoticeWatch(P);
      w.update(dt, [idling()]);
      for (const rpm of [peak - 400, peak]) w.update(dt, [idling({ rpm, throttle: 1 })]);
      return w.update(dt, [idling({ rpm: peak - 800 })]).find((n) => n.kind === 'rev').strength;
    };
    expect(strength(5800)).toBeGreaterThan(strength(2800));
    expect(strength(5800)).toBeLessThanOrEqual(1.5);
  });

  it('does not count an idle that hunts, a rough one or one sat high on the choke, with the throttle shut', () => {
    const w = new NoticeWatch(P);
    let out = [];
    for (let t = 0; t < 10; t += dt) {
      const choke = t > 2 ? 1300 : 0; // the choke pulled out: the idle climbs to 2500 and stays
      const hunt = 600 * Math.sin(t * 4) + (Math.random() - 0.5) * 400;
      out = out.concat(kinds(w.update(dt, [idling({ rpm: 1200 + choke + hunt })])));
    }
    expect(out).not.toContain('rev');
  });

  it('measures a rev from the choke\'s fast idle, not the warm idle', () => {
    const w = new NoticeWatch(P);
    for (let t = 0; t < 6; t += dt) w.update(dt, [idling({ rpm: 2600 })]);
    expect(blip(w, [3000, 3200, 3000])).toEqual([]); // a whiff of throttle on a fast idle is not a rev
    expect(blip(w, [3800, 4500, 4200])).toEqual(['rev']);
  });

  it('does not count a barely opened throttle', () => {
    const w = new NoticeWatch(P);
    w.update(dt, [idling()]);
    expect(blip(w, [2500, 3500, 3000], { throttle: P.revThrottle / 2 })).toEqual([]);
  });

  it('does not count pulling away as revving', () => {
    const w = new NoticeWatch(P);
    w.update(dt, [idling()]);
    const out = blip(w, [2500, 3500], { speed: 0.2 }).concat(blip(w, [4000, 3500], { speed: P.revMaxSpeed + 0.5 }));
    expect(out).not.toContain('rev');
  });

  it('does not count revs on an engine that is not running', () => {
    const w = new NoticeWatch(P);
    w.update(dt, [idling({ running: false, rpm: 0 })]);
    expect(blip(w, [300, 2500, 2000], { running: false })).toEqual([]);
  });

  it('notices a vehicle lurching forward from slow, not one already going or one gently pulling away', () => {
    const w = new NoticeWatch(P);
    w.update(dt, [quad()]);
    expect(kinds(w.update(dt, [quad({ speed: P.lurchAccel * dt * 2 })]))).toEqual(['lurch']);
    const going = new NoticeWatch(P);
    going.update(dt, [quad({ speed: P.lurchMaxSpeed + 2 })]);
    expect(going.update(dt, [quad({ speed: P.lurchMaxSpeed + 4 })])).toEqual([]);
    const gentle = new NoticeWatch(P);
    gentle.update(dt, [quad()]);
    expect(gentle.update(dt, [quad({ speed: P.lurchAccel * dt * 0.5 })])).toEqual([]);
  });

  it('notices a landing after real air as a jump, and not a bump', () => {
    const w = new NoticeWatch(P);
    for (let t = 0; t < P.jumpMinAir + 0.1; t += dt) w.update(dt, [quad({ airborne: true, speed: 10 })]);
    expect(kinds(w.update(dt, [quad({ speed: 10 })]))).toContain('jump');
    const bump = new NoticeWatch(P);
    bump.update(dt, [quad({ airborne: true, speed: 10 })]);
    expect(kinds(bump.update(dt, [quad({ speed: 10 })]))).not.toContain('jump');
  });
});
