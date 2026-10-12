// The girls' movements that the model's clips don't have: getting on and off things, how they sit on each seat, and the ways they
// stand about. Pure data and maths (no Three.js), tested in tests/poseMoves.test.js; the rig turns a pose into bone rotations
// (CharacterRig.applyPose) and the companion moves her along a move's path (companionMoves.js).
//
// A pose is { bones, hands }:
//   bones  { boneName: [x, y, z] } radians about her own axes (x her left, y up, z forward), layered on top of whatever the clips do.
//          A child bone's turn is about the axes as its parent's turn left them, so a knee bends the same way however the hip is
//          turned. Signs, for the left side (mirrored for the right): UpLeg -x thigh forward, +x back, +z out to her left; Leg +x
//          bends the knee; Spine +x leans forward, +z leans to her right; Arm -x forward, +z out; ForeArm -x bends the elbow.
//   hands  { left, right }: { frame, at: [x, y, z], pole: [x, y, z], w } puts that hand at `at` (metres, in `frame`) with the elbow
//          toward `pole`, by weight w; with `fingers` and `palm` (directions in the frame) the hand is turned that way too. Frames: 'hips' and 'chest' (her hips or upper back, her own axes), 'seat' (the seat she's
//          getting on, its own axes: x its left, z its front).
//
// A move is a list of keys over its run from 0 (stood on the ground) to 1 (sat down). Besides the pose each key says:
//   over   0..1 how far her hips have gone from where she stood to over the seat
//   along  0..1 of the fore-and-aft part of that, where it differs (over the footboard first, then back onto the pillion); `over` if unsaid
//   lift   0..1 of the move's lift height, added on top (a foot up on the footrest, up onto the trailer)
//   sit    0..1 from the standing clip to the sitting one
//   turn   0..1 from the way she stood to the way the seat faces
//   twist  0..1 of an extra turn the companion works out (turned away from the seat, to sit back onto it)
//   spread 0..1 of her legs' spread astride the seat
// Keys are authored for getting on from the seat's left; from the right they're mirrored. Getting off plays them backwards.

export const BONES = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot',
];
const PATH_KEYS = ['over', 'along', 'lift', 'sit', 'turn', 'twist', 'spread'];
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, k) => a + (b - a) * k;
const flipX = (v) => [-v[0], v[1], v[2]];
const lerpVec = (u, v, k) => u.map((x, i) => lerp(x, v[i], k));

/** Swaps left and right: Left and Right bones trade places, turns about y and z change sign, and so does x in hand positions. */
export function mirrorPose(pose) {
  const swap = (name) => (name.startsWith('Left') ? 'Right' + name.slice(4) : name.startsWith('Right') ? 'Left' + name.slice(5) : name);
  const bones = {};
  for (const [name, [x, y, z]] of Object.entries(pose.bones ?? {})) bones[swap(name)] = [x, -y, -z];
  const hands = {};
  for (const [side, h] of Object.entries(pose.hands ?? {})) {
    const m = { ...h, at: flipX(h.at), pole: flipX(h.pole) };
    if (h.fingers) Object.assign(m, { fingers: flipX(h.fingers), palm: flipX(h.palm) });
    hands[side === 'left' ? 'right' : 'left'] = m;
  }
  return { bones, hands };
}

/** a + b * k, bone by bone; hands from b (by weight k) where a has none, otherwise a's. */
export function addPose(a, b, k = 1) {
  const bones = { ...a.bones };
  for (const [name, v] of Object.entries(b.bones ?? {})) {
    const o = bones[name] ?? [0, 0, 0];
    bones[name] = [o[0] + v[0] * k, o[1] + v[1] * k, o[2] + v[2] * k];
  }
  const hands = { ...a.hands };
  for (const [side, h] of Object.entries(b.hands ?? {})) if (!hands[side] || hands[side].w < 1e-3) hands[side] = { ...h, w: h.w * k };
  return { bones, hands };
}

export const EMPTY_POSE = Object.freeze({ bones: Object.freeze({}), hands: Object.freeze({}) });

