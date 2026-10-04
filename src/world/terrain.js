import * as THREE from 'three';
import { createGroundCanvas, createDetailCanvas } from './groundTexture.js';

/**
 * Builds the detailed field terrain (visual mesh plus Rapier heightfield) and a
 * coarser patchwork ring of neighbouring fields out to the horizon.
 */
export function createTerrain({ scene, physics, RAPIER, layout, heights, track, renderer }) {
  const { terrainSize: size, terrainSegments: segs } = layout;
  const half = size / 2;
  const step = size / segs;
  const n = segs + 1;

  // Sample heights once; shared by the mesh and the collider.
  const grid = new Float32Array(n * n); // grid[ix * n + iz]
  for (let ix = 0; ix < n; ix++) {
    for (let iz = 0; iz < n; iz++) {
      grid[ix * n + iz] = heights.heightAt(-half + ix * step, -half + iz * step);
    }
  }

  // Physics. Rapier's heightfield is column-major with rows along z.
  const collider = physics.createCollider(
    RAPIER.ColliderDesc.heightfield(segs, segs, grid, { x: size, y: 1, z: size }).setFriction(0.9),
  );

  // Visual mesh.
  const positions = new Float32Array(n * n * 3);
  const uvs = new Float32Array(n * n * 2);
  const colors = new Float32Array(n * n * 3);
  for (let ix = 0; ix < n; ix++) {
    for (let iz = 0; iz < n; iz++) {
      const i = ix * n + iz;
      const x = -half + ix * step;
      const z = -half + iz * step;
      positions.set([x, grid[i], z], i * 3);
      uvs.set([ix / segs, iz / segs], i * 2);
      // Low-frequency tint, a little darker in the hedge shadow.
      const edge = Math.max(Math.abs(x), Math.abs(z));
      const shade = edge > layout.fieldHalf - 4 && edge < layout.fieldHalf + 4 ? 0.82 : 1;
      const v = (0.92 + 0.08 * Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.06)) * shade;
      colors.set([v, v, v], i * 3);
    }
  }
  const indices = [];
  for (let ix = 0; ix < segs; ix++) {
    for (let iz = 0; iz < segs; iz++) {
      const a = ix * n + iz;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      indices.push(a, b, c, c, b, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const groundTex = new THREE.CanvasTexture(
    createGroundCanvas({ size: 2048, worldSize: size, track, layout, puddles: heights.puddles }),
  );
  groundTex.flipY = false;
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const detailTex = new THREE.CanvasTexture(createDetailCanvas());
  detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;

  const mat = new THREE.MeshStandardMaterial({ map: groundTex, vertexColors: true, roughness: 0.95 });
  addDetailLayer(mat, detailTex, 0.45);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);

  scene.add(createOuterRing(layout, heights));

  return { mesh, collider };
}

/** Multiplies a tiling greyscale texture over the diffuse colour in world space. */
function addDetailLayer(material, detailTex, scale) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.detailMap = { value: detailTex };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWorldXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D detailMap;\nvarying vec2 vWorldXZ;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float detail = texture2D(detailMap, vWorldXZ * ${scale.toFixed(3)}).r;
        float detail2 = texture2D(detailMap, vWorldXZ * ${(scale * 0.13).toFixed(3)}).r;
        diffuseColor.rgb *= mix(0.72, 1.28, detail) * mix(0.85, 1.15, detail2);`,
      );
  };
}

// Patchwork of neighbouring fields as vertex colours, with dark lines where
// the hedgerows between them would be.
const PATCH_COLORS = [
  [0.36, 0.48, 0.22],
  [0.42, 0.54, 0.26],
  [0.33, 0.44, 0.2],
  [0.52, 0.54, 0.28],
  [0.42, 0.35, 0.26],
  [0.6, 0.56, 0.36],
  [0.39, 0.5, 0.24],
];

function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function patchAt(x, z) {
  const cell = 85;
  const wx = x + 14 * Math.sin(z * 0.017);
  const wz = z + 14 * Math.sin(x * 0.019);
  const cx = Math.floor(wx / cell);
  const cz = Math.floor(wz / cell);
  const fx = wx / cell - cx;
  const fz = wz / cell - cz;
  const border = Math.min(fx, 1 - fx, fz, 1 - fz) * cell;
  return { id: hash2(cx, cz), border };
}

function createOuterRing(layout, heights) {
  const { outerSize: size, outerSegments: segs, terrainSize } = layout;
  const half = size / 2;
  const inner = terrainSize / 2;
  const step = size / segs;
  const n = segs + 1;
  const positions = new Float32Array(n * n * 3);
  const colors = new Float32Array(n * n * 3);
  for (let ix = 0; ix < n; ix++) {
    for (let iz = 0; iz < n; iz++) {
      const i = ix * n + iz;
      const x = -half + ix * step;
      const z = -half + iz * step;
      positions.set([x, heights.heightAt(x, z), z], i * 3);
      const { id, border } = patchAt(x, z);
      let col = PATCH_COLORS[Math.floor(id * PATCH_COLORS.length)];
      if (border < 3) col = [0.17, 0.25, 0.11];
      // Fade to the near field's grass colour close to the hedges.
      const edge = Math.max(Math.abs(x), Math.abs(z));
      const blend = Math.min(1, Math.max(0, (edge - inner) / 40));
      const near = [0.37, 0.49, 0.23];
      colors.set(
        [0, 1, 2].map((k) => near[k] + (col[k] - near[k]) * blend),
        i * 3,
      );
    }
  }
  const indices = [];
  const inside = (ix, iz) => {
    const x = -half + ix * step;
    const z = -half + iz * step;
    return Math.abs(x) <= inner + 1e-3 && Math.abs(z) <= inner + 1e-3;
  };
  for (let ix = 0; ix < segs; ix++) {
    for (let iz = 0; iz < segs; iz++) {
      if (inside(ix, iz) && inside(ix + 1, iz + 1) && inside(ix + 1, iz) && inside(ix, iz + 1)) continue;
      const a = ix * n + iz;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      indices.push(a, b, c, c, b, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  mesh.receiveShadow = true;
  mesh.name = 'outerTerrain';
  return mesh;
}
