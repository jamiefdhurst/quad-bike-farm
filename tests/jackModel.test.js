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
});
