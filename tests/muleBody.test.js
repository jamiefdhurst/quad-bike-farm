import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { MULE_BONNET, MULE_BED, MULE_DOOR, MULE_ROOF, loftTop } from '../src/vehicle/muleBody.js';
import { buildBuckledBelt, tongueGeometry } from '../src/vehicle/detail/belts.js';
import { poseUtvDoors, poseUtvBelts, BELTS, UTV_SEATS } from '../src/vehicle/utvModel.js';
import { UTV_SPEC } from '../src/vehicle/quadSpecs.js';
import { measureModel, proportionErrors, REAL_SIZES, IN_PROPORTION } from '../src/vehicle/detail/realSizes.js';
import { MAKER_FOR } from '../src/vehicle/detail/decals.js';
import { buildAllModels, fakeCanvas } from './helpers/vehicleModels.js';

vi.stubGlobal('document', { createElement: () => fakeCanvas() });

// The UTV as a Mule-4010-style side-by-side, the Ridgeback Yak 4010 (TODO 99).

describe('the UTV’s numbers', () => {
  it('finds the hood’s top between its stations, for the ribs to stand on', () => {
    expect(loftTop(MULE_BONNET, 0, 0.6)).toBeCloseTo(MULE_BONNET[0].y1, 6);
    expect(loftTop(MULE_BONNET, 0, 1.38)).toBeCloseTo(MULE_BONNET[2].y1, 6);
    expect(loftTop(MULE_BONNET, 0.27, 1.0)).toBeLessThan(MULE_BONNET[1].y1);
  });

  it('keeps the tailgate at the bed’s end, the door nets inside the cage’s width and the roof at the real height', () => {
    expect(MULE_BED.gate).toBeLessThan(MULE_BED.front);
    expect(MULE_DOOR.front).toBeGreaterThan(MULE_DOOR.rear);
    expect(Math.max(...MULE_ROOF.map((r) => r.y1))).toBeLessThan(1.95);
    expect(UTV_SEATS.bed.z).toBeLessThan(MULE_BED.gate);
  });
});

describe('the buckled belt', () => {
  const at = { top: [0.5, 1.36, -0.52], low: [0.5, 0.8, -0.44], buckle: [0.2, 0.8, -0.38], hip: [0.34, 0.76, -0.42] };
  const named = (o, n) => { let f = null; o.traverse((c) => { if (c.name === n) f = c; }); return f; };

  it('has the stowed and worn children the poser wants, the loop, reel, buckle on its strap with a button, and a tongue with its slot', () => {
    const belt = buildBuckledBelt('left', at);
    expect(belt.name).toBe('belt_left');
    expect(named(belt, 'worn').visible).toBe(false);
    for (const n of ['beltLoop', 'beltReel', 'beltBuckle', 'beltBuckleSlot', 'beltButton', 'beltStalk', 'beltTongue', 'beltTongueWorn', 'beltLap', 'beltSash']) expect(named(belt, n), n).toBeTruthy();
    const g = tongueGeometry();
    g.computeBoundingBox();
    expect(g.boundingBox.getSize(new THREE.Vector3()).y).toBeGreaterThan(0.07); // a real tongue plate, with its two holes
    expect(g.attributes.position.count).toBeGreaterThan(60);
  });

  it('runs the worn belt to the tongue, which stands just above the buckle, and gives the webbing a weave to look at', () => {
    const belt = buildBuckledBelt('left', at);
    const tongue = named(belt, 'beltTongueWorn');
    expect(tongue.position.x).toBeCloseTo(at.buckle[0], 6);
    expect(tongue.position.y).toBeGreaterThan(at.buckle[1]);
    expect(named(belt, 'beltLap').material.map).toBeTruthy();
    expect(named(belt, 'beltLap').geometry.attributes.uv).toBeTruthy();
  });
});

describe('the UTV’s model', () => {
  let utv;
  beforeAll(async () => {
    utv = (await buildAllModels()).find((v) => v.id === 'utv');
  });

  it('is in proportion to the real one on every measure', () => {
    expect(IN_PROPORTION).toContain('utv');
    const errors = proportionErrors(measureModel(utv.model, utv.layout), REAL_SIZES.utv);
    for (const [k, e] of Object.entries(errors)) expect(Math.abs(e), k).toBeLessThan(0.08);
    expect(MAKER_FOR.utv).toBe('ridgeback');
    expect(UTV_SPEC.bodyColor).toBe(0x3b5b3a);
  });

  it('has a belt for each seat, each with a buckle, and poses them stowed or worn', () => {
    for (const seat of Object.keys(BELTS)) expect(utv.model.getObjectByName(`belt_${seat}`).getObjectByName('beltButton'), seat).toBeTruthy();
    poseUtvBelts(utv.model, { driver: true, mid: false, left: false });
    const w = (s) => utv.model.getObjectByName(`belt_${s}`).getObjectByName('worn').visible;
    expect([w('driver'), w('mid'), w('left')]).toEqual([true, false, false]);
    poseUtvBelts(utv.model, { driver: false, mid: false, left: false });
  });

  it('has door nets that swing out on the rear hoop and shut again', () => {
    const left = utv.model.getObjectByName('doorNetLeft');
    const right = utv.model.getObjectByName('doorNetRight');
    poseUtvDoors(utv.model, 0);
    expect(left.rotation.y).toBe(0);
    poseUtvDoors(utv.model, 1);
    expect(left.rotation.y).toBeGreaterThan(1);
    expect(right.rotation.y).toBeLessThan(-1);
    poseUtvDoors(utv.model, 0);
  });

  it('keeps the wheels’ parts inboard of the tyre’s face and has its nuts', () => {
    const wheel = utv.model.getObjectByName('wheel_fl');
    const nuts = []; wheel.traverse((o) => { if (o.name === 'wheelNut') nuts.push(o); });
    expect(nuts.length).toBe(4);
    const face = 0.21 / 2;
    for (const n of nuts) expect(new THREE.Box3().setFromObject(n).max.x).toBeLessThanOrEqual(face + 0.001);
  });

  it('puts the lamps on the cab’s back plate and in the nose, found by the light code', () => {
    expect(utv.model.getObjectByName('tailPlate')).toBeTruthy();
    expect(utv.model.userData.tailMaterial).toBeTruthy();
    expect(utv.model.getObjectByName('headlamp')).toBeTruthy();
    expect(utv.model.getObjectByName('bed').getObjectByName('tailgate')).toBeTruthy();
  });
});
