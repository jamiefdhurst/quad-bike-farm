import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildFiestaModel, poseFiestaHatch } from '../src/vehicle/fiestaModel.js';
import { poseSeriesDoors } from '../src/vehicle/seriesModel.js';
import { poseCarControls } from '../src/vehicle/carModel.js';
import { FIESTA_BODY, FIESTA_DOOR, FIESTA_HATCH } from '../src/vehicle/fiestaBody.js';
import { carLayout } from '../src/vehicle/carModel.js';
import { MAKERS } from '../src/vehicle/detail/decals.js';
import { RADIO_STYLES } from '../src/vehicle/detail/radios.js';
import { buildAllModels } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';

let model;
beforeAll(async () => {
  await buildAllModels(); // stubs the canvas for the dash and the trim
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true }), style: {} }) });
  model = buildFiestaModel({});
  model.updateMatrixWorld(true);
});

const world = (name) => model.getObjectByName(name).getWorldPosition(new THREE.Vector3());

describe('the Fiesta at its real size', () => {
  it('has the parts the game looks for, the doors, the hatch and its struts, and the pedals', () => {
    for (const n of ['bodyRoot', 'riderAnchor', 'seatLeft', 'seatRearLeft', 'seatRearRight', 'cameraAnchor', 'parkBrakeLever', 'chokeKnob', 'gearLever', 'handlebars', 'exhaustTip', 'seatBack_left', 'seatBack_driver',
      'doorLeft', 'doorRight', 'hatch', 'hatchStrutLeft', 'hatchStrutRight', 'pedalClutch', 'pedalBrake', 'pedalAccel', 'hazardSwitch', 'radio_cassette', 'ignitionKey']) {
      expect(model.getObjectByName(n), n).toBeTruthy();
    }
  });

  it('has its doors hinge on their front edges and swing out at their own side, the dirt on them going with them', () => {
    const left = model.getObjectByName('doorLeft');
    const right = model.getObjectByName('doorRight');
    expect(left.position.z).toBeCloseTo(FIESTA_DOOR.hinge, 3);
    expect(left.userData.mudRest).toEqual([left.position.x, 0, left.position.z]);
    poseSeriesDoors(model, { left: 1, right: 0 });
    expect(left.rotation.y).toBeLessThan(-1);
    expect(right.rotation.y).toBe(0);
    poseSeriesDoors(model, { left: 0, right: 1 });
    expect(right.rotation.y).toBeGreaterThan(1);
    poseSeriesDoors(model, { left: 0, right: 0 });
  });

  it('lifts its hatch up and back on a hinge at the roof, the struts following it, and shuts again', () => {
    const hatch = model.getObjectByName('hatch');
    const foot = () => new THREE.Vector3(0, -(FIESTA_BODY.roofRear[1] - FIESTA_HATCH.foot), FIESTA_BODY.tail - FIESTA_BODY.roofRear[0]).applyMatrix4(hatch.matrixWorld); // the lower edge
    poseFiestaHatch(model, 0);
    model.updateMatrixWorld(true);
    const shut = foot();
    poseFiestaHatch(model, 1);
    model.updateMatrixWorld(true);
    const open = foot();
    expect(open.y).toBeGreaterThan(shut.y + 0.5); // the lower edge swings up
    expect(open.z).toBeLessThan(shut.z + 0.0001); // and not forward
    for (const n of ['hatchStrutLeft', 'hatchStrutRight']) {
      const strut = model.getObjectByName(n);
      expect(strut.scale.z).toBeGreaterThan(0.3); // it has stretched between its two ends
    }
    poseFiestaHatch(model, 0);
    model.updateMatrixWorld(true);
  });

  it('puts the pedals right-hand-drive: the clutch nearest the tunnel, the accelerator by the door, and works them', () => {
    const x = (n) => model.getObjectByName(n).position.x;
    expect(x('pedalClutch')).toBeGreaterThan(x('pedalBrake'));
    expect(x('pedalBrake')).toBeGreaterThan(x('pedalAccel'));
    for (let i = 0; i < 20; i++) poseCarControls(model, { clutch: 1, brake: 0, throttle: 0.5 });
    expect(model.getObjectByName('pedalClutch').rotation.x).toBeLessThan(-0.2);
    expect(model.getObjectByName('pedalBrake').rotation.x).toBeCloseTo(0, 2);
    expect(model.getObjectByName('pedalAccel').rotation.x).toBeLessThan(-0.08);
    for (let i = 0; i < 20; i++) poseCarControls(model, {});
  });

  it('has a cassette radio of the shared kind, dark until the radio is on with the key, a rocker wired to it, and a key that turns', () => {
    expect(RADIO_STYLES.cassette).toBeTruthy();
    const state = (over) => ({ ignition: true, keyOn: true, speedMph: 0, fuelLevel: 0.5, temperature: 80, rpm: 800, odoMiles: 100, indicatorLamps: {}, lightLamps: { lights: false, main: false }, ...over });
    for (let i = 0; i < 30; i++) model.userData.dash.update(state({ keyOn: false }));
    const radio = model.getObjectByName('radio_cassette');
    const rocker = model.getObjectByName('rockerRadio');
    const off = rocker.rotation.x;
    expect(radio.userData.powered).toBe(false);
    expect(model.getObjectByName('ignitionKey').rotation.z).toBeCloseTo(0, 2);
    for (let i = 0; i < 30; i++) model.userData.dash.update(state({ radioOn: true }));
    expect(radio.userData.powered).toBe(true);
    expect(rocker.rotation.x).toBeGreaterThan(off + 0.2);
    expect(model.getObjectByName('ignitionKey').rotation.z).toBeGreaterThan(0.5);
    expect(model.userData.liveMaterials).toContain(radio.userData.faceMaterial); // the mud coat leaves its display alone
  });

  it('is the size of the car it stands for (within 8%: tests/vehicleModels.test.js) and wears a made-up maker\'s name', () => {
    expect(MAKERS.thorne.name).toBe('Thorne');
    expect(carLayout('fiesta').wheels).toHaveLength(4);
  });

  const upperLine = (z) => { // the top of the body's side at z
    const u = FIESTA_BODY.upper;
    for (let i = 1; i < u.length; i++) if (z >= u[i][0]) return u[i - 1][1] + ((u[i][1] - u[i - 1][1]) * (u[i - 1][0] - z)) / (u[i - 1][0] - u[i][0]);
    return u[u.length - 1][1];
  };

  // Holes: rays fired at the body from outside must hit the skin, not slip through a gap and hit the inside.
  const firstHit = (origin, dir) => {
    model.updateMatrixWorld(true);
    const meshes = [];
    model.traverse((o) => { if (o.isMesh && o.visible && !o.isSprite && !/^headlight/.test(o.name)) meshes.push(o); });
    return new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...dir).normalize(), 0, 20).intersectObjects(meshes, false)[0] ?? null;
  };

  it('has no holes in its sides, from the nose to the tail below the belt line, and through the cabin up to the roof (the arches excepted: the tyres are fitted by the game)', () => {
    const holes = [];
    for (const s of [1, -1]) {
      for (let z = -1.6383; z <= 1.75; z += 0.0497) {
        for (let y = 0.4513; y <= 1.3; y += 0.0497) {
          const front = 0.7 - (y - 0.93); // the A pillar's line (world y: the body stands 5 cm on its wheels)
          const cabin = z < front - 0.08 && z > -1.25;
          if (y > upperLine(z) + 0.05 - 0.03 && !cabin) continue; // over the bonnet and the tail: open air above the line
          if (y < 0.7 && Math.abs(Math.abs(z) - 1.145) < 0.36) continue; // an arch
          const h = firstHit([s * 3, y, z], [-s, 0, 0]);
          const lean = 0.735 - Math.max(0, y - FIESTA_BODY.screenBase[1] - 0.05) * FIESTA_BODY.tumble - 0.06; // the glass leans in towards the roof
          if (!h || Math.abs(h.point.x) < lean) holes.push(`side ${s} z ${z.toFixed(2)} y ${y.toFixed(2)}`);
        }
      }
    }
    expect(holes.slice(0, 12)).toEqual([]);
  }, 40000);

  it('has no holes in its back or its front (round the hatch, the lamps, the bumper, the grille)', () => {
    const holes = [];
    for (let x = -0.7517; x <= 0.75; x += 0.0497) {
      for (let y = 0.4113; y <= 1.2; y += 0.0497) { // (from the bumper's top: below it is the open under-body, as on the car)
        const lowOrNarrow = y < 0.9 || Math.abs(x) < 0.55;
        if (!lowOrNarrow) continue; // above the bonnet and the deck, outside the glass: open air
        const h = firstHit([x, y, -4], [0, 0, 1]);
        if (!h || h.point.z > -1.0) holes.push(`back x ${x.toFixed(2)} y ${y.toFixed(2)}`);
        if (y > 0.74) continue; // the front: only the nose, not the bonnet's slope up to the screen
        const f = firstHit([x, y, 4], [0, 0, -1]);
        if (!f || f.point.z < FIESTA_BODY.nose - 0.3) holes.push(`front x ${x.toFixed(2)} y ${y.toFixed(2)}`);
      }
    }
    expect(holes.slice(0, 12)).toEqual([]);
  }, 40000);

  it('has no two faces fighting for one plane where you can see them', () => {
    const fights = coplanarOverlaps(model, { gap: 0.003, minArea: 2e-5 }).filter((f) => f.area > 3e-4); // 3 cm2 or more, to 3 mm: the boot's carpet and trim fought at the edge
    expect(fights.slice(0, 8).map((f) => `${f.a}|${f.b} ${(f.area * 1e4).toFixed(0)} cm2 at ${f.at.map((v) => v.toFixed(2)).join(',')}`)).toEqual([]);
  });

  it('has nothing of its body inside the tyres, at rest or at full bump (a tyre is 0.27 m radius, 0.145 wide)', () => {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const p = new THREE.Vector3();
    const inside = [];
    const layout = carLayout('fiesta');
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (!o.isMesh) return;
      for (let q = o; q; q = q.parent) if (/^wheel_|^mirror|^seatBack|^belt|^hatch/.test(q.name)) return;
      if (['3a3c3e'].includes(o.material.color.getHexString())) return; // the engine (under the bonnet, far from the rear wheels)
      const pos = o.geometry.attributes.position;
      const idx = o.geometry.index;
      const n = idx ? idx.count / 3 : pos.count / 3;
      for (let t = 0; t < n; t++) {
        const g = (k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
        a.fromBufferAttribute(pos, g(0)).applyMatrix4(o.matrixWorld);
        b.fromBufferAttribute(pos, g(1)).applyMatrix4(o.matrixWorld);
        c.fromBufferAttribute(pos, g(2)).applyMatrix4(o.matrixWorld);
        for (let i = 0; i <= 8; i++) {
          for (let j = 0; j <= 8 - i; j++) {
            const u = i / 8;
            const w = j / 8;
            p.set(a.x * (1 - u - w) + b.x * u + c.x * w, a.y * (1 - u - w) + b.y * u + c.y * w, a.z * (1 - u - w) + b.z * u + c.z * w);
            for (const wh of layout.wheels) {
              if (Math.abs(p.x - wh.x) > 0.07) continue;
              for (const cy of [FIESTA_BODY.R + 0.05, FIESTA_BODY.R + 0.0]) if (Math.hypot(p.y - cy, p.z - wh.z) < FIESTA_BODY.R - 0.01) inside.push(`${o.name || o.parent?.name} #${o.material.color.getHexString()} at ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`);
            }
          }
        }
      }
    });
    expect(inside.slice(0, 6)).toEqual([]);
  });

  it('shows no sky through the body below the window sills from any seat, with stand-in tyres at rest height', () => {
    const meshes = [];
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (!o.isMesh || !o.visible || o.isSprite || /^headlight/.test(o.name)) return;
      for (let q = o; q; q = q.parent) if (/^wheel_|^belt|^seatBack/.test(q.name)) return;
      meshes.push(o);
    });
    for (const wh of carLayout('fiesta').wheels) {
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(FIESTA_BODY.R, FIESTA_BODY.R, 0.145, 20).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial());
      tyre.position.set(wh.x, FIESTA_BODY.R + 0.05, wh.z);
      tyre.updateMatrixWorld(true);
      meshes.push(tyre);
    }
    const rc = new THREE.Raycaster();
    const holes = [];
    const eyes = [[FIESTA_BODY.seats.driver.x, 1.21, -0.38], [FIESTA_BODY.seats.left.x, 1.21, -0.38], [FIESTA_BODY.rear.rearLeft.x, 1.23, -1.08], [FIESTA_BODY.rear.rearRight.x, 1.23, -1.08]];
    for (const eye of eyes) {
      for (let tz = -1.55; tz <= 0.6; tz += 0.0397) {
        for (let ty = 0.42; ty <= 0.84; ty += 0.0397) {
          for (const side of [1, -1]) {
            const o = new THREE.Vector3(...eye);
            const target = new THREE.Vector3(side * 0.77, ty, tz);
            const d = target.clone().sub(o);
            const dist = d.length();
            rc.set(o, d.normalize());
            const h = rc.intersectObjects(meshes, false)[0];
            if (!h || Math.abs(h.point.x) > 0.82 || h.distance > dist + 0.12) holes.push(`eye ${eye} to z ${tz.toFixed(2)} y ${ty.toFixed(2)} side ${side}`);
          }
        }
      }
    }
    expect(holes.slice(0, 8)).toEqual([]);
  }, 60000);
});
