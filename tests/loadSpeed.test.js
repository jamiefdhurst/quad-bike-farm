import { describe, it, expect, vi } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { Track } from '../src/world/track.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { GroundGrid, sampleColumns } from '../src/world/groundTiles.js';
import { columnBands, workerCount, sampleGroundInWorkers, MAX_GROUND_WORKERS } from '../src/world/groundSampler.js';
import { distanceToEdges, nearestOnEdge, outsidePolygon, pointInPolygon, polygonEdges, polygonBounds, outsideBounds } from '../src/world/polygons.js';
import { streamFor } from '../src/world/props.js';
import { timed, laps, loadSteps, slowestStepsText } from '../src/core/loadSteps.js';
import { World } from '../src/world/world.js';

// Getting the farm to "Ready" sooner (#1107): the ground's grid in workers, quicker asks of the ground that give the same numbers, each props
// builder on its own stream, the ground cover built behind the start screen, and the load's parts timed.

const random = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe('the ground grid in bands', () => {
  const bounds = { minX: -7, maxX: 13, minZ: -4, maxZ: 9 };
  const heightAt = (x, z) => Math.sin(x * 0.31) * 3 + Math.cos(z * 0.17) * 2 + x * 0.01;

  it('splits the columns into bands that cover each once', () => {
    for (const [count, n] of [[21, 4], [1696, 8], [3, 8], [10, 1]]) {
      const bands = columnBands(count, n);
      expect(bands[0][0]).toBe(0);
      expect(bands.at(-1)[1]).toBe(count);
      for (let i = 1; i < bands.length; i++) expect(bands[i][0]).toBe(bands[i - 1][1]);
      expect(bands.length).toBe(Math.min(n, count));
    }
  });

  it('uses one fewer worker than the cores, between 2 and the most', () => {
    expect(workerCount(14)).toBe(MAX_GROUND_WORKERS);
    expect(workerCount(4)).toBe(3);
    expect(workerCount(1)).toBe(2);
    expect(workerCount(0)).toBe(3); // a browser that won't say is taken as four cores
  });

  it('gives the same grid from bands as worked out in one go', () => {
    const whole = new GroundGrid(bounds, heightAt);
    const stride = whole.stride;
    const parts = new Float32Array(whole.heights.length);
    for (const [a, b] of columnBands(whole.nx + 1, 3)) parts.set(sampleColumns(bounds, heightAt, a, b), a * stride);
    expect(parts).toEqual(whole.heights);
    // and a GroundGrid handed them takes them without asking the ground again
    const asked = vi.fn(heightAt);
    expect(new GroundGrid(bounds, asked, parts).heights).toBe(parts);
    expect(asked).not.toHaveBeenCalled();
  });

  it('works the real farm\'s ground out in workers to the same numbers as on the page', async () => {
    // A stand-in worker that runs groundWorker.js's sums on what it is posted, as a structured clone, as a real one is.
    const small = { minX: -40, maxX: 30, minZ: -25, maxZ: 35 };
    const makeWorker = () => {
      const w = {
        postMessage(msg) {
          const { layout, bounds, ix0, ix1 } = structuredClone(msg);
          const h = createTerrainHeight(layout, new Track(layout.trackPoints));
          queueMicrotask(() => w.onmessage({ data: { ix0, out: sampleColumns(bounds, h.heightAt, ix0, ix1) } }));
        },
        terminate: vi.fn(),
      };
      return w;
    };
    const heights = await sampleGroundInWorkers(LAYOUT, { bounds: small, makeWorker, workers: 4 });
    const page = new GroundGrid(small, createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints)).heightAt);
    expect(heights).toEqual(page.heights);
  });

  it('answers null, for the page to work it out, with no workers or a band that fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await sampleGroundInWorkers(LAYOUT, { bounds, makeWorker: () => null })).toBeNull();
    const failing = () => { const w = { postMessage: () => queueMicrotask(() => w.onmessage({ data: { error: 'no' } })), terminate: () => {} }; return w; };
    expect(await sampleGroundInWorkers(LAYOUT, { bounds, makeWorker: failing })).toBeNull();
    vi.restoreAllMocks();
  });
});

