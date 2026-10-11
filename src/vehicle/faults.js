// Faults that develop on a quad over time, separate from wear: a slow puncture, a
// slipping drive belt, a sticking throttle cable, a dirty carb, worn engine mounts and (on the chain-driven ones) a stretched drive chain. Each starts
// without warning, gets worse until it's put right at the toolbox, and has a
// symptom you can feel or hear. Pure logic, no Three.js.

export const DEFAULT_FAULT_PARAMS = {
  // How often each one starts, as the average seconds of the right kind of use per fault.
  punctureEvery: 2400, // riding: a thorn from the hedge
  beltEvery: 1800, // riding hard, with the throttle well open
  cableEvery: 7200, // engine running (was 2700: it stuck too often)
  carbEvery: 2400, // engine running
  mountsEvery: 5400, // engine running: rubber perishing, so it comes on slower than the rest
  chainEvery: 3000, // riding, on a chain-driven quad: the chain stretching (a dry one starts sooner, see chainDryWear)
  // How long each takes to go from just started to as bad as it gets.
  punctureSeconds: 120, // the tyre going flat
  beltSeconds: 300, // of hard riding
  cableSeconds: 600, // running
  carbSeconds: 900, // running
  mountsSeconds: 1500, // running: the mounts going from sound to shot
  chainSeconds: 900, // of riding: the chain going from just slack to hanging off the sprocket
  chainLubeSeconds: 1500, // of riding for a freshly oiled chain to run dry
  // What they do at their worst.
  puncturePull: 0.09, // radians the bars are pulled towards the flat tyre (half for a rear one)
  punctureDrag: 0.12, // drive lost to a flat tyre's rolling resistance
  beltDriveLoss: 0.8, // drive lost to a fully slipping belt
  cableHang: 5, // seconds the throttle takes to come back from open, just before the cable sticks for good
  cableHangFrom: 0.2, // below this the cable's only a little stiff and doesn't hang
  cableHangMin: 0.4, // seconds it takes to come back as it first starts to hang, lengthening from there (faster than linear)
  cableStuckAt: 0.9, // at this level it never comes back: it holds wherever you last opened it until you switch off
  chainDryWear: 2, // extra stretching, and chance of it starting, on a bone dry chain (1 + this)
  chainSlapFrom: 0.3, // slack at which it starts slapping on the chainguard over bumps
  chainSlapBump: 4, // m/s2 of jolt that makes a slack chain slap
  chainSlapGap: 0.35, // seconds between slaps
  chainLash: 0.12, // drive lost to a fully slack chain taking up the lash
  chainJumpFrom: 0.8, // slack at which it can jump the sprocket under power
  chainJumpThrottle: 0.5, // throttle that loads the chain enough to jump it
  chainJumpRate: 0.25, // chance a second of it jumping at full slack with the throttle open
  proneSpread: 2.5, // each quad is dealt, once a game, how prone it is to each fault and how fast each worsens: from 1/this to this times the rates here
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
  mountsEvery: [60, 20000, 60],
  chainEvery: [60, 20000, 60],
  punctureSeconds: [10, 1200, 10],
  beltSeconds: [10, 1800, 10],
  cableSeconds: [10, 1800, 10],
  carbSeconds: [10, 3600, 10],
  mountsSeconds: [10, 3600, 10],
  chainSeconds: [10, 3600, 10],
  chainLubeSeconds: [60, 7200, 60],
  chainDryWear: [0, 6, 0.1],
  chainSlapFrom: [0, 1, 0.05],
  chainSlapBump: [0.5, 20, 0.5],
  chainSlapGap: [0.05, 2, 0.05],
  chainLash: [0, 0.6, 0.01],
  chainJumpFrom: [0.3, 1, 0.05],
  chainJumpThrottle: [0.1, 1, 0.05],
  chainJumpRate: [0, 2, 0.05],
  puncturePull: [0, 0.3, 0.005],
  punctureDrag: [0, 0.5, 0.01],
  beltDriveLoss: [0, 1, 0.01],
  cableHang: [0, 15, 0.5],
  cableHangFrom: [0, 1, 0.05],
  cableHangMin: [0, 5, 0.1],
  cableStuckAt: [0.3, 1, 0.01],
  proneSpread: [1, 6, 0.1],
  hardThrottle: [0.1, 1, 0.05],
  movingSpeed: [0.5, 10, 0.5],
  fieldFixLevel: [0, 0.5, 0.01],
  fieldFixCap: [0, 1, 0.01],
};

