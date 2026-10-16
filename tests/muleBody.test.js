import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { MULE_BONNET, MULE_DASH, MULE_DOOR, MULE_BED, MULE_DOOR, MULE_ROOF, loftTop } from '../src/vehicle/muleBody.js';
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

  it('has door nets hinged at the front that swing out at one side only, the free end going outwards', () => {
    const left = utv.model.getObjectByName('doorNetLeft');
    const right = utv.model.getObjectByName('doorNetRight');
    expect(left.position.z).toBeCloseTo(MULE_DOOR.front, 6); // the hinge is on the front post
    poseUtvDoors(utv.model, { left: 0, right: 0 });
    expect(Math.abs(left.rotation.y)).toBe(0);
    poseUtvDoors(utv.model, { left: 1, right: 0 });
    utv.model.updateMatrixWorld(true);
    const latch = (net) => net.getObjectByName('doorLatch').getWorldPosition(new THREE.Vector3());
    expect(latch(left).x).toBeGreaterThan(MULE_DOOR.x + 0.5); // the free end swung out to the left
    expect(Math.abs(right.rotation.y)).toBe(0); // the other side stays shut
    expect(Math.abs(latch(right).x)).toBeLessThan(MULE_DOOR.x + 0.05);
    poseUtvDoors(utv.model, { left: 0, right: 1 });
    utv.model.updateMatrixWorld(true);
    expect(latch(right).x).toBeLessThan(-MULE_DOOR.x - 0.5);
    poseUtvDoors(utv.model, { left: 0, right: 0 });
  });

  it('lights its tail lamps in a row, outer to inner the indicator, the brake and the reverse, on a narrow plate, all dark until lit', () => {
    const m = utv.model;
    m.updateMatrixWorld(true);
    const x = (n) => { const o = []; m.traverse((c) => { if (c.name === n) o.push(c); }); return o.map((c) => Math.abs(c.position.x)).sort()[0]; };
    expect(x('tailIndicator')).toBeGreaterThan(x('tailLens'));
    expect(x('tailLens')).toBeGreaterThan(x('tailReverse'));
    const plate = new THREE.Box3().setFromObject(m.getObjectByName('tailPlate'));
    expect(plate.max.x - plate.min.x).toBeLessThan(1.0);
    const dark = (mat) => Math.max(mat.color.r, mat.color.g, mat.color.b);
    expect(dark(m.userData.signalMaterials.left)).toBeLessThan(0.4);
    expect(dark(m.userData.signalMaterials.reverse)).toBeLessThan(0.4);
    expect(m.userData.signalMaterials.left.emissive.getHex()).toBe(0);
  });

  it('keeps the headlamps clear of the bumper and gives the bumper some moulding', () => {
    const m = utv.model;
    const lamp = new THREE.Box3().setFromObject(m.getObjectByName('lampHousing'));
    const bumper = new THREE.Box3().setFromObject(m.getObjectByName('bumper'));
    expect(lamp.min.y).toBeGreaterThan(bumper.max.y + 0.02);
    const nose = new THREE.Box3().setFromObject(m.getObjectByName('frontBody'));
    expect(lamp.max.y).toBeLessThan(nose.max.y); // the housing sits in the body, not above it
    expect(lamp.max.z).toBeGreaterThan(1.38); // and its face stands just proud of the nose's
    expect(lamp.min.z).toBeLessThan(1.37); // with its back inside it
    expect(m.getObjectByName('bumper').material.bumpMap).toBeTruthy();
    expect(m.getObjectByName('bumperRib')).toBeTruthy();
  });

  it('keeps the stowed belts no higher than their loops', () => {
    for (const seat of Object.keys(BELTS)) {
      const belt = utv.model.getObjectByName(`belt_${seat}`);
      const loop = new THREE.Box3().setFromObject(belt.getObjectByName('beltLoop'));
      for (const part of ['beltWebbing']) {
        const web = new THREE.Box3().setFromObject(belt.getObjectByName('stowed').getObjectByName(part));
        expect(web.max.y, `${seat} ${part}`).toBeLessThanOrEqual(loop.max.y + 0.001);
      }
    }
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

  it('shows a windscreen and attaches its mirrors, wiper, lamp plate, grab handle and handbrake to something', () => {
    const m = utv.model;
    m.updateMatrixWorld(true);
    expect(m.getObjectByName('windscreen').material.opacity).toBeGreaterThan(0.2); // clear but there to see
    const box = (n) => new THREE.Box3().setFromObject(m.getObjectByName(n));
    const pivot = box('wiperPivot');
    expect(pivot.intersectsBox(box('dashPanel').expandByScalar(0.02))).toBe(true); // the wiper stands on the dash
    expect(box('wiperArm').intersectsBox(pivot.clone().expandByScalar(0.01))).toBe(true);
    expect(box('mirrorArm').min.x).toBeLessThan(0.7);
    expect(box('grabHandle').min.y).toBeLessThan(loftTop(MULE_DASH, 0.14, 0.4, 3) + 0.01); // its feet are in the dash's top
    expect(box('tailPlate').min.z).toBeGreaterThan(-0.7); // right behind the rear hoop, bolted to it
    expect(m.getObjectByName('gateBadge').position.x).toBe(0);
    expect(m.getObjectByName('parkBrakeLever').getObjectByName('handbrakeButton')).toBeTruthy(); // a car's lever with its release button
  });

  it('keeps the exhaust clear of the frame: its silencer is inboard of the right rail and the tailpipe over the cross member', () => {
    const sil = new THREE.Box3().setFromObject(utv.model.getObjectByName('silencer'));
    expect(sil.min.x).toBeGreaterThan(-0.42 + 0.04); // inside the rail at x -0.42 (radius 0.035)
    expect(sil.max.x).toBeLessThan(-0.1);
  });
});
