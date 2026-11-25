// The way a girl climbs to a seat that is up off the ground (the shepherd's hut's steps and bunk: a rest spot with `via` points), and back down.
// Pure; companionResting.js walks her along it.

/**
 * Points a girl passes through on the way up to her seat: `[start, ...via, end]` with `k` 0..1 along the whole path (by length), and a position
 * back, with `climbing` true until she is on the last leg. Used both ways (k running down to climb down).
 */
export function pathAt(points, k) {
  const lens = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const l = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y, points[i].z - points[i - 1].z);
    lens.push(l);
    total += l;
  }
  let d = Math.min(1, Math.max(0, k)) * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const t = lens[i] > 0 ? Math.min(1, d / lens[i]) : 1;
      const a = points[i];
      const b = points[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, climbing: i < lens.length - 1 };
    }
    d -= lens[i];
  }
  return { ...points[points.length - 1], climbing: false };
}
