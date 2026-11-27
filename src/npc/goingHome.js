// Going home (#100): calling it a day at the wall calendar sends the girls home before the recap. Each takes her own car off the pad by the Dutch
// barn, down the drive over the cattle grid and away down the public lane (or round Back Lane, or onto the A-road); a girl you gave a lift that morning (her car isn't here) goes and sits in
// your car to wait for you instead. Pure: the game says where each girl is and acts on the events; the driving is HerDrive's `park` route.
// Jess's speed on the way out is her own in carGo.js (she gives it everything), and Amy tuts at it. Tested in tests/goingHome.test.js.

import { roadNetwork } from '../world/roads.js';
import { laneDeparture, aRoadOut, junctionSOf } from '../world/laneRoutes.js';

export const DEFAULT_GOING_HOME_PARAMS = {
  giveUpAfter: 360, // seconds before a girl who still hasn't got away is counted gone anyway (stuck, or a very long walk to the pad)
  laneZ: 95, // how far down the public lane (z) her route runs: past this she is gone
  tutAfter: 1.5, // seconds after Jess sets off that Amy tuts, if Amy is still there to hear it
  backLaneAmy: 0.15, // 0..1 the chance Amy drives home round Back Lane rather than down the lane, where the farm has one (the new farm)
  backLaneJess: 0.45, // and Jess, who likes the road better and drives it as she drives everything
  backLaneMetres: 160, // m along Back Lane from the lane that she is counted gone
  aRoadAmy: 0.4, // 0..1 the chance (of what is left after Back Lane) she drives home north up the lane and out onto the A-road, where the farm has one (#687)
  aRoadJess: 0.4,
  aRoadMetres: 25, // m from the end of her route on the A-road that she is counted gone
};

export const GOING_HOME_PARAM_RANGES = {
  backLaneAmy: [0, 1, 0.05],
  backLaneJess: [0, 1, 0.05],
  backLaneMetres: [60, 400, 10],
  aRoadAmy: [0, 1, 0.05],
  aRoadJess: [0, 1, 0.05],
  aRoadMetres: [10, 80, 5],
  giveUpAfter: [60, 900, 10],
  laneZ: [20, 200, 5],
  tutAfter: [0, 10, 0.5],
};

/**
 * Her route out, for a car turned to face the road (the row is nosed in to the Dutch barn with no room to turn, so the game swings it round
 * to the south-east before she gets in): on to the drive, along it over the cattle grid and away down the lane. The last point is `laneZ` down it, where
 * she is gone. `slot` is where her car is parked ({ x, z }).
 */
export function leaveRoute(slot, layout, p = DEFAULT_GOING_HOME_PARAMS, via = 'lane') {
  const lane = layout.publicLane;
  const roadZ = layout.road.z;
  const gone = goneBeyond(layout, p);
  // The drive (#568): along it, over the cattle grid (no gate to open) and out onto the lane.
  const over = layout.road.grid.x;
  if (via === 'backLane' && backLaneOf(layout)) {
    // Or the other way: out of the drive, north up the lane keeping left, then in at Back Lane's north end and along it.
    const lead = backLaneOf(layout).pointsAlong('backLane', { step: 14, from: 0, to: p.backLaneMetres });
    return [
      { x: slot.x + 3.5, z: roadZ + 1.5 },
      { x: over - 6, z: roadZ + 1.5 },
      { x: over + 6, z: roadZ + 1.5 },
      { x: lane.x - 5, z: roadZ + 1.5 },
      { x: lane.x - 1.3, z: roadZ - 6 },
      { x: lane.x - 1.3, z: lead[0].z + 24 },
      ...lead.map((q) => ({ x: q.x, z: q.z })),
    ];
  }
  if (via === 'aRoad' && aRoadOf(layout)) {
    // Or north up the lane, round its bend to the A-road and out onto it (#687): the route ends where the A-road leaves the map.
    return [
      { x: slot.x + 3.5, z: roadZ + 1.5 },
      { x: over - 6, z: roadZ + 1.5 },
      { x: over + 6, z: roadZ + 1.5 },
      { x: lane.x - 5, z: roadZ + 1.5 },
      { x: lane.x - 1.3, z: roadZ - 6 },
      ...aRoadRoute(layout, roadZ).map(({ x, z }) => ({ x, z })),
    ];
  }
  return [
    { x: slot.x + 3.5, z: roadZ + 1.5 },
    { x: over - 6, z: roadZ + 1.5 },
    { x: over + 6, z: roadZ + 1.5 },
    { x: lane.x - 5, z: roadZ + 1.5 },
    { x: lane.x - 1.3, z: roadZ + 4.5 },
    { x: lane.x, z: roadZ + 10 },
    { x: lane.x, z: gone.z },
  ];
}

/**
 * Where a girl is counted gone: past the drive's mouth and `laneZ` less 2 m down the lane from it, or at the end of her way along Back Lane or the A-road.
 */
export function goneBeyond(layout, p = DEFAULT_GOING_HOME_PARAMS, via = 'lane') {
  if (via === 'aRoad' && aRoadOf(layout)) {
    const end = aRoadRoute(layout, layout.road.z).at(-1);
    return { x: end.x, z: end.z, aRoad: true };
  }
  if (via === 'backLane' && backLaneOf(layout)) {
    const lead = backLaneOf(layout).pointsAlong('backLane', { step: 14, from: 0, to: p.backLaneMetres });
    return { x: lead[lead.length - 1].x, z: lead[lead.length - 1].z, backLane: true };
  }
  return { x: layout.publicLane.x - 5, z: layout.road.z + (p.laneZ - 2) };
}

