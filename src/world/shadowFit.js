// Where the sun's shadow window sits: ahead of you along the way you are looking, so most of the square covers what is in front and only a
// strip behind. A caster whose shadow lands in view sits on the ray towards the sun, which an orthographic shadow camera covers whatever its
// window, so nothing needs stretching towards the sun. See docs/decisions/performance.md, "Shadows only where you can see them (#405)".

/** The way you are looking along the ground, smoothed so the window glides round as you turn instead of jumping. */
export class ShadowFit {
  constructor() {
    this.angle = 0;
    this.ready = false;
  }

  /** Follows the view's ground direction (x, z). Looking straight up or down gives no direction, so it holds the last. `dt` 0 snaps. */
  update(dt, dirX, dirZ, rate = 4) {
    if (Math.hypot(dirX, dirZ) < 0.2) return;
    const target = Math.atan2(dirX, dirZ);
    if (!this.ready || !(dt > 0)) {
      this.angle = target;
      this.ready = true;
      return;
    }
    let d = target - this.angle;
    d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2; // the short way round
    this.angle += d * (1 - Math.exp(-dt * rate));
  }

  /** Where to put the middle of the shadow window: `ahead` metres along the view from `focus`, snapped to whole texels. */
  centre(focus, ahead, texel) {
    const snap = (v) => (texel > 0 ? Math.round(v / texel) * texel : v);
    return { x: snap(focus.x + Math.sin(this.angle) * ahead), z: snap(focus.z + Math.cos(this.angle) * ahead) };
  }
}
