import { describe, it, expect } from 'vitest';
import { DEFAULT_BODY_SHAKE_PARAMS as P, BODY_SHAKE_PARAM_RANGES, SPRINGS, REGIONS, stillShake, shakeStep, shakeOffsets, shakeWeights, jolt, figureGive } from '../src/npc/bodyShake.js';

const AMY = { bust: 1, hips: 0.95 };
const JESS = { bust: 1.4, hips: 1.2 };

/** Her bust's height offset over `seconds` after a jolt upward of `accel` for 0.05 s (20: a metre a second, a drop of about 5 cm), at 60 frames a second. */
function bump(figure = AMY, { accel = 20, seconds = 2, p = P } = {}) {
  const s = stillShake();
  const ys = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    shakeStep(s, [0, t < 0.05 ? accel : 0, 0], 1 / 60, p);
    ys.push(shakeOffsets(s, 0, p, figure).bust[1]);
  }
  return ys;
}

describe('a body that gives with the shake', () => {
  it('has a tuning range for every param, and stiffness, damping and give for every spring', () => {
    expect(Object.keys(BODY_SHAKE_PARAM_RANGES).sort()).toEqual(Object.keys(P).sort());
    for (const k of SPRINGS) for (const t of ['Stiffness', 'Damping', 'Give']) expect(P[`${k}${t}`]).toBeGreaterThan(0);
    for (const r of REGIONS) expect(SPRINGS).toContain(r.spring);
  });

  it('stays still when nothing moves her', () => {
    const s = stillShake();
    for (let i = 0; i < 60; i++) shakeStep(s, [0, 0, 0], 1 / 60);
    const o = shakeOffsets(s, 0, P, AMY);
    for (const k of SPRINGS) expect(o[k]).toEqual([0, 0, 0]);
  });

  it('a bump throws her bust down, and it settles over a couple of swings', () => {
    const ys = bump();
    const low = Math.min(...ys);
    expect(low).toBeLessThan(-0.01); // clearly visible: over a centimetre
    // It swings back up past where it rests at least once...
    const after = ys.slice(ys.indexOf(low));
    expect(Math.max(...after)).toBeGreaterThan(0.002);
    // ...and has settled within a second and a half.
    const late = ys.slice(Math.round(1.5 * 60));
    expect(Math.max(...late.map(Math.abs))).toBeLessThan(Math.abs(low) * 0.1);
  });

  it('moves the fuller figure more', () => {
    expect(Math.min(...bump(JESS))).toBeLessThan(Math.min(...bump(AMY)));
    expect(figureGive(JESS).seat).toBeGreaterThan(figureGive(AMY).seat);
    expect(figureGive({ bust: 0 }).bust).toBe(0);
  });

  it('eases a big jolt into maxOffset, a fuller figure a little further', () => {
    const most = P.maxOffset * Math.sqrt(figureGive(JESS).bust);
    const ys = bump(JESS, { accel: 60 });
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-most);
    expect(Math.min(...bump(JESS, { accel: 60 }))).toBeLessThan(Math.min(...bump(AMY, { accel: 60 })));
    const o = shakeOffsets(stillShake(), 0.05, P, JESS);
    for (const k of SPRINGS) expect(Math.hypot(...o[k])).toBeLessThanOrEqual(P.maxOffset * Math.sqrt(figureGive(JESS)[k]));
  });

  it("shows the running seat's heave as a shiver, the other way from the seat", () => {
    const o = shakeOffsets(stillShake(), 0.004, P, AMY);
    // A warm idle's few millimetres show plainly; a rough quad's heave tops out rather than swamping her.
    expect(o.bust[1]).toBeLessThan(-0.005);
    expect(o.bust[1]).toBeLessThan(o.belly[1]);
    expect(shakeOffsets(stillShake(), -0.004, P, AMY).bust[1]).toBeCloseTo(-o.bust[1], 9);
    const rough = shakeOffsets(stillShake(), 0.036, P, AMY).bust[1];
    expect(rough).toBeGreaterThanOrEqual(-P.shiver * P.bustGive - 1e-9);
  });

  it('holds still with strength at 0', () => {
    const ys = bump(JESS, { p: { ...P, strength: 0 } });
    expect(Math.max(...ys.map(Math.abs))).toBe(0);
  });

  it('stays steady at a low frame rate and after a wild jolt', () => {
    const s = stillShake();
    for (let i = 0; i < 50; i++) shakeStep(s, [i % 2 ? 500 : -500, 0, 0], 0.1);
    for (let i = 0; i < 100; i++) shakeStep(s, [0, 0, 0], 0.1);
    const o = shakeOffsets(s, 0, P, JESS);
    for (const k of SPRINGS) for (const v of o[k]) expect(Math.abs(v)).toBeLessThan(1e-3);
  });

  it('a jolt from the panel sets her moving and she settles', () => {
    const s = jolt(stillShake(), 0.6);
    shakeStep(s, [0, 0, 0], 0.05);
    expect(shakeOffsets(s, 0, P, AMY).bust[1]).toBeLessThan(-0.005);
    for (let i = 0; i < 180; i++) shakeStep(s, [0, 0, 0], 1 / 60);
    expect(Math.abs(shakeOffsets(s, 0, P, AMY).bust[1])).toBeLessThan(0.001);
  });
});

