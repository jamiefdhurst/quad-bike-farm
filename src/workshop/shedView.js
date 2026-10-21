import '../world/classifieds.css';
import * as THREE from 'three';
import { barnShape } from '../world/barn.js';
import { SHED_PIECES, SHED_PIECE_IDS } from '../farm/shed.js';
import { SHED_KINDS, SHED_PIECE_OF } from '../vehicle/shedFaults.js';
import { buildCatalogue, buildCompressor, buildWasher, buildPit } from './shedModels.js';

/**
 * The barn's shed kit (farm/shed.js): the catalogue hung on a nail under the cork board, and the compressor, the parts washer and the pit that
 * stand in the barn the morning after they are paid for. Look at the catalogue and press E for the card: 1 to 3 buy a piece from the tin.
 * What stands in the barn is decided when the day loads, since a piece turns up overnight.
 */
export class ShedView {
  constructor({ game, shed, market }) {
    this.game = game;
    this.shed = shed;
    this.market = market;
    const L = game.world.layout;
    const shape = barnShape(L);
    const heightAt = (x, z) => game.world.heightAt(x, z);
    // The catalogue on the west wall, facing out over the barn (+x), a hand's width clear of the plaster.
    const cat = buildCatalogue();
    cat.group.position.set(shape.inner.minX + 0.03, heightAt(shape.x, L.shed.catalogue.z) + L.shed.catalogue.y, L.shed.catalogue.z);
    cat.group.rotation.y = Math.PI / 2;
    game.scene.add(cat.group);
    this.catalogue = cat.group;
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.copy(cat.group.position);
    this.proxy.position.x += 0.05;
    game.scene.add(this.proxy);
    // The pieces, built once and shown only if they have been delivered.
    this.pieces = {};
    const day = game.farm.day;
    for (const [id, build] of [['compressor', buildCompressor], ['washer', buildWasher], ['pit', () => buildPit(L.shed.pit)]]) {
      const at = L.shed[id];
      const built = build();
      const y = heightAt(at.x, at.z);
      built.group.position.set(at.x, y, at.z);
      built.group.rotation.y = at.yaw ?? 0;
      built.group.visible = shed.has(id, day);
      game.scene.add(built.group);
      this.pieces[id] = { ...built, collider: null };
    }
    this.armed = null;
    this.buildCard();
  }

  /** Is this piece standing in the barn now (it was shown when the day loaded)? */
  standing(id) {
    return this.pieces[id]?.group.visible ?? false;
  }

  /** Shows (or hides) a piece at once: the debug panel and the console hand them over without waiting for the morning. */
  setStanding(id, on) {
    const p = this.pieces[id];
    if (!p) return;
    p.group.visible = on;
    if (on && !p.collider && id !== 'pit') this.addCollider(id, p);
  }

  /** Compressor and washer cannot be walked or driven through. The pit is flat, so nothing blocks it. */
  addCollider(id, p) {
    const game = this.game;
    if (!game.RAPIER || !game.physics?.createCollider) return;
    const { x, y, z } = p.group.position;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.group.rotation.y);
    const half = id === 'compressor' ? { x: p.size.x / 2, z: p.size.z / 2 } : { x: p.size.x / 2, z: p.size.z / 2 };
    p.collider = game.physics.createCollider(
      game.RAPIER.ColliderDesc.cuboid(half.x, p.size.y / 2, half.z).setTranslation(x, y + p.size.y / 2, z).setRotation(q),
    );
  }

  get isOpen() {
    return this.el.style.display !== 'none';
  }

  prompt() {
    return 'Look through the shed catalogue';
  }

  open() {
    this.armed = null;
    this.render();
    this.el.style.display = 'block';
    document.body.classList.add('classifieds-open');
    this.game.player.moveEnabled = false;
  }

  close() {
    this.el.style.display = 'none';
    document.body.classList.remove('classifieds-open');
    this.game.player.moveEnabled = true;
  }

  handleInput(input) {
    this.game.player.moveEnabled = false;
    input.takeWheelSteps();
    if (input.wasPressed('KeyG') || input.wasPressed('KeyE') || input.wasPressed('Escape')) return this.close();
    SHED_PIECE_IDS.forEach((id, i) => {
      if (!input.wasPressed(`Digit${i + 1}`)) return;
      if (this.armed === id && !this.shed.whyNot(id, this.market.purse)) {
        this.armed = null;
        this.game.buyShedPiece(id);
      } else {
        const why = this.shed.whyNot(id, this.market.purse);
        this.armed = why ? null : id; // a first press only asks; the same number again buys
        if (why) this.game.hud.toast(why, 2.5);
        this.render();
      }
    });
  }

  refresh() {
    if (this.isOpen) this.render();
  }

  buildCard() {
    const el = document.createElement('div');
    el.className = 'classifieds';
    el.style.display = 'none';
    el.innerHTML = '<div class="cl-card"><div class="cl-title">Ashby Workshop Supplies: shed kit</div><div class="cl-purse"></div><div class="cl-body"></div><div class="cl-keys"></div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.purseEl = el.querySelector('.cl-purse');
    this.bodyEl = el.querySelector('.cl-body');
    this.keysEl = el.querySelector('.cl-keys');
  }

  /** What each piece puts right, as a short list for the card. */
  static faultNames(id) {
    return SHED_KINDS.filter((k) => SHED_PIECE_OF[k] === id).map((k) => FAULT_WORDS[k]).join(', ');
  }

  render() {
    const day = this.game.farm.day;
    this.purseEl.textContent = `In the tin: £${this.market.purse.toLocaleString('en-GB')}`;
    const rows = SHED_PIECE_IDS.map((id, i) => {
      const piece = SHED_PIECES[id];
      const price = this.shed.price(id);
      const have = this.shed.has(id, day);
      const coming = this.shed.onTheWay(id, day);
      const why = this.shed.whyNot(id, this.market.purse);
      const row = Object.assign(document.createElement('div'), { className: have || coming || why ? 'cl-ad cl-no' : 'cl-ad' });
      const status = have ? 'In the barn' : coming ? 'Turns up tomorrow morning' : `£${price.toLocaleString('en-GB')}`;
      row.append(
        Object.assign(document.createElement('div'), { textContent: `${i + 1}. ${piece.name}: ${status}` }),
        Object.assign(document.createElement('div'), { className: 'cl-hint', textContent: `${piece.blurb} Fixes: ${ShedView.faultNames(id)}.` }),
        Object.assign(document.createElement('div'), {
          className: 'cl-hint',
          textContent: have || coming ? '' : why ?? (this.armed === id ? `Press ${i + 1} again to buy it. It turns up tomorrow morning.` : 'Press the number to buy it.'),
        }),
      );
      return row;
    });
    this.bodyEl.replaceChildren(...rows);
    this.keysEl.textContent = 'E or G to step back';
  }
}

const FAULT_WORDS = {
  tyreLeak: 'a leaking bead',
  tyreCold: 'tyres shrunk by the cold',
  tyreUneven: 'an uneven tyre',
  valveCore: 'a dud valve core',
  carbGum: 'a gummed carb',
  tapClog: 'a clogged fuel tap',
  chainGrit: 'a gritty chain',
  brakeMud: 'caked brakes',
  exhaustHole: 'a holed silencer',
  gasket: 'a weeping sump gasket',
  caliper: 'a dragging caliper',
  bearing: 'a worn wheel bearing',
};
