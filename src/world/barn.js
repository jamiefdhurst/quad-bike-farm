// The barn as a place: where its walls and doorway are, whether you (or a quad, or a drop of rain) are under its roof,
// and how it sounds and keeps an engine from there. Pure logic, no Three.js; barnBuild.js draws it.
//
// It is a plain box with a gable roof, its big doors (always open) in the +x end wall of its own frame. A second span of the same size (the
// annex) stands on its +z side with a roof of its own, a valley between, posts where the wall would be and a door of its own; everything about
// "the barn" (inside, under the roof, the walls, the floor) counts both. The loft and the first door belong to the first span.
//
// The barn can stand turned a quarter (`layout.barn.yaw`, #682): `barnShape` and everything that draws or hangs on the barn is in the barn's own
// frame, the one it has at yaw 0 about its anchor, and `barnFrame` turns a point of it into the world's and back. What answers for the world (is
// this point inside, where the walls are, how level the ground is) takes a world point and does that itself. `layout.barnLocal` holds the barn's
// own things (the bench, the loft, the bays) as they are in that frame, for the code that works along the barn's axes.

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

const COS = [1, 0, -1, 0];
const SIN = [0, 1, 0, -1];

/**
 * How the barn stands in the world: its anchor `x`, `z`, its `yaw` (a quarter turn, 0 to 3 of them in `q`) and the two ways across.
 * `toWorld` takes a point in the barn's own frame (where it is at yaw 0 about its anchor) to the world's, `toLocal` the other way, and `yawToWorld`
 * a facing. Turned the way `layoutAnchors.js` turns an offset, which is the way Three.js turns an object about y.
 */
export function barnFrame(layout) {
  const b = layout.barn;
  const yaw = b.yaw ?? 0;
  const q = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
  const c = COS[q];
  const s = SIN[q];
  return {
    x: b.x,
    z: b.z,
    yaw,
    q,
    turned: q !== 0,
    toWorld: (x, z) => ({ x: b.x + (x - b.x) * c + (z - b.z) * s, z: b.z - (x - b.x) * s + (z - b.z) * c }),
    toLocal: (x, z) => ({ x: b.x + (x - b.x) * c - (z - b.z) * s, z: b.z + (x - b.x) * s + (z - b.z) * c }),
    /** A step (dx, dz) along the barn's own axes as a step in the world's. */
    vecToWorld: (dx, dz) => ({ x: dx * c + dz * s, z: -dx * s + dz * c }),
    yawToWorld: (y) => y + yaw,
    /** The heading (a wind's, a facing: 0 towards +z, a quarter turn east) a heading in the barn's own frame is in the world. */
    headingToWorld: (h) => h + yaw,
  };
}

/**
 * Puts `object` at the barn-frame point (lx, lz), `y` up, turned with the barn: for what hangs on a wall or stands in the barn, built facing the
 * way it would at yaw 0 (its own rotation about y, if it has one, is kept and turned with it). Set once, before anything else turns it.
 */
export function placeInBarn(layout, object, lx, y, lz) {
  const f = barnFrame(layout);
  const p = f.toWorld(lx, lz);
  object.position.set(p.x, y, p.z);
  object.rotation.y += f.yaw;
  return object;
}

/** The barn's own things (`bench`, `loft`, `bay`...) in the barn's frame: `layout.barnLocal`, or the layout itself when the barn is not turned. */
export const barnLocal = (layout) => layout.barnLocal ?? layout;

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
    wide: !!b.wide, // the new farm's one building: its doors in an eaves wall with the roof's ridge running along it (barnWide.js)
    // The doorway is in the +x wall, centred on the barn's z.
    door: { x: b.x + b.halfX, minZ: b.z - b.door.halfWidth, maxZ: b.z + b.door.halfWidth, height: b.door.height },
  };
}

/**
 * The barn's two spans as the buildings she walks round (npc/detour.js), in the world: each the box round its walls with its doorway, `out` being the
 * way out of it. A quarter turn keeps a box a box, so these are the world's own axes.
 */
