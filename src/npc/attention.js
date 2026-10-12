// What she looks at. Each frame she is handed what is around her (people and moving vehicles), what she is busy with (her focus),
// where she is about to go (her intent) and anything that has just happened near her (notices: an engine catching, a backfire, a
// horn). This scores each by how much it would catch a real person's eye and picks one to look at: she holds it a moment rather than
// flicking about, tires of a thing she has looked at for a while and comes back to it later (which is what makes her glance at you
// now and then), and something startling turns her head at once. Pure: no Three.js. companion.js turns the pick into a head turn.
//
// The pattern for anything new the girls do (CLAUDE.md, "The girls' minds"): something that happens in the world calls
// game.notice(kind, ...) with a kind from NOTICE_KINDS; a state says what she looks at while in it (its `look`); a sub-activity
// inside a state calls companion.attend(...); walking to somewhere looks there first on its own.

/**
 * What can happen near her. seconds: how long it stays worth looking at; range: metres within which she notices it at all; heard:
 * noticed by ear from any direction (otherwise she has to be more or less facing it); interest: the girl's param that scales it
 * (how much she cares about that sort of thing), if any. How much each catches the eye is DEFAULT_NOTICE_PARAMS[kind].
 */
export const NOTICE_KINDS = {
  engineStart: { seconds: 2.5, range: 45, heard: true, interest: 'attentionEngines' }, // an engine catching
  stall: { seconds: 2, range: 40, heard: true, interest: 'attentionEngines' }, // an engine dying (or seizing)
  backfire: { seconds: 2.5, range: 80, heard: true, interest: 'attentionEngines' },
  pop: { seconds: 1.2, range: 30, heard: true, interest: 'attentionEngines' }, // a pop on the overrun
  spitBack: { seconds: 2, range: 35, heard: true, interest: 'attentionEngines' }, // a cold engine spitting back through the carb
  boilOver: { seconds: 4, range: 40, heard: false, interest: 'attentionEngines' }, // steam off a radiator
  rev: { seconds: 1.2, range: 40, heard: true, interest: 'attentionEngines' }, // a stood engine blipped
  horn: { seconds: 2, range: 90, heard: true },
  tipped: { seconds: 4, range: 60, heard: true, interest: 'attentionVehicles' }, // a vehicle going over
  lurch: { seconds: 1.5, range: 15, heard: false, interest: 'attentionVehicles' }, // a vehicle leaping forward from a standstill (a clutch dropped, a kangaroo hop)
  jump: { seconds: 3, range: 50, heard: false, interest: 'attentionVehicles' }, // a vehicle landing after real air
  traffic: { seconds: 4, range: 70, heard: true }, // something going by on the lane, or a visitor coming in at the gate
  pheasant: { seconds: 2.5, range: 40, heard: true }, // one bursting out of the hedge in a clatter of wings
  zap: { seconds: 2.5, range: 50, heard: true }, // someone catching the electric fence
  photo: { seconds: 3, range: 20, heard: false }, // you raising the camera: she looks at you
  bang: { seconds: 2.5, range: 80, heard: true }, // anything else loud and sudden (and the debug panel's test noise)
};

/** How much each kind catches the eye (the "What catches the eye" tuning, shared by both girls), and how revs are noticed. */
export const DEFAULT_NOTICE_PARAMS = {
  engineStart: 0.9,
  stall: 0.8,
  backfire: 1.8,
  pop: 0.45,
  spitBack: 1.2,
  boilOver: 1.3,
  rev: 0.7,
  horn: 1.4,
  tipped: 1.8,
  lurch: 1.3,
  jump: 1.2,
  traffic: 0.9,
  photo: 1.5,
  pheasant: 1.6,
  zap: 1.7,
  bang: 1.8,
  revThrottle: 0.2, // how far the throttle has to be opened for climbing revs to count as a vehicle being revved (an idle never does)
  revAbove: 0.2, // and how far up the rev range above its idle (0 idle, 1 flat out) the revs have to get
  revBaseSeconds: 1.5, // seconds the idle it's measured from takes to follow the revs with the throttle shut (a choke's fast idle)
  revEvery: 1.2, // seconds between rev notices from one vehicle
  revMaxSpeed: 0.5, // m/s: moving faster than this during it, it was pulling away, not being revved
  lurchAccel: 3.5, // m/s per second of sudden speeding up, from slow, that counts as a lurch
  lurchMaxSpeed: 4, // m/s: only from slower than this
  lurchEvery: 1, // seconds between lurch notices from one vehicle
  jumpMinAir: 0.35, // seconds in the air for a landing to count as a jump
};

export const NOTICE_PARAM_RANGES = {
  ...Object.fromEntries(Object.keys(NOTICE_KINDS).map((k) => [k, [0, 4, 0.05]])),
  revThrottle: [0.02, 1, 0.01],
  revAbove: [0.02, 1, 0.01],
  revBaseSeconds: [0.1, 10, 0.1],
  revEvery: [0.1, 5, 0.1],
  revMaxSpeed: [0, 5, 0.1],
  lurchAccel: [0.5, 15, 0.5],
  lurchMaxSpeed: [0.5, 10, 0.5],
  lurchEvery: [0.1, 5, 0.1],
  jumpMinAir: [0.05, 2, 0.05],
};

