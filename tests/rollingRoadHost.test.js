import { describe, it, expect, beforeAll, vi } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { visitPlaces, DEFAULT_TRAFFIC_PARAMS } from '../src/world/traffic.js';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';
import { Market } from '../src/farm/classifieds.js';
import { stockRpm, isRoadDay } from '../src/farm/rollingRoad.js';
import { fakeCanvas } from './helpers/vehicleModels.js';

// The rolling road as the player meets it: when the tuner turns up, what the screen's prompt says (an E action, or a plain reason), what a run
// costs and does, what is kept, and when she goes. A stand-in game and traffic host, since game.js is never built in tests.

let RollingRoadHost;
beforeAll(async () => {
  const el = () => ({ style: {}, className: '', innerHTML: '', children: [], appendChild() {}, replaceChildren(...c) { this.children = c; }, querySelector: () => el() });
  vi.stubGlobal('document', { createElement: (tag) => (tag === 'canvas' ? fakeCanvas() : el()), body: { appendChild() {} } });
  ({ RollingRoadHost } = await import('../src/world/rollingRoadHost.js'));
});

const red = QUAD_SPECS.find((s) => s.id === 'red');
const FULL = stockRpm(red);

function setup({ purse = 100, day = 1, hour = 12 } = {}) {
  const items = [];
  const toasts = [];
  const removed = [];
  const scene = [];
  const market = new Market();
  market.purse = purse;
  const quad = {
    position: { x: 0, y: 0, z: 0 },
    yaw: 0,
    speed: 0,
    manual: false,
    drivetrain: { gear: 0 },
    engine: { rpm: 1100, power: 1, isRunning: true },
    pto: { throttle: 0, load: 0 },
    parkBrake: false,
  };
  const unit = { id: 'red', spec: red, quad };
  const game = {
    seed: 1,
    farmSeed: 7,
    farm: { day },
    scene: { add: (o) => scene.push(o), remove: (o) => scene.splice(scene.indexOf(o), 1) },
    interaction: { add: (i) => items.push(i) },
    world: { layout: LAYOUT, heightAt: () => 0, groundHeightAt: () => 0 },
    physics: { createCollider: (d) => ({ d }), removeCollider: (c) => removed.push(c) },
    RAPIER: { ColliderDesc: { convexHull: () => ({ setFriction() { return this; } }) } },
    market,
    units: [unit],
    companions: [],
    daylight: { hour, darkness: 0 },
    hud: { toast: (t) => toasts.push(t) },
    player: { isRiding: false, position: { x: -90, y: 0, z: 90 } },
  };
  const traffic = { places: visitPlaces(LAYOUT), params: { ...DEFAULT_TRAFFIC_PARAMS }, view: { shown: new Map() }, later: [], remark: vi.fn(), lastEvent: '', g: game };
  const host = new RollingRoadHost(game, traffic);
  const ctx = { darkness: 0, blockers: [], swingSeconds: 1.8, gate: { isOpen: true, set: () => true }, gates: undefined };
  const step = (n = 1, dt = 0.1) => {
    for (let i = 0; i < n; i++) {
      // The engine follows the throttle the run holds, as it would against the rollers.
      quad.engine.rpm = 1100 + (FULL - 1100) * quad.pto.throttle;
      host.update(dt, ctx);
    }
  };
  const until = (done, limit = 4000) => {
    for (let i = 0; i < limit && !done(); i++) step();
    return done();
  };
  const item = items[0];
  const park = () => {
    const c = host.site.cradle;
    Object.assign(quad.position, { x: c.x, z: c.z });
    quad.yaw = c.yaw;
  };
  return { host, game, traffic, quad, unit, item, toasts, removed, scene, step, until, park, ctx };
}

function arrive(t) {
  expect(t.host.call()).toBe(true);
  expect(t.until(() => t.host.state === 'set')).toBe(true);
  t.step(30);
}

describe('her day', () => {
  it('turns up on a road day once the morning is in and the farm is a little way in', () => {
    const t = setup();
    t.step(100);
    expect(t.host.state).toBe('away'); // not in the first seconds
    t.step(150);
    expect(t.host.state).not.toBe('away');
    expect(t.host.visit?.kind).toBe('tuner');
  });
  it('does not turn up before her hour or after it', () => {
    for (const hour of [7, 19]) {
      const t = setup({ hour });
      t.step(400);
      expect(t.host.state, `at ${hour}`).toBe('away');
    }
  });
  it('does not turn up on a day that is not one', () => {
    const day = [2, 3, 4, 5, 6, 7, 8].find((d) => !isRoadDay(d, 7));
    const t = setup({ day });
    expect(t.host.isToday).toBe(false);
    t.step(400);
    expect(t.host.state).toBe('away');
  });
  it('can be turned off', () => {
    const t = setup();
    t.host.params.everyDays = 0;
    t.step(200);
    expect(t.host.state).toBe('away');
  });
  it('is called by the console whatever the day, and only once at a time', () => {
    const t = setup({ day: 2, hour: 7 });
    expect(t.host.debugCall()).toBe(true);
    expect(t.host.debugCall()).toBe(false);
  });
  it('sets up where she stops: the ramp comes down and the deck and ramp become solid', () => {
    const t = setup();
    arrive(t);
    expect(t.host.state).toBe('set');
    expect(t.host.colliders).toHaveLength(2);
    expect(t.host.rampK).toBe(1);
    expect(t.traffic.remark).toHaveBeenCalledWith('roadComing', expect.anything(), expect.any(Number));
  });
});

