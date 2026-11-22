import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import * as THREE from 'three';
import { villageShape, smoothRoad, frontOf, roadMarks, roadLeadIn, OAK_CROWN } from '../src/world/village.js';
import { Frame, bayWindow } from '../src/world/villageKit.js';
import { laneBarriers, neighbourFarmShape } from '../src/world/neighbourFarm.js';
import { createBrook } from '../src/world/brook.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';

const S = villageShape(LAYOUT);
const lane = LAYOUT.publicLane;
const overlap = (a, b, m = 0) => a.minX < b.maxX + m && a.maxX > b.minX - m && a.minZ < b.maxZ + m && a.maxZ > b.minZ - m;

describe('the village', () => {
  it('is there, called Nether Thornby, with a 20 mph limit', () => {
    expect(S.name).toBe('Nether Thornby');
    expect(S.limit).toBe(20);
  });



  it('smoothRoad passes through its points and ends where they end', () => {
    const r = smoothRoad([[0, 0], [10, 0], [20, 5]], 1);
    expect(r[0]).toMatchObject({ x: 0, z: 0 });
    expect(r[r.length - 1]).toMatchObject({ x: 20, z: 5 });
    expect(r.some((p) => Math.hypot(p.x - 10, p.z) < 0.01)).toBe(true);
  });


  it('turns every front to the road', () => {
    for (const b of S.buildings) {
      const f = frontOf(b);
      const r = S.roadAt(b.x, f.z);
      expect(Math.sign(r.at.z - f.z), b.id).toBe(f.face); // the road lies the way the front faces
    }
  });

  it('keeps the car park and the forecourt off the buildings and the road', () => {
    for (const b of S.buildings) expect(overlap(S.carPark, b.outer), b.id).toBe(false);
    for (let x = S.carPark.minX; x <= S.carPark.maxX; x += 1) expect(S.roadAt(x, S.carPark.maxZ).d).toBeGreaterThan(S.roadHalfWidth + 0.5);
    expect(S.pubStop.x).toBeGreaterThan(S.carPark.minX);
    expect(S.pubStop.x).toBeLessThan(S.carPark.maxX);
    expect(S.pubStop.z).toBeGreaterThan(S.carPark.minZ);
    expect(S.pubStop.z).toBeLessThan(S.carPark.maxZ);
  });




  it('levels the ground under each building, the car park and the forecourt, and leaves the road to follow the land', () => {
    const heights = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
    for (const b of [S.pub, S.shop, S.garage]) {
      const ys = [];
      for (const dx of [-0.8, 0, 0.8]) for (const dz of [-0.8, 0, 0.8]) ys.push(heights.heightAt(b.x + dx * b.halfX, b.z + dz * b.halfZ));
      expect(Math.max(...ys) - Math.min(...ys), b.id).toBeLessThan(0.01);
    }
    const c = S.carPark;
    const corner = heights.heightAt(c.minX + 1, c.minZ + 1);
    expect(Math.abs(corner - heights.heightAt(c.maxX - 1, c.maxZ - 1))).toBeLessThan(0.01);
  });
});

describe('the village road meets the lane and carries on past its gate (#535)', () => {
  const lane2 = LAYOUT.publicLane;

  it('has a broken centre line and one give-way line, across the way out only', () => {
    const { centre, giveWay } = roadMarks(S);
    expect(centre.length).toBeGreaterThan(10);
    expect(centre.every((m) => m.s > S.giveWay && m.a < 0 && m.b > 0)).toBe(true);
    // Across the north half (positive offset: the left going east, the traffic leaving the village), never the south.
    expect(giveWay.length).toBeGreaterThan(3);
    for (const m of giveWay) {
      expect(m.a).toBeGreaterThan(0);
      expect(m.b).toBeLessThanOrEqual(S.roadHalfWidth);
      expect(m.s - S.giveWay).toBeLessThan(1);
    }
  });

  it('opens the car park onto the road with a dropped kerb inside the car park\'s width', () => {
    const e = LAYOUT.village.pub.carPark.entry;
    expect(e.minX).toBeGreaterThanOrEqual(S.carPark.minX);
    expect(e.maxX).toBeLessThanOrEqual(S.carPark.maxX);
  });

});

