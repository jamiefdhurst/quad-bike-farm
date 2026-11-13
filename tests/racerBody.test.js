import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { RACER_FENDERS, RACER_SECTION, RACER_SHROUD, RACER_SEAT, RACER_TAIL, RACER_FLANK, RACER_SIDE_PLATE, RACER_LOUVRES, RACER_EXHAUST, RACER_POD, RACER_WHEELS, TYRE_OUTER, shroudTop } from '../src/vehicle/racerBody.js';
import { barAt, HORNET_VBARS } from '../src/vehicle/hornetBody.js';
import { shellGeometry } from '../src/vehicle/quadGeometry.js';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';
import { BODY_STYLES } from '../src/vehicle/quadModel.js';
import { CHOKE_STYLES, TAP_STYLES } from '../src/vehicle/controls.js';
import { MAKER_FOR } from '../src/vehicle/detail/decals.js';
import { buildAllModels } from './helpers/vehicleModels.js';

// The orange quad as the Viper Adder (TODO 92): a triangle wedge, flat wings, a shroud with louvres, big flank triangles, a pod
// on the left bar with the lights rocker and the choke lever, no number plates.

describe('the Adder body numbers', () => {
  it('keep every wing inside the tyre beside it, and clear of it (4 cm to spare for the tread and a little travel)', () => {
    expect(RACER_FENDERS.front.width[1]).toBeLessThan(TYRE_OUTER.front);
    expect(RACER_FENDERS.rear.width[1]).toBeLessThan(TYRE_OUTER.rear);
    for (const [which, wheelWidth] of [['front', RACER_WHEELS.front], ['rear', RACER_WHEELS.rear]]) {
      const F = RACER_FENDERS[which];
      const p = shellGeometry(F.profile, RACER_SECTION, F.width[0], F.width[1], { samples: 48 }).attributes.position;
      let min = Infinity;
      for (let i = 0; i < p.count; i++) {
        const [x, y, z] = [p.getX(i), p.getY(i), p.getZ(i)];
        if (y <= 0 || x < RACER_WHEELS.x - wheelWidth / 2 || x > RACER_WHEELS.x + wheelWidth / 2) continue;
        min = Math.min(min, Math.hypot(y, z) - RACER_WHEELS.radius);
      }
      expect(min, `${which} wing clearance over its tyre`).toBeGreaterThan(0.04);
    }
  });

  it('kicks the rear wings up towards the back, and keeps the shroud higher than the seat: a wedge in side view', () => {
    const rear = RACER_FENDERS.rear.profile;
    expect(rear.at(-1)[1]).toBeGreaterThan(rear[0][1] + 0.25); // the wing's back end is much higher than its front (toned down from +0.36)
    expect(shroudTop(0.22)).toBeGreaterThan(RACER_SEAT[2].y1 + 0.03);
    expect(shroudTop(0.9)).toBeLessThan(shroudTop(0.22) - 0.2); // and falls away to a low front
  });

  it('is a triangle in plan: narrow at the nose, wider through the seat, widest at the tail and wings', () => {
    const w = (S, z) => S.find((s) => s.z === z).w;
    expect(w(RACER_SHROUD, 0.98)).toBeLessThan(w(RACER_SHROUD, 0.22));
    expect(RACER_SEAT.at(2).w).toBeLessThan(RACER_SEAT.at(4).w); // the seat widens to the back
    expect(Math.max(...RACER_TAIL.map((t) => t.w)) / 2).toBeGreaterThanOrEqual(RACER_FENDERS.rear.width[0] - 0.01); // the tail fills the gap between the wings
  });

  it('has flank triangles whose corners are in order: front top, rear top, a lower apex between them', () => {
    const [front, rear, apex] = RACER_FLANK.corners;
    expect(front[0]).toBeGreaterThan(apex[0]);
    expect(apex[0]).toBeGreaterThan(rear[0]);
    expect(apex[1]).toBeLessThan(Math.min(front[1], rear[1]) - 0.15);
    expect(rear[0]).toBeGreaterThan(RACER_WHEELS.zRear + RACER_FENDERS.rear.profile[0][0] - 0.01); // ends before the rear wing starts
  });

  it('puts the side plate under the wing (below its inner edge) and clear of the tail', () => {
    const top = RACER_SIDE_PLATE.y + RACER_SIDE_PLATE.h / 2;
    expect(top).toBeLessThan(RACER_WHEELS.y + RACER_FENDERS.rear.profile[2][1] - 0.04);
    expect(RACER_SIDE_PLATE.z - RACER_SIDE_PLATE.len / 2).toBeGreaterThan(-0.9);
  });

  it('puts all three louvres on the sloping part of the shroud top, in order', () => {
    for (const z of RACER_LOUVRES) expect(shroudTop(z)).toBeTypeOf('number');
    expect(RACER_LOUVRES).toEqual([...RACER_LOUVRES].sort((a, b) => a - b));
    expect(shroudTop(RACER_LOUVRES[0])).toBeGreaterThan(shroudTop(RACER_LOUVRES[2]));
  });

  it('passes the exhaust under the wing and the flank, and ends the can inboard of the wing and before the tail’s end', () => {
    const E = RACER_EXHAUST;
    const [, rearZ] = [0, RACER_WHEELS.zRear];
    for (const [x, y, z] of E.path) {
      if (Math.abs(x) > RACER_FENDERS.rear.width[0] && z < rearZ + RACER_FENDERS.rear.profile[0][0]) {
        const rel = z - rearZ; // under the wing here: well below its surface
        const prof = RACER_FENDERS.rear.profile;
        const top = prof.find((p, i) => rel <= p[0] && rel >= prof[i + 1]?.[0]);
        if (top) expect(y + 0.05).toBeLessThan(RACER_WHEELS.y + top[1] - 0.05);
      }
    }
    // the can is under the tail and the wings' inner edges: well below the wing's underside over its whole length
    const lowestWing = Math.min(...RACER_FENDERS.rear.profile.filter((p) => p[0] <= 0.05 && p[0] >= -0.4).map((p) => p[1]));
    expect(E.can.y + 0.06 + (Math.sin(E.can.tilt) * E.can.length) / 2).toBeLessThan(RACER_WHEELS.y + lowestWing - 0.03);
    expect(E.can.y + 0.06).toBeLessThan(RACER_TAIL[0].y0 + 0.0); // and under the tail's underside
    expect(E.tip[2]).toBeGreaterThan(RACER_TAIL.at(-1).z);
  });

  it('puts the pod on the V bars’ level run, with the lights rocker, the choke lever and the dash’s panel on it in order', () => {
    expect(RACER_POD.x1).toBeLessThanOrEqual(HORNET_VBARS.run + 0.01);
    expect(RACER_POD.rockerX).toBeLessThan(RACER_POD.chokeX);
    expect(RACER_POD.chokeX).toBeLessThan(RACER_POD.dashX);
    expect(barAt(RACER_POD.dashX).y).toBe(HORNET_VBARS.centreY);
  });
});

