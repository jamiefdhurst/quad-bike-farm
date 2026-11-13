import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildCragModel, poseCragBackDoor } from '../src/vehicle/cragModel.js';
import { buildTorModel } from '../src/vehicle/torModel.js';
import { voltsFraction } from '../src/vehicle/dashState.js';
import { poseTorDoors } from '../src/vehicle/torModel.js';
import { setHeadlights } from '../src/vehicle/quadModel.js';
import { DEF_END, DEF_DOOR, DEF_BACK_DOOR, DEF_SCREEN, DEF_ROOF, DEF_DASH, DEF_HITCH, defScreenZ, DEF_SCREEN_TOP_Z, DEF_SIDE_WINDOW, DEF_PLATE, DEF_ARCH } from '../src/vehicle/cragBody.js';
import { CAB_SEATS, CRAG_REAR_SEATS, CRAG_LAYOUT, poseCabControls } from '../src/vehicle/cabModel.js';
import { buildAllModels } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';

let model;
beforeAll(async () => {
  await buildAllModels(); // stubs the canvas for the dashes
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true }), style: {} }) });
  model = buildCragModel({});
  model.updateMatrixWorld(true);
});

const at = (name) => model.getObjectByName(name).getWorldPosition(new THREE.Vector3()).sub(model.getObjectByName('bodyRoot').getWorldPosition(new THREE.Vector3()));

