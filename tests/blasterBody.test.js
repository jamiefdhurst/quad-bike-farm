import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { BLASTER_FENDERS, BLASTER_NOSE, BLASTER_TAIL, BLASTER_FOOTREST, BLASTER_BUMPER, BLASTER_CARB, BLASTER_TAP, BLASTER_THROTTLE, TYRE_OUTER, BLASTER_WHEELS } from '../src/vehicle/blasterBody.js';
import { WHEELS } from '../src/vehicle/quadPhysics.js';
import { QUAD_SPECS, EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';
import { BODY_STYLES } from '../src/vehicle/quadModel.js';
import { CHOKE_STYLES, TAP_STYLES, chokeReach } from '../src/vehicle/controls.js';
import { MAKER_FOR } from '../src/vehicle/detail/decals.js';
import { measureModel, proportionErrors, REAL_SIZES } from '../src/vehicle/detail/realSizes.js';
import { buildAllModels } from './helpers/vehicleModels.js';

// The yellow quad as a Blaster-style sport quad (TODO 91): small plastics inside the tyres' edges, an open engine bay with the choke
// plunger and the fuel tap at the side of the carb, and a key-only dash.

describe('the Blaster body numbers', () => {
  it('match the game’s wheel layout and tyre widths', () => {
    expect(BLASTER_WHEELS.x).toBe(WHEELS[0].x);
    expect(BLASTER_WHEELS.zFront).toBe(WHEELS[0].z);
    expect(BLASTER_WHEELS.zRear).toBe(WHEELS[2].z);
  });

  it('keeps every panel inside the tyre beside it, so the wheels are the edge of the quad', () => {
    expect(BLASTER_FENDERS.front.width[1]).toBeLessThan(TYRE_OUTER.front);
    expect(BLASTER_FENDERS.rear.width[1]).toBeLessThan(TYRE_OUTER.rear);
  });

  it('stops the fenders near the tyres’ ends, so the front of the front tyre and the back of the rear one show', () => {
    const front = BLASTER_FENDERS.front.profile;
    const rear = BLASTER_FENDERS.rear.profile;
    expect(BLASTER_WHEELS.zFront + front[0][0]).toBeLessThan(BLASTER_WHEELS.zFront + BLASTER_WHEELS.radius + 0.06);
    expect(BLASTER_WHEELS.zRear + rear[rear.length - 1][0]).toBeGreaterThan(BLASTER_WHEELS.zRear - BLASTER_WHEELS.radius - 0.1);
  });

  it('leaves the engine bay open between the fenders, a long gap that the carb sits inside', () => {
    const frontEnd = BLASTER_WHEELS.zFront + BLASTER_FENDERS.front.profile.at(-1)[0];
    const rearStart = BLASTER_WHEELS.zRear + BLASTER_FENDERS.rear.profile[0][0];
    expect(frontEnd - rearStart).toBeGreaterThan(0.5);
    for (const z of [BLASTER_CARB.z - BLASTER_CARB.len / 2, BLASTER_CARB.z + BLASTER_CARB.len / 2]) {
      expect(z).toBeGreaterThan(rearStart);
      expect(z).toBeLessThan(frontEnd);
    }
  });

  it('joins the nose to the front fenders: it is as wide as their inner edges where they overlap in z', () => {
    const fenderZ0 = BLASTER_WHEELS.zFront + BLASTER_FENDERS.front.profile.at(-1)[0];
    const row = BLASTER_NOSE.find((n) => n.z > fenderZ0 + 0.3 && n.w / 2 >= BLASTER_FENDERS.front.width[0] - 0.01);
    expect(row).toBeTruthy();
  });

  it('fills the gap between the rear fenders with the tail', () => {
    const widest = Math.max(...BLASTER_TAIL.map((t) => t.w));
    expect(widest / 2).toBeGreaterThanOrEqual(BLASTER_FENDERS.rear.width[0] - 0.01);
  });

  it('puts each footrest on the lower frame rail and the bumper’s ends on the cradle', () => {
    expect(BLASTER_FOOTREST.x0).toBe(BLASTER_FOOTREST.rail.x);
    expect(Math.abs(BLASTER_FOOTREST.y - BLASTER_FOOTREST.rail.y)).toBeLessThan(0.03);
    // the pegs' fixed point (x 0.29, z -0.06) is on the plate
    expect(BLASTER_FOOTREST.x0).toBeLessThan(0.29);
    expect(BLASTER_FOOTREST.x1).toBeGreaterThan(0.29);
    expect(BLASTER_FOOTREST.z0).toBeLessThan(-0.06);
    expect(BLASTER_FOOTREST.z1).toBeGreaterThan(-0.06);
    expect(BLASTER_BUMPER.rail).toEqual({ x: 0.19, y: 0.36, z: 0.92 }); // buildFrame's lower rail corner
  });

  it('runs the throttle cable from the column to the carb’s cap', () => {
    const end = BLASTER_THROTTLE.at(-1);
    expect(end[0]).toBe(BLASTER_CARB.x);
    expect(end[2]).toBe(BLASTER_CARB.z);
    expect(end[1]).toBeGreaterThan(BLASTER_CARB.capY);
    expect(BLASTER_THROTTLE[0][0]).toBeLessThan(0); // down the right of the tank
  });

  it('puts the choke plunger on the carb’s left and the tap on the left too', () => {
    expect(BLASTER_CARB.plunger.x).toBeGreaterThan(BLASTER_CARB.r);
    expect(BLASTER_TAP.pos[0]).toBeGreaterThan(0);
  });
});

describe('the yellow quad’s spec', () => {
  const yellow = QUAD_SPECS.find((s) => s.id === 'yellow');

  it('names a body style, a choke and a tap that exist, with a Tamura badge', () => {
    expect(BODY_STYLES).toContain(yellow.style);
    expect(yellow.style).toBe('blaster');
    expect(CHOKE_STYLES).toContain(yellow.chokeStyle);
    expect(TAP_STYLES).toContain(yellow.tapStyle);
    expect(MAKER_FOR.yellow).toBe('tamura');
  });

  it('has its choke on the carb: reached only all but stopped, and it takes a hand off the bars', () => {
    expect(yellow.chokeStyle).toBe('plunger');
    expect(chokeReach('plunger', 0.2).ok).toBe(true);
    expect(chokeReach('plunger', 0.2).steer).toBeLessThan(1);
    expect(chokeReach('plunger', 5).ok).toBe(false);
  });

  it('leaves the kids’ quad on the old sport body', () => {
    expect([...QUAD_SPECS, ...EXTRA_SPECS].find((s) => s.id === 'kids').style).toBe('sport');
  });
});

describe('the yellow quad’s model', () => {
  let yellow;
  const world = (o) => o.getWorldPosition(new THREE.Vector3());
  beforeAll(async () => {
    yellow = (await buildAllModels()).find((v) => v.id === 'yellow');
  });

  it('has the parts the game looks for and the new ones by name', () => {
    for (const n of ['chokeLever', 'chokeKnob', 'fuelTap', 'fuelTapBody', 'carb', 'intakeBoot', 'airbox', 'fuelHose', 'throttleCable', 'throttleCableLower', 'headlight', 'nose', 'tail', 'footPlate', 'pegLeft', 'pegRight', 'seat', 'pillionSeat', 'badge']) {
      expect(yellow.model.getObjectByName(n), n).toBeTruthy();
    }
  });

  it('has no number plate: the old sport nose’s round plate and its backing are gone', () => {
    yellow.model.traverse((o) => {
      if (o.isMesh && o.geometry.type === 'CircleGeometry') expect(o.geometry.parameters.radius, 'a plate-sized disc').not.toBeCloseTo(0.11, 2);
    });
  });

  it('keeps the wheels the widest thing: no fender reaches the tyre’s outer edge', () => {
    for (const [tag, outer] of [['fl', TYRE_OUTER.front], ['fr', TYRE_OUTER.front], ['rl', TYRE_OUTER.rear], ['rr', TYRE_OUTER.rear]]) {
      const box = new THREE.Box3().setFromObject(yellow.model.getObjectByName(`fender_${tag}`));
      expect(Math.max(Math.abs(box.min.x), Math.abs(box.max.x)), tag).toBeLessThan(outer);
    }
  });

  it('has the choke knob on the carb’s left, pulling out along x, and the tap beside it', () => {
    const lever = yellow.model.getObjectByName('chokeLever');
    const carb = world(yellow.model.getObjectByName('carb'));
    const at = world(lever);
    expect(at.x).toBeGreaterThan(carb.x + BLASTER_CARB.r);
    expect(Math.abs(at.y - carb.y)).toBeLessThan(0.03);
    expect(Math.abs(at.z - carb.z)).toBeLessThan(0.05);
    expect(lever.userData.baseY).toBe(0);
    // the game pulls it by moving its y down (quad.js): that must go outwards
    const before = world(lever).x;
    lever.position.y = -0.045;
    lever.parent.updateMatrixWorld(true);
    expect(world(lever).x).toBeGreaterThan(before + 0.04);
    lever.position.y = 0;
    const tap = world(yellow.model.getObjectByName('fuelTap'));
    expect(tap.x).toBeGreaterThan(0.1);
    expect(Math.hypot(tap.x - carb.x, tap.z - carb.z)).toBeLessThan(0.3);
  });

  it('has the tap on the tank’s lower edge, not floating', () => {
    const tank = new THREE.Box3().setFromObject(yellow.model.getObjectByName('tank'));
    const body = new THREE.Box3().setFromObject(yellow.model.getObjectByName('fuelTapBody'));
    expect(body.intersectsBox(tank)).toBe(true);
  });

  it('is within 8% of the real Blaster’s length and height, and the tyre', () => {
    const e = proportionErrors(measureModel(yellow.model, yellow.layout), REAL_SIZES.yellow);
    for (const k of ['length', 'height', 'tyre']) expect(Math.abs(e[k]), k).toBeLessThan(0.08);
  });
});
