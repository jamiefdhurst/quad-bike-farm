// The small furniture of a road's edge (#687), a kit for any road like roadSigns.js: a council grit bin and a heap of grit, a postbox on its post, a bin stand
// with wheelie bins, and a bus stop flag with its timetable case. Each `build...` makes one thing standing at the origin facing +z, ready to be placed and turned.

import * as THREE from 'three';
import { canvasTexture, worldBox } from './outbuildingProps.js';
import { woodTexture } from './neighbourTextures.js';

const steel = new THREE.MeshStandardMaterial({ color: 0x8a8f92, roughness: 0.55, metalness: 0.5 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x1d1e20, roughness: 0.9 });

function text(ctx, lines, x, y, size, colour, gap = 1.15) {
  ctx.fillStyle = colour;
  ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x, y + (i - (lines.length - 1) / 2) * size * gap));
}

/** Weathered coloured plastic, `size` square: the base colour with fine speckle, a few scuffs and a dirty foot. */
export function plasticTexture(base = '#e2b820', dirt = true) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 380; i++) {
      ctx.fillStyle = i % 3 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)';
      ctx.fillRect((i * 37) % w, (i * 53) % h, 1 + (i % 3), 1);
    }
    if (dirt) {
      const g = ctx.createLinearGradient(0, h * 0.7, 0, h);
      g.addColorStop(0, 'rgba(60,50,30,0)');
      g.addColorStop(1, 'rgba(60,50,30,0.5)');
      ctx.fillStyle = g;
      ctx.fillRect(0, h * 0.7, w, h * 0.3);
    }
  });
}

/**
 * A council grit bin: a yellow lidded plastic bin 0.95 m wide, 0.65 m tall and 0.6 m deep, with a moulded foot, a rim, two ribs down each end, a hinged lid with
 * a grip, a "GRIT" plate on its front (+z) and a hasp. It stands on the ground at the origin.
 */
export function buildGritBin() {
  const g = new THREE.Group();
  const plastic = new THREE.MeshStandardMaterial({ map: plasticTexture('#dfb421'), roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ map: plasticTexture('#c49a16'), roughness: 0.75 });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  add(worldBox(1.0, 0.08, 0.64, 0.4), dark, 0, 0.04, 0); // the moulded foot
  add(worldBox(0.95, 0.5, 0.6, 0.4), plastic, 0, 0.32, 0); // the body
  add(worldBox(0.99, 0.05, 0.64, 0.4), dark, 0, 0.585, 0); // the rim under the lid
  const lid = add(worldBox(0.99, 0.07, 0.66, 0.4), plastic, 0, 0.64, 0.01); // the hinged lid, a touch proud at the front
  lid.rotation.x = -0.02;
  add(worldBox(0.3, 0.03, 0.1, 0.2), dark, 0, 0.69, 0.25); // its grip
  for (const sx of [-1, 1]) for (const z of [-0.15, 0.15]) add(worldBox(0.025, 0.42, 0.06, 0.2), dark, sx * 0.485, 0.32, z); // ribs down each end
  const plate = canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#17491f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f2efe2';
    ctx.fillRect(4, 4, w - 8, h - 8);
    text(ctx, ['GRIT'], w / 2, h / 2, 34, '#17491f');
  });
  add(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshStandardMaterial({ map: plate, roughness: 0.6 }), 0, 0.34, 0.3025);
  add(new THREE.BoxGeometry(0.06, 0.1, 0.02), steel, 0, 0.6, 0.325); // the hasp
  return g;
}

/** A heap of road grit the council tipped by a junction: three overlapping lumps of grey and brown stone chips, 1.6 m across and 0.6 m high, and a spill of chips. */
export function buildGritHeap() {
  const g = new THREE.Group();
  const grit = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#8b867a';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      ctx.fillStyle = ['#a9a499', '#6f6a60', '#b0a58b', '#5b574f'][i % 4];
      ctx.fillRect((i * 29) % w, (i * 47) % h, 2, 2);
    }
  });
  const mat = new THREE.MeshStandardMaterial({ map: grit, roughness: 1 });
  for (const [x, z, r, y] of [[0, 0, 0.7, 0.28], [0.5, 0.2, 0.5, 0.18], [-0.45, 0.25, 0.45, 0.16]]) {
    const lump = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
    lump.scale.set(1.15, 0.6, 1);
    lump.position.set(x, y, z);
    lump.rotation.y = x * 3;
    g.add(lump);
  }
  const spill = new THREE.Mesh(new THREE.CircleGeometry(1.0, 14), mat);
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(0.1, 0.01, 0.45);
  spill.scale.set(1.2, 1, 0.75);
  g.add(spill);
  return g;
}

/**
 * A postbox on a post at a farm's drive end: a timber post 1.9 m tall and a red pillar-box-red lamp box on it, 0.36 m wide, 0.5 m tall, with a domed top, a
 * posting slot under a small hood, a white collection plate, a black door line and a base ring. The slot faces +z.
 */
