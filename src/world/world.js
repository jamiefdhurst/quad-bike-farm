import { createRiver } from './river.js';
import { createCattleGrid } from './cattleGrid.js';
import { roadNetwork, EDGE } from './roads.js';
import { LAYOUT } from './layout.js';
import { Track } from './track.js';
import { createTerrainHeight } from './terrainHeight.js';
import { createTerrain } from './terrain.js';
import { DEFAULT_GROUND_PARAMS, GROUND_PARAM_RANGES, groundBounds } from './groundTiles.js';
import { DrawDistance } from './tiledInstances.js';
import { FarDetail, pixelsPerRadian } from './farDetail.js';
import { DEFAULT_GRAPHICS_PARAMS } from '../core/graphics.js';
import { buildProps } from './props.js';
import { DEFAULT_BARN_PARAMS, BARN_PARAM_RANGES, underRoof, insideBarn, indoorLevel, barnShape } from './barn.js';
import { DEFAULT_WEAR_PARAMS, WEAR_PARAM_RANGES } from './groundWear.js';
import { WearTiles } from './wearTiles.js';
import { stripFrame } from './layout.js';
import { Sky, SKY_PARAMS, SKY_RANGES } from './sky.js';
import { createFields } from './fields.js';
import { detourVia, DEFAULT_DETOUR_PARAMS, DETOUR_PARAM_RANGES } from '../npc/detour.js';
import { createOutbuildings, dutchBarnScreens } from './outbuildings.js';
import { hutShape } from './hut.js';
import { RoadWet, DEFAULT_ROAD_WET_PARAMS, ROAD_WET_PARAM_RANGES } from './roadWet.js';
import { RoadMud, RoadMudSet, DEFAULT_ROAD_MUD_PARAMS, ROAD_MUD_PARAM_RANGES } from './roadMud.js';
import { DEFAULT_DUST_PARAMS, DUST_PARAM_RANGES } from './dust.js';
import { leafCover, WINTER_TINTS } from './autumn.js';
import { applyAutumnTint } from './autumnView.js';
import { surfaceFeel, DEFAULT_SURFACE_PARAMS, SURFACE_PARAM_RANGES } from './surfaces.js';
import { DEFAULT_SQUEAL_PARAMS, SQUEAL_PARAM_RANGES } from '../vehicle/tyreSqueal.js';
import { registerTuning } from '../core/tuning.js';
import { skyAt } from './daylight.js';
import { StreamLevel, STREAM_PARAM_RANGES } from './streamLevel.js';
import { PuddleIce, DEFAULT_PUDDLE_ICE_PARAMS, PUDDLE_ICE_PARAM_RANGES } from './puddleIce.js';
import { PuddleIceView } from './puddleIceView.js';
import * as THREE from 'three';

/** The farm: terrain, track, sky and static props. */
const GRID_MARGIN = 1 - EDGE; // a road's bounds already include its soft edge: a grid reaches a metre past the tarmac

