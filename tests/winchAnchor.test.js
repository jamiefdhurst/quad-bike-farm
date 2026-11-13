import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { isHeavy, pickTree, trunkHookPoint, cableLoad, creakGap } from '../src/items/winchAnchor.js';
import { Winch } from '../src/items/winch.js';
import { creakSamples } from '../src/audio/winchAudio.js';

const tree = { x: 0, y: 0, z: 10, r: 0.4 };

describe('what the winch can hook', () => {
  it('treats the tractor, cars, the Tor, the Crag and the UTV as anchors, not things to drag', () => {
    expect(isHeavy({ tractor: true })).toBe(true);
    expect(isHeavy({ landRover: true })).toBe(true);
    expect(isHeavy({ car: true })).toBe(true);
    expect(isHeavy({ utv: true })).toBe(true);
    expect(isHeavy({})).toBe(false);
    expect(isHeavy(null)).toBe(false);
  });

  it('picks the trunk you look at and not one behind you, off to the side or too far', () => {
    const eye = { x: 0, y: 1.6, z: 0 };
    expect(pickTree([tree], eye, { x: 0, y: 0, z: 1 }, 20)).toBe(tree);
    expect(pickTree([tree], eye, { x: 0, y: 0, z: -1 }, 20)).toBe(null);
    expect(pickTree([tree], eye, { x: 1, y: 0, z: 0 }, 20)).toBe(null);
    expect(pickTree([tree], eye, { x: 0, y: 0, z: 1 }, 6)).toBe(null);
  });

  it('picks the nearer of two trunks in line', () => {
    const far = { x: 0, y: 0, z: 14, r: 0.4 };
    expect(pickTree([far, tree], { x: 0, y: 1.6, z: 0 }, { x: 0, y: 0, z: 1 }, 20)).toBe(tree);
  });

  it('puts the hook on the side of the trunk facing the winch', () => {
    const p = trunkHookPoint(tree, { x: 0, y: 0, z: 0 });
    expect(p.z).toBeCloseTo(9.6, 5);
    expect(p.y).toBeGreaterThan(0);
  });

  it('measures the load and when to groan', () => {
    expect(cableLoad(3250, 6500)).toBeCloseTo(0.5, 5);
    expect(cableLoad(99999, 6500)).toBe(1);
    expect(creakGap(0.05, true)).toBe(null);
    expect(creakGap(0.9, false)).toBe(null);
    expect(creakGap(1, true)).toBeLessThan(creakGap(0.3, true));
  });

  it('makes a groan of samples that is not silent', () => {
    const s = creakSamples(8000);
    expect(s.length).toBeGreaterThan(1000);
    expect(Math.max(...s.map(Math.abs))).toBeGreaterThan(0.05);
  });
});

/** A stand-in quad at (x, z) facing +z that records the impulses it is given. */
function fakeQuad(x, z, spec = {}) {
  const impulses = [];
  const self = {
    spec,
    towed: false,
    impulses,
    position: new THREE.Vector3(x, 0, z),
    // 300 kg, one step of 0.02 s: the impulse moves it, so a pulled vehicle really does come closer.
    physics: { body: { applyImpulseAtPoint: (i) => { impulses.push(i); self.position.z += (i.z / 300) * 0.02; } } },
    localToWorld: (lx, ly, lz) => new THREE.Vector3(self.position.x + lx, ly, self.position.z + lz),
    model: { getObjectByName: (n) => (n === 'winchFairlead' ? { getWorldPosition: (o) => o.set(self.position.x, 0.5, self.position.z + 1) } : null) },
  };
  return self;
}
const camera = { add() {}, };

function rig(otherSpec) {
  const green = fakeQuad(0, 0);
  const winch = new Winch({ scene: { add() {} }, unit: { quad: green } });
  winch.handHook.removeFromParent = () => {};
  return { green, winch, other: fakeQuad(0, 12, otherSpec) };
}

describe('the winch on a tree', () => {
  it('pulls the green towards the tree once the cable is tight, with its brakes off, and winds in', () => {
    const { green, winch } = rig();
    winch.take(camera);
    winch.hookTree({ x: 0, y: 0, z: 10, r: 0.4 });
    expect(winch.selfPull).toBe(true);
    winch.fixedUpdate(0.02, true);
    expect(winch.cable).toBeLessThan(9.5);
    for (let i = 0; i < 100; i++) winch.fixedUpdate(0.02, true);
    expect(winch.tight).toBe(true);
    expect(green.towed).toBe(true);
    const last = green.impulses.at(-1);
    expect(last.z).toBeGreaterThan(0); // towards the tree
    expect(Math.hypot(last.x, last.y, last.z) / 0.02).toBeLessThanOrEqual(winch.params.maxPull + 1);
    winch.unhook(camera);
    expect(green.towed).toBe(false);
  });

  it('stops winding at stopAt from the fairlead', () => {
    const { winch } = rig();
    winch.take(camera);
    winch.hookTree({ x: 0, y: 0, z: 10, r: 0.4 });
    for (let i = 0; i < 2000; i++) winch.fixedUpdate(0.02, true);
    expect(winch.cable).toBeCloseTo(winch.params.stopAt, 5);
  });
});

describe('the winch on another vehicle', () => {
  it('drags a light quad to the green and lets its brakes go', () => {
    const { green, winch, other } = rig();
    winch.take(camera);
    winch.hookOn(other);
    expect(winch.selfPull).toBe(false);
    expect(other.towed).toBe(true);
    for (let i = 0; i < 200; i++) winch.fixedUpdate(0.02, true);
    expect(other.impulses.at(-1).z).toBeLessThan(0);
    expect(green.impulses.length).toBe(0);
    winch.unhook(camera);
    expect(other.towed).toBe(false);
  });

  it('never drags the tractor: the green pulls itself to it', () => {
    const { green, winch, other } = rig({ tractor: true });
    winch.take(camera);
    winch.hookOn(other);
    expect(winch.selfPull).toBe(true);
    expect(other.towed).toBe(false);
    for (let i = 0; i < 200; i++) winch.fixedUpdate(0.02, true);
    expect(other.impulses.length).toBe(0);
    expect(green.impulses.at(-1).z).toBeGreaterThan(0);
    winch.stow();
    expect(green.towed).toBe(false);
  });

  it('groans while winding under load', () => {
    const { winch } = rig();
    let n = 0;
    winch.onCreak = () => n++;
    winch.take(camera);
    winch.hookTree({ x: 0, y: 0, z: 10, r: 0.4 });
    for (let i = 0; i < 400; i++) {
      winch.fixedUpdate(0.02, true);
      winch.update(0.02);
    }
    expect(n).toBeGreaterThan(0);
  });
});
