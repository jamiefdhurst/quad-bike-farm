import * as THREE from 'three';
import { TIP_TRAILER_SPEC } from '../vehicle/tipTrailerModel.js';

const PATCHES = 160; // a ring: the oldest patch goes when there are more than this

/**
 * What the muck job looks like: the heap of muck standing in the tub (grows with the load) and the patches it leaves on the ground behind.
 * The patches are one instanced mesh of flat dark lumps (an ordinary lit material, so the daylight dims them with everything else).
 */
export class MuckView {
  constructor({ scene, tub, heightAt, random = Math.random }) {
    this.heightAt = heightAt;
    this.random = random;
    const mat = new THREE.MeshStandardMaterial({ color: 0x35271b, roughness: 0.95 });
    this.mound = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), mat);
    // In tub-local metres: z runs from the pivot at the rear edge, the tub's middle being half its length on.
    this.mound.position.set(0, 0, (TIP_TRAILER_SPEC.frontZ - TIP_TRAILER_SPEC.rearZ) / 2);
    this.mound.visible = false;
    tub.add(this.mound);
    this.patches = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 4), mat, PATCHES);
    this.patches.count = 0;
    this.patches.frustumCulled = false;
    this.patches.receiveShadow = true;
    scene.add(this.patches);
    this.next = 0;
    this.matrix = new THREE.Matrix4();
    this.quat = new THREE.Quaternion();
  }

  /** The muck in the tub, 0 (none) to 1 (full). */
  setLoad(load) {
    this.mound.visible = load > 0.01;
    const k = Math.min(1, load);
    this.mound.scale.set(1.0 * (0.5 + 0.5 * k), 0.12 + 0.55 * k, 1.35 * (0.5 + 0.5 * k));
    this.mound.position.y = 0.02 + 0.04 * k;
  }

  /** Drops a patch on the ground at (x, z); `size` is its radius in metres (a tipped heap is bigger). */
  lay(x, z, size = 0.8) {
    const r = size * (0.8 + this.random() * 0.4);
    this.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.random() * Math.PI * 2);
    this.matrix.compose(new THREE.Vector3(x, this.heightAt(x, z) + 0.01, z), this.quat, new THREE.Vector3(r, r * 0.12, r * (0.7 + this.random() * 0.3)));
    this.patches.setMatrixAt(this.next, this.matrix);
    this.next = (this.next + 1) % PATCHES;
    this.patches.count = Math.min(PATCHES, this.patches.count + 1);
    this.patches.instanceMatrix.needsUpdate = true;
  }

  /** Clears the ground (the debug panel's reset). */
  clear() {
    this.patches.count = 0;
    this.next = 0;
  }
}
