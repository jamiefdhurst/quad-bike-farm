// The neighbour's farm over the lane (layout.neighbourFarm): a walled yard on the public lane's west side with a farmhouse, a barn and three
// vehicles parked about, and the neighbour who lives there. Pure: the shapes (for the props, the terrain, the map and the walls), the
// invisible walls that make a stretch of the lane ridable, and `Neighbour`, who stands about, turns to face whoever comes and greets them.

import { villageShape } from './village.js';
import { yardFootprints, yardPiece } from './neighbourYard.js';

export const DEFAULT_NEIGHBOUR_PARAMS = {
  greetRange: 16, // m: you or a girl comes this close and she says hello
  greetEvery: 240, // s before she greets the same visit again (she remembers you were just here)
  chatRange: 7, // m: this close, on foot, and she makes conversation now and then
  chatEvery: 40, // s between one remark and the next while you stand by her
  farewellRange: 32, // m: you ride off past this far after a good while near and she says goodbye
  nearForFarewell: 12, // s near her before leaving counts as a visit worth a goodbye
  indoorsDark: 0.7, // 0..1 darkness after which she goes in (the door light comes on and the house windows glow)
  turnRate: 2.4, // rad/s she turns to face you
  lookRange: 24, // m: she turns to watch you while you are this close
};

export const NEIGHBOUR_PARAM_RANGES = {
  greetRange: [4, 40, 1],
  greetEvery: [10, 900, 10],
  chatRange: [2, 20, 0.5],
  chatEvery: [5, 300, 5],
  farewellRange: [10, 80, 1],
  nearForFarewell: [1, 60, 1],
  indoorsDark: [0.2, 1, 0.05],
  turnRate: [0.5, 8, 0.1],
  lookRange: [6, 60, 1],
};

/** How big each parked vehicle is for its collider: half length (along its heading), half width and height, in metres. */
export const PARKED_SIZES = {
  tor: { hl: 2.15, hw: 0.95, h: 1.95 },
  utv: { hl: 1.55, hw: 0.85, h: 1.85 },
  tractor: { hl: 1.9, hw: 1.0, h: 2.4 },
};

const EAST_REACH = 1; // m the levelling eases over on the lane side, away from the gateway (see floorAt), on a farm whose lane runs by the wall
const rect = (x, z, hx, hz) => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
const inRect = (r, x, z, margin = 0) => x > r.minX - margin && x < r.maxX + margin && z > r.minZ - margin && z < r.maxZ + margin;
const outside = (r, x, z) => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The yard's shape from the layout, or null on a farm without one: the wall's outline and the boxes it is built from (the wall on the gateway's
 * side, `gateway.side` 'east' or 'west', has the gateway in it), the house and the barn (outside, roof and door), the parked vehicles with
 * their footprints, and where she stands.
 */
