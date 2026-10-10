import { describe, it, expect } from 'vitest';
import { NoticeWatch } from '../src/npc/noticeWatch.js';
import { DEFAULT_NOTICE_PARAMS as P, NOTICE_KINDS } from '../src/npc/attention.js';

const dt = 1 / 30;
const quad = (o = {}) => ({ id: 'red', x: 1, y: 0.8, z: 2, events: [], rpm: 1200, running: true, speed: 0, horn: false, tipped: false, ...o });
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

  it('notices a stood engine being revved, not too often, and not one being ridden', () => {
    const w = new NoticeWatch(P);
    w.update(dt, [quad()]);
    const jump = 1200 + P.revRate * dt * 2;
    expect(kinds(w.update(dt, [quad({ rpm: jump })]))).toEqual(['rev']);
    expect(w.update(dt, [quad({ rpm: jump + P.revRate * dt * 2 })])).toEqual([]); // too soon after
    const ridden = new NoticeWatch(P);
    ridden.update(dt, [quad({ speed: 8 })]);
    expect(ridden.update(dt, [quad({ speed: 8, rpm: jump })])).toEqual([]);
  });

  it('does not count revs on an engine that is not running', () => {
    const w = new NoticeWatch(P);
    w.update(dt, [quad({ running: false, rpm: 0 })]);
    expect(w.update(dt, [quad({ running: false, rpm: 300 })])).toEqual([]);
  });
});
