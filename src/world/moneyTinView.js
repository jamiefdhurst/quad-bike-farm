import './classifieds.css';
import * as THREE from 'three';
import { barnShape } from './barn.js';
import { buildTin, TIN } from './moneyTin.js';
import { tinLevel, ledgerText } from '../farm/classifieds.js';
import { moneyFacts } from '../farm/classifieds.js';

const SHELF = { long: 0.5, deep: 0.25, thick: 0.03, height: 0.8 }; // metres; height is the shelf's top above the barn floor
const SPEED = 3.2; // lid openness per second

/**
 * The money tin on its shelf under the cork board, on the barn's back wall: a biscuit tin with the farm's money in it (world/moneyTin.js). Look at it
 * and press E: the lid comes up and a card says what is in it, what moved today and the last few deals. What shows in the tin grows with the balance.
 */
export class MoneyTinView {
  constructor({ game, market }) {
    this.game = game;
    this.market = market;
    const shape = barnShape(game.world.layout);
    const floorY = game.world.heightAt(shape.x, shape.z);
    const wallX = shape.inner.minX;
    const z = shape.z + 3.75; // under the cork board
    // A plank on two brackets, against the plaster.
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2e, roughness: 0.85 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.5 });
    const shelf = new THREE.Group();
    shelf.name = 'tin-shelf';
    shelf.add(this.box(SHELF.deep, SHELF.thick, SHELF.long, wood, SHELF.deep / 2, -SHELF.thick / 2, 0));
    for (const dz of [-SHELF.long * 0.35, SHELF.long * 0.35]) {
      shelf.add(this.box(0.02, 0.17, 0.02, iron, 0.012, -SHELF.thick - 0.085 + 0.02, dz)); // upright against the wall
      shelf.add(this.box(0.17, 0.02, 0.02, iron, 0.09, -SHELF.thick - 0.0, dz)); // arm under the plank
    }
    shelf.position.set(wallX + 0.005, floorY + SHELF.height, z);
    game.scene.add(shelf);
    this.tin = buildTin();
    // The tin sits a little off the wall so its lid, standing open, clears it; the lid hinge is the back edge.
    this.tin.group.position.set(wallX + 0.005 + 0.09 + TIN.deep / 2, floorY + SHELF.height, z);
    game.scene.add(this.tin.group);
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.46), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.set(this.tin.group.position.x, floorY + SHELF.height + 0.12, z);
    game.scene.add(this.proxy);
    this.position = this.tin.group.position;
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
    if (input.wasPressed('KeyG') || input.wasPressed('KeyE') || input.wasPressed('Escape')) this.close();
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
    el.innerHTML = '<div class="cl-card"><div class="cl-title">The tin</div><div class="cl-purse tin-balance"></div><div class="cl-body"></div><div class="cl-keys">E or G to put the lid back</div></div>';
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
