// What she's set on doing, and how she goes about it. Once she's chosen something (chooser.js) she walks at a pace that fits it:
// hurrying out of the rain or to catch her friend, dawdling off for a look round or a sit down, going briskly for a drive, slower when
// she's tired and quicker when she's keyed up. And if you call her over (the wheel, the bell) while she's on her way to it, she says so,
// and it's on her mind: she's keener on it for a while after and says so when she gets back to it. Pure.

/** How she walks for each pace a choice can have (OFFER_KINDS[key].pace, chooser.js). */
export const PACES = ['hurry', 'brisk', 'normal', 'dawdle'];

/**
 * Her walking this step: { mul (times her walking speed), jog ('yes': she may jog; 'no': she won't; 'auto': as the walk usually would) }.
 * `pace` is her chosen thing's (or null); `ctx`: wet (it's raining on her), tired (her rest need, 0..1), excited (her excitement need), mood (times her speed from how she's been feeling: mood.js).
 * Rain makes any walk but a dawdle a hurry. `p` her params (pace*).
 */
export function walkPace(pace, ctx, p) {
  let base = pace === 'hurry' ? p.paceHurry : pace === 'brisk' ? p.paceBrisk : pace === 'dawdle' ? p.paceDawdle : 1;
  const hurried = pace === 'hurry' || (ctx.wet && pace !== 'dawdle');
  if (hurried) base = Math.max(base, p.paceHurry);
  const mood = (1 - (ctx.tired ?? 0) * (1 - p.paceTired)) * (1 + (ctx.excited ?? 0) * (p.paceExcited - 1));
  return { mul: base * mood * (ctx.mood ?? 1), jog: pace === 'dawdle' ? 'no' : hurried ? 'yes' : 'auto' };
}

export class Intent {
  constructor() {
    this.clock = 0;
    this.current = null; // what she chose and is on her way to: { key, sig } (sig: her state and its goal just after she set off)
    this.resume = null; // what she was stopped from doing and is still keen on: { key, until }
    this.plan = null; // what she means to do after what she's on with (plans.js): { first, then, until }
  }

  /** She chose `key`; `sig` is her state just after (walking:start and so on). Returns true if it's the thing she was stopped from. */
  chose(key, sig) {
    this.current = { key, sig };
    if (this.plan?.then === key) this.plan = null; // she's on to the second part
    const resumed = this.resume?.key === key;
    if (resumed) this.resume = null;
    return resumed;
  }

  /** Each frame, with her state now: once it's moved on from setting off (she's got there), it's under way and no longer interruptible. */
  update(dt, sig) {
    this.clock += dt;
    if (this.current && sig !== this.current.sig) this.current = null;
    if (this.resume && this.clock > this.resume.until) this.resume = null;
    if (this.plan && this.clock > this.plan.until) this.plan = null;
  }

  /** She means to do `then` once she's done `first`, for `p.planFor` s. */
  makePlan(first, then, p) {
    this.plan = { first, then, until: this.clock + p.planFor };
  }

  /** Free again: the offer that carries on her plan, if it's still on offer, else null (the plan waits for it until it runs out). */
  nextStep(offers) {
    return (this.plan && offers.find((o) => o.key === this.plan.then)) || null;
  }

  /** Something else has her (you asked, the bell): returns what she was on her way to, now on her mind for `p.resumeFor` s, or null. */
  interrupt(p) {
    const key = this.current?.key ?? null;
    if (key) this.resume = { key, until: this.clock + p.resumeFor };
    this.current = null;
    this.plan = null; // asked for something else, the plan is off
    return key;
  }

  /** What she's set on, for the debug panel and the console. */
  describe(labelOf = (k) => k) {
    const on = this.current ? `on her way to ${labelOf(this.current.key)}` : 'nothing she can be stopped from';
    const mind = this.resume ? `; still keen to ${labelOf(this.resume.key)} (${Math.max(0, Math.round(this.resume.until - this.clock))} s)` : '';
    const plan = this.plan ? `; plans to ${labelOf(this.plan.then)} after` : '';
    return on + mind + plan;
  }

  /** How much keener she is on `key` now (`p.resumeBoost` while it's the thing she was stopped from, else 1). */
  boost(key, p) {
    return this.resume?.key === key ? p.resumeBoost : 1;
  }
}
