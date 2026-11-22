// One hedge line laid out as numbers (#829): its leafy blocks, the bushes in it and the boxes that are solid, so a test can check the boxes cover
// the leaves. props.js turns these into instances and colliders. `h` is a line from `fields.hedges`: { x1, z1, dx, dz, length, gaps, height?, coarse?, alongX }.
import { HEDGE_SOLID_HALF, HEDGE_WOBBLE, blockWidth, bushHeight } from './hedgeSolid.js';

/**
 * @param {object} o  { T, H, heightAt, random, blockReach (leafReach of the hedge model), bushReach (leaf radius per metre of bush height), bushes: whether bushes grow here }
 * @returns {{ blocks, bushes, colliders }}  blocks { s, across, x, z, y, width, spin, tall }; bushes { x, z, y, height, yaw };
 *   colliders { s0, s1, across (half thickness), x, z, y, hx, hy, hz, turn } (a box, `turn` its yaw; its middle is x, y, z).
 */
export function layHedge(h, { T, H, heightAt, random, blockReach, bushReach, bushes: withBushes = true }) {
  const flip = h.dx - h.dz < 0 ? -1 : 1;
  const side = { x: -h.dz * flip, z: h.dx * flip };
  const pointAt = (s, across = 0) => ({ x: h.x1 + h.dx * s + side.x * across, z: h.z1 + h.dz * s + side.z * across });
  const blocks = [];
  const bushes = [];
  for (let s = -1; s <= h.length + 1; s += h.coarse ? 2.2 + random() * 0.6 : 1.1 + random() * 0.5) {
    const across = (random() - 0.5) * HEDGE_WOBBLE;
    const width = blockWidth(T, random(), blockReach, across, h.coarse ? 1.5 : 1);
    // A block's leaves stay out of a gateway: no nearer to its middle than the block reaches along the hedge (a gate's leaf needs room too).
    if (h.gaps.some((g) => Math.abs(s - g.at) < g.half + Math.max(blockReach * width, g.gate ? 0.9 : 0))) continue;
    const { x, z } = pointAt(s, across);
    blocks.push({ s, across, x, z, y: heightAt(x, z) - 0.2, width, spin: random() * Math.PI * 2, tall: 0.8 + random() * 0.45 });
    if (withBushes && !h.coarse && random() < 0.3) {
      const off = (random() - 0.5) * T * 0.8;
      const bs = s + (random() - 0.5);
      const height = bushHeight(random(), bushReach, off);
      // Not within its own reach of a gateway either.
      if (h.gaps.some((g) => Math.abs(bs - g.at) < g.half + bushReach * height + 0.3)) continue;
      const b = pointAt(bs, off);
      bushes.push({ x: b.x, z: b.z, y: heightAt(b.x, b.z) - 0.3, height, yaw: random() * Math.PI * 2, s: bs, across: off });
    }
  }

  // Colliders: boxes between the gaps, at most 20 m long and shorter where the ground climbs (the hill's), so they follow it to within about half
  // a metre. They are `HEDGE_SOLID_HALF` either side of the line. A hedge along x or z gets a box square to the axes; a slanted one a turned box.
  const hy = H / 2 + 0.5;
  const cuts = [-2, ...h.gaps.flatMap((g) => [g.at - g.half, g.at + g.half]).sort((a, b) => a - b), h.length + 2];
  const groundAt = (s) => {
    const p = pointAt(s);
    return heightAt(p.x, p.z);
  };
  const colliders = [];
  for (let i = 0; i < cuts.length; i += 2) {
    const a = cuts[i];
    const b = cuts[i + 1];
    let lowest = Infinity;
    let highest = -Infinity;
    for (let s = a; s <= b; s += 2) {
      lowest = Math.min(lowest, groundAt(s));
      highest = Math.max(highest, groundAt(s));
    }
    const pieces = Math.max(1, Math.ceil((b - a) / 20), Math.ceil((highest - lowest) / 0.5));
    for (let k = 0; k < pieces; k++) {
      const pa = a + ((b - a) * k) / pieces;
      const pb = a + ((b - a) * (k + 1)) / pieces;
      const mid = pointAt((pa + pb) / 2);
      colliders.push({
        s0: pa, s1: pb, across: HEDGE_SOLID_HALF, x: mid.x, z: mid.z, y: heightAt(mid.x, mid.z) + H / 2 - 0.3, hx: h.alongX === false ? HEDGE_SOLID_HALF : (pb - pa) / 2, hy, hz: h.alongX === false ? (pb - pa) / 2 : HEDGE_SOLID_HALF,
        turn: h.alongX === null ? Math.atan2(-h.dz, h.dx) : 0,
      });
    }
  }
  return { blocks, bushes, colliders, pointAt };
}
