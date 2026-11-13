import * as THREE from 'three';
import { UNTOUCHED, COMBED_ALONG_Z } from './harrowing.js';

// What the harrowing job looks like: the field as a skin over the grass that shows the combed lines (light and dark stripes a few centimetres
// across, along the way the mat went, the other way where it was gone over across), and the molehills dealt over it, which vanish as the mat
// spreads them. The skin is an ordinary lit material, so the daylight dims it with everything else. Rules are in harrowing.js.

const LIFT = 0.04; // metres the skin sits above the ground
const TEXELS = 8; // texels to the metre: a stripe of one texel is about the 12 cm between a few tines
const SEGMENTS = 2; // vertices a metre, so the skin follows the ground
const LIGHT = [196, 204, 120, 120]; // r, g, b, alpha of a pale, lifted stripe of turf
const DARK = [52, 60, 30, 135]; // and of a dark one where the tines turned the soil

export class HarrowView {
  constructor({ scene, harrowing, heightAt, molehills }) {
    this.scene = scene;
    this.h = harrowing;
    this.heightAt = heightAt;
    this.hills = molehills;
    this.buildSkin();
    this.buildMolehills();
  }

  buildSkin() {
    const h = this.h;
    this.w = h.cols * TEXELS;
    this.d = h.rows * TEXELS;
    this.data = new Uint8Array(this.w * this.d * 4);
    this.texture = new THREE.DataTexture(this.data, this.w, this.d, THREE.RGBAFormat);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false;
    const nx = h.cols * SEGMENTS;
    const nz = h.rows * SEGMENTS;
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
    const uv = new Float32Array((nx + 1) * (nz + 1) * 2);
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const x = h.rect.minX + (i / nx) * (h.rect.maxX - h.rect.minX);
        const z = h.rect.minZ + (j / nz) * (h.rect.maxZ - h.rect.minZ);
        const k = j * (nx + 1) + i;
        pos.set([x, this.heightAt(x, z) + LIFT, z], k * 3);
        uv.set([i / nx, j / nz], k * 2);
      }
    }
    const idx = [];
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.skin = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: this.texture, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.skin.name = 'harrowedField';
    this.skin.receiveShadow = true;
    this.skin.renderOrder = 1;
    this.scene.add(this.skin);
    this.refresh();
  }

  /** Writes the stripes for one cell into the texture: along z the stripes run across x, along x they run across z. */
  paintCell(i) {
    const h = this.h;
    const c = i % h.cols;
    const r = Math.floor(i / h.cols);
    const st = h.state[i];
    for (let ty = 0; ty < TEXELS; ty++) {
      for (let tx = 0; tx < TEXELS; tx++) {
        const px = c * TEXELS + tx;
        const py = r * TEXELS + ty;
        const o = (py * this.w + px) * 4;
        if (st === UNTOUCHED) {
          this.data[o + 3] = 0;
          continue;
        }
        const stripe = st === COMBED_ALONG_Z ? px : py; // alternate texel columns (or rows) light and dark
        const col = stripe % 2 ? DARK : LIGHT;
        this.data[o] = col[0];
        this.data[o + 1] = col[1];
        this.data[o + 2] = col[2];
        this.data[o + 3] = col[3];
      }
    }
  }

  /** Redraws every cell from the state, and shows the molehills that are still on untouched ground. */
  refresh() {
    for (let i = 0; i < this.h.cells; i++) this.paintCell(i);
    this.texture.needsUpdate = true;
    this.showHills();
  }

  repaint(cells) {
    for (const i of cells) this.paintCell(i);
    this.texture.needsUpdate = true;
    this.showHills();
  }

  buildMolehills() {
    const geo = new THREE.SphereGeometry(0.28, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    geo.scale(1, 0.55, 1); // a low mound
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 });
    this.hillMesh = new THREE.InstancedMesh(geo, mat, Math.max(1, this.hills.length));
    this.hillMesh.name = 'molehills';
    this.hillMesh.receiveShadow = true;
    this.hillMesh.castShadow = false;
    this.hillMesh.count = this.hills.length;
    this.scene.add(this.hillMesh);
    this.shown = new Array(this.hills.length).fill(null);
    this.showHills();
  }

  /** A molehill stands while the cell it is in is untouched; combing the cell spreads it. */
  showHills() {
    if (!this.hillMesh) return;
    const m = new THREE.Matrix4();
    const s = new THREE.Vector3();
    const q = new THREE.Quaternion();
    this.hills.forEach((hill, k) => {
      const up = this.h.state[this.h.index(hill.x, hill.z)] === UNTOUCHED;
      if (this.shown[k] === up) return;
      this.shown[k] = up;
      const size = up ? hill.size : 0.0001;
      m.compose(new THREE.Vector3(hill.x, this.heightAt(hill.x, hill.z) - 0.02, hill.z), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, k), s.set(size, size, size));
      this.hillMesh.setMatrixAt(k, m);
    });
    this.hillMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.skin, this.hillMesh);
  }
}
