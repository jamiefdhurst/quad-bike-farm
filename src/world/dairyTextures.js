// Painted canvases for a dairy yard (dairyKit.js, #569): galvanised steel, brushed stainless, scraped and hosed concrete, the slurry store's panel wall and
// its crust, a roller shutter, a warning board and a lettered label. Nothing is loaded: each is drawn once at build time from the props' seeded random,
// one tile being the size its comment gives so worldBox can lay it over any shape. Lettering is made up and sits on flat faces.

import { canvasTexture } from './outbuildingProps.js';

/** Hot-dipped galvanised steel: pale grey with the crystal spangle in patches a little lighter and darker, and a few scuffs. One tile is a metre. */
export function galvanisedTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#aeb3b5';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 6 + random() * 22;
      ctx.fillStyle = `rgba(${random() < 0.5 ? '255,255,255' : '60,70,75'},${0.04 + random() * 0.07})`;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.9, y - r * 0.2);
      ctx.lineTo(x + r * 0.5, y + r * 0.8);
      ctx.lineTo(x - r * 0.7, y + r * 0.6);
      ctx.lineTo(x - r, y - r * 0.3);
      ctx.fill();
    }
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(${random() < 0.6 ? '90,95,95' : '235,238,238'},${0.2 + random() * 0.3})`;
      ctx.lineWidth = 1;
      const x = random() * w;
      const y = random() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (random() - 0.5) * 30, y + (random() - 0.5) * 10);
      ctx.stroke();
    }
  });
}

/** Brushed stainless: fine horizontal grain, a soft sheen down the middle of each tile and a few milk smears. One tile is half a metre. */
export function stainlessTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#a9aeb2');
    g.addColorStop(0.35, '#e3e7ea');
    g.addColorStop(0.5, '#f1f3f4');
    g.addColorStop(0.7, '#cfd4d8');
    g.addColorStop(1, '#a3a8ac');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) {
      ctx.fillStyle = `rgba(${random() < 0.5 ? '255,255,255' : '70,78,84'},${0.04 + random() * 0.07})`;
      ctx.fillRect(0, random() * h, w, 1);
    }
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = 'rgba(245,244,236,0.2)';
      ctx.fillRect(random() * w * 0.8, random() * h, 20 + random() * 80, 2 + random() * 5);
    }
  });
}

/**
 * Concrete scraped and hosed down every day: grey with shallow ridges along z where the scraper's blade has run, long damp streaks (drawn as strokes, not
 * blobs, #912) darker where the water lies, pale where it dries, and a joint round the tile. One tile is 4 m.
 */
export function scrapedConcreteTexture(random) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8e8c85';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 4 + random() * 4) {
      ctx.fillStyle = `rgba(${random() < 0.5 ? '255,255,250' : '40,38,32'},${0.04 + random() * 0.06})`;
      ctx.fillRect(x, 0, 1 + random() * 2, h);
    }
    for (let i = 0; i < 46; i++) {
      const x = random() * w;
      const len = 60 + random() * 260;
      const y = random() * h;
      ctx.fillStyle = `rgba(${random() < 0.65 ? '48,42,30' : '215,212,200'},${0.06 + random() * 0.12})`;
      ctx.fillRect(x, y, 3 + random() * 14, len);
    }
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(35,30,22,${0.05 + random() * 0.08})`;
      ctx.fillRect(random() * w, random() * h, 6 + random() * 40, 1 + random() * 3);
    }
    ctx.strokeStyle = 'rgba(40,38,34,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
  });
}

/** A slurry store's wall of precast panels: 2.4 m wide, joints and two rows of bolts, a dark stain down from the top and green at the foot. One tile is 2.4 m across by 3.6 m. */
export function slurryWallTexture(random) {
  return canvasTexture(256, 384, (ctx, w, h) => {
    ctx.fillStyle = '#9b9890';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(${random() < 0.5 ? '255,255,250' : '50,48,40'},${0.03 + random() * 0.06})`;
      ctx.fillRect(random() * w, random() * h, 3 + random() * 30, 1 + random() * 8);
    }
    for (let i = 0; i < 16; i++) {
      const x = random() * w;
      const g = ctx.createLinearGradient(0, 0, 0, h * (0.3 + random() * 0.5));
      g.addColorStop(0, 'rgba(58,46,30,0.42)');
      g.addColorStop(1, 'rgba(58,46,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 2 + random() * 9, h);
    }
    const foot = ctx.createLinearGradient(0, h * 0.78, 0, h);
    foot.addColorStop(0, 'rgba(70,92,48,0)');
    foot.addColorStop(1, 'rgba(70,92,48,0.5)');
    ctx.fillStyle = foot;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
    ctx.fillStyle = 'rgba(30,28,24,0.7)';
    ctx.fillRect(0, 0, 4, h);
    ctx.fillRect(w - 2, 0, 2, h);
    ctx.fillStyle = 'rgba(40,38,34,0.6)';
    for (const y of [h * 0.18, h * 0.82]) for (let x = 24; x < w; x += 52) ctx.fillRect(x, y, 5, 5);
  });
}

/** The crust on a slurry store: dark brown, cracked into plates, with straw and a wet gleam in the cracks. One tile is 3 m. */
export function slurryCrustTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#4b3a24';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 150; i++) {
      ctx.fillStyle = `rgba(${random() < 0.5 ? '90,70,40' : '30,22,12'},${0.2 + random() * 0.3})`;
      ctx.fillRect(random() * w, random() * h, 6 + random() * 30, 4 + random() * 18);
    }
    for (let i = 0; i < 160; i++) {
      ctx.strokeStyle = `rgba(170,140,75,${0.25 + random() * 0.35})`;
      const x = random() * w;
      const y = random() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (random() - 0.5) * 24, y + (random() - 0.5) * 24);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(15,10,5,0.7)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 70; i++) {
      // Short, forking cracks between plates, not lines right across.
      let x = random() * w;
      let y = random() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        x += (random() - 0.5) * 22;
        y += (random() - 0.5) * 22;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

/** A roller shutter's slats, one tile 1 m across and 1 m down: horizontal ribs in galvanised grey, dirt in the grooves and a scuffed bottom. */
export function rollerShutterTexture(random) {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#a4a9ab';
    ctx.fillRect(0, 0, w, h);
    const n = 16;
    for (let i = 0; i < n; i++) {
      const y = (i * h) / n;
      const g = ctx.createLinearGradient(0, y, 0, y + h / n);
      g.addColorStop(0, 'rgba(255,255,255,0.3)');
      g.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, w, h / n);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(60,55,45,${0.05 + random() * 0.08})`;
      ctx.fillRect(random() * w, random() * h, 2 + random() * 12, 1 + random() * 20);
    }
  });
}

/** A board of `lines` of lettering on `ground` with a black border, the lines' sizes `sizes` px, for the warning board and the collection point's. Tile is the board. */
export function lettered(lines, { ground = '#f2c40f', ink = '#161412', sizes = [], w = 256, h = 192 } = {}) {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 8;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    const gap = (h - 24) / lines.length;
    lines.forEach((t, i) => {
      ctx.font = `bold ${sizes[i] ?? 30}px sans-serif`;
      ctx.fillText(t, w / 2, 20 + gap * (i + 0.7), w - 30);
    });
  });
}
