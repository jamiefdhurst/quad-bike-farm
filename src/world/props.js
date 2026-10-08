import * as THREE from 'three';
import { stripFrame } from './layout.js';
import { enableShadows, instanceModel, modelBounds } from './assets.js';
import { patchAt } from './terrain.js';
import { outsideRect } from './fields.js';
import { buildBarnShed } from './barnBuild.js';
import { buildJumpRamp } from './jumpRamp.js';

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

  const barn = buildBarn(c);
  buildHedges(c);
  buildGate(c);
  buildRoadGate(c);
  buildPaddock(c);
  buildBales(c);
  buildTrees(c);
  buildDistantTrees(c);
  buildGrass(c);
  buildStubble(c);
  buildPuddles(c);
  buildBogs(c);
  const jumpRamp = ctx.layout.jumpRamp ? buildJumpRamp(c) : null;
  return { barn, jumpRamp };
}

function buildBarn(c) {
  return buildBarnShed(c);
}

function buildHedges({ scene, models, layout, heights, fields, fixedBox, random }) {
  const { hedgeThickness: T, hedgeHeight: H } = layout;
  const hedgeSize = modelBounds(models.hedge.scene).getSize(new THREE.Vector3());
  const bushSize = modelBounds(models.bush.scene).getSize(new THREE.Vector3());
  const hedgeMatrices = [];
  const bushMatrices = [];
  const hy = H / 2 + 0.5;
  const cy = (x, z) => heights.heightAt(x, z) + H / 2 - 0.3;

  // Overlapping, randomly turned blocks of varying height read as an irregular hedgerow rather than a row of cubes. Each hedge line
  // (fields.js) runs a metre past its ends so the corners close.
  for (const h of fields.hedges) {
    const lo = h.alongX ? h.x1 : h.z1;
    const hi = lo + h.length;
    const at = h.alongX ? h.z1 : h.x1;
    // The gate's leaf needs a little more room than an open gap.
    const skip = (s) => h.gaps.some((g) => Math.abs(s - g.at) < g.half + (g.gate ? 0.9 : 0.4));
    for (let s = lo - 1; s <= hi + 1; s += 1.1 + random() * 0.5) {
      if (skip(s)) continue;
      const wobble = (random() - 0.5) * 0.6;
      const x = h.alongX ? s : at + wobble;
      const z = h.alongX ? at + wobble : s;
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
        const bx = h.alongX ? s + (random() - 0.5) : at + off;
        const bz = h.alongX ? at + off : s + (random() - 0.5);
        const bs = (2.3 + random() * 1.6) / bushSize.y;
        bushMatrices.push(matrixAt(bx, heights.heightAt(bx, bz) - 0.3, bz, random() * Math.PI * 2, bs));
      }
    }

    // Colliders: boxes between the gaps, at most 20 m long so they follow the rise and fall of the ground.
    const cuts = [lo - 2, ...h.gaps.flatMap((g) => [g.at - g.half, g.at + g.half]).sort((a, b) => a - b), hi + 2];
    for (let i = 0; i < cuts.length; i += 2) {
      const a = cuts[i];
      const b = cuts[i + 1];
      const pieces = Math.max(1, Math.ceil((b - a) / 20));
      for (let k = 0; k < pieces; k++) {
        const pa = a + ((b - a) * k) / pieces;
        const pb = a + ((b - a) * (k + 1)) / pieces;
        const mid = (pa + pb) / 2;
        const half = (pb - pa) / 2;
        if (h.alongX) fixedBox(mid, cy(mid, at), at, half, hy, T / 2);
        else fixedBox(at, cy(at, mid), mid, T / 2, hy, half);
      }
    }
  }
  // Hedges don't cast shadows: there are hundreds of instances and the shadow pass would double their cost.
  scene.add(instanceModel(models.hedge.scene, hedgeMatrices, { castShadow: false }));
  scene.add(instanceModel(models.bush.scene, bushMatrices, { castShadow: false }));
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

/**
 * The big gate at the end of the farm road (layout.road.gate), in the farm's east hedge: a pair of galvanised steel field gates on heavy
 * timber posts, shut, meeting in the middle with a chain round them. Seven tubular rails each, closer together towards the bottom, with a
 * diagonal brace from the foot of the hinge end.
 */
