import * as THREE from 'three';

// Draws the rain on a windscreen (screenRain.js) on the glass itself: one instanced quad per drop and one per streak, hung on the model's
// `rainGlass` group (vehicle/wiperModel.js), so the drops stay on the glass as your head moves and the blades pass over them. Instances
// rather than a canvas texture, so nothing is uploaded each frame and a drop stays sharp up close. Lit like the world (a drop is water,
// not a light), so they dim with the day. Both sides, as you see them from the seat and from outside.

const DRAW_SCALE = 2; // a drop is drawn this much bigger than its radius: it bends the light round it, so it blurs a wider patch

let dropTexture = null;
let streakTexture = null;

/** A drop on glass: clear in the middle, a darker rim where it bends the light, a bright glint up at one side. Made once and shared. */
function dropMap() {
  if (dropTexture) return dropTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const body = g.createRadialGradient(32, 34, 4, 32, 32, 30);
  body.addColorStop(0, 'rgba(225,232,236,0.25)');
  body.addColorStop(0.7, 'rgba(150,160,166,0.55)');
  body.addColorStop(0.92, 'rgba(50,55,58,0.75)');
  body.addColorStop(1, 'rgba(60,66,70,0)');
  g.fillStyle = body;
  g.beginPath();
  g.arc(32, 32, 30, 0, Math.PI * 2);
  g.fill();
  const glint = g.createRadialGradient(24, 22, 0, 24, 22, 8);
  glint.addColorStop(0, 'rgba(255,255,255,0.9)');
  glint.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glint;
  g.fillRect(14, 12, 20, 20);
  dropTexture = new THREE.CanvasTexture(c);
  dropTexture.colorSpace = THREE.SRGBColorSpace;
  return dropTexture;
}

/** The wet line a running drop leaves: a thin strip, fading towards its far end (the texture's top). */
function streakMap() {
  if (streakTexture) return streakTexture;
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 64;
  const g = c.getContext('2d');
  const fade = g.createLinearGradient(0, 64, 0, 0);
  fade.addColorStop(0, 'rgba(170,180,186,0.45)');
  fade.addColorStop(1, 'rgba(170,180,186,0)');
  g.fillStyle = fade;
  g.fillRect(4, 0, 8, 64);
  streakTexture = new THREE.CanvasTexture(c);
  streakTexture.colorSpace = THREE.SRGBColorSpace;
  return streakTexture;
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class ScreenRainView {
  /** @param {THREE.Object3D} glass  the model's `rainGlass` group; @param {number} most  the most drops it will be asked to show */
  constructor(glass, most) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const material = (map) => new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.15, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1 });
    this.drops = new THREE.InstancedMesh(geo, material(dropMap()), most);
    this.streaks = new THREE.InstancedMesh(geo, material(streakMap()), most);
    for (const m of [this.streaks, this.drops]) {
      m.count = 0;
      m.frustumCulled = false; // (the instances move about the glass; the group is small and always near you)
      m.renderOrder = 2; // after the glass, which is transparent too
      glass.add(m);
    }
    this.most = most;
  }

  /** Puts the instances where `rain`'s drops are. */
  update(rain) {
    let n = 0;
    let t = 0;
    for (const d of rain.drops) {
      if (n >= this.most) break;
      const size = d.r * 2 * DRAW_SCALE;
      _m.compose(_p.set(d.x, d.y, 0), _q.identity(), _s.set(size, size, 1));
      this.drops.setMatrixAt(n++, _m);
      if (d.trail > 0.004 && t < this.most) {
        const dir = d.run >= 0 ? -1 : 1; // the streak is behind it: below a drop blown up, above one running down
        _m.compose(_p.set(d.x, d.y + (dir * d.trail) / 2, 0), _q.setFromAxisAngle(_s.set(0, 0, 1), dir > 0 ? 0 : Math.PI), _s.set(d.r * 1.4, d.trail, 1));
        this.streaks.setMatrixAt(t++, _m);
      }
    }
    this.drops.count = n;
    this.streaks.count = t;
    this.drops.instanceMatrix.needsUpdate = true;
    this.streaks.instanceMatrix.needsUpdate = true;
  }
}
