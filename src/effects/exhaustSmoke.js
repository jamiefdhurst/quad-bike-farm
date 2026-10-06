import * as THREE from 'three';

// Exhaust smoke. One soft puff per firing pulse, so at idle you can see the
// individual beats. How thick and what colour depends on the engine: white-grey
// vapour when cold, dark grey when running rich or flooded, a dark burst when
// the throttle is snapped open, and a light haze once warm.

export const DEFAULT_SMOKE_PARAMS = {
  opacity: 1.4, // master
  maxPerSecond: 60, // spawn cap; at high revs pulses are merged into fewer, denser puffs
  lifeMin: 1.6, // seconds
  lifeMax: 5.0,
  startSize: 0.09, // metres
  endSize: 2.3,
  exitSpeed: 2.0, // m/s out of the tip at idle
  throttleExitSpeed: 4.0, // extra at full throttle
  drag: 2.2, // 1/s, how fast puffs stop following the pipe and join the wind
  buoyancy: 0.6, // m/s^2 upward, warm gas rises
  windX: 0.7, // m/s
  windZ: 0.3,
  warmDensity: 0.15, // opacity of a puff from a warm, healthy engine
  coldDensity: 0.6, // extra when stone cold
  richDensity: 0.9, // extra at full richness
  foulDensity: 0.4, // extra with a fouled plug
  oilDensity: 1.2, // extra at full excess oil (too much pre-mix, or any in a four-stroke)
  waterDensity: 0.8, // extra steam from a drowned engine, white
  dieselDensity: 0.9, // extra thick smoke from a diesel-soaked engine, mid grey
  throttleBurst: 0.85, // extra when the throttle is snapped open
  throttleDensity: 0, // extra smoke at full throttle, held, not just on a blip (the tractor's)
  throttleBlack: 0, // and how black that is
  burstBlack: 0, // how black that burst is, 0 as usual to 1 for soot (the tractor's)
  catchBlack: 0, // how black, and how big, the cloud is when it catches: 0 as usual, 1 for the tractor's clatter and black cloud
  crankDensity: 0.26, // puffs while cranking
  coughDensity: 0.9, // puffs on a stall
  coldGray: 0.88, // colour of cold-engine vapour (0 black, 1 white)
  richGray: 0.22, // colour of rich, sooty smoke
  warmGray: 0.62,
  dieselGray: 0.5, // colour of diesel smoke: thick grey
  tint: '#ffffff', // colour cast; two-stroke oil smoke is bluish
  flashBrightness: 1, // how bright an overrun pop's flash from the pipe is, in poor light
};

export const SMOKE_PARAM_RANGES = {
  opacity: [0, 3, 0.01],
  maxPerSecond: [5, 120, 1],
  lifeMin: [0.2, 6, 0.05],
  lifeMax: [0.2, 8, 0.05],
  startSize: [0.01, 0.5, 0.005],
  endSize: [0.1, 5, 0.05],
  exitSpeed: [0, 8, 0.1],
  throttleExitSpeed: [0, 12, 0.1],
  drag: [0, 10, 0.1],
  buoyancy: [-1, 2, 0.01],
  windX: [-5, 5, 0.05],
  windZ: [-5, 5, 0.05],
  warmDensity: [0, 1, 0.005],
  coldDensity: [0, 1, 0.005],
  richDensity: [0, 2, 0.01],
  waterDensity: [0, 2, 0.01],
  dieselDensity: [0, 2, 0.01],
  dieselGray: [0, 1, 0.01],
  foulDensity: [0, 2, 0.01],
  oilDensity: [0, 3, 0.01],
  throttleBurst: [0, 2, 0.01],
  throttleDensity: [0, 3, 0.01],
  throttleBlack: [0, 1, 0.01],
  burstBlack: [0, 1, 0.01],
  catchBlack: [0, 1, 0.01],
  crankDensity: [0, 1, 0.005],
  coughDensity: [0, 2, 0.01],
  coldGray: [0, 1, 0.01],
  richGray: [0, 1, 0.01],
  warmGray: [0, 1, 0.01],
  flashBrightness: [0, 3, 0.05],
};

