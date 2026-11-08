import { describe, it, expect, vi, afterEach } from 'vitest';
import { BUDGETS, KNOWN_OVER, MEASURE_ARGS, SPOTS, check, measureInPage, summary } from '../tools/frameBudget.mjs';

const under = () => Object.fromEntries(SPOTS.map((s) => [s, { calls: BUDGETS[s].calls - 10, triangles: BUDGETS[s].triangles - 1000 }]));

describe('the frame budget', () => {
  it('passes when every spot is under', () => {
    const r = check(under());
    expect(r.failures).toEqual([]);
    expect(r.missing).toEqual([]);
    expect(r.rows).toHaveLength(SPOTS.length);
  });

  it('fails a spot over on calls or on triangles, naming it', () => {
    const m = under();
    m.yard = { calls: BUDGETS.yard.calls + 1, triangles: 0 };
    m.wood = { calls: 0, triangles: BUDGETS.wood.triangles + 1 };
    const r = check(m);
    expect(r.failures).toHaveLength(2);
    expect(r.failures[0]).toContain('yard');
    expect(r.failures[1]).toContain('wood');
  });

  it('reports a known overrun without failing on it', () => {
    const m = under();
    m.spawn = { calls: BUDGETS.spawn.calls * 2, triangles: 0 };
    const r = check(m, BUDGETS, ['spawn']);
    expect(r.failures).toEqual([]);
    expect(r.rows.find((x) => x.spot === 'spawn')).toMatchObject({ known: true });
    expect(r.rows.find((x) => x.spot === 'spawn').over).toHaveLength(1);
  });

  it('fails a known overrun once it is struck from the list', () => {
    const m = under();
    m.spawn = { calls: BUDGETS.spawn.calls * 2, triangles: 0 };
    expect(check(m, BUDGETS, []).failures).toHaveLength(1);
  });

  it('lists a spot that was not measured', () => {
    const m = under();
    delete m.village;
    expect(check(m).missing).toEqual(['village']);
  });

  it('keeps spawn at the budget it was given when the count was made repeatable (#597)', () => {
    expect(BUDGETS.spawn).toEqual({ calls: 640, triangles: 3.25e6 });
  });

  it('only knows overruns for spots that have a budget', () => {
    for (const k of KNOWN_OVER) expect(BUDGETS[k]).toBeDefined();
  });

  it('prints each spot with the change from main', () => {
    const m = under();
    const main = { ...under(), yard: { calls: m.yard.calls - 100, triangles: m.yard.triangles } };
    const text = summary(m, main);
    expect(text).toContain('| yard |');
    expect(text).toContain('(+100)');
    expect(text).toContain('(same)');
    expect(text).not.toContain('No numbers from main');
  });

  it('says so without main\'s numbers, and flags what is over', () => {
    const m = under();
    m.hilltop = { calls: 1e5, triangles: 1 };
    const text = summary(m);
    expect(text).toContain('No numbers from main');
    expect(text).toContain('Over budget: hilltop');
  });
});

describe('counting the draws (#597)', () => {
  afterEach(() => vi.unstubAllGlobals());

  // A stand-in page: a game whose renderer counts one call a visible thing, so what is hidden while it counts shows in the number.
  const standIn = () => {
    const mk = (name, extra = {}) => ({ name, visible: true, isSprite: false, ...extra });
    const flock = mk('flock');
    const halo = mk('headlightHalo', { isSprite: true });
    const wall = mk('wall');
    const girl = { root: mk('girl') };
    const bus = mk('bus');
    const items = [flock, halo, wall, girl.root, bus];
    const trafficUpdate = () => {};
    const info = { autoReset: true, render: { frame: 0, calls: 0, triangles: 0 }, reset() { this.render.calls = 0; this.render.triangles = 0; } };
    const seen = [];
    const g = {
      renderer: { info },
      camera: { position: {} },
      scene: { children: [flock, wall], traverse: (f) => items.forEach(f) },
      companions: [girl],
      daylight: { p: { clockRate: 1 } },
      world: {
        farDetail: { update() {}, viewHeight: 0 },
        sky: { fit: { ready: true } },
        layout: { yard: { x: 0, z: 0 } },
        groundHeightAt: () => 0,
      },
      trafficHost: { view: { update: trafficUpdate, shown: new Map([['v', { object: bus }]]), kidBikes: new Map(), rigs: {}, kidRigs: [], parcels: [] } },
      player: { isRiding: false, position: { x: 0, y: 0, z: 0 }, moveTo() {}, yaw: 0, pitch: 0 },
      frameStats: { summary: () => ({ ms: 1, worstMs: 2 }), since: () => ({}) },
      guard: { slowest: () => [] },
      frameBreakdown: { summary: () => [] },
    };
    vi.stubGlobal('window', { game: g });
    vi.stubGlobal('performance', { now: () => 0 });
    vi.stubGlobal('requestAnimationFrame', (f) => {
      info.render.frame++;
      info.render.calls += items.filter((o) => o.visible).length;
      seen.push({ clock: g.daylight.p.clockRate, fit: g.world.sky.fit.ready, update: g.trafficHost.view.update });
      queueMicrotask(f);
    });
    return { g, items, seen, trafficUpdate };
  };

  const args = { ...MEASURE_ARGS, spots: ['yard'], headings: [0], frames: 1 };

  it('counts without what moves, with the clock stopped and the shadow window snapped, and puts it all back', async () => {
    const { g, items, trafficUpdate } = standIn();
    const r = await measureInPage(args);
    expect(r.spots.yard.calls).toBe(1); // only the wall: the flock, the girl, the bus and the lamp's halo are out of the count
    expect(items.every((o) => o.visible)).toBe(true);
    expect(g.daylight.p.clockRate).toBe(1);
    expect(g.trafficHost.view.update).toBe(trafficUpdate);
  });

  it('stops the clock and freezes the traffic only while it counts', async () => {
    const { seen, trafficUpdate } = standIn();
    await measureInPage(args);
    const counting = seen.filter((s) => s.clock === 0);
    expect(counting.length).toBeGreaterThan(0);
    expect(counting.every((s) => s.update !== trafficUpdate)).toBe(true);
    expect(seen.some((s) => s.fit === false)).toBe(true);
  });

  it('times with everything moving as in play', async () => {
    const { items } = standIn();
    const during = [];
    vi.stubGlobal('setTimeout', (f) => { during.push(items.every((o) => o.visible)); f(); });
    await measureInPage({ ...args, dwell: 1 });
    expect(during).toEqual([true]);
  });
});
