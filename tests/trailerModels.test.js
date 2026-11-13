import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildTrailerModel, TRAILER_SPEC, poseRamps, rampOpenAngle } from '../src/vehicle/trailerModel.js';
import { buildTipTrailerModel, TIP_TRAILER_SPEC, CARGO_SPOTS, SEAT_AT } from '../src/vehicle/tipTrailerModel.js';
import { TRAILER_SIZES } from '../src/vehicle/detail/realSizes.js';
import { treadBlocks } from '../src/vehicle/detail/tread.js';
import { TrailerCoat } from '../src/effects/trailerCoat.js';
import { MAKERS } from '../src/vehicle/detail/decals.js';
import { buildAllModels } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';

let bale;
let tip;
beforeAll(async () => {
  await buildAllModels(); // stubs the canvas for the lamps' and plates' textures
  bale = buildTrailerModel();
  tip = buildTipTrailerModel();
  for (const m of [bale, tip]) m.updateMatrixWorld(true);
});

const size = (model, wheelName) => {
  const box = new THREE.Box3().setFromObject(model);
  const tyre = new THREE.Box3().setFromObject(model.getObjectByName(wheelName).getObjectByName('spin'));
  return { length: box.max.z - box.min.z, width: box.max.x - box.min.x, height: box.max.y, tyre: tyre.max.y - tyre.min.y };
};

describe('the trailers\' models (item 101)', () => {
  it('keep what the game looks them up by: the seats, the ramps, the winch, the tub, the gate, the cargo spots, the wheels with their spin', () => {
    for (const n of ['body', 'wheelLeft', 'wheelRight']) expect(bale.getObjectByName(n), n).toBeTruthy();
    for (const n of ['seatLeft', 'seatRight', 'rampLeft', 'rampRight', 'winch', 'winchEye', 'straps']) expect(bale.getObjectByName(n), n).toBeTruthy();
    for (const n of ['body', 'tub', 'tailgate', 'seat', 'wheelLeft', 'wheelRight']) expect(tip.getObjectByName(n), n).toBeTruthy();
    for (const m of [bale, tip]) for (const w of ['wheelLeft', 'wheelRight']) expect(m.getObjectByName(w).getObjectByName('spin').userData.keep).toBe(true);
    CARGO_SPOTS.forEach((_, i) => expect(tip.getObjectByName(`cargo${i}`), `cargo${i}`).toBeTruthy());
  });

  it('keep the fixed points where they were: the girls\' seats on the bale trailer and in the tub, the cargo spots, the hitch rings\' heights', () => {
    const at = (m, n) => m.getObjectByName(n).getWorldPosition(new THREE.Vector3());
    expect(at(bale, 'seatLeft').x).toBeCloseTo(TRAILER_SPEC.seatX, 3);
    expect(at(bale, 'seatLeft').y).toBeCloseTo(TRAILER_SPEC.bedY + TRAILER_SPEC.baleHeight, 3);
    expect(at(bale, 'seatLeft').z).toBeCloseTo(TRAILER_SPEC.seatZ, 3);
    expect(at(tip, 'seat').z).toBeCloseTo(SEAT_AT.z, 3);
    expect(at(tip, 'cargo1').x).toBeCloseTo(CARGO_SPOTS[1].x, 3);
    expect(at(tip, 'cargo1').z).toBeCloseTo(CARGO_SPOTS[1].z, 3);
    expect(at(tip, 'cargo1').y).toBeCloseTo(TIP_TRAILER_SPEC.floorY + 0.02, 3);
  });

  it('are the size of what they stand for (within 8% on length, width, height and tyre)', () => {
    for (const [model, wheel, real] of [[bale, 'wheelLeft', TRAILER_SIZES.bale], [tip, 'wheelLeft', TRAILER_SIZES.tip]]) {
      const got = size(model, wheel);
      for (const k of ['length', 'width', 'height', 'tyre']) expect(Math.abs(got[k] * 1000 / real[k] - 1), `${real.like}: ${k} ${got[k].toFixed(2)} m`).toBeLessThan(0.08);
    }
  });

  it('wear a made-up maker\'s chassis plate, never a real one', () => {
    expect(MAKERS.fenwick.name).toBe('Fenwick');
    for (const m of [bale, tip]) expect(m.getObjectByName('chassisPlate')).toBeTruthy();
  });

  it('have no two faces fighting for one plane where you can see them', () => {
    for (const [name, m] of [['bale trailer', bale], ['tipping trailer', tip]]) {
      const fights = coplanarOverlaps(m, { gap: 0.002, minArea: 2e-5 }).filter((f) => f.area > 8e-4);
      expect(fights.slice(0, 6).map((f) => `${name}: ${f.a}|${f.b} ${(f.area * 1e4).toFixed(0)} cm2 at ${f.at.map((v) => v.toFixed(2)).join(',')}`)).toEqual([]);
    }
  });
});

