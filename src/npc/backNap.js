// Asleep on the back. On a long smooth ride (steady speed, no hard braking, a quad with a low even beat) the girl on the pillion
// seat grows drowsy, her head drops onto your shoulder and her grip goes slack. A pothole, a hard brake or a rough engine wakes
// her with a start. Pure logic: the game says how the ride is going, this says how drowsy she is and when she wakes.

export const DEFAULT_NAP_PARAMS = {
  minSpeed: 3, // m/s: a steady ride, not a crawl or a stand
  maxSpeed: 14, // m/s: too quick to doze through
  calmAccel: 1.2, // m/s^2: speeding up or slowing down more than this isn't steady
  calmJolt: 3, // m/s^2: the seat's vertical jerk (smoothed) above which the road is too bumpy to nod off on
  calmShake: 0.8, // how hard the seat shakes her (the voice's level: cm of heave plus degrees of pitch and roll) she can doze through
  dropSeconds: 45, // seconds of calm ride for a girl of average sleepiness to go from alert to asleep
  sleepyShare: 0.6, // how much her sleepiness need (0..1) speeds it up: 1 plus this at fully sleepy
  fallBack: 2, // times faster drowsiness drains in a rough patch than it builds
  wakeBrake: 4.5, // m/s^2: braking harder than this wakes her
  wakeJolt: 9, // m/s^2: a bump this hard wakes her
  wakeShake: 2, // shake level that wakes her, a rough engine
  stopWake: 3, // seconds stood still, or with the engine off, before she wakes by herself
  nodAt: 0.4, // drowsiness at which her head starts to droop
  easeIn: 1.2, // seconds her head takes to settle on your shoulder
  easeOut: 0.35, // seconds she takes to snap upright when woken
  gap: 120, // seconds after waking before she can drop off again
  boldWake: 1, // wake with a start (a flinch); 0 wakes quietly
};

export const NAP_PARAM_RANGES = {
  minSpeed: [0, 10, 0.5],
  maxSpeed: [2, 30, 0.5],
  calmAccel: [0.1, 5, 0.1],
  calmJolt: [0.5, 20, 0.5],
  calmShake: [0.1, 5, 0.1],
  dropSeconds: [5, 300, 5],
  sleepyShare: [0, 3, 0.05],
  fallBack: [0.5, 10, 0.5],
  wakeBrake: [1, 15, 0.5],
  wakeJolt: [2, 40, 0.5],
  wakeShake: [0.5, 8, 0.1],
  stopWake: [0.5, 20, 0.5],
  nodAt: [0, 0.95, 0.05],
  easeIn: [0.2, 6, 0.1],
  easeOut: [0.1, 3, 0.05],
  gap: [0, 600, 10],
  boldWake: [0, 1, 1],
};

/** One girl's drowsiness on the back of a quad. The game keeps one for each girl. */
export class BackNap {
  constructor(params = { ...DEFAULT_NAP_PARAMS }) {
    this.p = params;
    this.drowse = 0; // 0 alert .. 1 asleep
    this.asleep = false;
    this.depth = 0; // 0..1: how far her head has gone onto your shoulder, eased (for the pose)
    this.rest = 0; // seconds until she might drop off again
    this.stopped = 0; // seconds with the quad still while she sleeps
    this.side = 1; // which shoulder (1 her left, -1 her right)
    this.forced = false; // told to drop off at once (the debug panel)
  }

  /** Drops off now, if she's on the back (the debug panel); the next update finds the ride calm enough or wakes her. */
  force() {
    this.forced = true;
    this.rest = 0;
  }

  /** Wakes her: 'gentle' (you spoke to her, or the ride stopped) or 'start' (a bump, a brake, a rough engine). Returns the event. */
  wake(how) {
    if (!this.asleep) return null;
    this.asleep = false;
    this.drowse = 0;
    this.stopped = 0;
    this.rest = this.p.gap;
    return { type: 'wake', how };
  }

  /**
   * One step. `ctx`: { onBack (sat on the pillion seat of a quad you're riding), riding (you at the controls, engine running),
   * speed, accel (smoothed along the nose, signed), jolt (smoothed vertical, abs), shake, sleepy (her sleepiness need 0..1),
   * prone (her own tendency, 1 average) }. Returns events: { type: 'asleep' } and { type: 'wake', how }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.rest = Math.max(0, this.rest - dt);
    const ease = (to, seconds) => {
      this.depth += (to - this.depth) * Math.min(1, dt / Math.max(0.05, seconds));
      if (Math.abs(to - this.depth) < 0.003) this.depth = to;
    };
    if (!ctx.onBack) {
      // Got off (or the ride ended): nothing is left of it.
      this.drowse = 0;
      this.asleep = false;
      this.stopped = 0;
      this.forced = false;
      ease(0, p.easeOut);
      return events;
    }
    const moving = ctx.riding && ctx.speed >= p.minSpeed && ctx.speed <= p.maxSpeed;
    const steady = moving && Math.abs(ctx.accel) < p.calmAccel;
    const calm = steady && ctx.jolt < p.calmJolt && ctx.shake < p.calmShake;

    if (this.asleep) {
      const rough = ctx.shake >= p.wakeShake;
      if (-ctx.accel >= p.wakeBrake) events.push(this.wake('brake'));
      else if (ctx.jolt >= p.wakeJolt) events.push(this.wake('jolt'));
      else if (ctx.riding && rough) events.push(this.wake('rough'));
      else {
        this.stopped = !ctx.riding || ctx.speed < 0.5 ? this.stopped + dt : 0;
        if (this.stopped >= p.stopWake) events.push(this.wake('stop'));
      }
    } else if (this.rest <= 0 && (calm || this.forced)) {
      const sleepy = Math.min(1, Math.max(0, ctx.sleepy ?? 0));
      const rate = (1 + p.sleepyShare * sleepy) * (ctx.prone ?? 1) / p.dropSeconds;
      this.drowse = this.forced ? 1 : Math.min(1, this.drowse + rate * dt);
      if (this.drowse >= 1) {
        this.asleep = true;
        this.forced = false;
        this.stopped = 0;
        events.push({ type: 'asleep' });
      }
    } else {
      this.drowse = Math.max(0, this.drowse - (dt * p.fallBack) / p.dropSeconds);
      if (!ctx.riding) this.forced = false;
    }

    // Her head follows: it droops once she's nodding and goes right down when she's asleep.
    const want = this.asleep ? 1 : this.drowse >= p.nodAt ? Math.min(0.6, ((this.drowse - p.nodAt) / (1 - p.nodAt)) * 0.6) : 0;
    ease(want, want > this.depth ? p.easeIn : p.easeOut);
    return events.filter(Boolean);
  }
}
