// The frame's budget, held in CI (#364). Draw calls and triangles come from `renderer.info`, which still counts with the GL draws stubbed, so they
// are the same on any machine (frame ms is not: software GL makes it meaningless, so `perf` in the console and tools/perf.mjs are the local
// tools for that). They are counted from fixed spots on the farm: you at each one, looking north, east, south and west, and the worst view kept.
//
// tools/smoke.mjs measures in the page it already loads and fails over budget. `node tools/budget.mjs --dist <dir> --out <file>` loads a build
// on its own and writes the numbers (CI does that for main); `node tools/budget.mjs --summary <pr.json> [main.json]` prints the markdown
// table for the job summary, with the change from main. This file is the pure part (and the in-page measuring), tested in tests/frameBudget.test.js.
//
// A budget is raised only on purpose, with a line in docs/decisions/performance.md saying why (.claude/rules/checking.md).
/** Per spot: the most draw calls and triangles a frame may take there. */
export const BUDGETS = {
  // Every spot on the farm everybody plays (#692), measured with tools/budget.mjs on the build (seed 3, sunny, 15.5), the same on every run, and held to about 8% over:
  // spawn 731 calls and 1.74M triangles (the dev server CI's smoke test measures on; the build has 718 and 1.29M), the yard 1,815 and 1.94M, the village street 2,143 and 2.49M, the wood's gate 1,486 and 3.46M, the hilltop 1,370 and 2.03M,
  // Back Lane between its hairpins 1,507 and 2.04M, the A-road junction (14 m up the lane) 1,173 and 2.13M, the pit's gate 1,634 and 2.03M, the Moor's ridge 1,637 and 2.56M and
  // its middle 1,682 and 2.37M, and the far view (#820: the hilltop and the ridge looking east, Back Lane's north end looking south, each at the default view distance and at
  // 3,000 m, the worse kept, the same at both) 1,180 and 1.98M, 1,734 and 2.65M, 1,288 and 2.66M. The animals, the girls and the lane's traffic are not in them; the real frame,
  // moving things and all, is `tools/perf.mjs`. `movers` is everything left out of those counts, drawn up as if all of it were in view (5,440 calls and 1.39M triangles):
  // not a frame, but what a new herd, rider or vehicle body adds to the farm's moving things, which the spots no longer see. Raise it only on purpose (`MOVERS` in `measureInPage`).
  // Since #1041 (each still root's shadows in a call or two, and the barn's and yard's fixtures merged) the spawn is 494 calls and the yard 1,246, held to about 8% over.
  // Since #1072 (the sprayed and combed ground drawn only where it is worked: 65,000 and 274,000 triangles no longer in every view of Lane Field and Low Ley) the nine
  // spots that saw both are held to about 8% over their new triangles: the yard 1.81M, the village 2.24M, the wood 3.22M, the junction 1.81M, the ridge 2.23M, the Moor's
  // middle 2.04M and the far views 1.68M, 2.34M and 2.38M. Their calls did not move.
  // Since #1076 (the far hedge strips drawn a 300 m tile at a time, the far oaks and bushes a 240 m tile) every spot is a sixth to a third fewer calls, held to about 8%
  // over again, and the triangles, which rose up to 10% because a big tile partly in view draws all of its far tiles, are raised to 8% over where they had less room than
  // that (spawn 357 and 1.88M, yard 1,028 and 1.86M, wood 1,112 and 3.41M, Back Lane's far view 884 and 2.61M; the rest are below with their budgets).
  spawn: { calls: 390, triangles: 2.03e6 },
  yard: { calls: 1120, triangles: 2.02e6 },
  village: { calls: 1800, triangles: 2.45e6 },
  wood: { calls: 1210, triangles: 3.69e6 },
  hilltop: { calls: 1090, triangles: 2.30e6 },
  hairpins: { calls: 1210, triangles: 2.25e6 },
  junction: { calls: 910, triangles: 2.02e6 },
  pitGate: { calls: 1420, triangles: 2.31e6 },
  moorRidge: { calls: 1290, triangles: 2.41e6 },
  moorMiddle: { calls: 1100, triangles: 2.24e6 },
  viewHilltop: { calls: 930, triangles: 1.91e6 },
  viewMoorRidge: { calls: 1400, triangles: 2.54e6 },
  viewBackLane: { calls: 970, triangles: 2.83e6 },
  river: { calls: 1120, triangles: 2.33e6 }, // the river's crossing, 6 m back on its north landing (#999): 1,029 calls and 2.16M triangles there since #1076, held to about 8% over
  movers: { calls: 5880, triangles: 1.51e6 },
};

