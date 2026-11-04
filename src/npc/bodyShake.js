// Her body giving with the shake: her bust most, her belly, the backs of her upper arms, and her seat and thighs. Each is a damped
// spring thrown by how her chest is jolted about (a bump, landing on a seat, running), plus the seat's own fast heave while she sits
// on something running, which her soft parts can't keep up with: a cold single's slow thump shows as a heavy wobble, a two-stroke's
// buzz as a shiver. How far each part moves is scaled by her figure, so the fuller the shape the more it moves. The model has no bones
// for any of this, so the offsets are added to her vertices in the shader (bodyShakeView.js), weighted by region here. Pure.
// docs/decisions/girls.md, "Bodies that give with the shake (#573)".

export const DEFAULT_BODY_SHAKE_PARAMS = {
  strength: 1, // all of it together: 0 holds her still, 2 twice as much
  maxOffset: 0.035, // metres: about the furthest a part of her moves from where it would be (eased into, and more on a fuller figure)
  response: 0.4, // how much of her chest's jolt throws her soft parts (a rough quad's idle jolts her chest at 20 to 40 m/s²)
  shiver: 0.012, // metres: how far a running seat's heave shakes her at its hardest, the other way from the seat
  shiverRef: 0.006, // metres of the seat's heave that make a hard shake (voiceWobble's): a warm idle is 2 to 4 mm, the green's lumpy one 12 or more
  bustStiffness: 220, // how hard each part is pulled back (per second squared): 220 is about 2.4 swings a second
  bustDamping: 4.5, // how quickly a swing dies away (per second): a bump settles over a couple of swings
  bustGive: 0.75, // how far it moves for a jolt
  bellyStiffness: 320,
  bellyDamping: 7,
  bellyGive: 0.45,
  armStiffness: 280,
  armDamping: 6,
  armGive: 0.5,
  seatStiffness: 260,
  seatDamping: 6,
  seatGive: 0.6,
};

export const BODY_SHAKE_PARAM_RANGES = {
  strength: [0, 3, 0.05],
  maxOffset: [0.005, 0.08, 0.001],
  response: [0, 2, 0.05],
  shiver: [0, 0.04, 0.001],
  shiverRef: [0.001, 0.03, 0.0005],
  bustStiffness: [40, 800, 5],
  bustDamping: [0.5, 20, 0.1],
  bustGive: [0, 3, 0.05],
  bellyStiffness: [40, 800, 5],
  bellyDamping: [0.5, 20, 0.1],
  bellyGive: [0, 3, 0.05],
  armStiffness: [40, 800, 5],
  armDamping: [0.5, 20, 0.1],
  armGive: [0, 3, 0.05],
  seatStiffness: [40, 800, 5],
  seatDamping: [0.5, 20, 0.1],
  seatGive: [0, 3, 0.05],
};

/** The springs, each with its own tuning (`<name>Stiffness`, `<name>Damping`, `<name>Give`). */
export const SPRINGS = ['bust', 'belly', 'arm', 'seat'];

/**
 * The regions the shader moves, each by its spring's offset carried into the bone that region is skinned to (so a sitting girl's
 * thighs bounce up and down, not along their length). The view's attributes hold them in this order.
 */
export const REGIONS = [
  { name: 'bust', spring: 'bust', bone: 'Spine2' },
  { name: 'belly', spring: 'belly', bone: 'Spine' },
  { name: 'armL', spring: 'arm', bone: 'LeftArm' },
  { name: 'armR', spring: 'arm', bone: 'RightArm' },
  { name: 'seat', spring: 'seat', bone: 'Hips' },
  { name: 'thighL', spring: 'seat', bone: 'LeftUpLeg' },
  { name: 'thighR', spring: 'seat', bone: 'RightUpLeg' },
];

export function stillShake() {
  const s = {};
  for (const k of SPRINGS) s[k] = { x: [0, 0, 0], v: [0, 0, 0] };
  return s;
}

const STEP = 1 / 240; // the springs are stepped no coarser than this, so a stiff one stays stable at a low frame rate

/**
 * Steps each spring on by `dt` seconds. `accel`: [x, y, z] how her chest is being accelerated, in world metres per second squared
 * (the part lags behind it, so it is thrown the other way). Changes `state` and returns it.
 */
export function shakeStep(state, accel, dt, p = DEFAULT_BODY_SHAKE_PARAMS) {
  if (!(dt > 0)) return state;
  const n = Math.min(40, Math.ceil(dt / STEP));
  const h = dt / n;
  for (const k of SPRINGS) {
    const stiff = p[`${k}Stiffness`];
    const damp = p[`${k}Damping`];
    const { x, v } = state[k];
    for (let i = 0; i < n; i++) {
      for (let a = 0; a < 3; a++) {
        v[a] += (-accel[a] * p.response - stiff * x[a] - damp * v[a]) * h;
        x[a] += v[a] * h;
      }
    }
    // A teleport or a wild jolt never leaves a spring flung far out.
    for (let a = 0; a < 3; a++) {
      x[a] = Math.max(-0.5, Math.min(0.5, x[a]));
      v[a] = Math.max(-20, Math.min(20, v[a]));
    }
  }
  return state;
}

