// The village's canvas textures (world/villageProps.js): brick and clay tiles for the houses, paving and the car park's painted bays, signwriting for
// the fascias and hanging signs, the road signs, the pumps' faces and price board, the shop's shelves and awning, the garage's roller door. All drawn
// in code; nothing is a real maker's or shop's name.

import { canvasTexture } from './outbuildingProps.js';
import { segText } from '../vehicle/dashParts.js';

const grain = (ctx, w, h, random, n, alpha = 0.08) => {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(${random() < 0.5 ? '255,255,255' : '0,0,0'},${alpha * (0.4 + random())})`;
    ctx.fillRect(random() * w, random() * h, 1 + random() * 2, 1 + random() * 2);
  }
};

/** Red-brown brick in stretcher bond, one tile being 1 m square (13 courses): each brick a little different, pale mortar, the odd dark header. */
export function brickTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b8b0a0';
    ctx.fillRect(0, 0, w, h);
    const rows = 13;
    const rh = h / rows;
    const bw = w / 5; // a whole number of bricks across, so the tile joins its neighbour with no seam
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bw * 0.5;
      for (let c = -1; c < 6; c++) {
        const t = random();
        const base = t < 0.12 ? [92, 52, 42] : t < 0.4 ? [150, 78, 56] : [168, 88, 62];
        const j = (random() - 0.5) * 22;
        ctx.fillStyle = `rgb(${base[0] + j},${base[1] + j * 0.6},${base[2] + j * 0.5})`;
        ctx.fillRect(c * bw + off + 1, r * rh + 1, bw - 2, rh - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(c * bw + off + 1, r * rh + rh - 2, bw - 2, 1.5);
      }
    }
    grain(ctx, w, h, random, 500, 0.1);
  });
}

/** Clay roof tiles, one tile being 1 m: rows of overlapping tiles, orange to brown, with moss in the lower courses and a few darker. */
export function clayTileTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#4a2a1c';
    ctx.fillRect(0, 0, w, h);
    const rows = 14;
    const rh = h / rows;
    const tw = w / 10;
    for (let r = 0; r < rows; r++) {
      for (let c = -1; c < 11; c++) {
        const t = random();
        const base = t < 0.15 ? [118, 66, 46] : t < 0.35 ? [170, 92, 58] : [190, 104, 64];
        const j = (random() - 0.5) * 26;
        ctx.fillStyle = `rgb(${base[0] + j},${base[1] + j * 0.6},${base[2] + j * 0.4})`;
        ctx.fillRect(c * tw + (r % 2) * tw * 0.5 + 1, r * rh + 1, tw - 2, rh - 1);
        if (random() < 0.12) {
          ctx.fillStyle = 'rgba(86,110,50,0.4)'; // moss
          ctx.fillRect(c * tw + (r % 2) * tw * 0.5 + 1, r * rh + 1, tw - 2, rh * 0.6);
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, r * rh + rh - 2, w, 2);
    }
  });
}

/** Paving slabs 0.6 m square, one tile 1.2 m: pale grey, joints, grit, the odd stain. */
export function pavingTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8f8d86';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const s = 150 + random() * 26;
        ctx.fillStyle = `rgb(${s},${s - 2},${s - 8})`;
        ctx.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
      }
    }
    grain(ctx, w, h, random, 900, 0.12);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = `rgba(40,36,30,${0.06 + random() * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(random() * w, random() * h, 6 + random() * 14, 4 + random() * 8, random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** The pub's car park from above, one texture over the whole rectangle (`wm` by `hm` metres): worn tarmac with white bay lines along the north edge, a disabled bay and the arrow at the entrance. */
export function carParkTexture(random, wm, hm) {
  const ppm = 24;
  return canvasTexture(Math.round(wm * ppm), Math.round(hm * ppm), (ctx, w, h) => {
    ctx.fillStyle = '#3f4042';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, random, 5000, 0.14);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(20,18,14,${0.06 + random() * 0.1})`;
      ctx.beginPath();
      ctx.ellipse(random() * w, random() * h, 6 + random() * 26, 5 + random() * 18, random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(235,235,225,0.85)';
    ctx.lineWidth = 3;
    const bays = 6;
    const bw = (w - 2 * ppm) / bays;
    for (let i = 0; i <= bays; i++) {
      ctx.beginPath();
      ctx.moveTo(ppm + i * bw, 0.2 * ppm);
      ctx.lineTo(ppm + i * bw, 5.2 * ppm);
      ctx.stroke();
    }
    ctx.beginPath(); // and a second row, back to back with the first on the far side
    ctx.moveTo(ppm, h - 0.2 * ppm);
    ctx.lineTo(ppm, h - 5.2 * ppm);
    for (let i = 1; i <= bays; i++) {
      ctx.moveTo(ppm + i * bw, h - 0.2 * ppm);
      ctx.lineTo(ppm + i * bw, h - 5.2 * ppm);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(40,90,180,0.75)'; // the disabled bay
    ctx.fillRect(ppm + 0.15 * bw, 0.4 * ppm, bw * 0.7, 4.7 * ppm);
    ctx.fillStyle = 'rgba(240,240,240,0.9)';
    ctx.beginPath();
    ctx.arc(ppm + bw / 2, 1.9 * ppm, 0.45 * ppm, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(ppm + bw / 2 - 0.12 * ppm, 2.2 * ppm, 0.24 * ppm, 1.6 * ppm);
    // The way in and out, an arrow along the middle.
    ctx.fillStyle = 'rgba(235,235,225,0.7)';
    const ay = h / 2;
    ctx.fillRect(w - 6 * ppm, ay - 0.12 * ppm, 4 * ppm, 0.24 * ppm);
    ctx.beginPath();
    ctx.moveTo(w - 2 * ppm, ay - 0.5 * ppm);
    ctx.lineTo(w - 1 * ppm, ay);
    ctx.lineTo(w - 2 * ppm, ay + 0.5 * ppm);
    ctx.fill();
  });
}

/** A hedge or clipped box: dense leaves in greens, one tile 1 m. */
export function hedgeTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2f4a22';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const g = 70 + random() * 70;
      ctx.fillStyle = `rgba(${30 + random() * 40},${g},${24 + random() * 24},0.8)`;
      ctx.beginPath();
      ctx.arc(random() * w, random() * h, 1.5 + random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

const rounded = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

/**
 * A painted fascia board, one texture over the whole board: `text` in signwriter's gold or cream on `bg`, a thin border, `sub` smaller beneath
 * (or beside it) and a rule. Shadowed letters, a little weathering.
 */
export function fasciaTexture(random, { text, sub = null, bg = '#1f3d2b', fg = '#e8d9a0', accent = '#b8923a', width = 1024, height = 160, font = 'bold 92px Georgia, serif' }) {
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(${random() < 0.5 ? '255,255,255' : '0,0,0'},${0.02 + random() * 0.04})`;
      ctx.fillRect(random() * w, 0, 1 + random() * 3, h);
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(18, 18, w - 36, h - 36);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font;
    const y = sub ? h * 0.42 : h / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(text, w / 2 + 4, y + 4);
    ctx.fillStyle = fg;
    ctx.fillText(text, w / 2, y);
    if (sub) {
      ctx.font = 'bold 38px Georgia, serif';
      ctx.fillStyle = accent;
      ctx.fillText(sub, w / 2, h * 0.8);
    }
    grain(ctx, w, h, random, 400, 0.1);
  });
}

/** The pub's hanging sign, one painted board (2:3 portrait, the same both sides): a plough and harrow on a field under a evening sky, the name on a scroll. */
export function pubSignTexture(random, name = 'The Plough & Harrow') {
  return canvasTexture(384, 512, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, '#2f4f78');
    sky.addColorStop(0.7, '#e9a65c');
    sky.addColorStop(1, '#f2cf8a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8c47a'; // the low sun
    ctx.beginPath();
    ctx.arc(w * 0.72, h * 0.5, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4c5f3a'; // far hills
    ctx.beginPath();
    ctx.moveTo(0, h * 0.58);
    ctx.bezierCurveTo(w * 0.2, h * 0.46, w * 0.4, h * 0.6, w * 0.6, h * 0.52);
    ctx.bezierCurveTo(w * 0.8, h * 0.46, w * 0.9, h * 0.56, w, h * 0.54);
    ctx.lineTo(w, h * 0.7);
    ctx.lineTo(0, h * 0.7);
    ctx.fill();
    const field = ctx.createLinearGradient(0, h * 0.58, 0, h);
    field.addColorStop(0, '#6b4a2c');
    field.addColorStop(1, '#3a2616');
    ctx.fillStyle = field;
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    ctx.strokeStyle = 'rgba(20,12,6,0.5)'; // furrows running to the horizon
    ctx.lineWidth = 3;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * 8, h * 0.62);
      ctx.lineTo(w / 2 + i * 62, h);
      ctx.stroke();
    }
    // The plough: a beam, a handle, a coulter and a share, dark against the sky.
    ctx.strokeStyle = '#1b1612';
    ctx.fillStyle = '#1b1612';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.16, h * 0.62);
    ctx.lineTo(w * 0.5, h * 0.55);
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.55);
    ctx.lineTo(w * 0.62, h * 0.43);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.4, h * 0.565);
    ctx.lineTo(w * 0.44, h * 0.66);
    ctx.lineTo(w * 0.56, h * 0.66);
    ctx.lineTo(w * 0.5, h * 0.57);
    ctx.fill();
    ctx.beginPath(); // the wheel
    ctx.lineWidth = 5;
    ctx.arc(w * 0.26, h * 0.65, 17, 0, Math.PI * 2);
    ctx.stroke();
    // The harrow beside it: a frame of crossed bars with tines.
    ctx.lineWidth = 5;
    ctx.strokeRect(w * 0.64, h * 0.64, w * 0.26, h * 0.1);
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(w * 0.64 + i * w * 0.052, h * 0.64);
      ctx.lineTo(w * 0.64 + i * w * 0.052, h * 0.745);
      ctx.stroke();
    }
    // The name on a scroll.
    ctx.fillStyle = '#efe0b0';
    rounded(ctx, 22, 28, w - 44, 92, 14);
    ctx.fill();
    ctx.strokeStyle = '#6b4a22';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#2a1a0c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = name.toUpperCase().split(' & ');
    ctx.font = 'bold 40px Georgia, serif';
    ctx.fillText(`${words[0]} &`, w / 2, 62);
    ctx.fillText(words[1] ?? '', w / 2, 100);
    ctx.fillStyle = '#efe0b0';
    ctx.font = 'italic 28px Georgia, serif';
    ctx.fillText('Ales & Good Food', w / 2, h - 52);
    ctx.font = '20px Georgia, serif';
    ctx.fillText('Est. 1743', w / 2, h - 24);
    ctx.strokeStyle = '#c8a24a';
    ctx.lineWidth = 8;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    grain(ctx, w, h, random, 700, 0.1);
  });
}

