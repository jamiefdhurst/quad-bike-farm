// Faults that develop on a quad over time, separate from wear: a slow puncture, a
// slipping drive belt, a sticking throttle cable, a dirty carb, worn engine mounts (on the chain-driven ones) a stretched drive chain and (on the four-strokes) valve clearances gone out. Each starts
// without warning, gets worse until it's put right at the toolbox, and has a
// symptom you can feel or hear. Pure logic, no Three.js.

import { DEFAULT_SHED_FAULT_PARAMS, SHED_FAULT_RANGES, SHED_KINDS, SHED_WHEEL_KINDS } from './shedFaults.js';

export const DEFAULT_FAULT_PARAMS = {
  ...DEFAULT_SHED_FAULT_PARAMS,
  // How often each one starts, as the average seconds of the right kind of use per fault.
  punctureEvery: 2400, // riding: a thorn from the hedge
  beltEvery: 1800, // riding hard, with the throttle well open
  cableEvery: 7200, // engine running (was 2700: it stuck too often)
  carbEvery: 2400, // engine running
  clutchEvery: 400, // slipping the clutch (at the bite under load, or creeping in low): a worn plate starts after this much slipping
  leakEvery: 6000, // engine running: the intake boot perishing and splitting (diesels have no carb boot, see hasBoot)
  mountsEvery: 5400, // engine running: rubber perishing, so it comes on slower than the rest
  valvesEvery: 4800, // engine running, on a four-stroke: the tappets wearing wide
  chainEvery: 3000, // riding, on a chain-driven quad: the chain stretching (a dry one starts sooner, see chainDryWear)
  // How long each takes to go from just started to as bad as it gets.
  punctureSeconds: 120, // the tyre going flat
  beltSeconds: 300, // of hard riding
  cableSeconds: 600, // running
  carbSeconds: 900, // running
  leakSeconds: 1200, // running: the split opening up from a hiss to a gape
  clutchSeconds: 500, // of slipping it: the plate wearing from a little slip to hardly gripping at all
  mountsSeconds: 1500, // running: the mounts going from sound to shot
  valvesSeconds: 2400, // running: the clearance going from a faint tick to a loud one
  chainSeconds: 900, // of riding: the chain going from just slack to hanging off the sprocket
  chainLubeSeconds: 1500, // of riding for a freshly oiled chain to run dry
  // What they do at their worst.
  puncturePull: 0.09, // radians the bars are pulled towards the flat tyre (half for a rear one)
  punctureDrag: 0.12, // drive lost to a flat tyre's rolling resistance
  beltDriveLoss: 0.8, // drive lost to a fully slipping belt
  clutchDriveLoss: 0.75, // drive lost to a fully worn clutch slipping under full throttle (less on less throttle)
  clutchSlipFrom: 0.2, // how worn the clutch has to be before it slips under power at all: below it, it only wears
  clutchBiteLo: 0.05, // the pedal's clutch bite (0..1) between these two counts as slipping it
  clutchBiteHi: 0.85,
  clutchCreepSpeed: 2, // m/s: at the bite and slower than this in a gear is creeping, which wears it even with no throttle
  clutchLoadThrottle: 0.3, // throttle that counts as loading it when it is slipping
  clutchLoadSlope: 0.05, // or a climb this steep (sine of the angle)
  cableHang: 5, // seconds the throttle takes to come back from open, just before the cable sticks for good
  cableHangFrom: 0.2, // below this the cable's only a little stiff and doesn't hang
  cableHangMin: 0.4, // seconds it takes to come back as it first starts to hang, lengthening from there (faster than linear)
  cableStuckAt: 0.9, // at this level it never comes back: it holds wherever you last opened it until you switch off
  valvesBotchedLevel: 0.5, // how far out a valve clearance set badly at the bench is, on the tight side
  chainDryWear: 2, // extra stretching, and chance of it starting, on a bone dry chain (1 + this)
  chainSlapFrom: 0.3, // slack at which it starts slapping on the chainguard over bumps
  chainSlapBump: 4, // m/s2 of jolt that makes a slack chain slap
  chainSlapGap: 0.35, // seconds between slaps
  chainLash: 0.12, // drive lost to a fully slack chain taking up the lash
  chainJumpFrom: 0.8, // slack at which it can jump the sprocket under power
  chainJumpThrottle: 0.5, // throttle that loads the chain enough to jump it
  chainJumpRate: 0.25, // chance a second of it jumping at full slack with the throttle open
  rodPull: 0.07, // radians the bars are pulled towards a bent track rod's wheel when it is as bent as it gets
  rodToe: 0.14, // radians that front wheel toes out of line, for show
  rimDrag: 0.05, // drive lost to a bent rim at its worst
  rimWobble: 0.09, // radians the bent wheel wobbles from side to side, for show
  proneSpread: 2.5, // each quad is dealt, once a game, how prone it is to each fault and how fast each worsens: from 1/this to this times the rates here
  hardThrottle: 0.6, // throttle that counts as riding hard
  movingSpeed: 2, // m/s over which it counts as being ridden
  fieldFixLevel: 0.12, // what's left of a fault after a rough fix in the yard (the bench does it properly)
  fieldFixCap: 0.28, // and it never gets worse than this, which is just under what Amy notices
  plugFixLevel: 0.07, // what a tyre plug leaves of a puncture: a rubber strip in the hole holds better than a spare tube dropped in at the roadside
  plugFixCap: 0.18, // and it never gets worse than this
};

