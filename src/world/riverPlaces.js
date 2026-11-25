// Where the river's and the brook's small things stand (#999), as numbers, so the farm's list of placed things (farmPlacement.js) has the same ones the
// props draw (riverProps.js): the rushes and sedge at the wet edges, the reeds along the brook past the meadow, the loose stones and the ruts at the
// crossing, the tussocks, thistles, docks and cowpats over Brook Meadow, and the stock fence along the brook to the lane's verge. Pure: no Three.js.
// Everything comes from its own random stream (`streamFor('riverside')`), so it is the same however the other builders draw.

import { streamFor } from './propStreams.js';
import { pointInPolygon, polygonBounds } from './polygons.js';
import { roadNetwork } from './roads.js';

/** How many of each the meadow has (Brook Meadow is about 7 ha), and the stock fence's sizes. */
export const RIVERSIDE_COUNTS = { tussocks: 700, thistles: 230, docks: 160, dung: 170 };
export const BROOK_FENCE = { off: 1.5, wander: 2.2, gap: 5, gapAt: 0.45 }; // m off the water's edge, how far a straight stretch may stray from that, the gap's width and where along it is

/** Metres from the line to the water's edge at x on `side` (-1 north, 1 south): where the bank comes out of the water, a bar's shelf or a wall. */
export function waterEdge(brook, x, side) {
  const z0 = brook.zAt(x);
  for (let r = 0; r < brook.halfAt(x) + 3; r += 0.1) if (brook.waterAt(x, z0 + side * r) < 0.05) return r;
  return brook.halfAt(x) + 3;
}

/** How the river's water is shaded at x (#1000), a multiplier on its colour: darker over a deep pool, paler over a riffle with its gravel showing; 1 elsewhere. */
export function waterShade(brook, x) {
  if (!brook?.steps) return 1;
  const deep = Math.max(0, Math.min(1, (brook.waterDepthAt(x) - 0.45) / 0.7));
  return (1 - 0.3 * deep) * (1 + 0.45 * brook.riffleK(x));
}

/**
 * The broken water over each riffle (#1000), for a strip of pale flecks laid on the water: per riffle a run of cross-sections { x, z, hn, hs, y, a } every
 * half metre from just above its fall to a little below it, `hn` and `hs` m to its north and south edges (inside the water's edge), `y` a hand over the
 * surface (`heightAt` the ground's), `a` 0..1 how much of it shows, nothing at the run's ends.
 */
export function riffleFoam(brook, heightAt) {
  if (!brook?.steps) return [];
  return brook.riffles().map((r) => {
    const from = r.a - 0.5;
    const to = r.b + 1.5;
    const run = [];
    for (let x = from; x <= to + 1e-6; x += 0.5) {
      const z = brook.zAt(x);
      const t = (x - from) / (to - from);
      run.push({ x, z, hn: Math.max(0.2, waterEdge(brook, x, -1) - 0.15), hs: Math.max(0.2, waterEdge(brook, x, 1) - 0.15), y: heightAt(x, z) + brook.waterDepthAt(x) + 0.015, a: Math.sin(Math.PI * t) ** 0.7 * 0.9 });
    }
    return run;
  });
}

/**
 * The stock fence along the brook's north bank (#999): from Brook Meadow's river gate to the lane's verge, `BROOK_FENCE.off` m back from the water, as a
 * few straight stretches (a strainer at each corner, wireFence.js), open where the boundary track crosses the brook, where the farm's east hedge
 * stands and at one gap half-way, so the strip of Low Ley south of the brook can still be reached. `points` [[x, z]], `gaps` [from, to] m along them.
 */