export class World {
  constructor({ scene, physics, RAPIER, renderer, models, layout = LAYOUT, graphics = { ...DEFAULT_GRAPHICS_PARAMS }, autumn = false, winter = false }) {
    this.layout = layout;
    this.autumn = autumn; // an autumn day (autumn.js): turned leaves, leaf litter, conkers and a slippery wood floor
    this.drawDistance = new DrawDistance(graphics); // hides far tiles of grass, stubble, tussocks and bracken (tiledInstances.js)
    this.farDetail = new FarDetail(scene, graphics); // leaves out set pieces, small vehicle parts and far shadows (farDetail.js)
    this.track = new Track(layout.trackPoints);
    this.heights = createTerrainHeight(layout, this.track);
    this.fields = createFields(layout);
    this.river = createRiver(layout, this.heights.brook); // the river's crossing and what zone a point is in (river.js)
    this.roads = roadNetwork(layout); // every road: world/roads.js
    this.cattleGrid = createCattleGrid(layout); // across the road in the grass field's east gateway, or null
    this.outbuildings = createOutbuildings(layout); // the Dutch barn, the field shed, the muck heap and the trough out east
    this.hutShape = hutShape(layout); // the shepherd's hut on the hill (hut.js), or null

    this.streamLevel = new StreamLevel(); // how high the stream stands after rain (streamLevel.js)
    registerTuning('Stream', this.streamLevel.params, STREAM_PARAM_RANGES);
    this.streamStarted = false;
    this.streamEvent = null; // 'up' or 'down' on the frame the stream crossed the line, for the girls

    this.surfaceParams = { ...DEFAULT_SURFACE_PARAMS };
    registerTuning('Surfaces', this.surfaceParams, SURFACE_PARAM_RANGES);
    this.dustParams = { ...DEFAULT_DUST_PARAMS }; // the cloud a quad throws up on dry stubble (dust.js)
    registerTuning('Dust', this.dustParams, DUST_PARAM_RANGES);
    this.squealParams = { ...DEFAULT_SQUEAL_PARAMS }; // tyres squealing on the tarmac (vehicle/tyreSqueal.js), for the ride sounds
    registerTuning('Tyre squeal', this.squealParams, SQUEAL_PARAM_RANGES);

    this.barnParams = { ...DEFAULT_BARN_PARAMS };
    registerTuning('Barn', this.barnParams, BARN_PARAM_RANGES);

    // The buildings she walks round rather than into (npc/detour.js): the barn, with its doorway, and the field shed.
    this.detourParams = { ...DEFAULT_DETOUR_PARAMS };
    registerTuning('Walking round buildings', this.detourParams, DETOUR_PARAM_RANGES);
    const bo = barnShape(layout);
    const sh = layout.fieldShed;
    this.detourBuildings = [
      { ...bo.outer, door: { x: bo.door.x, z: bo.z, halfWidth: bo.door.maxZ - bo.z } },
      ...(bo.annex ? [{ ...bo.annex.outer, door: { x: bo.annex.door.x, z: bo.annex.z, halfWidth: bo.annex.door.maxZ - bo.annex.z } }] : []),
      ...(sh ? [{ minX: sh.x - sh.halfX, maxX: sh.x + sh.halfX, minZ: sh.z - sh.halfZ, maxZ: sh.z + sh.halfZ }] : []),
      ...(this.hutShape ? [this.hutShape.box()] : []),
    ];

    // What hides you from a girl as well (npc/sight.js): those, the Dutch barn's clad back and east end (its front and west end are open) and
    // its bale stack, and the neighbour's house and barn. The muck heap, the trough and the neighbour's parked vehicles are too low or too varied.
    const db = this.outbuildings.barn;
    const nb = this.outbuildings.neighbour?.shape;
    this.sightBuildings = [
      ...this.detourBuildings,
      ...dutchBarnScreens(db),
      ...(nb ? [nb.house.outer, nb.barn.outer] : []),
    ];

    this.sky = new Sky(scene, renderer, { ...SKY_PARAMS });
    this.sky.graphics = graphics;
    registerTuning('Sky', this.sky.params, SKY_RANGES);

    // Tyres wear the fields (groundWear.js); the yard, the drag strip, the barn floors and the road are hard and never do.
    const strip = layout.dragStrip;
    const exempt = (x, z) => {
      if (Math.hypot(x - layout.yard.x, z - layout.yard.z) < layout.yard.radius) return true;
      if (this.fields.tarmacAt(x, z) > 0.3) return true;
      if (this.inBarn(x, z, 1) || this.outbuildings.builtAt(x, z, 0.5)) return true;
      if (!strip) return false;
      const f = stripFrame(strip, x, z);
      return Math.abs(f.across) < strip.width / 2 + 1 && f.along > -8 && f.along < strip.length + strip.runOff;
    };
    this.wearParams = { ...DEFAULT_WEAR_PARAMS };
    registerTuning('Ground wear', this.wearParams, WEAR_PARAM_RANGES);
    this.wear = new WearTiles({ bounds: this.fields.wearBounds, ground: groundBounds(layout), exempt, soak: this.fields.soakAt, lane: this.fields.laneAt, params: this.wearParams });

    // Mud the tyres carry onto the road (roadMud.js), on a fine grid over the tarmac.
    this.roadMudParams = { ...DEFAULT_ROAD_MUD_PARAMS };
    registerTuning('Road mud', this.roadMudParams, ROAD_MUD_PARAM_RANGES);
    const grid = (bounds) => new RoadMud({ bounds, tarmacAt: this.fields.tarmacAt, params: this.roadMudParams });
    // One grid for each stretch of road you can ride: the farm road with its hardstanding, the lane you can ride (its `open` stretch), and the
    // village's ground (the lane's grid takes the mouth of its street). The first is `main`, the grid the ground shader shows.
    const grids = [];
    const farm = this.roads.road('farm');
    const lane = this.roads.road('lane');
    const street = this.roads.road('street');
    if (farm) grids.push(grid(this.roads.boundsOf('farm', GRID_MARGIN)));
    if (farm && lane) grids.push(grid(this.roads.boundsOf('lane', GRID_MARGIN, layout.publicLane.open)));
    const vArea = layout.village?.area;
    if (farm && street && lane && vArea) grids.push(grid({ minX: vArea.minX, maxX: lane.points[0][0] - lane.halfWidth - 1, minZ: vArea.minZ, maxZ: vArea.maxZ }));
    this.roadMud = grids.length ? new RoadMudSet(grids) : null;
    // How wet the tarmac is, for the shine (roadWet.js): rain wets it at once and it dries over many minutes, in patches.
    this.roadWetParams = { ...DEFAULT_ROAD_WET_PARAMS };
    registerTuning('Wet road', this.roadWetParams, ROAD_WET_PARAM_RANGES);
    this.roadWet = new RoadWet({ params: this.roadWetParams });
    this.roadWetStarted = false;

    if (autumn) applyAutumnTint(models);
    else if (winter) applyAutumnTint(models, WINTER_TINTS); // the leaves dull and dark in winter (seasons.js) // before anything is built from the models
    // The ground is drawn in tiles (groundTiles.js): those round where you start are built now, behind the start screen, and the rest as you move.
    this.groundParams = { ...DEFAULT_GROUND_PARAMS };
    registerTuning('Ground tiles', this.groundParams, GROUND_PARAM_RANGES);
    const ctx = { scene, physics, RAPIER, renderer, models, layout, grid: this.cattleGrid, heights: this.heights, track: this.track, wear: this.wear, fields: this.fields, roadMud: this.roadMud?.main, drawDistance: this.drawDistance, autumn, params: this.groundParams };
    this.terrain = createTerrain(ctx);
    this.terrain.prime(layout.spawn.player.x, layout.spawn.player.z);
    this.props = buildProps(ctx);

    // A skin of ice on the track's puddles on a frosty day (puddleIce.js): wheels crack it and break it.
    this.puddleIceParams = { ...DEFAULT_PUDDLE_ICE_PARAMS };
    registerTuning('Puddle ice', this.puddleIceParams, PUDDLE_ICE_PARAM_RANGES);
    this.puddleIce = new PuddleIce(this.heights.puddles, layout.puddleRadius, this.puddleIceParams);
    this.puddleIceView = new PuddleIceView(this.props.puddles ?? [], this.puddleIce);
    this.puddleIceStarted = false;
  }

