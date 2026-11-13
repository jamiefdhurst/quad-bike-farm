import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { AG_WHEELS, AG_RAKE, forkZ, AG_BARS_AT, AG_FRAME, AG_SEAT, AG_BARS, AG_EXHAUST, AG_RIDER, AG_PILLION, AG_PEGS, AG_PILLION_PEGS } from '../src/vehicle/shepherdBody.js';
import { EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';
import { CHOKE_STYLES, TAP_STYLES } from '../src/vehicle/controls.js';
import { DASH_STYLES } from '../src/vehicle/dash.js';
import { MAKER_FOR } from '../src/vehicle/detail/decals.js';
import { AG_LAYOUT } from '../src/vehicle/shepherdModel.js';
import { FOR_SALE } from '../src/farm/classifieds.js';
import { measureModel, proportionErrors, REAL_SIZES, IN_PROPORTION, PROPORTION_TOLERANCE } from '../src/vehicle/detail/realSizes.js';
import { buildAllModels } from './helpers/vehicleModels.js';

// The farm bike (#75) as a Ridgeback Shepherd 200: the numbers read off the photos, the parts it must have by name, the
// controls the game poses, the room on the back and the front end turning about the bars' axis.

const spec = EXTRA_SPECS.find((s) => s.id === 'shepherd');

describe('the farm bike’s numbers', () => {
  it('put the wheels where the physics layout has them, a wheelbase of 1.33 m', () => {
    expect(AG_LAYOUT.wheels.map((w) => w.z)).toEqual([AG_WHEELS.frontZ, AG_WHEELS.rearZ]);
    expect(AG_WHEELS.frontZ - AG_WHEELS.rearZ).toBeCloseTo(1.33, 6);
  });

  it('rake the forks back about 24 degrees, with the bars’ origin on the fork’s axis', () => {
    const deg = Math.atan(AG_RAKE) * (180 / Math.PI);
    expect(deg).toBeGreaterThan(20);
    expect(deg).toBeLessThan(30);
    expect(forkZ(AG_WHEELS.radius)).toBeCloseTo(AG_WHEELS.frontZ, 6);
    expect(Math.abs(forkZ(AG_BARS_AT[1]) - AG_BARS_AT[2])).toBeLessThan(0.01);
  });

  it('join the frame’s tubes end to end, down to the rear axle', () => {
    const F = AG_FRAME;
    expect(F.top.at(-1)).toEqual(F.seatRail[0]);
    expect(F.seatStay[0]).toEqual(F.seatRail[0]);
    expect(F.seatStay.at(-1)).toEqual([AG_WHEELS.rearZ, AG_WHEELS.radius]);
    expect(F.downtube.at(-1)).toEqual(F.cradle[0]);
  });

  it('seat the rider at the front of a long seat and the passenger behind, each a hand’s breadth above the cushion', () => {
    const top = (z) => Math.max(...AG_SEAT.filter((s) => Math.abs(s.z - z) < 0.2).map((s) => s.y1));
    expect(AG_RIDER.y - top(AG_RIDER.z)).toBeGreaterThan(0.02);
    expect(AG_RIDER.y - top(AG_RIDER.z)).toBeLessThan(0.08);
    expect(AG_PILLION.y - top(AG_PILLION.z)).toBeGreaterThan(0.02);
    expect(AG_PILLION.y - top(AG_PILLION.z)).toBeLessThan(0.08);
    expect(AG_RIDER.z - AG_PILLION.z).toBeGreaterThan(0.35); // room for the rider’s hips and hers
    expect(AG_RIDER.camera - AG_RIDER.y).toBeCloseTo(0.79, 6);
    const reach = AG_BARS_AT[2] + AG_BARS.grip[2] - AG_RIDER.z;
    expect(reach).toBeGreaterThan(0.4);
    expect(reach).toBeLessThan(0.7);
  });

  it('put her pegs behind the rider’s and higher, and the seat long enough to reach back past them', () => {
    expect(AG_PILLION_PEGS.z).toBeLessThan(AG_PEGS.z - 0.3);
    expect(AG_PILLION_PEGS.y).toBeGreaterThan(AG_PEGS.y);
    expect(Math.min(...AG_SEAT.map((s) => s.z))).toBeLessThan(AG_PILLION.z - 0.1);
  });

  it('put the exhaust on the right (-x) and sweep the silencer up and back', () => {
    for (const [x] of AG_EXHAUST.path) expect(x).toBeLessThan(0);
    expect(AG_EXHAUST.can.to[1]).toBeGreaterThan(AG_EXHAUST.can.from[1] + 0.1);
    expect(AG_EXHAUST.can.to[2]).toBeLessThan(AG_EXHAUST.can.from[2] - 0.3);
  });
});

describe('the farm bike’s spec', () => {
  it('names a dash, a plunger choke by the carb, a tap, a Ridgeback badge and a button start with a kickstart', () => {
    expect(spec).toBeTruthy();
    expect(DASH_STYLES).toContain(spec.dashStyle);
    expect(CHOKE_STYLES).toContain(spec.chokeStyle);
    expect(TAP_STYLES).toContain(spec.tapStyle);
    expect(MAKER_FOR.shepherd).toBe('ridgeback');
    expect(spec.engine.noStarter).toBeFalsy();
    expect(spec.engine.kickStart).toBe(true);
    expect(spec.engine.pullStart).toBe(true);
    expect(spec.gearbox.gears).toBe(4);
  });

  it('has room on the back, is for sale, and is in the fleet pool', () => {
    expect(spec.solo).toBeFalsy();
    expect(FOR_SALE.shepherd.colours).toContain(spec.bodyColor);
  });

  it('sounds like a different machine from the quads it shares a bank with', () => {
    const quads = EXTRA_SPECS.concat().filter((s) => !s.audio?.recBank && s.id !== 'shepherd');
    expect(spec.audio.recIdleSource).toBe('rev'); // not the red’s idle
    expect(spec.audio.recToneClosed).toBeGreaterThan(7000); // thinner than the quads’
    expect(quads.every((s) => s.audio?.pulseRefRpm !== spec.audio.pulseRefRpm || s.audio?.recToneClosed !== spec.audio.recToneClosed)).toBe(true);
    expect(spec.idleRange[0]).toBeGreaterThan(1300); // a faster tickover than the red’s 1,100
  });
});

describe('the farm bike’s model', () => {
  let bike;
  const world = (o) => o.getWorldPosition(new THREE.Vector3());
  beforeAll(async () => {
    bike = (await buildAllModels()).find((v) => v.id === 'shepherd');
  });

  it('is in proportion to the real bike', () => {
    expect(IN_PROPORTION).toContain('shepherd');
    const errors = proportionErrors(measureModel(bike.model, bike.layout), REAL_SIZES.shepherd);
    for (const [k, e] of Object.entries(errors)) expect(Math.abs(e), k).toBeLessThan(PROPORTION_TOLERANCE);
  });

  it('has its parts by name: the controls the game poses, the lamp, the engine in the open, the exhaust, both racks and the strap', () => {
    const m = bike.model;
    for (const n of ['handlebars', 'gripLeft', 'gripRight', 'riderHands', 'dash', 'podMount', 'chokeLever', 'chokeKnob', 'fuelTap', 'fuelTapBody', 'carb', 'crankcase', 'kickStart', 'headlight', 'tailLight', 'exhaustTip', 'silencer', 'heatShield', 'seat', 'grabStrap', 'frontFender', 'rearFender', 'tank', 'pegLeft', 'pegRight', 'passengerPegLeft', 'passengerPegRight', 'handGuard', 'twine', 'badge', 'riderAnchor', 'cameraAnchor', 'wheel_fl', 'wheel_rl']) {
      expect(m.getObjectByName(n), n).toBeTruthy();
    }
  });

  it('has a pillion seat: an anchor behind the rider, a camera over it, and the two ends of the strap for her to hold', () => {
    const m = bike.model;
    const rider = world(m.getObjectByName('riderAnchor'));
    const her = world(m.getObjectByName('pillionAnchor'));
    expect(her.z).toBeLessThan(rider.z - 0.35);
    expect(world(m.getObjectByName('pillionCameraAnchor')).y).toBeGreaterThan(her.y + 0.7);
    const left = world(m.getObjectByName('pillionGripLeft'));
    const right = world(m.getObjectByName('pillionGripRight'));
    expect(left.x).toBeGreaterThan(0.05);
    expect(right.x).toBeLessThan(-0.05);
    expect(left.z).toBeGreaterThan(her.z); // the strap is in front of her
    expect(m.getObjectByName('pillionGripLeft').userData.strap).toBe(true);
  });

  it('takes the headlamp’s beam from a lens on the bars', () => {
    let lenses = 0;
    bike.model.traverse((o) => {
      if (o.isMesh && o.material === bike.model.userData.lensMaterial) lenses++;
    });
    expect(lenses).toBe(1);
    expect(bike.model.userData.bike).toBe(true);
  });

  it('has the kickstart and the exhaust on the right, and the choke out to the left of the carb', () => {
    expect(world(bike.model.getObjectByName('kickStart')).x).toBeLessThan(-0.05);
    expect(world(bike.model.getObjectByName('silencer')).x).toBeLessThan(-0.1);
    expect(world(bike.model.getObjectByName('chokeLever')).x).toBeGreaterThan(world(bike.model.getObjectByName('carb')).x + 0.05);
  });

  it('turns the whole front end about the bars’ axis', () => {
    expect(bike.model.userData.steerPivotZ).toBe(AG_BARS_AT[2]);
    expect(bike.model.getObjectByName('handlebars').position.toArray()).toEqual(AG_BARS_AT);
  });
});
