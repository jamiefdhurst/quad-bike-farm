import * as THREE from 'three';
import { createGroundCanvas, createDetailCanvas } from './groundTexture.js';
import { patchColor, patchBlend } from './patchwork.js';
import { tarmacMask } from './roadWet.js';

export { patchAt } from './patchwork.js';

/**
 * Builds the detailed field terrain (visual mesh plus Rapier heightfield) and a
 * coarser patchwork ring of neighbouring fields out to the horizon.
 */
export function createTerrain({ scene, physics, RAPIER, layout, heights, track, renderer, wear, fields, roadMud, autumn = false }) {
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
      const shade = fields.hedgeDistance(x, z) < 4 ? 0.82 : 1;
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
    // About 10 pixels a metre, as it was on the old 200 m square at 2048.
    createGroundCanvas({ size: 4096, worldSize: size, track, layout, fields, puddles: heights.puddles, bogs: heights.bogs, autumn }),
  );
  groundTex.flipY = false;
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const detailTex = new THREE.CanvasTexture(createDetailCanvas());
  detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;

  const mat = new THREE.MeshStandardMaterial({ map: groundTex, vertexColors: true, roughness: 0.95 });
  // Worn ground, from the wear grid (groundWear.js): one texel a grid point, soft in red and bog in green.
  const wearTex = new THREE.DataTexture(wear.data, wear.nx, wear.nz, THREE.RGBAFormat);
  wearTex.magFilter = wearTex.minFilter = THREE.LinearFilter;
  wearTex.needsUpdate = true;
  // Mud carried onto the road (roadMud.js): one texel a grid point, the smear in red.
  const mudData = roadMud ?? { data: new Uint8Array(4), nx: 1, nz: 1, minX: 0, minZ: 0, sizeX: 1, sizeZ: 1 };
  const roadMudTex = new THREE.DataTexture(mudData.data, mudData.nx, mudData.nz, THREE.RGBAFormat);
  roadMudTex.magFilter = roadMudTex.minFilter = THREE.LinearFilter;
  roadMudTex.needsUpdate = true;
  const snow = { value: 0 }; // 0..1 how far the ground is under snow (the weather's cover); the World feeds it
  const frost = { value: 0 }; // 0..1 how hard the frost is (the weather's); the World feeds it
  const roadWet = { value: 0 }; // 0..1 how wet the tarmac is (roadWet.js); the World feeds it
  const skyTint = { value: new THREE.Color() }; // what the wet tarmac mirrors: the horizon's colour now, the World feeds it
  // Where the tarmac is, for the shine (roadWet.js): the farm road, the lane and the village's streets.
  const mask = tarmacMask(fields.tarmacAt, size);
  const tarmacTex = new THREE.DataTexture(mask.data, mask.n, mask.n, THREE.RedFormat);
  tarmacTex.magFilter = tarmacTex.minFilter = THREE.LinearFilter;
  tarmacTex.needsUpdate = true;
  addDetailLayer(mat, detailTex, 0.45, {
    frost,
    snow,
    roadWet,
    skyTint,
    tarmac: { map: tarmacTex, origin: new THREE.Vector2(mask.minX, mask.minZ), size: new THREE.Vector2(mask.size, mask.size) },
    wear: { map: wearTex, origin: new THREE.Vector2(wear.minX, wear.minZ), size: new THREE.Vector2(wear.sizeX, wear.sizeZ) },
    roadMud: { map: roadMudTex, origin: new THREE.Vector2(mudData.minX, mudData.minZ), size: new THREE.Vector2(mudData.sizeX, mudData.sizeZ) },
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);

  scene.add(createOuterRing(layout, heights, fields));

  return { mesh, collider, frost, snow, roadWet, skyTint, wearTexture: wearTex, roadMudTexture: roadMudTex, meshHeightAt: (x, z) => gridHeight(grid, n, step, half, x, z) };
}

/**
 * Height of the visual terrain mesh itself (flat triangles between the 1 m
 * samples), or NaN off the detailed square. Cheap; for things that must sit
 * exactly on the drawn ground, like wheel ruts and mud specks.
 */
