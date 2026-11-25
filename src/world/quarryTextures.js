// The canvas textures of the pit's props: the plant's hardcore pad, rusty plate, faded digger paint, the container's and the cabin's steel, the hazard signs and the drums,
// and the lane entrance's bellmouth and its loose tarmac (#1002); and the relics' years of standing (#1003): chalked paint, cracks and moss, rusted
// drums, rust streaks, cracked glass, a worn belt, weathered plastic and the container's hardstanding.

import { canvasTexture } from './outbuildingProps.js';
import { tarmacAt, rutDip, bellmouthHalf, raggedEdge, ENTRANCE } from './pitEntrance.js';

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
  const W = 1024; // about 50 pixels a metre
  const H = 1024;
  const span = reach + BELLMOUTH_UV.pad - BELLMOUTH_UV.u0;
  const toPx = (u, v) => [((v + BELLMOUTH_UV.v) / (2 * BELLMOUTH_UV.v)) * W, H * (1 - (u - BELLMOUTH_UV.u0) / span)];
  const pxPerM = W / (2 * BELLMOUTH_UV.v);
  return canvasTexture(W, H, (ctx) => {
    // The hardcore: crushed stone in greys and buff.
    ctx.fillStyle = '#8b8578';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 36000; i++) {
      const v = 90 + Math.floor(random() * 90);
      ctx.fillStyle = `rgba(${v + 10},${v + 4},${v - 10},0.55)`;
      ctx.fillRect(random() * W, random() * H, 1.5 + random() * 3, 1.5 + random() * 2.5);
    }
    // The tarmac, cell by cell where it still holds, with a crumbled grey rim where it is breaking up.
    // Each cell a little bigger than its spacing and knocked off the grid, so the broken edge reads as crumbled stone and not as squares.
    const cell = 0.07;
    for (let u = BELLMOUTH_UV.u0; u < reach + BELLMOUTH_UV.pad; u += cell) {
      for (let v = -BELLMOUTH_UV.v; v < BELLMOUTH_UV.v; v += cell) {
        const t = tarmacAt(u, v, reach) + (random() - 0.5) * 0.07;
        if (t < 0.42) continue;
        const [x, y] = toPx(u + (random() - 0.5) * cell, v + (random() - 0.5) * cell);
        const g = 54 + Math.floor(random() * 6);
        const r = (cell * pxPerM * (1.2 + random() * 0.6)) / 2; // round crumbs, not squares
        ctx.fillStyle = t < 0.48 ? `rgb(${g + 40},${g + 37},${g + 32})` : `rgb(${g},${g},${g + 2})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Aggregate showing through the tarmac, and its cracks.
    for (let i = 0; i < 9000; i++) {
      const u = BELLMOUTH_UV.u0 + random() * (reach + 1);
      const v = (random() - 0.5) * 2 * BELLMOUTH_UV.v;
      if (tarmacAt(u, v, reach) < 0.55) continue;
      const [x, y] = toPx(u, v);
      const c = 85 + Math.floor(random() * 60);
      ctx.fillStyle = `rgba(${c},${c},${c - 3},0.6)`;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.strokeStyle = 'rgba(18,18,18,0.75)';
    ctx.lineWidth = 2;
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
    // Each a run of overlapping blobs along the rut, so its edge is uneven and not a drawn oval.
    for (const { u, v, len } of puddles) {
      for (const [col, grow] of [['rgba(176,166,140,0.16)', 0.12], ['rgba(62,54,42,0.5)', 0]]) {
        for (let k = 0; k < 7; k++) {
          const along = (k / 6 - 0.5) * len * 0.8;
          const [x, y] = toPx(u + along, v + (random() - 0.5) * 0.08);
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.ellipse(x, y, (ENTRANCE.rutHalf * (0.8 + random() * 0.4) + grow) * pxPerM, (len * 0.17 + grow) * pxPerM, (random() - 0.5) * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
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
    for (let i = 0; i < 1600; i++) {
      const u = reach - 1.5 + Math.pow(random(), 0.6) * 2;
      const v = (random() - 0.5) * 2 * (bellmouthHalf(u, reach) - 0.5);
      const [x, y] = toPx(u, v);
      const c = 118 + Math.floor(random() * 60);
      ctx.fillStyle = `rgba(${c},${c - 6},${c - 18},${0.45 + random() * 0.3})`;
      ctx.fillRect(x, y, 1.5 + random() * 2, 1.5 + random() * 2);
    }
    // Moss and grass in the cracks at the very edge, where nothing runs over it.
    for (let i = 0; i < 2400; i++) {
      const u = BELLMOUTH_UV.u0 + random() * (reach + 1);
      const side = random() < 0.5 ? -1 : 1;
      const v = side * (bellmouthHalf(u, reach) + raggedEdge(u, side) - random() * random() * 0.35);
      const [x, y] = toPx(u, v);
      ctx.fillStyle = `rgba(${66 + random() * 30},${92 + random() * 36},${42 + random() * 18},${0.3 + random() * 0.35})`;
      ctx.fillRect(x, y, 2 + random() * 2, 2 + random() * 3);
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

/**
 * Cracks, moss and weeds over a stone or concrete surface left for years (#1003), drawn from `wear`: dark cracks that wander and fork, green-black
 * moss along them and in patches, a few bright tufts of grass in the cracks, and damp dark stains where water stands.
 */
export function crackAndMoss(ctx, w, h, wear, { cracks = 7, moss = 1 } = {}) {
  for (let i = 0; i < 6; i++) {
    const x = wear() * w;
    const y = wear() * h;
    const r = 16 + wear() * 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(48,46,40,0.32)'); // damp, where the water stands
    g.addColorStop(1, 'rgba(48,46,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const crack = (x, y, a, len, width, depth) => {
    ctx.strokeStyle = `rgba(34,32,28,${0.35 + wear() * 0.3})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const pts = [];
    for (let s = 0; s < len; s += 5) {
      a += (wear() - 0.5) * 0.8;
      x += Math.cos(a) * 5;
      y += Math.sin(a) * 5;
      ctx.lineTo(x, y);
      pts.push([x, y]);
    }
    ctx.stroke();
    for (const [px, py] of pts) {
      if (wear() < 0.25 * moss) {
        ctx.fillStyle = `rgba(${52 + wear() * 30},${74 + wear() * 30},${30 + wear() * 14},${0.45 + wear() * 0.3})`; // moss along it
        ctx.fillRect(px - 2, py - 2, 3 + wear() * 4, 3 + wear() * 4);
      }
      if (wear() < 0.06 * moss) {
        ctx.strokeStyle = `rgba(${86 + wear() * 40},${120 + wear() * 30},${40 + wear() * 20},0.85)`; // a tuft of grass in it
        ctx.lineWidth = 1;
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + (wear() - 0.5) * 8, py + (wear() - 0.5) * 8);
          ctx.stroke();
        }
      }
      if (depth > 0 && wear() < 0.05) crack(px, py, a + (wear() < 0.5 ? 1 : -1) * (0.6 + wear() * 0.6), len * 0.45, Math.max(1, width - 1), depth - 1);
    }
  };
  for (let i = 0; i < cracks; i++) crack(wear() * w, wear() * h, wear() * Math.PI * 2, 60 + wear() * 160, 0.7 + wear() * 0.8, 1);
  for (let i = 0; i < 10 * moss; i++) {
    const x = wear() * w;
    const y = wear() * h;
    const r = 6 + wear() * 18;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${60 + wear() * 30},${82 + wear() * 30},${36},0.5)`);
    g.addColorStop(1, 'rgba(60,82,36,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/**
 * The plant's hardcore pad, one tile 3 m square: crushed stone in greys and buff, with dark oil stains and a few pale dust patches; with `wear`, cracked,
 * mossed and weedy from years of standing (`crackAndMoss`, #1003).
 */
export function hardcoreTexture(random, { wear = null } = {}) {
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
    if (wear) crackAndMoss(ctx, w, h, wear);
  });
}

/**
 * Years out in the weather over a painted tile (#1003), drawn from `wear` (its own stream, so a texture's first draws stay as they were): `chalk` 0..1
 * the paint's bloom gone pale and powdery, heaviest at the top where the sun and rain fall; `rust` 0..1 more rust breaking through in patches and runs;
 * `grime` 0..1 green-grey algae and dirt washed down from the top and up from the foot. v up (the canvas's top is a face's top).
 */
export function weatherPaint(ctx, w, h, wear, { chalk = 0, rust = 0, grime = 0 } = {}) {
  if (chalk) {
    ctx.fillStyle = `rgba(214,206,178,${0.1 * chalk})`; // the whole coat a little paler and flatter
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x = wear() * w;
      const y = wear() ** 1.6 * h; // more towards the top
      const r = 10 + wear() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(232,226,204,${(0.08 + wear() * 0.12) * chalk})`);
      g.addColorStop(1, 'rgba(232,226,204,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(240,234,214,${0.06 * chalk + wear() * 0.08})`; // the powder itself
      ctx.fillRect(wear() * w, wear() * h, 1, 1);
    }
  }
  if (rust) {
    for (let i = 0; i < 28 * rust; i++) {
      ctx.fillStyle = `rgba(${wear() < 0.5 ? '128,64,28' : '96,50,26'},${0.35 + wear() * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(wear() * w, wear() * h, 2 + wear() * 10, 1.5 + wear() * 6, wear() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 34 * rust; i++) {
      const x = wear() * w;
      const y = wear() * h * 0.8;
      const len = 20 + wear() * 120;
      const g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, `rgba(118,56,22,${0.3 + 0.3 * rust})`);
      g.addColorStop(1, 'rgba(118,56,22,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 1 + wear() * 3, len);
    }
  }
  if (grime) {
    ctx.fillStyle = `rgba(96,98,80,${0.12 * grime})`; // dingy all over
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) {
      const x = wear() * w;
      const len = h * (0.2 + wear() * 0.6);
      const g = ctx.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, `rgba(72,84,52,${0.4 * grime})`);
      g.addColorStop(1, 'rgba(72,84,52,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 3 + wear() * 12, len);
    }
    const foot = ctx.createLinearGradient(0, h * 0.65, 0, h);
    foot.addColorStop(0, 'rgba(70,78,48,0)');
    foot.addColorStop(1, `rgba(70,78,48,${0.55 * grime})`);
    ctx.fillStyle = foot;
    ctx.fillRect(0, h * 0.65, w, h * 0.35);
  }
}

/**
 * A faded paint-and-rust texture for the excavator's body: `colour` worn through to the rust in streaks and edges, dirt low down; with `wear` (a
 * random stream) the weathering of a machine left for years over it (`weatherPaint`, #1003).
 */
export function diggerTexture(random, colour, { wear = null, chalk = 0, rust = 0 } = {}) {
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
    if (wear) weatherPaint(ctx, w, h, wear, { chalk, rust });
  });
}

/**
 * Painted steel gone to rust from the bottom: one tile (v up; the container's walls stretch it to their own height). `base` is the paint; the rust creeps up from the foot and the edges,
 * with a few streaks running down from higher up.
 */
export function paintedSteelTexture(random, base, rustAmount = 0.5, { wear = null, chalk = 0, rust = 0, grime = 0 } = {}) {
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
    if (wear) weatherPaint(ctx, w, h, wear, { chalk, rust, grime });
  });
}

/** A site cabin's ribbed steel cladding: one tile 0.6 m wide and as tall as the cabin (2.65 m), four ribs across it, v up, rusty at the foot. */
export function cladding(random, base = '#c9c3a8', { wear = null, chalk = 0, rust = 0, grime = 0 } = {}) {
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
    if (wear) weatherPaint(ctx, w, h, wear, { chalk, rust, grime });
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

/**
 * A drum left out for years (#1003), one tile round the whole drum (u round it, v up), with its colour in it: what is left of the paint (`paint`) in
 * islands over rust, the label long gone, the rims and hoops rusted through, rust running down from the lid and a brown crust at the foot. From `wear`.
 */
export function rustedDrumTexture(wear, paint) {
  return canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#74462a';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${wear() < 0.5 ? '140,76,36' : '88,50,30'},${0.3 + wear() * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(wear() * w, wear() * h, 2 + wear() * 7, 2 + wear() * 6, wear() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = paint; // the paint that is left, flaking, more of it in the middle band away from the rims
    for (let i = 0; i < 30; i++) {
      ctx.globalAlpha = 0.55 + wear() * 0.35;
      ctx.beginPath();
      ctx.ellipse(wear() * w, h * (0.18 + wear() * 0.64), 3 + wear() * 9, 3 + wear() * 12, wear() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(226,220,198,0.16)'; // the paint chalked by the sun
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(92,48,24,0.75)'; // the hoops and rims, rubbed to bare rusted steel
    for (const f of [0.34, 0.66]) ctx.fillRect(0, h * f - 3, w, 5);
    ctx.fillRect(0, 0, w, 5);
    ctx.fillRect(0, h - 6, w, 6);
    for (let i = 0; i < 18; i++) {
      const x = wear() * w;
      const len = 14 + wear() * 50;
      const g = ctx.createLinearGradient(0, 4, 0, 4 + len);
      g.addColorStop(0, 'rgba(108,50,20,0.6)');
      g.addColorStop(1, 'rgba(108,50,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 4, 1 + wear() * 2, len);
    }
    const foot = ctx.createLinearGradient(0, h * 0.78, 0, h);
    foot.addColorStop(0, 'rgba(84,62,38,0)');
    foot.addColorStop(1, 'rgba(84,62,38,0.7)');
    ctx.fillStyle = foot;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
  });
}

/** A rust streak to hang under a pin or a bolt (#1003), on a transparent canvas: a few runs of rust from the top, fading as they go down. v up. */
export function rustStreakTexture(wear) {
  return canvasTexture(64, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g0 = ctx.createRadialGradient(w / 2, 6, 0, w / 2, 6, w * 0.45);
    g0.addColorStop(0, 'rgba(112,54,22,0.85)'); // the stain round the pin itself
    g0.addColorStop(1, 'rgba(112,54,22,0)');
    ctx.fillStyle = g0;
    ctx.fillRect(0, 0, w, w * 0.5);
    for (let i = 0; i < 6; i++) {
      const x = w * (0.28 + wear() * 0.44);
      const len = h * (0.45 + wear() * 0.55);
      const wd = 5 + wear() * 9;
      const g = ctx.createLinearGradient(0, 0, 0, len);
      const c = wear() < 0.5 ? '104,48,18' : '132,66,26';
      g.addColorStop(0, `rgba(${c},${0.8 + wear() * 0.15})`);
      g.addColorStop(0.6, `rgba(${c},${0.45 + wear() * 0.2})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); // a run that narrows as it goes
      ctx.moveTo(x - wd / 2, 2);
      ctx.lineTo(x + wd / 2, 2);
      ctx.lineTo(x + wd * 0.15, len);
      ctx.lineTo(x - wd * 0.15, len);
      ctx.closePath();
      ctx.fill();
    }
  });
}

