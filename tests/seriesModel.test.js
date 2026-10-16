import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildSeriesModel, poseSeriesDoors, poseSeriesTailgate } from '../src/vehicle/seriesModel.js';
import { SERIES_END, SERIES_TUB, SERIES_TUB_SPOTS, SERIES_DOOR, SERIES_HITCH, SERIES_GATE, SERIES_SCREEN, SERIES_ROOF, screenZ, SERIES_SCREEN_TOP_Z } from '../src/vehicle/seriesBody.js';
import { LANDY_LAYOUT, LANDY_SEATS } from '../src/vehicle/landRoverModel.js';
import { buildAllModels } from './helpers/vehicleModels.js';

let model;
beforeAll(async () => {
  await buildAllModels(); // stubs the canvas for the dashes
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true }), style: {} }) });
  model = buildSeriesModel({});
  model.updateMatrixWorld(true);
});

const at = (name) => model.getObjectByName(name).getWorldPosition(new THREE.Vector3()).sub(model.getObjectByName('bodyRoot').getWorldPosition(new THREE.Vector3()));

describe('the Series at its real size', () => {
  it('has its seats where the girls were put, and the wheel and tow jaw it needs', () => {
    expect(at('riderAnchor').x).toBeCloseTo(LANDY_SEATS.driver.x, 3);
    expect(at('towHitch').z).toBeCloseTo(SERIES_HITCH.z, 3);
    expect(SERIES_HITCH.z).toBeLessThan(SERIES_END); // the jaw is behind the tailgate
    expect(model.getObjectByName('crankHole')).toBeTruthy();
  });

  it('puts the cab where the photos have it: the screen behind the wing, the roof over the cab and the doors', () => {
    expect(SERIES_SCREEN.baseZ).toBeLessThan(0.6); // the old model had it at 0.595
    expect(SERIES_SCREEN_TOP_Z).toBeGreaterThan(SERIES_ROOF.z1);
    expect(SERIES_ROOF.z0).toBeLessThanOrEqual(SERIES_SCREEN_TOP_Z + 0.05); // the roof reaches the top of the screen
    expect(SERIES_ROOF.y).toBeGreaterThan(SERIES_DOOR.glassTop);
    expect(screenZ(SERIES_SCREEN.topY)).toBeCloseTo(SERIES_SCREEN_TOP_Z, 5);
  });
});

describe('the doors', () => {
  it('are groups hinged on their front edge, shut at rest, that swing their free edge out on their own side', () => {
    const left = model.getObjectByName('doorLeft');
    const right = model.getObjectByName('doorRight');
    expect(left.position.z).toBeCloseTo(SERIES_DOOR.hinge, 5);
    expect(left.position.x).toBeGreaterThan(0);
    expect(right.position.x).toBeLessThan(0);
    poseSeriesDoors(model, { left: 0, right: 0 });
    expect(left.rotation.y).toBeCloseTo(0, 6);
    poseSeriesDoors(model, { left: 1, right: 0 });
    expect(right.rotation.y).toBeCloseTo(0, 6); // only the side asked for
    model.updateMatrixWorld(true);
    const free = new THREE.Vector3(0, 1, -0.8).applyMatrix4(left.matrixWorld); // a point on the door's rear edge
    expect(free.x).toBeGreaterThan(left.position.x + 0.5); // out to the left
    poseSeriesDoors(model, { left: 0, right: 1 });
    model.updateMatrixWorld(true);
    expect(new THREE.Vector3(0, 1, -0.8).applyMatrix4(right.matrixWorld).x).toBeLessThan(right.position.x - 0.5);
    poseSeriesDoors(model, { left: 0, right: 0 });
  });

  it('keep their dirt with them (mudRest at the hinge)', () => {
    for (const n of ['doorLeft', 'doorRight']) {
      const d = model.getObjectByName(n);
      expect(d.userData.mudRest).toEqual([d.position.x, d.position.y, d.position.z]);
    }
  });
});

describe('the tailgate', () => {
  const gate = () => model.getObjectByName('tailgate');
  const corner = () => {
    model.updateMatrixWorld(true);
    return new THREE.Vector3(0.78, SERIES_GATE.height - 0.03, 0).applyMatrix4(gate().matrixWorld).sub(model.getObjectByName('bodyRoot').getWorldPosition(new THREE.Vector3()));
  };

  it('stands up shut, lies flat at the floor height open, and is hinged on the rear edge of the floor', () => {
    poseSeriesTailgate(model, 0);
    expect(gate().position.z).toBeCloseTo(SERIES_END, 5);
    expect(corner().y).toBeCloseTo(SERIES_GATE.hingeY + SERIES_GATE.height - 0.03, 3);
    poseSeriesTailgate(model, 1);
    expect(corner().y).toBeCloseTo(SERIES_GATE.hingeY, 3);
    expect(corner().z).toBeLessThan(SERIES_END - 0.2); // behind the tub
    poseSeriesTailgate(model, 0);
  });

  it('keeps its chains joined to the pin on the tub and the corner of the gate however far open it is', () => {
    for (const open of [0, 0.4, 1]) {
      poseSeriesTailgate(model, open);
      model.updateMatrixWorld(true);
      for (const [name, x] of [['gateChainLeft', 0.775], ['gateChainRight', -0.775]]) {
        const chain = model.getObjectByName(name);
        const end = new THREE.Vector3(0, 0, 1).multiplyScalar(chain.scale.z).applyQuaternion(chain.quaternion).add(chain.position);
        const a = -open * Math.PI / 2;
        const want = new THREE.Vector3(x, SERIES_GATE.hingeY + (SERIES_GATE.height - 0.03) * Math.cos(a), SERIES_END + (SERIES_GATE.height - 0.03) * Math.sin(a));
        expect(end.distanceTo(want)).toBeLessThan(1e-4);
      }
    }
    poseSeriesTailgate(model, 0);
  });
});

describe('the tub', () => {
  it('has a cargo spot for each of its places, on the floor, between the wheel humps and clear of the tailgate and the cab', () => {
    const wheelZ = LANDY_LAYOUT.wheels.find((w) => w.name === 'wheel_rl').z;
    for (let i = 0; i < SERIES_TUB_SPOTS.length; i++) {
      const a = at(`bedCargo${i}`);
      expect(a.y).toBeCloseTo(SERIES_TUB.floor + 0.02, 3);
      expect(Math.abs(a.x)).toBeLessThan(0.4); // inside the humps (which start at 0.45)
      expect(a.z).toBeGreaterThan(SERIES_END + 0.2);
      expect(a.z).toBeLessThan(SERIES_TUB.front - 0.2);
      expect(wheelZ).toBeLessThan(0);
    }
    expect(model.getObjectByName(`bedCargo${SERIES_TUB_SPOTS.length}`)).toBeFalsy();
    expect(model.getObjectByName('bedProxy')).toBeTruthy();
  });
});
