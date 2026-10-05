import * as THREE from 'three';

// Mud thrown by the tyres: clumps flung up off the back of each tyre when it
// rolls through mud, a roost of dirt kicked out behind spinning wheels, and
// muddy water splashing out of puddles. Clumps fly under gravity, land, sit on
// the ground for a few seconds as dark specks and shrink away. One point
// buffer per quad, with a spawn cap, drawn opaque.

const MAX = 1600;

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aSeed;
  varying vec3 vColor;
  varying float vSeed;
  uniform float uScale;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // A pixel and a half at least, so distant flecks don't shimmer away to nothing.
    gl_PointSize = aSize > 0.0 ? max(1.5, aSize * uScale / max(0.1, -mvPosition.z)) : 0.0;
    vColor = aColor;
    vSeed = aSeed;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vSeed;
  uniform vec3 uLight;
  #include <fog_pars_fragment>
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    // Lumpy outline, different for each clump.
    float ang = atan(uv.y, uv.x);
    float edge = 0.36 + 0.08 * sin(ang * 3.0 + vSeed * 40.0) + 0.05 * sin(ang * 5.0 - vSeed * 23.0);
    float r = length(uv);
    if (r > edge) discard;
    // Rounded and wet: lit from above, a small highlight.
    float shade = 0.75 + 0.45 * (0.5 - uv.y) - 0.35 * (r / edge) * (r / edge);
    float spec = smoothstep(0.1, 0.0, length(uv - vec2(-0.08, -0.12))) * 0.25;
    gl_FragColor = vec4(uLight * (vColor * shade + spec), 1.0);
    #include <fog_fragment>
  }