export function neighbourFarmShape(layout) {
  const n = layout.neighbourFarm;
  if (!n) return null;
  const y = n.yard;
  const w = y.wall;
  const side = n.gateway.side ?? 'east'; // which wall the gateway is in: the east wall on today's farm (the lane is beside it), the west on the new one (the lane is away to the west)
  const gx = side === 'west' ? y.minX + w / 2 : y.maxX - w / 2;
  const otherX = side === 'west' ? y.maxX - w / 2 : y.minX + w / 2;
  const gz0 = n.gateway.z - n.gateway.width / 2;
  const gz1 = n.gateway.z + n.gateway.width / 2;
  // The wall as boxes { x, z, hx, hz } (centre and half sizes in plan): north, south and the wall opposite the gateway whole, the gateway's wall in two pieces round it.
  const walls = [
    { x: (y.minX + y.maxX) / 2, z: y.minZ + w / 2, hx: (y.maxX - y.minX) / 2, hz: w / 2 },
    { x: (y.minX + y.maxX) / 2, z: y.maxZ - w / 2, hx: (y.maxX - y.minX) / 2, hz: w / 2 },
    { x: otherX, z: (y.minZ + y.maxZ) / 2, hx: w / 2, hz: (y.maxZ - y.minZ) / 2 - w },
    { x: gx, z: (y.minZ + w + gz0) / 2, hx: w / 2, hz: (gz0 - y.minZ - w) / 2 },
    { x: gx, z: (gz1 + y.maxZ - w) / 2, hx: w / 2, hz: (y.maxZ - w - gz1) / 2 },
  ];
  const h = n.house;
  const b = n.barn;
  // The main range, and the wing and the lean-to as footprints of their own: the wing's roof is its own, the lean-to's is the main roof's south slope carried on down (a catslide).
  const wing = h.wing ? { ...h.wing, outer: rect(h.wing.x, h.wing.z, h.wing.halfX, h.wing.halfZ), roof: rect(h.wing.x - 0.175, h.wing.z, h.wing.halfX + 0.175, h.wing.halfZ + 0.4) } : null;
  const leanTo = h.leanTo ? { ...h.leanTo, outer: rect(h.leanTo.x, h.leanTo.z, h.leanTo.halfX, h.leanTo.halfZ), roof: rect(h.leanTo.x, h.leanTo.z, h.leanTo.halfX + 0.1, h.leanTo.halfZ + 0.35) } : null;
  const garden = h.garden ? { ...h.garden, outer: { minX: h.garden.minX, maxX: h.garden.maxX, minZ: h.garden.minZ, maxZ: h.garden.maxZ } } : null;
  const house = { ...h, wing, leanTo, garden, outer: rect(h.x, h.z, h.halfX, h.halfZ), roof: rect(h.x, h.z, h.halfX + 0.35, h.halfZ + 0.4) };
  const barn = { ...b, outer: rect(b.x, b.z, b.halfX, b.halfZ), roof: rect(b.x, b.z, b.halfX + 0.3, b.halfZ + 0.35) };
  // The dairy (the new farm's neighbour has one): the parlour and the bulk tank's room are buildings with roofs, the collecting yard is open slab, the slurry store is round.
  const mk = (o) => o ? { ...o, outer: rect(o.x, o.z, o.halfX, o.halfZ), roof: rect(o.x, o.z, o.halfX + 0.3, o.halfZ + 0.35) } : null;
  const parlour = mk(n.parlour);
  const tankRoom = mk(n.tankRoom);
  const collecting = n.collecting ? { ...n.collecting, outer: { minX: n.collecting.minX, maxX: n.collecting.maxX, minZ: n.collecting.minZ, maxZ: n.collecting.maxZ } } : null;
  const slurry = n.slurry ? { ...n.slurry, outer: rect(n.slurry.x, n.slurry.z, n.slurry.r, n.slurry.r) } : null;
  const parked = n.parked.map((p) => {
    const s = PARKED_SIZES[p.kind];
    return { ...p, ...s, outer: rect(p.x, p.z, Math.max(s.hl, s.hw), Math.max(s.hl, s.hw)) };
  });
  return {
    yard: y,
    outline: rect((y.minX + y.maxX) / 2, (y.minZ + y.maxZ) / 2, (y.maxX - y.minX) / 2, (y.maxZ - y.minZ) / 2),
    walls,
    gateway: { x: gx, z: n.gateway.z, minZ: gz0, maxZ: gz1, half: n.gateway.width / 2, side },
    // Where the ground is levelled from (`floor.at`, default her yard's middle) and how far it eases out over (`floor.reach`, default 4 m): a yard on a slope.
    floor: n.floor ?? null,
    house,
    barn,
    parlour,
    collecting,
    tankRoom,
    slurry,
    parked,
    // What stands about the yard (neighbourYard.js): each piece with its footprint, those on a wall (the cat) included with none.
    furniture: (n.furniture ?? []).map(yardPiece).filter(Boolean),
    stand: n.stand,
    // Where she is when she is indoors, so a nearby sound can come from the house.
    indoors: { x: h.x, z: h.z },
    // The concrete in front of the buildings and round the gateway, inside the wall (`slab` in the layout when the yard has its own shape of it).
    slab: n.slab ?? (side === 'west'
      ? { minX: y.minX + w, maxX: y.maxX - w - 2, minZ: y.minZ + w + 4, maxZ: house.outer.minZ - 1.2 }
      : { minX: y.minX + w + 2, maxX: y.maxX - w, minZ: y.minZ + w + 4, maxZ: house.outer.minZ - 1.2 }),
  };
}

