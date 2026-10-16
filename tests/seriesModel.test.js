import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildSeriesModel, poseSeriesDoors, poseSeriesTailgate } from '../src/vehicle/seriesModel.js';
import { SERIES_DASH, SERIES_END, SERIES_TUB, SERIES_TUB_SPOTS, SERIES_DOOR, SERIES_HITCH, SERIES_GATE, SERIES_SCREEN, SERIES_ROOF, screenZ, SERIES_SCREEN_TOP_Z } from '../src/vehicle/seriesBody.js';
import { setHeadlights } from '../src/vehicle/quadModel.js';
import { LANDY_LAYOUT, LANDY_SEATS } from '../src/vehicle/landRoverModel.js';
import { buildAllModels } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';

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

  it('puts the choke at the driver\'s end of the dash and the hand throttle beside the radio, both under the shelf and clear of the wheel', () => {
    const choke = at('chokeKnob');
    const hand = at('handThrottleKnob');
    expect(choke.x).toBeLessThan(-0.5); // by the driver
    expect(hand.x).toBeLessThan(SERIES_DASH.radio.x - SERIES_DASH.radio.w / 2); // to the driver's side of the radio
    expect(hand.x).toBeGreaterThan(-0.2);
    for (const k of [choke, hand]) {
      expect(k.y).toBeLessThan(SERIES_DASH.deck.y - SERIES_DASH.deck.t); // under the shelf
      expect(k.y).toBeGreaterThan(SERIES_DASH.tray.y + 0.06); // above the tray's height
    }
    expect(Math.abs(choke.x + 0.42)).toBeGreaterThan(0.21); // outside the wheel's rim, which is 0.21 m out from its column
  });

  it('has a radio standing proud of the shelf\'s lip, a gap under it, and the kit\'s wipers on the glass', () => {
    expect(SERIES_DASH.radio.z0).toBeLessThan(SERIES_DASH.deck.z0); // its face is in front of the lip
    expect(SERIES_DASH.radio.y + SERIES_DASH.radio.h / 2).toBeLessThan(SERIES_DASH.deck.y); // under the shelf
    expect(SERIES_DASH.radio.y - SERIES_DASH.radio.h / 2).toBeGreaterThan(SERIES_DASH.tray.y + 0.1); // with the tray's gap below
    const wipers = [];
    model.traverse((o) => { if (o.name === 'wiper') wipers.push(o); });
    expect(wipers).toHaveLength(2);
  });

  it('lights its sidelamps with the headlights, and has round rear lamps', () => {
    setHeadlights(model, true, 1);
    expect(model.userData.sideMaterial.emissive.getHex()).not.toBe(0);
    setHeadlights(model, false, 0);
    expect(model.userData.sideMaterial.emissive.getHex()).toBe(0);
  });

  it('moves the lights\' pull knob with the light switch and turns its key with the ignition', () => {
    const knob = model.getObjectByName('pullKnob');
    const key = model.getObjectByName('ignitionKey');
    const state = (over) => ({ ignition: true, keyOn: true, speedMph: 0, fuelLevel: 0.5, temperature: 80, rpm: 800, odoMiles: 100, indicatorLamps: {}, ...over });
    for (let i = 0; i < 30; i++) model.userData.dash.update(state({ lightLamps: { lights: false, main: false }, keyOn: false }));
    expect(knob.position.z).toBeCloseTo(0, 3);
    expect(key.rotation.z).toBeCloseTo(0, 2); // OFF, pointing up
    for (let i = 0; i < 30; i++) model.userData.dash.update(state({ lightLamps: { lights: true, main: false } }));
    const dipped = knob.position.z;
    for (let i = 0; i < 30; i++) model.userData.dash.update(state({ lightLamps: { lights: true, main: true } }));
    expect(dipped).toBeGreaterThan(0.005);
    expect(knob.position.z).toBeGreaterThan(dipped + 0.005);
    expect(key.rotation.z).toBeGreaterThan(0.5); // turned to ON
  });

  // The same checks as the 200TDi's (tests/defenderModel.test.js): rays at the sides and back from outside find no hole, and no visible faces fight.
  const firstHit = (origin, dir) => {
    model.updateMatrixWorld(true);
    const meshes = [];
    model.traverse((o) => { if (o.isMesh && o.visible && !o.isSprite && !/^headlight/.test(o.name)) meshes.push(o); });
    return new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...dir).normalize(), 0, 20).intersectObjects(meshes, false)[0] ?? null;
  };

  it('has no holes in its cab\'s sides or back (between the pillars and the quarter glass, round the rear window)', () => {
    const holes = [];
    for (const s of [1, -1]) {
      for (let z = -0.7; z <= 0.4; z += 0.0497) {
        for (let y = 0.7; y <= 1.84; y += 0.0497) {
          if (y > 1.3 && z > screenZ(y) - 0.03) continue; // in front of the screen's raked side post: open air
          const h = firstHit([s * 3, y, z], [-s, 0, 0]);
          if (!h || Math.abs(h.point.x) < 0.7) holes.push(`z ${z.toFixed(2)} y ${y.toFixed(2)}`);
        }
      }
    }
    for (let x = -0.8; x <= 0.8; x += 0.0497) {
      for (let y = 1.0; y <= 1.84; y += 0.0497) {
        const h = firstHit([x, y, -4], [0, 0, 1]);
        if (!h || h.point.z > -0.6) holes.push(`back x ${x.toFixed(2)} y ${y.toFixed(2)}`);
      }
    }
    expect(holes.slice(0, 12)).toEqual([]);
  }, 30000);

  it('has no two faces fighting for one plane where you can see them (the doors\' pieces, the sills, the scuttle)', () => {
    const fights = coplanarOverlaps(model, { gap: 0.002, minArea: 2e-5 }).filter((f) => f.area > 8e-4);
    expect(fights.slice(0, 8).map((f) => `${f.a}|${f.b} ${(f.area * 1e4).toFixed(0)} cm2 at ${f.at.map((v) => v.toFixed(2)).join(',')}`)).toEqual([]);
  });
});