describe('the 200TDi at its real size', () => {
  it('has its seats where the girls were put, front and back, and the tow jaw it needs', () => {
    for (const [name, seat] of [['riderAnchor', CAB_SEATS.driver], ['seatMid', CAB_SEATS.mid], ['seatLeft', CAB_SEATS.left]]) expect(at(name).x).toBeCloseTo(seat.x, 3);
    for (const name of Object.keys(CRAG_REAR_SEATS)) {
      const cap = name[0].toUpperCase() + name.slice(1);
      expect(at(`seat${cap}`).z).toBeCloseTo(CRAG_REAR_SEATS[name].z, 3);
      expect(model.getObjectByName(`belt_${name}`)).toBeTruthy();
    }
    expect(at('towHitch').z).toBeCloseTo(DEF_HITCH.z, 3);
    expect(DEF_HITCH.z).toBeLessThan(DEF_END); // the jaw is behind the back door
    expect(model.getObjectByName('crankHole')).toBeFalsy();
  });

  it('has the Crag 90\'s wheelbase and track', () => {
    const z = CRAG_LAYOUT.wheels.map((w) => w.z);
    expect(Math.max(...z) - Math.min(...z)).toBeCloseTo(2.36, 3);
    expect(Math.abs(CRAG_LAYOUT.wheels[0].x) * 2).toBeCloseTo(1.486, 3);
  });

  it('has doors that hinge on their front edges and swing out at their own side, with the dirt going with them', () => {
    const left = model.getObjectByName('doorLeft');
    const right = model.getObjectByName('doorRight');
    expect(left.position.z).toBeCloseTo(DEF_DOOR.hinge, 3);
    expect(left.userData.mudRest).toEqual([left.position.x, 0, left.position.z]);
    poseTorDoors(model, { left: 1, right: 0 });
    expect(left.rotation.y).toBeLessThan(-1);
    expect(right.rotation.y).toBe(0);
    poseTorDoors(model, { left: 0, right: 1 });
    expect(right.rotation.y).toBeGreaterThan(1);
    poseTorDoors(model, { left: 0, right: 0 });
  });

  it('swings its back door out on the offside hinge and back, the spare going with it', () => {
    const door = model.getObjectByName('backDoor');
    expect(door.position.x).toBeCloseTo(DEF_BACK_DOOR.hingeX, 3);
    expect(door.position.x).toBeLessThan(0); // the driver's side
    const free = () => new THREE.Vector3(DEF_BACK_DOOR.width, 1.2, 0).applyMatrix4(door.matrixWorld); // a point on the door's free edge
    poseCragBackDoor(model, 0);
    model.updateMatrixWorld(true);
    const shut = free();
    expect(shut.z).toBeCloseTo(DEF_END, 2);
    poseCragBackDoor(model, 1);
    model.updateMatrixWorld(true);
    const open = free();
    expect(open.z).toBeLessThan(DEF_END - 0.9); // swung out behind
    expect(open.x).toBeLessThan(shut.x); // round towards the offside
    poseCragBackDoor(model, 0);
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
    for (const [name, seat] of Object.entries(CRAG_REAR_SEATS)) {
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
    for (let i = 0; i < 20; i++) poseCabControls(model, { clutch: 1, brake: 0.5, throttle: 0 });
    expect(model.getObjectByName('pedalClutch').rotation.x).toBeLessThan(rest[0] - 0.2); // right down
    expect(model.getObjectByName('pedalBrake').rotation.x).toBeLessThan(rest[1] - 0.1); // half way
    expect(model.getObjectByName('pedalBrake').rotation.x).toBeGreaterThan(model.getObjectByName('pedalClutch').rotation.x);
    expect(model.getObjectByName('pedalAccel').rotation.x).toBeCloseTo(rest[2], 3); // untouched
    for (let i = 0; i < 20; i++) poseCabControls(model, {});
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

  it('uses the same radio as the Tor, and keeps its face out of the mud coat\'s copies', () => {
    const tor = buildTorModel({});
    expect(tor.getObjectByName('radio_dab')).toBeTruthy();
    expect(model.getObjectByName('radio_dab')).toBeTruthy();
    for (const m of [tor, model]) expect(m.userData.liveMaterials).toContain(m.getObjectByName('radio_dab').userData.faceMaterial);
    expect(tor.userData.liveMaterials).toContain(tor.userData.sideMaterial); // the sidelamps light directly, so they are live too
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

  it('has no hole along the top edge of its sides (a slot over the B pillar, between the rails, under the roof)', () => {
    const holes = [];
    for (const s of [1, -1]) {
      for (let z = -1.7983; z <= 0.2; z += 0.0111) {
        for (const y of [1.685, 1.695, 1.705, 1.715, 1.725, 1.735]) {
          const h = firstHit([s * 3, y, z], [-s, 0, 0]);
          if (!h || Math.abs(h.point.x) < 0.7) holes.push(`z ${z.toFixed(2)} y ${y}`);
        }
      }
    }
    expect(holes.slice(0, 12)).toEqual([]);
  }, 30000);

  it('has no two faces fighting for the same plane where you can see them (the rails and pillars, the door\'s pieces, the roof\'s edge, the back)', () => {
    const fights = coplanarOverlaps(model, { gap: 0.002, minArea: 2e-5 }).filter((f) => f.area > 8e-4); // 8 cm2 or more
    expect(fights.slice(0, 8).map((f) => `${f.a}|${f.b} ${(f.area * 1e4).toFixed(0)} cm2 at ${f.at.map((v) => v.toFixed(2)).join(',')}`)).toEqual([]);
  });

  it('puts the pedals the right way round for a right-hand-drive car: the clutch furthest left of the driver (the most +x), the accelerator furthest right', () => {
    const x = (n) => model.getObjectByName(n).position.x;
    expect(x('pedalClutch')).toBeGreaterThan(x('pedalBrake'));
    expect(x('pedalBrake')).toBeGreaterThan(x('pedalAccel'));
    expect(x('pedalAccel')).toBeLessThan(CAB_SEATS.driver.x + 0.2); // by the door side of the wheel's column
  });

  it('puts the wipers\' spindles below the glass, in the screen\'s bottom rail', () => {
    for (const w of model.getObjectByName('bodyRoot').children) if (w.name === 'wiper') expect(w.position.y).toBeLessThan(0.06);
    const wipers = [];
    model.traverse((o) => { if (o.name === 'wiper') wipers.push(o); });
    expect(wipers.length).toBe(2);
    for (const w of wipers) expect(w.position.y).toBeLessThan(0.06);
  });

  it('has nothing of its body inside the rear tyres, at rest or at full bump (the tyre is 0.38 m radius, 0.21 wide, at x 0.743)', () => {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const p = new THREE.Vector3();
    const inside = [];
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (!o.isMesh) return;
      for (let q = o; q; q = q.parent) if (/^wheel_|^mirror|^seatBack|^belt/.test(q.name)) return;
      if (['151617', '3a3c3e', '8e9396'].includes(o.material.color.getHexString())) return; // the chassis, springs and the like are meant to be down there
      const pos = o.geometry.attributes.position;
      const idx = o.geometry.index;
      const n = idx ? idx.count / 3 : pos.count / 3;
      for (let t = 0; t < n; t++) {
        const g = (k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
        a.fromBufferAttribute(pos, g(0)).applyMatrix4(o.matrixWorld);
        b.fromBufferAttribute(pos, g(1)).applyMatrix4(o.matrixWorld);
        c.fromBufferAttribute(pos, g(2)).applyMatrix4(o.matrixWorld);
        for (let i = 0; i <= 6; i++) {
          for (let j = 0; j <= 6 - i; j++) {
            const u = i / 6;
            const w = j / 6;
            p.set(a.x * (1 - u - w) + b.x * u + c.x * w, a.y * (1 - u - w) + b.y * u + c.y * w, a.z * (1 - u - w) + b.z * u + c.z * w);
            for (const side of [1, -1]) {
              if (Math.abs(p.x - side * 0.743) > 0.105) continue;
              for (const cy of [0.45, 0.58]) if (Math.hypot(p.y - cy, p.z - CRAG_LAYOUT.wheels[2].z) < 0.37) inside.push(`${o.name || o.parent?.name} at ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`);
            }
          }
        }
      }
    });
    expect(inside.slice(0, 6)).toEqual([]);
  });

  it('shows no sky through the body below the window sills from any seat, with the rear tyres in their arches (a stand-in tyre at rest height)', () => {
    const meshes = [];
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (!o.isMesh || !o.visible || o.isSprite || /^headlight/.test(o.name)) return;
      for (let q = o; q; q = q.parent) if (/^wheel_|^belt|^seatBack/.test(q.name)) return;
      meshes.push(o);
    });
    for (const x of [0.743, -0.743]) { // the rear tyres, where the game puts them at rest (centre height 0.45)
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.21, 24).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial());
      tyre.position.set(x, 0.45, CRAG_LAYOUT.wheels[2].z);
      tyre.updateMatrixWorld(true);
      meshes.push(tyre);
    }
    const rc = new THREE.Raycaster();
    const holes = [];
    for (const eye of [[0.38, 1.67, -1.1], [-0.38, 1.67, -1.1], [-0.42, 1.63, -0.32], [0.42, 1.63, -0.32]]) {
      for (let tz = -1.82; tz <= -0.5; tz += 0.0211) {
        for (let ty = 0.62; ty <= 1.26; ty += 0.0211) {
          for (const side of [1, -1]) {
            const o = new THREE.Vector3(...eye);
            const target = new THREE.Vector3(side * 0.84, ty, tz);
            const d = target.clone().sub(o);
            const dist = d.length();
            rc.set(o, d.normalize());
            const h = rc.intersectObjects(meshes, false)[0];
            if (!h || Math.abs(h.point.x) > 0.9 || h.distance > dist + 0.12) holes.push(`eye ${eye} to z ${tz.toFixed(2)} y ${ty.toFixed(2)} side ${side}`);
          }
        }
      }
    }
    expect(holes.slice(0, 8)).toEqual([]);
  }, 60000);

  it('has no strip of fighting faces in the boot or the rear arches (the wheel boxes, the load floor and the seat boxes, down to a square centimetre)', () => {
    const fights = coplanarOverlaps(model, { gap: 0.003, minArea: 1e-5 }).filter((f) => f.at[2] < -0.5 && f.at[2] > -1.85 && Math.abs(f.at[0]) < 0.9 && f.at[1] > 0.55 && f.at[1] < 1.3);
    expect(fights.slice(0, 8).map((f) => `${f.a}|${f.b} ${(f.area * 1e4).toFixed(1)} cm2 at ${f.at.map((v) => v.toFixed(2)).join(',')}`)).toEqual([]);
  });
});
