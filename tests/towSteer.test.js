import { describe, it, expect } from 'vitest';
import { towControls, TowSteer, DEFAULT_TOW_STEER_PARAMS as P } from '../src/npc/towSteer.js';

const base = { room: 5, closing: 0, slack: 0, error: 0, leaderSpeed: 3, horizon: 2, distracted: false };

describe('steering a dead quad on the rope', () => {
  it('has no throttle and no brake when the rope is taut and she is following', () => {
    const c = towControls(base);
    expect(c.throttle).toBe(0);
    expect(c.brake).toBe(0);
    expect(c.steer).toBe(0);
  });

  it('steers towards the hitch, left for a positive error', () => {
    expect(towControls({ ...base, error: 0.3 }).steer).toBeGreaterThan(0);
    expect(towControls({ ...base, error: -0.3 }).steer).toBeLessThan(0);
    expect(towControls({ ...base, error: 3 }).steer).toBe(1);
  });

  it('brakes harder the sooner she would run into the back of it', () => {
    const far = towControls({ ...base, room: 4, closing: 1 }).brake; // 4 s away
    const near = towControls({ ...base, room: 1, closing: 2 }).brake; // half a second
    expect(far).toBe(0);
    expect(near).toBeGreaterThan(0.5);
  });

  it('brakes earlier with a longer horizon (Amy) than a short one (Jess)', () => {
    const s = { ...base, room: 2.5, closing: 1.5 };
    expect(towControls({ ...s, horizon: 2.6 }).brake).toBeGreaterThan(towControls({ ...s, horizon: 1.2 }).brake);
  });

  it('eases off on a slack rope she is closing on, and holds the brake when the towing quad has stopped', () => {
    expect(towControls({ ...base, slack: 1, closing: P.easeClosing + 0.2 }).brake).toBeGreaterThanOrEqual(P.easeBrake);
    expect(towControls({ ...base, room: 1, slack: 1, leaderSpeed: 0 }).brake).toBeGreaterThanOrEqual(P.holdBrake);
  });

  it('does nothing at all while she is looking away', () => {
    const c = towControls({ ...base, room: 0.2, closing: 3, error: 1, distracted: true });
    expect(c).toEqual({ throttle: 0, brake: 0, steer: 0 });
  });
});

describe('the tow steering driver', () => {
  const rig = () => {
    const dead = { yaw: 0, position: { x: 0, z: -4 } };
    const lead = { speed: 2, rider: {}, driver: null };
    const rope = { state: 'hooked', target: dead, puller: lead, length: 3, gap: () => 4, pin: () => ({ x: 0, y: 0, z: 0 }) };
    return { dead, lead, rope };
  };

  it('says it has started, once', () => {
    const { dead, rope } = rig();
    const d = new TowSteer(dead, rope, { random: () => 0.9 });
    expect(d.update(0.1)).toContain('towStart');
    expect(d.update(0.1)).not.toContain('towStart');
  });

  it('is done when the rope comes off', () => {
    const { dead, rope } = rig();
    const d = new TowSteer(dead, rope, { random: () => 0.9 });
    d.update(0.1);
    rope.state = 'carried';
    d.update(0.1);
    expect(d.done).toBe(true);
    expect(d.result).toBe('unhooked');
  });

  it('gets off if nobody is on the towing quad for long', () => {
    const { dead, lead, rope } = rig();
    lead.rider = null;
    const d = new TowSteer(dead, rope, { random: () => 0.9 });
    for (let t = 0; t < P.giveUpAfter + 1 && !d.done; t += 1) d.update(1);
    expect(d.result).toBe('bored');
  });

  it('runs into the back of the towing quad if she is looking away, and says so once', () => {
    const { dead, rope } = rig();
    const d = new TowSteer(dead, rope, { random: () => 0, distractChance: 1 }); // always looking away
    let gap = 2;
    rope.gap = () => gap;
    d.update(0.1);
    gap = 0.3; // closed 1.7 m in 0.1 s
    const events = [...d.update(0.1)];
    expect(d.controls.brake).toBe(0);
    expect(events).toContain('bump');
    gap = 0.2;
    expect(d.update(0.1)).not.toContain('bump'); // not again straight away
  });

  it('stops with the brake on when asked', () => {
    const { dead, rope } = rig();
    const d = new TowSteer(dead, rope, { random: () => 0.9 });
    d.update(0.1);
    d.stop('asked');
    expect(d.done).toBe(true);
    expect(d.controls.brake).toBe(1);
  });
});
