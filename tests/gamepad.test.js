import { describe, it, expect, vi, afterEach } from 'vitest';
import { PadController, PAD, shapeStick, shapeTrigger, readPad, padStatus, radialItems, radialPositions, sliceAt, DEFAULT_PAD_PARAMS as P, PAD_RANGES } from '../src/input/gamepad.js';
import { Input } from '../src/core/input.js';

// A browser Gamepad stand-in: pressed buttons by index, trigger amounts, stick axes.
function raw({ down = [], lt = 0, rt = 0, axes = [0, 0, 0, 0] } = {}) {
  const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 }));
  buttons[PAD.LT] = { pressed: lt > 0.05, value: lt };
  buttons[PAD.RT] = { pressed: rt > 0.05, value: rt };
  return { connected: true, id: 'Test pad', buttons, axes };
}
const ride = { mode: 'ride', seat: 'rider', gear: 2, gears: 4 };
const foot = { mode: 'foot' };

describe('sticks and triggers', () => {
  it('ignores a drifting stick and rises from zero at the edge of the dead zone', () => {
    expect(shapeStick(0.1, 0.1, P.deadzone).mag).toBe(0);
    const s = shapeStick(1, 0, P.deadzone);
    expect(s.x).toBeCloseTo(1);
    const part = shapeStick(0.5, 0, P.deadzone);
    expect(part.x).toBeGreaterThan(0);
    expect(part.x).toBeLessThan(0.5);
  });

  it('scales a trigger from nothing past its dead zone to one', () => {
    expect(shapeTrigger(0.03, P.triggerDeadzone)).toBe(0);
    expect(shapeTrigger(1, P.triggerDeadzone)).toBe(1);
    expect(shapeTrigger(0.5, P.triggerDeadzone)).toBeGreaterThan(0.4);
  });

  it('refuses anything that is not a full pad', () => {
    expect(readPad(null)).toBe(null);
    expect(readPad({ buttons: [], axes: [] })).toBe(null);
  });

  it('has a range for every tunable', () => {
    for (const k of Object.keys(P)) expect(PAD_RANGES[k], k).toBeTruthy();
  });
});

describe('on foot', () => {
  it('maps A to E, B to G and the stick to a walk', () => {
    const c = new PadController({ ...P });
    const s = c.update(raw({ down: [PAD.A, PAD.B], axes: [0, -1, 0, 0] }), 0.016, foot);
    expect(s.held.has('KeyE')).toBe(true);
    expect(s.held.has('KeyG')).toBe(true);
    expect(s.move.y).toBeLessThan(0); // up is forward
  });

  it('turns the right stick into mouse pixels, finer near the middle', () => {
    const c = new PadController({ ...P });
    const small = c.update(raw({ axes: [0, 0, 0.4, 0] }), 0.1, foot).look.x;
    const big = c.update(raw({ axes: [0, 0, 1, 0] }), 0.1, foot).look.x;
    expect(big).toBeGreaterThan(small * 3);
    expect(big).toBeCloseTo(P.lookRate * 0.1);
  });

  it('says nothing when no pad is there', () => {
    const c = new PadController({ ...P });
    const s = c.update(null, 0.016, foot);
    expect(s.connected).toBe(false);
    expect(s.held.size).toBe(0);
  });
});

