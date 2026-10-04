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

export function createTerrainHeight(layout, track) {
  const { yard, trackHalfWidth, trackDepth, puddleRadius, puddleDepth, fieldHalf } = layout;
  const yardHeight = baseHeight(yard.x, yard.z);
  const puddles = layout.puddles.map((u) => track.sample(u));
  const trackReach = trackHalfWidth + 1.5;

  function heightAt(x, z) {
    let h = baseHeight(x, z);

    // Land rises gently beyond the hedges towards distant hills.
    const edge = Math.max(Math.abs(x), Math.abs(z));
    h += smoothstep(fieldHalf + 10, 380, edge) * 22 * (0.6 + 0.4 * Math.sin(x * 0.01 + z * 0.013));

    // Flatten the yard around the barn.
    const yd = Math.hypot(x - yard.x, z - yard.z);
    h += (yardHeight - h) * (1 - smoothstep(yard.radius * 0.6, yard.radius, yd));

    // Dished dirt track with softened shoulders.
    const d = track.distanceTo(x, z, trackReach);
    if (d < trackReach) {
      const k = 1 - smoothstep(trackHalfWidth * 0.4, trackReach, d);
      h -= trackDepth * k;
    }

    // Puddle hollows.
    for (const p of puddles) {
      const pd = Math.hypot(x - p.x, z - p.z);
      if (pd < puddleRadius) h -= puddleDepth * (1 - smoothstep(0, puddleRadius, pd)) ** 0.7;
    }
    return h;
  }

  /** 0..1, how muddy the surface is here (1 on the track centre). */
  function mudAt(x, z) {
    const d = track.distanceTo(x, z, trackReach);
    return 1 - smoothstep(trackHalfWidth * 0.7, trackHalfWidth + 0.6, d);
  }

  return { heightAt, mudAt, puddles };
}
