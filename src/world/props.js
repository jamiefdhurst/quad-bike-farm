import * as THREE from 'three';
import { swayMaterials } from '../effects/windSway.js';
import { stripFrame } from './layout.js';
import { enableShadows, instanceModel, modelBounds } from './assets.js';
import { tiledInstances } from './tiledInstances.js';
import { patchAt } from './terrain.js';
import { buildBarnShed } from './barnBuild.js';
import { buildJumpRamp } from './jumpRamp.js';
import { standingDistance } from './carStanding.js';
import { buildCarStanding } from './carStandingBuild.js';
import { buildHill } from './hillProps.js';
import { buildOutbuildings } from './outbuildingProps.js';
import { Gate, DEFAULT_GATE_PARAMS } from './gates.js';

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
  c.gateParams = { ...DEFAULT_GATE_PARAMS }; // shared by the gates, tuned in the panel
  const gates = [buildGate(c), buildRoadGate(c)].filter(Boolean);
  buildCattleGrid(c);
  buildPublicLane(c);
  if (ctx.layout.carStanding) buildCarStanding(c);
  buildPaddock(c);
  const bale = buildBales(c);
  buildOutbuildings({ ...c, bale });
  buildTrees(c);
  buildDistantTrees(c);
  buildGrass(c);
  buildStubble(c);
  buildPuddles(c);
  buildBogs(c);
  if (ctx.fields.hill) buildHill(c);
  const jumpRamp = ctx.layout.jumpRamp ? buildJumpRamp(c) : null;
  return { barn, jumpRamp, gates, gateParams: c.gateParams };
}

function buildBarn(c) {
  return buildBarnShed(c);
}

function buildHedges({ scene, models, layout, heights, fields, fixedBox, random }) {
  const { hedgeThickness: T } = layout;
  const hedgeSize = modelBounds(models.hedge.scene).getSize(new THREE.Vector3());
  const bushSize = modelBounds(models.bush.scene).getSize(new THREE.Vector3());
  const hedgeMatrices = [];
  const bushMatrices = [];

  // Overlapping, randomly turned blocks of varying height read as an irregular hedgerow rather than a row of cubes. Each hedge line
  // (fields.js) runs a metre past its ends so the corners close. The lane's hedges are taller than the rest.
  for (const h of fields.hedges) {
    const H = h.height ?? layout.hedgeHeight;
    const hy = H / 2 + 0.5;
    const cy = (x, z) => heights.heightAt(x, z) + H / 2 - 0.3;
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

    // Colliders: boxes between the gaps, at most 20 m long and shorter where the ground climbs (the hill's), so they follow it to within
    // about half a metre.
    const cuts = [lo - 2, ...h.gaps.flatMap((g) => [g.at - g.half, g.at + g.half]).sort((a, b) => a - b), hi + 2];
    const groundAt = (s) => (h.alongX ? heights.heightAt(s, at) : heights.heightAt(at, s));
    for (let i = 0; i < cuts.length; i += 2) {
      const a = cuts[i];
      const b = cuts[i + 1];
      let lowest = Infinity;
      let highest = -Infinity;
      for (let s = a; s <= b; s += 2) {
        lowest = Math.min(lowest, groundAt(s));
        highest = Math.max(highest, groundAt(s));
      }
      const pieces = Math.max(1, Math.ceil((b - a) / 20), Math.ceil((highest - lowest) / 0.5));
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
  swayMaterials(models.hedge.scene, 'hedge', layout.hedgeHeight);
  scene.add(instanceModel(models.hedge.scene, hedgeMatrices, { castShadow: false }));
  scene.add(instanceModel(models.bush.scene, bushMatrices, { castShadow: false }));
}

function buildGate({ scene, layout, heights, fixedBox, fields, gateParams }) {
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
  // Five-bar gate leaf, hung on the west post. Open (layout.gate.open), it's swung back into the field and tied to a stake.
  const leafW = w - 0.3;
  const leaf = new THREE.Group();
  leaf.position.set(-w / 2 + 0.15, 0, 0);
  const swing = Math.PI / 2 + 0.08; // swung right open
  leaf.rotation.y = gate.open ? swing : 0;
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
  const tie = new THREE.Group(); // the stake it's tied to, shown when it is swung right open
  g.add(tie);
  {
    // The stake it's tied to, by the closing end, and a loop of orange baler twine round the two.
    const end = new THREE.Vector3(leafW, 0, 0).applyAxisAngle(UP, swing).add(leaf.position);
    const stake = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 0.1), postMat);
    stake.position.set(end.x - 0.12, 0.5, end.z);
    tie.add(stake);
    const twine = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 5, 10), new THREE.MeshStandardMaterial({ color: 0xe0782a, roughness: 0.8 }));
    twine.position.set(end.x - 0.06, 0.92, end.z);
    twine.rotation.x = Math.PI / 2;
    tie.add(twine);
  }
  enableShadows(g);
  scene.add(g);
  // Shut, the whole gap is solid; swung open, only the leaf standing out into the field.
  const mid = new THREE.Vector3(leafW / 2, 0, 0).applyAxisAngle(UP, swing).add(leaf.position);
  return new Gate({
    id: 'south',
    params: gateParams,
    x: gate.x,
    z: F,
    open: !!gate.open,
    pose: (a) => {
      leaf.rotation.y = a * swing;
      tie.visible = a > 0.99;
    },
    solid: fixedBox(gate.x, y + 0.8, F, w / 2 + 0.2, 0.9, 0.2),
    swungSolid: fixedBox(gate.x + mid.x, y + 0.7, F + mid.z, leafW / 2, 0.7, 0.08, swing),
    gap: fields.gates.south,
  });
}

