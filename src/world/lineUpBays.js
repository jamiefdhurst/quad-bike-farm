import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bayPlaces } from './challenges.js';
import { canvasTexture, worldBox } from './outbuildingProps.js';
import { createRandom } from '../core/random.js';

const LENGTH = 2.6; // a railway sleeper is about 2.6 m long,
const WIDTH = 0.25; // 25 cm across
const THICK = 0.15; // and 15 cm thick, laid flat and half sunk in the grass

/** Old creosoted timber, one tile a metre with the grain along u: dark brown gone grey, long splits, a few knots and lichen. */
function sleeperTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(104,88,70)';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const y = random() * h;
      const shade = (random() - 0.5) * 60;
      ctx.fillStyle = `rgba(${shade > 0 ? '170,160,140' : '20,14,10'},${Math.abs(shade) / 150})`;
      ctx.fillRect(random() * w * 0.4, y, w * (0.3 + random() * 0.7), 1 + random() * 2);
    }
    ctx.strokeStyle = 'rgba(15,10,6,0.65)'; // the long splits that open up along old sleepers
    for (let i = 0; i < 9; i++) {
      let x = random() * w;
      const y = random() * h;
      ctx.lineWidth = 1 + random();
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) ctx.lineTo((x += 8 + random() * 22), y + (random() - 0.5) * 3);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(25,16,10,0.55)';
    for (let i = 0; i < 3; i++) {
      const x = random() * w;
      const y = random() * h;
      for (let r = 2; r < 8; r += 2) {
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.6, r * 0.7, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(${random() < 0.5 ? '110,120,86' : '150,150,130'},${0.1 + random() * 0.15})`;
      ctx.beginPath();
      ctx.arc(random() * w, random() * h, 1 + random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/**
 * The line-up spaces (layout.lineUp), each marked by an old railway sleeper laid across the end the quad noses to, half sunk in the grass: no
 * painted lines, just a weathered stop. Each differs a little in length, turn and tilt, and carries a rusty chair plate and bolt. Two meshes in all
 * (timber, iron). Returns { group, bays }; `bays` are the places the line-up challenge judges.
 */
export function buildLineUpBays(scene, heightAt, lineUp) {
  const bays = bayPlaces(lineUp);
  const random = createRandom(0x51ee9e);
  const nose = new THREE.Vector3(Math.sin(lineUp.yaw), 0, Math.cos(lineUp.yaw));
  const across = new THREE.Vector3(Math.cos(lineUp.yaw), 0, -Math.sin(lineUp.yaw));
  const wood = [];
  const iron = [];
  for (const bay of bays) {
    const at = new THREE.Vector3(bay.x, 0, bay.z).addScaledVector(nose, lineUp.length / 2);
    const len = LENGTH - random() * 0.12;
    const ends = [-1, 1].map((s) => heightAt(at.x + across.x * s * len * 0.5, at.z + across.z * s * len * 0.5));
    const y = (ends[0] + ends[1]) / 2 - THICK * 0.15 + 0.01; // the whole thing's middle at the ground, so half of it shows
    const turn = new THREE.Euler((random() - 0.5) * 0.03, lineUp.yaw + (random() - 0.5) * 0.08, Math.atan2(ends[1] - ends[0], len) + (random() - 0.5) * 0.02, 'YXZ');
    const m = new THREE.Matrix4().compose(new THREE.Vector3(at.x, y, at.z), new THREE.Quaternion().setFromEuler(turn), new THREE.Vector3(1, 1, 1));
    const piece = (geo, list, x, yy) => list.push(geo.translate(x, yy, 0).applyMatrix4(m));
    piece(worldBox(len, THICK * 0.7, WIDTH), wood, 0, 0); // the body
    piece(worldBox(len - 0.04, THICK * 0.3, WIDTH - 0.04), wood, 0, THICK * 0.5); // the worn top, stepped in from the edges
    const end = random() < 0.5 ? -1 : 1;
    piece(new THREE.BoxGeometry(0.17, 0.012, 0.13), iron, end * (len / 2 - 0.3), THICK * 0.66); // a rusty chair plate where a rail sat
    piece(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 6), iron, end * (len / 2 - 0.3), THICK * 0.7); // and its bolt
  }
  const group = new THREE.Group();
  group.name = 'lineUpSleepers';
  const timber = new THREE.MeshStandardMaterial({ map: sleeperTexture(random), roughness: 0.95 });
  const rust = new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.8, metalness: 0.4 });
  for (const [list, material] of [[wood, timber], [iron, rust]]) {
    const mesh = new THREE.Mesh(mergeGeometries(list.map((g) => g.toNonIndexed())), material);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  scene.add(group);
  return { group, bays };
}
