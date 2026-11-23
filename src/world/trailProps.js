// The Fern Trail's things (world/woods.js, `woods.trail`): roots across the path, the log to hop, blue-banded way-marker posts, the marker at
// the start, and ferns and brambles along its edges. Roots and the log have colliders (low rounded bumps, so a wheel rolls over them);
// the plants don't, you ride through them.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tiledInstances } from './tiledInstances.js';
import { matrixAt } from './hillProps.js';
import { plantMaterial, fernTexture, brambleLeafTexture, fernGeometry, brambleGeometry } from './woodPlants.js';
import { worldBox, canvasTexture } from './outbuildingProps.js';
import { woodTexture, barkTexture, logEndTexture, routedPostTexture, platedTexture } from './neighbourTextures.js';

const UP = new THREE.Vector3(0, 1, 0);
export const POST_BAND = 0.114; // m: the blue band round a way-marker post
export const DISC_RADIUS = 0.05; // m: the arrow disc on it, which has to stay inside the band
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
  buildTrailSign(c, woods, group);
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

/** Way-marker posts: a squared timber post with a bevelled cap, a blue band, and the arrow disc on the face that looks back along the way on. Merged into a mesh per material: 11 posts of five parts would be 55 draw calls. */
function buildPosts(c, trail, group) {
  const { heights, random, fixedBox } = c;
  const mats = {
    wood: new THREE.MeshStandardMaterial({ map: woodTexture(random, [108, 84, 58]), roughness: 0.95 }),
    band: new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.7 }),
    disc: new THREE.MeshStandardMaterial({ map: arrowTexture(), roughness: 0.6 }),
  };
  const parts = { wood: [], band: [], disc: [] };
  for (const p of trail.posts) {
    const y = heights.heightAt(p.x, p.z);
    const at = new THREE.Matrix4().compose(
      new THREE.Vector3(p.x, y - 0.1, p.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler((random() - 0.5) * 0.03, p.yaw + (random() - 0.5) * 0.12, (random() - 0.5) * 0.04)), // never quite true
      new THREE.Vector3(1, 1, 1),
    );
    const put = (kind, geo, x, py, z, rotY = 0) => {
      if (rotY) geo.rotateY(rotY);
      parts[kind].push(geo.translate(x, py, z).applyMatrix4(at));
    };
    put('wood', worldBox(0.1, 1.6, 0.1, 1), 0, 0.8, 0);
    put('wood', new THREE.ConeGeometry(0.085, 0.07, 4), 0, 1.635, 0, Math.PI / 4);
    put('wood', worldBox(0.13, 0.08, 0.13, 1), 0, 0.14, 0); // a foot where it meets the ground
    put('band', worldBox(POST_BAND, 0.2, POST_BAND, 1), 0, 1.35, 0);
    put('disc', new THREE.CircleGeometry(DISC_RADIUS, 16), 0, 1.35, 0.0575); // narrower than the 0.114 band, so its edge stays on the post
    fixedBox(p.x, y + 0.7, p.z, 0.055, 0.8, 0.055);
  }
  for (const kind of Object.keys(parts)) {
    if (!parts[kind].length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(parts[kind]), mats[kind]);
    mesh.castShadow = kind === 'wood';
    group.add(mesh);
  }
}

/** The marker's size in metres (the post's face, its bands and plate), which the lettering's boxes are checked against (tests/trailMarkers.test.js). */
export const MARKER = {
  w: 0.26, d: 0.14, h: 1.2, below: 0.15, // the post: its face is w by h, and it is set `below` m into the ground
  name: { lines: ['FERN', 'TRAIL'], box: [0.04, 0.4] }, // the routed name, as fractions of the face's height from the top
  band: { y: 0.62, h: POST_BAND }, // the blue band's middle, above the ground
  plate: { w: 0.19, h: 0.07, y: 0.43, text: 'Two-wheelers' }, // no longer than a hand
};

