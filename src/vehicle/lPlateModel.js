import * as THREE from 'three';

// A pair of L plates taped on by Jess: a white square with a red L, and a strip of tape at each top corner (npc/lPlates.js). One plate
// is stuck on the back of a quad's bodywork, one on the front of the tractor's grille; `showOn` moves it between them.

function texture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f6f4ee';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#c4161c';
  ctx.fillRect(40, 20, 22, 88); // the stem of the L
  ctx.fillRect(40, 86, 52, 22); // and its foot
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildLPlate() {
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), new THREE.MeshStandardMaterial({ map: texture(), roughness: 0.6, side: THREE.DoubleSide }));
  g.add(face);
  const tape = new THREE.MeshStandardMaterial({ color: 0xcfc9b4, roughness: 0.8 });
  for (const s of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.004), tape);
    t.position.set(s * 0.07, 0.085, 0.002);
    t.rotation.z = s * 0.4;
    g.add(t);
  }
  g.visible = false;
  return g;
}

/** Where the plate stands on a quad's model (the back of the body, between the tail lights) and on the tractor's (the front of the grille), facing out. */
export const LPLATE_PLACES = {
  quad: { x: 0, y: 0.685, z: -1.074, ry: Math.PI },
  tractor: { x: 0.12, y: 0.98, z: 1.475, ry: 0 },
};

export class LPlateSet {
  constructor() {
    this.plate = buildLPlate();
    this.parent = null;
  }

  /** Put the plate on `model` (a quad's or the tractor's, `kind` 'quad' or 'tractor'), or take it off with null. */
  showOn(model, kind = 'quad') {
    if (this.parent === model && this.kind === kind) return;
    this.plate.removeFromParent();
    this.parent = model;
    this.kind = kind;
    this.plate.visible = !!model;
    if (!model) return;
    const p = LPLATE_PLACES[kind];
    this.plate.position.set(p.x, p.y, p.z);
    this.plate.rotation.set(0, p.ry, 0);
    model.add(this.plate);
  }
}