/** Whether a car at `position` is past where its girl is counted gone (`goneBeyond`, with ten metres' give on the way down the lane). */
export function hasGone(layout, p, position, via = 'lane') {
  const away = goneBeyond(layout, p, via);
  if (away.backLane) return Math.hypot(position.x - away.x, position.z - away.z) < 20;
  if (away.aRoad) return Math.hypot(position.x - away.x, position.z - away.z) < p.aRoadMetres;
  return position.x > away.x && position.z > away.z - 10;
}

export class GoingHome {
  constructor(params = { ...DEFAULT_GOING_HOME_PARAMS }) {
    this.p = params;
    this.reset();
  }

  reset() {
    this.active = false;
    this.clock = 0;
    this.girls = {}; // id -> { how: 'drive' | 'lift', state: 'going' | 'gone', sentOff: clock }
    this.tutted = false;
  }

  /**
   * She calls it a day. `girls` is [{ id, how }]: 'drive' (her own car is here) or 'lift' (she came with you and waits at your car). A girl with
   * neither is not in it, and she is home as far as the day is concerned.
   */
  begin(girls) {
    this.reset();
    this.active = true;
    for (const g of girls) this.girls[g.id] = { how: g.how, state: 'going', sentOff: null };
    return Object.keys(this.girls).map((id) => ({ type: 'go', girl: id, how: this.girls[id].how }));
  }

  /** Whether everyone has got away (or there was no one to send). */
  get done() {
    return this.active && Object.values(this.girls).every((g) => g.state === 'gone');
  }

  /** Her car is off down the road: Jess's drives faster, so Amy hears her go. */
  setOff(id) {
    const g = this.girls[id];
    if (g && g.sentOff === null) g.sentOff = this.clock;
  }

  /** She has got away: her car down the lane, or she is sat in yours. */
  gone(id) {
    const g = this.girls[id];
    if (g) g.state = 'gone';
  }

  /**
   * Moves on `dt` seconds. Returns events: { type: 'tut', girl: 'amy' } once, when Jess has been away a moment and Amy is still on the farm;
   * { type: 'giveUp', girl } for each girl who has taken too long; { type: 'done' } once, when everyone has gone.
   */
  update(dt) {
    if (!this.active) return [];
    const ev = [];
    this.clock += dt;
    const jess = this.girls.jess;
    const amy = this.girls.amy;
    if (!this.tutted && jess?.how === 'drive' && jess.sentOff !== null && this.clock - jess.sentOff >= this.p.tutAfter && amy && amy.state === 'going') {
      this.tutted = true;
      ev.push({ type: 'tut', girl: 'amy' });
    }
    if (this.clock >= this.p.giveUpAfter) {
      for (const [id, g] of Object.entries(this.girls)) {
        if (g.state === 'gone') continue;
        g.state = 'gone';
        ev.push({ type: 'giveUp', girl: id });
      }
    }
    if (this.done) {
      this.active = false;
      ev.push({ type: 'done' });
    }
    return ev;
  }

  /** In a line, for the console and the Girls tab. */
  describe(names = {}) {
    if (!this.active) return 'nobody is going home';
    return Object.entries(this.girls)
      .map(([id, g]) => `${names[id] ?? id}: ${g.state === 'gone' ? 'gone' : g.how === 'lift' ? 'going to your car' : g.sentOff === null ? 'walking to her car' : 'driving off'}`)
      .join(', ');
  }
}

/** The road network if the farm has a Back Lane (the new farm), else null. Built once for each layout. */
const networks = new WeakMap();
function backLaneOf(layout) {
  if (!networks.has(layout)) {
    const net = roadNetwork(layout);
    networks.set(layout, net.road('backLane') ? net : null);
  }
  return networks.get(layout);
}

/** The road network if the farm has an A-road (the new farm), else null. */
const aNetworks = new WeakMap();
function aRoadOf(layout) {
  if (!aNetworks.has(layout)) {
    const net = roadNetwork(layout);
    aNetworks.set(layout, net.road('aRoad') ? net : null);
  }
  return aNetworks.get(layout);
}

/** Her way out along the lane from the drive at z `roadZ`, north round the bend and onto the A-road, up it to where it leaves the map: waypoints { x, z }. */
function aRoadRoute(layout, roadZ) {
  const net = aRoadOf(layout);
  return [...laneDeparture(net, -1, roadZ), ...aRoadOut(net, junctionSOf(net), true)];
}

/**
 * How a girl drives home today: 'backLane', 'aRoad' or 'lane'. `roll` is a 0..1 draw the game makes for her. Only where the farm has a Back Lane and a drive onto the
 * lane (the new farm); Jess takes it more often than Amy (`backLaneJess` against `backLaneAmy`).
 */
export function homeVia(layout, id, roll, p = DEFAULT_GOING_HOME_PARAMS) {
  if (!backLaneOf(layout) || layout.road.grid.x === undefined) return 'lane';
  const back = id === 'jess' ? p.backLaneJess : p.backLaneAmy;
  if (roll < back) return 'backLane';
  if (aRoadOf(layout) && roll < back + (1 - back) * (id === 'jess' ? p.aRoadJess : p.aRoadAmy)) return 'aRoad';
  return 'lane';
}
