import * as THREE from 'three';
import { barnShape } from './barn.js';
import { buildBiscuitTin, buildPlankShelf, BISCUIT_TIN } from './biscuitTin.js';

const SPEED = 3; // lid openness per second
const SHELF_HEIGHT = 0.85; // metres: the shelf's top above the barn floor (the money tin's is 0.8)

/**
 * The snack tin on a plank of its own on the barn's back wall, a few metres along from the money tin under the cork board. The girls
 * help themselves (npc/lunch.js); `want(true)` lifts the lid and `update` swings it. `front` is where a girl stands to reach it.
 */
export class BiscuitTinView {
  constructor({ scene, world }) {
    const shape = barnShape(world.layout);
    const floorY = world.heightAt(shape.x, shape.z);
    const wallX = shape.inner.minX;
    const z = shape.z + 2.2;
    // One named group, so it is drawn only close to the barn (BARN_PROP_NAMES in world/farDetail.js).
    const set = new THREE.Group();
    set.name = 'snackTin';
    scene.add(set);
    const shelf = buildPlankShelf();
    shelf.position.set(wallX + 0.005, floorY + SHELF_HEIGHT, z);
    set.add(shelf);
    this.tin = buildBiscuitTin();
    // Set off the wall so the lid, standing open, clears it: the hinge is the back edge.
    this.tin.group.position.set(wallX + 0.005 + 0.03 + BISCUIT_TIN.radius * 1.0, floorY + SHELF_HEIGHT, z);
    set.add(this.tin.group);
    this.position = this.tin.group.position;
    this.front = new THREE.Vector3(wallX + 0.8, world.heightAt(wallX + 0.8, z), z);
    this.target = 0;
  }

  /** Lid up (true) or down. */
  want(open) {
    this.target = open ? 1 : 0;
  }

  update(dt) {
    const o = this.tin.openness;
    if (o === this.target) return;
    this.tin.setOpen(o < this.target ? Math.min(this.target, o + dt * SPEED) : Math.max(this.target, o - dt * SPEED));
  }
}
