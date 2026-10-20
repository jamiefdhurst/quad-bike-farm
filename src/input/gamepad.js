// The gamepad, pure (no DOM): a snapshot of the pad goes in, and out come the keys it counts as holding, the keys it taps, the analogue
// amounts (stick, triggers) and the radial menu. `Input` (core/input.js) feeds the keys into the same sets the keyboard uses, so
// everything that asks `isDown('KeyE')` works on a pad without knowing. Standard mapping only (Xbox, PlayStation, Switch Pro and most
// others report it).

export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export const DEFAULT_PAD_PARAMS = {
  deadzone: 0.18, // how far a stick must lean before it counts (0..1); worn sticks drift, so this is generous
  triggerDeadzone: 0.06, // how far a trigger must be squeezed before it counts
  lookRate: 900, // mouse pixels a second a fully leaned right stick stands for (the mouse sensitivity then turns them into an angle)
  lookCurve: 2, // 1 is straight, higher gives finer aim near the middle and the full rate at the edge
  steerCurve: 1.4, // the same for the steering stick, so small corrections are small
  holdReach: 0.5, // how far the stick has to lean to pick a slice of the radial menu
};

export const PAD_RANGES = {
  deadzone: [0.05, 0.5, 0.01],
  triggerDeadzone: [0, 0.3, 0.01],
  lookRate: [200, 2000, 50],
  lookCurve: [1, 3, 0.1],
  steerCurve: [1, 3, 0.1],
  holdReach: [0.2, 0.9, 0.05],
};

/** A stick with a round dead zone: nothing inside it, then rising from zero at its edge to one at full lean. */
export function shapeStick(x, y, dead) {
  const m = Math.hypot(x, y);
  if (m <= dead) return { x: 0, y: 0, mag: 0 };
  const k = Math.min(1, (m - dead) / (1 - dead));
  return { x: (x / m) * k, y: (y / m) * k, mag: k };
}

/** A trigger from 0 to 1 once past its dead zone. */
export function shapeTrigger(v, dead) {
  return v <= dead ? 0 : Math.min(1, (v - dead) / (1 - dead));
}

/** The numbers worth having from a browser Gamepad (or anything shaped like one). Null if it isn't a usable pad. */
export function readPad(raw, params = DEFAULT_PAD_PARAMS) {
  if (!raw || !raw.buttons || raw.buttons.length < 12) return null;
  const down = (i) => !!raw.buttons[i]?.pressed;
  const value = (i) => raw.buttons[i]?.value ?? (down(i) ? 1 : 0);
  const axes = raw.axes ?? [];
  const buttons = [];
  for (let i = 0; i < 16; i++) buttons.push(down(i));
  const left = shapeStick(axes[0] ?? 0, axes[1] ?? 0, params.deadzone);
  const right = shapeStick(axes[2] ?? 0, axes[3] ?? 0, params.deadzone);
  const lt = shapeTrigger(value(PAD.LT), params.triggerDeadzone);
  const rt = shapeTrigger(value(PAD.RT), params.triggerDeadzone);
  // Some pads report the triggers as plain buttons with no analogue value: pressed is all you get, so it is full.
  buttons[PAD.LT] = lt > 0;
  buttons[PAD.RT] = rt > 0;
  return { buttons, left, right, lt, rt };
}

/** The line the console prints about the pad. `names` are the connected pads' ids. */
export function padStatus(names) {
  if (!names.length) return 'Gamepad: none detected. If one is plugged in, press a button on it (browsers only see a pad once it is used).';
  if (names.length === 1) return `Gamepad: detected, ${names[0]}. Start to play, H for the controls.`;
  return `Gamepad: ${names.length} detected, using the first (${names[0]}).`;
}

// The radial menu ----------------------------------------------------------------------------------------------------------------------

