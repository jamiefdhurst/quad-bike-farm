import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { Wipers, girlWiperSetting, WIPER_PARAMS } from '../src/vehicle/wipers.js';
import { wiperGeometry, poseWipers } from '../src/vehicle/wiperModel.js';
import { createScreenRain, wipeSector, addDrop, onGlass } from '../src/effects/screenRain.js';
import { isOpenVehicle } from '../src/effects/lensMud.js';
import { buildAllModels } from './helpers/vehicleModels.js';

const run = (w, seconds, powered = true, dt = 1 / 60) => {
  let most = 0;
  for (let t = 0; t < seconds; t += dt) most = Math.max(most, w.update(dt, powered));
  return most;
};

describe('the wiper stalk', () => {
  it('steps through its speeds and back to off', () => {
    const w = new Wipers(['int', 'slow', 'fast']);
    expect([w.step(), w.step(), w.step(), w.step()]).toEqual(['int', 'slow', 'fast', 'off']);
    expect(new Wipers(['slow']).positions()).toEqual(['off', 'slow']);
  });

  it('sweeps across and back, and parks when switched off mid-sweep', () => {
    const w = new Wipers(['slow', 'fast']);
    w.set('slow');
    expect(run(w, WIPER_PARAMS.slowCycle * 0.5)).toBeGreaterThan(0.95); // at the far end by half a wipe
    w.set('off');
    expect(w.running).toBe(true); // still going home
    run(w, WIPER_PARAMS.slowCycle);
    expect(w.blade).toBe(0);
    expect(w.running).toBe(false);
  });

  it('keeps wiping on slow and fast after being parked on intermittent (found testing #512)', () => {
    for (const next of ['slow', 'fast']) {
      const w = new Wipers(['int', 'slow', 'fast']);
      w.set('int');
      run(w, WIPER_PARAMS.slowCycle * 1.2); // one wipe, now parked and waiting out the pause
      expect(w.blade).toBe(0);
      w.set(next);
      let sweeps = 0;
      let high = false;
      for (let t = 0; t < 6; t += 0.05) {
        w.update(0.05, true);
        if (w.blade > 0.9 && !high) sweeps++;
        high = w.blade > 0.9;
      }
      expect(sweeps, next).toBeGreaterThanOrEqual(3);
    }
  });

  it('stops dead with the ignition off', () => {
    const w = new Wipers(['slow']);
    w.set('slow');
    run(w, 0.3);
    const at = w.blade;
    run(w, 2, false);
    expect(w.blade).toBe(at);
  });

  it('pauses between wipes on intermittent, and fast is quicker than slow', () => {
    const w = new Wipers(['int', 'slow', 'fast']);
    w.set('int');
    run(w, WIPER_PARAMS.slowCycle + 0.05);
    run(w, WIPER_PARAMS.intPause * 0.5);
    expect(w.blade).toBe(0); // waiting
    expect(run(w, WIPER_PARAMS.intPause * 0.5 + WIPER_PARAMS.slowCycle * 0.6)).toBeGreaterThan(0.9); // and off again
    const fast = new Wipers(['slow', 'fast']);
    fast.set('fast');
    expect(run(fast, WIPER_PARAMS.fastCycle * 0.5)).toBeGreaterThan(0.95);
    expect(WIPER_PARAMS.fastCycle).toBeLessThan(WIPER_PARAMS.slowCycle);
  });

  it('a girl driving picks the speed for the rain from what the stalk has', () => {
    expect(girlWiperSetting(0, ['int', 'slow', 'fast'])).toBe('off');
    expect(girlWiperSetting(0.15, ['int', 'slow', 'fast'])).toBe('int');
    expect(girlWiperSetting(0.15, ['slow', 'fast'])).toBe('slow');
    expect(girlWiperSetting(0.5, ['int', 'slow', 'fast'])).toBe('slow');
    expect(girlWiperSetting(0.9, ['int', 'slow', 'fast'])).toBe('fast');
    expect(girlWiperSetting(0.9, ['slow'])).toBe('slow');
  });
});

