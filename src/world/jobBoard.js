import './jobBoard.css';
import * as THREE from 'three';
import { barnShape } from './barn.js';

/**
 * The chalkboard hung on the barn's sliding door: today's farm jobs (farmJobs.js JobBoard), ticked off in chalk as they're done. Look at it
 * and press E for a close view (the card), the same way as Amy's logbook. The prop is drawn on a canvas that's redrawn when the list changes.
 */
export class JobBoardView {
  constructor({ game, board }) {
    this.game = game;
    this.board = board;
    const shape = barnShape(game.world.layout);
    const floorY = game.world.heightAt(shape.x, shape.z);
    // The sliding door leaf nearer the first wall segment (barnBuild.js hangs it 0.25 m out from the wall, 0.06 thick).
    const door = shape.door;
    const x = door.x + 0.25 + 0.03 + 0.012;
    const z = door.minZ - 1.2;
    const y = floorY + 1.6;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 340;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const group = new THREE.Group();
    group.name = 'job-board';
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1), new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.9 }));
    face.rotation.y = Math.PI / 2; // the plane's front faces +x, out over the yard
    group.add(face);
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 0.85 });
    for (const [w, h, dx, dy] of [[1.58, 0.04, 0, 0.52], [1.58, 0.04, 0, -0.52], [0.04, 1.08, 0.77, 0], [0.04, 1.08, -0.77, 0]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, w), wood);
      bar.position.set(0.005, dy, dx);
      group.add(bar);
    }
    group.position.set(x, y, z);
    game.scene.add(group);
    this.group = group;
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 1.6), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.copy(group.position);
    game.scene.add(this.proxy);
    this.buildCard();
    this.draw();
  }

  get isOpen() {
    return this.el.style.display !== 'none';
  }

  prompt() {
    return "Read today's jobs";
  }

  open() {
    this.render();
    this.el.style.display = 'block';
    document.body.classList.add('jobboard-open');
    this.game.player.moveEnabled = false;
  }

  close() {
    this.el.style.display = 'none';
    document.body.classList.remove('jobboard-open');
    this.game.player.moveEnabled = true;
  }

  handleInput(input) {
    this.game.player.moveEnabled = false;
    input.takeWheelSteps();
    if (input.wasPressed('KeyG') || input.wasPressed('KeyE') || input.wasPressed('Escape')) this.close();
  }

  /** The list changed (a job done): redraw the board and the card. */
  refresh() {
    this.draw();
    if (this.isOpen) this.render();
  }

  draw() {
    const ctx = this.canvas.getContext('2d');
    const { width: w, height: h } = this.canvas;
    ctx.fillStyle = '#2b3330';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; // smeared chalk dust
    for (let i = 0; i < 6; i++) ctx.fillRect(20 + i * 70, 30 + ((i * 53) % 200), 160, 26);
    ctx.fillStyle = '#ece8d8';
    ctx.font = 'bold 40px "Comic Sans MS", "Segoe Print", cursive';
    ctx.fillText('TODAY', 28, 58);
    ctx.fillRect(28, 68, 190, 3);
    ctx.font = '28px "Comic Sans MS", "Segoe Print", cursive';
    const lines = this.board.lines();
    if (!lines.length) ctx.fillText('Nothing on. Put the kettle on.', 28, 130);
    lines.forEach((l, i) => {
      const y = 130 + i * 90;
      ctx.fillText(`${i + 1}.`, 28, y);
      this.wrap(ctx, l.text, 70, y, w - 110, 34);
      if (l.done) {
        ctx.strokeStyle = '#8fd694';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(w - 60, y - 24);
        ctx.lineTo(w - 44, y - 4);
        ctx.lineTo(w - 14, y - 44);
        ctx.stroke();
      }
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
    el.className = 'jobboard';
    el.style.display = 'none';
    el.innerHTML = '<div class="jb-card"><div class="jb-title">Today\'s jobs</div><div class="jb-body"></div><div class="jb-keys">E or G to step back</div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.bodyEl = el.querySelector('.jb-body');
  }

  render() {
    const rows = this.board.lines().map((l) => {
      const row = document.createElement('div');
      row.className = l.done ? 'jb-job jb-done' : 'jb-job';
      const name = Object.assign(document.createElement('div'), { textContent: `${l.done ? '✓ ' : ''}${l.text}` });
      row.append(name, Object.assign(document.createElement('div'), { className: 'jb-hint', textContent: l.done ? 'Done.' : l.hint }));
      return row;
    });
    this.bodyEl.replaceChildren(...(rows.length ? rows : [Object.assign(document.createElement('div'), { textContent: 'Nothing on today.' })]));
  }
}
