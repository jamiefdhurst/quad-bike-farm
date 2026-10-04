import * as THREE from 'three';
import { enableShadows, instanceModel, modelBounds } from './assets.js';
import { patchAt } from './terrain.js';

const UP = new THREE.Vector3(0, 1, 0);

function seeded(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function matrixAt(x, y, z, yaw, sx, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(UP, yaw),
    new THREE.Vector3(sx, sy, sz),
  );
}

/** Builds every static prop on the farm and its colliders. */
export function buildProps(ctx) {
  const random = seeded(1234);
  const c = { ...ctx, random };
  c.fixedBox = (x, y, z, hx, hy, hz, rotY = 0) => {
    const q = new THREE.Quaternion().setFromAxisAngle(UP, rotY);
    return ctx.physics.createCollider(
      ctx.RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(q),
    );
  };

  buildBarn(c);
  buildHedges(c);
  buildGate(c);
  buildPaddock(c);
  buildBales(c);
  buildTrees(c);
  buildDistantTrees(c);
  buildGrass(c);
  buildPuddles(c);
}

function buildBarn({ scene, models, layout, heights, fixedBox }) {
  const { x, z, rotY, scale } = layout.barn;
  const barn = models.barn.scene.clone();
  const y = heights.heightAt(x, z) - 0.05;
  barn.position.set(x, y, z);
  barn.rotation.y = rotY;
  barn.scale.setScalar(scale);
  enableShadows(barn);
  scene.add(barn);
  const b = modelBounds(models.barn.scene);
  fixedBox(x, y + (b.max.y * scale) / 2, z, (b.max.x * scale) * 0.98, (b.max.y * scale) / 2, b.max.z * scale * 0.98, rotY);
}

function buildHedges({ scene, models, layout, heights, fixedBox, random }) {
  const { fieldHalf: F, hedgeThickness: T, hedgeHeight: H, gate } = layout;
  const hedgeSize = modelBounds(models.hedge.scene).getSize(new THREE.Vector3());
  const bushSize = modelBounds(models.bush.scene).getSize(new THREE.Vector3());
  const seg = 2.1;
  const gateHalf = gate.width / 2 + 0.35;
  const hedgeMatrices = [];
  const bushMatrices = [];

  // Overlapping, randomly turned blocks of varying height read as an
  // irregular hedgerow rather than a row of cubes.
  const sides = [
    { along: 'x', at: -F },
    { along: 'x', at: F, gate: true },
    { along: 'z', at: -F },
    { along: 'z', at: F },
  ];
  for (const side of sides) {
    for (let s = -F - 1; s <= F + 1; s += 1.1 + random() * 0.5) {
      if (side.gate && Math.abs(s - gate.x) < gateHalf + 0.9) continue;
      const wobble = (random() - 0.5) * 0.6;
      const x = side.along === 'x' ? s : side.at + wobble;
      const z = side.along === 'x' ? side.at + wobble : s;
      const y = heights.heightAt(x, z) - 0.2;
      const width = T * (0.95 + random() * 0.4);
      hedgeMatrices.push(
        matrixAt(
          x,
          y,
          z,
          random() * Math.PI * 2,
          width / hedgeSize.x,
          (H / hedgeSize.y) * (0.8 + random() * 0.45),
          width / hedgeSize.z,
        ),
      );
      if (random() < 0.3) {
        const off = (random() - 0.5) * T * 0.8;
        const bx = side.along === 'x' ? s + (random() - 0.5) : side.at + off;
        const bz = side.along === 'x' ? side.at + off : s + (random() - 0.5);
        const bs = (2.3 + random() * 1.6) / bushSize.y;
        bushMatrices.push(matrixAt(bx, heights.heightAt(bx, bz) - 0.3, bz, random() * Math.PI * 2, bs));
      }
    }
  }
  scene.add(instanceModel(models.hedge.scene, hedgeMatrices));
  scene.add(instanceModel(models.bush.scene, bushMatrices));

  // Colliders: one long box per side, split around the gate.
  const hy = H / 2 + 0.5;
  const cy = (x, z) => heights.heightAt(x, z) + H / 2 - 0.3;
  fixedBox(0, cy(0, -F), -F, F + 2, hy, T / 2);
  fixedBox(-F, cy(-F, 0), 0, T / 2, hy, F + 2);
  fixedBox(F, cy(F, 0), 0, T / 2, hy, F + 2);
  const leftEnd = gate.x - gateHalf;
  const rightStart = gate.x + gateHalf;
  const lMid = (-F - 2 + leftEnd) / 2;
  const rMid = (rightStart + F + 2) / 2;
  fixedBox(lMid, cy(lMid, F), F, (leftEnd + F + 2) / 2, hy, T / 2);
  fixedBox(rMid, cy(rMid, F), F, (F + 2 - rightStart) / 2, hy, T / 2);
}

