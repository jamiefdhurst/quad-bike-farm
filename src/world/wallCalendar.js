import * as THREE from 'three';
import { barnShape } from './barn.js';

const CAL_W = 0.9; // metres
const CAL_H = 1.2;
const PX_W = 384; // the same paper-per-metre both ways
const PX_H = 512;

export const DAYS_PER_PAGE = 30;
export const PAGE_COLUMNS = 7;
// The farm starts in April, when there is plenty to do. A page is thirty days, so the months are the farm's own, not the real ones.
export const MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
export const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * The page of the calendar for a farm day (1 is the first day on the farm): its month, the farm's year, and a cell for each day with
 * whether it is gone (crossed off), today (circled) or still to come. A new page turns over after DAYS_PER_PAGE days. Pure, tested.
 */
export function calendarPage(day) {
  const d = Math.max(1, Math.floor(day) || 1);
  const page = Math.floor((d - 1) / DAYS_PER_PAGE);
  const first = page * DAYS_PER_PAGE;
  const cells = [];
  for (let i = 0; i < DAYS_PER_PAGE; i++) {
    const n = first + i + 1;
    cells.push({ n, label: i + 1, state: n < d ? 'past' : n === d ? 'today' : 'future', column: i % PAGE_COLUMNS, row: Math.floor(i / PAGE_COLUMNS) });
  }
  return { month: MONTHS[page % MONTHS.length], year: 1 + Math.floor(page / MONTHS.length), page, cells };
}

/**
 * A wall calendar on the barn's back wall, between the jobs board and the records board: a funny picture across the top and the month
 * under it, with each day gone crossed off in red and today circled. Drawn on a canvas once, when the barn is built (the day does not
 * change while it is loaded). Nothing to press: you read it from where you stand.
 */
