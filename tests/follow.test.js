import { describe, it, expect } from 'vitest';
import { HerDrive } from '../src/npc/herDriving.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';

/** Just the follow maths, without a quad to drive. */
function follower(lead) {
  const d = Object.create(HerDrive.prototype);
  d.p = { ...DEFAULT_COMPANION_PARAMS, driveSpeedMaxBase: DEFAULT_COMPANION_PARAMS.driveSpeedMax };
  d.follow = () => lead;
  return d;
}

describe('following you', () => {
  const lead = { position: { x: 0, z: 0 }, yaw: 0, forwardSpeed: 6 };

  it('aims behind your quad and matches your speed at her gap', () => {
    const p = DEFAULT_COMPANION_PARAMS;
    const t = follower(lead).followTarget({ x: 0, z: -p.followGap });
    expect(t.point.z).toBeCloseTo(-p.followGap, 5);
    expect(t.speed).toBeCloseTo(6, 5);
  });

  it('speeds up to close a gap, eases off when too close, and never goes past her top speed', () => {
    const far = follower(lead).followTarget({ x: 0, z: -25 });
    const near = follower(lead).followTarget({ x: 0, z: -4 });
    expect(far.speed).toBeGreaterThan(6);
    expect(near.speed).toBeLessThan(6);
    const miles = follower({ ...lead, forwardSpeed: 30 }).followTarget({ x: 0, z: -100 });
    expect(miles.speed).toBeLessThanOrEqual(DEFAULT_COMPANION_PARAMS.followMaxSpeed);
  });

  it('pulls up behind you when you stop, and waits with nothing to follow', () => {
    expect(follower({ ...lead, forwardSpeed: 0 }).followTarget({ x: 0, z: -8 }).stopped).toBe(true);
    expect(follower(null).followTarget({ x: 0, z: -8 })).toBeNull();
  });
});

describe('when you get off and leave her following nobody', () => {
  function waiting(chance) {
    const d = follower(null);
    d.p.followGiveUpMin = 30;
    d.p.followGiveUpMax = 30;
    d.p.followDriveOnChance = chance;
    d.random = () => 0.5;
    d.quad = { position: { x: 3, z: 4 } };
    d.time = 50;
    d.phase = 'drive';
    d.events = [];
    d.stop = (reason) => (d.stopped = reason);
    return d;
  }

  it('waits a while, then gives up on you and pulls up', () => {
    const d = waiting(0);
    for (let t = 0; t < 29; t++) d.waitForLeader(1);
    expect(d.follow).not.toBeNull();
    d.waitForLeader(2);
    expect(d.follow).toBeNull();
    expect(d.stopped).toBe('bored');
    expect(d.events).toContain('followGaveUp');
  });

  it('or goes for a drive on her own from where she is', () => {
    const d = waiting(1);
    for (let t = 0; t < 31; t++) d.waitForLeader(1);
    expect(d.follow).toBeNull();
    expect(d.stopped).toBeUndefined();
    expect(d.events).toContain('followDriveOn');
    expect(d.origin).toEqual({ x: 3, z: 4 });
    expect(d.driveFor).toBeGreaterThan(50);
  });

  it('keeps waiting as long as you are on your quad', () => {
    const lead = { position: { x: 0, z: 0 }, yaw: 0, forwardSpeed: 0 };
    const d = waiting(0);
    d.follow = () => lead;
    for (let t = 0; t < 600; t++) d.waitForLeader(1);
    expect(d.follow).not.toBeNull();
  });
});