export const FAULT_PARAM_RANGES = {
  ...SHED_FAULT_RANGES,
  punctureEvery: [60, 20000, 60],
  beltEvery: [60, 20000, 60],
  cableEvery: [60, 20000, 60],
  carbEvery: [60, 20000, 60],
  mountsEvery: [60, 20000, 60],
  leakEvery: [60, 20000, 60],
  clutchEvery: [30, 10000, 30],
  clutchSeconds: [10, 3600, 10],
  clutchDriveLoss: [0, 1, 0.01],
  clutchSlipFrom: [0, 1, 0.05],
  clutchBiteLo: [0, 0.5, 0.01],
  clutchBiteHi: [0.5, 1, 0.01],
  clutchCreepSpeed: [0.2, 6, 0.1],
  clutchLoadThrottle: [0, 1, 0.05],
  clutchLoadSlope: [0, 0.3, 0.01],
  leakSeconds: [10, 3600, 10],
  chainEvery: [60, 20000, 60],
  valvesEvery: [60, 20000, 60],
  valvesSeconds: [10, 7200, 10],
  valvesBotchedLevel: [0, 1, 0.05],
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
  rodPull: [0, 0.3, 0.005],
  rodToe: [0, 0.4, 0.01],
  rimDrag: [0, 0.5, 0.01],
  rimWobble: [0, 0.3, 0.005],
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
  plugFixLevel: [0, 0.5, 0.01],
  plugFixCap: [0, 1, 0.01],
};

export const FAULT_KINDS = ['puncture', 'belt', 'cable', 'carb', 'mounts', 'chain', 'valves', 'rod', 'rim', 'leak', 'clutch', ...SHED_KINDS];

const perKind = (v) => Object.fromEntries(FAULT_KINDS.map((k) => [k, v]));

/** Faults the toolbox can't touch: a rough fix in the yard does nothing, only the bench puts them right. */
export const BENCH_ONLY_KINDS = ['leak', 'clutch', ...SHED_KINDS];

