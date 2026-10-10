import { describe, it, expect } from 'vitest';
import { NoticeWatch } from '../src/npc/noticeWatch.js';
import { DEFAULT_NOTICE_PARAMS as P, NOTICE_KINDS } from '../src/npc/attention.js';

const dt = 1 / 30;
const quad = (o = {}) => ({ id: 'red', x: 1, y: 0.8, z: 2, events: [], rpm: 1200, running: true, speed: 0, horn: false, tipped: false, airborne: false, ...o });
const kinds = (out) => out.map((n) => n.kind);

describe('NoticeWatch', () => {
  it('turns engine events into notices, once each per frame, at the vehicle', () => {
    const w = new NoticeWatch(P);
    const out = w.update(dt, [quad({ events: ['caught', 'backfire', 'backfire', 'starterClick'] })]);
    expect(kinds(out)).toEqual(['engineStart', 'backfire']);
    expect(out[0]).toMatchObject({ key: 'red', x: 1, y: 0.8, z: 2 });
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

  it('notices a stood engine being revved, at the top of the blip, not too often', () => {
    const w = new NoticeWatch(P);
    w.update(dt, [quad()]);
    const up = 1200 + P.revRate * dt * 2;
    expect(w.update(dt, [quad({ rpm: up })])).toEqual([]); // still climbing
    expect(kinds(w.update(dt, [quad({ rpm: up - 100 })]))).toEqual(['rev']); // and back down
    w.update(dt, [quad({ rpm: up + P.revRate * dt * 2 })]);
    expect(w.update(dt, [quad({ rpm: up })])).toEqual([]); // too soon after the last
  });

  it('does not count pulling away as revving', () => {
    const w = new NoticeWatch(P);
    w.update(dt, [quad()]);
    const up = 1200 + P.revRate * dt * 2;
    w.update(dt, [quad({ rpm: up, speed: 0.2 })]);
    w.update(dt, [quad({ rpm: up + 300, speed: P.revMaxSpeed + 0.5 })]);
    expect(w.update(dt, [quad({ rpm: up, speed: P.revMaxSpeed + 1.5 })])).toEqual([]);
  });

  it('does not count revs on an engine that is not running', () => {
    const w = new NoticeWatch(P);
    w.update(dt, [quad({ running: false, rpm: 0 })]);
    expect(w.update(dt, [quad({ running: false, rpm: 300 })])).toEqual([]);
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
