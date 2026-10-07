import { describe, it, expect } from 'vitest';
import { RollWatch, rollReactions, DEFAULT_HANDBRAKE_PARAMS as P } from '../src/vehicle/handbrake.js';
import { AMY_HANDBRAKE_LINES, JESS_HANDBRAKE_LINES } from '../src/npc/handbrakeLines.js';
import { describeVehicle } from '../src/debug/startReport.js';

const quad = (over = {}) => ({ id: 'red', attended: false, braked: false, speed: 1, left: { who: 'jess', braked: false }, ...over });
const run = (w, seconds, q, dt = 0.1) => {
  const out = [];
  for (let t = 0; t < seconds; t += dt) out.push(...w.update(dt, [typeof q === 'function' ? q(t) : q]));
  return out;
};

describe('RollWatch', () => {
  it('flags an empty quad with the brake off that is moving, once, blaming who left it', () => {
    const w = new RollWatch();
    const events = run(w, 5, quad({ left: { who: 'jess', braked: false } }));
    expect(events.filter((e) => e.type === 'roll')).toEqual([{ type: 'roll', id: 'red', who: 'jess' }]);
    expect(w.tally.jess).toBe(1);
  });

  it('has the girl who forgot own up a moment later, and never for you', () => {
    const w = new RollWatch();
    const events = run(w, 5, quad());
    const own = events.find((e) => e.type === 'own');
    expect(own).toEqual({ type: 'own', id: 'red', who: 'jess' });
    expect(run(new RollWatch(), 5, quad({ left: { who: 'you', braked: false } })).some((e) => e.type === 'own')).toBe(false);
  });

  it('names nobody when it was left braked, or nobody left it, and ignores one that is held, attended or still', () => {
    expect(run(new RollWatch(), 2, quad({ left: { who: 'amy', braked: true } }))[0]).toMatchObject({ type: 'roll', who: null });
    expect(run(new RollWatch(), 2, quad({ left: null }))[0]).toMatchObject({ who: null });
    expect(run(new RollWatch(), 2, quad({ braked: true }))).toEqual([]);
    expect(run(new RollWatch(), 2, quad({ attended: true }))).toEqual([]);
    expect(run(new RollWatch(), 2, quad({ speed: P.rollSpeed - 0.1 }))).toEqual([]);
  });

  it('can flag it again after it has stopped for a while, but not while it keeps rolling', () => {
    const w = new RollWatch();
    const events = run(w, 30, (t) => quad({ speed: t < 3 ? 1 : t < 12 ? 0 : 1 }));
    expect(events.filter((e) => e.type === 'roll').length).toBe(2);
    const again = run(new RollWatch(), 30, quad());
    expect(again.filter((e) => e.type === 'roll').length).toBe(1);
  });

  it('counts a quad that somebody gets on as no longer rolling', () => {
    const w = new RollWatch();
    run(w, 1, quad());
    run(w, 0.5, quad({ attended: true }));
    expect(run(w, 1, quad()).filter((e) => e.type === 'roll').length).toBe(1);
  });
});

describe('rollReactions', () => {
  const both = (nearAmy = true, nearJess = true) => [
    { id: 'amy', near: nearAmy },
    { id: 'jess', near: nearJess },
  ];

  it('has the friend blame the girl who forgot', () => {
    expect(rollReactions({ type: 'roll', id: 'red', who: 'jess' }, both())).toEqual([{ girl: 'amy', situation: 'handbrakeJess' }]);
    expect(rollReactions({ type: 'roll', id: 'red', who: 'amy' }, both())).toEqual([{ girl: 'jess', situation: 'handbrakeAmy' }]);
  });

  it('has a girl blame you, and a general shout when it is nobody\'s known fault', () => {
    expect(rollReactions({ type: 'roll', id: 'red', who: 'you' }, both())[0].situation).toBe('handbrakeYou');
    expect(rollReactions({ type: 'roll', id: 'red', who: null }, both())[0].situation).toBe('handbrakeRoll');
  });

  it('has her own up at once if her friend is too far to notice, and later if she is near', () => {
    expect(rollReactions({ type: 'roll', id: 'red', who: 'jess' }, both(false, true))).toEqual([{ girl: 'jess', situation: 'handbrakeOwn' }]);
    expect(rollReactions({ type: 'own', id: 'red', who: 'jess' }, both())).toEqual([{ girl: 'jess', situation: 'handbrakeOwn' }]);
    expect(rollReactions({ type: 'own', id: 'red', who: 'jess' }, both(true, false))).toEqual([]);
  });

  it('says nothing when nobody is near', () => {
    expect(rollReactions({ type: 'roll', id: 'red', who: 'you' }, both(false, false))).toEqual([]);
  });
});

describe('handbrake lines and report', () => {
  it('has each line, and no em dashes', () => {
    for (const k of ['handbrakeRoll', 'handbrakeYou', 'handbrakeJess', 'handbrakeOwn']) expect(AMY_HANDBRAKE_LINES[k].lines.length, k).toBeGreaterThan(0);
    for (const k of ['handbrakeRoll', 'handbrakeYou', 'handbrakeAmy', 'handbrakeOwn']) expect(JESS_HANDBRAKE_LINES[k].length, k).toBeGreaterThan(0);
    for (const l of [...Object.values(AMY_HANDBRAKE_LINES).flatMap((e) => e.lines), ...Object.values(JESS_HANDBRAKE_LINES).flat()]) expect(l).not.toMatch(/—/);
  });

  it('shows the brake state in the start block', () => {
    const base = { name: 'Red quad', idle: 1000, top: 6000, redline: 5800, roughness: 0.05, litres: 5, tap: 'off', hours: 1, odo: 1, trip: 0, pod: null, wear: 0.1, faults: [], tinker: null, lastRider: null, quirks: [], wornGear: null, hand: null };
    expect(describeVehicle({ ...base, parkBrake: true })).toContain('parking brake: on');
    expect(describeVehicle(base)).not.toContain('parking brake');
  });
});
