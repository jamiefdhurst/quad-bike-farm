import { describe, it, expect } from 'vitest';
import { hangingJumperRings, HANGING_JUMPER as J } from '../src/world/jumperRail.js';

describe('a jumper hanging on the rack', () => {
  const [body, ...sleeves] = hangingJumperRings();
  const points = (rings) => rings.flat();

  it('is a body and two sleeves, every point a real number', () => {
    expect(sleeves).toHaveLength(2);
    for (const p of points([...body, ...sleeves.flat()])) for (const v of p) expect(Number.isFinite(v)).toBe(true);
  });

  it('hangs from its shoulders to a hem about its length below them, flat rather than round', () => {
    const ys = points(body).map((p) => p[1]);
    expect(Math.max(...ys)).toBeLessThan(0); // all below the hook
    expect(Math.min(...ys)).toBeCloseTo(J.shoulderY - J.slope - J.length, 1);
    const xs = points(body).map((p) => Math.abs(p[0]));
    const zs = points(body).map((p) => Math.abs(p[2]));
    expect(Math.max(...xs)).toBeGreaterThan(4 * Math.max(...zs));
  });

  it('dips lower at the front of the neck than at the back', () => {
    const neck = body[body.length - 1 - 14 - 4 - 0]; // the top of the neckband
    const front = neck.filter((p) => p[2] > 0.03).map((p) => p[1]);
    const back = neck.filter((p) => p[2] < -0.03).map((p) => p[1]);
    expect(Math.max(...front)).toBeLessThan(Math.min(...back));
  });

  it('has its sleeves hanging either side of the body, down near the hem, ending in a darker rib', () => {
    for (const [s, side] of [[sleeves[0], -1], [sleeves[1], 1]]) {
      const cuff = s[s.length - 1];
      const x = cuff.reduce((a, p) => a + p[0], 0) / cuff.length;
      expect(Math.sign(x)).toBe(side);
      expect(Math.abs(x)).toBeGreaterThan(J.halfWidth);
      expect(cuff[0][3]).toBeLessThan(s[2][0][3]); // the cuff is shaded darker than the sleeve
    }
  });
});