/** Spots over their budget today, which are reported and not failed on until the issue that brings them back under makes them strict. None now:
 * spawn came under in #365. */
export const KNOWN_OVER = [];

/** The spots `measureInPage` knows how to find by itself; any other name in `BUDGETS` has to be in `layout.budgetSpots` (a test checks). */
export const BUILT_IN_SPOTS = ['spawn', 'yard', 'village', 'wood', 'hilltop'];

/** East and south as a player's yaw (0 looks north, down -z: player.js), and the far view's spots (#820): where each stands (`from`: 'hilltop', or a name in the layout's
 * `budgetSpots`), the way it looks and the view distances it is counted at, the worst kept. 3,000 m is the most the setting allows. */
export const VIEW_DISTANCES = [1500, 3000];
export const VIEW_SPOTS = {
  viewHilltop: { from: 'hilltop', yaw: (3 * Math.PI) / 2 },
  viewMoorRidge: { from: 'moorRidge', yaw: (3 * Math.PI) / 2 },
  viewBackLane: { from: 'backLaneNorth', yaw: Math.PI },
};

export const SPOTS = Object.keys(BUDGETS).filter((k) => k !== 'movers');

/** The spots (and what is measured at each) as the page sees them. Runs in the browser, so it is self-contained. Returns { [spot]: { calls, triangles } } or { error }.
 * With `dwell` (seconds, on a real GPU: tools/perf.mjs) each view is also held that long and timed: `ms` and `worstMs` from frameStats and the three
 * slowest features, the worst view's kept. The draws are counted with everything that moves held still and out of sight (#597), so the count is the
 * farm's and the same on every run; the timing, if asked for, is with it all moving as in play. */
