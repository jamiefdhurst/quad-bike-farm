// Where the brook (world/brook.js) goes under the public lane: a stone headwall with a concrete pipe mouth each side of the road, set into the
// bank where the channel meets the lane's embankment. The tarmac itself is the terrain's, level over the top, so nothing here is on the road.

import * as THREE from 'three';
import { stoneTexture, worldBox } from './outbuildingProps.js';
import { enableShadows } from './assets.js';

/** Builds the culvert's two headwalls and their colliders. `c` is the props context (props.js). */
export function buildBrookCulvert(c) {
  const { scene, heights, fixedBox, random } = c;
  const brook = heights.brook;
  if (!brook?.culvert) return;
  const group = new THREE.Group();
  group.name = 'brookCulvert';
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(random), roughness: 0.95 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x9a978e, roughness: 0.9 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x0a0b0a });
  const width = 3.4;
  const thick = 0.6;
  for (const m of brook.mouths) {
    const x = m.x + m.side * 1.0; // out from the lane, where the channel is a little cut in
    const z = brook.zAt(x);
    const bed = heights.heightAt(x, z);
    const bank = Math.max(heights.heightAt(x, z - width / 2 - 0.3), heights.heightAt(x, z + width / 2 + 0.3));
    const top = bank + 0.3;
    const h = top - (bed - 0.35);
    const wall = new THREE.Mesh(worldBox(thick, h, width, 2), stone);
    wall.position.set(x - m.side * thick * 0.5, bed - 0.35 + h / 2, z);
    group.add(wall);
    const cap = new THREE.Mesh(worldBox(thick + 0.12, 0.1, width + 0.12, 1), concrete);
    cap.position.set(x - m.side * thick * 0.5, top + 0.05, z);
    group.add(cap);
    // The pipe's mouth: a concrete ring standing out of the face, and the dark inside.
    const faceX = x + m.side * 0.01;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 8, 20), concrete);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(faceX + m.side * 0.05, bed + 0.5, z);
    group.add(ring);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), dark);
    hole.rotation.y = m.side > 0 ? Math.PI / 2 : -Math.PI / 2;
    hole.position.set(faceX + m.side * 0.02, bed + 0.5, z);
    group.add(hole);
    fixedBox(wall.position.x, wall.position.y, z, thick / 2, h / 2, width / 2);
  }
  enableShadows(group);
  scene.add(group);
}