/** The village's entrance sign: a painted board with the name, a sheaf of wheat and "Please drive carefully", one texture over the board (3:2). */
export function villageSignTexture(random, name = 'Nether Thornby') {
  return canvasTexture(768, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f0ead6';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1f3d2b';
    rounded(ctx, 18, 18, w - 36, h - 36, 24);
    ctx.fill();
    ctx.strokeStyle = '#d6b24c';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#efe3b4';
    ctx.font = 'bold 70px Georgia, serif';
    ctx.fillText(name.toUpperCase(), w / 2, 130);
    ctx.strokeStyle = '#d6b24c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(90, 190);
    ctx.lineTo(w - 90, 190);
    ctx.stroke();
    // A sheaf of wheat: a bound bundle of ears fanned out.
    ctx.strokeStyle = '#d6b24c';
    ctx.fillStyle = '#d6b24c';
    ctx.lineWidth = 4;
    for (let k = -4; k <= 4; k++) {
      ctx.beginPath();
      ctx.moveTo(w / 2, 400);
      ctx.quadraticCurveTo(w / 2 + k * 14, 330, w / 2 + k * 30, 250);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(w / 2 + k * 30, 242, 6, 15, k * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 36, 352);
    ctx.lineTo(w / 2 + 36, 352);
    ctx.stroke();
    ctx.fillStyle = '#efe3b4';
    ctx.font = 'italic 34px Georgia, serif';
    ctx.fillText('Please drive carefully', w / 2, 448);
    ctx.font = '22px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('Parish of', 56, 232);
    ctx.fillText('Thornby', 56, 258);
    ctx.textAlign = 'right';
    ctx.fillText('Best Kept', w - 56, 232);
    ctx.fillText('Village', w - 56, 258);
    grain(ctx, w, h, random, 800, 0.08);
  });
}

