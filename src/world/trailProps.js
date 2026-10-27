// The Fern Trail's things (world/woods.js, `woods.trail`): roots across the path, the log to hop, blue-banded way-marker posts, the sign at
// the start, and ferns and brambles along its edges. Roots and the log have colliders (low rounded bumps, so a wheel rolls over them);
// the plants don't, you ride through them.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tiledInstances } from './tiledInstances.js';
import { matrixAt, frondGeometry } from './hillProps.js';
import { worldBox, canvasTexture } from './outbuildingProps.js';
import { woodTexture, barkTexture, logEndTexture } from './neighbourTextures.js';

const UP = new THREE.Vector3(0, 1, 0);
const BLUE = '#1f5fa8'; // the band on the posts: a blue-graded route, as the Forestry England trails are

/** Builds the trail's props and colliders. `c` is the props context (props.js). */
export function buildTrail(c, woods) {
  const trail = woods.trail;
  if (!trail) return;
  const group = new THREE.Group();
  group.name = 'trailMarkers';
  buildRoots(c, trail, group);
  buildHopLog(c, trail.hop, group);
  buildPosts(c, trail, group);
  buildSign(c, trail, group);
  c.scene.add(group);
  buildEdges(c, woods);
}

/** A fixed cylinder collider lying across the trail (its axis along the thing's long side), which rolls under a wheel instead of stopping it. */
function lyingCylinder({ physics, RAPIER }, x, y, z, yaw, halfLen, r) {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
  return physics.createCollider(RAPIER.ColliderDesc.cylinder(halfLen, r).setTranslation(x, y, z).setRotation(q));
}

/** A root: a tube along `pts` whose radius swells in the middle and tapers to nothing where it dives into the earth at each end. */
function rootTube(pts, r, sides = 6) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const rings = 14;
  const frames = curve.computeFrenetFrames(rings, false);
  const pos = [];
  const uv = [];
  const index = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const c = curve.getPointAt(t);
    const rad = r * (0.25 + 0.85 * Math.pow(Math.sin(Math.PI * t), 0.6));
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const nx = Math.cos(a);
      const ny = Math.sin(a);
      pos.push(c.x + rad * (nx * frames.normals[i].x + ny * frames.binormals[i].x), c.y + rad * (nx * frames.normals[i].y + ny * frames.binormals[i].y), c.z + rad * (nx * frames.normals[i].z + ny * frames.binormals[i].z));
      uv.push(t * 3, j / sides);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sides; j++) {
      const k = i * (sides + 1) + j;
      index.push(k, k + 1, k + sides + 1, k + 1, k + sides + 2, k + sides + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Roots in clusters across the path: knobbly, bending, half sunk in the earth and diving into it past the edges. */
function buildRoots(c, trail, group) {
  const { heights, random } = c;
  const geos = [];
  for (const root of trail.roots) {
    const ux = Math.cos(root.yaw); // along the root
    const uz = -Math.sin(root.yaw);
    const pts = [];
    const n = 8;
    const phase = random() * 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n - 0.5;
      const bend = Math.sin(t * 6 + phase) * 0.14 + t * (random() - 0.5) * 0.1;
      const x = root.x + ux * t * root.len - uz * bend;
      const z = root.z + uz * t * root.len + ux * bend;
      const dive = Math.max(0, Math.abs(t) - 0.34) / 0.16; // 0 across the path, 1 at the tip
      pts.push(new THREE.Vector3(x, heights.heightAt(x, z) + root.r * (1.0 + 0.3 * Math.sin(t * 14 + phase)) - dive * root.r * 1.7, z));
    }
    geos.push(rootTube(pts, root.r));
    const y = heights.heightAt(root.x, root.z) + root.r * 0.8;
    lyingCylinder(c, root.x, y, root.z, root.yaw, root.len / 2 - 0.5, root.r);
  }
  if (!geos.length) return;
  const bark = barkTexture(random);
  const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ map: bark, color: 0xd9c4a8, roughness: 1 }));
  mesh.name = 'trailRoots';
  group.add(mesh);
}

