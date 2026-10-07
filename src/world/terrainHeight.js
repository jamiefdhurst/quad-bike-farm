// Height of the land at any (x, z). Pure function of the layout, used to build
// the physics heightfield, the visual mesh and to place props and the NPC.

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Gentle rolling farmland. */
export function baseHeight(x, z) {
  return (
    1.4 * Math.sin(x * 0.018 + 0.6) * Math.cos(z * 0.015 - 0.4) +
    0.8 * Math.sin((x + z) * 0.035 + 1.1) +
    0.35 * Math.sin(x * 0.09 + 2.0) * Math.sin(z * 0.075 + 0.7) +
    0.12 * Math.sin(x * 0.23 + z * 0.19)
  );
}

import { floorBlend } from './barn.js';
import { stripFrame } from './layout.js';

export function createTerrainHeight(layout, track) {
  const { yard, trackHalfWidth, trackDepth, puddleRadius, puddleDepth, fieldHalf } = layout;
  const yardHeight = baseHeight(yard.x, yard.z);
  const puddles = layout.puddles.map((u) => track.sample(u));
  const bogs = (layout.bogs ?? []).map((b) => (b.track !== undefined ? { ...track.sample(b.track), radius: b.radius } : { ...b }));
  const trackReach = trackHalfWidth + 1.5;
  // The drag strip is level: the average of the ground along it, blended back into the field over its shoulders.
  const strip = layout.dragStrip;
  const stripLevel = strip ? [0, 0.25, 0.5, 0.75, 1].reduce((sum, t) => sum + baseHeight(strip.x + Math.sin(strip.yaw) * strip.length * t, strip.z + Math.cos(strip.yaw) * strip.length * t), 0) / 5 : 0;

  function heightAt(x, z) {
    let h = baseHeight(x, z);

    // Land rises gently beyond the hedges towards distant hills.
    const edge = Math.max(Math.abs(x), Math.abs(z));
    h += smoothstep(fieldHalf + 10, 380, edge) * 22 * (0.6 + 0.4 * Math.sin(x * 0.01 + z * 0.013));

    // Flatten the yard around the barn.
    const yd = Math.hypot(x - yard.x, z - yard.z);
    h += (yardHeight - h) * (1 - smoothstep(yard.radius * 0.6, yard.radius, yd));

    // And level under the barn, so its floor is flat.
    if (layout.barn) h += (yardHeight - h) * floorBlend(layout, x, z);

    // Level under the drag strip, with a shoulder to ease it back into the field.
    if (strip) {
      const f = stripFrame(strip, x, z);
      const outAcross = Math.abs(f.across) - strip.width / 2;
      const outAlong = Math.max(-8 - f.along, f.along - (strip.length + strip.runOff), 0);
      const k = 1 - smoothstep(0, 6, Math.max(outAcross, outAlong));
      if (k > 0) h += (stripLevel - h) * k;
    }

    // Dished dirt track with softened shoulders.
    const d = track.distanceTo(x, z, trackReach);
    if (d < trackReach) {
      const k = 1 - smoothstep(trackHalfWidth * 0.4, trackReach, d);
      h -= trackDepth * k;
    }

    // Bogs sit in a shallow dip.
    for (const b of bogs) {
      const bd = Math.hypot(x - b.x, z - b.z);
      if (bd < b.radius) h -= layout.bogDepth * (1 - smoothstep(b.radius * 0.3, b.radius, bd));
    }

    // Puddle hollows.
    for (const p of puddles) {
      const pd = Math.hypot(x - p.x, z - p.z);
      if (pd < puddleRadius) h -= puddleDepth * (1 - smoothstep(0, puddleRadius, pd)) ** 0.7;
    }
    return h;
  }

  /** 0..1, how deep a bog this is (1 in the middle of one). */
  function bogAt(x, z) {
    let w = 0;
    for (const b of bogs) {
      const bd = Math.hypot(x - b.x, z - b.z);
      if (bd < b.radius) w = Math.max(w, 1 - smoothstep(b.radius * 0.35, b.radius * 0.9, bd));
    }
    return w;
  }

  /** 0..1, how muddy the surface is here (1 on the track centre, and in a bog). */
  function mudAt(x, z) {
    const d = track.distanceTo(x, z, trackReach);
    return Math.max(1 - smoothstep(trackHalfWidth * 0.7, trackHalfWidth + 0.6, d), Math.min(1, bogAt(x, z) * 1.5));
  }

  /** 0..1, how much standing water there is here (1 in the middle of a puddle). */
  function puddleAt(x, z) {
    let w = 0;
    for (const p of puddles) {
      const pd = Math.hypot(x - p.x, z - p.z);
      if (pd < puddleRadius) w = Math.max(w, 1 - smoothstep(puddleRadius * 0.45, puddleRadius * 0.85, pd));
    }
    return w;
  }

  return { heightAt, mudAt, puddleAt, bogAt, puddles, bogs };
}