function buildRoadGate({ scene, layout, heights, fixedBox }) {
  const road = layout.road;
  if (!road?.gate || !layout.farm) return;
  const x = layout.farm.maxX;
  const w = road.gate.width;
  const y = heights.heightAt(x, road.z);
  const steel = new THREE.MeshStandardMaterial({ color: 0xa8adaf, metalness: 0.6, roughness: 0.45 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x5e4c38, roughness: 0.95 });
  const g = new THREE.Group();
  g.position.set(x, y, road.z);
  g.rotation.y = Math.PI / 2; // the gate's length (its local x) along the hedge

  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.1, 0.3), timber);
    post.position.set((sx * (w / 2 + 0.15)), 0.75, 0);
    g.add(post);
  }
  const tube = (len, r, x0, y0, x1, y1) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), steel);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
    m.rotation.z = Math.atan2(x0 - x1, y1 - y0);
    return m;
  };
  const leafW = w / 2 - 0.05;
  const rails = [0.12, 0.26, 0.41, 0.57, 0.75, 0.95, 1.18];
  for (const side of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.set(side * (w / 2), 0, 0); // hung from its post
    const along = (d) => -side * d; // from the hinge towards the middle
    for (const ry of rails) {
      const r = ry === rails[rails.length - 1] ? 0.03 : 0.018; // a heavier top rail
      leaf.add(tube(leafW, r, along(0), ry, along(leafW), ry));
    }
    leaf.add(tube(1.12, 0.025, along(0.03), 0.1, along(0.03), 1.2)); // hinge stile
    leaf.add(tube(1.12, 0.022, along(leafW - 0.03), 0.1, along(leafW - 0.03), 1.2)); // closing stile
    leaf.add(tube(Math.hypot(leafW * 0.55, 1.05), 0.018, along(0.05), 0.14, along(leafW * 0.55), 1.17)); // brace
    // Hinges: two straps round the post.
    for (const hy of [0.26, 1.1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.08), steel);
      strap.position.set(along(-0.02), hy, 0);
      leaf.add(strap);
    }
    g.add(leaf);
  }
  // The chain round the two closing stiles.
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 12), new THREE.MeshStandardMaterial({ color: 0x55504a, metalness: 0.5, roughness: 0.6 }));
  chain.position.set(0, 0.95, 0);
  chain.rotation.y = Math.PI / 2;
  g.add(chain);
  enableShadows(g);
  scene.add(g);
  fixedBox(x, y + 0.8, road.z, 0.2, 0.9, w / 2 + 0.3);
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

  // Straw bales in the barn, to sit on out of the rain.
  for (const [x, z, yaw] of layout.barnBaleSpots ?? []) place(x, z, { yaw });

  // Straw bales out in the field, away from the track.
  for (const [x, z, yaw] of layout.strawBaleSpots) {
    if (track.distanceTo(x, z, 10) < layout.trackHalfWidth + 3) continue;
    place(x, z, { yaw });
  }
}

// Trees ---------------------------------------------------------------------