function buildGate({ scene, layout, heights, fixedBox }) {
  const { gate, fieldHalf: F } = layout;
  const y = heights.heightAt(gate.x, F);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8b7d66, roughness: 0.9 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b5a45, roughness: 0.95 });
  const g = new THREE.Group();
  g.position.set(gate.x, y, F);
  const w = gate.width;

  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.9, 0.24), postMat);
    post.position.set((sx * w) / 2, 0.75, 0);
    g.add(post);
  }
  // Five-bar gate leaf.
  const leafW = w - 0.3;
  const leaf = new THREE.Group();
  leaf.position.set(-w / 2 + 0.15, 0, 0);
  const box = (bw, bh, bd, x, yy, rotZ = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), wood);
    m.position.set(x, yy, 0);
    m.rotation.z = rotZ;
    leaf.add(m);
  };
  for (let i = 0; i < 5; i++) box(leafW, 0.09, 0.05, leafW / 2, 0.22 + i * 0.235);
  box(0.12, 1.2, 0.07, 0.06, 0.68);
  box(0.12, 1.2, 0.07, leafW - 0.06, 0.68);
  box(0.09, 1.0, 0.05, leafW * 0.5, 0.68);
  const diag = Math.hypot(leafW - 0.2, 0.94);
  box(diag, 0.09, 0.05, leafW / 2, 0.68, Math.atan2(0.94, leafW - 0.2));
  g.add(leaf);
  enableShadows(g);
  scene.add(g);
  fixedBox(gate.x, y + 0.8, F, w / 2 + 0.2, 0.9, 0.2);
}

function buildPaddock({ scene, models, layout, heights, fixedBox }) {
  const { x: px, z: pz, half } = layout.paddock;
  const fenceLen = modelBounds(models.fence.scene).getSize(new THREE.Vector3()).x;
  const segLen = half;
  const sx = segLen / fenceLen;
  const runs = [];
  // Two segments per side, leaving the side facing the yard half open.
  for (const i of [-0.5, 0.5]) {
    runs.push({ x: px + i * segLen, z: pz - half, yaw: 0 });
    runs.push({ x: px + i * segLen, z: pz + half, yaw: 0 });
    runs.push({ x: px - half, z: pz + i * segLen, yaw: Math.PI / 2 });
  }
  runs.push({ x: px + half, z: pz - 0.5 * segLen, yaw: Math.PI / 2 });
  for (const r of runs) {
    const f = models.fence.scene.clone();
    const y = heights.heightAt(r.x, r.z) - 0.05;
    f.position.set(r.x, y, r.z);
    f.rotation.y = r.yaw;
    f.scale.set(sx, 1, 1);
    enableShadows(f);
    scene.add(f);
    fixedBox(r.x, y + 0.55, r.z, segLen / 2, 0.55, 0.1, r.yaw);
  }
}

// Round bales ---------------------------------------------------------------

