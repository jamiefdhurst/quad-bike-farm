import { createCattleGrid } from './cattleGrid.js';
import { LAYOUT } from './layout.js';
import { Track } from './track.js';
import { createTerrainHeight } from './terrainHeight.js';
import { createTerrain } from './terrain.js';
import { buildProps } from './props.js';
import { DEFAULT_BARN_PARAMS, BARN_PARAM_RANGES, underRoof, insideBarn, indoorLevel } from './barn.js';
import { GroundWear, DEFAULT_WEAR_PARAMS, WEAR_PARAM_RANGES } from './groundWear.js';
import { stripFrame } from './layout.js';
import { Sky, SKY_PARAMS, SKY_RANGES } from './sky.js';
import { createFields } from './fields.js';
import { createOutbuildings } from './outbuildings.js';
import { RoadMud, DEFAULT_ROAD_MUD_PARAMS, ROAD_MUD_PARAM_RANGES } from './roadMud.js';
import { DEFAULT_DUST_PARAMS, DUST_PARAM_RANGES } from './dust.js';
import { surfaceFeel, DEFAULT_SURFACE_PARAMS, SURFACE_PARAM_RANGES } from './surfaces.js';
import { DEFAULT_SQUEAL_PARAMS, SQUEAL_PARAM_RANGES } from '../vehicle/tyreSqueal.js';
import { registerTuning } from '../core/tuning.js';
import * as THREE from 'three';

/** The farm: terrain, track, sky and static props. */
export class World {
  constructor({ scene, physics, RAPIER, renderer, models, layout = LAYOUT }) {
    this.layout = layout;
    this.track = new Track(layout.trackPoints);
    this.heights = createTerrainHeight(layout, this.track);
    this.fields = createFields(layout);
    this.cattleGrid = createCattleGrid(layout); // across the road in the grass field's east gateway, or null
    this.outbuildings = createOutbuildings(layout); // the Dutch barn, the field shed, the muck heap and the trough out east

    this.surfaceParams = { ...DEFAULT_SURFACE_PARAMS };
    registerTuning('Surfaces', this.surfaceParams, SURFACE_PARAM_RANGES);
    this.dustParams = { ...DEFAULT_DUST_PARAMS }; // the cloud a quad throws up on dry stubble (dust.js)
    registerTuning('Dust', this.dustParams, DUST_PARAM_RANGES);
    this.squealParams = { ...DEFAULT_SQUEAL_PARAMS }; // tyres squealing on the tarmac (vehicle/tyreSqueal.js), for the ride sounds
    registerTuning('Tyre squeal', this.squealParams, SQUEAL_PARAM_RANGES);

    this.barnParams = { ...DEFAULT_BARN_PARAMS };
    registerTuning('Barn', this.barnParams, BARN_PARAM_RANGES);

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

    const ctx = { scene, physics, RAPIER, renderer, models, layout, grid: this.cattleGrid, heights: this.heights, track: this.track, wear: this.wear, fields: this.fields, roadMud: this.roadMud };
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
    return surfaceFeel(this.surfaceParams, this.fields.tarmacAt(x, z), this.fields.stubbleAt(x, z), this.wet);
  }

  /** The next point on the way from `from` to `to` that doesn't go through a hedge (fields.js): `to` itself in the same field. */
  nextWaypoint(from, to) {
    return this.fields.nextWaypoint(from, to);
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
    Object.assign(this.sky.params, weather.skyParams());
    this.sky.update(0, new THREE.Vector3(), { position: new THREE.Vector3() });
    this.sky.buildEnvironment();
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

  update(dt, focus, camera) {
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
      Object.assign(this.sky.params, this.weather.update(dt).skyParams());
      // Wet ground looks darker, and a little glossier.
      const m = this.terrain.mesh.material;
      m.color.setScalar(1 - 0.24 * this.weather.wet);
      m.roughness = 0.95 - 0.25 * this.weather.wet;
    }
    this.sky.update(dt, focus, camera);
  }
}
