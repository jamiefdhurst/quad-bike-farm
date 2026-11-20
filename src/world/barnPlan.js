// The new barn (#818): one building about 26 by 18 m on the farm plan, its one pair of doors in the long south wall onto the yard, and everything that
// stands in it. Written in the barn's own frame (`at('barn', ...)`, the frame it has at yaw 0): +x towards the doors, z across the building, so the
// workshop's back wall is x -8.8 and the doors' wall x 9, the bench is against the wall at z -12.8 and the helmets against the one at z 12.8. The barn
// stands turned a quarter (`FARMSTEAD_PLAN.barn`), so +x is plan south. Pure: no Three.js.

import { at } from './layoutAnchors.js';

/** The building's own numbers: the plan's 498 to 524 by 319 to 337 is `halfZ` 13 across the doors' wall and `halfX` 9 deep. */
export const BARN_NEW = {
  halfX: 9, // half the depth, from the back wall to the doors' wall
  halfZ: 13, // half the width along the doors' wall (which is the long, eaves wall: the ridge runs along it)
  wall: 0.2,
  wallHeight: 5, // the eaves
  ridge: 8.4, // the top of the roof: 18 m of span at about 21 degrees
  door: { halfWidth: 3.2, height: 3.9 }, // the one pair of doors, in the middle of the doors' wall: a tractor and a trailer go through
  wide: true, // the doors are in an eaves wall and the roof's ridge runs across them (barn.js `barnShape.wide`)
};

const INNER_X = BARN_NEW.halfX - BARN_NEW.wall; // 8.8: the inside face of the doors' wall (and, negative, of the back wall)
const INNER_Z = BARN_NEW.halfZ - BARN_NEW.wall; // 12.8: the inside faces of the two side walls

/** A girl's way in from the yard to the south wall's hooks and rack, round the big bay: out in the yard, just inside the doors, then along the side. */
const WAY_IN = [{ x: 11.3, z: 0 }, { x: 7.6, z: 0 }, { x: 7.6, z: 8 }];

/**
 * The barn's things as `at('barn', ...)` entries, to lay over today's layout in the new farm. What today's layout writes from the barn that is not here
 * stays (the shed's pit, the barn find, the plover and the bench's bottles are all here because they stand in this room).
 */
export function barnRaw() {
  const bench = { x: -3.5, z: -12.3, length: 4.2 }; // along the north wall, the vice at its +x end as it was
  return {
    barn: at('barn', { x: 0, z: 0, yaw: 0, ...BARN_NEW, door: { ...BARN_NEW.door } }),
    // Straw bales to sit on, scattered by the back wall where it is dry, and not in a row (each turned a different way).
    barnBaleSpots: at('barn', [
      [-7.6, 3.9, Math.PI / 2 + 0.2],
      [-6.9, 5.9, Math.PI / 2 - 0.35],
      [-7.7, 8.3, Math.PI / 2 + 0.05],
      [-5.6, 10.6, Math.PI * 0.8],
    ]),
    bench: at('barn', { ...bench, yaw: 0, depth: 0.7, height: 0.92 }),
    benchCharger: at('barn', { x: bench.x - 1.7, z: -12.2, yaw: 0 }),
    toolbox: at('barn', { x: bench.x - 0.1, z: -12.3, yaw: 0.1, lift: 0.92 }),
    benchOil: at('barn', { x: bench.x + 0.75, z: -12.3, yaw: 0.2 }),
    benchLeads: at('barn', { x: bench.x - 0.75, z: -12.3, yaw: 0.4 }),
    benchPack: at('barn', { x: bench.x + 1, z: -12.08, yaw: 0.15 }),
    moneyTin: at('barn', { x: -7.7, z: -INNER_Z, y: 1.05 }),
    // On the doors' wall beside the doorway: the thermometer, the barometer and the forecast together (the clock is on the back wall, `clock`).
    weatherStation: at('barn', { x: INNER_X, z: -6.4, yaw: -Math.PI / 2, y: 1.65 }), // on the doors' wall, facing back into the barn
    clock: at('barn', { x: 1, z: -INNER_Z, yaw: 0, y: 3.9 }), // high on the bench's wall over the bays, so it is seen from the bench and the big bay, apart from the calendar on the back wall
    // The farm desk against the back wall and its stool, by the boards: where the paperwork is done (the computer for the classifieds is #806's).
    desk: at('barn', { x: -8.45, z: -8.6, yaw: 0 }), // facing the doors, its back to the wall
    // By the doors, on the yard side: the bell on its post beside the east leaf's resting place, and the generator off the west wall (yard frame: plan z 347 is its 0).
    bell: at('yard', { x: -7.8, z: -1, yaw: 0 }),
    generator: at('yard', { x: -16, z: 21.4, yaw: 0, stand: { x: -15.3, z: 22.4 } }),
    // The bay in front of the bench, and the big one in the middle of the floor nose-in from the doors, with the pit along it and the jack beside it.
    bay: at('barn', { x: bench.x + 0.2, z: -9.9, halfX: 1.5, halfZ: 1.1, yaw: 0 }),
    bay2: at('barn', { x: 4, z: 0, halfX: 3, halfZ: 1.9, yaw: 0 }),
    jack: at('barn', { x: 2.4, z: 4.2, yaw: 0.25 }),
    axleStands: at('barn', [{ x: 1.1, z: 4.4, yaw: 0.1 }, { x: 1.7, z: 4.7, yaw: -0.3 }]),
    shed: at('barn', {
      compressor: { x: -8.45, z: -2.4, yaw: Math.PI / 2 },
      washer: { x: bench.x + 2.65, z: -12.05, yaw: 0 },
      pit: { x: 4, z: 0, yaw: 0, halfX: 1.9, halfZ: 0.45 },
      catalogue: { x: bench.x + 0.45, z: -12.34, yaw: 0.2 },
    }),
    rusty: at('barn', { x: -5.8, z: 0.4, yaw: 0.15 }),
    plover: at('barn', { x: -5.2, z: -3.8, yaw: Math.PI }),
    // The rack for the two jumpers and the helmets' hooks, on the south side wall (z 12.8), each reached from the doors by the way along the side.
    jumperRail: at('barn', { x: 3.2, z: 11.7, yaw: 0, y: 1.7, length: 1.3, stand: { x: 4.6, z: 11.7 }, door: { in: [...WAY_IN, { x: 4.6, z: 10.7 }], out: { ...WAY_IN[0] } } }),
    helmetHooks: at('barn', { x: 7.6, z: INNER_Z - 0.02, yaw: 0, y: 1.5, length: 1.6, stand: { x: 7.6, z: 11.8 }, door: { in: [...WAY_IN, { x: 7.6, z: 10.8 }], out: { ...WAY_IN[0] } } }),
  };
}
