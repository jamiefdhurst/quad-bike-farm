import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildJack, buildAxleStand } from '../src/workshop/jackModel.js';

const size = (o) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());

describe('the jack and the axle stands', () => {
  it('make a trolley jack of a believable size: low, under a metre long, with a handle', () => {
    const jack = buildJack();
    const s = size(jack);
    expect(jack.children.length).toBeGreaterThan(15);
    expect(s.y).toBeGreaterThan(0.3);
    expect(s.y).toBeLessThan(1);
    expect(s.x).toBeLessThan(1.6);
    expect(s.z).toBeLessThan(0.4);
  });
  it('make an axle stand under half a metre tall and standing on the floor', () => {
    const stand = buildAxleStand();
    const box = new THREE.Box3().setFromObject(stand);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(box.max.y).toBeGreaterThan(0.35);
    expect(box.max.y).toBeLessThan(0.6);
    expect(size(stand).x).toBeLessThan(0.5);
  });

  describe('holds together (#808)', () => {
    const named = (jack, name) => {
      const out = [];
      jack.traverse((o) => o.name === name && out.push(o));
      return out;
    };
    const rise = (jack) => {
      jack.updateMatrixWorld(true);
      return jack;
    };

    it('has the ram standing on its plate and its rod ending in the arm, not through it or short of it', () => {
      const jack = rise(buildJack());
      const ram = named(jack, 'jackRam')[0];
      const arm = named(jack, 'jackArm')[0];
      const plate = new THREE.Box3().setFromObject(named(jack, 'jackRamPlate')[0]);
      const up = new THREE.Vector3(0, 1, 0).transformDirection(ram.matrixWorld);
      const base = new THREE.Vector3(0, 0, 0).applyMatrix4(ram.matrixWorld);
      expect(base.y).toBeLessThan(plate.max.y); // sunk into the plate, so it is held
      expect(base.y).toBeGreaterThan(plate.min.y);
      // From the rod's end, 2 cm back down its length, the arm's underside is the first thing hit, within a few millimetres of the end.
      const tip = new THREE.Vector3(0, 0.108, 0).applyMatrix4(ram.matrixWorld);
      const rc = new THREE.Raycaster(tip.clone().addScaledVector(up, -0.02), up, 0, 0.1);
      const hit = rc.intersectObject(arm, true)[0];
      expect(hit).toBeTruthy();
      expect(hit.distance).toBeGreaterThan(0.015); // not already through the arm
      expect(hit.distance).toBeLessThan(0.025); // and not short of it: the end is within 5 mm of the underside
      // Nothing of the ram stands up above the arm.
      const top = new THREE.Box3().setFromObject(ram).max.y;
      const armTop = new THREE.Box3().setFromObject(arm).max.y;
      expect(top).toBeLessThan(armTop);
    });

    it('has the arm turning on a pin that goes through both ears, and the ears standing on the channels', () => {
      const jack = rise(buildJack());
      const pin = new THREE.Box3().setFromObject(named(jack, 'jackPivot')[0]);
      const ears = named(jack, 'jackEar').map((e) => new THREE.Box3().setFromObject(e));
      expect(ears.length).toBe(2);
      for (const ear of ears) {
        expect(ear.intersectsBox(pin)).toBe(true);
        expect(ear.min.y).toBeLessThan(0.135); // down into the channel, whose top is at 0.135
      }
    });
  });
});
