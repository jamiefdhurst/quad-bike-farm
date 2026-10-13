import { createCattleGrid } from './cattleGrid.js';
import { LAYOUT } from './layout.js';
import { Track } from './track.js';
import { createTerrainHeight } from './terrainHeight.js';
import { createTerrain } from './terrain.js';
import { DrawDistance } from './tiledInstances.js';
import { DEFAULT_GRAPHICS_PARAMS } from '../core/graphics.js';
import { buildProps } from './props.js';
import { DEFAULT_BARN_PARAMS, BARN_PARAM_RANGES, underRoof, insideBarn, indoorLevel, barnShape } from './barn.js';
import { GroundWear, DEFAULT_WEAR_PARAMS, WEAR_PARAM_RANGES } from './groundWear.js';
import { stripFrame } from './layout.js';
import { Sky, SKY_PARAMS, SKY_RANGES } from './sky.js';
import { createFields } from './fields.js';
import { detourVia, DEFAULT_DETOUR_PARAMS, DETOUR_PARAM_RANGES } from '../npc/detour.js';
import { createOutbuildings } from './outbuildings.js';
import { RoadMud, DEFAULT_ROAD_MUD_PARAMS, ROAD_MUD_PARAM_RANGES } from './roadMud.js';
import { DEFAULT_DUST_PARAMS, DUST_PARAM_RANGES } from './dust.js';
import { surfaceFeel, DEFAULT_SURFACE_PARAMS, SURFACE_PARAM_RANGES } from './surfaces.js';
import { DEFAULT_SQUEAL_PARAMS, SQUEAL_PARAM_RANGES } from '../vehicle/tyreSqueal.js';
import { registerTuning } from '../core/tuning.js';
import { skyAt } from './daylight.js';
import { StreamLevel, STREAM_PARAM_RANGES } from './streamLevel.js';
import * as THREE from 'three';

/** The farm: terrain, track, sky and static props. */
export class World {
  constructor({ scene, physics, RAPIER, renderer, models, layout = LAYOUT, graphics = { ...DEFAULT_GRAPHICS_PARAMS } }) {
    this.layout = layout;
    this.drawDistance = new DrawDistance(graphics); // hides far tiles of grass, stubble, tussocks and bracken (tiledInstances.js)
    this.track = new Track(layout.trackPoints);
    this.heights = createTerrainHeight(layout, this.track);
    this.fields = createFields(layout);
    this.cattleGrid = createCattleGrid(layout); // across the road in the grass field's east gateway, or null
    this.outbuildings = createOutbuildings(layout); // the Dutch barn, the field shed, the muck heap and the trough out east

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
      ...(sh ? [{ minX: sh.x - sh.halfX, maxX: sh.x + sh.halfX, minZ: sh.z - sh.halfZ, maxZ: sh.z + sh.halfZ }] : []),
    ];

    this.sky = new Sky(scene, renderer, { ...SKY_PARAMS });
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
    this.wear = new GroundWear({ bounds: this.fields.farm, exempt, soak: this.fields.soakAt, params: this.wearParams });

    // Mud the tyres carry onto the road (roadMud.js), on a fine grid over the tarmac.
    this.roadMudParams = { ...DEFAULT_ROAD_MUD_PARAMS };
    registerTuning('Road mud', this.roadMudParams, ROAD_MUD_PARAM_RANGES);
    const road = layout.road;
    const reach = (road?.pad?.radius ?? road?.halfWidth ?? 0) + 1;
    this.roadMud = road
      ? new RoadMud({
          bounds: { minX: road.fromX - 1, maxX: Math.max(road.toX + 1, (road.pad?.x ?? 0) + reach), minZ: road.z - reach, maxZ: road.z + reach },
          tarmacAt: this.fields.tarmacAt,
          params: this.roadMudParams,
        })
      : null;

    const ctx = { scene, physics, RAPIER, renderer, models, layout, grid: this.cattleGrid, heights: this.heights, track: this.track, wear: this.wear, fields: this.fields, roadMud: this.roadMud, drawDistance: this.drawDistance };
    this.terrain = createTerrain(ctx);
    this.props = buildProps(ctx);
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
    return surfaceFeel(this.surfaceParams, this.fields.tarmacAt(x, z), this.fields.stubbleAt(x, z), this.wet, this.weather?.cover ?? 0);
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
    return underRoof(this.layout, x, z) || this.outbuildings.covered(x, z);
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

  /** 0..1 how wet the ground is. */
  get wet() {
    return this.weather?.wet ?? 0;
  }

  /** How much more water an engine gulps at (x, z) than usual: the stream, when it is up, is deeper and its bow wave bigger. */
  gulpBoostAt(x, z) {
    const hill = this.heights.hill;
    return hill && hill.waterAt(x, z) > 0.5 && Math.abs(z - hill.streamZ(x)) <= hill.halfAt(x) + 1 ? this.streamLevel.gulp : 1;
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

  /** Gives the hill, and the water drawn, the stream's level as it is now. */
  setStreamLevel() {
    const s = this.streamLevel;
    this.heights.hill?.setRise(s.rise);
    this.fields.hill?.setRise(s.rise);
    this.props.stream?.update(this.streamLastDt ?? 0, s.level, s.rise, s.flow);
  }

  update(dt, focus, camera) {
    this.streamLastDt = dt;
    this.wear.update(dt, this.wet);
    if (this.wear.packed) this.terrain.wearTexture.needsUpdate = true;
    this.wear.packed = false;
    if (this.roadMud) {
      this.roadMud.update(dt, this.weather?.rain ?? 0);
      if (this.roadMud.packed) this.terrain.roadMudTexture.needsUpdate = true;
      this.roadMud.packed = false;
    }
    if (this.weather) {
      this.terrain.frost.value = this.weather.frost;
      this.terrain.snow.value = this.weather.cover;
      this.weather.update(dt);
      this.updateStream(dt);
      Object.assign(this.sky.params, this.skyNow());
      // Wet ground looks darker, and a little glossier.
      const m = this.terrain.mesh.material;
      m.color.setScalar(1 - 0.24 * this.weather.wet);
      m.roughness = 0.95 - 0.25 * this.weather.wet;
    }
    this.sky.update(dt, focus, camera);
    this.drawDistance.update(camera.position);
  }
}
