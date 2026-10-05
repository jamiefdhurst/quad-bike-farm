import { LAYOUT } from './layout.js';
import { Track } from './track.js';
import { createTerrainHeight } from './terrainHeight.js';
import { createTerrain } from './terrain.js';
import { buildProps } from './props.js';
import { Sky, SKY_PARAMS, SKY_RANGES } from './sky.js';
import { registerTuning } from '../core/tuning.js';
import * as THREE from 'three';

/** The farm: terrain, track, sky and static props. */
export class World {
  constructor({ scene, physics, RAPIER, renderer, models, layout = LAYOUT }) {
    this.layout = layout;
    this.track = new Track(layout.trackPoints);
    this.heights = createTerrainHeight(layout, this.track);

    this.sky = new Sky(scene, renderer, { ...SKY_PARAMS });
    registerTuning('Sky', this.sky.params, SKY_RANGES);

    const ctx = { scene, physics, RAPIER, renderer, models, layout, heights: this.heights, track: this.track };
    this.terrain = createTerrain(ctx);
    buildProps(ctx);
  }

  heightAt(x, z) {
    return this.heights.heightAt(x, z);
  }

  mudAt(x, z) {
    return this.heights.mudAt(x, z);
  }

  bogAt(x, z) {
    return this.heights.bogAt(x, z);
  }

  puddleAt(x, z) {
    return this.heights.puddleAt(x, z);
  }

  /** Height of the drawn ground: cheaper than heightAt, and exact for things laid on it. */
  groundHeightAt(x, z) {
    const h = this.terrain.meshHeightAt(x, z);
    return Number.isNaN(h) ? this.heights.heightAt(x, z) : h;
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

  /** 0..1 how wet the ground is. */
  get wet() {
    return this.weather?.wet ?? 0;
  }

  update(dt, focus, camera) {
    if (this.weather) {
      Object.assign(this.sky.params, this.weather.update(dt).skyParams());
      // Wet ground looks darker, and a little glossier.
      const m = this.terrain.mesh.material;
      m.color.setScalar(1 - 0.24 * this.weather.wet);
      m.roughness = 0.95 - 0.25 * this.weather.wet;
    }
    this.sky.update(dt, focus, camera);
  }
}
