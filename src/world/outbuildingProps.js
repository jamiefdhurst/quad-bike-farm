// The buildings and odds and ends out in the east fields (world/outbuildings.js has their shapes): the Dutch barn with its curved tin roof
// on steel stanchions and its stack of round bales, the old stone field shed with a rusty tin roof, the muck heap and the galvanised water
// trough. All procedural, with canvas textures, and colliders for each.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createOutbuildings, muckHeapHeight, BALE } from './outbuildings.js';
import { enableShadows } from './assets.js';

const UP = new THREE.Vector3(0, 1, 0);

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Corrugated sheet, one tile 1.2 m across (u) and 3 m down (v): sixteen corrugations shaded light to dark across each, the base colour
 * blotched, and rust running down from the laps and fixings, `rust` 0..1 how much.
 */
function corrugatedTexture(random, base, rust) {
  return canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 10 + random() * 50;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const c = random() < 0.5 ? '0,0,0' : '255,255,255';
      g.addColorStop(0, `rgba(${c},0.08)`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Rust: streaks down from the top lap and the odd fixing, and a band along the bottom edge.
    for (let i = 0; i < 70 * rust; i++) {
      const x = random() * w;
      const y0 = random() < 0.5 ? 0 : random() * h;
      const len = 20 + random() * 160;
      const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
      g.addColorStop(0, `rgba(${120 + random() * 40},${55 + random() * 20},25,${0.5 + random() * 0.3})`);
      g.addColorStop(1, 'rgba(120,60,25,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y0, 2 + random() * 8, len);
    }
    const band = ctx.createLinearGradient(0, h * 0.85, 0, h);
    band.addColorStop(0, 'rgba(110,55,22,0)');
    band.addColorStop(1, `rgba(110,55,22,${0.6 * rust})`);
    ctx.fillStyle = band;
    ctx.fillRect(0, h * 0.85, w, h * 0.15);
    // The corrugations: each a light crest and a dark trough.
    const n = 16;
    for (let i = 0; i < n; i++) {
      const x0 = (i * w) / n;
      const g = ctx.createLinearGradient(x0, 0, x0 + w / n, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.28)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.16)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = g;
      ctx.fillRect(x0, 0, w / n, h);
    }
  });
}

/** Rough stone walling, one tile 2 m square: courses of irregular grey-buff stones in pale lime mortar, darker and greener low down. */
function stoneTexture(random) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#9a9384';
    ctx.fillRect(0, 0, w, h);
    let y = 0;
    while (y < h) {
      const ch = 22 + random() * 26;
      let x = -random() * 40;
      while (x < w) {
        const sw = 30 + random() * 70;
        const shade = 95 + random() * 60;
        const warm = random() * 18;
        ctx.fillStyle = `rgb(${shade + warm},${shade + warm * 0.6},${shade - 6})`;
        ctx.beginPath();
        const inset = 2.5;
        ctx.moveTo(x + inset + random() * 3, y + inset + random() * 3);
        ctx.lineTo(x + sw - inset - random() * 3, y + inset + random() * 3);
        ctx.lineTo(x + sw - inset - random() * 3, y + ch - inset - random() * 3);
        ctx.lineTo(x + inset + random() * 3, y + ch - inset - random() * 3);
        ctx.closePath();
        ctx.fill();
        x += sw;
      }
      y += ch;
    }
    // Lichen and grime.
    for (let i = 0; i < 160; i++) {
      const x = random() * w;
      const yy = random() * h;
      const r = 3 + random() * 14;
      ctx.fillStyle = random() < 0.4 ? `rgba(160,170,110,${0.2 + random() * 0.25})` : `rgba(40,40,30,${0.08 + random() * 0.12})`;
      ctx.beginPath();
      ctx.arc(x, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const damp = ctx.createLinearGradient(0, h * 0.6, 0, h);
    damp.addColorStop(0, 'rgba(50,60,35,0)');
    damp.addColorStop(1, 'rgba(50,60,35,0.35)');
    ctx.fillStyle = damp;
    ctx.fillRect(0, 0, w, h);
  });
}