/**
 * The big gate at the end of the farm road (layout.road.gate), in the farm's east hedge: a pair of galvanised steel field gates on heavy
 * timber posts, shut, meeting in the middle with a chain round them. Seven tubular rails each, closer together towards the bottom, with a
 * diagonal brace from the foot of the hinge end.
 */
function buildRoadGate({ scene, layout, heights, fixedBox, fields, gateParams }) {
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
  const leaves = [];
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
    leaves.push({ leaf, side });
  }
  // The chain round the two closing stiles.
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 12), new THREE.MeshStandardMaterial({ color: 0x55504a, metalness: 0.5, roughness: 0.6 }));
  chain.position.set(0, 0.95, 0);
  chain.rotation.y = Math.PI / 2;
  g.add(chain);
  enableShadows(g);
  scene.add(g);
  return new Gate({
    id: 'road',
    params: gateParams,
    x,
    z: road.z,
    open: false,
    pose: (a) => {
      for (const { leaf, side } of leaves) leaf.rotation.y = -side * a * (Math.PI / 2 - 0.05); // inwards, into the farm
      chain.visible = a < 0.05;
    },
    solid: fixedBox(x, y + 0.8, road.z, 0.2, 0.9, w / 2 + 0.3),
    gap: fields.gates.road,
  });
}

/**
 * The public lane (layout.publicLane) outside the farm's east hedge: a strip of tarmac laid over the ground in short sections, a worn
 * dashed line down its middle and a grassy verge worn into each side. Nothing on it is solid: the ground under it is the terrain's.
 */
function buildPublicLane({ scene, layout, heights, fixedBox }) {
  const lane = layout.publicLane;
  if (!lane) return;
  // An invisible wall along the lane's near edge: you can walk through the gate onto the verge, but not out into the road.
  const wallX = lane.x - lane.halfWidth - 1.2;
  fixedBox(wallX, 0, (lane.minZ + lane.maxZ) / 2, 0.3, 40, (lane.maxZ - lane.minZ) / 2 + 20);
  const step = 1; // as fine as the terrain's own grid, or its bumps show through
  const cols = 5; // and across, so the camber of the ground doesn't
  const tarmac = new THREE.CanvasTexture(laneTexture());
  tarmac.wrapS = tarmac.wrapT = THREE.RepeatWrapping;
  tarmac.colorSpace = THREE.SRGBColorSpace;
  const ribbon = (x0, half, lift, material, dashed, uvScale) => {
    const pos = [];
    const uv = [];
    const idx = [];
    let n = 0;
    for (let z = lane.minZ; z < lane.maxZ; z += step) {
      if (dashed && Math.floor((z - lane.minZ) / 3) % 3 !== 0) continue;
      const z1 = Math.min(lane.maxZ, z + step);
      for (const zz of [z, z1]) {
        for (let c = 0; c < cols; c++) {
          const x = x0 - half + (2 * half * c) / (cols - 1);
          pos.push(x, heights.heightAt(x, zz) + lift, zz);
          uv.push((c / (cols - 1)) * uvScale, zz / 4);
        }
      }
      for (let c = 0; c < cols - 1; c++) {
        const a = n + c;
        const b = n + cols + c;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
      n += cols * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    m.frustumCulled = false;
    scene.add(m);
  };
  const poly = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  ribbon(lane.x, lane.halfWidth, 0.07, new THREE.MeshStandardMaterial({ map: tarmac, color: 0xffffff, roughness: 0.92, ...poly }), false, 1);
  ribbon(lane.x, 0.07, 0.09, new THREE.MeshStandardMaterial({ color: 0xcfcfc4, roughness: 0.9, ...poly }), true, 1);
}

/** Worn grey tarmac: speckle, a darker band down each wheel track and a pale, crumbling edge. */
function laneTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#434446';
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  let seed = 99;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (seed * 16807) % 2147483647;
      const n = (seed / 2147483647 - 0.5) * 26;
      const u = x / size;
      const track = Math.exp(-(((u - 0.27) / 0.09) ** 2)) + Math.exp(-(((u - 0.73) / 0.09) ** 2)); // the wheel tracks, worn darker
      const edge = Math.max(0, 1 - Math.min(u, 1 - u) / 0.06) * 14; // the edges, paler and gritty
      const k = n - track * 9 + edge;
      const i = (y * size + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + k));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + k));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + k));
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/**
 * The cattle grid (world/cattleGrid.js) in the grass field's east gateway: a dark pit sunk across the road with galvanised tubes laid
 * over it, concrete kerbs along its sides, and post-and-rail wings closing the rest of the gap so the grid is the way through. The
 * ground stays solid under it (the wheels ride it flat); the rumble is in the vibration model.
 */
