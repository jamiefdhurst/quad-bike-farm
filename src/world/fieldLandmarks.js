// The field landmarks' shapes (#815), pure: the pond's dish in Far Field and which landmarks the game builds itself. `layout.fieldLandmarks` has every
// field's landmark (layoutNew.js, `FIELD_LANDMARKS_PLAN`); the pieces that draw them are in landmarkProps.js.

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The landmarks this issue builds, by kind. The others only have their place here: #711 (the line), #624 (the barn), #684 (the hut and the rock) and #713 (the pillar) build theirs. */
export const BUILT_KINDS = ['loneOak', 'oldGateposts', 'deadElm', 'farPond', 'castRoller', 'loneAsh', 'brookAlders', 'bigOaks', 'pollardOak'];

/** The pond's ground: the dish goes `DISH` m deep at its middle and the water stands `WATER` m deep there; the dish reaches `REACH` of the pond's radii out. */
export const POND = { depth: 0.9, water: 0.5, reach: 1.25 };

/** The landmarks of `kind` in a layout (none on today's farm, which has no `fieldLandmarks`). */
export const landmarksOf = (layout, kind) => (layout.fieldLandmarks ?? []).filter((l) => l.kind === kind);

/**
 * The pond at `spot` (`at`, `rx`, `rz` in metres): how far it is cut into the ground at (x, z), and how far (x, z) is through it, 0 at the middle and 1 at the
 * edge of the dish. The cut is the same shape as the Wet Meadow's (hill.js `pondCut`): flat-bottomed to 30% of the way out, then easing up to the bank.
 */
export function pondShape(spot, p = POND) {
  const [cx, cz] = spot.at;
  // An irregular outline, not an ellipse: the reach swells and shrinks a tenth or so round the bank.
  const reach = (angle) => 1 + 0.1 * Math.sin(2 * angle + 1.3) + 0.06 * Math.sin(3 * angle + 0.4);
  const through = (x, z) => Math.hypot((x - cx) / (spot.rx * p.reach), (z - cz) / (spot.rz * p.reach)) / reach(Math.atan2(z - cz, x - cx));
  return {
    through,
    cut(x, z) {
      const r = through(x, z);
      return r >= 1 ? 0 : p.depth * (1 - smoothstep(0.3, 1, r));
    },
  };
}
