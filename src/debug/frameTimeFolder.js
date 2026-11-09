// The Tune tab's "Frame time" folder: what a frame costs and where it goes (core/frameBreakdown.js), updated as you watch. It is the first thing on
// the tab, closed. Read-only: it is for finding what to look at, not for changing anything.
import { FRAME_STAGES, stageText } from '../core/frameBreakdown.js';

const show = (f, label, get) => f.add({ get v() { return get(); } }, 'v').name(label).listen().disable();

/** @param {import('./debugGui.js').DebugGui} d */
export function buildFrameTime(d) {
  const g = d.game;
  const f = d.addFolder('Tune', 'Frame time (what each part of a frame costs)');
  f.close();
  const stats = () => g.frameStats.summary();
  const info = () => g.renderer.info.render;
  show(f, 'Frames a second', () => Math.round(stats().fps));
  show(f, 'The game\'s own time', () => `${stats().ms.toFixed(2)} ms a frame, worst ${stats().worstMs.toFixed(1)}`);
  show(f, 'Slowest 1% of frames', () => `${stats().p99Ms.toFixed(1)} ms, ${stats().longFrames} over 33 ms in 10 s (${stats().longTotal} in all)`);
  for (let i = 0; i < 3; i++) show(f, `Long frame ${i + 1} (newest first)`, () => g.stutters.log.lines()[i] ?? '-');
  // Chrome only (performance.memory); a drop in the heap beside a long frame is named as a memory clean-up above.
  show(f, 'Memory', () => (performance.memory ? `${(g.stutters.heap.used / 1048576).toFixed(0)} MB, allocating ${g.stutters.heap.allocMbPerSecond.toFixed(1)} MB a second` : 'not reported by this browser'));
  show(f, 'Biggest part', () => g.frameBreakdown.biggest ?? '-');
  for (const [name] of FRAME_STAGES) show(f, name, () => stageText(g.frameBreakdown.summary().find((s) => s.name === name)));
  // The farm features split out (core/featureGuard.js times each one): the five that take the most.
  for (let i = 0; i < 5; i++) show(f, `Feature ${i + 1} of the slowest`, () => { const s = g.guard.slowest(5)[i]; return s ? `${s.name} ${s.ms.toFixed(3)} ms` : '-'; });
  // A feature whose update threw is caught so the rest of the frame runs (core/featureGuard.js); it is listed here so it is not hidden.
  show(f, 'Features that threw', () => (g.guard.total ? g.guard.summary().map((e) => `${e.name} x${e.count}`).join(', ') : 'none'));
  // The ground's tiles (world/groundTiles.js): how many are drawn at each detail, and the slowest one to build.
  show(f, 'Ground tiles', () => { const t = g.world.terrain.tileSet.stats(); return `${t.built} of ${t.tiles} (${Object.entries(t.bySteps).map(([s, n]) => `${n} at ${s} m`).join(', ')}), ${t.waiting} waiting, slowest build ${t.worstBuildMs.toFixed(1)} ms`; });
  show(f, 'Drawn', () => `${info().calls} calls, ${Math.round(info().triangles / 1000)}k triangles`);
  return f;
}