/** The pose between two keys' poses, k of the way from a to b. A hand in only one of them fades in or out where it is. */
function blendPose(a, b, k) {
  const bones = {};
  const names = new Set([...Object.keys(a.bones ?? {}), ...Object.keys(b.bones ?? {})]);
  for (const name of names) {
    const u = a.bones?.[name] ?? [0, 0, 0];
    const v = b.bones?.[name] ?? [0, 0, 0];
    bones[name] = [lerp(u[0], v[0], k), lerp(u[1], v[1], k), lerp(u[2], v[2], k)];
  }
  const hands = {};
  for (const side of ['left', 'right']) {
    const u = a.hands?.[side];
    const v = b.hands?.[side];
    if (!u && !v) continue;
    const from = u ?? { ...v, w: 0 };
    const to = v ?? { ...u, w: 0 };
    hands[side] = {
      frame: k < 0.5 ? from.frame : to.frame,
      at: lerpVec(from.at, to.at, k),
      pole: lerpVec(from.pole, to.pole, k),
      w: lerp(from.w ?? 1, to.w ?? 1, k),
    };
    // The hand's turn, where either says one (only while it's held there, so a turned hand fades with its weight).
    const turned = from.fingers ? from : to.fingers ? to : null;
    if (turned) {
      hands[side].fingers = from.fingers && to.fingers ? lerpVec(from.fingers, to.fingers, k) : turned.fingers;
      hands[side].palm = from.palm && to.palm ? lerpVec(from.palm, to.palm, k) : turned.palm;
    }
  }
  return { bones, hands };
}

/**
 * A move at `t` (0..1), eased between its keys, mirrored when `side` is -1.
 * @returns {{over: number, lift: number, sit: number, turn: number, twist: number, spread: number, pose: object}}
 */
export function sampleMove(move, t, side = 1) {
  const keys = move.keys;
  t = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[i + 1] ?? a;
  const k = b.t > a.t ? smooth((t - a.t) / (b.t - a.t)) : 1;
  const out = {};
  const value = (key, name) => key[name] ?? (name === 'along' ? key.over : 0) ?? 0;
  for (const name of PATH_KEYS) out[name] = lerp(value(a, name), value(b, name), k);
  const pose = blendPose(a.pose ?? EMPTY_POSE, b.pose ?? EMPTY_POSE, k);
  out.pose = side < 0 ? mirrorPose(pose) : pose;
  return out;
}

/** b / a, or 0 when a is nothing: how far along a part-done move's span `b` is, for running it back from where it got to. */
export function shareOf(b, a) {
  return a > 1e-3 ? Math.min(1, b / a) : 0;
}

// Hands on the seat, in the seat's frame: she's on its left, reaching across.
const SEAT_HANDS = {
  right: { frame: 'seat', at: [0.02, -0.04, 0.3], pole: [0.6, 0.2, -0.3], w: 1 },
  left: { frame: 'seat', at: [0.16, -0.04, -0.12], pole: [0.8, 0.3, 0.2], w: 1 },
};
const fade = (hands, w) => Object.fromEntries(Object.entries(hands).map(([s, h]) => [s, { ...h, w }]));

