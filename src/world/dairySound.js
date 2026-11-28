// What the neighbour's dairy yard sounds like at a given hour (#965), pure: where each sound comes from in her yard (`dairySpots`), which of them
// are going now (`dairyPlan`, on the milking clock of dairyDay.js), whether one is near enough to be made at all (`keepSound`) and how much a
// building's wall between it and you dulls it (`muffleFor`). audio/dairyAudio.js makes the sounds; world/neighbourHost.js feeds it each frame.

import { DEFAULT_MILKING_PARAMS, MILKING_PARAM_RANGES, milkingAt } from './dairyDay.js';

export const DEFAULT_DAIRY_SOUND_PARAMS = {
  ...DEFAULT_MILKING_PARAMS,
  volume: 0.6, // 0..1 the whole yard's sounds
  machineVolume: 0.5, // the milking machine's pulse and the vacuum pump, against the rest
  compressorVolume: 0.35, // the bulk tank's cooling compressor
  radioVolume: 0.3, // the radio in the parlour
  windVolume: 0.5, // the wind in the barn's sheeting, at a strong wind
  compressorCycle: 20, // minutes between the compressor's runs by day, once the milk is cooled
  compressorRun: 4, // minutes each of those runs lasts
  compressorAfter: 60, // minutes it runs on after a milking, cooling the new milk
  nightFrom: 22, // hours: from here to the morning milking the compressor rests and the yard is quiet
  feedMinutes: 20, // minutes her loader tractor ticks over after each milking while she feeds and scrapes
  mooEvery: 14, // s between cows lowing while the herd is in
  hoofEvery: 2.5, // s between hooves shuffling on the concrete while the herd is in
  barkEvery: 80, // s between her dog's barks by day
  troughEvery: 150, // s between the water trough's valve filling it by day
  range: 80, // m beyond her yard's wall past which none of its sounds is made (the issue's limit)
};

export const DAIRY_SOUND_PARAM_RANGES = {
  ...MILKING_PARAM_RANGES,
  volume: [0, 1, 0.05],
  machineVolume: [0, 1, 0.05],
  compressorVolume: [0, 1, 0.05],
  radioVolume: [0, 1, 0.05],
  windVolume: [0, 1, 0.05],
  compressorCycle: [5, 60, 1],
  compressorRun: [1, 20, 1],
  compressorAfter: [0, 180, 5],
  nightFrom: [19, 24, 0.25],
  feedMinutes: [0, 60, 1],
  mooEvery: [3, 60, 1],
  hoofEvery: [0.5, 10, 0.5],
  barkEvery: [10, 600, 10],
  troughEvery: [20, 900, 10],
  range: [20, 80, 1],
};

/**
 * Every sound of her yard: `kind` 'loop' (made while it is going and you are in range) or 'once' (one at a time, now and then), the metres from
 * it that it is heard within (`within`; and never from further than the `range` param beyond the yard's wall), `ref` the metres within which a
 * loop is at its full level (the panner's refDistance: a bigger machine carries further), and its `label` for the panel and the console.
 */
export const DAIRY_SOUNDS = {
  pulse: { kind: 'loop', within: 80, ref: 8, label: 'the milking machine\'s pulse' },
  vacuum: { kind: 'loop', within: 95, ref: 8, label: 'the vacuum pump' },
  compressor: { kind: 'loop', within: 100, ref: 12, label: 'the bulk tank\'s compressor' }, // from her gateway it is 90 m off, across the yard
  radio: { kind: 'loop', within: 35, ref: 3, label: 'the radio in the parlour' },
  wind: { kind: 'loop', within: 60, ref: 10, label: 'the wind in the barn\'s sheeting' },
  moo: { kind: 'once', within: 80, label: 'a cow lowing' },
  hooves: { kind: 'once', within: 40, label: 'hooves on the concrete' },
  bark: { kind: 'once', within: 80, label: 'her dog barking' },
  trough: { kind: 'once', within: 30, label: 'the water trough filling' },
  tractor: { kind: 'once', within: 80, label: 'her tractor ticking over' },
};

export const DAIRY_SOUND_NAMES = Object.keys(DAIRY_SOUNDS);

const piece = (shape, kind) => shape.furniture?.find((f) => f.kind === kind);

/**
 * Where each sound comes from, from her yard's shape (world/neighbourFarm.js): { name: { x, y, z, inside } } with y above the yard's ground. The
 * milking sounds are in the parlour (the pulse along its pit, the pump at its east end by the tank room), the compressor on the tank room's
 * outside wall, the wind in the barn's sheeting, the herd in the collecting yard (`spread` the half size to pick a cow's place in), the dog at
 * its kennel, the trough at the water trough and the tractor where her loader tractor stands. A farm without the dairy gives none of the
 * dairy's (only the barn, the dog and the tractor if it has them).
 */
export function dairySpots(shape) {
  const out = {};
  const p = shape.parlour;
  if (p) {
    out.pulse = { x: p.x, y: 1.2, z: p.z, inside: 'parlour' };
    out.vacuum = { x: p.x + p.halfX - 2, y: 0.8, z: p.z, inside: 'parlour' };
    out.radio = { x: p.x - p.halfX * 0.4, y: 2.2, z: p.z - p.halfZ + 0.6, inside: 'parlour' };
  }
  const t = shape.tankRoom;
  if (t) out.compressor = { x: t.x + t.halfX + 0.6, y: 0.9, z: t.z, inside: null };
  const b = shape.barn;
  if (b) out.wind = { x: b.x, y: b.wallHeight - 0.5, z: b.z, inside: 'barn' };
  const c = shape.collecting;
  if (c) {
    const mid = { x: (c.minX + c.maxX) / 2, y: 1.3, z: (c.minZ + c.maxZ) / 2, inside: null, spread: { x: (c.maxX - c.minX) / 2 - 1, z: (c.maxZ - c.minZ) / 2 - 1 } };
    out.moo = mid;
    out.hooves = { ...mid, y: 0.1 };
  }
  const kennel = piece(shape, 'kennel');
  if (kennel) out.bark = { x: kennel.x, y: 0.5, z: kennel.z, inside: null };
  const trough = piece(shape, 'waterTrough');
  if (trough) out.trough = { x: trough.x, y: 0.5, z: trough.z, inside: null };
  const tractor = shape.parked?.find((v) => v.kind === 'loaderTractor') ?? shape.parked?.find((v) => v.kind === 'tractor');
  if (tractor) out.tractor = { x: tractor.x, y: 1.4, z: tractor.z, inside: null };
  return out;
}

