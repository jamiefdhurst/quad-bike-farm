// What the console's commands need from the game: where things are, putting them somewhere else, the vehicle verbs, the girls' actions
// and the weather. Everything calls the same methods the debug panel and the game itself use.
import { loadSteps } from '../core/loadSteps.js';
import { girlActions } from '../debug/girlActions.js';
import { jobActions } from '../debug/jobActions.js';
import { fixEverything, startWarm, switchOff } from '../debug/vehicleDebug.js';
import { SCENES, runScene } from '../debug/scenes.js';
import { WEATHER_KINDS } from '../world/weather.js';
import { describeFieldNames } from '../world/fieldNames.js';
import { plantSite, plantPoint } from '../world/plantSite.js';
import { pitRide } from '../world/pitScrub.js';
import { labelSpot } from '../hud/farmMap.js';
import { BUILT_KINDS } from '../world/fieldLandmarks.js';
import { neighbourGate } from '../world/neighbourFarm.js';
import { barnFrame, barnLocal } from '../world/barn.js';
import { sAlong } from '../world/laneSigns.js';
import { layByOf } from '../world/aRoadFittings.js';
import { gridPlace } from '../world/moor.js';
import { faceYaw } from '../world/trailProps.js';
import { waterEdge } from '../world/riverPlaces.js';

/** In front of the Fern Trail's marker post, which stands on the trail's entrance and faces the lead-in: `tp me fern` must not drop you inside it. */
export function fernMarkerSpot(woods) {
  const { x, z } = woods.trail.entrance;
  const yaw = faceYaw(x, z, woods.leadIn);
  return { x: x + Math.sin(yaw) * 1.5, z: z + Math.cos(yaw) * 1.5 };
}

const DEG = 180 / Math.PI;
const norm = (deg) => ((deg % 360) + 360) % 360;
const round = (v, n = 1) => Math.round(v * 10 ** n) / 10 ** n;

export const VEHICLE_VERBS = [
  { name: 'start', help: 'running and warm, fuel on (no cranking)' },
  { name: 'stop', help: 'ignition off, fuel tap off' },
  { name: 'warm', help: 'engine up to temperature' },
  { name: 'cool', help: 'engine stone cold' },
  { name: 'fill', help: 'fill the tank' },
  { name: 'load', help: 'winch it onto the bale trailer (ramps down at once; not the tractor, UTV or the Tor and the Crag)' },
  { name: 'unload', help: 'pay it back down the trailer\'s ramps' },
  { name: 'rackcan', help: 'stand the red jerry can on its rack, loose (quads with a rack)' },
  { name: 'racktoolbox', help: 'stand the toolbox on its rack, loose' },
  { name: 'strap', help: 'strap down what is on its rack, or undo the strap' },
  { name: 'backcan', help: 'stand the red jerry can in the back of a Tor or Crag, loose' },
  { name: 'backtoolbox', help: 'stand the toolbox in the back of a Tor or Crag, loose' },
  { name: 'clearback', help: 'tip whatever is in the back of a Tor or Crag out onto the ground' },
  { name: 'clearrack', help: 'take whatever is on its rack off, gone from the rack' },
  { name: 'soak', help: 'rain on its windscreen, as in a downpour (the cars, the Tor, the Crag and the UTV)' },
  { name: 'dry', help: 'its windscreen dried off' },
  { name: 'mist', help: 'the glass of its cab misted over, as after a cold wet drive with a full load (the cars, the Tor and the Crag)' },
  { name: 'demist', help: 'the glass of its cab cleared of mist' },
  { name: 'radiomusic', help: 'choose a folder of music to add to the station its radio is tuned to, for this session (the radios in the Tor, the Crag and the cars)' },
  { name: 'fix', help: 'put right: faults, plug, filter, wear, scuffing, seizure, water (quirks stay)' },
];

/** In front of the workbench, inside the barn, whichever way the barn is turned. */
export function benchSpot(layout) {
  const b = barnLocal(layout).bench;
  return b && layout.barn ? barnFrame(layout).toWorld(b.x, b.z + 1.4) : null;
}

