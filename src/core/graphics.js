// How much the renderer is asked to do: how often a frame is drawn, at what resolution, and how far small ground cover reaches. See
// docs/decisions/world.md, "Drawing less (frame time)".

export const DEFAULT_GRAPHICS_PARAMS = {
  maxFps: 60, // frames drawn a second at most (0: as often as the screen asks, 120 on a ProMotion Mac); the physics steps at 60 regardless
  renderScale: 1.5, // pixels drawn per screen point at most (2 is full Retina); never more than the screen has
  coverDistance: 70, // metres the grass and the stubble are drawn out to (0: all of it)
  roughDistance: 90, // metres the tussocks and bracken on the hill are drawn out to (0: all of it)
};

export const GRAPHICS_PARAM_RANGES = {
  maxFps: [0, 240, 10],
  renderScale: [0.5, 3, 0.25],
  coverDistance: [0, 400, 5],
  roughDistance: [0, 400, 5],
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
