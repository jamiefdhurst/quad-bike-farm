import * as THREE from 'three';

// The cars' hard-standing (layout.carStanding, world/carStanding.js): a slab of old concrete laid on the levelled ground, in bays with
// joints between them, weathered: a crack or two, oil under where the cars stand, moss creeping in along the joints and the edges.
// Only something to look at and drive on: the ground under it is the levelled terrain, and fields.tarmacAt gives it a road's grip.

function concreteTexture(st) {
  const px = 48; // pixels a metre
  const w = Math.round(st.halfX * 2 * px);
  const h = Math.round(st.halfZ * 2 * px);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  let seed = 29;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#a5a39b';
  g.fillRect(0, 0, w, h);
  // The aggregate and the weather: fine speckle, and broad blotches lighter and darker.
  for (let i = 0; i < 60; i++) {
    g.fillStyle = random() < 0.5 ? 'rgba(255,255,250,0.05)' : 'rgba(40,40,35,0.06)';
    g.beginPath();
    g.ellipse(random() * w, random() * h, 20 + random() * 80, 20 + random() * 60, random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < w * h * 0.08; i++) {
    const v = 120 + Math.floor(random() * 80);
    g.fillStyle = `rgba(${v},${v - 2},${v - 8},0.45)`;
    g.fillRect(random() * w, random() * h, 1.5, 1.5);
  }
  // Oil under each car's engine: the cars park nose to the hedge (-x), so their engines sit near the slab's west end.
  for (const spot of Object.values(st.cars ?? {})) {
    const cx = (spot.x - 1.1 - (st.x - st.halfX)) * px;
    const cz = (spot.z - (st.z - st.halfZ)) * px;
    for (let i = 0; i < 4; i++) {
      g.fillStyle = 'rgba(30,28,24,0.18)';
      g.beginPath();
      g.ellipse(cx + (random() - 0.5) * 20, cz + (random() - 0.5) * 14, 14 + random() * 22, 10 + random() * 14, random() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  // The bays: a joint every two and a half metres across and one down the middle, each a dark line with moss in it.
  const joint = (x0, y0, x1, y1) => {
    g.strokeStyle = 'rgba(45,44,40,0.75)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.strokeStyle = 'rgba(70,95,45,0.35)';
    g.lineWidth = 4;
    g.stroke();
  };
  for (let x = 2.5 * px; x < w - 1; x += 2.5 * px) joint(x, 0, x, h);
  joint(0, h / 2, w, h / 2);
  // A crack wandering across one bay.
  g.strokeStyle = 'rgba(35,34,30,0.7)';
  g.lineWidth = 1.2;
  g.beginPath();
  let x = w * 0.62;
  let y = 0;
  g.moveTo(x, y);
  while (y < h * 0.45) {
    x += (random() - 0.5) * 18;
    y += 6 + random() * 10;
    g.lineTo(x, y);
  }
  g.stroke();
  // Moss and grass creeping in from the edges.
  for (let i = 0; i < 260; i++) {
    const side = Math.floor(random() * 4);
    const along = random();
    const inset = Math.pow(random(), 3) * 18;
    const px0 = side === 0 ? inset : side === 1 ? w - inset : along * w;
    const py0 = side === 2 ? inset : side === 3 ? h - inset : along * h;
    g.fillStyle = `rgba(${60 + random() * 30},${85 + random() * 30},${35 + random() * 20},0.5)`;
    g.fillRect(px0, py0, 2 + random() * 4, 2 + random() * 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Builds the slab into the scene: a grid laid on the ground a few centimetres up, so the levelled terrain doesn't show through. */
export function buildCarStanding({ scene, layout, heights }) {
  const st = layout.carStanding;
  const cols = Math.round(st.halfX * 2) + 1;
  const rows = Math.round(st.halfZ * 2) + 1;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = st.x - st.halfX + (2 * st.halfX * c) / (cols - 1);
      const z = st.z - st.halfZ + (2 * st.halfZ * r) / (rows - 1);
      pos.push(x, heights.heightAt(x, z) + 0.012, z); // only just above the ground the tyres stand on, so they don't look sunk into it
      uv.push(c / (cols - 1), 1 - r / (rows - 1));
    }
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const slab = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: concreteTexture(st), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  slab.name = 'carStanding';
  slab.receiveShadow = true;
  scene.add(slab);
  // Its edge: the slab's thickness showing where the ground falls away from it.
  const edge = new THREE.MeshStandardMaterial({ color: 0x8e8c85, roughness: 1 });
  for (const [x, z, w, d] of [[st.x, st.z - st.halfZ, st.halfX * 2, 0.08], [st.x, st.z + st.halfZ, st.halfX * 2, 0.08], [st.x - st.halfX, st.z, 0.08, st.halfZ * 2], [st.x + st.halfX, st.z, 0.08, st.halfZ * 2]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), edge);
    m.position.set(x, heights.heightAt(x, z) - 0.06, z); // its top just at the slab's surface
    m.receiveShadow = true;
    scene.add(m);
  }
  return slab;
}
