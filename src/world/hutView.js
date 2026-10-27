import * as THREE from 'three';
import { ExhaustSmoke, DEFAULT_SMOKE_PARAMS } from '../effects/exhaustSmoke.js';
import { HUT_INSIDE } from './hut.js';

// The hut's stove as you see it (world/hut.js says what state it is in): a glow in the stove's door, the window lit from inside once it is dark,
// woodsmoke from the stovepipe on the wind, a flickering point light made at the start (only its strength changes, never a light added), and
// the kettle tipping as you pour. The hut itself is hutBuild.js's.

export class HutView {
  /** @param {object} o.parts the pieces hutBuild.js returns; `shape` is hut.js's frame. */
  constructor({ scene, shape, parts, heightAt, params }) {
    this.p = params;
    this.shape = shape;
    this.parts = parts;
    this.t = 0;
    const y0 = parts.ground;
    // The light, made now and only ever dimmed: inside, a little in front of the stove, so the bunk and the door both catch it.
    const at = shape.toWorld(HUT_INSIDE.stove.x - 0.2, HUT_INSIDE.stove.z - 0.4);
    this.light = new THREE.PointLight(0xff8a3a, 0, params.lightReach, 1.6);
    this.light.position.set(at.x, y0 + shape.floor + 1.0, at.z);
    this.light.castShadow = false;
    scene.add(this.light);
    // Smoke: its own puffs, drawn and dimmed like the bonfire's (game.updateWeather).
    this.smoke = new ExhaustSmoke(scene, heightAt, { ...DEFAULT_SMOKE_PARAMS, startSize: 0.12, endSize: 1.8, lifeMin: 3, lifeMax: 6, buoyancy: 0.9, opacity: 0.9 });
    const top = shape.chimney;
    this.smokeTop = new THREE.Vector3(top.x, y0 + parts.chimneyY, top.z);
    this.smokeBudget = 0;
    this.noVel = { x: 0, y: 0, z: 0 };
  }

  setViewport(heightPx, fovDeg) {
    this.smoke.setViewport(heightPx, fovDeg);
  }

  /** The kettle tips as you pour: `k` 0 (standing) to 1 (the mug filled). */
  setPour(k) {
    const kettle = this.parts.kettle;
    kettle.rotation.z = k > 0 ? -0.55 * Math.sin(Math.min(1, k) * Math.PI) : 0;
  }

  /**
   * Each frame. `stove` the Stove; `env`: { wind: { x, z }, darkness (0 day..1 night) }. The glow and the light follow the stove's heat, the
   * window shows the light from inside once it is dark, and the smoke goes up the pipe and downwind.
   */
  update(dt, stove, env) {
    this.t += dt;
    const t = this.t;
    const heat = stove.heat;
    const flick = stove.burning ? 0.88 + 0.12 * Math.sin(t * 13.1) * Math.sin(t * 4.3 + 1) + 0.05 * Math.sin(t * 27) : 0.7;
    const night = 0.25 + 0.75 * env.darkness;
    this.parts.stoveDoor.material.emissiveIntensity = stove.glowing ? 1.6 * heat * flick : 0;
    // The window glows from outside when it is dusk and the stove is lit; by day it is just glass.
    this.parts.glass.emissiveIntensity = stove.glowing ? Math.max(0, env.darkness - 0.15) * 1.8 * heat : 0;
    this.light.intensity = this.p.lightCandela * heat * flick * night;
    this.light.distance = this.p.lightReach;
    const sp = this.smoke.params;
    sp.windX = env.wind.x;
    sp.windZ = env.wind.z;
    this.smokeBudget = Math.min(this.smokeBudget + stove.smoke * 6 * dt, 3);
    this.smoke.tipPos.copy(this.smokeTop);
    this.smoke.tipDir.set(0, 1, 0.1);
    while (this.smokeBudget >= 1) {
      this.smokeBudget -= 1;
      this.smoke.spawn(0.22, 0.5, 0.8 + Math.random() * 0.5, this.noVel, 0);
    }
    this.smoke.simulate(dt);
  }
}
