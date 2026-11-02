import './rollingRoad.css';
import * as THREE from 'three';
import { barnShape } from './barn.js';
import { stockRpm, slipLines } from '../farm/rollingRoad.js';

// What the rolling road leaves behind: the slip she hands you after a run (a small card that fades by itself, because it is not a screen to
// work in) and the results sheet pinned to the barn's back wall, a graph for each quad that has had a run, to check back on later.

const SHEET_W = 0.66; // metres
const SHEET_H = 0.48;
const PX_W = 660;
const PX_H = 480;

/** The panels on the sheet: the four quads run most recently, latest first. Pure. */
export function sheetPanels(log, nameOf, specOf, count = 4) {
  return log
    .ids()
    .reverse()
    .slice(0, count)
    .map((id) => {
      const run = log.last(id);
      const spec = specOf(id);
      const prev = log.before(id);
      return { id, name: nameOf(id), run, stock: spec?.stockBhp ?? 0, fullRpm: spec ? stockRpm(spec) : 6200, prev, runs: log.runs[id].length };
    });
}

/** The results sheet on the barn wall. `anchor` is where its middle is: { x, y, z } on the west wall, facing out over the barn (+x). */
export class RoadSheet {
  constructor({ game, anchor }) {
    this.game = game;
    const canvas = document.createElement('canvas');
    canvas.width = PX_W;
    canvas.height = PX_H;
    this.canvas = canvas;
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    const group = new THREE.Group();
    group.name = 'rolling-road-sheet';
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W, SHEET_H), new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.9 }));
    paper.rotation.y = Math.PI / 2; // faces +x, out over the barn
    group.add(paper);
    const tape = new THREE.MeshStandardMaterial({ color: 0xd8cfa6, roughness: 0.6, transparent: true, opacity: 0.85 });
    for (const [dz, dy] of [[-SHEET_W / 2 + 0.03, SHEET_H / 2 - 0.01], [SHEET_W / 2 - 0.03, SHEET_H / 2 - 0.01]]) { // a strip of masking tape at each top corner
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.035, 0.09), tape);
      strip.position.set(0.004, dy, dz);
      strip.rotation.x = dz < 0 ? 0.5 : -0.5;
      group.add(strip);
    }
    group.position.set(anchor.x, anchor.y, anchor.z);
    group.visible = false;
    game.scene.add(group);
    this.group = group;
  }

  /** Redraws the sheet from the log and shows it once there is anything on it. */
  refresh(log, nameOf, specOf) {
    const panels = sheetPanels(log, nameOf, specOf);
    this.group.visible = panels.length > 0;
    if (!panels.length) return;
    const g = this.canvas.getContext('2d');
    g.fillStyle = '#ece6d2';
    g.fillRect(0, 0, PX_W, PX_H);
    g.fillStyle = 'rgba(120,100,60,0.05)'; // the paper's grain
    for (let y = 0; y < PX_H; y += 3) g.fillRect(0, y, PX_W, 1);
    g.fillStyle = '#26333d';
    g.font = 'bold 26px Georgia, serif';
    g.textAlign = 'left';
    g.fillText('ROLLING ROAD RESULTS', 24, 40);
    g.font = '15px Georgia, serif';
    g.fillStyle = '#5a5648';
    g.fillText('Power at the rollers. Dashed line: stock.', 24, 62);
    const cols = 2;
    const cw = (PX_W - 24 * 2 - 18) / cols;
    const ch = 188;
    panels.forEach((p, i) => this.drawPanel(g, p, 24 + (i % cols) * (cw + 18), 80 + Math.floor(i / cols) * (ch + 14), cw, ch));
    this.texture.needsUpdate = true;
  }

  drawPanel(g, p, x, y, w, h) {
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(38,51,61,0.35)';
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, w, h);
    g.fillStyle = '#26333d';
    g.font = 'bold 17px Georgia, serif';
    g.textAlign = 'left';
    g.fillText(p.name.replace(/^./, (c) => c.toUpperCase()), x + 8, y + 22);
    // The plot area.
    const px = x + 38;
    const py = y + 34;
    const pw = w - 52;
    const ph = h - 84;
    const top = Math.max(p.stock, p.run.bhp, ...p.run.curve.map((c) => c.bhp), 1) * 1.2;
    const maxRpm = p.fullRpm * 1.15;
    const X = (rpm) => px + (Math.min(rpm, maxRpm) / maxRpm) * pw;
    const Y = (bhp) => py + ph - (Math.max(0, bhp) / top) * ph;
    g.strokeStyle = 'rgba(38,51,61,0.18)';
    for (let k = 0; k <= 4; k++) {
      g.beginPath();
      g.moveTo(px, py + (ph * k) / 4);
      g.lineTo(px + pw, py + (ph * k) / 4);
      g.stroke();
    }
    g.strokeStyle = '#26333d';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px, py + ph);
    g.lineTo(px + pw, py + ph);
    g.stroke();
    g.font = '11px Arial, sans-serif';
    g.fillStyle = '#5a5648';
    g.textAlign = 'right';
    for (const k of [0, 2, 4]) g.fillText(String(Math.round((top * (4 - k)) / 4)), px - 4, py + (ph * k) / 4 + 4);
    g.textAlign = 'center';
    for (let r = 2000; r < maxRpm; r += 2000) g.fillText(`${r / 1000}k`, X(r), py + ph + 13);
    // The stock line, dashed.
    g.setLineDash([5, 4]);
    g.strokeStyle = '#a3231d';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(px, Y(p.stock));
    g.lineTo(px + pw, Y(p.stock));
    g.stroke();
    g.setLineDash([]);
    // The curve of the latest run.
    const pts = p.run.curve.length ? p.run.curve : [{ rpm: p.run.rpm, bhp: p.run.bhp }];
    g.strokeStyle = '#1d4f8f';
    g.lineWidth = 2.5;
    g.beginPath();
    pts.forEach((c, i) => (i ? g.lineTo(X(c.rpm), Y(c.bhp)) : g.moveTo(X(c.rpm), Y(c.bhp))));
    g.stroke();
    g.fillStyle = '#1d4f8f';
    g.beginPath();
    g.arc(X(p.run.rpm), Y(p.run.bhp), 4, 0, Math.PI * 2);
    g.fill();
    // The figures.
    g.textAlign = 'left';
    g.font = 'bold 14px Georgia, serif';
    g.fillStyle = '#26333d';
    const sign = p.run.diff > 0 ? '+' : '';
    g.fillText(`${p.run.bhp.toFixed(1)} bhp at ${p.run.rpm.toLocaleString('en-GB')} rpm`, x + 8, y + h - 24);
    g.font = '13px Georgia, serif';
    g.fillStyle = p.run.diff > 0.5 ? '#2c6a2e' : p.run.diff < -0.5 ? '#a3231d' : '#5a5648';
    const last = p.prev ? ` (last time ${p.prev.bhp.toFixed(1)})` : '';
    g.fillText(`Stock ${p.stock}: ${sign}${p.run.diff.toFixed(1)}${last}`, x + 8, y + h - 8);
  }
}

