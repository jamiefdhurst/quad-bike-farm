// The Old Pit's lane entrance as numbers (#1002), pure: no Three.js. Where the dressed lane gate, its bellmouth, the blocks, the height barrier, the
// two signs, the weeds, the buddleia, the remnant hedge and its litter stand, and the shape of the spoil bank inside the fence that you see from the
// lane. quarry.js lays the bank into the ground, quarryProps.js `buildPitEntrance` draws the rest, and farmPlacement.js lists what stands, all from
// these, so the three agree.
//
// Everything is placed in the gate's own frame: `u` metres out from the fence towards the lane (negative is inside the pit's field) and `v` metres
// along the fence. `frameOf(gate)` turns (u, v) into game metres.

import { streamFor } from './propStreams.js';
import { layHedge } from './hedgeLay.js';

/** The entrance's sizes, metres, real ones: a works entrance's gate, precast posts, an interlocking block, a height barrier and a works sign. */
export const ENTRANCE = {
  postW: 0.3, // the precast concrete gate posts, square with chamfered arrises
  postH: 1.8, // above the ground
  postSink: 0.45,
  leafH: 1.2, // a field gate's height
  hardcore: 2.8, // the bellmouth's half-width at the gate: the way and a little either side of the posts
  splay: 6, // the radius of the splay where it meets the lane: 17.6 m across its mouth
  rut: 0.95, // each rut this far either side of the middle of the way: a lorry's track
  rutHalf: 0.22,
  rutDip: 0.04, // how much lower the ruts lie than the hardcore round them
  block: { l: 1.6, w: 0.8, h: 0.8 }, // an interlocking concrete block
  barrier: { u: 5.5, clear: 2.1, post: 0.15, beam: 0.18, over: 0.45 }, // the height barrier: where, the height under its beam, its posts and beam, how far its posts stand beyond the way
  sign: { w: 1.5, h: 1.0, bottom: 0.95, post: 0.06 }, // the operator's board on two posts
  plate: { w: 0.6, h: 0.4, v: -1.15, y: 0.58 }, // the newer plate wired to the gate: its middle along the gate and its foot above the ground
  hedge: { u: 3.2, from: 7.5, to: 25.5 }, // the remnant hedge on the lane side of the fence, either side of the bellmouth
  bank: { u: -13, half: 10, h: 4, length: 56, taper: 7 }, // the spoil bank: its crest this far inside the fence, half its base across, its height and length
};

/** The operator's made-up name and the two signs' wording (British, and no real firm: a search found none of this name). */
export const SIGN_WORDS = {
  operator: 'THORNBY SAND & GRAVEL LTD',
  board: ['WORKS ENTRANCE', 'NO TIPPING'],
  plate: ['PRIVATE LAND', 'NO ACCESS'],
};

/** The gate's frame: `at(u, v)` is game metres, `yaw` the turn that points a model's +z out to the lane and its +x along +v. */
export function frameOf(gate) {
  const ox = -gate.inward[0];
  const oz = -gate.inward[1];
  const tx = -gate.inward[1];
  const tz = gate.inward[0];
  return {
    out: [ox, oz],
    along: [tx, tz],
    at: (u, v) => ({ x: gate.x + ox * u + tx * v, z: gate.z + oz * u + tz * v }),
    toFrame: (x, z) => ({ u: (x - gate.x) * ox + (z - gate.z) * oz, v: (x - gate.x) * tx + (z - gate.z) * tz }),
    yaw: Math.atan2(ox, oz),
  };
}

/** The pit's lane gate: the shut one of `gates` (quarry.js `gatesOf`), or null on a farm without one. */
export const laneGateOf = (gates) => (gates ?? []).find((g) => !g.open && g.haul) ?? null;

/** How far out from the gate the lane's tarmac begins, stepping out along the way: `onLane(x, z)` says whether a point is on it. */
export function laneReach(gate, onLane, max = 60) {
  const f = frameOf(gate);
  for (let u = 0; u < max; u += 0.1) {
    const p = f.at(u, 0);
    if (onLane(p.x, p.z)) return Math.round(u * 10) / 10;
  }
  return max;
}

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The bellmouth's half-width `u` m out from the gate, before its ragged edge: the way to the posts, splaying out over the last `splay` m to the lane (`reach`). */
export function bellmouthHalf(u, reach) {
  const R = ENTRANCE.splay;
  const s = u - (reach - R);
  return ENTRANCE.hardcore + (s > 0 ? R - Math.sqrt(Math.max(0, R * R - s * s)) : 0);
}

