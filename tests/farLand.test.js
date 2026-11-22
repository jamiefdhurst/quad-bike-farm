import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew, fromPlan } from '../src/world/layoutNew.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { groundBounds } from '../src/world/groundTiles.js';
import { World } from '../src/world/world.js';
import { roadNetwork, describeRoad } from '../src/world/roads.js';
import { WEATHER_KINDS } from '../src/world/weather.js';
import { DEFAULT_GRAPHICS_PARAMS, GRAPHICS_PARAM_RANGES } from '../src/core/graphics.js';
import { farFog, FOG_VIEW, FAR_PARAMS, FAR_ROADS, FAR_RIVER, farRects, outsideBy, axisLines, createFarHeight, farRingData, farFieldPlan, farClusters, smoothPath, ribbon, bankTrees } from '../src/world/farLand.js';

// The far landscape (#708): a ring from the skirt's edge out to 3.5 km that meets the ground with no gap and carries the land's lie on.
const two = layoutNew(LAYOUT, RAW_LAYOUT);
const heights = createTerrainHeight(two, new Track(two.trackPoints));
const bounds = groundBounds(two);
const { inner, outer } = farRects(bounds, two.outerMargin);
const heightAt = createFarHeight({ landform: two.landform, groundAt: heights.heightAt, inner });
const ring = farRingData({ inner, outer, heightAt });
const up = (x, z) => heightAt(x, z) - heightAt.floor;

describe('the ring and the ground', () => {
  it('starts where the skirt of the ground ends, and runs out 3.5 km from there', () => {
    expect(inner).toEqual({ minX: bounds.minX - two.outerMargin, maxX: bounds.maxX + two.outerMargin, minZ: bounds.minZ - two.outerMargin, maxZ: bounds.maxZ + two.outerMargin });
    expect(outer.minX).toBe(inner.minX - FAR_PARAMS.reach);
    expect(outer.maxZ).toBe(inner.maxZ + FAR_PARAMS.reach);
  });

  it('has lines across both axes that run from the outer edge to the other, through the inner edges', () => {
    for (const [lines, lo, hi, a, b] of [[ring.xs, outer.minX, outer.maxX, inner.minX, inner.maxX], [ring.zs, outer.minZ, outer.maxZ, inner.minZ, inner.maxZ]]) {
      expect(lines[0]).toBe(lo);
      expect(lines.at(-1)).toBe(hi);
      expect(lines).toContain(a);
      expect(lines).toContain(b);
      expect(lines.every((v, i) => i === 0 || v > lines[i - 1])).toBe(true);
    }
  });

  it('covers everything between the two outlines and nothing inside the inner one', () => {
    const p = ring.positions;
    let area = 0;
    for (let t = 0; t < ring.index.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => ring.index[t + k] * 3);
      area += Math.abs((p[b] - p[a]) * (p[c + 2] - p[a + 2]) - (p[c] - p[a]) * (p[b + 2] - p[a + 2])) / 2;
      const cx = (p[a] + p[b] + p[c]) / 3;
      const cz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
      expect(outsideBy(inner, cx, cz)).toBeGreaterThan(0);
    }
    const whole = (outer.maxX - outer.minX) * (outer.maxZ - outer.minZ) - (inner.maxX - inner.minX) * (inner.maxZ - inner.minZ);
    expect(area).toBeCloseTo(whole, -3); // no gap and no overlap, to a few m2
  });

  it('meets the ground at every vertex on the inner edge: its height is the ground\'s', () => {
    const p = ring.positions;
    let onEdge = 0;
    for (let v = 0; v < p.length; v += 3) {
      const x = p[v];
      const z = p[v + 2];
      if (outsideBy(inner, x, z) > 0) continue;
      onEdge++;
      expect(p[v + 1]).toBeCloseTo(heights.heightAt(x, z), 4);
    }
    expect(onEdge).toBeGreaterThan(100);
  });

  it('blends the ground into the far land with no step over its first cells', () => {
    for (const [x, z] of [[inner.maxX, 100], [inner.minX, 100], [200, inner.minZ], [200, inner.maxZ]]) {
      const step = Math.abs(heightAt(x + Math.sign(x - 200 || 1) * 0.01 * (z === 100 ? 1 : 0), z) - heights.heightAt(x, z));
      expect(step).toBeLessThan(0.05);
    }
  });
});

