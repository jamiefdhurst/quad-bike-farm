// Closed dirt track defined by Catmull-Rom control points, sampled into a
// polyline for distance queries. Pure maths, no rendering.

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export class Track {
  /**
   * @param {number[][]} controlPoints [[x, z], ...] forming a closed loop.
   * @param {number} samplesPerSegment
   */
  constructor(controlPoints, samplesPerSegment = 40) {
    const n = controlPoints.length;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const p0 = controlPoints[(i - 1 + n) % n];
      const p1 = controlPoints[i];
      const p2 = controlPoints[(i + 1) % n];
      const p3 = controlPoints[(i + 2) % n];
      for (let s = 0; s < samplesPerSegment; s++) {
        const t = s / samplesPerSegment;
        pts.push([catmullRom(p0[0], p1[0], p2[0], p3[0], t), catmullRom(p0[1], p1[1], p2[1], p3[1], t)]);
      }
    }
    this.points = pts;

    // Cumulative length for mapping 0..1 positions along the loop.
    this.lengths = [0];
    for (let i = 1; i <= pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i % pts.length];
      this.lengths.push(this.lengths[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    this.totalLength = this.lengths[pts.length];

    // Bounding box for a quick reject in distance queries.
    this.minX = Math.min(...pts.map((p) => p[0]));
    this.maxX = Math.max(...pts.map((p) => p[0]));
    this.minZ = Math.min(...pts.map((p) => p[1]));
    this.maxZ = Math.max(...pts.map((p) => p[1]));
  }

  /** Distance from (x, z) to the track centreline. */
  distanceTo(x, z, maxInterest = Infinity) {
    if (
      x < this.minX - maxInterest ||
      x > this.maxX + maxInterest ||
      z < this.minZ - maxInterest ||
      z > this.maxZ + maxInterest
    ) {
      return maxInterest;
    }
    const pts = this.points;
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const abx = b[0] - a[0];
      const abz = b[1] - a[1];
      const len2 = abx * abx + abz * abz;
      let t = len2 > 0 ? ((x - a[0]) * abx + (z - a[1]) * abz) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = a[0] + abx * t - x;
      const dz = a[1] + abz * t - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < best) best = d2;
    }
    return Math.sqrt(best);
  }

  /** Point and unit tangent at fraction u (0..1) around the loop. */
  sample(u) {
    const target = (((u % 1) + 1) % 1) * this.totalLength;
    let i = 0;
    while (i < this.points.length - 1 && this.lengths[i + 1] < target) i++;
    const a = this.points[i];
    const b = this.points[(i + 1) % this.points.length];
    const segLen = this.lengths[i + 1] - this.lengths[i];
    const t = segLen > 0 ? (target - this.lengths[i]) / segLen : 0;
    const tx = b[0] - a[0];
    const tz = b[1] - a[1];
    const tl = Math.hypot(tx, tz) || 1;
    return { x: a[0] + tx * t, z: a[1] + tz * t, tx: tx / tl, tz: tz / tl };
  }
}