/** A small ragged wobble of the bellmouth's edge at `u` on side `side`, metres: the tarmac and hardcore broken back unevenly. */
export const raggedEdge = (u, side) => 0.18 * Math.sin(u * 1.9 + side * 2.1) + 0.11 * Math.sin(u * 4.3 + side) + 0.06 * Math.sin(u * 9.7 - side * 3);

/** 0..1 how much of the bellmouth at (u, v) is still tarmac (the rest is hardcore): broken back from the lane towards the gate, in islands. */
export function tarmacAt(u, v, reach) {
  const lump = 0.22 * Math.sin(u * 1.3 + v * 0.9) + 0.14 * Math.sin(u * 3.1 - v * 2.3 + 1) + 0.08 * Math.sin(v * 5.7 + u * 0.4);
  return smooth(0.32, 0.62, u / reach + lump);
}

/** How far below the bellmouth's surface the ruts take it at `v` along the gate: two lorry tracks. */
export function rutDip(v) {
  let d = 0;
  for (const c of [-ENTRANCE.rut, ENTRANCE.rut]) d = Math.max(d, 1 - smooth(ENTRANCE.rutHalf * 0.4, ENTRANCE.rutHalf * 1.6, Math.abs(v - c)));
  return d * ENTRANCE.rutDip;
}

/**
 * The spoil bank along the lane side of the pit's field (#1002), the pit's landmark from the lane: a long grassed bund `h` high, its crest `u` m inside
 * the fence, `length` m long centred on the lane gate, tapering at its ends. Pure numbers for `bankRise`.
 */
export function spoilBankOf(gate) {
  const f = frameOf(gate);
  const B = ENTRANCE.bank;
  const ends = [f.at(B.u, -B.length / 2), f.at(B.u, B.length / 2)];
  const reach = B.half + 1;
  const xs = [...ends.map((p) => p.x)];
  const zs = [...ends.map((p) => p.z)];
  return {
    ...B,
    frame: f,
    box: { minX: Math.min(...xs) - reach, maxX: Math.max(...xs) + reach, minZ: Math.min(...zs) - reach, maxZ: Math.max(...zs) + reach },
  };
}

/**
 * How high the spoil bank stands at (x, z), metres over the ground as it lies: a rounded bund with a gentle lump along it, nothing within the haul road's
 * gap (`roadDist(x, z)` is the distance to the nearest haul road's middle, `roadHalf` its half-width) and nothing outside its footprint.
 */
export function bankRise(bank, x, z, roadDist, roadHalf) {
  if (!bank || x < bank.box.minX || x > bank.box.maxX || z < bank.box.minZ || z > bank.box.maxZ) return 0;
  const { u, v } = bank.frame.toFrame(x, z);
  const across = Math.abs(u - bank.u) / bank.half;
  if (across >= 1) return 0;
  const half = bank.length / 2;
  if (Math.abs(v) >= half) return 0;
  const end = smooth(half, half - bank.taper, Math.abs(v));
  const profile = 0.5 + 0.5 * Math.cos(Math.PI * across);
  const lump = 1 + 0.07 * Math.sin(v * 0.31 + 0.6) + 0.05 * Math.sin(v * 0.83 - 1.1) - 0.04 * Math.sin(u * 0.9 + v * 0.2);
  // Full height again by roadHalf + 7.5, inside the haul roads' search boxes (quarry.js pads them roadHalf + 8), so no step where a box ends.
  const gap = smooth(roadHalf + 2, roadHalf + 7.5, roadDist(x, z));
  return bank.h * profile * end * lump * gap;
}

/**
 * Where everything at the lane entrance stands, in game metres, from the lane gate (`gate`, quarry.js) and `reach`, how far out the lane's tarmac
 * begins (`laneReach`). Its own random stream, so the builder and the list of placed things deal the same. Returns
 * `{ frame, reach, posts, leaves, bellmouth, ruts, puddles, blocks, barrier, sign, plate, hedges, buddleia, weeds, litter, gravel, chunks }`.
 */