function strawCanvas(random, ends) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9a94f';
  ctx.fillRect(0, 0, 256, 256);
  if (ends) {
    for (let r = 4; r < 128; r += 3 + random() * 3) {
      ctx.strokeStyle = random() < 0.5 ? 'rgba(120,90,30,0.45)' : 'rgba(240,215,130,0.4)';
      ctx.lineWidth = 1 + random() * 1.5;
      ctx.beginPath();
      ctx.arc(128, 128, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 1400; i++) {
    const x = random() * 256;
    const y = random() * 256;
    const len = 6 + random() * 18;
    const a = ends ? random() * Math.PI : (random() - 0.5) * 0.3;
    ctx.strokeStyle = random() < 0.5 ? 'rgba(130,95,35,0.35)' : 'rgba(245,220,140,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildBales({ scene, layout, heights, track, physics, RAPIER, random }) {
  const R = 0.75;
  const W = 1.2;
  const geo = new THREE.CylinderGeometry(R, R, W, 28, 1);
  const strawSide = new THREE.MeshStandardMaterial({ map: strawCanvas(random, false), roughness: 1 });
  const strawEnd = new THREE.MeshStandardMaterial({ map: strawCanvas(random, true), roughness: 1 });
  const straw = [strawSide, strawEnd, strawEnd];
  const wrapSide = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.32, metalness: 0.0 });
  const wrapEnd = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.4 });
  const wrap = [wrapSide, wrapEnd, wrapEnd];

  const place = (x, z, { wrapped = false, upright = false, stackLevel = 0, yaw = 0 }) => {
    const mesh = new THREE.Mesh(geo, wrapped ? wrap : straw);
    const ground = heights.heightAt(x, z);
    const y = upright ? ground + W / 2 + stackLevel * W - 0.03 : ground + R - 0.06;
    mesh.position.set(x, y, z);
    const q = new THREE.Quaternion();
    if (!upright) q.setFromEuler(new THREE.Euler(0, yaw, Math.PI / 2, 'YXZ'));
    else q.setFromAxisAngle(UP, yaw);
    mesh.quaternion.copy(q);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    physics.createCollider(
      RAPIER.ColliderDesc.cylinder(W / 2, R).setTranslation(x, y, z).setRotation(q).setFriction(0.8),
    );
  };

  // Wrapped silage stacked two high beside the barn.
  const sx = layout.barn.x - 3;
  const sz = layout.barn.z + 9;
  for (let i = 0; i < 4; i++) place(sx + i * 1.55, sz, { wrapped: true, upright: true });
  for (let i = 0; i < 3; i++) place(sx + 0.78 + i * 1.55, sz, { wrapped: true, upright: true, stackLevel: 1 });
  for (let i = 0; i < 3; i++) place(sx + i * 1.55 + 0.3, sz + 1.6, { wrapped: true, upright: true });

  // Straw bales out in the field, away from the track.
  const spots = [
    [12, 14, 0.4],
    [14.2, 15.4, 0.5],
    [10.5, 16.8, 1.9],
    [42, -18, 1.2],
    [-22, -24, 2.6],
    [62, -66, 0.2],
    [64, -63.4, 0.25],
    [-70, -68, 0.9],
    [-50, 66, 0.1],
  ];
  for (const [x, z, yaw] of spots) {
    if (track.distanceTo(x, z, 10) < layout.trackHalfWidth + 3) continue;
    place(x, z, { yaw });
  }
}

// Trees ---------------------------------------------------------------------

function buildTrees({ scene, models, layout, heights, physics, RAPIER, random }) {
  const F = layout.fieldHalf;
  const spots = [];
  // Tree line along the north boundary, two staggered rows.
  for (let x = -115; x <= 115; x += 7 + random() * 5) {
    spots.push([x, -F - 8 - random() * 4]);
    if (random() < 0.7) spots.push([x + 3, -F - 15 - random() * 6]);
  }
  // Hedgerow oaks on the east and south hedges.
  for (const z of [-58, -18, 24, 62]) spots.push([F + 0.5, z + (random() - 0.5) * 6]);
  for (const x of [10, 52]) spots.push([x, F + 0.5]);
  // Behind the barn.
  spots.push([-76, 72], [-84, 52], [-86, 20], [-90, -14]);

  const mats = [[], []];
  for (const [x, z] of spots) {
    const v = random() < 0.5 ? 0 : 1;
    const s = 1.35 + random() * 0.6;
    mats[v].push(matrixAt(x, heights.heightAt(x, z) - 0.15, z, random() * Math.PI * 2, s));
    physics.createCollider(
      RAPIER.ColliderDesc.cylinder(2.5 * s, 0.32 * s).setTranslation(x, heights.heightAt(x, z) + 2.5 * s, z),
    );
  }
  scene.add(instanceModel(models.treeA.scene, mats[0]));
  scene.add(instanceModel(models.treeB.scene, mats[1]));
}

