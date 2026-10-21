import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { BANTAM_WHEELS, BANTAM_RAKE, forkZ, BANTAM_BARS_AT, BANTAM_FORK, BANTAM_FRAME, BANTAM_SEAT, BANTAM_BARS, BANTAM_EXHAUST, BANTAM_CARB, BANTAM_RIDER } from '../src/vehicle/bantamBody.js';
import { PLOVER_SPEC } from '../src/vehicle/quadSpecs.js';
import { CHOKE_STYLES, TAP_STYLES } from '../src/vehicle/controls.js';
import { DASH_STYLES } from '../src/vehicle/dash.js';
import { MAKER_FOR } from '../src/vehicle/detail/decals.js';
import { BANTAM_LAYOUT } from '../src/vehicle/bantamModel.js';
import { measureModel, proportionErrors, REAL_SIZES, IN_PROPORTION, PROPORTION_TOLERANCE } from '../src/vehicle/detail/realSizes.js';
import { fenderGeometry } from '../src/vehicle/bantamDetail.js';
import { buildAllModels } from './helpers/vehicleModels.js';

// The old bike (#38) as an Ashby Plover 125 after a 1949 Bantam: the numbers read off the photos, the parts it must have by name, the
// controls the game poses, and the front end turning about the bars' axis.

describe('the old bike’s numbers', () => {
  it('put the wheels where the physics layout has them, a wheelbase of 1.31 m', () => {
    expect(BANTAM_LAYOUT.wheels.map((w) => w.z)).toEqual([BANTAM_WHEELS.frontZ, BANTAM_WHEELS.rearZ]);
    expect(BANTAM_WHEELS.frontZ - BANTAM_WHEELS.rearZ).toBeCloseTo(1.31, 6);
  });

  it('rake the forks back about 27 degrees, with the bars’ origin on the fork’s axis', () => {
    const deg = Math.atan(BANTAM_RAKE) * (180 / Math.PI);
    expect(deg).toBeGreaterThan(24);
    expect(deg).toBeLessThan(30);
    expect(forkZ(BANTAM_WHEELS.radius)).toBeCloseTo(BANTAM_WHEELS.frontZ, 6);
    expect(Math.abs(forkZ(BANTAM_BARS_AT[1]) - BANTAM_BARS_AT[2])).toBeLessThan(0.01);
    expect(BANTAM_FORK.gaiter[1]).toBeLessThan(BANTAM_FORK.upperTop); // the stanchion shows above the gaiter
  });

  it('join the frame’s tubes end to end, down to the rear axle', () => {
    const F = BANTAM_FRAME;
    expect(F.top.at(-1)).toEqual(F.seatStay[0]);
    expect(F.seatStay.at(-1)).toEqual(F.cradle.at(-1));
    expect(F.seatStay.at(-1)).toEqual([BANTAM_WHEELS.rearZ, BANTAM_WHEELS.radius]);
    expect(F.downtube.at(-1)).toEqual(F.cradle[0]);
  });

  it('seat the rider at the saddle with the grips narrower than the real bars (about 70 cm across)', () => {
    const top = Math.max(...BANTAM_SEAT.map((s) => s.y1));
    expect(BANTAM_RIDER.y - top).toBeGreaterThan(0.02);
    expect(BANTAM_RIDER.y - top).toBeLessThan(0.08);
    expect(BANTAM_RIDER.camera - BANTAM_RIDER.y).toBeCloseTo(0.79, 6);
    const reach = BANTAM_BARS_AT[2] + BANTAM_BARS.grip[2] - BANTAM_RIDER.z;
    expect(reach).toBeGreaterThan(0.45);
    expect(reach).toBeLessThan(0.7);
  });

  it('put the exhaust and the carb on the right (-x) and have the silencer reach back over the rear wheel', () => {
    for (const [x] of BANTAM_EXHAUST.path) expect(x).toBeLessThan(0);
    expect(BANTAM_CARB.x).toBeLessThan(0);
    expect(BANTAM_EXHAUST.can.to[2]).toBeLessThan(BANTAM_WHEELS.rearZ + 0.2);
    expect(BANTAM_EXHAUST.can.r1).toBeGreaterThan(BANTAM_EXHAUST.can.r0); // it tapers up to the back
  });

  it('sweep a fender clear of its wheel: the crown over the tyre, the valance outside its width', () => {
    const g = fenderGeometry({ r: 0.35, width: 0.12, flange: 0.07, from: -42, to: 118 });
    const pos = g.attributes.position;
    let crown = Infinity;
    let valance = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getY(i), pos.getZ(i));
      if (Math.abs(pos.getX(i)) < 0.01) crown = Math.min(crown, r);
      else if (r < BANTAM_WHEELS.radius) valance = Math.min(valance, Math.abs(pos.getX(i))); // the part of the valance that hangs below the tyre's top
    }
    expect(crown).toBeGreaterThan(BANTAM_WHEELS.radius + 0.01);
    expect(valance).toBeGreaterThan(BANTAM_WHEELS.width / 2 + 0.01);
  });
});

