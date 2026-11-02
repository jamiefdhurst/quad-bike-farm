// Her face: which expression she wears and how far, eased over a fifth of a second. Pure: this gives the pose's channels (brows lifted
// or knitted, the mouth curved, stretched or open, the teeth, the eyes narrowed or screwed shut, the head tipped back), face.js lays
// the brows and mouth to them, the eyelids take `squint` and `squeeze`, and the companion tips her head back.
//
// What sets it, strongest first: a face picked in the debug panel; laughing (a laugh in her voice); a reaction (reactions.js) for its
// length; and her mood (mood.js) as the face she rests in.

/** The channels, each at rest 0. */
export const FACE_CHANNELS = ['lift', 'knit', 'curve', 'wide', 'open', 'teeth', 'squint', 'squeeze', 'headBack'];

/** Each expression, at its fullest. A channel left out stays at rest. */
export const FACE_POSES = {
  rest: {},
  smile: { lift: 0.15, curve: 1, wide: 0.2, squint: 0.22 }, // corners up, the cheeks lifting under the eyes, brows easy
  grimace: { lift: -0.3, knit: 0.8, curve: -0.15, wide: 1, open: 0.35, teeth: 1 }, // wide and flat, teeth showing, brows drawn in
  laugh: { lift: 0.35, curve: 0.8, wide: 0.35, open: 1, teeth: 0.55, squeeze: 1, headBack: 1 }, // open, eyes screwed shut, head back
  scowl: { lift: -0.6, knit: 1, curve: -1 }, // brows down and in, corners down
  surprised: { lift: 1, curve: -0.1, open: 0.55 }, // brows up, mouth dropped open
};

/** The face each reaction (reactions.js REACTIONS) pulls while it lasts. One that isn't here leaves her face to her mood. */
export const REACTION_FACES = {
  flinch: 'grimace',
  stepBack: 'grimace',
  coverEars: 'grimace',
  turnAway: 'grimace',
  gasp: 'surprised',
  cheer: 'laugh',
  wave: 'smile',
  pose: 'smile',
  face: 'grimace', // pulling a face for the camera
  palm: 'scowl',
};

export const DEFAULT_FACE_PARAMS = {
  faceSeconds: 0.2, // seconds a new expression takes to come over her face, or go
  faceMoodFrom: 0.25, // her mood (-1 to 1) past which her resting face starts to smile, or below minus this to scowl
  faceMoodMost: 0.55, // how much of a smile or scowl her mood alone gives her, at its highest or lowest
  faceReact: 1, // how much of a reaction's face she pulls
};

export const FACE_PARAM_RANGES = {
  faceSeconds: [0.05, 1, 0.01],
  faceMoodFrom: [0, 1, 0.05],
  faceMoodMost: [0, 1, 0.05],
  faceReact: [0, 1.5, 0.05],
};

/** The face her mood alone gives her: { pose, weight }. */
export function moodFace(mood, p = DEFAULT_FACE_PARAMS) {
  const over = Math.abs(mood) - p.faceMoodFrom;
  if (over <= 0) return { pose: 'rest', weight: 0 };
  const weight = Math.min(1, over / Math.max(0.01, 1 - p.faceMoodFrom)) * p.faceMoodMost;
  return { pose: mood > 0 ? 'smile' : 'scowl', weight };
}

/**
 * The face she wants now: { pose, weight, over: { pose, weight } }, `over` the stronger face laid over her resting one. `ctx`:
 * `mood` -1..1, `reaction` { type, weight } or null, `laughing`, `held` a pose name picked in the debug panel or null.
 */
export function wantedFace({ mood = 0, reaction = null, laughing = false, held = null } = {}, p = DEFAULT_FACE_PARAMS) {
  const resting = moodFace(mood, p);
  let over = null;
  if (held && FACE_POSES[held]) over = { pose: held, weight: 1 };
  else if (laughing) over = { pose: 'laugh', weight: 1 };
  else if (reaction && REACTION_FACES[reaction.type] && reaction.weight > 0) over = { pose: REACTION_FACES[reaction.type], weight: Math.min(1, reaction.weight * p.faceReact) };
  return { ...resting, over };
}

/** The channels for a wanted face: the resting face, with the stronger one laid over it by its weight. */
export function channelsFor(want) {
  const out = {};
  for (const ch of FACE_CHANNELS) {
    const rest = (FACE_POSES[want.pose]?.[ch] ?? 0) * want.weight;
    const o = want.over;
    out[ch] = o ? rest * (1 - o.weight) + (FACE_POSES[o.pose]?.[ch] ?? 0) * o.weight : rest;
  }
  return out;
}

export class Face {
  constructor(params = { ...DEFAULT_FACE_PARAMS }) {
    this.p = params;
    this.held = null; // a pose picked in the debug panel, or null to let her face follow what's going on
    this.ch = Object.fromEntries(FACE_CHANNELS.map((c) => [c, 0]));
    this.want = { pose: 'rest', weight: 0, over: null };
  }

  /** One step towards what `ctx` (see wantedFace) asks for. Returns the channels. */
  update(dt, ctx = {}) {
    this.want = wantedFace({ ...ctx, held: this.held }, this.p);
    const target = channelsFor(this.want);
    // Most of the way there in `faceSeconds`: exponential, so a pose changing part way through eases on from where it is.
    const k = 1 - Math.exp((-3 * dt) / Math.max(0.01, this.p.faceSeconds));
    for (const c of FACE_CHANNELS) this.ch[c] += (target[c] - this.ch[c]) * k;
    return this.ch;
  }

  /** What she's pulling, in words: the debug panel and the console. */
  describe() {
    const { pose, weight, over } = this.want;
    const top = over && over.weight >= 0.5 ? over : weight > 0.05 ? { pose, weight } : null;
    if (!top) return 'at rest';
    return `${top.pose}${top.weight < 0.95 ? ` (${Math.round(top.weight * 100)}%)` : ''}${this.held ? ', held' : ''}`;
  }
}

/** What the debug panel and the console can hold her face in: 'auto' lets it follow what's going on. */
export const FACE_PICKS = ['auto', ...Object.keys(FACE_POSES)];

/** Holds her face in a pick from FACE_PICKS ('auto' lets it go). */
export function pickFace(face, pick) {
  face.held = pick === 'auto' || !FACE_POSES[pick] ? null : pick;
}
