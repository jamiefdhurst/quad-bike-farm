import { describe, it, expect, vi, afterEach } from 'vitest';
import { BUDGETS, BUILT_IN_SPOTS, KNOWN_OVER, MEASURE_ARGS, SPOTS, check, measureInPage, summary } from '../tools/frameBudget.mjs';
import { LAYOUT } from '../src/world/layout.js';

const under = () => Object.fromEntries(Object.keys(BUDGETS).map((s) => [s, { calls: BUDGETS[s].calls - 10, triangles: BUDGETS[s].triangles - 1000 }]));

describe('the frame budget', () => {
  it('passes when every spot is under', () => {
    const r = check(under());
    expect(r.failures).toEqual([]);
    expect(r.missing).toEqual([]);
    expect(r.rows).toHaveLength(SPOTS.length + 1); // the spots and the movers
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

  it('keeps spawn at the budget it was given when the count was made repeatable (#597), its triangles tightened by the ground in tiles (#665)', () => {
    expect(BUDGETS.spawn).toEqual({ calls: 630, triangles: 2.93e6 });
  });

  it('has a budget for what is left out of the spots, which is not a spot to stand at (#597)', () => {
    expect(BUDGETS.movers.calls).toBeGreaterThan(0);
    expect(BUDGETS.movers.triangles).toBeGreaterThan(0);
    expect(SPOTS).not.toContain('movers');
  });

  it('fails the movers over their budget, as a spot is', () => {
    const m = under();
    m.movers = { calls: BUDGETS.movers.calls + 1, triangles: 0 };
    const r = check(m);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain('movers');
  });

  it('lists the movers in the summary', () => {
    expect(summary(under())).toContain('| movers |');
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

  // A stand-in page: a scene whose renderer counts one call for each thing still attached to it, so what is taken out while it counts shows in the number.
  const node = (name, extra = {}) => {
    const o = { name, visible: true, parent: null, children: [], isMesh: true, geometry: { groups: [], attributes: { position: { count: 3 } } }, material: {}, ...extra };
    o.add = (c) => { c.parent?.remove(c); c.parent = o; o.children.push(c); };
    o.remove = (c) => { o.children = o.children.filter((x) => x !== c); c.parent = null; };
    return o;
  };

  const standIn = ({ pool = [], stock = 0 } = {}) => {
    const scene = node('scene', { isMesh: false });
    const flock = node('flock');
    const wall = node('wall');
    // The dog sets its own `visible` every frame, so hiding it would not hold.
    const dog = node('dog', { visible: true });
    const halo = node('headlightHalo', { isSprite: true, isMesh: false });
    const lamp = node('lamp');
    lamp.add(halo);
    const girl = { root: node('girl') };
    const bus = node('bus');
    scene.add(flock);
    scene.add(wall);
    scene.add(dog);
    scene.add(lamp);
    scene.add(girl.root);
    scene.add(bus);
    const attached = (o) => { for (let p = o; p; p = p.parent) if (p === scene) return true; return false; };
    const all = [flock, wall, dog, halo, lamp, girl.root, bus];
    const trafficUpdate = () => {};
    const info = { autoReset: true, render: { frame: 0, calls: 0, triangles: 0 }, reset() { this.render.calls = 0; this.render.triangles = 0; } };
    const seen = [];
    const calls = { dressed: 0, baked: 0, stocked: 0, fresh: [], tileBudgets: [] };
    let toStock = stock;
    const g = {
      renderer: { info },
      camera: { position: {} },
      scene: { children: scene.children, remove: (o) => scene.remove(o), add: (o) => scene.add(o), traverse: (f) => all.forEach(f) },
      companions: [girl],
      units: [],
      pendingLooks: [1, 2],
      dressFinds() { calls.dressed++; this.pendingLooks.shift(); },
      bakeWear() { calls.baked++; },
      daylight: { p: { clockRate: 1 } },
      world: {
        farDetail: { update(p, dt, now, fresh) { calls.fresh.push(fresh); }, viewHeight: 0 },
        terrain: { tileSet: { update(x, z, budgetMs) { calls.tileBudgets.push(budgetMs); } } },
        sky: { fit: { ready: true } },
        layout: { yard: { x: 0, z: 0 } },
        groundHeightAt: () => 0,
      },
      trafficHost: {
        view: {
          update: trafficUpdate,
          shown: new Map([['v', { object: bus }]]),
          kidBikes: new Map(),
          rigs: {},
          kidRigs: [],
          parcels: [],
          pool: new Map([['a', pool]]),
          stockUp: () => { calls.stocked++; return toStock-- > 0; },
        },
      },
      player: { isRiding: false, position: { x: 0, y: 0, z: 0 }, moveTo() {}, yaw: 0, pitch: 0 },
      frameStats: { summary: () => ({ ms: 1, worstMs: 2 }), since: () => ({}) },
      guard: { slowest: () => [] },
      frameBreakdown: { summary: () => [] },
    };
    // The scene's children are the real list, for the game's own look-ups.
    g.scene.children = scene.children;
    Object.defineProperty(g.scene, 'children', { get: () => scene.children });
    vi.stubGlobal('window', { game: g });
    vi.stubGlobal('performance', { now: () => 0 });
    vi.stubGlobal('requestAnimationFrame', (f) => {
      dog.visible = true;
      info.render.frame++;
      info.render.calls += all.filter((o) => o.isMesh && attached(o)).length;
      seen.push({ clock: g.daylight.p.clockRate, fit: g.world.sky.fit.ready, update: g.trafficHost.view.update });
      queueMicrotask(f);
    });
    return { g, scene, all, seen, trafficUpdate, calls, dog, bus, girl, halo, lamp };
  };

  const args = { ...MEASURE_ARGS, spots: ['yard'], headings: [0], frames: 1, movers: false };

  it('counts without what moves, with the clock stopped and the shadow window snapped, and puts it all back', async () => {
    const { g, all, scene, trafficUpdate, halo, lamp } = standIn();
    const r = await measureInPage(args);
    expect(r.spots.yard.calls).toBe(2); // the wall and the lamp: the flock, the dog, the girl, the bus and the lamp's halo are out of the count
    expect(all.filter((o) => o !== halo).every((o) => o.parent === scene || o.parent === null || o.parent === lamp)).toBe(true);
    expect(all.every((o) => o.parent !== null)).toBe(true);
    expect(halo.parent).toBe(lamp);
    expect(g.daylight.p.clockRate).toBe(1);
    expect(g.trafficHost.view.update).toBe(trafficUpdate);
  });

  describe('spots by the layout\'s names (#665)', () => {
    it('stands you at a place the layout names and counts there, under that name', async () => {
      const { g } = standIn();
      g.world.layout.budgetSpots = { dairy: { x: 700, z: -250 } };
      const stood = [];
      g.player.moveTo = (p) => stood.push([p.x, p.z]);
      const r = await measureInPage({ ...args, spots: ['yard', 'dairy'] });
      expect(stood).toContainEqual([700, -250]);
      expect(r.spots.dairy.calls).toBe(2);
    });

    it('says so, and measures nothing, for a name the layout does not have', async () => {
      standIn();
      const r = await measureInPage({ ...args, spots: ['yard', 'dairy'] });
      expect(r.spots.dairy).toBeUndefined();
      expect(r.notes.join()).toContain('dairy');
    });

    it('has, for every spot in BUDGETS, a way to find it: a built-in one or a name in the layout', () => {
      for (const s of SPOTS) expect(BUILT_IN_SPOTS.includes(s) || LAYOUT.budgetSpots?.[s], `no way to stand at the budget spot ${s}: add it to layout.budgetSpots`).toBeTruthy();
    });
  });

  it('keeps out a thing that turns itself visible every frame, which hiding it would not (the dog and the cat do)', async () => {
    const { dog } = standIn();
    const r = await measureInPage(args);
    expect(dog.visible).toBe(true);
    expect(r.spots.yard.calls).toBe(2);
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
    const { all, scene, lamp } = standIn();
    const during = [];
    vi.stubGlobal('setTimeout', (f) => { during.push(all.every((o) => o.parent === scene || o.parent === lamp)); f(); });
    await measureInPage({ ...args, dwell: 1 });
    expect(during).toEqual([true]);
  });

  it('finishes what the page does a little at a time after Ready before it counts, and looks at the far detail from scratch', async () => {
    const { calls } = standIn({ stock: 3 });
    await measureInPage({ ...args, movers: true });
    expect(calls.dressed).toBe(2); // the barn finds' damage
    expect(calls.baked).toBe(1); // the wear
    expect(calls.stocked).toBe(4); // the traffic's bodies, until it has none left to make
    expect(calls.fresh.length).toBeGreaterThan(0);
    expect(calls.fresh.every((f) => f === true)).toBe(true);
    // The ground builds its tiles a few milliseconds a frame in play, so a slow machine would count fewer of the fine ones (#760): every one is built first.
    expect(calls.tileBudgets.length).toBe(calls.fresh.length);
    expect(calls.tileBudgets.every((b) => b === Infinity)).toBe(true);
  });

  describe('the movers', () => {
    const body = () => {
      const root = node('body', { isMesh: false, visible: false }); // an idle body is kept hidden: its own flag is not what counts
      const a = node('panel');
      const b = node('glass', { material: [{}, {}], geometry: { groups: [{}, {}], index: { count: 6 }, attributes: { position: { count: 4 } } } });
      const hidden = node('part', { visible: false });
      const instanced = node('bolts', { isInstancedMesh: true, count: 50, geometry: { groups: [], index: { count: 36 }, attributes: { position: { count: 8 } } } });
      root.add(a);
      root.add(b);
      root.add(hidden);
      root.add(instanced);
      return root;
    };

    it('adds up what is held out as if all of it were in view, an instanced mesh counting once', async () => {
      const { girl } = standIn({ pool: [{ object: body() }, { object: body() }] });
      girl.root.add(node('shirt'));
      const r = await measureInPage({ ...args, movers: true });
      // each body: a panel, two for the glass, one instanced mesh = 4 calls; two of them = 8. The flock, the dog, the girl (and her shirt), the lamp's halo: 1, 1, 2, 1.
      expect(r.spots.movers.calls).toBe(8 + 1 + 1 + 2 + 1);
      // triangles: a panel 1, the glass 2, the bolts 12 each of 50 = 600; so 603 a body
      expect(r.spots.movers.triangles).toBeGreaterThanOrEqual(2 * 603);
    });

    it('is the same however often it is measured, and does not count the few vehicles out on the road', async () => {
      standIn({ pool: [{ object: body() }] });
      const a = await measureInPage({ ...args, movers: true });
      const b = await measureInPage({ ...args, movers: true });
      expect(b.spots.movers).toEqual(a.spots.movers);
    });

    it('is not worked out unless asked (perf.mjs does not want it)', async () => {
      standIn();
      const r = await measureInPage(args);
      expect(r.spots.movers).toBeUndefined();
    });
  });
});