describe('the old bike’s spec', () => {
  it('names a dash, a choke on the carb, a tap, an Ashby badge, no starter motor and a kickstart', () => {
    expect(DASH_STYLES).toContain(PLOVER_SPEC.dashStyle);
    expect(CHOKE_STYLES).toContain(PLOVER_SPEC.chokeStyle);
    expect(TAP_STYLES).toContain(PLOVER_SPEC.tapStyle);
    expect(MAKER_FOR.plover).toBe('ashby');
    expect(PLOVER_SPEC.engine.noStarter).toBe(true);
    expect(PLOVER_SPEC.engine.kickStart).toBe(true);
    expect(PLOVER_SPEC.engine.manualTiming).toBe(true);
    expect(PLOVER_SPEC.solo).toBe(true);
    expect(PLOVER_SPEC.gearbox.gears).toBe(3);
  });
});

describe('the old bike’s model', () => {
  let bike;
  const world = (o) => o.getWorldPosition(new THREE.Vector3());
  beforeAll(async () => {
    bike = (await buildAllModels()).find((v) => v.id === 'plover');
  });

  it('is in proportion to the real bike', () => {
    expect(IN_PROPORTION).toContain('plover');
    const errors = proportionErrors(measureModel(bike.model, bike.layout), REAL_SIZES.plover);
    for (const [k, e] of Object.entries(errors)) expect(Math.abs(e), k).toBeLessThan(PROPORTION_TOLERANCE);
  });

  it('has its parts by name: the controls the game poses, the lamp, the engine in the open and the exhaust', () => {
    const m = bike.model;
    for (const n of ['handlebars', 'gripLeft', 'gripRight', 'riderHands', 'dash', 'podMount', 'chokeLever', 'chokeKnob', 'fuelTap', 'fuelTapBody', 'carb', 'crankcase', 'kickStart', 'advanceLever', 'advanceArm', 'tickler', 'headlight', 'tailLight', 'exhaustTip', 'silencer', 'seat', 'frontFender', 'rearFender', 'tank', 'pegLeft', 'pegRight', 'badge', 'riderAnchor', 'cameraAnchor', 'wheel_fl', 'wheel_rl']) {
      expect(m.getObjectByName(n), n).toBeTruthy();
    }
  });

  it('takes the headlamp’s beam from a lens on the bars and has no pillion', () => {
    let lenses = 0;
    bike.model.traverse((o) => {
      if (o.isMesh && o.material === bike.model.userData.lensMaterial) lenses++;
    });
    expect(lenses).toBe(1);
    expect(bike.model.getObjectByName('pillionAnchor')).toBeFalsy();
    expect(bike.model.userData.bike).toBe(true);
  });

  it('has the kickstart on the right, the advance lever on the left bar, and the choke out to the right of the carb', () => {
    expect(world(bike.model.getObjectByName('kickStart')).x).toBeLessThan(-0.05);
    expect(world(bike.model.getObjectByName('advanceLever')).x).toBeGreaterThan(0.05);
    expect(world(bike.model.getObjectByName('chokeLever')).x).toBeLessThan(world(bike.model.getObjectByName('carb')).x - 0.05);
    expect(world(bike.model.getObjectByName('tickler')).y).toBeGreaterThan(world(bike.model.getObjectByName('carb')).y);
  });

  it('turns the whole front end about the bars’ axis', () => {
    expect(bike.model.userData.steerPivotZ).toBe(BANTAM_BARS_AT[2]);
    expect(bike.model.getObjectByName('handlebars').position.toArray()).toEqual(BANTAM_BARS_AT);
  });
});
