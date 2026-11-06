// The frame budget over time (#373): every merge to main adds the five spots' draw calls and triangles to a history kept as a CI artifact
// (the Release workflow, .github/workflows/release.yml), and the Smoke job's summary shows the last ten as a trend, so a creep shows before it crosses a budget.
// Pure; the command line is in tools/budget.mjs. Tested in tests/budgetHistory.test.js.

/** One merge: when, which commit, what it was called, and each spot's { calls, triangles }. */
export function entry({ sha, label, at }, measured) {
  const spots = {};
  for (const [spot, m] of Object.entries(measured)) spots[spot] = { calls: Math.round(m.calls), triangles: Math.round(m.triangles) };
  return { at, sha: sha.slice(0, 7), label, spots };
}

/** The history with `e` on the end (a commit already in it is replaced, so a re-run doesn't double it), keeping the last `keep`. */
export function append(history, e, keep = 60) {
  return [...history.filter((h) => h.sha !== e.sha), e].slice(-keep);
}

/** The newest merge's numbers in the shape a measurement has ({ spot: { calls, triangles } }) and its commit, or null with no history:
 * what the Smoke job compares a PR with, rather than building and measuring main again (#636). */
export function latest(history) {
  const e = history?.[history.length - 1];
  return e ? { sha: e.sha, spots: e.spots } : null;
}

const SPARK = '▁▂▃▄▅▆▇█';
const spark = (vs) => {
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  return vs.map((v) => SPARK[hi === lo ? 3 : Math.round(((v - lo) / (hi - lo)) * (SPARK.length - 1))]).join('');
};

/** The markdown for the job summary: per spot, the last `last` merges' calls and triangles, oldest first, with a bar and the change over them. */
export function trend(history, last = 10) {
  const h = history.slice(-last);
  if (h.length < 2) return '';
  const spots = Object.keys(h[h.length - 1].spots);
  const lines = [`### Last ${h.length} merges to main`, '', '| Spot | Draw calls | Over the merges | Triangles (M) | Over the merges |', '| --- | --- | --- | --- | --- |'];
  for (const spot of spots) {
    const rows = h.map((x) => x.spots[spot]).filter(Boolean);
    if (rows.length < 2) continue;
    const calls = rows.map((r) => r.calls);
    const tris = rows.map((r) => r.triangles / 1e6);
    const d = (vs, f) => { const x = vs[vs.length - 1] - vs[0]; return `${spark(vs)} ${x >= 0 ? '+' : '-'}${f(Math.abs(x))}`; };
    lines.push(`| ${spot} | ${calls[0].toLocaleString('en-GB')} → ${calls[calls.length - 1].toLocaleString('en-GB')} | ${d(calls, (v) => String(Math.round(v)))} | ${tris[0].toFixed(2)} → ${tris[tris.length - 1].toFixed(2)} | ${d(tris, (v) => v.toFixed(2))} |`);
  }
  lines.push('', `From ${h[0].sha} to ${h[h.length - 1].sha}: ${h.map((x) => x.label).filter(Boolean).slice(-3).join('; ')}.`);
  return lines.join('\n');
}
