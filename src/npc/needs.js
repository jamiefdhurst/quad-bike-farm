// What a girl wants: six needs, each 0 (met) to 1 (pressing), that build and get met as she goes about the farm. The chooser
// (chooser.js) weighs what she could do against them, so what she does next follows from how she feels rather than a roll of the dice.
// Pure: the game says each frame what she's doing and what it's like where she is.
//
//   warmth      rises with the day's chill outside, faster when it's raining on her; met by an engine, a cab, the barn roof
//   company     rises with nobody near her; met by being near you or her friend
//   excitement  creeps up all the time; met by going fast and by a good shake
//   rest        rises while she's on the go; met by sitting down
//   sleep       creeps up all the time (a bit faster on the go); met only by dozing; the sleepier she is, the less she does and the slower she thinks
//   purpose     rises while she stands about with nothing to do (at the old boredom wait's pace); met by starting anything she chose
//   attention   rises while she's with her friend and you're not near her (faster the closer you are to the friend); met by you coming over
//               or talking to her. Jealousy: it is what 'neglected' now means (favour.js), and makes showing off and pranks likelier

export const NEEDS = ['warmth', 'company', 'excitement', 'rest', 'sleep', 'purpose', 'attention'];

/** What each need is called in the debug panel. */
export const NEED_LABELS = { warmth: 'warmth', company: 'company', excitement: 'excitement', rest: 'rest', sleep: 'sleepiness', purpose: 'something to do', attention: 'your attention' };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class Needs {
  constructor(start = {}) {
    for (const n of NEEDS) this[n] = start[n] ?? 0;
  }

  /**
   * One step. `ctx`: chill (0..1, the day's cold where she is: 0 indoors or in a cab), wet (it's raining on her), warmed (warming up:
   * hands over an engine, a running cab, the barn), alone (nobody within her lonely range), together (someone close, or riding with
   * her), thrill (0..1: speed and shake), active (on the go: walking, driving, getting about), sitting, dozing (asleep or nodding off on the bales), idle (stood about with nothing
   * to do), purposeRate (per second while idle: 1 over her current boredom wait), withFriend (her friend is close), youNear (you are close to her),
   * youWithFriend (you are close to her friend and not to her). `p` her params (the need* keys).
   */
  update(dt, ctx, p) {
    this.warmth += dt * (ctx.chill * p.needColdRise + (ctx.wet ? p.needWetRise : 0));
    if (ctx.warmed) this.warmth -= dt * p.needWarmFall;
    else if (ctx.chill < 0.15 && !ctx.wet) this.warmth -= dt * p.needWarmFall * 0.3; // a mild day, she warms up anyway
    if (ctx.alone) this.company += dt * p.needLonelyRise;
    if (ctx.together) this.company -= dt * p.needCompanyFall;
    this.excitement += dt * (p.needThrillRise - (ctx.thrill ?? 0) * p.needThrillFall);
    if (ctx.active) this.rest += dt * p.needTireRise;
    if (ctx.sitting) this.rest -= dt * p.needRestFall;
    this.sleep += dt * (p.needSleepRise * (ctx.active ? 1.5 : 1));
    if (ctx.dozing) this.sleep -= dt * p.needSleepFall;
    if (ctx.idle) this.purpose += dt * (ctx.purposeRate ?? 0);
    else this.purpose -= dt * p.needBusyFall; // doing something, the itch to do something fades
    if (ctx.youNear) this.attention -= dt * p.needAttentionFall;
    else if (ctx.withFriend) this.attention += dt * p.needJealousRise * (ctx.youWithFriend ? p.needJealousFriend : 1);
    else this.attention -= dt * p.needAttentionFade; // on her own, it fades slowly: there's nobody to be jealous of
    for (const n of NEEDS) this[n] = clamp01(this[n]);
  }

  /** You paid her friend attention with her stood there (or ignored her): a bump, whatever else is going on. */
  slighted(amount) {
    this.attention = clamp01(this.attention + amount);
  }

  /** You talked to her: it eases at once. */
  noticed(amount) {
    this.attention = clamp01(this.attention - amount);
  }

  /** The most pressing need and how pressing: { need, level }. */
  top() {
    let best = NEEDS[0];
    for (const n of NEEDS) if (this[n] > this[best]) best = n;
    return { need: best, level: this[best] };
  }

  /** She got what she chose: the needs it meets drop by that much (purpose all the way, as she's off doing something). */
  met(satisfies) {
    for (const [n, amount] of Object.entries(satisfies)) if (NEEDS.includes(n)) this[n] = clamp01(this[n] - amount * 0.25);
    this.purpose = 0;
  }
}