/** The slip after a run: a card low on the screen that fades by itself. */
export class RoadSlip {
  constructor() {
    const el = document.createElement('div');
    el.className = 'road-slip';
    el.style.display = 'none';
    el.innerHTML = '<div class="rs-card"><div class="rs-title">Rolling road</div><div class="rs-body"></div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.body = el.querySelector('.rs-body');
    this.left = 0;
  }

  get isShown() {
    return this.left > 0;
  }

  show(name, result, previous, seconds = 14) {
    const lines = slipLines(name, result, previous);
    this.body.replaceChildren(...lines.map((t, i) => Object.assign(document.createElement('div'), { textContent: t, className: i === 1 ? 'rs-big' : '' })));
    this.el.style.display = 'block';
    this.left = seconds;
  }

  hide() {
    this.left = 0;
    this.el.style.display = 'none';
  }

  update(dt) {
    if (this.left <= 0) return;
    this.left -= dt;
    if (this.left <= 0) this.hide();
  }
}

/**
 * Where the sheet hangs: on the barn's back (west) wall just past the cork board, beyond the first post between the two spans, at eye height. The wall
 * under the boards is behind the bales, and the boards themselves are full.
 */
export function sheetAnchor(layout, floorY) {
  const shape = barnShape(layout);
  return { x: shape.inner.minX + 0.03, y: floorY + 1.5, z: shape.z + 6.0 };
}