describe('the land it carries on', () => {
  it('falls east to the valley floor, which stays level, and rises west to the far hillside', () => {
    expect(up(inner.maxX + 100, 0)).toBeLessThan(up(0, 0));
    expect(up(inner.maxX + 100, 0)).toBeLessThan(8);
    expect(up(inner.minX - 1500, 0)).toBeGreaterThan(up(inner.minX, 0) + 20);
  });

  it('rises to the north and has hills on every side', () => {
    expect(up(200, inner.minZ - 2500)).toBeGreaterThan(up(200, inner.minZ - 100) + 30);
    for (const [x, z] of [[200, outer.minZ + 700], [outer.minX + 800, 200], [outer.maxX - 800, 200]]) expect(up(x, z)).toBeGreaterThan(40);
  });

  it('drops behind the hills so the rim is a valley they hide', () => {
    const hill = Math.max(...Array.from({ length: 40 }, (_, k) => up(inner.minX + 200 * k * 0 + 100 + k * 40, outer.minZ + 600 + k * 20)));
    expect(hill).toBeGreaterThan(up(300, outer.minZ + 5));
  });

  it('keeps the moor\'s plateau under Upper Thornby on from the ground', () => {
    const [ux, uz] = two.upperThornby.at;
    expect(Math.abs(heightAt(ux, uz) - heights.heightAt(ux, uz))).toBeLessThan(0.001); // within the skirt
    expect(up(inner.minX - 200, uz)).toBeGreaterThan(up(ux, uz) - 15);
  });
});

describe('what is painted on it', () => {
  const plan = farFieldPlan({ outer, inner, heightAt });

  it('has fields in different greens and golds, and woods as dark blocks', () => {
    expect(plan.fields.length).toBeGreaterThan(5000);
    const tones = new Set(plan.fields.filter((f) => !f.wood && !f.moor).map((f) => f.color.map((v) => v.toFixed(2)).join()));
    expect(tones.size).toBeGreaterThan(6);
    const woods = plan.fields.filter((f) => f.wood);
    expect(woods.length / plan.fields.length).toBeGreaterThan(0.03);
    const lum = (c) => c[0] + c[1] + c[2];
    const field = plan.fields.filter((f) => !f.wood && !f.moor).slice(0, 400);
    expect(Math.max(...woods.slice(0, 200).map((w) => lum(w.color)))).toBeLessThan(Math.min(...field.map((f) => lum(f.color))) + 0.6);
  });

  it('draws hedge lines between fields, some left out so they come in different sizes, with trees along them', () => {
    expect(plan.hedges.length).toBeGreaterThan(5000);
    expect(plan.trees.length).toBeGreaterThan(5000);
    const cells = plan.fields.length;
    expect(plan.hedges.length).toBeLessThan(cells * 2); // two sides a cell, fewer once some are joined
  });

  it('gets bluer and lighter with distance', () => {
    const near = plan.fields.filter((f) => !f.wood && !f.moor && outsideBy(inner, ...f.corners[0]) < 150);
    const far = plan.fields.filter((f) => !f.wood && !f.moor && outsideBy(inner, ...f.corners[0]) > 3000);
    const blue = (fs) => fs.reduce((s, f) => s + f.color[2] - f.color[0], 0) / fs.length;
    expect(near.length).toBeGreaterThan(10);
    expect(far.length).toBeGreaterThan(10);
    expect(blue(far)).toBeGreaterThan(blue(near) + 0.1);
  });

  it('leaves the open hill with walls, not hedgerows', () => {
    const walls = plan.hedges.filter((h) => h.wall).length;
    expect(walls).toBeGreaterThan(50);
    expect(plan.hedges.filter((h) => !h.wall).length).toBeGreaterThan(walls);
  });
});

