import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildTrailerModel, TRAILER_SPEC } from '../src/vehicle/trailerModel.js';
import { buildTipTrailerModel, TIP_TRAILER_SPEC, CARGO_SPOTS, SEAT_AT } from '../src/vehicle/tipTrailerModel.js';
import { TRAILER_SIZES } from '../src/vehicle/detail/realSizes.js';
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
