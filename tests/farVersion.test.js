import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { farTriangles, buildFarVersion, drawFull } from '../src/world/farVersion.js';
import { farVillage } from '../src/world/villageProps.js';
import { farNeighbourFarm } from '../src/world/neighbourFarmProps.js';
import { villageShape } from '../src/world/village.js';
import { neighbourFarmShape } from '../src/world/neighbourFarm.js';
import { LAYOUT } from '../src/world/layout.js';

const house = { x: 10, z: 20, y: 2, halfX: 4, halfZ: 3, wallHeight: 4, ridge: 6.5, wall: '#8c877a', roof: '#42474c' };
const bounds = (positions) => {
  const b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      b.min[k] = Math.min(b.min[k], positions[i + k]);
      b.max[k] = Math.max(b.max[k], positions[i + k]);
    }
  }
  return b;
};

describe('farTriangles', () => {
  it('draws a building as walls, two gables and two roof slopes, one colour a vertex', () => {
    const { positions, colors } = farTriangles({ buildings: [house] });
    expect(positions.length).toBe(colors.length);
    expect(positions.length / 9).toBe(10 + 2 + 4); // five wall faces, two gables, two slopes of two triangles
  });
  it('stands the building on its floor, to the ridge, with the roof overhanging the walls', () => {
    const b = bounds(farTriangles({ buildings: [house] }).positions);
    expect(b.max[1]).toBeCloseTo(2 + 6.5);
    expect(b.min[1]).toBeLessThan(2); // sunk a little into the ground
    expect(b.min[0]).toBeLessThan(10 - 4);
    expect(b.max[2]).toBeGreaterThan(20 + 3);
  });
  it('draws a wall as a box', () => {
    const { positions } = farTriangles({ walls: [{ x: 0, z: 0, hx: 10, hz: 0.25, y: 1, height: 1.3, color: '#888888' }] });
    const b = bounds(positions);
    expect(b.max[1]).toBeCloseTo(2.3);
    expect(b.max[0]).toBeCloseTo(10);
  });
  it('is empty for nothing', () => {
    expect(buildFarVersion('x', {}).children).toHaveLength(0);
  });
});

describe('buildFarVersion', () => {
  it('is one named mesh that casts no shadow', () => {
    const g = buildFarVersion('somethingFar', { buildings: [house] });
    expect(g.name).toBe('somethingFar');
    const meshes = [];
    g.traverse((o) => o.isMesh && meshes.push(o));
    expect(meshes).toHaveLength(1);
    expect(meshes[0].castShadow).toBe(false);
    expect(meshes[0].geometry.getAttribute('normal')).toBeTruthy();
  });
});

describe('drawFull', () => {
  it('is full within the distance and far beyond it', () => {
    expect(drawFull(30, 45, false, 10)).toBe(true);
    expect(drawFull(60, 45, false, 10)).toBe(false);
  });
  it('holds the full version a margin further out once drawn, so it does not flicker on the line', () => {
    expect(drawFull(50, 45, true, 10)).toBe(true);
    expect(drawFull(50, 45, false, 10)).toBe(false);
    expect(drawFull(56, 45, true, 10)).toBe(false);
  });
  it('is always full with a distance of 0', () => {
    expect(drawFull(900, 0, false, 10)).toBe(true);
  });
});

describe('the far versions of the farm', () => {
  const heights = { heightAt: () => 3 };
  const count = (g) => {
    let n = 0;
    g.traverse((o) => o.isMesh && n++);
    return n;
  };
  it('has the village as one mesh, a box and roof for every building', () => {
    const S = villageShape(LAYOUT);
    const g = farVillage(S, heights);
    expect(g.name).toBe('villageFar');
    expect(count(g)).toBe(1);
    const mesh = g.children[0];
    expect(mesh.geometry.getAttribute('position').count / 3).toBe(S.buildings.length * 16);
  });
  it('has the neighbour farm as one mesh: the house, the barn and the yard wall', () => {
    const s = neighbourFarmShape(LAYOUT);
    const g = farNeighbourFarm(s, 3);
    expect(g.name).toBe('neighbourFarmFar');
    expect(count(g)).toBe(1);
    expect(g.children[0].geometry.getAttribute('position').count / 3).toBe(2 * 16 + s.walls.length * 10);
  });
  it('lies over the same ground as the full pieces, within the village and the yard', () => {
    const S = villageShape(LAYOUT);
    const g = farVillage(S, heights);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    expect(box.min.x).toBeGreaterThan(S.area.minX - 2);
    expect(box.max.x).toBeLessThan(S.area.maxX + 2);
  });
});