  heightAt(x, z) {
    return this.heights.heightAt(x, z);
  }

  /** How muddy it is: the track and the bogs, any ground the tyres have worn soft, and mud they've carried onto the road. */
  mudAt(x, z) {
    const m = Math.max(this.heights.mudAt(x, z), this.wear.softAt(x, z) * 0.8, Math.min(1, this.wear.bogAt(x, z, this.wet) * 1.5));
    return this.roadMud ? Math.max(m, this.roadMud.mudAt(x, z)) : m;
  }

  /** 0..1 tarmac (the farm road) and stubble (the fields either side of it) under (x, z); the rest is grass. */
  tarmacAt(x, z) {
    return this.fields.tarmacAt(x, z);
  }

  stubbleAt(x, z) {
    return this.fields.stubbleAt(x, z);
  }

  /** Grip and rolling drag here as factors on grass, in today's wetness (surfaces.js). */
  surfaceFeelAt(x, z) {
    return surfaceFeel(this.surfaceParams, this.fields.tarmacAt(x, z), this.fields.stubbleAt(x, z), this.wet, this.weather?.cover ?? 0, this.autumn ? leafCover(this.fields.woods, x, z) : 0, this.fields.quarry?.gravelAt(x, z) ?? 0);
  }

  /** The next point on the way from `from` to `to` that doesn't go through a hedge (fields.js): `to` itself in the same field. */
  nextWaypoint(from, to) {
    return this.fields.nextWaypoint(from, to);
  }

