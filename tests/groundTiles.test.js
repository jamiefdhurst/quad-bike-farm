import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { LAYOUT } from '../src/world/layout.js';
import { Track } from '../src/world/track.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { DEFAULT_GROUND_PARAMS, GROUND_PARAM_RANGES, GroundGrid, TileSet, cutTiles, groundBounds, stepFor, tileDistance, tileMeshData } from '../src/world/groundTiles.js';

const P = DEFAULT_GROUND_PARAMS;
const flat = () => 0.5;
const noTint = () => 1;
const noUv = (x, z) => [x, z];

// A ground 1,400 by 1,000 m that is not centred on the origin, with the real farm's land on it (and its rolling hills beyond the farm).
const BIG = { ...LAYOUT, ground: { minX: -300, maxX: 1100, minZ: -400, maxZ: 600 } };
const heights = createTerrainHeight(BIG, new Track(BIG.trackPoints));
let big;
beforeAll(() => {
  big = new GroundGrid(groundBounds(BIG), heights.heightAt);
}, 30000);

describe('the ground\'s rectangle', () => {
  it('is the layout\'s, in whole metres rounded outward', () => {
    expect(groundBounds({ ground: { minX: -10.4, maxX: 20.2, minZ: 3, maxZ: 9 } })).toEqual({ minX: -11, maxX: 21, minZ: 3, maxZ: 9 });
  });

  it('is the old centred square when the layout gives none', () => {
    expect(groundBounds({ terrainSize: 420 })).toEqual({ minX: -210, maxX: 210, minZ: -210, maxZ: 210 });
  });

  it('is, for today\'s farm, the painted square, so the texture covers all of it', () => {
    const g = groundBounds(LAYOUT);
    const half = LAYOUT.terrainSize / 2;
    expect(g).toEqual({ minX: -half, maxX: half, minZ: -half, maxZ: half });
  });

  it('is within the painted square, or the ground beyond it would have no painting (grow terrainSize with it, or paint it another way)', () => {
    const g = groundBounds(LAYOUT);
    const half = LAYOUT.terrainSize / 2;
    expect([g.minX, g.maxX, g.minZ, g.maxZ].every((v) => Math.abs(v) <= half)).toBe(true);
  });
});

describe('cutting the ground into tiles', () => {
  it('covers a 1,400 by 1,000 m ground exactly, with no overlap', () => {
    const { tiles, cols, rows } = cutTiles(groundBounds(BIG));
    expect(cols * rows).toBe(tiles.length);
    expect(tiles.length).toBe(Math.ceil(1400 / 64) * Math.ceil(1000 / 64));
    const area = tiles.reduce((sum, t) => sum + (t.maxX - t.minX) * (t.maxZ - t.minZ), 0);
    expect(area).toBe(1400 * 1000);
    for (const t of tiles) {
      expect(t.maxX - t.minX).toBeLessThanOrEqual(64);
      const right = tiles.find((o) => o.tz === t.tz && o.tx === t.tx + 1);
      if (right) expect(right.minX).toBe(t.maxX);
    }
  });

  it('gives a short last tile only the steps that divide it', () => {
    const { tiles } = cutTiles({ minX: 0, maxX: 100, minZ: 0, maxZ: 64 });
    expect(tiles[0].maxStep).toBe(8);
    expect(tiles[1].maxX - tiles[1].minX).toBe(36);
    expect(tiles[1].maxStep).toBe(4);
  });

  it('measures distance to the nearest edge of a tile', () => {
    const t = { minX: 0, maxX: 64, minZ: 0, maxZ: 64 };
    expect(tileDistance(t, 10, 10)).toBe(0);
    expect(tileDistance(t, 100, 32)).toBe(36);
    expect(tileDistance(t, 67, 68)).toBe(5);
  });
});