/** Which of her buildings (x, z) is inside: 'parlour', 'tankRoom', 'barn', 'house' or null. */
export function buildingAt(shape, x, z) {
  const inR = (r) => r && x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;
  if (inR(shape.parlour?.outer)) return 'parlour';
  if (inR(shape.tankRoom?.outer)) return 'tankRoom';
  if (inR(shape.barn?.outer)) return 'barn';
  if (inR(shape.house?.outer)) return 'house';
  return null;
}

/**
 * 0..1 how much a wall dulls a sound: none when it and you are in the same place (both outdoors, or both in the parlour), most when it is in a
 * building and you are not in that one, and a good deal when you are indoors and it is out in the yard. The barn's sheeting is the wind's own
 * noise, so it is only a little dulled from outside.
 */
export function muffleFor(sourceIn, listenerIn) {
  if (sourceIn === listenerIn) return 0;
  if (sourceIn === 'barn') return 0.3;
  if (sourceIn) return 1;
  return 0.7;
}

/** How far (x, z) is outside her yard's wall, 0 inside it. */
export function outsideYard(shape, x, z) {
  const r = shape.outline;
  return Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));
}

/**
 * Whether to keep (or start) making a sound `distance` m away while you are `outside` m beyond her yard's wall: within its reach and the range
 * to start, a few metres more before one already made is dropped, so it doesn't flicker on and off at the edge; never past the range.
 */
export function keepSound(made, distance, within, outside = 0, p = DEFAULT_DAIRY_SOUND_PARAMS) {
  if (outside >= p.range) return false;
  return made ? distance < within + 5 && outside < p.range : distance < within && outside < p.range - 3;
}

/**
 * What is going at `hour`: `loops` { pulse, vacuum, compressor, radio, wind } each a level 0..1 (0 off), and `every` { moo, hooves, bark,
 * trough, tractor } the seconds between one and the next (Infinity for none). `wind` is the weather's wind (about 0.5 still to 1.5 a gale),
 * `away` that she is out calling at the farm, `forced` { name: true } the sounds the panel or the console has started whatever the hour.
 */
export function dairyPlan(hour, { wind = 0, away = false, forced = {} } = {}, p = DEFAULT_DAIRY_SOUND_PARAMS) {
  const m = milkingAt(hour, p);
  const h = ((hour % 24) + 24) % 24;
  const milking = m.phase === 'milking';
  const herdIn = milking; // the herd waits in the collecting yard on the clock, she or no
  const machine = milking && !away; // she milks only when she is at home
  const night = h >= p.nightFrom || h < p.morning;
  const cooling = milking || m.phase === 'walkOut' || m.sinceMilking * 60 < p.compressorAfter;
  const cycling = !night && ((h * 60) % p.compressorCycle) < p.compressorRun;
  const windLevel = Math.max(0, Math.min(1, (wind - 0.6) / 0.9));
  const feeding = !away && m.phase === 'none' && m.sinceMilking * 60 < p.feedMinutes;
  const loops = {
    pulse: machine ? 1 : 0,
    vacuum: machine ? 1 : 0,
    compressor: cooling || cycling ? 1 : 0,
    radio: m.phase !== 'none' && !away ? 1 : 0,
    wind: windLevel < 0.05 ? 0 : windLevel,
  };
  const every = {
    moo: herdIn ? p.mooEvery : m.phase !== 'none' ? p.mooEvery * 3 : Infinity, // a cow or two calls on the walk in and out too
    hooves: herdIn ? p.hoofEvery : Infinity,
    bark: night ? Infinity : p.barkEvery,
    trough: night ? Infinity : herdIn || m.phase === 'walkOut' ? p.troughEvery / 4 : p.troughEvery, // drunk down after milking, it fills more often
    tractor: feeding ? 9 : Infinity, // back to back while it runs: each is a few seconds of idle
  };
  for (const name of Object.keys(forced)) {
    if (!forced[name]) continue;
    if (name in loops) loops[name] = Math.max(loops[name], 1);
    else if (name in every) every[name] = Math.min(every[name], name === 'hooves' ? p.hoofEvery : name === 'tractor' ? 9 : 6);
  }
  return { milking: m, loops, every };
}

/** One line for the panel and the console: where the milking is and what is going. */
export function describeDairy(plan) {
  const m = plan.milking;
  const going = [...Object.entries(plan.loops).filter(([, v]) => v > 0).map(([k]) => k), ...Object.entries(plan.every).filter(([, v]) => v < Infinity).map(([k]) => k)];
  const at = m.phase === 'none' ? 'no milking now' : `${m.which} milking, ${m.phase === 'walkIn' ? 'herd walking in' : m.phase === 'milking' ? 'milking' : 'herd walking back'} (${Math.floor(m.minutes)} min)`;
  return `${at}; going: ${going.join(', ') || 'nothing'}`;
}