/** Concrete blocks, one tile 1.8 m across and 1.2 m up: 440 by 215 mm blocks, stretcher bond, weathered. */
function blockTexture(random) {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8d8b85';
    ctx.fillRect(0, 0, w, h);
    const bw = (w * 0.44) / 1.8;
    const bh = (h * 0.215) / 1.2;
    for (let r = 0; r * bh < h; r++) {
      for (let x = (r % 2) * -bw * 0.5; x < w; x += bw) {
        const s = 130 + random() * 25;
        ctx.fillStyle = `rgb(${s},${s - 2},${s - 7})`;
        ctx.fillRect(x + 1.5, r * bh + 1.5, bw - 3, bh - 3);
      }
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(60,55,45,${0.05 + random() * 0.1})`;
      ctx.fillRect(random() * w, random() * h, 4 + random() * 40, 2 + random() * 20);
    }
  });
}

/** Muck: dark brown, wet-looking, with straw through it. */
function muckTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3e2f1f';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 4 + random() * 18;
      ctx.fillStyle = random() < 0.5 ? `rgba(25,18,10,${0.3 + random() * 0.3})` : `rgba(95,75,45,${0.2 + random() * 0.25})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 700; i++) {
      const x = random() * w;
      const y = random() * h;
      const a = random() * Math.PI;
      const len = 4 + random() * 14;
      ctx.strokeStyle = random() < 0.6 ? `rgba(170,140,70,${0.35 + random() * 0.35})` : `rgba(120,95,50,${0.4 + random() * 0.3})`;
      ctx.lineWidth = 1 + random();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
  });
}

/** A box `w` by `h` by `d` whose texture coordinates are in metres over `tile` (so a tile `tile` m across repeats evenly on every face). */
function worldBox(w, h, d, tileU = 1, tileV = tileU) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.getAttribute('uv');
  // Faces in order +x, -x, +y, -y, +z, -z, four vertices each: what u and v run along on each.
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) uv.setXY(f * 4 + i, (uv.getX(f * 4 + i) * dims[f][0]) / tileU, (uv.getY(f * 4 + i) * dims[f][1]) / tileV);
  return geo;
}

const at = (geo, x, y, z, rotY = 0) => {
  if (rotY) geo.rotateY(rotY);
  return geo.translate(x, y, z);
};

/** A steel tube from a to b (Vector3s), radius r. */
function tube(a, b, r) {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(r, r, len, 6, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize());
  geo.applyQuaternion(q);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return geo.translate(mid.x, mid.y, mid.z);
}

/** Builds the buildings and odds and ends out east, and their colliders. `c` is the props context (props.js), with `bale` the round bales' geometry and straw. */
export function buildOutbuildings(c) {
  const ob = createOutbuildings(c.layout);
  if (ob.barn) buildDutchBarn(c, ob.barn);
  if (ob.shed) buildFieldShed(c, ob.shed);
  if (c.layout.muckHeap) buildMuckHeap(c);
  if (c.layout.trough) buildTrough(c);
  return ob;
}

/**
 * The Dutch barn: steel stanchions at each bay, lattice arched trusses under a curved galvanised roof gone rusty, a concrete block wall
 * up to 1.2 m along the back and the east end with corrugated sheet above, the east end's curved gable sheeted too. The front and the west
 * end are open. Round bales stacked in the east bays, and two on the floor at the front to sit on.
 */
