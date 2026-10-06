// Faults that develop on a quad over time, separate from wear: a slow puncture, a
// slipping drive belt, a sticking throttle cable and a dirty carb. Each starts
// without warning, gets worse until it's put right at the toolbox, and has a
// symptom you can feel or hear. Pure logic, no Three.js.

export const DEFAULT_FAULT_PARAMS = {
  // How often each one starts, as the average seconds of the right kind of use per fault.
  punctureEvery: 2400, // riding: a thorn from the hedge
  beltEvery: 1800, // riding hard, with the throttle well open
  cableEvery: 7200, // engine running (was 2700: it stuck too often)
  carbEvery: 2400, // engine running
  // How long each takes to go from just started to as bad as it gets.
  punctureSeconds: 120, // the tyre going flat
  beltSeconds: 300, // of hard riding
  cableSeconds: 600, // running
  carbSeconds: 900, // running
  // What they do at their worst.
  puncturePull: 0.09, // radians the bars are pulled towards the flat tyre (half for a rear one)
  punctureDrag: 0.12, // drive lost to a flat tyre's rolling resistance
  beltDriveLoss: 0.8, // drive lost to a fully slipping belt
  cableHang: 5, // seconds the throttle takes to come back from open, just before the cable sticks for good
  cableHangFrom: 0.2, // below this the cable's only a little stiff and doesn't hang
  cableHangMin: 0.4, // seconds it takes to come back as it first starts to hang, lengthening from there (faster than linear)
  cableStuckAt: 0.9, // at this level it never comes back: it holds wherever you last opened it until you switch off
  hardThrottle: 0.6, // throttle that counts as riding hard
  movingSpeed: 2, // m/s over which it counts as being ridden
  fieldFixLevel: 0.12, // what's left of a fault after a rough fix in the yard (the bench does it properly)
  fieldFixCap: 0.28, // and it never gets worse than this, which is just under what Amy notices
};

export const FAULT_PARAM_RANGES = {
  punctureEvery: [60, 20000, 60],
  beltEvery: [60, 20000, 60],
  cableEvery: [60, 20000, 60],
  carbEvery: [60, 20000, 60],
  punctureSeconds: [10, 1200, 10],
  beltSeconds: [10, 1800, 10],
  cableSeconds: [10, 1800, 10],
  carbSeconds: [10, 3600, 10],
  puncturePull: [0, 0.3, 0.005],
  punctureDrag: [0, 0.5, 0.01],
  beltDriveLoss: [0, 1, 0.01],
  cableHang: [0, 15, 0.5],
  cableHangFrom: [0, 1, 0.05],
  cableHangMin: [0, 5, 0.1],
  cableStuckAt: [0.3, 1, 0.01],
  hardThrottle: [0.1, 1, 0.05],
  movingSpeed: [0.5, 10, 0.5],
  fieldFixLevel: [0, 0.5, 0.01],
  fieldFixCap: [0, 1, 0.01],
};

export const FAULT_KINDS = ['puncture', 'belt', 'cable', 'carb'];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Which side a flat tyre pulls to: wheels 0 and 2 are on the rider's left (steering positive), 1 and 3 on the right. */
export const tyreSide = (i) => (i % 2 === 0 ? 1 : -1);
export const tyreIsFront = (i) => i < 2;

export class Faults {
  constructor(params = { ...DEFAULT_FAULT_PARAMS }, random = Math.random) {
    this.params = params;
    this.random = random;
    this.tyre = -1; // which wheel has the puncture
    this.levels = { puncture: 0, belt: 0, cable: 0, carb: 0 }; // 0 none, rising to 1 at their worst
    this.started = { puncture: false, belt: false, cable: false, carb: false };
    this.caps = { puncture: 1, belt: 1, cable: 1, carb: 1 }; // a rough fix leaves it from getting any worse than this
    this.heldThrottle = 0; // what a sticking cable is still holding open
    this.events = []; // { type: 'start' | 'fixed', kind } this step
  }

  has(kind) {
    return this.started[kind];
  }

  get any() {
    return FAULT_KINDS.some((k) => this.started[k]);
  }

  /** The starting level of a fault, so it's already noticeable and always has somewhere to go. */
  begin(kind) {
    if (this.started[kind]) return false;
    this.started[kind] = true;
    this.levels[kind] = 0.15;
    if (kind === 'puncture') this.tyre = Math.floor(this.random() * 4);
    this.events.push({ type: 'start', kind });
    return true;
  }

