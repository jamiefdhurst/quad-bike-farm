import * as THREE from 'three';
import { clockHands } from './daylight.js';

// The clock and the little weather station on the barn's north wall, by the door end of the bench: three round dials on a board, a
// clock, a thermometer and a barometer. The time and the temperature are the day's (daylight.js); the barometer reads the weather and
// falls ahead of rain, as a real one does. Each dial is drawn on a canvas and redrawn only when what it shows has moved on. The angles
// are pure and tested; the drawing needs a browser.

const SWEEP = 1.5 * Math.PI; // the thermometer and the barometer use three quarters of a turn, from bottom left round to bottom right
export const THERMO_RANGE = [-20, 40]; // degrees C round the thermometer's dial

/** The thermometer's needle for a temperature: radians clockwise from straight up. */
export function thermoAngle(celsius) {
  const [lo, hi] = THERMO_RANGE;
  const t = Math.min(1, Math.max(0, (celsius - lo) / (hi - lo)));
  return -SWEEP / 2 + SWEEP * t;
}

/** The words round a barometer, from low pressure to high. */
export const BARO_WORDS = ['Stormy', 'Rain', 'Change', 'Fair', 'Very dry'];

/** How settled each weather is, 0 (stormy) to 1 (very dry): where the barometer sits for it. */
const SETTLED = { sunny: 0.85, fair: 0.7, overcast: 0.5, drizzle: 0.35, rain: 0.22, fog: 0.55, snow: 0.4 };

/**
 * The barometer's reading, 0 (stormy) to 1 (very dry), for the weather: `kind` (weather.js), `rain` falling now and `target` (where
 * the rain is heading), and `from` and `mix` while it turns to `kind`. It falls ahead of rain coming on and lower still while it pours.
 */
export function baroReading(kind, rain, target, from = null, mix = 1) {
  const now = SETTLED[kind] ?? 0.5;
  // While the weather turns the glass moves across with the sky (it leads the rain, which comes part-way through).
  const settled = from ? (SETTLED[from] ?? 0.5) + (now - (SETTLED[from] ?? 0.5)) * Math.min(1, mix * 1.5) : now;
  return Math.min(1, Math.max(0, settled - 0.35 * Math.max(0, target - rain) - 0.15 * rain));
}

/** The barometer's needle for a reading: radians clockwise from straight up. */
export function baroAngle(reading) {
  return -SWEEP / 2 + SWEEP * Math.min(1, Math.max(0, reading));
}

const SIZE = 256;

function dialCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  return c;
}

