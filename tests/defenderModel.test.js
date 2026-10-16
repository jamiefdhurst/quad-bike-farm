import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildDefenderModel, poseDefenderBackDoor } from '../src/vehicle/defenderModel.js';
import { poseSeriesDoors } from '../src/vehicle/seriesModel.js';
import { setHeadlights } from '../src/vehicle/quadModel.js';
import { DEF_END, DEF_DOOR, DEF_BACK_DOOR, DEF_SCREEN, DEF_ROOF, DEF_DASH, DEF_HITCH, defScreenZ, DEF_SCREEN_TOP_Z } from '../src/vehicle/defenderBody.js';
import { LANDY_SEATS, LANDY_REAR_SEATS, DEFENDER_LAYOUT } from '../src/vehicle/landRoverModel.js';
import { buildAllModels } from './helpers/vehicleModels.js';

let model;
beforeAll(async () => {
  await buildAllModels(); // stubs the canvas for the dashes
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true }), style: {} }) });
  model = buildDefenderModel({});
  model.updateMatrixWorld(true);
});

const at = (name) => model.getObjectByName(name).getWorldPosition(new THREE.Vector3()).sub(model.getObjectByName('bodyRoot').getWorldPosition(new THREE.Vector3()));

describe('the 200TDi at its real size', () => {
  it('has its seats where the girls were put, front and back, and the tow jaw it needs', () => {
    for (const [name, seat] of [['riderAnchor', LANDY_SEATS.driver], ['seatMid', LANDY_SEATS.mid], ['seatLeft', LANDY_SEATS.left]]) expect(at(name).x).toBeCloseTo(seat.x, 3);
    for (const name of Object.keys(LANDY_REAR_SEATS)) {
      const cap = name[0].toUpperCase() + name.slice(1);
      expect(at(`seat${cap}`).z).toBeCloseTo(LANDY_REAR_SEATS[name].z, 3);
      expect(model.getObjectByName(`belt_${name}`)).toBeTruthy();
    }
    expect(at('towHitch').z).toBeCloseTo(DEF_HITCH.z, 3);
    expect(DEF_HITCH.z).toBeLessThan(DEF_END); // the jaw is behind the back door
    expect(model.getObjectByName('crankHole')).toBeFalsy();
  });

  it('has the Defender 90\'s wheelbase and track', () => {
    const z = DEFENDER_LAYOUT.wheels.map((w) => w.z);
    expect(Math.max(...z) - Math.min(...z)).toBeCloseTo(2.36, 3);
    expect(Math.abs(DEFENDER_LAYOUT.wheels[0].x) * 2).toBeCloseTo(1.486, 3);
  });

  it('has doors that hinge on their front edges and swing out at their own side, with the dirt going with them', () => {
    const left = model.getObjectByName('doorLeft');
    const right = model.getObjectByName('doorRight');
    expect(left.position.z).toBeCloseTo(DEF_DOOR.hinge, 3);
    expect(left.userData.mudRest).toEqual([left.position.x, 0, left.position.z]);
    poseSeriesDoors(model, { left: 1, right: 0 });
    expect(left.rotation.y).toBeLessThan(-1);
    expect(right.rotation.y).toBe(0);
    poseSeriesDoors(model, { left: 0, right: 1 });
    expect(right.rotation.y).toBeGreaterThan(1);
    poseSeriesDoors(model, { left: 0, right: 0 });
  });

  it('swings its back door out on the offside hinge and back, the spare going with it', () => {
    const door = model.getObjectByName('backDoor');
    expect(door.position.x).toBeCloseTo(DEF_BACK_DOOR.hingeX, 3);
    expect(door.position.x).toBeLessThan(0); // the driver's side
    const free = () => new THREE.Vector3(DEF_BACK_DOOR.width, 1.2, 0).applyMatrix4(door.matrixWorld); // a point on the door's free edge
    poseDefenderBackDoor(model, 0);
    model.updateMatrixWorld(true);
    const shut = free();
    expect(shut.z).toBeCloseTo(DEF_END, 2);
    poseDefenderBackDoor(model, 1);
    model.updateMatrixWorld(true);
    const open = free();
    expect(open.z).toBeLessThan(DEF_END - 0.9); // swung out behind
    expect(open.x).toBeLessThan(shut.x); // round towards the offside
    poseDefenderBackDoor(model, 0);
  });

  it('has the screen raked into a roof that starts where the glass ends, and a dash in front of the driver that the glass clears', () => {
    expect(DEF_ROOF.z0).toBeCloseTo(DEF_SCREEN_TOP_Z + 0.02, 3);
    expect(defScreenZ(DEF_SCREEN.baseY)).toBeCloseTo(DEF_SCREEN.baseZ, 5);
    // The pod's top edge (the fixed point's tilt) stays behind the glass at its height.
    const pod = DEF_DASH.pod;
    const topY = pod.y + 0.069 * Math.cos(pod.tilt);
    const topZ = pod.z + 0.069 * Math.sin(pod.tilt);
    expect(topZ).toBeLessThan(defScreenZ(topY));
  });

  it('lights its sidelamps with the headlights, and keeps its choke and hand throttle as hidden stand-ins', () => {
    setHeadlights(model, true, 1);
    expect(model.userData.sideMaterial.emissive.getHex()).not.toBe(0);
    setHeadlights(model, false, 0);
    expect(model.userData.sideMaterial.emissive.getHex()).toBe(0);
    for (const n of ['chokeKnob', 'handThrottleKnob']) expect(model.getObjectByName(n).visible).toBe(false);
  });

  it('turns its key with the ignition', () => {
    const key = model.getObjectByName('ignitionKey');
    const state = (over) => ({ ignition: true, keyOn: true, speedMph: 0, fuelLevel: 0.5, temperature: 80, rpm: 800, odoMiles: 100, indicatorLamps: {}, ...over });
    for (let i = 0; i < 30; i++) model.userData.dash.update(state({ keyOn: false }));
    expect(key.rotation.z).toBeCloseTo(0, 2);
    for (let i = 0; i < 30; i++) model.userData.dash.update(state({}));
    expect(key.rotation.z).toBeGreaterThan(0.5);
  });
});
