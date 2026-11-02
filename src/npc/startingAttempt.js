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
  pullWhenFlat: 0, // chance that on a flat battery she has a go at the pull-start (if it has one) instead of giving up
  maxPulls: 5, // yanks on the cord before she gives up
  pullHoldMin: 0.3, // seconds she holds the cord before a yank: anywhere from here...
  pullHoldMax: 1.4, // ...to here, so only some are proper ones
  pullWait: 2, // seconds between yanks
  knackChance: 0.6, // chance she knows the quad's starting trick (the green's double blip) before she's tried it
  blipHold: 0.2, // seconds the throttle is open for each blip of that trick...
  blipGap: 0.3, // ...and shut between them
  floodedFouling: 0.4, // plug fouling past which she thinks it's flooded (Amy apologises to it)...
  floodedRich: 0.2, // ...or mixture richness past which she does
  tickleChance: 0.85, // on an old bike with a tickler, from cold she tickles the carb
  tickleMax: 2, // up to this many presses (the old bike floods past about three)
  leverChance: 0.7, // and retards the spark lever before she kicks it; the rest of the time she leaves it where it was
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
    this.events = []; // what she did this step, for her voice: 'tapOn', 'chokeOn', 'crank', 'remembered', 'caught', 'gaveUp', 'slow', 'flat', 'pull', 'knack', 'flooded'
    this.pulls = 0;
    this.knowsKnack = false;
    this.blipsLeft = 0;
    this.saidSlow = false;
    this.saidFlooded = false;
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
    if (this.checkKick) {
      this.checkKick = false;
      if (engine.kicked > 0) this.events.push('kickedBack');
    }

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
        // The old bike's ritual first (a tickle and the spark lever): tickled, she leaves the choke alone, as the two together drown it.
        if (engine.params?.manualTiming) this.oldBikeRitual();
        if (!this.events.includes('tickle') && this.random() < (engine.temperature < 0.5 ? p.coldChokeChance : p.warmChokeChance)) {
          this.quad.choke = 1;
          this.events.push('chokeOn');
        }
        this.knowsKnack = this.random() < p.knackChance;
        this.startBurst();
        break;
      case 'blip':
        // The trick: open and shut the throttle the right number of times, then crank.
        if (this.timer > 0) break;
        if (this.quad.helperThrottle > 0 || this.blipsLeft <= 0) {
          this.quad.helperThrottle = 0;
          this.timer = p.blipGap;
          if (this.blipsLeft <= 0) this.startBurst();
        } else {
          this.quad.helperThrottle = 1;
          this.blipsLeft--;
          this.timer = p.blipHold;
        }
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
      case 'pull':
        // Pulling the cord: hold it, yank, wait to see, again.
        if (engine.isRunning) {
          this.quad.helperPull = false;
          this.phase = 'tending';
          this.events.push('caught');
        } else if (this.timer <= 0) {
          if (this.pulling) {
            this.quad.helperPull = false; // letting go is the yank
            this.pulling = false;
            this.checkKick = true; // the kick happens on the quad's next step: look for a kick-back on hers
            this.quad.helperThrottle = 0;
            this.timer = p.pullWait;
            if (this.quad.engine.params?.manualTiming) this.rethink(); // the old bike's lever, the tap, a flooded plug: she thinks between kicks
          } else if (this.pulls >= p.maxPulls) {
            engine.setIgnition(false);
            this.finish('gaveUp');
            this.events.push('gaveUp');
          } else {
            this.beginPull();
          }
        }
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
        else if (this.p.settleAt != null && engine.temperature >= this.p.settleAt) {
          // Needed on the road: she takes the choke off and leaves it to idle, rather than minding it until it is fully warm.
          this.quad.choke = 0;
          this.finish('running');
        }
        break;
    }
    return this.events;
  }

  /** The old bike's starting ritual: a tickle or two when it is cold, and the spark lever back to where it starts, if she remembers. */
  oldBikeRitual() {
    const { engine } = this.quad;
    const p = this.p;
    if (engine.params.tickler && engine.temperature < 0.5 && this.random() < p.tickleChance) {
      const presses = 1 + Math.floor(this.random() * p.tickleMax);
      for (let i = 0; i < presses; i++) engine.tickle();
      this.events.push('tickle');
    }
    if (this.random() < p.leverChance) {
      engine.advance = engine.params.startAdvance;
      this.events.push('retard');
    }
  }

  /** Draws the cord back for a yank (a kick on the old bike). */
  beginPull() {
    this.pulls++;
    this.pulling = true;
    // Flooded, she kicks it over with the throttle open to blow it clear.
    const e = this.quad.engine;
    if (e.params?.tickler && (e.tickled > e.params.tickleFloodAbove || e.fouling > this.p.floodedFouling)) this.quad.helperThrottle = 1;
    this.timer = this.between(this.p.pullHoldMin, this.p.pullHoldMax);
    this.quad.helperPull = true;
    if (this.pulls === 1) this.events.push('pull');
  }

  /** A cold quad with a trick to starting it that hasn't been done lately. */
  needsKnack() {
    const { engine } = this.quad;
    return !!engine.knack && !engine.knack.primed && engine.temperature < engine.params.knackColdBelow;
  }

  startBurst() {
    const { engine } = this.quad;
    const ep = engine.params ?? {};
    if (this.knowsKnack && this.needsKnack() && !engine.starterDead) {
      this.phase = 'blip';
      this.blipsLeft = ep.knackBlips;
      this.timer = 0;
      if (!this.saidKnack) this.events.push('knack');
      this.saidKnack = true;
      return;
    }
    // No starter motor: straight to the cord, whatever the battery.
    if (ep.noStarter) {
      this.phase = 'pull';
      this.beginPull();
      return;
    }
    // A flat battery: it only clicks. She says so, then either has a go at the cord or gives up.
    if (engine.starterDead) {
      this.events.push('flat');
      if (ep.pullStart && this.random() < this.p.pullWhenFlat) {
        this.phase = 'pull';
        this.beginPull();
      } else {
        engine.setIgnition(false);
        this.finish('gaveUp');
        this.events.push('gaveUp');
      }
      return;
    }
    if (engine.battery < ep.batteryWeakBelow && !this.saidSlow) {
      this.saidSlow = true;
      this.events.push('slow');
    }
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
    // Too much petrol in it: she notices (once) before she thinks of anything else.
    if (!this.saidFlooded && (engine.fouling > p.floodedFouling || engine.rich > p.floodedRich)) {
      this.saidFlooded = true;
      this.events.push('flooded');
    }
    if (this.random() >= p.rememberChance) return;
    if (fuel.tap === 'off' && !this.checkedTap) {
      fuel.tap = 'on';
      this.checkedTap = true;
      this.events.push('remembered', 'tapOn');
    } else if (engine.temperature < 0.5 && this.quad.choke < 0.5 && !(engine.tickled > 0.3)) { // (tickled, it wants no choke as well)
      this.quad.choke = 1;
      this.events.push('remembered', 'chokeOn');
    } else if (engine.params?.manualTiming && engine.advance > engine.params.kickAbove) {
      engine.advance = engine.params.startAdvance; // it kicked back: that is the lever
      this.events.push('remembered', 'retard');
    } else if (this.needsKnack() && !this.knowsKnack) {
      this.knowsKnack = true;
      this.events.push('remembered');
    } else if (engine.temperature >= 0.5 && this.quad.choke > 0.5) {
      this.quad.choke = 0;
      this.events.push('remembered');
    }
  }

  finish(result) {
    this.starter = false;
    this.quad.helperThrottle = 0;
    this.quad.helperPull = false;
    this.done = true;
    this.result = result;
  }

  /** Stops whatever she's doing, e.g. because you've got on. */
  abandon() {
    this.quad.helperPull = false;
    this.finish(this.quad.engine.isRunning ? 'running' : 'gaveUp');
  }
}
