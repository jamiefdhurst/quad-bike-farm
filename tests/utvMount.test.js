import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { UtvMount } from '../src/vehicle/utvMount.js';
import { UTV_SEATS } from '../src/vehicle/utvModel.js';

// A model with just the anchors the mount looks for, standing at the origin facing +Z.
function fakeQuad(yaw = 0) {
  const model = new THREE.Group();
  for (const [name, s] of [['seatLeft', UTV_SEATS.left], ['seatMid', UTV_SEATS.mid], ['bedSeat', UTV_SEATS.bed]]) {
    const a = new THREE.Object3D();
    a.name = name;
    a.position.set(s.x, s.y, s.z);
    model.add(a);
  }
  model.rotation.y = yaw;
  model.updateMatrixWorld(true);
  return { model, yaw, speed: 0 };
}

describe('the UTV mount', () => {
  it('stands a girl beside her seat on the left, and behind the tailgate for the bed, facing the UTV', () => {
    const mount = new UtvMount(fakeQuad(), () => 0);
    const left = mount.standPoint(1, mount.slots.left);
    expect(left.position.x).toBeGreaterThan(1);
    expect(left.facing).toBeCloseTo(Math.atan2(-left.position.x, -left.position.z), 5);
    const bed = mount.standPoint(1, mount.slots.bed);
    expect(bed.position.z).toBeLessThan(-2);
    expect(Math.abs(bed.position.x)).toBeLessThan(0.01);
  });

  it('follows the UTV when it turns', () => {
    const mount = new UtvMount(fakeQuad(Math.PI / 2), () => 0);
    const bed = mount.standPoint(1, mount.slots.bed);
    expect(bed.position.x).toBeLessThan(-2); // behind it is now -x
  });

  it('offers the bench seats, never the bed, and the nearer one first', () => {
    const mount = new UtvMount(fakeQuad(), () => 0);
    const near = new THREE.Vector3(5, 0, 0);
    expect(mount.freeSlot(near)).not.toBe(mount.slots.bed);
    mount.slots.left.girl = {};
    expect(mount.freeSlot(near)).toBe(mount.slots.mid);
    mount.slots.mid.girl = {};
    expect(mount.freeSlot(near)).toBeNull();
    expect(mount.bedBusy).toBe(false);
    mount.slots.bed.girl = {};
    expect(mount.bedBusy).toBe(true);
  });

  it('knows which seat a girl is in, and shakes harder the faster it goes', () => {
    const quad = fakeQuad();
    const mount = new UtvMount(quad, () => 0);
    const jess = {};
    mount.slots.mid.girl = jess;
    expect(mount.seatOf(jess)).toBe('mid');
    mount.update(0.1);
    expect(mount.motion.jolt).toBe(0);
    quad.speed = 11;
    mount.update(0.1);
    expect(mount.motion.jolt).toBe(1);
    expect(mount.motion.speed).toBe(11);
  });
});
