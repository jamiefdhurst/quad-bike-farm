import { describe, it, expect } from 'vitest';
import { TrailerRide, DEFAULT_TRAILER_RIDE_PARAMS as P } from '../src/npc/trailerRide.js';

const girls = (over = {}) => [
  { id: 'amy', free: true, aboard: false, dist: 10, ...over.amy },
  { id: 'jess', free: true, aboard: false, dist: 12, ...over.jess },
];
const base = { riding: true, active: true, speed: 0, jolt: 0, slide: false };
const run = (r, seconds, ctx, dt = 0.1) => {
  const out = [];
  for (let t = 0; t < seconds; t += dt) out.push(...r.update(dt, typeof ctx === 'function' ? ctx() : ctx));
  return out;
};
const always = (v) => () => v;

describe('a girl in the trailer', () => {
  it('hops in after a stop, and it is Jess when both are near', () => {
    const r = new TrailerRide(undefined, always(0));
    const ev = run(r, P.boardDelayMax + 1, { ...base, girls: girls() });
    expect(ev.filter((e) => e.type === 'board').map((e) => e.girl)).toEqual(['jess']);
  });

  it('does not board while it is moving, or when you are not riding it', () => {
    const r = new TrailerRide(undefined, always(0));
    expect(run(r, 10, { ...base, speed: 3, girls: girls() }).some((e) => e.type === 'board')).toBe(false);
    expect(run(r, 10, { ...base, riding: false, girls: girls() }).some((e) => e.type === 'board')).toBe(false);
  });

  it('gives Amy far less chance than Jess', () => {
    expect(P.amyChance).toBeLessThan(P.boardChance / 2);
    const r = new TrailerRide(undefined, always(0.2)); // below boardChance, above amyChance
    const only = { jess: { free: false } };
    expect(run(r, P.boardDelayMax + 1, { ...base, girls: girls(only) }).some((e) => e.type === 'board')).toBe(false);
  });

  it('has the other girl tell her off once, and her shriek at a bump no more than once in bumpGap', () => {
    const r = new TrailerRide(undefined, always(0));
    const inside = girls({ jess: { aboard: true, free: false } });
    const ev = run(r, 8, { ...base, girls: inside, speed: 2, jolt: P.bumpJolt + 0.2 });
    expect(ev.filter((e) => e.type === 'tell')).toEqual([{ type: 'tell', girl: 'amy', target: 'jess' }]);
    expect(ev.filter((e) => e.type === 'bump')).toHaveLength(1);
  });

  it('complains about the bouncing only when it is going', () => {
    const inside = girls({ jess: { aboard: true, free: false } });
    const slow = run(new TrailerRide(undefined, always(0)), 60, { ...base, girls: inside, speed: 1 });
    expect(slow.some((e) => e.type === 'shout')).toBe(false);
    const fast = run(new TrailerRide(undefined, always(0)), 60, { ...base, girls: inside, speed: P.shoutSpeed + 1 });
    expect(fast.some((e) => e.type === 'shout')).toBe(true);
  });

  it('sends her off the back when the tub tips', () => {
    const r = new TrailerRide(undefined, always(0));
    const ev = run(r, 0.2, { ...base, slide: true, girls: girls({ jess: { aboard: true, free: false } }) });
    expect(ev.some((e) => e.type === 'slide' && e.girl === 'jess')).toBe(true);
  });

  it('makes her climb out when you get off, unless you asked her in', () => {
    const inside = girls({ jess: { aboard: true, free: false } });
    const off = { ...base, riding: false, girls: inside };
    expect(run(new TrailerRide(undefined, always(0.5)), 2, off).some((e) => e.type === 'leave')).toBe(true);
    const asked = new TrailerRide(undefined, always(0.5));
    asked.ask('jess');
    expect(run(asked, 5, off).some((e) => e.type === 'leave')).toBe(false);
    asked.dismiss('jess');
    expect(run(asked, 2, off).some((e) => e.type === 'leave')).toBe(true);
  });

  it('gets bored and climbs out in the end', () => {
    const r = new TrailerRide(undefined, always(0));
    const ev = run(r, P.stayMin + 5, { ...base, girls: girls({ jess: { aboard: true, free: false } }) }, 1);
    expect(ev.some((e) => e.type === 'leave' && e.bored)).toBe(true);
  });
});
