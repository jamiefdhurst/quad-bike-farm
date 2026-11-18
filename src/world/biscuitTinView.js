import * as THREE from 'three';
import { barnShape, barnFrame, placeInBarn } from './barn.js';
import { buildBiscuitTin, buildPlankShelf, BISCUIT_TIN } from './biscuitTin.js';

const SPEED = 3; // lid openness per second
const SHELF_HEIGHT = 0.85; // metres: the shelf's top above the barn floor (the money tin's is 0.8)

/**
 * The snack tin on a plank of its own on the barn's back wall, a few metres along from the cork board. The girls
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
    // Built in the barn's own frame, the shelf at the group's origin, and the whole group put where that is in the world, turned with the barn.
    const frame = barnFrame(world.layout);
    placeInBarn(world.layout, set, wallX + 0.005, floorY + SHELF_HEIGHT, z);
    const shelf = buildPlankShelf();
    set.add(shelf);
    this.tin = buildBiscuitTin();
    // Set off the wall so the lid, standing open, clears it: the hinge is the back edge.
    this.tin.group.position.set(0.03 + BISCUIT_TIN.radius * 1.0, 0, 0);
    set.add(this.tin.group);
    const tinAt = frame.toWorld(wallX + 0.005 + 0.03 + BISCUIT_TIN.radius * 1.0, z);
    this.position = new THREE.Vector3(tinAt.x, floorY + SHELF_HEIGHT, tinAt.z); // the tin, in the world
    const frontAt = frame.toWorld(wallX + 0.8, z);
    this.front = new THREE.Vector3(frontAt.x, world.heightAt(frontAt.x, frontAt.z), frontAt.z);
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