/** The one log right across the trail, thick enough to feel and low enough to hop: bark, sawn ends, a snapped stub and moss on top. */
function buildHopLog(c, hop, group) {
  if (!hop) return;
  const { heights, random } = c;
  const log = new THREE.Group();
  const y = heights.heightAt(hop.x, hop.z) + hop.r * 0.5;
  log.position.set(hop.x, y, hop.z);
  log.rotation.y = hop.yaw;
  const bark = barkTexture(random);
  bark.repeat.set(2, 1);
  const barkMat = new THREE.MeshStandardMaterial({ map: bark, color: 0x9a8670, roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(hop.r, hop.r * 1.1, hop.len, 10, 1, true), barkMat);
  trunk.rotation.z = Math.PI / 2;
  log.add(trunk);
  const endMat = new THREE.MeshStandardMaterial({ map: logEndTexture(random), roughness: 0.9 });
  for (const end of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(hop.r * (end < 0 ? 1.1 : 1), 10), endMat);
    face.position.x = (end * hop.len) / 2 + end * 0.002;
    face.rotation.y = end * (Math.PI / 2);
    log.add(face);
  }
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(hop.r * 0.2, hop.r * 0.3, hop.r * 1.5, 6), barkMat);
  stub.position.set(hop.len * 0.18, hop.r * 0.8, hop.r * 0.35);
  stub.rotation.x = -0.9;
  log.add(stub);
  const moss = new THREE.MeshStandardMaterial({ color: 0x4d6b2a, roughness: 1 });
  for (const [at, s] of [[-0.3, 1], [0.05, 0.7], [0.32, 0.85]]) {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(hop.r * 0.55 * s, 7, 5), moss);
    patch.scale.set(1.6, 0.35, 1);
    patch.position.set(at * hop.len, hop.r * 0.95, 0);
    log.add(patch);
  }
  log.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  group.add(log);
  lyingCylinder(c, hop.x, y, hop.z, hop.yaw, hop.len / 2, hop.r);
}

/** The disc on a post: blue with a white arrow pointing straight on, the way a way-marker says "this way". */
function arrowTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = BLUE;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f4f1e6';
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.12);
    ctx.lineTo(w * 0.8, h * 0.5);
    ctx.lineTo(w * 0.6, h * 0.5);
    ctx.lineTo(w * 0.6, h * 0.88);
    ctx.lineTo(w * 0.4, h * 0.88);
    ctx.lineTo(w * 0.4, h * 0.5);
    ctx.lineTo(w * 0.2, h * 0.5);
    ctx.closePath();
    ctx.fill();
  });
}

/** Way-marker posts: a squared timber post with a bevelled cap, a blue band, and the arrow disc on the face that looks back along the way on. */
function buildPosts(c, trail, group) {
  const { heights, random, fixedBox } = c;
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(random, [108, 84, 58]), roughness: 0.95 });
  const band = new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.7 });
  const disc = new THREE.MeshStandardMaterial({ map: arrowTexture(), roughness: 0.6 });
  for (const p of trail.posts) {
    const y = heights.heightAt(p.x, p.z);
    const post = new THREE.Group();
    post.position.set(p.x, y - 0.1, p.z);
    post.rotation.y = p.yaw + (random() - 0.5) * 0.12; // never quite true
    const shaft = new THREE.Mesh(worldBox(0.1, 1.6, 0.1, 1), wood);
    shaft.position.y = 0.8;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.07, 4), wood);
    cap.rotation.y = Math.PI / 4;
    cap.position.y = 1.635;
    const ring = new THREE.Mesh(worldBox(0.114, 0.2, 0.114, 1), band);
    ring.position.y = 1.35;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), disc);
    face.position.set(0, 1.35, 0.0575);
    // A bevelled foot where it meets the ground, and a lean from the weather.
    const foot = new THREE.Mesh(worldBox(0.13, 0.08, 0.13, 1), wood);
    foot.position.y = 0.14;
    post.add(shaft, cap, ring, face, foot);
    post.rotation.z = (random() - 0.5) * 0.04;
    post.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    group.add(post);
    fixedBox(p.x, y + 0.7, p.z, 0.055, 0.8, 0.055);
  }
}

/** The board at the start: two posts, a painted board with the trail's name and a bike's welcome, a shingle cap, an arrow. Faces the gate. */
function buildSign(c, trail, group) {
  const { heights, random, fixedBox } = c;
  const { x, z } = trail.entrance;
  const y = heights.heightAt(x, z);
  const sign = new THREE.Group();
  sign.position.set(x, y - 0.1, z);
  sign.rotation.y = 0.12; // a little round to the lead-in, to face the way you come in
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(random, [96, 76, 52]), roughness: 0.95 });
  const board = new THREE.MeshStandardMaterial({
    map: canvasTexture(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#1b3b2a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#e8e2cc';
      ctx.lineWidth = 8;
      ctx.strokeRect(14, 14, w - 28, h - 28);
      ctx.fillStyle = BLUE;
      ctx.fillRect(14, h - 74, w - 28, 60);
      ctx.fillStyle = '#e8e2cc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 54px Georgia, serif';
      ctx.fillText('THE FERN TRAIL', w / 2, 84);
      ctx.font = '30px Georgia, serif';
      ctx.fillText('Two-wheelers welcome', w / 2, 138);
      ctx.font = 'bold 34px Arial, sans-serif';
      ctx.fillText('Follow the blue posts  →', w / 2, h - 44);
    }),
    roughness: 0.75,
  });
  for (const px of [-0.7, 0.7]) {
    const post = new THREE.Mesh(worldBox(0.12, 1.7, 0.12, 1), wood);
    post.position.set(px, 0.85, 0);
    sign.add(post);
    fixedBox(x + px * Math.cos(0.12), y + 0.85, z - px * Math.sin(0.12), 0.07, 0.85, 0.07);
  }
  const face = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.75, 0.04), [wood, wood, wood, wood, board, wood]);
  face.position.set(0, 1.25, 0.08);
  const rail = new THREE.Mesh(worldBox(1.6, 0.05, 0.12, 1), wood); // the cap along the top, with a drip overhang
  rail.position.set(0, 1.66, 0.1);
  rail.rotation.x = -0.12;
  const rail2 = new THREE.Mesh(worldBox(1.5, 0.06, 0.06, 1), wood); // and a batten behind the board
  rail2.position.set(0, 0.95, 0.0);
  sign.add(face, rail, rail2);
  sign.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  group.add(sign);
}