/** Faults that come from a knock (crashDamage.js), not from use: they never start or worsen by themselves, and only the bench puts them right. */
export const CRASH_KINDS = ['rod', 'rim'];

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
    this.rodWheel = -1; // which front wheel has the bent track rod
    this.rimWheel = -1; // which wheel has the bent rim
    this.steerWheels = [0, 1]; // the wheels a track rod can be bent on (set by Quad)
    this.levels = perKind(0); // 0 none, rising to 1 at their worst
    this.started = perKind(false);
    this.caps = perKind(1); // a rough fix leaves it from getting any worse than this
    this.wheelOf = Object.fromEntries(SHED_WHEEL_KINDS.map((k) => [k, -1])); // which wheel the uneven tyre, the dud valve core, the dragging caliper and the bearing are on
    this.hasSump = false; // a petrol four-stroke has a sump to weep from (set by Quad)
    this.tapLoad = 0; // the throttle just now, for a clogged tap starving the carb
    this.cold = 0; // 0..1 how cold the morning is, for the tyres (set by update)
    this.standing = true; // not moving just now
    this.heldThrottle = 0; // what a sticking cable is still holding open
    this.prone = perKind(1); // times as often it starts (see roll)
    this.worsens = perKind(1); // times as fast it gets worse
    this.hasChain = false; // a chain-driven quad (the sport quad, the mini moto, the ATC) can have a stretched chain; the others never
    this.hasBoot = true; // a petrol carb or throttle body has an intake boot to split; a diesel has none (set by Quad)
    this.hasClutch = false; // a manual quad has a clutch plate to wear out; the automatics' belt is the belt fault (set by Quad)
    this.hasValves = false; // a four-stroke can have its valve clearances out; a two-stroke has no valves (set by Quad)
    this.kept = { chainLube: 1, chainOff: false, valveTight: false }; // the chain's oil (1 fresh, 0 bone dry) and whether it has jumped the sprocket, and whether the valves were left too tight rather than worn wide: kept between games
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
    this.pickWheel(kind);
    this.events.push({ type: 'start', kind });
    return true;
  }

  /** A bent rod or rim needs a wheel (the panel and a quad's history start them without a knock). */
  pickWheel(kind) {
    const pool = kind === 'rod' ? this.steerWheels : this.tyreWheels;
    if (kind === 'rod' && this.rodWheel < 0) this.rodWheel = pool[Math.floor(this.random() * pool.length)] ?? 0;
    if (kind === 'rim' && this.rimWheel < 0) this.rimWheel = pool[Math.floor(this.random() * pool.length)] ?? 0;
    if (SHED_WHEEL_KINDS.includes(kind) && this.wheelOf[kind] < 0) this.wheelOf[kind] = this.tyreWheels[Math.floor(this.random() * this.tyreWheels.length)] ?? 0;
  }

  /**
   * A knock bends something (a hit or a landing, see crashDamage.js). A second knock on the same part only makes it worse,
   * and moves it to the wheel that took the worse of the two.
   */
  damage(kind, level, wheel) {
    const worse = !this.started[kind] || level > this.levels[kind];
    this.started[kind] = true;
    this.caps[kind] = 1;
    if (worse) {
      this.levels[kind] = Math.min(1, level);
      if (kind === 'rod') this.rodWheel = wheel;
      else this.rimWheel = wheel;
    }
    this.events.push({ type: 'start', kind });
  }

  /**
   * @param {number} dt
   * @param {object} s
   * @param {boolean} s.running  engine running
   * @param {number} s.speed     m/s over the ground
   * @param {number} s.throttle  0..1
   * @param {number} [s.punctureFactor]  times as likely a puncture starts (bald tyres, tyres.js)
   * @param {number} [s.jolt]    m/s2 of vertical jolt from the ground (for a slack chain slapping)
   * @param {number} [s.clutchSlip]  0..1 how hard the clutch is being slipped just now (clutchSlipping below): that is what wears it
   */
  update(dt, { running, speed, throttle, jolt = 0, clutchSlip = 0, punctureFactor = 1, temperature = 12 }) {
    const p = this.params;
    this.events.length = 0;
    const moving = running && speed > p.movingSpeed;
    const hard = moving && throttle > p.hardThrottle;
    const chance = (every, kind) => 1 - Math.exp((-dt * this.prone[kind]) / every);
    if (moving && !this.started.puncture && this.random() < chance(p.punctureEvery / punctureFactor, 'puncture')) this.begin('puncture');
    if (hard && !this.started.belt && this.random() < chance(p.beltEvery, 'belt')) this.begin('belt');
    if (running && !this.started.cable && this.random() < chance(p.cableEvery, 'cable')) this.begin('cable');
    if (running && !this.started.carb && this.random() < chance(p.carbEvery, 'carb')) this.begin('carb');
    if (running && !this.started.mounts && this.random() < chance(p.mountsEvery, 'mounts')) this.begin('mounts');
    if (this.hasValves && running && !this.started.valves && this.random() < chance(p.valvesEvery, 'valves')) this.begin('valves');
    if (this.hasBoot && running && !this.started.leak && this.random() < chance(p.leakEvery, 'leak')) this.begin('leak');
    if (this.hasClutch && clutchSlip > 0 && !this.started.clutch && this.random() < chance(p.clutchEvery / clutchSlip, 'clutch')) this.begin('clutch');
    const grow = (kind, on, seconds) => {
      if (this.started[kind] && on) this.levels[kind] = Math.min(this.caps[kind], this.levels[kind] + (dt * this.worsens[kind] * (on === true ? 1 : on)) / seconds);
    };
    grow('puncture', true, p.punctureSeconds); // a tyre goes down parked too
    grow('belt', hard, p.beltSeconds);
    grow('cable', running, p.cableSeconds);
    grow('carb', running, p.carbSeconds);
    grow('mounts', running, p.mountsSeconds);
    grow('leak', running, p.leakSeconds);
    grow('clutch', clutchSlip > 0 && clutchSlip, p.clutchSeconds); // only slipping it wears it further
    grow('valves', running && !this.kept.valveTight, p.valvesSeconds); // wearing wide; a clearance set too tight stays as it is
    if (this.hasChain) this.updateChain(dt, { moving, throttle, jolt });
    this.updateShed(dt, { running, moving, throttle, temperature });
  }

  /**
   * The shed's faults (shedFaults.js). The tyres' come on with use, the cold and the standing; the washer's with the engine and the mud; the pit's
   * with the engine and the miles. None has a rough fix, so none is ever put off by a quick job in the yard.
   */
  updateShed(dt, { running, moving, throttle, temperature }) {
    const p = this.params;
    this.tapLoad = running ? throttle : 0;
    this.standing = !moving;
    this.cold = clamp((p.tyreColdBelow - temperature) / Math.max(1, p.tyreColdBelow + 4), 0, 1);
    const chance = (every, kind, scale = 1) => 1 - Math.exp((-dt * this.prone[kind] * scale) / every);
    const roll = (kind, on, every, scale = 1) => {
      if (on && !this.started[kind] && this.random() < chance(every, kind, scale)) this.begin(kind);
    };
    roll('tyreLeak', moving, p.tyreLeakEvery);
    roll('tyreCold', this.cold > 0, p.tyreColdEvery, this.cold);
    roll('tyreUneven', moving, p.tyreUnevenEvery);
    roll('valveCore', true, p.valveCoreEvery);
    roll('carbGum', running && this.prone.carb > 0, p.carbGumEvery);
    roll('tapClog', running, p.tapClogEvery);
    roll('chainGrit', moving && this.hasChain, p.chainGritEvery);
    roll('brakeMud', moving, p.brakeMudEvery);
    roll('exhaustHole', running, p.exhaustHoleEvery);
    roll('gasket', running && this.hasSump, p.gasketEvery);
    roll('caliper', moving, p.caliperEvery);
    roll('bearing', moving, p.bearingEvery);
    const grow = (kind, on, seconds) => {
      if (this.started[kind] && on) this.levels[kind] = Math.min(this.caps[kind], this.levels[kind] + (dt * this.worsens[kind]) / seconds);
    };
    grow('tyreLeak', true, p.tyreLeakSeconds);
    grow('tyreCold', this.cold > 0, p.tyreColdSeconds); // the cold does not worsen it once the day has warmed up
    grow('tyreUneven', moving, p.tyreUnevenSeconds);
    grow('valveCore', true, p.valveCoreSeconds);
    grow('carbGum', running, p.carbGumSeconds);
    grow('tapClog', running, p.tapClogSeconds);
    grow('chainGrit', moving && this.hasChain, p.chainGritSeconds);
    grow('brakeMud', moving, p.brakeMudSeconds);
    grow('exhaustHole', running, p.exhaustHoleSeconds);
    grow('gasket', running && this.hasSump, p.gasketSeconds);
    grow('caliper', moving, p.caliperSeconds);
    grow('bearing', moving, p.bearingSeconds);
    // A warm day lets the cold-morning drop go again by itself: it was only the air.
    if (this.started.tyreCold && this.cold === 0 && this.caps.tyreCold >= 1) this.levels.tyreCold = Math.max(0, this.levels.tyreCold - dt / p.tyreColdSeconds);
    if (this.started.tyreCold && this.cold === 0 && this.levels.tyreCold <= 0) this.started.tyreCold = false;
  }

  /** psi a second to take off every tyre (a slow leak), whether it is ridden or stood. */
  get tyreBleed() {
    return this.started.tyreLeak ? this.params.tyreLeakBleed * this.levels.tyreLeak : 0;
  }

  /** psi a second to take off the one wheel with the dud valve core: it seeps while the vehicle stands, so it is down in the morning. */
  get coreBleed() {
    return this.started.valveCore && this.standing ? this.params.valveCoreBleed * this.levels.valveCore : 0;
  }

  /** How far under stock a tyre cannot be held above, for the whole set: the cold morning's contracted air. */
  get coldDrop() {
    return this.started.tyreCold ? this.params.tyreColdDrop * this.levels.tyreCold : 0;
  }

  /** How far under stock the odd tyre sits (wheelOf.tyreUneven), 0 if none is. */
  get unevenDrop() {
    return this.started.tyreUneven ? this.params.tyreUnevenDrop * this.levels.tyreUneven : 0;
  }

  /** Multiplier on the braking force: caked brakes grab less. */
  get brakeFactor() {
    return 1 - (this.started.brakeMud ? this.params.brakeMudFade * this.levels.brakeMud : 0);
  }

  /** 0..1 how loud a holed silencer is, for the engine (the louder of this and a blown one's; a silencer taken off is still the loudest). */
  get exhaustLeak() {
    return this.started.exhaustHole ? this.params.exhaustHoleLoud * this.levels.exhaustHole : 0;
  }

  /** Sump level to lose in a step, for the weeping gasket (only while the engine runs). */
  gasketLoss(dt, running) {
    return this.hasSump && running && this.started.gasket ? this.params.gasketBleed * this.levels.gasket * dt : 0;
  }

  /** The chain: it oils off as you ride, stretches faster dry, slaps over bumps once slack, and jumps the sprocket when slack and loaded. */
  updateChain(dt, { moving, throttle, jolt }) {
    const p = this.params;
    const grit = this.started.chainGrit ? p.chainGritWear * this.levels.chainGrit : 0; // a gritty chain stretches faster, as a dry one does
    const dry = 1 + p.chainDryWear * (1 - this.kept.chainLube) + grit;
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
    return this.hasChain ? Math.min(1, 1 - this.kept.chainLube + (this.started.chainGrit ? 0.5 * this.levels.chainGrit : 0)) : 0;
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

  /** The side a wheel is on: +1 is the rider's left, as for a flat tyre. */
  sideOf(i) {
    return this.wheelSides?.[i]?.side ?? tyreSide(i);
  }

  /** Radians the bars are pulled by a bent track rod (positive is left): towards the side the bent rod is on. */
  get rodPull() {
    if (!this.started.rod || this.rodWheel < 0) return 0;
    return this.sideOf(this.rodWheel) * this.params.rodPull * this.levels.rod;
  }

  /** Radians that wheel is toed out of line, for show (zero for any other). */
  wheelToe(i) {
    return this.started.rod && i === this.rodWheel ? this.sideOf(i) * this.params.rodToe * this.levels.rod : 0;
  }

  /** Radians that wheel wobbles side to side once a turn, for show (zero for any other). */
  wheelWobble(i) {
    const rim = this.started.rim && i === this.rimWheel ? this.params.rimWobble * this.levels.rim : 0;
    const bearing = this.started.bearing && i === this.wheelOf.bearing ? this.params.bearingWobble * this.levels.bearing : 0;
    return rim + bearing;
  }

  /** Multiplier on the drive force at the wheels. */
  get driveFactor() {
    if (this.kept.chainOff) return 0;
    return (1 - this.params.punctureDrag * this.levels.puncture) * (1 - this.params.beltDriveLoss * this.levels.belt) * (1 - this.params.chainLash * this.levels.chain) * (1 - this.params.rimDrag * this.levels.rim) * this.shedDriveFactor;
  }

  /** What the tap, the silencer, the caliper and the bearing take off the drive between them. */
  get shedDriveFactor() {
    const p = this.params;
    const on = (kind, k) => (this.started[kind] ? k * this.levels[kind] : 0);
    return (1 - on('tapClog', p.tapClogLoss * this.tapLoad)) * (1 - on('exhaustHole', p.exhaustHoleLoss)) * (1 - on('caliper', p.caliperDrag)) * (1 - on('bearing', p.bearingDrag));
  }

  /** 0..1 how badly the belt slips, and how dirty the carb is (for the engine). */
  get slip() {
    return this.levels.belt;
  }

  get dirt() {
    return Math.max(this.levels.carb, this.started.carbGum ? this.params.carbGumDirt * this.levels.carbGum : 0);
  }

  /** 0..1 how badly the intake boot is split, for the engine (it leans out, hunts at idle and pops on the overrun). */
  get airLeak() {
    return this.levels.leak;
  }

  /** 0..1 how worn the clutch plate is, for the manual drivetrain (it slips under power, more the worse it is). */
  get clutchWear() {
    return this.hasClutch ? this.levels.clutch : 0;
  }

  /** 0..1 how loud the tappets tick (valves worn wide), for the engine. */
  get valveLoose() {
    return this.started.valves && !this.kept.valveTight ? this.levels.valves : 0;
  }

  /** 0..1 how far too tight the valves are (set badly at the bench), for the engine. */
  get valveTight() {
    return this.started.valves && this.kept.valveTight ? this.levels.valves : 0;
  }

  /** 0..1 how worn the engine mounts are (for the vibration model). */
  get mountWear() {
    return this.started.mounts ? this.levels.mounts : 0;
  }

  /**
   * Puts one right (pump and patch the tyre, new belt, lubricate the cable, clean the carb). True if there was anything to do.
   * A rough fix, which is all you can do in the yard, leaves a mild fault that never gets much worse; the bench does it properly.
   * A `plug` (a tyre plug in the hole) is a rough fix that leaves a puncture milder still.
   */
  fix(kind, { rough = false, plug = false } = {}) {
    if (!this.started[kind]) return false;
    if (rough && BENCH_ONLY_KINDS.includes(kind)) return false; // a split boot wants a new one
    if (rough && CRASH_KINDS.includes(kind)) return false; // bent metal can't be mended with what's in the toolbox
    if (kind === 'chain') {
      // Put back on the sprocket either way, and given a squirt of oil; only the bench takes the stretch out.
      this.kept.chainOff = false;
      this.kept.chainLube = Math.max(this.kept.chainLube, rough ? 0.6 : 1);
    }
    if (kind === 'valves') this.kept.valveTight = false; // a rough fix (a shim) or the bench both leave it wide, not tight
    if (rough) {
      if (this.caps[kind] < 1) return false; // already patched up as far as it'll go
      const plugged = plug && kind === 'puncture'; // a tyre plug, which only a puncture takes
      this.leave(kind, plugged ? this.params.plugFixLevel : this.params.fieldFixLevel, plugged ? this.params.plugFixCap : this.params.fieldFixCap);
      this.events.push({ type: 'fixed', kind });
      return true;
    }
    this.started[kind] = false;
    this.levels[kind] = 0;
    this.caps[kind] = 1;
    if (kind === 'puncture') this.tyre = -1;
    if (kind === 'rod') this.rodWheel = -1;
    if (kind === 'rim') this.rimWheel = -1;
    if (kind === 'cable') this.heldThrottle = 0;
    if (kind in this.wheelOf) this.wheelOf[kind] = -1;
    this.events.push({ type: 'fixed', kind });
    return true;
  }

  /** Leaves a fault at this level, unable to get worse than `cap`: a botched or rough repair. */
  leave(kind, level, cap = 1) {
    this.started[kind] = true;
    this.levels[kind] = Math.min(level, cap);
    this.caps[kind] = cap;
    if (kind === 'puncture' && this.tyre < 0) this.tyre = this.tyreWheels[Math.floor(this.random() * this.tyreWheels.length)];
    this.pickWheel(kind);
  }
}

