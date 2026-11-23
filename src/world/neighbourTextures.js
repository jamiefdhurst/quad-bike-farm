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

/** A colour with alpha, for the standing trees' bark. */
const rgba = (r, g, b, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;

/**
 * Bark by `kind`: 'oak' deep brown with wide furrows, 'elm' dead and bleached (grey wood, peeling, beetle galleries), 'ash' pale grey with diamond-crossing fissures, 'alder' dark
 * brown-grey and rough with lighter cracked plates, 'willow' deep grey ridges. One tile is a metre of trunk.
 */
function treeBarkTexture(random, kind) {
  const base = { oak: [88, 72, 54], elm: [128, 120, 108], ash: [124, 122, 112], alder: [74, 62, 52], willow: [86, 78, 66] }[kind] ?? [100, 90, 80];
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = rgba(...base);
    ctx.fillRect(0, 0, w, h);
    const fissures = kind === 'ash' ? 70 : 110;
    for (let i = 0; i < fissures; i++) {
      const x = random() * w;
      const y = random() * h;
      const len = 14 + random() * (kind === 'willow' ? 90 : 60);
      ctx.strokeStyle = rgba(24, 20, 16, 0.3 + random() * 0.3);
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
      ctx.fillStyle = l ? rgba(210, 205, 190, 0.1 + random() * 0.12) : rgba(0, 0, 0, 0.08 + random() * 0.1);
      ctx.fillRect(random() * w, random() * h, 1 + random() * 4, 4 + random() * 22);
    }
    if (kind === 'elm') {
      // Where the bark has come away: long pale strips of bare wood with fine dark galleries across them, and a few dark knots.
      for (let i = 0; i < 9; i++) {
        const x = random() * (w - 20);
        const y = random() * h * 0.8;
        ctx.fillStyle = rgba(196, 188, 170, 0.8);
        ctx.fillRect(x, y, 10 + random() * 16, 30 + random() * 80);
        for (let k = 0; k < 24; k++) {
          ctx.strokeStyle = rgba(70, 56, 40, 0.5);
          ctx.beginPath();
          ctx.moveTo(x + random() * 20, y + random() * 90);
          ctx.lineTo(x + random() * 20, y + random() * 90);
          ctx.stroke();
        }
      }
    }
    if (kind === 'alder' || kind === 'willow') {
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = rgba(110, 130, 70, 0.22);
        ctx.beginPath();
        ctx.arc(random() * w, random() * h, 2 + random() * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** Bark: deep vertical fissures in brown and grey with paler lichen flecks. One tile is a log's side. `kind` 'oak', 'elm', 'ash', 'alder' or 'willow' paints a standing tree's (a tile a metre of trunk, #815). */
export function barkTexture(random, kind = 'log') {
  if (kind !== 'log') return treeBarkTexture(random, kind);
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

/**
 * The face of a trailhead marker post: weathered grey oak grain with a green damp foot, and `lines` routed into it (a dark cut with a little cream paint in the
 * bottom of each letter, no border). The canvas is the whole face, `faceW` by `faceH` m; the lines are centred in `box` ([top, bottom] as fractions of the height)
 * and each is shrunk until it fits inside the face with `margin` m to spare.
 */
export function routedPostTexture(random, { faceW, faceH, lines, box, margin = 0.02 }) {
  return canvasTexture(256, Math.round(256 * (faceH / faceW)), (ctx, w, h) => {
    ctx.fillStyle = rgb(132, 126, 114);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const shade = (random() - 0.5) * 60;
      ctx.fillStyle = `rgba(${shade > 0 ? '225,220,205' : '35,32,26'},${Math.abs(shade) / 170})`;
      ctx.fillRect(random() * w, 0, 1 + random() * 2, h);
    }
    const foot = ctx.createLinearGradient(0, h * 0.82, 0, h); // the damp green foot
    foot.addColorStop(0, 'rgba(70,92,44,0)');
    foot.addColorStop(1, 'rgba(70,92,44,0.8)');
    ctx.fillStyle = foot;
    ctx.fillRect(0, h * 0.82, w, h * 0.18);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const top = box[0] * h;
    const step = ((box[1] - box[0]) * h) / lines.length;
    const room = w * (1 - (2 * margin) / faceW);
    lines.forEach((text, i) => {
      let px = step * 0.9;
      do ctx.font = `bold ${px--}px Georgia, serif`;
      while (ctx.measureText(text).width > room && px > 8);
      const y = top + step * (i + 0.5);
      ctx.fillStyle = 'rgba(28,22,14,0.9)'; // the cut
      ctx.fillText(text, w / 2 + 1.5, y + 1.5);
      ctx.fillStyle = 'rgba(214,206,176,0.85)'; // the paint in it
      ctx.fillText(text, w / 2, y);
    });
  });
}

/** A small oak plate with one line of lettering painted on it, `plateW` by `plateH` m. */
export function platedTexture(random, text, { plateW, plateH }) {
  return canvasTexture(256, Math.round(256 * (plateH / plateW)), (ctx, w, h) => {
    ctx.fillStyle = rgb(104, 86, 62);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(30,20,10,${random() * 0.2})`;
      ctx.fillRect(0, random() * h, w, 1);
    }
    ctx.fillStyle = '#e4dcc0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let px = h * 0.6;
    do ctx.font = `bold ${px--}px Georgia, serif`;
    while (ctx.measureText(text).width > w * 0.9 && px > 8);
    ctx.fillText(text, w / 2, h / 2);
  });
}

// The upland farmhouse (neighbourFarmProps.js `buildFarmhouse`) ------------------------------------------------------------------------

/** Dressed gritstone: the squared, paler blocks of lintels, mullions, drip hoods, copings and surrounds, with fine tooling lines and a little soot. One tile is a metre. */
export function dressedStoneTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b3ab99';
    ctx.fillRect(0, 0, w, h);
    let y = 0;
    while (y < h) {
      const ch = 40 + random() * 30;
      let x = -random() * 50;
      while (x < w) {
        const sw = 70 + random() * 80;
        const s = 150 + random() * 32;
        ctx.fillStyle = rgb(s + 8, s + 2, s - 14);
        ctx.fillRect(x + 1.5, y + 1.5, sw - 3, ch - 3);
        ctx.strokeStyle = 'rgba(70,64,50,0.16)'; // the chisel's lines
        for (let k = 0; k < 7; k++) {
          const ly = y + 5 + random() * (ch - 10);
          ctx.beginPath();
          ctx.moveTo(x + 4, ly);
          ctx.lineTo(x + sw - 4, ly + random() * 2 - 1);
          ctx.stroke();
        }
        x += sw;
      }
      y += ch;
    }
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(30,28,22,${0.05 + random() * 0.1})`; // soot and rain streaks
      ctx.fillRect(random() * w, random() * h, 1 + random() * 2, 10 + random() * 40);
    }
  });
}

/** Rough, darker gritstone of the 1700s, in uneven courses with lichen and a damp band at the foot. One tile is two metres. */
export function oldStoneTexture(random) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#6f695c';
    ctx.fillRect(0, 0, w, h);
    let y = 0;
    while (y < h) {
      const ch = 26 + random() * 34;
      let x = -random() * 60;
      while (x < w) {
        const sw = 40 + random() * 90;
        const s = 92 + random() * 52;
        ctx.fillStyle = rgb(s + random() * 12, s + random() * 6, s - 10);
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, sw - 4, ch - 4, 4);
        ctx.fill();
        x += sw;
      }
      y += ch;
    }
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = random() < 0.5 ? `rgba(150,160,95,${0.15 + random() * 0.2})` : `rgba(30,30,20,${0.08 + random() * 0.12})`;
      ctx.beginPath();
      ctx.arc(random() * w, random() * h, 3 + random() * 13, 0, Math.PI * 2);
      ctx.fill();
    }
    const g = ctx.createLinearGradient(0, h, 0, h * 0.8); // damp at the foot
    g.addColorStop(0, 'rgba(25,25,20,0.3)');
    g.addColorStop(1, 'rgba(25,25,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.8, w, h * 0.2);
  });
}

