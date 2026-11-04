// Puts the snow coat (snowCoat.js) on the world's meshes once they are built, and keeps the world's uniforms fed from the weather.
import * as THREE from 'three';
import { coatable, coatMaterial, materialKind, snowUniforms, SnowLook, DEFAULT_SNOW_COAT_PARAMS } from './snowCoat.js';

const box = new THREE.Box3();

const materialsOf = (mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);
const gives = (m) => !!m.emissive && m.emissiveIntensity > 0 && m.emissive.r + m.emissive.g + m.emissive.b > 0.05;

/**
 * Coats every mesh under `root` that can take snow. A subtree marked `userData.snowOwn` is left (the ground draws its own, a vehicle has
 * its own uniforms); a mesh under a roof and low is indoors, which `covered(x, z)` tells us. Returns how many materials were coated.
 */
export function coatTree(root, uniforms, { covered = () => false, p = DEFAULT_SNOW_COAT_PARAMS } = {}) {
  let coated = 0;
  root.updateMatrixWorld(true);
  const visit = (o) => {
    if (o.userData?.snowOwn) return;
    if (o.isMesh && o.material) {
      let indoors = false;
      const mats = materialsOf(o);
      if (mats.some((m) => coatable({ kind: materialKind(m), skinned: !!o.isSkinnedMesh, transparent: m.transparent, emissive: gives(m) }))) {
        box.setFromObject(o);
        if (!box.isEmpty()) indoors = box.max.y < p.indoorRoof && covered((box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2);
      }
      for (const m of mats) {
        if (coatable({ kind: materialKind(m), skinned: !!o.isSkinnedMesh, indoors, transparent: m.transparent, emissive: gives(m) })) {
          if (coatMaterial(m, uniforms, p)) coated++;
        }
      }
    }
    for (const c of o.children) visit(c);
  };
  visit(root);
  return coated;
}

/** The world's snow: one pair of uniforms for everything, fed each frame from the ground's cover. */
export class WorldSnow {
  constructor(params = DEFAULT_SNOW_COAT_PARAMS) {
    this.p = params;
    this.look = new SnowLook(params);
    this.uniforms = snowUniforms(params);
  }

  update(dt, cover) {
    this.look.update(dt, cover);
    this.uniforms.uSnowTops.value = this.look.tops;
    this.uniforms.uSnowWet.value = this.look.wet;
    this.uniforms.uSnowEdge.value = this.p.holdEdge;
  }
}
