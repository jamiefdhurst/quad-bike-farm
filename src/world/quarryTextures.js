// The canvas textures of the pit's props: the plant's hardcore pad, rusty plate, faded digger paint, the container's and the cabin's steel, the hazard signs and the drums.

import { canvasTexture } from './outbuildingProps.js';

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
