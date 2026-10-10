// Horns. Beep at a girl sat on a quad and she beeps back (Jess always; Amy mostly, and once or twice at a time). Now and
// then Jess creeps up close behind Amy while Amy is driving and blasts the horn, and Amy jumps. Pure logic: the game says
// who and where everyone is, and sounds each horn from `beeping`. Also the voice of each horn (weedy on the quads, a proper
// two-tone on the tractor).

export const DEFAULT_HORN_PARAMS = {
  hearRange: 35, // metres between you and a girl for her to hear your beep and answer
  jessReplyChance: 1, // Jess always answers
  amyReplyChance: 0.6, // Amy usually does
  replyDelayMin: 0.4, // seconds before she answers
  replyDelayMax: 1.1,
  beepLength: 0.22, // seconds each of her beeps lasts
  beepGap: 0.14, // seconds between beeps
  maxBeeps: 2, // most beeps in one answer
  replyCooldown: 3, // seconds before she'll answer again
  pressGap: 0.15, // seconds your horn must have been quiet for a new press to count as a new beep
  creepRange: 9, // metres: how close behind Amy Jess has to be to jump her
  creepMin: 2, // metres: any closer and it's a collision, not a prank
  creepBehind: 0.7, // how far into Amy's rear arc Jess must be (1 is dead behind)
  amyMinSpeed: 2, // m/s: Amy must be moving, or there's nothing to jump at
  prankFirstDelay: 120, // seconds into a game before the first creep-up
  prankCooldown: 240, // seconds between creep-ups
  prankChance: 0.15, // chance per second, while she's in position
  prankBlast: 0.7, // seconds of Jess's blast
  jumpDelay: 0.12, // seconds after the blast starts that Amy jumps
};

export const HORN_PARAM_RANGES = {
  hearRange: [5, 100, 1],
  jessReplyChance: [0, 1, 0.05],
  amyReplyChance: [0, 1, 0.05],
  replyDelayMin: [0, 3, 0.05],
  replyDelayMax: [0, 3, 0.05],
  beepLength: [0.05, 1, 0.01],
  beepGap: [0.05, 1, 0.01],
  maxBeeps: [1, 5, 1],
  replyCooldown: [0, 30, 0.5],
  pressGap: [0, 1, 0.05],
  creepRange: [3, 30, 0.5],
  creepMin: [0.5, 8, 0.5],
  creepBehind: [0, 1, 0.05],
  amyMinSpeed: [0, 10, 0.5],
  prankFirstDelay: [0, 1200, 10],
  prankCooldown: [0, 1800, 10],
  prankChance: [0, 1, 0.01],
  prankBlast: [0.2, 2, 0.05],
  jumpDelay: [0, 1, 0.02],
};

const REPLY_CHANCE = { jess: 'jessReplyChance', amy: 'amyReplyChance' };

/**
 * What a horn sounds like: two tones (Hz), the loudness, how buzzy it is, and how much of the top it keeps. The quads' horns
 * are weedy little things, each a touch different; the tractor's is a proper low two-tone. A spec can say its own as `horn`.
 */
export function hornVoice(spec) {
  if (spec.horn) return spec.horn;
  if (spec.tractor) return { freqs: [196, 247], level: 0.55, buzz: 0.25, bright: 900 };
  let h = 0;
  for (const ch of spec.id ?? '') h = (h * 31 + ch.charCodeAt(0)) % 997;
  const lean = 0.9 + (h % 21) / 100; // 0.9 to 1.1
  return { freqs: [620 * lean, 780 * lean], level: 0.22, buzz: 0.6, bright: 2600 };
}

export class Horns {
  constructor(params = { ...DEFAULT_HORN_PARAMS }, random = Math.random) {
    this.p = params;
    this.random = random;
    this.clock = 0;
    this.lastDown = false;
    this.lastUp = -Infinity; // when your horn last went quiet
    this.beeps = new Map(); // girl id -> { segments: [[from, to]], end }
    this.nextAnswer = new Map(); // girl id -> earliest time she'll answer again
    this.lastPrank = -Infinity;
    this.jump = null; // { girl, at } Amy about to jump
  }

  /** Is this girl's horn sounding right now? */
  beeping(girl) {
    const b = this.beeps.get(girl);
    return !!b && b.segments.some(([a, z]) => this.clock >= a && this.clock < z);
  }