const TAU = Math.PI * 2;

/** The turn (radians, -pi..pi) from heading `from` to heading `to`. */
export function turnBetween(from, to) {
  return ((((to - from + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

/** The heading (as her root's rotation.y: 0 faces +z) from (x, z) to (tx, tz). */
export function headingTo(x, z, tx, tz) {
  return Math.atan2(tx - x, tz - z);
}

/** 1 close by, falling to 0.3 at `range`, 0 beyond. */
function reach(d, range) {
  return d > range ? 0 : 1 - 0.7 * (d / range);
}

/** How well she sees something `off` radians from where she faces: fully within the fov, down to `behind` straight behind her. */
function sight(off, p) {
  const a = Math.abs(off);
  if (a <= p.attentionFov) return 1;
  return 1 - (1 - p.attentionBehind) * Math.min(1, (a - p.attentionFov) / (Math.PI - p.attentionFov));
}

/**
 * Everything she could look at this frame, scored. `view` (all positions as { x, y, z }):
 *   self: where her eyes are; facing: her heading
 *   people: [{ key, x, y, z, speaking, talkingToMe, warmth }] (you are key 'you'; warmth 0..1, how she feels about you)
 *   vehicles: [{ key, x, y, z, speed }] moving ones, not counting the one she's on
 *   focus: { x, y, z, weight } what she's busy with, or null
 *   intent: { x, y, z } where she's about to go, or null; noGaze: true to leave out looking about (her head is busy)
 * `notices` are the live ones, with their ages; `about` a point out in front of her to gaze at when nothing else is worth it (null for
 * none). Returns [{ key, kind, x, y, z, score, startling, habituates }].
 */
export function candidates(view, notices, p, noticeParams = DEFAULT_NOTICE_PARAMS, about = null) {
  const out = [];
  const { self } = view;
  const offOf = (c) => turnBetween(view.facing, headingTo(self.x, self.z, c.x, c.z));
  const dist = (c) => Math.hypot(c.x - self.x, c.z - self.z);
  for (const n of notices) {
    const kind = NOTICE_KINDS[n.kind];
    if (!kind) continue;
    const d = dist(n);
    const fresh = Math.max(0, 1 - (n.age / kind.seconds) ** 2);
    const seen = kind.heard ? 1 : sight(offOf(n), p);
    const interest = kind.interest ? p[kind.interest] : 1;
    const salience = noticeParams[n.kind] ?? 1;
    const score = salience * (n.strength ?? 1) * fresh * reach(d, kind.range) * seen * interest;
    if (score > 0) out.push({ key: n.key, kind: n.kind, x: n.x, y: n.y, z: n.z, score, startling: salience * (n.strength ?? 1) >= p.attentionStartle && n.age < 0.5, habituates: false });
  }
  for (const who of view.people ?? []) {
    const you = who.key === 'you';
    const d = dist(who);
    if (who.talkingToMe) {
      out.push({ key: who.key, kind: 'talking', x: who.x, y: who.y, z: who.z, score: p.attentionTalking, startling: false, habituates: false });
      continue;
    }
    let base = you ? p.attentionYou * (1 + p.attentionFavour * (who.warmth ?? 0)) : p.attentionFriend;
    // Someone talking is heard from any direction; otherwise she has to see them.
    const seen = who.speaking ? Math.max(0.7, sight(offOf(who), p)) : sight(offOf(who), p);
    if (who.speaking) base += p.attentionSpeaker;
    const score = base * reach(d, p.attentionRange) * seen;
    if (score > 0) out.push({ key: who.key, kind: who.speaking ? 'speaking' : you ? 'you' : 'friend', x: who.x, y: who.y, z: who.z, score, startling: false, habituates: !who.speaking });
  }
  for (const v of view.vehicles ?? []) {
    const moving = Math.min(1, v.speed / p.attentionVehicleSpeed);
    if (moving <= 0.05) continue;
    const score = p.attentionVehicles * moving * reach(dist(v), p.attentionRange) * sight(offOf(v), p);
    if (score > 0) out.push({ key: `vehicle:${v.key}`, kind: 'vehicle', x: v.x, y: v.y, z: v.z, score, startling: false, habituates: true });
  }
  if (view.focus) {
    const f = view.focus;
    out.push({ key: 'focus', kind: 'focus', x: f.x, y: f.y, z: f.z, score: p.attentionFocus * (f.weight ?? 1), startling: false, habituates: true });
  }
  if (view.intent) {
    const t = view.intent;
    out.push({ key: 'intent', kind: 'intent', x: t.x, y: t.y, z: t.z, score: p.attentionIntent, startling: false, habituates: false });
  }
  if (about) out.push({ key: 'about', kind: 'about', x: about.x, y: about.y, z: about.z, score: p.attentionIdle, startling: false, habituates: true });
  return out;
}

export class Attention {
  /** `p` is her params (the attention* keys, companionParams.js); `noticeParams` how much each kind catches the eye. */
  constructor(p, noticeParams = DEFAULT_NOTICE_PARAMS, random = Math.random) {
    this.p = p;
    this.noticeParams = noticeParams;
    this.random = random;
    this.about = null; // the point she gazes at when nothing else is worth it, picked afresh each time she goes back to gazing
    this.notices = []; // [{ kind, key, x, y, z, strength, age }]
    this.habit = new Map(); // key -> seconds she has looked at it lately (fading while she looks elsewhere)
    this.current = null; // what she's looking at: { key, kind, x, y, z, score, held, turnTo }
  }

  /**
   * Something happened: { kind (a NOTICE_KINDS key), key (what made it, so a second one from the same thing refreshes the first),
   * x, y, z, strength (1 usual) }. Unknown kinds are ignored (a test checks every kind the game uses is known).
   */
  notice(n) {
    if (!NOTICE_KINDS[n.kind]) return;
    const key = `${n.kind}:${n.key ?? ''}`;
    const old = this.notices.find((o) => o.key === key);
    if (old) Object.assign(old, { x: n.x, y: n.y, z: n.z, strength: Math.max(n.strength ?? 1, old.age < 0.5 ? old.strength : 0), age: 0 });
    else this.notices.push({ kind: n.kind, key, x: n.x, y: n.y, z: n.z, strength: n.strength ?? 1, age: 0 });
  }

  /** One frame: picks what she looks at (see `candidates` for `view`). Returns `current` (null: nothing in particular). */
  update(dt, view) {
    const p = this.p;
    for (const n of this.notices) n.age += dt;
    this.notices = this.notices.filter((n) => n.age < NOTICE_KINDS[n.kind].seconds);
    // Somewhere out in front to gaze at, new each time she comes back to it.
    if (this.current?.key !== 'about') {
      const h = view.facing + (this.random() * 2 - 1) * p.attentionGazeSpread;
      this.about = { x: view.self.x + Math.sin(h) * 15, y: view.self.y - 0.4, z: view.self.z + Math.cos(h) * 15 };
    }
    const all = candidates(view, this.notices, p, this.noticeParams, view.noGaze ? null : this.about);
    for (const c of all) if (c.habituates) c.score /= 1 + (this.habit.get(c.key) ?? 0) / p.attentionHabit;

    let best = null;
    for (const c of all) if (c.score >= p.attentionMin && (!best || c.score > best.score)) best = c;
    const cur = this.current && all.find((c) => c.key === this.current.key && c.score >= p.attentionMin);
    let next = best;
    if (cur && best && best.key !== cur.key) {
      // Hold what she's looking at for a moment, and only switch for something clearly better, unless it made her jump.
      const settled = this.current.held >= p.attentionDwell;
      if (!best.startling && (!settled || best.score < cur.score * (1 + p.attentionSwitch))) next = cur;
    }
    const held = next && this.current && next.key === this.current.key ? this.current.held + dt : 0;

    // Tiring of what she's looking at; getting her interest back in everything else.
    const fade = Math.exp(-dt / p.attentionRecover);
    for (const [k, v] of this.habit) {
      const nv = k === next?.key ? v : v * fade;
      if (nv < 0.01) this.habit.delete(k);
      else this.habit.set(k, nv);
    }
    if (next) this.habit.set(next.key, (this.habit.get(next.key) ?? 0) + dt);

    if (!next) return (this.current = null);
    const heading = headingTo(view.self.x, view.self.z, next.x, next.z);
    const off = turnBetween(view.facing, heading);
    // Held a while and too far round to look at over her shoulder: she turns to face it (where she's free to).
    const turnTo = held >= p.attentionBodyAfter && Math.abs(off) > p.attentionBodyYaw && !['focus', 'intent', 'about'].includes(next.kind) ? heading : null;
    this.current = { key: next.key, kind: next.kind, x: next.x, y: next.y, z: next.z, score: next.score, held, turnTo };
    return this.current;
  }

  /** What she's looking at, for the debug panel and the console. */
  describe() {
    const c = this.current;
    if (!c) return 'nothing in particular';
    const what = c.kind === 'vehicle' ? `a moving ${c.key.slice(8)}` : c.kind === 'talking' ? 'you, talking to her' : c.kind === 'speaking' ? `${c.key}, talking` : c.kind === 'you' ? 'you' : c.kind === 'friend' ? c.key : c.kind === 'focus' ? 'what she is doing' : c.kind === 'intent' ? 'where she is going' : c.kind === 'about' ? 'looking about' : `a ${c.kind} (${c.key.split(':')[1] || 'somewhere'})`;
    return `${what}, ${c.held.toFixed(1)} s${c.turnTo !== null ? ', turning to it' : ''}`;
  }
}