/** A round speed limit sign, red ring, white face, black number. */
export function limitSignTexture(mph = 20) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#9a9ea0'; // the back, showing round the edge if the face is a little small
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 124, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c4171d';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 106, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 110px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(mph), w / 2, h / 2 + 6);
  });
}

/** A "road closed" board: red and white diagonal bars either side of the words. */
export function roadClosedTexture() {
  return canvasTexture(512, 192, (ctx, w, h) => {
    ctx.fillStyle = '#f2f2ee';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c4171d';
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    for (let x = -h; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + 32, h);
      ctx.lineTo(x + 32 + h, 0);
      ctx.lineTo(x + h, 0);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#f2f2ee';
    ctx.fillRect(40, 40, w - 80, h - 80);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 54px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ROAD CLOSED', w / 2, h / 2 - 12);
    ctx.font = '26px Arial, Helvetica, sans-serif';
    ctx.fillText('Flooding ahead', w / 2, h / 2 + 34);
  });
}

const LED_RED = { on: '#ff3b2a', ghost: '#3a0f0c' };
const LED_GREEN = { on: '#6dff7d', ghost: '#0e3a16' };

/** A dark display window at (x, y) `w` by `h` with seven-segment `text` in it, right-aligned, the unlit segments faintly showing (as the quads' dashes do). */
function ledWindow(ctx, text, x, y, w, h, { on, ghost }) {
  ctx.fillStyle = '#080a0c';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#7d7f7c';
  ctx.lineWidth = 5;
  ctx.strokeRect(x, y, w, h);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  const dh = h - 24;
  segText(ctx, text, x + w - 14, y + 12, dh, on, ghost);
}

