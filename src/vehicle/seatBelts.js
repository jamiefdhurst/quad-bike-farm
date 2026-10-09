// The UTV's seat belts. Whoever sits in the bench or the driver's seat has one: the girls always buckle up a moment after they sit down
// and undo it when they get out, and you do it with a key (and are nagged if you don't: the dash lamp flashes and a quiet bing sounds
// every few seconds while you are sat unbelted with the key on, or while the driver's seat is empty, since someone is expected in it).
// Pure logic, so it is tested without the game
// (tests/seatBelts.test.js); the model shows each belt stowed or worn (`poseUtvBelts` in utvModel.js).

export const BELT_SEATS = ['driver', 'mid', 'left'];

export const DEFAULT_SEAT_BELT_PARAMS = {
  girlSeconds: 2, // seconds after she sits down before she has her belt on
  nagDelay: 1.5, // seconds you can sit unbelted with the key on before the bing starts
  bingEvery: 2, // seconds between bongs (every fourth flash of the lamp, sounding as it lights)
  flashRate: 2, // the dash lamp's flashes a second
};

export const SEAT_BELT_PARAM_RANGES = {
  girlSeconds: [0, 10, 0.5],
  nagDelay: [0, 10, 0.5],
  bingEvery: [1, 20, 0.5],
  flashRate: [0.5, 6, 0.5],
};

export const SEAT_BELT_PARAMS = { ...DEFAULT_SEAT_BELT_PARAMS }; // shared by the UTV (and anything else that gets belts), registered once

export class SeatBelts {
  /** `seats`: the seats that have a belt (the 200TDi's back bench adds rearLeft, rearMid and rearRight). */
  constructor(p = SEAT_BELT_PARAMS, seats = BELT_SEATS) {
    this.p = p;
    this.seats = Object.fromEntries(seats.map((s) => [s, { who: null, sat: 0, belted: false }]));
    this.sinceBing = 0;
    this.wasLit = false;
    this.emptyFor = 0; // seconds the key has been on with nobody in the driver's seat
  }

  /**
   * One step. `who` says who is in each seat ({ driver, mid, left, ... }: 'you', 'girl' or null), `keyOn` whether the ignition is on and
   * `seconds` the dash clock the lamp flashes by. A seat that empties lets its belt go. Returns true when the bong should sound: as the
   * lamp lights, once `bingEvery` has passed, so the sound and the flash go together.
   */
  update(dt, who, keyOn, seconds = 0) {
    for (const [name, seat] of Object.entries(this.seats)) {
      const now = who[name] ?? null;
      if (now !== seat.who) {
        seat.who = now;
        seat.sat = 0;
        seat.belted = false;
      }
      if (!now) continue;
      seat.sat += dt;
      if (now === 'girl' && seat.sat >= this.p.girlSeconds) seat.belted = true;
    }
    const yours = Object.values(this.seats).find((s) => s.who === 'you');
    // The driver's seat is expected to be filled and buckled whenever the key is on, so an empty one nags too (a girl who has just sat
    // down is left to her two seconds).
    this.emptyFor = keyOn && !this.seats.driver.who ? this.emptyFor + dt : 0;
    const nagging = !!keyOn && ((!!yours && !yours.belted && yours.sat >= this.p.nagDelay) || this.emptyFor >= this.p.nagDelay);
    const lit = beltLampLit('flash', seconds, this.p);
    const edge = lit && !this.wasLit;
    this.wasLit = lit;
    if (!nagging) {
      this.sinceBing = this.p.bingEvery; // the first bong comes with the next flash once the nag starts
      return false;
    }
    this.sinceBing += dt;
    if (!edge || this.sinceBing < this.p.bingEvery - 0.1) return false;
    this.sinceBing = 0;
    return true;
  }

  /** The key: does or undoes your belt in `seat` (if you are the one sitting there). Returns 'on', 'off' or null if you aren't. */
  toggle(seat) {
    const s = this.seats[seat];
    if (!s || s.who !== 'you') return null;
    s.belted = !s.belted;
    return s.belted ? 'on' : 'off';
  }

  /** Which belts are worn, by seat: { driver, mid, left, ... }. */
  worn() {
    return Object.fromEntries(Object.entries(this.seats).map(([s, seat]) => [s, seat.belted]));
  }

  /** Someone is sitting there with their belt off, or the driver's seat is empty (the dash lamp's cue, with the key on). */
  get anyUnbelted() {
    return Object.values(this.seats).some((s) => s.who && !s.belted) || !this.seats.driver.who;
  }
}

/** The dash's seat belt lamp: flashing while someone sits unbelted with the key on, otherwise out. */
export function beltLampMode(keyOn, unbelted) {
  return keyOn && unbelted ? 'flash' : 'off';
}

/** Whether a lamp in `mode` is lit at `seconds` (any steadily running clock). */
export function beltLampLit(mode, seconds, p = SEAT_BELT_PARAMS) {
  if (mode === 'on') return true;
  if (mode !== 'flash') return false;
  return Math.floor(seconds * p.flashRate * 2) % 2 === 0;
}
