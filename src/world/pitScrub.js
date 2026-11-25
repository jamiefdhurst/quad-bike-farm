// The Old Pit's field gone to scrub (#1004), as numbers, so the farm's list of placed things (farmPlacement.js) has the same ones quarryProps.js
// draws: a mown ride kept open round the pit and out to the farm gate, rough grass and thistles over the rough, roots hanging out of the topsoil at
// the lip and a skirt of loose scree at the walls' foot, and a tree line of hawthorn with ash and oak standards along the sides that face arable.
// The bushes and the field's trees and stones are quarry.js `quarryPlants`, which keeps off the same ride. And, worked out from where the builder
// stands each relic (dealt in its drawing code, so it joins the list with them, #1229): the brambles and nettles thick round the container's
// hardstanding and the dead trees. Pure: no Three.js. Each comes from a stream of its own, so the pit's other deals stand where they did.

import { streamFor } from './propStreams.js';
import { pointInPolygon, polygonArea, rectPolygon } from './polygons.js';
import { inPlantsWay } from './plantSite.js';
import { HARDSTANDING, framePoint } from './pitGrowth.js';

const TAU = Math.PI * 2;

/** How much grows and where (#1004). */
export const PIT_SCRUB = {
  rideOut: 15, // metres out from the lip that the ride runs round the pit
  rideHalf: 2.6, // half its width: a mown strip about 5 m across
  rideClear: 1, // metres the scrub keeps off its edge
  tussocks: [0.02, 650], // rough grass tussocks a square metre of the field, and the most (the rest of the rough is in the ground's painting)
  thistles: [0.003, 100],
  roots: 0.6, // root tangles a metre round the lip, where the face is not the road's or the climb's
  scree: 1.8, // loose stones a metre round the walls' foot
  hawthornStep: 3.4, // metres between the tree line's hawthorns, give or take
  standardStep: 42, // and between its standards, alternately ash and oak
  lineIn: 3.2, // metres in from the fence the tree line stands
};

/** Metres the scrub keeps from a place held for a later item (quarry.js `held`): the list's 1.5 m round it and room for a bush's reach. */
const HELD_CLEAR = 3.5;

const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
};

/** `per` a unit of `area`, rounded, and never more than `cap`: how many of a thing a field of that size has. */
export const byArea = ([per, cap], area) => Math.min(cap, Math.round(per * area));

/** The field's area in square metres: its outline's, or its rectangle's on a field with none. */
export const fieldArea = (quarry) => Math.abs(polygonArea(quarry.outline ?? rectPolygon(quarry.rect)));

/** The bowl's area at the lip, square metres. */
export const bowlArea = (quarry) => Math.PI * quarry.pit.rx * quarry.pit.rz;

const rides = new WeakMap();

/**
 * The ride (#1004): a mown strip kept open through the scrub, `{ loop, spur, half }`. The loop runs round the pit `rideOut` m beyond the lip (pulled in
 * where the field's edge comes closer), so it passes the climb's finish and crosses the haul road's lead-in; the spur joins it to the farm gate.
 * Points `[x, z]` in game metres. The same object each time for one quarry.
 */
export function pitRide(quarry) {
  if (rides.has(quarry)) return rides.get(quarry);
  const inField = (x, z) => quarry.inQuarry(x, z, 7);
  const loop = [];
  const N = 96;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    let out = PIT_SCRUB.rideOut;
    let p = quarry.frameAt(a, quarry.rimAt(a) + out);
    while (!inField(p.x, p.z) && out > 6) p = quarry.frameAt(a, quarry.rimAt(a) + (out -= 0.5));
    loop.push([p.x, p.z]);
  }
  // The spur: straight in from the farm gate to the nearest point of the loop.
  const way = quarry.way;
  let best = loop[0];
  for (const p of loop) if (Math.hypot(p[0] - way.x, p[1] - way.z) < Math.hypot(best[0] - way.x, best[1] - way.z)) best = p;
  const spur = [[way.x + way.inward[0] * 1, way.z + way.inward[1] * 1], best];
  const ride = { loop, spur, half: PIT_SCRUB.rideHalf };
  rides.set(quarry, ride);
  return ride;
}

/** Metres from (x, z) to the ride's middle line. */
export function rideDistance(ride, x, z) {
  let d = Infinity;
  const { loop, spur } = ride;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    if (Math.abs(a[0] - x) > 12 && Math.abs(b[0] - x) > 12) continue;
    d = Math.min(d, segDist(x, z, a[0], a[1], b[0], b[1]));
  }
  return Math.min(d, segDist(x, z, spur[0][0], spur[0][1], spur[1][0], spur[1][1]));
}