describe('the roads and the river carrying on', () => {
  it('runs the lane on south from where the ground ends', () => {
    const lane = FAR_ROADS.find((r) => r.id === 'lane');
    expect(lane.points[0]).toEqual(fromPlan([905, 970]));
    expect(lane.points.at(-1)[1]).toBeGreaterThan(inner.maxZ + 1000);
    const path = smoothPath(lane.points, 40);
    expect(path.length).toBeGreaterThan(30);
    const r = ribbon(path, lane.halfWidth, heightAt, 0.4);
    expect(r.positions.length / 3).toBe(path.length * 2);
    expect(Math.max(...r.index)).toBeLessThan(path.length * 2);
  });

  it('carries the A-road past both ends, further than the map\'s outer edge reaches the sight', () => {
    const north = FAR_ROADS.find((r) => r.id === 'aRoadNorth');
    const south = FAR_ROADS.find((r) => r.id === 'aRoadSouth');
    expect(north.points.at(-1)[1]).toBeLessThan(outer.minZ + 600);
    expect(south.points.at(-1)[1]).toBeGreaterThan(outer.maxZ - 1500);
  });

  it('puts a line of trees along the river on the valley floor', () => {
    const path = smoothPath(FAR_RIVER.points, 40);
    const trees = bankTrees(path);
    expect(trees.length).toBeGreaterThan(80);
    for (const [x, z] of trees.slice(0, 50)) expect(Math.min(...path.map(([px, pz]) => Math.hypot(px - x, pz - z)))).toBeLessThan(25);
  });
});

describe('far farms', () => {
  const { shapes, sites } = farClusters({ inner, outer, heightAt });

  it('are out in the far land, a few on level ground, each with grey roofs and trees', () => {
    expect(sites.length).toBeGreaterThan(15);
    expect(shapes.buildings.length).toBeGreaterThanOrEqual(sites.length * 2);
    expect(shapes.walls.length).toBeGreaterThanOrEqual(sites.length * 5);
    for (const [x, z] of sites) {
      expect(outsideBy(inner, x, z)).toBeGreaterThanOrEqual(120);
      expect(up(x, z)).toBeLessThan(95);
    }
  });

  it('stay clear of what the caller keeps clear', () => {
    const none = farClusters({ inner, outer, heightAt, keepClear: () => true });
    expect(none.sites.length).toBe(0);
  });

  it('are the same every time', () => {
    expect(farClusters({ inner, outer, heightAt }).sites).toEqual(sites);
  });
});

describe('axisLines', () => {
  it('grows outward and is finest by the inner edge', () => {
    const l = axisLines(-4000, 4000, -500, 500);
    const gap = (i) => l[i + 1] - l[i];
    const iLo = l.indexOf(-500);
    expect(gap(iLo - 1)).toBeLessThan(gap(0));
    expect(gap(iLo - 1)).toBeLessThanOrEqual(FAR_PARAMS.nearStep + 1e-9);
  });
});

describe('the ring in two parts', () => {
  const near = (x, z) => outsideBy(inner, x, z) < 900;
  const a = farRingData({ inner, outer, heightAt, select: near });
  const b = farRingData({ inner, outer, heightAt, select: (x, z) => !near(x, z) });
  const area = (r) => {
    let sum = 0;
    const p = r.positions;
    for (let t = 0; t < r.index.length; t += 3) {
      const [i, j, k] = [0, 1, 2].map((n) => r.index[t + n] * 3);
      sum += Math.abs((p[j] - p[i]) * (p[k + 2] - p[i + 2]) - (p[k] - p[i]) * (p[j + 2] - p[i + 2])) / 2;
    }
    return sum;
  };

  it('together are the whole ring, with nothing twice and nothing left out', () => {
    expect(area(a) + area(b)).toBeCloseTo(area(ring), -3);
  });

  it('meet along vertices both have, at the same heights, so there is no crack between them', () => {
    const key = (p, v) => `${p[v]},${p[v + 2]}`;
    const inA = new Map();
    for (let v = 0; v < a.positions.length; v += 3) inA.set(key(a.positions, v), a.positions[v + 1]);
    let shared = 0;
    for (let v = 0; v < b.positions.length; v += 3) {
      const h = inA.get(key(b.positions, v));
      if (h === undefined) continue;
      shared++;
      expect(b.positions[v + 1]).toBe(h);
    }
    expect(shared).toBeGreaterThan(50);
  });
});

