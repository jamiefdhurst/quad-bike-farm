// What the girls call the quads. Each game Jess gives the quads nicknames, one at a time, early on ("Grandad" for
// the RB300, "the wasp" for the Hornet), and from then on they turn up in what the girls say about a quad. Amy
// pretends not to use them, then slips. Lines are recorded, so a nickname can't be dropped into a sentence at
// runtime: every line that names a quad is written out once for the model's name and once for each possible nickname
// (`expandQuadLines`), and the game picks the version for this game's names. Pure logic.

import { thePhrase } from '../vehicle/names.js';

export const QUAD_PHRASES = Object.fromEntries(['red', 'blue', 'yellow', 'green', 'orange', 'kids', 'loan', 'moto', 'atc'].map((id) => [id, thePhrase(id)]));

// Two to pick from for each, so a game gets one of them. Each reads in "That's ___" and "Come on, ___".
export const NICKNAMES = {
  red: ['Postie', 'the tomato'],
  blue: ['Smurf', 'Bluebell'],
  yellow: ['the wasp', 'Custard'],
  green: ['Grandad', 'Kermit'],
  orange: ['the satsuma', 'Tango'],
  kids: ['Tiddler', 'the pram'],
  loan: ['Lucky', 'the loaner'],
  moto: ['Pogo', 'the bumblebee'],
  atc: ['the tripod', 'Wobbles'],
};

export const DEFAULT_NAME_PARAMS = {
  firstNameAfter: 25, // seconds into the game before Jess names the first quad
  nameEvery: 40, // seconds between her naming one and the next
  nameRange: 30, // metres: she names a quad while she's free and you're this close to her
  amyHolds: 4, // times Amy would have used a nickname and doesn't, before she slips
};

export const NAME_PARAM_RANGES = {
  firstNameAfter: [0, 300, 5],
  nameEvery: [5, 300, 5],
  nameRange: [5, 100, 1],
  amyHolds: [0, 12, 1],
};

const capital = (s) => s[0].toUpperCase() + s.slice(1);

/** Key of the line for a situation about this quad, said with this nickname (or none: the model's name). */
export const quadKey = (kind, specId, nick = null) => (nick ? `${kind}:${specId}:${nick}` : `${kind}:${specId}`);

/**
 * Written-out situations for templates of lines about a quad. `templates` is { kind: { cooldown, lines } }; `{q}` in a
 * line is the quad ("the RB300", "Grandad"), `{Q}` the same with a capital. Each template is written out for
 * the colour and for every nickname, under `quadKey(kind, specId, nick)`.
 */
export function expandQuadLines(templates) {
  const out = {};
  for (const [kind, entry] of Object.entries(templates)) {
    for (const specId of Object.keys(QUAD_PHRASES)) {
      for (const nick of [null, ...NICKNAMES[specId]]) {
        const q = nick ?? QUAD_PHRASES[specId];
        out[quadKey(kind, specId, nick)] = { cooldown: entry.cooldown, lines: entry.lines.map((l) => l.replaceAll('{Q}', capital(q)).replaceAll('{q}', q)) };
      }
    }
  }
  return out;
}

export class QuadNames {
  /**
   * @param {string[]} specIds  the quads in this game
   * @param {object} [opts] { params, random }
   */
  constructor(specIds, { params = { ...DEFAULT_NAME_PARAMS }, random = Math.random } = {}) {
    this.p = params;
    this.random = random;
    this.names = {};
    for (const id of specIds) {
      const pool = NICKNAMES[id];
      if (pool) this.names[id] = pool[Math.floor(random() * pool.length)];
    }
    this.announced = new Set(); // quads Jess has named out loud
    this.clock = 0;
    this.nextAt = params.firstNameAfter;
    this.amyHeld = 0; // times she's kept to the colour
    this.amyCaved = false;
  }

  /** Its nickname, once Jess has said it. */
  nameOf(specId) {
    return this.announced.has(specId) ? this.names[specId] : null;
  }

  /**
   * One step. `ctx`: { jessFree, youNear, candidates: spec ids Jess could name now, nearest first }.
   * Returns { type: 'name', specId, nick } when Jess names one.
   */
  update(dt, ctx) {
    this.clock += dt;
    if (this.clock < this.nextAt || !ctx.jessFree || !ctx.youNear) return null;
    const specId = ctx.candidates.find((id) => this.names[id] && !this.announced.has(id));
    if (!specId) return null;
    this.announced.add(specId);
    this.nextAt = this.clock + this.p.nameEvery;
    return { type: 'name', specId, nick: this.names[specId] };
  }

  /**
   * What `girl` calls this quad when she mentions it: { nick, slip }. nick is its nickname or null for the colour. Amy
   * holds out for `amyHolds` mentions, then the next one slips (slip: true) and from then on she uses them.
   */
  refer(girl, specId) {
    const nick = this.nameOf(specId);
    if (!nick || girl !== 'amy' || this.amyCaved) return { nick, slip: false };
    return this.amyHeld < this.p.amyHolds ? { nick: null, slip: false } : { nick, slip: true };
  }

  /** She did mention it, as `refer` said: that's what counts towards Amy holding out, or slipping. */
  mentioned(girl, specId, referred) {
    if (girl !== 'amy' || this.amyCaved || !this.nameOf(specId)) return;
    if (referred.slip) this.amyCaved = true;
    else this.amyHeld++;
  }
}
