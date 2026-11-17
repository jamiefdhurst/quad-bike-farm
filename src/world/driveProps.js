// The drive's furniture (#568): the cattle grid with its kerbs, sills, sign and wings, the white reflector posts at the lane end, and the grass along the
// verges, cut short by the grid and longer further in. The tarmac, its patches, gravel edges, potholes and the mud and straw at the gateways are painted into
// the ground (groundTexture.js `drawRoad`), so the weather lies on them. The grid is today's too (layout 1 has it in the farm road's gateway), so both use
// this one builder.

import * as THREE from 'three';
import { enableShadows } from './assets.js';
import { tiledInstances } from './tiledInstances.js';
import { worldBox } from './outbuildingProps.js';
import { woodTexture } from './neighbourTextures.js';
import { concreteTexture, galvanisedTexture, cattleGridSignTexture, reflectorPostTexture } from './villageTextures.js';

const UP = new THREE.Vector3(0, 1, 0);

const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0, ...extra });

/** The textures the drive's pieces share, drawn the first time and kept on the context. */
const texturesOf = (c) => (c.driveTextures ??= {
  concrete: concreteTexture(c.random),
  steel: galvanisedTexture(c.random),
  sign: cattleGridSignTexture(),
  post: reflectorPostTexture(c.random),
  timber: woodTexture(c.random, [94, 76, 56]),
});

/** How tall the verge's grass stands `along` m in from the lane end of the drive: cut short by the grid, longer by the yard. Pure, for the tests. */
export function vergeGrassHeight(along, { short = 0.1, long = 0.55, cutTo = 14, fullAt = 150 } = {}) {
  if (along <= cutTo) return short;
  const t = Math.min(1, (along - cutTo) / (fullAt - cutTo));
  return short + (long - short) * t * t * (3 - 2 * t);
}

/**
 * The cattle grid (world/cattleGrid.js) across the road: a pit with galvanised bars laid over it on bearers, concrete sills at each end the bars rest on,
 * concrete kerbs along the road's edge with their tops painted white, a "Cattle grid" sign on a post by the verge facing the lane, and a post-and-rail wing each
 * side closing the rest of the gateway so the grid is the way through. The ground stays solid under it (the wheels ride it flat); the rumble is in the
 * vibration model. `c` is the props context with `grid` (createCattleGrid). The deck leans with the road, as the ground along it does.
 */
