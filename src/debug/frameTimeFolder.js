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
  show(f, 'Biggest part', () => g.frameBreakdown.biggest ?? '-');
  for (const [name] of FRAME_STAGES) show(f, name, () => stageText(g.frameBreakdown.summary().find((s) => s.name === name)));
  show(f, 'Drawn', () => `${info().calls} calls, ${Math.round(info().triangles / 1000)}k triangles`);
  return f;
}