/** The face: cream, a brass rim, ticks round `sweep` radians (a full turn for the clock), with labels. */
function drawFace(ctx, { sweep, ticks, labels, title }) {
  const r = SIZE / 2;
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = '#9a7a3c';
  ctx.beginPath();
  ctx.arc(r, r, r - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f1e9d2';
  ctx.beginPath();
  ctx.arc(r, r, r - 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a2622';
  ctx.fillStyle = '#2a2622';
  const start = sweep >= Math.PI * 2 - 1e-6 ? 0 : -sweep / 2;
  for (let i = 0; i <= ticks; i++) {
    if (sweep >= Math.PI * 2 - 1e-6 && i === ticks) break;
    const a = start + (sweep * i) / ticks;
    const big = i % (ticks / (labels.length - (sweep >= Math.PI * 2 - 1e-6 ? 0 : 1))) === 0;
    ctx.lineWidth = big ? 4 : 2;
    const r0 = r - 22;
    const r1 = r0 - (big ? 16 : 8);
    ctx.beginPath();
    ctx.moveTo(r + Math.sin(a) * r0, r - Math.cos(a) * r0);
    ctx.lineTo(r + Math.sin(a) * r1, r - Math.cos(a) * r1);
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const steps = sweep >= Math.PI * 2 - 1e-6 ? labels.length : labels.length - 1;
  labels.forEach((text, i) => {
    const a = start + (sweep * i) / steps;
    ctx.font = `${text.length > 3 ? 20 : 26}px Georgia, serif`;
    ctx.fillText(text, r + Math.sin(a) * (r - 62), r - Math.cos(a) * (r - 62));
  });
  if (title) {
    ctx.font = '18px Georgia, serif';
    ctx.fillText(title, r, r + 52);
  }
}

function drawHand(ctx, angle, length, width, colour) {
  const r = SIZE / 2;
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(r - Math.sin(angle) * 14, r + Math.cos(angle) * 14);
  ctx.lineTo(r + Math.sin(angle) * length, r - Math.cos(angle) * length);
  ctx.stroke();
}

function drawPin(ctx) {
  ctx.fillStyle = '#6d5526';
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, 8, 0, Math.PI * 2);
  ctx.fill();
}

const CHALK = '#ece8da';

function cloudShape(ctx, x, y, w) {
  ctx.beginPath();
  ctx.arc(x - w * 0.22, y, w * 0.2, 0, Math.PI * 2);
  ctx.arc(x + w * 0.05, y - w * 0.12, w * 0.26, 0, Math.PI * 2);
  ctx.arc(x + w * 0.3, y, w * 0.18, 0, Math.PI * 2);
  ctx.rect(x - w * 0.22, y, w * 0.52, w * 0.18);
  ctx.fill();
}

/** A weather picture in chalk (forecast.js SYMBOLS) centred on (x, y), about `w` wide. */
export function drawSymbol(ctx, symbol, x, y, w) {
  ctx.fillStyle = ctx.strokeStyle = CHALK;
  ctx.lineWidth = Math.max(2, w * 0.05);
  ctx.lineCap = 'round';
  const sun = (sx, sy, r) => {
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * r * 1.35, sy + Math.sin(a) * r * 1.35);
      ctx.lineTo(sx + Math.cos(a) * r * 1.75, sy + Math.sin(a) * r * 1.75);
      ctx.stroke();
    }
  };
  if (symbol === 'sun') sun(x, y, w * 0.2);
  else if (symbol === 'sunCloud') {
    sun(x - w * 0.14, y - w * 0.14, w * 0.14);
    cloudShape(ctx, x + w * 0.06, y + w * 0.1, w * 0.8);
  } else if (symbol !== 'fog') cloudShape(ctx, x, y - w * (symbol === 'cloud' ? 0 : 0.12), w * 0.8);
  if (symbol === 'drizzle' || symbol === 'rain') {
    const n = symbol === 'rain' ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const dx = x - w * 0.24 + (i / (n - 1)) * w * 0.48;
      ctx.beginPath();
      ctx.moveTo(dx, y + w * 0.12);
      ctx.lineTo(dx - w * 0.06, y + w * (symbol === 'rain' ? 0.34 : 0.26));
      ctx.stroke();
    }
  } else if (symbol === 'snow') {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x - w * 0.22 + i * w * 0.22, y + w * 0.26, w * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (symbol === 'fog') {
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - w * 0.34, y - w * 0.12 + i * w * 0.14);
      ctx.lineTo(x + w * 0.34, y - w * 0.12 + i * w * 0.14);
      ctx.stroke();
    }
  }
}

const SYMBOL_WORDS = { sun: 'Sunny', sunCloud: 'Sunny spells', cloud: 'Overcast', drizzle: 'Drizzle', rain: 'Rain', fog: 'Fog', snow: 'Snow' };

const HOURS = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