describe('on a vehicle', () => {
  it('gives the triggers as amounts, and as W and S for the rules that read keys', () => {
    const c = new PadController({ ...P });
    const s = c.update(raw({ rt: 0.5, lt: 0 }), 0.016, ride);
    expect(s.held.has('KeyW')).toBe(true);
    expect(s.held.has('KeyS')).toBe(false);
    expect(s.throttle).toBeGreaterThan(0.4);
    expect(s.throttle).toBeLessThan(0.6);
  });

  it('steers left positive, as A does, in proportion to the lean', () => {
    const c = new PadController({ ...P });
    expect(c.update(raw({ axes: [-1, 0, 0, 0] }), 0.016, ride).steer).toBeCloseTo(1);
    expect(c.update(raw({ axes: [0.5, 0, 0, 0] }), 0.016, ride).steer).toBeLessThan(0);
    expect(c.update(raw({ axes: [0.3, 0, 0, 0] }), 0.016, ride).held.has('KeyD')).toBe(false);
  });

  it('works the clutch on LB and the gear lever on the D-pad', () => {
    const c = new PadController({ ...P });
    let s = c.update(raw({ down: [PAD.LB] }), 0.016, ride);
    expect(s.held.has('ShiftLeft')).toBe(true);
    s = c.update(raw({ down: [PAD.LB, PAD.UP] }), 0.016, ride);
    expect(s.taps).toEqual(['Digit3']);
    s = c.update(raw({ down: [PAD.LB, PAD.UP] }), 0.016, ride); // held: no second shift
    expect(s.taps).toEqual([]);
    c.update(raw({ down: [PAD.LB] }), 0.016, ride);
    s = c.update(raw({ down: [PAD.LB, PAD.DOWN] }), 0.016, ride);
    expect(s.taps).toEqual(['Digit1']);
  });

  it('goes to neutral from first, to first from neutral, and stops at the top gear', () => {
    const c = new PadController({ ...P });
    const lb = { down: [PAD.LB] };
    c.update(raw(lb), 0.016, ride);
    expect(c.update(raw({ down: [PAD.LB, PAD.DOWN] }), 0.016, { ...ride, gear: 1 }).taps).toEqual(['Digit0']);
    c.update(raw(lb), 0.016, ride);
    expect(c.update(raw({ down: [PAD.LB, PAD.UP] }), 0.016, { ...ride, gear: 0 }).taps).toEqual(['Digit1']);
    c.update(raw(lb), 0.016, ride);
    expect(c.update(raw({ down: [PAD.LB, PAD.UP] }), 0.016, { ...ride, gear: 4 }).taps).toEqual(['Digit4']);
    c.update(raw(lb), 0.016, ride);
    expect(c.update(raw({ down: [PAD.LB, PAD.UP] }), 0.016, { ...ride, gear: -1 }).taps).toEqual(['Digit1']);
  });

  it('gets off on B, and talks on A only as a pillion', () => {
    const c = new PadController({ ...P });
    expect(c.update(raw({ down: [PAD.B] }), 0.016, ride).held.has('KeyE')).toBe(true);
    expect(c.update(raw({ down: [PAD.A] }), 0.016, ride).held.has('KeyE')).toBe(false);
    expect(c.update(raw({ down: [PAD.A] }), 0.016, { ...ride, seat: 'pillion' }).held.has('KeyE')).toBe(true);
  });
});

describe('the radial menu', () => {
  const open = (c, ctx = ride) => {
    c.update(raw(), 0.016, ctx);
    return c.update(raw({ down: [PAD.R3] }), 0.016, ctx);
  };

  it('opens on R3, walks round with the D-pad and does the pick on A', () => {
    const c = new PadController({ ...P });
    expect(open(c).radial.index).toBe(0);
    c.update(raw(), 0.016, ride);
    expect(c.update(raw({ down: [PAD.RIGHT] }), 0.016, ride).radial.index).toBe(1);
    c.update(raw(), 0.016, ride);
    const s = c.update(raw({ down: [PAD.A] }), 0.016, ride);
    expect(s.radial).toBe(null);
    expect(s.taps).toEqual([radialItems('ride')[1].key]);
  });

  it('wraps round both ways and shuts on B or Start without Start pausing', () => {
    const c = new PadController({ ...P });
    open(c);
    const n = radialItems('ride').length;
    expect(c.update(raw({ down: [PAD.LEFT] }), 0.016, ride).radial.index).toBe(n - 1);
    c.update(raw(), 0.016, ride);
    const s = c.update(raw({ down: [PAD.START] }), 0.016, ride);
    expect(s.start).toBe(false);
    expect(s.radial).toBe(null);
    c.update(raw(), 0.016, ride);
    expect(c.update(raw({ down: [PAD.START] }), 0.016, ride).start).toBe(true);
  });

  it('holds a crank for a few seconds, and lets go on any press', () => {
    const c = new PadController({ ...P });
    open(c);
    c.update(raw(), 0.016, ride);
    c.update(raw({ down: [PAD.RIGHT] }), 0.016, ride); // Crank
    c.update(raw(), 0.016, ride);
    let s = c.update(raw({ down: [PAD.A] }), 0.016, ride);
    expect(s.held.has('KeyR')).toBe(true);
    s = c.update(raw(), 1, ride);
    expect(s.held.has('KeyR')).toBe(true);
    s = c.update(raw({ down: [PAD.X] }), 0.016, ride);
    expect(s.held.has('KeyR')).toBe(false);
  });

  it('keeps pad movement and the throttle out of it while it is open', () => {
    const c = new PadController({ ...P });
    open(c);
    const s = c.update(raw({ rt: 1, axes: [0, 0, 0, 0] }), 0.016, ride);
    expect(s.radial).toBeTruthy();
    expect(s.look).toEqual({ x: 0, y: 0 });
  });

  it('picks by the right stick and lays the ring out from the top, clockwise', () => {
    expect(sliceAt(0, -1, 8, 0.5)).toBe(0);
    expect(sliceAt(1, 0, 8, 0.5)).toBe(2);
    expect(sliceAt(0, 1, 8, 0.5)).toBe(4);
    expect(sliceAt(-1, 0, 8, 0.5)).toBe(6);
    expect(sliceAt(0.1, 0.1, 8, 0.5)).toBe(-1);
    const [top, right] = radialPositions(4, 100);
    expect(top.y).toBeCloseTo(-100);
    expect(right.x).toBeCloseTo(100);
  });

  it('offers on foot only what makes sense there', () => {
    const labels = radialItems('foot').map((i) => i.label);
    expect(labels).toContain('Dipstick');
    expect(labels).not.toContain('Left indicator');
    expect(radialItems('ride').map((i) => i.label)).not.toContain('Dipstick');
  });
});