export async function measureInPage({ spots, headings, frames, dwell = 0, viewHeight = 0, movers = false, views = {}, viewDistances = [] }) {
  const g = window.game;
  await g.world.buildLater?.(); // the ground cover built behind the start screen (#1107)
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const settle = async (n) => { for (let i = 0; i < n; i++) await frame(); };
  const info = g.renderer.info;
  const wasAuto = info.autoReset;
  info.autoReset = false;
  // What moves through a view while it is counted (the animals, the girls, the lane's traffic), the lamps' halos and the sun's slow track (it moves the shadow square)
  // shifted the count by tens of calls from run to run (#597): they are taken out of the scene and the clock stopped for the count, and put back for the timing.
  // Taken out, not just hidden: the cat and the dog set their own `visible` every update, so hiding them held on some runs and not others.
  const MOVERS = ['flock', 'rabbits', 'rabbitEyes', 'pheasants', 'pheasantWings', 'cat', 'dog', 'farmAnimals'];
  const parked = [];
  let clockRate = null;
  let trafficUpdate = null;
  const park = (o) => {
    if (!o.parent) return;
    parked.push([o, o.parent]);
    o.parent.remove(o);
  };
  const holdStill = (on) => {
    if (on === (clockRate !== null)) return;
    if (on) {
      clockRate = g.daylight.p.clockRate;
      g.daylight.p.clockRate = 0;
      const out = g.scene.children.filter((c) => MOVERS.includes(c.name));
      out.push(...g.companions.map((c) => c.root));
      const view = g.trafficHost.view;
      trafficUpdate = view.update;
      view.update = () => {}; // its bodies and riders stay where they were, and are taken out below
      out.push(...[...view.shown.values(), ...view.kidBikes.values()].map((b) => b.object));
      out.push(...Object.values(view.rigs).map((r) => r.rig.root), ...view.kidRigs.filter(Boolean).map((k) => k.rig.root), ...view.parcels);
      g.scene.traverse((o) => { if (o.isSprite && /Halo$/.test(o.name)) out.push(o); }); // the lamps' glows come on and go off as the vehicles' lights settle, in the afternoon too
      out.forEach(park);
    } else {
      g.daylight.p.clockRate = clockRate;
      clockRate = null;
      g.trafficHost.view.update = trafficUpdate;
      while (parked.length) {
        const [o, parent] = parked.pop();
        parent.add(o);
      }
    }
  };
  // What is held out of the count, drawn up on its own as if all of it were in view (nothing is left out for being behind you or too small): the animals, the
  // girls, the lamps' halos and the lane's traffic (every body and rig it keeps ready, which `stockUp` has finished building, not the few out on the road, which is
  // chance). A root's own `visible` is ignored, since the game turns it off and on itself; an instanced mesh is one call.
  const drawsOf = (roots) => {
    const t = { calls: 0, triangles: 0 };
    const walk = (o, top) => {
      if (!top && !o.visible) return;
      if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.geometry && o.material?.visible !== false) {
        t.calls += Array.isArray(o.material) ? o.geometry.groups.length || 1 : 1;
        const geo = o.geometry;
        if (o.isMesh) t.triangles += ((geo.index?.count ?? geo.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1);
      }
      for (const c of o.children) walk(c, false);
    };
    for (const r of roots) walk(r, true);
    return t;
  };
  const moverDraws = () => {
    const view = g.trafficHost.view;
    const roots = g.scene.children.filter((c) => MOVERS.includes(c.name));
    roots.push(...g.companions.map((c) => c.root));
    roots.push(...[...view.pool.values()].flat().map((b) => b.object), ...Object.values(view.rigs).map((r) => r.rig.root), ...view.kidRigs.filter(Boolean).map((k) => k.rig.root));
    g.scene.traverse((o) => { if (o.isSprite && /Halo$/.test(o.name)) roots.push(o); });
    return drawsOf(roots);
  };
  const count = async () => {
    holdStill(true);
    g.world.sky.fit.ready = false; // the shadow window eases round to the way you look over a second or two, so the count would depend on how long it had had: snap it
    await settle(3); // the update that follows a move decides what is drawn
    g.world.terrain.tileSet.update(g.camera.position.x, g.camera.position.z, Infinity); // the ground builds its tiles a few milliseconds a frame, so a slow machine had drawn fewer of the fine ones (#760): build them all
    g.world.farDetail.update(g.camera.position, 0, true, true); // and the far detail looks only every quarter second, so bring it up to date, from scratch: what it left out depends on where it has been
    info.reset();
    // The game does not draw on every animation frame, so count the draws themselves (render.frame goes up once a render).
    const from = info.render.frame;
    for (let i = 0; i < 600 && info.render.frame - from < frames; i++) await frame();
    const drawn = Math.max(1, info.render.frame - from);
    const r = { calls: info.render.calls / drawn, triangles: info.render.triangles / drawn };
    holdStill(false);
    if (dwell > 0) {
      const from = performance.now() / 1000;
      await new Promise((ok) => setTimeout(ok, dwell * 1000)); // longer than frameStats' window, so it is this view's frames only
      const t = g.frameStats.summary();
      // The stutter figures (#373) are missing from a build of main from before they existed, which perf.mjs --main measures too.
      const low = g.frameStats.since?.(from);
      const causes = (g.stutters?.log.items ?? []).filter((x) => x.at >= from).map((x) => `${Math.round(x.ms)} ms, ${x.cause}`);
      Object.assign(r, { ms: t.ms, worstMs: t.worstMs, ...low, causes, slowest: g.guard.slowest(3), stages: g.frameBreakdown.summary().map((s) => [s.name, Math.round(s.ms * 100) / 100]) });
    }
    return r;
  };
  const worst = (a, b) => {
    const w = { calls: Math.max(a.calls, b.calls), triangles: Math.max(a.triangles, b.triangles) };
    if (b.ms !== undefined) Object.assign(w, { ms: Math.max(a.ms ?? 0, b.ms), worstMs: Math.max(a.worstMs ?? 0, b.worstMs), ...(b.p99Ms === undefined ? {} : { p99Ms: Math.max(a.p99Ms ?? 0, b.p99Ms), longFrames: (a.longFrames ?? 0) + b.longFrames }), causes: [...(a.causes ?? []), ...(b.causes ?? [])].slice(-3), slowest: (a.ms ?? -1) >= b.ms ? a.slowest : b.slowest, stages: (a.ms ?? -1) >= b.ms ? a.stages : b.stages });
    return w;
  };
  g.world.farDetail.viewHeight = viewHeight; // what is too small to see depends on the window, and the check's may be tiny: count as in one this high
  const layout = g.world.layout;
  const out = {};
  const notes = [];
  // You start the day sat in your car (#229), and the spots are stood at on foot: get out first, as you would. The spawn view is from beside it.
  if (g.player.isRiding) {
    g.tryDismount();
    await settle(10);
  }
  const home = { x: g.player.position.x, y: g.player.position.y, z: g.player.position.z, yaw: g.player.yaw, pitch: g.player.pitch };
  const standAt = (x, z) => g.player.moveTo({ x, y: g.world.groundHeightAt(x, z), z });
  const lookFrom = async (x, z) => {
    standAt(x, z);
    g.player.pitch = 0;
    let w = { calls: 0, triangles: 0 };
    for (const yaw of headings) {
      g.player.yaw = yaw;
      w = worst(w, await count());
    }
    return w;
  };
  const viewDistance = g.graphics?.viewDistance;
  // The highest point of the hill's pasture (the hilltop spot, and where the far view from it stands).
  const hilltopAt = () => {
    const p = layout.hill.pasture;
    let best = null;
    for (let x = p.minX; x <= p.maxX; x += 4) for (let z = p.minZ; z <= p.maxZ; z += 4) {
      if (p.points && !g.world.fields.hill.inPasture(x, z)) continue; // the new farm's pasture is an outline: not its rectangle's corners
      const h = g.world.heightAt(x, z);
      if (!best || h > best.h) best = { x, z, h };
    }
    return best;
  };
  try {
    if (g.player.isRiding) return { error: 'you are on a vehicle at the start' };
    await settle(10);
    while (g.pendingLooks?.length) g.dressFinds(); // the barn finds' damage is put on one at a time after Ready, 50 ms apart: how much of it is there depends on how long the page has had
    // The girls buckle their belts two seconds after they sit, and a belt is drawn across them until then.
    const belting = () => g.units.some((u) => u.quad.belts && Object.values(u.quad.belts.seats).some((seat) => seat.who === 'girl' && !seat.belted));
    for (let i = 0; i < 600 && belting(); i++) await frame();
    g.bakeWear(1e9); // the vehicles' wear is baked into their coats a little each frame, and the parts it replaces are drawn until it is: so how much is drawn depends on how long the page has had
    if (movers) {
      for (let i = 0; i < 400 && g.trafficHost.view.stockUp(); i++); // the traffic builds its bodies one at a time as the day goes on, so how many are ready depends on how long it has had
      out.movers = moverDraws();
    }
    if (spots.includes('spawn')) out.spawn = await count(); // the view the game opens on, as it is
    if (spots.includes('yard')) out.yard = await lookFrom(layout.yard.x, layout.yard.z);
    if (spots.includes('village')) {
      if (g.villageHost?.active) {
        g.villageHost.debugGoTo('shop'); // the village street
        let w = { calls: 0, triangles: 0 };
        g.player.pitch = 0;
        for (const yaw of headings) {
          g.player.yaw = yaw;
          w = worst(w, await count());
        }
        out.village = w;
      } else notes.push('no village on this farm');
    }
    if (spots.includes('wood')) {
      if (layout.woods) out.wood = await lookFrom(layout.woods.gate.x, layout.woods.leadIn[1][1]);
      else notes.push('no wood on this farm');
    }
    // The spots the layout names (`layout.budgetSpots`: { x, z } each, written from the place's anchor), by the name `BUDGETS` has them under.
    for (const name of spots) {
      if (['spawn', 'yard', 'village', 'wood', 'hilltop'].includes(name) || views[name]) continue; // (this runs in the page, so it cannot use BUILT_IN_SPOTS)
      const at = layout.budgetSpots?.[name];
      if (at) out[name] = await lookFrom(at.x, at.z);
      else notes.push(`no spot called ${name} in the layout`);
    }
    if (spots.includes('hilltop')) {
      if (layout.hill) {
        const best = hilltopAt();
        out.hilltop = await lookFrom(best.x, best.z);
      } else notes.push('no hill on this farm');
    }
    // The far view (#820): one way, at each view distance, the worst kept.
    for (const [name, v] of Object.entries(views)) {
      if (!spots.includes(name)) continue;
      const at = v.from === 'hilltop' ? (layout.hill ? hilltopAt() : null) : layout.budgetSpots?.[v.from];
      if (!at) {
        notes.push(`no ${v.from} spot on this farm for ${name}`);
        continue;
      }
      standAt(at.x, at.z);
      g.player.pitch = 0;
      g.player.yaw = v.yaw;
      let w = { calls: 0, triangles: 0 };
      for (const d of viewDistances) {
        g.graphics.viewDistance = d;
        w = worst(w, await count());
      }
      g.graphics.viewDistance = viewDistance;
      out[name] = w;
    }
  } finally {
    holdStill(false);
    if (viewDistance !== undefined) g.graphics.viewDistance = viewDistance;
    g.world.farDetail.viewHeight = 0;
    info.autoReset = wasAuto;
    g.player.moveTo({ x: home.x, y: home.y, z: home.z });
    g.player.yaw = home.yaw;
    g.player.pitch = home.pitch;
  }
  return { spots: out, notes };
}

