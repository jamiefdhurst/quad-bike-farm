// How far a hedge's leaves may reach, and what is solid (#829). A block of the hedge model is a square of leaves turned at random and jittered
// across the line, and a bush stands in it at up to 3.9 m, so leaves used to hang 0.4 to 4 m past the 0.9 m collider and you walked into them.
// Now the collider reaches `HEDGE_SOLID_HALF` either side of the line and no leaf is let past it (more than a hand), nor into a gateway.
// Pure but for reading a model's vertices: no Three.js import, the model is whatever has `traverse` and meshes with a position attribute.

export const HEDGE_SOLID_HALF = 1.3; // m each side of the hedge line that is solid (on foot and on a quad)
export const HEDGE_LEAF_SLACK = 0.15; // m: a hand, how far a leaf may still reach past the solid part
export const HEDGE_WOBBLE = 0.4; // m: how far a block's middle is jittered across the line, in all (a block sits within half of it)

/**
 * How far a model's leaves reach from its middle in plan, as a fraction of the width it is scaled to (its box x and z size, both scaled to
 * `width`): the farthest vertex's distance over the width. Turning the model at random never takes a leaf further than this.
 * `size` is the model's box size, `centre` the middle of its box in x and z (the instances are placed by their origin, which is that middle).
 */
export function leafReach(root, size) {
  let reach = 0;
  root.updateMatrixWorld?.(true);
  root.traverse((o) => {
    const p = o.isMesh && o.geometry?.attributes?.position;
    if (!p) return;
    const m = o.matrixWorld;
    for (let i = 0; i < p.count; i++) {
      const x = (m.elements[0] * p.getX(i) + m.elements[4] * p.getY(i) + m.elements[8] * p.getZ(i) + m.elements[12]) / size.x;
      const z = (m.elements[2] * p.getX(i) + m.elements[6] * p.getY(i) + m.elements[10] * p.getZ(i) + m.elements[14]) / size.z;
      reach = Math.max(reach, Math.hypot(x, z));
    }
  });
  return reach;
}

/** The widest a block may be scaled so its leaves, jittered by `wobble` across the line, still end within the solid part and a hand. */
export function widestBlock(reach, wobble = HEDGE_WOBBLE / 2) {
  return (HEDGE_SOLID_HALF + HEDGE_LEAF_SLACK - Math.abs(wobble)) / reach;
}

/** A block's width: its usual one (`T` times 0.95 to 1.35 by `r`), kept within `widestBlock`. */
export function blockWidth(T, r, reach, wobble, scale = 1) {
  return Math.min(T * (0.95 + r * 0.4) * scale, widestBlock(reach, wobble));
}

/** A bush's height (2.3 to 3.9 m by `r`), brought down until its leaves, `across` m off the line, end within the solid part and a hand. `reach` is metres of leaf radius per metre of height. */
export function bushHeight(r, reach, across) {
  return Math.min(2.3 + r * 1.6, (HEDGE_SOLID_HALF + HEDGE_LEAF_SLACK - Math.abs(across)) / reach);
}

/** Whether a leaf `along` m from a gap's middle is in the open way: leaves are kept off `half` less a hand. */
export const inOpenWay = (along, half) => Math.abs(along) < half - HEDGE_LEAF_SLACK;