/** Whether scrub may stand at (x, z): what `quarry.plantOk` allows (`clear` m off the lip), off the ride and the climb's way over the lip. */
export function scrubOk(quarry, x, z, clear = 1.5, margin = 0) {
  if (!quarry.plantOk(x, z, clear)) return false;
  if ((quarry.held ?? []).some(([hx, hz]) => Math.hypot(x - hx, z - hz) < HELD_CLEAR + margin)) return false;
  const ride = pitRide(quarry);
  if (rideDistance(ride, x, z) < ride.half + PIT_SCRUB.rideClear + margin) return false;
  const [c0, , c2] = quarry.climb.points;
  // The climb's line runs on past its finish over the lip towards the ride, so you can ride out of it.
  const bx = c2[0] + (c2[0] - c0[0]) * 0.35;
  const bz = c2[1] + (c2[1] - c0[1]) * 0.35;
  return segDist(x, z, c0[0], c0[1], bx, bz) >= quarry.climb.gateHalf + 1;
}

/** How much the lip draws the scrub at (x, z): 1 within a few metres of it, fading to 0 by 14 m out. */
export function lipNearness(quarry, x, z) {
  const { a, s } = quarry.polar(x, z);
  const out = s - quarry.rimAt(a);
  return out < 0 ? 0 : 1 - Math.min(1, Math.max(0, (out - 3) / 11));
}

/**
 * Rough grass and thistles over the rough (#1004), `{ tussocks, thistles }`, each `[{ x, z, s, yaw }]`: by the field's area to a cap, thinned into
 * patches by a slow pattern and thicker towards the lip, off the ride, the roads, the climb and the gates.
 */
export function pitCover(quarry, { random = streamFor('pitCover') } = {}) {
  const r = quarry.rect;
  const area = fieldArea(quarry);
  const patch = (x, z) => 0.5 + 0.3 * Math.sin(x * 0.09 + z * 0.06 + 1.3) + 0.2 * Math.sin(z * 0.13 - x * 0.05 + 0.4);
  const deal = (count, sizes) => {
    const out = [];
    for (let tries = 0; out.length < count && tries < count * 30; tries++) {
      const x = r.minX + random() * (r.maxX - r.minX);
      const z = r.minZ + random() * (r.maxZ - r.minZ);
      const keep = random();
      const s = sizes[0] + random() * (sizes[1] - sizes[0]);
      const yaw = random() * TAU;
      if (keep > 0.3 + 0.5 * patch(x, z) + 0.4 * lipNearness(quarry, x, z)) continue;
      if (!scrubOk(quarry, x, z, 0.8)) continue;
      out.push({ x, z, s, yaw });
    }
    return out;
  };
  return { tussocks: deal(byArea(PIT_SCRUB.tussocks, area), [0.7, 1.3]), thistles: deal(byArea(PIT_SCRUB.thistles, area), [0.75, 1.2]) };
}

/** Whether a stretch of the lip at angle `a` is open: the haul road coming in, or the climb going over (quarry.fenceOpen's line), so nothing hangs there. */
const lipOpen = (quarry, a) => {
  const p = quarry.frameAt(a, quarry.rimAt(a) + 2.4);
  return quarry.fenceOpen(a, p.x, p.z);
};

/**
 * The lip and the foot (#1004): `roots`, tangles hanging out of the topsoil just under the lip, `[{ x, z, a, s, yaw }]` (`yaw` turns its +z to face
 * into the pit, `s` its scale), none where the road comes in or the climb goes over; and `scree`, loose stones in a skirt along the walls' foot,
 * `[{ x, z, s, yaw, shape }]`, off the roads, the climb, the water, the heaps and the plant. Neither is solid: nothing on them for a wheel to bump.
 */
export function pitLip(quarry, { random = streamFor('pitLip') } = {}) {
  const { pit } = quarry;
  const roots = [];
  const N = Math.round(TAU * pit.rx * PIT_SCRUB.roots);
  for (let i = 0; i < N; i++) {
    const a = ((i + random() * 0.8) / N) * TAU;
    const s = 0.7 + random() * 0.6;
    const back = 0.25 + random() * 0.35; // metres in from the lip, down the face
    const turn = random() - 0.5;
    if (random() < 0.25 || lipOpen(quarry, a)) continue; // the odd stretch bare, where the turf has gone
    const p = quarry.frameAt(a, quarry.rimAt(a) - back);
    roots.push({ ...p, a, s, yaw: Math.atan2(pit.x - p.x, pit.z - p.z) + turn * 0.4 });
  }
  const scree = [];
  const start = quarry.climb.points[0];
  const M = Math.round(TAU * pit.rx * PIT_SCRUB.scree);
  for (let i = 0; i < M; i++) {
    const a = random() * TAU;
    const run = quarry.runAt(a);
    const at = quarry.floorEdge(a) + (random() - 0.6) * Math.min(4, run * 0.25); // the toe of the bank and a little out onto the floor
    const s = 0.08 + random() * random() * 0.32;
    const yaw = random() * TAU;
    const shape = random();
    const p = quarry.frameAt(a, at);
    if (quarry.waterAt(p.x, p.z) > 0 || quarry.roadNear(p.x, p.z).d < quarry.roadHalf + 0.8) continue;
    if (pit.heaps.some((m) => Math.hypot(m.x - p.x, m.z - p.z) < m.r) || inPlantsWay(pit, p.x, p.z, 0.3)) continue;
    if (Math.hypot(p.x - start[0], p.z - start[1]) < 6) continue;
    scree.push({ ...p, s, yaw, shape });
  }
  return { roots, scree };
}