export const MOVES = {
  // Astride a quad, a three-wheeler or the mini moto, from its left: hands on the seat, a foot up on the footrest, the right leg
  // swung up behind and over, and down onto the seat.
  legOver: {
    liftFrom: 'mount', // which of the companion's lift heights (liftHeight in companionMoves.js)
    keys: [
      { t: 0 },
      { t: 0.2, over: 0.06, along: 0, turn: 1, pose: { bones: { Spine: [0.12, 0, 0.04], Spine1: [0.1, 0, 0.04] }, hands: fade(SEAT_HANDS, 0.8) } },
      {
        t: 0.4, over: 0.28, along: 0, lift: 1, sit: 0.08, turn: 1,
        pose: {
          bones: { Spine: [0.25, 0, 0.12], Spine1: [0.2, 0, 0.08], RightUpLeg: [0.35, 0, -0.35], RightLeg: [0.7, 0, 0], LeftLeg: [0.15, 0, 0] },
          hands: SEAT_HANDS,
        },
      },
      {
        t: 0.6, over: 0.62, along: 0.3, lift: 0.5, sit: 0.2, turn: 1, spread: 0.2,
        pose: {
          bones: { Spine: [0.3, 0, 0.14], Spine1: [0.18, 0, 0.08], RightUpLeg: [-0.35, 0, -1.25], RightLeg: [1.35, 0, 0], LeftLeg: [0.25, 0, 0] },
          hands: SEAT_HANDS,
        },
      },
      {
        t: 0.8, over: 0.94, along: 0.85, lift: 0.1, sit: 0.65, turn: 1, spread: 0.75,
        pose: { bones: { Spine: [0.15, 0, 0.04], RightUpLeg: [-0.1, 0, -0.35], RightLeg: [0.5, 0, 0] }, hands: fade(SEAT_HANDS, 0.4) },
      },
      { t: 1, over: 1, sit: 1, turn: 1, spread: 1 },
    ],
  },

  // Sitting back onto a seat she can't straddle (side-saddle on the back, the front rack): turned away from it, hands back on it,
  // a little hop up, and round to face the way she'll sit.
  hopOn: {
    liftFrom: 'hop',
    keys: [
      { t: 0 },
      {
        t: 0.3, over: 0.2, turn: 1, twist: 1,
        pose: {
          bones: { Spine: [0.2, 0, 0], Spine1: [0.1, 0, 0], LeftLeg: [0.2, 0, 0], RightLeg: [0.2, 0, 0], LeftUpLeg: [-0.1, 0, 0], RightUpLeg: [-0.1, 0, 0] },
          hands: {
            left: { frame: 'seat', at: [0.22, 0.0, 0.2], pole: [0.2, 0.3, 0.6], w: 0.9 },
            right: { frame: 'seat', at: [0.22, 0.0, -0.2], pole: [0.2, 0.3, -0.6], w: 0.9 },
          },
        },
      },
      {
        t: 0.62, over: 0.85, lift: 1, sit: 0.6, turn: 1, twist: 1,
        pose: {
          bones: { Spine: [0.1, 0, 0], LeftUpLeg: [-0.3, 0, 0], RightUpLeg: [-0.3, 0, 0], LeftLeg: [0.5, 0, 0], RightLeg: [0.5, 0, 0] },
          hands: {
            left: { frame: 'seat', at: [0.1, 0.0, 0.25], pole: [0.2, 0.3, 0.6], w: 1 },
            right: { frame: 'seat', at: [0.1, 0.0, -0.25], pole: [0.2, 0.3, -0.6], w: 1 },
          },
        },
      },
      { t: 0.82, over: 1, lift: 0.15, sit: 0.95, turn: 1, twist: 0.55 },
      { t: 1, over: 1, sit: 1, turn: 1 },
    ],
  },

  // Into a bench seat behind a door (the UTV, the Land Rover), from its left: the right foot in and up on the sill, ducking under
  // the roof, in onto the seat turning to face forward, and the other leg in after.
  stepIn: {
    liftFrom: 'step',
    keys: [
      { t: 0 },
      {
        t: 0.28, over: 0.12, lift: 0.3, turn: 0.45,
        pose: {
          bones: { Spine: [0.2, 0, 0.1], Spine1: [0.15, 0, 0.05], Neck: [0.15, 0, 0], RightUpLeg: [-0.95, 0, -0.25], RightLeg: [1.25, 0, 0] },
          hands: { right: { frame: 'seat', at: [0.1, 0.05, 0.05], pole: [0.6, 0.2, -0.3], w: 0.8 } },
        },
      },
      {
        t: 0.52, over: 0.55, lift: 1, sit: 0.3, turn: 0.7,
        pose: {
          bones: { Spine: [0.3, 0, 0.1], Spine1: [0.2, 0, 0.05], Neck: [0.2, 0, 0], RightUpLeg: [-0.7, 0, -0.15], RightLeg: [1.0, 0, 0], LeftUpLeg: [0.25, 0, 0], LeftLeg: [0.5, 0, 0] },
          hands: { right: { frame: 'seat', at: [-0.05, 0.02, 0.1], pole: [0.6, 0.2, -0.3], w: 1 } },
        },
      },
      {
        t: 0.78, over: 0.95, lift: 0.4, sit: 0.85, turn: 0.95,
        pose: { bones: { Spine: [0.15, 0, 0], Neck: [0.1, 0, 0], LeftUpLeg: [-0.5, 0, -0.2], LeftLeg: [1.0, 0, 0] } },
      },
      { t: 1, over: 1, sit: 1, turn: 1 },
    ],
  },

  // Into the 200TDi's back bench: in at the door past the tipped front seat, then back to the bench, ducking lower under the roof.
  // The stepIn move, with the fore-and-aft part (`along`) held back until she's through the door.
  stepInBack: {
    liftFrom: 'step',
    keys: [
      { t: 0 },
      {
        t: 0.25, over: 0.15, along: 0.02, lift: 0.3, turn: 0.3,
        pose: {
          bones: { Spine: [0.35, 0, 0.1], Spine1: [0.25, 0, 0.05], Neck: [0.2, 0, 0], RightUpLeg: [-0.95, 0, -0.25], RightLeg: [1.25, 0, 0] },
          hands: { right: { frame: 'seat', at: [0.1, 0.05, 0.25], pole: [0.6, 0.2, -0.3], w: 0.6 } },
        },
      },
      {
        t: 0.5, over: 0.6, along: 0.25, lift: 1, sit: 0.2, turn: 0.55,
        pose: {
          bones: { Spine: [0.45, 0, 0.1], Spine1: [0.3, 0, 0.05], Neck: [0.25, 0, 0], RightUpLeg: [-0.7, 0, -0.15], RightLeg: [1.0, 0, 0], LeftUpLeg: [0.25, 0, 0], LeftLeg: [0.5, 0, 0] },
          hands: { right: { frame: 'seat', at: [-0.05, 0.02, 0.1], pole: [0.6, 0.2, -0.3], w: 1 } },
        },
      },
      {
        t: 0.78, over: 0.95, along: 0.85, lift: 0.4, sit: 0.85, turn: 0.95,
        pose: { bones: { Spine: [0.25, 0, 0], Neck: [0.15, 0, 0], LeftUpLeg: [-0.5, 0, -0.2], LeftLeg: [1.0, 0, 0] } },
      },
      { t: 1, over: 1, along: 1, sit: 1, turn: 1 },
    ],
  },

  // Up onto something high (the bale trailer, the tractor's arch or seat, the UTV's bed): facing it, hands on the edge, a knee up,
  // hauled up, and turned round to sit.
  climbUp: {
    liftFrom: 'climb',
    keys: [
      { t: 0 },
      {
        t: 0.25, over: 0.08, lift: 0.15,
        pose: {
          bones: { Spine: [0.3, 0, 0], Spine1: [0.15, 0, 0], RightUpLeg: [-1.25, 0, -0.1], RightLeg: [1.7, 0, 0] },
          hands: {
            left: { frame: 'hips', at: [0.2, 0.3, 0.42], pole: [0.6, -0.2, 0.2], w: 0.9 },
            right: { frame: 'hips', at: [-0.2, 0.3, 0.42], pole: [-0.6, -0.2, 0.2], w: 0.9 },
          },
        },
      },
      {
        t: 0.55, over: 0.55, lift: 1, sit: 0.15,
        pose: {
          bones: { Spine: [0.45, 0, 0], Spine1: [0.2, 0, 0], RightUpLeg: [-0.6, 0, -0.1], RightLeg: [1.0, 0, 0], LeftUpLeg: [-1.1, 0, 0.1], LeftLeg: [1.5, 0, 0] },
          hands: {
            left: { frame: 'hips', at: [0.2, 0.0, 0.35], pole: [0.6, 0.2, 0.0], w: 1 },
            right: { frame: 'hips', at: [-0.2, 0.0, 0.35], pole: [-0.6, 0.2, 0.0], w: 1 },
          },
        },
      },
      { t: 0.8, over: 0.92, lift: 0.5, sit: 0.6, turn: 0.6, pose: { bones: { Spine: [0.15, 0, 0] } } },
      { t: 1, over: 1, sit: 1, turn: 1 },
    ],
  },
};