  /** The first point to head for from `from` to `to` so as not to walk into a building (npc/detour.js), or null if the way is clear. */
  detour(from, to, prefer = null) {
    return detourVia(from, to, this.detourBuildings, this.detourParams, prefer);
  }

  /** How deep a bog: the three on the farm, and any the wear has made. */
  bogAt(x, z) {
    return Math.max(this.heights.bogAt(x, z), this.wear.bogAt(x, z, this.wet));
  }

  /** Bogs for the girls to plan round: the three on the farm and the ones wear has made. */
  bogHazards() {
    return [...(this.heights.bogs ?? []).map((b) => ({ x: b.x, z: b.z, radius: b.radius })), ...this.wear.hazards(this.wet)];
  }

  puddleAt(x, z) {
    return this.heights.puddleAt(x, z);
  }

  /** Height of the drawn ground: cheaper than heightAt, and exact for things laid on it. */
  groundHeightAt(x, z) {
    const h = this.terrain.meshHeightAt(x, z);
    return Number.isNaN(h) ? this.heights.heightAt(x, z) : h;
  }

  /** Under a roof (the barn's, the Dutch barn's or the field shed's): out of the rain. */
  covered(x, z) {
    return underRoof(this.layout, x, z) || this.outbuildings.covered(x, z) || !!this.hutShape?.covered(x, z);
  }

  /** In the barn: a quad parked here keeps its warmth (the open-sided Dutch barn and the draughty shed don't). */
  warmCover(x, z) {
    return underRoof(this.layout, x, z);
  }

  /** Inside the barn's walls (`margin` metres in from them). */
  inBarn(x, z, margin = 0) {
    return insideBarn(this.layout, x, z, margin);
  }

  /** 0..1 how far indoors (for the light and the sound of rain on the roof). */
  indoor(x, z) {
    return indoorLevel(this.layout, x, z, this.barnParams);
  }

  get spawn() {
    return this.layout.spawn;
  }

  /** Sets this game's weather (weather.js) and bakes the reflections for its sky. */
  setWeather(weather) {
    this.weather = weather;
    Object.assign(this.sky.params, this.skyNow());
    this.sky.update(0, new THREE.Vector3(), { position: new THREE.Vector3() });
    this.sky.buildEnvironment();
  }

  /** The sky for the weather and, if the day is running (daylight.js), the time of day: golden at dusk, dark at night. */
  skyNow() {
    const base = this.weather.skyParams();
    return this.daylight ? skyAt(base, this.daylight.sun, this.daylight.p) : base;
  }

  /** 0..1 how warm the day is: full sun on a sunny day, nothing much in the rain. */
  get warmth() {
    return this.weather?.warmth ?? 0.5;
  }

  /** The day's temperature in degrees C. */
  get temperature() {
    return this.weather?.temperature ?? 12;
  }

  /** 0..1 how cold the day is for an engine (the weather's chill). */
  get chill() {
    return this.weather?.chill ?? 0;
  }

  /** 0..1 how damp the air is: the rain and the wet ground (weather.js). */
  get damp() {
    return this.weather?.damp ?? 0.4;
  }

  /** 0..1 how wet the ground is. */
  get wet() {
    return this.weather?.wet ?? 0;
  }

  /** How much more water an engine gulps at (x, z) than usual: the stream, when it is up, is deeper and its bow wave bigger. */
  gulpBoostAt(x, z) {
    const hill = this.heights.hill;
    const brook = this.heights.brook;
    if (brook && brook.waterAt(x, z) > 0.5) return this.streamLevel.gulp;
    return hill && hill.waterAt(x, z) > 0.5 && Math.abs(z - hill.streamZ(x)) <= hill.halfAt(x) + 1 ? this.streamLevel.gulp : 1;
  }

