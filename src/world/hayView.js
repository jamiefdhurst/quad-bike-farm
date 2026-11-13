import * as THREE from 'three';
import { squareBaleGeometry, squareBaleMaterials } from './squareBale.js';
import { STACK_CAPACITY, stackSpots } from './haymaking.js';
import { createRandom } from '../core/random.js';
import { maskLayout, fillMask, presence } from './hayMask.js';
import { tiledInstances } from './tiledInstances.js';

// What the hay job looks like. The meadow's colour is drawn by the terrain's own shader from a small picture of the cells (hayMask.js), so it is
// one surface with the field round it and the tyres stand on it; here are the picture, the pressed lines, the long grass standing on it (one
// instanced tuft, shrunk to nothing where the grass is cut or flattened), the loose bales on the ground, the ones stacked on the trailer, a bale
// in the air while it is thrown, and the stack in the Dutch barn. The materials are ordinary lit ones, so the daylight dims them with everything
// else. The rules are in haymaking.js.

const BALE = { w: 0.98, h: 0.38, d: 0.44 }; // the trailer's own bales
const TRACK_EVERY = 0.2; // seconds between redraws of the pressed lines
const TUFTS_PER_M2 = 14; // long grass: tufts a square metre (before the ragged edge thins them)
const BLADES = 9; // in a tuft
const BLADE_HEIGHT = 0.7; // metres, the tallest blade of a tuft at scale 1
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** One tuft of long grass: blades splayed out of a point, each a single bent triangle, pointing up in the light so they shade like the ground. */
export function tuftGeometry(random) {
  const pos = [];
  const col = [];
  for (let i = 0; i < BLADES; i++) {
    const a = (i / BLADES) * Math.PI * 2 + random() * 0.6;
    const r = random() * 0.1;
    const bx = Math.cos(a) * r;
    const bz = Math.sin(a) * r;
    const h = BLADE_HEIGHT * (0.55 + random() * 0.45);
    const lean = 0.08 + random() * 0.18;
    const w = 0.022 + random() * 0.012;
    const px = -Math.sin(a) * w;
    const pz = Math.cos(a) * w;
    pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, bx + Math.cos(a) * lean, h, bz + Math.sin(a) * lean);
    col.push(0.22, 0.32, 0.1, 0.22, 0.32, 0.1, 0.5, 0.6, 0.26);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const n = new Float32Array(pos.length);
  for (let i = 0; i < n.length; i += 3) n[i + 1] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return geo;
}

/** Where the tufts stand: scattered over the patch and its margin, thinning out past the edge. Matrices placed on the ground by `heightAt`. */
export function tuftSpots(rect, heightAt, random) {
  const l = maskLayout(rect);
  const out = [];
  const tries = Math.round(l.sizeX * l.sizeZ * TUFTS_PER_M2);
  for (let i = 0; i < tries; i++) {
    const x = l.minX + random() * l.sizeX;
    const z = l.minZ + random() * l.sizeZ;
    if (random() > presence(rect, x, z)) continue;
    const s = 0.7 + random() * 0.6;
    out.push(new THREE.Matrix4().compose(
      new THREE.Vector3(x, heightAt(x, z) - 0.02, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * 6.28),
      new THREE.Vector3(s, s * (0.75 + random() * 0.5), s),
    ));
  }
  return out;
}

export class HayView {
  /** `patch` is the terrain's `hayPatch` (the uniforms its shader reads); `drawDistance` hides the far tiles of grass. */
  constructor({ scene, hay, heightAt, tracks = null, patch = null, drawDistance = null, random = createRandom(0x4a17) }) {
    this.scene = scene;
    this.hay = hay;
    this.tracks = tracks;
    this.heightAt = heightAt;
    this.patch = patch;
    this.geo = squareBaleGeometry(BALE.w, BALE.h, BALE.d);
    this.mats = squareBaleMaterials(random);
    this.meshes = new Map(); // bale id -> mesh
    this.flying = []; // { mesh, from, slot (trailer-local), body, t, seconds, onLand }
    this.stack = []; // the meshes in the barn
    this.loose = new THREE.Group(); // the bales lying about: what E aims at
    this.loose.name = 'hayBales';
    scene.add(this.loose);
    this.time = { value: 0 };
    this.wind = { value: 0.3 };
    this.buildMask();
    if (tracks) this.buildTracks();
    this.buildGrass(random, drawDistance);
  }