`;

const _fwd = new THREE.Vector3();
const _side = new THREE.Vector3();
const _up = new THREE.Vector3();
const _centre = new THREE.Vector3();

export class MudSpray {
  constructor(scene, heightAt, params) {
    this.params = params;
    this.heightAt = heightAt;
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.color = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.size0 = new Float32Array(MAX);
    this.age = new Float32Array(MAX);
    this.landed = new Float32Array(MAX).fill(-1); // time it landed, < 0 while flying
    this.life = new Float32Array(MAX).fill(-1); // < 0 means free
    this.water = new Uint8Array(MAX);
    this.seed = new Float32Array(MAX).map(() => Math.random());
    this.next = 0;
    this.live = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    this.geometry = geo;
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uScale: { value: 600 }, uLight: { value: new THREE.Color(0xe2ddd4) } },
      ]),
      vertexShader,
      fragmentShader,
      fog: true,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);

    this.budget = 0;
    this.carry = [0, 0, 0, 0]; // fractional spawns per wheel
    this.wasInPuddle = [0, 0, 0, 0];
  }

  setViewport(heightPx, fovDeg) {
    this.material.uniforms.uScale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  /**
   * @param {number} dt
   * @param {Quad} quad
   * @param {number} spinSlip  Driven tyres' surface speed over the ground, m/s.
   */
  update(dt, quad, spinSlip) {
    const p = this.params;
    this.budget = Math.min(this.budget + p.maxPerSecond * dt, p.maxPerSecond * 0.1);
    const q = quad.model.quaternion;
    _fwd.set(0, 0, 1).applyQuaternion(q);
    _up.set(0, 1, 0).applyQuaternion(q);
    const carrier = quad.velocity;
    const speed = Math.hypot(carrier.x, carrier.z);
    const info = quad.physics.wheelInfo;

    for (let i = 0; i < quad.wheels.length; i++) {
      const w = quad.wheels[i];
      const wi = info[i];
      if (!wi.contact) {
        this.wasInPuddle[i] = 0;
        continue;
      }
      const mud = Math.max(wi.mud, wi.puddle);
      const slip = wi.driven ? spinSlip : 0;
      const rate = mud * (p.rollRate * Math.min(speed, 14) + p.spinRate * slip) + wi.puddle * p.puddleRate * Math.min(speed, 12);
      this.carry[i] = Math.min(this.carry[i] + rate * dt, 6);
      w.object.getWorldPosition(_centre);
      _side.set(Math.sign(w.x), 0, 0).applyQuaternion(q);

      // Driving into a puddle throws up a sheet of muddy water.
      if (wi.puddle > 0.45 && this.wasInPuddle[i] <= 0.45 && speed > 1.2) {
        const n = Math.min(p.splashCount, Math.round(p.splashCount * Math.min(1, speed / 8)));
        for (let k = 0; k < n; k++) this.spawnSplash(_centre, carrier, speed, true);
      }
      this.wasInPuddle[i] = wi.puddle;

      while (this.carry[i] >= 1 && this.budget >= 1) {
        this.carry[i] -= 1;
        this.budget -= 1;
        const r = Math.random();
        if (wi.puddle > 0.3 && r < wi.puddle * 0.7) this.spawnSplash(_centre, carrier, speed, false);
        else if (slip > 0.5 && r < slip / (slip + speed * 0.6 + 0.01)) this.spawnRoost(_centre, carrier, slip);
        else this.spawnFling(_centre, carrier, speed, w);
      }
    }
    this.simulate(dt);
  }

  /** Clumps leaving the back of a rolling tyre: up, and lagging behind the quad. */
  spawnFling(centre, carrier, speed, w) {
    const p = this.params;
    const R = 0.3;
    const lag = 0.7 + Math.random() * 0.25;
    const lift = speed * (p.flingLift * (0.4 + Math.random() * 0.8));
    const out = (Math.random() - 0.3) * 0.35 * speed * 0.15;
    const a = Math.random() * 0.9; // round the back of the tyre, from the ground up to the top
    const px = centre.x - _fwd.x * R * Math.cos(a) * 0.9 + _up.x * R * (Math.sin(a) - 0.6) + _side.x * (Math.random() - 0.5) * 0.2;
    const py = centre.y - _fwd.y * R * Math.cos(a) * 0.9 + _up.y * R * (Math.sin(a) - 0.6);
    const pz = centre.z - _fwd.z * R * Math.cos(a) * 0.9 + _up.z * R * (Math.sin(a) - 0.6) + _side.z * (Math.random() - 0.5) * 0.2;
    this.emit(
      px, py, pz,
      carrier.x * lag + _side.x * out + (Math.random() - 0.5) * 0.4,
      lift + carrier.y,
      carrier.z * lag + _side.z * out + (Math.random() - 0.5) * 0.4,
      p.clumpSize * (0.5 + Math.random()),
      false,
    );
  }

  /** Dirt kicked out backwards from under a spinning tyre. */
  spawnRoost(centre, carrier, slip) {
    const p = this.params;
    const back = slip * (0.45 + Math.random() * 0.6);
    const up = slip * (0.2 + Math.random() * 0.45);
    const out = (Math.random() - 0.5) * slip * 0.35;
    const px = centre.x - _fwd.x * 0.32 - _up.x * 0.22;
    const py = centre.y - _fwd.y * 0.32 - _up.y * 0.22;
    const pz = centre.z - _fwd.z * 0.32 - _up.z * 0.22;
    this.emit(
      px, py, pz,
      carrier.x - _fwd.x * back + _side.x * out,
      carrier.y + up,
      carrier.z - _fwd.z * back + _side.z * out,
      p.clumpSize * (0.4 + Math.random() * 1.1),
      false,
    );
  }

  /** Muddy water thrown out sideways and up from a puddle. */
  spawnSplash(centre, carrier, speed, burst) {
    const p = this.params;
    const k = Math.min(1.4, speed / 7) * (burst ? 1.2 : 0.8);
    const out = (0.6 + Math.random() * 2.2) * k * (Math.random() < 0.5 ? -1 : 1);
    const up = (1 + Math.random() * 2.6) * k;
    const fwd = speed * (0.15 + Math.random() * 0.45);
    const fwdX = carrier.x / Math.max(0.1, speed);
    const fwdZ = carrier.z / Math.max(0.1, speed);
    const px = centre.x + (Math.random() - 0.5) * 0.4 - _up.x * 0.25;
    const py = centre.y - _up.y * 0.22;
    const pz = centre.z + (Math.random() - 0.5) * 0.4 - _up.z * 0.25;
    this.emit(
      px, py, pz,
      fwdX * fwd + _side.x * out + (Math.random() - 0.5) * 0.5,
      up,
      fwdZ * fwd + _side.z * out + (Math.random() - 0.5) * 0.5,
      p.dropSize * (0.5 + Math.random()) * (burst ? 1.5 : 1),
      true,
    );
  }

  emit(x, y, z, vx, vy, vz, size, water) {
    const p = this.params;
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    const j = i * 3;
    this.pos[j] = x;
    this.pos[j + 1] = y;
    this.pos[j + 2] = z;
    this.vel[j] = vx;
    this.vel[j + 1] = vy;
    this.vel[j + 2] = vz;
    this.size0[i] = size;
    this.size[i] = size;
    this.age[i] = 0;
    this.landed[i] = -1;
    // Water soaks away almost at once; clumps sit there a while.
    this.life[i] = water ? 0.25 + Math.random() * 0.3 : p.groundLife * (0.6 + Math.random() * 0.8);
    this.water[i] = water ? 1 : 0;
    // Dark wet earth, some lighter clay; puddle water is browner and lighter.
    const c = water ? p.waterGray : p.mudGray;
    const v = c * (0.7 + Math.random() * 0.6);
    this.color[j] = v * (water ? 1.08 : 1.25);
    this.color[j + 1] = v * (water ? 0.98 : 0.95);
    this.color[j + 2] = v * (water ? 0.85 : 0.68);
    this.seed[i] = Math.random();
  }

  simulate(dt) {
    const p = this.params;
    const drag = Math.exp(-p.drag * dt);
    let live = 0;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] < 0) {
        this.size[i] = 0;
        continue;
      }
      live++;
      const age = (this.age[i] += dt);
      const j = i * 3;
      if (this.landed[i] < 0) {
        this.vel[j] *= drag;
        this.vel[j + 1] = this.vel[j + 1] * drag - p.gravity * dt;
        this.vel[j + 2] *= drag;
        this.pos[j] += this.vel[j] * dt;
        this.pos[j + 1] += this.vel[j + 1] * dt;
        this.pos[j + 2] += this.vel[j + 2] * dt;
        const ground = this.heightAt(this.pos[j], this.pos[j + 2]) + this.size0[i] * 0.2;
        if (this.pos[j + 1] <= ground && this.vel[j + 1] < 0) {
          // Splat: stays where it fell.
          this.pos[j + 1] = ground;
          this.landed[i] = age;
          if (!this.water[i]) this.size0[i] *= 1.3;
        } else if (age > 4) {
          this.life[i] = -1;
          this.size[i] = 0;
          continue;
        }
        this.size[i] = this.size0[i];
      } else {
        const t = (age - this.landed[i]) / this.life[i];
        if (t >= 1) {
          this.life[i] = -1;
          this.size[i] = 0;
          continue;
        }
        this.size[i] = this.size0[i] * (1 - t * t);
      }
    }
    this.live = live;
    const g = this.geometry.attributes;
    g.position.needsUpdate = true;
    g.aSize.needsUpdate = true;
    g.aColor.needsUpdate = true;
    g.aSeed.needsUpdate = true;
  }
}
