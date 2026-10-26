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
  spawn: { calls: 2040, triangles: 3.5e6 },
  // The others are what each measured after #451 (yard 2,432 and 3.50M, the most the smoke test saw, village 3,170 and 3.80M, wood 1,232 and 3.80M, hilltop 1,530 and 6.70M)
  // and about 8% over. Before it (and after #365) they were 2,945, 3,957, 1,901 and 2,396 calls: parts too small to see are no longer drawn.
  yard: { calls: 2630, triangles: 3.8e6 },
  village: { calls: 3430, triangles: 4.1e6 },
  wood: { calls: 1330, triangles: 4.1e6 },
  hilltop: { calls: 1650, triangles: 7.2e6 },
};

/** Spots over their budget today, which are reported and not failed on until the issue that brings them back under makes them strict. None now:
 * spawn came under in #365. */
export const KNOWN_OVER = [];

export const SPOTS = Object.keys(BUDGETS);

/** The spots (and what is measured at each) as the page sees them. Runs in the browser, so it is self-contained. Returns { [spot]: { calls, triangles } } or { error }.
 * With `dwell` (seconds, on a real GPU: tools/perf.mjs) each view is also held that long and timed: `ms` and `worstMs` from frameStats and the three
 * slowest features, the worst view's kept. */
export async function measureInPage({ spots, headings, frames, dwell = 0, viewHeight = 0 }) {
  const g = window.game;
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const settle = async (n) => { for (let i = 0; i < n; i++) await frame(); };
  const info = g.renderer.info;
  const wasAuto = info.autoReset;
  info.autoReset = false;
  const count = async () => {
    await settle(3); // the update that follows a move decides what is drawn
    g.world.farDetail.update(g.camera.position, 0, true); // and the far detail looks only every quarter second, so bring it up to date
    info.reset();
    // The game does not draw on every animation frame, so count the draws themselves (render.frame goes up once a render).
    const from = info.render.frame;
    for (let i = 0; i < 600 && info.render.frame - from < frames; i++) await frame();
    const drawn = Math.max(1, info.render.frame - from);
    const r = { calls: info.render.calls / drawn, triangles: info.render.triangles / drawn };
    if (dwell > 0) {
      await new Promise((ok) => setTimeout(ok, dwell * 1000)); // longer than frameStats' window, so it is this view's frames only
      const t = g.frameStats.summary();
      Object.assign(r, { ms: t.ms, worstMs: t.worstMs, slowest: g.guard.slowest(3), stages: g.frameBreakdown.summary().map((s) => [s.name, Math.round(s.ms * 100) / 100]) });
    }
    return r;
  };
  const worst = (a, b) => {
    const w = { calls: Math.max(a.calls, b.calls), triangles: Math.max(a.triangles, b.triangles) };
    if (b.ms !== undefined) Object.assign(w, { ms: Math.max(a.ms ?? 0, b.ms), worstMs: Math.max(a.worstMs ?? 0, b.worstMs), slowest: (a.ms ?? -1) >= b.ms ? a.slowest : b.slowest, stages: (a.ms ?? -1) >= b.ms ? a.stages : b.stages });
    return w;
  };
  g.world.farDetail.viewHeight = viewHeight; // what is too small to see depends on the window, and the check's may be tiny: count as in one this high
  const layout = g.world.layout;
  const out = {};
  const notes = [];
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
  try {
    if (g.player.isRiding) return { error: 'you are on a vehicle at the start' };
    await settle(10);
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
    if (spots.includes('hilltop')) {
      if (layout.hill) {
        const p = layout.hill.pasture;
        let best = null;
        for (let x = p.minX; x <= p.maxX; x += 4) for (let z = p.minZ; z <= p.maxZ; z += 4) {
          const h = g.world.heightAt(x, z);
          if (!best || h > best.h) best = { x, z, h };
        }
        out.hilltop = await lookFrom(best.x, best.z);
      } else notes.push('no hill on this farm');
    }
  } finally {
    g.world.farDetail.viewHeight = 0;
    info.autoReset = wasAuto;
    g.player.moveTo({ x: home.x, y: home.y, z: home.z });
    g.player.yaw = home.yaw;
    g.player.pitch = home.pitch;
  }
  return { spots: out, notes };
}

export const MEASURE_ARGS = { spots: SPOTS, headings: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2], frames: 3, viewHeight: 1000 };

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
    if (!m) { missing.push(spot); continue; }
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