/** How a symptom comes across to someone near it, 0..1: below `from` it's too slight to notice. */
export function noticeable(level, from = 0.3) {
  return clamp((level - from) / (1 - from), 0, 1);
}

/**
 * How hard a manual's clutch is being slipped just now, 0..1: in gear with the engine running and the pedal part way up (at the bite),
 * and either loaded (throttle open or climbing) or creeping along in low gear. Fully in or fully out wears nothing. Pure.
 * @param {{gear: number, clutch: number}} d  the manual drivetrain
 */
export function clutchSlipping(d, { running, throttle, slope, speed }, p = DEFAULT_FAULT_PARAMS) {
  if (!running || d.gear === 0 || d.clutch < p.clutchBiteLo || d.clutch > p.clutchBiteHi) return 0;
  const load = Math.max(throttle >= p.clutchLoadThrottle ? throttle : 0, slope >= p.clutchLoadSlope ? clamp(slope / (p.clutchLoadSlope * 3), 0.4, 1) : 0);
  const creep = Math.abs(speed) < p.clutchCreepSpeed && Math.abs(d.gear) <= 2 ? 0.35 : 0;
  // Worst in the middle of the bite, where the plates rub hardest.
  const middle = 1 - Math.abs(d.clutch - (p.clutchBiteLo + p.clutchBiteHi) / 2) / ((p.clutchBiteHi - p.clutchBiteLo) / 2);
  return clamp(Math.max(load, creep) * (0.4 + 0.6 * middle), 0, 1);
}