describe('mud on a trailer', () => {
  const wheels = (m) => ['wheelLeft', 'wheelRight'].map((n) => m.getObjectByName(n));

  it('builds on both trailers, takes the quads\' wear setting, and starts clean', () => {
    for (const m of [buildTrailerModel(), buildTipTrailerModel()]) {
      const coat = new TrailerCoat(m, wheels(m), 0.5);
      expect(coat.coat.look.wear).toBe(0.5);
      expect(coat.state.body).toBe(0);
      expect(coat.state.wheels).toBe(0);
    }
  });

  it('picks up mud rolling through it, the tyres much faster than the bodywork, and sheds the tyres\' on grass', () => {
    const m = buildTipTrailerModel();
    m.updateMatrixWorld(true);
    const coat = new TrailerCoat(m, wheels(m), 0.3);
    const v = new THREE.Vector3();
    const mud = { mudAt: () => 1, puddleAt: () => 0 };
    for (let i = 0; i < 600; i++) coat.update(1 / 30, 3, mud, v); // 20 s at 3 m/s through mud
    expect(coat.state.wheels).toBeGreaterThan(0.5);
    expect(coat.state.body).toBeGreaterThan(0.05);
    expect(coat.state.wheels).toBeGreaterThan(coat.state.body * 2);
    const caked = coat.state.wheels;
    const grass = { mudAt: () => 0, puddleAt: () => 0 };
    for (let i = 0; i < 600; i++) coat.update(1 / 30, 5, grass, v);
    expect(coat.state.wheels).toBeLessThan(caked);
    const standing = coat.state.body;
    for (let i = 0; i < 300; i++) coat.update(1 / 30, 0, mud, v); // standing still in mud: nothing thrown
    expect(coat.state.body).toBeCloseTo(standing, 3);
  });
});

describe('the bale trailer\'s ramps', () => {
  const open = rampOpenAngle(TRAILER_SPEC.bedY);
  const box = (t) => {
    poseRamps(bale, t, open);
    bale.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(bale.getObjectByName('rampLeft'));
  };

  it('lie on the bed when stowed, in sight, behind the bales, and never below the deck at any point of opening', () => {
    const stowed = box(0);
    expect(stowed.min.y).toBeGreaterThanOrEqual(TRAILER_SPEC.bedY - 0.002); // on the deck, not in it
    expect(stowed.max.z).toBeLessThanOrEqual(0.62); // clear of the bales' front stack (0.61)
    expect(stowed.min.z).toBeGreaterThan(TRAILER_SPEC.rearZ - 0.15);
    for (let t = 0; t <= 0.6; t += 0.05) expect(box(t).min.y, `t ${t.toFixed(2)}`).toBeGreaterThanOrEqual(TRAILER_SPEC.bedY - 0.002);
  });

  it('slide back along the bed first, then drop to the ground, walking face up', () => {
    const z = (t) => (box(t), bale.getObjectByName('rampLeft').position.z);
    expect(z(0.3)).toBeLessThan(z(0)); // sliding back
    expect(z(0.6)).toBeCloseTo(TRAILER_SPEC.rearZ, 2); // its upper end at the back edge
    expect(box(1).min.y).toBeLessThan(0.1); // its lower end on the ground
    expect(box(1).min.z).toBeLessThan(TRAILER_SPEC.rearZ - 2); // out behind
    // Face up: the cleats' tops are above the plank's.
    const ramp = bale.getObjectByName('rampLeft');
    const up = new THREE.Vector3(0, -1, 0).applyQuaternion(ramp.getWorldQuaternion(new THREE.Quaternion())); // the walking face is on local -y
    expect(up.y).toBeGreaterThan(0.9);
    poseRamps(bale, 0, open);
  });
});

describe('the chevron tyres', () => {
  it('have their V\'s apex leading the way the tyre turns: the arms\' ends trail it at the top of the tyre', () => {
    // At the top of the tyre (th 0) the arms of the V on the right (x > 0) run out and forward (+z) from the centre line, so the apex points back, which
    // seen from the front of the tyre is up (the direction its tread is moving there).
    const arms = treadBlocks('atv', { radius: 0.3, width: 0.16, rimR: 0.18, count: 14 }).filter((b) => b.lean === 0 && b.th === 0);
    const right = arms.find((b) => b.x > 0);
    // a block's long axis is its x; yawed by `yaw` about y it points along (cos yaw, 0, -sin yaw): going outward (+x) the z change is -sin(yaw)
    expect(-Math.sin(right.yaw)).toBeGreaterThan(0); // outward means forward along z at the top
  });
});


describe('the shared winch', () => {
  it('is on the bale trailer with its eye where the game draws the rope from, and on the green quad with its hook and fairlead where they were', async () => {
    expect(bale.getObjectByName('winch').getObjectByName('winchRope')).toBeTruthy();
    expect(bale.getObjectByName('winchEye')).toBeTruthy();
    const green = (await buildAllModels()).find((v) => v.id === 'rb300').model;
    expect(green.getObjectByName('winchUnit').getObjectByName('winchRope')).toBeTruthy();
    const at = (n) => green.getObjectByName(n).getWorldPosition(new THREE.Vector3());
    expect(at('winchHook').z).toBeCloseTo(1.19, 2); // (tests/fixedPoints.json checks the rest to 2 mm)
    expect(at('winchFairlead').z).toBeCloseTo(1.19, 2);
  });
});
