import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, PLAN_ORIGIN } from '../src/world/layoutNew.js';
import { insideBarn } from '../src/world/barn.js';
import { visitPlaces, Visit, DEFAULT_TRAFFIC_PARAMS } from '../src/world/traffic.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';

// A visitor's whole drive, on either farm, stays out of the barn's walls and off the yard's trailers and tanks (#978).
const two = LAYOUT;

function drive(layout, kind) {
  const places = visitPlaces(layout);
  const visit = new Visit({ kind, places, from: 1, to: 1, leaveOpen: false, params: { ...DEFAULT_TRAFFIC_PARAMS } });
  const trail = [];
  let t = 0;
  while (!visit.done && t < 1500) {
    visit.update(0.1, { gate: undefined, gates: {}, blockers: [], swingSeconds: 1.8 });
    if (visit.current?.type === 'drive') trail.push({ x: visit.drive.x, z: visit.drive.z });
    t += 0.1;
  }
  return { done: visit.done, trail };
}

describe.each([['today\'s farm', LAYOUT], ['the new farm', two]])('a visitor on %s', (_, layout) => {
  for (const kind of ['post', 'neighbour']) {
    it(`(${kind}) gets in, turns round and gets away without driving into the barn`, () => {
      const { done, trail } = drive(layout, kind);
      expect(done).toBe(true);
      const worst = trail.find((p) => insideBarn(layout, p.x, p.z, -1)); // within a metre of the walls, or inside them
      expect(worst, worst && `${worst.x.toFixed(1)}, ${worst.z.toFixed(1)}`).toBeUndefined();
    });
  }
});

describe('a visitor on the new farm', () => {
  it('keeps 3 m from the trailers, the sprayer, the tanks and the harrows', () => {
    const { trail } = drive(two, 'post');
    for (const k of ['trailer', 'tipTrailer', 'sprayer', 'harrows', 'fuelTank', 'dieselBowser']) {
      const o = two[k];
      const near = Math.min(...trail.map((p) => Math.hypot(p.x - o.x, p.z - o.z)));
      expect(near, k).toBeGreaterThan(3);
    }
  });
  it('has the trailers in the yard, off the drive\'s line and outside what is kept clear', () => {
    for (const k of ['trailer', 'tipTrailer', 'sprayer']) {
      const [, z] = [two[k].x + PLAN_ORIGIN[0], two[k].z + PLAN_ORIGIN[1]];
      expect(Math.abs(z - 345), k).toBeGreaterThan(10);
    }
  });
});

describe('Home Ground\'s rail', () => {
  it('is drawn and solid along the whole boundary, with a gap at the gateway', async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildHomeRails } = await import('../src/world/farmsteadProps.js');
    const boxes = [];
    const scene = new THREE.Scene();
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const group = buildHomeRails({ scene, layout: two, heights: createTerrainHeight(two, new Track(two.trackPoints)), fixedBox: (x, y, z, hx) => boxes.push({ x, z, hx }), random });
    expect(group.name).toBe('homeRails');
    const zs = boxes.map((b) => b.z + PLAN_ORIGIN[1]);
    expect(Math.min(...zs)).toBeLessThan(240); // from the boundary's north end, plan z 235...
    expect(Math.max(...zs)).toBeGreaterThan(435); // ...to its south end, 440
    const gate = two.gateways.find((g) => g.a === 'home' && g.b === 'farmstead');
    expect(boxes.some((b) => Math.abs(b.z - (368 - PLAN_ORIGIN[1])) < gate.half - 0.5)).toBe(false);
    let covered = 0;
    for (const b of boxes) covered += 2 * b.hx; // each box's long half-length
    expect(covered).toBeGreaterThan(190 - 2 * gate.half); // all of the 205 m but the gap and the corner pieces
  });
});