/** Three metres inside her gateway, or null on a farm without her yard: where `tp neighbour` and the panel's button put you. */
export function neighbourGate(layout) {
  const s = neighbourFarmShape(layout);
  return s ? { x: s.gateway.x + (s.gateway.side === 'west' ? 3 : -3), z: s.gateway.z } : null;
}

/** Whether (x, z) is within `margin` m of the yard's wall (or inside it): the distant trees keep clear of her farm and the lane beside it. */
export function nearNeighbourYard(layout, x, z, margin) {
  const s = neighbourFarmShape(layout);
  return !!s && outside(s.outline, x, z) < margin;
}

/** The yard's buildings, vehicles and wall as the rest of the world sees them: footprints, shelter, levelling and what is built where. */
export function createNeighbourFarm(layout) {
  const s = neighbourFarmShape(layout);
  if (!s) return null;
  const dairy = [s.parlour, s.tankRoom].filter(Boolean);
  const footprints = [s.house.outer, ...(s.house.wing ? [s.house.wing.outer] : []), ...(s.house.leanTo ? [s.house.leanTo.outer] : []), s.barn.outer, ...dairy.map((d) => d.outer), ...(s.slurry ? [s.slurry.outer] : []), ...s.parked.map((p) => p.outer), ...yardFootprints(s.furniture).map((f) => f.outer)];
  /** Under the house's, the barn's, the parlour's or the tank room's roof: out of the rain. */
  const covered = (x, z) => inRect(s.house.roof, x, z) || (s.house.wing && inRect(s.house.wing.roof, x, z)) || (s.house.leanTo && inRect(s.house.leanTo.roof, x, z)) || inRect(s.barn.roof, x, z) || dairy.some((d) => inRect(d.roof, x, z));
  /** On the yard's wall, a building or a parked vehicle (or within `margin` of one). */
  const builtAt = (x, z, margin = 0) =>
    footprints.some((r) => inRect(r, x, z, margin)) || s.walls.some((wb) => inRect({ minX: wb.x - wb.hx, maxX: wb.x + wb.hx, minZ: wb.z - wb.hz, maxZ: wb.z + wb.hz }, x, z, margin));
  /** Whether (x, z) is inside the wall. */
  const inYard = (x, z, margin = 0) => inRect(s.outline, x, z, -margin);
  /**
   * 0..1 how much to level the ground at (x, z) to the yard's, and the level there from `ground(x, z)` at its middle: flat inside the wall,
   * easing back over `reach` m outside it. On the east, towards the lane, it eases over barely a metre (the lane's own edge is 1.1 m from the
   * wall) except about the gateway, where it takes the full reach to ramp up from the lane; pulled further, the yard's level would drag the
   * tarmac sideways across a slope and give it a camber.
   */
  function floorAt(x, z, ground, reach = s.floor?.reach ?? 4) {
    const c = s.outline;
    const near = Math.abs(z - s.gateway.z);
    const eastReach = EAST_REACH + (reach - EAST_REACH) * (1 - smooth(clamp01((near - 6) / 14)));
    const r = !s.floor && x > c.maxX ? Math.min(reach, eastReach) : reach; // only a lane right beside the wall (today's farm) narrows it
    const d = outside(c, x, z);
    if (d >= r) return null;
    const from = s.floor?.at ?? { x: (c.minX + c.maxX) / 2, z: (c.minZ + c.maxZ) / 2 };
    return { k: 1 - smooth(clamp01(d / r)), level: ground(from.x, from.z) };
  }
  return { shape: s, footprints, covered, builtAt, inYard, floorAt };
}

// Her ----------------------------------------------------------------------

const wrap = (a) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;