// How she sits, on top of the sitting clip, by the kind of seat. Mirrored for side-saddle on the right.
export const SEAT_POSES = {
  // Astride a quad: thighs down toward the footrests and the feet tucked back onto them, sat up.
  astride: { bones: { LeftUpLeg: [0.3, 0, 0], RightUpLeg: [0.3, 0, 0], LeftLeg: [0.25, 0, 0], RightLeg: [0.25, 0, 0], Spine: [-0.04, 0, 0] } },
  // On the front rack, legs together over the front.
  rack: { bones: { LeftUpLeg: [0.15, 0, 0], RightUpLeg: [0.15, 0, 0], LeftLeg: [0.1, 0, 0], RightLeg: [0.1, 0, 0] } },
  // Side-saddle on the back, legs to her left: knees together, ankles crossed toward the ground.
  side: { bones: { LeftUpLeg: [0.25, 0, -0.08], RightUpLeg: [0.25, 0, 0.12], LeftLeg: [0.15, 0, 0], RightLeg: [0.2, 0, 0] } },
  // A bench seat with a floor in front: as the clip has it, a touch more relaxed.
  bench: { bones: { Spine: [-0.06, 0, 0], LeftUpLeg: [0, 0, 0.06], RightUpLeg: [0, 0, -0.06] } },
};