function gridHeight(grid, n, step, half, x, z) {
  const gx = (x + half) / step;
  const gz = (z + half) / step;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  if (ix < 0 || iz < 0 || ix >= n - 1 || iz >= n - 1) return NaN;
  const fx = gx - ix;
  const fz = gz - iz;
  const a = grid[ix * n + iz];
  const b = grid[ix * n + iz + 1];
  const c = grid[(ix + 1) * n + iz];
  const d = grid[(ix + 1) * n + iz + 1];
  // Each cell is split along its b-c diagonal, as in the index buffer.
  if (fx + fz <= 1) return a + (c - a) * fx + (b - a) * fz;
  return d + (b - d) * (1 - fx) + (c - d) * (1 - fz);
}

/** Multiplies a tiling greyscale texture over the diffuse colour in world space, and lays the worn ground and the road's mud over it. */
function addDetailLayer(material, detailTex, scale, { wear, roadMud, frost, snow, roadWet, skyTint, tarmac }) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.detailMap = { value: detailTex };
    shader.uniforms.wearMap = { value: wear.map };
    shader.uniforms.wearOrigin = { value: wear.origin };
    shader.uniforms.wearSize = { value: wear.size };
    shader.uniforms.uFrost = frost;
    shader.uniforms.uSnow = snow;
    shader.uniforms.uRoadWet = roadWet;
    shader.uniforms.uSkyTint = skyTint;
    shader.uniforms.tarmacMap = { value: tarmac.map };
    shader.uniforms.tarmacOrigin = { value: tarmac.origin };
    shader.uniforms.tarmacSize = { value: tarmac.size };
    shader.uniforms.roadMudMap = { value: roadMud.map };
    shader.uniforms.roadMudOrigin = { value: roadMud.origin };
    shader.uniforms.roadMudSize = { value: roadMud.size };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWorldXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D detailMap;\nuniform sampler2D wearMap;\nuniform vec2 wearOrigin;\nuniform vec2 wearSize;\nuniform sampler2D roadMudMap;\nuniform vec2 roadMudOrigin;\nuniform vec2 roadMudSize;\nuniform float uFrost;\nuniform float uSnow;\nuniform float uRoadWet;\nuniform vec3 uSkyTint;\nuniform sampler2D tarmacMap;\nuniform vec2 tarmacOrigin;\nuniform vec2 tarmacSize;\nvarying vec2 vWorldXZ;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float detail = texture2D(detailMap, vWorldXZ * ${scale.toFixed(3)}).r;
        float detail2 = texture2D(detailMap, vWorldXZ * ${(scale * 0.13).toFixed(3)}).r;
        diffuseColor.rgb *= mix(0.72, 1.28, detail) * mix(0.85, 1.15, detail2);
        // Ground the tyres have worn: churned brown where it's soft, dark and glossy where it's a bog, ragged at the edges.
        vec2 wearUv = (vWorldXZ - wearOrigin) / wearSize;
        float wearIn = step(0.0, wearUv.x) * step(wearUv.x, 1.0) * step(0.0, wearUv.y) * step(wearUv.y, 1.0);
        vec2 worn = texture2D(wearMap, wearUv).rg * wearIn;
        float rag = (texture2D(detailMap, vWorldXZ * 0.9).r - 0.5) * 0.4;
        float wornSoft = smoothstep(0.15, 0.55, worn.r + rag);
        float wornBog = smoothstep(0.25, 0.65, worn.g + rag);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.19, 0.14, 0.085), wornSoft * 0.75);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.085, 0.06, 0.036), wornBog * 0.9);
        // Mud the tyres have carried onto the road: brown smears along their lines, broken up at the edges, the thick ones darker.
        vec2 mudUv = (vWorldXZ - roadMudOrigin) / roadMudSize;
        float mudIn = step(0.0, mudUv.x) * step(mudUv.x, 1.0) * step(0.0, mudUv.y) * step(mudUv.y, 1.0);
        float smear = texture2D(roadMudMap, mudUv).r * mudIn;
        float onRoad = smoothstep(0.04, 0.3, smear + rag * 0.5) * smoothstep(0.0, 0.03, smear);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.3, 0.23, 0.15), vec3(0.17, 0.12, 0.075), smoothstep(0.3, 0.9, smear)), onRoad * 0.85);
        // Frost on a freezing morning: white on the grass with a glitter of crystals, melted along the lines the tyres have rolled (the
        // wear map's blue) and gone where the ground is churned. It sits less thickly on the road.
        float thawed = texture2D(wearMap, wearUv).b * wearIn;
        float grain = texture2D(detailMap, vWorldXZ * 2.3).r;
        float patchy = 0.75 + 0.25 * (texture2D(detailMap, vWorldXZ * 0.07).r - 0.5) * 2.0;
        float frostAmt = uFrost * patchy * (1.0 - smoothstep(0.1, 0.6, thawed)) * (1.0 - wornSoft) * (1.0 - 0.45 * onRoad);
        float glitter = smoothstep(0.82, 1.0, texture2D(detailMap, vWorldXZ * 5.1).r) * frostAmt;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.91, 0.94) * mix(0.9, 1.08, grain), frostAmt * 0.72) + vec3(0.25) * glitter;
        // Snow: it lies in patches at first and joins up as the cover grows. The tyres' lines and churned ground show through it
        // (the wear map), so tracks stay, and it lies a little thinner on the road.
        float snowPatch = texture2D(detailMap, vWorldXZ * 0.11).r * 0.6 + texture2D(detailMap, vWorldXZ * 0.9).r * 0.4;
        float snowLay = smoothstep(0.0, 0.25, uSnow * 1.5 - (snowPatch - 0.25) * 0.9);
        float snowAmt = snowLay * (1.0 - 0.7 * smoothstep(0.1, 0.5, thawed)) * (1.0 - 0.85 * wornSoft) * (1.0 - 0.3 * onRoad);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98) * mix(0.93, 1.04, grain), snowAmt * 0.93);
        float snowGlint = smoothstep(0.86, 1.0, texture2D(detailMap, vWorldXZ * 6.3).r) * snowAmt;
        diffuseColor.rgb += vec3(0.12) * snowGlint;
        // Wet tarmac: dark and glossy, drying in patches (each spot has its own point at which it goes dull), not under frost, snow or mud.
        float tarmacHere = texture2D(tarmacMap, (vWorldXZ - tarmacOrigin) / tarmacSize).r;
        float dryPoint = clamp(0.5 + (texture2D(detailMap, vWorldXZ * 0.04).r * 0.7 + texture2D(detailMap, vWorldXZ * 0.17).r * 0.3 - 0.5) * 3.2, 0.05, 0.95);
        float wetRoad = tarmacHere * smoothstep(dryPoint - 0.05, dryPoint + 0.1, uRoadWet) * (1.0 - 0.8 * onRoad) * (1.0 - frostAmt) * (1.0 - snowAmt);
        diffuseColor.rgb *= 1.0 - 0.45 * wetRoad;`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n        roughnessFactor *= 1.0 - 0.4 * wornBog;\n        roughnessFactor = mix(roughnessFactor, 0.55, frostAmt * 0.5);\n        roughnessFactor = mix(roughnessFactor, 0.85, snowAmt * 0.6);\n        roughnessFactor = mix(roughnessFactor, 0.08, wetRoad);')
      // The sky in the wet road, strongest where you look along it.
      .replace('#include <opaque_fragment>', 'float skyLook = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);\n        outgoingLight += uSkyTint * wetRoad * (0.04 + 0.35 * skyLook);\n        #include <opaque_fragment>');
  };
}

function createOuterRing(layout, heights, fields) {
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
      // Fading from the farm's grass just beyond its hedges, as the ground texture does (groundTexture.js).
      colors.set(patchColor(x, z, patchBlend(fields.outside(x, z))), i * 3);
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