describe('quicker asks of a polygon give the same numbers', () => {
  // As they were before #1107: every edge through nearestOnEdge, and pointInPolygon then the distance again.
  const oldDistance = (edges, x, z) => edges.reduce((best, e) => Math.min(best, nearestOnEdge(e, x, z).d), Infinity);
  const oldOutside = (pts, x, z, edges) => (pointInPolygon(pts, x, z, 0, edges) ? 0 : oldDistance(edges, x, z));

  it('to the bit, inside and out, on edges and at corners', () => {
    const r = random(7);
    for (let n = 0; n < 40; n++) {
      const k = 3 + Math.floor(r() * 9);
      const cx = r() * 400 - 200;
      const cz = r() * 400 - 200;
      const pts = Array.from({ length: k }, (_, i) => { const a = (i / k) * Math.PI * 2; const rr = 20 + r() * 80; return [cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]; });
      const edges = polygonEdges(pts);
      const probes = [...pts, ...pts.map(([x, z], i) => [(x + pts[(i + 1) % k][0]) / 2, (z + pts[(i + 1) % k][1]) / 2])];
      for (let i = 0; i < 200; i++) probes.push([cx + r() * 400 - 200, cz + r() * 400 - 200]);
      for (const [x, z] of probes) {
        expect(Object.is(distanceToEdges(edges, x, z), oldDistance(edges, x, z))).toBe(true);
        expect(Object.is(outsidePolygon(pts, x, z, edges), oldOutside(pts, x, z, edges))).toBe(true);
      }
    }
  });

  it('never puts a polygon nearer than its bounding box', () => {
    const pts = [[0, 0], [50, 10], [40, 60], [-5, 40]];
    const b = polygonBounds(pts);
    for (const [x, z] of [[100, 100], [-60, 20], [20, -90], [10, 10]]) expect(outsideBounds(b, x, z)).toBeLessThanOrEqual(outsidePolygon(pts, x, z) + 1e-12);
  });
});

describe('each props builder\'s own stream', () => {
  it('is the same every load, differs between builders and stays in 0 to 1', () => {
    const a = streamFor('buildStubble');
    const b = streamFor('buildStubble');
    const c = streamFor('buildGrass');
    const first = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(first);
    expect(Array.from({ length: 5 }, c)).not.toEqual(first);
    for (const v of first) expect(v >= 0 && v < 1).toBe(true);
  });
});

describe('the ground cover built behind the start screen', () => {
  it('builds what the props left for later once, in order, each in its own task', async () => {
    const order = [];
    const world = { props: { later: [{ build: () => order.push('grass') }, { build: () => order.push('stubble') }] } };
    const p = World.prototype.buildLater.call(world);
    expect(order).toEqual([]); // nothing until the page has had a turn
    expect(World.prototype.buildLater.call(world)).toBe(p);
    await p;
    expect(order).toEqual(['grass', 'stubble']);
  });
});

describe('the load\'s parts timed', () => {
  it('records timed parts and laps, adds up a part timed twice and lists the slowest first', () => {
    performance.clearMeasures();
    const busy = (ms) => { const t = performance.now(); while (performance.now() - t < ms); };
    expect(timed('test · a', () => (busy(4), 42))).toBe(42);
    timed('test · a', () => busy(4));
    const lap = laps();
    busy(2);
    lap('test · b');
    const steps = loadSteps();
    expect(steps.map((s) => s.name)).toEqual(['test · a', 'test · b']);
    expect(steps[0].ms).toBeGreaterThanOrEqual(7);
    expect(slowestStepsText(steps, 1)).toMatch(/^test · a 0\.0\d s$/);
    expect(slowestStepsText([])).toBe('-');
  });
});

describe('the Moor\'s plants wait for the later list', () => {
  it('are scattered only when it is built, and take the cotton grass\'s season when they come', async () => {
    const { fakeCanvas } = await import('./helpers/vehicleModels.js');
    const { headlessContext } = await import('./helpers/worldModels.js');
    const { DrawDistance } = await import('../src/world/tiledInstances.js');
    const { DEFAULT_GRAPHICS_PARAMS } = await import('../src/core/graphics.js');
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildMoorProps } = await import('../src/world/moorProps.js');
    const draw = new DrawDistance({ ...DEFAULT_GRAPHICS_PARAMS });
    const later = [];
    const c = { ...headlessContext(), drawDistance: draw, streamFor, later, physics: { createCollider: () => ({}) }, RAPIER: { ColliderDesc: new Proxy({}, { get: () => () => ({ setTranslation: () => ({}), setRotation: () => ({}) }) }) } };
    const moor = buildMoorProps(c);
    const named = (n) => draw.groups.find((g) => g.group.name === n);
    expect(named('moor heather')).toBeUndefined();
    expect(later.map((l) => l.name)).toEqual(['moor plants']);
    moor.setDate({ month: 0, day: 10 }); // January: no cotton grass
    later[0].build();
    expect(named('moor heather').group.children.length).toBeGreaterThan(1);
    expect(moor.plants.cottonGroup.visible).toBe(false);
    vi.unstubAllGlobals();
  });
});
