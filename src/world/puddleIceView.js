// What the ice on the puddles looks like: each puddle's water disc goes from dark water to pale, glossy ice as it freezes, and shows white
// cracks once it has been loaded. The state is world/puddleIce.js's.
import * as THREE from 'three';

const WATER = new THREE.Color(0x4a4236);
const ICE = new THREE.Color(0xc9dde6);
const CRACKED = new THREE.Color(0xeaf3f6);

/** A white web of cracks on clear, for the disc's map (made once, shared). */
function crackTexture(random = Math.random) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d8e6ec';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    let x = size / 2 + (random() - 0.5) * 16;
    let y = size / 2 + (random() - 0.5) * 16;
    let a = (i / 9) * Math.PI * 2 + random() * 0.5;
    ctx.lineWidth = 1 + random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      a += (random() - 0.5) * 1.1;
      x += Math.cos(a) * (8 + random() * 10);
      y += Math.sin(a) * (8 + random() * 10);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class PuddleIceView {
  /** @param {THREE.Mesh[]} meshes  The puddles' water discs, in the same order as the PuddleIce's puddles. */
  constructor(meshes, ice) {
    this.meshes = meshes;
    this.ice = ice;
    this.keys = meshes.map(() => '');
    this.cracks = null;
  }

  sync() {
    const { ice } = this;
    for (let i = 0; i < this.meshes.length; i++) {
      const frozen = ice.isIce(i);
      const cracked = frozen && ice.damage[i] >= ice.params.crackAt;
      const key = `${frozen ? Math.round(ice.thickness[i] * 20) : 0}${cracked ? 'c' : ''}`;
      if (key === this.keys[i]) continue;
      this.keys[i] = key;
      const mat = this.meshes[i].material;
      const t = frozen ? Math.min(1, ice.thickness[i]) : 0;
      mat.color.copy(WATER).lerp(cracked ? CRACKED : ICE, t);
      mat.roughness = 0.06 + 0.2 * t;
      mat.opacity = 0.88 + 0.1 * t;
      mat.map = cracked ? (this.cracks ??= crackTexture()) : null;
      mat.needsUpdate = true;
    }
  }
}
