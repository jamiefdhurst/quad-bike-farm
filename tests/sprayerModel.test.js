import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildSprayerModel, poseSprayer, nozzlePositions, SPRAYER_SPEC } from '../src/vehicle/sprayerModel.js';
import { DEFAULT_SPRAY_PARAMS } from '../src/world/spraying.js';
import { buildAllModels } from './helpers/vehicleModels.js';

let model;
beforeAll(async () => {
  await buildAllModels(); // stubs the canvas for the lamps' and plates' textures
  model = buildSprayerModel();
});

const world = () => {
  model.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(model);
};

describe('the sprayer model', () => {
  it('keeps what the game looks it up by: the body, the wheels with their spin, the boom arms, the nozzles and the sight tube', () => {
    for (const n of ['body', 'wheelLeft', 'wheelRight', 'boomMid', 'boomLeft', 'boomRight', 'level']) expect(model.getObjectByName(n), n).toBeTruthy();
    for (const n of ['wheelLeft', 'wheelRight']) expect(model.getObjectByName(n).getObjectByName('spin'), n).toBeTruthy();
    expect(nozzlePositions(model)).toHaveLength(SPRAYER_SPEC.nozzles * 2);
  });

  it('spans the boom width when it is out, and folds in along the tank (no wider than the wheels, no taller than the tank)', () => {
    poseSprayer(model, { boom: 1, tank: 1 });
    const out = world();
    expect(out.max.x - out.min.x).toBeGreaterThan(DEFAULT_SPRAY_PARAMS.boomWidth - 0.4);
    expect(out.max.x - out.min.x).toBeLessThan(DEFAULT_SPRAY_PARAMS.boomWidth + 0.4);
    poseSprayer(model, { boom: 0, tank: 1 });
    const folded = world();
    expect(folded.max.x - folded.min.x).toBeLessThan(1.6);
    expect(folded.max.y).toBeLessThan(1.5);
    expect(folded.max.z).toBeLessThan(SPRAYER_SPEC.drawLength + 0.1); // not past the coupling
  });

  it('hangs the boom where the spraying rules put it, behind the axle, with the nozzles under it and above the ground', () => {
    poseSprayer(model, { boom: 1, tank: 1 });
    model.updateMatrixWorld(true);
    const mid = new THREE.Vector3();
    model.getObjectByName('boomMid').getWorldPosition(mid);
    expect(mid.z).toBeCloseTo(-DEFAULT_SPRAY_PARAMS.boomBehind, 1);
    for (const n of nozzlePositions(model)) {
      expect(n.y).toBeGreaterThan(0.1);
      expect(n.y).toBeLessThan(mid.y);
      expect(Math.abs(n.z - mid.z)).toBeLessThan(0.1);
    }
  });

  it('puts the hitch ring at the height and distance the motion expects', () => {
    const box = world();
    expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(box.max.z).toBeGreaterThan(SPRAYER_SPEC.drawLength - 0.2); // the coupling stands out at the front
  });

  it('shows the tank level on its sight tube', () => {
    poseSprayer(model, { boom: 0, tank: 1 });
    const full = model.getObjectByName('level').scale.y;
    poseSprayer(model, { boom: 0, tank: 0.25 });
    expect(model.getObjectByName('level').scale.y).toBeLessThan(full);
  });
});
