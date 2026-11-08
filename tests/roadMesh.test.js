import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { LAYOUT } from '../src/world/layout.js';
import { roadNetwork, dashes } from '../src/world/roads.js';
import { tarmacPixels, buildRoadMesh, roadStrip, paintMarks, kerbFace } from '../src/world/roadMesh.js';
import { LANE_TARMAC_LIFT } from '../src/world/props.js';

const net = roadNetwork(LAYOUT);
const heights = { heightAt: (x, z) => 0.01 * x + 0.02 * z };

describe('the tarmac of a road', () => {
  const px = (data, size, x, y) => data[(y * size + x) * 4];
  const mean = (data, size, x0, x1) => {
    let sum = 0;
    let n = 0;
    for (let y = 0; y < size; y++) for (let x = x0; x < x1; x++) (sum += px(data, size, x, y)), n++;
    return sum / n;
  };

  it('is the same every time for a seed and different for another', () => {
    expect(Array.from(tarmacPixels({ size: 32 }))).toEqual(Array.from(tarmacPixels({ size: 32 })));
    expect(Array.from(tarmacPixels({ size: 32, seed: 5 }))).not.toEqual(Array.from(tarmacPixels({ size: 32 })));
  });

  it('is worn darker down the wheel tracks and paler and grittier at the edges', () => {
    const size = 128;
    const d = tarmacPixels({ size });
    const track = mean(d, size, Math.round(0.27 * size) - 1, Math.round(0.27 * size) + 2);
    const middle = mean(d, size, Math.round(0.5 * size) - 1, Math.round(0.5 * size) + 2);
    const edge = mean(d, size, 0, 3);
    expect(track).toBeLessThan(middle - 3);
    expect(edge).toBeGreaterThan(middle + 3);
  });

  it('has repairs when it is given patches, and none when it is not', () => {
    const plain = tarmacPixels({ size: 128 });
    const patched = tarmacPixels({ size: 128, patches: 4 });
    let changed = 0;
    for (let i = 0; i < plain.length; i += 4) if (Math.abs(plain[i] - patched[i]) > 4) changed++;
    expect(changed).toBeGreaterThan(300);
    expect(Array.from(tarmacPixels({ size: 128, patches: 0 }))).toEqual(Array.from(plain));
  });
});

describe('the dashes of a centre line', () => {
  it('lay a dash every on + off metres, the last one cut short at the end', () => {
    const d = dashes({ on: 3, off: 6, to: 20 });
    expect(d.map((m) => [m.s, m.len])).toEqual([[1.5, 3], [10.5, 3], [19, 2]]);
    expect(d[0]).toMatchObject({ a: -0.07, b: 0.07 });
  });
});

describe('the road mesh builder', () => {
  it('lays the lane as a strip of carriageway the width of the road with its dashed line over it', () => {
    const scene = new THREE.Scene();
    const points = net.pointsAlong('lane', { step: 1, to: 60 });
    const meshes = buildRoadMesh({ scene, road: net.road('lane'), points, heights, texture: null });
    expect(meshes.length).toBe(2);
    expect(scene.children.length).toBe(2);
    const body = meshes[0].geometry.attributes.position;
    const xs = Array.from({ length: body.count }, (_, i) => body.getX(i));
    expect(Math.min(...xs)).toBeCloseTo(LAYOUT.publicLane.x - LAYOUT.publicLane.halfWidth, 3);
    expect(Math.max(...xs)).toBeCloseTo(LAYOUT.publicLane.x + LAYOUT.publicLane.halfWidth, 3);
    // It lies on the ground, lifted: the road's own lift is the one traffic stands things on.
    expect(net.road('lane').lift).toBe(LANE_TARMAC_LIFT);
    for (let i = 0; i < body.count; i += 7) expect(body.getY(i)).toBeCloseTo(heights.heightAt(body.getX(i), body.getZ(i)) + LANE_TARMAC_LIFT, 3);
    // The dashes sit a little above the carriageway.
    const line = meshes[1].geometry.attributes.position;
    for (let i = 0; i < line.count; i += 3) expect(line.getY(i)).toBeCloseTo(heights.heightAt(line.getX(i), line.getZ(i)) + LANE_TARMAC_LIFT + 0.02, 3);
  });

  it('lays an edge line down each side when the road has one', () => {
    const scene = new THREE.Scene();
    const road = { ...net.road('lane'), markings: { centre: 'none', edge: true } };
    const meshes = buildRoadMesh({ scene, road, points: net.pointsAlong('lane', { step: 2, to: 30 }), heights, texture: null });
    expect(meshes.length).toBe(3);
    const line = meshes[1].geometry.attributes.position;
    const xs = Array.from({ length: line.count }, (_, i) => line.getX(i));
    expect(Math.max(...xs) - LAYOUT.publicLane.x).toBeCloseTo(LAYOUT.publicLane.halfWidth - 0.2, 3);
  });

  it('draws a road with no centre line without one', () => {
    const scene = new THREE.Scene();
    const road = { ...net.road('lane'), markings: { centre: 'none' } };
    expect(buildRoadMesh({ scene, road, points: net.pointsAlong('lane', { step: 2, to: 30 }), heights, texture: null }).length).toBe(1);
  });

  it('builds strips, marks and a kerb along the village street for its pavements', () => {
    const samples = net.road('street').samples;
    const ctx = { samples, heights };
    const mat = new THREE.MeshBasicMaterial();
    const strips = roadStrip(ctx, -2.3, 2.3, 0.075, mat, { from: 14, skip: (p) => p.x < -20 });
    expect(strips.length).toBeGreaterThan(0);
    expect(paintMarks(ctx, dashes({ on: 2, off: 4, to: 30, width: 0.1 }), mat, 0.08)).toBeTruthy();
    expect(paintMarks(ctx, [], mat, 0.08)).toBeNull();
    expect(kerbFace(ctx, 2.3, 0.075, 0.16, mat, { from: 16 }).geometry.index.count).toBeGreaterThan(0);
  });
});
