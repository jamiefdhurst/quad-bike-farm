import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { archPanel, buildLandRoverModel, poseLandyControls, gearLeverPose, LANDY_LAYOUT, LANDY_BELTS, TUB_FLOOR } from '../src/vehicle/landRoverModel.js';
import { poseUtvBelts } from '../src/vehicle/utvModel.js';
import { LAND_ROVER_SPEC, DEFENDER_SPEC } from '../src/vehicle/quadSpecs.js';
import { ManualDrivetrain, DEFAULT_GEARBOX_PARAMS } from '../src/vehicle/manualDrivetrain.js';
import { DASH_STYLES } from '../src/vehicle/dash.js';

// A canvas that accepts every drawing call and does nothing, so the model (whose dash and trim are drawn on canvases) builds in node.
function fakeCanvas() {
  const ctx = new Proxy({ canvas: null }, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => ((t[k] = v), true) });
  return { width: 0, height: 0, getContext: () => ctx, style: {} };
}

describe('Land Rover wheel arches', () => {
  const wheel = LANDY_LAYOUT.wheels[0];
  const centreY = wheel.radius + 0.2; // tyre radius plus the suspension's rest length: the wheel's height above the ground
  const make = (x, yBottom, yTop, z0, z1, zc) => {
    const g = new THREE.Group();
    archPanel(x, 0.04, yBottom, yTop, z0, z1, zc, new THREE.MeshBasicMaterial(), g);
    const geo = g.children[0].geometry;
    geo.computeBoundingBox();
    return geo;
  };

  it('is a panel of the size asked for, centred on x', () => {
    const b = make(0.82, 0.78, 1.28, -1.95, -0.65, -1.115).boundingBox;
    expect(b.min.x).toBeCloseTo(0.8, 5);
    expect(b.max.x).toBeCloseTo(0.84, 5);
    expect(b.min.y).toBeCloseTo(0.78, 5);
    expect(b.max.y).toBeCloseTo(1.28, 5);
    expect(b.min.z).toBeCloseTo(-1.95, 5);
    expect(b.max.z).toBeCloseTo(-0.65, 5);
  });

  it('keeps every part of the panel outside the tyre, so the wheel shows through the arch', () => {
    for (const [yBottom, z0, z1, zc] of [[0.78, -1.95, -0.65, -1.115], [0.75, 0.7, 1.6, 1.115]]) {
      const pos = make(0.82, yBottom, 1.38, z0, z1, zc).attributes.position;
      for (let i = 0; i < pos.count; i++) {
        expect(Math.hypot(pos.getZ(i) - zc, pos.getY(i) - centreY)).toBeGreaterThan(wheel.radius + 0.02);
      }
    }
  });
});

describe('Land Rover model', () => {
  let model;
  beforeAll(() => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    model = buildLandRoverModel({});
    model.updateMatrixWorld(true);
  });

  const box = (name) => new THREE.Box3().setFromObject(model.getObjectByName(name));

  it('has the parts the rest of the game looks for', () => {
    for (const n of ['bodyRoot', 'riderAnchor', 'seatMid', 'seatLeft', 'towHitch', 'crankHole', 'cameraAnchor', 'parkBrakeLever', 'chokeKnob', 'handThrottleKnob', 'gearLever']) {
      expect(model.getObjectByName(n), n).toBeTruthy();
    }
  });

  it('has a belt for each seat, stowed or worn, that the UTV\'s pose code can switch', () => {
    for (const seat of Object.keys(LANDY_BELTS)) expect(model.getObjectByName(`belt_${seat}`).getObjectByName('worn')).toBeTruthy();
    poseUtvBelts(model, { driver: true, mid: false, left: true });
    expect(model.getObjectByName('belt_driver').getObjectByName('worn').visible).toBe(true);
    expect(model.getObjectByName('belt_mid').getObjectByName('worn').visible).toBe(false);
    expect(model.getObjectByName('belt_mid').getObjectByName('stowed').visible).toBe(true);
  });

  it('puts the tub floor above the wheels, so no tyre pokes through it', () => {
    expect(LANDY_LAYOUT.wheels[2].radius + 0.2 + 0.38).toBeLessThan(TUB_FLOOR);
  });

  it('pulls the choke and hand throttle knobs out on shafts that stay in the dash, and lifts the handbrake', () => {
    const lever = model.getObjectByName('parkBrakeLever');
    const off = lever.rotation.x;
    for (let i = 0; i < 40; i++) poseLandyControls(model, { choke: 1, hand: 1, park: true });
    expect(lever.rotation.x).toBeLessThan(off - 1);
    const knob = model.getObjectByName('chokeKnob');
    expect(knob.position.z).toBeCloseTo(0.4 - 0.1, 5);
    // Fully out, the shaft's back end is still well inside the dash (the shelf's face is at z 0.4), so it never floats free.
    knob.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(knob).max.z).toBeGreaterThan(0.4 + 0.05);
  });
});

