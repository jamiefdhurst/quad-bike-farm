import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { prepareShaders, showHidden } from '../src/core/shaderPrep.js';

/** A renderer that, like three's, only sees what is visible when it is asked, and links each program a moment later. */
function fakeRenderer() {
  const seen = [];
  return {
    seen,
    compileAsync(root, camera, target) {
      root.traverseVisible((o) => o.isMesh && seen.push(o.name));
      return Promise.resolve(target);
    },
  };
}

function sceneWithHidden() {
  const scene = new THREE.Scene();
  const shown = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  shown.name = 'shown';
  const set = new THREE.Group();
  set.visible = false; // a far-hidden set piece
  const inner = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  inner.name = 'inside the hidden set';
  inner.visible = false;
  set.add(inner);
  scene.add(shown, set, new THREE.PointLight());
  return { scene, set, inner };
}

describe('shader preparation (#372)', () => {
  it('shows hidden objects and puts them back as they were', () => {
    const { set, inner } = sceneWithHidden();
    set.visible = true; // only the inner mesh is hidden here
    const restore = showHidden(set);
    expect(inner.visible).toBe(true);
    restore();
    expect(inner.visible).toBe(false);
    expect(set.visible).toBe(true);
  });

  it('asks for hidden things too, and leaves them hidden', async () => {
    const { scene, set, inner } = sceneWithHidden();
    const renderer = fakeRenderer();
    const r = await prepareShaders(renderer, scene, new THREE.PerspectiveCamera());
    expect(renderer.seen.sort()).toEqual(['inside the hidden set', 'shown']);
    expect(set.visible).toBe(false);
    expect(inner.visible).toBe(false);
    expect(r.children).toBe(2); // the light is not a thing to compile
  });

  it('gives the page back between slices and waits for every program', async () => {
    const { scene } = sceneWithHidden();
    let pauses = 0;
    let t = 0;
    const r = await prepareShaders(fakeRenderer(), scene, new THREE.PerspectiveCamera(), { pause: async () => void pauses++, now: () => (t += 10), sliceMs: 5 });
    expect(pauses).toBeGreaterThan(0);
    expect(r.ms).toBeGreaterThan(0);
  });

  it('puts visibility back even when the renderer throws', async () => {
    const { scene, set } = sceneWithHidden();
    const renderer = { compileAsync: () => { throw new Error('no context'); } };
    await expect(prepareShaders(renderer, scene, new THREE.PerspectiveCamera())).rejects.toThrow('no context');
    expect(set.visible).toBe(false);
  });
});
