import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import {
  ATC_WHEELS, ATC_BARS_AT, ATC_RAKE, forkZ, ATC_FORK, ATC_FRONT_FENDER, ATC_REAR_BODY, ATC_FLARE, ATC_FLARE_LIP, ATC_FRAME, ATC_SEAT, ATC_EXHAUST, ATC_ENGINE, ATC_CARB, ATC_BARS, ATC_TANK, ATC_LAMP,
} from '../src/vehicle/atcBody.js';
import { ATC_LAYOUT } from '../src/vehicle/atcModel.js';
import { EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';
import { CHOKE_STYLES, TAP_STYLES } from '../src/vehicle/controls.js';
import { DASH_STYLES } from '../src/vehicle/dash.js';
import { MAKER_FOR } from '../src/vehicle/detail/decals.js';
import { measureModel, proportionErrors, REAL_SIZES, IN_PROPORTION } from '../src/vehicle/detail/realSizes.js';
import { buildAllModels } from './helpers/vehicleModels.js';

// The old three-wheeler as a Honda-ATC185S-style trike, the Kestrel T185 (TODO 95): balloon tyres on plain silver rims, chrome legs in black
// boots under two red steering columns, a rectangular headlamp, swept bars, one wide red rear body with a long flat seat, the engine in the
// open with the choke on the carb, and a headlight and tail light.

/** The tyre's top height at distance dz from its axle line. */
const tyreTop = (dz) => ATC_WHEELS.radius + Math.sqrt(Math.max(0, ATC_WHEELS.radius ** 2 - dz ** 2));

describe('the old three-wheeler’s numbers', () => {
  it('put the wheels where the physics layout has them: one in front, two behind at the real 0.78 m track', () => {
    const [f, l, r] = ATC_LAYOUT.wheels;
    expect([f.x, f.z]).toEqual([0, ATC_WHEELS.frontZ]);
    expect([l.x, l.z]).toEqual([ATC_WHEELS.halfTrack, ATC_WHEELS.rearZ]);
    expect(r.x).toBe(-l.x);
    expect(l.x * 2).toBeCloseTo(0.78, 2);
  });

  it('rake the front end from the axle up to the bars’ clamp, so it turns about the bars’ axis', () => {
    expect(forkZ(ATC_BARS_AT[1])).toBeCloseTo(ATC_BARS_AT[2], 6);
    expect(forkZ(ATC_WHEELS.radius)).toBeCloseTo(ATC_WHEELS.frontZ, 6);
    expect(ATC_RAKE).toBeGreaterThan(0.3);
    expect(ATC_RAKE).toBeLessThan(0.5);
    expect(ATC_FORK.clamp).toBeLessThan(ATC_BARS_AT[1]);
    expect(ATC_FORK.crown).toBeGreaterThan(ATC_FORK.bootTop);
  });

  it('keep the front fender clear of the tyre, and the rear body and flares clear of the rear tyres', () => {
    for (const st of ATC_FRONT_FENDER) {
      expect(st.y0, `front fender at z ${st.z}`).toBeGreaterThan(tyreTop(st.z - ATC_WHEELS.frontZ) + 0.005);
    }
    for (const st of ATC_REAR_BODY) {
      expect(st.y0, `rear body at z ${st.z}`).toBeGreaterThan(tyreTop(st.z - ATC_WHEELS.rearZ) + 0.02);
    }
    const outer = ATC_WHEELS.halfTrack + ATC_WHEELS.rear / 2;
    for (const st of ATC_FLARE) expect(st.x - st.w / 2, `flare at z ${st.z}`).toBeGreaterThanOrEqual(outer - 0.01); // outside the tyre's face, not in it
  });

  it('join the flares to the body: the lip runs in under its edge, the skirt hangs from the lip, and both stay off the tyre', () => {
    const halfAt = (z) => {
      const i = ATC_REAR_BODY.findIndex((st) => st.z <= z);
      return ATC_REAR_BODY[Math.max(0, i)].w / 2;
    };
    ATC_FLARE_LIP.forEach((lip, i) => {
      expect(lip.x - lip.w / 2, `lip inner edge at z ${lip.z}`).toBeLessThan(halfAt(lip.z));
      expect(lip.y0, `lip over the tyre at z ${lip.z}`).toBeGreaterThan(tyreTop(lip.z - ATC_WHEELS.rearZ) + 0.01);
      const skirt = ATC_FLARE[i];
      expect(skirt.x - skirt.w / 2, 'skirt starts inside the lip').toBeLessThan(lip.x + lip.w / 2);
      expect(skirt.x + skirt.w / 2, 'and the lip reaches it').toBeGreaterThan(lip.x + lip.w / 2 - 0.03);
      expect(skirt.y1, 'skirt top is in the lip').toBeGreaterThan(lip.y0);
    });
  });

  it('keep the frame out of what the steering swings: nothing of it ahead of z 0.25 but the head tube on the axis', () => {
    for (const run of [ATC_FRAME.cradle, ATC_FRAME.spine]) for (const [z] of run) expect(z).toBeLessThanOrEqual(0.25);
    expect(ATC_FRAME.head[1]).toBeGreaterThan(ATC_FRAME.head[0]);
  });

  it('seat the rider at the fixed height: the seat top near the anchor (0.92), on the body’s top, the tank joined to the seat', () => {
    const top = Math.max(...ATC_SEAT.filter((s) => s.z <= -0.2 && s.z >= -0.5).map((s) => s.y1));
    expect(top).toBeGreaterThan(0.84);
    expect(top).toBeLessThan(0.9);
    const bodyTop = Math.max(...ATC_REAR_BODY.map((s) => s.y1));
    expect(Math.min(...ATC_SEAT.map((s) => s.y0))).toBeLessThanOrEqual(bodyTop); // the seat sits on the body
    const rear = ATC_TANK.stations[ATC_TANK.stations.length - 1];
    expect(rear.z).toBeGreaterThan(ATC_SEAT[0].z - 0.05); // the tank's back runs under the seat's front
  });

  it('send the exhaust out of the cylinder’s front in a few plain bends to a can between the tyres', () => {
    expect(ATC_EXHAUST.path.length).toBeLessThanOrEqual(6);
    const [sx, sy, sz] = ATC_EXHAUST.path[0];
    const cy = ATC_ENGINE.cylinder;
    const front = cy.z + (sy - cy.y) * Math.tan(cy.lean) + cy.r / Math.cos(cy.lean);
    expect(Math.abs(sz - front), 'pipe starts at the barrel’s face').toBeLessThan(0.03);
    expect(sx).toBeLessThanOrEqual(0);
    expect(ATC_EXHAUST.can.from).toEqual(ATC_EXHAUST.path[ATC_EXHAUST.path.length - 1]);
    const inner = ATC_WHEELS.halfTrack - ATC_WHEELS.rear / 2;
    expect(Math.abs(ATC_EXHAUST.can.from[0]) + ATC_EXHAUST.can.r, 'the can is inside the tyre').toBeLessThan(inner);
  });

  it('keep the grips at their fixed points and the headlamp between the steering columns', () => {
    expect(ATC_BARS.grip).toEqual([0.318, 0.0675, -0.042]);
    expect(ATC_LAMP.w / 2).toBeLessThanOrEqual(ATC_FORK.columnX);
  });
});

describe('the old three-wheeler’s spec', () => {
  const atc = EXTRA_SPECS.find((s) => s.id === 'atc');

  it('names its dash, the choke on the carb, the tap by it, a Kestrel badge, and keeps the lamp, the cord start and the solo seat', () => {
    expect(DASH_STYLES).toContain(atc.dashStyle);
    expect(CHOKE_STYLES).toContain(atc.chokeStyle);
    expect(TAP_STYLES).toContain(atc.tapStyle);
    expect(atc.chokeStyle).toBe('plunger');
    expect(atc.tapStyle).toBe('carbLeft');
    expect(atc.noHeadlight).toBeFalsy();
    expect(atc.barLights).toBe('switch');
    expect(MAKER_FOR.atc).toBe('kestrel');
    expect(atc.engine.pullStart).toBe(true);
    expect(atc.engine.noStarter).toBe(true);
    expect(atc.solo).toBe(true);
    expect(atc.threeWheeler).toBe(true);
  });
});

describe('the old three-wheeler’s model', () => {
  let atc;
  const world = (o) => o.getWorldPosition(new THREE.Vector3());
  beforeAll(async () => {
    atc = (await buildAllModels()).find((v) => v.id === 'atc');
  });

  it('has its parts by name: the controls, the engine in the open, the exhaust, the body and the lights', () => {
    const m = atc.model;
    for (const n of ['handlebars', 'gripLeft', 'gripRight', 'riderHands', 'dash', 'podMount', 'chokeLever', 'chokeKnob', 'fuelTap', 'fuelTapBody', 'carb', 'crankcase', 'recoilStarter', 'recoilHandle', 'header', 'silencer', 'exhaustTip', 'seat', 'rearBody', 'tank', 'flare', 'frontFender', 'frontFlap', 'headlight', 'tailLight', 'badge', 'stripe', 'pegLeft', 'pegRight', 'axleHousing', 'wheel_fl', 'wheel_rl', 'wheel_rr']) {
      expect(m.getObjectByName(n), n).toBeTruthy();
    }
  });

  it('has a lights rocker on the left bar and a thumb throttle on the right that moves with the throttle', async () => {
    const m = atc.model;
    const bars = m.getObjectByName('handlebars');
    expect(bars.getObjectByName('lightsRocker').position.x).toBeGreaterThan(0.2);
    const paddle = bars.getObjectByName('thumbThrottle');
    expect(paddle.position.x).toBeLessThan(-0.25);
    const { poseThumbThrottle } = await import('../src/vehicle/foremanControls.js');
    poseThumbThrottle(m, 0);
    const rest = paddle.rotation.x;
    poseThumbThrottle(m, 1);
    expect(paddle.rotation.x).toBeGreaterThan(rest + 0.3);
    poseThumbThrottle(m, 0);
  });

  it('has the pads against the crossbar, not hanging off it', () => {
    const bars = atc.model.getObjectByName('handlebars');
    bars.updateMatrixWorld(true);
    const cross = new THREE.Box3().setFromObject(bars.getObjectByName('barPadLeft')).expandByScalar(0.004);
    // The crossbar (z 0, radius 9 mm): a point on its back surface must be inside the pad's box.
    const p = new THREE.Vector3(ATC_BARS.crossX * 0.6, ATC_BARS.crossY - 0.004, -0.007).applyMatrix4(bars.matrixWorld);
    expect(cross.containsPoint(p)).toBe(true);
  });

  it('has a headlight whose lens takes the lamp material (so the beam finds it), and a tail light', () => {
    const lens = atc.model.getObjectByName('headlight');
    expect(lens.material).toBe(atc.model.userData.lensMaterial);
    expect(world(lens).z).toBeGreaterThan(0.3);
    expect(atc.model.userData.beams?.length ?? atc.model.children.length).toBeGreaterThan(0);
    expect(atc.model.userData.tailMaterial).toBeTruthy();
    expect(atc.model.userData.tailHalos.length).toBeGreaterThan(0);
  });

  it('has the choke knob out to the carb’s left, pulling out along x by 9 cm', () => {
    const lever = atc.model.getObjectByName('chokeLever');
    const carb = world(atc.model.getObjectByName('carb'));
    expect(world(lever).x).toBeGreaterThan(carb.x + ATC_CARB.r + 0.02);
    expect(lever.userData.travel).toBeGreaterThanOrEqual(0.08);
    const before = world(lever).x;
    lever.position.y = -lever.userData.travel;
    lever.parent.updateMatrixWorld(true);
    expect(world(lever).x).toBeGreaterThan(before + 0.08);
    lever.position.y = 0;
    lever.parent.updateMatrixWorld(true);
  });

  it('turns its front end about the bars’ axis: the columns go with the bars and the legs with the wheel', () => {
    expect(atc.model.userData.steerPivotZ).toBe(ATC_BARS_AT[2]);
    expect(atc.model.userData.steerGain).toBe(1);
    const bars = atc.model.getObjectByName('handlebars');
    const wheel = atc.model.getObjectByName('wheel_fl');
    expect(wheel.getObjectByName('frontFender')).toBeTruthy();
    expect(bars.getObjectByName('clampBlock')).toBeTruthy();
    expect(bars.getObjectByName('headlight')).toBeTruthy();
  });

  it('keeps the bars at their fixed height and the dash on the clamp', () => {
    const bars = atc.model.getObjectByName('handlebars');
    expect(world(bars).toArray().map((v) => +v.toFixed(3))).toEqual(ATC_BARS_AT);
    expect(world(bars.getObjectByName('dash')).y).toBeCloseTo(1.075, 3);
  });

  it('is in proportion to the real one on every measure', () => {
    expect(IN_PROPORTION).toContain('atc');
    const errors = proportionErrors(measureModel(atc.model, atc.layout), REAL_SIZES.atc);
    for (const [k, e] of Object.entries(errors)) expect(Math.abs(e), k).toBeLessThan(0.08);
  });
});
