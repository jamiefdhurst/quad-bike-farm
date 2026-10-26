// The pure part of tools/perf.mjs: combining runs and the before-and-after table /perf puts in a PR. Tested in tests/perfReport.test.js.
//
// Draw calls and triangles are the same on every run (tools/frameBudget.mjs); ms a frame and the load time are not, so several runs are taken
// and the median kept, and a change smaller than NOISE is called "same" rather than a win.
import { BUDGETS } from './frameBudget.mjs';

/** Budgets that only mean something on a real GPU, checked locally and never in CI. */
export const LOCAL_BUDGETS = {
  ms: 8, // the game's own work a frame at any spot (the simulation and handing the frame over), on Jamie's Mac
  readyS: 2.5, // seconds from opening the page to "Ready" (.claude/rules/checking.md)
};

/** How far a measured number has to move to count as a change, not run-to-run noise. Two builds of the same game on Jamie's Mac differed by up
 * to 1 ms a frame at a spot and 3 ms in the worst frame; calls and triangles drift a little with main between a before and an after. */
export const NOISE = { calls: 25, triangles: 20000, ms: 1.2, worstMs: 4, p99Ms: 4, longFrames: 1, readyS: 0.2, mb: 0.5 };

const median = (xs) => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return undefined;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

/** Several runs of { load, spots } into one: each number the median of the runs, the slowest features from the run nearest that median. */
export function combineRuns(runs) {
  const load = {};
  for (const k of ['readyS', 'mb', 'heapMb']) load[k] = median(runs.map((r) => r.load?.[k]));
  const spots = {};
  for (const spot of new Set(runs.flatMap((r) => Object.keys(r.spots ?? {})))) {
    const all = runs.map((r) => r.spots?.[spot]).filter(Boolean);
    const s = {};
    for (const k of ['calls', 'triangles', 'ms', 'worstMs', 'p99Ms', 'longFrames']) s[k] = median(all.map((x) => x[k]));
    const near = [...all].sort((a, b) => Math.abs((a.ms ?? 0) - (s.ms ?? 0)) - Math.abs((b.ms ?? 0) - (s.ms ?? 0)))[0];
    if (near?.slowest) s.slowest = near.slowest;
    const causes = all.flatMap((x) => x.causes ?? []);
    if (causes.length) s.causes = causes.slice(-3);
    spots[spot] = s;
  }
  return { load, spots };
}

/** Each number over its budget, as lines: the frame budget's calls and triangles and the local ms and load time. */
export function overBudget(m) {
  const over = [];
  for (const [spot, s] of Object.entries(m.spots)) {
    const b = BUDGETS[spot];
    if (b && s.calls > b.calls) over.push(`${spot}: ${Math.round(s.calls)} calls > ${b.calls}`);
    if (b && s.triangles > b.triangles) over.push(`${spot}: ${(s.triangles / 1e6).toFixed(2)}M triangles > ${(b.triangles / 1e6).toFixed(1)}M`);
    if (s.ms > LOCAL_BUDGETS.ms) over.push(`${spot}: ${s.ms.toFixed(1)} ms a frame > ${LOCAL_BUDGETS.ms}`);
  }
  if (m.load?.readyS > LOCAL_BUDGETS.readyS) over.push(`load: ${m.load.readyS.toFixed(2)} s to Ready > ${LOCAL_BUDGETS.readyS}`);
  return over;
}

/** The change in one number: '' with nothing to compare, 'same' within the noise, else signed with the percentage. */
export function change(now, before, noise, fmt = (v) => String(Math.round(v))) {
  if (before === undefined || now === undefined) return '';
  const d = now - before;
  if (Math.abs(d) < noise) return 'same';
  const pct = before ? `, ${d > 0 ? '+' : ''}${Math.round((d / before) * 100)}%` : '';
  return `${d > 0 ? '+' : '-'}${fmt(Math.abs(d))}${pct}`;
}

/** Did anything move beyond the noise, and which way? 'better', 'worse', 'mixed' or 'same'. */
export function verdict(after, before) {
  let better = 0;
  let worse = 0;
  const cmp = (a, b, noise) => {
    if (a === undefined || b === undefined || Math.abs(a - b) < noise) return;
    if (a < b) better++;
    else worse++;
  };
  for (const [spot, s] of Object.entries(after.spots)) {
    const b = before.spots?.[spot];
    if (!b) continue;
    for (const k of ['calls', 'triangles', 'ms']) cmp(s[k], b[k], NOISE[k]);
  }
  cmp(after.load?.readyS, before.load?.readyS, NOISE.readyS);
  return better && worse ? 'mixed' : better ? 'better' : worse ? 'worse' : 'same';
}

const n0 = (v) => Math.round(v).toLocaleString('en-GB');
const tri = (v) => `${(v / 1e6).toFixed(2)}M`;
const ms1 = (v) => v.toFixed(1);
const s2 = (v) => v.toFixed(2);
const cell = (now, before, noise, fmt) => {
  if (now === undefined) return '';
  const c = change(now, before, noise, fmt);
  return before === undefined ? fmt(now) : `${fmt(before)} → ${fmt(now)}${c && c !== 'same' ? ` (${c})` : ''}`;
};

/** The markdown table for a PR body and the decisions file: each spot and the load, before and after (or just now, with no `before`). */
export function report(after, before) {
  const lines = ['| Spot | Draw calls | Triangles | ms a frame | Worst frame ms | 1% low ms | Frames over 33 ms |', '| --- | --- | --- | --- | --- | --- | --- |'];
  for (const [spot, s] of Object.entries(after.spots)) {
    const b = before?.spots?.[spot] ?? {};
    lines.push(
      `| ${spot} | ${cell(s.calls, b.calls, NOISE.calls, n0)} | ${cell(s.triangles, b.triangles, NOISE.triangles, tri)} | ${cell(s.ms, b.ms, NOISE.ms, ms1)} | ${cell(s.worstMs, b.worstMs, NOISE.worstMs, ms1)} | ${cell(s.p99Ms, b.p99Ms, NOISE.p99Ms, ms1)} | ${cell(s.longFrames, b.longFrames, NOISE.longFrames, n0)} |`,
    );
  }
  const l = after.load ?? {};
  const lb = before?.load ?? {};
  lines.push('', `Load: ${cell(l.readyS, lb.readyS, NOISE.readyS, s2)} s to Ready, ${cell(l.mb, lb.mb, NOISE.mb, ms1)} MB fetched.`);
  const slow = Object.entries(after.spots).filter(([, s]) => s.slowest?.length).map(([spot, s]) => `${spot}: ${s.slowest.map((f) => `${f.name} ${f.ms.toFixed(2)}`).join(', ')}`);
  if (slow.length) lines.push('', `Slowest features (ms): ${slow.join('; ')}.`);
  const stutter = Object.entries(after.spots).filter(([, s]) => s.causes?.length).map(([spot, s]) => `${spot}: ${s.causes.join(' / ')}`);
  if (stutter.length) lines.push('', `Long frames and what caused them: ${stutter.join('; ')}.`);
  if (before) lines.push('', `Overall: ${verdict(after, before)}.`);
  const over = overBudget(after);
  if (over.length) lines.push('', `Over budget: ${over.join('; ')}.`);
  return lines.join('\n');
}