/** A clump of arching bramble canes: brown stems and a scatter of toothed green leaves, a metre or so high. Colours are baked in. */
function brambleGeometry(random) {
  const pos = [];
  const colors = [];
  const quad = (a, b, c2, d, col) => {
    for (const tri of [[a, b, c2], [a, c2, d], [a, c2, b], [a, d, c2]]) {
      for (const v of tri) {
        pos.push(...v);
        colors.push(...col);
      }
    }
  };
  for (let k = 0; k < 6; k++) {
    const yaw = (k / 6) * Math.PI * 2 + random() * 0.6;
    const dx = Math.cos(yaw);
    const dz = Math.sin(yaw);
    const reach = 0.6 + random() * 0.5;
    const rise = 0.45 + random() * 0.35;
    let prev = null;
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      const p = [dx * reach * t, rise * Math.sin(t * Math.PI * 0.8) - t * t * 0.25, dz * reach * t];
      if (prev) {
        const w = 0.016 * (1 - t * 0.5);
        quad([prev[0] - dz * w, prev[1], prev[2] + dx * w], [prev[0] + dz * w, prev[1], prev[2] - dx * w], [p[0] + dz * w, p[1], p[2] - dx * w], [p[0] - dz * w, p[1], p[2] + dx * w], [0.26, 0.15, 0.1]);
        if (i > 1) {
          // A leaf of three lobes on each side of the cane.
          for (const side of [-1, 1]) {
            const lx = p[0] - dz * side * 0.1;
            const lz = p[2] + dx * side * 0.1;
            const s = 0.1 + random() * 0.05;
            const g = 0.24 + random() * 0.14;
            quad([p[0], p[1], p[2]], [lx - dx * s, p[1] + 0.02, lz - dz * s], [lx + dz * s * 0.3, p[1] + 0.05, lz - dx * s * 0.3], [lx + dx * s, p[1] + 0.02, lz + dz * s], [0.12, g * 0.9, 0.07]);
          }
        }
      }
      prev = p;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const normals = geo.getAttribute('normal');
  for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 1, 0);
  return geo;
}

/** Ferns on both edges of the trail, brambles thrown in here and there. Kept off the Hollow Run, the pond and the logs, and thinner in the dips. */
function buildEdges({ scene, heights, random, drawDistance, autumn }, woods) {
  const half = woods.trailHalf;
  const total = woods.trailTrack.totalLength;
  const ferns = [];
  const fernColors = [];
  const brambles = [];
  const clear = (x, z) => woods.nearest(x, z).d > woods.halfWidth + 1.4 && woods.waterAt(x, z) === 0 && !woods.trail.posts.some((p) => Math.hypot(p.x - x, p.z - z) < 0.5);
  for (let m = 0; m < total; m += 0.9) {
    const p = woods.trailAt(m + random() * 0.8);
    for (const side of [-1, 1]) {
      if (random() < 0.25) continue;
      const lat = side * (half + 0.3 + random() * 1.6);
      const x = p.x - p.tz * lat;
      const z = p.z + p.tx * lat;
      if (!clear(x, z)) continue;
      const bramble = random() < 0.07;
      const s = bramble ? 0.9 + random() * 0.7 : 0.8 + random() * 0.7;
      if (bramble) {
        brambles.push(matrixAt(x, heights.heightAt(x, z) - 0.04, z, random() * 6.28, s, s * (0.8 + random() * 0.4), s));
        continue;
      }
      ferns.push(matrixAt(x, heights.heightAt(x, z) - 0.03, z, random() * 6.28, s, s * (0.8 + random() * 0.4), s));
      const turning = random() < (autumn ? 0.75 : 0.12); // brown and rusty fronds, mostly in autumn
      const col = new THREE.Color();
      if (turning) col.setHSL(0.07 + random() * 0.04, 0.55, 0.4);
      else col.setHSL(0.27 + random() * 0.05, 0.4 + random() * 0.15, 0.32 + random() * 0.14);
      fernColors.push(col);
    }
  }
  const fernMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  // Ferns arch out from a crown: many broad, drooping fronds.
  scene.add(drawDistance.add(tiledInstances(frondGeometry(random, 13, 0.8, 0.1, 0.8), fernMaterial, ferns, { colors: fernColors, name: 'ferns' }), 'roughDistance'));
  if (brambles.length) scene.add(drawDistance.add(tiledInstances(brambleGeometry(random), fernMaterial, brambles, { name: 'brambles' }), 'roughDistance'));
}
