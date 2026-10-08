import * as THREE from 'three';

// The dust a quad throws up on dry stubble (world/dust.js says how much): soft tan puffs lifted off the ground behind it that
// swell and thin away, so a quad ridden fast leaves a cloud hanging along its track. One point buffer per quad.

const MAX = 260;

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aSeed;
  varying float vAlpha;
  varying float vSeed;
  uniform float uScale;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uScale / max(0.1, -mvPosition.z);
    vAlpha = aAlpha;
    vSeed = aSeed;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vSeed;
  uniform vec3 uColor;
  #include <fog_pars_fragment>
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    float wisp = 0.5 + 0.5 * sin(atan(uv.y, uv.x) * 3.0 + vSeed * 40.0);
    float a = smoothstep(1.0, 0.1, r + wisp * 0.12);
    if (a <= 0.003) discard;
    gl_FragColor = vec4(uColor, a * vAlpha);
    #include <fog_fragment>
  }
`;

export class DustCloud {
  constructor(scene, heightAt, params) {
    this.params = params;
    this.heightAt = heightAt;
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.age = new Float32Array(MAX);
    this.life = new Float32Array(MAX).fill(-1); // < 0 means free
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.seed = new Float32Array(MAX).map(() => Math.random());
    this.next = 0;
    this.budget = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uScale: { value: 600 }, uColor: { value: new THREE.Color(0xbfae85) } }]),
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    scene.add(this.points);
  }

  setViewport(heightPx, fovDeg) {
    this.material.uniforms.uScale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  /**
   * @param {number} dt
   * @param {number} level  0..1 how much dust the quad is throwing up
   * @param {{x,y,z}} at  Where it lifts: the ground behind the quad's wheels
   * @param {{x,z}} vel  The quad's velocity, a little of which the dust takes with it
   */
  update(dt, level, at, vel) {
    const p = this.params;
    this.budget = Math.min(this.budget + p.puffRate * level * dt, 6);
    while (this.budget >= 1) {
      this.budget -= 1;
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      this.pos[i * 3] = at.x + (Math.random() - 0.5) * 1.1;
      this.pos[i * 3 + 1] = this.heightAt(at.x, at.z) + 0.15;
      this.pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * 1.1;
      this.vel[i * 3] = vel.x * 0.25 + (Math.random() - 0.5) * 0.8;
      this.vel[i * 3 + 1] = 0.5 + Math.random() * 0.6;
      this.vel[i * 3 + 2] = vel.z * 0.25 + (Math.random() - 0.5) * 0.8;
      this.age[i] = 0;
      this.life[i] = p.puffLife * (0.7 + Math.random() * 0.6);
    }
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] < 0) {
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      this.age[i] += dt;
      const k = this.age[i] / this.life[i];
      if (k >= 1) {
        this.life[i] = -1;
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      const damp = 1 - Math.min(1, dt * 1.2);
      this.vel[i * 3] *= damp;
      this.vel[i * 3 + 1] *= 1 - Math.min(1, dt * 1.8);
      this.vel[i * 3 + 2] *= damp;
      for (let a = 0; a < 3; a++) this.pos[i * 3 + a] += this.vel[i * 3 + a] * dt;
      this.size[i] = p.puffSize * (1 + 2.2 * k);
      this.alpha[i] = p.puffAlpha * (1 - k) * Math.min(1, k * 8);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  }
}
