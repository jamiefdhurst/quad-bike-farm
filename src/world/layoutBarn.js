// The barn's own things in the barn's own frame (#682). Pure: no Three.js.
//
// The barn can stand turned (`anchors.barn.yaw`), and `resolveLayout` turns everything of it with it. Code that works along the barn's axes (its
// walls, the bench, the bays, the loft, what hangs on the back wall) does so in the frame the barn has at yaw 0 about its anchor, and turns the
// results into the world's with `barnFrame` (barn.js). `layout.barnLocal` holds these keys resolved that way, so that code reads them as it always has.

import { resolveLayout } from './layoutAnchors.js';

/** The keys of the layout written inside `at('barn', ...)`, which `layout.barnLocal` holds in the barn's own frame. */
export const BARN_KEYS = [
  'barn', 'barnBaleSpots', 'loft', 'bench', 'benchCharger', 'weatherStation', 'jumperRail', 'helmetHooks', 'moneyTin', 'bay', 'bay2', 'shed',
  'jack', 'axleStands', 'rusty', 'plover', 'toolbox', 'benchOil', 'benchLeads', 'benchPack',
];

/** The layout resolved from `raw` with these `anchors`, and `barnLocal` beside it: the barn's keys with the barn not turned. */
export function resolveWithBarnLocal(raw, anchors) {
  const layout = resolveLayout({ ...raw, anchors });
  // A few readers want one coordinate of a point on its own: read off the points, once, here (and again for the barn's own frame below).
  layout.loft.edgeX = layout.loft.edge.x;
  layout.loft.ladder.footX = layout.loft.ladder.x;
  layout.village.garage.pumps.xs = layout.village.garage.pumps.spots.map(([x]) => x);
  layout.village.garage.pumps.z = layout.village.garage.pumps.spots[0][1];
  const b = anchors.barn;
  const own = resolveLayout({ ...raw, anchors: { ...anchors, barn: { x: b.x, z: b.z, yaw: 0 } } });
  const barnLocal = Object.fromEntries(BARN_KEYS.map((k) => [k, own[k]]));
  // The readers that want one coordinate of a point on its own (layout.js does this for the world's).
  barnLocal.loft.edgeX = barnLocal.loft.edge.x;
  barnLocal.loft.ladder.footX = barnLocal.loft.ladder.x;
  return { ...layout, barnLocal };
}