export class WeatherStation {
  /** On the barn's north wall at `at` ({ x, y, z }: the board's middle), facing into the barn (+z). */
  constructor(scene, at) {
    this.group = new THREE.Group();
    this.group.position.set(at.x, at.y, at.z);
    this.group.scale.setScalar(1.25); // big enough to read from the bench
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.36, 0.025), new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.8 }));
    board.position.z = 0.0125;
    this.group.add(board);
    this.dials = ['clock', 'thermo', 'baro'].map((name, i) => {
      const canvas = dialCanvas();
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.13, 40), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55 }));
      face.position.set(-0.29 + i * 0.29, 0, 0.027);
      this.group.add(face);
      // A rim standing proud of the board, and glass over it.
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.008, 6, 40), new THREE.MeshStandardMaterial({ color: 0xa8833e, metalness: 0.8, roughness: 0.35 }));
      rim.position.copy(face.position);
      this.group.add(rim);
      return { name, canvas, ctx: canvas.getContext('2d'), texture, shown: null };
    });
    // The forecast board hung under it: a slate with the morning, the afternoon and the evening (forecast.js).
    const slate = dialCanvas();
    slate.width = 512;
    slate.height = 160;
    const slateTexture = new THREE.CanvasTexture(slate);
    slateTexture.colorSpace = THREE.SRGBColorSpace;
    slateTexture.anisotropy = 4;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.32, 0.02), new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.8 }));
    frame.position.set(0, -0.37, 0.01);
    this.group.add(frame);
    const slateFace = new THREE.Mesh(new THREE.PlaneGeometry(0.9, (0.9 * 160) / 512), new THREE.MeshStandardMaterial({ map: slateTexture, roughness: 0.9 }));
    slateFace.position.set(0, -0.37, 0.0215);
    this.group.add(slateFace);
    this.slate = { canvas: slate, ctx: slate.getContext('2d'), texture: slateTexture, shown: null };
    scene.add(this.group);
  }

  /** Redraws the forecast board (forecast.js `board`) when what it shows has changed. */
  setForecast(slots) {
    const key = slots.map((s) => `${s.symbol}${s.past ? 'p' : ''}${s.now ? 'n' : ''}`).join();
    if (this.slate.shown === key) return;
    this.slate.shown = key;
    const { ctx, canvas } = this.slate;
    ctx.fillStyle = '#24302a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    const w = canvas.width / slots.length;
    slots.forEach((s, i) => {
      const cx = w * (i + 0.5);
      ctx.globalAlpha = s.past ? 0.35 : 1;
      ctx.fillStyle = CHALK;
      ctx.font = '26px "Comic Sans MS", cursive, sans-serif';
      ctx.fillText(s.label, cx, 32);
      drawSymbol(ctx, s.symbol, cx, 82, 90);
      ctx.font = '22px "Comic Sans MS", cursive, sans-serif';
      ctx.fillText(SYMBOL_WORDS[s.symbol] ?? '', cx, 148);
      if (s.now) {
        ctx.strokeStyle = CHALK;
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - w / 2 + 8, 6, w - 16, canvas.height - 12);
      }
      ctx.globalAlpha = 1;
    });
    this.slate.texture.needsUpdate = true;
  }

  /** Redraws whatever has moved on: `hour` (time of day), `celsius`, and the weather (`kind`, `rain`, `target`). */
  update(hour, celsius, kind, rain, target, from = null, mix = 1) {
    const [clock, thermo, baro] = this.dials;
    const minute = Math.floor(hour * 60);
    if (clock.shown !== minute) {
      clock.shown = minute;
      const { ctx } = clock;
      drawFace(ctx, { sweep: Math.PI * 2, ticks: 60, labels: HOURS });
      const h = clockHands(hour);
      drawHand(ctx, h.hour, 62, 9, '#1d1a17');
      drawHand(ctx, h.minute, 92, 5, '#1d1a17');
      drawPin(ctx);
      clock.texture.needsUpdate = true;
    }
    const tenth = Math.round(celsius * 2) / 2;
    if (thermo.shown !== tenth) {
      thermo.shown = tenth;
      const { ctx } = thermo;
      drawFace(ctx, { sweep: SWEEP, ticks: 30, labels: ['-20', '-10', '0', '10', '20', '30', '40'], title: '°C' });
      drawHand(ctx, thermoAngle(celsius), 90, 4, '#a3241c');
      drawPin(ctx);
      thermo.texture.needsUpdate = true;
    }
    const reading = Math.round(baroReading(kind, rain, target, from, mix) * 100) / 100;
    if (baro.shown !== reading) {
      baro.shown = reading;
      const { ctx } = baro;
      drawFace(ctx, { sweep: SWEEP, ticks: 20, labels: BARO_WORDS });
      drawHand(ctx, baroAngle(reading), 90, 4, '#1d1a17');
      drawPin(ctx);
      baro.texture.needsUpdate = true;
    }
  }
}