export const FAULT_KINDS = ['puncture', 'belt', 'cable', 'carb', 'mounts', 'chain'];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Which side a flat tyre pulls to: wheels 0 and 2 are on the rider's left (steering positive), 1 and 3 on the right. */
export const tyreSide = (i) => (i % 2 === 0 ? 1 : -1);
export const tyreIsFront = (i) => i < 2;

export class Faults {
  constructor(params = { ...DEFAULT_FAULT_PARAMS }, random = Math.random) {
    this.params = params;
    this.random = random;
    this.tyre = -1; // which wheel has the puncture
    this.tyreWheels = [0, 1, 2, 3]; // the wheels one can land on (the mini moto's outriggers can't go flat)
    this.wheelSides = null; // per wheel { side, front } when the layout isn't a plain four-wheeler's (set by Quad)
    this.levels = { puncture: 0, belt: 0, cable: 0, carb: 0, mounts: 0, chain: 0 }; // 0 none, rising to 1 at their worst
    this.started = { puncture: false, belt: false, cable: false, carb: false, mounts: false, chain: false };
    this.caps = { puncture: 1, belt: 1, cable: 1, carb: 1, mounts: 1, chain: 1 }; // a rough fix leaves it from getting any worse than this
    this.heldThrottle = 0; // what a sticking cable is still holding open
    this.prone = { puncture: 1, belt: 1, cable: 1, carb: 1, mounts: 1, chain: 1 }; // times as often it starts (see roll)
    this.worsens = { puncture: 1, belt: 1, cable: 1, carb: 1, mounts: 1, chain: 1 }; // times as fast it gets worse
    this.hasChain = false; // a chain-driven quad (the sport quad, the mini moto, the ATC) can have a stretched chain; the others never
    this.kept = { chainLube: 1, chainOff: false }; // the chain's oil (1 fresh, 0 bone dry) and whether it has jumped the sprocket: kept between games
    this.slapped = 0; // 0..1 how hard the slack chain just slapped; take it with takeSlap()
    this.slapGap = 0;
    this.jumpHeard = false; // the chain has just come off; take it with takeJump()
    this.lastJolt = 0; // m/s2 of vertical jolt this step, for the slap (set by update)
    this.events = []; // { type: 'start' | 'fixed' | 'jump', kind } this step
  }

  /**
   * Deals this quad its own luck for the game, from `random` (so a seed repeats it): for each fault, how prone it is
   * (times as often it starts) and how fast it worsens, each between 1/proneSpread and proneSpread times the usual,
   * evenly on a log scale, so one quad can be belt-prone and slow to puncture and another the reverse.
   */
  roll(random) {
    const k = Math.log(this.params.proneSpread);
    const deal = () => Math.exp((random() * 2 - 1) * k);
    for (const kind of FAULT_KINDS) {
      this.prone[kind] = deal();
      this.worsens[kind] = deal();
    }
    this.random = random;
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
    if (kind === 'puncture') this.tyre = this.tyreWheels[Math.floor(this.random() * this.tyreWheels.length)];
    this.events.push({ type: 'start', kind });
    return true;
  }

  /**
   * @param {number} dt
   * @param {object} s
   * @param {boolean} s.running  engine running
   * @param {number} s.speed     m/s over the ground
   * @param {number} s.throttle  0..1
   * @param {number} [s.jolt]    m/s2 of vertical jolt from the ground (for a slack chain slapping)
   */
  update(dt, { running, speed, throttle, jolt = 0 }) {
    const p = this.params;
    this.events.length = 0;
    const moving = running && speed > p.movingSpeed;
    const hard = moving && throttle > p.hardThrottle;
    const chance = (every, kind) => 1 - Math.exp((-dt * this.prone[kind]) / every);
    if (moving && !this.started.puncture && this.random() < chance(p.punctureEvery, 'puncture')) this.begin('puncture');
    if (hard && !this.started.belt && this.random() < chance(p.beltEvery, 'belt')) this.begin('belt');
    if (running && !this.started.cable && this.random() < chance(p.cableEvery, 'cable')) this.begin('cable');
    if (running && !this.started.carb && this.random() < chance(p.carbEvery, 'carb')) this.begin('carb');
    if (running && !this.started.mounts && this.random() < chance(p.mountsEvery, 'mounts')) this.begin('mounts');
    const grow = (kind, on, seconds) => {
      if (this.started[kind] && on) this.levels[kind] = Math.min(this.caps[kind], this.levels[kind] + (dt * this.worsens[kind]) / seconds);
    };
    grow('puncture', true, p.punctureSeconds); // a tyre goes down parked too
    grow('belt', hard, p.beltSeconds);
    grow('cable', running, p.cableSeconds);
    grow('carb', running, p.carbSeconds);
    grow('mounts', running, p.mountsSeconds);
    if (this.hasChain) this.updateChain(dt, { moving, throttle, jolt });
  }

