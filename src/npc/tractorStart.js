// Her having a go at starting the tractor: key on to heat the glow plugs, wait for the lamp (or not, if she's Jess), crank in bursts,
// and give up after a few. A diesel has no tap to check and no choke, so this is a StartingAttempt's little sibling with the same
// face (update, abandon, phase, done, result, starter, events), which HerDrive uses in its place for the tractor. Pure logic.

export const DEFAULT_TRACTOR_START_PARAMS = {
  rushChance: 0.5, // chance she cranks before the glow lamp is lit, on her first go
  burstMin: 2.5, // seconds on the starter each go
  burstMax: 4.5,
  pauseMin: 1.5, // seconds between goes
  pauseMax: 3,
  maxBursts: 5, // then she gives up
  keyDelay: 0.8, // seconds before she turns the key
  settle: 1, // seconds it has to run for before she counts it as started
};

export const TRACTOR_START_PARAM_RANGES = {
  rushChance: [0, 1, 0.05],
  burstMin: [0.5, 8, 0.1],
  burstMax: [0.5, 10, 0.1],
  pauseMin: [0, 6, 0.1],
  pauseMax: [0, 8, 0.1],
  maxBursts: [1, 12, 1],
  keyDelay: [0, 4, 0.1],
  settle: [0, 5, 0.1],
};

export class TractorStartAttempt {
  /** @param {object} quad  Anything with engine (EngineModel). */
  constructor(quad, { random = Math.random, params = DEFAULT_TRACTOR_START_PARAMS } = {}) {
    this.quad = quad;
    this.random = random;
    this.p = params;
    this.phase = 'reach';
    this.timer = params.keyDelay;
    this.bursts = 0;
    this.rushes = this.random() < params.rushChance; // she can't wait for the lamp, the first time
    this.starter = false;
    this.events = []; // 'keyOn', 'glowWait', 'rush', 'crank', 'caught', 'gaveUp'
    this.done = false;
    this.result = null; // 'running' or 'gaveUp'
  }

  between(a, b) {
    return a + this.random() * (b - a);
  }

  abandon() {
    this.starter = false;
    this.done = true;
    this.result ??= 'abandoned';
  }

  finish(result) {
    this.starter = false;
    this.done = true;
    this.result = result;
  }

  /** Advances by dt seconds; sets `starter`. Returns this step's events. */
  update(dt) {
    this.events = [];
    if (this.done) return this.events;
    const { engine } = this.quad;
    const p = this.p;
    this.timer -= dt;

    switch (this.phase) {
      case 'reach':
        if (this.timer > 0) break;
        if (!engine.ignitionOn) engine.setIgnition(true);
        this.events.push('keyOn');
        this.phase = 'glow';
        this.timer = 0;
        break;
      case 'glow':
        // Waiting for the lamp: she cranks regardless if she's the sort who can't wait (once).
        if (engine.isRunning) return this.caught();
        if (engine.glowLamp) return this.startBurst();
        if (!this.waited) {
          this.waited = true;
          this.events.push('glowWait');
        }
        if (this.rushes && this.bursts === 0 && this.timer < -1.2) {
          this.events.push('rush');
          this.startBurst();
        }
        break;
      case 'crank':
        if (engine.isRunning) return this.caught();
        if (this.timer > 0) break;
        this.starter = false;
        if (this.bursts >= p.maxBursts) {
          engine.setIgnition(false);
          this.finish('gaveUp');
          this.events.push('gaveUp');
          break;
        }
        this.phase = 'pause';
        this.timer = this.between(p.pauseMin, p.pauseMax);
        break;
      case 'pause':
        // Having failed once she waits for the lamp, however keen she was.
        this.rushes = false;
        if (this.timer <= 0) {
          if (engine.ignitionOn === false) engine.setIgnition(true);
          this.phase = 'glow';
          this.timer = 0;
        }
        break;
      case 'tending':
        if (!engine.isRunning) {
          // It died on her straight away.
          this.phase = 'pause';
          this.timer = this.between(p.pauseMin, p.pauseMax);
          break;
        }
        if (this.timer <= -p.settle) this.finish('running');
        break;
    }
    return this.events;
  }

  startBurst() {
    this.bursts++;
    this.phase = 'crank';
    this.starter = true;
    this.timer = this.between(this.p.burstMin, this.p.burstMax);
    this.events.push('crank');
    return this.events;
  }

  caught() {
    this.starter = false;
    this.phase = 'tending';
    this.timer = 0;
    this.events.push('caught');
    return this.events;
  }
}
