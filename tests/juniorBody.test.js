import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { juniorRearFenderY, JUNIOR_FENDERS, JUNIOR_SECTION, JUNIOR_FRONT, JUNIOR_SEAT, JUNIOR_TAIL, JUNIOR_FLAP, JUNIOR_SIDE_PLATE, JUNIOR_EXHAUST, JUNIOR_TYRES, JUNIOR_TYRE_OUTER, JUNIOR_WHEELS, juniorTop, juniorHalf } from '../src/vehicle/juniorBody.js';
import { BLASTER_VBARS } from '../src/vehicle/blasterBody.js';
import { shellGeometry } from '../src/vehicle/quadGeometry.js';
import { EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';
import { BODY_STYLES } from '../src/vehicle/quadModel.js';
import { CHOKE_STYLES, TAP_STYLES } from '../src/vehicle/controls.js';
import { DASH_STYLES } from '../src/vehicle/dash.js';
import { MAKER_FOR } from '../src/vehicle/detail/decals.js';
import { buildAllModels } from './helpers/vehicleModels.js';

// The kids' quad as a Suzuki LT50 (TODO 93): bulky pink plastics, a thick blue seat, the engine in the open with the choke on the carb, a
// thumb throttle, a key on the clamp, stickers and no lights.

describe('the kids’ quad body numbers', () => {
  it('keep every fender clear of its tyre (4 cm to spare), with fatter tyres than the other sport quads', () => {
    expect(JUNIOR_TYRES.front).toBeGreaterThan(0.22);
    for (const [which, wheelWidth] of [['front', JUNIOR_TYRES.front], ['rear', JUNIOR_TYRES.rear]]) {
      const F = JUNIOR_FENDERS[which];
      expect(F.width[1], `${which} fender is inside its tyre's outer edge`).toBeLessThan(JUNIOR_TYRE_OUTER[which]);
      const p = shellGeometry(F.profile, JUNIOR_SECTION, F.width[0], F.width[1], { samples: 48 }).attributes.position;
      let min = Infinity;
      for (let i = 0; i < p.count; i++) {
        const [x, y, z] = [p.getX(i), p.getY(i), p.getZ(i)];
        if (y <= 0 || x < JUNIOR_WHEELS.x - wheelWidth / 2 || x > JUNIOR_WHEELS.x + wheelWidth / 2) continue;
        min = Math.min(min, Math.hypot(y, z) - JUNIOR_WHEELS.radius);
      }
      expect(min, `${which} fender clearance over its tyre`).toBeGreaterThan(0.04);
    }
  });

  it('are bulkier than the yellow’s plastics: deeper, taller fenders and a wider front body and seat', () => {
    expect(Math.max(...JUNIOR_FENDERS.front.profile.map((p) => p[1]))).toBeGreaterThan(0.45);
    expect(Math.max(...JUNIOR_FRONT.map((s) => s.w))).toBeGreaterThan(0.4);
    expect(Math.max(...JUNIOR_SEAT.map((s) => s.w))).toBeGreaterThan(0.32);
  });

  it('keep the seat top at the rider’s anchor (0.9) and the front body’s top meeting the bars’ clamp', () => {
    const top = Math.max(...JUNIOR_SEAT.filter((s) => s.z <= -0.18 && s.z >= -0.55).map((s) => s.y1));
    expect(top).toBeGreaterThan(0.9);
    expect(top).toBeLessThan(0.93);
    const clampBottom = 1.0 + BLASTER_VBARS.centreY + 0.012 - 0.015; // the bars are at y 1.0 over z 0.46
    expect(Math.abs(juniorTop(0.46) - clampBottom)).toBeLessThan(0.02);
  });

  it('ends the tail between the rear fenders, the flaps up in the fenders’ back ends, and the can small and clear of the plate', () => {
    expect(Math.max(...JUNIOR_TAIL.map((t) => t.w)) / 2).toBeGreaterThanOrEqual(JUNIOR_FENDERS.rear.width[0] - 0.01);
    // The flap hangs just behind the tyre, under the fender's end, with its top edge meeting the fender's underside across its width.
    for (const x of [JUNIOR_FLAP.x - JUNIOR_FLAP.w / 2, JUNIOR_FLAP.x + JUNIOR_FLAP.w / 2]) {
      const top = juniorRearFenderY(x, JUNIOR_FLAP.z);
      expect(top - JUNIOR_FLAP.bottom).toBeGreaterThan(0.12); // a flap, not a sliver
      expect(top).toBeLessThan(JUNIOR_WHEELS.y + 0.45); // and no higher than the wing's own height there
    }
    expect(JUNIOR_FLAP.z + JUNIOR_FLAP.d / 2).toBeLessThan(JUNIOR_WHEELS.zRear - 0.27); // clear of the tyre's back
    expect(Math.abs(JUNIOR_FLAP.x - JUNIOR_WHEELS.x)).toBeLessThan(0.01); // centred on the tyre
    const E = JUNIOR_EXHAUST;
    expect(E.can.length).toBeLessThan(0.3); // a small can
    expect(Math.abs(E.can.x) - 0.04).toBeGreaterThan(JUNIOR_SIDE_PLATE.x + 0.0125); // outboard of the plate
    expect(E.can.y + 0.045).toBeLessThan(JUNIOR_WHEELS.y + JUNIOR_FENDERS.rear.profile[3][1] - 0.05); // and under the fender
  });

  it('has a way to find the front body’s top and width between its stations', () => {
    expect(juniorTop(0.2)).toBeCloseTo(0.97, 6);
    expect(juniorHalf(0.2)).toBeCloseTo(0.2, 6);
    expect(juniorTop(5)).toBeNull();
  });
});

describe('the kids’ quad’s spec', () => {
  const kids = EXTRA_SPECS.find((s) => s.id === 'asp');

  it('names its own body style and dash, the choke on the carb, the tap by it, no lamps, a Viper badge and a faded pink', () => {
    expect(BODY_STYLES).toContain(kids.style);
    expect(kids.style).toBe('junior');
    expect(DASH_STYLES).toContain(kids.dashStyle);
    expect(CHOKE_STYLES).toContain(kids.chokeStyle);
    expect(TAP_STYLES).toContain(kids.tapStyle);
    expect(kids.chokeStyle).toBe('plunger');
    expect(kids.noHeadlight).toBe(true);
    expect(kids.barLights).toBeFalsy();
    expect(MAKER_FOR.asp).toBe('viper');
    expect(kids.bodyWear).toBeGreaterThan(0.55);
    expect(kids.scale).toBe(0.65);
    expect(kids.solo).toBe(true);
  });
});

describe('the kids’ quad’s model', () => {
  let kids;
  const world = (o) => o.getWorldPosition(new THREE.Vector3());
  beforeAll(async () => {
    kids = (await buildAllModels()).find((v) => v.id === 'asp');
  });

  it('has its parts by name and none for lights: no lamp, no lights rocker, no pod', () => {
    const m = kids.model;
    for (const n of ['frontBody', 'tail', 'sidePlate', 'mudFlap', 'seat', 'carb', 'chokeLever', 'chokeKnob', 'fuelTap', 'fuelTapBody', 'thumbThrottle', 'thumbHousing', 'crossbar', 'clampBlock', 'dash', 'badge', 'number50', 'warning', 'stripe', 'pegLeft', 'pegRight', 'brakeCable', 'throttleCable']) {
      expect(m.getObjectByName(n), n).toBeTruthy();
    }
    for (const n of ['headlight', 'headlightHousing', 'lampMount', 'lightsRocker', 'stopRocker', 'barPad', 'pillionSeat', 'grabStrap']) expect(m.getObjectByName(n), `no ${n}`).toBeFalsy();
  });

  it('has no number plate and no lamp anywhere (nothing that takes the headlamp lens’s material)', () => {
    kids.model.traverse((o) => {
      if (o.isMesh && o.geometry.type === 'CircleGeometry') expect(o.geometry.parameters.radius).not.toBeCloseTo(0.11, 2);
      if (o.isMesh && o.material === kids.model.userData.lensMaterial) throw new Error(`a lamp lens: ${o.name}`);
    });
  });

  it('keeps the fenders inside the tyres’ outer edges, and the seat blue and faded', () => {
    for (const [tag, outer] of [['fl', JUNIOR_TYRE_OUTER.front], ['fr', JUNIOR_TYRE_OUTER.front], ['rl', JUNIOR_TYRE_OUTER.rear], ['rr', JUNIOR_TYRE_OUTER.rear]]) {
      const box = new THREE.Box3().setFromObject(kids.model.getObjectByName(`fender_${tag}`));
      expect(Math.max(Math.abs(box.min.x), Math.abs(box.max.x)), tag).toBeLessThan(outer);
    }
    const c = kids.model.userData.seatMaterial.color;
    expect(c.b).toBeGreaterThan(c.r); // blue
    expect(Math.max(c.r, c.g, c.b)).toBeLessThan(0.8);
  });

  it('has the choke knob on the carb’s left, pulling out along x, and the key’s housing on the clamp block', () => {
    const lever = kids.model.getObjectByName('chokeLever');
    const carb = world(kids.model.getObjectByName('carb'));
    expect(world(lever).x).toBeGreaterThan(carb.x + 0.03);
    const before = world(lever).x;
    lever.position.y = -lever.userData.travel;
    expect(lever.userData.travel).toBeGreaterThanOrEqual(0.08);
    lever.parent.updateMatrixWorld(true);
    expect(world(lever).x).toBeGreaterThan(before + 0.08);
    lever.position.y = 0;
    const bars = kids.model.getObjectByName('handlebars');
    bars.updateMatrixWorld(true);
    const dash = new THREE.Box3().setFromObject(bars.getObjectByName('dash'));
    expect(new THREE.Box3().setFromObject(bars.getObjectByName('clampBlock')).expandByScalar(0.004).intersectsBox(dash), 'the key meets the clamp').toBe(true);
  });

  it('has a thumb throttle that moves with the throttle', async () => {
    const paddle = kids.model.getObjectByName('thumbThrottle');
    const { poseThumbThrottle } = await import('../src/vehicle/foremanControls.js');
    poseThumbThrottle(kids.model, 0);
    const rest = paddle.rotation.x;
    poseThumbThrottle(kids.model, 1);
    expect(paddle.rotation.x).toBeGreaterThan(rest + 0.3);
    poseThumbThrottle(kids.model, 0);
  });
});