describe('menus and the start card', () => {
  it('uses A and B in the wheel, the D-pad as arrows', () => {
    const c = new PadController({ ...P });
    const s = c.update(raw({ down: [PAD.A, PAD.LEFT] }), 0.016, { mode: 'menu', menu: 'wheel' });
    expect(s.held.has('Enter')).toBe(true);
    expect(s.held.has('ArrowLeft')).toBe(true);
    expect(c.update(raw({ down: [PAD.B] }), 0.016, { mode: 'menu', menu: 'wheel' }).held.has('Escape')).toBe(true);
  });

  it('does not let A shut the toolbox, which treats Enter as leave', () => {
    const c = new PadController({ ...P });
    const s = c.update(raw({ down: [PAD.A] }), 0.016, { mode: 'menu', menu: 'workshop' });
    expect(s.held.has('Enter')).toBe(false);
  });

  it('moves the wheel cursor with the right stick, and nothing else, behind the card', () => {
    const c = new PadController({ ...P });
    expect(c.update(raw({ axes: [0, 0, 1, 0] }), 0.1, { mode: 'menu', menu: 'wheel' }).look.x).toBeGreaterThan(0);
    const s = c.update(raw({ down: [PAD.A, PAD.START], axes: [0, 0, 1, 0] }), 0.1, { mode: 'paused' });
    expect(s.start).toBe(true);
    expect(s.held.size).toBe(0);
    expect(s.look.x).toBe(0);
  });

  it('reads Start once, not every frame it is held', () => {
    const c = new PadController({ ...P });
    expect(c.update(raw({ down: [PAD.START] }), 0.016, foot).start).toBe(true);
    expect(c.update(raw({ down: [PAD.START] }), 0.016, foot).start).toBe(false);
  });
});

describe('the console line', () => {
  it('says none, one, or several', () => {
    expect(padStatus([])).toMatch(/none detected/);
    expect(padStatus(['Xbox'])).toMatch(/detected, Xbox/);
    expect(padStatus(['A', 'B'])).toMatch(/2 detected/);
  });
});

const setPad = (pad) => vi.stubGlobal('navigator', { getGamepads: () => [pad] });

describe('Input with a pad', () => {
  afterEach(() => vi.unstubAllGlobals());

  function fakeInput(pad) {
    vi.stubGlobal('window', { addEventListener() {} });
    vi.stubGlobal('document', { addEventListener() {} });
    setPad(pad);
    return new Input({});
  }

  it('counts pad buttons as keys, with a press only on the first frame', () => {
    const input = fakeInput(raw({ down: [PAD.A] }));
    input.poll(0.016, foot);
    expect(input.isDown('KeyE')).toBe(true);
    expect(input.wasPressed('KeyE')).toBe(true);
    input.endFrame();
    input.poll(0.016, foot);
    expect(input.wasPressed('KeyE')).toBe(false);
    expect(input.isDown('KeyE')).toBe(true);
    setPad(raw());
    input.endFrame();
    input.poll(0.016, foot);
    expect(input.isDown('KeyE')).toBe(false);
  });

  it('gives a trigger as an amount, and the keyboard all the way', () => {
    const input = fakeInput(raw({ rt: 0.5 }));
    input.poll(0.016, ride);
    expect(input.fromPad('KeyW')).toBe(true);
    expect(input.amount('KeyW')).toBeCloseTo(0.47, 1);
    input.down.add('KeyS');
    expect(input.amount('KeyS')).toBe(1);
  });

  it('steers from the stick, else from A and D', () => {
    const input = fakeInput(raw({ axes: [-1, 0, 0, 0] }));
    input.poll(0.016, ride);
    expect(input.steerAxis()).toBeCloseTo(1);
    setPad(null);
    input.poll(0.016, ride);
    input.down.add('KeyD');
    expect(input.steerAxis()).toBe(-1);
  });

  it('presses a radial pick for one frame only', () => {
    const input = fakeInput(raw());
    input.poll(0.016, ride);
    setPad(raw({ down: [PAD.R3] }));
    input.poll(0.016, ride);
    setPad(raw());
    input.poll(0.016, ride);
    setPad(raw({ down: [PAD.A] }));
    input.poll(0.016, ride);
    expect(input.wasPressed('KeyK')).toBe(true);
    input.endFrame();
    setPad(raw());
    input.poll(0.016, ride);
    expect(input.isDown('KeyK')).toBe(false);
  });

  it('adds the stick to the mouse look', () => {
    const input = fakeInput(raw({ axes: [0, 0, 1, 0] }));
    input.poll(0.1, foot);
    expect(input.takeMouseDelta().x).toBeGreaterThan(50);
  });
});