/**
 * Glass that has been hit and left (#1003), on a canvas whose alpha is the glass's: a pale dirty pane, a star of cracks out from where it was hit and
 * rings round it, the cracks bright and nearly opaque. `hit` [u, v] 0..1 is where.
 */
export function crackedGlassTexture(wear, hit = [0.4, 0.55]) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(70,86,90,0.42)';
    ctx.fillRect(0, 0, w, h);
    const grime = ctx.createLinearGradient(0, h * 0.6, 0, h);
    grime.addColorStop(0, 'rgba(110,98,72,0)');
    grime.addColorStop(1, 'rgba(110,98,72,0.5)');
    ctx.fillStyle = grime;
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
    const cx = hit[0] * w;
    const cy = (1 - hit[1]) * h;
    ctx.strokeStyle = 'rgba(224,230,228,0.85)';
    ctx.lineWidth = 1;
    const rays = 9 + Math.floor(wear() * 5);
    for (let i = 0; i < rays; i++) {
      let a = (i / rays) * Math.PI * 2 + wear() * 0.4;
      let x = cx;
      let y = cy;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 14; s++) {
        a += (wear() - 0.5) * 0.25;
        x += Math.cos(a) * 7;
        y += Math.sin(a) * 7;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (const r of [8, 16, 27]) {
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const rr = r * (0.8 + wear() * 0.4);
        if (i) ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        else ctx.moveTo(cx + rr, cy);
      }
      ctx.stroke();
    }
  });
}

