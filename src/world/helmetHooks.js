import * as THREE from 'three';
import { buildHelmet, buildGoggles, GOGGLE_LOOK } from '../npc/helmetModel.js';

// The hooks by the barn's south wall (headgear.js): a board with four pegs, Amy's helmet, Jess's, yours, and your goggles hanging from the
// last. `show` says which helmets are hanging there (a girl who has hers, or you wearing yours, takes it off the peg).

const wood = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.8 });
const metal = new THREE.MeshStandardMaterial({ color: 0x4a4d50, roughness: 0.5, metalness: 0.6 });

/** Pegs along the board, in x, for the items in order. */
export const HOOK_ITEMS = ['amy', 'jess', 'you', 'goggles'];

export class HelmetHooks {
  constructor(scene, layout, heightAt) {
    const h = layout.helmetHooks;
    this.layout = h;
    const floor = heightAt(h.x, h.z);
    this.group = new THREE.Group();
    this.group.name = 'helmetHooks';
    this.group.position.set(h.x, floor, h.z);
    this.group.rotation.y = Math.PI; // the board is on the wall at +z and its front faces -z, into the barn
    const board = new THREE.Mesh(new THREE.BoxGeometry(h.length, 0.16, 0.03), wood);
    board.position.set(0, h.y, 0);
    board.castShadow = true;
    this.group.add(board);
    this.items = {};
    this.proxies = {};
    const gap = h.length / HOOK_ITEMS.length;
    HOOK_ITEMS.forEach((id, i) => {
      const x = -h.length / 2 + gap * (i + 0.5);
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), metal);
      peg.rotation.x = Math.PI / 2;
      peg.position.set(x, h.y, 0.065);
      this.group.add(peg);
      const item = id === 'goggles' ? this.hangGoggles() : this.hangHelmet(id);
      item.position.set(x, id === 'goggles' ? h.y - 0.06 : h.y + 0.005, 0.12);
      this.group.add(item);
      this.items[id] = item;
      // What you look at to take it: a box round the peg and what hangs from it.
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(gap * 0.9, 0.34, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
      proxy.position.set(x, h.y - 0.05, 0.12);
      this.group.add(proxy);
      this.proxies[id] = proxy;
    });
    scene.add(this.group);
    this.group.updateMatrixWorld(true);
  }

  /** A helmet hung by its strap: dome up on the peg, facing into the barn, tipped back a little against the board. */
  hangHelmet(who) {
    const g = new THREE.Group();
    const helmet = buildHelmet(who);
    helmet.rotation.set(-0.35, 0, 0);
    g.add(helmet);
    return g;
  }

  hangGoggles() {
    const g = new THREE.Group();
    const gg = buildGoggles(GOGGLE_LOOK, 0.06);
    gg.rotation.x = -0.2;
    g.add(gg);
    return g;
  }

  /** Shows what is hanging there: `ids` among 'amy', 'jess', 'you' and 'goggles'. */
  show(ids) {
    for (const [id, item] of Object.entries(this.items)) item.visible = ids.includes(id);
  }
}