export function detourBoxes(layout) {
  const s = barnShape(layout);
  const f = barnFrame(layout);
  const out = f.vecToWorld(1, 0);
  const box = (o, doorX, doorZ, halfWidth) => {
    const a = f.toWorld(o.minX, o.minZ);
    const c = f.toWorld(o.maxX, o.maxZ);
    return { minX: Math.min(a.x, c.x), maxX: Math.max(a.x, c.x), minZ: Math.min(a.z, c.z), maxZ: Math.max(a.z, c.z), door: { ...f.toWorld(doorX, doorZ), halfWidth, out } };
  };
  const boxes = [box(s.outer, s.door.x, s.z, s.door.maxZ - s.z)];
  if (s.annex) boxes.push(box(s.annex.outer, s.annex.door.x, s.annex.z, s.annex.door.maxZ - s.annex.z));
  return boxes;
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

/** Whether the world point (x, z) is inside the first span's walls, `margin` metres in from them (the cat's and the dog's idea of the barn). */
export function inFirstSpan(layout, wx, wz, margin = 0.5) {
  const b = layout.barn;
  const { x, z } = barnFrame(layout).toLocal(wx, wz);
  return Math.abs(x - b.x) < b.halfX - margin && Math.abs(z - b.z) < b.halfZ - margin;
}

/** Whether the world point (x, z) is in the first door's doorway, a little inside and a little out of it. */
export function inDoorway(layout, wx, wz, reach = 0.6) {
  const b = layout.barn;
  const { x, z } = barnFrame(layout).toLocal(wx, wz);
  return Math.abs(z - b.z) < b.door.halfWidth - 0.4 && x > b.x + b.halfX - reach && x < b.x + b.halfX + reach;
}

/**
 * The world point `out` metres out of the first door (negative: inside), `side` metres along the door wall from its middle (positive: towards the
 * barn's own +z, the second span's side). `facing` is the heading to look out of the door, in the world.
 */
export function outsideDoor(layout, out, side = 0) {
  const b = layout.barn;
  const f = barnFrame(layout);
  return { ...f.toWorld(b.x + b.halfX + out, b.z + side), facing: f.headingToWorld(Math.PI / 2) };
}

/** Whether the world point (x, z) is inside the walls, `margin` metres in from them (negative: that far outside). */
export function insideBarn(layout, wx, wz, margin = 0) {
  const inner = barnShape(layout).innerAll;
  const { x, z } = barnFrame(layout).toLocal(wx, wz);
  return x > inner.minX + margin && x < inner.maxX - margin && z > inner.minZ + margin && z < inner.maxZ - margin;
}

/** Whether the world point (x, z) is under the roof, which overhangs the walls a little. */
export function underRoof(layout, wx, wz) {
  const outer = barnShape(layout).outerAll;
  const { x, z } = barnFrame(layout).toLocal(wx, wz);
  return x > outer.minX - 0.3 && x < outer.maxX + 0.3 && z > outer.minZ - 0.3 && z < outer.maxZ + 0.3;
}

/**
 * How far indoors you are, 0 to 1, for lighting and for hearing the rain on the roof: 0 outside, rising across the threshold
 * over `doorFade` metres, 1 once you're properly in.
 */
export function indoorLevel(layout, wx, wz, p = DEFAULT_BARN_PARAMS) {
  const { innerAll: inner, door } = barnShape(layout);
  const { x, z } = barnFrame(layout).toLocal(wx, wz);
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
 * The solid wall boxes as { id, x, z, hx, hz } (centres and half-sizes in the ground plane of the world, full wall height): the back, side and far
 * walls and the door wall in pieces either side of the doorways. Named for the barn's own frame (west, north, south and the east wall's three
 * pieces), whichever way it stands.
 */
export function wallBoxes(layout) {
  const frame = barnFrame(layout);
  return localWallBoxes(layout).map((b) => {
    const p = frame.toWorld(b.x, b.z);
    return frame.q % 2 ? { id: b.id, x: p.x, z: p.z, hx: b.hz, hz: b.hx } : { ...b, x: p.x, z: p.z };
  });
}

/** `wallBoxes` in the barn's own frame. */
export function localWallBoxes(layout) {
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

/** Weight (0..1) at a world point to flatten the ground to the barn's floor: 1 under the building, easing off over `reach` metres outside it. */
export function floorBlend(layout, wx, wz, reach = 2.5) {
  const outer = barnShape(layout).outerAll;
  const { x, z } = barnFrame(layout).toLocal(wx, wz);
  const dx = Math.max(outer.minX - x, 0, x - outer.maxX);
  const dz = Math.max(outer.minZ - z, 0, z - outer.maxZ);
  return 1 - smooth(clamp01(Math.hypot(dx, dz) / reach));
}

/**
 * How a switched-off engine's temperature moves in a step: it cools toward the open air (`openFloor`, 0 if not given), or, in the barn, only down to
 * `warmFloor` and `coolFactor` times slower (the engine's `barnWarmC` above the air and `barnCoolFactor`), so a quad left under cover starts better on a
 * cold morning. It never warms up by itself.
 */
export function offTemperature(temperature, h, coolDownSeconds, sheltered, p) {
  const floor = sheltered ? p.warmFloor : (p.openFloor ?? 0); // (the air's own temperature, when it's in degrees)
  if (temperature <= floor) return temperature;
  const tau = Math.max(1, coolDownSeconds) * (sheltered ? p.coolFactor : 1);
  return temperature + ((floor - temperature) * h) / tau;
}