/** Cheap low-poly tree clumps along the distant hedgerows for depth on the horizon. */
function buildDistantTrees({ scene, layout, heights, random }) {
  const trunks = [];
  const crowns = [];
  const inner = layout.terrainSize / 2 + 8;
  let tries = 0;
  while (crowns.length < 420 && tries++ < 20000) {
    const x = (random() * 2 - 1) * 380;
    const z = (random() * 2 - 1) * 380;
    if (Math.max(Math.abs(x), Math.abs(z)) < inner) continue;
    if (patchAt(x, z).border > 4 && random() > 0.04) continue;
    const s = 0.8 + random() * 0.9;
    const y = heights.heightAt(x, z);
    trunks.push(matrixAt(x, y, z, 0, s));
    crowns.push(matrixAt(x, y + 5 * s, z, random() * 6, s * (3.2 + random() * 1.2), s * (3 + random()), s * (3.2 + random() * 1.2)));
  }
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.25, 0.4, 5, 5).translate(0, 2.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 1 }),
    trunks.length,
  );
  const crownMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
    crowns.length,
  );
  const col = new THREE.Color();
  trunks.forEach((m, i) => trunkMesh.setMatrixAt(i, m));
  crowns.forEach((m, i) => {
    crownMesh.setMatrixAt(i, m);
    col.setHSL(0.24 + random() * 0.06, 0.35 + random() * 0.15, 0.2 + random() * 0.08);
    crownMesh.setColorAt(i, col);
  });
  scene.add(trunkMesh, crownMesh);
}

/** Instanced grass tufts across the field, kept off the track and the yard. */
function buildGrass({ scene, layout, heights, random }) {
  const blades = 7;
  const pos = [];
  const colors = [];
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + random();
    const r = random() * 0.08;
    const bx = Math.cos(a) * r;
    const bz = Math.sin(a) * r;
    const lean = 0.05 + random() * 0.08;
    const w = 0.012;
    const h = 0.1 + random() * 0.12;
    const px = -Math.sin(a) * w;
    const pz = Math.cos(a) * w;
    pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, bx + Math.cos(a) * lean, h, bz + Math.sin(a) * lean);
    colors.push(0.26, 0.36, 0.15, 0.26, 0.36, 0.15, 0.46, 0.56, 0.26);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  // Point normals up so the blades light like the ground under them.
  const normals = geo.getAttribute('normal');
  for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 1, 0);

  const count = 90000;
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    count,
  );
  const F = layout.fieldHalf - 1.5;
  const { yard } = layout;
  const col = new THREE.Color();
  let placed = 0;
  let tries = 0;
  while (placed < count && tries++ < count * 3) {
    const x = (random() * 2 - 1) * F;
    const z = (random() * 2 - 1) * F;
    if (heights.mudAt(x, z) > 0.02) continue;
    if (Math.hypot(x - yard.x, z - yard.z) < yard.radius * 0.75) continue;
    const s = 0.6 + random() * 0.8;
    mesh.setMatrixAt(placed, matrixAt(x, heights.heightAt(x, z) - 0.02, z, random() * 6.28, s, s * (0.7 + random() * 0.6), s));
    col.setHSL(0.2 + random() * 0.05, 0.3 + random() * 0.15, 0.55 + random() * 0.2);
    mesh.setColorAt(placed, col);
    placed++;
  }
  mesh.count = placed;
  mesh.receiveShadow = true;
  mesh.name = 'grass';
  scene.add(mesh);
}

function buildPuddles({ scene, layout, heights }) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a4236,
    roughness: 0.06,
    metalness: 0.1,
    transparent: true,
    opacity: 0.88,
  });
  for (const p of heights.puddles) {
    const bottom = heights.heightAt(p.x, p.z);
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(layout.puddleRadius * 0.8, 28).rotateX(-Math.PI / 2), mat);
    mesh.position.set(p.x, bottom + layout.puddleDepth * 0.6, p.z);
    mesh.scale.set(1, 1, 0.75);
    mesh.rotation.y = Math.atan2(p.tx, p.tz);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}
