// A girl swinging the Land Rover's starting handle because the battery is flat: key on, choke if it is cold, then swing after swing
// (hold the handle, let go to turn it over) until it catches or she has had enough. Jess holds it with her thumb round the handle and
// now and then gets kicked back, which stops her for a few seconds; Amy keeps her thumb alongside her fingers and never does. Pure
// logic with the same face as the other start attempts (update, abandon, done, result, events); it drives `quad.helperPull`, which the
// Land Rover turns into the engine's pull (vehicle/quad.js, crankHandle.js). Tested in tests/crankAttempt.test.js.

export const DEFAULT_CRANK_ATTEMPT_PARAMS = {
  keyDelay: 0.8, // seconds before she turns the key
  coldChoke: 0.8, // chance she puts the choke on from cold
  holdMin: 0.4, // seconds she holds the handle before a swing: a proper one is between these...
  holdMax: 0.8,
  sloppyChance: 0.25, // ...except now and then (Jess) when she lets go too soon or too late
  wait: 1.2, // seconds she waits to see after a swing
  maxSwings: 10, // then she gives up (a swing turns it over for under a second, so it takes several)
  settle: 1, // seconds it has to run for before she counts it as started
};

export const CRANK_ATTEMPT_PARAM_RANGES = {
  keyDelay: [0, 4, 0.1],
  coldChoke: [0, 1, 0.05],
  holdMin: [0.1, 2, 0.05],
  holdMax: [0.1, 2, 0.05],
  sloppyChance: [0, 1, 0.05],
  wait: [0.2, 6, 0.1],
  maxSwings: [1, 15, 1],
  settle: [0, 5, 0.1],
};

export class CrankAttempt {
  /** @param {object} quad  The Land Rover's quad: engine, crank (CrankHandle), choke, helperPull, helperGrip. @param {string} who 'amy' or 'jess' */
  constructor(quad, who, { random = Math.random, params = DEFAULT_CRANK_ATTEMPT_PARAMS } = {}) {
    this.quad = quad;
    this.random = random;
    this.p = params;
    this.jess = who === 'jess';
    this.phase = 'reach';
    this.timer = params.keyDelay;
    this.swings = 0;
    this.holding = false;
    this.events = []; // 'keyOn', 'swing', 'kick', 'caught', 'gaveUp'
    this.done = false;
    this.result = null; // 'running' or 'gaveUp'
    quad.helperGrip = this.jess ? 'round' : 'along';
  }

  between(a, b) {
    return a + this.random() * (b - a);
  }

  finish(result) {
    this.quad.helperPull = false;
    this.done = true;
    this.result = result;
  }

  /** Stops whatever she's doing, e.g. because you've got on. */
  abandon() {
    this.finish(this.quad.engine.isRunning ? 'running' : 'gaveUp');
  }

  /** The handle is turning over right now: for her arms. */
  get turning() {
    return this.quad.engine.pullLeft > 0;
  }

  /** Advances by dt seconds. Returns this step's events. */
  update(dt) {
    this.events = [];
    if (this.done) return this.events;
    const { engine, crank } = this.quad;
    const p = this.p;
    this.timer -= dt;
    if (engine.isRunning && this.phase !== 'tending') {
      this.quad.helperPull = false;
      this.phase = 'tending';
      this.timer = p.settle;
      this.events.push('caught');
      return this.events;
    }
    switch (this.phase) {
      case 'reach':
        if (this.timer > 0) break;
        if (!engine.ignitionOn) engine.setIgnition(true);
        this.events.push('keyOn');
        if (engine.temperature < 0.5 && this.random() < p.coldChoke) this.quad.choke = 1;
        this.beginHold();
        break;
      case 'hold':
        // Holding the handle; letting go is the swing.
        if (this.timer > 0) break;
        this.quad.helperPull = false;
        this.holding = false;
        this.swings++;
        if (this.swings === 1) this.events.push('swing');
        this.phase = 'wait';
        this.timer = p.wait;
        break;
      case 'wait':
        // A kick-back has hurt her hand: nothing more until it has stopped hurting.
        if (crank && !crank.ready) {
          if (!this.kicked) {
            this.kicked = true;
            this.events.push('kick');
          }
          break;
        }
        this.kicked = false;
        if (this.timer > 0) break;
        if (this.swings >= p.maxSwings) {
          engine.setIgnition(false);
          this.finish('gaveUp');
          this.events.push('gaveUp');
          break;
        }
        this.beginHold();
        break;
      case 'tending':
        if (!engine.isRunning) {
          this.phase = 'wait';
          this.timer = p.wait;
        } else if (this.timer <= 0) {
          this.quad.choke = Math.min(this.quad.choke, engine.temperature > 0.4 ? 0 : 0.3); // off once it will run without
          this.finish('running');
        }
        break;
    }
    return this.events;
  }

  beginHold() {
    const p = this.p;
    this.phase = 'hold';
    this.holding = true;
    this.timer = this.jess && this.random() < p.sloppyChance ? (this.random() < 0.5 ? this.between(0.1, p.holdMin * 0.7) : this.between(p.holdMax * 1.6, p.holdMax * 2.2)) : this.between(p.holdMin, p.holdMax);
    this.quad.helperPull = true;
  }
}