describe('the gear lever\'s H', () => {
  // Top is forward (a positive lean about x); the driver's left is +x, which is a negative lean about z.
  const g = (n) => gearLeverPose(n);
  it('puts first top-left, second below it, third top-right and fourth below that', () => {
    expect(g(1).along).toBeGreaterThan(0);
    expect(g(2).along).toBeLessThan(0);
    expect(g(3).along).toBeGreaterThan(0);
    expect(g(4).along).toBeLessThan(0);
    expect(g(1).across).toBe(g(2).across);
    expect(g(3).across).toBe(g(4).across);
    expect(g(1).across).toBeLessThan(g(3).across); // the left column is further left
  });
  it('puts reverse top-left of first, and neutral in the middle', () => {
    expect(g(-1).along).toBe(g(1).along);
    expect(g(-1).across).toBeLessThan(g(1).across);
    expect(g(0)).toEqual({ along: 0, across: 0 });
  });
  it('really moves the lever the way the maths says (left is +x for the driver)', () => {
    const lever = new THREE.Object3D();
    const tip = (gear) => {
      lever.rotation.set(gearLeverPose(gear).along, 0, gearLeverPose(gear).across);
      lever.updateMatrixWorld(true);
      return new THREE.Vector3(0, 1, 0).applyMatrix4(lever.matrixWorld);
    };
    expect(tip(1).x).toBeGreaterThan(tip(3).x); // first is on the driver's left
    expect(tip(1).z).toBeGreaterThan(tip(2).z); // and further forward than second
    expect(tip(-1).x).toBeGreaterThan(tip(1).x);
  });
});

describe('the 200TDi', () => {
  let series;
  let defender;
  beforeAll(() => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    series = buildLandRoverModel({ variant: 'series' });
    defender = buildLandRoverModel({ variant: 'defender', dashStyle: 'defender' });
    for (const m of [series, defender]) m.updateMatrixWorld(true);
  });

  it('is a square back with a rear door, and keeps the Series\' tailgate and starting handle hole to the Series', () => {
    expect(defender.getObjectByName('rearDoor')).toBeTruthy();
    expect(defender.getObjectByName('tailgate')).toBeFalsy();
    expect(series.getObjectByName('tailgate')).toBeTruthy();
    expect(series.getObjectByName('crankHole')).toBeTruthy();
    expect(defender.getObjectByName('crankHole')).toBeFalsy();
  });

  it('has everything the controls code looks up by name, including hidden knobs for the choke it hasn\'t got', () => {
    for (const n of ['gearLever', 'transferKnob', 'diffLockKnob', 'parkBrakeLever', 'chokeKnob', 'handThrottleKnob', 'riderAnchor', 'seatMid', 'seatLeft', 'towHitch', 'exhaustTip']) {
      expect(defender.getObjectByName(n), n).toBeTruthy();
    }
    expect(defender.getObjectByName('chokeKnob').visible).toBe(false);
    poseLandyControls(defender, { gear: 3, park: true, choke: 1, hand: 1 }); // must not throw
    for (const seat of Object.keys(LANDY_BELTS)) expect(defender.getObjectByName(`belt_${seat}`)).toBeTruthy();
  });

  it('carries the spare on the back door, behind the body, and not on the bonnet', () => {
    const box = new THREE.Box3().setFromObject(defender);
    expect(box.min.z).toBeLessThan(-2.1); // the spare sticks out past the rear panel (at -1.97)
    const sBox = new THREE.Box3().setFromObject(series);
    expect(sBox.min.z).toBeGreaterThan(-2.1);
  });

  it('has a spec the game can build: a dash that exists, a diesel with a clutch, synchromesh and no handle', () => {
    expect(DASH_STYLES).toContain(DEFENDER_SPEC.dashStyle);
    expect(DEFENDER_SPEC.landRover).toBe(true);
    expect(DEFENDER_SPEC.engine.compressionIgnition).toBe(true);
    expect(DEFENDER_SPEC.engine.crankHandle).toBeFalsy();
    expect(DEFENDER_SPEC.manual).toBe(true);
    expect(DEFENDER_SPEC.gearbox.crashGears).toBe(0);
    expect(LAND_ROVER_SPEC.gearbox.crashGears).toBeGreaterThan(0);
    expect(DEFENDER_SPEC.id).not.toBe(LAND_ROVER_SPEC.id);
    expect(DEFENDER_SPEC.engine.idleRpmWarm).not.toBe(LAND_ROVER_SPEC.engine.idleRpmWarm);
  });
});

