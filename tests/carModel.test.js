import { describe, it, expect, vi, beforeAll } from 'vitest';
import { buildCarModel, carLayout, sideShape, poseCarControls, poseCarSeats, carEyeToGlass, carDashThroughWheel, CARS, CAR_GROUND_OFFSET } from '../src/vehicle/carModel.js';
import { landyEyeToGlass } from '../src/vehicle/landRoverModel.js';
import { poseUtvBelts } from '../src/vehicle/utvModel.js';
import { FIESTA_SPEC, CORSA_SPEC } from '../src/vehicle/quadSpecs.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { DASH_STYLES } from '../src/vehicle/dash.js';
import { AUDIO_PARAM_RANGES, DEFAULT_AUDIO_PARAMS } from '../src/audio/audioParams.js';

// A canvas that accepts every drawing call and does nothing, so the models (whose dash, trim and plates are drawn on canvases) build in node.
function fakeCanvas() {
  const ctx = new Proxy({ canvas: null }, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {}, width: 10 })), set: (t, k, v) => ((t[k] = v), true) });
  return { width: 0, height: 0, getContext: () => ctx, style: {} };
}

describe.each([['fiesta', FIESTA_SPEC], ['corsa', CORSA_SPEC]])('%s', (kind, spec) => {
  let model;
  beforeAll(() => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    model = buildCarModel({ kind, bodyColor: spec.bodyColor, dashStyle: spec.dashStyle });
    model.updateMatrixWorld(true);
  });

  it('has the parts the rest of the game looks for, and four seats with a belt each', () => {
    for (const n of ['bodyRoot', 'riderAnchor', 'seatLeft', 'seatRearLeft', 'seatRearRight', 'cameraAnchor', 'cameraLeft', 'cameraRearLeft', 'cameraRearRight',
      'parkBrakeLever', 'chokeKnob', 'gearLever', 'handlebars', 'gripLeft', 'gripRight', 'riderHands', 'exhaustTip', 'seatBack_left', 'seatBack_driver', 'fuelTap', 'chokeLever']) {
      expect(model.getObjectByName(n), n).toBeTruthy();
    }
    expect(model.getObjectByName('seatMid')).toBeFalsy(); // two in front, not a bench
    const belted = { driver: true, left: false, rearLeft: true, rearRight: false };
    poseUtvBelts(model, belted);
    for (const [seat, on] of Object.entries(belted)) expect(model.getObjectByName(`belt_${seat}`).getObjectByName('worn').visible).toBe(on);
  });

  it('stands on its tyres at its size: the physics puts the ground where the model draws it', () => {
    const k = spec.scale;
    for (const w of carLayout(kind).wheels) {
      const ground = w.y * k - spec.vehicle.suspensionRestLength - w.radius * k;
      expect(ground).toBeCloseTo(CAR_GROUND_OFFSET * k, 2);
    }
    expect(spec.vehicle.wheelRadius).toBeCloseTo(CARS[kind].R * k, 2);
  });

  it('drives its front wheels only', () => {
    const wheels = carLayout(kind).wheels;
    expect(wheels.filter((w) => w.front).every((w) => w.driven !== false)).toBe(true);
    expect(wheels.filter((w) => !w.front).every((w) => w.driven === false)).toBe(true);
    expect(spec.vehicle.fourWheelDrive).toBe(1); // so the front pair is driven too
  });

  it('cuts its wheel arches clear of the tyres', () => {
    const c = CARS[kind];
    const pts = sideShape(c).getPoints(24);
    for (const zc of [c.wheelbase / 2, -c.wheelbase / 2]) {
      for (const p of pts) {
        if (p.y <= c.sill + 1e-6) continue; // the sill itself, below the wheel's middle
        expect(Math.hypot(p.x - zc, p.y - c.R)).toBeGreaterThan(c.R + 0.02);
      }
    }
  });

  it('has a spec the game can build: its own dash and engine sound, a clutch and an owner', () => {
    expect(DASH_STYLES).toContain(spec.dashStyle);
    expect(AUDIO_PARAM_RANGES.recBank).toContain(spec.audio.recBank);
    expect(spec.manual).toBe(true);
    expect(spec.fuel.noTap).toBe(true);
    expect(['amy', 'jess']).toContain(spec.owner);
    expect(spec.vehicle.maxSpeed).toBeGreaterThanOrEqual(spec.gearbox[`topSpeed${spec.gearbox.gears}`] - 1);
  });

  it('shows its dials and lamps through the hoop of the wheel, above the boss and inside the rim, from the driver\'s eye', () => {
    const { low, high, boss, rimInner } = carDashThroughWheel(kind);
    expect(low).toBeGreaterThan(boss + 0.015);
    expect(high).toBeLessThan(rimInner - 0.005);
  });

  it('pulls the handbrake up and tips the front seats forward', () => {
    const hb = model.getObjectByName('parkBrakeLever');
    const before = hb.rotation.x;
    for (let i = 0; i < 30; i++) poseCarControls(model, { gear: 1, gears: spec.gearbox.gears, choke: 1, park: true });
    expect(hb.rotation.x).toBeLessThan(before - 0.3);
    poseCarSeats(model, { left: 1, driver: 0 });
    expect(model.getObjectByName('seatBack_left').rotation.x).toBeGreaterThan(0.5);
    expect(model.getObjectByName('seatBack_driver').rotation.x).toBe(0);
  });
});