export function entrancePlan(gate, reach) {
  const random = streamFor('pitEntrance');
  const f = frameOf(gate);
  const E = ENTRANCE;
  const gateW = gate.width - 0.4; // the leaves' length together, as #685's gate (props.js)
  const postV = gate.width / 2 + 0.05; // on the fence's strainers at the gap's edges (wireFence.js), so each stands inside its post
  const half = (u) => bellmouthHalf(u, reach);
  const posts = [-1, 1].map((side) => ({ side, ...f.at(0, side * postV), v: side * postV }));
  const leaves = [-1, 1].map((side) => ({ side, hinge: side * (gateW / 2), length: gateW / 2 - 0.02 }));

  // The bellmouth: rows across it from the gate's line out to just under the lane's edge, each with its two ragged edges.
  const rows = [];
  // From a metre inside the gate, where the hardcore meets the haul road, to a quarter of a metre under the lane's edge.
  const us = [];
  for (let u = -1; u < reach + 0.2; u += 0.5) us.push(u);
  us.push(reach + 0.25);
  for (const u of us) rows.push({ u, left: -(half(u) + raggedEdge(u, -1)), right: half(u) + raggedEdge(u, 1) });
  const ruts = [-1, 1].map((side) => ({ v: side * E.rut, from: 0.2, to: reach - 0.4 }));
  // Puddles lying in the ruts on the hardcore, where the lorries' wheels dug deepest.
  const puddles = [
    { u: 1.9, v: -E.rut, len: 1.6 },
    { u: 4.4, v: E.rut, len: 2.1 },
    { u: 7.3, v: -E.rut, len: 1.3 },
    { u: 9.6, v: E.rut, len: 1.7 },
  ].map((p) => ({ ...p, w: E.rutHalf * 1.7, ...f.at(p.u, p.v) }));
  // The blocks: one across the near half of the way just out from the gate, one dumped askew on the splay.
  const blocks = [
    { u: 1.7, v: 1.05, turn: 0.12 },
    { u: 9.2, v: -2.7, turn: 0.62 },
  ].map((b) => ({ ...b, ...f.at(b.u, b.v) }));
  // The height barrier across the way, its posts outside the bellmouth's edge.
  const bu = E.barrier.u;
  const barrier = { u: bu, span: half(bu) + E.barrier.over, posts: [-1, 1].map((side) => ({ side, ...f.at(bu, side * (half(bu) + E.barrier.over)) })) };
  // The operator's board, facing the lane on the north side of the splay (+v is north at the Old Pit's gate), and the newer plate wired to the gate.
  const su = reach - 3.6;
  const sign = { u: su, v: half(su) + 1.4, ...f.at(su, half(su) + 1.4), turn: 0.08 };
  sign.posts = [-1, 1].map((side) => f.at(su, sign.v + side * (E.sign.w / 2 - 0.18)));
  const plate = { ...E.plate, ...f.at(0.05, E.plate.v) };
  // The remnant hedge either side of the bellmouth, on the lane side of the fence.
  const hedges = [-1, 1].map((side) => {
    const a = f.at(E.hedge.u, side * E.hedge.from);
    const b = f.at(E.hedge.u, side * E.hedge.to);
    return { side, a, b };
  });
  // Buddleia, seeded in the broken ground along the fence: inside it by one post and further along either way, and outside it at one hedge's end.
  const buddleia = [
    { u: -1.7, v: -4.3, h: 2.6 },
    { u: 1.3, v: 5.6, h: 2.2 },
    { u: -1.9, v: 11.5, h: 2.9 },
    { u: -1.5, v: -15.8, h: 2.3 },
  ].map((b) => ({ ...b, ...f.at(b.u, b.v), yaw: random() * Math.PI * 2 }));
  // Weeds along both sides of the fence away from the way, round the posts, the blocks' feet, the barrier's posts and the sign's, and at the hedge's foot.
  const weeds = [];
  const weed = (u, v, kind) => weeds.push({ u, v, kind, ...f.at(u, v), yaw: random() * Math.PI * 2, scale: 0.6 + random() * 0.6 });
  const kinds = ['nettle', 'dock', 'parsley'];
  for (let i = 0; i < 46; i++) {
    const side = i % 2 ? 1 : -1;
    const v = side * (3.1 + random() * 19);
    weed((random() - 0.5) * 1.6, v, kinds[Math.floor(random() * 3)]);
  }
  for (const p of posts) for (let k = 0; k < 3; k++) weed((random() - 0.3) * 0.9, p.v + p.side * (0.35 + random() * 0.4), kinds[k]);
  for (const b of blocks) for (let k = 0; k < 2; k++) weed(b.u + (random() - 0.5) * 1.2, b.v + (k ? 1 : -1) * (0.9 + random() * 0.2), kinds[k + 1]);
  for (const p of barrier.posts) weed(bu + (random() - 0.5) * 0.5, p.side * (barrier.span + 0.3), 'nettle');
  for (const s of [-1, 1]) weed(su + 0.3, sign.v + s * (ENTRANCE.sign.w / 2 - 0.18), 'dock');
  for (const h of [-1, 1]) for (let i = 0; i < 8; i++) weed(E.hedge.u + 1.2 + random() * 0.6, h * (E.hedge.from + random() * (E.hedge.to - E.hedge.from)), kinds[Math.floor(random() * 3)]);
  // Litter: snagged in the hedge, at the foot of the fence, and thrown on the verge by the mouth.
  // Snagged on the hedge's face towards the lane (its leaves reach about 1.3 m from its line), half in it, so it shows.
  const litter = [
    { kind: 'bag', u: E.hedge.u + 1.25, v: 9.8, y: 0.95 },
    { kind: 'packet', u: E.hedge.u + 1.3, v: 14.2, y: 0.55 },
    { kind: 'packet', u: E.hedge.u + 1.3, v: -11.6, y: 0.7 },
    { kind: 'can', u: E.hedge.u + 1.4, v: -19.4, y: 0 },
    { kind: 'bag', u: E.hedge.u + 1.2, v: -22.3, y: 1.2 },
    { kind: 'packet', u: E.hedge.u + 1.3, v: 21.5, y: 0.35 },
    { kind: 'bottle', u: 0.35, v: 6.4, y: 0 },
    { kind: 'can', u: 0.3, v: -7.9, y: 0 },
    { kind: 'packet', u: -0.25, v: 3.6, y: 0 },
    { kind: 'can', u: reach - 1.2, v: half(reach - 1.2) + 1.1, y: 0 },
  ].map((l) => ({ ...l, ...f.at(l.u, l.v), yaw: random() * Math.PI * 2, tip: random() }));
  // Chippings washed out of the hardcore onto the lane's near half, thickest by the mouth.
  const gravel = [];
  for (let i = 0; i < 260; i++) {
    const out = reach - 1 + Math.pow(random(), 1.6) * 3.4; // from just inside the edge to about 2.4 m onto the tarmac
    const v = (random() - 0.5) * 2 * (half(reach) - 1.5) * (1 - 0.35 * (out - reach + 1) / 3.4);
    gravel.push({ u: out, v, ...f.at(out, v), size: 0.012 + random() * 0.03, yaw: random() * Math.PI * 2, onLane: out > reach });
  }
  // Loose pieces of tarmac where it has broken up at its ragged edge towards the gate.
  const chunks = [];
  for (let i = 0; i < 14; i++) {
    const u = reach * (0.3 + random() * 0.35);
    const v = (random() - 0.5) * 2 * (half(u) - 0.4);
    chunks.push({ u, v, ...f.at(u, v), size: 0.25 + random() * 0.4, yaw: random() * Math.PI * 2, tilt: (random() - 0.5) * 0.14, shape: random() });
  }
  return { frame: f, gate, reach, gateW, postV, posts, leaves, bellmouth: { rows }, ruts, puddles, blocks, barrier, sign, plate, hedges, buddleia, weeds, litter, gravel, chunks };
}

/**
 * The remnant hedge's two runs laid out as the farm's hedges are (hedgeLay.js `layHedge`, from their own stream): each `{ blocks, colliders }`, for the
 * builder and the list of placed things alike. `o` is { T, H, heightAt, blockReach }.
 */
export function entranceHedges(plan, { T, H, heightAt, blockReach }) {
  const random = streamFor('pitEntranceHedge');
  return plan.hedges.map(({ a, b }) => {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const h = { x1: a.x, z1: a.z, dx: (b.x - a.x) / length, dz: (b.z - a.z) / length, length, gaps: [], alongX: null };
    return layHedge(h, { T, H, heightAt, random, blockReach, bushReach: 0.5, bushes: false });
  });
}
