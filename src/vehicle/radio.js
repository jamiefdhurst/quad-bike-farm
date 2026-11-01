// The radio in the Land Rovers and the girls' cars: on or off, how loud, and how well it holds the one station. It needs the key on (a flat
// battery silences it, and so does the starter motor, which takes the supply for as long as it turns). Pure, so it is tested without
// Web Audio; the sound is audio/radioAudio.js, and what is on air is audio/radioProgramme.js.
//
// Each vehicle's set has its own character (RADIO_PROFILES): the Series' is an old dash radio with a tinny speaker that picks up the
// ignition and drifts off the station; the 200TDi's is a plainer stereo; Amy's Fiesta has a cassette radio with a little warble; Jess's
// Corsa has a bassy aftermarket head unit that is loud and clean.

export const DEFAULT_RADIO_PARAMS = {
  startVolume: 0.5, // how loud it is the first time it goes on, 0 to 1
  volumeStep: 0.15, // what one press of louder or quieter moves it
  outsideRange: 22, // metres: how far its sound carries from the vehicle when you are out of it
  outsideLevel: 0.35, // and how much of its inside level is left just outside the door
  driftSeconds: 37, // how long its station takes to wander off and back once (the vehicle's drift scales how far)
  cutSeconds: 0.12, // how quickly the supply coming back brings it up again
};

export const RADIO_PARAM_RANGES = {
  startVolume: [0, 1, 0.05],
  volumeStep: [0.05, 0.4, 0.01],
  outsideRange: [4, 60, 1],
  outsideLevel: [0, 1, 0.01],
  driftSeconds: [8, 120, 1],
  cutSeconds: [0.02, 1, 0.01],
};

export const RADIO_PARAMS = { ...DEFAULT_RADIO_PARAMS }; // shared by every set, registered once

/**
 * Each set's character, by vehicle id: band (the speaker's low and high roll-off, Hz), hiss (the static floor, 0 to 1), crackle (the
 * pops and spits), whine (how much the engine's ignition gets into it, rising with the revs), drift (how far the station wanders off
 * into static), bass (dB added below 200 Hz), warble (a slow wobble of pitch, from a worn cassette head), loud (its top level) and
 * name (what the debug panel calls it).
 */
export const RADIO_PROFILES = {
  landrover: { name: 'old dash radio, tinny speaker', band: [380, 3000], hiss: 0.55, crackle: 0.65, whine: 0.75, drift: 0.55, bass: 0, warble: 0.1, loud: 0.8 },
  landrover200: { name: 'plain stereo, door speakers', band: [200, 4800], hiss: 0.3, crackle: 0.25, whine: 0.25, drift: 0.25, bass: 3, warble: 0, loud: 0.9 },
  fiesta: { name: 'cassette radio', band: [160, 5200], hiss: 0.25, crackle: 0.12, whine: 0.1, drift: 0.15, bass: 4, warble: 0.4, loud: 0.85 },
  corsa: { name: 'aftermarket head unit, big bass', band: [60, 9500], hiss: 0.1, crackle: 0.05, whine: 0.04, drift: 0.08, bass: 10, warble: 0, loud: 1.15 },
  p309: { name: 'factory cassette radio', band: [140, 6000], hiss: 0.22, crackle: 0.1, whine: 0.15, drift: 0.15, bass: 3, warble: 0.25, loud: 0.9 }, // your car's: a diesel's glow plugs and alternator whine into it a little
};

/** The profile for a vehicle id (the Series' if it is one we don't know). */
export function profileFor(id) {
  return RADIO_PROFILES[id] ?? RADIO_PROFILES.landrover;
}

/** Which vehicles have a radio: the Land Rovers and the girls' cars. */
export function hasRadio(spec) {
  return !!(spec && (spec.landRover || spec.car));
}

/**
 * How well the station comes in at `t` seconds, 1 clear to 0 all static. It wanders slowly (two sines that don't line up) by as much as
 * the set's drift, and a set picks up the ignition: the revs (0 to 1) pull it down a little more. Never fully gone: there is always some voice.
 */
export function signalAt(t, drift, rev = 0, whine = 0, P = RADIO_PARAMS) {
  const w = (Math.PI * 2) / P.driftSeconds;
  const wander = 0.5 + 0.35 * Math.sin(t * w) + 0.15 * Math.sin(t * w * 2.7 + 1.3); // 0 to 1
  const loss = drift * (1 - wander) * 1.2 + whine * rev * 0.25;
  return Math.max(0.15, Math.min(1, 1 - loss));
}

export class Radio {
  constructor(id, P = RADIO_PARAMS) {
    this.id = id;
    this.profile = profileFor(id);
    this.P = P;
    this.on = false;
    this.volume = P.startVolume;
    this.powered = false; // the supply: key on, battery good, the starter not turning
    this.level = 0; // what you actually hear, 0 to 1 of its top: eases up and down so a cut-out isn't a click
    this.rev = 0; // 0 to 1, the engine's revs, for the ignition whine
    this.clock = 0;
    this.changedAt = -Infinity; // when anyone last touched it, on the radio's own clock (the girls leave it alone for a while after you do)
  }

  /** On the key: it goes on or off. */
  toggle() {
    this.on = !this.on;
    this.changedAt = this.clock;
    return this.on;
  }

  set(on) {
    this.on = !!on;
    this.changedAt = this.clock;
  }

  louder() {
    this.changedAt = this.clock;
    this.volume = Math.min(1, this.volume + this.P.volumeStep);
    return this.volume;
  }

  quieter() {
    this.changedAt = this.clock;
    this.volume = Math.max(0, this.volume - this.P.volumeStep);
    return this.volume;
  }

  setVolume(v) {
    this.changedAt = this.clock;
    this.volume = Math.max(0, Math.min(1, v));
  }

  /** Seconds since anyone touched it. */
  get untouchedFor() {
    return this.clock - this.changedAt;
  }

  /** Is it making a sound now (on and powered)? */
  get playing() {
    return this.on && this.powered;
  }

  /** How well the station comes in right now. */
  get signal() {
    return signalAt(this.clock, this.profile.drift, this.rev, this.profile.whine, this.P);
  }

  /** Every frame: `power` is the engine's hasPower, `cranking` the starter turning, `rev` the revs from 0 to 1. */
  update(dt, { power = false, cranking = false, rev = 0 } = {}) {
    this.clock += dt;
    this.powered = !!power && !cranking;
    this.rev = Math.max(0, Math.min(1, rev));
    const target = this.playing ? this.volume * this.profile.loud : 0;
    const k = Math.min(1, dt / Math.max(0.001, this.P.cutSeconds));
    this.level += (target - this.level) * k;
    if (Math.abs(target - this.level) < 0.001) this.level = target;
  }

  /** How the debug panel and the console describe it. */
  describe() {
    if (!this.on) return 'off';
    if (!this.powered) return 'on, no power';
    return `on, volume ${Math.round(this.volume * 100)}%`;
  }
}

/**
 * How loud it is where the listener is: `inside` (sat in the vehicle) hears its level straight; outside it falls away over the range
 * and is duller. Returns { gain, dull } with dull 0 clear to 1 muffled.
 */
export function heardAt(level, distance, inside, P = RADIO_PARAMS) {
  if (inside) return { gain: level, dull: 0 };
  if (distance >= P.outsideRange) return { gain: 0, dull: 1 };
  const fall = 1 - distance / P.outsideRange;
  return { gain: level * P.outsideLevel * fall * fall, dull: 0.5 + 0.5 * (1 - fall) };
}