export class WallCalendar {
  constructor({ game, day }) {
    this.game = game;
    const shape = barnShape(game.world.layout);
    const floorY = game.world.heightAt(shape.x, shape.z);
    this.canvas = document.createElement('canvas');
    this.canvas.width = PX_W;
    this.canvas.height = PX_H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const group = new THREE.Group();
    group.name = 'wall-calendar';
    const face = new THREE.Mesh(new THREE.PlaneGeometry(CAL_W, CAL_H), new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.95 }));
    face.rotation.y = Math.PI / 2; // front faces +x, out over the yard, like the boards
    group.add(face);
    // A nail and a strip of card behind it, so it hangs off the wall rather than being painted on.
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.01, CAL_H + 0.03, CAL_W + 0.03), new THREE.MeshStandardMaterial({ color: 0x8a7b5c, roughness: 0.9 }));
    card.position.x = -0.012;
    group.add(card);
    const nail = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 8), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6, roughness: 0.5 }));
    nail.rotation.z = Math.PI / 2;
    nail.position.set(0.012, CAL_H / 2 - 0.02, 0);
    group.add(nail);
    // Level with the boards' middle; the boards' backing is 1 cm off the plaster, this is the same.
    group.position.set(shape.inner.minX + 0.06, floorY + 1.75, shape.z);
    game.scene.add(group);
    this.group = group;
    this.draw(day);
  }

  draw(day) {
    const page = calendarPage(day);
    const ctx = this.canvas.getContext('2d');
    ctx.fillStyle = '#f4efe0';
    ctx.fillRect(0, 0, PX_W, PX_H);
    this.picture(ctx, 0, 0, PX_W, 210);

    ctx.fillStyle = '#2b2b2b';
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px "Comic Sans MS", "Segoe Print", cursive';
    ctx.fillText(page.year > 1 ? `${page.month}, year ${page.year}` : page.month, PX_W / 2, 262);
    ctx.font = 'bold 22px "Comic Sans MS", "Segoe Print", cursive';
    const colW = PX_W / PAGE_COLUMNS;
    const left = colW / 2;
    WEEKDAYS.forEach((w, i) => {
      ctx.fillStyle = i >= 5 ? '#a33' : '#555';
      ctx.fillText(w, left + i * colW, 296);
    });
    const rowH = 38;
    const top = 330;
    for (const c of page.cells) {
      const x = left + c.column * colW;
      const y = top + c.row * rowH;
      if (c.state === 'today') {
        ctx.fillStyle = 'rgba(255, 214, 80, 0.55)';
        ctx.fillRect(x - colW / 2 + 3, y - 27, colW - 6, rowH - 4);
      }
      ctx.fillStyle = c.state === 'past' ? '#777' : '#222';
      ctx.font = `${c.state === 'today' ? 'bold ' : ''}24px "Comic Sans MS", "Segoe Print", cursive`;
      ctx.fillText(String(c.label), x, y);
      ctx.strokeStyle = '#c0281c';
      ctx.lineCap = 'round';
      if (c.state === 'past') {
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(x - 17, y - 26);
        ctx.lineTo(x + 17, y + 5);
        ctx.moveTo(x + 17, y - 26);
        ctx.lineTo(x - 17, y + 5);
        ctx.stroke();
      } else if (c.state === 'today') {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, y - 10, 21, 19, -0.15, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.textAlign = 'start';
    this.texture.needsUpdate = true;
  }

  /** Sheep of the month: a woolly sheep in sunglasses, a bit too pleased with itself. */
  picture(ctx, x0, y0, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, w, h);
    ctx.clip();
    const sky = ctx.createLinearGradient(0, y0, 0, y0 + h);
    sky.addColorStop(0, '#8ec5e8');
    sky.addColorStop(1, '#cfe8f2');
    ctx.fillStyle = sky;
    ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = '#6fae52'; // the field
    ctx.fillRect(x0, y0 + h - 50, w, 50);
    const cx = x0 + w / 2;
    const cy = y0 + h - 82;
    // legs
    ctx.fillStyle = '#2a2a2a';
    for (const dx of [-42, -18, 22, 46]) ctx.fillRect(cx + dx - 5, cy + 30, 10, 42);
    // wool: a cloud of circles
    ctx.fillStyle = '#fbfaf4';
    ctx.strokeStyle = '#d8d4c4';
    ctx.lineWidth = 2;
    for (const [dx, dy, r] of [[-62, 4, 30], [-34, -20, 34], [4, -28, 36], [42, -16, 34], [64, 8, 30], [34, 28, 32], [-6, 32, 34], [-38, 28, 30], [10, 0, 38]]) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath(); // fill the seams
    ctx.arc(cx + 2, cy + 6, 46, 0, Math.PI * 2);
    ctx.fill();
    // head, to the left, with a tuft
    const hx = cx - 78;
    const hy = cy - 4;
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.ellipse(hx, hy, 24, 29, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hx - 24, hy - 14, 14, 7, -0.6, 0, Math.PI * 2); // ear
    ctx.fill();
    ctx.fillStyle = '#fbfaf4';
    ctx.beginPath();
    ctx.arc(hx + 2, hy - 28, 14, 0, Math.PI * 2);
    ctx.fill();
    // sunglasses
    ctx.fillStyle = '#000';
    ctx.fillRect(hx - 22, hy - 10, 22, 13);
    ctx.fillRect(hx + 2, hy - 10, 22, 13);
    ctx.fillRect(hx - 2, hy - 8, 6, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(hx - 18, hy - 8, 6, 3);
    ctx.fillRect(hx + 6, hy - 8, 6, 3);
    // a wide grin
    ctx.strokeStyle = '#f4efe0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hx, hy + 8, 13, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // caption
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(x0 + w - 190, y0 + 10, 180, 44);
    ctx.fillStyle = '#7a1f1f';
    ctx.font = 'bold 21px "Comic Sans MS", "Segoe Print", cursive';
    ctx.textAlign = 'center';
    ctx.fillText('SHEEP OF', x0 + w - 100, y0 + 30);
    ctx.fillText('THE MONTH', x0 + w - 100, y0 + 49);
    ctx.restore();
  }
}
