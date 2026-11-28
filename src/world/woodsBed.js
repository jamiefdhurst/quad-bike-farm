// Hollow Wood's sound (#980): it comes in as the trees close round you, over the same 40 m as the wood's ground (`woods.weight`), and is gone out in
// the open. Birdsong by day, the wind in the canopy, leaves under your wheels in autumn, the pond's drip and its frogs, and a tawny owl from dusk.
// Pure: where you are, the wood (woods.js), the day and the date in, how much of each out; the sound is made on the spot by `audio/woodsAudio.js`.

import { dayBirds } from './riverBed.js';
import { chorusSeason } from './farmBirds.js';

export const DEFAULT_WOODS_SOUND_PARAMS = {
  birdsEvery: 6, // seconds between one wood bird's song and the next, deep in the wood by day in spring, on average
  canopyCalm: 0.3, // how much the canopy sighs in a calm, as a share of a full wind's
  leavesFull: 6, // m/s you move at for the autumn leaves under you to rustle their loudest
  pondReach: 30, // m from the pond's edge at which its drip and frogs have fallen to nothing
  dripEvery: 2.5, // seconds between drips into the pond, stood at its edge
  frogsEvery: 5, // seconds between frogs' croaks at the pond's edge on a spring evening
  owlEvery: 18, // seconds between the tawny owl's calls at dusk
};

export const WOODS_SOUND_RANGES = {
  birdsEvery: [1, 60, 0.5],
  canopyCalm: [0, 1, 0.05],
  leavesFull: [1, 20, 0.5],
  pondReach: [5, 80, 1],
  dripEvery: [0.5, 20, 0.5],
  frogsEvery: [1, 60, 0.5],
  owlEvery: [4, 120, 1],
};

/** Farm months (0 for January) the frogs croak at the pond: from spawning in March to the end of August. */
export const FROG_MONTHS = [2, 7];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** 0..1 how much the tawny owl calls at this darkness: none by day, coming in as the sun sets (darkness 0.5 is the sun on the horizon), thinning to a third in the full dark. */
export const owlCalls = (darkness = 0) => smoothstep(0.45, 0.65, darkness) * (1 - 0.66 * smoothstep(0.85, 1, darkness));

/** Metres a second you move at, from `moved` metres in `dt` seconds: 0 for a jump of over 5 m in a frame (getting on a quad, a `tp`), which is not a ride. */
export function travelSpeed(moved, dt) {
  return dt > 0 && moved <= 5 ? moved / dt : 0;
}

/** About how many metres (x, z) is from the edge of `pond` (an ellipse { x, z, rx, rz }): 0 in it, Infinity with no pond. Near enough for a sound. */
export function pondEdge(pond, x, z) {
  if (!pond) return Infinity;
  const r = Math.hypot((x - pond.x) / pond.rx, (z - pond.z) / pond.rz);
  if (r <= 1) return 0;
  return Math.hypot(x - pond.x, z - pond.z) * (1 - 1 / r); // along the line from its middle, the edge is 1/r of the way out
}

/**
 * What to play at (x, z): `level` 0..1 how far in you are (`woods.weight`); `birds` and `birdsEvery` (seconds, Infinity when none) for the songs; `canopy`
 * the wind in the leaves; `leaves` the autumn litter under you as you move; `pond` 0..1 how near its edge, `pondAt` where it is, `dripEvery` and
 * `frogsEvery`; `owl` and `owlEvery`. `state` is { darkness 0..1, wind 0..1, month (0 January), autumn (bool), speed (m/s you move at), rain 0..1 }.
 */
export function woodsHeard(woods, x, z, state = {}, p = DEFAULT_WOODS_SOUND_PARAMS) {
  const quiet = { level: 0, birds: 0, birdsEvery: Infinity, canopy: 0, leaves: 0, pond: 0, pondAt: null, dripEvery: Infinity, frogsEvery: Infinity, owl: 0, owlEvery: Infinity };
  const level = woods ? woods.weight(x, z) : 0;
  if (level <= 0) return quiet;
  const { darkness = 0, wind = 0, month = 4, autumn = false, speed = 0, rain = 0 } = state;
  const heard = level > 0.05;
  const birds = heard ? level * dayBirds(darkness) * chorusSeason(month) * (1 - 0.7 * clamp01(rain)) : 0;
  const owl = heard ? level * owlCalls(darkness) * (1 - 0.5 * clamp01(rain)) : 0;
  const pond = heard ? (1 - clamp01(pondEdge(woods.pond, x, z) / p.pondReach)) ** 2 : 0;
  const frogs = pond * (month >= FROG_MONTHS[0] && month <= FROG_MONTHS[1] ? 0.5 + 0.5 * smoothstep(0.2, 0.5, darkness) : 0);
  return {
    level,
    birds,
    birdsEvery: birds > 0.05 ? p.birdsEvery / birds : Infinity,
    canopy: level * (p.canopyCalm + (1 - p.canopyCalm) * clamp01(wind)),
    leaves: autumn ? level * clamp01(speed / p.leavesFull) : 0,
    pond,
    pondAt: pond > 0 ? { x: woods.pond.x, z: woods.pond.z } : null,
    dripEvery: pond > 0.05 ? p.dripEvery / pond : Infinity,
    frogsEvery: frogs > 0.05 ? p.frogsEvery / frogs : Infinity,
    owl,
    owlEvery: owl > 0.05 ? p.owlEvery / owl : Infinity,
  };
}