function buildCattleGrid({ scene, layout, heights, fixedBox, grid }) {
  if (!grid) return;
  const length = grid.maxX - grid.minX;
  const width = grid.maxZ - grid.minZ;
  const y = heights.heightAt(grid.x, grid.z);
  const steel = new THREE.MeshStandardMaterial({ color: 0xb4b9bb, metalness: 0.65, roughness: 0.4 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8b8a84, roughness: 0.95 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x5e4c38, roughness: 0.95 });
  const g = new THREE.Group();
  g.position.set(grid.x, y, grid.z);

  const pit = new THREE.Mesh(new THREE.BoxGeometry(length, 0.02, width), new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 1 }));
  pit.position.y = 0.015;
  g.add(pit);
  // The tubes lie across the road, one every pitch, just proud of the tarmac so the wheels run over them.
  const n = Math.floor(length / grid.pitch);
  const tubes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, width, 8).rotateX(Math.PI / 2), steel, n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) tubes.setMatrixAt(i, m.makeTranslation(-length / 2 + (i + 0.5) * grid.pitch, 0.05, 0));
  g.add(tubes);
  // Kerbs along the road's edge of each end and a rail under the tubes.
  for (const sx of [-1, 1]) {
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, width + 0.2), concrete);
    kerb.position.set(sx * (length / 2 + 0.11), 0.05, 0);
    g.add(kerb);
  }
  enableShadows(g);
  scene.add(g);

  // Wings: a post-and-rail fence from each side of the grid to the edge of the gateway, in line with the hedge.
  const reach = (layout.road.halfWidth + layout.road.verge) - (width / 2);
  for (const side of [-1, 1]) {
    const z0 = grid.z + side * (width / 2);
    const z1 = grid.z + side * (width / 2 + reach);
    const fy = heights.heightAt(grid.x, (z0 + z1) / 2);
    const w = new THREE.Group();
    w.position.set(grid.x, fy, (z0 + z1) / 2);
    const len = Math.abs(z1 - z0);
    for (const pz of [-len / 2, 0, len / 2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.25, 0.14), timber);
      post.position.set(0, 0.55, pz);
      w.add(post);
    }
    for (const ry of [0.45, 0.8, 1.1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, len), timber);
      rail.position.set(0, ry, 0);
      w.add(rail);
    }
    enableShadows(w);
    scene.add(w);
    fixedBox(grid.x, fy + 0.65, (z0 + z1) / 2, 0.12, 0.65, len / 2 + 0.07);
  }
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
  if (!ends) {
    // Baler twine: loops round the middle of the bale in a few turns, a darker line with a lighter edge.
    for (const y of [64, 78, 178, 192]) {
      ctx.fillStyle = 'rgba(70,45,15,0.55)';
      ctx.fillRect(0, y, 256, 3);
      ctx.fillStyle = 'rgba(250,225,150,0.35)';
      ctx.fillRect(0, y + 3, 256, 1);
    }
  }
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

