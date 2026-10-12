import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TowRope, ropeForce, ropeLengthFor, isSnatch, DEFAULT_TOW_ROPE_PARAMS as P } from '../src/items/towRope.js';

/** A stand-in quad: a point that faces +z, with a body that records the impulses it is given. */
function fakeQuad(x, z, yaw = 0) {
  const impulses = [];
  return {
    position: new THREE.Vector3(x, 0, z),
    yaw,
    towed: false,
    impulses,
    physics: { body: { applyImpulseAtPoint: (i) => impulses.push(i) } },
    localToWorld(lx, ly, lz) {
      return new THREE.Vector3(x + Math.sin(yaw) * lz + Math.cos(yaw) * lx, ly, z + Math.cos(yaw) * lz - Math.sin(yaw) * lx);
    },
  };
}

describe('the tow rope force', () => {
  it('pulls nothing while slack', () => {
    expect(ropeForce(0, 5)).toBe(0);
    expect(ropeForce(-0.5, 5)).toBe(0);
  });

  it('pulls harder the further it stretches, and harder still while it is stretching quickly', () => {
    expect(ropeForce(0.2, 0)).toBeCloseTo(0.2 * P.stiffness, 5);
    expect(ropeForce(0.2, 2)).toBeGreaterThan(ropeForce(0.2, 0));
    expect(ropeForce(0.2, -3)).toBeCloseTo(0.2 * P.stiffness, 5); // coming back in adds nothing
  });

  it('never pulls more than its limit', () => {
    expect(ropeForce(50, 50)).toBe(P.maxPull);
  });

  it('is left a little slack when hooked, within its limits', () => {
    expect(ropeLengthFor(3)).toBeCloseTo(3 + P.extra, 5);
    expect(ropeLengthFor(0.5)).toBe(P.minLength);
    expect(ropeLengthFor(20)).toBe(P.maxLength);
  });

  it('counts a quick take-up of the slack as a snatch, and a slow one as not', () => {
    expect(isSnatch(0.05, P.snatchRate + 0.1)).toBe(true);
    expect(isSnatch(0.05, P.snatchRate - 0.5)).toBe(false);
    expect(isSnatch(0, 10)).toBe(false); // still slack
  });
});

describe('hooking the rope on', () => {
  const setup = () => {
    const rope = new TowRope({ scene: new THREE.Scene() });
    const camera = new THREE.Object3D();
    const puller = fakeQuad(0, 0);
    const dead = fakeQuad(0, -4); // behind the puller
    return { rope, camera, puller, dead };
  };

  it('is taken from a quad, hooks a dead one (which then has its brakes off) and comes off again', () => {
    const { rope, camera, puller, dead } = setup();
    expect(rope.take(camera, puller)).toBe(true);
    expect(rope.hookOn(puller)).toBe(false); // not on the quad it came from
    expect(rope.hookOn(dead)).toBe(true);
    expect(dead.towed).toBe(true);
    expect(rope.length).toBeGreaterThanOrEqual(P.minLength);
    rope.unhook(camera);
    expect(dead.towed).toBe(false);
    expect(rope.state).toBe('carried');
    rope.stow();
    expect(rope.state).toBe('stowed');
  });

  it('does nothing while slack, then pulls the dead quad on and the towing quad back once tight', () => {
    const { rope, camera, puller, dead } = setup();
    rope.take(camera, puller);
    rope.hookOn(dead);
    rope.fixedUpdate(1 / 60);
    expect(dead.impulses).toHaveLength(0);
    const far = fakeQuad(0, 3); // the towing quad has driven off
    rope.puller = far;
    rope.fixedUpdate(1 / 60);
    expect(rope.tight).toBe(true);
    expect(dead.impulses).toHaveLength(1);
    expect(dead.impulses[0].z).toBeGreaterThan(0); // towards the hitch
    expect(far.impulses[0].z).toBeLessThan(0); // and the towing quad dragged back
  });

  it('reports a snatch when it goes tight at speed', () => {
    const { rope, camera, puller, dead } = setup();
    rope.take(camera, puller);
    rope.hookOn(dead);
    rope.fixedUpdate(1 / 60);
    rope.puller = fakeQuad(0, 3); // the hitch leapt away in one step
    rope.fixedUpdate(1 / 60);
    expect(rope.events).toContain('snatch');
  });
});
