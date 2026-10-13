// The barn as a place: where its walls and doorway are, whether you (or a quad, or a drop of rain) are under its roof,
// and how it sounds and keeps an engine from there. Pure logic, no Three.js; barnBuild.js draws it.
//
// It is a plain box with a gable roof, axes aligned to the world, its big doors (always open) in the +x end wall. A second span of the same
// size (the annex) stands on its south side with a roof of its own, a valley between, posts where the wall would be and a door of its own;
// everything about "the barn" (inside, under the roof, the walls, the floor) counts both. The loft and the first door belong to the first span.

export const DEFAULT_BARN_PARAMS = {
  reverbWet: 0.55, // how much of a sound's echo off the tin and brick comes back (0..1) when you and it are both inside
  reverbWetOutside: 0.2, // the same when only one of you is inside: heard through the doorway
  boomDb: 6, // dB of bass added to an engine you can hear from inside
  rainTin: 3, // how much louder rain is, and how much more it clatters, when you are under the tin roof
  rainSpeak: 0.35, // how much rain you can still hear from just outside the door, as a fraction of the way in
  doorFade: 1.5, // metres either side of the threshold over which indoors fades in
};

export const BARN_PARAM_RANGES = {
  reverbWet: [0, 1.5, 0.01],
  reverbWetOutside: [0, 1.5, 0.01],
  boomDb: [0, 18, 0.5],
  rainTin: [1, 8, 0.1],
  rainSpeak: [0, 1, 0.01],
  doorFade: [0.1, 6, 0.1],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => t * t * (3 - 2 * t);

/** The outside and inside rectangles, the doorway and the heights, from the layout's `barn`. */
export function barnShape(layout) {
  const b = layout.barn;
  const inner = { minX: b.x - b.halfX + b.wall, maxX: b.x + b.halfX - b.wall, minZ: b.z - b.halfZ + b.wall, maxZ: b.z + b.halfZ - b.wall };
  const outer = { minX: b.x - b.halfX, maxX: b.x + b.halfX, minZ: b.z - b.halfZ, maxZ: b.z + b.halfZ };
  const a = b.annex;
  let annex = null;
  if (a) {
    const z = b.z + b.halfZ + a.halfZ; // the second span's middle
    annex = {
      z,
      halfZ: a.halfZ,
      outer: { ...outer, minZ: b.z + b.halfZ, maxZ: z + a.halfZ },
      door: { x: b.x + b.halfX, z, minZ: z - a.door.halfWidth, maxZ: z + a.door.halfWidth, height: a.door.height },
    };
  }
  const outerAll = { ...outer, maxZ: annex ? annex.outer.maxZ : outer.maxZ };
  const innerAll = { ...inner, maxZ: outerAll.maxZ - b.wall };
  return {
    annex,
    outerAll, // both spans, outside the walls
    innerAll, // and inside them
    x: b.x,
    z: b.z,
    outer,
    inner,
    wall: b.wall,
    wallHeight: b.wallHeight,
    ridge: b.ridge,
    // The doorway is in the +x wall, centred on the barn's z.
    door: { x: b.x + b.halfX, minZ: b.z - b.door.halfWidth, maxZ: b.z + b.door.halfWidth, height: b.door.height },
  };
}

/** Every doorway in the +x wall, the first span's first. */
export function barnDoors(layout) {
  const s = barnShape(layout);
  return s.annex ? [s.door, s.annex.door] : [s.door];
}

/** The posts that stand where the wall between the two spans would be, to carry the valley beam: { x, z, r } (none with one span). */
export function dividerPosts(layout) {
  const s = barnShape(layout);
  if (!s.annex) return [];
  const span = s.inner.maxX - s.inner.minX;
  return [0.2, 0.5, 0.8].map((t) => ({ x: s.inner.minX + span * t, z: s.outer.maxZ, r: 0.1 }));
}

/** Whether (x, z) is inside the walls, `margin` metres in from them (negative: that far outside). */
export function insideBarn(layout, x, z, margin = 0) {
  const inner = barnShape(layout).innerAll;
  return x > inner.minX + margin && x < inner.maxX - margin && z > inner.minZ + margin && z < inner.maxZ - margin;
}

/** Whether (x, z) is under the roof, which overhangs the walls a little. */
export function underRoof(layout, x, z) {
  const outer = barnShape(layout).outerAll;
  return x > outer.minX - 0.3 && x < outer.maxX + 0.3 && z > outer.minZ - 0.3 && z < outer.maxZ + 0.3;
}

/**
 * How far indoors you are, 0 to 1, for lighting and for hearing the rain on the roof: 0 outside, rising across the threshold
 * over `doorFade` metres, 1 once you're properly in.
 */
export function indoorLevel(layout, x, z, p = DEFAULT_BARN_PARAMS) {
  const { innerAll: inner, door } = barnShape(layout);
  if (z <= inner.minZ || z >= inner.maxZ || x <= inner.minX) return 0;
  // Depth from the open end: positive inside, negative out in the yard (only through the doorway does the yard see in).
  const depth = door.x - x;
  const fade = Math.max(0.05, p.doorFade);
  if (depth < 0) return 0;
  const side = Math.min(z - inner.minZ, inner.maxZ - z);
  return smooth(clamp01(depth / fade)) * smooth(clamp01(side / 0.6));
}

/** Echo level for a sound from `sourceIn` heard by a listener who is `listenerIn` (booleans). */
export function reverbSend(listenerIn, sourceIn, p = DEFAULT_BARN_PARAMS) {
  if (listenerIn && sourceIn) return p.reverbWet;
  if (listenerIn || sourceIn) return p.reverbWetOutside;
  return 0;
}

/** Bass boost in dB for an engine heard from inside the barn (whether or not it's inside too). */
export function boomFor(listenerIn, sourceIn, p = DEFAULT_BARN_PARAMS) {
  if (listenerIn && sourceIn) return p.boomDb;
  if (listenerIn) return p.boomDb * 0.4;
  return 0;
}

/** The rain level to play: louder and clattier under the tin roof. Returns { level, tin } with tin 0..1 the share of drumming. */
export function rainHeard(rain, indoor, p = DEFAULT_BARN_PARAMS) {
  const r = clamp01(rain);
  const tin = r > 0 ? clamp01(indoor) : 0;
  return { level: Math.min(1.5, r * (1 + (p.rainTin - 1) * 0.35 * tin)), tin };
}

/**
 * The solid wall boxes as { x, z, hx, hz } (centres and half-sizes in the ground plane, full wall height): west, north and south
 * walls, and the east wall in two halves either side of the doorway.
 */
export function wallBoxes(layout) {
  const { outerAll: outer, wall } = barnShape(layout);
  const doors = barnDoors(layout);
  const cx = (outer.minX + outer.maxX) / 2;
  const cz = (outer.minZ + outer.maxZ) / 2;
  const hx = (outer.maxX - outer.minX) / 2;
  const hz = (outer.maxZ - outer.minZ) / 2;
  const w = wall / 2;
  const boxes = [
    { id: 'west', x: outer.minX + w, z: cz, hx: w, hz },
    { id: 'north', x: cx, z: outer.minZ + w, hx, hz: w },
    { id: 'south', x: cx, z: outer.maxZ - w, hx, hz: w },
  ];
  // The east wall in pieces between the doorways: north of the first, between them, south of the last.
  const edges = [outer.minZ, ...doors.flatMap((d) => [d.minZ, d.maxZ]), outer.maxZ];
  const names = ['eastNorth', 'eastMiddle', 'eastSouth'];
  for (let i = 0; i < edges.length; i += 2) {
    const len = (edges[i + 1] - edges[i]) / 2;
    const name = i === 0 ? names[0] : i === edges.length - 2 ? names[2] : names[1];
    boxes.push({ id: name, x: outer.maxX - w, z: edges[i] + len, hx: w, hz: len });
  }
  return boxes;
}

/** Weight (0..1) to flatten the ground to the barn's floor: 1 under the building, easing off over `reach` metres outside it. */
export function floorBlend(layout, x, z, reach = 2.5) {
  const outer = barnShape(layout).outerAll;
  const dx = Math.max(outer.minX - x, 0, x - outer.maxX);
  const dz = Math.max(outer.minZ - z, 0, z - outer.maxZ);
  return 1 - smooth(clamp01(Math.hypot(dx, dz) / reach));
}

/**
 * How a switched-off engine's temperature moves in a step: it cools toward stone cold (or, in the barn, only down to `warmFloor`,
 * and `coolFactor` times slower; both are the engine's `barnWarmFloor` and `barnCoolFactor`), so a quad left under cover starts better on a cold morning. It never warms up by itself.
 */
export function offTemperature(temperature, h, coolDownSeconds, sheltered, p) {
  const floor = sheltered ? p.warmFloor : 0;
  if (temperature <= floor) return temperature;
  const tau = Math.max(1, coolDownSeconds) * (sheltered ? p.coolFactor : 1);
  return temperature + ((floor - temperature) * h) / tau;
}