  /** The chain: it oils off as you ride, stretches faster dry, slaps over bumps once slack, and jumps the sprocket when slack and loaded. */
  updateChain(dt, { moving, throttle, jolt }) {
    const p = this.params;
    const dry = 1 + p.chainDryWear * (1 - this.kept.chainLube);
    if (moving) {
      this.kept.chainLube = Math.max(0, this.kept.chainLube - dt / p.chainLubeSeconds);
      if (!this.started.chain && this.random() < 1 - Math.exp((-dt * this.prone.chain * dry) / p.chainEvery)) this.begin('chain');
      if (this.started.chain) this.levels.chain = Math.min(this.caps.chain, this.levels.chain + (dt * this.worsens.chain * dry) / p.chainSeconds);
    }
    this.slapGap = Math.max(0, this.slapGap - dt);
    const level = this.started.chain ? this.levels.chain : 0;
    if (moving && !this.kept.chainOff && level >= p.chainSlapFrom && jolt > p.chainSlapBump && this.slapGap <= 0) {
      this.slapped = noticeable(level, p.chainSlapFrom * 0.5);
      this.slapGap = p.chainSlapGap;
    }
    if (!this.kept.chainOff && level >= p.chainJumpFrom && throttle > p.chainJumpThrottle) {
      const rate = (p.chainJumpRate * (level - p.chainJumpFrom)) / Math.max(0.01, 1 - p.chainJumpFrom);
      if (this.random() < 1 - Math.exp(-dt * rate)) {
        this.kept.chainOff = true;
        this.jumpHeard = true;
        this.events.push({ type: 'jump', kind: 'chain' });
      }
    }
  }

  /** How hard the chain slapped since last asked (0 if it didn't), for the sound. */
  takeSlap() {
    const s = this.slapped;
    this.slapped = 0;
    return s;
  }

  /** True once after the chain jumps the sprocket, for the clunk. */
  takeJump() {
    const j = this.jumpHeard;
    this.jumpHeard = false;
    return j;
  }

  /** The chain has come off the sprocket: the engine turns and nothing drives the wheels until it is put back. */
  get chainOff() {
    return this.kept.chainOff;
  }

  /** A dry chain squeaks and rattles; 0 fresh, 1 bone dry (only means anything on a chain-driven quad). */
  get chainDryness() {
    return this.hasChain ? 1 - this.kept.chainLube : 0;
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
    const w = this.wheelSides?.[this.tyre];
    const side = w ? w.side : tyreSide(this.tyre);
    const front = w ? w.front : tyreIsFront(this.tyre);
    return side * (front ? 1 : 0.5) * this.params.puncturePull * this.levels.puncture;
  }

  /** Multiplier on the drive force at the wheels. */
  get driveFactor() {
    if (this.kept.chainOff) return 0;
    return (1 - this.params.punctureDrag * this.levels.puncture) * (1 - this.params.beltDriveLoss * this.levels.belt) * (1 - this.params.chainLash * this.levels.chain);
  }

  /** 0..1 how badly the belt slips, and how dirty the carb is (for the engine). */
  get slip() {
    return this.levels.belt;
  }

  get dirt() {
    return this.levels.carb;
  }

  /** 0..1 how worn the engine mounts are (for the vibration model). */
  get mountWear() {
    return this.started.mounts ? this.levels.mounts : 0;
  }

  /**
   * Puts one right (pump and patch the tyre, new belt, lubricate the cable, clean the carb). True if there was anything to do.
   * A rough fix, which is all you can do in the yard, leaves a mild fault that never gets much worse; the bench does it properly.
   */
  fix(kind, { rough = false } = {}) {
    if (!this.started[kind]) return false;
    if (kind === 'chain') {
      // Put back on the sprocket either way, and given a squirt of oil; only the bench takes the stretch out.
      this.kept.chainOff = false;
      this.kept.chainLube = Math.max(this.kept.chainLube, rough ? 0.6 : 1);
    }
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
    if (kind === 'puncture' && this.tyre < 0) this.tyre = this.tyreWheels[Math.floor(this.random() * this.tyreWheels.length)];
  }
}

/** How a symptom comes across to someone near it, 0..1: below `from` it's too slight to notice. */
export function noticeable(level, from = 0.3) {
  return clamp((level - from) / (1 - from), 0, 1);
}