  /** 0..1 how deep the river's water is at (x, z): over the intake, so an engine in it floods at any speed (0 on the crossing, in the brook and everywhere else). */
  deepWaterAt(x, z) {
    return this.heights.brook?.deepAt(x, z) ?? 0;
  }

  /** The tarmac takes the rain at once and dries in the sun and wind; the ground shader draws it dark and shining by `roadWet.value`. */
  updateRoadWet(dt) {
    const w = this.weather;
    if (!this.roadWetStarted) {
      this.roadWetStarted = true;
      this.roadWet.set(Math.max(0, w.wet - w.groundWet)); // a game that starts on a wet day starts with the road wet
    }
    const sun = Math.min(1, w.def.sky.sunIntensity / 2.6) * (1 - w.rain) * w.sunUp;
    this.roadWet.update(dt, { rain: w.rain, sun, wind: Math.min(1, w.wind / 1.5), temperature: w.temperature });
    this.terrain.roadWet.value = this.roadWet.value;
    this.terrain.skyTint.value.copy(this.sky.uniforms.horizonColor.value);
  }

  /** The stream follows the rain: its surface lifts, browns and runs faster as the level rises. */
  updateStream(dt) {
    const s = this.streamLevel;
    if (!this.streamStarted) {
      this.streamStarted = true;
      s.start(this.weather.wet);
    }
    this.streamEvent = s.update(dt, this.weather.rain);
    this.setStreamLevel();
  }

  /** The puddles freeze and thaw with the day's temperature; they start as a night at that temperature would leave them. */
  updatePuddleIce(dt) {
    if (!this.puddleIceStarted) {
      this.puddleIceStarted = true;
      this.puddleIce.settle(this.weather.temperature);
    }
    this.puddleIce.update(dt, this.weather.temperature, this.weather.rain);
    this.puddleIceView.sync();
  }

  /** Gives the hill, and the water drawn, the stream's level as it is now. */
  setStreamLevel() {
    const s = this.streamLevel;
    this.heights.hill?.setRise(s.rise);
    this.fields.hill?.setRise(s.rise);
    this.props.stream?.update(this.streamLastDt ?? 0, s.level, s.rise, s.flow);
  }

  /** `guard` (the game's FeatureGuard) times the ground's tiles as a feature of their own, `updateGround`. */
  update(dt, focus, camera, guard = null) {
    this.streamLastDt = dt;
    this.wear.update(dt, this.wet);
    if (this.wear.packed) this.terrain.wearTexture.needsUpdate = this.terrain.wearIndexTexture.needsUpdate = true;
    this.wear.packed = false;
    if (this.roadMud) {
      this.roadMud.update(dt, this.weather?.rain ?? 0);
      if (this.roadMud.main.packed) this.terrain.roadMudTexture.needsUpdate = true;
      this.roadMud.main.packed = false;
    }
    if (this.weather) {
      this.terrain.frost.value = this.weather.frost;
      this.terrain.snow.value = this.weather.cover;
      this.weather.update(dt);
      this.updateRoadWet(dt);
      this.updateStream(dt);
      this.updatePuddleIce(dt);
      Object.assign(this.sky.params, this.skyNow());
      // Wet ground looks darker, and a little glossier.
      const m = this.terrain.material;
      m.color.setScalar(1 - 0.24 * this.weather.wet);
      m.roughness = 0.95 - 0.25 * this.weather.wet;
    }
    this.sky.update(dt, focus, camera);
    const ground = () => this.terrain.update(camera.position.x, camera.position.z); // the tiles as fine as their distance wants, a few built a frame
    if (guard) guard.run('updateGround', ground);
    else ground();
    this.drawDistance.update(camera.position);
    this.farDetail.pixelsPerRadian = pixelsPerRadian(camera.fov, this.farDetail.viewHeight || window.innerHeight);
    this.farDetail.update(camera.position, dt);
  }
}