export function brookFence(layout, brook, roads = roadNetwork(layout)) {
  const meadow = layout.hill?.riverside;
  const lane = layout.publicLane;
  if (!meadow?.gates || !brook?.banks || !lane) return null;
  const x0 = meadow.maxX + 0.4;
  const x1 = lane.x - lane.halfWidth - 2;
  const bankAt = (x) => [x, brook.zAt(x) - waterEdge(brook, x, -1) - BROOK_FENCE.off];
  const samples = [];
  for (let x = x0; x < x1; x += 2) samples.push(bankAt(x));
  samples.push(bankAt(x1));
  // Straight stretches as long as the bank lets them, each within `wander` m of the line it follows and never nearer the water than half of `off`.
  const points = [samples[0]];
  let i = 0;
  while (i < samples.length - 1) {
    let j = i + 1;
    for (let k = i + 2; k < samples.length; k++) {
      const [ax, az] = samples[i];
      const [bx, bz] = samples[k];
      const ok = samples.slice(i + 1, k).every(([sx, sz]) => {
        const z = az + ((bz - az) * (sx - ax)) / (bx - ax);
        return Math.abs(z - sz) < BROOK_FENCE.wander && z < brook.zAt(sx) - waterEdge(brook, sx, -1) - BROOK_FENCE.off * 0.5;
      });
      if (!ok) break;
      j = k;
    }
    points.push(samples[j]);
    i = j;
  }
  // Metres along the fence to where it crosses x.
  const lengthAt = (x) => {
    let s = 0;
    for (let k = 0; k + 1 < points.length; k++) {
      const [ax, az] = points[k];
      const [bx, bz] = points[k + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (x <= bx) return s + (len * (x - ax)) / (bx - ax);
      s += len;
    }
    return s;
  };
  const gaps = [];
  const openAt = (a, b) => gaps.push([lengthAt(a), lengthAt(b)]);
  // The roads and tracks it would cross (the boundary track down the farm's east side), with a metre to spare either side.
  let on = null;
  for (let x = x0; x <= x1; x += 0.25) {
    const z = brook.zAt(x) - waterEdge(brook, x, -1) - BROOK_FENCE.off;
    const road = roads.surfaceAt(x, z);
    if (road && on === null) on = x;
    if (!road && on !== null) { openAt(on - 1, x + 1); on = null; }
  }
  if (on !== null) openAt(on - 1, x1);
  // The farm's own east hedge (the boundary the river gate shuts at `meadow.gates[2]`): the hedge stands there, so no fence.
  const east = meadow.gates[2];
  if (east > x0 && east < x1) openAt(east - 1.6, east + 1.6);
  const mid = x0 + (x1 - x0) * BROOK_FENCE.gapAt;
  openAt(mid - BROOK_FENCE.gap / 2, mid + BROOK_FENCE.gap / 2);
  return { points, gaps: gaps.sort((a, b) => a[0] - b[0]), lengthAt };
}

/** The stretches of the fence between its gaps, as segments [[ax, az], [bx, bz]], for the farm's list of placed things and the tests. */
export function fenceStretches(fence) {
  if (!fence) return [];
  const { points, gaps } = fence;
  const lens = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  const at = (s) => {
    let left = s;
    for (let i = 0; i < lens.length; i++) {
      if (left <= lens[i] || i === lens.length - 1) {
        const f = Math.min(1, left / lens[i]);
        return [points[i][0] + (points[i + 1][0] - points[i][0]) * f, points[i][1] + (points[i + 1][1] - points[i][1]) * f];
      }
      left -= lens[i];
    }
    return points[points.length - 1];
  };
  const cuts = [0, ...points.slice(1, -1).map((_, i) => lens.slice(0, i + 1).reduce((a, b) => a + b, 0)), total];
  const out = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    let from = cuts[i];
    for (const [g0, g1] of gaps) {
      if (g1 <= from || g0 >= cuts[i + 1]) continue;
      if (g0 > from) out.push([at(from), at(g0)]);
      from = Math.max(from, g1);
    }
    if (cuts[i + 1] > from) out.push([at(from), at(cuts[i + 1])]);
  }
  return out;
}

/**
 * Everything small the river and the brook have, from the layout and the brook (brook.js), in game metres. Each plant or stone is { x, z, s, yaw, water }
 * (`water` true for one that stands in the water on purpose, as a reed in the shallows does). Null on a farm with no shaped banks (today's).
 */