/** A jolt from nowhere (the debug panel's): each part thrown down at `speed` metres a second, to watch it settle. */
export function jolt(state, speed = 0.5) {
  for (const k of SPRINGS) state[k].v[1] -= speed;
  return state;
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** How much each spring's part moves for her figure (figure.js amounts, 1 the usual): the fuller her bust or hips, the more. */
export function figureGive({ bust = 1, hips = 1 } = {}) {
  return {
    bust: clamp(bust, 0, 2.5) ** 1.5,
    belly: 1,
    arm: 1,
    seat: clamp(hips, 0, 2.5) ** 1.5,
  };
}

/**
 * Where each spring's part is, in world metres from where it would be: the spring, plus the shiver from the seat's `heave` (metres,
 * up, eased so a rough quad's tops out at `shiver`), times its give, her figure's and the whole strength. A big jolt eases into `maxOffset` (times the square root of her
 * figure's give, so a fuller figure still moves further) rather than stopping dead. Fills and returns `out` ({ bust: [x, y, z], ... }).
 */
export function shakeOffsets(state, heave, p = DEFAULT_BODY_SHAKE_PARAMS, figure = {}, out = {}) {
  const give = figureGive(figure);
  for (const k of SPRINGS) {
    const g = p[`${k}Give`] * give[k] * p.strength;
    const { x } = state[k];
    const o = out[k] ?? (out[k] = [0, 0, 0]);
    o[0] = x[0] * g;
    o[1] = (x[1] - p.shiver * Math.tanh(heave / p.shiverRef)) * g;
    o[2] = x[2] * g;
    const len = Math.hypot(o[0], o[1], o[2]);
    const most = p.maxOffset * Math.sqrt(give[k]);
    if (len > 1e-9) for (let a = 0; a < 3; a++) o[a] *= (most * Math.tanh(len / most)) / len;
  }
  return out;
}

const bell = (t) => (Math.abs(t) < 1 ? (1 - t * t) ** 2 : 0);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Where each region is on her, in figure.js's body frame (the hips bone at 0, x to her left, y up, z to her front, a unit her
// hips-to-neck length).
export const SHAKE_SHAPE = {
  bustReach: 0.22, // each breast's region about its apex, across and up and down
  bustFrontFrom: 0, // only the front of her chest moves: none at this z,
  bustFrontTo: 0.15, // all of it from here
  bellyY: 0.28, // her belly's middle, its reach up and down, its half-width
  bellyReach: 0.2,
  bellyWide: 0.24,
  bellyFrontFrom: 0.02,
  bellyFrontTo: 0.12,
  seatY: -0.2, // her seat's fullest and its reach up and down
  seatReach: 0.36,
  seatBackFrom: 0.02, // only behind her: none at this z, all of it from seatBackTo
  seatBackTo: -0.1,
  thighAt: 0.4, // a thigh moves most this far from her hip to her knee
  thighReach: 0.6, // fading out over this much of the way either side
  thigh: 0.8, // and at most this much
};

/**
 * How much each region (REGIONS' order) moves one point of her or her clothes, 0 to 1. `q`: { x, y, z } in the body frame. `skin`: the
 * point's skin weight on her upper arms and thighs ({ armL, armR, legL, legR }). `frame`: from the body ({ apex, arms: { L: {y, z},
 * R }, hip: { y }, knee: { y } }, body frame), with `bust` her figure's bust amount so a fuller one's region is as much bigger as
 * figure.js made it.
 */
export function shakeWeights(q, skin, frame, s = SHAKE_SHAPE) {
  const { apex } = frame;
  const g = Math.max(0.5, 1 + 0.45 * ((frame.bust ?? 1) - 1)); // figure.js's BUST.grow
  const across = Math.abs(q.x) - apex.x;
  const e = (across / (s.bustReach * g)) ** 2 + ((q.y - apex.y) / (s.bustReach * g)) ** 2;
  const bust = e < 1 ? smoothstep(0, 1, 1 - e) * smoothstep(s.bustFrontFrom, s.bustFrontTo, q.z) : 0;
  const belly = bell((q.y - s.bellyY) / s.bellyReach) * bell(q.x / s.bellyWide) * smoothstep(s.bellyFrontFrom, s.bellyFrontTo, q.z) * (1 - bust);
  // The backs of her upper arms: in the bind pose her arms are straight out, so the underside and back of each is below and behind
  // the line from her shoulder to her elbow.
  const under = (side) => {
    const a = frame.arms[side];
    const dy = q.y - a.y;
    const dz = q.z - a.z;
    const r = Math.hypot(dy, dz) || 1;
    return smoothstep(-0.3, 0.8, -(dy + dz) / (r * Math.SQRT2));
  };
  const armL = clamp(skin.armL, 0, 1) * under('L');
  const armR = clamp(skin.armR, 0, 1) * under('R');
  let seat = bell((q.y - s.seatY) / s.seatReach) * smoothstep(s.seatBackFrom, s.seatBackTo, q.z);
  const along = (q.y - frame.hip.y) / (frame.knee.y - frame.hip.y); // 0 at her hip, 1 at her knee
  const thighAt = s.thigh * bell((along - s.thighAt) / s.thighReach);
  let thighL = clamp(skin.legL, 0, 1) * thighAt;
  let thighR = clamp(skin.legR, 0, 1) * thighAt;
  // Her seat and thighs move with one spring: where they overlap they share it rather than adding up.
  const lower = seat + thighL + thighR;
  if (lower > 1) {
    seat /= lower;
    thighL /= lower;
    thighR /= lower;
  }
  return [bust, belly, armL, armR, seat, thighL, thighR];
}