/** The new farm's farmstead places (#682): the stackyard, the orchard, the garden's gate and the cars, and the yard's dressing (#817): the barn wall's gear, Home Ground's steel gate and the stackyard's bales. Today's farm has none of them. */
export function farmsteadPlaces(layout) {
  const f = layout.farmstead;
  if (!f) return {}; // (the places read as undefined, and are left out)
  const mid = (r) => ({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 });
  return {
    stackyard: { x: mid(f.stackyard).x, z: layout.dutchBarn.z + layout.dutchBarn.halfZ + 10 }, // in front of the Dutch barn
    orchard: mid(f.orchard),
    garden: { x: f.garden.gate.x, z: f.garden.maxZ + 3 }, // at its gate, on the yard side
    cars: { x: layout.cars.finch.x, z: layout.cars.finch.z + 5 }, // in front of the girls' cars
    ...(f.yard && {
      barnwall: { x: f.yard.wall.x + 4, z: f.yard.wall.z + 3 }, // the hose reel, brush, shovel and bucket on the barn's east wall (#817)
      homegate: { x: f.yard.gates[0].x + 6, z: f.yard.gates[0].z + 3 }, // the steel gate at Home Ground's rail
      stackbales: { x: f.yard.stack.x + 6, z: f.yard.stack.z + 9 }, // the square bales under the Dutch barn, and the straw and bale spike beyond
    }),
  };
}

/**
 * Back Lane's places (#686), on the new farm: `backlane` 40 m in from the lane at the north end, `backlaneford` 12 m before the ford, `hairpins` on the road
 * between them, and `footpath` at the fingerpost. The road's own point, so you stand on the tarmac. Today's farm has none.
 */
export function backLanePlaces(layout, roads) {
  const road = roads?.road('backLane');
  if (!road) return {};
  const onRoad = (s) => {
    const p = roads.pointAt('backLane', s);
    return { x: p.x, z: p.z };
  };
  const hairpin = road.hairpins?.[0] ? sAlong(road, road.hairpins[0][0], road.hairpins[0][1]) : null;
  const ford = road.ford ? sAlong(road, road.ford.at[0], road.ford.at[1]) : null;
  const path = road.footpath ? sAlong(road, road.footpath.at[0], road.footpath.at[1]) : null;
  return {
    backlane: onRoad(40),
    backlaneford: ford === null ? null : onRoad(ford - 12),
    hairpins: hairpin === null ? null : onRoad((hairpin + (road.hairpins[1] ? sAlong(road, road.hairpins[1][0], road.hairpins[1][1]) : hairpin)) / 2),
    footpath: path === null ? null : onRoad(path - 6),
  };
}

/**
 * The A-road's and the lane's places (#687), on the new farm: `junction` 14 m up the lane from the give-way line at the A-road, `villagejunction` the same on the
 * village street's end, `lanesouth` 30 m before the lane's southern line, `cottages` in front of the pair on the lane, `postbox` at the end of our drive and
 * `busstop` by the A-road's bus bay. Each on the road or its verge, so you stand where you can see the thing. None of them is on the A-road itself, which turns
 * you round. Today's farm has none.
 */
export function aRoadPlaces(layout, roads) {
  const lane = roads?.road('lane');
  const stub = roads?.road('streetEnd');
  if (!lane || !layout.laneFittings) return {};
  const on = (id, s) => {
    const p = roads.pointAt(id, s);
    return { x: p.x, z: p.z };
  };
  const F = layout.laneFittings;
  const by = layout.aRoadFittings?.layBy && roads.road('aRoad') ? layByOf(roads.road('aRoad'), layout.aRoadFittings.layBy) : null;
  return {
    junction: on('lane', 17),
    villagejunction: stub ? on('streetEnd', stub.length - 17) : null,
    lanesouth: on('lane', lane.length - 45),
    cottages: { x: F.cottages.minX + 3, z: (F.cottages.minZ + F.cottages.maxZ) / 2 },
    postbox: { x: F.postbox.x - 2, z: F.postbox.z },
    busstop: by ? { x: by.flag.x, z: by.flag.z - 4 } : null,
  };
}

/**
 * The Moor's places (#713), on the new farm: `moor` 70 m out on the heather west of the moor gate, `ridge` beside the trig pillar on the ridge, `stile` 9 m
 * short of the ladder stile (the line that turns you round is 1.2 m from the wall), `moorgrid` on Back Lane 10 m before the first cattle grid, `flush` east of the spring's
 * wet flush and `moorsheep` on Back Lane by the summer flock (#821). Today's farm has none.
 */
