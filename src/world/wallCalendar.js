import * as THREE from 'three';
import { barnShape } from './barn.js';
import { MONTH_DAYS } from './seasons.js';

const CAL_W = 0.9; // metres
const CAL_H = 1.2;
const PX_W = 384; // the same paper-per-metre both ways
const PX_H = 512;

export const PAGE_COLUMNS = 7;
export const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * The page of the calendar for a farm date (`farmDate` in seasons.js): the month's real days under the weekdays, each with whether it is
 * gone (crossed off), today (circled) or still to come, and the month's name and the farm's year. Pure, tested.
 */
export function calendarPage(date) {
  const first = (((date.weekday - (date.dom - 1)) % 7) + 7) % 7; // the column the 1st falls in
  const cells = [];
  for (let i = 0; i < MONTH_DAYS[date.month]; i++) {
    const label = i + 1;
    cells.push({ n: label, label, state: label < date.dom ? 'past' : label === date.dom ? 'today' : 'future', column: (first + i) % PAGE_COLUMNS, row: Math.floor((first + i) / PAGE_COLUMNS) });
  }
  return { month: date.monthName, year: date.year, page: date.month, cells };
}

/** Miss Mudguard: the sort of pin-up that hung in every garage, a 1950s cartoon in dungarees leaning on a stack of tyres, winking, spanner in hand. */
function missMudguard(ctx, x0, y0, w, h) {
  const bg = ctx.createLinearGradient(0, y0, 0, y0 + h);
  bg.addColorStop(0, '#f2c75c');
  bg.addColorStop(1, '#e8884a');
  ctx.fillStyle = bg;
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; // sunburst
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.42, y0 + h * 0.55);
    ctx.arc(x0 + w * 0.42, y0 + h * 0.55, 400, (i * Math.PI) / 6, (i * Math.PI) / 6 + Math.PI / 12);
    ctx.fill();
  }
  // tyres
  ctx.fillStyle = '#222';
  for (const [tx, ty] of [[x0 + w * 0.62, y0 + h - 22], [x0 + w * 0.62, y0 + h - 62], [x0 + w * 0.82, y0 + h - 22]]) {
    ctx.beginPath();
    ctx.ellipse(tx, ty, 46, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.ellipse(tx, ty, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
  }
  const cx = x0 + w * 0.36;
  const top = y0 + 24;
  // legs and boots
  ctx.fillStyle = '#2d5b9a';
  ctx.fillRect(cx - 24, top + 118, 20, 66);
  ctx.fillRect(cx + 6, top + 118, 20, 66);
  ctx.fillStyle = '#7a1f1f';
  ctx.fillRect(cx - 28, top + 180, 28, 12);
  ctx.fillRect(cx + 4, top + 180, 30, 12);
  // body: a spotted top under the dungaree bib
  ctx.fillStyle = '#c0281c';
  ctx.beginPath();
  ctx.ellipse(cx, top + 82, 36, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  for (const [dx, dy] of [[-18, 62], [10, 56], [-4, 82], [20, 84], [-24, 98], [2, 104]]) {
    ctx.beginPath();
    ctx.arc(cx + dx, top + dy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#2d5b9a';
  ctx.fillRect(cx - 28, top + 96, 56, 30);
  ctx.fillRect(cx - 22, top + 76, 18, 24); // bib
  ctx.fillRect(cx - 26, top + 54, 6, 28); // one strap up, one down
  // arm up with the spanner
  ctx.strokeStyle = '#f0c8a0';
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + 30, top + 66);
  ctx.lineTo(cx + 62, top + 40);
  ctx.lineTo(cx + 58, top + 6);
  ctx.stroke();
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx + 58, top + 6);
  ctx.lineTo(cx + 58, top - 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 58, top - 18, 8, 0.4 * Math.PI, 2.6 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = '#f0c8a0';
  ctx.lineWidth = 10;
  ctx.beginPath(); // other hand on the hip
  ctx.moveTo(cx - 32, top + 68);
  ctx.lineTo(cx - 46, top + 96);
  ctx.lineTo(cx - 28, top + 108);
  ctx.stroke();
  // head: victory rolls and a headscarf
  ctx.fillStyle = '#5a2e14';
  ctx.beginPath();
  ctx.arc(cx - 22, top + 6, 13, 0, Math.PI * 2);
  ctx.arc(cx + 22, top + 6, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.ellipse(cx, top + 22, 24, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c0281c';
  ctx.fillRect(cx - 24, top - 4, 48, 11);
  ctx.fillStyle = '#fff';
  for (const dx of [-16, -4, 8, 18]) ctx.fillRect(cx + dx, top - 1, 4, 4);
  ctx.strokeStyle = '#222'; // a wink and a smile
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 14, top + 20);
  ctx.quadraticCurveTo(cx - 8, top + 15, cx - 2, top + 20);
  ctx.moveTo(cx + 6, top + 20);
  ctx.quadraticCurveTo(cx + 11, top + 16, cx + 16, top + 20);
  ctx.stroke();
  ctx.fillStyle = '#d4142a';
  ctx.beginPath();
  ctx.ellipse(cx + 1, top + 36, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e86a5a'; // blush
  ctx.beginPath();
  ctx.arc(cx - 16, top + 30, 4, 0, Math.PI * 2);
  ctx.arc(cx + 18, top + 30, 4, 0, Math.PI * 2);
  ctx.fill();
  // caption
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillRect(x0 + w - 178, y0 + 10, 168, 46);
  ctx.fillStyle = '#7a1f1f';
  ctx.font = 'bold 20px "Comic Sans MS", "Segoe Print", cursive';
  ctx.textAlign = 'center';
  ctx.fillText('MISS', x0 + w - 94, y0 + 31);
  ctx.fillText('MUDGUARD', x0 + w - 94, y0 + 50);
  ctx.textAlign = 'start';
}

// One a page; more go here.
export const PICTURES = [missMudguard];

/**
 * A wall calendar on the barn's back wall, between the jobs board and the records board: a funny picture across the top and the month
 * under it, with each day gone crossed off in red and today circled. Drawn on a canvas once, when the barn is built (the day does not
 * change while it is loaded). Nothing to press: you read it from where you stand.
 */
export class WallCalendar {
  constructor({ game, date }) {
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
    this.draw(date);
  }

  draw(date) {
    const page = calendarPage(date);
    const ctx = this.canvas.getContext('2d');
    ctx.fillStyle = '#f4efe0';
    ctx.fillRect(0, 0, PX_W, PX_H);
    this.picture(ctx, 0, 0, PX_W, 210, page.page);

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
    const rowH = 33; // up to six rows of weeks
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

  /** The page's picture, one of PICTURES by page so a new one is a new function and a line in the list. */
  picture(ctx, x0, y0, w, h, page = 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, w, h);
    ctx.clip();
    PICTURES[page % PICTURES.length](ctx, x0, y0, w, h);
    ctx.restore();
  }
}