/** A conveyor belt's worn rubber, one tile 1 m square: near black with grey dust in its grooves along the run, scuffs and cracked edges. */
export function beltTexture(wear) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#262523';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) {
      ctx.fillStyle = `rgba(150,142,124,${0.06 + wear() * 0.08})`; // stone dust in the grooves
      ctx.fillRect(0, y, w, 2);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${wear() < 0.6 ? '160,150,130' : '12,12,12'},${0.1 + wear() * 0.2})`;
      ctx.fillRect(wear() * w, wear() * h, 4 + wear() * 30, 1 + wear() * 3);
    }
    ctx.strokeStyle = 'rgba(8,8,8,0.6)';
    for (let i = 0; i < 6; i++) {
      const y = wear() * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(4 + wear() * 10, y + (wear() - 0.5) * 6); // the edge cracking
      ctx.stroke();
    }
  });
}

/** White moulded plastic left out for years (#1003), one tile 0.5 m: gone grey and chalky, green algae in streaks and a dirty foot. */
export function weatheredPlasticTexture(wear, base = '#b4b2a5') {
  return canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(${wear() < 0.5 ? '96,104,74' : '120,112,96'},${0.08 + wear() * 0.18})`;
      ctx.fillRect(wear() * w, wear() * h, 2 + wear() * 6, 4 + wear() * 22);
    }
    weatherPaint(ctx, w, h, wear, { grime: 0.8 });
  });
}

/**
 * The container's hardstanding (#1003), one tile 4 m square: an old concrete slab gone grey-green, cracked and mossed, weeds in the cracks, a broken
 * corner showing the hardcore under it and rust stains where something stood.
 */
export function hardstandingTexture(random, wear) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#817f74';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 20 + random() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${random() < 0.5 ? '84,96,60' : '62,60,52'},0.35)`); // green and dark weathering in broad patches
      g.addColorStop(1, 'rgba(70,80,56,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = `rgba(${random() > 0.5 ? '178,176,166' : '82,82,76'},${0.08 + random() * 0.2})`;
      ctx.fillRect(random() * w, random() * h, 1 + random() * 2, 1 + random() * 2);
    }
    for (let i = 0; i < 4; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 14 + random() * 22;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(118,62,30,0.35)'); // rust stains
      g.addColorStop(1, 'rgba(118,62,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.fillStyle = 'rgba(60,58,52,0.5)'; // the bay joint
    ctx.fillRect(w / 2 - 1, 0, 2, h);
    crackAndMoss(ctx, w, h, wear, { cracks: 9, moss: 1.4 });
  });
}
