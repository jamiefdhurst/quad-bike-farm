import { describe, it, expect } from 'vitest';
import { HerDrive } from '../src/npc/herDriving.js';
import { drivingMethods } from '../src/npc/companionDriving.js';
import { DEFAULT_COMPANION_PARAMS as P } from '../src/npc/companionParams.js';
import { DEFAULT_OUTING_PARAMS } from '../src/npc/outings.js';
import { MindsHost } from '../src/npc/mindsHost.js';
import { OFFER_KINDS, needsMetBy } from '../src/npc/chooser.js';
import { DEFAULT_FAR_WALK_PARAMS, liftDrop, describeLift } from '../src/npc/farWalk.js';
import { AMY_LIFT_LINES, JESS_LIFT_LINES } from '../src/npc/liftLines.js';
import { VOICE_LINES as COMPANION_LINES } from '../src/npc/voiceLines.js';
import { JESS_LINES } from '../src/npc/jessLines.js';

// A girl who goes a long way to do something (#1066): on a quad of her own she drives there one way, parks, gets off and does it;
// on the back of yours she says where she wants to go and gets off when you stop near it.

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 1 / 30;

/** Just enough quad to drive, as tests/herDriving.test.js has it. */
function fakeQuad() {
  return {
    position: { x: 0, z: 0, distanceTo(p) { return Math.hypot(this.x - p.x, this.z - p.z); } },
    yaw: 0,
    forwardSpeed: 0,
    speed: 0,
    choke: 0,
    fuel: { tap: 'on' },
    engine: { isRunning: true, ignitionOn: true, temperature: 1, setIgnition(on) { this.ignitionOn = on; } },
    driver: null,
    rider: null,
    hasPillion: true,
    passenger: null,
    setDriver(d) { this.driver = d; },
    step(dt) {
      const c = this.driver.controls;
      const push = this.engine.isRunning ? Math.max(0, c.throttle - 0.18) * 20 : 0;
      let v = this.forwardSpeed + (push - c.brake * 6 * Math.sign(this.forwardSpeed) - 0.4 * this.forwardSpeed) * dt;
      if (c.reverse) v = -Math.min(1, c.throttle * 2);
      this.forwardSpeed = v;
      this.speed = v;
      this.yaw += c.steer * 0.55 * v * 0.5 * dt;
      this.position.x += Math.sin(this.yaw) * v * dt;
      this.position.z += Math.cos(this.yaw) * v * dt;
    },
  };
}

const HUT = { x: 10, z: 260 };

/** A stand-in game for the far-is-far host: the hut a long way up the hill, one quad she can take, the hut's own offer to sit in it. */
function setup({ girlAt = { x: 0, z: 0 } } = {}) {
  const took = [];
  const said = [];
  const quad = fakeQuad();
  quad.id = 'q1';
  const girl = {
    character: { id: 'amy' },
    root: { position: { ...girlAt } },
    quads: [quad],
    log: [],
    selfEvents: [],
    fsm: { name: 'idle', is(...names) { return names.includes(this.name); }, transition(name) { this.name = name; } },
    voice: { say: (k, o) => said.push([k, o]) },
    canDrive: () => true,
    canRidePillion: () => true,
    requestMount(q, o) { this.log.push(['mount', q.id, o.seat]); },
    requestDrive(q) { this.log.push(['drive', q.id]); },
    requestStandBeside(q) { this.log.push(['off', q.id]); this.afterDismount = null; this.fsm.transition('dismounting'); },
  };
  const hutOffer = { key: 'hut', girl: 'amy', weight: 1, take: () => took.push('hut') };
  const g = {
    companions: [girl],
    hutHost: { spots: [HUT] },
    flaskSpot: null,
    fireSpots: [],
    world: { layout: { yard: { x: 0, z: 10 } }, fields: { route: (a, b) => [{ x: b.x, z: b.z }], hill: { waitSpot: { x: 0, z: 0 } } } },
  };
  const host = new MindsHost(g);
  host.offersFor = () => [hutOffer]; // what she could do once she is up there: the hut's own offer
  return { host, girl, quad, took, said, offers: [hutOffer, { key: 'tea', girl: 'amy', weight: 0.5, take: () => took.push('tea') }] };
}

