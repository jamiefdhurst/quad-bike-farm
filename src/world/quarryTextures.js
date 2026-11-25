// The canvas textures of the pit's props: the plant's hardcore pad, rusty plate, faded digger paint, the container's and the cabin's steel, the hazard signs and the drums,
// and the lane entrance's bellmouth and its loose tarmac (#1002).

import { canvasTexture } from './outbuildingProps.js';
import { tarmacAt, rutDip, bellmouthHalf, ENTRANCE } from './pitEntrance.js';

/** Where the bellmouth's texture lies over it: `v` metres either way along the gate, and from `u0` metres inside the gate to `pad` past the lane's edge. */
export const BELLMOUTH_UV = { v: 10, u0: -1.2, pad: 0.6 };

/** The texture's [u, v] at (u, v) in the gate's frame, for a bellmouth reaching `reach` m to the lane. */
export const bellmouthUv = (u, v, reach) => [(v + BELLMOUTH_UV.v) / (2 * BELLMOUTH_UV.v), (u - BELLMOUTH_UV.u0) / (reach + BELLMOUTH_UV.pad - BELLMOUTH_UV.u0)];

/** Old road tarmac for a loose lump of it, one tile 0.5 m square: near black with grey aggregate showing, a pale crazed top. */
export function tarmacTexture(random) {
  return canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#3b3b3d';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 380; i++) {
      const v = 70 + Math.floor(random() * 90);
      ctx.fillStyle = `rgba(${v},${v},${v - 4},0.55)`;
      ctx.fillRect(random() * w, random() * h, 1 + random() * 2, 1 + random() * 2);
    }
    ctx.strokeStyle = 'rgba(20,20,20,0.6)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(random() * w, random() * h);
      for (let k = 0; k < 4; k++) ctx.lineTo(random() * w, random() * h);
      ctx.stroke();
    }
  });
}

/**
 * The bellmouth's own painting (#1002), over the whole of it once (`bellmouthUv`): crushed hardcore at the gate breaking up into old tarmac towards the
 * lane in islands with crumbled edges and cracks, two ruts worn muddy through it with damp silt where the puddles stand, an oil stain, chippings fanned
 * out at the lane's edge and grass creeping in at the ragged sides. `plan` is pitEntrance.js `entrancePlan`'s: `reach` (how far the lane is) and its `puddles`.
 */