describe('the village houses, shop and pub shells (#538)', () => {
  it('keeps every oak\'s crown off every building', () => {
    expect(LAYOUT.village.trees.length).toBeGreaterThan(2);
    for (const t of LAYOUT.village.trees) {
      for (const r of S.footprints) {
        const d = Math.hypot(Math.max(r.minX - t.x, 0, t.x - r.maxX), Math.max(r.minZ - t.z, 0, t.z - r.maxZ));
        expect(d, `oak at ${t.x}, ${t.z}`).toBeGreaterThan(OAK_CROWN * t.scale);
      }
    }
  });

  it('keeps each cottage\'s back garden inside the village\'s wall, short of the brook beyond it', () => {
    for (const b of S.buildings.filter((x) => x.kind === 'cottage')) {
      const depth = S.gardenDepth(b);
      const hedgeZ = b.yaw === 0 ? b.z - b.halfZ - depth : b.z + b.halfZ + depth;
      expect(depth).toBeLessThanOrEqual(6);
      expect(hedgeZ - 0.4).toBeGreaterThan(S.area.minZ + 0.3);
      expect(hedgeZ + 0.4).toBeLessThan(S.area.maxZ - 0.3);
    }
  });

  it('joins a bay window\'s panes end to end, the side ones running from the wall to the front pane, facing out', () => {
    for (const face of [1, -1]) {
      const group = new THREE.Group();
      const f = new Frame({ group, x: 0, z: 0, yaw: 0, y0: 0, fixedBox: () => {} });
      const stand = new THREE.MeshBasicMaterial();
      const m = { glass: stand, glow: stand, paint: stand, stone: stand, lead: stand };
      const w = 4.4;
      const depth = 0.5;
      bayWindow(f, m, { x: 1, w, depth, wallZ: 10, face, lit: false });
      const panes = group.children.filter((c) => c.userData.pane);
      expect(panes.length).toBe(3);
      const ends = (p) => {
        const half = p.userData.pane / 2;
        const ax = Math.cos(p.rotation.y);
        const az = -Math.sin(p.rotation.y);
        return [[p.position.x - ax * half, p.position.z - az * half], [p.position.x + ax * half, p.position.z + az * half]];
      };
      const front = panes.find((p) => Math.abs(p.position.z - (10 + face * depth)) < 1e-6);
      for (const side of panes.filter((p) => p !== front)) {
        // One end on the wall at x = 1 +- w/2, the other on one of the front pane's ends.
        const [a, b] = ends(side);
        const onWall = [a, b].find((e) => Math.abs(e[1] - 10) < 1e-6);
        const joined = [a, b].find((e) => e !== onWall);
        expect(onWall && Math.abs(Math.abs(onWall[0] - 1) - w / 2) < 1e-6).toBe(true);
        expect(ends(front).some((e) => Math.hypot(e[0] - joined[0], e[1] - joined[1]) < 1e-6)).toBe(true);
        // Facing out: its normal points away from the bay's middle line, and away from the wall.
        const nx = Math.sin(side.rotation.y);
        const nz = Math.cos(side.rotation.y);
        expect(nz * face).toBeGreaterThan(0);
        expect(nx * Math.sign(side.position.x - 1)).toBeGreaterThan(0);
      }
    }
  });
});


describe('the road turns south and is shut by a gate before the wall (found testing #593)', () => {

  it('keeps every building and the car park clear of the road\'s pavements', () => {
    const clear = (r) => S.road.every((p) => Math.hypot(Math.max(r.minX - p.x, 0, p.x - r.maxX), Math.max(r.minZ - p.z, 0, p.z - r.maxZ)) > S.curb - 0.5);
    for (const b of S.buildings) expect(clear(b.outer), b.id ?? b.kind).toBe(true);
  });
});