const MAX = 600;

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aGray;
  attribute float aSeed;
  varying float vAlpha;
  varying float vGray;
  varying float vSeed;
  uniform float uScale;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uScale / max(0.1, -mvPosition.z);
    vAlpha = aAlpha;
    vGray = aGray;
    vSeed = aSeed;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vGray;
  varying float vSeed;
  uniform vec3 uLight;
  uniform vec3 uTint;
  #include <fog_pars_fragment>
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    // Soft blob with a wispy edge.
    float n = noise(uv * 5.0 + vSeed * 17.0) * 0.6 + noise(uv * 11.0 - vSeed * 9.0) * 0.4;
    float a = smoothstep(1.0, 0.15, r + (n - 0.5) * 0.55);
    if (a <= 0.003) discard;
    // Lit a little from above.
    float shade = 0.82 + 0.18 * (0.5 - uv.y);
    gl_FragColor = vec4(uLight * uTint * vGray * shade, a * vAlpha);
    #include <fog_fragment>
  }
`;

export class ExhaustSmoke {
  constructor(scene, heightAt, params = { ...DEFAULT_SMOKE_PARAMS }) {
    this.params = params;
    this.heightAt = heightAt;
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.age = new Float32Array(MAX);
    this.life = new Float32Array(MAX).fill(-1); // < 0 means free
    this.alpha0 = new Float32Array(MAX);
    this.gray = new Float32Array(MAX);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.seed = new Float32Array(MAX).map(() => Math.random());
    this.next = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aGray', new THREE.BufferAttribute(this.gray, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    this.geometry = geo;

    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uScale: { value: 600 }, uLight: { value: new THREE.Color(0xd8dcde) }, uTint: { value: new THREE.Color(params.tint ?? '#ffffff') } },
      ]),
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

    // The flash of an overrun pop: a small additive glow at the tip, only visible when the light is poor.
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffa040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.flash.visible = false;
    this.flash.renderOrder = 3;
    scene.add(this.flash);
    this.flashLeft = 0;
    this.darkness = 0; // 0 bright day .. 1 dark: set by the game from the weather

    this.spawnBudget = 0;
    this.pendingAlpha = 0;
    this.burst = 0;
    this.lastThrottle = 0;
    this.tipPos = new THREE.Vector3();
    this.tipDir = new THREE.Vector3();
    this.tmpQ = new THREE.Quaternion();
  }

  /** Viewport height in pixels, so point sizes are in metres. */
  setViewport(heightPx, fovDeg) {
    this.material.uniforms.uScale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  /**
   * @param {number} dt
   * @param {EngineModel} engine
   * @param {THREE.Object3D} tip     Exhaust tip; smoke leaves along its local -Z.
   * @param {{x,y,z}} carrierVel     World velocity of the bike.
   */
  update(dt, engine, tip, carrierVel) {
    const p = this.params;
    tip.getWorldPosition(this.tipPos);
    tip.getWorldQuaternion(this.tmpQ);
    this.tipDir.set(0, 0.12, -1).normalize().applyQuaternion(this.tmpQ);

    // Snapping the throttle open makes a dark burst.
    const dThrottle = engine.throttle - this.lastThrottle;
    this.lastThrottle = engine.throttle;
    if (dThrottle > 0) this.burst = Math.min(1, this.burst + dThrottle * 2);
    this.burst *= Math.exp(-dt * 2.5);

    const coldness = 1 - engine.temperature;
    const rich = Math.max(0, engine.mixture - engine.params.richTolerance);
    const density =
      p.warmDensity + p.coldDensity * coldness + p.richDensity * rich + p.foulDensity * engine.fouling + p.oilDensity * engine.oilRich + p.waterDensity * (engine.water ?? 0) + p.dieselDensity * (engine.dieselSoak ?? 0) + p.throttleBurst * this.burst + p.throttleDensity * engine.throttle;
    // Colour: vapour-white when cold, sooty when rich or bursting.
    const sooty = Math.min(1, rich * 1.5 + engine.fouling + engine.oilRich * 0.6 + this.burst * 0.5);
    const base = p.warmGray + (p.coldGray - p.warmGray) * coldness;
    const steamy = Math.min(1, (engine.water ?? 0) * 3); // water's steam is white whatever else is going on
    const dieselly = Math.min(1, (engine.dieselSoak ?? 0) * 2); // diesel smoke is grey, over the sootiness
    const sootGray = (base + (p.richGray - base) * sooty) * (1 - dieselly) + p.dieselGray * dieselly;
    const gray = (sootGray * (1 - steamy) + p.coldGray * steamy) * (1 - p.burstBlack * this.burst) * (1 - p.throttleBlack * engine.throttle);

    this.spawnBudget = Math.min(this.spawnBudget + p.maxPerSecond * dt, 3);
    for (const pulse of engine.pulses) {
      let a = 0;
      if (pulse.type === 'fire' || pulse.type === 'sputter') a = density * pulse.strength;
      else if (pulse.type === 'misfire') a = density * 1.5 + p.richDensity * 0.2; // unburnt fuel
      else if (pulse.type === 'compression') a = engine.state === 'cranking' ? p.crankDensity : p.crankDensity * 0.5;
      this.pendingAlpha += a;
      if (this.spawnBudget >= 1 && this.pendingAlpha > 0.005) {
        this.spawnBudget -= 1;
        const exit = p.exitSpeed + p.throttleExitSpeed * engine.throttle;
        this.spawn(Math.min(1, this.pendingAlpha), gray, exit, carrierVel, dt - pulse.t);
        this.pendingAlpha = 0;
      }
    }
    for (const e of engine.events) {
      if (e.type === 'overrunPop') this.flashLeft = Math.max(this.flashLeft, e.strength);
      if (e.type === 'stalled' || e.type === 'caught') {
        const black = e.type === 'caught' ? p.catchBlack : 0;
        const puffs = 3 + Math.round(black * 12);
        for (let i = 0; i < puffs; i++) {
          this.spawn(Math.min(1, p.coughDensity * (1 - i * 0.25 / (1 + black * 1.5)) * (1 + black)), (p.richGray + 0.15) * (1 - black * 0.9), 1.5 + black * 1.5, carrierVel, dt - e.t);
        }
      }
    }

    this.updateFlash(dt);
    this.simulate(dt);
  }

  /** The flash of an overrun pop at the tip, which you only see in poor light. */
  updateFlash(dt) {
    this.flashLeft *= Math.exp(-dt / 0.03);
    const seen = this.flashLeft * this.params.flashBrightness * this.darkness;
    this.flash.visible = seen > 0.02;
    if (!this.flash.visible) return;
    this.flash.position.copy(this.tipPos);
    this.flash.material.opacity = Math.min(1, seen);
    this.flash.scale.setScalar(0.12 + 0.2 * this.flashLeft);
  }

  spawn(alpha, gray, exit, carrierVel, preAge) {
    const p = this.params;
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    const j = i * 3;
    const spread = 0.35;
    this.vel[j] = carrierVel.x + this.tipDir.x * exit + (Math.random() - 0.5) * spread;
    this.vel[j + 1] = carrierVel.y + this.tipDir.y * exit + (Math.random() - 0.5) * spread;
    this.vel[j + 2] = carrierVel.z + this.tipDir.z * exit + (Math.random() - 0.5) * spread;
    // Start where the puff would be now if it left the pipe earlier in this frame.
    const back = Math.max(0, preAge);
    this.pos[j] = this.tipPos.x - carrierVel.x * back + this.vel[j] * back * 0.5;
    this.pos[j + 1] = this.tipPos.y - carrierVel.y * back + this.vel[j + 1] * back * 0.5;
    this.pos[j + 2] = this.tipPos.z - carrierVel.z * back + this.vel[j + 2] * back * 0.5;
    this.age[i] = back;
    this.life[i] = p.lifeMin + Math.random() * (p.lifeMax - p.lifeMin);
    this.alpha0[i] = alpha;
    this.gray[i] = Math.min(1, Math.max(0, gray + (Math.random() - 0.5) * 0.06));
  }

  simulate(dt) {
    const p = this.params;
    const dragK = Math.exp(-p.drag * dt);
    for (let i = 0; i < MAX; i++) {
      const life = this.life[i];
      if (life < 0) {
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      const age = (this.age[i] += dt);
      if (age >= life) {
        this.life[i] = -1;
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      const j = i * 3;
      // Relax toward the wind, rise a little.
      this.vel[j] = p.windX + (this.vel[j] - p.windX) * dragK;
      this.vel[j + 1] = this.vel[j + 1] * dragK + p.buoyancy * dt;
      this.vel[j + 2] = p.windZ + (this.vel[j + 2] - p.windZ) * dragK;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;

      const t = age / life;
      this.size[i] = p.startSize + (p.endSize - p.startSize) * Math.sqrt(t);
      // Puffs roll along the ground rather than sinking into it.
      const floor = this.heightAt(this.pos[j], this.pos[j + 2]) + this.size[i] * 0.5;
      if (this.pos[j + 1] < floor) {
        this.pos[j + 1] = floor;
        if (this.vel[j + 1] < 0) this.vel[j + 1] = 0;
      }
      // Quick fade in, long fade out; bigger puffs thin out.
      const fadeIn = Math.min(1, age / 0.08);
      this.alpha[i] = this.alpha0[i] * p.opacity * fadeIn * (1 - t) ** 1.6;
    }
    const g = this.geometry.attributes;
    g.position.needsUpdate = true;
    g.aSize.needsUpdate = true;
    g.aAlpha.needsUpdate = true;
    g.aGray.needsUpdate = true;
  }
}
