import '../world/classifieds.css';
import * as THREE from 'three';
import { SHED_PIECES, SHED_PIECE_IDS } from '../farm/shed.js';
import { SHED_KINDS, SHED_PIECE_OF } from '../vehicle/shedFaults.js';
import { buildCatalogue, buildCompressor, buildWasher, buildPit } from './shedModels.js';
import { pitHoleRect, NO_HOLE } from './pitHole.js';

const FLOOR_TOP = 0.011;
const PIT_LAMP_GLOW = 0.7; // the pit lamps' emissive intensity while the generator runs

/**
 * The barn's shed kit (farm/shed.js): the catalogue lying on the workbench, and the compressor, the parts washer and the pit that
 * stand in the barn the morning after they are paid for. Look at the catalogue and press E for the card: 1 to 3 buy a piece from the tin.
 * What stands in the barn is decided when the day loads, since a piece turns up overnight.
 */
export class ShedView {
  constructor({ game, shed, market }) {
    this.game = game;
    this.shed = shed;
    this.market = market;
    const L = game.world.layout;
    const heightAt = (x, z) => game.world.heightAt(x, z);
    // The catalogue lying on the workbench's front edge, cover up with its top to the wall, where you stand to work.
    const cat = buildCatalogue();
    const spot = L.shed.catalogue;
    cat.group.position.set(spot.x, heightAt(spot.x, spot.z) + L.bench.height + 0.004, spot.z);
    cat.group.rotation.y = spot.yaw;
    game.scene.add(cat.group);
    this.catalogue = cat.group;
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(cat.size.x, 0.1, cat.size.z), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.copy(cat.group.position);
    this.proxy.position.y += 0.03;
    this.proxy.rotation.y = spot.yaw;
    game.scene.add(this.proxy);
    // The pieces, built once and shown only if they have been delivered.
    this.pieces = {};
    const day = game.farm.day;
    for (const [id, build] of [['compressor', buildCompressor], ['washer', buildWasher], ['pit', () => buildPit(L.shed.pit)]]) {
      const at = L.shed[id];
      const built = build();
      const y = heightAt(at.x, at.z) + FLOOR_TOP; // the barn's slab stands this far above the ground (barnBuild.js), which the pit's flat parts must clear
      built.group.position.set(at.x, y, at.z);
      built.group.rotation.y = at.yaw ?? 0;
      built.group.visible = shed.has(id, day);
      game.scene.add(built.group);
      this.pieces[id] = { ...built, collider: null };
    }
    this.cutPit(this.standing('pit'));
    this.armed = null;
    this.buildCard();
  }

  /** The pit is a hole in the floor while it stands: the barn's slab has the opening, so the plug that fills it goes and the drawn ground under it is cut away. */
  cutPit(on) {
    const plug = this.game.world.props?.barn?.pitPlug;
    if (plug) plug.visible = !on;
    this.game.world.terrain?.pitHole?.set(...(on ? pitHoleRect(this.game.world.layout.shed.pit) : NO_HOLE));
  }

  /** The pit's lamps burn off the generator, like the barn's bulbs (game.js). */
  setLamps(lit) {
    const lamp = this.pieces.pit?.lamp;
    if (lamp) lamp.emissiveIntensity = lit ? PIT_LAMP_GLOW : 0;
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
    if (id === 'pit') this.cutPit(on);
    if (on && !p.collider && id !== 'pit') this.addCollider(id, p);
  }

  /** Compressor and washer cannot be walked or driven through. The pit has none: you and the girls cross it at floor level (the ground is one heightfield, which cannot be cut), so the cover is a look, not a floor. */
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
    if (input.wasPressed('KeyB') || input.wasPressed('Escape')) return this.close();
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
    this.keysEl.textContent = 'B to step back';
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