export function bellmouthTexture(random, { reach, puddles }) {
  const W = 512;
  const H = 512;
  const span = reach + BELLMOUTH_UV.pad - BELLMOUTH_UV.u0;
  const toPx = (u, v) => [((v + BELLMOUTH_UV.v) / (2 * BELLMOUTH_UV.v)) * W, H * (1 - (u - BELLMOUTH_UV.u0) / span)];
  const pxPerM = W / (2 * BELLMOUTH_UV.v);
  return canvasTexture(W, H, (ctx) => {
    // The hardcore: crushed stone in greys and buff.
    ctx.fillStyle = '#8b8578';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) {
      const v = 90 + Math.floor(random() * 90);
      ctx.fillStyle = `rgba(${v + 10},${v + 4},${v - 10},0.55)`;
      ctx.fillRect(random() * W, random() * H, 1 + random() * 2.2, 1 + random() * 2);
    }
    // The tarmac, cell by cell where it still holds, with a crumbled grey rim where it is breaking up.
    const cell = 0.14;
    for (let u = BELLMOUTH_UV.u0; u < reach + BELLMOUTH_UV.pad; u += cell) {
      for (let v = -BELLMOUTH_UV.v; v < BELLMOUTH_UV.v; v += cell) {
        const t = tarmacAt(u, v, reach) + (random() - 0.5) * 0.12;
        if (t < 0.42) continue;
        const [x, y] = toPx(u, v);
        const g = 52 + Math.floor(random() * 14);
        ctx.fillStyle = t < 0.52 ? `rgb(${g + 34},${g + 32},${g + 28})` : `rgb(${g},${g},${g + 2})`;
        ctx.fillRect(x, y - cell * pxPerM, cell * pxPerM + 0.6, cell * pxPerM + 0.6);
      }
    }
    // Aggregate showing through the tarmac, and its cracks.
    for (let i = 0; i < 2600; i++) {
      const u = BELLMOUTH_UV.u0 + random() * (reach + 1);
      const v = (random() - 0.5) * 2 * BELLMOUTH_UV.v;
      if (tarmacAt(u, v, reach) < 0.55) continue;
      const [x, y] = toPx(u, v);
      const c = 85 + Math.floor(random() * 60);
      ctx.fillStyle = `rgba(${c},${c},${c - 3},0.6)`;
      ctx.fillRect(x, y, 1.2, 1.2);
    }
    ctx.strokeStyle = 'rgba(18,18,18,0.75)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 60; i++) {
      let u = reach * (0.45 + random() * 0.55);
      let v = (random() - 0.5) * 2 * bellmouthHalf(u, reach);
      ctx.beginPath();
      ctx.moveTo(...toPx(u, v));
      for (let k = 0; k < 5; k++) {
        u += (random() - 0.5) * 0.9;
        v += (random() - 0.5) * 0.9;
        ctx.lineTo(...toPx(u, v));
      }
      ctx.stroke();
    }
    // The ruts: worn muddy lines through it all, darkest in the middle of each.
    for (let u = BELLMOUTH_UV.u0; u < reach; u += 0.06) {
      for (let v = -ENTRANCE.rut - 0.4; v <= ENTRANCE.rut + 0.4; v += 0.06) {
        const d = rutDip(v) / ENTRANCE.rutDip;
        if (d < 0.05) continue;
        const [x, y] = toPx(u, v);
        const on = 1 - 0.5 * tarmacAt(u, v, reach);
        ctx.fillStyle = `rgba(${78 + random() * 14},${66 + random() * 10},${48 + random() * 8},${0.75 * d * on})`;
        ctx.fillRect(x, y, 0.06 * pxPerM + 0.5, 0.06 * pxPerM + 0.5);
      }
    }
    // Damp silt where the puddles stand, with a paler rim where they have dried back.
    for (const { u, v, len } of puddles) {
      const [x, y] = toPx(u, v);
      ctx.fillStyle = 'rgba(196,186,160,0.45)';
      ctx.beginPath();
      ctx.ellipse(x, y, ENTRANCE.rutHalf * 1.4 * pxPerM, (len / 2 + 0.15) * pxPerM, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(62,54,42,0.85)';
      ctx.beginPath();
      ctx.ellipse(x, y, ENTRANCE.rutHalf * pxPerM, (len / 2) * pxPerM, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // An oil stain where something stood.
    {
      const [x, y] = toPx(reach * 0.55, -1.8);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 0.8 * pxPerM);
      g.addColorStop(0, 'rgba(20,18,16,0.55)');
      g.addColorStop(1, 'rgba(20,18,16,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - pxPerM, y - pxPerM, pxPerM * 2, pxPerM * 2);
    }
    // Chippings fanned out at the lane's edge, and grass creeping in at the ragged sides.
    for (let i = 0; i < 1400; i++) {
      const u = reach - 1.5 + random() * 2;
      const v = (random() - 0.5) * 2 * (bellmouthHalf(u, reach) - 0.5);
      const [x, y] = toPx(u, v);
      const c = 150 + Math.floor(random() * 70);
      ctx.fillStyle = `rgba(${c},${c - 6},${c - 20},0.8)`;
      ctx.fillRect(x, y, 1.5 + random() * 1.5, 1.5 + random() * 1.5);
    }
    for (let i = 0; i < 2200; i++) {
      const u = BELLMOUTH_UV.u0 + random() * (reach + 1);
      const side = random() < 0.5 ? -1 : 1;
      const v = side * (bellmouthHalf(u, reach) - random() * 0.6);
      const [x, y] = toPx(u, v);
      ctx.fillStyle = `rgba(${70 + random() * 30},${100 + random() * 40},${44 + random() * 20},${0.4 + random() * 0.4})`;
      ctx.fillRect(x, y, 1.2, 2.5 + random() * 3);
    }
  });
}

/** A rusty steel plate texture, one tile 2 m square: orange and brown blotches, streaks, and the odd pale patch of old paint. */
export function rustTexture(random, base = '#7a4a30') {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 8 + random() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const col = random() < 0.5 ? '150,78,34' : random() < 0.5 ? '70,38,24' : '176,120,64';
      g.addColorStop(0, `rgba(${col},0.4)`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 40; i++) {
      const x = random() * w;
      const y = random() * h * 0.6;
      const len = 20 + random() * 120;
      const g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, 'rgba(90,40,18,0.5)');
      g.addColorStop(1, 'rgba(90,40,18,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 1 + random() * 5, len);
    }
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = 'rgba(190,170,110,0.28)';
      ctx.fillRect(random() * w, random() * h, 10 + random() * 40, 6 + random() * 24);
    }
  });
}