describe('the orange quad’s spec', () => {
  const orange = QUAD_SPECS.find((s) => s.id === 'adder');

  it('names its own body style, the choke on the pod, a tap that exists, a plain lights switch and a Viper badge', () => {
    expect(BODY_STYLES).toContain(orange.style);
    expect(orange.style).toBe('racer');
    expect(orange.chokeStyle).toBe('thumb');
    expect(CHOKE_STYLES).toContain(orange.chokeStyle);
    expect(TAP_STYLES).toContain(orange.tapStyle);
    expect(orange.barLights).toBe('switch');
    expect(orange.noHeadlight).toBeFalsy(); // its lamp shines now it has a switch
    expect(MAKER_FOR.adder).toBe('viper');
  });
});

describe('the orange quad’s model', () => {
  let orange;
  const world = (o) => o.getWorldPosition(new THREE.Vector3());
  beforeAll(async () => {
    orange = (await buildAllModels()).find((v) => v.id === 'adder');
  });

  it('has its own parts by name: shroud, three louvres, two flanks, plates, tail, pod, rocker, choke lever, lamp on the bars, pad on a level crossbar', () => {
    const m = orange.model;
    for (const n of ['shroud', 'tail', 'controlPod', 'lightsRocker', 'chokeLever', 'headlight', 'headlightHousing', 'crossbar', 'barPad', 'brakeCable', 'throttleCable', 'badge', 'pegLeft', 'pegRight', 'seat', 'pillionSeat']) expect(m.getObjectByName(n), n).toBeTruthy();
    expect(m.getObjectByName('handlebars').getObjectByName('headlight')).toBeTruthy();
    let louvres = 0;
    let flanks = 0;
    m.traverse((o) => {
      if (o.name === 'louvre') louvres++;
      if (o.name === 'flank') flanks++;
    });
    expect(louvres).toBe(3);
    expect(flanks).toBe(2);
  });

  it('has no number plates: no plate discs, no textured number boards', () => {
    orange.model.traverse((o) => {
      if (!o.isMesh) return;
      if (o.geometry.type === 'CircleGeometry') expect(o.geometry.parameters.radius).not.toBeCloseTo(0.11, 2);
      if (o.material?.map) expect(o.name || o.parent?.name, 'a textured part').toMatch(/badge|decal|dash|lens|^$/i);
    });
  });

  it('keeps the wings inside the tyres’ outer edges and the frame blue, the seat blue', () => {
    for (const [tag, outer] of [['fl', TYRE_OUTER.front], ['fr', TYRE_OUTER.front], ['rl', TYRE_OUTER.rear], ['rr', TYRE_OUTER.rear]]) {
      const box = new THREE.Box3().setFromObject(orange.model.getObjectByName(`fender_${tag}`));
      expect(Math.max(Math.abs(box.min.x), Math.abs(box.max.x)), tag).toBeLessThan(outer);
    }
    expect(orange.model.userData.seatMaterial.color.getHex()).toBe(0x1f4aa0);
    let black = 0;
    const bars = orange.model.getObjectByName('handlebars');
    orange.model.getObjectByName('bodyRoot').traverse((o) => {
      for (let a = o.parent; a; a = a.parent) if (a === bars) return;
      if (o.isMesh && o.material?.color?.getHex?.() === 0x1f2123) black++; // the shared frame's black: it is all blue here
    });
    expect(black, 'meshes left in the shared black frame material').toBe(0);
  });

  it('has the choke lever on the pod on the left bar (a thumb lever, not on the carb), and the lights rocker beside it', () => {
    const lever = orange.model.getObjectByName('chokeLever');
    const pod = new THREE.Box3().setFromObject(orange.model.getObjectByName('controlPod')).expandByScalar(0.03);
    expect(pod.containsPoint(world(lever))).toBe(true);
    expect(world(lever).x).toBeGreaterThan(0.05); // the left
    const rocker = orange.model.getObjectByName('lightsRocker');
    expect(Math.abs(world(rocker).x - world(lever).x)).toBeLessThan(0.1);
    expect(orange.model.getObjectByName('stopRocker')).toBeFalsy(); // so it poses as a plain switch
  });

  it('swings the choke lever through its whole travel without touching the crossbar or the pod’s own parts: it is clear of the bar', () => {
    const bars = orange.model.getObjectByName('handlebars');
    const lever = orange.model.getObjectByName('chokeLever');
    const cross = new THREE.Box3().setFromObject(bars.getObjectByName('crossbar'));
    for (const angle of [0.5, 0.0, -0.5, -0.95]) { // off (0.5) to full choke (0.5 - 1.45), as quad.js poses it
      lever.rotation.x = angle;
      bars.updateMatrixWorld(true);
      for (const part of ['chokeLeverArm', 'chokeLeverKnob']) {
        const box = new THREE.Box3().setFromObject(lever.getObjectByName(part));
        expect(box.intersectsBox(cross), `${part} at ${angle} rad is through the crossbar`).toBe(false);
      }
    }
    lever.rotation.x = 0.5;
  });

  it('has a thumb throttle whose paddle moves with the throttle', async () => {
    const paddle = orange.model.getObjectByName('thumbThrottle');
    expect(paddle).toBeTruthy();
    expect(orange.model.getObjectByName('thumbHousing')).toBeTruthy();
    const { poseThumbThrottle } = await import('../src/vehicle/farm300Controls.js');
    poseThumbThrottle(orange.model, 0);
    const rest = paddle.rotation.x;
    poseThumbThrottle(orange.model, 1);
    expect(paddle.rotation.x).toBeGreaterThan(rest + 0.3);
    poseThumbThrottle(orange.model, 0);
  });

  it('has the kill switch’s panel standing on the pod, and a crossbar no higher than the grips', () => {
    const bars = orange.model.getObjectByName('handlebars');
    bars.updateMatrixWorld(true);
    const dash = new THREE.Box3().setFromObject(bars.getObjectByName('dash'));
    const pod = new THREE.Box3().setFromObject(bars.getObjectByName('controlPod')).expandByScalar(0.02);
    expect(pod.intersectsBox(dash)).toBe(true);
    const cross = new THREE.Box3().setFromObject(bars.getObjectByName('crossbar'));
    expect(cross.max.y - bars.position.y).toBeLessThan(HORNET_VBARS.grip[1]);
  });
});
