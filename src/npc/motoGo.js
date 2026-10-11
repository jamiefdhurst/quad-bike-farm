// The girls on the mini moto. Amy won't touch it. Jess has a go: she is wobbly and slow at first, gets braver the longer she is on it, and
// comes off on the grass (the two-wheeler's fall, bikeLean.js). Her nerve carries between goes, so the next is steadier and faster, and the
// odds of coming off fall as it grows. Pure, no Three.js. Her lines are in motoLines.js.

export const DEFAULT_MOTO_PARAMS = {
  amyRefuses: 1, // 1: Amy won't ride the mini moto at all, and says so (0 lets her have a go like Jess)
  startNerve: 0.15, // Jess's nerve on it the first time, 0 to 1
  nerveGain: 0.012, // nerve she gains each second she is riding it
  fallBrave: 0.25, // nerve she gains from coming off (she gets back on, braver)
  moveSpeed: 2, // m/s: slower than this she has a foot down, so nothing wobbles and the clock doesn't run
  wobbleAmp: 0.45, // bars (-1 to 1) of wobble at no nerve, falling to nothing at full nerve
  wobbleHz: 0.7, // how fast the wobble sways
  speedFloor: 0.45, // her top speed on it at no nerve, as a share of her usual, rising to all of it at full nerve
  firstFallMin: 15, // seconds riding before she comes off, the first time (a real one, she always does)
  firstFallMax: 35,
  laterFall: 0.5, // chance a later go ends in a fall at no nerve, falling to nothing as nerve rises
  laterFallMin: 20,
  laterFallMax: 60,
};

export const MOTO_PARAM_RANGES = {
  amyRefuses: [0, 1, 1],
  startNerve: [0, 1, 0.05],
  nerveGain: [0, 0.1, 0.002],
  fallBrave: [0, 0.6, 0.05],
  moveSpeed: [0.5, 5, 0.1],
  wobbleAmp: [0, 1, 0.05],
  wobbleHz: [0.2, 2, 0.05],
  speedFloor: [0.2, 1, 0.05],
  firstFallMin: [3, 60, 1],
  firstFallMax: [3, 90, 1],
  laterFall: [0, 1, 0.05],
  laterFallMin: [3, 90, 1],
  laterFallMax: [3, 150, 1],
};

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const lerp = (a, b, t) => a + (b - a) * t;

/** Would this girl refuse the mini moto outright? Only Amy does. */
export function refusesMoto(characterId, P = DEFAULT_MOTO_PARAMS) {
  return characterId === 'amy' && P.amyRefuses > 0;
}

/** How much of her usual top speed she allows herself on it at this nerve. */
export function speedShare(nerve, P = DEFAULT_MOTO_PARAMS) {
  return lerp(P.speedFloor, 1, clamp(nerve, 0, 1));
}

/** One girl's nerve on the moto, and the go she is having. */
export class MotoNerve {
  constructor(P = DEFAULT_MOTO_PARAMS, random = Math.random) {
    this.P = P;
    this.random = random;
    this.nerve = P.startNerve;
    this.goes = 0;
    this.falls = 0;
    this.go = null;
  }

  /** She has got on. Decides now whether this go ends in a fall, and when. */
  begin() {
    const P = this.P;
    this.goes += 1;
    let fallAt = Infinity;
    if (this.falls === 0) fallAt = lerp(P.firstFallMin, P.firstFallMax, this.random());
    else if (this.random() < P.laterFall * (1 - this.nerve)) fallAt = lerp(P.laterFallMin, P.laterFallMax, this.random());
    this.go = { t: 0, fallAt, phase: this.random() * 6.28 };
  }

  /** She has got off without falling. */
  end() {
    this.go = null;
  }

  /**
   * @param {number} dt
   * @param {{speed:number, grass:boolean}} s  her speed, m/s, and whether she is on the grass (she waits for it to come off)
   * @returns {{wobble:number, fall:boolean}} the bars' wobble to add to her steering (-1 to 1), and whether she comes off now
   */
  update(dt, { speed, grass }) {
    const go = this.go;
    const P = this.P;
    if (!go) return { wobble: 0, fall: false };
    const moving = speed > P.moveSpeed;
    if (moving) {
      go.t += dt;
      this.nerve = Math.min(1, this.nerve + P.nerveGain * dt);
    }
    if (moving && grass && go.t >= go.fallAt) {
      this.go = null;
      this.falls += 1;
      this.nerve = Math.min(1, this.nerve + P.fallBrave);
      return { wobble: 0, fall: true };
    }
    if (!moving) return { wobble: 0, fall: false };
    const w = Math.sin(go.phase + go.t * P.wobbleHz * 6.28) + 0.5 * Math.sin(go.phase * 2 + go.t * P.wobbleHz * 2.3 * 6.28);
    return { wobble: (P.wobbleAmp * (1 - this.nerve) * w) / 1.5, fall: false };
  }
}