/** The plant's hardcore pad, one tile 3 m square: crushed stone in greys and buff, with dark oil stains and a few pale dust patches. */
export function hardcoreTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8d877b';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 3200; i++) {
      const v = 95 + Math.floor(random() * 80);
      ctx.fillStyle = `rgba(${v + 10},${v + 4},${v - 8},0.5)`;
      ctx.beginPath();
      ctx.arc(random() * w, random() * h, 0.8 + random() * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 7; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 14 + random() * 36;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, random() < 0.7 ? 'rgba(28,24,20,0.5)' : 'rgba(205,196,170,0.4)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

/** A faded paint-and-rust texture for the excavator's body: `colour` worn through to the rust in streaks and edges, dirt low down. */
export function diggerTexture(random, colour) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 20 + random() * 60;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const col = random() < 0.5 ? '120,64,30' : random() < 0.5 ? '70,56,40' : '214,186,96';
      g.addColorStop(0, `rgba(${col},${0.1 + random() * 0.14})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 40; i++) {
      const x = random() * w;
      const y = random() * h * 0.7;
      const len = 14 + random() * 90;
      const g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, 'rgba(110,52,22,0.45)');
      g.addColorStop(1, 'rgba(110,52,22,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 1 + random() * 4, len);
    }
    ctx.strokeStyle = 'rgba(100,48,20,0.55)';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, w, h);
    const dirt = ctx.createLinearGradient(0, h * 0.6, 0, h);
    dirt.addColorStop(0, 'rgba(120,100,70,0)');
    dirt.addColorStop(1, 'rgba(120,100,70,0.5)');
    ctx.fillStyle = dirt;
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
  });
}

/**
 * Painted steel gone to rust from the bottom: one tile (v up; the container's walls stretch it to their own height). `base` is the paint; the rust creeps up from the foot and the edges,
 * with a few streaks running down from higher up.
 */
export function paintedSteelTexture(random, base, rustAmount = 0.5) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 14 + random() * 50;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const c = random() < 0.5 ? '0,0,0' : '255,255,255';
      g.addColorStop(0, `rgba(${c},0.07)`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // The foot of the sheet (canvas y grows downwards, and v up means the bottom of the tile is the foot of a wall).
    const foot = ctx.createLinearGradient(0, h * 0.78, 0, h);
    foot.addColorStop(0, 'rgba(126,64,28,0)');
    foot.addColorStop(1, `rgba(126,64,28,${0.55 * rustAmount + 0.15})`);
    ctx.fillStyle = foot;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
    for (let i = 0; i < 26; i++) {
      const x = random() * w;
      const y = random() * h * 0.7;
      const len = 20 + random() * 110;
      const g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, `rgba(120,58,24,${0.35 * rustAmount + 0.1})`);
      g.addColorStop(1, 'rgba(120,58,24,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 1 + random() * 4, len);
    }
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(150,76,30,${0.25 + random() * 0.3})`;
      ctx.beginPath();
      ctx.arc(random() * w, h * (0.7 + random() * 0.3), 2 + random() * 9, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** A site cabin's ribbed steel cladding: one tile 0.6 m wide and as tall as the cabin (2.65 m), four ribs across it, v up, rusty at the foot. */
export function cladding(random, base = '#c9c3a8') {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const x = (i * w) / 4;
      const lit = ctx.createLinearGradient(x, 0, x + w / 4, 0);
      lit.addColorStop(0, 'rgba(255,255,255,0.18)');
      lit.addColorStop(0.45, 'rgba(255,255,255,0.04)');
      lit.addColorStop(0.5, 'rgba(0,0,0,0.22)');
      lit.addColorStop(1, 'rgba(0,0,0,0.04)');
      ctx.fillStyle = lit;
      ctx.fillRect(x, 0, w / 4, h);
    }
    for (let i = 0; i < 30; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 12 + random() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${random() < 0.5 ? '90,70,40' : '255,250,230'},0.1)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const foot = ctx.createLinearGradient(0, h * 0.8, 0, h);
    foot.addColorStop(0, 'rgba(120,62,28,0)');
    foot.addColorStop(1, 'rgba(120,62,28,0.6)');
    ctx.fillStyle = foot;
    ctx.fillRect(0, h * 0.8, w, h * 0.2);
    for (let i = 0; i < 14; i++) {
      const x = random() * w;
      const y = random() * h * 0.6;
      const len = 20 + random() * 90;
      const g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, 'rgba(100,52,22,0.4)');
      g.addColorStop(1, 'rgba(100,52,22,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 1 + random() * 3, len);
    }
  });
}