  /** Is she in the middle of an answer or a blast? */
  busy(girl) {
    return this.beeps.has(girl);
  }

  /**
   * One step. `ctx`:
   *   you: { x, z, honking }          honking: your horn button is down on a quad you drive
   *   girls: [{ id, x, z, yaw, speed, canHonk, driving }]    canHonk: she's on a quad (seated or driving) and can reach the horn; driving: she's at its controls
   * Returns events: { type: 'answer', girl, beeps }, { type: 'creep', girl, victim } (Jess starts her blast),
   *   { type: 'jump', girl } (Amy jumps), { type: 'done', girl }.
   */
  update(dt, ctx) {
    const p = this.p;
    const events = [];
    this.clock += dt;
    for (const [id, b] of this.beeps) {
      if (this.clock >= b.end || !ctx.girls.find((g) => g.id === id)?.canHonk) {
        this.beeps.delete(id);
        events.push({ type: 'done', girl: id });
      }
    }
    if (this.jump && this.clock >= this.jump.at) {
      events.push({ type: 'jump', girl: this.jump.girl });
      this.jump = null;
    }

    const down = !!ctx.you.honking;
    if (!down && this.lastDown) this.lastUp = this.clock;
    const fresh = down && !this.lastDown && this.clock - this.lastUp >= p.pressGap;
    this.lastDown = down;
    if (fresh) {
      for (const g of ctx.girls) {
        if (!g.canHonk || this.beeps.has(g.id) || this.clock < (this.nextAnswer.get(g.id) ?? 0)) continue;
        if (Math.hypot(g.x - ctx.you.x, g.z - ctx.you.z) > p.hearRange) continue;
        if (this.random() >= (p[REPLY_CHANCE[g.id]] ?? 0)) continue;
        this.answer(g, events);
      }
    }
    this.creepUp(dt, ctx, events);
    return events;
  }

  answer(g, events) {
    const p = this.p;
    const count = 1 + Math.floor(this.random() * p.maxBeeps);
    let at = this.clock + p.replyDelayMin + this.random() * Math.max(0, p.replyDelayMax - p.replyDelayMin);
    const segments = [];
    for (let i = 0; i < count; i++) {
      segments.push([at, at + p.beepLength]);
      at += p.beepLength + p.beepGap;
    }
    const end = segments[segments.length - 1][1];
    this.beeps.set(g.id, { segments, end });
    this.nextAnswer.set(g.id, end + p.replyCooldown);
    events.push({ type: 'answer', girl: g.id, beeps: count });
  }

  /** She sounds the horn on her own account (waiting for you): one toot of this length now. */
  toot(id, length) {
    const b = this.beeps.get(id);
    if (b) return false; // already at it
    this.beeps.set(id, { segments: [[this.clock, this.clock + length]], end: this.clock + length });
    return true;
  }

  /** Is Jess close behind Amy, in her rear arc, with Amy driving along? */
  inPosition(jess, amy) {
    const p = this.p;
    if (!jess?.driving || !amy?.driving || amy.speed < p.amyMinSpeed) return false;
    const dx = jess.x - amy.x;
    const dz = jess.z - amy.z;
    const d = Math.hypot(dx, dz);
    if (d > p.creepRange || d < p.creepMin) return false;
    return -(dx * Math.sin(amy.yaw) + dz * Math.cos(amy.yaw)) / d >= p.creepBehind;
  }

  creepUp(dt, ctx, events) {
    const p = this.p;
    const jess = ctx.girls.find((g) => g.id === 'jess');
    const amy = ctx.girls.find((g) => g.id === 'amy');
    if (this.clock < p.prankFirstDelay || this.clock - this.lastPrank < p.prankCooldown || this.beeps.has('jess')) return;
    if (!this.inPosition(jess, amy) || this.random() >= p.prankChance * dt) return;
    this.lastPrank = this.clock;
    this.beeps.set('jess', { segments: [[this.clock, this.clock + p.prankBlast]], end: this.clock + p.prankBlast });
    this.jump = { girl: 'amy', at: this.clock + p.jumpDelay };
    events.push({ type: 'creep', girl: 'jess', victim: 'amy' });
  }
}
