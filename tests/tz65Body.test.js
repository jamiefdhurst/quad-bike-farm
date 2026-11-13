import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { TZ_WHEELS, TZ_RAKE, forkZ, TZ_BARS_AT, TZ_FORK, TZ_FRONT_FENDER, TZ_FRAME, TZ_SIDE_BOARD, TZ_CARB, TZ_EXHAUST, TZ_ENGINE, TZ_SEAT, TZ_BARS } from '../src/vehicle/tz65Body.js';
import { EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';
import { CHOKE_STYLES, TAP_STYLES } from '../src/vehicle/controls.js';
import { DASH_STYLES } from '../src/vehicle/dash.js';
import { MAKER_FOR } from '../src/vehicle/detail/decals.js';
import { MOTO_LAYOUT } from '../src/vehicle/miniMotoModel.js';
import { buildAllModels } from './helpers/vehicleModels.js';

// The mini moto as a Tamura TZ 65 (TODO 94): the numbers read off the photos, the parts it must have by name, the
// choke and tap by the carb, no lights, and the front end turning about the bars' axis.

describe('the mini moto’s numbers', () => {
  it('put the wheels where the physics layout has them, a wheelbase of 1.05 m', () => {
    const z = MOTO_LAYOUT.wheels.map((w) => w.z);
    expect(z).toEqual([TZ_WHEELS.frontZ, TZ_WHEELS.rearZ]);
    expect(TZ_WHEELS.frontZ - TZ_WHEELS.rearZ).toBeCloseTo(1.05, 6);
  });

  it('rake the forks back 24 degrees and take them up to the bars’ clamp, not leave the bars out ahead of them', () => {
    expect(Math.atan(TZ_RAKE) * (180 / Math.PI)).toBeGreaterThan(22);
    expect(Math.atan(TZ_RAKE) * (180 / Math.PI)).toBeLessThan(28);
    expect(forkZ(TZ_WHEELS.radius)).toBeCloseTo(TZ_WHEELS.frontZ, 6);
    expect(Math.abs(forkZ(TZ_BARS_AT[1]) - TZ_BARS_AT[2])).toBeLessThan(0.05);
    expect(TZ_FORK.upperBottom).toBeLessThan(TZ_FORK.lowerTop); // the gold tubes slide down into the blue legs
    expect(TZ_FORK.upperTop).toBeGreaterThan(TZ_FORK.upperClamp);
  });

  it('keep the front fender clear of the tyre, high on the bike as the real one is', () => {
    for (const st of TZ_FRONT_FENDER) {
      const dz = st.z - TZ_WHEELS.frontZ;
      const tyreTop = Math.abs(dz) < TZ_WHEELS.radius ? TZ_WHEELS.radius + Math.sqrt(TZ_WHEELS.radius ** 2 - dz * dz) : 0;
      expect(st.y0 - tyreTop, `fender at z ${st.z}`).toBeGreaterThan(0.03);
    }
    expect(Math.max(...TZ_FRONT_FENDER.map((s) => s.z))).toBeLessThan(TZ_WHEELS.frontZ + TZ_WHEELS.radius);
  });

  it('join the frame’s tubes end to end', () => {
    const F = TZ_FRAME;
    expect(F.spar.at(-1)).toEqual(F.rear[0]);
    expect(F.seatRail[0]).toEqual(F.rear[0]);
    expect(F.cradle.at(-1)).toEqual(F.rear.at(-1));
  });

  it('keep the seat top at the rider’s anchor (0.78) and the grips at their fixed point', () => {
    const top = Math.max(...TZ_SEAT.filter((s) => s.z <= -0.18 && s.z >= -0.3).map((s) => s.y1));
    expect(top).toBeGreaterThan(0.73);
    expect(top).toBeLessThan(0.78);
    expect(TZ_BARS.grip).toEqual([0.27, 0.057, -0.036]);
  });

  it('leave the side boards behind the carb’s choke so the plunger shows, and the exhaust outboard of the board', () => {
    expect(TZ_CARB.plungerZ).toBeGreaterThan(Math.max(...TZ_SIDE_BOARD.outline.map(([z]) => z)));
    // The silencer clears the board's outer face (with its 3 mm bevel) along its whole length, and the pipe under the board stays outboard too.
    for (const [x, y] of [TZ_EXHAUST.can.from, TZ_EXHAUST.can.to]) {
      expect(Math.abs(x) - TZ_EXHAUST.can.r, `silencer at y ${y}`).toBeGreaterThan(TZ_SIDE_BOARD.x + 0.003);
    }
    const lowestBoardY = Math.min(...TZ_SIDE_BOARD.outline.map(([, y]) => y));
    const boardZ = TZ_SIDE_BOARD.outline.map(([z]) => z);
    for (const [x, y, z] of TZ_EXHAUST.path) if (y > lowestBoardY - 0.05 && z > Math.min(...boardZ) && z < Math.max(...boardZ)) expect(Math.abs(x), `pipe at y ${y}`).toBeGreaterThan(TZ_SIDE_BOARD.x);
    expect(TZ_EXHAUST.can.to[2]).toBeLessThan(TZ_WHEELS.rearZ + 0.1); // reaches back over the rear wheel
  });

  it('runs the pipe from the cylinder’s front face in a few plain bends, and ends it on the can', () => {
    expect(TZ_EXHAUST.path.length).toBeLessThanOrEqual(6);
    const [sx, sy, sz] = TZ_EXHAUST.path[0];
    const cy = TZ_ENGINE.cylinder; // the barrel leans forward, so its front face at the pipe's height is about here
    const front = cy.z + (sy - cy.y) * Math.tan(cy.lean) + cy.r / Math.cos(cy.lean);
    expect(Math.abs(sz - front), 'pipe starts at the barrel’s face').toBeLessThan(0.02);
    expect(TZ_EXHAUST.can.from).toEqual(TZ_EXHAUST.path[TZ_EXHAUST.path.length - 1]);
    // The long run along the right is straight: the middle points sit within 2 cm of the line between the ends of the run.
    const [a, b] = [TZ_EXHAUST.path[3], TZ_EXHAUST.path[4]];
    expect(Math.abs(a[0] - b[0])).toBeLessThan(0.02);
    expect(sx).toBeLessThan(0);
  });
});

describe('the mini moto’s spec', () => {
  const moto = EXTRA_SPECS.find((s) => s.id === 'tz65');

  it('names a dash, a choke on the carb, a tap by it, a Tamura badge, no lights and the cord alone', () => {
    expect(DASH_STYLES).toContain(moto.dashStyle);
    expect(CHOKE_STYLES).toContain(moto.chokeStyle);
    expect(TAP_STYLES).toContain(moto.tapStyle);
    expect(moto.chokeStyle).toBe('plunger');
    expect(moto.tapStyle).toBe('carbLeft');
    expect(moto.barLights).toBeFalsy();
    expect(MAKER_FOR.tz65).toBe('tamura');
    expect(moto.engine.pullStart).toBe(true);
    expect(moto.engine.noStarter).toBe(true);
    expect(moto.solo).toBe(true);
  });
});

describe('the mini moto’s model', () => {
  let moto;
  const world = (o) => o.getWorldPosition(new THREE.Vector3());
  beforeAll(async () => {
    moto = (await buildAllModels()).find((v) => v.id === 'tz65');
  });

  it('has its parts by name: the controls, the engine in the open, the exhaust, the stickers and the pull starter', () => {
    const m = moto.model;
    for (const n of ['handlebars', 'gripLeft', 'gripRight', 'riderHands', 'dash', 'podMount', 'chokeLever', 'chokeKnob', 'fuelTap', 'fuelTapBody', 'carb', 'crankcase', 'recoilStarter', 'recoilHandle', 'chamber', 'silencer', 'exhaustTip', 'seat', 'swingarm', 'shroud', 'sideBoard', 'numberPlate', 'frontFender', 'brakeCaliper', 'badge', 'stripe', 'pegLeft', 'pegRight', 'wheel_fl', 'wheel_rl']) {
      expect(m.getObjectByName(n), n).toBeTruthy();
    }
  });

  it('has no lamp: nothing takes the headlamp lens’s material, and there is no lights switch or number on the plate', () => {
    moto.model.traverse((o) => {
      if (o.isMesh && o.material === moto.model.userData.lensMaterial) throw new Error(`a lamp lens: ${o.name}`);
    });
    for (const n of ['headlight', 'lightsRocker', 'stopRocker', 'thumbThrottle']) expect(moto.model.getObjectByName(n), `no ${n}`).toBeFalsy();
  });

  it('has the choke knob out to the carb’s left, pulling out along x by 9 cm, clear of the side board', () => {
    const lever = moto.model.getObjectByName('chokeLever');
    const carb = world(moto.model.getObjectByName('carb'));
    expect(world(lever).x).toBeGreaterThan(carb.x + TZ_CARB.r + 0.02);
    expect(lever.userData.travel).toBeGreaterThanOrEqual(0.08);
    const before = world(lever).x;
    lever.position.y = -lever.userData.travel;
    lever.parent.updateMatrixWorld(true);
    expect(world(lever).x).toBeGreaterThan(before + 0.08);
    lever.position.y = 0;
    lever.parent.updateMatrixWorld(true);
  });

  it('turns its front end about the bars’ axis: the pivot is the bars’ z, the gold tubes are with the bars and the blue legs with the wheel', () => {
    expect(moto.model.userData.steerPivotZ).toBe(TZ_BARS_AT[2]);
    expect(moto.model.userData.steerGain).toBe(1);
    const bars = moto.model.getObjectByName('handlebars');
    const wheel = moto.model.getObjectByName('wheel_fl');
    expect(wheel.getObjectByName('frontFender')).toBeTruthy();
    expect(bars.getObjectByName('numberPlate')).toBeTruthy();
    expect(bars.getObjectByName('frontFender')).toBeFalsy();
  });

  it('has risers from the top clamp up to the bars, so the bars are not floating', () => {
    const bars = moto.model.getObjectByName('handlebars');
    bars.updateMatrixWorld(true);
    const bar = TZ_BARS_AT[1] + TZ_BARS.half[4][1] - 0.0108; // the bar's underside where the risers hold it
    for (const riser of bars.children.filter((o) => o.name === 'barRiser')) {
      const box = new THREE.Box3().setFromObject(riser);
      expect(box.max.y).toBeGreaterThanOrEqual(bar); // up to the bar (into it)
      expect(box.min.y).toBeLessThan(TZ_FORK.upperClamp + 0.01); // down to the clamp
    }
    expect(bars.children.filter((o) => o.name === 'barRiser').length).toBe(2);
  });

  it('keeps the bars at their fixed height and the dash on the clamp', () => {
    const bars = moto.model.getObjectByName('handlebars');
    expect(world(bars).toArray().map((v) => +v.toFixed(3))).toEqual(TZ_BARS_AT);
    expect(world(bars.getObjectByName('dash')).y).toBeCloseTo(0.904, 3);
  });
});
