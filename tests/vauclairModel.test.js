import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { build309Model, pose309Hatch, dentGeometry, onDoor, halfAt } from '../src/vehicle/vauclairModel.js';
import { VAUCLAIR_CLUSTER } from '../src/vehicle/dash.js';
import { poseTorDoors } from '../src/vehicle/torModel.js';
import { poseCarControls, carLayout } from '../src/vehicle/carModel.js';
import { VAUCLAIR_BODY, VAUCLAIR_DOOR, VAUCLAIR_HATCH, VAUCLAIR_DENTS, VAUCLAIR_SHELF } from '../src/vehicle/vauclairBody.js';
import { MAKERS, MAKER_FOR } from '../src/vehicle/detail/decals.js';
import { buildAllModels } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';

// Your 309 (#229): the Finch's checks (tests/finchModel.test.js) on the longer, lower car with its bustle, plus what makes it yours.
let model;
beforeAll(async () => {
  await buildAllModels(); // stubs the canvas for the dash and the trim
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true }), style: {} }) });
  model = build309Model({});
  model.updateMatrixWorld(true);
});

const C = VAUCLAIR_BODY;
const LIFT = 0.05; // the body stands this far up on its wheels: world y is the numbers' y plus this

describe('your 309 at its real size', () => {
  it('has the parts the game looks for, the doors, the hatch and its struts, the pedals, and no choke you can see', () => {
    for (const n of ['bodyRoot', 'riderAnchor', 'seatLeft', 'seatRearLeft', 'seatRearRight', 'cameraAnchor', 'parkBrakeLever', 'chokeKnob', 'gearLever', 'handlebars', 'exhaustTip', 'seatBack_left', 'seatBack_driver',
      'doorLeft', 'doorRight', 'hatch', 'hatchStrutLeft', 'hatchStrutRight', 'pedalClutch', 'pedalBrake', 'pedalAccel', 'hazardSwitch', 'radio_cassette', 'ignitionKey', 'aerial']) {
      expect(model.getObjectByName(n), n).toBeTruthy();
    }
    expect(model.getObjectByName('chokeKnob').visible).toBe(false); // a diesel: glow plugs on the key
    expect(model.userData.carKind).toBe('vauclair');
  });

  it('wears the made-up maker on its badges, never the real one', () => {
    expect(MAKER_FOR.vauclair).toBe('vauclair');
    expect(MAKERS.vauclair.name).toBe('Vauclair');
  });

  it('has its doors hinge on their front edges and swing out at their own side', () => {
    const left = model.getObjectByName('doorLeft');
    const right = model.getObjectByName('doorRight');
    expect(left.position.z).toBeCloseTo(VAUCLAIR_DOOR.hinge, 3);
    poseTorDoors(model, { left: 1, right: 0 });
    expect(left.rotation.y).toBeLessThan(-1);
    expect(right.rotation.y).toBe(0);
    poseTorDoors(model, { left: 0, right: 1 });
    expect(right.rotation.y).toBeGreaterThan(1);
    poseTorDoors(model, { left: 0, right: 0 });
  });

  it('lifts its hatch, the bustle and the tail lamps with it, up and back, the struts following', () => {
    const hatch = model.getObjectByName('hatch');
    const foot = () => new THREE.Vector3(0, -(C.roofRear[1] - VAUCLAIR_HATCH.foot), C.tail - C.roofRear[0]).applyMatrix4(hatch.matrixWorld);
    pose309Hatch(model, 0);
    model.updateMatrixWorld(true);
    const shut = foot();
    pose309Hatch(model, 1);
    model.updateMatrixWorld(true);
    const open = foot();
    expect(open.y).toBeGreaterThan(shut.y + 0.5);
    for (const n of ['hatchStrutLeft', 'hatchStrutRight']) expect(model.getObjectByName(n).scale.z).toBeGreaterThan(0.3);
    pose309Hatch(model, 0);
    model.updateMatrixWorld(true);
  });

  it('puts the pedals right-hand-drive and works them', () => {
    const x = (n) => model.getObjectByName(n).position.x;
    expect(x('pedalClutch')).toBeGreaterThan(x('pedalBrake'));
    expect(x('pedalBrake')).toBeGreaterThan(x('pedalAccel'));
    for (let i = 0; i < 20; i++) poseCarControls(model, { clutch: 1, brake: 0, throttle: 0.5 });
    expect(model.getObjectByName('pedalClutch').rotation.x).toBeLessThan(-0.2);
    for (let i = 0; i < 20; i++) poseCarControls(model, {});
  });

  it('powers its radio with the key and the radio on, its switch pushed in, and turns its key', () => {
    const state = (over) => ({ ignition: true, keyOn: true, speedMph: 0, fuelLevel: 0.5, temperature: 80, rpm: 800, odoMiles: 100, indicatorLamps: {}, lightLamps: { lights: false, main: false }, clock: '07:45', ...over });
    for (let i = 0; i < 30; i++) model.userData.dash.update(state({ keyOn: false }));
    const radio = model.getObjectByName('radio_cassette');
    const push = model.getObjectByName('pushRadio');
    const out = push.position.z;
    expect(radio.userData.powered).toBe(false);
    for (let i = 0; i < 30; i++) model.userData.dash.update(state({ radioOn: true }));
    expect(radio.userData.powered).toBe(true);
    expect(push.position.z).toBeGreaterThan(out + 0.004);
    expect(model.getObjectByName('ignitionKey').rotation.z).toBeGreaterThan(0.5);
  });

  it("is lived in: bottles in the driver's door pocket (so they swing with the door), CD cases in the tray, and dents in the panels", () => {
    const door = model.getObjectByName('doorRight');
    let bottles = 0;
    door.traverse((o) => { if (o.name === 'bottle') bottles++; });
    expect(bottles).toBe(2);
    expect(model.userData.tray).toBeTruthy();
    expect(VAUCLAIR_DENTS.length).toBeGreaterThanOrEqual(2);
    // A dent's normals bow in from the panel's: lit as a hollow, its middle facing straight out.
    const g = dentGeometry(0.08, 0.8);
    const n = g.attributes.normal;
    expect(n.getX(0)).toBeCloseTo(1, 5);
    const p = g.attributes.position;
    let tipped = 0;
    for (let i = 1; i < n.count; i++) {
      tipped = Math.max(tipped, Math.hypot(n.getY(i), n.getZ(i)));
      expect(n.getY(i) * p.getY(i) + n.getZ(i) * p.getZ(i), `vertex ${i}`).toBeLessThanOrEqual(1e-9); // towards the middle: a hollow, not a bump
    }
    expect(tipped).toBeGreaterThan(0.3);
  });

  const upperLine = (z) => {
    const u = C.upper;
    for (let i = 1; i < u.length; i++) if (z >= u[i][0]) return u[i - 1][1] + ((u[i][1] - u[i - 1][1]) * (u[i - 1][0] - z)) / (u[i - 1][0] - u[i][0]);
    return u[u.length - 1][1];
  };

  const firstHit = (origin, dir) => {
    model.updateMatrixWorld(true);
    const meshes = [];
    model.traverse((o) => { if (o.isMesh && o.visible && !o.isSprite && !/^headlight/.test(o.name)) meshes.push(o); });
    return new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...dir).normalize(), 0, 20).intersectObjects(meshes, false)[0] ?? null;
  };

  it('has no holes in its sides, from the nose to the tail below the belt line, and through the cabin up to the roof (the arches excepted)', () => {
    const holes = [];
    const [zs, ys] = C.screenBase;
    const [zt, yt] = C.screenTop;
    for (const s of [1, -1]) {
      for (let z = C.tail + 0.0117; z <= C.nose - 0.05; z += 0.0497) {
        for (let y = 0.3513; y <= 1.3; y += 0.0497) {
          const front = zs - (y - (ys + LIFT)) * ((zs - zt) / (yt - ys)); // the A pillar's line
          const cabin = z < front - 0.08 && z > -1.15;
          if (y > upperLine(z) + LIFT - 0.03 && !cabin) continue; // over the bonnet and the deck: open air above the line
          if (y < 0.74 && Math.abs(Math.abs(z) - C.wheelbase / 2) < 0.39) continue; // an arch
          const h = firstHit([s * 3, y, z], [-s, 0, 0]);
          const lean = C.width / 2 - 0.05 - Math.max(0, y - ys - LIFT) * C.tumble - 0.06;
          if (!h || Math.abs(h.point.x) < lean) holes.push(`side ${s} z ${z.toFixed(2)} y ${y.toFixed(2)}`);
        }
      }
    }
    expect(holes.slice(0, 12)).toEqual([]);
  }, 40000);

  it('has no holes in its back or its front (round the hatch, the lamps, the bumpers, the grille)', () => {
    const holes = [];
    for (let x = -0.7517; x <= 0.75; x += 0.0497) {
      for (let y = 0.3113; y <= 1.2; y += 0.0497) { // from the bumpers' bottoms: below is the open under-body
        if (y >= 0.93 && Math.abs(x) >= 0.55) continue; // above the deck, outside the glass: open air
        const h = firstHit([x, y, -4], [0, 0, 1]);
        if (!h || h.point.z > -1.2) holes.push(`back x ${x.toFixed(2)} y ${y.toFixed(2)}`);
        if (y > 0.74) continue;
        const f = firstHit([x, y, 4], [0, 0, -1]);
        if (!f || f.point.z < C.nose - 0.3) holes.push(`front x ${x.toFixed(2)} y ${y.toFixed(2)}`);
      }
    }
    expect(holes.slice(0, 12)).toEqual([]);
  }, 40000);

  it('has no two faces fighting for one plane where you can see them', () => {
    const fights = coplanarOverlaps(model, { gap: 0.003, minArea: 2e-5 }).filter((f) => f.area > 3e-4);
    expect(fights.slice(0, 8).map((f) => `${f.a}|${f.b} ${(f.area * 1e4).toFixed(0)} cm2 at ${f.at.map((v) => v.toFixed(2)).join(',')}`)).toEqual([]);
  });

  it('has nothing of its body inside the tyres, at rest or at full bump', () => {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const p = new THREE.Vector3();
    const inside = [];
    const layout = carLayout('vauclair');
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (!o.isMesh) return;
      for (let q = o; q; q = q.parent) if (/^wheel_|^mirror|^seatBack|^belt|^hatch|^door/.test(q.name)) return;
      if (['3a3c3e'].includes(o.material.color.getHexString())) return; // the engine
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
              if (Math.abs(p.x - wh.x) > 0.08) continue;
              for (const cy of [C.R + 0.05, C.R]) if (Math.hypot(p.y - cy, p.z - wh.z) < C.R - 0.01) inside.push(`${o.name || o.parent?.name} #${o.material.color.getHexString()} at ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`);
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
    for (const wh of carLayout('vauclair').wheels) {
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(C.R, C.R, 0.165, 20).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial());
      tyre.position.set(wh.x, C.R + 0.05, wh.z);
      tyre.updateMatrixWorld(true);
      meshes.push(tyre);
    }
    const rc = new THREE.Raycaster();
    const holes = [];
    const eye = (s) => [s.x, s.y + LIFT + 0.66, s.z + 0.02];
    for (const e of [eye(C.seats.driver), eye(C.seats.left), eye(C.rear.rearLeft), eye(C.rear.rearRight)]) {
      for (let tz = -1.75; tz <= 0.7; tz += 0.0397) {
        for (let ty = 0.42; ty <= 0.88; ty += 0.0397) {
          for (const side of [1, -1]) {
            const o = new THREE.Vector3(...e);
            const target = new THREE.Vector3(side * 0.79, ty, tz);
            const d = target.clone().sub(o);
            const dist = d.length();
            rc.set(o, d.normalize());
            const h = rc.intersectObjects(meshes, false)[0];
            if (!h || Math.abs(h.point.x) > 0.84 || h.distance > dist + 0.12) holes.push(`eye ${e.map((v) => v.toFixed(2))} to z ${tz.toFixed(2)} y ${ty.toFixed(2)} side ${side}`);
          }
        }
      }
    }
    expect(holes.slice(0, 8)).toEqual([]);
  }, 60000);

  // Jamie's first look (#491) ---------------------------------------------------------------------------------------------------------------

  it('keeps the mud out of the inside: the vents and the rest of the dark fittings in there are clean materials', () => {
    const clean = new Set(model.userData.cleanMaterials);
    const vents = [];
    model.traverse((o) => { if (o.isMesh && o.name === 'vent') vents.push(o); });
    expect(vents.length).toBeGreaterThanOrEqual(4);
    for (const v of vents) expect(clean.has(v.material)).toBe(true);
    for (const n of ['pedalClutch', 'gearLever', 'parkBrakeLever']) model.getObjectByName(n).traverse((o) => { if (o.isMesh) expect(clean.has(o.material), n).toBe(true); });
  });

  it('puts the tray clear of the vents either side of it', () => {
    const t = model.userData.tray;
    const box = new THREE.Box3();
    model.traverse((o) => {
      if (!o.isMesh || o.name !== 'vent') return;
      box.setFromObject(o);
      const clear = box.max.x < t.x - t.half - 0.01 || box.min.x > t.x + t.half + 0.01;
      expect(clear, `vent ${box.min.x.toFixed(2)} to ${box.max.x.toFixed(2)}`).toBe(true);
    });
  });

  it('lays out its cluster with nothing running into anything else', () => {
    const { speedo, clock, fuel, water, pockets, lamps } = VAUCLAIR_CLUSTER;
    const left = (d) => d.cx - d.r - 2; // (a dial's black rim is 2 px proud of its face)
    const right = (d) => d.cx + d.r + 2;
    expect(left(speedo)).toBeGreaterThan(pockets[0] + 34 + 3);
    expect(right(speedo)).toBeLessThan(lamps[0] - 3);
    expect(left(clock)).toBeGreaterThan(lamps[1] + 3);
    expect(right(clock)).toBeLessThan(pockets[1] - 3);
    for (const [g, x] of [[fuel, pockets[0]], [water, pockets[1]]]) {
      expect(g.cx - g.r).toBeGreaterThan(x);
      expect(g.cx + g.r).toBeLessThan(x + 34);
    }
  });

  it('puts the dents on the doors in the doors, so they swing with them, and keeps every dent off the arches and the shut lines', () => {
    for (const d of VAUCLAIR_DENTS) {
      for (const zc of [C.wheelbase / 2, -C.wheelbase / 2]) expect(Math.hypot(d.z - zc, d.y - (C.R + 0.03)), `dent at ${d.z}`).toBeGreaterThan(C.R + 0.07 + d.r + 0.02);
      for (const edge of [VAUCLAIR_DOOR.hinge, VAUCLAIR_DOOR.rear]) expect(Math.abs(d.z - edge), `dent at ${d.z}`).toBeGreaterThan(d.r + 0.02);
    }
    const doorDents = (name) => { let n = 0; model.getObjectByName(name).traverse((o) => { if (o.name === 'dent') n++; }); return n; };
    expect(doorDents('doorLeft')).toBe(VAUCLAIR_DENTS.filter((d) => d.side > 0 && onDoor(d)).length);
    expect(doorDents('doorRight')).toBe(VAUCLAIR_DENTS.filter((d) => d.side < 0 && onDoor(d)).length);
    expect(doorDents('doorLeft')).toBeGreaterThan(0);
  });

  it('paints its fuel flap', () => {
    const flap = model.getObjectByName('fuelFlap');
    expect(flap.material.color.getHex()).not.toBe(0x1b1c1d);
    expect(flap.material).toBe(model.getObjectByName('wing').material);
  });

  it('keeps its parcel shelf under the glass and the deck, behind the seat back, and inside the back belts', () => {
    const deckUnder = (z) => (z <= C.hatchBottom[0] ? upperLine(z) : C.roofRear[1] + ((C.hatchBottom[1] - C.roofRear[1]) * (z - C.roofRear[0])) / (C.hatchBottom[0] - C.roofRear[0])) - 0.03;
    for (const z of [VAUCLAIR_SHELF.front, VAUCLAIR_SHELF.back]) expect(VAUCLAIR_SHELF.y + 0.006, `z ${z}`).toBeLessThan(deckUnder(z) - 0.01);
    expect(VAUCLAIR_SHELF.back).toBeGreaterThan(C.tail + 0.2); // nowhere near the tail
    expect(VAUCLAIR_SHELF.half).toBeLessThan(halfAt(C.rear.rearLeft.y + 0.6) - 0.03 - 0.03); // the back belts' tops hang outside it
  });

  it('keeps its hatch struts inside the body at every point of the hatch\'s swing', () => {
    const [, yr] = C.roofRear;
    for (const open of [0, 0.25, 0.5, 0.75, 1]) {
      pose309Hatch(model, open);
      model.updateMatrixWorld(true);
      for (const n of ['hatchStrutLeft', 'hatchStrutRight']) {
        const strut = model.getObjectByName(n);
        for (let t = 0; t <= 1; t += 0.1) {
          const p = new THREE.Vector3(0, 0, t).applyMatrix4(strut.matrixWorld); // along the strut (its length is its z scale)
          const y = p.y - LIFT;
          if (y > yr) continue; // up in the opening the hatch has left: open air
          expect(Math.abs(p.x), `${n} open ${open} at ${p.toArray().map((v) => v.toFixed(2))}`).toBeLessThan(halfAt(y) - 0.04);
        }
      }
    }
    pose309Hatch(model, 0);
    model.updateMatrixWorld(true);
  });
});

