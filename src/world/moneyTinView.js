import './classifieds.css';
import * as THREE from 'three';
import { buildTin, TIN } from './moneyTin.js';
import { tinLevel, ledgerText } from '../farm/classifieds.js';
import { moneyFacts } from '../farm/classifieds.js';
import { barnFrame, barnLocal, placeInBarn } from './barn.js';

const SHELF = { long: 0.5, deep: 0.25, thick: 0.03 }; // metres
const SPEED = 3.2; // lid openness per second

/**
 * The money tin on its shelf in the barn's north-west corner, on the north wall (`layout.moneyTin`), out of the way of the bench: a tin with the farm's money in it
 * (world/moneyTin.js). Look at it and press E: the lid comes up and a card says what is in it, what moved today and the last few deals. What shows in the tin grows
 * with the balance.
 */
export class MoneyTinView {
  constructor({ game, market }) {
    this.game = game;
    this.market = market;
    const layout = game.world.layout;
    const spot = barnLocal(layout).moneyTin; // in the barn's own frame: the whole set is put in the world turned with the barn
    const floorY = game.world.heightAt(layout.barn.x, layout.barn.z); // the barn's floor is level
    const top = floorY + spot.y;
    const wallZ = spot.z + 0.005; // the plank's back, against the plaster
    const set = new THREE.Group();
    set.name = 'tin-set';
    placeInBarn(layout, set, spot.x, top, wallZ);
    game.scene.add(set);
    // The shelf and the tin are built with their backs to a wall along z and their fronts to +x; turned a quarter, they stand on the north wall with their fronts to +z.
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2e, roughness: 0.85 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.5 });
    const shelf = new THREE.Group();
    shelf.name = 'tin-shelf';
    shelf.add(this.box(SHELF.deep, SHELF.thick, SHELF.long, wood, SHELF.deep / 2, -SHELF.thick / 2, 0));
    for (const dz of [-SHELF.long * 0.35, SHELF.long * 0.35]) {
      shelf.add(this.box(0.02, 0.17, 0.02, iron, 0.012, -SHELF.thick - 0.085 + 0.02, dz)); // upright against the wall
      shelf.add(this.box(0.17, 0.02, 0.02, iron, 0.09, -SHELF.thick - 0.0, dz)); // arm under the plank
    }
    shelf.rotation.y = -Math.PI / 2;
    set.add(shelf);
    this.tin = buildTin();
    // The tin sits a little off the wall so its lid, standing open, clears it; the lid hinge is the back edge.
    const off = 0.09 + TIN.deep / 2;
    this.tin.group.position.set(0, 0, off);
    this.tin.group.rotation.y = -Math.PI / 2;
    set.add(this.tin.group);
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.36), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.set(0, 0.12, off);
    set.add(this.proxy);
    const tinAt = barnFrame(layout).toWorld(spot.x, wallZ + off);
    this.position = new THREE.Vector3(tinAt.x, top, tinAt.z); // the tin in the world: the coins' sound and how far you are from it
    this.target = 0;
    this.buildCard();
    this.refresh();
  }

  box(w, h, d, material, x, y, zz) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, zz);
    return m;
  }

  get isOpen() {
    return this.el.style.display !== 'none';
  }

  prompt() {
    return 'Look in the tin';
  }

  open() {
    this.render();
    this.el.style.display = 'block';
    document.body.classList.add('classifieds-open');
    this.game.player.moveEnabled = false;
    this.target = 1;
  }

  close() {
    this.el.style.display = 'none';
    document.body.classList.remove('classifieds-open');
    this.game.player.moveEnabled = true;
    this.target = 0;
  }

  handleInput(input) {
    this.game.player.moveEnabled = false;
    input.takeWheelSteps();
    if (input.wasPressed('KeyB') || input.wasPressed('Escape')) this.close();
  }

  /** The lid eases open and shut. */
  update(dt) {
    const now = this.tin.openness;
    if (now === this.target) return;
    this.tin.setOpen(now + Math.sign(this.target - now) * Math.min(Math.abs(this.target - now), SPEED * dt));
  }

  /** The balance or a deal changed: what shows in the tin, and the card if it is up. */
  refresh() {
    this.tin.setLevel(tinLevel(this.market.purse));
    if (this.isOpen) this.render();
  }

  buildCard() {
    const el = document.createElement('div');
    el.className = 'classifieds money-tin';
    el.style.display = 'none';
    el.innerHTML = '<div class="cl-card"><div class="cl-title">The tin</div><div class="cl-purse tin-balance"></div><div class="cl-body"></div><div class="cl-keys">B to put the lid back</div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.balanceEl = el.querySelector('.tin-balance');
    this.bodyEl = el.querySelector('.cl-body');
  }

  render() {
    const m = this.market;
    this.balanceEl.textContent = `£${m.purse.toLocaleString('en-GB')} in the tin`;
    const today = moneyFacts(m.today, m.purse).replace(/^£[\d,]+ in the tin ?/, '').replace(/^\(|\)$/g, '');
    const rows = [];
    rows.push(Object.assign(document.createElement('div'), { className: 'cl-ad', textContent: today ? `Today: ${today}` : 'Nothing has moved today.' }));
    const deals = m.ledger.slice().reverse();
    rows.push(Object.assign(document.createElement('div'), { className: 'cl-hint', textContent: deals.length ? 'The last few deals:' : 'No deals yet.' }));
    for (const d of deals) rows.push(Object.assign(document.createElement('div'), { className: 'cl-ad', textContent: ledgerText(d) }));
    this.bodyEl.replaceChildren(...rows);
  }
}
