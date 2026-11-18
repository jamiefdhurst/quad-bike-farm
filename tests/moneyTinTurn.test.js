import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { barnFrame, insideBarn, barnShape } from '../src/world/barn.js';

// The money tin's shelf hangs on the barn's back wall, whichever way the barn is turned (#978): on the new farm that wall is the east one.
const two = layoutNew(LAYOUT, RAW_LAYOUT);

const build = async (layout) => {
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const { MoneyTinView } = await import('../src/world/moneyTinView.js');
  vi.spyOn(MoneyTinView.prototype, 'buildCard').mockImplementation(() => {});
  vi.spyOn(MoneyTinView.prototype, 'refresh').mockImplementation(() => {});
  const scene = new THREE.Scene();
  const game = { world: { layout, heightAt: () => 0 }, scene };
  const view = new MoneyTinView({ game, market: {} });
  scene.updateMatrixWorld(true);
  return { view, scene };
};

describe('the money tin', () => {
  it('stands inside the turned barn, its shelf against the back wall and not through it', async () => {
    const { view, scene } = await build(two);
    const box = new THREE.Box3().setFromObject(scene.getObjectByName('tin-set'));
    for (const x of [box.min.x, box.max.x]) {
      for (const z of [box.min.z, box.max.z]) expect(insideBarn(two, x, z, -0.06), `${x.toFixed(2)}, ${z.toFixed(2)}`).toBe(true);
    }
    expect(insideBarn(two, view.position.x, view.position.z)).toBe(true);
  });
  it('is the same distance from the back wall as on the unturned barn, with its front into the barn', async () => {
    const turned = await build(two);
    const plain = await build(LAYOUT);
    const gap = (layout, view) => {
      const f = barnFrame(layout);
      const local = f.toLocal(view.position.x, view.position.z);
      return [local.x - barnShape(layout).inner.minX, local.z - layout.barnLocal.moneyTin.z];
    };
    const [a, b] = [gap(two, turned.view), gap(LAYOUT, plain.view)];
    expect(a[0]).toBeCloseTo(b[0], 6);
    expect(a[1]).toBeCloseTo(b[1], 6);
    expect(a[1]).toBeGreaterThan(0.1); // out from the wall, in the barn's own frame
  });
});