export function buildCattleGrid(c) {
  const { scene, layout, heights, fixedBox, grid } = c;
  if (!grid) return null;
  const tex = texturesOf(c);
  const length = grid.maxX - grid.minX;
  const width = grid.maxZ - grid.minZ;
  const concrete = std(tex.concrete);
  const paint = new THREE.MeshStandardMaterial({ color: 0xe8e6de, roughness: 0.85 });
  const steel = std(tex.steel, { metalness: 0.65, roughness: 0.42 });
  const pitMat = std(tex.concrete, { color: 0x2a2926, roughness: 1 }); // the pit, in shadow under the bars

  const group = new THREE.Group();
  group.name = 'cattleGrid';
  const y0 = heights.heightAt(grid.x - length / 2, grid.z);
  const y1 = heights.heightAt(grid.x + length / 2, grid.z);
  const deck = new THREE.Group(); // leans with the ground along the road
  deck.position.set(grid.x, (y0 + y1) / 2, grid.z);
  deck.rotation.z = Math.atan2(y1 - y0, length);
  group.add(deck);
  const part = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    deck.add(m);
    return m;
  };

  // The pit's floor, dark, with the bearers across it that the bars lie on.
  part(worldBox(length, 0.02, width - 0.1, 1), pitMat, 0, 0.01, 0);
  for (const sx of [-1, 1]) part(worldBox(0.1, 0.07, width - 0.1, 0.5), steel, sx * (length / 2 - 0.22), 0.045, 0);
  // The bars, one a pitch, lying across the road just proud of the tarmac.
  const n = Math.floor(length / grid.pitch);
  const bars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, width - 0.12, 8).rotateX(Math.PI / 2), steel, n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) bars.setMatrixAt(i, m.makeTranslation(-length / 2 + (i + 0.5) * grid.pitch, 0.085, 0));
  deck.add(bars);
  // Sills at each end, which the bars rest on, a hand's width taller than the tarmac.
  for (const sx of [-1, 1]) part(worldBox(0.4, 0.11, width + 0.1, 1), concrete, sx * (length / 2 + 0.2), 0.055, 0);
  // Kerbs along each edge of the road, their tops and ends painted white (the faces in order +x, -x, +y, -y, +z, -z).
  const kerbMat = [paint, paint, paint, concrete, concrete, concrete];
  // (Set a centimetre into the ground and a hand short of the sills' ends, so no two faces share a plane.)
  for (const sz of [-1, 1]) part(worldBox(length + 0.76, 0.21, 0.28, 1), kerbMat, 0, 0.095, sz * (width / 2 + 0.14));
  // Wisps of straw and a smear of mud on the bars, carried in on the tyres.
  const strawMat = new THREE.MeshStandardMaterial({ color: 0xc9b27a, roughness: 1 });
  for (let i = 0; i < 7; i++) {
    const wisp = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.25 + c.random() * 0.3, 4), strawMat);
    wisp.position.set((c.random() - 0.5) * length, 0.12, (c.random() - 0.5) * (width - 1));
    wisp.rotation.set(Math.PI / 2 + (c.random() - 0.5) * 0.4, 0, c.random() * Math.PI);
    deck.add(wisp);
  }
  // Clods of mud knocked off the tyres, lying on the bars and in the pit.
  const mud = new THREE.MeshStandardMaterial({ color: 0x4a3b28, roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const clod = new THREE.Mesh(new THREE.SphereGeometry(0.04 + c.random() * 0.05, 6, 4), mud);
    clod.scale.y = 0.5;
    clod.position.set((c.random() - 0.5) * length, 0.115, (c.random() - 0.5) * (width - 1.2));
    deck.add(clod);
  }

  // The sign: a red-bordered triangle over a plate, on a galvanised post by the verge, facing the lane. Today's farm has none: the gate across its road swings through that verge.
  const sign = new THREE.Group();
  const sx = grid.x + length / 2 + 2.2;
  const sz = grid.z - (width / 2 + 1.1);
  sign.position.set(sx, heights.heightAt(sx, sz), sz);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 2.2, 8), steel);
  post.position.y = 1.1;
  sign.add(post);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.97, 0.02), [paint, paint, paint, paint, std(tex.sign, { roughness: 0.55 }), paint]);
  face.position.set(0.04, 1.78, 0);
  face.rotation.y = Math.PI / 2; // its face to the east, the lane
  sign.add(face);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), steel);
  cap.position.y = 2.2;
  sign.add(cap);
  if (!layout.road.grid.gateOffset) group.add(sign);
  enableShadows(group);
  scene.add(group);

  // Wings: a post-and-rail fence from each side of the grid to the edge of the gateway, in line with the hedge (the drive's stand in the boundary, `wingX`,
  // so there is no way round the grid; today's stand at the grid's own x).
  const wingX = layout.road.grid?.wingX ?? grid.x;
  const mouth = layout.road.grid?.mouth ?? layout.road.halfWidth + layout.road.verge;
  const reach = mouth - width / 2;
  const timber = std(tex.timber);
  for (const side of [-1, 1]) {
    const z0 = grid.z + side * (width / 2 + 0.28);
    const z1 = grid.z + side * (width / 2 + Math.max(0.5, reach));
    const len = Math.abs(z1 - z0);
    const mid = (z0 + z1) / 2;
    const fy = heights.heightAt(wingX, mid);
    const w = new THREE.Group();
    w.position.set(wingX, fy, mid);
    for (const pz of [-len / 2, len / 2]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.25, 0.14), timber);
      p.position.set(0, 0.55, pz);
      w.add(p);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.16), timber); // a cap to shed the rain
      top.position.set(0, 1.19, pz);
      w.add(top);
    }
    for (const ry of [0.45, 0.8, 1.1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, len), timber);
      rail.position.set(0, ry, 0);
      w.add(rail);
    }
    enableShadows(w);
    group.add(w);
    fixedBox(wingX, fy + 0.65, mid, 0.12, 0.65, len / 2 + 0.07);
  }
  return group;
}