export function buildPostbox(random) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(random, [112, 96, 74]), roughness: 0.95 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb2121b, roughness: 0.45, metalness: 0.2 });
  const post = new THREE.Mesh(worldBox(0.14, 1.9, 0.14, 1), wood);
  post.position.y = 0.75;
  g.add(post);
  const foot = new THREE.Mesh(worldBox(0.34, 0.08, 0.34, 1), new THREE.MeshStandardMaterial({ color: 0x9b9a94, roughness: 1 }));
  foot.position.y = -0.2;
  g.add(foot);
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  add(new THREE.BoxGeometry(0.2, 0.46, 0.04), steel, 0, 1.2, -0.1); // the bracket plate behind the box
  add(new THREE.CylinderGeometry(0.19, 0.19, 0.4, 14), red, 0, 1.3, 0.04);
  const dome = add(new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), red, 0, 1.5, 0.04);
  dome.scale.y = 0.7;
  add(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 14), red, 0, 1.08, 0.04); // the base ring
  add(new THREE.BoxGeometry(0.24, 0.045, 0.02), rubber, 0, 1.43, 0.225); // the slot
  add(new THREE.BoxGeometry(0.28, 0.03, 0.07), red, 0, 1.47, 0.225); // and its hood
  const plate = canvasTexture(128, 96, (ctx, w, h) => {
    ctx.fillStyle = '#f4f2e6';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    text(ctx, ['LAST', 'COLLECTION', '4.30 pm', 'MON - SAT'], w / 2, h / 2, 15, '#111', 1.05);
  });
  add(new THREE.PlaneGeometry(0.17, 0.13), new THREE.MeshStandardMaterial({ map: plate, roughness: 0.6 }), 0, 1.22, 0.2325);
  add(new THREE.BoxGeometry(0.005, 0.24, 0.008), rubber, 0.0, 1.3, 0.2325 - 0.12 + 0.12); // the door's seam below the plate
  return g;
}

/**
 * A bin stand at a farm's drive end: a low timber deck 1.6 by 0.8 m on two bearers with a back board, and on it a green wheelie bin, a black one and a blue
 * recycling box, each with a lid, a handle and wheels. Facing +z.
 */
export function buildBinStand(random) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(random, [118, 100, 78]), roughness: 0.95 });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  for (const x of [-0.65, 0.65]) add(worldBox(0.1, 0.12, 0.84, 1), wood, x, 0.06, 0);
  for (let i = 0; i < 5; i++) add(worldBox(1.6, 0.03, 0.15, 1), wood, 0, 0.135, -0.32 + i * 0.16);
  add(worldBox(1.7, 0.7, 0.04, 1), wood, 0, 0.5, -0.46); // the back board
  add(worldBox(1.74, 0.05, 0.08, 1), wood, 0, 0.88, -0.46); // its capping
  const wheelie = (x, body, lid) => {
    const bin = new THREE.Group();
    bin.position.set(x, 0.15, 0.02);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.78, 0.55), new THREE.MeshStandardMaterial({ map: plasticTexture(body, false), roughness: 0.75 }));
    b.position.y = 0.42;
    bin.add(b);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 0.6), new THREE.MeshStandardMaterial({ map: plasticTexture(lid, false), roughness: 0.75 }));
    l.position.set(0, 0.84, 0.01);
    bin.add(l);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.04), rubber);
    bar.position.set(0, 0.75, -0.3);
    bin.add(bar);
    for (const sx of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), rubber);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * 0.26, 0.1, -0.2);
      bin.add(wheel);
    }
    g.add(bin);
  };
  wheelie(-0.5, '#2e6b34', '#1d1e20');
  wheelie(0.1, '#26282b', '#26282b');
  const box = add(new THREE.BoxGeometry(0.44, 0.34, 0.36), new THREE.MeshStandardMaterial({ map: plasticTexture('#2058a8', false), roughness: 0.75 }), 0.62, 0.32, 0.08);
  void box;
  return g;
}

/**
 * A bus stop flag with its timetable case: a grey steel pole 3 m tall with a blue flag plate (a white bus and "BUS STOP") at the top, held by two clamps, and
 * a small case with a glass front below it holding a timetable. The flag faces +z.
 */
export function buildBusStopFlag() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 3.1, 8), steel);
  pole.position.y = 1.4;
  g.add(pole);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 8), steel);
  cap.position.y = 2.96;
  g.add(cap);
  const foot = new THREE.Mesh(worldBox(0.4, 0.12, 0.4, 1), new THREE.MeshStandardMaterial({ color: 0x9b9a94, roughness: 1 }));
  foot.position.y = -0.12;
  g.add(foot);
  const flagTex = canvasTexture(192, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e9e9e2';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#12449b';
    ctx.fillRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#f6f6f0'; // a bus, side on
    ctx.fillRect(34, 50, 124, 62);
    ctx.fillStyle = '#12449b';
    for (let i = 0; i < 4; i++) ctx.fillRect(42 + i * 28, 58, 20, 24);
    ctx.fillStyle = '#f6f6f0';
    for (const x of [58, 134]) {
      ctx.beginPath();
      ctx.arc(x, 116, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    text(ctx, ['BUS', 'STOP'], w / 2, 188, 38, '#f6f6f0', 1.0);
  });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), new THREE.MeshStandardMaterial({ map: flagTex, roughness: 0.5, metalness: 0.1 }));
  flag.position.set(0.0, 2.55, 0.06);
  g.add(flag);
  const flagBack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.58, 0.02), steel);
  flagBack.position.set(0, 2.55, 0.045);
  g.add(flagBack);
  for (const y of [2.35, 2.75]) {
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.1), steel);
    clamp.position.set(0, y, 0.02);
    g.add(clamp);
  }
  const caseTex = canvasTexture(96, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d9dcdc';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f7f5ea';
    ctx.fillRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#12449b';
    ctx.fillRect(8, 8, w - 16, 20);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = '#444';
      ctx.fillRect(14, 38 + i * 9, w - 28 - (i % 3) * 14, 3);
    }
  });
  const timetable = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.46, 0.05), new THREE.MeshStandardMaterial({ color: 0x8a8f92, roughness: 0.5, metalness: 0.4 }));
  timetable.position.set(0, 1.55, 0.07);
  g.add(timetable);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.4), new THREE.MeshStandardMaterial({ map: caseTex, roughness: 0.4 }));
  sheet.position.set(0, 1.55, 0.0955);
  g.add(sheet);
  return g;
}
