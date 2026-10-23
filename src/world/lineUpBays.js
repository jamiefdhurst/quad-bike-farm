import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bayPlaces } from './challenges.js';

const LINE_W = 0.1; // metres wide, painted white
const LINE_LIFT = 0.03; // above the ground at the highest point of the row, so the grass never covers it

/** The line-up bays painted on the grass (layout.lineUp): a line between each pair, one at each end and one across the back, as one mesh. */
export function buildLineUpBays(scene, heightAt, lineUp) {
  const bays = bayPlaces(lineUp);
  const across = { x: Math.cos(lineUp.yaw), z: -Math.sin(lineUp.yaw) };
  const along = { x: Math.sin(lineUp.yaw), z: Math.cos(lineUp.yaw) };
  const pieces = [];
  const lay = (x, z, width, length) => {
    const g = new THREE.PlaneGeometry(width, length);
    g.rotateX(-Math.PI / 2);
    g.rotateY(lineUp.yaw);
    g.translate(x, 0, z);
    pieces.push(g);
  };
  for (let i = 0; i <= lineUp.bays; i++) {
    const o = (i - lineUp.bays / 2) * lineUp.spacing;
    lay(lineUp.x + across.x * o, lineUp.z + across.z * o, LINE_W, lineUp.length); // a side line, running along the bay
  }
  const backX = lineUp.x - along.x * (lineUp.length / 2);
  const backZ = lineUp.z - along.z * (lineUp.length / 2);
  lay(backX, backZ, lineUp.bays * lineUp.spacing + LINE_W, LINE_W); // across the back
  const top = Math.max(...bays.map((b) => heightAt(b.x, b.z)), heightAt(backX, backZ));
  const geometry = mergeGeometries(pieces);
  geometry.translate(0, top + LINE_LIFT, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xe9e6da, transparent: true, opacity: 0.8, depthWrite: false }));
  mesh.name = 'line-up-bays';
  mesh.receiveShadow = false;
  scene.add(mesh);
  return { mesh, bays };
}