/** The way the marker's face looks: towards the lead-in point 5 m up it towards the gate, which is where you come from. */
function faceYaw(x, z, leadIn) {
  let best = { d: Infinity, x: leadIn[0][0], z: leadIn[0][1] };
  for (let i = 0; i + 1 < leadIn.length; i++) {
    const [ax, az] = leadIn[i];
    const [bx, bz] = leadIn[i + 1];
    const len2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / len2));
    const px = ax + (bx - ax) * t;
    const pz = az + (bz - az) * t;
    const d = Math.hypot(px - x, pz - z);
    if (d < best.d) best = { d, x: px, z: pz, dx: ax - bx, dz: az - bz, len: Math.sqrt(len2) };
  }
  const k = best.len ? 5 / best.len : 0; // towards the start of the lead-in, the gate
  return Math.atan2(best.x + (best.dx ?? 0) * k - x, best.z + (best.dz ?? 0) * k - z);
}

/** The marker at the start: a squared oak post with the name routed in, a blue band and arrow disc, a small plate, set off the track in the leaf litter with ferns at its foot. `woods` is world/woods.js. */
export function buildTrailSign(c, woods, group) {
  const { heights, random, fixedBox, scene, drawDistance, autumn } = c;
  const { x, z } = woods.trail.entrance;
  const y = heights.heightAt(x, z);
  const yaw = faceYaw(x, z, woods.leadIn);
  const { w, d, h, below } = MARKER;
  const root = new THREE.Group();
  root.name = 'trailSign';
  root.position.set(x, y, z);
  root.rotation.y = yaw;
  const lean = new THREE.Group(); // never quite true
  lean.position.y = -below;
  lean.rotation.set(-0.025, 0, 0.03);
  root.add(lean);
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(random, [122, 116, 104]), roughness: 0.95 });
  const face = new THREE.MeshStandardMaterial({ map: routedPostTexture(random, { faceW: w, faceH: h + below, lines: MARKER.name.lines, box: MARKER.name.box.map((f) => f * h / (h + below)) }), roughness: 0.95 });
  const part = (geo, mat, px, py, pz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.castShadow = true;
    lean.add(m);
    return m;
  };
  part(new THREE.BoxGeometry(w, h + below, d), [wood, wood, wood, wood, face, wood], 0, (h + below) / 2, 0);
  const cap = part(new THREE.ConeGeometry(0.5, 0.07, 4), wood, 0, h + below + 0.035 - 0.004, 0); // a chamfered top that sheds the rain
  cap.rotation.y = Math.PI / 4;
  cap.scale.set(w * 0.98, 1, d * 0.98);
  part(new THREE.BoxGeometry(w + 0.03, 0.2, d + 0.03), new THREE.MeshStandardMaterial({ color: 0x4a5a30, roughness: 1 }), 0, below + 0.04, 0); // the green foot
  const bandY = below + MARKER.band.y;
  part(new THREE.BoxGeometry(w + 0.012, MARKER.band.h, d + 0.012), new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.7 }), 0, bandY, 0);
  part(new THREE.CircleGeometry(DISC_RADIUS, 16), new THREE.MeshStandardMaterial({ map: arrowTexture(), roughness: 0.6 }), 0, bandY, d / 2 + 0.006 + 0.004);
  const pl = MARKER.plate;
  part(new THREE.BoxGeometry(pl.w, pl.h, 0.025), new THREE.MeshStandardMaterial({ map: platedTexture(random, pl.text, { plateW: pl.w, plateH: pl.h }), roughness: 0.85 }), 0, below + pl.y, d / 2 + 0.008);
  // Moss on the north side, which is where the damp stays: flat patches half in the post.
  const moss = new THREE.MeshStandardMaterial({ color: 0x5a7a30, roughness: 1 });
  const nx = Math.sin(yaw);
  const nz = -Math.cos(yaw);
  for (const [up, s, across] of [[0.1, 1.5, -0.03], [0.22, 1.2, 0.04], [0.36, 0.8, -0.02], [0.52, 0.6, 0.03]]) {
    const patch = part(new THREE.SphereGeometry(0.07 * s, 8, 6), moss, nx * (d / 2 - 0.012) + nz * across, below + up, nz * (d / 2 - 0.012) - nx * across);
    patch.rotation.y = Math.atan2(nx, nz);
    patch.scale.set(1.5, 0.9, 0.3); // a low cushion, wider than it is tall
  }
  // Leaf litter under it, a few brown and ochre scraps.
  const litter = [0x6b4a28, 0x8a6a2e, 0x5a3e22].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.1 + random() * 0.12, 7), litter[i % 3]);
    const a = random() * 6.28;
    const r = 0.1 + random() * 0.45;
    leaf.rotation.x = -Math.PI / 2;
    leaf.position.set(Math.cos(a) * r, 0.015 + i * 0.005, Math.sin(a) * r);
    root.add(leaf);
  }
  group.add(root);
  fixedBox(x, y + h / 2, z, w / 2, h / 2, d / 2);
  // Ferns round the foot, clear of the face so the lettering reads.
  const fernMatrices = [];
  for (let i = 0; i < 7; i++) {
    const a = yaw + Math.PI * (0.5 + (i / 6) * 1.0) * (i % 2 ? 1 : -1) + random() * 0.4;
    const r = 0.35 + random() * 0.35;
    const fx = x + Math.sin(a) * r;
    const fz = z + Math.cos(a) * r;
    const s = 0.7 + random() * 0.5;
    fernMatrices.push(matrixAt(fx, heights.heightAt(fx, fz) - 0.03, fz, random() * 6.28, s, s * (0.8 + random() * 0.4), s));
  }
  scene.add(drawDistance.add(tiledInstances(fernGeometry(random, { autumn, turn: autumn ? 0.25 : 0 }), plantMaterial(fernTexture(random)), fernMatrices, { name: 'ferns' }), 'roughDistance'));
}

