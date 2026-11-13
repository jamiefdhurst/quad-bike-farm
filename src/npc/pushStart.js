// A girl pushing a vehicle with a flat battery so you can bump-start it: she leans on the back, gets it rolling to a walking pace and
// shouts when it is fast enough to drop the clutch (Jess shouts, and her shove is the harder; Amy says it more quietly and tires sooner).
// Only the vehicle's speed and the engine are read, so it is pure and tested in tests/pushStart.test.js. It gives the game the
// acceleration to push with (`accel`, m/s2 along the vehicle's heading) and the events to speak ('start', 'now', 'caught', 'tired').

export const DEFAULT_PUSH_PARAMS = {
  force: 520, // N of push, Jess; Amy pushes at `amyShare` of it
  amyShare: 0.8,
  minAccel: 0.45, // m/s2: even a Tor or Crag moves, slowly
  maxAccel: 2.2, // m/s2: a light quad is not flung
  topSpeed: 3.4, // m/s: she walks it up to this, no faster
  shoutSpeed: 2.2, // m/s: fast enough that she shouts for you to let the clutch out
  shoutEvery: 3.5, // s between shouts if you haven't
  startDelay: 0.6, // s leaning in before the first shove
  jessTime: 16, // s before she has had enough...
  amyTime: 10, // ...Amy sooner
  settle: 1.5, // s it has to keep running before she lets go
  maxDistance: 45, // m she will push it
};

export const PUSH_PARAM_RANGES = {
  force: [100, 1500, 10],
  amyShare: [0.2, 1.5, 0.05],
  minAccel: [0.1, 2, 0.05],
  maxAccel: [0.5, 5, 0.1],
  topSpeed: [1, 8, 0.1],
  shoutSpeed: [0.5, 6, 0.1],
  shoutEvery: [1, 10, 0.5],
  startDelay: [0, 3, 0.1],
  jessTime: [3, 60, 1],
  amyTime: [3, 60, 1],
  settle: [0, 6, 0.1],
  maxDistance: [5, 150, 1],
};

/** The acceleration a push of `force` newtons gives a vehicle of `mass` kg, between the limits. */
export function pushAccel(force, mass, p = DEFAULT_PUSH_PARAMS) {
  return Math.min(p.maxAccel, Math.max(p.minAccel, force / Math.max(1, mass)));
}

export class PushStart {
  /** @param {object} quad  engine, forwardSpeed, rider. @param {string} who 'amy' or 'jess'. @param {number} mass kg */
  constructor(quad, who, mass, { random = Math.random, params = DEFAULT_PUSH_PARAMS, skill = 0.5 } = {}) {
    this.quad = quad;
    this.p = params;
    this.random = random;
    this.jess = who === 'jess';
    // How well she knows it (her bumpStart skill): 0.5 is as she always pushed, a novice shoves at half strength and tires in half the time.
    this.effort = Math.min(1.5, Math.max(0.5, 0.5 + skill));
    const force = params.force * (this.jess ? 1 : params.amyShare) * this.effort;
    this.thrust = pushAccel(force, mass, params);
    this.time = 0;
    this.travelled = 0;
    this.accel = 0; // what the game pushes with this frame
    this.pushing = false; // for her pose
    this.shouted = 0; // how many times she has said "now"
    this.shoutIn = 0;
    this.keptRunning = 0;
    this.events = [];
    this.done = false;
    this.result = null; // 'running', 'tired' or 'abandoned'
  }

  finish(result) {
    this.done = true;
    this.accel = 0;
    this.pushing = false;
    this.result = result;
  }

  /** Stops, e.g. because you have got off. */
  abandon() {
    this.finish(this.quad.engine.isRunning ? 'running' : 'abandoned');
  }

  /** Advances by dt seconds. Returns this step's events. */
  update(dt) {
    this.events = [];
    this.accel = 0;
    if (this.done) return this.events;
    const p = this.p;
    const speed = this.quad.forwardSpeed;
    this.time += dt;
    this.travelled += Math.max(0, speed) * dt;
    if (this.time === dt) this.events.push('start');

    if (this.quad.engine.isRunning) {
      if (!this.caught) {
        this.caught = true;
        this.events.push('caught');
      }
      this.pushing = false;
      this.keptRunning += dt;
      if (this.keptRunning >= p.settle) this.finish('running');
      return this.events;
    }
    if (this.time > (this.jess ? p.jessTime : p.amyTime) * this.effort || this.travelled > p.maxDistance) {
      this.events.push('tired');
      this.finish('tired');
      return this.events;
    }
    this.pushing = this.time >= p.startDelay;
    // She turns the key on if you haven't: nothing fires without it, and the battery doesn't matter.
    if (this.pushing && !this.quad.engine.ignitionOn) this.quad.engine.setIgnition(true);
    if (this.pushing && speed < p.topSpeed) this.accel = this.thrust;

    // At a pace the wheels can turn it over at she tells you to let the clutch out, and again if you don't.
    this.shoutIn -= dt;
    if (speed >= p.shoutSpeed && this.shoutIn <= 0) {
      this.events.push('now');
      this.shouted++;
      this.shoutIn = p.shoutEvery;
    }
    return this.events;
  }
}