/**
 * A petrol pump's face (2:3): the grade in a coloured band, then three dark windows of seven-segment digits (the money and the litres in red, the
 * price in pence a litre in green) with a short caption to the left of each, and the pay-inside plate under them.
 */
export function pumpFaceTexture(grade, band, price) {
  return canvasTexture(384, 576, (ctx, w, h) => {
    ctx.fillStyle = '#e8e8e2';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, w, 110);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(grade, w / 2, 56);
    const row = (y, label, text, colour) => {
      ledWindow(ctx, text, 112, y, 252, 92, colour);
      ctx.fillStyle = '#2a2a2a';
      ctx.textAlign = 'left';
      ctx.font = 'bold 21px Arial, Helvetica, sans-serif';
      ctx.fillText(label, 14, y + 46);
    };
    row(132, '£', '  0.00', LED_RED);
    row(240, 'LITRES', '  0.00', LED_RED);
    row(348, 'PENCE/L', `${Math.round(parseFloat(price) * 100)}.9`, LED_GREEN);
    ctx.fillStyle = '#9a9a92';
    ctx.fillRect(24, 468, w - 48, 52);
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Arial, Helvetica, sans-serif';
    ctx.fillText('LIFT NOZZLE · PAY INSIDE', w / 2, 494);
  });
}

/** A pump's side panel (about 1:3.2): white enamel with a stripe in the grade's colour, a vent grille, a hazard plate and a small name. */
export function pumpSideTexture(band) {
  return canvasTexture(128, 416, (ctx, w, h) => {
    ctx.fillStyle = '#e4e4de';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = band;
    ctx.fillRect(0, 30, w, 22);
    ctx.fillStyle = '#c8c8c0';
    ctx.fillRect(10, 74, w - 20, 120);
    ctx.fillStyle = '#6a6a64';
    for (let y = 82; y < 190; y += 9) ctx.fillRect(16, y, w - 32, 4); // the louvres
    ctx.fillStyle = '#e8c23a';
    ctx.fillRect(14, 230, w - 28, 54);
    ctx.fillStyle = '#16161a';
    ctx.font = 'bold 15px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NO SMOKING', w / 2, 247);
    ctx.fillText('ENGINE OFF', w / 2, 266);
    ctx.fillStyle = '#3a3d40';
    ctx.font = 'bold 17px Arial, Helvetica, sans-serif';
    ctx.fillText('HOLLIS', w / 2, 330);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, h - 70, w, 70); // the dirt that splashes up
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(60,50,40,${0.04 + Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * w, h - 90 + Math.random() * 90, 2 + Math.random() * 6, 2 + Math.random() * 12);
    }
  });
}