describe('how finely a tile is drawn', () => {
  it('is every metre near, then 2, 4 and 8 m by distance', () => {
    expect(stepFor(10, undefined, P)).toBe(1);
    expect(stepFor(P.near - 1, undefined, P)).toBe(1);
    expect(stepFor(P.near + 1, undefined, P)).toBe(2);
    expect(stepFor(P.mid + 1, undefined, P)).toBe(4);
    expect(stepFor(P.far + 1, undefined, P)).toBe(8);
  });

  it('keeps the detail it has until it is well past the line, so it does not flicker on it', () => {
    expect(stepFor(P.near + 1, 1, P)).toBe(1);
    expect(stepFor(P.near * (1 + P.hysteresis) + 1, 1, P)).toBe(2);
    expect(stepFor(P.near - 1, 2, P)).toBe(2);
    expect(stepFor(P.near * (1 - P.hysteresis) - 1, 2, P)).toBe(1);
  });

  it('is never coarser than the tile can be', () => {
    expect(stepFor(5000, undefined, P, 4)).toBe(4);
  });

  it('has a range for each tunable that holds its default', () => {
    for (const [k, [lo, hi]] of Object.entries(GROUND_PARAM_RANGES)) {
      expect(DEFAULT_GROUND_PARAMS[k]).toBeGreaterThanOrEqual(lo);
      expect(DEFAULT_GROUND_PARAMS[k]).toBeLessThanOrEqual(hi);
    }
  });
});

describe('the height grid', () => {
  it('matches terrainHeight at every sample point of a 1,400 by 1,000 m ground', () => {
    expect(big.nx).toBe(1400);
    expect(big.nz).toBe(1000);
    for (const [x, z] of [[-300, -400], [1100, 600], [0, 0], [412, -77], [999, 599], [-299, 3], [650, 250]]) {
      expect(Math.abs(big.surfaceAt(x, z) - heights.heightAt(x, z))).toBeLessThan(0.001);
    }
  });

  it('is NaN off the ground, and exact between the samples on the flat', () => {
    expect(big.surfaceAt(-301, 0)).toBeNaN();
    expect(big.surfaceAt(0, 601)).toBeNaN();
    const g = new GroundGrid({ minX: 0, maxX: 4, minZ: 0, maxZ: 4 }, (x, z) => x + 2 * z);
    expect(g.surfaceAt(1.25, 2.5)).toBeCloseTo(1.25 + 5, 5);
  });
});

/** The height along a tile's edge by linear interpolation between its edge vertices, at `along` metres from the tile's corner. */
function edgeHeight(mesh, tile, step, side, along) {
  const nz = mesh.nz;
  const vertex = (ix, iz) => mesh.positions[(ix * (nz + 1) + iz) * 3 + 1];
  const i = Math.min(Math.floor(along / step), (side < 2 ? nz : mesh.nx) - 1);
  const t = along / step - i;
  const at = (k) => (side === 0 ? vertex(0, k) : side === 1 ? vertex(mesh.nx, k) : side === 2 ? vertex(k, 0) : vertex(k, nz));
  return at(i) + (at(i + 1) - at(i)) * t;
}

describe('a tile\'s vertices', () => {
  const tile = { minX: 64, maxX: 128, minZ: 128, maxZ: 192, maxStep: 8 };
  const edgesOf = (s) => [s, s, s, s];

  it('are the ground\'s height at each, at every step', () => {
    for (const step of [1, 2, 4, 8]) {
      const m = tileMeshData(big, tile, step, edgesOf(step), noTint, noUv);
      expect(m.nx).toBe(64 / step);
      for (let ix = 0; ix <= m.nx; ix += 3) {
        for (let iz = 0; iz <= m.nz; iz += 5) {
          const i = ix * (m.nz + 1) + iz;
          expect(m.positions[i * 3]).toBe(tile.minX + ix * step);
          expect(Math.abs(m.positions[i * 3 + 1] - heights.heightAt(tile.minX + ix * step, tile.minZ + iz * step))).toBeLessThan(0.001);
        }
      }
    }
  });

  it('have unit normals that point up on level ground and lean away from a rise', () => {
    const level = new GroundGrid({ minX: 0, maxX: 64, minZ: 0, maxZ: 64 }, flat);
    const t = { minX: 0, maxX: 64, minZ: 0, maxZ: 64, maxStep: 8 };
    const m = tileMeshData(level, t, 2, edgesOf(2), noTint, noUv);
    expect(Math.abs(m.normals[0]) + Math.abs(m.normals[2])).toBe(0);
    expect(m.normals[1]).toBe(1);
    const slope = new GroundGrid({ minX: 0, maxX: 64, minZ: 0, maxZ: 64 }, (x) => x * 0.5);
    const s = tileMeshData(slope, t, 1, edgesOf(1), noTint, noUv);
    const i = (10 * 65 + 10) * 3;
    expect(s.normals[i]).toBeLessThan(0);
    expect(Math.hypot(s.normals[i], s.normals[i + 1], s.normals[i + 2])).toBeCloseTo(1, 5);
  });

  it('use the same grid points as the physics, so a coarse vertex is always on the ground', () => {
    const m = tileMeshData(big, tile, 8, edgesOf(8), noTint, noUv);
    for (let k = 0; k < m.positions.length; k += 3) {
      expect(Math.abs(m.positions[k + 1] - big.surfaceAt(m.positions[k], m.positions[k + 2]))).toBeLessThan(1e-4);
    }
  });
});

