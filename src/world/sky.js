import * as THREE from 'three';

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

  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, 0.0, 1.0);
    vec3 col = mix(horizonColor, zenithColor, pow(h, 0.6));
    if (d.y > 0.0) {
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
    this.scene.fog.density = p.fogDensity;
    this.sun.intensity = p.sunIntensity;
    this.hemi.intensity = p.hemiIntensity;
    this.renderer.toneMappingExposure = p.exposure;

    // Keep the shadow frustum centred on the action, snapped to texels to stop shimmering.
    const texel = 90 / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel;
    const fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx + this.sunOffset.x, focus.y + this.sunOffset.y, fz + this.sunOffset.z);
    this.dome.position.copy(camera.position);
  }
}
