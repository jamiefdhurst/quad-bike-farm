import './photoBoard.css';
import * as THREE from 'three';
import { barnShape } from '../world/barn.js';

const BOARD_W = 1.3; // metres
const BOARD_H = 1;
const PX_W = 1040; // 800 px a metre, so a 160 px shot is a print about 20 cm across
const PX_H = 800;
const PRINT_W = 220; // pixels: white border included
const PRINT_H = 176;
const PIN_COLOURS = ['#c43a2e', '#2f6fb5', '#e0b42c', '#3f9a4c'];

/**
 * The corkboard in the barn, on the back wall south of the chalkboards: the photos, pinned at random and a little askew, drawn on a canvas
 * that's redrawn when one is added. Look at it and press E for a bigger view (a card of the prints with when they were taken).
 */
export class PhotoBoardView {
  constructor({ game, wall }) {
    this.game = game;
    this.wall = wall;
    const shape = barnShape(game.world.layout);
    const floorY = game.world.heightAt(shape.x, shape.z);
    this.canvas = document.createElement('canvas');
    this.canvas.width = PX_W;
    this.canvas.height = PX_H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    const group = new THREE.Group();
    group.name = 'photo-board';
    const face = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_H), new THREE.MeshStandardMaterial({ map: this.texture, roughness: 1 }));
    face.rotation.y = Math.PI / 2; // front faces +x, out over the yard, like the boards
    group.add(face);
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 0.85 });
    for (const [w, h, dz, dy] of [[BOARD_W + 0.08, 0.04, 0, BOARD_H / 2 + 0.02], [BOARD_W + 0.08, 0.04, 0, -BOARD_H / 2 - 0.02], [0.04, BOARD_H + 0.08, BOARD_W / 2 + 0.02, 0], [0.04, BOARD_H + 0.08, -BOARD_W / 2 - 0.02, 0]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, w), wood);
      bar.position.set(0.005, dy, dz);
      group.add(bar);
    }
    // South of the two chalkboards (z - 2 each side of the calendar), clear of the barn's end wall.
    group.position.set(shape.inner.minX + 0.06, floorY + 1.6, shape.z - 3.65);
    game.scene.add(group);
    this.group = group;
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(0.4, BOARD_H + 0.1, BOARD_W + 0.1), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.copy(group.position);
    game.scene.add(this.proxy);
    this.images = new Map(); // data URL -> a loaded Image
    this.buildCard();
    this.draw();
  }

  get isOpen() {
    return this.el.style.display !== 'none';
  }

  prompt() {
    return this.wall.photos.length ? 'Look at the photos' : 'The corkboard (take a photo with 5)';
  }

  open() {
    this.render();
    this.el.style.display = 'block';
    document.body.classList.add('photoboard-open');
    this.game.player.moveEnabled = false;
  }

  close() {
    this.el.style.display = 'none';
    document.body.classList.remove('photoboard-open');
    this.game.player.moveEnabled = true;
  }

  handleInput(input) {
    this.game.player.moveEnabled = false;
    input.takeWheelSteps();
    if (input.wasPressed('KeyG') || input.wasPressed('KeyE') || input.wasPressed('Escape')) this.close();
  }

  /** A photo was added or the wall was restored. */
  refresh() {
    this.draw();
    if (this.isOpen) this.render();
  }

  /** The Image for a saved shot, decoded once; the board redraws when it has loaded. */
  image(data) {
    let img = this.images.get(data);
    if (!img) {
      img = new Image();
      img.onload = () => this.draw();
      img.src = data;
      this.images.set(data, img);
      if (this.images.size > this.wall.p.maxKept * 2) this.images.delete(this.images.keys().next().value);
    }
    return img;
  }

  draw() {
    const ctx = this.canvas.getContext('2d');
    // Cork: a warm brown with speckles, from a fixed pattern so it does not shimmer when redrawn.
    ctx.fillStyle = '#b08658';
    ctx.fillRect(0, 0, PX_W, PX_H);
    let s = 12345;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(120,80,40,0.35)' : 'rgba(220,180,130,0.3)';
      ctx.fillRect(rnd() * PX_W, rnd() * PX_H, 2 + rnd() * 5, 2 + rnd() * 4);
    }
    if (!this.wall.photos.length) {
      ctx.fillStyle = 'rgba(60,40,20,0.55)';
      ctx.font = 'bold 44px "Comic Sans MS", "Segoe Print", cursive';
      ctx.textAlign = 'center';
      ctx.fillText('Photos go here', PX_W / 2, PX_H / 2);
    }
    for (const ph of this.wall.photos) {
      const cx = ph.x * PX_W;
      const cy = ph.y * PX_H;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ph.tilt);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; // its shadow on the cork
      ctx.fillRect(-PRINT_W / 2 + 5, -PRINT_H / 2 + 6, PRINT_W, PRINT_H);
      ctx.fillStyle = '#f6f2e8';
      ctx.fillRect(-PRINT_W / 2, -PRINT_H / 2, PRINT_W, PRINT_H);
      const img = this.image(ph.data);
      const iw = PRINT_W - 16;
      const ih = Math.round(iw / 1.6);
      if (img.complete && img.naturalWidth) ctx.drawImage(img, -iw / 2, -PRINT_H / 2 + 8, iw, ih);
      else {
        ctx.fillStyle = '#777';
        ctx.fillRect(-iw / 2, -PRINT_H / 2 + 8, iw, ih);
      }
      ctx.fillStyle = '#3a3a3a';
      ctx.font = '19px "Comic Sans MS", "Segoe Print", cursive';
      ctx.textAlign = 'center';
      ctx.fillText(`Day ${ph.day}`, 0, PRINT_H / 2 - 7);
      ctx.fillStyle = PIN_COLOURS[ph.pin % PIN_COLOURS.length];
      ctx.beginPath();
      ctx.arc(0, -PRINT_H / 2 + 5, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(-3, -PRINT_H / 2 + 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    this.texture.needsUpdate = true;
  }

  buildCard() {
    const el = document.createElement('div');
    el.className = 'photoboard';
    el.style.display = 'none';
    el.innerHTML = '<div class="pb-card"><div class="pb-title">The corkboard</div><div class="pb-grid"></div><div class="pb-keys">E or G to step back</div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.gridEl = el.querySelector('.pb-grid');
  }

  /** Caption for a print: when, and who is in it. */
  static caption(ph, names) {
    const who = ph.girls.length ? ph.girls.map((g) => names[g] ?? g).join(' and ') : 'just you';
    return `Day ${ph.day}, ${ph.time}: ${who}`;
  }

  render() {
    const names = Object.fromEntries(this.game.companions.map((c) => [c.character.id, c.character.name]));
    const prints = [...this.wall.photos].reverse().map((ph) => {
      const div = document.createElement('div');
      div.className = 'pb-print';
      const img = document.createElement('img');
      img.src = ph.data;
      const cap = document.createElement('div');
      cap.textContent = PhotoBoardView.caption(ph, names);
      div.append(img, cap);
      return div;
    });
    this.gridEl.replaceChildren(...(prints.length ? prints : [Object.assign(document.createElement('div'), { textContent: 'Nothing pinned yet. Press 5 to take a photo.' })]));
  }
}