// Ways of standing about. `hold` is the pose while it lasts; `wave` adds a swing (amplitudes over `period` seconds, a list of them
// for limbs out of step with each other, each with its `phase` as a fraction of a period), and `short` ones only last a few
// seconds. Authored with her left as the busy side, mirrored at random unless `fixedSide`.
export const STANDING_IDLES = {
  // Arms folded across her chest.
  folded: {
    hold: {
      bones: { Spine1: [-0.03, 0, 0] },
      hands: {
        // Each hand tucked round the other arm, fingers back and the palm against it.
        left: { frame: 'chest', at: [-0.13, -0.07, 0.11], pole: [0.5, -0.3, 0.05], fingers: [-0.35, -0.1, -0.9], palm: [-1, 0, 0], w: 1 },
        right: { frame: 'chest', at: [0.13, -0.1, 0.1], pole: [-0.5, -0.35, 0.05], fingers: [0.35, -0.1, -0.9], palm: [1, 0, 0], w: 1 },
      },
    },
    wave: { period: 5.5, bones: { Spine: [0.02, 0, 0] } },
  },
  // Hands clasped low in front of her.
  clasped: {
    hold: {
      hands: {
        left: { frame: 'hips', at: [0.03, -0.04, 0.17], pole: [0.5, -0.1, -0.1], w: 1 },
        right: { frame: 'hips', at: [-0.03, -0.06, 0.18], pole: [-0.5, -0.1, -0.1], w: 1 },
      },
    },
    wave: { period: 6, bones: { Spine: [0, 0.03, 0] } },
  },
  // Weight on one foot, the other knee eased, the hip dropped: shifted from one to the other now and then.
  weight: {
    hold: { bones: { Hips: [0, 0, 0.07], Spine: [0, 0, -0.06], Spine1: [0, 0, -0.03], RightUpLeg: [-0.12, 0, 0.04], RightLeg: [0.28, 0, 0], RightFoot: [-0.12, 0, 0] } },
    wave: { period: 7, bones: { Hips: [0, 0, 0.015] } },
  },
  // Hands on her hips, elbows out.
  hips: {
    hold: {
      bones: { Spine: [-0.03, 0, 0] },
      hands: {
        left: { frame: 'hips', at: [0.17, 0.07, 0.02], pole: [0.7, 0.15, -0.25], w: 1 },
        right: { frame: 'hips', at: [-0.17, 0.07, 0.02], pole: [-0.7, 0.15, -0.25], w: 1 },
      },
    },
    wave: { period: 4, bones: { Spine: [0, 0.04, 0] } },
  },
  // Hands behind her back, rocking on her heels.
  rock: {
    hold: {
      hands: {
        left: { frame: 'hips', at: [0.06, 0.0, -0.16], pole: [0.5, 0, -0.4], w: 1 },
        right: { frame: 'hips', at: [-0.06, 0.0, -0.17], pole: [-0.5, 0, -0.4], w: 1 },
      },
    },
    wave: { period: 1.7, bones: { Hips: [0.05, 0, 0], LeftFoot: [-0.08, 0, 0], RightFoot: [-0.08, 0, 0], Spine: [-0.03, 0, 0] } },
  },
  // Scuffing at the ground with the toe of one welly.
  scuff: {
    hold: { bones: { Hips: [0, 0, -0.04], LeftUpLeg: [-0.1, 0, 0.03], LeftLeg: [0.3, 0, 0], LeftFoot: [0.35, 0, 0], Head: [0.25, 0, 0] } },
    wave: { period: 1.3, bones: { LeftUpLeg: [-0.12, 0, 0.05], LeftLeg: [0.12, 0, 0] } },
  },
  // A big stretch, arms up over her head.
  stretch: {
    short: true,
    hold: {
      bones: { Spine: [-0.1, 0, 0], Spine1: [-0.06, 0, 0], Head: [-0.15, 0, 0] },
      hands: {
        left: { frame: 'chest', at: [0.1, 0.6, 0.02], pole: [0.6, 0.3, 0], w: 1 },
        right: { frame: 'chest', at: [-0.1, 0.6, 0.02], pole: [-0.6, 0.3, 0], w: 1 },
      },
    },
  },
  // One hand in her back pocket, weight on the other foot.
  pocket: {
    hold: {
      bones: { Hips: [0, 0, -0.05], Spine: [0, 0, 0.04], LeftUpLeg: [-0.08, 0, -0.03], LeftLeg: [0.2, 0, 0] },
      hands: { left: { frame: 'hips', at: [0.12, -0.05, -0.13], pole: [0.5, 0, -0.35], w: 1 } },
    },
    wave: { period: 5, bones: { Spine: [0, 0.04, 0] } },
  },
  // Ways of waiting that fit what's about her (waiting.js says when): turned to the thing by companionWaiting.js.
  // Kicking a tyre with the toe of her welly, twice.
  kickTyre: {
    short: true,
    hold: { bones: { Hips: [0, 0, -0.04], Spine: [-0.06, 0, 0], LeftUpLeg: [-0.45, 0, 0.02], LeftLeg: [0.35, 0, 0], LeftFoot: [-0.15, 0, 0] } },
    wave: { period: 1.1, bones: { LeftUpLeg: [-0.32, 0, 0], LeftLeg: [-0.35, 0, 0] } },
  },
  // Wiping the seat in front of her with the flat of her hand, leant over it.
  wipeSeat: {
    hold: {
      bones: { Spine: [0.3, 0, 0], Spine1: [0.12, 0, 0], LeftUpLeg: [-0.05, 0, 0], RightLeg: [0.1, 0, 0] },
      hands: { left: { frame: 'hips', at: [0.08, -0.1, 0.46], pole: [0.6, 0.3, -0.2], fingers: [-0.3, 0, 1], palm: [0, -1, 0], w: 1 } },
    },
    move: { period: 0.9, hands: { left: [0.12, 0, 0.03] } },
  },
  // Rubbing her hands together in front of her for the cold, shoulders up.
  rubHands: {
    hold: {
      bones: { Spine1: [0.08, 0, 0], Neck: [0.1, 0, 0], LeftShoulder: [0, 0, 0.08], RightShoulder: [0, 0, -0.08] },
      hands: {
        left: { frame: 'chest', at: [0.025, -0.1, 0.24], pole: [0.6, -0.4, 0], fingers: [0, 0.6, 0.8], palm: [-1, 0, 0], w: 1 },
        right: { frame: 'chest', at: [-0.025, -0.1, 0.24], pole: [-0.6, -0.4, 0], fingers: [0, 0.6, 0.8], palm: [1, 0, 0], w: 1 },
      },
    },
    move: { period: 0.4, hands: { left: [0, 0.035, 0.01], right: [0, -0.035, -0.01] } },
  },
  // A hand flat over her brow against the sun, looking out.
  shadeEyes: {
    hold: {
      bones: { Spine1: [-0.04, 0, 0], Hips: [0, 0, 0.04] },
      hands: { left: { frame: 'chest', at: [0.03, 0.34, 0.15], pole: [0.8, 0.1, 0.1], fingers: [-1, 0, 0.25], palm: [0, -1, 0], w: 1 } },
    },
    wave: { period: 5, bones: { Spine: [0, 0.06, 0] } },
  },
  // Looking up at the sky as it clouds over, leant back a touch (the head's tilt is attention's, at a point up there).
  lookUp: {
    short: true,
    hold: { bones: { Spine: [-0.06, 0, 0], Spine1: [-0.05, 0, 0], Neck: [-0.15, 0, 0] } },
  },
  // Her phone held in her right hand in front of her, looking down at it (companionWaiting.js puts the phone there).
  phone: {
    fixedSide: true,
    hold: {
      bones: { Neck: [0.15, 0, 0], Spine1: [0.04, 0, 0] },
      hands: { right: { frame: 'chest', at: [-0.04, -0.14, 0.3], pole: [-0.6, -0.5, -0.2], fingers: [0.1, 0.35, 1], palm: [0, 1, 0.2], w: 1 } },
    },
    wave: { period: 6, bones: { Spine: [0, 0.03, 0] } },
  },
  // Her phone held to her ear, a hand on her hip, turned a little away (phoneCalls.js forces it; companionWaiting.js puts the phone there).
  phoneCall: {
    fixedSide: true,
    hold: {
      bones: { Neck: [0, -0.1, 0.12], Spine1: [0, 0.05, 0] },
      hands: {
        right: { frame: 'chest', at: [-0.13, 0.36, 0.1], pole: [-1, 0.3, -0.3], fingers: [0.1, 0.35, 1], palm: [1, 0.3, 0], w: 1 },
        left: { frame: 'hips', at: [0.2, 0, 0.05], pole: [0.8, 0, -0.4], fingers: [0.2, 0.4, 0.6], palm: [-1, 0, 0], w: 1 },
      },
    },
    wave: { period: 4, bones: { Spine: [0, 0.04, 0] } },
  },
};

