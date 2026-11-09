// How much the renderer is asked to do: how often a frame is drawn, at what resolution, and how far small ground cover reaches. See
// docs/decisions/world.md, "Drawing less (frame time)".

export const DEFAULT_GRAPHICS_PARAMS = {
  maxFps: 60, // frames drawn a second at most (0: as often as the screen asks, 120 on a ProMotion Mac); the physics steps at 60 regardless
  renderScale: 1.5, // pixels drawn per screen point at most (2 is full Retina); never more than the screen has
  coverDistance: 70, // metres the grass and the stubble are drawn out to (0: all of it)
  roughDistance: 75, // metres the tussocks and bracken on the hill are drawn out to (0: all of it)
  setPieceDistance: 160, // metres a set piece (the neighbour's farm, brushwood, logs, cone courses, the village) is drawn out to, from its nearest edge (0: all)
  fullDistance: 45, // metres from its nearest edge within which the village and the neighbour's farm are drawn in full, not as a plain far version (0: always full)
  hedgeFullDistance: 150, // metres from a tile of hedge or wall within which its leafy blocks are drawn, and beyond which a plain strip is (0: always the blocks)
  barnPropsDistance: 25, // metres the barn's racks, charger, generator and jacks are drawn out to, from their nearest edge: more than the barn's corner to corner, so none vanish from inside it (0: all of them)
  vehicleDetailDistance: 60, // metres beyond which a vehicle loses its small parts (bolts, cables, decals, brake bits; 0: never)
  shadowDistance: 80, // metres beyond which a vehicle casts no shadow (0: always)
  shadowSize: 64, // metres across the square the sun's shadows are drawn in (it was 90, centred on you)
  shadowAhead: 22, // metres that square is pushed ahead of you along the way you look, so little is drawn behind you (0: centred on you)
  partPixels: 1, // screen points a part's bounding sphere has to span (radius) to be drawn: a bolt, a cable or a fender too far off to see is left out (0: all drawn)
  smallShadowDistance: 20, // metres beyond which a small thing (a mug, a bottle, a tool, a bolt) casts no shadow (0: always)
};

export const GRAPHICS_PARAM_RANGES = {
  maxFps: [0, 240, 10],
  renderScale: [0.5, 3, 0.25],
  coverDistance: [0, 400, 5],
  roughDistance: [0, 400, 5],
  setPieceDistance: [0, 600, 10],
  fullDistance: [0, 400, 5],
  hedgeFullDistance: [0, 600, 10],
  barnPropsDistance: [0, 200, 5],
  vehicleDetailDistance: [0, 300, 5],
  shadowDistance: [0, 400, 5],
  shadowSize: [30, 150, 5],
  shadowAhead: [0, 60, 1],
  partPixels: [0, 4, 0.1],
  smallShadowDistance: [0, 200, 5],
};

/** The renderer's pixel ratio: the screen's, but no more than the render scale. */
export function pixelRatioFor(devicePixelRatio, params) {
  return Math.min(devicePixelRatio || 1, params.renderScale);
}

// A frame due a little early still counts: the screen's ticks jitter, and at 120 Hz waiting for a full 1/60 s would skip two in three.
const EARLY = 0.004;

/**
 * Under the fps cap, whether a screen tick at `now` (seconds) draws a frame, given when the next frame is `due`: null if it doesn't, or
 * when the one after is due if it does. Kept as a schedule rather than a gap since the last frame, so the cap holds on average whatever
 * the screen's rate (a 144 Hz or unthrottled screen would otherwise draw at every tick past the early allowance).
 */
export function nextFrameAt(now, due, maxFps) {
  if (!(maxFps > 0)) return now;
  if (due != null && now < due - EARLY) return null;
  const step = 1 / maxFps;
  return due == null || now > due + step ? now + step : due + step; // fallen a whole frame behind: start the schedule again from now
}
