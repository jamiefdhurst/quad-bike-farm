import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildAllGirls } from './helpers/girlModels.js';
import { BodyShake } from '../src/npc/bodyShakeView.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { REGIONS } from '../src/npc/bodyShake.js';

// The shake on the real model: every skinned mesh she wears weighted, the material patched, and an offset in the world coming back
// out of the skinning as that offset.

let girls;
beforeAll(async () => {
  girls = (await buildAllGirls()).map((g) => {
    const { bust, hips } = CHARACTERS.find((c) => c.id === g.id).params;
    g.rig.bodyShake = new BodyShake(g.rig, { figure: () => ({ bust, hips }) });
    g.rig.bodyShake.update(1 / 60);
    return g;
  });
}, 60000);

const skinned = (rig) => {
  const out = [];
  rig.model.traverse((o) => o.isSkinnedMesh && o.visible && out.push(o));
  return out;
};
const weightAt = (mesh, i, region) => {
  const k = REGIONS.findIndex((r) => r.name === region);
  const [attr, c] = [['shakeA', 0], ['shakeA', 1], ['shakeB', 0], ['shakeB', 1], ['shakeA', 2], ['shakeC', 0], ['shakeC', 1]][k];
  return mesh.geometry.attributes[attr].getComponent(i, c);
};

describe('her body giving with the shake, on the model', () => {
  it('weighs her body and every garment and patches each material', () => {
    for (const { rig } of girls) {
      const meshes = skinned(rig);
      expect(meshes.length).toBeGreaterThan(1);
      for (const m of meshes) {
        expect(m.geometry.attributes.shakeA, m.name).toBeTruthy();
        expect(m.material.userData.bodyShake, m.name).toBe(true);
      }
      const body = meshes[0];
      let most = 0;
      for (let i = 0; i < body.geometry.attributes.position.count; i++) most = Math.max(most, weightAt(body, i, 'bust'));
      expect(most).toBeGreaterThan(0.8);
    }
  });

  it("adds the offset before skinning in the shader, after the plaid's or the mud's own changes", () => {
    const { rig } = girls[0];
    const mat = skinned(rig)[0].material;
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    mat.onBeforeCompile(shader, null);
    expect(shader.uniforms.shakeOff).toBe(rig.bodyShake.uniform);
    expect(shader.vertexShader).toMatch(/transformed \+= shakeA\.x \* shakeOff\[0\][\s\S]*#include <skinning_vertex>/);
    expect(mat.customProgramCacheKey()).toMatch(/bodyShake$/);
  });

  it('her clothes over her bust move as her bust does, so nothing comes through', () => {
    for (const { rig } of girls) {
      const [body, ...garments] = skinned(rig);
      const bp = body.geometry.attributes.position;
      const v = new THREE.Vector3();
      const u = new THREE.Vector3();
      let worst = 0;
      for (const g of garments) {
        const gp = g.geometry.attributes.position;
        for (let i = 0; i < gp.count; i++) {
          const w = weightAt(g, i, 'bust');
          if (w < 0.2) continue;
          v.fromBufferAttribute(gp, i);
          let best = Infinity;
          let bw = 0;
          for (let j = 0; j < bp.count; j++) {
            const d = u.fromBufferAttribute(bp, j).distanceToSquared(v);
            if (d < best) [best, bw] = [d, weightAt(body, j, 'bust')];
          }
          worst = Math.max(worst, Math.abs(w - bw));
        }
      }
      // At the most a bust moves (about 4.5 cm), a difference of 0.15 is 7 mm: inside the gap a shell keeps off her.
      expect(worst).toBeLessThan(0.15);
    }
  });

  it('an offset in the world comes back out of the skinning as that offset', () => {
    const { rig } = girls[1];
    const shake = rig.bodyShake;
    const body = skinned(rig)[0];
    // Her bust thrown 2 cm down and 1 cm to the side (no easing, no figure), worked out with no time passing.
    const off = new THREE.Vector3(0.01, -0.02, 0);
    shake.params = { ...shake.params, strength: 1, bustGive: 1, maxOffset: 10 };
    shake.figure = () => ({ bust: 1, hips: 1 });
    shake.state.bust.x = off.toArray();
    shake.update(0);
    const bindOff = shake.uniform.value[0];
    const pos = body.geometry.attributes.position;
    let i = 0;
    for (let j = 0; j < pos.count; j++) if (weightAt(body, j, 'bust') > weightAt(body, i, 'bust')) i = j;
    const w = weightAt(body, i, 'bust');
    const at = (extra) => {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i).addScaledVector(bindOff, extra);
      body.applyBoneTransform(i, p);
      return p.applyMatrix4(body.matrixWorld);
    };
    const moved = at(w).sub(at(0));
    expect(moved.x).toBeCloseTo(off.x * w, 3);
    expect(moved.y).toBeCloseTo(off.y * w, 3);
    expect(moved.z).toBeCloseTo(0, 3);
  });
});
