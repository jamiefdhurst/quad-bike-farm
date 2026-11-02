import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { RIG } from '../src/world/rollingRoadSite.js';
import { fakeCanvas } from './helpers/vehicleModels.js';

let buildRollingRoadModel, poseRamp, spinRollers, setRunning, RoadScreen, model;
beforeAll(async () => {
  vi.stubGlobal('document', { createElement: () => fakeCanvas() }); // the sign, stripes and lamps draw on canvases
  ({ buildRollingRoadModel, poseRamp, spinRollers, setRunning, RoadScreen } = await import('../src/world/rollingRoadModel.js'));
  model = buildRollingRoadModel();
});

const meshes = (o) => {
  let n = 0;
  o.traverse((c) => {
    if (c.isMesh) n++;
  });
  return n;
};

describe('the rolling road model', () => {
  it('has the parts the game moves', () => {
    const u = model.userData;
    expect(u.ramp).toBeTruthy();
    expect(u.rollers).toHaveLength(2);
    expect(u.blades).toBeTruthy();
    expect(u.straps).toBeTruthy();
    expect(u.post.userData.screen).toBeInstanceOf(RoadScreen);
  });
  it('keeps its draw calls down by merging the static parts', () => {
    expect(meshes(model)).toBeLessThan(80);
  });
  it('folds the ramp up for towing and lowers it to the ground', () => {
    poseRamp(model, 0);
    expect(model.userData.ramp.rotation.x).toBeCloseTo(Math.PI / 2, 5);
    poseRamp(model, 1);
    const ramp = model.userData.ramp;
    ramp.updateMatrixWorld(true);
    const foot = new THREE.Vector3(0, 0, -RIG.rampLength).applyMatrix4(ramp.matrixWorld);
    expect(foot.y).toBeCloseTo(0, 2);
    expect(foot.z).toBeCloseTo(-RIG.deckHalf - Math.sqrt(RIG.rampLength ** 2 - RIG.deckHeight ** 2), 2);
    poseRamp(model, 2);
    expect(ramp.rotation.x).toBeCloseTo(-Math.asin(RIG.deckHeight / RIG.rampLength), 5);
  });
  it('sits the rollers across the cradle, spaced as the site says, with their tops just above the deck', () => {
    const [a, b] = model.userData.rollers;
    expect(a.position.z - b.position.z).toBeCloseTo(RIG.rollerGap, 5);
    expect((a.position.z + b.position.z) / 2).toBeCloseTo(RIG.cradleZ, 5);
    expect(a.position.y + 0.1).toBeGreaterThan(RIG.deckHeight);
    expect(a.position.y + 0.1).toBeLessThan(RIG.deckHeight + 0.05);
  });
  it('turns the rollers and the fan, and shows the straps and beacon while running', () => {
    spinRollers(model, 1.5, 2.5);
    expect(model.userData.rollers[0].rotation.x).toBe(1.5);
    expect(model.userData.blades.rotation.z).toBe(2.5);
    setRunning(model, true);
    expect(model.userData.straps.visible).toBe(true);
    expect(model.userData.beaconMat.emissiveIntensity).toBeGreaterThan(0);
    setRunning(model, false);
    expect(model.userData.straps.visible).toBe(false);
    expect(model.userData.beaconMat.emissiveIntensity).toBe(0);
  });
  it('lies within the trailer frame the site describes, not hanging off it', () => {
    poseRamp(model, 1);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.07); // the ramp's foot is sunk a little, so no gap shows on uneven ground
    expect(box.max.z).toBeLessThan(RIG.deckHalf + 1.75); // the tongue
    expect(box.min.z).toBeGreaterThan(-RIG.deckHalf - RIG.rampLength - 0.4);
    expect(Math.abs(box.max.x)).toBeLessThan(2.1);
    expect(box.max.y).toBeLessThan(2.2); // the headboard stands about 1.75 m over the deck
  });
});
