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
const SETTLED = { sunny: 0.85, fair: 0.7, overcast: 0.5, drizzle: 0.35, rain: 0.22, fog: 0.55 };

/**
 * The barometer's reading, 0 (stormy) to 1 (very dry), for the weather: `kind` (weather.js), `rain` falling now and `target` (where
 * the rain is heading). It falls ahead of rain coming on and lower still while it pours.
 */
export function baroReading(kind, rain, target) {
  const settled = SETTLED[kind] ?? 0.5;
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
    scene.add(this.group);
  }

  /** Redraws whatever has moved on: `hour` (time of day), `celsius`, and the weather (`kind`, `rain`, `target`). */
  update(hour, celsius, kind, rain, target) {
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
    const reading = Math.round(baroReading(kind, rain, target) * 100) / 100;
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