/** The strip across the pump's head (about 4:1): the name on the grade's colour. */
export function pumpHeaderTexture(band) {
  return canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#f2f2ec';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, 22, h);
    ctx.fillRect(w - 22, 0, 22, h);
    ctx.fillStyle = '#1b2a44';
    ctx.font = 'bold 40px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOLLIS', w / 2, h / 2 + 2);
  });
}

/** A yellow post, painted and scuffed, with a black band and a white reflector strip near the top. One tile wraps round once. */
export function bollardTexture(random) {
  return canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e0b92c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#17171a';
    ctx.fillRect(0, h * 0.18, w, h * 0.1);
    ctx.fillStyle = '#e9e9e2';
    ctx.fillRect(0, h * 0.3, w, h * 0.08);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(${random() < 0.5 ? '40,30,10' : '255,240,180'},${0.05 + random() * 0.15})`;
      ctx.fillRect(random() * w, h * 0.4 + random() * h * 0.6, 1 + random() * 4, 1 + random() * 9);
    }
    const g = ctx.createLinearGradient(0, h * 0.7, 0, h);
    g.addColorStop(0, 'rgba(50,40,30,0)');
    g.addColorStop(1, 'rgba(50,40,30,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);
  });
}

/** A packet off the parts rack (4:3 or so): the colour of the part, a white label with its name, and a simple picture of it. */
export function partPacketTexture(label, colour, kind) {
  return canvasTexture(256, 192, (ctx, w, h) => {
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, w, 14);
    ctx.fillRect(0, h - 10, w, 10);
    ctx.fillStyle = '#f4f1e6';
    ctx.fillRect(14, 26, w - 28, 46);
    ctx.fillStyle = '#16161a';
    ctx.font = 'bold 30px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, 50);
    ctx.fillStyle = '#f4f1e6';
    ctx.strokeStyle = '#f4f1e6';
    ctx.lineWidth = 8;
    const cx = w / 2;
    const cy = 128;
    if (kind === 'plug') {
      ctx.fillRect(cx - 9, cy - 38, 18, 30);
      ctx.fillRect(cx - 20, cy - 8, 40, 14);
      ctx.fillRect(cx - 7, cy + 6, 14, 28);
      ctx.fillRect(cx - 1.5, cy + 34, 3, 12);
    } else if (kind === 'tube') {
      ctx.beginPath();
      ctx.ellipse(cx, cy, 48, 32, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillRect(cx - 5, cy - 46, 10, 16);
    } else {
      ctx.beginPath();
      ctx.ellipse(cx, cy, 70, 30, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 3;
      for (let x = cx - 62; x <= cx + 62; x += 10) {
        ctx.beginPath();
        ctx.moveTo(x, cy - 27 * Math.sqrt(Math.max(0, 1 - ((x - cx) / 70) ** 2)) - 4);
        ctx.lineTo(x, cy - 27 * Math.sqrt(Math.max(0, 1 - ((x - cx) / 70) ** 2)) + 4);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, w - 8, h - 8);
  });
}

/** The garage's price board on its post: the name, the grades and today's prices in £ a litre. */
export function priceBoardTexture(random, name, rows) {
  return canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1b2a44';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e8c23a';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8c23a';
    ctx.font = 'bold 42px Georgia, serif';
    ctx.fillText(name.split(' ')[0].toUpperCase(), w / 2, 56);
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText(name.split(' ').slice(1).join(' ').toUpperCase(), w / 2, 100);
    rows.forEach((r, i) => {
      const y = 170 + i * 110;
      ctx.fillStyle = r.band;
      ctx.fillRect(22, y - 38, w - 44, 28);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px Arial, Helvetica, sans-serif';
      ctx.fillText(r.label, w / 2, y - 24);
      ledWindow(ctx, `${Math.round(parseFloat(r.price) * 100)}.9`, 22, y - 8, w - 44, 70, LED_GREEN);
    });
    ctx.fillStyle = '#cfd6e2';
    ctx.font = '22px Arial, Helvetica, sans-serif';
    ctx.fillText('PENCE PER LITRE', w / 2, h - 36);
    grain(ctx, w, h, random, 300, 0.08);
  });
}

/** A striped shop awning: cream and green bands running down the slope, with the scalloped valance in the bottom fifth. */
export function awningTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    const bands = 8;
    const bw = w / bands;
    const slope = h * 0.8;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i % 2 ? '#f1ead2' : '#2c6b45';
      ctx.fillRect(i * bw, 0, bw, h);
    }
    ctx.clearRect(0, slope, w, h - slope);
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i % 2 ? '#f1ead2' : '#2c6b45';
      ctx.beginPath();
      ctx.moveTo(i * bw, slope - 1);
      ctx.lineTo((i + 1) * bw, slope - 1);
      ctx.lineTo((i + 1) * bw, slope + 10);
      ctx.arc(i * bw + bw / 2, slope + 10, bw / 2, 0, Math.PI);
      ctx.fill();
    }
  });
}

/** The shop's stock seen through its window and open door: shelves of tins, boxes and bottles in a few colours. Drawn once, lit or not. */
export function shopInteriorTexture(random, lit = false) {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = lit ? '#f4e6b8' : '#2a2a28';
    ctx.fillRect(0, 0, w, h);
    const cols = ['#b4282b', '#2f6a9a', '#e0b13a', '#3f8a52', '#d8d4c4', '#7a4a9a', '#e0762c'];
    for (let shelf = 0; shelf < 4; shelf++) {
      const y = 20 + shelf * 58;
      for (let x = 6; x < w - 14; ) {
        const bw = 12 + random() * 20;
        const bh = 22 + random() * 24;
        ctx.fillStyle = cols[Math.floor(random() * cols.length)];
        ctx.globalAlpha = lit ? 0.95 : 0.45;
        ctx.fillRect(x, y + 40 - bh, bw, bh);
        ctx.globalAlpha = 1;
        x += bw + 2;
      }
      ctx.fillStyle = lit ? '#8a6a3a' : '#171512';
      ctx.fillRect(0, y + 40, w, 6);
    }
  });
}

/** An A-board's chalk: the lines on a dark board, in a hand. */
export function chalkBoardTexture(random, lines) {
  return canvasTexture(256, 384, (ctx, w, h) => {
    ctx.fillStyle = '#26302c';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 12;
    ctx.strokeRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 20; i++) ctx.fillRect(random() * w, random() * h, 40 + random() * 80, 8 + random() * 14);
    ctx.fillStyle = '#efeadb';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => {
      ctx.font = `${i === 0 ? 'bold 46px' : '34px'} "Comic Sans MS", "Chalkboard SE", cursive`;
      ctx.fillText(l, w / 2, 70 + i * (h - 110) / Math.max(1, lines.length));
    });
  });
}

/** The garage's workshop door, one tile being the whole door: grey horizontal slats, a window strip, dents, grime at the foot. */
export function rollerDoorTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#9ba0a2';
    ctx.fillRect(0, 0, w, h);
    const n = 14;
    for (let i = 0; i < n; i++) {
      const y = (i * h) / n;
      const s = 150 + random() * 20;
      ctx.fillStyle = `rgb(${s},${s + 3},${s + 6})`;
      ctx.fillRect(0, y + 1, w, h / n - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, y + h / n - 2, w, 2);
    }
    ctx.fillStyle = '#20282e';
    for (let i = 0; i < 4; i++) ctx.fillRect(30 + i * 52, h / n * 2 + 1, 44, h / n - 2); // the windows
    const g = ctx.createLinearGradient(0, h * 0.7, 0, h);
    g.addColorStop(0, 'rgba(30,24,18,0)');
    g.addColorStop(1, 'rgba(30,24,18,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);
    grain(ctx, w, h, random, 500, 0.1);
  });
}

/** A telephone box's glazing: eight panes a side behind red bars (one texture is one face). */
export function phoneGlassTexture(lit = false) {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = lit ? '#f4e2a8' : '#25323a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#b4141b';
    const bar = 6;
    for (let i = 0; i <= 3; i++) ctx.fillRect((i * (w - bar)) / 3, 0, bar, h);
    for (let j = 0; j <= 8; j++) ctx.fillRect(0, (j * (h - bar)) / 8, w, bar);
  });
}

/** A timetable or notice behind glass: a white sheet with lines of small print. */
export function noticeTexture(random, heading, lines = 9) {
  return canvasTexture(192, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f2efe2';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1f3a6b';
    ctx.fillRect(0, 0, w, 44);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(heading, w / 2, 24);
    ctx.fillStyle = '#333';
    for (let i = 0; i < lines; i++) ctx.fillRect(14, 62 + i * 20, 90 + random() * (w - 120), 5);
  });
}