describe('which parts of her move', () => {
  const frame = { apex: { x: 0.12, y: 0.7, z: 0.3 }, arms: { L: { y: 0.95, z: 0.02 }, R: { y: 0.95, z: 0.02 } }, hip: { y: -0.1 }, knee: { y: -0.95 } };
  const none = { armL: 0, armR: 0, legL: 0, legR: 0 };
  const at = (q, skin = none) => Object.fromEntries(REGIONS.map((r, i) => [r.name, shakeWeights(q, skin, frame)[i]]));

  it('her bust most at its apex, and none of her back', () => {
    expect(at({ x: 0.12, y: 0.7, z: 0.3 }).bust).toBeCloseTo(1, 5);
    expect(at({ x: -0.12, y: 0.7, z: 0.3 }).bust).toBeCloseTo(1, 5);
    expect(at({ x: 0.12, y: 0.7, z: -0.05 }).bust).toBe(0);
    expect(at({ x: 0.12, y: 0.2, z: 0.2 }).bust).toBe(0);
  });

  it('a bigger bust covers more of her', () => {
    const q = { x: 0.12, y: 0.5, z: 0.25 };
    expect(shakeWeights(q, none, { ...frame, bust: 1.4 })[0]).toBeGreaterThan(shakeWeights(q, none, frame)[0]);
  });

  it('her belly in front, and not where her bust is', () => {
    expect(at({ x: 0, y: 0.28, z: 0.2 }).belly).toBeGreaterThan(0.9);
    expect(at({ x: 0, y: 0.28, z: -0.1 }).belly).toBe(0);
    expect(at({ x: 0.12, y: 0.7, z: 0.3 }).belly).toBe(0);
  });

  it('the backs of her upper arms, not the tops', () => {
    const underneath = at({ x: 0.5, y: 0.9, z: -0.03 }, { ...none, armL: 1 });
    const top = at({ x: 0.5, y: 1.0, z: 0.07 }, { ...none, armL: 1 });
    expect(underneath.armL).toBeGreaterThan(0.9);
    expect(top.armL).toBeLessThan(0.05);
    expect(underneath.armR).toBe(0);
  });

  it('her seat behind and her thighs, sharing one spring where they meet', () => {
    expect(at({ x: 0.1, y: -0.2, z: -0.15 }).seat).toBeGreaterThan(0.9);
    expect(at({ x: 0.1, y: -0.2, z: 0.2 }).seat).toBe(0);
    expect(at({ x: 0.1, y: -0.45, z: 0 }, { ...none, legL: 1 }).thighL).toBeGreaterThan(0.7);
    const both = at({ x: 0.1, y: -0.35, z: -0.15 }, { ...none, legL: 1 });
    expect(both.seat + both.thighL + both.thighR).toBeLessThanOrEqual(1 + 1e-9);
  });
});