function buildTrees({ scene, models, layout, heights, physics, RAPIER, random }) {
  const F = layout.fieldHalf;
  const spots = [];
  const farm = layout.farm ?? { maxX: F, maxZ: F };
  // Tree line along the north boundary, two staggered rows, the length of the farm.
  for (let x = -115; x <= farm.maxX + 35; x += 7 + random() * 5) {
    spots.push([x, -F - 8 - random() * 4]);
    if (random() < 0.7) spots.push([x + 3, -F - 15 - random() * 6]);
  }
  // Hedgerow oaks on the east and south hedges (the grass field's east hedge is now between it and the stubble), and the farm's far ones.
  for (const z of [-58, -18, 24, 62]) spots.push([F + 0.5, z + (random() - 0.5) * 6]);
  for (const x of [10, 52]) spots.push([x, F + 0.5]);
  if (layout.farm) {
    for (const z of [-46, 34, 66]) spots.push([farm.maxX + 0.5, z + (random() - 0.5) * 6]);
    for (const x of [104, 148, 186]) spots.push([x + (random() - 0.5) * 6, farm.maxZ + 0.5]);
  }
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
function buildDistantTrees({ scene, layout, heights, fields, random }) {
  const trunks = [];
  const crowns = [];
  const reach = layout.outerSize / 2 - 20;
  let tries = 0;
  while (crowns.length < 520 && tries++ < 25000) {
    const x = (random() * 2 - 1) * reach;
    const z = (random() * 2 - 1) * reach;
    // Well clear of the farm's hedges, and none on the ground through the south gate, which is kept for the hill (TODO 3).
    if (outsideRect(fields.farm, x, z) < 40) continue;
    if (x > -100 && x < 100 && z > fields.farm.maxZ && z < layout.terrainSize / 2 + 10) continue;
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
  const { yard, dragStrip: strip } = layout;
  const col = new THREE.Color();
  let placed = 0;
  let tries = 0;
  while (placed < count && tries++ < count * 3) {
    const x = (random() * 2 - 1) * F;
    const z = (random() * 2 - 1) * F;
    if (heights.mudAt(x, z) > 0.02) continue;
    if (Math.hypot(x - yard.x, z - yard.z) < yard.radius * 0.75) continue;
    if (strip) {
      // None growing through the gravel of the drag strip.
      const f = stripFrame(strip, x, z);
      if (f.along > -3 && f.along < strip.length + strip.runOff + 3 && Math.abs(f.across) < strip.width / 2 + 2) continue;
    }
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

/**
 * Cut straw stalks standing in the stubble fields, in the drill rows (half a metre apart, the way each field was drilled), off the tarmac and
 * clear of the hedges: each field's own crop (layout.stubbleFields), the barley shorter, greyer and thicker than the wheat.
 */
function buildStubble({ scene, fields, heights, random }) {
  const areas = ['north', 'south'].filter((k) => fields.areas[k]);
  if (!areas.length) return;
  const perArea = (r) => (r.maxX - r.minX) * (r.maxZ - r.minZ);
  const fieldsList = areas.map((k) => ({ r: fields.areas[k], f: fields.stubbleField(k) ?? {} }));
  const weight = fieldsList.map(({ r, f }) => perArea(r) * (f.density ?? 1));
  const total = 60000;
  for (let n = 0; n < fieldsList.length; n++) {
    const { r, f } = fieldsList[n];
    const [lowH, highH] = f.stalkHeight ?? [0.08, 0.16];
    const [tip, base] = f.stalk ?? [[0.8, 0.66, 0.38], [0.5, 0.4, 0.22]];
    const stalks = 6;
    const pos = [];
    const colors = [];
    for (let i = 0; i < stalks; i++) {
      // Along the row, a hand's width of stalks, cut square and leaning a little.
      const bx = (random() - 0.5) * 0.14;
      const bz = (random() - 0.5) * 0.03;
      const w = 0.006;
      const h = lowH + random() * (highH - lowH);
      const lx = (random() - 0.5) * 0.04;
      const lz = (random() - 0.5) * 0.04;
      const a = [bx - w, 0, bz];
      const b = [bx + w, 0, bz];
      const c = [bx + lx + w, h, bz + lz];
      const d = [bx + lx - w, h, bz + lz];
      // Each face twice, once each way round, drawn front side only: lit the same from either side (a double-sided material would flip the
      // up-pointing normal on the back and draw it dark).
      for (const tri of [[a, b, c], [a, c, d], [a, c, b], [a, d, c]]) {
        for (const v of tri) {
          pos.push(...v);
          colors.push(...(v[1] > 0 ? tip : base));
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const normals = geo.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 1, 0);

    const count = Math.round((total * weight[n]) / weight.reduce((a, b) => a + b, 0));
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), count);
    const alongX = f.rows !== 'z';
    const col = new THREE.Color();
    let placed = 0;
    let tries = 0;
    while (placed < count && tries++ < count * 3) {
      const span = alongX ? r.maxZ - r.minZ : r.maxX - r.minX;
      const row = (alongX ? r.minZ : r.minX) + 0.25 + Math.floor(random() * (span / 0.5)) * 0.5 + (random() - 0.5) * 0.06;
      const along = alongX ? r.minX + random() * (r.maxX - r.minX) : r.minZ + random() * (r.maxZ - r.minZ);
      const x = alongX ? along : row;
      const z = alongX ? row : along;
      if (fields.stubbleAt(x, z) < 0.99 || fields.hedgeDistance(x, z) < 1.5) continue;
      const sc = 0.8 + random() * 0.5;
      const yaw = (alongX ? 0 : Math.PI / 2) + (random() - 0.5) * 0.3;
      mesh.setMatrixAt(placed, matrixAt(x, heights.heightAt(x, z) - 0.01, z, yaw, sc, sc * (0.7 + random() * 0.6), sc));
      col.setHSL(0.11 + random() * 0.03, (f.crop === 'barley' ? 0.25 : 0.45) + random() * 0.15, 0.5 + random() * 0.12);
      mesh.setColorAt(placed, col);
      placed++;
    }
    mesh.count = placed;
    mesh.receiveShadow = true;
    mesh.name = `stubble-${areas[n]}`;
    scene.add(mesh);
  }
}

/** A bog's surface: wet, shiny, nearly black mud with a ragged edge, sitting in its dip. */
function buildBogs({ scene, heights }) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x2e2416, roughness: 0.22, metalness: 0.05, transparent: true, opacity: 0.85, depthWrite: false });
  for (const b of heights.bogs ?? []) {
    const n = 36;
    const shape = new THREE.Shape();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = b.radius * (0.62 + 0.1 * Math.sin(a * 3 + b.x) + 0.06 * Math.sin(a * 7 + b.z));
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ShapeGeometry(shape, 1).rotateX(-Math.PI / 2);
    // Drape it over the ground so it follows the dip.
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heights.heightAt(b.x + pos.getX(i), b.z + pos.getZ(i)) + 0.03);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(b.x, 0, b.z);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
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