// What the right stick click opens: the keys the pad has no button left for. `hold` is how long the key is held for after you pick it (a
// press is one frame), because the crank, the choke and the pull-start work by holding. `where` is 'ride', 'foot' or both.
export const RADIAL_ITEMS = [
  { label: 'Ignition', key: 'KeyK' },
  { label: 'Crank', key: 'KeyR', hold: 3 },
  { label: 'Pull-start', key: 'KeyO', hold: 0.9, where: 'ride' },
  { label: 'More choke', key: 'KeyQ', hold: 0.5 },
  { label: 'Less choke', key: 'KeyZ', hold: 0.5 },
  { label: 'Fuel tap', key: 'KeyF' },
  { label: 'Dipstick', key: 'KeyY', hold: 1.2, where: 'foot' },
  { label: 'Lights', key: 'KeyP', where: 'ride', note: 'Yak, Moorlands and the quads that have a switch' },
  { label: 'Left indicator', key: 'Comma', where: 'ride' },
  { label: 'Right indicator', key: 'Period', where: 'ride' },
  { label: 'Hazards', key: 'Equal', where: 'ride' },
  { label: '4WD', key: 'KeyG', where: 'ride' },
  { label: 'Diff lock', key: 'KeyU', where: 'ride' },
  { label: 'Neutral', key: 'Digit0', where: 'ride' },
  { label: 'Radio', key: 'KeyI', where: 'ride', note: 'Moorlands and cars' },
  { label: 'Seat belt', key: 'Semicolon', where: 'ride' },
  { label: 'Right it', key: 'KeyT', where: 'ride' },
  { label: 'Hitch', key: 'KeyJ' },
  { label: 'Wipe the lens', key: 'KeyX', where: 'ride' },
  { label: 'Tip / ramps', key: 'KeyT', where: 'foot' },
  { label: 'Push', key: 'KeyV', hold: 1.5, where: 'foot' },
  { label: 'Wave', key: 'Digit6' },
  { label: 'Bucket list', key: 'Tab' },
  { label: 'Sound on/off', key: 'KeyN' },
];

/** The items for where you are: `mode` is 'ride' or 'foot'. */
export function radialItems(mode) {
  return RADIAL_ITEMS.filter((i) => !i.where || i.where === mode);
}

/** Where each slice's label sits round a ring of `radius`, the first at the top, going clockwise (screen y grows downward). */
export function radialPositions(n, radius) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: Math.sin(a) * radius, y: -Math.cos(a) * radius };
  });
}

/** Which slice a stick leaning to (x, y) points at, or -1 if it isn't leaning far enough. y is screen-down, as the stick reports. */
export function sliceAt(x, y, n, reach) {
  if (n <= 0 || Math.hypot(x, y) < reach) return -1;
  const a = Math.atan2(x, -y); // 0 at the top, clockwise
  const turn = (a + Math.PI * 2) % (Math.PI * 2);
  return Math.round((turn / (Math.PI * 2)) * n) % n;
}

// The controller ----------------------------------------------------------------------------------------------------------------------

/**
 * What the buttons mean now. Remembers the last frame (for taps and the radial menu), and what is being held for a while after a
 * radial pick. `update(raw, dt, ctx)` takes the browser's pad (or null), the seconds since last time and
 * ctx = { mode: 'foot' | 'ride' | 'menu' | 'paused', menu: 'wheel' | 'workshop' | 'bench' | 'notebook', seat, gear, gears, bucketOpen }, and returns:
 *   { connected, held: Set of key codes, taps: key codes pressed this frame, move, look, steer, throttle, brake,
 *     start, select, radial: null | { items, index } }
 */
export class PadController {
  constructor(params = DEFAULT_PAD_PARAMS) {
    this.params = params;
    this.prev = new Array(16).fill(false);
    this.timed = new Map(); // key code -> seconds left it stays held (radial picks)
    this.radial = null;
  }

  /** Where it is open: the items and which one is picked. */
  get radialOpen() {
    return !!this.radial;
  }

