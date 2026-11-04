import { SprayerTrailer, DEFAULT_SPRAYER_PARAMS, SPRAYER_PARAM_RANGES } from './sprayerTrailer.js';
import { buildHarrowModel, poseHarrow, HARROW_SPEC, HARROW_FOOTPRINT } from './harrowModel.js';

export const DEFAULT_HARROW_TRAILER_PARAMS = {
  ...DEFAULT_SPRAYER_PARAMS,
  drawLength: HARROW_SPEC.drawLength,
  springRate: 170, // an empty frame bounces a little more than a sprayer with a full tank
  towWeight: 2, // the mat on the ground drags like this many things in the tow load (the harrowing rules scale it by how far down it is)
};

export const HARROW_TRAILER_PARAM_RANGES = SPRAYER_PARAM_RANGES;

export const HARROW_KIT = { build: buildHarrowModel, spec: HARROW_SPEC, footprint: HARROW_FOOTPRINT, pose: poseHarrow, hitchProxyY: HARROW_SPEC.floorY + 0.4 };

/**
 * The chain harrows' carrier: the sprayer's hitch and motion (vehicle/sprayerTrailer.js) with the harrow model, which lowers its mat of tines
 * to the ground or lifts it clear. The harrowing rules are in world/harrowing.js; this only moves, poses and hitches.
 */
export class HarrowTrailer extends SprayerTrailer {
  constructor({ scene, world, params = { ...DEFAULT_HARROW_TRAILER_PARAMS } }) {
    super({ scene, world, params, kit: HARROW_KIT });
  }
}
