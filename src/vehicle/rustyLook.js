import * as THREE from 'three';

// How the barn find looks: its materials weathered towards rust and dust, and the old tarp that covers it. Procedural, no assets.

const RUST = new THREE.Color(0x7a4423);
const DUST = new THREE.Color(0x9a8f7c);

/**
 * Gives every part of the model its own copy of its material (the quad bodies share some) and pulls the colour towards rust on the
 * metal and dust on everything, so it looks as if it has stood for years. Rubber and glass stay mostly dark.
 */
export function weatherModel(model, { rust = 0.3, dust = 0.22 } = {}) {
  const copies = new Map();
  model.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material) || o.material.transparent) return;
    let m = copies.get(o.material);
    if (!m) {
      m = o.material.clone();
      // A clone loses the mud coat's shader patch (and with it the wear layer): keep it.
      m.onBeforeCompile = o.material.onBeforeCompile;
      m.customProgramCacheKey = o.material.customProgramCacheKey;
      const metal = (m.metalness ?? 0) > 0.3 ? 1 : 0.35;
      m.color.lerp(RUST, rust * metal);
      m.color.lerp(DUST, dust);
      m.roughness = Math.min(1, (m.roughness ?? 0.6) + 0.35);
      m.metalness = (m.metalness ?? 0) * 0.5;
      copies.set(o.material, m);
    }
    o.material = m;
  });
}

/** A faded blue tarp, thrown over it and tied down: a lumpy box that comes down to the floor all round. Sits in bodyRoot space. */
export function buildTarp() {
  const g = new THREE.BoxGeometry(1.5, 1.0, 2.2, 12, 5, 16);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);
    // Round the top over, then crumple it.
    const edge = Math.max(Math.abs(x) / 0.75, Math.abs(z) / 1.1);
    if (y > 0) y -= 0.12 * edge * edge;
    const fold = 0.035 * Math.sin(x * 9 + z * 3) + 0.03 * Math.sin(z * 7 - x * 2) + 0.02 * Math.sin((x + z) * 15);
    const out = y > -0.3 ? fold : 0;
    pos.setXYZ(i, x * (1 + out), y + (y > 0 ? out * 0.7 : 0), z * (1 + out * 0.5));
  }
  g.computeVertexNormals();
  const tarp = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x4a6470, roughness: 0.95, flatShading: true }));
  tarp.position.set(0, 0.5, 0);
  tarp.name = 'tarp';
  return tarp;
}