  /**
   * @param {number} dt
   * @param {object} s
   * @param {boolean} s.running  engine running
   * @param {number} s.speed     m/s over the ground
   * @param {number} s.throttle  0..1
   */
  update(dt, { running, speed, throttle }) {
    const p = this.params;
    this.events.length = 0;
    const moving = running && speed > p.movingSpeed;
    const hard = moving && throttle > p.hardThrottle;
    const chance = (every) => 1 - Math.exp(-dt / every);
    if (moving && !this.started.puncture && this.random() < chance(p.punctureEvery)) this.begin('puncture');
    if (hard && !this.started.belt && this.random() < chance(p.beltEvery)) this.begin('belt');
    if (running && !this.started.cable && this.random() < chance(p.cableEvery)) this.begin('cable');
    if (running && !this.started.carb && this.random() < chance(p.carbEvery)) this.begin('carb');
    const grow = (kind, on, seconds) => {
      if (this.started[kind] && on) this.levels[kind] = Math.min(this.caps[kind], this.levels[kind] + dt / seconds);
    };
    grow('puncture', true, p.punctureSeconds); // a tyre goes down parked too
    grow('belt', hard, p.beltSeconds);
    grow('cable', running, p.cableSeconds);
    grow('carb', running, p.carbSeconds);
  }

  /** The cable has stuck for good: it won't close until you switch off (or it's fixed). */
  get stuck() {
    return this.started.cable && this.levels.cable >= this.params.cableStuckAt;
  }

  /**
   * What the throttle really is. A stiffening cable keeps it open for a while after you let go, longer the worse it gets, and once
   * it's bad enough it stays wherever you last opened it (opening further still works). Switching off frees it.
   */
  stickThrottle(dt, throttle, running) {
    const p = this.params;
    const level = this.levels.cable;
    if (!this.started.cable || !running || level < p.cableHangFrom) {
      this.heldThrottle = throttle;
      return throttle;
    }
    if (this.stuck) {
      this.heldThrottle = Math.max(throttle, this.heldThrottle);
      return this.heldThrottle;
    }
    // From a moment's hesitation to p.cableHang seconds, accelerating as it nears sticking.
    const t = clamp((level - p.cableHangFrom) / Math.max(0.01, p.cableStuckAt - p.cableHangFrom), 0, 1);
    const hang = p.cableHangMin + (p.cableHang - p.cableHangMin) * Math.pow(t, 1.5);
    // Eases back from where it was left.
    this.heldThrottle = Math.max(throttle, this.heldThrottle - (dt / hang) * Math.max(0.1, this.heldThrottle));
    return this.heldThrottle > throttle ? this.heldThrottle : throttle;
  }

  /** Radians the bars are pulled to one side (positive is left). */
  get steerPull() {
    if (!this.started.puncture) return 0;
    return tyreSide(this.tyre) * (tyreIsFront(this.tyre) ? 1 : 0.5) * this.params.puncturePull * this.levels.puncture;
  }

  /** Multiplier on the drive force at the wheels. */
  get driveFactor() {
    return (1 - this.params.punctureDrag * this.levels.puncture) * (1 - this.params.beltDriveLoss * this.levels.belt);
  }

  /** 0..1 how badly the belt slips, and how dirty the carb is (for the engine). */
  get slip() {
    return this.levels.belt;
  }

  get dirt() {
    return this.levels.carb;
  }

  /**
   * Puts one right (pump and patch the tyre, new belt, lubricate the cable, clean the carb). True if there was anything to do.
   * A rough fix, which is all you can do in the yard, leaves a mild fault that never gets much worse; the bench does it properly.
   */
  fix(kind, { rough = false } = {}) {
    if (!this.started[kind]) return false;
    if (rough) {
      if (this.caps[kind] < 1) return false; // already patched up as far as it'll go
      this.leave(kind, this.params.fieldFixLevel, this.params.fieldFixCap);
      this.events.push({ type: 'fixed', kind });
      return true;
    }
    this.started[kind] = false;
    this.levels[kind] = 0;
    this.caps[kind] = 1;
    if (kind === 'puncture') this.tyre = -1;
    if (kind === 'cable') this.heldThrottle = 0;
    this.events.push({ type: 'fixed', kind });
    return true;
  }

  /** Leaves a fault at this level, unable to get worse than `cap`: a botched or rough repair. */
  leave(kind, level, cap = 1) {
    this.started[kind] = true;
    this.levels[kind] = Math.min(level, cap);
    this.caps[kind] = cap;
    if (kind === 'puncture' && this.tyre < 0) this.tyre = Math.floor(this.random() * 4);
  }
}

/** How a symptom comes across to someone near it, 0..1: below `from` it's too slight to notice. */
export function noticeable(level, from = 0.3) {
  return clamp((level - from) / (1 - from), 0, 1);
}