describe('tiles meeting', () => {
  // Draw every tile of the big ground as a camera at (cx, cz) would, and compare the two edges of every pair of neighbours at every metre.
  function seams(cx, cz) {
    const bounds = groundBounds(BIG);
    const { tiles, cols, rows } = cutTiles(bounds);
    const drawn = new Map();
    const set = new TileSet(tiles, cols, rows, { ...P }, {
      build: (tile, step, edges) => drawn.set(tile.id, { step, mesh: tileMeshData(big, tile, step, edges, noTint, noUv) }),
    });
    set.prime(cx, cz, 1e9);
    let worst = 0;
    let checked = 0;
    const steps = new Set();
    for (const t of tiles) {
      const right = set.neighbour(t, 1, 0);
      const up = set.neighbour(t, 0, 1);
      const a = drawn.get(t.id);
      steps.add(a.step);
      for (const [o, mySide, theirSide, len] of [[right, 1, 0, t.maxZ - t.minZ], [up, 3, 2, t.maxX - t.minX]]) {
        if (!o) continue;
        const b = drawn.get(o.id);
        for (let along = 0; along <= len; along++) {
          const ha = edgeHeight(a.mesh, t, a.step, mySide, along);
          const hb = edgeHeight(b.mesh, o, b.step, theirSide, along);
          worst = Math.max(worst, Math.abs(ha - hb));
          checked++;
        }
      }
    }
    return { worst, checked, steps: [...steps].sort(), drawn };
  }

  it('match to 1 cm along every seam of the 1,400 by 1,000 m ground, with every step meeting its neighbours', () => {
    const r = seams(200, 100);
    expect(r.steps).toEqual([1, 2, 4, 8]);
    expect(r.checked).toBeGreaterThan(20000);
    expect(r.worst).toBeLessThan(0.01);
  });

  it('match when the camera is somewhere else', () => {
    expect(seams(-250, -380).worst).toBeLessThan(0.01);
    expect(seams(1090, 590).worst).toBeLessThan(0.01);
  });

  it('would not, without the snapping, which is what the snapping is for', () => {
    const bounds = groundBounds(BIG);
    const t = cutTiles(bounds).tiles.find((x) => x.minX === bounds.minX + 64 * 5 && x.minZ === bounds.minZ + 64 * 5);
    const fine = tileMeshData(big, t, 1, [1, 1, 1, 1], noTint, noUv);
    const stitched = tileMeshData(big, t, 1, [8, 1, 1, 1], noTint, noUv);
    let differ = 0;
    for (let iz = 1; iz < 64; iz++) differ = Math.max(differ, Math.abs(fine.positions[iz * 3 + 1] - stitched.positions[iz * 3 + 1]));
    expect(differ).toBeGreaterThan(0.01);
  });
});