/**
 * The tree line between the arable and the pit (#1004): along each of the field's boundaries whose other side is arable (`kinds` from the fields,
 * `boundaries` the layout's), `lineIn` m inside the fence, hawthorns every few metres with an ash or oak standard now and then and the odd gap,
 * none within 9 m of a gate. `[{ x, z, kind, s, yaw }]`, `kind` 'hawthorn', 'ash' or 'oak'.
 */
export function pitTreeLine(quarry, boundaries = [], kinds = {}, { random = streamFor('pitTreeLine') } = {}) {
  if (!quarry.outline) return [];
  const out = [];
  let standard = 0;
  for (const b of boundaries) {
    const other = b.between?.find((k) => k !== 'pit');
    if (!b.between?.includes('pit') || kinds[other] !== 'arable') continue;
    const pts = b.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / len;
      const dz = (bz - az) / len;
      let nx = -dz;
      let nz = dx;
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      if (!pointInPolygon(quarry.outline, mx + nx * 2, mz + nz * 2)) [nx, nz] = [-nx, -nz]; // the side the field is on
      let nextStandard = PIT_SCRUB.standardStep * (0.4 + random() * 0.4);
      for (let t = 7; t < len - 7; t += PIT_SCRUB.hawthornStep * (0.75 + random() * 0.5)) { // not into the corners, where the next side's fence is as near
        const inward = PIT_SCRUB.lineIn + (random() - 0.5) * 1.2;
        const x = ax + dx * t + nx * inward;
        const z = az + dz * t + nz * inward;
        const s = 0.8 + random() * 0.45;
        const yaw = random() * TAU;
        const gap = random() < 0.07;
        if (quarry.gates.some((g) => Math.hypot(x - g.x, z - g.z) < 9)) continue;
        if ((quarry.held ?? []).some(([hx, hz]) => Math.hypot(x - hx, z - hz) < HELD_CLEAR + 1.5)) continue;
        if (t >= nextStandard) {
          nextStandard = t + PIT_SCRUB.standardStep * (0.8 + random() * 0.5);
          out.push({ x: x + nx * 1.2, z: z + nz * 1.2, kind: standard++ % 2 ? 'oak' : 'ash', s: 0.85 + random() * 0.3, yaw });
          continue;
        }
        if (!gap) out.push({ x, z, kind: 'hawthorn', s, yaw });
      }
    }
  }
  return out;
}

/**
 * Scrub thick round the relics that stand in the field (#1004): brambles, nettles and rough grass ringing the container's hardstanding a metre to four
 * out, round the foot of each dead tree, and nettles and grass up round the pallet by the pond. `container` is `{ at, turn }` (quarryProps.js
 * buildSite's), `trees` `[{ x, z }]`, `pallet` `{ x, z, r }`. `[{ x, z, s, yaw, kind }]`, `kind` 'bramble', 'nettle', 'tussock' or 'thistle'. `ok(x, z)`
 * says where may take one.
 */
export function relicScrub({ container = null, trees = [], pallet = null }, ok = () => true, { random = streamFor('pitRelicScrub') } = {}) {
  const out = [];
  const kinds = ['bramble', 'bramble', 'nettle', 'tussock', 'tussock', 'thistle'];
  if (container) {
    const { x0, x1, halfW } = HARDSTANDING;
    for (let i = 0; i < 34; i++) {
      const side = Math.floor(random() * 4);
      const off = 1 + random() * random() * 3;
      const along = random();
      const lx = side === 0 ? x0 - off : side === 1 ? x1 + off : x0 + (x1 - x0) * along;
      const lz = side < 2 ? (along * 2 - 1) * (halfW + 1) : (side === 2 ? -1 : 1) * (halfW + off);
      const p = framePoint(container.at, container.turn, lx, lz);
      const kind = kinds[Math.floor(random() * kinds.length)];
      const s = 0.8 + random() * 0.5;
      const yaw = random() * TAU;
      if (ok(p.x, p.z)) out.push({ ...p, s, yaw, kind });
    }
  }
  for (const t of trees) {
    for (let i = 0; i < 9; i++) {
      const a = random() * TAU;
      const d = 0.6 + random() * 1.9;
      const kind = kinds[Math.floor(random() * kinds.length)];
      const s = 0.8 + random() * 0.5;
      const yaw = random() * TAU;
      const x = t.x + Math.cos(a) * d;
      const z = t.z + Math.sin(a) * d;
      if (ok(x, z)) out.push({ x, z, s, yaw, kind });
    }
  }
  if (pallet) {
    for (let i = 0; i < 7; i++) {
      const a = random() * TAU;
      const d = pallet.r + 0.05 + random() * 0.45;
      const kind = random() < 0.4 ? 'nettle' : 'tussock';
      const s = 0.7 + random() * 0.4;
      const yaw = random() * TAU;
      const x = pallet.x + Math.cos(a) * d;
      const z = pallet.z + Math.sin(a) * d;
      if (ok(x, z)) out.push({ x, z, s, yaw, kind });
    }
  }
  return out;
}