describe('the screen on the post', () => {
  it('is only there to use while she is set up and you are on foot', () => {
    const t = setup();
    expect(t.item.isAvailable()).toBe(false);
    arrive(t);
    expect(t.item.isAvailable()).toBe(true);
    t.game.player.isRiding = true;
    expect(t.item.isAvailable()).toBe(false);
  });
  it('says what is missing, in the order you would fix it, as plain reasons with no key', () => {
    const t = setup();
    arrive(t);
    expect(t.item.prompt()).toEqual({ info: 'Ride a quad onto the rollers first' });
    t.park();
    t.quad.engine.isRunning = false;
    expect(t.item.prompt()).toEqual({ info: "Start the quad's engine first" });
    t.quad.engine.isRunning = true;
    t.quad.manual = true;
    t.quad.drivetrain.gear = 2;
    expect(t.item.prompt()).toEqual({ info: 'Put it in neutral first' });
    t.quad.drivetrain.gear = 0;
    t.game.market.purse = 3;
    expect(t.item.prompt()).toEqual({ info: 'You are £12 short' });
  });
  it('offers the run as an E action with the quad and the price', () => {
    const t = setup();
    arrive(t);
    t.park();
    expect(t.item.prompt()).toEqual({ action: 'Run the Farm 300 on the rolling road for £15' });
  });
  it('does not take a quad that is rolling, crosswise or off to one side', () => {
    const t = setup();
    arrive(t);
    t.park();
    t.quad.speed = 3;
    expect(t.host.onTheRollers()).toBeNull();
    t.quad.speed = 0;
    t.quad.yaw += Math.PI / 2;
    expect(t.host.onTheRollers()).toBeNull();
    t.quad.yaw = t.host.site.cradle.yaw;
    t.quad.position.z += 3;
    expect(t.host.onTheRollers()).toBeNull();
  });
  it('makes the click of the strap and shows the rest', () => {
    const t = setup();
    expect(t.item.feedback).toBe('latch');
  });
});

describe('a run', () => {
  it('takes the money, holds the quad and its throttle, and leaves the engine as it found it', () => {
    const t = setup();
    arrive(t);
    t.park();
    t.item.interact();
    expect(t.game.market.purse).toBe(85);
    expect(t.quad.parkBrake).toBe(true);
    t.step(30);
    expect(t.quad.pto.throttle).toBeGreaterThan(0);
    expect(t.quad.pto.load).toBeGreaterThan(0);
    expect(t.host.run.active).toBe(true);
    expect(t.item.prompt()).toEqual({ info: 'A run is on' });
    t.until(() => !t.host.run);
    expect(t.quad.parkBrake).toBe(false);
    expect(t.quad.pto).toEqual({ throttle: 0, load: 0 });
  });
  it('writes the result down, hands over the slip and puts it on the sheet', () => {
    const t = setup();
    arrive(t);
    t.park();
    t.item.interact();
    t.until(() => !t.host.run);
    const last = t.host.log.last('red');
    expect(last.bhp).toBeGreaterThan(red.stockBhp - 1);
    expect(last.bhp).toBeLessThan(red.stockBhp + 1);
    expect(t.host.slip.isShown).toBe(true);
    expect(t.host.sheet.group.visible).toBe(true);
  });
  it('has the girls say something about the figure, and cheer a good one', () => {
    const t = setup();
    arrive(t);
    t.park();
    t.quad.engine.power = 1.15; // a keen engine
    t.item.interact();
    t.until(() => !t.host.run);
    expect(t.traffic.later.length).toBeGreaterThan(0);
    const spoken = [];
    t.traffic.remark = (key) => spoken.push(key);
    for (const l of t.traffic.later) l.run();
    expect(spoken).toContain('roadUp');
  });
  it('says down when the engine is sick', () => {
    const t = setup();
    arrive(t);
    t.park();
    t.quad.engine.power = 0.7;
    t.item.interact();
    t.until(() => !t.host.run);
    const spoken = [];
    t.traffic.remark = (key) => spoken.push(key);
    for (const l of t.traffic.later) l.run();
    expect(spoken).toContain('roadDown');
    expect(t.host.log.last('red').diff).toBeLessThan(-1);
  });
  it('gives the money back and drops the run if the engine cuts out', () => {
    const t = setup();
    arrive(t);
    t.park();
    t.item.interact();
    t.step(30);
    t.quad.engine.isRunning = false;
    t.step(2);
    expect(t.host.run).toBeNull();
    expect(t.game.market.purse).toBe(100);
    expect(t.host.log.last('red')).toBeNull();
    expect(t.toasts.some((m) => /cut out/.test(m) && /money is back/.test(m))).toBe(true);
    expect(t.quad.parkBrake).toBe(false);
  });
  it('gives the money back if the quad leaves the rollers', () => {
    const t = setup();
    arrive(t);
    t.park();
    t.item.interact();
    t.step(10);
    t.quad.position.z += 5;
    t.step(2);
    expect(t.host.run).toBeNull();
    expect(t.game.market.purse).toBe(100);
    expect(t.toasts.some((m) => /left the rollers/.test(m))).toBe(true);
  });
  it('is refused with the tin short, and nothing is taken', () => {
    const t = setup({ purse: 5 });
    arrive(t);
    t.park();
    t.item.interact();
    expect(t.host.run).toBeNull();
    expect(t.game.market.purse).toBe(5);
    expect(t.quad.parkBrake).toBe(false);
  });
  it('costs nothing from the console, but still wants a quad on the rollers', () => {
    const t = setup({ purse: 0 });
    arrive(t);
    expect(t.host.debugRun()).toBe(false);
    t.park();
    expect(t.host.debugRun()).toBe(true);
    expect(t.game.market.purse).toBe(0);
  });
  it('lets the girls argue once two quads are on the sheet and the new one is strongest', () => {
    const t = setup();
    t.host.log.add('blue', 1, { bhp: 12, rpm: 5000, torque: 10, diff: 0, curve: [] });
    arrive(t);
    t.park();
    t.item.interact();
    t.until(() => !t.host.run);
    expect(t.traffic.later.length).toBeGreaterThanOrEqual(2); // a line about the figure, and the argument
  });
});