/** Silage wrap: bands of film overlapping round the bale, a little lighter where one layer lies over the next. */
function wrapCanvas(random) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#16181a';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = `rgba(255,255,255,${0.04 + random() * 0.05})`;
    ctx.fillRect(0, y, 256, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, y + 4, 256, 2);
  }
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    const x = random() * 256;
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (random() - 0.5) * 30, 256);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A round bale body: a cylinder with a rounded rim and a slight belly, so it stops looking like a tin. Axis along y, three material groups. */
export function roundBaleGeometry(R, W) {
  const geo = new THREE.CylinderGeometry(R, R, W, 32, 14);
  const pos = geo.attributes.position;
  const half = W / 2;
  const rim = 0.2; // how much of each end is rounded off
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ay = Math.abs(y);
    let k = 1 + 0.025 * (1 - (y / half) ** 2); // belly
    if (ay > half - rim) {
      const t = (ay - (half - rim)) / rim;
      k *= 1 - 0.12 * t * t; // the end ring is 12% narrower, eased in over the rim
    }
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildBales({ scene, layout, heights, track, physics, RAPIER, random }) {
  const R = 0.75;
  const W = 1.2;
  const geo = roundBaleGeometry(R, W);
  const strawSide = new THREE.MeshStandardMaterial({ map: strawCanvas(random, false), roughness: 1 });
  const strawEnd = new THREE.MeshStandardMaterial({ map: strawCanvas(random, true), roughness: 1 });
  const straw = [strawSide, strawEnd, strawEnd];
  const wrapSide = new THREE.MeshStandardMaterial({ color: 0xffffff, map: wrapCanvas(random), roughness: 0.32, metalness: 0.0 });
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
  return { geo, straw }; // for the Dutch barn's stack (outbuildingProps.js)
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
  // Trees and hedges lean and rock in the wind (effects/windSway.js; the metres are at the top in an ordinary wind, wind.js).
  swayMaterials(models.treeA.scene, 'tree', 8);
  swayMaterials(models.treeB.scene, 'tree', 8);
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
    // Well clear of the farm's hedges, and none on the ground through the south gate, which is kept for the hill.
    if (fields.outside(x, z) < 40) continue;
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
function buildGrass({ scene, layout, heights, random, drawDistance }) {
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
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const matrices = [];
  const tints = [];
  const F = layout.fieldHalf - 1.5;
  const { yard, dragStrip: strip, carStanding } = layout;
  let tries = 0;
  while (matrices.length < count && tries++ < count * 3) {
    const x = (random() * 2 - 1) * F;
    const z = (random() * 2 - 1) * F;
    if (heights.mudAt(x, z) > 0.02) continue;
    if (Math.hypot(x - yard.x, z - yard.z) < yard.radius * 0.75) continue;
    if (strip) {
      // None growing through the gravel of the drag strip.
      const f = stripFrame(strip, x, z);
      if (f.along > -3 && f.along < strip.length + strip.runOff + 3 && Math.abs(f.across) < strip.width / 2 + 2) continue;
    }
    if (carStanding && standingDistance(carStanding, x, z) < 0.6) continue; // nor through the cars' concrete
    const s = 0.6 + random() * 0.8;
    matrices.push(matrixAt(x, heights.heightAt(x, z) - 0.02, z, random() * 6.28, s, s * (0.7 + random() * 0.6), s));
    tints.push(new THREE.Color().setHSL(0.2 + random() * 0.05, 0.3 + random() * 0.15, 0.55 + random() * 0.2));
  }
  scene.add(drawDistance.add(tiledInstances(geo, material, matrices, { colors: tints, name: 'grass' }), 'coverDistance'));
}

/**
 * Cut straw stalks standing in the stubble fields, in the drill rows (half a metre apart, the way each field was drilled), off the tarmac and
 * clear of the hedges: each field's own crop (layout.stubbleFields), the barley shorter, greyer and thicker than the wheat.
 */
function buildStubble({ scene, fields, heights, random, drawDistance }) {
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
    const matrices = [];
    const tints = [];
    const alongX = f.rows !== 'z';
    let tries = 0;
    while (matrices.length < count && tries++ < count * 3) {
      const span = alongX ? r.maxZ - r.minZ : r.maxX - r.minX;
      const row = (alongX ? r.minZ : r.minX) + 0.25 + Math.floor(random() * (span / 0.5)) * 0.5 + (random() - 0.5) * 0.06;
      const along = alongX ? r.minX + random() * (r.maxX - r.minX) : r.minZ + random() * (r.maxZ - r.minZ);
      const x = alongX ? along : row;
      const z = alongX ? row : along;
      if (fields.stubbleAt(x, z) < 0.99 || fields.hedgeDistance(x, z) < 1.5) continue;
      const sc = 0.8 + random() * 0.5;
      const yaw = (alongX ? 0 : Math.PI / 2) + (random() - 0.5) * 0.3;
      matrices.push(matrixAt(x, heights.heightAt(x, z) - 0.01, z, yaw, sc, sc * (0.7 + random() * 0.6), sc));
      tints.push(new THREE.Color().setHSL(0.11 + random() * 0.03, (f.crop === 'barley' ? 0.25 : 0.45) + random() * 0.15, 0.5 + random() * 0.12));
    }
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    scene.add(drawDistance.add(tiledInstances(geo, material, matrices, { colors: tints, name: `stubble-${areas[n]}` }), 'coverDistance'));
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
