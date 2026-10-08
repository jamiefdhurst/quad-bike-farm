import { describe, it, expect } from 'vitest';
import { onTarmac, settleBoost, boostFactor, TarmacWatch, DEFAULT_TARMAC_PARAMS as P } from '../src/npc/tarmac.js';
import { AMY_TARMAC_LINES, JESS_TARMAC_LINES } from '../src/npc/tarmacLines.js';
import { HerDrive } from '../src/npc/herDriving.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';
import { LAYOUT } from '../src/world/layout.js';

const road = { z: 2, fromX: 78, toX: 199.5, halfWidth: 2.3 };

describe('the tarmac', () => {
  it('is the road itself, not its verge or the fields', () => {
    expect(onTarmac(road, 100, 2)).toBe(true);
    expect(onTarmac(road, 100, 4.2)).toBe(true);
    expect(onTarmac(road, 100, 5)).toBe(false);
    expect(onTarmac(road, 60, 2)).toBe(false);
    expect(onTarmac(null, 100, 2)).toBe(false);
  });

  it('eases the pace up and down rather than jumping', () => {
    let s = 0;
    s = settleBoost(s, true, 0.5, P);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
    for (let i = 0; i < 20; i++) s = settleBoost(s, true, 0.5, P);
    expect(s).toBe(1);
    expect(boostFactor(s, P.speedBoost)).toBe(P.speedBoost);
    expect(boostFactor(0, P.speedBoost)).toBe(1);
    for (let i = 0; i < 20; i++) s = settleBoost(s, false, 0.5, P);
    expect(s).toBe(0);
  });
});

describe('who says what on the road', () => {
  const you = (o = {}) => ({ onRoad: true, speed: 10, squeal: 0, ...o });
  const jess = (o = {}) => ({ id: 'jess', free: true, onRoad: true, distance: 10, role: 'driving', ...o });
  const amy = (o = {}) => ({ id: 'amy', free: true, onRoad: true, distance: 10, role: null, ...o });

  it('has Jess egg you on from her quad on the road, then leaves a gap', () => {
    const w = new TarmacWatch({ ...P });
    expect(w.update(0.1, { you: you(), girls: [jess()] })).toEqual([{ type: 'egg', girl: 'jess' }]);
    expect(w.update(0.1, { you: you(), girls: [jess()] })).toEqual([]);
    expect(w.update(P.eggGap, { you: you(), girls: [jess()] })).toHaveLength(1);
  });

  it('keeps Jess quiet when she or you are off the road, or she is too far', () => {
    expect(new TarmacWatch({ ...P }).update(0.1, { you: you({ onRoad: false }), girls: [jess()] })).toEqual([]);
    expect(new TarmacWatch({ ...P }).update(0.1, { you: you(), girls: [jess({ onRoad: false })] })).toEqual([]);
    expect(new TarmacWatch({ ...P }).update(0.1, { you: you(), girls: [jess({ distance: P.eggRange + 1 })] })).toEqual([]);
    expect(new TarmacWatch({ ...P }).update(0.1, { you: null, girls: [jess()] })).toEqual([]);
  });

  it('has Jess on your back egg you on only when you are going', () => {
    expect(new TarmacWatch({ ...P }).update(0.1, { you: you({ speed: 3 }), girls: [jess({ role: 'pillion' })] })).toEqual([]);
    expect(new TarmacWatch({ ...P }).update(0.1, { you: you(), girls: [jess({ role: 'pillion' })] })).toHaveLength(1);
  });

  it('has Amy scold only after the tyres have squealed for a moment', () => {
    const w = new TarmacWatch({ ...P });
    const ctx = { you: you({ squeal: 0.8 }), girls: [amy({ role: 'pillion' })] };
    expect(w.update(P.squealFor / 2, ctx)).toEqual([]);
    expect(w.update(P.squealFor, ctx)).toEqual([{ type: 'scold', girl: 'amy' }]);
    expect(w.update(P.squealFor * 2, ctx)).toEqual([]);
  });

  it('lets a squeal that stops reset the count, and ignores one off the road', () => {
    const w = new TarmacWatch({ ...P });
    w.update(P.squealFor * 0.8, { you: you({ squeal: 0.8 }), girls: [amy({ role: 'pillion' })] });
    w.update(0.1, { you: you({ squeal: 0 }), girls: [amy({ role: 'pillion' })] });
    expect(w.update(P.squealFor * 0.8, { you: you({ squeal: 0.8 }), girls: [amy({ role: 'pillion' })] })).toEqual([]);
    expect(new TarmacWatch({ ...P }).update(5, { you: you({ onRoad: false, squeal: 1 }), girls: [amy({ role: 'pillion' })] })).toEqual([]);
  });

  it('has Amy scold from the verge only if she is free and near, and not while she drives', () => {
    const squeal = you({ squeal: 1 });
    expect(new TarmacWatch({ ...P }).update(1, { you: squeal, girls: [amy()] })).toHaveLength(1);
    expect(new TarmacWatch({ ...P }).update(1, { you: squeal, girls: [amy({ distance: 80 })] })).toEqual([]);
    expect(new TarmacWatch({ ...P }).update(1, { you: squeal, girls: [amy({ role: 'driving' })] })).toEqual([]);
  });

  it('has lines for each remark', () => {
    expect(AMY_TARMAC_LINES.roadOn.lines.length).toBeGreaterThan(0);
    expect(AMY_TARMAC_LINES.roadScold.lines.length).toBeGreaterThan(0);
    expect(JESS_TARMAC_LINES.roadOn.length).toBeGreaterThan(0);
    expect(JESS_TARMAC_LINES.roadEgg.length).toBeGreaterThan(0);
  });
});

describe('her driving on the road', () => {
  it('rides faster once on the tarmac and mentions it, and goes back off it', () => {
    const quad = { engine: { isRunning: true }, fuel: {}, choke: {}, position: { x: 100, z: 2 }, yaw: 0, forwardSpeed: 0 };
    const d = new HerDrive(quad, { params: { ...DEFAULT_COMPANION_PARAMS }, probe: () => Infinity, isClear: () => true, tarmac: { at: (x, z) => onTarmac(road, x, z), p: { ...P } } });
    d.updateRoadPace(1);
    expect(d.roadPace).toBeGreaterThan(1);
    expect(d.events).toContain('onRoad');
    for (let i = 0; i < 10; i++) d.updateRoadPace(1);
    expect(d.roadPace).toBeCloseTo(P.speedBoost);
    quad.position.z = 20;
    for (let i = 0; i < 10; i++) d.updateRoadPace(1);
    expect(d.roadPace).toBe(1);
  });

  it('does not speed up following you, or without a road', () => {
    const quad = { engine: { isRunning: true }, fuel: {}, choke: {}, position: { x: 100, z: 2 }, yaw: 0, forwardSpeed: 0 };
    const base = { params: { ...DEFAULT_COMPANION_PARAMS }, probe: () => Infinity, isClear: () => true };
    const following = new HerDrive(quad, { ...base, follow: () => quad, tarmac: { at: () => true, p: { ...P } } });
    following.updateRoadPace(5);
    expect(following.roadPace).toBe(1);
    const none = new HerDrive(quad, base);
    none.updateRoadPace(5);
    expect(none.roadPace).toBe(1);
  });
});
