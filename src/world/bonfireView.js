import * as THREE from 'three';
import { ExhaustSmoke, DEFAULT_SMOKE_PARAMS } from '../effects/exhaustSmoke.js';

// The bonfire as you see it (world/bonfire.js says what state it is in): a ring of stones, the pile of cuttings growing as bundles go on, flames
// that flicker and lean, an orange glow on the ground, sparks, woodsmoke on the wind, a flickering point light made at the start (only its
// strength changes, never a light added), and the logs the girls sit on. No colliders: you can ride through it, and are warned.

const SEAT_HEIGHT = 0.42;
const STICKS_PER_HEAP = 7;
const SPARKS = 36;

function flameTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, 'rgba(255,200,90,1)');
  grad.addColorStop(0.35, 'rgba(255,120,30,0.9)');
  grad.addColorStop(0.8, 'rgba(200,50,10,0.35)');
  grad.addColorStop(1, 'rgba(120,20,0,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(32, 0);
  g.bezierCurveTo(52, 40, 62, 80, 50, 118);
  g.quadraticCurveTo(32, 134, 14, 118);
  g.bezierCurveTo(2, 80, 12, 40, 32, 0);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,150,50,0.9)');
  grad.addColorStop(0.5, 'rgba(255,90,20,0.35)');
  grad.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class BonfireView {
  /**
   * @param {object} o.site  { x, z, seatRadius }
   * @param {{x,z,yaw}[]} o.seats  where the logs lie (bonfire.logSeats)
   */
  constructor({ scene, site, seats, heightAt, params }) {
    this.p = params;
    this.site = site;
    this.heightAt = heightAt;
    this.y0 = heightAt(site.x, site.z);
    this.group = new THREE.Group();
    this.group.position.set(site.x, this.y0, site.z);
    scene.add(this.group);
    this.t = 0;

    // The ring of stones.
    const stone = new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 1 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17 + (i % 3) * 0.03, 0), stone);
      rock.position.set(Math.sin(a) * 0.9, 0.08, Math.cos(a) * 0.9);
      rock.rotation.set(i, i * 2, i * 3);
      rock.scale.y = 0.7;
      rock.castShadow = rock.receiveShadow = true;
      this.group.add(rock);
    }
    this.ash = new THREE.Mesh(new THREE.CircleGeometry(0.78, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2b2927, roughness: 1 }));
    this.ash.position.y = 0.015;
    this.ash.visible = false;
    this.group.add(this.ash);

    // The pile: sticks leaning in on each other, shown a bundle at a time. They go black once it has burnt.
    this.woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4d30, roughness: 0.95 });
    this.charMat = new THREE.MeshStandardMaterial({ color: 0x1c1a19, roughness: 1 });
    this.sticks = [];
    for (let i = 0; i < 6 * STICKS_PER_HEAP; i++) {
      const a = (i * 2.399) % (Math.PI * 2);
      const lean = 0.5 + ((i * 7) % 5) * 0.06;
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 1.1 - (i % 4) * 0.08, 5), this.woodMat);
      const r = 0.2 + ((i * 3) % 4) * 0.05;
      stick.position.set(Math.sin(a) * r, 0.42, Math.cos(a) * r);
      stick.rotation.set(Math.cos(a) * lean, 0, -Math.sin(a) * lean);
      stick.castShadow = true;
      this.group.add(stick);
      this.sticks.push(stick);
    }

    // The flames: three crossed planes, additive, so they glow at night and wash out by day on their own.
    const flameMat = new THREE.MeshBasicMaterial({ map: flameTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.flames = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6).translate(0, 0.8, 0), flameMat);
      plane.rotation.y = (i * Math.PI) / 3;
      this.flames.add(plane);
    }
    this.flames.position.y = 0.3;
    this.flames.visible = false;
    this.group.add(this.flames);
    this.glow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.glow.position.y = 0.04;
    this.glow.visible = false;
    this.group.add(this.glow);

    // Sparks.
    this.sparkPos = new Float32Array(SPARKS * 3).fill(-1000);
    this.sparkVel = new Float32Array(SPARKS * 3);
    this.sparkLife = new Float32Array(SPARKS);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffa040, size: 0.06, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.sparks.frustumCulled = false;
    scene.add(this.sparks);
    this.sparkNext = 0;
    this.sparkBudget = 0;

    // The light, made now and only ever dimmed.
    this.light = new THREE.PointLight(0xff8a3a, 0, params.lightReach, 1.6);
    this.light.position.set(site.x, this.y0 + 1, site.z);
    this.light.castShadow = false;
    scene.add(this.light);

    // Smoke: its own puffs, drawn and dimmed like the vehicles' (game.updateWeather).
    this.smoke = new ExhaustSmoke(scene, heightAt, { ...DEFAULT_SMOKE_PARAMS, startSize: 0.3, endSize: 3.2, lifeMin: 3, lifeMax: 7, buoyancy: 0.9, opacity: 1.1 });
    this.smokeTop = new THREE.Vector3(site.x, this.y0 + 1.1, site.z);
    this.smokeBudget = 0;
    this.noVel = { x: 0, y: 0, z: 0 };

    // The logs the girls sit on, lying tangent to the fire.
    const log = new THREE.MeshStandardMaterial({ color: 0x6a5036, roughness: 1 });
    const cut = new THREE.MeshStandardMaterial({ color: 0xb8976a, roughness: 0.9 });
    for (const s of seats) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.23, 1.2, 10).rotateZ(Math.PI / 2), log);
      body.position.y = SEAT_HEIGHT - 0.21;
      body.castShadow = body.receiveShadow = true;
      g.add(body);
      for (const e of [-1, 1]) {
        const end = new THREE.Mesh(new THREE.CircleGeometry(0.2, 10), cut);
        end.position.set(e * 0.601, SEAT_HEIGHT - 0.21, 0);
        end.rotation.y = e * Math.PI / 2;
        g.add(end);
      }
      g.position.set(s.x, heightAt(s.x, s.z), s.z);
      g.rotation.y = s.yaw;
      scene.add(g);
    }
    this.piled = -1;
    this.state = 'none';
  }

  get seatHeight() {
    return SEAT_HEIGHT;
  }

  setViewport(heightPx, fovDeg) {
    this.smoke.setViewport(heightPx, fovDeg);
  }

  /** Shows `piled` bundles, charred or not. */
  setPile(piled, state, total) {
    if (piled === this.piled && state === this.state) return;
    this.piled = piled;
    this.state = state;
    const burnt = state === 'ash';
    const shown = state === 'lit' ? total * STICKS_PER_HEAP : piled * STICKS_PER_HEAP;
    this.sticks.forEach((s, i) => {
      s.visible = burnt ? i < 8 : i < shown;
      s.material = burnt ? this.charMat : this.woodMat;
      s.scale.setScalar(burnt ? 0.6 : 1);
    });
    this.ash.visible = burnt;
  }

  /**
   * Each frame. `fire` the Bonfire; `env`: { wind: { x, z }, darkness (0 day..1 night), warmth }. The flames shrink and lean with the fire's
   * intensity and the wind; the light follows the flames, strongest in the dark.
   */
  update(dt, fire, env) {
    this.t += dt;
    const t = this.t;
    this.setPile(fire.piled, fire.state, fire.p.heapsNeeded);
    const s = fire.state === 'lit' ? fire.intensity : 0;
    const wind = Math.hypot(env.wind.x, env.wind.z);
    const flick = 0.85 + 0.15 * Math.sin(t * 17.3) * Math.sin(t * 5.1 + 1) + 0.08 * Math.sin(t * 31);
    this.flames.visible = s > 0.02;
    this.glow.visible = fire.state === 'lit';
    if (this.flames.visible) {
      const h = (0.25 + 1.0 * s) * flick;
      this.flames.scale.set(0.45 + 0.6 * s, h, 0.45 + 0.6 * s);
      this.flames.rotation.y = t * 0.6;
      this.flames.children.forEach((pl, i) => {
        pl.scale.y = 0.85 + 0.2 * Math.sin(t * (9 + i * 3.7) + i);
        pl.scale.x = 0.9 + 0.15 * Math.sin(t * (7 + i * 2.3));
      });
      this.flames.position.x = Math.min(0.35, wind * 0.06) * Math.sign(env.wind.x) * s;
      this.flames.position.z = Math.min(0.35, wind * 0.06) * Math.sign(env.wind.z) * s;
    }
    if (this.glow.visible) {
      this.glow.material.opacity = Math.min(1, 0.25 + s);
      this.glow.scale.setScalar(0.6 + 0.6 * s);
    }
    // Strongest at night; by day it is barely noticed.
    const night = 0.2 + 0.8 * env.darkness;
    this.light.intensity = this.p.lightCandela * s * flick * night;
    this.light.distance = this.p.lightReach;

    // Sparks: a few, more in a gust and at the full blaze.
    const rate = s > 0.5 ? 4 + wind * 2 : 0;
    this.sparkBudget += rate * dt;
    while (this.sparkBudget >= 1) {
      this.sparkBudget -= 1;
      const i = this.sparkNext;
      this.sparkNext = (this.sparkNext + 1) % SPARKS;
      const j = i * 3;
      this.sparkPos[j] = this.site.x + (Math.random() - 0.5) * 0.5;
      this.sparkPos[j + 1] = this.y0 + 0.9;
      this.sparkPos[j + 2] = this.site.z + (Math.random() - 0.5) * 0.5;
      this.sparkVel[j] = (Math.random() - 0.5) * 0.6 + env.wind.x * 0.5;
      this.sparkVel[j + 1] = 1.2 + Math.random() * 1.5;
      this.sparkVel[j + 2] = (Math.random() - 0.5) * 0.6 + env.wind.z * 0.5;
      this.sparkLife[i] = 1 + Math.random() * 1.2;
    }
    for (let i = 0; i < SPARKS; i++) {
      if (this.sparkLife[i] <= 0) continue;
      this.sparkLife[i] -= dt;
      const j = i * 3;
      if (this.sparkLife[i] <= 0) {
        this.sparkPos[j + 1] = -1000;
        continue;
      }
      this.sparkVel[j + 1] -= 0.8 * dt;
      this.sparkPos[j] += this.sparkVel[j] * dt;
      this.sparkPos[j + 1] += this.sparkVel[j + 1] * dt;
      this.sparkPos[j + 2] += this.sparkVel[j + 2] * dt;
    }
    this.sparks.geometry.attributes.position.needsUpdate = true;

    // Smoke goes up and leans downwind; paler and thicker when damp.
    const sp = this.smoke.params;
    sp.windX = env.wind.x;
    sp.windZ = env.wind.z;
    this.smokeBudget = Math.min(this.smokeBudget + fire.smoke * 9 * dt, 3);
    this.smoke.tipPos.copy(this.smokeTop);
    this.smoke.tipDir.set(0, 1, 0.1);
    while (this.smokeBudget >= 1) {
      this.smokeBudget -= 1;
      this.smoke.spawn((fire.damp ? 0.45 : 0.28) * (0.6 + 0.4 * fire.smoke), fire.damp ? 0.78 : 0.4, 0.8 + Math.random() * 0.6, this.noVel, 0);
    }
    this.smoke.simulate(dt);
  }
}