/**
 * The white reflector posts at the lane end of the drive (`layout.road.reflectors`): a round plastic post a metre tall with a black band and a red
 * reflector, a red plate at the top on each face, and a little earth heaped at the foot.
 */
export function buildReflectorPosts(c) {
  const { scene, layout, heights } = c;
  const spots = layout.road?.reflectors;
  if (!spots?.length) return null;
  const tex = texturesOf(c);
  const group = new THREE.Group();
  group.name = 'driveReflectors';
  const body = std(tex.post, { roughness: 0.55 });
  const plate = new THREE.MeshStandardMaterial({ color: 0xb3171c, roughness: 0.3, metalness: 0.2 });
  const earth = new THREE.MeshStandardMaterial({ color: 0x5a4a34, roughness: 1 });
  for (const [x, z] of spots) {
    const post = new THREE.Group();
    post.position.set(x, heights.heightAt(x, z), z);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1, 10), body);
    shaft.position.y = 0.5;
    post.add(shaft);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), body);
    top.position.y = 1;
    post.add(top);
    for (const face of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.05), plate);
      lens.position.set(face * 0.047, 0.82, 0);
      post.add(lens);
    }
    const heap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.06, 8), earth);
    heap.position.y = 0.02;
    post.add(heap);
    group.add(post);
  }
  enableShadows(group);
  scene.add(group);
  return group;
}

/**
 * The grass along both verges of the drive: tufts from the road's edge out to the drive field's sides, cut short for the first stretch in from the lane
 * and longer by the yard (`vergeGrassHeight`), clear of the tarmac, the grid and the reflector posts.
 */
export function buildDriveVerge(c) {
  const { scene, layout, heights, random, drawDistance, fields } = c;
  const road = layout.road;
  if (!road || road.grid?.x === undefined) return null;
  const blade = (h) => {
    const pos = [];
    const colors = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + random();
      const r = random() * 0.06;
      const lean = 0.04 + random() * 0.08;
      const w = 0.014;
      pos.push(Math.cos(a) * r + Math.sin(a) * w, 0, Math.sin(a) * r - Math.cos(a) * w, Math.cos(a) * r - Math.sin(a) * w, 0, Math.sin(a) * r + Math.cos(a) * w, Math.cos(a) * (r + lean), h * (0.8 + random() * 0.4), Math.sin(a) * (r + lean));
      colors.push(0.3, 0.42, 0.16, 0.3, 0.42, 0.16, 0.52, 0.64, 0.3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const normals = geo.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 1, 0); // light like the ground under them
    return geo;
  };
  const matrices = [];
  const tints = [];
  const length = road.toX - road.fromX;
  const grid = road.grid;
  const count = Math.round(length * 30);
  for (let i = 0; i < count; i++) {
    const x = road.fromX + random() * length;
    const side = random() < 0.5 ? -1 : 1;
    const across = road.halfWidth + 0.25 + random() * (road.verge - 0.5);
    const z = road.z + side * across;
    if (fields.tarmacAt(x, z) > 0.01) continue;
    if (Math.abs(x - grid.x) < grid.length / 2 + 1.2 && across < road.halfWidth + 1.5) continue; // the grid's kerbs and wings
    const h = vergeGrassHeight(road.toX - x);
    const s = 0.8 + random() * 0.5;
    matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(x, heights.heightAt(x, z) - 0.02, z), new THREE.Quaternion().setFromAxisAngle(UP, random() * 6.28), new THREE.Vector3(s, (h / 0.2) * s, s)));
    tints.push(new THREE.Color().setHSL(0.2 + random() * 0.05, 0.3 + random() * 0.15, 0.5 + random() * 0.2));
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const tufts = tiledInstances(blade(0.2), material, matrices, { colors: tints, name: 'driveVerge' });
  scene.add(drawDistance.add(tufts, 'coverDistance'));
  return tufts;
}