export const MEASURE_ARGS = { spots: SPOTS, headings: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2], frames: 3, viewHeight: 1000, movers: true, views: VIEW_SPOTS, viewDistances: VIEW_DISTANCES };

/**
 * Compare measured numbers with the budgets.
 * @returns {{ rows: { spot: string, calls: number, triangles: number, budget: object, over: string[], known: boolean }[], failures: string[], missing: string[] }}
 */
export function check(measured, budgets = BUDGETS, knownOver = KNOWN_OVER) {
  const rows = [];
  const failures = [];
  const missing = [];
  for (const [spot, budget] of Object.entries(budgets)) {
    const m = measured[spot];
    if (!m) {
      missing.push(spot);
      continue;
    }
    const over = [];
    if (m.calls > budget.calls) over.push(`${Math.round(m.calls)} calls > ${budget.calls}`);
    if (m.triangles > budget.triangles) over.push(`${Math.round(m.triangles)} triangles > ${budget.triangles}`);
    const known = knownOver.includes(spot);
    rows.push({ spot, calls: m.calls, triangles: m.triangles, budget, over, known });
    if (over.length && !known) failures.push(`${spot}: ${over.join(', ')}`);
  }
  return { rows, failures, missing };
}

const n0 = (v) => Math.round(v).toLocaleString('en-GB');
const tri = (v) => `${(v / 1e6).toFixed(2)}M`;
const delta = (now, before, fmt) => {
  if (before === undefined) return '';
  const d = now - before;
  if (Math.abs(d) < 0.5) return ' (same)';
  return ` (${d > 0 ? '+' : '-'}${fmt(Math.abs(d))})`;
};

/** The job summary: a markdown table of each spot's numbers against its budget, and the change from main when its numbers are given. */
export function summary(measured, main, budgets = BUDGETS, knownOver = KNOWN_OVER) {
  const { rows, failures, missing } = check(measured, budgets, knownOver);
  const lines = ['### Frame budget', '', '| Spot | Draw calls | Triangles | Budget | |', '| --- | --- | --- | --- | --- |'];
  for (const r of rows) {
    const b = main?.[r.spot];
    const status = r.over.length ? (r.known ? 'over, known overrun' : 'OVER') : 'ok';
    lines.push(
      `| ${r.spot} | ${n0(r.calls)}${delta(r.calls, b?.calls, n0)} | ${tri(r.triangles)}${delta(r.triangles, b?.triangles, tri)} | ${n0(r.budget.calls)} calls, ${tri(r.budget.triangles)} | ${status} |`,
    );
  }
  if (missing.length) lines.push('', `Not measured: ${missing.join(', ')}.`);
  if (failures.length) lines.push('', `Over budget: ${failures.join('; ')}. Bring it back under, or raise the budget on purpose with a line in docs/decisions/performance.md.`);
  if (!main) lines.push('', 'No numbers from main to compare with.');
  return lines.join('\n');
}
