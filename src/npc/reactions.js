// How she reacts with her body. Something sudden near her makes her move: a bang makes her flinch, a quad lurching at her makes her
// step back, revs right beside her make her cover her ears, a quad going over makes her gasp, someone's jump makes her cheer, and
// smoke makes her turn away. Most come from the notices attention.js already gets (NOTICE_REACTIONS); a feature can also start one
// directly (companion.react). Pure: which reaction, if any, and how strongly it shows over its life. companionReacting.js poses it.
//
// The pattern (CLAUDE.md, "The girls' minds"): a notice kind that should make her move gets a rule here; a new reaction type goes in
// REACTIONS with a pose in companionReacting.js, who may do it in mayReact there, and a debug button in girlActions.js.

/** Each reaction: how long it lasts (seconds), how soon it's full on and how long it eases off at the end, and what it takes. */
export const REACTIONS = {
  flinch: { seconds: 0.9, rise: 0.08, fall: 0.5, needs: 'any' }, // shoulders up, head down, arms in
  stepBack: { seconds: 1.1, rise: 0.1, fall: 0.6, needs: 'feet' }, // a quick hop or two away from it, arms up
  coverEars: { seconds: 2.2, rise: 0.25, fall: 0.5, needs: 'hands' }, // both hands over her ears
  gasp: { seconds: 2.4, rise: 0.2, fall: 0.6, needs: 'hands' }, // both hands to her mouth
  cheer: { seconds: 2.2, rise: 0.2, fall: 0.5, needs: 'hands' }, // arms up (or a clap, as her cheerArms says)
  turnAway: { seconds: 3, rise: 0.4, fall: 0.8, needs: 'feet' }, // turns her face away and waves it off (smoke)
  wave: { seconds: 2.6, rise: 0.3, fall: 0.5, needs: 'hands' }, // a hand up, waving at someone going by
  pose: { seconds: 3.4, rise: 0.3, fall: 0.6, needs: 'hands' }, // a hand on her hip, head tilted, for the camera
  face: { seconds: 3.4, rise: 0.25, fall: 0.5, needs: 'hands' }, // both hands up by her cheeks, head wobbling, pulling a face for the camera
  palm: { seconds: 3, rise: 0.2, fall: 0.6, needs: 'hands' }, // a flat hand up in front of her face: put that away
};

/**
 * Which notices (attention.js NOTICE_KINDS) make her react, and how: within (metres of her), minStrength (the notice's strength),
 * chance (a number, or the name of her param that holds it), notOwn (not for the vehicle she's on: you don't cheer your own jump).
 */
export const NOTICE_REACTIONS = {
  backfire: { reaction: 'flinch', within: 20 },
  bang: { reaction: 'flinch', within: 20 },
  spitBack: { reaction: 'flinch', within: 4 },
  pop: { reaction: 'flinch', within: 3, chance: 0.3 },
  horn: { reaction: 'flinch', within: 4, chance: 0.6, notOwn: true },
  lurch: { reaction: 'stepBack', within: 3.5, notOwn: true },
  boilOver: { reaction: 'stepBack', within: 4, notOwn: true },
  rev: { reaction: 'coverEars', within: 5, minStrength: 0.8, chance: 'reactEarsChance', notOwn: true },
  tipped: { reaction: 'gasp', within: 40, notOwn: true },
  pheasant: { reaction: 'flinch', within: 14, chance: 'reactStartleChance' },
  zap: { reaction: 'flinch', within: 25, notOwn: true },
  jump: { reaction: 'cheer', within: 45, chance: 'reactCheerChance', notOwn: true },
  traffic: { reaction: 'wave', within: 45, chance: 'reactWaveChance' },
};

/** Stronger things take over from weaker ones already under way. */
const RANK = { wave: 1, pose: 1, face: 1, palm: 1, cheer: 1, turnAway: 1, coverEars: 2, gasp: 2, flinch: 3, stepBack: 4 };

/**
 * The reaction a notice gets from her, or null. `ctx`: distance (metres from her), own (it's the vehicle she's on), can(type) (whether
 * she's free to do that one now), current (the reaction under way, if any: { type, t }). `p` her params (the chances).
 */
export function reactionTo(notice, ctx, p, random = Math.random) {
  const rule = NOTICE_REACTIONS[notice.kind];
  if (!rule || ctx.distance > rule.within) return null;
  if (rule.notOwn && ctx.own) return null;
  if ((notice.strength ?? 1) < (rule.minStrength ?? 0)) return null;
  if (!mayInterrupt(rule.reaction, ctx.current)) return null;
  if (!ctx.can(rule.reaction)) return null;
  const chance = typeof rule.chance === 'string' ? p[rule.chance] : rule.chance ?? 1;
  if (random() >= chance) return null;
  return { type: rule.reaction, from: { x: notice.x, y: notice.y, z: notice.z }, strength: Math.min(1.5, notice.strength ?? 1) };
}

/** Whether `type` can start while `current` ({ type, t }) is under way: nothing on, it's nearly over, or the new one ranks higher. */
export function mayInterrupt(type, current) {
  if (!current) return true;
  const r = REACTIONS[current.type];
  if (current.t >= r.seconds - r.fall) return true;
  return RANK[type] > RANK[current.type];
}

/** How far into showing it she is (0..1) at `t` seconds: up quickly, held, eased off at the end. 0 once it's over. */
export function reactionWeight(type, t) {
  const r = REACTIONS[type];
  if (!r || t < 0 || t >= r.seconds) return 0;
  const up = r.rise > 0 ? Math.min(1, t / r.rise) : 1;
  const down = r.fall > 0 ? Math.min(1, (r.seconds - t) / r.fall) : 1;
  const k = Math.min(up, down);
  return k * k * (3 - 2 * k);
}
