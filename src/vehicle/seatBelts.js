// The UTV's seat belts. Whoever sits in the bench or the driver's seat has one: the girls always buckle up a moment after they sit down
// and undo it when they get out, and you do it with a key (and are nagged if you don't: the dash lamp flashes and a quiet bing sounds
// every few seconds while you are sat unbelted with the key on). Pure logic, so it is tested without the game
// (tests/seatBelts.test.js); the model shows each belt stowed or worn (`poseUtvBelts` in utvModel.js).

export const BELT_SEATS = ['driver', 'mid', 'left'];

export const DEFAULT_SEAT_BELT_PARAMS = {
  girlSeconds: 2, // seconds after she sits down before she has her belt on
  nagDelay: 1.5, // seconds you can sit unbelted with the key on before the bing starts
  bingEvery: 4, // seconds between bings
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
  constructor(p = SEAT_BELT_PARAMS) {
    this.p = p;
    this.seats = Object.fromEntries(BELT_SEATS.map((s) => [s, { who: null, sat: 0, belted: false }]));
    this.sinceBing = 0;
  }

  /**
   * One step. `who` says who is in each seat ({ driver, mid, left }: 'you', 'girl' or null) and `keyOn` whether the ignition is on.
   * A seat that empties lets its belt go. Returns true when the bing should sound.
   */
  update(dt, who, keyOn) {
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
    const nagging = !!keyOn && !!yours && !yours.belted && yours.sat >= this.p.nagDelay;
    if (!nagging) {
      this.sinceBing = this.p.bingEvery; // the first bing comes as soon as the nag starts
      return false;
    }
    this.sinceBing += dt;
    if (this.sinceBing < this.p.bingEvery) return false;
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

  /** Which belts are worn: { driver, mid, left }. */
  worn() {
    return Object.fromEntries(BELT_SEATS.map((s) => [s, this.seats[s].belted]));
  }

  /** Someone is sitting there with their belt off (the dash lamp's cue). */
  get anyUnbelted() {
    return Object.values(this.seats).some((s) => s.who && !s.belted);
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