function buildDutchBarn({ scene, layout, heights, physics, RAPIER, fixedBox, random, bale }, s) {
  const b = layout.dutchBarn;
  const y0 = heights.heightAt(b.x, b.z);
  const { outer, roof } = s;
  const group = new THREE.Group();

  // The roof's curve across the barn: a circular arc from eave to eave (over the overhang too), `rise` m high in the middle.
  const half = b.halfZ + b.overhang;
  const r = (half * half + b.rise * b.rise) / (2 * b.rise);
  const top = y0 + b.eaves + b.rise;
  const arcY = (dz) => top - (r - Math.sqrt(r * r - dz * dz)); // height of the roof's underside at dz from the middle
  const eaveY = arcY(b.halfZ);

  // Roof sheets: a grid along x and round the curve, u across the corrugations (along x), v down the slope, in metres over the tile.
  {
    const nA = 28;
    const xs = [roof.minX, roof.maxX];
    const theta0 = Math.asin(half / r);
    const pos = [];
    const uv = [];
    const index = [];
    for (let i = 0; i <= nA; i++) {
      const t = -theta0 + (2 * theta0 * i) / nA;
      const dz = r * Math.sin(t);
      const y = top - r * (1 - Math.cos(t)) + 0.04;
      for (const x of xs) {
        pos.push(x, y, b.z + dz);
        uv.push((x - roof.minX) / 1.2, (r * (t + theta0)) / 3);
      }
    }
    for (let i = 0; i < nA; i++) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: corrugatedTexture(random, '#8f9592', 0.9), roughness: 0.75, metalness: 0.35, side: THREE.DoubleSide });
    group.add(new THREE.Mesh(geo, mat));
  }

  // Steelwork, merged into one mesh: the stanchions (I-section, as three plates), the eaves beams along the front and back, a lattice
  // arched truss over each pair of stanchions, and purlins along under the sheets.
  const steel = [];
  const postH = eaveY - y0;
  for (const x of s.postXs) {
    for (const z of [outer.minZ, outer.maxZ]) {
      const yMid = y0 + postH / 2 - 0.2;
      steel.push(at(new THREE.BoxGeometry(0.2, postH + 0.4, 0.014), x, yMid, z - 0.09), at(new THREE.BoxGeometry(0.2, postH + 0.4, 0.014), x, yMid, z + 0.09));
      steel.push(at(new THREE.BoxGeometry(0.012, postH + 0.4, 0.18), x, yMid, z));
    }
  }
  for (const z of [outer.minZ, outer.maxZ]) steel.push(at(new THREE.BoxGeometry(outer.maxX - outer.minX + 0.2, 0.3, 0.15), b.x, eaveY - 0.15, z));
  const n = 14;
  for (const x of s.postXs) {
    const upper = [];
    const lower = [];
    for (let i = 0; i <= n; i++) {
      const dz = -b.halfZ + (2 * b.halfZ * i) / n;
      const y = arcY(dz) - 0.06;
      const depth = 0.45 * Math.sin((Math.PI * i) / n) + 0.08; // the lattice is deepest at the crown
      upper.push(new THREE.Vector3(x, y, b.z + dz));
      lower.push(new THREE.Vector3(x, y - depth, b.z + dz));
    }
    for (let i = 0; i < n; i++) {
      steel.push(tube(upper[i], upper[i + 1], 0.045), tube(lower[i], lower[i + 1], 0.04));
      steel.push(tube(i % 2 ? upper[i] : lower[i], i % 2 ? lower[i + 1] : upper[i + 1], 0.022));
    }
  }
  for (let i = 1; i < 7; i++) {
    const dz = -b.halfZ + (2 * b.halfZ * i) / 7;
    steel.push(at(new THREE.BoxGeometry(outer.maxX - outer.minX + 0.4, 0.12, 0.06), b.x, arcY(dz) - 0.04, b.z + dz));
  }
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x40493f, roughness: 0.6, metalness: 0.5 });
  group.add(new THREE.Mesh(mergeGeometries(steel.map((g) => g.deleteAttribute('uv'))), steelMat));

  // Walls: blocks up to 1.2 m, then sheet to the eaves, along the back and up the east end into the curve of the roof.
  const blockH = 1.2;
  const blocks = new THREE.MeshStandardMaterial({ map: blockTexture(random), roughness: 0.95 });
  const sheet = new THREE.MeshStandardMaterial({ map: corrugatedTexture(random, '#7f8a84', 0.55), roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide });
  const len = outer.maxX - outer.minX;
  const depth = outer.maxZ - outer.minZ;
  const back = new THREE.Mesh(worldBox(len, blockH + 0.3, 0.2, 1.8, 1.2), blocks);
  back.position.set(b.x, y0 + blockH / 2 - 0.15, outer.minZ - 0.18);
  const end = new THREE.Mesh(worldBox(0.2, blockH + 0.3, depth, 1.8, 1.2), blocks);
  end.position.set(outer.maxX + 0.18, y0 + blockH / 2 - 0.15, b.z);
  group.add(back, end);
  const backSheet = new THREE.Mesh(worldBox(len, eaveY - y0 - blockH, 0.03, 1.2, 3), sheet);
  backSheet.position.set(b.x, (eaveY + y0 + blockH) / 2, outer.minZ - 0.16);
  group.add(backSheet);
  {
    // The east end: sheet from the blocks up to the roof's curve.
    const shape = new THREE.Shape();
    shape.moveTo(-b.halfZ, blockH);
    shape.lineTo(b.halfZ, blockH);
    for (let i = 0; i <= 16; i++) {
      const dz = b.halfZ - (2 * b.halfZ * i) / 16;
      shape.lineTo(dz, arcY(dz) - y0);
    }
    const geo = new THREE.ShapeGeometry(shape);
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.2, uv.getY(i) / 3);
    geo.rotateY(Math.PI / 2);
    const gable = new THREE.Mesh(geo, sheet);
    gable.position.set(outer.maxX + 0.16, y0, b.z);
    group.add(gable);
  }
  enableShadows(group);
  scene.add(group);

  const wallH = (eaveY - y0) / 2;
  fixedBox(b.x, y0 + wallH, outer.minZ - 0.17, len / 2 + 0.1, wallH, 0.12);
  fixedBox(outer.maxX + 0.17, y0 + wallH, b.z, 0.12, wallH, depth / 2 + 0.1);
  for (const x of s.postXs) fixedBox(x, y0 + wallH, outer.maxZ, 0.1, wallH, 0.1);

  // The bales: the stack, lying with their ends to the front, and the two seats at the front lying across.
  const R = BALE.radius;
  const placed = [
    ...s.bales.map((p) => ({ x: p.x, y: y0 + p.y - 0.06, z: p.z, yaw: Math.PI / 2 })),
    ...s.seats.map((p) => ({ x: p.x, y: y0 + R - 0.06, z: p.z, yaw: p.yaw })),
  ];
  const mesh = new THREE.InstancedMesh(bale.geo, bale.straw, placed.length);
  placed.forEach((p, i) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.yaw + (random() - 0.5) * 0.06, Math.PI / 2, 'YXZ'));
    mesh.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(1, 1, 1)));
    physics.createCollider(RAPIER.ColliderDesc.cylinder(BALE.length / 2, R).setTranslation(p.x, p.y, p.z).setRotation(q).setFriction(0.8));
  });
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.name = 'dutch-barn-bales';
  scene.add(mesh);
}

