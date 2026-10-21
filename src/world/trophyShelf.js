import * as THREE from 'three';
import { barnShape } from './barn.js';

const SHELF_W = 0.9; // as wide as the calendar above it
const SHELF_D = 0.14;
const PEG_SPACING = SHELF_W / 4;

/** One rosette: a gathered ring round a flat middle and two tails, in the place's colour. Faces +x, like the boards. */
export function buildRosette(colour) {
  const g = new THREE.Group();
  const ribbon = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.7 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 20), ribbon);
  ring.rotation.y = Math.PI / 2;
  g.add(ring);
  const middle = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 20), new THREE.MeshStandardMaterial({ color: 0xf2ead6, roughness: 0.8 }));
  middle.rotation.z = Math.PI / 2;
  middle.position.x = 0.004;
  g.add(middle);
  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.11, 0.032), ribbon);
    tail.position.set(-0.004, -0.1, side * 0.022);
    tail.rotation.x = side * 0.18;
    g.add(tail);
  }
  return g;
}

/** A little shelf on the barn's back wall under the calendar, with a rosette hung from a nail for each show the farm has been placed at. */
export class TrophyShelf {
  constructor({ game }) {
    const shape = barnShape(game.world.layout);
    const floorY = game.world.heightAt(shape.x, shape.z);
    const group = new THREE.Group();
    group.name = 'trophy-shelf';
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(SHELF_D, 0.025, SHELF_W), wood);
    board.position.set(SHELF_D / 2, 0, 0);
    group.add(board);
    for (const z of [-SHELF_W / 2 + 0.06, SHELF_W / 2 - 0.06]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.02), wood);
      bracket.position.set(0.012, -0.06, z);
      group.add(bracket);
    }
    this.rosettes = new THREE.Group();
    group.add(this.rosettes);
    group.position.set(shape.inner.minX + 0.06, floorY + 1.02, shape.z); // under the calendar (its middle 1.75 m up, 1.2 m tall)
    game.scene.add(group);
    this.group = group;
  }

  /** Hangs the rosettes of `list` ([{ rosette }], latest last) from the wall above the shelf, the latest on the right. */
  show(list) {
    this.rosettes.clear();
    list.slice(-8).forEach((r, i, all) => {
      const m = buildRosette(r.rosette);
      m.position.set(0.008, 0.2, (i - (all.length - 1) / 2) * Math.min(PEG_SPACING, (SHELF_W - 0.14) / Math.max(1, all.length - 1)));
      this.rosettes.add(m);
    });
  }
}
