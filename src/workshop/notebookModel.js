import * as THREE from 'three';

// Amy's logbook as it lies on the bench: a hardback with a rounded spine, an elastic band, a ribbon, a label and a pencil. Origin on the
// bench top, the spine along -x, 0.2 by 0.28 m.

const W = 0.2;
const D = 0.28;
const BOARD = 0.004; // each cover board
const BLOCK = 0.014; // the page block

function pagesTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ebe5d2';
  ctx.fillRect(0, 0, 128, 32);
  for (let y = 1; y < 32; y += 2) {
    ctx.fillStyle = 'rgba(120,105,70,0.28)';
    ctx.fillRect(0, y, 128, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function labelTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ece6d2';
  ctx.fillRect(0, 0, 128, 96);
  ctx.strokeStyle = '#7a1f1f';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 120, 88);
  ctx.fillStyle = '#3a2a22';
  ctx.font = 'bold 20px serif';
  ctx.textAlign = 'center';
  ctx.fillText('QUAD LOG', 64, 36);
  ctx.fillRect(18, 46, 92, 1.5);
  ctx.fillRect(18, 62, 92, 1.5);
  ctx.fillRect(18, 78, 92, 1.5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildNotebookModel() {
  const g = new THREE.Group();
  g.name = 'notebook';
  const cloth = new THREE.MeshStandardMaterial({ color: 0x7a1f1f, roughness: 0.85 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xece6d4, roughness: 0.9 });
  const edge = new THREE.MeshStandardMaterial({ map: pagesTexture(), roughness: 0.9 });
  const elastic = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.7 });
  const ribbon = new THREE.MeshStandardMaterial({ color: 0xd9b24a, roughness: 0.6 });
  const add = (geo, mat, x, y, z, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(...rot);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const top = BOARD * 2 + BLOCK;
  // Boards a hair bigger than the page block on three sides, which is how a hardback looks.
  add(new THREE.BoxGeometry(W, BOARD, D), cloth, 0, BOARD / 2, 0);
  add(new THREE.BoxGeometry(W, BOARD, D), cloth, 0, top - BOARD / 2, 0);
  // Page block: lined edges on the three open sides (box groups: +x, -x, +y, -y, +z, -z), plain paper top and bottom.
  add(new THREE.BoxGeometry(W - 0.016, BLOCK, D - 0.012), [edge, paper, paper, paper, edge, edge], 0.004, BOARD + BLOCK / 2, 0);
  // The spine: a half-round of cloth over the back edge.
  add(new THREE.CylinderGeometry(top / 2, top / 2, D, 10, 1, false, 0, Math.PI), cloth, -W / 2, top / 2, 0, [Math.PI / 2, 0, Math.PI]); // curved side out, towards -x
  // Label on the front, elastic band round the open edge and a ribbon hanging out of the foot.
  const label = add(new THREE.PlaneGeometry(0.085, 0.064), new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.8 }), 0.005, top + 0.0005, -0.05, [-Math.PI / 2, 0, 0]);
  label.castShadow = false;
  add(new THREE.BoxGeometry(0.012, top + 0.002, D + 0.002), elastic, W / 2 - 0.035, top / 2, 0);
  add(new THREE.BoxGeometry(0.012, 0.0008, 0.07), ribbon, 0.03, BOARD + 0.002, D / 2 + 0.03, [0, 0.15, 0]);
  // A pencil lying across it.
  const pencil = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xe6c25a, roughness: 0.6 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.17, 6), wood);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.014, 6), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6 }));
  tip.position.y = -0.092;
  tip.rotation.z = Math.PI;
  const rubber = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.012, 6), new THREE.MeshStandardMaterial({ color: 0xd88a8a, roughness: 0.8 }));
  rubber.position.y = 0.09;
  pencil.add(shaft, tip, rubber);
  pencil.rotation.z = Math.PI / 2;
  pencil.rotation.y = 0.9;
  pencil.position.set(0.02, top + 0.005, 0.07);
  pencil.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  g.add(pencil);
  return g;
}