describe('building the tiles as they are needed', () => {
  const make = (params = {}, clock = () => 0) => {
    const { tiles, cols, rows } = cutTiles(groundBounds(BIG));
    const built = [];
    const set = new TileSet(tiles, cols, rows, { ...P, ...params }, { build: (tile, step, edges) => built.push({ tile, step, edges }), now: clock });
    return { set, built, tiles };
  };

  it('primes the tiles round the start, then draws something everywhere, coarsely, so there is no hole', () => {
    const { set, built, tiles } = make();
    set.prime(0, 0);
    expect(built.length).toBe(tiles.length);
    expect(new Set(built.map((b) => b.tile.id)).size).toBe(tiles.length);
  });

  it('builds nothing more when nothing has changed', () => {
    const { set, built } = make();
    set.prime(0, 0);
    const n = built.length;
    expect(set.update(0, 0, 100)).toBe(0);
    expect(built.length).toBe(n);
  });

  it('builds the nearest tile first, and only as many as the time allows', () => {
    let t = 0;
    const { set, built } = make({}, () => (t += 1));
    const n = set.update(0, 0, 3);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(5);
    const first = built[0].tile;
    expect(tileDistance(first, 0, 0)).toBe(0);
    for (const b of built) expect(tileDistance(b.tile, 0, 0)).toBeLessThanOrEqual(tileDistance(built[built.length - 1].tile, 0, 0) + 1e-9);
    expect(set.stats().waiting).toBeGreaterThan(0);
  });

  it('always builds at least one tile when it has work, however small the budget', () => {
    let t = 0;
    const { set } = make({}, () => (t += 10));
    expect(set.update(0, 0, 0.1)).toBe(1);
  });

  it('redraws the tiles whose detail changes when you move, and the neighbours that must follow their edges', () => {
    const { set, built } = make();
    set.prime(0, 0);
    built.length = 0;
    set.update(300, 0, 1e9);
    expect(built.length).toBeGreaterThan(0);
    const changed = new Set(built.map((b) => b.tile.id));
    expect(changed.size).toBe(built.length); // none twice
    const nearNow = built.filter((b) => b.step === 1).length;
    expect(nearNow).toBeGreaterThan(0);
    // After which it is steady.
    built.length = 0;
    expect(set.update(300, 0, 1e9)).toBe(0);
  });

  it('draws the tiles near as 1 m, and the farthest as 8 m', () => {
    const { set, built } = make();
    set.prime(0, 0);
    const byDist = [...built].sort((a, b) => tileDistance(a.tile, 0, 0) - tileDistance(b.tile, 0, 0));
    expect(byDist[0].step).toBe(1);
    expect(byDist[byDist.length - 1].step).toBe(8);
  });

  it('records what it built and how long that took', () => {
    let t = 0;
    const { set } = make({}, () => (t += 2));
    set.prime(0, 0);
    const s = set.stats();
    expect(s.built).toBe(s.tiles);
    expect(s.builds).toBe(s.tiles);
    expect(s.worstBuildMs).toBeGreaterThan(0);
    expect(Object.keys(s.bySteps).length).toBeGreaterThan(1);
  });
});

describe('the heightfield for physics', () => {
  it('puts every wheel on the same ground the tiles are drawn from, on a ground that is not square or centred', async () => {
    await RAPIER.init();
    const bounds = { minX: -300, maxX: 500, minZ: 40, maxZ: 340 };
    const grid = new GroundGrid(bounds, (x, z) => 3 * Math.sin(x * 0.01) + 2 * Math.cos(z * 0.02) + x * 0.001);
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(
      RAPIER.ColliderDesc.heightfield(grid.nz, grid.nx, grid.heights, { x: grid.nx, y: 1, z: grid.nz }).setTranslation(
        (bounds.minX + bounds.maxX) / 2,
        0,
        (bounds.minZ + bounds.maxZ) / 2,
      ),
    );
    world.step();
    let worst = 0;
    for (const [x, z] of [[-299.999, 40.001], [499.999, 339.999], [-298.5, 338.5], [0.001, 100.001], [123.001, 200.001], [498.999, 41.001], [250.2, 300.2], [250.8, 300.8], [-150.5, 250.25]]) {
      const hit = world.castRay(new RAPIER.Ray({ x, y: 100, z }, { x: 0, y: -1, z: 0 }), 200, true);
      expect(hit).not.toBeNull();
      worst = Math.max(worst, Math.abs(100 - hit.timeOfImpact - grid.surfaceAt(x, z)));
    }
    expect(worst).toBeLessThan(0.01);
    // And nothing under the ground off its edge.
    expect(world.castRay(new RAPIER.Ray({ x: -320, y: 100, z: 100 }, { x: 0, y: -1, z: 0 }), 200, true)).toBeNull();
    expect(world.castRay(new RAPIER.Ray({ x: 100, y: 100, z: 360 }, { x: 0, y: -1, z: 0 }), 200, true)).toBeNull();
  });
});