/** The later wing's stone: paler, yellower, squarer and tidier than the old wall. One tile is two metres. */
export function newStoneTexture(random) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#a79d82';
    ctx.fillRect(0, 0, w, h);
    const ch = 34;
    for (let y = 0; y < h; y += ch) {
      let x = -((y / ch) % 2) * 40;
      while (x < w) {
        const sw = 70 + random() * 40;
        const s = 160 + random() * 26;
        ctx.fillStyle = rgb(s + 12, s + 4, s - 28);
        ctx.fillRect(x + 1.5, y + 1.5, sw - 3, ch - 3);
        x += sw;
      }
    }
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = `rgba(60,55,40,${0.04 + random() * 0.08})`;
      ctx.fillRect(random() * w, random() * h, 2 + random() * 3, 20 + random() * 60);
    }
  });
}

/** Stone slates: thick, uneven, in courses that shrink to the ridge, grey with ochre and green lichen and a few that have slipped. One tile is two metres, courses running across. */
export function stoneSlateTexture(random) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#2f3234';
    ctx.fillRect(0, 0, w, h);
    let y = 0;
    let n = 0;
    while (y < h) {
      const ch = 38 - n * 1.6 + random() * 6;
      let x = -random() * 50;
      while (x < w) {
        const sw = 46 + random() * 56;
        const s = 62 + random() * 36;
        const lichen = random() < 0.22;
        ctx.fillStyle = lichen ? rgb(s + 30, s + 28, s - 6) : rgb(s, s + 4, s + 7);
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 2 + random() * 3);
        ctx.lineTo(x + sw - 2, y + 2 + random() * 3);
        ctx.lineTo(x + sw - 1, y + ch + random() * 3);
        ctx.lineTo(x + 1, y + ch + random() * 3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; // the shadow under each course's lip
        ctx.fillRect(x + 2, y + ch - 3, sw - 4, 3);
        x += sw;
      }
      y += ch;
      n = (n + 1) % 10;
    }
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(140,150,80,${0.1 + random() * 0.2})`;
      ctx.beginPath();
      ctx.arc(random() * w, random() * h, 4 + random() * 12, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Limewash over stone, peeling: cream, grey where the rain runs, and patches gone to show the stone underneath. One tile is two metres. */
export function limewashTexture(random) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#dcd5c0';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(120,110,85,${0.04 + random() * 0.08})`;
      ctx.fillRect(random() * w, random() * h * 0.5, 2 + random() * 6, 40 + random() * 220);
    }
    for (let i = 0; i < 16; i++) { // peeled patches: the stone shows, ragged
      const px = random() * w;
      const py = random() * h;
      const r = 14 + random() * 36;
      ctx.fillStyle = '#756f60';
      ctx.beginPath();
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        const rr = r * (0.6 + random() * 0.7);
        ctx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.7);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(190,182,160,0.5)';
      ctx.fillRect(px - r * 0.5, py - 2, r, 3);
    }
    const g = ctx.createLinearGradient(0, h, 0, h * 0.75); // splashed and damp at the foot
    g.addColorStop(0, 'rgba(60,55,40,0.4)');
    g.addColorStop(1, 'rgba(60,55,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.75, w, h * 0.25);
  });
}

