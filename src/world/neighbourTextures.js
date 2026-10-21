// Painted canvases for the neighbour's yard (neighbourFarmProps.js): grained and painted timber, the front door, sash windows, ribbed
// plastic bins and a barrel, bark and sawn log ends, and the postbox's face. Nothing is loaded: each is drawn once at build time from the
// props' seeded random, one tile being a metre (or the size named) so worldBox can lay it over any shape.

import { canvasTexture } from './outbuildingProps.js';

const rgb = (r, g, b) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;

/** Bare timber: long grain streaks, a few knots and a darker weathered cast. `base` is [r, g, b]. One tile is a metre across. */
export function woodTexture(random, base = [112, 86, 58]) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgb(...base);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) {
      const x = random() * w;
      const shade = (random() - 0.5) * 46;
      ctx.fillStyle = `rgba(${shade > 0 ? '255,240,215' : '30,20,10'},${Math.abs(shade) / 160})`;
      ctx.fillRect(x, 0, 1 + random() * 2, h);
    }
    for (let i = 0; i < 4; i++) {
      const x = random() * w;
      const y = random() * h;
      ctx.strokeStyle = 'rgba(40,26,14,0.5)';
      ctx.lineWidth = 1;
      for (let r = 2; r < 9; r += 2) {
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.7, r * 1.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(30,22,14,0.35)'; // plank joints every quarter metre across
    for (let x = 0; x < w; x += w / 4) ctx.fillRect(x, 0, 2, h);
  });
}

/** Gloss paint on wood: the colour with brush streaks along the grain, the wood showing through where it has flaked and at the edges. */
export function paintedTexture(random, colour = '#e9e6dc') {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(${random() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + random() * 0.06})`;
      ctx.fillRect(random() * w, 0, 1 + random() * 2, h);
    }
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(${96 + random() * 30},${78 + random() * 24},${56},${0.35 + random() * 0.3})`;
      ctx.fillRect(random() * w, random() * h, 2 + random() * 5, 3 + random() * 14);
    }
    ctx.fillStyle = 'rgba(70,60,45,0.4)';
    ctx.fillRect(0, 0, 3, h);
    ctx.fillRect(w - 3, 0, 3, h);
  });
}

/** The front door, one tile being the whole door (0.9 by 2.05 m): four raised panels, a brass letterbox and a lock plate, in `colour`. */
export function doorTexture(random, colour = '#2d4a3a') {
  return canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(${random() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + random() * 0.05})`;
      ctx.fillRect(random() * w, 0, 1 + random() * 2, h);
    }
    const panel = (x, y, pw, ph) => {
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; // the moulding's shadow, top and left
      ctx.fillRect(x - 5, y - 5, pw + 10, ph + 10);
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; // and its lit edge, bottom and right
      ctx.fillRect(x - 1, y - 1, pw + 7, ph + 7);
      ctx.fillStyle = colour;
      ctx.fillRect(x, y, pw, ph);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(x + 8, y + 8, pw - 16, ph - 16);
    };
    panel(40, 40, 176, 150);
    panel(40, 216, 176, 120);
    panel(40, 360, 176, 110);
    ctx.fillStyle = '#b8a24a'; // letterbox
    ctx.fillRect(80, 200, 96, 14);
    ctx.fillStyle = '#6b5d28';
    ctx.fillRect(86, 204, 84, 4);
    ctx.fillStyle = '#b8a24a'; // lock plate
    ctx.fillRect(196, 330, 22, 48);
    ctx.fillStyle = '#3a3218';
    ctx.fillRect(203, 346, 8, 8);
  });
}

/** A sash window's glass, one tile being the window: six panes (two over two across, three tall) behind white glazing bars. `lit` draws it for the glow. */
export function sashTexture(lit = false) {
  return canvasTexture(128, 160, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    if (lit) {
      g.addColorStop(0, '#ffe3a3');
      g.addColorStop(1, '#d99a45');
    } else {
      g.addColorStop(0, '#3a4a52');
      g.addColorStop(0.5, '#1b2428');
      g.addColorStop(1, '#2c3b42');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = lit ? '#000' : '#ecebe3';
    const bar = 5;
    for (const x of [0, w / 2 - bar / 2, w - bar]) ctx.fillRect(x, 0, bar, h);
    for (const y of [0, h / 3 - bar / 2, (2 * h) / 3 - bar / 2, h - bar]) ctx.fillRect(0, y, w, bar);
  });
}

/** A wheelie bin's body in greyscale (the material's colour tints it): vertical ribs and a moulded band, one tile being the bin's side. */
export function binTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d6d6d6';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) {
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      ctx.fillRect(x, 10, 3, h - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + 3, 10, 2, h - 10);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 4, w, 5); // the rim under the lid
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; // house number, stencilled
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('14', w * 0.38, h * 0.55);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(30,28,20,${0.04 + random() * 0.08})`;
      ctx.fillRect(random() * w, random() * h, 1 + random() * 3, 2 + random() * 10);
    }
  });
}

