import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { BLASTER_FENDERS, BLASTER_NOSE, BLASTER_TAIL, BLASTER_FOOTREST, BLASTER_BUMPER, BLASTER_CARB, BLASTER_TAP, BLASTER_THROTTLE, BLASTER_SECTION, BLASTER_EXHAUST, BLASTER_VBARS, BLASTER_LAMP, barAt, blasterCross, TYRE_OUTER, BLASTER_WHEELS } from '../src/vehicle/blasterBody.js';
import { WHEELS } from '../src/vehicle/quadPhysics.js';
import { shellGeometry } from '../src/vehicle/quadGeometry.js';
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

  it('keeps every fender surface clear of the tyre under it: no wheel pokes through a wing (4 cm to spare for the tread and a little travel)', () => {
    for (const [which, wheelWidth] of [['front', BLASTER_WHEELS.front], ['rear', BLASTER_WHEELS.rear]]) {
      const F = BLASTER_FENDERS[which];
      const p = shellGeometry(F.profile, BLASTER_SECTION, F.width[0], F.width[1], { samples: 48 }).attributes.position;
      let min = Infinity;
      for (let i = 0; i < p.count; i++) {
        const [x, y, z] = [p.getX(i), p.getY(i), p.getZ(i)];
        if (y <= 0 || x < BLASTER_WHEELS.x - wheelWidth / 2 || x > BLASTER_WHEELS.x + wheelWidth / 2) continue;
        min = Math.min(min, Math.hypot(y, z) - BLASTER_WHEELS.radius);
      }
      expect(min, `${which} fender clearance over its tyre`).toBeGreaterThan(0.03);
    }
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

describe('the Blaster exhaust', () => {
  const E = BLASTER_EXHAUST;
  const rear = BLASTER_FENDERS.rear;
  // The wing's top at a z, from its profile (z is relative to the wheel): the pipe has to pass under it, not through it.
  const wingTop = (z) => {
    const p = rear.profile;
    const rz = z - BLASTER_WHEELS.zRear;
    for (let i = 0; i < p.length - 1; i++) if (rz <= p[i][0] && rz >= p[i + 1][0]) return BLASTER_WHEELS.y + p[i][1] + ((p[i + 1][1] - p[i][1]) * (p[i][0] - rz)) / (p[i][0] - p[i + 1][0]);
    return null;
  };

  it('passes under the wing wherever it is beneath it, and the can is inboard of the wing’s inner edge', () => {
    for (const [x, y, z] of E.path) {
      const top = wingTop(z);
      if (top !== null && Math.abs(x) > rear.width[0]) expect(y + 0.07, `pipe at z ${z} is under the wing`).toBeLessThan(top - 0.12);
    }
    expect(Math.abs(E.can.x) + 0.05).toBeLessThan(rear.width[0]);
  });

  it('keeps the can under the tail and clear of the tail’s cross-tube at z -0.93, and passes below the side plate', () => {
    expect(E.can.y + 0.05 + Math.sin(E.can.tilt) * E.can.length / 2).toBeLessThan(BLASTER_TAIL[0].y0);
    expect(E.tip[2] - 0.03).toBeGreaterThan(-0.93);
    for (const [x, y, z] of E.path) if (Math.abs(x) > 0.15 && Math.abs(x) < 0.24 && z < -0.24 && z > -0.6) expect(y + 0.03, `pipe at z ${z} under the plate`).toBeLessThan(0.54);
  });
});

describe('the Blaster bars', () => {
  const V = BLASTER_VBARS;

  it('run level across the middle then rise steeply (over 40 degrees) to the grips’ fixed point, which does not move', () => {
    expect(V.grip).toEqual([0.318, 0.0675, -0.042]);
    expect(barAt(0).y).toBe(V.centreY);
    expect(barAt(V.run).y).toBe(V.centreY);
    expect(barAt(V.grip[0]).y).toBeCloseTo(V.grip[1], 6);
    const rise = Math.atan2(V.grip[1] - V.centreY, V.grip[0] - V.run);
    expect(rise).toBeGreaterThan((40 * Math.PI) / 180);
  });

  it('join the arms with a level crossbar that is no higher than the arms’ own rise, and put the perch outboard of it', () => {
    const c = blasterCross();
    expect(c.y).toBeLessThan(V.grip[1]); // no hoop over the V
    expect(c.y).toBeGreaterThan(V.centreY);
    expect(V.perchX).toBeGreaterThan(V.crossX + 0.02);
    expect(V.perchX).toBeLessThan(V.grip[0]);
  });

  it('keep the lamp straight on the bars’ middle, in front of the clamp, low and close', () => {
    expect(BLASTER_LAMP.z - BLASTER_LAMP.d / 2).toBeLessThan(0.02);
    expect(BLASTER_LAMP.z - BLASTER_LAMP.d / 2).toBeGreaterThan(-0.02);
    expect(BLASTER_LAMP.y + BLASTER_LAMP.h / 2).toBeLessThan(0.05); // no higher than the arms at the grips, so it never stands up out of the bars
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

  it('has a plain on / off lights switch on P, and its pull-start is on O now (P is the lights on every other vehicle)', async () => {
    expect(yellow.barLights).toBe('switch');
    const { RADIAL_ITEMS } = await import('../src/input/gamepad.js');
    expect(RADIAL_ITEMS.find((i) => i.label === 'Pull-start').key).toBe('KeyO');
    expect(RADIAL_ITEMS.find((i) => i.label === 'Lights').key).toBe('KeyP');
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

  it('has the lamp straight on the handlebars, the key in a small pod on the clamp block (no stalk), a level crossbar and a cable each side', () => {
    const bars = yellow.model.getObjectByName('handlebars');
    expect(bars.getObjectByName('headlight'), 'the headlight steers with the bars').toBeTruthy();
    expect(yellow.model.getObjectByName('nose').getObjectByName('headlight')).toBeFalsy();
    for (const n of ['headlightHousing', 'lampMount', 'clampBlock', 'crossbar', 'brakeCable', 'throttleCable']) expect(bars.getObjectByName(n), n).toBeTruthy();
    expect(bars.getObjectByName('barPad'), 'no pad on the crossbar').toBeFalsy();
    expect(yellow.model.getObjectByName('brakeCableLower')).toBeTruthy();
    bars.updateMatrixWorld(true);
    const box = (n) => new THREE.Box3().setFromObject(bars.getObjectByName(n));
    // the key's housing sits on the clamp block: they overlap or touch, and the housing is nowhere near 10 cm above it
    const dash = new THREE.Box3().setFromObject(bars.getObjectByName('dash'));
    expect(box('clampBlock').expandByScalar(0.004).intersectsBox(dash), 'the key pod meets the clamp block').toBe(true);
    expect(dash.max.y - box('clampBlock').max.y).toBeLessThan(0.045);
    // the crossbar is level, no higher than the grips, and the lamp is on the clamp's mount
    const cross = box('crossbar');
    expect(cross.max.y - cross.min.y).toBeLessThan(0.03);
    expect(cross.max.y - bars.position.y, 'the crossbar is no higher than the grips').toBeLessThan(BLASTER_VBARS.grip[1]);
    expect(box('lampMount').expandByScalar(0.004).intersectsBox(box('headlightHousing'))).toBe(true);
    expect(box('lampMount').expandByScalar(0.004).intersectsBox(box('clampBlock'))).toBe(true);
  });

  it('has a lights rocker on the left bar that a plain switch can pose, with no stop rocker or start button', async () => {
    const rocker = yellow.model.getObjectByName('lightsRocker');
    expect(rocker).toBeTruthy();
    expect(yellow.model.getObjectByName('stopRocker')).toBeFalsy();
    const { poseBarPod, POD } = await import('../src/vehicle/foremanControls.js');
    poseBarPod(yellow.model, { lights: 'off' });
    expect(rocker.rotation.x).toBeCloseTo(-POD.rock, 6);
    poseBarPod(yellow.model, { lights: 'low' });
    expect(rocker.rotation.x).toBeCloseTo(POD.rock, 6);
    expect(rocker.position.x).toBeGreaterThan(0); // on the left
    expect(new THREE.Box3().setFromObject(yellow.model.getObjectByName('lightsSwitchHousing')).intersectsBox(new THREE.Box3().setFromObject(yellow.model.getObjectByName('clampBlock')).expandByScalar(0.1))).toBe(true);
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
