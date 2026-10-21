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
  // The model's own handles on materials (the headlamp's lens the game lights, the seat the frost settles on) must follow the clones, or the
  // lamp is lit in a material no mesh uses any more.
  for (const [k, v] of Object.entries(model.userData)) if (v && v.isMaterial && copies.has(v)) model.userData[k] = copies.get(v);
}

/**
 * The highest surface at each point of a grid over the quad, in bodyRoot space: `nx` by `nz` cells over x -0.95..0.95 and z -1.45..1.4,
 * found by dropping a ray on every one (the wheels and seat included; the tarp, the damage planes and the lamps' sprites are not). 0 where
 * nothing is there.
 */
function sampleHeights(model, nx, nz) {
  const root = model.getObjectByName('bodyRoot');
  root.updateMatrixWorld(true);
  const meshes = [];
  model.traverse((o) => {
    // (not the tarp, the damage, the invisible box you look at to get on, or a lamp's faked beam)
    if (o.isMesh && o.visible && o.name !== 'tarp' && !/proxy|beam|halo/i.test(o.name) && !o.userData.rustyDamage && o.material?.visible !== false && !(o.material?.transparent && o.material.opacity < 0.05)) meshes.push(o);
  });
  const heights = new Float32Array((nx + 1) * (nz + 1));
  // Rasterised, not ray-cast: every triangle is laid flat on the grid (in bodyRoot space) and each sample point it covers keeps the highest
  // surface seen. The same thirteen sample points round every grid point as the rays had (so a thin bar or grip between points is not missed),
  // but one pass over the triangles instead of ten thousand rays through all of them: 600 ms of the load for a bike of 30,000 triangles.
  const dx = 1.9 / nx;
  const dz = 2.85 / nz;
  const OFFS = [[0, 0], [0.04, 0], [-0.04, 0], [0, 0.04], [0, -0.04], [0.04, 0.04], [-0.04, 0.04], [0.04, -0.04], [-0.04, -0.04], [0.02, 0], [-0.02, 0], [0, 0.02], [0, -0.02]];
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (const mesh of meshes) {
    const pos = mesh.geometry.attributes.position;
    if (!pos) continue;
    const index = mesh.geometry.index;
    m.multiplyMatrices(inv, mesh.matrixWorld);
    const tris = index ? index.count / 3 : pos.count / 3;
    for (let t = 0; t < tris; t++) {
      const [ia, ib, ic] = index ? [index.getX(t * 3), index.getX(t * 3 + 1), index.getX(t * 3 + 2)] : [t * 3, t * 3 + 1, t * 3 + 2];
      a.fromBufferAttribute(pos, ia).applyMatrix4(m);
      b.fromBufferAttribute(pos, ib).applyMatrix4(m);
      c.fromBufferAttribute(pos, ic).applyMatrix4(m);
      const det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      if (Math.abs(det) < 1e-12) continue; // edge-on from above: it covers no sample
      const i0 = Math.max(0, Math.ceil((Math.min(a.x, b.x, c.x) - 0.04 + 0.95) / dx));
      const i1 = Math.min(nx, Math.floor((Math.max(a.x, b.x, c.x) + 0.04 + 0.95) / dx));
      const j0 = Math.max(0, Math.ceil((Math.min(a.z, b.z, c.z) - 0.04 + 1.45) / dz));
      const j1 = Math.min(nz, Math.floor((Math.max(a.z, b.z, c.z) + 0.04 + 1.45) / dz));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const x = -0.95 + i * dx;
          const z = -1.45 + j * dz;
          let top = heights[j * (nx + 1) + i];
          for (const [ox, oz] of OFFS) {
            const px = x + ox;
            const pz = z + oz;
            const l1 = ((b.z - c.z) * (px - c.x) + (c.x - b.x) * (pz - c.z)) / det;
            const l2 = ((c.z - a.z) * (px - c.x) + (a.x - c.x) * (pz - c.z)) / det;
            const l3 = 1 - l1 - l2;
            if (l1 < 0 || l2 < 0 || l3 < 0) continue;
            const y = l1 * a.y + l2 * b.y + l3 * c.y;
            if (y > top) top = y;
          }
          heights[j * (nx + 1) + i] = top;
        }
      }
    }
  }
  return heights;
}