/** Cast iron painted black, rust coming through at the joints and in streaks. One tile is a metre. */
export function castIronTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1f2325';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${130 + random() * 40},${60 + random() * 30},30,${0.25 + random() * 0.4})`;
      ctx.fillRect(random() * w, random() * h, 1 + random() * 3, 6 + random() * 40);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 2, h);
  });
}

/** A small lawn with daisies and a few worn bare patches, one tile being two metres. */
export function lawnTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#566b3a';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(${60 + random() * 50},${90 + random() * 50},${40 + random() * 30},0.5)`;
      ctx.fillRect(random() * w, random() * h, 1.5, 4 + random() * 5);
    }
    for (let i = 0; i < 25; i++) {
      ctx.fillStyle = random() < 0.7 ? '#f1eee2' : '#e8c23a';
      ctx.fillRect(random() * w, random() * h, 3, 3);
    }
  });
}

/** Bedding flowers in a trough, seen from above and the front: dense green with red, white and yellow blooms. One tile is a metre. */
export function flowersTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3d5a2c';
    ctx.fillRect(0, 0, w, h);
    const colours = ['#c8302e', '#f2efe4', '#e5b82f', '#c8302e', '#8a4a9a'];
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = colours[Math.floor(random() * colours.length)];
      ctx.beginPath();
      ctx.arc(random() * w, random() * h, 2.5 + random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** The sawn ends of a stack of split logs seen end on: rows of pale discs with rings and dark gaps between. One tile is a metre square. */
export function logStackTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2a1f16';
    ctx.fillRect(0, 0, w, h);
    const r = 17;
    for (let row = 0; row * r * 1.8 < h + r; row++) {
      for (let col = -1; col * r * 2 < w + r; col++) {
        const x = col * r * 2 + (row % 2) * r + (random() - 0.5) * 3;
        const y = row * r * 1.8 + (random() - 0.5) * 3;
        const rr = r * (0.82 + random() * 0.16);
        ctx.fillStyle = `rgb(${190 + random() * 25},${150 + random() * 25},${100 + random() * 20})`;
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(110,76,42,0.5)';
        ctx.beginPath();
        ctx.arc(x, y, rr * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, rr * 0.25, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  });
}
