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

  it('hangs further back behind a two-stroke if she hates the smoke, and closer in if she loves it', () => {
    const smoky = { ...lead, engine: { params: { strokes: 2 } } };
    const p = DEFAULT_COMPANION_PARAMS;
    const amy = follower(smoky);
    amy.events = [];
    expect(amy.followTarget({ x: 0, z: 0 }).point.z).toBeCloseTo(-p.followGap * p.followSmokeGap, 5);
    expect(amy.events).toEqual(['followSmoke']);
    amy.followTarget({ x: 0, z: 0 });
    expect(amy.events).toEqual(['followSmoke']); // said once
    const jess = follower(smoky);
    jess.events = [];
    jess.p = { ...jess.p, followSmokeGap: 0.7 };
    expect(jess.followTarget({ x: 0, z: 0 }).point.z).toBeCloseTo(-p.followGap * 0.7, 5);
    // A four-stroke makes no difference.
    expect(follower({ ...lead, engine: { params: { strokes: 4 } } }).followTarget({ x: 0, z: 0 }).point.z).toBeCloseTo(-p.followGap, 5);
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

describe('after she gives up following you', () => {
  it('and moves onto the back by choice, she gets bored there and gets off', async () => {
    const { Companion } = await import('../src/npc/companion.js');
    const p = { ...DEFAULT_COMPANION_PARAMS, ownMind: true, boredGetOffChance: 1 };
    const c = Object.create(Companion.prototype);
    Object.assign(c, {
      params: p,
      quad: { rider: null, driver: null, passenger: null },
      seatedByChoice: true,
      restlessness: 1,
      selfEvents: [],
      randomBetween: (a, b) => a,
      requestStandBeside: (q) => (c.stoodBeside = q),
    });
    for (let t = 0; t < p.boredWaitCeiling * 1.5 + 1 && !c.stoodBeside; t++) c.boredOnTheBack(1);
    expect(c.stoodBeside).toBe(c.quad);
    expect(c.selfEvents).toContain('getOff');
  });
});

describe('overtaking out of impatience', () => {
  const lead = { position: { x: 0, z: 0 }, yaw: 0, forwardSpeed: 4 };
  function passer(extra = {}, pos = { x: 0, z: -8 }) {
    const d = Object.create(HerDrive.prototype);
    d.p = { ...DEFAULT_COMPANION_PARAMS, driveSpeedMaxBase: DEFAULT_COMPANION_PARAMS.driveSpeedMax, overtakeChance: 1, ...extra };
    d.follow = () => lead;
    d.quad = { position: pos };
    d.events = [];
    d.random = () => 0;
    d.pass = null;
    d.slowFor = 0;
    return d;
  }
  const run = (d, seconds, dt = 0.5) => {
    let last = null;
    for (let t = 0; t < seconds; t += dt) last = d.passTarget(dt);
    return last;
  };

  it('does nothing until she has been stuck behind a slow pace long enough, and only if she is the impatient sort', () => {
    expect(run(passer(), 10)).toBeNull();
    expect(run(passer({ overtakeChance: 0 }), 60)).toBeNull();
    expect(run(passer(), 21)).not.toBeNull();
  });

  it('a pace she is happy with, or you stopped, never makes her impatient', () => {
    const fast = passer();
    fast.follow = () => ({ ...lead, forwardSpeed: 8 });
    expect(run(fast, 60)).toBeNull();
    const stopped = passer();
    stopped.follow = () => ({ ...lead, forwardSpeed: 0 });
    expect(run(stopped, 60)).toBeNull();
  });

  it('drives past on one side to a point ahead, faster than you, then waits there and says so', () => {
    const d = passer();
    d.startPass(1);
    const t = d.passTarget(0.1);
    expect(t.stopped).toBe(false);
    expect(t.point.z).toBeGreaterThan(lead.position.z + d.p.overtakeAhead);
    expect(Math.abs(t.point.x)).toBeGreaterThan(2);
    expect(t.speed).toBeGreaterThan(lead.forwardSpeed);
    d.quad.position = { x: 3, z: 14 }; // ahead of you now
    const waiting = d.passTarget(0.1);
    expect(waiting.stopped).toBe(true);
    expect(d.events).toContain('overtook');
    d.quad.position = { x: 3, z: 14 };
    lead.position.z = 6; // you've come up to her
    d.passTarget(0.1);
    expect(d.events).toContain('waitedAhead');
    lead.position.z = 0;
  });

  it('goes back to following once you have gone by, or she has waited long enough', () => {
    const d = passer({ overtakeWait: 10 });
    d.startPass(1);
    d.quad.position = { x: 3, z: 14 };
    d.passTarget(0.1);
    expect(d.passTarget(5).stopped).toBe(true);
    expect(d.passTarget(6)).toBeNull();
    expect(d.pass).toBeNull();
    const e = passer();
    e.startPass(1);
    e.quad.position = { x: 3, z: 14 };
    e.passTarget(0.1);
    lead.position.z = 20; // you've gone by
    expect(e.passTarget(0.1)).toBeNull();
    lead.position.z = 0;
  });
});