/** A ribbed barrel (the water butt) in greyscale: horizontal ribs and two hoops. */
export function barrelTexture() {
  return canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d0d0d0';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) {
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(0, y, w, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(0, y + 2, w, 1);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, h * 0.18, w, 5);
    ctx.fillRect(0, h * 0.78, w, 5);
  });
}

/** Bark: deep vertical fissures in brown and grey with paler lichen flecks. One tile is a log's side. */
export function barkTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#5a4430';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = random() * w;
      const dark = random() < 0.6;
      ctx.fillStyle = dark ? `rgba(24,16,10,${0.3 + random() * 0.3})` : `rgba(140,118,90,${0.15 + random() * 0.2})`;
      ctx.fillRect(x, random() * h * 0.5, 1 + random() * 3, 20 + random() * h * 0.7);
    }
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(150,160,120,${0.2 + random() * 0.25})`;
      ctx.beginPath();
      ctx.arc(random() * w, random() * h, 1 + random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** The sawn end of a log: pale heartwood, growth rings, a split or two and a dark rim of bark. Fills a circle. */
export function logEndTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#4a3828';
    ctx.fillRect(0, 0, w, h);
    const c = w / 2;
    ctx.fillStyle = '#c9a572';
    ctx.beginPath();
    ctx.arc(c, c, c * 0.9, 0, Math.PI * 2);
    ctx.fill();
    for (let r = c * 0.85; r > 3; r -= 3 + random() * 3) {
      ctx.strokeStyle = `rgba(110,76,42,${0.35 + random() * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(c + (random() - 0.5) * 2, c + (random() - 0.5) * 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(50,34,18,0.7)';
    for (let i = 0; i < 2; i++) {
      const a = random() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(c + Math.cos(a) * c * 0.85, c + Math.sin(a) * c * 0.85);
      ctx.stroke();
    }
  });
}

/** The postbox's face (0.3 by 0.42 m): red cast iron with a raised border, a white plate of times and the slot's brass-edged recess. */
export function postboxTexture(random) {
  return canvasTexture(192, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b4141b';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(${random() < 0.5 ? '0,0,0' : '255,120,110'},${0.03 + random() * 0.06})`;
      ctx.fillRect(random() * w, random() * h, 2 + random() * 8, 1 + random() * 3);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = '#1a0608'; // the slot
    ctx.fillRect(34, 46, w - 68, 14);
    ctx.fillStyle = '#c9a54a';
    ctx.fillRect(30, 42, w - 60, 3);
    ctx.fillRect(30, 61, w - 60, 3);
    ctx.fillStyle = '#ecebe3'; // the collection plate
    ctx.fillRect(40, 150, w - 80, 70);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('LETTERS', 58, 172);
    ctx.font = '12px sans-serif';
    ctx.fillText('MON-SAT 4.15', 54, 192);
    ctx.fillText('SUN  NONE', 62, 210);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = 'bold 22px serif';
    ctx.fillText('GR', 78, 118); // a cipher: a king, not a maker
  });
}