describe('the fog on the new farm', () => {
  it('lets a clear day show 1.5 km (the sky is still 5% there) and leaves rain and mist as they are', () => {
    expect(Math.exp(-((farFog(0.0032) * 1500) ** 2))).toBeGreaterThan(0.04);
    expect(Math.exp(-((0.0032 * 1500) ** 2))).toBeLessThan(0.001); // as it was: nothing
    expect(farFog(0.016)).toBe(0.016);
    expect(farFog(0.028)).toBe(0.028);
  });

  it('never thickens a weather, and rises with it, so the weather moves smoothly', () => {
    let last = 0;
    for (let d = 0.0005; d <= 0.03; d += 0.0005) {
      expect(farFog(d)).toBeLessThanOrEqual(d + 1e-12);
      expect(farFog(d)).toBeGreaterThan(last);
      last = farFog(d);
    }
  });
});

describe('the view distance (#820)', () => {
  const seen = (density) => 1.794 / density; // metres until FogExp2 leaves 4% of the world's colour (exp(-(d x)^2) = 0.04)

  it('is a graphics setting of 1500 m by default, from 300 to 3000 in steps of 50, and the fog is written for that default', () => {
    expect(DEFAULT_GRAPHICS_PARAMS.viewDistance).toBe(1500);
    expect(GRAPHICS_PARAM_RANGES.viewDistance).toEqual([300, 3000, 50]);
    expect(FOG_VIEW).toBe(DEFAULT_GRAPHICS_PARAMS.viewDistance);
  });

  it('makes every weather a fraction of it: at 500 m and at 1500 m each shows in proportion, and the default is what it was', () => {
    for (const [kind, def] of Object.entries(WEATHER_KINDS)) {
      const d = def.sky.fogDensity;
      expect(farFog(d, 1500), kind).toBe(farFog(d));
      expect(seen(farFog(d, 500)) / seen(farFog(d, 1500)), kind).toBeCloseTo(500 / 1500, 6);
      expect(seen(farFog(d, 3000)) / seen(farFog(d, 1500)), kind).toBeCloseTo(2, 6);
    }
  });

  it('shows a clear day at the view distance and a grey one in a few hundred metres, rain and mist closing right in', () => {
    const shown = (kind, view) => seen(farFog(WEATHER_KINDS[kind].sky.fogDensity, view));
    expect(shown('sunny', 1500)).toBeGreaterThan(1400);
    expect(shown('sunny', 500)).toBeGreaterThan(450);
    expect(shown('sunny', 500)).toBeLessThan(600);
    expect(shown('overcast', 1500)).toBeLessThan(950);
    expect(shown('rain', 1500)).toBeLessThan(250);
    expect(shown('fog', 1500)).toBeLessThan(70);
  });

  it('changes the fog smoothly with the setting: a step of 50 m moves the density by no more than a few percent at 1500 m', () => {
    for (const def of Object.values(WEATHER_KINDS)) {
      for (let v = 300; v < 3000; v += 50) {
        const a = farFog(def.sky.fogDensity, v);
        const b = farFog(def.sky.fogDensity, v + 50);
        expect(b).toBeLessThan(a); // a longer view is always a thinner fog
        expect((a - b) / a).toBeLessThan(50 / v + 1e-9);
      }
    }
  });
});

describe('what #820 left to check', () => {
  it('has the far view\'s Back Lane spot on the lane\'s tarmac, not over its hedge', () => {
    const at = two.budgetSpots.backLaneNorth;
    expect(describeRoad(roadNetwork(two), at.x, at.z)).toMatch(/^Back Lane \(tarmac.*on the carriageway/);
  });

  it('passes the view distance into the new farm\'s fog and leaves today\'s alone', () => {
    const fogAt = (newFarm, viewDistance) => World.prototype.skyNow.call({ layout: { newFarm }, weather: { skyParams: () => ({ fogDensity: 0.0032 }) }, sky: { graphics: { viewDistance } } }).fogDensity;
    expect(fogAt(true, 3000)).toBeCloseTo(fogAt(true, 1500) / 2, 9);
    expect(fogAt(false, 3000)).toBe(0.0032);
    expect(fogAt(false, 1500)).toBe(0.0032);
  });
});