export function moorPlaces(layout, roads) {
  const M = layout.moor;
  if (!M) return {};
  const lane = roads?.road('backLane');
  const grid = lane && M.grids[0] ? gridPlace(lane, M.grids[0].near) : null;
  const p = grid ? roads.pointAt('backLane', Math.max(0, grid.s - 10)) : null;
  // The lane's own point nearest 30 m west of the moor gate and 25 m up it: where the summer flock grazes the verge (#821).
  const flockAt = lane?.samples.reduce((best, s) => (Math.hypot(s.x - (M.gate.x - 30), s.z - (M.gate.z - 25)) < Math.hypot(best.x - (M.gate.x - 30), best.z - (M.gate.z - 25)) ? s : best), lane.samples[0]);
  const f = M.flushes[0];
  return {
    flush: { x: f.x + f.rx + 6, z: f.z }, // just east of the spring's flush, to ride into it
    moorsheep: flockAt ? { x: flockAt.x, z: flockAt.z } : null, // on Back Lane beside where the summer flock grazes
    moor: { x: M.gate.x - 70, z: M.gate.z },
    ridge: { x: M.trig.at[0] + 5, z: M.trig.at[1] },
    stile: { x: M.stile.at[0] + 9, z: M.stile.at[1] },
    moorgrid: p ? { x: p.x, z: p.z } : null,
  };
}

/** `tp me to riffle` (#1000): on the gravel bar beside the first riffle below the crossing, a metre and a half up it from the water's edge. */
export function riffleSpot(brook) {
  const r = brook.riffles?.()[1];
  return r ? { x: r.x, z: brook.zAt(r.x) + r.side * (waterEdge(brook, r.x, r.side) + 1.5) } : null;
}

/**
 * The farm's tracks' places (#689), on the new farm: `stonetrack` on the stone track north a third of the way to the pit, `farmbridge` 9 m up the south track from the
 * bridge, `boundarytrack` on the grass track in Lane Field, and `headland` on the headland inside Lane Field's north-west corner. Today's farm has none.
 */
export function trackPlaces(layout, roads) {
  if (!layout.farmBridge || !roads) return {};
  const on = (id, f) => {
    const p = roads.pointAt(id, roads.road(id).length * f);
    return { x: p.x, z: p.z };
  };
  const ring = layout.headlands.fields.find((h) => h.field === 'lanefield')?.ring[0];
  const edge = layout.fields.find((f) => f.name === 'lanefield')?.points[0];
  return {
    stonetrack: on('stoneNorth', 0.35),
    farmbridge: { x: layout.farmBridge.x, z: layout.farmBridge.z - 9 },
    boundarytrack: on('boundaryTrack', 0.33), // down the east side, where 0.3 put it before the loop lost 300 m on Hill Pasture (#1061)
    headland: ring && edge ? { x: (ring[0] + edge[0]) / 2, z: (ring[1] + edge[1]) / 2 } : null,
  };
}

