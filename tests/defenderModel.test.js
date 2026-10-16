import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildDefenderModel, poseDefenderBackDoor } from '../src/vehicle/defenderModel.js';
import { buildSeriesModel } from '../src/vehicle/seriesModel.js';
import { voltsFraction } from '../src/vehicle/dashState.js';
import { poseSeriesDoors } from '../src/vehicle/seriesModel.js';
import { setHeadlights } from '../src/vehicle/quadModel.js';
import { DEF_END, DEF_DOOR, DEF_BACK_DOOR, DEF_SCREEN, DEF_ROOF, DEF_DASH, DEF_HITCH, defScreenZ, DEF_SCREEN_TOP_Z, DEF_SIDE_WINDOW, DEF_PLATE, DEF_ARCH } from '../src/vehicle/defenderBody.js';
import { LANDY_SEATS, LANDY_REAR_SEATS, DEFENDER_LAYOUT, poseLandyControls } from '../src/vehicle/landRoverModel.js';
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

  it('leaves room for the driver\'s feet and knees under a shallow dash, and keeps the rear belts off the windows', () => {
    expect(DEF_DASH.z0 - DEF_DASH.z1).toBeLessThan(0.3); // a shelf under 0.3 m deep
    expect(DEF_DASH.face).toBeGreaterThanOrEqual(0.9); // its face stops a hand's breadth above the pedals' arms, nothing solid under it at the driver's end
    // The belts' upper anchors hang on the C pillar (a body panel across the window), not on the glass.
    for (const name of ['rearLeft', 'rearRight']) {
      const belt = model.getObjectByName(`belt_${name}`);
      expect(belt).toBeTruthy();
      const box = new THREE.Box3().setFromObject(belt.getObjectByName('stowed'));
      const pillar = DEF_SIDE_WINDOW.z1 + 0.5 * (DEF_SIDE_WINDOW.z0 - DEF_SIDE_WINDOW.z1); // the middle of the window: the pillar stands behind it
      expect(box.max.z).toBeLessThan(pillar - 0.2);
    }
    // And each rear seat has a buckle in front of its backrest's face.
    for (const [name, seat] of Object.entries(LANDY_REAR_SEATS)) {
      const belt = model.getObjectByName(`belt_${name}`);
      const box = new THREE.Box3().setFromObject(belt);
      expect(box.max.z, name).toBeGreaterThan(seat.z); // reaches forward of the seat's hips
    }
  });

  // Holes: a ray fired at the body from outside, level and square to a side or the back, must hit the skin (a panel, a window, a post, a door), not
  // go through a gap and hit the inside. The first hit being well inboard of the skin means the ray found a hole.
  const firstHit = (origin, dir) => {
    model.updateMatrixWorld(true); // (the doors may have been swung and put back by an earlier test)
    const meshes = [];
    model.traverse((o) => { if (o.isMesh && o.visible && !o.isSprite && !/^headlight/.test(o.name)) meshes.push(o); });
    const rc = new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...dir).normalize(), 0, 20);
    return rc.intersectObjects(meshes, false)[0] ?? null;
  };

  it('has no holes in its sides (between a door and the pillar behind it, at the back of the side window, under the roof)', () => {
    const holes = [];
    for (const s of [1, -1]) {
      for (let z = -1.7983; z <= 0.4; z += 0.0497) { // (a grid that does not line up with the seams between panels: a ray exactly on a seam can slip through it)
        for (let y = 0.7213; y <= 1.74; y += 0.0497) {
          if (Math.abs(z + 1.18) < 0.5 && y < 1.0) continue; // the rear wheel arch: the tyre is fitted by the Quad, not in this model
          if (y > 1.3 && z > defScreenZ(y) - 0.03) continue; // in front of the screen's raked side post
          const h = firstHit([s * 3, y, z], [-s, 0, 0]);
          if (!h || Math.abs(h.point.x) < 0.7) holes.push(`z ${z.toFixed(2)} y ${y.toFixed(2)}`);
        }
      }
    }
    expect(holes.slice(0, 12)).toEqual([]);
  }, 30000);

  it('has no holes in its back (round the back door, its window, the corner posts and the roof)', () => {
    const holes = [];
    for (let x = -0.8517; x <= 0.85; x += 0.0497) {
      for (let y = 0.7513; y <= 1.74; y += 0.0497) {
        const h = firstHit([x, y, -4], [0, 0, 1]);
        if (!h || h.point.z > -1.7) holes.push(`x ${x.toFixed(2)} y ${y.toFixed(2)}`);
      }
    }
    expect(holes.slice(0, 12)).toEqual([]);
  }, 30000);

  it('has no hole under the back door from above: the load floor is solid down to the chassis, and the rear plate is clear of the crossmember and the jaw', () => {
    for (let x = -0.5; x <= 0.5; x += 0.05) {
      const h = firstHit([x, 3, -1.5], [0, -1, 0]);
      expect(h, `x ${x}`).toBeTruthy();
      expect(h.point.y).toBeGreaterThan(0.85); // the load floor's carpet (0.91) or the seat behind it, not the ground
    }
    const plate = model.getObjectByName('bodyRoot').children.find((c) => c.isMesh && c.material.map && Math.abs(c.position.x - DEF_PLATE.x) < 0.01 && Math.abs(c.position.y - DEF_PLATE.y) < 0.01);
    expect(plate, 'the plate').toBeTruthy();
    const front = firstHit([DEF_PLATE.x, DEF_PLATE.y, -4], [0, 0, 1]); // seen from behind, the first thing at the plate's place is the plate itself
    expect(front.point.z).toBeGreaterThan(-1.95); // nothing sticks out behind it (the tow plate and jaw are at the middle)
  });

  it('moves its pedals with your feet', () => {
    const rest = ['pedalClutch', 'pedalBrake', 'pedalAccel'].map((n) => model.getObjectByName(n).rotation.x);
    for (let i = 0; i < 20; i++) poseLandyControls(model, { clutch: 1, brake: 0.5, throttle: 0 });
    expect(model.getObjectByName('pedalClutch').rotation.x).toBeLessThan(rest[0] - 0.2); // right down
    expect(model.getObjectByName('pedalBrake').rotation.x).toBeLessThan(rest[1] - 0.1); // half way
    expect(model.getObjectByName('pedalBrake').rotation.x).toBeGreaterThan(model.getObjectByName('pedalClutch').rotation.x);
    expect(model.getObjectByName('pedalAccel').rotation.x).toBeCloseTo(rest[2], 3); // untouched
    for (let i = 0; i < 20; i++) poseLandyControls(model, {});
    expect(model.getObjectByName('pedalClutch').rotation.x).toBeCloseTo(0, 2); // let go
  });

  it('wires the centre stack\'s hazard, lights and radio rockers, and lights the radio\'s display with the radio', () => {
    const state = (over) => ({ ignition: true, keyOn: true, speedMph: 0, fuelLevel: 0.5, temperature: 80, rpm: 800, odoMiles: 100, indicatorLamps: {}, lightLamps: { lights: false, main: false }, ...over });
    const rocker = (n) => model.getObjectByName(n).rotation.x;
    for (let i = 0; i < 30; i++) model.userData.dash.update(state({}));
    const off = ['rockerHazard', 'rockerLights', 'rockerRadio'].map(rocker);
    for (let i = 0; i < 30; i++) model.userData.dash.update(state({ hazardOn: true, lightLamps: { lights: true, main: false }, radioOn: true }));
    ['rockerHazard', 'rockerLights', 'rockerRadio'].forEach((n, i) => expect(rocker(n), n).toBeGreaterThan(off[i] + 0.2));
    const unit = model.getObjectByName('radio_dab');
    expect(unit.userData.powered).toBe(true);
    for (let i = 0; i < 30; i++) model.userData.dash.update(state({ radioOn: true, ignition: false })); // a flat battery: dark
    expect(unit.userData.powered).toBe(false);
  });

  it('uses the same radio as the Series, and keeps its face out of the mud coat\'s copies', () => {
    const series = buildSeriesModel({});
    expect(series.getObjectByName('radio_dab')).toBeTruthy();
    expect(model.getObjectByName('radio_dab')).toBeTruthy();
    for (const m of [series, model]) expect(m.userData.liveMaterials).toContain(m.getObjectByName('radio_dab').userData.faceMaterial);
    expect(series.userData.liveMaterials).toContain(series.userData.sideMaterial); // the sidelamps light directly, so they are live too
    expect(model.userData.liveMaterials).toContain(model.userData.sideMaterial);
  });

  it('reads the battery on its volts gauge', () => {
    expect(voltsFraction(1, false)).toBeGreaterThan(voltsFraction(0.2, false)); // a flat battery reads lower
    expect(voltsFraction(0.5, true)).toBeGreaterThan(voltsFraction(0.5, false)); // charging reads higher than standing
    expect(voltsFraction(0.5, true)).toBeLessThan(1);
    expect(voltsFraction(0, false)).toBeGreaterThan(0.3); // never off the bottom of the scale
  });

  it('leaves the tyres room in the rear arches, and has an arch block that does not cut them', () => {
    expect(DEF_ARCH.r).toBeGreaterThanOrEqual(0.38 + 0.08); // the tyre's radius and 8 cm
    expect(DEF_ARCH.y).toBeCloseTo(0.58, 5); // centred where the wheel is at full bump
    // From above, through the arch block's hole, a ray finds the tyre's place (nothing there but air in this model, which has no wheels fitted)
    // and the block's solid over it, 7 cm of plastic.
    const h = firstHit([0.68, 3, -1.18], [0, -1, 0]);
    expect(h.point.y).toBeGreaterThan(DEF_ARCH.y + DEF_ARCH.r); // the top of the block, over the hole
    const under = firstHit([0.68, 0.7, -1.18], [0, 1, 0]); // from inside the hole upwards: the block's roof, at the top of the hole
    expect(under.point.y).toBeCloseTo(DEF_ARCH.y + DEF_ARCH.r, 1);
  });
});
