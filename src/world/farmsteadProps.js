// What the farmstead's plan puts round its edges (#682): the garden plot's drystone wall, and the post-and-rail fence along Home Ground's side of the yard
// (where the paddock's fences were). Each is merged into a draw call or two per material, with a collider per stretch. The data is `layout.farmstead`
// (layoutNew.js `farmsteadLayout`) and, for the rails, the boundaries and gateways of the fields.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldBox, stoneTexture } from './outbuildingProps.js';
import { woodTexture } from './neighbourTextures.js';

const WALL = { height: 1.1, thickness: 0.45, piece: 2.6, sink: 0.45, coping: 0.08 };
const RAIL = { piece: 3, post: [0.14, 1.3, 0.14], rails: [0.42, 0.78, 1.14], section: [0.05, 0.12] };

/** Meshes from lists of geometries by material: one merged mesh each. */
function mergedGroup(byMaterial) {
  const g = new THREE.Group();
  for (const [material, geos] of byMaterial) {
    if (!geos.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(geos), material);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

/** A box `sx` by `sy` by `sz` standing on its middle point (x, z) with its base at `y0`, turned `yaw` about y, as geometry in the world's frame. */
function placedBox(geo, x, y, z, yaw) {
  geo.rotateY(yaw);
  geo.translate(x, y, z);
  return geo;
}

/**
 * The garden plot's wall: round `layout.farmstead.garden`, 1.1 m high and 45 cm thick, in pieces that follow the ground, with a coping on the top and a gap
 * in the yard side for the gate. Returns the group (named for farDetail.js `SET_PIECE_NAMES`).
 */
export function buildGardenWall({ scene, layout, heights, fixedBox, random }) {
  const garden = layout.farmstead?.garden;
  if (!garden) return null;
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(random, { damp: false }), roughness: 0.95 });
  const cap = new THREE.MeshStandardMaterial({ color: 0x7d7a70, roughness: 0.9 });
  const stones = [];
  const caps = [];
  const sides = [
    { from: [garden.minX, garden.minZ], to: [garden.maxX, garden.minZ] },
    { from: [garden.maxX, garden.minZ], to: [garden.maxX, garden.maxZ] },
    { from: [garden.maxX, garden.maxZ], to: [garden.minX, garden.maxZ], gate: garden.gate },
    { from: [garden.minX, garden.maxZ], to: [garden.minX, garden.minZ] },
  ];
  const T = WALL.thickness;
  for (const side of sides) {
    const [x0, z0] = side.from;
    const [x1, z1] = side.to;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const yaw = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2; // a box's length is along its x
    const n = Math.ceil(len / WALL.piece);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * len;
      const b = ((i + 1) / n) * len;
      const mid = (a + b) / 2;
      const ux = (x1 - x0) / len;
      const uz = (z1 - z0) / len;
      const mx = x0 + ux * mid;
      const mz = z0 + uz * mid;
      if (side.gate && Math.abs(mx - side.gate.x) < side.gate.width / 2 + (b - a) / 2) continue; // the gap for the gate (a piece it would clip is left out)
      const ga = heights.heightAt(x0 + ux * a, z0 + uz * a);
      const gb = heights.heightAt(x0 + ux * b, z0 + uz * b);
      const bottom = Math.min(ga, gb) - WALL.sink;
      const top = Math.max(ga, gb) + WALL.height;
      const l = b - a + 0.02;
      stones.push(placedBox(worldBox(l, top - bottom, T, 2), mx, (top + bottom) / 2, mz, yaw));
      caps.push(placedBox(worldBox(l, WALL.coping, T + 0.12, 1), mx, top + WALL.coping / 2 - 0.01, mz, yaw));
      // Through-stones standing out of each face, two a piece, at their own heights and set along it, so the wall has a rough surface and not a flat one.
      for (const face of [-1, 1]) {
        for (let k = 0; k < 2; k++) {
          const along = (random() - 0.5) * (l - 0.5);
          const nx = (z1 - z0) / len;
          const nz = -(x1 - x0) / len; // a normal to the side: out of one face and the other
          const h = Math.min(ga, gb) + 0.25 + random() * (WALL.height - 0.45);
          stones.push(placedBox(worldBox(0.34 + random() * 0.2, 0.16 + random() * 0.08, 0.12, 1), mx + ux * along + nx * face * (T / 2 + 0.03), h, mz + uz * along + nz * face * (T / 2 + 0.03), yaw));
        }
      }
      fixedBox(mx, (top + bottom) / 2, mz, l / 2, (top - bottom) / 2, T / 2, yaw);
    }
  }
  const group = mergedGroup(new Map([[stone, stones], [cap, caps]]));
  group.name = 'gardenWall';
  scene.add(group);
  return group;
}

