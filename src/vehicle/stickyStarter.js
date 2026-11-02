// A sticky starter: an old starter motor with worn brushes that, on a cold start, only clicks until someone gives it a tap with a
// spanner. Some games have one electric-start petrol vehicle with it, some none. It doesn't wear or worsen: it sticks, a tap frees it,
// and the next cold start it may stick again. Jess learns the tap by watching you do it (`TrickLearner`). Pure logic, no Three.js:
// quad.js asks `step` each frame and feeds `stuck` to the engine as a control; the game deals it and the toolbox taps it.

export const DEFAULT_STICKY_PARAMS = {
  gameChance: 0.6, // chance a game has a vehicle with a sticky starter at all
  stickChance: 0.7, // chance a cold start finds it stuck
  coldBelow: 0.6, // engine temperature (0 cold, 1 warm) under which it can stick
  tapsToLearn: 2, // taps Jess has to see done before she can do it herself
  watchRange: 12, // metres: how near she must be to see you tap it
  notice: 1, // seconds of clicking before a girl starting it says something
  tapDelay: 0.6, // and another moment before Jess, who knows the trick, reaches for the spanner
  tapChance: 0.85, // chance Jess, who knows the trick, taps it on a given go (she does it with relish, but she's no machine)
};

export const STICKY_PARAM_RANGES = {
  gameChance: [0, 1, 0.05],
  stickChance: [0, 1, 0.05],
  coldBelow: [0.1, 1, 0.05],
  tapsToLearn: [1, 6, 1],
  watchRange: [2, 40, 1],
  notice: [0, 5, 0.1],
  tapDelay: [0, 5, 0.1],
  tapChance: [0, 1, 0.05],
};

export class StickyStarter {
  constructor(params = DEFAULT_STICKY_PARAMS, random = Math.random) {
    this.p = params;
    this.random = random;
    this.stuck = false;
    this.armed = true; // the next cold press of the starter rolls the dice; it is armed again once the engine has run
    this.down = false;
  }

  /** One frame: `pressed` is the starter held, `running` the engine going, `temperature` its warmth. Returns true on the frame it sticks. */
  step(pressed, running, temperature) {
    if (running) {
      this.stuck = false;
      this.armed = true;
    }
    const rising = pressed && !this.down;
    this.down = pressed;
    if (!rising || running || !this.armed || temperature >= this.p.coldBelow) return false;
    this.armed = false;
    this.stuck = this.random() < this.p.stickChance;
    return this.stuck;
  }

  /** A tap with the spanner. Returns whether it was stuck (and so is free now). */
  tap() {
    const was = this.stuck;
    this.stuck = false;
    this.armed = false; // freed for this start: it isn't rolled again until the engine has run
    return was;
  }
}

/** Which of the vehicles (in a fixed order) has the sticky starter this game, or null for none. `candidates` are ids with a petrol starter motor. */
export function dealSticky(candidates, random, P = DEFAULT_STICKY_PARAMS) {
  const roll = random();
  const pick = random();
  if (!candidates.length || roll >= P.gameChance) return null;
  return candidates[Math.floor(pick * candidates.length)];
}

/** Whether a vehicle's engine could have it: an electric starter on a petrol engine. */
export function canStick(engineParams) {
  return !engineParams.noStarter && !engineParams.compressionIgnition;
}

/** What each girl has learnt about the trick: how many taps she has seen, and so whether she can do it. Kept in the save. */
export class TrickLearner {
  constructor(ids, params = DEFAULT_STICKY_PARAMS) {
    this.p = params;
    this.seen = Object.fromEntries(ids.map((id) => [id, 0]));
  }

  /** You tapped it with the spanner while she was `distance` metres away and free to look. Returns true the moment she learns it. */
  watch(id, distance, looking = true) {
    if (!(id in this.seen) || !looking || distance > this.p.watchRange || this.knows(id)) return false;
    this.seen[id]++;
    return this.knows(id);
  }

  knows(id) {
    return (this.seen[id] ?? 0) >= this.p.tapsToLearn;
  }

  capture() {
    return { ...this.seen };
  }

  restore(s) {
    for (const id of Object.keys(this.seen)) if (Number.isFinite(s?.[id])) this.seen[id] = s[id];
  }
}

/** A girl starting a vehicle whose starter is stuck: after a moment she says what is wrong, and if she knows the trick she taps it free. */
export class StuckHelp {
  constructor(params = DEFAULT_STICKY_PARAMS, random = Math.random) {
    this.p = params;
    this.random = random;
    this.wait = 0;
    this.told = false;
  }

  /** One frame. `stuck` is the starter, `knows` whether the girl starting it has learnt the tap (null when nobody is starting it). Returns 'tap', 'stuck' (once) or null. */
  step(dt, stuck, knows) {
    if (!stuck) this.told = false;
    if (!stuck || knows === null) {
      this.wait = 0;
      return null;
    }
    this.wait += dt;
    if (this.wait < this.p.notice) return null;
    if (knows) return this.wait >= this.p.notice + this.p.tapDelay && this.random() < this.p.tapChance ? 'tap' : null;
    if (!this.told) {
      this.told = true;
      return 'stuck';
    }
    return null;
  }
}
