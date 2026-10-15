import { describe, it, expect, beforeAll } from 'vitest';
import { buildAllModels } from './helpers/vehicleModels.js';
import { poseBarPod, POD } from '../src/vehicle/foremanControls.js';
import { LightSwitch, LIGHT_MODES } from '../src/vehicle/lightSwitch.js';
import { CHOKE_STYLES, chokeReach } from '../src/vehicle/controls.js';
import { poseParkBrake } from '../src/vehicle/quadModel.js';

// The red quad's bar controls (TODO 88): the switch pod, the levers, the 2WD / 4WD rocker.
let red;
beforeAll(async () => {
  red = (await buildAllModels()).find((v) => v.id === 'red');
});

describe('the red quad’s switch pod', () => {
  it('has the lights, HI / LO and engine-stop rockers, the start button and a sliding choke, each by name', () => {
    for (const n of ['controlPod', 'lightsRocker', 'beamRocker', 'stopRocker', 'startButton', 'chokeLever', 'driveSwitchRocker', 'parkBrakeLever', 'parkBrakeCatch']) {
      expect(red.model.getObjectByName(n), n).toBeTruthy();
    }
    expect(red.model.getObjectByName('chokeLever').userData.baseX).toBeTypeOf('number');
  });

  it('poses the rockers for each lights position: ON with the bottom in, HI with the top in, RUN when the key is on', () => {
    const lights = red.model.getObjectByName('lightsRocker');
    const beam = red.model.getObjectByName('beamRocker');
    const stop = red.model.getObjectByName('stopRocker');
    poseBarPod(red.model, { lights: 'off', keyOn: false });
    expect(lights.rotation.x).toBeCloseTo(-POD.rock);
    expect(beam.rotation.x).toBeCloseTo(POD.rock); // LO
    const off = stop.rotation.y;
    poseBarPod(red.model, { lights: 'low', keyOn: true });
    expect(lights.rotation.x).toBeCloseTo(POD.rock);
    expect(stop.rotation.y).toBeGreaterThan(off);
    poseBarPod(red.model, { lights: 'high', keyOn: true });
    expect(beam.rotation.x).toBeCloseTo(-POD.rock);
  });

  it('presses the start button in while cranking, and lets it out again', () => {
    const start = red.model.getObjectByName('startButton');
    poseBarPod(red.model, { cranking: false });
    const z = start.position.z;
    poseBarPod(red.model, { cranking: true });
    expect(start.position.z).toBeLessThan(z);
    poseBarPod(red.model, { cranking: false });
    expect(start.position.z).toBeCloseTo(z);
  });

  it('keeps the parking brake working: squeezed in, and the latch shows only while it holds', () => {
    const lever = red.model.getObjectByName('parkBrakeLever');
    const latch = red.model.getObjectByName('parkBrakeCatch');
    poseParkBrake(red.model, 0);
    expect(latch.visible).toBe(false);
    poseParkBrake(red.model, 1);
    expect(lever.rotation.y).toBeGreaterThan(0.1);
    expect(latch.visible).toBe(true);
  });

  it('is reached like a thumb lever: always in reach, with full steering', () => {
    expect(CHOKE_STYLES).toContain('slide');
    expect(chokeReach('slide', 15)).toEqual({ ok: true, steer: 1 });
  });
});

describe('the red quad’s light switch', () => {
  it('starts dipped and cycles dipped, main beam, off, dipped', () => {
    const sw = new LightSwitch('low');
    expect(sw.mode).toBe('low');
    expect(LIGHT_MODES.map(() => sw.cycle())).toEqual(['high', 'off', 'low']);
  });
});

describe('the red quad’s thumb throttle', () => {
  it('has a paddle that the throttle pushes forward, and lets back at zero', async () => {
    const { poseThumbThrottle } = await import('../src/vehicle/foremanControls.js');
    const lever = red.model.getObjectByName('thumbThrottle');
    expect(lever).toBeTruthy();
    poseThumbThrottle(red.model, 0);
    expect(lever.rotation.x).toBe(0);
    poseThumbThrottle(red.model, 1);
    expect(lever.rotation.x).toBeGreaterThan(0.3);
  });
});
