import * as THREE from 'three';
import { ShadowFit } from './shadowFit.js';
import { DEFAULT_GRAPHICS_PARAMS } from '../core/graphics.js';

export const SKY_PARAMS = {
  horizonColor: '#cfd3d4',
  zenithColor: '#9aa3ab',
  cloudColor: '#e4e6e6',
  cloudShadowColor: '#8c949b',
  cloudCover: 0.62,
  cloudSpeed: 0.004,
  fogDensity: 0.0055,
  sunIntensity: 1.25,
  hemiIntensity: 1.7,
  exposure: 1.0,
};

export const SKY_RANGES = {
  cloudCover: [0, 1, 0.01],
  cloudSpeed: [0, 0.05, 0.001],
  fogDensity: [0, 0.03, 0.0005],
  sunIntensity: [0, 4, 0.05],
  hemiIntensity: [0, 4, 0.05],
  exposure: [0.2, 2.5, 0.05],
};

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

// Overcast: a grey gradient with soft, slowly drifting cloud masses.
const fragmentShader = /* glsl */ `
  uniform vec3 horizonColor;
  uniform vec3 zenithColor;
  uniform vec3 cloudColor;
  uniform vec3 cloudShadowColor;
  uniform float cover;
  uniform float time;
  uniform float stars;
  uniform vec3 moonDir;
  uniform float moonPhase;
  uniform float moonLevel;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  // Stars: a grid of cells over the sphere, each holding at most one, of its own brightness and a slight tint, twinkling a little.
  float starField(vec3 d) {
    vec3 q = d * 140.0;
    vec3 c = floor(q);
    vec3 f = fract(q) - 0.5;
    float r = fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    if (r < 0.9) return 0.0;
    vec3 off = (vec3(fract(r * 91.7), fract(r * 37.3), fract(r * 17.9)) - 0.5) * 0.6;
    float dist = length(f - off);
    float bright = (r - 0.9) * 10.0;
    float tw = 0.8 + 0.2 * sin(time * 900.0 + r * 60.0);
    return smoothstep(0.17, 0.0, dist) * (0.35 + 0.65 * bright * bright) * tw;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, 0.0, 1.0);
    vec3 col = mix(horizonColor, zenithColor, pow(h, 0.6));
    if (d.y > 0.0) {
      float sky = smoothstep(0.02, 0.3, d.y);
      if (stars > 0.0) col += vec3(0.85, 0.9, 1.0) * starField(d) * stars * sky;
      if (moonLevel > 0.0) {
        // The moon: a disc seen face on, lit by the sun's side of it (the phase), with a halo round it.
        float cosA = dot(d, moonDir);
        float radius = 0.035;
        float ang = acos(clamp(cosA, -1.0, 1.0));
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), moonDir));
        vec3 up = cross(moonDir, right);
        vec2 local = vec2(dot(d, right), dot(d, up)) / sin(radius);
        float rr = dot(local, local);
        float halo = exp(-ang * ang / (radius * radius * 30.0)) * 0.22;
        float disc = 0.0;
        if (cosA > 0.0 && rr < 1.0) {
          vec3 n = vec3(local, sqrt(1.0 - rr));
          float a = 6.2831853 * moonPhase;
          vec3 toSun = vec3(sin(a), 0.0, -cos(a));
          float lit = smoothstep(-0.04, 0.06, dot(n, toSun));
          float maria = 0.8 + 0.2 * noise(local * 3.0 + 7.0);
          disc = (0.04 + 0.96 * lit) * maria * smoothstep(1.0, 0.92, sqrt(rr));
        }
        col += vec3(0.9, 0.93, 1.0) * (halo * (0.15 + 0.85 * moonPhase * (1.0 - moonPhase) * 4.0) + disc * 1.3) * moonLevel * sky;
      }
      vec2 uv = d.xz / (d.y + 0.12) * 1.4 + vec2(time, time * 0.4);
      float n = fbm(uv);
      float clouds = smoothstep(1.0 - cover - 0.15, 1.0 - cover + 0.35, n);
      float shade = fbm(uv * 1.7 + 3.1);
      vec3 cloud = mix(cloudShadowColor, cloudColor, smoothstep(0.3, 0.75, shade));
      col = mix(col, cloud, clouds * smoothstep(0.0, 0.25, d.y));
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Sky {
  constructor(scene, renderer, params = SKY_PARAMS) {
    this.scene = scene;
    this.renderer = renderer;
    this.params = params;

    this.uniforms = {
      horizonColor: { value: new THREE.Color(params.horizonColor) },
      zenithColor: { value: new THREE.Color(params.zenithColor) },
      cloudColor: { value: new THREE.Color(params.cloudColor) },
      cloudShadowColor: { value: new THREE.Color(params.cloudShadowColor) },
      cover: { value: params.cloudCover },
      time: { value: 0 },
      stars: { value: 0 },
      moonDir: { value: new THREE.Vector3(0, -1, 0) },
      moonPhase: { value: 0.5 },
      moonLevel: { value: 0 },
    };
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(1000, 48, 24),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader,
        fragmentShader,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1;
    scene.add(this.dome);

    scene.fog = new THREE.FogExp2(params.horizonColor, params.fogDensity);
    scene.background = new THREE.Color(params.horizonColor);

    this.hemi = new THREE.HemisphereLight(0xdfe4e8, 0x5b5a3e, params.hemiIntensity);
    scene.add(this.hemi);

    // Diffuse sun through thin cloud: soft, slightly warm, high in the south-west.
    this.sun = new THREE.DirectionalLight(0xfff3e2, params.sunIntensity);
    this.sunOffset = new THREE.Vector3(-40, 70, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera;
    s.left = s.bottom = -45;
    s.right = s.top = 45;
    s.near = 1;
    s.far = 220;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 4;
    this.fit = new ShadowFit();
    this.viewDir = new THREE.Vector3();
    this.graphics = null; // the graphics params, lent by the World (shadowSize, shadowAhead)
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.buildEnvironment();
  }

  /** Bakes the sky into an environment map for soft reflections on paint and puddles. */
  buildEnvironment() {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(this.dome.geometry, this.dome.material));
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(900, 16).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x4a5a30 }),
    );
    ground.position.y = -5;
    envScene.add(ground);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(envScene, 0.02).texture;
    this.scene.environmentIntensity = 0.6;
    pmrem.dispose();
  }

  update(dt, focus, camera) {
    const p = this.params;
    this.uniforms.time.value += dt * p.cloudSpeed;
    this.uniforms.cover.value = p.cloudCover;
    // Colours follow the params too, as the weather changes.
    this.uniforms.horizonColor.value.set(p.horizonColor);
    this.uniforms.zenithColor.value.set(p.zenithColor);
    this.uniforms.cloudColor.value.set(p.cloudColor);
    this.uniforms.cloudShadowColor.value.set(p.cloudShadowColor);
    // The night sky (night.js, lent by daylight.js's skyAt): the stars and the moon, absent while there is no time of day.
    this.uniforms.stars.value = p.starLevel ?? 0;
    this.uniforms.moonLevel.value = p.moonLevel ?? 0;
    this.uniforms.moonPhase.value = p.moonPhase ?? 0.5;
    if (p.moonDir) this.uniforms.moonDir.value.set(p.moonDir.x, p.moonDir.y, p.moonDir.z).normalize();
    this.scene.fog.color.set(p.horizonColor);
    this.scene.background.set(p.horizonColor);
    // The leaves' soft cut-out edges (assets.js) let a little of what's behind the canvas through, so behind it is the sky's colour too:
    // against the page's grey, the trees sparkled at night.
    if (this.backdrop !== p.horizonColor && this.renderer.domElement?.style) {
      this.backdrop = p.horizonColor;
      this.renderer.domElement.style.background = p.horizonColor;
    }
    this.scene.fog.density = p.fogDensity;
    this.sun.intensity = p.sunIntensity;
    this.hemi.intensity = p.hemiIntensity;
    this.renderer.toneMappingExposure = p.exposure;
    // The time of day (daylight.js): the sun's colour and where it is, the sky's fill going blue, and the baked reflections dimming with
    // the light so paint doesn't shine with the afternoon at night.
    if (p.sunColor) this.sun.color.set(p.sunColor);
    if (p.hemiColor) this.hemi.color.set(p.hemiColor);
    if (p.sunDir) this.sunOffset.set(p.sunDir.x, p.sunDir.y, p.sunDir.z).multiplyScalar(85);
    this.scene.environmentIntensity = 0.6 * (p.envLevel ?? 1);

    // Keep the shadow window on what you can see: ahead of you along the view, snapped to texels to stop shimmering (shadowFit.js).
    const g = this.graphics ?? DEFAULT_GRAPHICS_PARAMS;
    const half = g.shadowSize / 2;
    const cam = this.sun.shadow.camera;
    if (cam.right !== half) {
      cam.left = cam.bottom = -half;
      cam.right = cam.top = half;
      cam.updateProjectionMatrix();
    }
    if (camera.getWorldDirection) {
      camera.getWorldDirection(this.viewDir);
      this.fit.update(dt, this.viewDir.x, this.viewDir.z);
    }
    const { x: fx, z: fz } = this.fit.centre(focus, g.shadowAhead, g.shadowSize / this.sun.shadow.mapSize.x);
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx + this.sunOffset.x, focus.y + this.sunOffset.y, fz + this.sunOffset.z);
    this.dome.position.copy(camera.position);
  }
}
