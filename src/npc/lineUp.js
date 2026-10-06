// Lining them up. The quads start the game parked any old how; bored in the yard, Amy moves them one by one into a neat row
// in front of the barn doors, and Jess now and then parks one crooked on purpose, which Amy straightens by hand.
// Pure logic: where the slots are, which quad goes where, what she does next. Companion.lineUpJob and herDriving's `park` do the rest.

export const DEFAULT_LINEUP_PARAMS = {
  rowX: -50, // metres: the row's line, in front of the barn doors (the barn is at x -64, its doors face +x)
  rowZ: 60, // the middle of the row, level with the doors
  spacing: 3.2, // metres between quads
  yaw: -Math.PI / 2, // noses to the barn
  stage: 7, // metres out from the slot, in line with it, she drives to first so she comes in straight
  tidyDistance: 0.9, // metres from its slot a quad counts as in place
  tidyYaw: 0.25, // radians from the row's heading it counts as straight
  shoveRange: 4, // metres: a quad this near its slot is nudged by hand, not driven
  shoveSeconds: 1.6, // how long the nudge takes
  nearRange: 55, // metres from her: only quads this close are hers to tidy
  continueChance: 0.85, // the chance, once one is in, she goes on to the next
  crookedYaw: 0.5, // radians out Jess leaves it
  crookedShift: 0.7, // metres along the row she leaves it off its slot
};

export const LINEUP_PARAM_RANGES = {
  rowX: [-58, -40, 0.5],
  rowZ: [50, 70, 0.5],
  spacing: [2.4, 5, 0.1],
  yaw: [-3.14, 3.14, 0.05],
  stage: [3, 14, 0.5],
  tidyDistance: [0.3, 2, 0.1],
  tidyYaw: [0.05, 0.8, 0.05],
  shoveRange: [1, 8, 0.5],
  shoveSeconds: [0.5, 5, 0.1],
  nearRange: [10, 100, 1],
  continueChance: [0, 1, 0.05],
  crookedYaw: [0.1, 1, 0.05],
  crookedShift: [0.2, 1.5, 0.1],
};

const angleDiff = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** n slots in a row along z, centred on rowZ, each { x, z, yaw }. */
export function rowSlots(n, p = DEFAULT_LINEUP_PARAMS) {
  return Array.from({ length: n }, (_, i) => ({ x: p.rowX, z: p.rowZ + (i - (n - 1) / 2) * p.spacing, yaw: p.yaw }));
}

/** Whether a quad ({ x, z, yaw }) is in this slot, close and straight enough. */
export function isTidy(quad, slot, p = DEFAULT_LINEUP_PARAMS) {
  return Math.hypot(quad.x - slot.x, quad.z - slot.z) <= p.tidyDistance && Math.abs(angleDiff(quad.yaw, slot.yaw)) <= p.tidyYaw;
}

/** The point in line with a slot, `stage` metres out in front of it, to drive to first. */
export function stagePoint(slot, p = DEFAULT_LINEUP_PARAMS) {
  return { x: slot.x - Math.sin(slot.yaw) * p.stage, z: slot.z - Math.cos(slot.yaw) * p.stage };
}

/** Quads to slots, closest pairs first, so one already in a slot keeps it. Returns slots[i] for quads[i]. */
export function assignSlots(quads, slots) {
  const pairs = [];
  quads.forEach((q, i) => slots.forEach((s, j) => pairs.push({ i, j, d: Math.hypot(q.x - s.x, q.z - s.z) })));
  pairs.sort((a, b) => a.d - b.d);
  const out = new Array(quads.length).fill(null);
  const taken = new Set();
  for (const { i, j } of pairs) {
    if (out[i] || taken.has(j)) continue;
    out[i] = slots[j];
    taken.add(j);
  }
  return out;
}

/**
 * What to do next: the untidy quad nearest her, as { index, slot, mode } with mode 'shove' (just off its slot, nudged by hand)
 * or 'drive'; null once they are all in place. `quads` are { x, z, yaw } (all the movable ones), `from` is { x, z }.
 */
export function nextJob(quads, from, p = DEFAULT_LINEUP_PARAMS) {
  if (!quads.length) return null;
  const slots = assignSlots(quads, rowSlots(quads.length, p));
  let best = null;
  quads.forEach((q, index) => {
    if (isTidy(q, slots[index], p)) return;
    // One whose slot has another quad sat in it waits its turn, so she doesn't drive into it.
    const blocked = quads.some((o, k) => k !== index && Math.hypot(o.x - slots[index].x, o.z - slots[index].z) < p.tidyDistance * 2);
    const d = Math.hypot(q.x - from.x, q.z - from.z) + (blocked ? 1000 : 0);
    if (!best || d < best.d) best = { index, slot: slots[index], d };
  });
  if (!best) return null;
  const q = quads[best.index];
  const mode = Math.hypot(q.x - best.slot.x, q.z - best.slot.z) <= p.shoveRange ? 'shove' : 'drive';
  return { index: best.index, slot: best.slot, mode };
}

/** A slot left a bit off on purpose: shifted along the row and turned. */
export function crookedSlot(slot, p = DEFAULT_LINEUP_PARAMS, random = Math.random) {
  const side = random() < 0.5 ? 1 : -1;
  return { x: slot.x, z: slot.z + side * p.crookedShift, yaw: slot.yaw + side * p.crookedYaw };
}

/** The route for HerDrive's `park`: in line with the slot first, then the slot. */
export function parkRoute(slot, p = DEFAULT_LINEUP_PARAMS) {
  return [stagePoint(slot, p), { x: slot.x, z: slot.z }];
}

/** The pose a nudge has got to after fraction t (0..1), eased. */
export function nudgePose(from, to, t) {
  const k = t * t * (3 - 2 * t);
  return { x: from.x + (to.x - from.x) * k, z: from.z + (to.z - from.z) * k, yaw: from.yaw + angleDiff(from.yaw, to.yaw) * k };
}

/**
 * Heading for the last leg into a slot: along the row's heading, turned back towards its line by how far off it she is
 * (`lateral` metres to the right of the line, positive), so she finishes straight and not just pointing at the slot.
 */
export function slotHeading(slotYaw, lateral) {
  return slotYaw - Math.max(-0.7, Math.min(0.7, lateral * 0.45));
}

/** How far a point is along the slot's heading (negative short of it) and to the right of its line (metres). */
export function slotOffsets(pos, slot) {
  const dx = pos.x - slot.x;
  const dz = pos.z - slot.z;
  return { along: dx * Math.sin(slot.yaw) + dz * Math.cos(slot.yaw), lateral: dx * Math.cos(slot.yaw) - dz * Math.sin(slot.yaw) };
}
