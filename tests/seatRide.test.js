import { describe, it, expect } from 'vitest';
import { SeatSpring, UpAccel, SEAT_KINDS, DEFAULT_SEAT_PARAMS as P, SEAT_PARAM_RANGES } from '../src/vehicle/seatRide.js';
import { AMY_SEAT_LINES, JESS_SEAT_LINES } from '../src/npc/seatLines.js';

/** Feeds a seat a vertical acceleration for a while; returns its biggest travel up and down, and the slams. */
function drive(kind, accelAt, seconds = 3, dt = 1 / 60) {
  const s = new SeatSpring(kind, { ...P });
  let hi = 0;
  let lo = 0;
  const slams = [];
  for (let t = 0; t < seconds; t += dt) {
    const { offset, slam } = s.update(dt, accelAt(t));
    hi = Math.max(hi, offset);
    lo = Math.min(lo, offset);
    if (slam) slams.push({ ...slam, t });
  }
  return { hi, lo, slams, rest: s.x };
}
const knock = (size) => (t) => (t > 0.2 && t < 0.28 ? size : 0); // a single sharp bump
const rumble = (size, hz) => (t) => size * Math.sin(2 * Math.PI * hz * t);

describe('each seat rides differently', () => {
  it('every kind has every tunable and a range for it', () => {
    for (const k of SEAT_KINDS) {
      for (const n of ['Gain', 'Freq', 'Damp', 'Pitch', 'Max', 'Slam']) {
        expect(P[`${k}${n}`], `${k}${n}`).toBeTypeOf('number');
        expect(SEAT_PARAM_RANGES[`${k}${n}`]).toHaveLength(3);
      }
    }
  });

  it('settles back to rest after a bump', () => {
    for (const k of SEAT_KINDS) expect(Math.abs(drive(k, knock(30), 5).rest)).toBeLessThan(0.002);
  });

  it('the back bench on its leaf springs moves more, and rings longer, than a cab seat', () => {
    const rear = drive('rear', knock(25));
    const front = drive('front', knock(25));
    expect(rear.hi - rear.lo).toBeGreaterThan((front.hi - front.lo) * 1.5);
    // Count its swings after the bump: the lightly damped spring keeps going.
    const swings = (kind) => {
      const s = new SeatSpring(kind, { ...P });
      let crossings = 0;
      let last = 0;
      for (let t = 0; t < 3; t += 1 / 60) {
        const { offset } = s.update(1 / 60, knock(25)(t));
        if (t > 0.4 && Math.sign(offset) !== Math.sign(last) && Math.abs(offset) > 0.001) crossings++;
        last = offset;
      }
      return crossings;
    };
    expect(swings('rear')).toBeGreaterThan(swings('front'));
  });

  it('a big bump bottoms the back bench out and slams, a small one does not', () => {
    expect(drive('rear', knock(60)).slams.length).toBeGreaterThan(0);
    expect(drive('rear', knock(3)).slams).toEqual([]);
    const hard = drive('rear', knock(60)).slams[0];
    expect(hard).toMatchObject({ kind: 'rear' });
    expect(hard.strength).toBeGreaterThan(0.3);
  });

  it('slams are spaced out, however rough it is', () => {
    const r = drive('rear', rumble(40, 3), 4);
    for (let i = 1; i < r.slams.length; i++) expect(r.slams[i].t - r.slams[i - 1].t).toBeGreaterThanOrEqual(P.slamGap - 0.05);
  });

  it('the bed is thrown up over a big one (the cattle grid), and says so', () => {
    const up = drive('bed', (t) => (t > 0.2 && t < 0.3 ? -70 : 0)); // the frame dropping away from under it
    expect(up.slams.some((s) => s.up)).toBe(true);
    expect(up.hi).toBeLessThanOrEqual(P.bedMax + 1e-9);
  });

  it('the travel never exceeds the seat\'s own limit', () => {
    for (const k of SEAT_KINDS) {
      const r = drive(k, rumble(200, 4));
      expect(r.hi).toBeLessThanOrEqual(P[`${k}Max`] + P[`${k}Max`] + 1e-9); // (travel plus the pitch lift, which is zero here)
      expect(r.lo).toBeGreaterThanOrEqual(-P[`${k}Max`] - 1e-9);
    }
  });

  it('further back, the pitch lifts it more (the lift is passed in, within the travel)', () => {
    const s = new SeatSpring('rear', { ...P });
    expect(s.update(1 / 60, 0, 0.02).offset).toBeCloseTo(0.02);
    expect(s.update(1 / 60, 0, 5).offset).toBeLessThanOrEqual(P.rearMax + 1e-9);
  });
});

describe('the frame\'s acceleration', () => {
  it('reads a steady height as none and a bump as a spike', () => {
    const u = new UpAccel();
    for (let i = 0; i < 20; i++) expect(Math.abs(u.update(1 / 60, 1))).toBeLessThan(1);
    let peak = 0;
    for (let i = 0; i < 10; i++) peak = Math.max(peak, Math.abs(u.update(1 / 60, 1 + 0.002 * i * i)));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(P.accelMax);
  });
});

describe('her lines', () => {
  it('both girls have every one, and nobody is called he, she or they', () => {
    for (const key of Object.keys(AMY_SEAT_LINES)) {
      expect(JESS_SEAT_LINES[key]?.length).toBeGreaterThan(0);
      expect(AMY_SEAT_LINES[key].lines.length).toBeGreaterThan(0);
    }
    const all = [...Object.values(AMY_SEAT_LINES).flatMap((l) => l.lines), ...Object.values(JESS_SEAT_LINES).flat()].join(' ');
    expect(all).not.toMatch(/\b(he|she|they)\b/i);
    expect(all).not.toMatch(/—/);
  });
});