describe('the two cars', () => {
  it("are Amy's carburettor Fiesta with a choke and four gears, and Jess's injected Corsa with five and no choke", () => {
    expect(FIESTA_SPEC.owner).toBe('amy');
    expect(CORSA_SPEC.owner).toBe('jess');
    expect(FIESTA_SPEC.gearbox.gears).toBe(4);
    expect(CORSA_SPEC.gearbox.gears).toBe(5);
    expect(FIESTA_SPEC.engine.injected).toBeFalsy();
    expect(CORSA_SPEC.engine.injected).toBe(true);
  });

  it("idle where Jamie hears them right, with each recorded beat stretched no further than the sound will stretch it", () => {
    // The Corsa idles at its recording's pace (854 to 909). The Fiesta's recording idles at 1,084 to 1,187, but it sounded too fast
    // there: it idles at about 850, so each beat is stretched to fill the longer cycle, and must stay above pulseSlowest or it leaves a gap.
    expect(CORSA_SPEC.idleRange[0]).toBeGreaterThan(854 * 0.9);
    expect(CORSA_SPEC.idleRange[1]).toBeLessThan(909 * 1.05);
    expect(FIESTA_SPEC.idleRange[1]).toBeLessThan(1000);
    const slowest = FIESTA_SPEC.audio.pulseSlowest ?? DEFAULT_AUDIO_PARAMS.pulseSlowest;
    expect(FIESTA_SPEC.idleRange[0] / 1187).toBeGreaterThan(slowest); // the slowest idle against the fastest recorded beat
  });
});

describe('where the driver sits', () => {
  it("puts the windscreen as far from your eye as in the Land Rovers (both at the same scale), with the mirror well ahead of you", () => {
    const landy = landyEyeToGlass();
    for (const kind of Object.keys(CARS)) {
      const e = carEyeToGlass(kind);
      expect(Math.abs(e.glass - landy), kind).toBeLessThan(0.06);
      expect(e.mirror, kind).toBeGreaterThan(0.4); // in front of you, in view, not over your head
      expect(e.mirrorUp, kind).toBeLessThan(0.15);
    }
  });
});

const rnd = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

describe('the Corsa\'s injected idle', () => {
  it('has dropped to within 40 rpm of its warm idle by 0.6 up the gauge, and is still fast when cold', () => {
    const idleAt = (temperature) => {
      const e = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...CORSA_SPEC.engine, initialTemperature: temperature }, { random: rnd(3) });
      e.setIgnition(true);
      for (let t = 0; t < 6 && !e.isRunning; t += 1 / 60) e.update(1 / 60, { starter: true, fuel: 1 });
      for (let t = 0; t < 3; t += 1 / 60) e.update(1 / 60, { fuel: 1 });
      expect(e.isRunning).toBe(true);
      return e.idleTarget;
    };
    expect(idleAt(0.6) - CORSA_SPEC.engine.idleRpmWarm).toBeLessThan(40);
    expect(idleAt(0.2)).toBeGreaterThan(1050);
  });
});