describe('the 200TDi\'s five-speed', () => {
  const g5 = (n) => gearLeverPose(n, 5);
  it('has an H with first and second on the left, third and fourth in the middle, fifth top right and reverse below it', () => {
    expect(g5(1).along).toBeGreaterThan(0);
    expect(g5(2).along).toBeLessThan(0);
    expect(g5(1).across).toBe(g5(2).across);
    expect(g5(3).across).toBe(g5(4).across);
    expect(g5(1).across).toBeLessThan(g5(3).across);
    expect(g5(3).across).toBeLessThan(g5(5).across);
    expect(g5(5).along).toBeGreaterThan(0);
    expect(g5(-1).across).toBe(g5(5).across);
    expect(g5(-1).along).toBeLessThan(0);
    expect(g5(0)).toEqual({ along: 0, across: 0 });
  });
  it('is faster than the Series: five gears climbing evenly to a higher top speed, which the car can reach', () => {
    const b = { ...DEFAULT_GEARBOX_PARAMS, ...DEFENDER_SPEC.gearbox };
    expect(b.gears).toBe(5);
    const tops = [b.topSpeed1, b.topSpeed2, b.topSpeed3, b.topSpeed4, b.topSpeed5];
    for (let i = 1; i < 5; i++) expect(tops[i]).toBeGreaterThan(tops[i - 1] * 1.3);
    expect(b.topSpeed5).toBeGreaterThan(LAND_ROVER_SPEC.gearbox.topSpeed4);
    expect(DEFENDER_SPEC.vehicle.maxSpeed).toBeGreaterThanOrEqual(b.topSpeed5);
    const torques = [b.torque1, b.torque2, b.torque3, b.torque4, b.torque5];
    for (let i = 1; i < 5; i++) expect(torques[i]).toBeLessThan(torques[i - 1]);
  });
  it('takes fifth gear', () => {
    const d = new ManualDrivetrain({ maxSpeed: 32, maxReverseSpeed: 2.6 }, { ...DEFAULT_GEARBOX_PARAMS, ...DEFENDER_SPEC.gearbox });
    d.pedalDown = 1; // the clutch has been down long enough for a clean change
    d.pedal = 1;
    expect(d.select(5, true)).toBe('ok');
    expect(d.gear).toBe(5);
    expect(d.topSpeed(5)).toBe(32);
    const four = new ManualDrivetrain({ maxSpeed: 24 }, { ...DEFAULT_GEARBOX_PARAMS, ...LAND_ROVER_SPEC.gearbox });
    four.pedalDown = 1;
    four.pedal = 1;
    expect(four.select(5, true)).toBe('same'); // the Series has no fifth
  });
});
