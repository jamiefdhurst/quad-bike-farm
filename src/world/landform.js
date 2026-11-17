// The lie of the whole land, as one height along the farm's east-west run: the valley floor in the east, rising west through the farm and the
// hill to the moor's ridge (docs/farm-plan.md, #813). Pure: no Three.js. terrainHeight.js adds it to the farm's own rolling.

/**
 * A smooth height by x through `points` ([x, height], x rising), which never overshoots between two of them: a monotone cubic (Fritsch and
 * Carlson), flat at both ends so the valley floor and the ridge's crest level out and the land beyond (#708) can carry on from either.
 * Past the first and last point it holds their height.
 */
export function createLandform(points) {
  const n = points.length;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const slope = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const tangent = ys.map((_, i) => {
    if (i === 0 || i === n - 1) return 0;
    // A turn in the run (down then up) is a flat, so it never overshoots.
    if (slope[i - 1] * slope[i] <= 0) return 0;
    return (slope[i - 1] + slope[i]) / 2;
  });
  // Keep each span monotone: a tangent more than three times its span's slope would overshoot.
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const r = Math.hypot(a, b);
    if (r > 3) {
      tangent[i] = (3 * a * slope[i]) / r;
      tangent[i + 1] = (3 * b * slope[i]) / r;
    }
  }

  /** The height at x, metres. */
  function heightAt(x) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * tangent[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * tangent[i + 1];
  }

  return heightAt;
}
