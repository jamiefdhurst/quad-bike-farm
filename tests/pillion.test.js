import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { solveTwoBone, orientHand } from '../src/npc/armIK.js';
import { PillionDynamics } from '../src/npc/pillionDynamics.js';
import { DEFAULT_PILLION_PARAMS } from '../src/npc/pillionParams.js';

/** A left arm hanging straight down from a shoulder at (0.2, 1.4, 0), 0.2 + 0.16 m long, with a hand. */
function makeArm() {
  const root = new THREE.Group();
  const shoulder = new THREE.Bone();
  shoulder.position.set(0.2, 1.4, 0);
  const elbow = new THREE.Bone();
  elbow.position.set(0, -0.2, 0);
  const wrist = new THREE.Bone();
  wrist.position.set(0, -0.16, 0);
  const finger = new THREE.Bone();
  finger.position.set(0, -0.07, 0);
  const thumb = new THREE.Bone();
  thumb.position.set(-0.02, -0.03, 0.02);
  root.add(shoulder);
  shoulder.add(elbow);
  elbow.add(wrist);
  wrist.add(finger, thumb);
  root.updateMatrixWorld(true);
  return { root, shoulder, elbow, wrist, finger, thumb };
}

const world = (o) => o.getWorldPosition(new THREE.Vector3());

describe('two-bone arm IK', () => {
  it('puts the wrist on a reachable target with the elbow toward the pole', () => {
    const a = makeArm();
    const target = new THREE.Vector3(0.1, 1.2, 0.25);
    const pole = new THREE.Vector3(0.6, 1.2, 0);
    solveTwoBone(a.shoulder, a.elbow, a.wrist, target, pole);
    expect(world(a.wrist).distanceTo(target)).toBeLessThan(1e-4);
    // Bone lengths are kept.
    expect(world(a.shoulder).distanceTo(world(a.elbow))).toBeCloseTo(0.2, 4);
    expect(world(a.elbow).distanceTo(world(a.wrist))).toBeCloseTo(0.16, 4);
    // The elbow bends out toward the pole (+X) rather than in.
    const mid = world(a.shoulder).lerp(target, 0.5);
    expect(world(a.elbow).x).toBeGreaterThan(mid.x);
  });

  it('reaches toward a target out of reach without locking straight', () => {
    const a = makeArm();
    const target = new THREE.Vector3(0.2, 1.4, 1.0);
    const short = solveTwoBone(a.shoulder, a.elbow, a.wrist, target, new THREE.Vector3(0.6, 1.0, 0));
    expect(short).toBeGreaterThan(0.6);
    const dir = world(a.wrist).sub(world(a.shoulder));
    expect(dir.length()).toBeLessThan(0.36);
    expect(dir.normalize().z).toBeGreaterThan(0.999);
  });

  it('leaves the pose alone at zero weight and goes part way at half', () => {
    const a = makeArm();
    const before = world(a.wrist);
    const target = new THREE.Vector3(0.1, 1.2, 0.25);
    const pole = new THREE.Vector3(0.6, 1.2, 0);
    solveTwoBone(a.shoulder, a.elbow, a.wrist, target, pole, 0);
    expect(world(a.wrist).distanceTo(before)).toBeLessThan(1e-9);
    solveTwoBone(a.shoulder, a.elbow, a.wrist, target, pole, 0.5);
    const half = world(a.wrist);
    expect(half.distanceTo(before)).toBeGreaterThan(0.05);
    expect(half.distanceTo(target)).toBeGreaterThan(0.05);
  });

  it('turns a hand to point its fingers and palm the way asked', () => {
    const a = makeArm();
    const fingers = new THREE.Vector3(-1, 0, 0);
    const palm = new THREE.Vector3(0, 0, -1);
    orientHand(a.wrist, a.finger, a.thumb, fingers, palm, 1);
    const f = world(a.finger).sub(world(a.wrist)).normalize();
    expect(f.dot(fingers)).toBeGreaterThan(0.999);
    // The thumb stays on the same side of the palm it started on.
    const t = world(a.thumb).sub(world(a.wrist));
    t.addScaledVector(f, -t.dot(f));
    const n = new THREE.Vector3().crossVectors(f, t).normalize();
    expect(n.dot(palm)).toBeGreaterThan(0.999);
  });
});

describe('pillion dynamics', () => {
  const run = (d, seconds, motion) => {
    for (let t = 0; t < seconds; t += 1 / 60) d.update(1 / 60, motion);
  };

  it('stays upright riding steadily in a straight line', () => {
    const d = new PillionDynamics({ ...DEFAULT_PILLION_PARAMS });
    run(d, 3, { forward: 10, up: 0, yawRate: 0 });
    expect(Math.abs(d.roll.x)).toBeLessThan(1e-3);
    expect(Math.abs(d.pitch.x)).toBeLessThan(1e-3);
  });

  it('leans into a left turn and the other way into a right one', () => {
    const left = new PillionDynamics({ ...DEFAULT_PILLION_PARAMS });
    run(left, 3, { forward: 8, up: 0, yawRate: 0.5 });
    expect(left.accel.left).toBeCloseTo(4, 1);
    expect(left.roll.x).toBeCloseTo(4 * DEFAULT_PILLION_PARAMS.leanPerAccel, 2);
    const right = new PillionDynamics({ ...DEFAULT_PILLION_PARAMS });
    run(right, 3, { forward: 8, up: 0, yawRate: -0.5 });
    expect(right.roll.x).toBeCloseTo(-left.roll.x, 5);
  });

  it('caps the lean in a very hard turn', () => {
    const d = new PillionDynamics({ ...DEFAULT_PILLION_PARAMS });
    run(d, 3, { forward: 12, up: 0, yawRate: 2 });
    expect(d.roll.x).toBeLessThanOrEqual(DEFAULT_PILLION_PARAMS.leanMax + 0.01);
  });

  it('is pushed forward harder braking than accelerating', () => {
    const accel = new PillionDynamics({ ...DEFAULT_PILLION_PARAMS });
    const brake = new PillionDynamics({ ...DEFAULT_PILLION_PARAMS });
    let va = 0;
    let vb = 15;
    for (let t = 0; t < 1.5; t += 1 / 60) {
      accel.update(1 / 60, { forward: (va += 5 / 60), up: 0, yawRate: 0 });
      brake.update(1 / 60, { forward: (vb -= 5 / 60), up: 0, yawRate: 0 });
    }
    expect(accel.pitch.x).toBeGreaterThan(0.02);
    expect(brake.pitch.x).toBeGreaterThan(accel.pitch.x * 2);
  });

  it('is squashed down by a jolt up from the seat, then settles', () => {
    const d = new PillionDynamics({ ...DEFAULT_PILLION_PARAMS });
    run(d, 0.5, { forward: 5, up: 0, yawRate: 0 });
    d.update(1 / 60, { forward: 5, up: 0.5, yawRate: 0 });
    let low = 0;
    for (let i = 0; i < 20; i++) {
      d.update(1 / 60, { forward: 5, up: 0.5, yawRate: 0 });
      low = Math.min(low, d.heave.x);
    }
    expect(low).toBeLessThan(-0.002);
    run(d, 4, { forward: 5, up: 0.5, yawRate: 0 });
    expect(Math.abs(d.heave.x)).toBeLessThan(5e-4);
  });
});