  /** The picture of the cells the ground shader and the grass read (hayMask.js). */
  buildMask() {
    const l = (this.layout = maskLayout(this.hay.rect));
    this.maskData = new Uint8Array(l.cols * l.rows * 4);
    this.maskTexture = new THREE.DataTexture(this.maskData, l.cols, l.rows, THREE.RGBAFormat);
    this.maskTexture.magFilter = this.maskTexture.minFilter = THREE.LinearFilter;
    this.maskTexture.generateMipmaps = false;
    if (this.patch) {
      this.patch.map.value = this.maskTexture;
      this.patch.origin.value.set(l.minX, l.minZ);
      this.patch.size.value.set(l.cols * 0.5, l.rows * 0.5);
    }
    this.refresh();
  }

  /** The lines wheels have pressed in the standing grass: a picture of how flat each point is, read by the ground shader and the grass. */
  buildTracks() {
    const t = this.tracks;
    this.trackPixels = new Uint8Array(t.cols * t.rows);
    this.trackTexture = new THREE.DataTexture(this.trackPixels, t.cols, t.rows, THREE.RedFormat);
    this.trackTexture.magFilter = this.trackTexture.minFilter = THREE.LinearFilter;
    this.trackTexture.generateMipmaps = false;
    this.trackTexture.needsUpdate = true;
    if (this.patch) {
      this.patch.trackMap.value = this.trackTexture;
      this.patch.trackOrigin.value.set(t.rect.minX, t.rect.minZ);
      this.patch.trackSize.value.set(t.cols * t.cell, t.rows * t.cell);
    }
    this.trackSince = 0;
  }