/**
 * The neighbour in her yard. `update(dt, ctx)` takes `targets` ([{ x, z, kind: 'you' | 'girl', onFoot }]), `darkness` and `rain`, turns her
 * to face whoever is near, and returns the events of this step: { type: 'greet' | 'chat' | 'farewell' | 'indoors' | 'outdoors', key } where
 * `key` names the kind of line to say (neighbourLines.js).
 */
export class Neighbour {
  constructor(shape, params = { ...DEFAULT_NEIGHBOUR_PARAMS }, random = Math.random) {
    this.shape = shape;
    this.p = params;
    this.random = random;
    this.x = shape.stand.x;
    this.z = shape.stand.z;
    this.yaw = shape.stand.yaw;
    this.indoors = false;
    this.away = false; // out calling at the farm: not in her yard, so she does nothing here (setAway)
    this.greetedFor = 0; // s left before she greets again
    this.chatFor = 0;
    this.nearTime = 0; // s someone has been near her this visit
    this.metBefore = false;
    this.watching = null; // who she is looking at now
  }

  /** She goes out (calling at the farm) or comes home: home, she is at her door facing the yard again, as she was left. */
  setAway(away) {
    if (away === this.away) return;
    this.away = away;
    this.watching = null;
    this.nearTime = 0;
    this.x = this.shape.stand.x;
    this.z = this.shape.stand.z;
    this.yaw = this.shape.stand.yaw;
  }

  update(dt, { targets = [], darkness = 0, rain = 0 }) {
    const events = [];
    const p = this.p;
    if (this.away) return events; // she is out: her yard has nobody to greet, chat to or go indoors
    this.greetedFor = Math.max(0, this.greetedFor - dt);
    this.chatFor = Math.max(0, this.chatFor - dt);
    const wantsIn = darkness > p.indoorsDark;
    if (wantsIn !== this.indoors) {
      this.indoors = wantsIn;
      events.push({ type: wantsIn ? 'indoors' : 'outdoors' });
    }
    if (this.indoors) {
      this.watching = null;
      this.nearTime = 0;
      return events;
    }
    let near = null;
    let nd = Infinity;
    for (const t of targets) {
      const d = Math.hypot(t.x - this.x, t.z - this.z);
      if (d < nd) {
        near = t;
        nd = d;
      }
    }
    const you = targets.find((t) => t.kind === 'you');
    const youD = you ? Math.hypot(you.x - this.x, you.z - this.z) : Infinity;
    // She looks at whoever is nearest (inside lookRange), else back to where she stands.
    this.watching = near && nd < p.lookRange ? near : null;
    const want = this.watching ? Math.atan2(this.watching.x - this.x, this.watching.z - this.z) : this.shape.stand.yaw;
    const turn = wrap(want - this.yaw);
    this.yaw += Math.max(-p.turnRate * dt, Math.min(p.turnRate * dt, turn));
    if (youD < p.greetRange || (near && nd < p.greetRange && !you)) this.nearTime += dt;
    if (near && nd < p.greetRange && this.greetedFor <= 0) {
      this.greetedFor = p.greetEvery;
      this.chatFor = p.chatEvery * 0.5;
      events.push({ type: 'greet', key: rain > 0.35 ? 'greetWet' : this.metBefore ? 'greetAgain' : 'greet', who: near.kind });
      this.metBefore = true;
    } else if (you && you.onFoot && youD < p.chatRange && this.chatFor <= 0 && this.greetedFor < p.greetEvery - 4) {
      this.chatFor = p.chatEvery * (0.8 + this.random() * 0.4);
      events.push({ type: 'chat', key: 'chat', who: 'you' });
    }
    if (this.nearTime > p.nearForFarewell && youD > p.farewellRange) {
      this.nearTime = 0;
      events.push({ type: 'farewell', key: 'farewell', who: 'you' });
    } else if (youD > p.farewellRange * 1.5) {
      this.nearTime = 0;
    }
    return events;
  }

  /** Forces a greeting now (the debug panel and the console). */
  greetNow() {
    this.greetedFor = 0;
  }
}
