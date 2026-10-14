// Her cleavage, drawn on. Her body is a few flat faces on her chest with no dip of its own, so wherever the game lays a piece of
// her skin's colour over it (the open polo's V, the space above the crop-top's band) the piece is shaded with this: a soft
// shadow down her middle, full below a height and fading out above it. One rule for both, so they look alike. Pure.

const smooth01 = (t) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

/**
 * How much to multiply her skin's colour by at a point.
 * `across`: metres from her middle line; `below`: metres below where the shadow starts to fade (negative above it);
 * `p`: `strength` (how dark at the centre, 0 to 1), `width` (metres either side of her middle) and `fade` (metres it takes to
 * fade out above `below` = 0).
 */
export function cleavageShade(across, below, p) {
  const tent = Math.max(0, 1 - Math.abs(across) / p.width);
  return 1 - p.strength * tent * smooth01(below / p.fade);
}
