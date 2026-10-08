import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Small square (rectangular) bales and loose straw, shared by the hayloft and the bale trailer. Length runs along x.

const TWINE_AT = [0.22, 0.78]; // where the two twine loops cross the long faces, as a fraction of the length

function sideCanvas(random) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9a74c';
  ctx.fillRect(0, 0, 256, 128);
  // Compressed straw: long strands lying along the bale, with the odd stalk poking out at an angle.
  for (let i = 0; i < 1100; i++) {
    const x = random() * 256;
    const y = random() * 128;
    const len = 10 + random() * 30;
    const a = (random() - 0.5) * 0.18;
    ctx.strokeStyle = random() < 0.5 ? 'rgba(125,90,30,0.32)' : 'rgba(250,228,150,0.38)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  // Two loops of twine, a dark line with a lit edge and a slight shadow either side where it bites into the straw.
  for (const f of TWINE_AT) {
    const x = Math.round(f * 256);
    ctx.fillStyle = 'rgba(60,40,12,0.28)';
    ctx.fillRect(x - 4, 0, 8, 128);
    ctx.fillStyle = '#3b6e8f';
    ctx.fillRect(x - 1.5, 0, 3, 128);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x - 1.5, 0, 1, 128);
  }
  return c;
}

function endCanvas(random) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d4b45a';
  ctx.fillRect(0, 0, 128, 128);
  // The cut ends of the stalks, and the folds where the baler laid it in layers.
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = random() < 0.5 ? 'rgba(140,100,35,0.4)' : 'rgba(255,235,160,0.45)';
    ctx.fillRect(random() * 128, random() * 128, 1 + random() * 2, 1 + random() * 2);
  }
  for (let y = 16; y < 128; y += 22) {
    ctx.fillStyle = 'rgba(90,65,20,0.28)';
    ctx.fillRect(0, y, 128, 1.5);
  }
  return c;
}

const tex = (canvas) => {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

/** Six materials for a square bale's box groups (+x, -x are the cut ends, the other four the long sides). White-ish, so per-bale tints work. */
export function squareBaleMaterials(random) {
  const side = new THREE.MeshStandardMaterial({ map: tex(sideCanvas(random)), roughness: 1 });
  const end = new THREE.MeshStandardMaterial({ map: tex(endCanvas(random)), roughness: 1 });
  return [end, end, side, side, side, side];
}

/**
 * A square bale: a box with a soft edge and a slight bulge on the long faces, so it looks packed rather than cut. `w` is the length,
 * along x.
 */
export function squareBaleGeometry(w = 0.9, h = 0.36, d = 0.46) {
  const geo = new THREE.BoxGeometry(w, h, d, 8, 3, 3);
  const pos = geo.attributes.position;
  const r = Math.min(h, d) * 0.12;
  const half = [w / 2, h / 2, d / 2];
  const v = new THREE.Vector3();
  const inner = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    inner.set(
      Math.max(-(half[0] - r), Math.min(half[0] - r, v.x)),
      Math.max(-(half[1] - r), Math.min(half[1] - r, v.y)),
      Math.max(-(half[2] - r), Math.min(half[2] - r, v.z)),
    );
    v.sub(inner);
    const len = v.length();
    if (len > 0) v.multiplyScalar(r / len);
    v.add(inner);
    // The bulge, where the twine pulls the middle of each long face out between the loops.
    const t = (pos.getX(i) / w + 0.5);
    const between = Math.sin(((t - TWINE_AT[0]) / (TWINE_AT[1] - TWINE_AT[0])) * Math.PI);
    const k = 1 + (t > TWINE_AT[0] && t < TWINE_AT[1] ? 0.03 * between : 0);
    pos.setXYZ(i, v.x, v.y * k, v.z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/** A clump of loose straw: a fan of thin stalks lying flat, about 0.35 m long, as one geometry (y is up, the clump is centred). */
export function strawClumpGeometry(random, stalks = 6) {
  const parts = [];
  for (let i = 0; i < stalks; i++) {
    const g = new THREE.BoxGeometry(0.14 + random() * 0.14, 0.006, 0.01);
    g.rotateY((random() - 0.5) * 1.1);
    g.rotateZ((random() - 0.5) * 0.15);
    g.translate((random() - 0.5) * 0.08, random() * 0.012, (random() - 0.5) * 0.08);
    parts.push(g);
  }
  return mergeGeometries(parts);
}
