import * as THREE from 'three';
import { JUMPERS } from '../npc/jumpers.js';

// The clothes rack in the barn where the jumpers hang: a freestanding rail on two legs, its bar running along the wall, with a
// baggy jumper on a hanger for each (grey and beige) unless a girl has it on. They hang edge-on to the wall, as clothes do on a
// rack. Built from boxes: a body and two sleeves hanging straight down, with ribbed cuffs and hem.

const metal = new THREE.MeshStandardMaterial({ color: 0x55595c, roughness: 0.45, metalness: 0.7 });

function hangingJumper(color) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true });
  const rib = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.85), roughness: 1, flatShading: true });
  const g = new THREE.Group();
  const part = (w, h, d, m, x, y, z, rz = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.rotation.z = rz;
    mesh.castShadow = true;
    g.add(mesh);
  };
  // Hung by the shoulders from the bar: the body drops from there, the sleeves fall either side of it.
  part(0.5, 0.62, 0.12, mat, 0, -0.32, 0);
  part(0.5, 0.07, 0.13, rib, 0, -0.64, 0);
  for (const side of [-1, 1]) {
    part(0.16, 0.6, 0.11, mat, side * 0.33, -0.34, 0.01, side * 0.06);
    part(0.15, 0.06, 0.12, rib, side * 0.35, -0.65, 0.01, side * 0.06);
  }
  // The hanger: a hook over the bar and a shoulder bar inside the neck.
  part(0.02, 0.1, 0.02, metal, 0, 0.03, 0);
  part(0.38, 0.015, 0.02, metal, 0, -0.02, 0);
  // Turned so its front faces along the rack, not out into the barn.
  g.rotation.y = Math.PI / 2;
  return g;
}

/** The rack and its jumpers. `show` lists the ids that are hanging there. */
export class JumperRail {
  constructor(scene, layout, heightAt) {
    const r = layout.jumperRail;
    const floor = heightAt(r.x, r.z);
    this.group = new THREE.Group();
    this.group.name = 'jumperRack';
    this.group.position.set(r.x, floor, r.z);
    const add = (geo, x, y, z, rx = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, metal);
      m.position.set(x, y, z);
      m.rotation.set(rx, 0, rz);
      m.castShadow = true;
      this.group.add(m);
    };
    const half = r.length / 2;
    // The bar, and at each end an upright with a foot, so it stands on its own.
    add(new THREE.CylinderGeometry(0.015, 0.015, r.length, 8), 0, r.y, 0, 0, Math.PI / 2);
    for (const side of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.015, 0.015, r.y, 8), side * half, r.y / 2, 0);
      add(new THREE.BoxGeometry(0.05, 0.03, 0.6), side * half, 0.015, 0);
    }
    this.hung = {};
    JUMPERS.forEach((j, i) => {
      const jumper = hangingJumper(j.color);
      jumper.position.set((i - (JUMPERS.length - 1) / 2) * 0.5, r.y - 0.04, 0);
      this.group.add(jumper);
      this.hung[j.id] = jumper;
    });
    scene.add(this.group);
  }

  show(ids) {
    for (const [id, mesh] of Object.entries(this.hung)) mesh.visible = ids.includes(id);
  }
}