/**
 * The post-and-rail fence along each boundary of kind 'rail' (Home Ground's side to the yard) for the stretch the yard fronts (`layout.farmstead.rails`),
 * with a gap at each gateway. Posts every 3 m and three rails, in weathered timber; a collider along each piece.
 */
export function buildHomeRails({ scene, layout, heights, fixedBox, random }) {
  const span = layout.farmstead?.rails;
  const lines = (layout.boundaries ?? []).map((b, index) => ({ b, index })).filter(({ b }) => b.kind === 'rail');
  if (!span || !lines.length) return null;
  const timber = new THREE.MeshStandardMaterial({ map: woodTexture(random, [118, 98, 72]), roughness: 0.95 });
  const post = new THREE.MeshStandardMaterial({ map: woodTexture(random, [84, 62, 40]), roughness: 0.95 });
  const capMat = new THREE.MeshStandardMaterial({ map: woodTexture(random, [64, 48, 32]), roughness: 0.95 });
  const posts = [];
  const rails = [];
  const caps = [];
  for (const { b, index } of lines) {
    const gaps = (layout.gateways ?? []).filter((g) => g.boundary === index).map((g) => [g.at - g.half, g.at + g.half]);
    let s0 = 0;
    for (let i = 0; i + 1 < b.points.length; i++) {
      const [x0, z0] = b.points[i];
      const [x1, z1] = b.points[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ux = (x1 - x0) / len;
      const uz = (z1 - z0) / len;
      const yaw = Math.atan2(ux, uz) - Math.PI / 2;
      const n = Math.max(1, Math.round(len / RAIL.piece));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * len;
        const e = ((k + 1) / n) * len;
        const ax = x0 + ux * a;
        const az = z0 + uz * a;
        const ex = x0 + ux * e;
        const ez = z0 + uz * e;
        const sa = s0 + a;
        const se = s0 + e;
        if (Math.min(az, ez) < span.minZ || Math.max(az, ez) > span.maxZ) continue;
        if (gaps.some(([g0, g1]) => se > g0 && sa < g1)) continue;
        const ga = heights.heightAt(ax, az);
        const ge = heights.heightAt(ex, ez);
        const mx = (ax + ex) / 2;
        const mz = (az + ez) / 2;
        const pieceLen = e - a;
        for (const [px, pz, g] of [[ax, az, ga], [ex, ez, ge]]) {
          posts.push(placedBox(worldBox(...RAIL.post, 1), px, g + RAIL.post[1] / 2 - 0.12, pz, 0));
          caps.push(placedBox(worldBox(0.2, 0.04, 0.2, 1), px, g + RAIL.post[1] - 0.1, pz, 0)); // a cap on each post, wider than it, to keep the wet out
          posts.push(placedBox(worldBox(0.07, 0.5, 0.07, 1), px + ux * 0.14, g + 0.4, pz + uz * 0.14, 0)); // and a short brace against the rails' pull
        }
        for (const y of RAIL.rails) {
          const geo = worldBox(pieceLen, RAIL.section[1], RAIL.section[0], 1);
          geo.rotateZ(Math.atan2(ge - ga, pieceLen)); // follows the ground along the piece
          rails.push(placedBox(geo, mx, (ga + ge) / 2 + y, mz, yaw));
        }
        fixedBox(mx, (ga + ge) / 2 + 0.6, mz, pieceLen / 2, 0.6, 0.07, yaw);
      }
      s0 += len;
    }
  }
  const group = mergedGroup(new Map([[post, posts], [timber, rails], [capMat, caps]]));
  group.name = 'homeRails';
  scene.add(group);
  return group;
}