  closeRadial() {
    this.radial = null;
  }

  update(raw, dt, ctx) {
    const p = this.params;
    const pad = readPad(raw, p);
    const out = { connected: !!pad, held: new Set(), taps: [], move: { x: 0, y: 0, mag: 0 }, look: { x: 0, y: 0 }, steer: 0, throttle: 0, brake: 0, start: false, select: false, radial: null };
    if (!pad) {
      this.prev.fill(false);
      this.timed.clear();
      this.radial = null;
      return out;
    }
    const b = pad.buttons;
    if (ctx.mode === 'paused') {
      // Behind the start or pause card only Start does anything.
      out.start = b[PAD.START] && !this.prev[PAD.START];
      this.prev = b.slice();
      this.radial = null;
      return out;
    }
    const edge = (i) => b[i] && !this.prev[i];
    const mode = ctx.mode;
    out.start = edge(PAD.START) && !this.radial; // Start shuts the radial menu first
    out.select = edge(PAD.SELECT);

    // A radial pick holds its key for a moment (the crank), and any other press lets go of it early.
    const anyPress = b.some((v, i) => v && !this.prev[i] && i !== PAD.START);
    for (const [code, left] of this.timed) {
      if (anyPress || left <= dt) this.timed.delete(code);
      else {
        this.timed.set(code, left - dt);
        out.held.add(code);
      }
    }

    if (this.radial) this.updateRadial(pad, edge, out);
    else if (mode !== 'menu') {
      if (edge(PAD.R3)) this.openRadial(mode);
    }

    if (this.radial) {
      out.radial = { items: this.radial.items, index: this.radial.index };
      out.look = { x: 0, y: 0 };
    } else if (mode === 'menu') {
      // A menu is the wheel's cursor on the right stick, the D-pad and A, B.
      out.look = this.lookFrom(pad.right, dt);
      out.look.x += pad.left.x * p.lookRate * dt * 0.6;
      out.look.y += pad.left.y * p.lookRate * dt * 0.6;
      this.menuKeys(b, ctx.menu, out);
    } else {
      out.look = this.lookFrom(pad.right, dt);
      if (mode === 'ride') this.rideKeys(pad, b, edge, out, ctx);
      else this.footKeys(pad, b, out);
    }
    if (b[PAD.SELECT] && !this.radial) out.held.add('KeyH');
    this.prev = b.slice();
    return out;
  }

  /**
   * The menus read keys of their own. The girls' wheel: A picks, B backs out. The toolbox: the D-pad moves between rows and adjusts, X
   * services, Y the silencer, B leaves. The bench: A is its E, the face buttons and bumpers pick a job (1 to 4), B leaves.
   */
  menuKeys(b, menu, out) {
    const dpad = () => {
      if (b[PAD.UP]) out.held.add('ArrowUp');
      if (b[PAD.DOWN]) out.held.add('ArrowDown');
      if (b[PAD.LEFT]) out.held.add('ArrowLeft');
      if (b[PAD.RIGHT]) out.held.add('ArrowRight');
    };
    if (menu === 'workshop') {
      dpad();
      if (b[PAD.B]) out.held.add('Escape');
      if (b[PAD.X]) out.held.add('KeyV');
      if (b[PAD.Y]) out.held.add('KeyX');
    } else if (menu === 'bench') {
      if (b[PAD.A]) out.held.add('KeyE');
      if (b[PAD.B]) out.held.add('Escape');
      if (b[PAD.X]) out.held.add('Digit1');
      if (b[PAD.Y]) out.held.add('Digit2');
      if (b[PAD.LB]) out.held.add('Digit3');
      if (b[PAD.RB]) out.held.add('Digit4');
    } else if (menu === 'notebook') {
      if (b[PAD.A] || b[PAD.B]) out.held.add('Escape');
    } else {
      dpad();
      if (b[PAD.A]) out.held.add('Enter');
      if (b[PAD.B]) out.held.add('Escape');
    }
  }

