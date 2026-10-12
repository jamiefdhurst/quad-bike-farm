import './sparesShelf.css';
import * as THREE from 'three';
import { registerTuning } from '../core/tuning.js';
import { createRandom } from '../core/random.js';
import { buildSparesModel } from './sparesModel.js';
import { Spares, DEFAULT_SPARES_PARAMS, SPARES_PARAM_RANGES, PARTS, PART_IDS, partCount } from './spares.js';

/**
 * The parts rack on the barn's back wall beside the bench: the parts in their trays and on their pegs, as many as the spares shelf (spares.js) has, the order
 * panel you open with E, and the parcel the post van leaves at the barn door, which you open with E to put the order on the shelf.
 */
export class SparesShelf {
  constructor(game) {
    this.game = game;
    this.params = { ...DEFAULT_SPARES_PARAMS };
    this.spares = new Spares(this.params, createRandom(game.seed ^ 0x5b3a));
    registerTuning('Spares shelf', this.params, SPARES_PARAM_RANGES);
    const L = game.world.layout;
    const x = L.bench.x - L.bench.length / 2 - 1.2;
    const z = L.barn.z - L.barn.halfZ + L.barn.wall + 0.16;
    const floor = game.world.heightAt(x, z);
    this.model = buildSparesModel();
    this.model.position.set(x, floor, z);
    game.scene.add(this.model);
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.set(x, floor + 1.4, z + 0.1);
    game.scene.add(this.proxy);
    const door = game.trafficHost.places.parcel;
    this.parcelProxy = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
    this.parcelProxy.position.set(door.x, game.world.groundHeightAt(door.x, door.z) + 0.3, door.z);
    game.scene.add(this.parcelProxy);
    game.interaction.add({
      target: this.proxy,
      isAvailable: () => !game.handsFull,
      prompt: () => 'Look at the parts rack',
      interact: () => this.open(),
    });
    game.interaction.add({
      target: this.parcelProxy,
      priority: 1,
      isAvailable: () => this.spares.hasParcel && !game.handsFull,
      prompt: () => 'Open the parcel from the post',
      interact: () => this.collect(),
    });
    this.seen = {};
    this.build();
    this.paintCrates();
  }

  get isOpen() {
    return this.el.style.display !== 'none';
  }

  /** The parcel is there to see on a day that starts with one in it (the farm remembers). */
  showParcel() {
    const door = this.game.trafficHost.places.parcel;
    if (this.spares.hasParcel) this.game.trafficHost.view.addParcel(door.x, door.z, 0.4);
  }

  collect() {
    const got = this.spares.collect();
    this.game.trafficHost.view.clearParcel();
    const list = Object.entries(got).map(([id, n]) => partCount(id, n));
    this.game.hud.toast(list.length ? `In the parcel: ${list.join(', ')}. Put on the rack` : 'The parcel is empty');
    this.paintCrates();
  }

  /** Orders a pack of a part; says what happened either way. */
  order(id) {
    const r = this.spares.order(id);
    this.game.hud.toast(r.ok ? `Ordered ${partCount(id, this.spares.pack(id))}: the post van will bring them` : `Can't order: ${r.why}`);
    this.render();
    return r.ok;
  }

  /** The rack shows as many of each part as there are on the shelf. */
  paintCrates() {
    this.model.userData.setCounts(this.spares.counts);
  }

  open() {
    this.render();
    this.el.style.display = 'block';
    document.body.classList.add('spares-open');
    this.game.player.moveEnabled = false;
  }

  close() {
    this.el.style.display = 'none';
    document.body.classList.remove('spares-open');
    this.game.player.moveEnabled = true;
  }

  handleInput(input) {
    this.game.player.moveEnabled = false;
    input.takeWheelSteps();
    if (input.wasPressed('KeyG') || input.wasPressed('KeyE') || input.wasPressed('Escape')) return this.close();
    PART_IDS.forEach((id, i) => {
      if (input.wasPressed(`Digit${i + 1}`) || input.wasPressed(`Numpad${i + 1}`)) this.order(id);
    });
  }

  /** Counts the order down, sends the post when it is due, and keeps the crates in step with the shelf. */
  update(dt) {
    const host = this.game.trafficHost;
    const free = !host.traffic.visit && (this.game.daylight?.darkness ?? 0) < 0.7;
    if (this.spares.update(dt, free) && host.debugVisit('post')) this.spares.sentOff();
    this.paintCrates();
    this.remarkOnStock();
  }

  /** A girl near the barn says so when a part runs down to the last one, or out. */
  remarkOnStock() {
    for (const id of PART_IDS) {
      const n = this.spares.count(id);
      const was = this.seen[id] ?? n;
      this.seen[id] = n;
      if (n < was && n <= 1) this.game.trafficHost.remark(n === 0 ? 'sparesOut' : 'sparesLow', this.model.position, 0.9);
    }
  }

  // Debug panel and console -------------------------------------------------

  describe() {
    const sp = this.spares;
    return `${PART_IDS.map((id) => `${id} ${sp.count(id)}${sp.ordered[id] ? `+${sp.ordered[id]} ordered` : ''}${sp.waiting[id] ? `+${sp.waiting[id]} parcel` : ''}`).join(', ')}${sp.due !== null ? `; van due in ${Math.max(0, Math.round(sp.due))} s` : ''}`;
  }

  /** Every crate to `n` (the debug panel's fill and empty). */
  debugSetAll(n) {
    for (const id of PART_IDS) this.spares.counts[id] = n;
    this.paintCrates();
  }

  debugOrderAll() {
    for (const id of PART_IDS) this.spares.order(id);
  }

  build() {
    const el = document.createElement('div');
    el.className = 'spares';
    el.style.display = 'none';
    el.innerHTML = '<div class="sp-card"><div class="sp-title">Parts rack</div><div class="sp-body"></div><div class="sp-keys"></div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.bodyEl = el.querySelector('.sp-body');
    this.keysEl = el.querySelector('.sp-keys');
  }

  render() {
    this.bodyEl.innerHTML = PART_IDS.map((id, i) => {
      const full = this.spares.total(id) + this.spares.pack(id) > this.params.maxOnShelf;
      return `<div class="sp-row${this.spares.has(id) ? '' : ' none'}"><span class="key">${i + 1}</span>${PARTS[id].many[0].toUpperCase()}${PARTS[id].many.slice(1)}: ${this.spares.line(id)}${full ? '' : ` <em>(order ${this.spares.pack(id)})</em>`}</div>`;
    }).join('');
    this.keysEl.textContent = 'Press a number to order a pack   ·   the post van brings it   ·   G step away';
  }
}
