import { LAYOUT } from './layout.js';
import { Track } from './track.js';
import { createTerrainHeight } from './terrainHeight.js';
import { createTerrain } from './terrain.js';
import { buildProps } from './props.js';
import { Sky, SKY_PARAMS, SKY_RANGES } from './sky.js';
import { registerTuning } from '../core/tuning.js';

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

  get spawn() {
    return this.layout.spawn;
  }

  update(dt, focus, camera) {
    this.sky.update(dt, focus, camera);
  }
}
