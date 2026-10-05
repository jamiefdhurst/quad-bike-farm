// Her having a go at starting a quad. She's not a mechanic: she usually
// remembers the fuel tap and the choke, but not always, cranks in bursts like a
// person, and gives up after a few goes. Once it's running she eases the choke
// off as it warms until someone takes over. Pure logic: it reads the engine and
// fuel state and sets the controls a person beside the bike would.

export const DEFAULT_STARTING_PARAMS = {
  tapCheckChance: 0.75, // she checks the fuel tap before cranking
  coldChokeChance: 0.8, // from cold she puts the choke on
  warmChokeChance: 0.15, // when it's already warm she puts it on anyway
  rememberChance: 0.55, // after a failed go, she remembers what she forgot
  burstMin: 2.2, // seconds on the starter each go
  burstMax: 4,
  pauseMin: 1.5, // seconds between goes
  pauseMax: 3,
  maxBursts: 4, // then she gives up
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class StartingAttempt {
  /**
   * @param {object} quad  Anything with engine (EngineModel), fuel (FuelSystem) and choke.
   */
  constructor(quad, { random = Math.random, params = DEFAULT_STARTING_PARAMS } = {}) {
    this.quad = quad;
    this.random = random;
    this.p = params;
    this.phase = 'reach';
    this.timer = 0.8;
    this.bursts = 0;
    this.checkedTap = false;
    this.starter = false;
    this.events = []; // what she did this step, for her voice: 'tapOn', 'chokeOn', 'crank', 'remembered', 'caught', 'gaveUp'
    this.done = false;
    this.result = null; // 'running' or 'gaveUp'
  }

  between(a, b) {
    return a + this.random() * (b - a);
  }

  /** Advances by dt seconds; sets the quad's controls. Returns this.events for this step. */
  update(dt) {
    this.events = [];
    if (this.done) return this.events;
    const { engine, fuel } = this.quad;
    const p = this.p;
    this.timer -= dt;

    switch (this.phase) {
      case 'reach':
        // Key on, then the tap and the choke, as she remembers them.
        if (this.timer > 0) break;
        if (!engine.ignitionOn) engine.setIgnition(true);
        if (fuel.tap !== 'on' && fuel.tap !== 'reserve' && this.random() < p.tapCheckChance) {
          fuel.tap = 'on';
          this.checkedTap = true;
          this.events.push('tapOn');
        }
        if (this.random() < (engine.temperature < 0.5 ? p.coldChokeChance : p.warmChokeChance)) {
          this.quad.choke = 1;
          this.events.push('chokeOn');
        }
        this.startBurst();
        break;
      case 'crank':
        if (engine.isRunning) {
          this.starter = false;
          this.phase = 'tending';
          this.events.push('caught');
          break;
        }
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
        this.rethink();
        break;
      case 'pause':
        if (this.timer <= 0) this.startBurst();
        break;
      case 'tending':
        // Ease the choke off as it warms, keeping it a little rich, until it's warm.
        if (!engine.isRunning) {
          // It died on her: have another go if she has goes left.
          if (this.bursts < p.maxBursts) {
            this.phase = 'pause';
            this.timer = this.between(p.pauseMin, p.pauseMax);
          } else {
            this.finish('gaveUp');
            this.events.push('gaveUp');
          }
          break;
        }
        const want = engine.temperature > 0.9 ? 0 : 1.15 - engine.temperature;
        this.quad.choke = Math.round(clamp(want, 0, this.quad.choke) * 10) / 10;
        if (engine.temperature > 0.95 && this.quad.choke === 0) this.finish('running');
        break;
    }
    return this.events;
  }

  startBurst() {
    this.phase = 'crank';
    this.timer = this.between(this.p.burstMin, this.p.burstMax);
    this.bursts++;
    this.starter = true;
    this.events.push('crank');
  }

  /** Between goes: maybe it's the tap, maybe it wants choke, maybe it has too much. */
  rethink() {
    const { engine, fuel } = this.quad;
    const p = this.p;
    if (this.random() >= p.rememberChance) return;
    if (fuel.tap === 'off' && !this.checkedTap) {
      fuel.tap = 'on';
      this.checkedTap = true;
      this.events.push('remembered', 'tapOn');
    } else if (engine.temperature < 0.5 && this.quad.choke < 0.5) {
      this.quad.choke = 1;
      this.events.push('remembered', 'chokeOn');
    } else if (engine.temperature >= 0.5 && this.quad.choke > 0.5) {
      this.quad.choke = 0;
      this.events.push('remembered');
    }
  }

  finish(result) {
    this.starter = false;
    this.done = true;
    this.result = result;
  }

  /** Stops whatever she's doing, e.g. because you've got on. */
  abandon() {
    this.finish(this.quad.engine.isRunning ? 'running' : 'gaveUp');
  }
}
