// Height of the land at any (x, z). Pure function of the layout, used to build
// the physics heightfield, the visual mesh and to place props and the NPC.

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Gentle rolling farmland. */
export function baseHeight(x, z) {
  return (
    1.4 * Math.sin(x * 0.018 + 0.6) * Math.cos(z * 0.015 - 0.4) +
    0.8 * Math.sin((x + z) * 0.035 + 1.1) +
    0.35 * Math.sin(x * 0.09 + 2.0) * Math.sin(z * 0.075 + 0.7) +
    0.12 * Math.sin(x * 0.23 + z * 0.19)
  );
}

import { floorBlend } from './barn.js';
import { stripFrame } from './layout.js';
import { outsideRect, createFieldShape } from './fields.js';
import { createHill } from './hill.js';
import { hutShape } from './hut.js';
import { createWoods } from './woods.js';
import { createQuarry } from './quarry.js';
import { createOutbuildings } from './outbuildings.js';
import { createBrook } from './brook.js';
import { villageShape } from './village.js';

export function createTerrainHeight(layout, track) {
  const { yard, trackHalfWidth, trackDepth, puddleRadius, puddleDepth, fieldHalf, road } = layout;
  const farm = layout.farm ?? { minX: -fieldHalf, maxX: fieldHalf, minZ: -fieldHalf, maxZ: fieldHalf };
  const fieldShape = createFieldShape(layout);
  const hill = createHill(layout);
  const woods = createWoods(layout);
  const quarry = createQuarry(layout);
  const outbuildings = createOutbuildings(layout);
  const brook = createBrook(layout);
  const village = villageShape(layout);
  const hut = hutShape(layout);
  let hutLevel = null; // the ground at the hut's middle as the land lies, found the first time it's needed
  let findingHutLevel = false;
  const yardHeight = baseHeight(yard.x, yard.z);
  const puddles = layout.puddles.map((u) => track.sample(u));
  const bogs = (layout.bogs ?? []).map((b) => (b.track !== undefined ? { ...track.sample(b.track), radius: b.radius } : { ...b }));
  if (woods) bogs.push(...woods.bogs.map((b) => ({ ...b })));
  const trackReach = trackHalfWidth + 1.5;
  // The drag strip is level: the average of the ground along it, blended back into the field over its shoulders.
  const strip = layout.dragStrip;
  const stripLevel = strip ? [0, 0.25, 0.5, 0.75, 1].reduce((sum, t) => sum + baseHeight(strip.x + Math.sin(strip.yaw) * strip.length * t, strip.z + Math.cos(strip.yaw) * strip.length * t), 0) / 5 : 0;

  /** The ground as the land lies, before anything is built on it or cut into it. */
  function natural(x, z) {
    let h = baseHeight(x, z);

    // Land rises gently beyond the farm's hedges towards distant hills; through the south gate, the lane and the hill pasture have their own
    // shape (world/hill.js), fading back into it beyond their hedges.
    // North, through the north gate, the wood has its own (world/woods.js) in the same way, and the gravel pit's field (world/quarry.js) is kept flat for it.
    const w = hill ? hill.weight(x, z) : 0;
    const ww = woods ? woods.weight(x, z) : 0;
    const qw = quarry ? quarry.weight(x, z) : 0;
    h += smoothstep(10, 300, outsideRect(farm, x, z)) * 22 * (0.6 + 0.4 * Math.sin(x * 0.01 + z * 0.013)) * (1 - Math.max(w, ww, qw));
    if (w > 0) h += w * hill.profile(x, z);
    if (ww > 0) h += ww * woods.profile(x, z);

    // The stubble fields' own lie: the north one's hollow, the south one's rise.
    h += fieldShape(x, z).lift;
    return h;
  }

  // The ground the gravel pit is cut into: the lie at its middle, the whole patch round it eased to it (quarry.groundAt).
  const quarryLevel = quarry ? natural(quarry.pit.x, quarry.pit.z) : 0;

  function heightAt(x, z) {
    let h = natural(x, z);

    // The village's ground is laid to a plane along its road (world/village.js), over the natural lie.
    if (village) {
      const w = village.areaWeight(x, z);
      if (w > 0) h += (village.planeAt(x, natural) - h) * w;
    }

    // The farm road is laid level across, following the lie of the land along its middle, with a 3 m shoulder each side; the
    // hardstanding at its end is flat.
    if (road) {
      const along = Math.max(road.fromX - 2 - x, 0, x - road.toX);
      const dRoad = Math.hypot(along, z - road.z) - road.halfWidth;
      const dPad = road.pad ? Math.hypot(x - road.pad.x, z - road.z) - road.pad.radius : Infinity;
      const k = 1 - smoothstep(0, 3, Math.min(dRoad, dPad));
      if (k > 0) {
        const padK = road.pad ? 1 - smoothstep(-4, 2, dPad) : 0;
        const level = baseHeight(Math.min(x, road.toX), road.z) * (1 - padK) + baseHeight(road.pad?.x ?? x, road.z) * padK;
        h += (level - h) * k;
      }
    }

    // Flatten the yard around the barn.
    const yd = Math.hypot(x - yard.x, z - yard.z);
    h += (yardHeight - h) * (1 - smoothstep(yard.radius * 0.6, yard.radius, yd));

    // And level under the barn, so its floor is flat.
    if (layout.barn) h += (yardHeight - h) * floorBlend(layout, x, z);

    // And under the Dutch barn and the field shed, to the lie of the land at their middles.
    const floor = outbuildings.floorAt(x, z, (fx, fz) => baseHeight(fx, fz) + fieldShape(fx, fz).lift);
    if (floor) h += (floor.level - h) * floor.k;

    // And under the village's buildings, its car park and the garage's forecourt.
    if (village) {
      const pad = village.floorAt(x, z, (fx) => village.planeAt(fx, natural));
      if (pad) h += (pad.level - h) * pad.k;
    }

    // And under the shepherd's hut on the hill, a terrace cut into the bank at the lie of the land at its middle.
    if (hut && !findingHutLevel) {
      const k = hut.levelK(x, z);
      if (k > 0) {
        if (hutLevel === null) {
          findingHutLevel = true;
          hutLevel = natural(hut.x, hut.z);
          findingHutLevel = false;
        }
        h += (hutLevel - h) * k;
      }
    }

    // The river's valley is level across, to the ground at its middle, and then the brook's channel is cut into it.
    if (brook) {
      const lk = brook.levelK(x, z);
      if (lk > 0) h += (natural(x, brook.zAt(x)) - h) * lk;
      h -= brook.cutAt(x, z);
    }

    // The gravel pit: its patch levelled, the bowl cut into it, the haul road down its wall, the pond and the heaps.
    if (quarry) h = quarry.groundAt(x, z, h, quarryLevel);

    // Level under the drag strip, with a shoulder to ease it back into the field.
    if (strip) {
      const f = stripFrame(strip, x, z);
      const outAcross = Math.abs(f.across) - strip.width / 2;
      const outAlong = Math.max(-8 - f.along, f.along - (strip.length + strip.runOff), 0);
      const k = 1 - smoothstep(0, 6, Math.max(outAcross, outAlong));
      if (k > 0) h += (stripLevel - h) * k;
    }

    // Dished dirt track with softened shoulders.
    const d = track.distanceTo(x, z, trackReach);
    if (d < trackReach) {
      const k = 1 - smoothstep(trackHalfWidth * 0.4, trackReach, d);
      h -= trackDepth * k;
    }

    // Bogs sit in a shallow dip.
    for (const b of bogs) {
      const bd = Math.hypot(x - b.x, z - b.z);
      if (bd < b.radius) h -= layout.bogDepth * (1 - smoothstep(b.radius * 0.3, b.radius, bd));
    }

    // Puddle hollows.
    for (const p of puddles) {
      const pd = Math.hypot(x - p.x, z - p.z);
      if (pd < puddleRadius) h -= puddleDepth * (1 - smoothstep(0, puddleRadius, pd)) ** 0.7;
    }
    return h;
  }

  /** 0..1, how deep a bog this is (1 in the middle of one). */
  function bogAt(x, z) {
    let w = 0;
    for (const b of bogs) {
      const bd = Math.hypot(x - b.x, z - b.z);
      if (bd < b.radius) w = Math.max(w, 1 - smoothstep(b.radius * 0.35, b.radius * 0.9, bd));
    }
    return w;
  }

  /** 0..1, how muddy the surface is here (1 on the track centre, and in a bog). */
  function mudAt(x, z) {
    const d = track.distanceTo(x, z, trackReach);
    return Math.max(1 - smoothstep(trackHalfWidth * 0.7, trackHalfWidth + 0.6, d), Math.min(1, bogAt(x, z) * 1.5), hill ? hill.mudAt(x, z) : 0, woods ? woods.mudAt(x, z) : 0, quarry ? quarry.mudAt(x, z) : 0, brook ? brook.mudAt(x, z) : 0);
  }

  /** 0..1, how much standing water there is here (1 in the middle of a puddle, or in the stream). */
  function puddleAt(x, z) {
    let w = Math.max(hill ? hill.waterAt(x, z) : 0, woods ? woods.waterAt(x, z) : 0, quarry ? quarry.waterAt(x, z) : 0, brook ? brook.waterAt(x, z) : 0);
    for (const p of puddles) {
      const pd = Math.hypot(x - p.x, z - p.z);
      if (pd < puddleRadius) w = Math.max(w, 1 - smoothstep(puddleRadius * 0.45, puddleRadius * 0.85, pd));
    }
    return w;
  }

  return { heightAt, mudAt, puddleAt, bogAt, puddles, bogs, hill, woods, quarry, brook };
}