/**
 * Ferns on both edges of the trail, brambles thrown in here and there (woodPlants.js: textured leaves, a colour of their own each, turning in autumn from their tips in).
 * Kept off the Hollow Run, the pond and the logs, and thinner in the dips. Two kinds of each (one further into its autumn), so the plants along the way differ.
 */
function buildEdges({ scene, heights, random, drawDistance, autumn }, woods) {
  const half = woods.trailHalf;
  const total = woods.trailTrack.totalLength;
  const ferns = [[], []];
  const fernColors = [[], []];
  const brambles = [[], []];
  const clear = (x, z) => woods.nearest(x, z).d > woods.halfWidth + 1.4 && woods.waterAt(x, z) === 0 && !woods.trail.posts.some((p) => Math.hypot(p.x - x, p.z - z) < 0.5);
  for (let m = 0; m < total; m += 0.9) {
    const p = woods.trailAt(m + random() * 0.8);
    for (const side of [-1, 1]) {
      if (random() < 0.25) continue;
      const lat = side * (half + 0.3 + random() * 1.6);
      const x = p.x - p.tz * lat;
      const z = p.z + p.tx * lat;
      if (!clear(x, z)) continue;
      const kind = random() < 0.5 ? 0 : 1;
      const bramble = random() < 0.07;
      const s = bramble ? 0.9 + random() * 0.7 : 0.8 + random() * 0.7;
      if (bramble) {
        brambles[kind].push(matrixAt(x, heights.heightAt(x, z) - 0.04, z, random() * 6.28, s, s * (0.8 + random() * 0.4), s));
        continue;
      }
      ferns[kind].push(matrixAt(x, heights.heightAt(x, z) - 0.03, z, random() * 6.28, s, s * (0.8 + random() * 0.4), s));
      const shade = 0.85 + random() * 0.3; // a plant is a little lighter or darker than the next
      fernColors[kind].push(new THREE.Color(shade, shade, shade));
    }
  }
  const fernMaterial = plantMaterial(fernTexture(random));
  const brambleMaterial = plantMaterial(brambleLeafTexture(random));
  const turns = autumn ? [0.25, 0.7] : [0, 0.15];
  turns.forEach((turn, kind) => {
    if (ferns[kind].length) scene.add(drawDistance.add(tiledInstances(fernGeometry(random, { autumn, turn }), fernMaterial, ferns[kind], { colors: fernColors[kind], name: 'ferns' }), 'roughDistance'));
    if (brambles[kind].length) scene.add(drawDistance.add(tiledInstances(brambleGeometry(random, { autumn, turn }), brambleMaterial, brambles[kind], { name: 'brambles' }), 'roughDistance'));
  });
}