/**
 * The field shed: an old stone shed with rough rubble walls, gables and a tin roof gone to rust, an open doorway with a timber lintel in its
 * south wall, and a little square window high in the east gable.
 */
function buildFieldShed({ scene, layout, heights, fixedBox, random }, s) {
  const f = layout.fieldShed;
  const y0 = heights.heightAt(f.x, f.z);
  const { outer, door } = s;
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(random), roughness: 0.95 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x4a3c2c, roughness: 0.95 });
  const group = new THREE.Group();
  const sink = 0.4; // the walls go this far into the ground, so no gap shows where it isn't quite level
  const H = f.wallHeight + sink;
  const yW = y0 - sink + H / 2;
  const w = f.wall;
  const len = outer.maxX - outer.minX;
  const depth = outer.maxZ - outer.minZ;
  const walls = [];
  const wall = (cx, cz, wx, hy, dz, cy = yW) => {
    const m = new THREE.Mesh(worldBox(wx, hy, dz, 2), stone);
    m.position.set(cx, cy, cz);
    group.add(m);
    walls.push([cx, cy, cz, wx / 2, hy / 2, dz / 2]);
  };
  wall(f.x, outer.minZ + w / 2, len, H, w); // north
  wall(outer.minX + w / 2, f.z, w, H, depth - 2 * w); // west
  wall(outer.maxX - w / 2, f.z, w, H, depth - 2 * w); // east
  // South, either side of the doorway and over it.
  const leftW = door.minX - outer.minX;
  const rightW = outer.maxX - door.maxX;
  wall(outer.minX + leftW / 2, outer.maxZ - w / 2, leftW, H, w);
  wall(outer.maxX - rightW / 2, outer.maxZ - w / 2, rightW, H, w);
  const overH = f.wallHeight - door.height;
  wall(f.x, outer.maxZ - w / 2, door.maxX - door.minX, overH, w, y0 + door.height + overH / 2);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(door.maxX - door.minX + 0.5, 0.16, w + 0.04), timber);
  lintel.position.set(f.x, y0 + door.height + 0.08, outer.maxZ - w / 2);
  group.add(lintel);

  // Gables: stone triangles up to the ridge at each end, with the window in the east one.
  const gableShape = () => {
    const sh = new THREE.Shape();
    sh.moveTo(-depth / 2, 0);
    sh.lineTo(depth / 2, 0);
    sh.lineTo(0, f.ridge - f.wallHeight);
    sh.closePath();
    return sh;
  };
  for (const side of [-1, 1]) {
    const sh = gableShape();
    if (side > 0) {
      const hole = new THREE.Path();
      hole.moveTo(-0.22, 0.25);
      hole.lineTo(0.22, 0.25);
      hole.lineTo(0.22, 0.7);
      hole.lineTo(-0.22, 0.7);
      hole.closePath();
      sh.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false });
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
    geo.translate(0, 0, -w / 2);
    geo.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(geo, stone);
    m.position.set(side > 0 ? outer.maxX - w / 2 : outer.minX + w / 2, y0 + f.wallHeight, f.z);
    group.add(m);
  }
  // The window's dark inside, so it doesn't show daylight through the shed.
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.45), new THREE.MeshBasicMaterial({ color: 0x0d0b09 }));
  dark.rotation.y = Math.PI / 2;
  dark.position.set(outer.maxX - w + 0.01, y0 + f.wallHeight + 0.475, f.z);
  group.add(dark);

  // The roof: two slopes of rusty tin from the ridge down past the walls, on a ridge board.
  const tin = new THREE.MeshStandardMaterial({ map: corrugatedTexture(random, '#7b4a2e', 1), roughness: 0.85, metalness: 0.2, side: THREE.DoubleSide });
  const over = s.roof.maxZ - f.z; // from the ridge to the eaves, across
  const drop = (f.ridge - f.wallHeight) * (over / f.halfZ);
  const slope = Math.hypot(over, drop);
  const pitch = Math.atan2(drop, over);
  for (const side of [-1, 1]) {
    const geo = worldBox(s.roof.maxX - s.roof.minX, 0.025, slope, 1.2, 3);
    const m = new THREE.Mesh(geo, tin);
    m.rotation.x = side * pitch;
    m.position.set(f.x, y0 + f.ridge + 0.03 - drop / 2, f.z + (side * over) / 2);
    group.add(m);
  }
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(s.roof.maxX - s.roof.minX, 0.08, 0.22), new THREE.MeshStandardMaterial({ color: 0x5d3a24, roughness: 0.8, metalness: 0.3 }));
  ridge.position.set(f.x, y0 + f.ridge + 0.06, f.z);
  group.add(ridge);
  enableShadows(group);
  scene.add(group);
  for (const [x, y, z, hx, hy, hz] of walls) fixedBox(x, y, z, hx, hy, hz);
}

