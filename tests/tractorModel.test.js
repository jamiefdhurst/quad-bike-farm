import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { buildTractorModel, TRACTOR_LAYOUT } from '../src/vehicle/tractorModel.js';

// The dash paints its dials on canvases; nothing here looks at them, so any 2D context that swallows every call will do.
const ctx = new Proxy(() => ctx, { get: (t, k) => (k === 'measureText' ? () => ({ width: 10 }) : ctx), set: () => true });
vi.stubGlobal('document', { createElement: () => ({ width: 1, height: 1, getContext: () => ctx }) });

// Quad, the girls' mounts and the controls look these parts up by name, so a redrawn tractor must keep them all.
const NAMED = [
  'body', 'bodyRoot', 'bonnet', 'exhaustFlap', 'exhaustTip', 'steeringColumn', 'handlebars', 'gripLeft', 'gripRight', 'riderHands',
  'gearLever', 'handThrottle', 'clutchPedal', 'stopKnob', 'fuelTap', 'chokeLever', 'mudguardLeft', 'mudguardRight', 'riderAnchor',
  'cameraAnchor',
];

describe('tractor model', () => {
  const model = buildTractorModel();

  it.each(NAMED)('has %s', (name) => {
    expect(model.getObjectByName(name)).toBeTruthy();
  });

  it('has the four wheels, each with a spin group', () => {
    for (const w of TRACTOR_LAYOUT.wheels) expect(model.getObjectByName(w.name).getObjectByName('spin')).toBeTruthy();
  });

  it('keeps the anchors where the girls and the camera expect them', () => {
    expect(model.getObjectByName('riderAnchor').position.toArray()).toEqual([0, 1.15, -0.8]);
    expect(model.getObjectByName('cameraAnchor').position.toArray()).toEqual([0, 1.86, -0.84]);
  });

  it('keeps the width and height of the old model (wheel to exhaust tip), which the parking spaces were sized for', () => {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const name of ['bodyRoot', 'wheel_fl', 'wheel_rr']) box.expandByObject(model.getObjectByName(name));
    const size = box.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(2.2);
    expect(size.x).toBeLessThan(2.45);
    expect(size.y).toBeGreaterThan(2.6);
    expect(size.y).toBeLessThan(2.9);
  });
});