  lookFrom(stick, dt) {
    const p = this.params;
    const curve = (v) => Math.sign(v) * Math.abs(v) ** p.lookCurve;
    return { x: curve(stick.x) * p.lookRate * dt, y: curve(stick.y) * p.lookRate * dt };
  }

  footKeys(pad, b, out) {
    out.move = pad.left;
    if (b[PAD.A]) out.held.add('KeyE');
    if (b[PAD.B]) out.held.add('KeyG');
    if (b[PAD.X]) out.held.add('KeyX');
    if (b[PAD.Y]) out.held.add('Space');
    if (b[PAD.RB]) out.held.add('KeyB');
    if (b[PAD.LT]) out.held.add('KeyV');
    if (b[PAD.L3] || b[PAD.LB]) out.held.add('ShiftLeft'); // jog, or the clutch while you work a gear lever from outside
    if (b[PAD.LEFT]) out.held.add('ArrowLeft'); // the bucket list's pages
    if (b[PAD.RIGHT]) out.held.add('ArrowRight');
    if (pad.rt > 0) out.held.add('KeyE'); // a second thumb for the hold-to-pour and winch jobs
  }

  rideKeys(pad, b, edge, out, ctx) {
    const p = this.params;
    const sx = pad.left.x;
    out.steer = -Math.sign(sx) * Math.abs(sx) ** p.steerCurve; // left is positive, as A is
    if (Math.abs(sx) > 0.35) out.held.add(sx < 0 ? 'KeyA' : 'KeyD'); // so the reverse rules and the like see steering
    out.throttle = pad.rt;
    out.brake = pad.lt;
    if (pad.rt > 0) out.held.add('KeyW');
    if (pad.lt > 0) out.held.add('KeyS');
    if (b[PAD.B] || (b[PAD.A] && ctx.seat === 'pillion')) out.held.add('KeyE');
    if (b[PAD.X]) out.held.add('KeyL');
    if (b[PAD.Y]) out.held.add('Space');
    if (b[PAD.LB]) out.held.add('ShiftLeft');
    if (b[PAD.RB]) out.held.add('KeyB');
    if (b[PAD.L3]) out.held.add('KeyC');
    if (!b[PAD.LB] && ctx.bucketOpen) {
      if (b[PAD.LEFT]) out.held.add('ArrowLeft');
      if (b[PAD.RIGHT]) out.held.add('ArrowRight');
    }
    if (b[PAD.LB]) {
      // Clutch in: the D-pad is the gear lever, a gear up or down from where it is (neutral between first and reverse).
      const gear = ctx.gear;
      if (gear != null && ctx.gears) {
        if (edge(PAD.UP)) out.taps.push(`Digit${Math.min(ctx.gears, Math.max(0, gear) + 1)}`);
        if (edge(PAD.DOWN) && gear > 0) out.taps.push(gear === 1 ? 'Digit0' : `Digit${gear - 1}`);
      }
    }
  }

  openRadial(mode) {
    const items = radialItems(mode);
    this.radial = { items, index: 0 };
  }

  updateRadial(pad, edge, out) {
    const r = this.radial;
    const n = r.items.length;
    if (edge(PAD.RIGHT) || edge(PAD.DOWN)) r.index = (r.index + 1) % n;
    if (edge(PAD.LEFT) || edge(PAD.UP)) r.index = (r.index + n - 1) % n;
    const pick = sliceAt(pad.right.x, pad.right.y, n, this.params.holdReach);
    if (pick >= 0) r.index = pick;
    if (edge(PAD.B) || edge(PAD.START)) {
      this.radial = null;
    } else if (edge(PAD.A) || edge(PAD.R3)) {
      const item = r.items[r.index];
      this.radial = null;
      if (item.hold) {
        this.timed.set(item.key, item.hold);
        out.held.add(item.key);
      }
      out.taps.push(item.key);
    }
  }
}