// Ways of sitting a while, on top of the sitting clip and the seat's pose: on a bench (the UTV, the Land Rover), or perched with
// her legs hanging (the bales, the tip trailer's tub, the UTV's tailgate, a quad's front rack, the tractor's arch). Hands in the
// hips frame are placed for the sitting clip, her thighs out level in front of her.
export const SEATED_IDLES = {
  // Arms folded, as stood.
  folded: { hold: { hands: STANDING_IDLES.folded.hold.hands }, wave: { period: 6, bones: { Spine1: [0.02, 0, 0] } } },
  // Hands resting on her knees.
  handsOnKnees: {
    hold: {
      bones: { Spine: [0.08, 0, 0] },
      hands: {
        left: { frame: 'hips', at: [0.12, 0.02, 0.3], pole: [0.5, 0.1, -0.2], fingers: [0, -0.3, 1], palm: [0, -1, 0], w: 1 },
        right: { frame: 'hips', at: [-0.12, 0.02, 0.3], pole: [-0.5, 0.1, -0.2], fingers: [0, -0.3, 1], palm: [0, -1, 0], w: 1 },
      },
    },
  },
  // One ankle over the other, knees together.
  anklesCrossed: {
    hold: { bones: { LeftUpLeg: [0, 0, -0.07], RightUpLeg: [0, 0, 0.05], LeftLeg: [0.12, 0, 0], RightLeg: [-0.05, 0, 0], LeftFoot: [0, 0, -0.1] } },
  },
  // Leant back on her hands, behind her on the seat.
  leanBack: {
    hold: {
      bones: { Spine: [-0.22, 0, 0], Spine1: [-0.06, 0, 0], Head: [0.12, 0, 0] },
      hands: {
        left: { frame: 'hips', at: [0.22, -0.06, -0.22], pole: [0.5, 0.3, 0.2], fingers: [0.1, 0, -1], palm: [0, -1, 0], w: 1 },
        right: { frame: 'hips', at: [-0.22, -0.06, -0.22], pole: [-0.5, 0.3, 0.2], fingers: [-0.1, 0, -1], palm: [0, -1, 0], w: 1 },
      },
    },
    perch: true, // needs a seat with no back to it
  },
  // Hands behind her head, elbows out, leant back.
  handsBehindHead: {
    hold: {
      bones: { Spine: [-0.12, 0, 0], Head: [-0.05, 0, 0] },
      hands: {
        left: { frame: 'chest', at: [0.07, 0.3, -0.14], pole: [0.7, 0.3, 0.15], fingers: [-1, 0.2, 0], palm: [0, 0, 1], w: 1 },
        right: { frame: 'chest', at: [-0.07, 0.3, -0.14], pole: [-0.7, 0.3, 0.15], fingers: [1, 0.2, 0], palm: [0, 0, 1], w: 1 },
      },
    },
    wave: { period: 7, bones: { Head: [0, 0.08, 0] } },
  },
  // Jiggling one knee, restless.
  kneeJiggle: {
    hold: { bones: { LeftLeg: [0.1, 0, 0], LeftFoot: [-0.25, 0, 0] } },
    wave: { period: 0.28, bones: { LeftUpLeg: [-0.035, 0, 0] } },
  },
  // Swinging her legs, out of step.
  swingLegs: {
    hold: { bones: { Spine: [0.05, 0, 0] } },
    wave: [
      { period: 1.5, bones: { LeftLeg: [0.3, 0, 0] } },
      { period: 1.5, phase: 0.5, bones: { RightLeg: [0.3, 0, 0] } },
    ],
    perch: true, // only with her legs hanging free
  },
  // Slouched down on the bench, legs out.
  slouch: {
    hold: { bones: { Spine: [-0.18, 0, 0], Spine1: [0.06, 0, 0], Head: [0.1, 0, 0], LeftLeg: [-0.25, 0, 0], RightLeg: [-0.25, 0, 0], LeftUpLeg: [0.08, 0, 0.05], RightUpLeg: [0.08, 0, -0.05] } },
    bench: true,
  },
  // An elbow out on the door top, at the window seat.
  elbowOut: {
    hold: {
      bones: { Spine: [0, 0, -0.08] },
      hands: { left: { frame: 'hips', at: [0.3, 0.24, 0.3], pole: [0.8, -0.2, -0.3], fingers: [0.2, 0, 1], palm: [0, -1, 0], w: 1 } },
    },
    fixedSide: true,
    window: true, // only by a door
  },
};

