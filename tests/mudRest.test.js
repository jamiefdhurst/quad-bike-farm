import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { MudCoat } from '../src/effects/mudCoat.js';
import { fakeCanvas } from './helpers/vehicleModels.js';

vi.stubGlobal('document', { createElement: () => fakeCanvas() });

// A part that swings (the UTV's tipping bed) must get its own mud program: the pattern is in the shader's text, and three shares a compiled
// program between materials with the same cache key, so a rest offset left out of the key gave the bed the fixed pattern's (Jamie: the mud did
// not move with the bed).

function model() {
  const quad = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);
  quad.add(body);
  const mat = new THREE.MeshStandardMaterial({ color: 0x336633 });
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));
  const bed = new THREE.Group();
  bed.name = 'bed';
  bed.userData.mudRest = [0, 0.66, -1.78];
  bed.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));
  root.add(bed);
  return { quad, mat };
}

describe('the mud coat on a swinging part', () => {
  it('gives a part with a rest offset its own copy, its own shader text and its own program key', () => {
    const { quad } = model();
    const q = { model: quad, wheels: [], layout: { wheels: [] }, groundOffset: 0 };
    try {
      // eslint-disable-next-line no-new
      new MudCoat(q);
    } catch (e) {
      // (the coat reads parts of a real quad this stand-in lacks: the patch is made before that, which is all this looks at)
    }
    const fixed = quad.getObjectByName('bodyRoot').children[0].material;
    const swinging = quad.getObjectByName('bed').children[0].material;
    expect(swinging).not.toBe(fixed);
    expect(swinging.customProgramCacheKey()).not.toBe(fixed.customProgramCacheKey());
    const text = (m) => { const sh = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' }; m.onBeforeCompile(sh); return sh.vertexShader; };
    expect(text(swinging)).toContain('position + vec3(0.00000, 0.66000, -1.78000)');
    expect(text(fixed)).not.toContain('position + vec3(');
  });
});