export function riversidePlaces(layout, brook, { roads = roadNetwork(layout), random = streamFor('riverside') } = {}) {
  const river = layout.hill?.river;
  const meadow = layout.hill?.riverside;
  if (!river || !meadow?.gates || !brook?.banks) return null;
  const cross = brook.crossing();
  const wet = (x, z) => brook.waterAt(x, z) > 0.05;
  const plant = (x, z, s) => ({ x, z, s, yaw: random() * Math.PI * 2, water: wet(x, z) });
  const nearDrink = (x, side, r) => brook.drinks.some((d) => d.side === side && Math.abs(d.x - x) < r);
  const byCrossing = (x, r) => Math.abs(x - cross.x) < cross.reach + r;
  const byBridge = (x) => river.bridge && Math.abs(x - river.bridge.x) < 10;
  const track = (x, z) => !!roads.surfaceAt(x, z);
  // A footpath's crossing is kept for its stile or gate (farmPlacement.js `SPOT_RADIUS`, 1.5 m, and a plant's own reach).
  const spots = layout.reserved?.crossings ?? [];
  const kept = (x, z) => spots.some((c) => Math.hypot(x - c.at[0], z - c.at[1]) < 2);
  const lane = layout.publicLane;
  const brookEnd = lane ? lane.x - lane.halfWidth - 2.5 : meadow.maxX;

  // Rushes and sedge at the wet edges (#999), both banks of the river and the brook to the lane's verge: soft rush in clumps on the water's edge, sedge
  // just behind it, none on the crossing's landings, at the drinking places or under the farm bridge; thinner on a cut bank, thicker on a bar's edge.
  const rushes = [];
  const sedge = [];
  for (const side of [-1, 1]) {
    for (let x = brook.minX + 3; x < brookEnd; x += 0.8 + random() * 2) {
      if (byCrossing(x, 3) || nearDrink(x, side, 5) || byBridge(x)) continue;
      const { out, s } = brook.bendAt(x);
      const cutBank = out === side ? s : 0;
      if (random() < cutBank * 0.6) continue;
      const edge = waterEdge(brook, x, side);
      const zc = brook.zAt(x);
      const zr = zc + side * (edge + (random() - 0.35) * 0.8);
      if (!track(x, zr) && !kept(x, zr)) rushes.push(plant(x, zr, 0.9 + random() * 0.5));
      if (random() < 0.7) {
        // Behind the water's edge where it stands, not where the rush does: on a bend or by a riffle's bar the edge moves a metre in a metre (#1000).
        const back = 0.4 + random() * 1.4;
        const xs = x + (random() - 0.5) * 1.5;
        const zs = brook.zAt(xs) + side * (waterEdge(brook, xs, side) + back);
        if (!track(xs, zs) && !kept(xs, zs)) sedge.push(plant(xs, zs, 0.7 + random() * 0.5));
      }
    }
  }

  // Reeds along the brook past the meadow (the river's own are `river.reeds`, river.js): drifts in its margins and a few up its banks.
  const brookReeds = [];
  for (let x = meadow.maxX + 2; x < brookEnd; ) {
    const side = random() < 0.5 ? -1 : 1;
    const drift = 2 + random() * 4;
    for (let d = 0; d < drift; d += 0.5 + random() * 0.7) {
      const xx = x + d;
      const z = brook.zAt(xx) + side * (waterEdge(brook, xx, side) + (random() - 0.6) * 0.7);
      if (!track(xx, z)) brookReeds.push({ ...plant(xx, z, 0.65 + random() * 0.45), kind: random() < 0.4 ? 'tall' : 'mid' });
    }
    x += drift + 4 + random() * 10;
  }

  // The crossing: loose stones and cobbles on the bed and up both landings, thicker at the water's edges where the tyres throw them, and the ruts:
  // two wheel tracks a quad's width apart, through the water and up each landing to the field.
  const stones = [];
  const reach = river.banks?.landing ?? 7;
  for (let i = 0; i < 150; i++) {
    const x = cross.x + (random() * 2 - 1) * (cross.reach - 0.4);
    const across = (random() * 2 - 1) * (cross.half + reach * 0.7);
    const edgey = Math.abs(Math.abs(across) - cross.half) < 1.2 ? 1 : 0.55;
    if (random() > edgey) continue;
    const z = brook.zAt(x) + across;
    stones.push(plant(x, z, 0.05 + random() ** 2 * 0.16));
  }
  const track0 = 0.55;
  const ruts = [-1, 1].map((sgn) => {
    const x = cross.x + 0.35 + sgn * track0;
    return { x, from: brook.zAt(x) - (brook.halfAt(x) + reach), to: brook.zAt(x) + brook.halfAt(x) + reach, width: 0.34 };
  });

  // Brook Meadow's grazing (#999): tussocks in loose groups, thicker towards the water; spear thistles in patches; docks where the ground is trodden
  // and rich, by the drinking places, the gateways and the crossing; cowpats anywhere the cattle graze. None in the water, on the crossing's landings or
  // on a track, and none under the willows' trunks.
  const poly = meadow.points;
  const box = polygonBounds(poly);
  const willows = [...(meadow.willows ?? []).map(([x, side, off]) => [x, brook.zAt(x) + side * (brook.halfAt(x) + off)]), ...(meadow.crackWillow ? [meadow.crackWillow] : [])];
  const clear = (x, z, keep = 1) => pointInPolygon(poly, x, z, 1)
    && Math.abs(z - brook.zAt(x)) > waterEdge(brook, x, Math.sign(z - brook.zAt(x)) || 1) + keep
    && brook.mudAt(x, z) < 0.3 && !track(x, z) && !willows.some(([wx, wz]) => Math.hypot(x - wx, z - wz) < 1.5);
  const inBox = () => [box.minX + random() * (box.maxX - box.minX), box.minZ + random() * (box.maxZ - box.minZ)];
  const scatter = (count, group, spread, near = null, keep = 1) => {
    const out = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 30) {
      const [cx0, cz0] = near ? near() : inBox();
      for (let k = 0; k < group && out.length < count; k++) {
        const x = cx0 + (random() - 0.5) * spread;
        const z = cz0 + (random() - 0.5) * spread;
        if (clear(x, z, keep)) out.push(plant(x, z, 0.75 + random() * 0.55));
      }
    }
    return out;
  };
  // Tussocks: half in groups by the water (the wet ground the cattle leave), half over the field.
  const byWater = () => {
    const x = brook.minX + 4 + random() * (meadow.maxX - brook.minX - 8);
    const side = random() < 0.5 ? -1 : 1;
    return [x, brook.zAt(x) + side * (brook.halfAt(x) + 2 + random() * 14)];
  };
  const tussocks = [...scatter(RIVERSIDE_COUNTS.tussocks / 2, 6, 5, byWater, 1.2), ...scatter(RIVERSIDE_COUNTS.tussocks / 2, 4, 8)];
  const thistles = scatter(RIVERSIDE_COUNTS.thistles, 9, 7);
  const rich = [...brook.drinks.map((d) => [d.x, brook.zAt(d.x) + d.side * (brook.halfAt(d.x) + 7)]), ...(river.worn ?? []).map(([x, z]) => [x, z]), [cross.x, cross.z - cross.half - reach - 2], [cross.x, cross.z + cross.half + reach + 2]];
  const docks = scatter(RIVERSIDE_COUNTS.docks, 5, 9, () => rich[Math.floor(random() * rich.length)]);
  const dung = scatter(RIVERSIDE_COUNTS.dung, 1, 0);

  // None on the ford's landings (#1060): left out once they are all placed, so the rest stand where they did.
  const ford = brook.ford?.();
  const offFord = (p) => !ford || Math.abs(p.x - ford.x) >= ford.reach + 1 || Math.abs(p.z - ford.z) >= ford.half + ford.back + 1;
  return { rushes: rushes.filter(offFord), sedge: sedge.filter(offFord), brookReeds: brookReeds.filter(offFord), stones, ruts, tussocks, thistles, docks, dung, fence: brookFence(layout, brook, roads) };
}