/** An idle's pose at `time` seconds into it, by weight, mirrored when `side` is -1. */
export function idlePose(name, time, side = 1, weight = 1, library = STANDING_IDLES) {
  const idle = library[name];
  if (!idle || weight <= 0) return EMPTY_POSE;
  let pose = addPose(EMPTY_POSE, idle.hold, weight);
  for (const w of [idle.wave ?? []].flat()) pose = addPose(pose, { bones: w.bones }, weight * Math.sin((time / w.period + (w.phase ?? 0)) * Math.PI * 2));
  // Hands moving to and fro (wiping, rubbing): metres added to where each is held, in its own frame.
  if (idle.move) {
    const k = Math.sin((time / idle.move.period) * Math.PI * 2);
    const hands = { ...pose.hands };
    for (const [side, d] of Object.entries(idle.move.hands)) if (hands[side]) hands[side] = { ...hands[side], at: hands[side].at.map((v, i) => v + d[i] * k) };
    pose = { bones: pose.bones, hands };
  }
  return side < 0 && !idle.fixedSide ? mirrorPose(pose) : pose;
}

/** Of a list of seated idles, the ones that suit a seat: `kind` 'bench' or 'perch', and whether it's beside a door. */
export function seatedIdlesFor(names, kind, window = false) {
  return names.filter((n) => {
    const idle = SEATED_IDLES[n];
    return idle && !(idle.perch && kind !== 'perch') && !(idle.bench && kind !== 'bench') && !(idle.window && !window);
  });
}

