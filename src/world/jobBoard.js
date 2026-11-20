import './jobBoard.css';
import * as THREE from 'three';
import { barnShape, placeInBarn } from './barn.js';
import { boardFont } from './boardFont.js';

const BOARD_W = 1.5; // metres
const BOARD_H = 1.3; // tall enough for the five records with room to spare
const BOARD_PX_W = 512;
const BOARD_PX_H = 444; // the same chalk-per-metre as the width
const RECORDS_FIRST = 112; // the first record's baseline, under the heading's underline
const RECORDS_PITCH = 56; // the most room a record line gets, in pixels; the more lines, the closer they sit
const RECORDS_LAST = BOARD_PX_H - 24; // the lowest a baseline may sit, clear of the frame

/** Baselines for a table of `count` records, one line each, evenly spaced between the heading and the foot of the board. */
export function recordRowYs(count) {
  const pitch = count > 1 ? Math.min(RECORDS_PITCH, (RECORDS_LAST - RECORDS_FIRST) / (count - 1)) : 0;
  return Array.from({ length: count }, (_, i) => RECORDS_FIRST + i * pitch);
}

/**
 * The chalkboards hung inside the barn on its back wall: today's farm jobs (farmJobs.js JobBoard), ticked off in chalk as they're done. Look at it
 * and press E for a close view (the card), the same way as Amy's logbook. The prop is drawn on a canvas that's redrawn when the list changes.
 */
export class JobBoardView {
  constructor({ game, board, records, challenges }) {
    this.game = game;
    this.board = board;
    this.records = records;
    this.challenges = challenges;
    const shape = barnShape(game.world.layout);
    const floorY = game.world.heightAt(shape.x, shape.z);
    // Both boards hang inside, on the back (west) wall, side by side: the jobs to the south, the records to the north. The backing is 1 cm off
    // the plaster, and each layer in front of it 2 cm clear of the last.
    const x = shape.inner.minX + 0.06;
    const y = floorY + 1.75;
    this.jobs = this.hangBoard(x, y, shape.z - 2);
    this.recordsBoard = this.hangBoard(x, y, shape.z + 2);
    this.canvas = this.jobs.canvas;
    this.proxy = this.jobs.proxy;
    this.recordsProxy = this.recordsBoard.proxy;
    this.buildCard();
    this.draw();
  }

