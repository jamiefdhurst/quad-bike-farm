// Painted canvases for the field landmarks (landmarkProps.js): weathered gritstone with lichen, rusting cast iron, three kinds of bark, and the
// worn earth under a tree. Each is drawn once at build time from the props' seeded random; one tile is a metre across, so `limb` and `worldBox`
// lay it over any shape.

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

/** Old cast iron: dark ribbed metal with orange rust blooms, flaked black paint, vertical ribs shaded light and dark. */
export function castIronTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgb(70, 66, 62);
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      ctx.fillStyle = 'rgba(210,210,200,0.06)';
      ctx.fillRect(x, 0, 2, h);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(x + 12, 0, 3, h);
    }
    for (let i = 0; i < 60; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 3 + random() * 16;
      ctx.fillStyle = rgb(120 + random() * 40, 66 + random() * 24, 34, 0.25 + random() * 0.3);
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.5 + random() * 0.6), random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Flaked paint: patches of old green-black that survive.
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = rgb(34, 50, 38, 0.5);
      ctx.fillRect(random() * w, random() * h, 6 + random() * 24, 4 + random() * 14);
    }
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = rgb(20, 14, 10, 0.3);
      ctx.fillRect(random() * w, random() * h, 1, 1 + random() * 3);
    }
    // Rust running down from the top.
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = rgb(130, 60, 26, 0.18);
      ctx.fillRect(random() * w, 0, 2 + random() * 4, h * (0.2 + random() * 0.5));
    }
  });
}

/**
 * Bark by `kind`: 'oak' deep brown with wide furrows, 'elm' dead and bleached (grey wood, peeling, beetle galleries), 'ash' pale grey with diamond-crossing fissures, 'alder' dark
 * brown-grey and rough with lighter cracked plates, 'willow' deep grey ridges. One tile is a metre of trunk.
 */
export function treeBarkTexture(random, kind = 'ash') {
  const base = { oak: [88, 72, 54], elm: [128, 120, 108], ash: [124, 122, 112], alder: [74, 62, 52], willow: [86, 78, 66] }[kind] ?? [100, 90, 80];
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = rgb(...base);
    ctx.fillRect(0, 0, w, h);
    const fissures = kind === 'ash' ? 70 : 110;
    for (let i = 0; i < fissures; i++) {
      const x = random() * w;
      const y = random() * h;
      const len = 14 + random() * (kind === 'willow' ? 90 : 60);
      ctx.strokeStyle = rgb(24, 20, 16, 0.3 + random() * 0.3);
      ctx.lineWidth = 1 + random() * 2.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (random() - 0.5) * 6, y + len);
      ctx.stroke();
      if (kind === 'ash' && random() < 0.8) {
        ctx.beginPath();
        ctx.moveTo(x, y + len * 0.3);
        ctx.lineTo(x + (random() < 0.5 ? -1 : 1) * (8 + random() * 10), y + len * 0.3 + 8 + random() * 10);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 120; i++) {
      const l = random() < 0.5;
      ctx.fillStyle = l ? rgb(210, 205, 190, 0.1 + random() * 0.12) : rgb(0, 0, 0, 0.08 + random() * 0.1);
      ctx.fillRect(random() * w, random() * h, 1 + random() * 4, 4 + random() * 22);
    }
    if (kind === 'elm') {
      // Where the bark has come away: long pale strips of bare wood with fine dark galleries across them, and a few dark knots.
      for (let i = 0; i < 9; i++) {
        const x = random() * (w - 20);
        const y = random() * h * 0.8;
        ctx.fillStyle = rgb(196, 188, 170, 0.8);
        ctx.fillRect(x, y, 10 + random() * 16, 30 + random() * 80);
        for (let k = 0; k < 24; k++) {
          ctx.strokeStyle = rgb(70, 56, 40, 0.5);
          ctx.beginPath();
          ctx.moveTo(x + random() * 20, y + random() * 90);
          ctx.lineTo(x + random() * 20, y + random() * 90);
          ctx.stroke();
        }
      }
    }
    if (kind === 'alder' || kind === 'willow') {
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = rgb(110, 130, 70, 0.22);
        ctx.beginPath();
        ctx.arc(random() * w, random() * h, 2 + random() * 6, 0, Math.PI * 2);
        ctx.fill();
      }
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
