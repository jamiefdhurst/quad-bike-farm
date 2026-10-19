// How she's been feeling, not just what she wants this second: one value per girl from -1 (low) to +1 (high) that eases towards how
// her needs (needs.js) have been over the last few minutes. Cold and bored a while pulls it down; a good ride, company and a warm-up lift
// it. It shows as a slower walk, being less keen on everything she could do, a remark when she tips into a low or high spell, and a
// curt answer when you ask her something in a low one. Never a refusal. Not saved: it's minutes long. Pure.
//
// Not the favour mood in favour.js (how she rates you), nor the driving mood in driveMood.js (how sure she is on a quad).

/** How much each need weighs in how uneasy she is (cold and boredom most). */
export const UNEASE_WEIGHTS = { warmth: 1, purpose: 1, excitement: 0.8, company: 0.8, rest: 0.5 };

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** 0 (everything met) to 1 (everything pressing): the weighted mean of the needs that wear a girl down. */
export function unease(needs) {
  let sum = 0;
  let total = 0;
  for (const [n, w] of Object.entries(UNEASE_WEIGHTS)) {
    sum += (needs[n] ?? 0) * w;
    total += w;
  }
  return sum / total;
}

/** 'low', 'high' or 'ok' for a value, with some give so a mood doesn't flicker at the edge (`was` is the state it is in now). */
export function moodState(value, was, p) {
  if (was === 'low') return value > p.moodLowAt + 0.2 ? 'ok' : 'low';
  if (was === 'high') return value < p.moodHighAt - 0.2 ? 'ok' : 'high';
  return value < p.moodLowAt ? 'low' : value > p.moodHighAt ? 'high' : 'ok';
}

export class Mood {
  constructor(start = 0.1) {
    this.value = start;
    this.state = 'ok';
    this.clock = 0;
    this.lastRemark = -Infinity;
  }

  /**
   * One step. `needs` is hers; `ctx` the needs context (thrill 0..1, together, warmed, chill); `p` her params (the mood* keys).
   * Returns 'low' or 'high' the moment she tips into one (at most one a `moodRemarkGap`), else null.
   */
  update(dt, needs, ctx, p) {
    this.clock += dt;
    let target = p.moodBase - p.moodUnease * unease(needs);
    target += (ctx.together ? p.moodCompany : 0) + (ctx.warmed && ctx.chill > 0.3 ? p.moodWarm : 0);
    // Easing towards it over a few minutes, and a fast ride lifts her straight away.
    this.value += (target - this.value) * (1 - Math.exp(-dt / p.moodSeconds));
    this.value = clamp(this.value + dt * (ctx.thrill ?? 0) * p.moodThrillLift, -1, 1);
    const was = this.state;
    this.state = moodState(this.value, was, p);
    if (this.state !== was && this.state !== 'ok' && this.clock - this.lastRemark >= p.moodRemarkGap) {
      this.lastRemark = this.clock;
      return this.state;
    }
    return null;
  }

  /** Times her walking speed: slower low, brisker high. */
  pace(p) {
    return 1 + this.value * p.moodPace;
  }

  /** Times the weight of anything she might choose that isn't urgent: less keen low (`moodKeenLow` at the bottom), keener high. */
  keen(p) {
    return this.value < 0 ? 1 + this.value * (1 - p.moodKeenLow) : 1 + this.value * (p.moodKeenHigh - 1);
  }

  /** For the debug panel and the console. */
  describe() {
    const word = this.state === 'low' ? 'low' : this.state === 'high' ? 'high' : 'even';
    return `${word} (${this.value.toFixed(2)})`;
  }
}