/** The same heights without a model to look at: a hump for the body, the bars standing up, the racks and the wheels. For tests. */
function guessHeights(nx, nz) {
  const bump = (x, z, cx, cz, sx, sz, h, p = 4) => h * Math.exp(-(Math.abs((x - cx) / sx) ** p + Math.abs((z - cz) / sz) ** p));
  const heights = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = -0.95 + (1.9 * i) / nx;
      const z = -1.45 + (2.85 * j) / nz;
      heights[j * (nx + 1) + i] = Math.max(bump(x, z, 0, 0, 0.85, 1.25, 0.98), bump(x, z, 0, 0.46, 0.75, 0.22, 1.24, 3), bump(x, z, 0, -0.95, 0.5, 0.2, 1.05), bump(x, z, 0, 0.85, 0.5, 0.25, 0.95));
    }
  }
  return heights;
}

/**
 * A faded blue tarp thrown over it: a cloth laid over the quad's own shape (found by dropping rays on a grid over it, so the bars stand up
 * under it and the wheels and racks make their bumps), draped down to the ground all round, with folds and a few creases. Without a
 * `model` it drapes over a guess at the shape. Sits in bodyRoot space; the ground is its y 0.
 */
export function buildTarp(model = null) {
  const NX = 22;
  const NZ = 32;
  const raw = model ? sampleHeights(model, NX, NZ) : guessHeights(NX, NZ);
  const at = (a, i, j) => a[Math.min(NZ, Math.max(0, j)) * (NX + 1) + Math.min(NX, Math.max(0, i))];
  // Spread what stands up two cells out each way, falling off 3.5 cm a cell (cloth cannot dip between a rack and a bar), then soften it so it falls away smoothly.
  let h = new Float32Array(raw.length);
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    let m = 0;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) m = Math.max(m, at(raw, i + di, j + dj) - 0.035 * Math.hypot(di, dj));
    h[j * (NX + 1) + i] = m;
  }
  for (let pass = 0; pass < 1; pass++) {
    const next = new Float32Array(h.length);
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
      let sum = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) sum += at(h, i + di, j + dj) * (di || dj ? 1 : 2);
      next[j * (NX + 1) + i] = sum / 10;
    }
    h = next;
  }
  for (let k = 0; k < h.length; k++) h[k] = Math.max(h[k], raw[k] + 0.11); // never under what it covers
  // The mesh: a finer grid over the same area, heights interpolated, folds added, the border brought down to the ground.
  const MX = 44;
  const MZ = 64;
  const pos = [];
  const idx = [];
  const sample = (u, v) => {
    const fx = u * NX;
    const fz = v * NZ;
    const i = Math.min(NX - 1, Math.floor(fx));
    const j = Math.min(NZ - 1, Math.floor(fz));
    const tx = fx - i;
    const tz = fz - j;
    const a = at(h, i, j) * (1 - tx) + at(h, i + 1, j) * tx;
    const b = at(h, i, j + 1) * (1 - tx) + at(h, i + 1, j + 1) * tx;
    return a * (1 - tz) + b * tz;
  };
  for (let j = 0; j <= MZ; j++) {
    for (let i = 0; i <= MX; i++) {
      const u = i / MX;
      const v = j / MZ;
      const x = -0.95 + 1.9 * u;
      const z = -1.45 + 2.85 * v;
      let y = sample(u, v);
      const border = Math.min(u, 1 - u, v, 1 - v);
      const fold = 0.045 * Math.sin(x * 11 + z * 3.5) + 0.035 * Math.sin(z * 8 - x * 3) + 0.018 * Math.sin((x + z) * 19) + 0.02 * Math.sin(x * 5 - z * 9);
      if (y > 0.05) y += fold * Math.min(1, y * 1.6); // folds only where it is lifted
      y = border < 0.02 ? 0.015 : Math.max(0.015, y);
      // Where it comes down to the ground it spreads a little, the way a dropped cloth pools.
      const spread = y < 0.3 ? 1 + (0.3 - y) * 0.12 : 1;
      pos.push(x * spread, y, z * (1 + (spread - 1) * 0.6));
    }
  }
  for (let j = 0; j < MZ; j++) {
    for (let i = 0; i < MX; i++) {
      const a = j * (MX + 1) + i;
      const b = a + 1;
      const c = a + MX + 1;
      idx.push(a, c, b, b, c, c + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const tarp = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x4a6470, roughness: 0.95, side: THREE.DoubleSide }));
  tarp.name = 'tarp';
  return tarp;
}