/** Her drive's outing as companionDriving builds it, from a stand-in girl: the farm's routes are straight lines. */
function outingOf(girl, quad) {
  const me = Object.assign(Object.create(drivingMethods), girl, {
    world: { fields: { route: (a, b) => [{ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, { x: b.x, z: b.z }] }, layout: {} },
    outingParams: { ...DEFAULT_OUTING_PARAMS },
    outingSpots: () => [{ name: 'the muck heap', x: 0, z: 60 }],
    sightsNow: () => [],
    driveClear: () => true,
    driveRandom: seededRandom(2),
  });
  const outing = me.outingFor(quad);
  girl.outingTo = me.outingTo;
  return outing;
}

/** Drives her drive to the end (or 400 s), noting each stage of the trip. */
function driveIt(quad, outing) {
  const d = new HerDrive(quad, { params: P, probe: () => Infinity, isClear: () => true, random: seededRandom(3), outing });
  quad.driver = d;
  const stages = new Set();
  const events = [];
  for (let t = 0; t < 400 && !d.done; t += DT) {
    events.push(...d.update(DT));
    quad.step(DT);
    if (d.trip) stages.add(d.trip.stage);
  }
  return { d, stages, events };
}

/** companionDriving's endDrive on a stand-in girl at the wheel of `quad` whose drive has finished. */
function endIt(girl, quad, d) {
  const me = Object.assign(Object.create(drivingMethods), {
    quad,
    drive: d,
    params: { ...P, driveKeyOffChance: 0 },
    driveExit: null,
    driveEvents: [],
    quads: [quad],
    endCall() {},
    endLineUp() {},
    takenByOther: () => false,
    fsm: girl.fsm,
  });
  Object.defineProperty(me, 'lift', { get: () => girl.lift, set: (v) => (girl.lift = v) });
  girl.fsm.name = 'driving';
  me.endDrive();
  return me;
}

describe('a lift to a far place, on a quad of her own (#1066)', () => {
  it('drives to the hut one way, parks near it, gets off and sits in it, without driving back first', () => {
    const { host, girl, quad, took, offers } = setup();
    const lift = host.farWalkOffers(girl, null, offers).find((o) => o.key === 'lift');
    expect(lift.how).toBe('quad');
    expect(lift.for).toBe('hut');
    lift.take();
    expect(girl.log).toEqual([['drive', 'q1']]);
    const { d, stages, events } = driveIt(quad, outingOf(girl, quad));
    expect(events).toContain('outing');
    expect(d.done).toBe(true);
    expect(d.result).toBe('arrived');
    expect([...stages]).toEqual(['there']); // never turned for home
    expect(Math.hypot(quad.position.x - HUT.x, quad.position.z - HUT.z)).toBeLessThan(DEFAULT_FAR_WALK_PARAMS.liftParkWithin + 2);
    const me = endIt(girl, quad, d);
    expect(me.driveEvents).not.toContain('bringHome');
    expect(me.driveEvents).not.toContain('toBack');
    expect(girl.fsm.name).toBe('dismounting');
    expect(took).toEqual([]);
    me.afterDismount(); // stood beside it at the hut
    expect(took).toEqual(['hut']);
    expect(girl.lift).toBeNull();
  });

  it('still does what she went for when it is no longer on offer up there', () => {
    const { host, girl, quad, took, offers } = setup();
    host.offersFor = () => [];
    host.farWalkOffers(girl, null, offers).find((o) => o.key === 'lift').take();
    const { d } = driveIt(quad, outingOf(girl, quad));
    endIt(girl, quad, d).afterDismount();
    expect(took).toEqual(['hut']);
  });

  it('an ordinary outing still turns round at the place', () => {
    const { girl, quad } = setup();
    const { stages } = driveIt(quad, outingOf(girl, quad));
    expect([...stages]).toEqual(['there', 'back']);
  });

  it('a drive that ends any other way drops the lift', () => {
    const { host, girl, quad, took, offers } = setup();
    host.farWalkOffers(girl, null, offers).find((o) => o.key === 'lift').take();
    const d = { done: true, result: 'bored', park: null };
    const me = endIt(girl, quad, d);
    me.afterDismount?.();
    expect(girl.lift).toBeNull();
    expect(took).toEqual([]);
  });
});

describe('the need she meets on a lift (#1066)', () => {
  it('is the hut\'s, not the lift kind\'s', () => {
    expect(needsMetBy({ key: 'lift', for: 'hut' })).toEqual(OFFER_KINDS.hut.satisfies);
    expect(needsMetBy({ key: 'lift', for: 'flask' })).toEqual(OFFER_KINDS.flask.satisfies);
    expect(needsMetBy({ key: 'hut' })).toEqual(OFFER_KINDS.hut.satisfies);
  });

  it('is what the minds meet when she takes one', async () => {
    const src = (await import('node:fs')).readFileSync(new URL('../src/npc/mindsHost.js', import.meta.url), 'utf8');
    expect(src).toContain('c.needs.met(needsMetBy(pick))');
    expect(src).not.toContain('c.needs.met(OFFER_KINDS[pick.key].satisfies)');
  });
});

describe('a lift on the back of your quad (#1066)', () => {
  const asked = () => {
    const s = setup();
    const yours = fakeQuad();
    yours.id = 'mine';
    yours.position.x = 6;
    const lift = s.host.farWalkOffers(s.girl, { quad: yours }, s.offers).find((o) => o.key === 'lift');
    expect(lift.how).toBe('ask');
    lift.take();
    // She gets on behind you.
    s.girl.quad = yours;
    s.girl.fsm.name = 'seated';
    return { ...s, yours };
  };
  const at = (q, x, z, speed = 0) => Object.assign(q.position, { x, z }) && Object.assign(q, { speed, forwardSpeed: speed });

  it('names the place once she is on, and gets off when you stop within 30 m of it', () => {
    const { host, girl, yours, said, took } = asked();
    host.watchLift(girl, { quad: yours }, DT);
    expect(said.map((s) => s[0])).toEqual(['liftTo_hut']);
    host.watchLift(girl, { quad: yours }, DT);
    expect(said.length).toBe(1); // once
    at(yours, HUT.x, HUT.z - 80);
    host.watchLift(girl, { quad: yours }, DT);
    at(yours, HUT.x, HUT.z - 25, 4); // close, but still going
    host.watchLift(girl, { quad: yours }, DT);
    expect(girl.log.filter((l) => l[0] === 'off')).toEqual([]);
    at(yours, HUT.x, HUT.z - 25, 0);
    host.watchLift(girl, { quad: yours }, DT);
    expect(girl.log).toContainEqual(['off', 'mine']);
    expect(girl.fsm.name).toBe('dismounting');
    girl.afterDismount();
    expect(took).toEqual(['hut']);
    expect(girl.lift).toBeNull();
  });

  it('stays on when you stop further off than that', () => {
    const { host, girl, yours } = asked();
    at(yours, HUT.x, HUT.z - 45, 0);
    host.watchLift(girl, { quad: yours }, DT);
    host.watchLift(girl, { quad: yours }, DT);
    expect(girl.log.filter((l) => l[0] === 'off')).toEqual([]);
    expect(girl.lift).toBeTruthy();
  });

  it('forgets the lift if she gets off another way', () => {
    const { host, girl, yours } = asked();
    host.watchLift(girl, { quad: yours }, DT);
    girl.fsm.name = 'idle';
    host.watchLift(girl, null, DT);
    expect(girl.lift).toBeNull();
  });

  it('knows when to get off (farWalk.js)', () => {
    const p = DEFAULT_FAR_WALK_PARAMS;
    expect(p.liftDropWithin).toBe(30);
    expect(liftDrop({ boarded: false, on: true, stopped: false, distance: 300, since: 1 }, p)).toBe('board');
    expect(liftDrop({ boarded: false, on: false, stopped: false, distance: Infinity, since: 1 }, p)).toBeNull();
    expect(liftDrop({ boarded: false, on: false, stopped: false, distance: Infinity, since: p.liftGiveUp + 1 }, p)).toBe('gone');
    expect(liftDrop({ boarded: true, on: true, stopped: true, distance: 29, since: 1 }, p)).toBe('off');
    expect(liftDrop({ boarded: true, on: true, stopped: true, distance: 31, since: 1 }, p)).toBeNull();
    expect(liftDrop({ boarded: true, on: true, stopped: false, distance: 10, since: 1 }, p)).toBeNull();
    expect(liftDrop({ boarded: true, on: false, stopped: false, distance: Infinity, since: 1 }, p)).toBe('gone');
  });
});

describe('the lift in the Girls tab and the console', () => {
  it('says what for, how and how far, or none', () => {
    expect(describeLift(null, { x: 0, z: 0 })).toBe('none');
    const lift = { for: 'hut', how: 'quad', place: { x: 0, z: 250 } };
    expect(describeLift(lift, { x: 0, z: 0 }, (k) => OFFER_KINDS[k].label)).toBe(`to ${OFFER_KINDS.hut.label}, on a quad of her own, 250 m off`);
    expect(describeLift({ ...lift, how: 'ask', boarded: true }, { x: 0, z: 240 })).toBe('to hut, on the back of your quad, 10 m off');
  });
});

describe('where she asks to go (liftLines.js)', () => {
  const places = ['hut', 'flask', 'fire', 'barn'];
  it('has a line for every far place, for each girl, and they are in the voice lines', () => {
    for (const where of places) {
      expect(AMY_LIFT_LINES[`liftTo_${where}`].lines.length).toBeGreaterThan(0);
      expect(JESS_LIFT_LINES[`liftTo_${where}`].lines.length).toBeGreaterThan(0);
      expect(COMPANION_LINES[`liftTo_${where}`]).toBe(AMY_LIFT_LINES[`liftTo_${where}`]);
      expect(JESS_LINES[`liftTo_${where}`]).toBe(JESS_LIFT_LINES[`liftTo_${where}`]);
    }
  });

  it('are merged last of all, so no recorded bank before them moves', () => {
    for (const [all, mine] of [[COMPANION_LINES, AMY_LIFT_LINES], [JESS_LINES, JESS_LIFT_LINES]]) {
      const keys = Object.keys(all);
      expect(keys.slice(-Object.keys(mine).length)).toEqual(Object.keys(mine));
    }
  });
});