  /** The long grass: tufts in tiles, standing where the mask says the grass is uncut and unpressed, and swaying in the wind. */
  buildGrass(random, drawDistance) {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const patch = this.patch;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.hayTime = this.time;
      shader.uniforms.hayWind = this.wind;
      shader.uniforms.hayMap = patch?.map ?? { value: this.maskTexture };
      shader.uniforms.hayOrigin = patch?.origin ?? { value: new THREE.Vector2(this.layout.minX, this.layout.minZ) };
      shader.uniforms.haySize = patch?.size ?? { value: new THREE.Vector2(this.layout.cols * 0.5, this.layout.rows * 0.5) };
      shader.uniforms.hayTrackMap = patch?.trackMap ?? { value: this.trackTexture };
      shader.uniforms.hayTrackOrigin = patch?.trackOrigin ?? { value: new THREE.Vector2() };
      shader.uniforms.hayTrackSize = patch?.trackSize ?? { value: new THREE.Vector2(1, 1) };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float hayTime;\nuniform float hayWind;\nuniform sampler2D hayMap;\nuniform vec2 hayOrigin;\nuniform vec2 haySize;\nuniform sampler2D hayTrackMap;\nuniform vec2 hayTrackOrigin;\nuniform vec2 hayTrackSize;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        // The tuft's height follows the picture at its foot: none where the grass is cut or has not grown (the edge), flat along a tyre's line.
        vec2 hp = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
        vec4 hs = texture2D(hayMap, (hp - hayOrigin) / haySize);
        vec2 tu = (hp - hayTrackOrigin) / hayTrackSize;
        float pressed = texture2D(hayTrackMap, clamp(tu, 0.0, 1.0)).r * step(0.0, tu.x) * step(tu.x, 1.0) * step(0.0, tu.y) * step(tu.y, 1.0);
        float grow = smoothstep(0.4, 0.7, hs.a) * (1.0 - smoothstep(0.3, 0.5, hs.r)) * (1.0 - 0.85 * pressed);
        float tip = position.y / ${BLADE_HEIGHT.toFixed(2)};
        transformed.y *= grow;
        transformed.xz *= mix(0.4, 1.0, grow);
        float gust = sin(hayTime * 1.7 + hp.x * 0.6 + hp.y * 0.45) + 0.5 * sin(hayTime * 3.3 + hp.x * 1.7 - hp.y * 1.1);
        transformed.x += gust * (0.04 + 0.16 * hayWind) * tip * tip * grow;
        transformed.z += gust * (0.02 + 0.08 * hayWind) * tip * tip * grow;`);
    };
    const matrices = tuftSpots(this.hay.rect, this.heightAt, random);
    const tints = matrices.map(() => new THREE.Color().setHSL(0.2 + random() * 0.05, 0.3 + random() * 0.15, 0.55 + random() * 0.2));
    this.grass = tiledInstances(tuftGeometry(random), material, matrices, { colors: tints, name: 'hayGrass' });
    this.scene.add(drawDistance ? drawDistance.add(this.grass, 'coverDistance') : this.grass);
  }

  /** Redraws the pressed lines (how flat, 0 to 255), a few times a second at most and only while something is pressed or lifting. */
  redrawTracks(dt) {
    const t = this.tracks;
    this.trackSince += dt;
    if (this.trackSince < TRACK_EVERY || !t.dirty) return;
    this.trackSince = 0;
    t.dirty = false;
    const lay = t.p.lay * 255;
    for (let i = 0; i < t.flat.length; i++) this.trackPixels[i] = Math.round(t.flat[i] * lay);
    this.trackTexture.needsUpdate = true;
  }

  /** Redraws the picture from the state. */
  refresh() {
    fillMask(this.maskData, this.layout, this.hay);
    this.maskTexture.needsUpdate = true;
  }

  /** The cells have changed: the picture is redrawn whole (it is a few thousand texels). */
  repaint() {
    this.refresh();
  }

  // The bales ---------------------------------------------------------------

  makeMesh() {
    const m = new THREE.Mesh(this.geo, this.mats);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  /** A bale the baler has left, lying on the ground. */
  addLoose(bale) {
    const m = this.makeMesh();
    m.userData.baleId = bale.id;
    this.meshes.set(bale.id, m);
    this.putDown(bale, m);
    return m;
  }

  /** (Re)places a bale's mesh on the ground where the bale is. */
  putDown(bale, mesh = bale && this.meshes.get(bale.id)) {
    if (!bale || !mesh) return;
    this.loose.attach(mesh);
    mesh.position.set(bale.x, this.heightAt(bale.x, bale.z) + BALE.h / 2 - 0.02, bale.z);
    mesh.rotation.set(0, bale.yaw ?? 0, 0);
    mesh.scale.set(1, 1, 1);
  }

  meshOf(id) {
    return this.meshes.get(id) ?? null;
  }

  /** The bale in the air from `from` (world) to a slot (trailer-local) on `body`, then it sits there. `onLand` is called as it lands. */
  throwOnto(bale, body, slot, seconds, from, onLand) {
    const mesh = this.meshes.get(bale.id);
    if (!mesh) return;
    this.scene.attach(mesh);
    mesh.position.copy(from);
    this.flying.push({ mesh, from: from.clone(), slot, body, t: 0, seconds, onLand });
  }

  /** Sits a bale straight on the trailer (no throw: a restore, or the debug panel). */
  seat(bale, body, slot) {
    const mesh = this.meshes.get(bale.id);
    if (!mesh) return;
    body.add(mesh);
    mesh.position.set(slot.x, slot.y, slot.z);
    mesh.rotation.set(0, 0, 0);
  }

  update(dt, wind = 0) {
    this.time.value += dt;
    this.wind.value = Math.min(1, wind / 6);
    if (this.tracks) {
      this.tracks.update(dt);
      this.redrawTracks(dt);
    }
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.seconds);
      f.body.localToWorld(_b.set(f.slot.x, f.slot.y, f.slot.z));
      _a.lerpVectors(f.from, _b, k);
      _a.y += Math.sin(k * Math.PI) * 0.9; // the arc
      f.mesh.position.copy(_a);
      f.mesh.rotation.y += dt * 3.5 * (1 - k);
      if (k >= 1) {
        this.flying.splice(i, 1);
        f.body.add(f.mesh);
        f.mesh.position.set(f.slot.x, f.slot.y, f.slot.z);
        f.mesh.rotation.set(0, 0, 0);
        f.onLand?.();
      }
    }
  }

  /** Takes these bales' meshes away (unloaded at the barn, or a reset). */
  remove(ids) {
    const gone = new Set(ids.map((id) => this.meshes.get(id)).filter(Boolean));
    this.flying = this.flying.filter((f) => !gone.has(f.mesh));
    for (const m of gone) m.parent?.remove(m);
    for (const id of ids) this.meshes.delete(id);
  }

  /** The stack in the Dutch barn's open bay: `count` bales lying along its back wall. */
  setStack(open, count, floorAt = 0) {
    for (const m of this.stack) m.parent?.remove(m);
    this.stack = [];
    if (!open) return;
    for (const s of stackSpots(open, Math.min(count, STACK_CAPACITY), { floor: floorAt })) {
      const m = this.makeMesh();
      m.position.set(s.x, s.y, s.z);
      m.rotation.y = (s.x * 7.3) % 0.06; // a hand's turn off true, so the row is not a printout
      this.scene.add(m);
      this.stack.push(m);
    }
  }

  /** Clears the bales and recolours the patch (the debug panel's reset). */
  reset() {
    this.remove([...this.meshes.keys()]);
    this.flying = [];
    this.refresh();
  }
}