/** @param {import('../game.js').Game} g @param {{ copy: (text: string) => void }} io */
export function createHost(g, { copy = () => {} } = {}) {
  const unitOf = (id) => g.units.find((u) => u.id === id);
  const girlOf = (id) => g.companions.find((c) => c.character.id === id);
  const items = {
    'petrol-can': g.petrolCan,
    'premix-can': g.premixCan,
    'diesel-can': g.dieselCan,
    toolbox: g.toolbox,
    'oil-bottle': g.oilBottle,
    'coolant-bottle': g.coolantBottle,
    'feed-bucket': g.feedBucket,
    leads: g.leads,
  };
  const itemNames = Object.keys(items).filter((k) => items[k]);
  const ground = (x, z) => g.world.heightAt(x, z);

  // Where each girl and item was at the start, for `reset`.
  const home = {};
  for (const c of g.companions) home[c.character.id] = { x: c.root.position.x, z: c.root.position.z, heading: c.heading };
  for (const k of itemNames) home[k] = { x: items[k].model.position.x, z: items[k].model.position.z, heading: items[k].model.rotation.y };

  const layout = g.world.layout;
  const places = () => {
    const farmstead = farmsteadPlaces(layout);
    const backLane = backLanePlaces(layout, g.world.roads);
    const aRoad = aRoadPlaces(layout, g.world.roads);
    const moorSpots = moorPlaces(layout, g.world.roads);
    const trackSpots = trackPlaces(layout, g.world.roads);
    const spots = {
      start: { x: layout.spawn.player.x, z: layout.spawn.player.z },
      yard: layout.yard,
      barn: layout.barn,
      bench: benchSpot(layout), // stood in front of the workbench in the barn
      bonfire: layout.bonfire,
      generator: layout.generator?.stand, // the barn generator's cord end, where a girl stands to pull it
      bell: layout.bell,
      ramp: layout.jumpRamp,
      dragstrip: layout.dragStrip,
      dutchbarn: layout.dutchBarn,
      fieldshed: layout.fieldShed,
      muckheap: layout.muckHeap,
      harrows: layout.harrows, // the chain harrows, left at the harrow field's west edge
      backlane: backLane.backlane, // Back Lane, 40 m in from the lane at the north end: the new farm's
      backlaneford: backLane.backlaneford, // 12 m before its ford
      hairpins: backLane.hairpins, // between its two hairpins
      footpath: backLane.footpath, // at the fingerpost of the footpath to Upper Thornby
      junction: aRoad.junction, // up the lane from its give-way line at the A-road: the new farm's (#687)
      villagejunction: aRoad.villagejunction, // the same on the village street's end
      lanesouth: aRoad.lanesouth, // 30 m before the lane's southern line, where you are turned round
      cottages: aRoad.cottages, // in front of the pair of cottages on the lane
      postbox: aRoad.postbox, // the postbox and bin stand at the end of our drive
      busstop: aRoad.busstop, // the bus bay on the A-road and its bus stop flag
      moor: moorSpots.moor, // the common beyond Back Lane, on the heather west of the moor gate: the new farm's (#713)
      ridge: moorSpots.ridge, // beside the trig pillar on the ridge
      stile: moorSpots.stile, // short of the ladder stile in the ridge wall, where climbing it turns you round
      moorgrid: moorSpots.moorgrid, // Back Lane before the first cattle grid onto the common
      flush: moorSpots.flush, // east of the spring's wet flush on the Moor, to ride into it and bog
      moorsheep: moorSpots.moorsheep, // Back Lane by the Moor's summer flock
      stonetrack: trackSpots.stonetrack, // the stone track north of the yard, on the way to the pit: the new farm's (#689)
      farmbridge: trackSpots.farmbridge, // 9 m up the stone track south from the farm bridge over the river's head
      boundarytrack: trackSpots.boundarytrack, // the grass track round the boundary, in Lane Field
      headland: trackSpots.headland, // the grass headland inside Lane Field's north-west corner
      stackyard: farmstead.stackyard, // the new farm's: in front of the Dutch barn
      orchard: farmstead.orchard, // the hens' run and the pig's ark
      garden: farmstead.garden, // the garden plot's gate
      cars: farmstead.cars, // in front of the girls' cars
      barnwall: farmstead.barnwall, // the barn's east wall's gear: the new farm's (#817)
      homegate: farmstead.homegate, // the steel gate at Home Ground's rail
      stackbales: farmstead.stackbales, // the square bales, straw and spike in the stackyard
      animals: layout.farmAnimals ? { x: layout.farmAnimals.pen.maxX + 2.5, z: (layout.farmAnimals.pen.minZ + layout.farmAnimals.sty.maxZ) / 2 } : null,
      trough: layout.trough,
      road: layout.road?.pad ?? (layout.road ? { x: (layout.road.fromX + layout.road.toX) / 2, z: layout.road.z } : null), // the pad, or halfway along the drive
      cattlegrid: layout.road?.grid ? { x: layout.road.grid.x - 8, z: layout.road.z } : null, // the drive's cattle grid, from the yard side
      lane: layout.publicLane ? { x: layout.publicLane.x, z: layout.publicLane.open.minZ + 100 } : null, // the public lane's tarmac, on the farm side of the village turning
      neighbour: neighbourGate(layout), // just inside her gateway, looking into her yard
      village: layout.village?.green, // the green, between the pub and the shop
      carpark: layout.village?.pub?.stop, // the pub's car park
      approach: layout.village?.approach ? { x: layout.publicLane.x, z: layout.village.approach.signs[0].z - 40 } : null, // the lane 40 m before the 30 signs at the village's north approach: the new farm's, #819
      smallfarm: layout.village?.approach ? { x: layout.village.approach.farm.gateway.x - 9, z: layout.village.approach.farm.gateway.z } : null, // on the track in front of the small farm's gateway: the new farm's, #819
      rollingroad: g.trafficHost.places.rig.stand, // beside the tuner's trailer when it is set up (the Farm tab's "Send the tuner" brings it)
      motbay: g.villageHost.mot ? g.villageHost.mot.bay : null, // the MOT bay's middle at Hollis Motors (then `face <vehicle> 90` to sit it along the wall)
      mot: g.villageHost.mot ? g.villageHost.mot.stand() : null, // on foot before the MOT clipboard
      ford: layout.hill ? { x: layout.hill.lane.x, z: layout.hill.stream.z } : null,
      wood: layout.woods ? { x: layout.woods.gate.x, z: layout.woods.leadIn[1][1] } : null,
      fern: layout.woods?.trail ? fernMarkerSpot(layout.woods) : null, // 1.5 m in front of the marker post, which stands on the trail's entrance
      hollowrun: layout.woods ? { x: layout.woods.circuit.points[0][0], z: layout.woods.circuit.points[0][1] } : null,
      woodpile: layout.logYard?.scenery ? { x: layout.logYard.park.x, z: layout.logYard.park.z + 6 } : null, // the woodpile at the wood's gate, with its lean-to and block: the new farm's, #683
      veteranoak: layout.woods?.oak ? { x: layout.woods.oak.x, z: layout.woods.oak.z + 12 } : null, // the great oak in the glade by the pond, twelve metres south of it
      river: layout.hill?.river ? g.world.heights.brook.crossing().landing(1, 8) : null, // on the crossing's south landing, 8 m back from the water: from its one anchor (#999)
      riffle: layout.hill?.river?.steps ? riffleSpot(g.world.heights.brook) : null, // on the gravel bar beside the first riffle below the crossing (#1000)
      brookford: g.world.heights?.brook?.ford?.()?.landing(-1, 6) ?? null, // on the boundary track 6 m north of its ford over the east brook (#1060)
      pit: g.world.fields.quarry ? (() => { const r = g.world.fields.quarry.roadPoints.find((p) => p.t > 0.02); return r ? { x: r.x, z: r.z } : null; })() : null,
      pitgate: g.world.fields.quarry ? (() => { const w = g.world.fields.quarry.way; return { x: w.x + w.inward[0] * 6, z: w.z + w.inward[1] * 6 }; })() : null, // just inside the gate you come in by: the farm gate on the new farm (#685)
      pitlane: g.world.fields.quarry?.gates.length > 1 ? (() => { const w = g.world.fields.quarry.gate; return { x: w.x + w.inward[0] * 8, z: w.z + w.inward[1] * 8 }; })() : null, // inside the shut lane gate, looking out at it: the new farm only
      pitentrance: g.world.fields.quarry?.gates.length > 1 ? (() => { const w = g.world.fields.quarry.gate; return { x: w.x - w.inward[0] * 13, z: w.z - w.inward[1] * 13 }; })() : null, // out on the lane gate's bellmouth by the lane, looking at the gate and the spoil bank (#1002)
      pitwall: g.world.fields.quarry ? { x: g.pitGates[0].x - g.pitGates[0].tx * 4, z: g.pitGates[0].z - g.pitGates[0].tz * 4 } : null,
      plant: (() => { const q = g.world.fields.quarry; const s = q && plantSite(q, ground); return s ? plantPoint(s, -5, 0) : null; })(), // the pit's screening plant, behind its hopper on the pad's line
      pitpond: g.world.fields.quarry ? (() => { const q = g.world.fields.quarry; const p = q.pond; const a = Math.atan2(q.pit.z - p.z, q.pit.x - p.x); return { x: p.x + Math.cos(a) * (p.rx + 3), z: p.z + Math.sin(a) * (p.rz + 3) }; })() : null, // on the pit's floor by its pond, at the gap in the reeds where the drums were dumped (#1003)
      pitcontainer: (() => { const c = g.scene?.getObjectByName('quarrySite')?.getObjectByName('container'); return c ? { x: c.position.x + Math.cos(c.rotation.y) * 4.5, z: c.position.z - Math.sin(c.rotation.y) * 4.5 } : null; })(), // on the hardstanding's apron, a metre and a half off the doors of the pit's old container (#1003)
      // The pit's field and walls worn and grown over (#1004): on the ride where it passes the climb's finish, on the lip a quarter of the way round from
      // the climb (its topsoil, roots and the scree below), by a dead tree at the rim, and out in Top Field looking at the tree line along the fence.
      pitride: g.world.fields.quarry ? (() => { const q = g.world.fields.quarry; const [fx, fz] = q.climb.points[2]; const p = pitRide(q).loop.reduce((b, c) => (Math.hypot(c[0] - fx, c[1] - fz) < Math.hypot(b[0] - fx, b[1] - fz) ? c : b)); return { x: p[0], z: p[1] }; })() : null,
      pitlip: g.world.fields.quarry ? (() => { const q = g.world.fields.quarry; const a = q.pit.climbAt + Math.PI / 2; return q.frameAt(a, q.rimAt(a) + 1); })() : null,
      pitdeadtree: (() => { const t = g.scene?.getObjectByName('quarrySite')?.userData.relics?.deadTrees[0]; const q = g.world.fields.quarry; if (!t || !q) return null; const k = Math.hypot(t.x - q.pit.x, t.z - q.pit.z); return { x: t.x + ((t.x - q.pit.x) / k) * 5, z: t.z + ((t.z - q.pit.z) / k) * 5 }; })(),
      pittrees: g.world.fields.quarry?.gates.length > 1 ? (() => { const w = g.world.fields.quarry.way; return { x: w.x - w.inward[0] * 16 + w.inward[1] * 40, z: w.z - w.inward[1] * 16 - w.inward[0] * 40 }; })() : null,
      viewpoint: layout.hill?.viewpoint, // the flat rock at the top of the pasture, where the flask is
      hut: g.world.hutShape?.footOfSteps ?? null, // the foot of its steps, not inside it
      terraces: layout.hill?.paddocks?.east.terraces?.stand ?? null, // the sheep field's top tread, looking down its banks
      pasture: layout.hill ? { x: (layout.hill.pasture.minX + layout.hill.pasture.maxX) / 2, z: (layout.hill.pasture.minZ + layout.hill.pasture.maxZ) / 2 } : null,
    };
    // On a plan that says what its fields are (the new farm), one place per field by its key (top, north, lanefield, hay ...), where it has the most room.
    // A place the game already has by that name wins (wood, pit): the wood and the pit have their own, at the wood's gate and the pit's lip.
    const inFields = layout.fields ? Object.fromEntries(layout.fields.map((f) => [f.name, labelSpot(g.world.fields.polygons[f.name])])) : {};
    // And the field landmarks (#815) by their kind in lower case (loneoak, oldgateposts, deadelm, farpond, castroller, loneash, brookalders, bigoaks), ten metres
    // south of each: the ones the game builds, so you stand where you can see them. The new farm only.
    const landmarks = Object.fromEntries((layout.fieldLandmarks ?? []).filter((l) => BUILT_KINDS.includes(l.kind)).map((l) => [l.kind.toLowerCase(), { x: l.at[0], z: l.at[1] + 10 }]));
    return Object.fromEntries(Object.entries({ ...landmarks, ...inFields, ...spots }).filter(([, p]) => p && Number.isFinite(p.x) && Number.isFinite(p.z)).map(([k, p]) => [k, { x: p.x, z: p.z }]));
  };

  const riding = () => (g.player.isRiding ? g.riddenUnit : null);

  const host = {
    vehicleVerbs: VEHICLE_VERBS,

    vehicles: () => g.units.map((u) => ({ id: u.id, name: u.name, summary: `${u.engine.state}, ${round(u.quad.speed * 2.237)} mph` })),
    girls: () => g.companions.map((c) => c.character.id),
    things: () => ['me', ...g.units.map((u) => u.id), ...g.companions.map((c) => c.character.id), ...itemNames],
    places,
    girlState: (id) => girlOf(id).state,

    locate(thing) {
      if (thing === 'me') {
        const r = riding();
        if (r) return { x: r.quad.position.x, y: r.quad.position.y, z: r.quad.position.z, heading: norm(r.quad.yaw * DEG) };
        const p = g.player.position;
        return { x: p.x, y: p.y, z: p.z, heading: norm((g.player.yaw + Math.PI) * DEG) };
      }
      const u = unitOf(thing);
      if (u) return { x: u.quad.position.x, y: u.quad.position.y, z: u.quad.position.z, heading: norm(u.quad.yaw * DEG) };
      const c = girlOf(thing);
      if (c) return { x: c.root.position.x, y: c.root.position.y, z: c.root.position.z, heading: norm(c.heading * DEG) };
      const item = items[thing];
      if (item) return { x: item.model.position.x, y: item.model.position.y, z: item.model.position.z, heading: norm(item.model.rotation.y * DEG) };
      return null;
    },

    put(thing, { x, z, heading }) {
      const here = host.locate(thing);
      const rad = heading === undefined ? undefined : (heading / DEG);
      if (thing === 'me') {
        if (riding()) throw new Error('you are on a vehicle: get off first (or tp the vehicle itself)');
        const y = g.player.flying ? Math.max(here.y, ground(x, z) + 0.5) : ground(x, z) + 0.5;
        g.player.moveTo({ x, y, z });
        if (rad !== undefined) g.player.yaw = rad - Math.PI;
      } else if (unitOf(thing)) {
        const q = unitOf(thing).quad;
        if (q.rider || q.driver) throw new Error(`${thing} has someone on it: they would go too, so get them off first`);
        q.placeAt(x, z, rad ?? q.yaw);
      } else if (girlOf(thing)) {
        const c = girlOf(thing);
        const a = c.availability({ asked: true });
    if (!a.free) throw new Error(`${c.name} is busy (${a.why}). Call her back with the bell, or wait until she is stood about`);
        c.root.position.set(x, ground(x, z), z);
        if (rad !== undefined) {
          c.heading = rad;
          c.root.rotation.y = rad;
        }
      } else if (items[thing]) {
        items[thing].putDown({ x, z }, rad ?? items[thing].model.rotation.y);
      }
      // Say where it was sent rather than where it reads as now: a vehicle's body only moves on the next physics step.
      return `${thing} is at x ${round(x)}, z ${round(z)}, heading ${Math.round(norm(heading ?? here.heading))}°`;
    },

    resetThing(thing) {
      const u = unitOf(thing);
      if (u) {
        if (u.quad.rider || u.quad.driver) throw new Error(`${thing} has someone on it`);
        u.resetToSpawn(g.world);
        return `${thing} is back where it started`;
      }
      if (thing === 'me') {
        const s = g.world.spawn.player;
        return host.put('me', { x: s.x, z: s.z, heading: norm((s.yaw + Math.PI) * DEG) });
      }
      const c = girlOf(thing);
      if (c) {
        g.settleGirl(c); // not just moved: a girl mid-drive or sat on a quad is still busy where she lands
        return `${c.name} stops and stands about (${Math.round(c.params.settleSeconds)} s) ready for the next thing`;
      }
      return host.put(thing, home[thing]);
    },

    vehicleVerb(id, verb) {
      const u = unitOf(id);
      switch (verb) {
        case 'start': startWarm(u); break;
        case 'stop': switchOff(u); break;
        case 'warm': u.engine.setTemperature(1); break;
        case 'cool': u.engine.setTemperature(0); break;
        case 'fill': u.quad.fuel.litres = u.quad.fuel.params.tankCapacity; break;
        case 'fix': fixEverything(u); break;
        case 'radiomusic':
          if (!u.quad.radio) return `${id} has no radio`;
          g.addRadioMusic(u);
          return `${id}: choose the music in the dialog`;
        case 'soak': if (!g.debugScreenRain(u, 'soak')) return `${id} has no windscreen`; break;
        case 'dry': if (!g.debugScreenRain(u, 'clear')) return `${id} has no windscreen`; break;
        case 'mist': if (!g.debugCabMist(u, 'mist')) return `${id} has no cab to mist`; break;
        case 'demist': if (!g.debugCabMist(u, 'clear')) return `${id} has no cab to mist`; break;
        case 'load': return `${id}: ${g.debugLoad(u)}`;
        case 'unload': return `${id}: ${g.debugUnload(u)}`;
        case 'rackcan': return `${id}: ${g.rackLoads.debugRack(u, 'can')}`;
        case 'racktoolbox': return `${id}: ${g.rackLoads.debugRack(u, 'toolbox')}`;
        case 'strap': return `${id}: ${g.rackLoads.debugRack(u, 'strap')}`;
        case 'backcan': return `${id}: ${g.debugBack(u, 'can')}`;
        case 'backtoolbox': return `${id}: ${g.debugBack(u, 'toolbox')}`;
        case 'clearback': return `${id}: ${g.debugBack(u, 'clear')}`;
        case 'clearrack': return `${id}: ${g.rackLoads.debugRack(u, 'clear')}`;
        default: throw new Error(`no such thing as ${verb}`);
      }
      return `${id}: ${verb}`;
    },

    girlVerbs: (id) => girlActions(g).forGirl(id),
    girlVerb(id, verb, vehicleId) {
      girlActions(g).find(id, verb).run(id, vehicleId ? unitOf(vehicleId) : undefined);
    },

    jobs: () => jobActions(g).jobs.map((j) => ({ id: j.id, name: j.name, stage: j.describe(), verbs: j.actions.map((a) => ({ verb: a.verb, label: a.label })) })),
    jobVerb: (id, verb) => jobActions(g).find(id).actions.find((a) => a.verb === verb).run(),

    weatherKinds: () => Object.keys(WEATHER_KINDS),
    weatherNow: () => `${g.weather.name}, ${g.weather.temperature} °C (${g.weather.band}), rain ${round(g.weather.rain, 2)}, ground wetness ${round(g.weather.wet, 2)}, snow cover ${round(g.weather.cover, 2)}`,
    setWeather(kind) {
      g.weatherHost.setKind(kind);
      return host.weatherNow();
    },

    birdsNow: () => g.farmBirdsHost?.describe() ?? 'no birds on this farm',
    startBirds: (kind) => g.farmBirdsHost.force(kind),

    layoutNow: () => ['the farm on the plan (layout 2)', describeFieldNames(g.world.layout)].filter(Boolean).join('. '),

    dump(text) {
      copy(text);
    },

    farmText: () => g.farmText(),
    farmSave: () => g.saveFarm(),
    farmJson: () => JSON.stringify(g.captureFarm(), null, 2),
    farmWipe: () => g.wipeFarm(),
    farmEndDay: () => {
      g.callItADay({ force: true });
      return g.farm.seeded ? 'a seeded game does not carry on to another day' : `fading to black: day ${g.farm.day + 1} loads next`;
    },
    farmSendHome: () => {
      if (g.goingHome.active) return `already going: ${g.describeGoingHome()}`;
      return g.sendGirlsHome() ? `the girls are going home (the card comes up when they have gone): ${g.describeGoingHome()}` : 'nobody has a car here to go home in';
    },
    farmLoad: (json) => g.loadFarmJson(json),

    notebookLearnt: () => g.discoveries.list.map((d) => ({ id: d.id, text: d.text, learnt: g.discoveries.learnt.has(d.id) })),
    learnThing: (id) => g.discoveries.learn(id),
    learnAll: () => g.discoveries.list.forEach((d) => g.discoveries.learn(d.id)),
    forgetAll: () => {
      g.discoveries.forget();
      if (g.hud.bucketOpen) g.showBucketList();
    },

    scenes: () => SCENES.map(({ id, label }) => ({ id, label })),
    runScene: (id, shell) => runScene(SCENES.find((s) => s.id === id), shell, g),

    errors: () => g.guard.summary(),
    clearErrors: () => g.guard.clear(),

    perf() {
      const r = g.renderer;
      return { ...g.frameStats.summary(), stages: g.frameBreakdown.summary().map((x) => ({ name: x.name, ms: x.ms })), slowestFeatures: g.guard.slowest(5), ground: g.world.terrain.tileSet.stats(), groundPainting: g.world.terrain.paintStats(), wornGround: g.world.wear.stats(), longFrameCauses: g.stutters.log.lines(), heapMb: g.stutters.heap.used / 1048576, allocMbPerSecond: g.stutters.heap.allocMbPerSecond, loadSteps: loadSteps().slice(0, 8), groundFromWorkers: g.world.groundFromWorkers, farBatches: g.world.farDetail.batchStats(), ...r.info.render, width: r.domElement.width, height: r.domElement.height, pixelRatio: r.getPixelRatio(), maxFps: g.graphics.maxFps };
    },
  };
  return host;
}
