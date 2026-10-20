import './classifieds.css';
import * as THREE from 'three';
import { barnShape } from './barn.js';

const BOARD_W = 1.2; // metres
const BOARD_H = 1.1;
const PX_W = 480;
const PX_H = 440; // the same scrap-per-metre as the width
const SLIP_H = 118; // a pinned slip, in pixels
const SLIPS = 3;

/**
 * The cork board of classified ads at the back of the barn (farm/classifieds.js Market): a card for sale from the neighbours, pinned up on the
 * odd day. Most days it is bare. Look at it and press E for a close view, where 1 to 3 buy the ad (it turns up tomorrow). Drawn on a canvas, redrawn
 * when an ad goes or the purse changes.
 */
export class ClassifiedsView {
  constructor({ game, market }) {
    this.game = game;
    this.market = market;
    const shape = barnShape(game.world.layout);
    const floorY = game.world.heightAt(shape.x, shape.z);
    // On the back (west) wall beside the chalkboards, the photo board and the calendar, 2 cm clear of the plaster.
    const canvas = document.createElement('canvas');
    canvas.width = PX_W;
    canvas.height = PX_H;
    this.canvas = canvas;
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const group = new THREE.Group();
    group.name = 'classifieds-board';
    const face = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_H), new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.95 }));
    face.rotation.y = Math.PI / 2; // the plane's front faces +x, out over the yard
    group.add(face);
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 0.85 });
    for (const [w, h, dz, dy] of [[BOARD_W + 0.08, 0.04, 0, BOARD_H / 2 + 0.02], [BOARD_W + 0.08, 0.04, 0, -BOARD_H / 2 - 0.02], [0.04, BOARD_H + 0.08, BOARD_W / 2 + 0.02, 0], [0.04, BOARD_H + 0.08, -BOARD_W / 2 - 0.02, 0]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, w), wood);
      bar.position.set(0.005, dy, dz);
      group.add(bar);
    }
    group.position.set(shape.inner.minX + 0.06, floorY + 1.7, shape.z + 3.75);
    game.scene.add(group);
    this.group = group;
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(0.4, BOARD_H + 0.1, BOARD_W + 0.1), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.copy(group.position);
    game.scene.add(this.proxy);
    this.buildCard();
    this.draw();
  }

  get isOpen() {
    return this.el.style.display !== 'none';
  }

  prompt() {
    return this.market.ads.length ? 'Read the ads for sale' : 'Read the ads (nothing today)';
  }

  open() {
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
    for (let i = 0; i < SLIPS; i++) if (input.wasPressed(`Digit${i + 1}`) && this.market.ads[i]) this.game.buyAd(this.market.ads[i]);
  }

  /** The board changed (an ad bought, a new day dealt, the purse moved): redraw it and the card. */
  refresh() {
    this.draw();
    if (this.isOpen) this.render();
  }

  draw() {
    const ctx = this.canvas.getContext('2d');
    ctx.fillStyle = '#a9794a'; // cork
    ctx.fillRect(0, 0, PX_W, PX_H);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(90,58,30,0.35)' : 'rgba(210,170,120,0.35)';
      ctx.fillRect((i * 97) % PX_W, (i * 53) % PX_H, 4 + (i % 3), 3);
    }
    const ads = this.market.ads;
    if (!ads.length) {
      // Bare cork with the pins left in it and a faded corner where a slip hung.
      ctx.fillStyle = 'rgba(80,50,25,0.25)';
      ctx.fillRect(40, 60, 160, 110);
      ctx.fillStyle = '#c0392b';
      for (const [x, y] of [[120, 64], [330, 250], [60, 330]]) {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ads.slice(0, SLIPS).forEach((ad, i) => {
      const y = 14 + i * (SLIP_H + 8);
      const tilt = (i % 2 ? 1 : -1) * 0.012;
      ctx.save();
      ctx.translate(PX_W / 2, y + SLIP_H / 2);
      ctx.rotate(tilt);
      ctx.fillStyle = i % 2 ? '#f3efd8' : '#e9eef2';
      ctx.fillRect(-PX_W / 2 + 24, -SLIP_H / 2, PX_W - 48, SLIP_H);
      ctx.fillStyle = '#1d1d1d';
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillText('FOR SALE', -PX_W / 2 + 40, -SLIP_H / 2 + 30);
      ctx.font = '19px "Courier New", monospace';
      this.wrap(ctx, ad.text, -PX_W / 2 + 40, -SLIP_H / 2 + 56, PX_W - 100, 23);
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(0, -SLIP_H / 2 + 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    this.texture.needsUpdate = true;
  }

  wrap(ctx, text, x, y, maxWidth, lineHeight) {
    let line = '';
    let row = 0;
    for (const word of text.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y + row * lineHeight);
        line = word;
        row += 1;
      } else line = test;
    }
    ctx.fillText(line, x, y + row * lineHeight);
  }

  buildCard() {
    const el = document.createElement('div');
    el.className = 'classifieds';
    el.style.display = 'none';
    el.innerHTML = '<div class="cl-card"><div class="cl-title">For sale</div><div class="cl-purse"></div><div class="cl-body"></div><div class="cl-keys"></div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.purseEl = el.querySelector('.cl-purse');
    this.bodyEl = el.querySelector('.cl-body');
    this.keysEl = el.querySelector('.cl-keys');
  }

  render() {
    const m = this.market;
    this.purseEl.textContent = `In the tin: £${m.purse.toLocaleString('en-GB')}`;
    const rows = m.ads.slice(0, SLIPS).map((ad, i) => {
      const why = m.whyNot(ad);
      const row = Object.assign(document.createElement('div'), { className: why ? 'cl-ad cl-no' : 'cl-ad' });
      row.append(
        Object.assign(document.createElement('div'), { textContent: `${i + 1}. ${ad.text}` }),
        Object.assign(document.createElement('div'), { className: 'cl-hint', textContent: why ?? 'Press the number to buy it. It turns up tomorrow.' }),
      );
      return row;
    });
    const bought = m.bought.length ? `On the way or bought: ${m.bought.length}` : '';
    this.bodyEl.replaceChildren(...(rows.length ? rows : [Object.assign(document.createElement('div'), { textContent: 'Nothing for sale today.' })]));
    this.keysEl.textContent = `${bought}${bought ? '   ·   ' : ''}E or G to step back`;
  }
}
