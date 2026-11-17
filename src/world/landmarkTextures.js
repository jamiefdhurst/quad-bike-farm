// Painted canvases for the field landmarks (landmarkProps.js): weathered gritstone with lichen and the worn earth under a tree or a gate. The cast iron is
// quarryTextures.js `rustTexture` and the barks are neighbourTextures.js `barkTexture`. Each is drawn once at build time from the props' seeded random;
// one tile is a metre across, so `limb` and `worldBox` lay it over any shape.

import { canvasTexture } from './outbuildingProps.js';

const rgb = (r, g, b, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;

/** Weathered gritstone: buff and grey grain, dark pitting, lichen in yellow-green and grey-white patches, damp moss and a stain running down. */
export function gritstoneTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgb(138, 130, 116);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const l = 90 + random() * 90;
      ctx.fillStyle = rgb(l + 8, l, l - 14, 0.18 + random() * 0.22);
      ctx.fillRect(random() * w, random() * h, 1 + random() * 3, 1 + random() * 2);
    }
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = rgb(48, 42, 36, 0.25 + random() * 0.3);
      ctx.beginPath();
      ctx.arc(random() * w, random() * h, 0.6 + random() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Lichen: rounded rosettes of crusts, yellow-green and a pale grey, some with a dark rim.
    for (let i = 0; i < 46; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 3 + random() * 10;
      const yellow = random() < 0.55;
      ctx.fillStyle = yellow ? rgb(168, 170, 70, 0.55) : rgb(196, 198, 180, 0.5);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgb(60, 56, 40, 0.35);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Damp green along the lower quarter, and a few long stains down the face.
    const moss = ctx.createLinearGradient(0, h * 0.72, 0, h);
    moss.addColorStop(0, 'rgba(70,92,40,0)');
    moss.addColorStop(1, 'rgba(70,92,40,0.45)');
    ctx.fillStyle = moss;
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = rgb(40, 38, 32, 0.12 + random() * 0.1);
      ctx.fillRect(random() * w, random() * h * 0.4, 2 + random() * 5, h * (0.3 + random() * 0.6));
    }
  });
}

/** The worn ground under a tree or a gate: a soft round patch of bare earth and dung going to nothing at its rim, over the grass. */
export function wornEarthTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(122,98,66,0.8)');
    g.addColorStop(0.5, 'rgba(126,104,72,0.55)');
    g.addColorStop(1, 'rgba(126,104,72,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 110; i++) {
      const a = random() * Math.PI * 2;
      const r = random() * w * 0.4;
      ctx.fillStyle = random() < 0.5 ? rgb(52, 40, 28, 0.35) : rgb(138, 116, 84, 0.3);
      ctx.fillRect(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 1 + random() * 3, 1 + random() * 2);
    }
    for (let i = 0; i < 16; i++) {
      const a = random() * Math.PI * 2;
      const r = random() * w * 0.34;
      ctx.fillStyle = rgb(60, 78, 34, 0.5);
      ctx.fillRect(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 2, 3 + random() * 3);
    }
  });
}