/** Plain galvanised steel, one tile 1 m square: a dull grey with a few water stains. */
export function galvanisedTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8b9093';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 8 + random() * 30;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${random() < 0.5 ? '60,60,56' : '200,204,206'},0.18)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = 'rgba(110,70,40,0.2)';
      ctx.fillRect(random() * w, random() * h * 0.5, 1 + random() * 2, 14 + random() * 50);
    }
  });
}

/** The lettered part of a sign texture is its top SIGN_V of the canvas; the strip under it is plain galvanised steel, for a sign's back and edges. */
export const SIGN_SIZE = { w: 512, h: 512, face: 360 };

/** A hazard sign: black on yellow, a heading and up to three lines, readable on a flat face, with a strip of plain galvanised steel under it. */
export function signTexture(heading, lines, { bg = '#e8c52a', fg = '#1a1a1a' } = {}) {
  const { w: W, h: H, face: F } = SIGN_SIZE;
  return canvasTexture(W, H, (ctx) => {
    ctx.fillStyle = '#d9d6cb';
    ctx.fillRect(0, 0, W, F);
    ctx.fillStyle = bg;
    ctx.fillRect(14, 14, W - 28, F - 28);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 8;
    ctx.strokeRect(24, 24, W - 48, F - 48);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.font = 'bold 70px Arial, Helvetica, sans-serif';
    ctx.fillText(heading, W / 2, 108);
    ctx.font = 'bold 40px Arial, Helvetica, sans-serif';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, 176 + i * 52));
    // Weathering and a bullet hole or two.
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(80,60,30,${0.05 + Math.random() * 0.12})`;
      ctx.fillRect(Math.random() * W, Math.random() * F, 3 + Math.random() * 30, 3 + Math.random() * 6);
    }
    // The galvanised strip: a dull grey with water stains.
    ctx.fillStyle = '#8b9093';
    ctx.fillRect(0, F, W, H - F);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '60,60,56' : '200,204,206'},${0.05 + Math.random() * 0.12})`;
      ctx.fillRect(Math.random() * W, F + Math.random() * (H - F), 6 + Math.random() * 40, 3 + Math.random() * 10);
    }
  });
}

/** A small painted notice (the container's number plate, the cabin's door sign): `lines` in `fg` on `bg`, with a border. */
export function plateTexture(lines, { bg = '#e9e5d6', fg = '#1d2a22', w = 256, h = 128, size = 34 } = {}) {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`;
    const gap = (h - 16) / (lines.length + 1);
    lines.forEach((l, i) => ctx.fillText(l, w / 2, 8 + gap * (i + 1) + size * 0.35));
  });
}

/** The stencilled owner code and size marks of a shipping container, white on its steel (drawn on a transparent canvas). */
export function stencilTexture(lines) {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(235,232,220,0.85)';
    ctx.textAlign = 'center';
    ctx.font = 'bold 46px Arial, Helvetica, sans-serif';
    lines.forEach((l, i) => ctx.fillText(l, w / 2, 52 + i * 56));
  });
}

/** A steel drum's painted skin, one tile covering the whole drum (u round it, v up): rolling hoops, the bottom and top rims, and wear. */
export function drumTexture(random) {
  return canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e6e6e6';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 6 + random() * 18;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${random() < 0.5 ? '120,64,30' : '60,56,50'},${0.2 + random() * 0.3})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (const f of [0.34, 0.66]) ctx.fillRect(0, h * f - 2, w, 3);
    const foot = ctx.createLinearGradient(0, h * 0.85, 0, h);
    foot.addColorStop(0, 'rgba(110,56,24,0)');
    foot.addColorStop(1, 'rgba(110,56,24,0.55)');
    ctx.fillStyle = foot;
    ctx.fillRect(0, h * 0.85, w, h * 0.15);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(w * 0.12, h * 0.42, w * 0.3, 10);
  });
}