/** How far a worn clutch slips under power, 0..1: nothing until it is worn past `clutchSlipFrom`, then more with wear and with throttle. */
export function clutchSlipUnderPower(wear, throttle, p = DEFAULT_FAULT_PARAMS) {
  if (wear <= p.clutchSlipFrom) return 0;
  return clamp(((wear - p.clutchSlipFrom) / (1 - p.clutchSlipFrom)) * clamp(throttle * 1.4, 0, 1), 0, 1);
}

/**
 * The shed's faults on a set of tyres, for a step (shedFaults.js): every tyre bleeds a little (a slow leak), the dud valve's wheel bleeds while the vehicle
 * stands, a cold morning puts a ceiling under stock on all four, and the odd tyre sits lower. Pressures are floats here; they only round when pumped.
 */
export function applyTyreFaults(tyres, faults, dt) {
  const stock = tyres.tune.stockPsi;
  const bleed = faults.tyreBleed * dt;
  for (const w of tyres.realWheels) {
    let psi = tyres.psi[w.i] - bleed;
    if (w.i === faults.wheelOf.valveCore) psi -= faults.coreBleed * dt;
    if (faults.coldDrop > 0) psi = Math.min(psi, stock - faults.coldDrop);
    if (faults.unevenDrop > 0 && w.i === faults.wheelOf.tyreUneven) psi = Math.min(psi, stock - faults.unevenDrop);
    tyres.psi[w.i] = Math.max(tyres.P.ventMinPsi, psi);
  }
}