  /** One board on the wall: a chalk-dusted slate on a backing slab in a wood frame, drawn on a canvas, with its invisible target for E. */
  hangBoard(x, y, z) {
    const canvas = document.createElement('canvas');
    canvas.width = BOARD_PX_W;
    canvas.height = BOARD_PX_H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const group = new THREE.Group();
    group.name = 'job-board';
    const face = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_H), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
    face.rotation.y = Math.PI / 2; // the plane's front faces +x, out over the yard
    group.add(face);
    const backing = new THREE.Mesh(new THREE.BoxGeometry(0.02, BOARD_H + 0.08, BOARD_W + 0.08), new THREE.MeshStandardMaterial({ color: 0x2b3330, roughness: 0.9 }));
    backing.position.x = -0.025;
    group.add(backing);
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 0.85 });
    for (const [w, h, dx, dy] of [[BOARD_W + 0.08, 0.04, 0, BOARD_H / 2 + 0.02], [BOARD_W + 0.08, 0.04, 0, -BOARD_H / 2 - 0.02], [0.04, BOARD_H + 0.08, BOARD_W / 2 + 0.02, 0], [0.04, BOARD_H + 0.08, -BOARD_W / 2 - 0.02, 0]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, w), wood);
      bar.position.set(0.005, dy, dx);
      group.add(bar);
    }
    placeInBarn(this.game.world.layout, group, x, y, z);
    this.game.scene.add(group);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.4, BOARD_H + 0.1, BOARD_W + 0.1), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.copy(group.position);
    proxy.quaternion.copy(group.quaternion);
    this.game.scene.add(proxy);
    return { canvas, texture, group, proxy };
  }

  get isOpen() {
    return this.el.style.display !== 'none';
  }

  prompt() {
    return "Read today's jobs";
  }

  recordsPrompt() {
    return 'Read the records';
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
    // A challenge closes the card first, so its toast isn't half behind it.
    if (input.wasPressed('Digit1')) {
      this.close();
      this.game.startColdStart();
    } else if (input.wasPressed('Digit2')) {
      this.close();
      this.game.judgeLineUp();
    }
    if (input.wasPressed('KeyB') || input.wasPressed('Escape')) this.close();
  }

  /** The list changed (a job done) or a record was set: redraw the boards and the card. */
  refresh() {
    this.draw();
    this.drawRecords();
    if (this.isOpen) this.render();
  }

  /** A slate wiped and dusted, with its heading and underline in chalk; returns the context and the canvas size. */
  slate(board, heading, underline) {
    const ctx = board.canvas.getContext('2d');
    const { width: w, height: h } = board.canvas;
    ctx.fillStyle = '#2b3330';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; // smeared chalk dust
    for (let i = 0; i < 6; i++) ctx.fillRect(20 + i * 70, 30 + ((i * 53) % 200), 160, 26);
    ctx.fillStyle = '#ece8d8';
    ctx.font = boardFont('board', 40, 'bold');
    ctx.fillText(heading, 28, 58);
    ctx.fillRect(28, 68, underline, 3);
    ctx.font = boardFont('board', 28);
    return { ctx, w, h };
  }

  /** The records board: a table of the game's bests in chalk, one line each, the event on the left and the time and who set it on the right. */
  drawRecords() {
    const { ctx, w } = this.slate(this.recordsBoard, 'RECORDS', 230);
    const rows = this.records.allLines();
    const ys = recordRowYs(rows.length);
    rows.forEach((l, i) => {
      ctx.font = boardFont('board', 24);
      ctx.textAlign = 'right';
      ctx.fillStyle = l.set ? '#f3d98a' : 'rgba(236,232,216,0.45)';
      ctx.fillText(l.text, w - 28, ys[i]);
      const room = w - 56 - ctx.measureText(l.text).width - 16; // what the value leaves for the event's name
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ece8d8';
      ctx.font = boardFont('board', 22);
      ctx.fillText(l.label, 28, ys[i], Math.max(room, 60));
    });
    ctx.textAlign = 'left';
    this.recordsBoard.texture.needsUpdate = true;
  }

  draw() {
    const { ctx, w } = this.slate(this.jobs, 'TODAY', 190);
    this.drawRecords();
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
    this.jobs.texture.needsUpdate = true;
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
    el.innerHTML = '<div class="jb-card"><div class="jb-title">Today\'s jobs</div><div class="jb-body"></div><div class="jb-title jb-records-title">Records</div><div class="jb-records"></div><div class="jb-title jb-records-title">Challenges</div><div class="jb-records jb-challenges"></div><div class="jb-keys">1 starts the cold-start clock, 2 judges the line-up. B to step back</div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.bodyEl = el.querySelector('.jb-body');
    this.recordsEl = el.querySelector('.jb-records');
    this.challengesEl = el.querySelector('.jb-challenges');
  }

  render() {
    const rows = this.board.lines().map((l) => {
      const row = document.createElement('div');
      row.className = l.done ? 'jb-job jb-done' : 'jb-job';
      const name = Object.assign(document.createElement('div'), { textContent: `${l.done ? '✓ ' : ''}${l.text}` });
      row.append(name, Object.assign(document.createElement('div'), { className: 'jb-hint', textContent: l.done ? 'Done.' : l.hint }));
      return row;
    });
    this.recordsEl.replaceChildren(
      ...this.records.allLines().map((l) => {
        const row = Object.assign(document.createElement('div'), { className: l.set ? 'jb-record' : 'jb-record jb-unset' });
        row.append(Object.assign(document.createElement('span'), { textContent: l.label }), Object.assign(document.createElement('span'), { textContent: l.text }));
        return row;
      }),
    );
    const cold = this.game.coldRun;
    this.challengesEl.replaceChildren(
      ...this.challenges.lines().flatMap((l) => {
        const row = Object.assign(document.createElement('div'), { className: l.set ? 'jb-record' : 'jb-record jb-unset' });
        const live = l.kind === 'coldStart' && cold.active ? `  (running: ${Math.floor(cold.time)} s, ${cold.left.size} left)` : '';
        row.append(Object.assign(document.createElement('span'), { textContent: l.label, title: l.blurb }), Object.assign(document.createElement('span'), { textContent: l.text + live }));
        return [row, Object.assign(document.createElement('div'), { className: 'jb-hint', textContent: l.blurb })];
      }),
    );
    this.bodyEl.replaceChildren(...(rows.length ? rows : [Object.assign(document.createElement('div'), { textContent: 'Nothing on today.' })]));
  }
}