/** The muck heap: a long heap of farmyard manure with slumped sides, dark and strawy, waiting to be spread. You can ride up it. */
function buildMuckHeap({ scene, layout, heights, physics, RAPIER, random }) {
  const m = layout.muckHeap;
  const nx = 36;
  const nz = 24;
  const pos = [];
  const uv = [];
  const index = [];
  const hull = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = m.x - m.halfX * 1.05 + (2.1 * m.halfX * i) / nx;
      const z = m.z - m.halfZ * 1.05 + (2.1 * m.halfZ * j) / nz;
      const lift = muckHeapHeight(layout, x, z);
      const y = heights.heightAt(x, z) + lift - 0.05;
      pos.push(x, y, z);
      uv.push(x / 1.5, z / 1.5);
      if (lift > 0.05 || (i % 6 === 0 && j % 6 === 0)) hull.push(x, y, z);
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      index.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: muckTexture(random), roughness: 0.8 }));
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.name = 'muck-heap';
  scene.add(mesh);
  const desc = RAPIER.ColliderDesc.convexHull(new Float32Array(hull));
  if (desc) physics.createCollider(desc.setFriction(0.5));
}

/** The water trough: galvanised, with a rolled rim, on short legs, full of water, and the ball valve's cover at one end. */
function buildTrough({ scene, layout, heights, fixedBox }) {
  const t = layout.trough;
  const y0 = heights.heightAt(t.x, t.z);
  const galv = new THREE.MeshStandardMaterial({ color: 0x9aa09e, roughness: 0.5, metalness: 0.65 });
  const parts = [];
  const L = t.length;
  const W = t.width;
  const H = t.height;
  const lift = 0.12; // on its legs
  const sides = H - 0.02;
  parts.push(at(new THREE.BoxGeometry(L, 0.02, W), 0, lift, 0));
  for (const s of [-1, 1]) {
    parts.push(at(new THREE.BoxGeometry(L, sides, 0.02), 0, lift + sides / 2, (s * W) / 2));
    parts.push(at(new THREE.BoxGeometry(0.02, sides, W), (s * L) / 2, lift + sides / 2, 0));
    parts.push(tube(new THREE.Vector3(-L / 2, lift + sides, (s * W) / 2), new THREE.Vector3(L / 2, lift + sides, (s * W) / 2), 0.022));
    parts.push(tube(new THREE.Vector3((s * L) / 2, lift + sides, -W / 2), new THREE.Vector3((s * L) / 2, lift + sides, W / 2), 0.022));
    for (const e of [-1, 1]) parts.push(at(new THREE.BoxGeometry(0.05, lift + 0.1, 0.05), (s * L) / 2 - s * 0.12, (lift + 0.1) / 2 - 0.1, (e * W) / 2 - e * 0.06));
  }
  // The valve's box over the east end.
  parts.push(at(new THREE.BoxGeometry(0.34, 0.06, W), L / 2 - 0.17, lift + sides + 0.03, 0));
  parts.push(at(new THREE.BoxGeometry(0.02, 0.12, W), L / 2 - 0.34, lift + sides - 0.03, 0));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mergeGeometries(parts.map((p) => p.deleteAttribute('uv'))), galv));
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(L - 0.38, W - 0.04).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x2c3328, roughness: 0.08, metalness: 0.1 }),
  );
  water.position.set(-0.17, lift + sides - 0.09, 0);
  g.add(water);
  g.position.set(t.x, y0, t.z);
  enableShadows(g);
  water.castShadow = false;
  scene.add(g);
  fixedBox(t.x, y0 + (lift + H) / 2, t.z, L / 2 + 0.03, (lift + H) / 2, W / 2 + 0.03);
}