export const DEFAULT_IDLE_POSE_PARAMS = {
  idlePoseGapMin: 2, // seconds stood plainly between one way of standing and the next
  idlePoseGapMax: 7,
  idlePoseHoldMin: 4, // seconds she stands each way
  idlePoseHoldMax: 10,
  idlePoseShortHold: 2.2, // seconds for a quick one (a stretch)
  idlePoseBlend: 0.7, // seconds to ease into or out of one
};

export const IDLE_POSE_PARAM_RANGES = {
  idlePoseGapMin: [0, 30, 0.5],
  idlePoseGapMax: [0, 60, 0.5],
  idlePoseHoldMin: [0.5, 30, 0.5],
  idlePoseHoldMax: [0.5, 60, 0.5],
  idlePoseShortHold: [0.5, 10, 0.1],
  idlePoseBlend: [0.1, 3, 0.05],
};

/**
 * Picks her ways of standing about from her own list while she's stood still: a gap, eased into one, held, eased out, another gap.
 * Anything else she does (walking off, warming her hands) eases it out quickly. With SEATED_IDLES for `library`, ways of sitting.
 */
export class StandingIdles {
  constructor(names, params = DEFAULT_IDLE_POSE_PARAMS, random = Math.random, library = STANDING_IDLES) {
    this.library = library;
    this.names = names.filter((n) => library[n]);
    this.weights = null; // name -> how likely, against 1 for the others (setChoices); null and they're all as likely
    this.params = params;
    this.random = random;
    this.name = null;
    this.side = 1;
    this.weight = 0;
    this.time = 0; // seconds into the current one
    this.left = this.between(params.idlePoseGapMin, params.idlePoseGapMax); // seconds until the next starts, or the current one ends
  }

  between(a, b) {
    return a + (b - a) * this.random();
  }

  /** Steps it on. `standing` is whether she's stood about with nothing else to do. Returns the pose to layer on. */
  update(dt, standing) {
    const p = this.params;
    const rate = dt / Math.max(0.05, p.idlePoseBlend);
    if (!standing) {
      this.weight = Math.max(0, this.weight - rate * 2);
      if (this.weight === 0) {
        this.name = null;
        this.left = Math.max(this.left, p.idlePoseGapMin);
      }
    } else if (this.name) {
      this.left -= dt;
      this.weight = this.left > 0 ? Math.min(1, this.weight + rate) : Math.max(0, this.weight - rate);
      if (this.left <= 0 && this.weight === 0) {
        this.name = null;
        this.left = this.between(p.idlePoseGapMin, p.idlePoseGapMax);
      }
    } else if (this.names.length && (this.left -= dt) <= 0) {
      const choices = this.names.length > 1 ? this.names.filter((n) => n !== this.last) : this.names;
      this.begin(this.pick(choices));
    }
    if (this.name) this.time += dt;
    return this.name ? idlePose(this.name, this.time, this.side, smooth(this.weight), this.library) : EMPTY_POSE;
  }

  /** One of `choices` at random, by weight. */
  pick(choices) {
    const w = (n) => this.weights?.[n] ?? 1;
    let r = this.random() * choices.reduce((sum, n) => sum + w(n), 0);
    for (const n of choices) if ((r -= w(n)) < 0) return n;
    return choices[choices.length - 1];
  }

  begin(name) {
    const p = this.params;
    this.name = name;
    this.last = name;
    this.side = this.random() < 0.5 ? -1 : 1;
    this.time = 0;
    this.weight = Math.min(this.weight, 0.3);
    this.left = this.library[name].short ? p.idlePoseShortHold : this.between(p.idlePoseHoldMin, p.idlePoseHoldMax);
  }

  /** Changes her list (a different seat); one that no longer suits is eased out. */
  setNames(names) {
    this.names = names.filter((n) => this.library[n]);
    if (this.name && !this.names.includes(this.name)) this.left = Math.min(this.left, 0);
  }

  /** Changes her list with how likely each is ([{ name, weight }], waiting.js); one that no longer suits is eased out. */
  setChoices(choices) {
    this.weights = Object.fromEntries(choices.map((c) => [c.name, c.weight]));
    this.setNames(choices.map((c) => c.name));
  }

  /** Starts one now (the debug panel), whatever was going on. */
  force(name) {
    if (!this.library[name]) return false;
    if (!this.names.includes(name)) this.names = [...this.names, name];
    this.begin(name);
    return true;
  }
}
