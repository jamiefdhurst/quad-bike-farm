import * as THREE from 'three';

// Wheel tracks: a ribbon laid along each tyre's path, dark, wet and glossy
// with a tread pattern in mud, faint flattened grass elsewhere. Segments live
// in a ring buffer per quad (the oldest are reused) and fade out over time.

const MAX_SEGMENTS = 5000;
const LIFT = 0.012; // metres above the drawn ground, with polygon offset on top

export class MudRuts {
  constructor(scene, groundHeightAt, params) {
    this.params = params;
    this.groundHeightAt = groundHeightAt;
    this.time = 0;
    this.next = 0;
    this.dirtyFrom = Infinity;
    this.dirtyTo = -1;

    const n = MAX_SEGMENTS * 4;
    this.position = new Float32Array(n * 3);
    this.birth = new Float32Array(n).fill(-1e6);
    this.mud = new Float32Array(n);
    this.rutUv = new Float32Array(n * 2);
    const index = new Uint32Array(MAX_SEGMENTS * 6);
    for (let s = 0; s < MAX_SEGMENTS; s++) {
      const v = s * 4;
      index.set([v, v + 2, v + 1, v + 1, v + 2, v + 3], s * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.position, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aBirth', new THREE.BufferAttribute(this.birth, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aMud', new THREE.BufferAttribute(this.mud, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aRutUv', new THREE.BufferAttribute(this.rutUv, 2).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    this.geometry = geo;

    this.uniforms = {
      uTime: { value: 0 },
      uMudLife: { value: params.rutMudLife },
      uGrassLife: { value: params.rutGrassLife },
      uGrassAlpha: { value: params.rutGrassAlpha },
    };
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
      envMapIntensity: 0.5,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute float aBirth;
          attribute float aMud;
          attribute vec2 aRutUv;
          varying float vBirth;
          varying float vMud;
          varying vec2 vRutUv;`,
        )
        .replace('#include <begin_vertex>', `#include <begin_vertex>\nvBirth = aBirth; vMud = aMud; vRutUv = aRutUv;`);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform float uMudLife;
          uniform float uGrassLife;
          uniform float uGrassAlpha;
          varying float vBirth;
          varying float vMud;
          varying vec2 vRutUv;
          float rutTread;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float rutAge = uTime - vBirth;
          float rutLife = mix(uGrassLife, uMudLife, vMud);
          float rutFade = 1.0 - smoothstep(rutLife * 0.4, rutLife, rutAge);
          float across = vRutUv.y;
          float rutEdge = smoothstep(0.0, 0.3, across) * smoothstep(1.0, 0.7, across);
          // Deeper and shallower along its length.
          float rutDepth = 0.7 + 0.3 * sin(vRutUv.x * 1.7 + sin(vRutUv.x * 0.43) * 3.0);
          // Chevron tread blocks pressed into the mud.
          float t = fract(vRutUv.x * 6.5 + abs(across - 0.5) * 1.4);
          rutTread = smoothstep(0.38, 0.46, t) * smoothstep(0.78, 0.7, t) * smoothstep(0.08, 0.2, abs(across - 0.5));
          vec3 mudCol = vec3(0.032, 0.022, 0.014) * (1.0 - 0.45 * rutTread);
          vec3 grassCol = vec3(0.05, 0.062, 0.025);
          diffuseColor.rgb = mix(grassCol, mudCol, vMud);
          diffuseColor.a = rutFade * rutEdge * mix(uGrassAlpha, 0.85 * rutDepth, vMud);`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          // Wet and smeared in mud, with water standing in the tread.
          roughnessFactor = mix(0.95, mix(0.78, 0.5, rutTread), vMud);`,
        );
    };
    mat.customProgramCacheKey = () => 'mudRuts';
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 1;
    this.mesh.name = 'mudRuts';
    scene.add(this.mesh);

    // Per wheel: the last edge laid, or null after leaving the ground.
    this.trails = [];
  }

  /**
   * @param {number} dt
   * @param {object[]} wheels  Per wheel: { x, z (ground point), contact, mud 0..1, width }.
   */
  update(dt, wheels) {
    const p = this.params;
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    this.uniforms.uMudLife.value = p.rutMudLife;
    this.uniforms.uGrassLife.value = p.rutGrassLife;
    this.uniforms.uGrassAlpha.value = p.rutGrassAlpha;
    for (let i = 0; i < wheels.length; i++) {
      const w = wheels[i];
      let t = this.trails[i];
      if (!w.contact) {
        this.trails[i] = null;
        continue;
      }
      if (!t) {
        this.trails[i] = { x: w.x, z: w.z, edge: null, u: 0 };
        continue;
      }
      const dx = w.x - t.x;
      const dz = w.z - t.z;
      const d = Math.hypot(dx, dz);
      if (d < p.rutStep) continue;
      if (d > 2) {
        // Teleported or bounced a long way: start a fresh trail.
        this.trails[i] = { x: w.x, z: w.z, edge: null, u: 0 };
        continue;
      }
      const nx = -dz / d;
      const nz = dx / d;
      const hw = w.width * 0.5;
      const edge = [
        w.x + nx * hw, 0, w.z + nz * hw,
        w.x - nx * hw, 0, w.z - nz * hw,
      ];
      edge[1] = this.groundHeightAt(edge[0], edge[2]) + LIFT;
      edge[4] = this.groundHeightAt(edge[3], edge[5]) + LIFT;
      const u = t.u + d;
      if (t.edge) this.addSegment(t.edge, edge, t.u, u, t.mud, w.mud);
      t.x = w.x;
      t.z = w.z;
      t.edge = edge;
      t.u = u;
      t.mud = w.mud;
    }
    this.flush();
  }

  addSegment(a, b, u0, u1, mud0, mud1) {
    const cap = Math.min(MAX_SEGMENTS, Math.max(4, Math.round(this.params.rutSegments)));
    if (this.next >= cap) this.next = 0;
    const s = this.next++;
    const v = s * 4;
    this.position.set(a, v * 3);
    this.position.set(b, v * 3 + 6);
    // A small birth stagger along the trail so it fades from the old end.
    this.birth[v] = this.birth[v + 1] = this.time - 0.02;
    this.birth[v + 2] = this.birth[v + 3] = this.time;
    this.mud[v] = this.mud[v + 1] = mud0;
    this.mud[v + 2] = this.mud[v + 3] = mud1;
    this.rutUv.set([u0, 0, u0, 1, u1, 0, u1, 1], v * 2);
    this.dirtyFrom = Math.min(this.dirtyFrom, s);
    this.dirtyTo = Math.max(this.dirtyTo, s);
  }

  flush() {
    if (this.dirtyTo < 0) return;
    const from = this.dirtyFrom * 4;
    const count = (this.dirtyTo - this.dirtyFrom + 1) * 4;
    const a = this.geometry.attributes;
    for (const [attr, size] of [[a.position, 3], [a.aBirth, 1], [a.aMud, 1], [a.aRutUv, 2]]) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(from * size, count * size);
      attr.needsUpdate = true;
    }
    this.dirtyFrom = Infinity;
    this.dirtyTo = -1;
  }

  /** How many segments are still visible, for checks. */
  get visibleCount() {
    let n = 0;
    for (let s = 0; s < MAX_SEGMENTS; s++) {
      const life = this.mud[s * 4] > 0.5 ? this.params.rutMudLife : this.params.rutGrassLife;
      if (this.time - this.birth[s * 4] < life) n++;
    }
    return n;
  }
}