describe('every vehicle with a windscreen has wipers that clear it', () => {
  let built;
  beforeAll(async () => {
    built = await buildAllModels();
  });

  it('has speeds on the spec and two front wipers (one on the UTV) over its rain glass', () => {
    const closed = built.filter((b) => !isOpenVehicle(b.spec.id));
    expect(closed.map((b) => b.spec.id).sort()).toEqual(['corsa', 'fiesta', 'landrover', 'landrover200', 'p309', 'utv']);
    for (const { spec, model } of closed) {
      expect(spec.wipers?.length, spec.id).toBeGreaterThan(0);
      const geo = wiperGeometry(model);
      expect(geo.length, spec.id).toBe(spec.id === 'utv' ? 1 : 2);
      const panes = model.getObjectByName('rainGlass').userData.panes;
      const glass = createScreenRain(panes);
      for (const w of geo) {
        expect(w.rOut - w.rIn, spec.id).toBeGreaterThan(0.25); // a real length of blade
        // Its spindle is just off the glass's foot, and half way through the sweep the blade's middle is on the glass.
        const a = w.park + w.sweep * 0.5;
        const r = (w.rIn + w.rOut) / 2;
        expect(onGlass(glass, w.px + r * Math.cos(a), w.py + r * Math.sin(a)), spec.id).toBe(true);
      }
    }
  });

  it('turns the blades across the glass and clears most of the drops on it', () => {
    for (const { spec, model } of built.filter((b) => b.spec.wipers)) {
      const glass = createScreenRain(model.getObjectByName('rainGlass').userData.panes);
      const geo = wiperGeometry(model);
      let n = 0;
      for (let i = 0; i < 400; i++) {
        const [x0, y0, x1, y1] = glass.box;
        const x = x0 + ((i * 0.6180339) % 1) * (x1 - x0);
        const y = y0 + ((i * 0.7548776) % 1) * (y1 - y0);
        if (onGlass(glass, x, y)) addDrop(glass, x, y, 0.0005, { maxDrops: 1000 }), n++;
      }
      for (const w of geo) for (let b = 0; b < 1; b += 0.05) wipeSector(glass, w, b, b + 0.05);
      // About half the glass or more, the edges and the top corners left wet as on the real thing, and none of the patch the driver looks
      // through: in line with the seat, a little below the middle where the road ahead is seen.
      expect(glass.drops.length / n, spec.id).toBeLessThan(spec.id === 'utv' ? 0.65 : 0.55); // (the UTV's one blade does the driver's side)
      const eye = model.getObjectByName('riderAnchor').getWorldPosition(new THREE.Vector3());
      const glassAt = model.getObjectByName('rainGlass').worldToLocal(eye);
      const view = glass.drops.filter((d) => Math.abs(d.x - glassAt.x) < 0.08 && Math.abs(d.y - (glass.box[1] * 0.6 + glass.box[3] * 0.4)) < 0.07);
      expect(view.length, `${spec.id}: drops left in front of the driver`).toBe(0);
      const wiper = model.userData.sweepers[0];
      const parked = wiper.rotation.z;
      poseWipers(model, 1);
      expect(Math.abs(wiper.rotation.z - parked), spec.id).toBeGreaterThan(1.3);
      poseWipers(model, 0);
    }
  });
});

describe('the console soaks and dries a windscreen', () => {
  it('calls the game\'s soak and dry, and says when the vehicle has no windscreen', async () => {
    const { createHost, VEHICLE_VERBS } = await import('../src/console/gameHost.js');
    const calls = [];
    const units = [{ id: 'fiesta' }, { id: 'red' }];
    const g = { units, companions: [], world: { layout: {} }, debugScreenRain: (u, what) => (calls.push([u.id, what]), u.id === 'fiesta') };
    const host = createHost(g);
    expect(VEHICLE_VERBS.map((v) => v.name)).toEqual(expect.arrayContaining(['soak', 'dry']));
    expect(host.vehicleVerb('fiesta', 'soak')).toBe('fiesta: soak');
    expect(host.vehicleVerb('fiesta', 'dry')).toBe('fiesta: dry');
    expect(host.vehicleVerb('red', 'soak')).toBe('red has no windscreen');
    expect(calls).toEqual([['fiesta', 'soak'], ['fiesta', 'clear'], ['red', 'soak']]);
  });

  it('a stalk moving is heard: set marks it for the click and the next update clears it', () => {
    const w = new Wipers(['slow']);
    w.set('slow');
    expect(w.moved).toBe(true);
    w.update(1 / 60, true);
    expect(w.moved).toBe(false);
    w.set('slow'); // already there: no click
    expect(w.moved).toBe(false);
  });
});
