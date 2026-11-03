import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import * as THREE from 'three';
import { villageShape, smoothRoad, frontOf, roadMarks, OAK_CROWN } from '../src/world/village.js';
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

  it('has a side road that turns off the lane and bends away west, not a straight line', () => {
    expect(S.road[0].x).toBeCloseTo(lane.x, 0);
    expect(S.road[S.road.length - 1].x).toBeLessThan(110);
    const heading = (i) => Math.atan2(S.road[i].tz, S.road[i].tx);
    const headings = S.road.map((_, i) => heading(i));
    expect(Math.max(...headings) - Math.min(...headings)).toBeGreaterThan(0.6);
    // Smooth: no jump between neighbouring samples.
    for (let i = 1; i < S.road.length; i++) expect(Math.hypot(S.road[i].x - S.road[i - 1].x, S.road[i].z - S.road[i - 1].z)).toBeLessThan(2.1);
  });

  it('smoothRoad passes through its points and ends where they end', () => {
    const r = smoothRoad([[0, 0], [10, 0], [20, 5]], 1);
    expect(r[0]).toMatchObject({ x: 0, z: 0 });
    expect(r[r.length - 1]).toMatchObject({ x: 20, z: 5 });
    expect(r.some((p) => Math.hypot(p.x - 10, p.z) < 0.01)).toBe(true);
  });

  it('keeps every building inside its area, off each other and clear of the road and its pavements', () => {
    for (const b of S.buildings) {
      expect(b.outer.minX, b.id).toBeGreaterThan(S.area.minX);
      expect(b.outer.maxX, b.id).toBeLessThan(S.area.maxX - 2);
      expect(b.outer.minZ, b.id).toBeGreaterThan(S.area.minZ + 3);
      expect(b.outer.maxZ, b.id).toBeLessThan(S.area.maxZ - 0.5);
      for (const o of S.buildings) if (o !== b) expect(overlap(b.outer, o.outer, 1.5), `${b.id} ${o.id}`).toBe(false);
      for (let x = b.outer.minX; x <= b.outer.maxX; x += 1) {
        for (const z of [b.outer.minZ, b.outer.maxZ]) expect(S.roadAt(x, z).d, `${b.id} ${x}`).toBeGreaterThan(S.curb + 1.5);
      }
    }
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

  it('stands clear of the brook and the neighbour\'s yard', () => {
    const brook = createBrook(LAYOUT);
    const yard = neighbourFarmShape(LAYOUT).outline;
    for (const b of S.buildings) {
      for (let x = b.outer.minX; x <= b.outer.maxX; x += 2) expect(b.outer.minZ - (brook.zAt(x) + brook.halfAt(x)), `${b.id} ${x}`).toBeGreaterThan(4);
      expect(b.outer.minZ).toBeGreaterThan(yard.maxZ + 8);
    }
  });

  it('opens a gap in the lane\'s west barrier at the turning, and keeps the lane ridable down to it', () => {
    const [a, b] = S.laneGap;
    expect(a).toBeLessThan(S.road[0].z);
    expect(b).toBeGreaterThan(S.road[0].z);
    expect(lane.open.maxZ).toBeGreaterThan(b);
    const west = laneBarriers(LAYOUT).filter((w) => w.x < lane.x);
    const mid = (a + b) / 2;
    expect(west.some((w) => mid > w.z - w.hz && mid < w.z + w.hz)).toBe(false);
  });

  it('shuts the village in with walls on its north, south and west', () => {
    expect(S.walls).toHaveLength(3);
    for (const w of S.walls) expect(w.hx * w.hz).toBeGreaterThan(0);
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
  it('starts at the lane\'s west edge, with the give-way line just inside it', () => {
    expect(S.laneEdge).toBeCloseTo(lane2.x - lane2.halfWidth, 5);
    expect(S.road[S.mouth].x).toBeLessThanOrEqual(S.laneEdge);
    expect(S.road[S.mouth - 1].x).toBeGreaterThan(S.laneEdge);
    expect(S.road[S.giveWay].x).toBeLessThan(S.laneEdge - 2);
  });

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

  it('goes on past the gate: from the last road sample, bending away and rising', () => {
    const lastRoad = S.road[S.road.length - 1];
    expect(S.beyond[0].x).toBeCloseTo(lastRoad.x, 0);
    expect(S.beyond[0].z).toBeCloseTo(lastRoad.z, 0);
    expect(S.beyond[S.beyond.length - 1].x).toBeLessThan(S.v.end.barrierX - 10);
    expect(S.beyond[S.beyond.length - 1].x).toBeGreaterThan(S.area.minX - 20);
    expect(S.beyondRise).toBeGreaterThan(2);
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
