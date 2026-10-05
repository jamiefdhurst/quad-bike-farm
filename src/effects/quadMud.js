import * as THREE from 'three';
import { MudSpray } from './mudSpray.js';
import { MudRuts } from './mudRuts.js';
import { MudCoat } from './mudCoat.js';
import { createMudState, updateMudBuildUp } from './mudBuildUp.js';

// Everything mud does to one quad: spray off the tyres, ruts left behind and
// mud building up on the bike. Grip in mud and puddles is in traction.js.

export const DEFAULT_MUD_PARAMS = {
  // Washing with the hose
  washRate: 0.1, // bodywork mud (0..1) off per second of spraying: a muddy quad takes about 8 s
  washDryTime: 60, // seconds for washed paint to dry off
  // Spray
  maxPerSecond: 500, // spawn cap for the quad
  rollRate: 5, // clumps per second per wheel for each m/s, rolling through mud
  spinRate: 22, // clumps per second per wheel for each m/s of wheelspin
  puddleRate: 18, // drops per second per wheel for each m/s, through a puddle
  splashCount: 60, // drops per wheel driving into a puddle at speed
  flingLift: 0.32, // how hard clumps leave the tyre upwards, per m/s of speed
  clumpSize: 0.045, // metres
  dropSize: 0.035,
  drag: 0.5, // 1/s
  gravity: 9.81,
  groundLife: 3, // seconds a landed clump stays before it's gone
  mudGray: 0.16, // colour of the clumps (0 black, 1 white)
  waterGray: 0.5, // colour of puddle splashes

  // Ruts
  rutSegments: 4000, // ring buffer size per quad: about 400 m (a lap) of track for each wheel
  rutStep: 0.4, // metres between rut points
  rutMudLife: 150, // seconds before a rut in mud has faded away
  rutGrassLife: 40, // seconds on grass
  rutGrassAlpha: 0.22, // how dark tracks on grass are

  // Build-up
  wheelBuildRate: 0.03, // tyres coat at this rate per m/s through mud
  bodyBuildRate: 0.004, // bodywork, slower than the tyres: about half-coated after 20 s through mud at 9 m/s
  puddleSplashRate: 0.04, // extra per m/s through a puddle
  tyreCleanRate: 0.0008, // rolling on grass sheds mud off the tyres, per m/s
  dryTime: 360, // seconds for fresh mud to dry
};

export const MUD_PARAM_RANGES = {
  washRate: [0, 2, 0.01],
  washDryTime: [1, 600, 1],
  maxPerSecond: [0, 2000, 10],
  rollRate: [0, 40, 0.5],
  spinRate: [0, 100, 1],
  puddleRate: [0, 100, 1],
  splashCount: [0, 120, 1],
  flingLift: [0, 1.5, 0.01],
  clumpSize: [0.005, 0.2, 0.005],
  dropSize: [0.005, 0.2, 0.005],
  drag: [0, 5, 0.05],
  gravity: [0, 20, 0.1],
  groundLife: [0, 20, 0.5],
  mudGray: [0, 1, 0.01],
  waterGray: [0, 1, 0.01],
  rutSegments: [100, 5000, 50],
  rutStep: [0.1, 1, 0.05],
  rutMudLife: [5, 600, 5],
  rutGrassLife: [5, 600, 5],
  rutGrassAlpha: [0, 1, 0.01],
  wheelBuildRate: [0, 0.2, 0.001],
  bodyBuildRate: [0, 0.02, 0.0001],
  puddleSplashRate: [0, 0.2, 0.001],
  tyreCleanRate: [0, 0.05, 0.0005],
  dryTime: [10, 1200, 10],
};

export const MUD_STATE_RANGES = {
  body: [0, 1, 0.01],
  wheels: [0, 1, 0.01],
  wet: [0, 1, 0.01],
  washed: [0, 1, 0.01],
};

const _p = new THREE.Vector3();

export class QuadMud {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {World} opts.world
   * @param {Quad} opts.quad
   * @param {boolean} opts.sport  Wider rear tyres.
   * @param {object} opts.params
   */
  constructor({ scene, world, quad, sport, params }) {
    this.params = params;
    this.quad = quad;
    this.state = createMudState();
    const ground = (x, z) => world.groundHeightAt(x, z);
    this.spray = new MudSpray(scene, ground, params);
    this.ruts = new MudRuts(scene, ground, params);
    this.coat = new MudCoat(quad);
    this.rutWheels = quad.wheels.map((w) => ({ x: 0, z: 0, contact: false, mud: 0, width: w.front ? 0.22 : sport ? 0.29 : 0.25 }));
  }

  setViewport(heightPx, fovDeg) {
    this.spray.setViewport(heightPx, fovDeg);
  }

  update(dt) {
    const quad = this.quad;
    const info = quad.physics.wheelInfo;
    const spinSlip = quad.physics.spinSlip;
    updateMudBuildUp(this.state, dt, info, quad.speed, spinSlip, this.params);
    this.coat.update(this.state);
    this.spray.update(dt, quad, spinSlip);
    for (let i = 0; i < quad.wheels.length; i++) {
      const r = this.rutWheels[i];
      quad.wheels[i].object.getWorldPosition(_p);
      r.x = _p.x;
      r.z = _p.z;
      r.contact = info[i].contact;
      r.mud = Math.min(1, Math.max(info[i].mud, info[i].puddle));
    }
    this.ruts.update(dt, this.rutWheels);
  }
}