describe('packing up', () => {
  it('waits while a quad is on the deck or a run is on, then raises the ramp, takes the deck away and goes', () => {
    const t = setup();
    arrive(t);
    t.park();
    t.game.daylight.hour = 18;
    t.step(50);
    expect(t.host.state).toBe('set'); // the quad is still on the rollers
    t.quad.position.x += 40;
    expect(t.until(() => t.host.state === 'away')).toBe(true);
    expect(t.removed).toHaveLength(2);
    expect(t.item.isAvailable()).toBe(false);
    expect(t.host.visit).toBeNull();
    expect(t.scene.some((o) => o.name === 'rolling-road-trailer')).toBe(false); // the trailer goes with her
  });
  it('goes when sent home, and not before she is set up', () => {
    const t = setup();
    expect(t.host.debugSendHome()).toBe(false);
    arrive(t);
    expect(t.host.debugSendHome()).toBe(true);
    expect(t.until(() => t.host.state === 'away')).toBe(true);
  });
  it('does not leave in the middle of a run', () => {
    const t = setup();
    arrive(t);
    t.park();
    t.item.interact();
    t.step(20);
    t.game.daylight.hour = 19;
    t.step(30);
    expect(t.host.state).toBe('set');
    t.until(() => !t.host.run);
    t.quad.position.x += 40;
    expect(t.until(() => t.host.state === 'away')).toBe(true);
  });
});

describe('what the farm keeps', () => {
  it('saves the runs and loads them again, and the sheet comes back with them', () => {
    const a = setup();
    arrive(a);
    a.park();
    a.item.interact();
    a.until(() => !a.host.run);
    const saved = JSON.parse(JSON.stringify(a.host.toJSON()));
    const b = setup();
    expect(b.host.sheet.group.visible).toBe(false);
    b.host.restore(saved);
    expect(b.host.log.last('red').bhp).toBe(a.host.log.last('red').bhp);
    expect(b.host.sheet.group.visible).toBe(true);
  });
  it('loads an old save with none of it', () => {
    const t = setup();
    t.host.restore(undefined);
    expect(t.host.log.ids()).toEqual([]);
    expect(t.host.sheet.group.visible).toBe(false);
  });
  it('can have the sheet taken down', () => {
    const t = setup();
    t.host.log.add('red', 1, { bhp: 18, rpm: 4800, torque: 20, diff: 0, curve: [] });
    t.host.refreshSheet();
    t.host.debugClearSheet();
    expect(t.host.log.ids()).toEqual([]);
    expect(t.host.sheet.group.visible).toBe(false);
  });
  it('describes itself for the panel', () => {
    const t = setup();
    expect(t.host.describe()).toMatch(/today is a rolling road day/);
    arrive(t);
    expect(t.host.describe()).toMatch(/set/);
  });
});
