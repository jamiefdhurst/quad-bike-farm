import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Instrument panels. Each quad picks a style from its spec:
//
//   classic: round analogue rev counter, green-backlit LCD (speed, fuel bar,
//            tap flag, trip) and separate warning lamps. Honda-ish.
//   modern:  one wide amber-on-black LCD with a bar-graph rev counter, big
//            speed digits, a vertical fuel gauge and warning icons drawn on
//            the display, in an angular pod with a visor. Yamaha-ish.
//   sport:   the same layout, compact, red-on-black, no visor, in a bare
//            pod. For the sport quad.
//
// buildDash(style) returns { group, update(state) } where state is
// { rpm, maxRpm, redline, speedMph, fuelLevel, reserveLevel, tap, coldLight,
//   ignition, tripMiles, reverse }. The group faces the rider along -Z and its
// +X is on the rider's left.

const DIAL_START_ANGLE = Math.PI * 0.75;
const DIAL_SWEEP = Math.PI * 1.5;
const DIAL_MAX_RPM = 10000;

const black = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 });
const charcoal = new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.45, metalness: 0.2 });
const faceMat = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.35 });

// Seven-segment digits ------------------------------------------------------

const SEGMENTS = {
  0: 'abcdef',
  1: 'bc',
  2: 'abdeg',
  3: 'abcdg',
  4: 'bcfg',
  5: 'acdfg',
  6: 'acdefg',
  7: 'abc',
  8: 'abcdefg',
  9: 'abcdfg',
  '-': 'g',
  ' ': '',
};

/** One seven-segment character, slanted slightly like a real LCD. Unlit segments are drawn faintly. */
function drawDigit(ctx, ch, x, y, w, h, on, ghost) {
  const t = Math.max(2, w * 0.17); // segment thickness
  const slant = w * 0.12;
  const lit = SEGMENTS[ch] ?? '';
  const sx = (px, py) => x + px + slant * (1 - py / h);
  const seg = {
    a: [[t * 0.6, 0], [w - t * 0.6, 0], [w - t * 1.4, t], [t * 1.4, t]],
    b: [[w, t * 0.6], [w, h / 2 - t * 0.4], [w - t, h / 2 - t * 0.1], [w - t, t * 1.3]],
    c: [[w, h / 2 + t * 0.4], [w, h - t * 0.6], [w - t, h - t * 1.3], [w - t, h / 2 + t * 0.1]],
    d: [[t * 1.4, h - t], [w - t * 1.4, h - t], [w - t * 0.6, h], [t * 0.6, h]],
    e: [[0, h / 2 + t * 0.4], [t, h / 2 + t * 0.1], [t, h - t * 1.3], [0, h - t * 0.6]],
    f: [[0, t * 0.6], [t, t * 1.3], [t, h / 2 - t * 0.1], [0, h / 2 - t * 0.4]],
    g: [[t * 0.8, h / 2], [t * 1.3, h / 2 - t / 2], [w - t * 1.3, h / 2 - t / 2], [w - t * 0.8, h / 2], [w - t * 1.3, h / 2 + t / 2], [t * 1.3, h / 2 + t / 2]],
  };
  for (const [name, pts] of Object.entries(seg)) {
    ctx.fillStyle = lit.includes(name) ? on : ghost;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(sx(px, py), y + py) : ctx.moveTo(sx(px, py), y + py)));
    ctx.closePath();
    ctx.fill();
  }
}

function drawNumber(ctx, text, x, y, w, h, gap, on, ghost) {
  [...text].forEach((ch, i) => {
    if (ch === '.') {
      ctx.fillStyle = on;
      ctx.fillRect(x + i * (w + gap) - gap * 0.8, y + h - w * 0.18, w * 0.18, w * 0.18);
      return;
    }
    drawDigit(ctx, ch, x + i * (w + gap), y, w, h, on, ghost);
  });
}

function padSpeed(mph) {
  return String(Math.min(99, Math.round(mph))).padStart(2, ' ');
}

function tripText(miles) {
  return (Math.floor(miles * 10) / 10).toFixed(1).padStart(5, ' ');
}

// Shared pieces ---------------------------------------------------------------

function canvasPanel(width, height, wMetres, hMetres) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(wMetres, hMetres),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  mesh.rotation.y = Math.PI;
  return { canvas, ctx: canvas.getContext('2d'), tex, mesh };
}

function dialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0c0c0c';
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#9a9a9a';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#c0221a';
  ctx.beginPath();
  ctx.arc(128, 128, 104, DIAL_START_ANGLE + DIAL_SWEEP * 0.75, DIAL_START_ANGLE + DIAL_SWEEP);
  ctx.stroke();
  ctx.fillStyle = '#eeeeee';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 10; i++) {
    const a = DIAL_START_ANGLE + (DIAL_SWEEP * i) / 10;
    ctx.strokeStyle = i >= 8 ? '#ff4433' : '#eeeeee';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112);
    ctx.lineTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92);
    ctx.stroke();
    if (i % 2 === 0) ctx.fillText(String(i), 128 + Math.cos(a) * 72, 128 + Math.sin(a) * 72);
  }
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText('x1000 rpm', 128, 180);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function labelTexture(text) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 48;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0e0e0e';
  ctx.fillRect(0, 0, 128, 48);
  ctx.fillStyle = '#cfcfcf';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 26);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function lamp(group, x, y, label, radius = 0.0085) {
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 16),
    new THREE.MeshBasicMaterial({ color: 0x1a1a1a, toneMapped: false }),
  );
  lens.position.set(x, y, -0.0372);
  lens.rotation.y = Math.PI;
  group.add(lens);
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.028, 0.0105),
    new THREE.MeshBasicMaterial({ map: labelTexture(label), toneMapped: false }),
  );
  plate.position.set(x, y - radius - 0.0075, -0.0372);
  plate.rotation.y = Math.PI;
  group.add(plate);
  return lens.material;
}

/** Redraws only when what's shown has actually changed. */
function changeGate() {
  let last = '';
  return (key) => {
    if (key === last) return false;
    last = key;
    return true;
  };
}

// Classic: analogue rev counter, green LCD, lamps ---------------------------------

function buildClassic() {
  const group = new THREE.Group();
  group.name = 'dash';
  const housing = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.135, 0.07, 3, 0.02), black);
  housing.name = 'dashHousing';
  group.add(housing);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.284, 0.12), faceMat);
  face.position.z = -0.0351;
  face.rotation.y = Math.PI;
  group.add(face);

  // Rev counter on the rider's left.
  const dialX = 0.083;
  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(0.05, 32),
    new THREE.MeshBasicMaterial({ map: dialTexture(), toneMapped: false }),
  );
  dial.name = 'rpmDial';
  dial.position.set(dialX, 0, -0.036);
  dial.rotation.y = Math.PI;
  group.add(dial);
  const needlePivot = new THREE.Group();
  needlePivot.name = 'rpmNeedle';
  needlePivot.position.set(dialX, 0, -0.038);
  needlePivot.rotation.y = Math.PI;
  group.add(needlePivot);
  const needle = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.0035, 0.001),
    new THREE.MeshBasicMaterial({ color: 0xff5522, toneMapped: false }),
  );
  needle.position.x = 0.019;
  needlePivot.add(needle);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.006, 12), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  cap.position.z = 0.0005;
  needlePivot.add(cap);

  // LCD on the right, lamps above it.
  const lcd = canvasPanel(256, 148, 0.13, 0.075);
  lcd.mesh.name = 'lcd';
  lcd.mesh.position.set(-0.05, -0.016, -0.0371);
  group.add(lcd.mesh);
  const tempLamp = lamp(group, -0.1, 0.046, 'TEMP');
  const ignLamp = lamp(group, -0.05, 0.046, 'IGN');
  const fuelLamp = lamp(group, 0.0, 0.046, 'FUEL');

  const gate = changeGate();
  let displayRpm = 0;

  function drawLcd(s) {
    const { ctx, canvas } = lcd;
    const W = canvas.width;
    const H = canvas.height;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, s.ignition ? '#b3c9a6' : '#6f7a6a');
    bg.addColorStop(1, s.ignition ? '#9fb592' : '#646e60');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const on = '#17241a';
    const ghost = s.ignition ? 'rgba(23,36,26,0.09)' : 'rgba(23,36,26,0.05)';
    if (!s.ignition) {
      drawNumber(ctx, '88', 20, 16, 52, 86, 12, ghost, ghost);
      return;
    }
    drawNumber(ctx, padSpeed(s.speedMph), 20, 16, 52, 86, 12, on, ghost);
    ctx.fillStyle = on;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('MPH', 148, 98);
    // Fuel bar, full at the top.
    const bars = 6;
    const lit = Math.ceil(s.fuelLevel * bars - 0.001);
    for (let i = 0; i < bars; i++) {
      ctx.fillStyle = i < lit ? on : ghost;
      ctx.fillRect(206, 96 - i * 15, 34, 10);
    }
    ctx.fillStyle = on;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('F', 222, 12);
    ctx.fillText('E', 194, 104);
    // Tap flag and trip.
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = s.tap === 'reserve' ? on : ghost;
    ctx.fillText('RES', 148, 30);
    ctx.fillStyle = s.tap === 'off' ? on : ghost;
    ctx.fillText('OFF', 148, 52);
    ctx.fillStyle = on;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('TRIP', 14, 136);
    drawNumber(ctx, tripText(s.tripMiles), 60, 118, 13, 22, 5, on, ghost);
    if (s.reverse) {
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('R', 182, 136);
    }
  }

  return {
    group,
    update(s) {
      displayRpm += (s.rpm - displayRpm) * 0.25;
      const frac = THREE.MathUtils.clamp(displayRpm / DIAL_MAX_RPM, 0, 1);
      needlePivot.rotation.z = -(DIAL_START_ANGLE + DIAL_SWEEP * frac);
      tempLamp.color.setHex(s.ignition && s.coldLight ? 0x2f7bff : 0x1a1a1a);
      ignLamp.color.setHex(s.ignition ? 0x33dd44 : 0x1a1a1a);
      fuelLamp.color.setHex(s.ignition && s.fuelLevel <= s.reserveLevel ? 0xffa020 : 0x1a1a1a);
      const key = [s.ignition, padSpeed(s.speedMph), Math.ceil(s.fuelLevel * 6 - 0.001), s.tap, tripText(s.tripMiles), s.reverse].join('|');
      if (gate(key)) {
        drawLcd(s);
        lcd.tex.needsUpdate = true;
      }
    },
  };
}

// Modern: one amber LCD in an angular pod ---------------------------------------

const MODERN = { width: 0.31, on: '#ffad3a', red: '#ff4a22', ghostRgb: '255,173,58', bg: '#100c07', visor: true };
const SPORT = { width: 0.27, on: '#ff5a46', red: '#ffffff', ghostRgb: '255,90,70', bg: '#0b0606', visor: false };

function buildModern(look = MODERN) {
  const group = new THREE.Group();
  group.name = 'dash';
  const housing = new THREE.Mesh(new RoundedBoxGeometry(look.width, 0.115, 0.065, 3, look.visor ? 0.012 : 0.02), look.visor ? charcoal : black);
  housing.name = 'dashHousing';
  group.add(housing);
  // Chamfered lower edge and a visor over the display.
  if (look.visor) {
    const chin = new THREE.Mesh(new RoundedBoxGeometry(0.25, 0.03, 0.06, 2, 0.01), charcoal);
    chin.position.set(0, -0.062, 0.006);
    chin.rotation.x = -0.5;
    group.add(chin);
    const visor = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.012, 0.05, 2, 0.005), charcoal);
    visor.position.set(0, 0.062, -0.04);
    visor.rotation.x = 0.35;
    visor.name = 'dashVisor';
    group.add(visor);
  }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(look.width - 0.02, 0.1), faceMat);
  face.position.z = -0.0326;
  face.rotation.y = Math.PI;
  group.add(face);

  const lcd = canvasPanel(512, 176, look.width - 0.048, 0.09);
  lcd.mesh.name = 'lcd';
  lcd.mesh.position.set(0, 0, -0.0331);
  group.add(lcd.mesh);

  const gate = changeGate();
  let displayRpm = 0;
  const BARS = 30;

  function drawIcon(ctx, kind, x, y, colour) {
    ctx.fillStyle = colour;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 3;
    if (kind === 'temp') {
      ctx.fillRect(x + 6, y, 6, 20);
      ctx.beginPath();
      ctx.arc(x + 9, y + 24, 7, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) ctx.fillRect(x + 14, y + 3 + i * 6, 6, 2);
    } else if (kind === 'fuel') {
      ctx.fillRect(x, y + 4, 14, 24);
      ctx.fillRect(x + 14, y + 8, 6, 3);
      ctx.fillRect(x + 18, y + 8, 3, 16);
      ctx.clearRect(x + 3, y + 7, 8, 7);
    } else if (kind === 'key') {
      ctx.beginPath();
      ctx.arc(x + 8, y + 14, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillRect(x + 14, y + 12, 14, 4);
      ctx.fillRect(x + 22, y + 16, 3, 6);
    }
  }

  function drawLcd(s) {
    const { ctx, canvas } = lcd;
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = s.ignition ? look.bg : '#0a0908';
    ctx.fillRect(0, 0, W, H);
    const on = look.on;
    const red = look.red;
    const ghost = s.ignition ? `rgba(${look.ghostRgb},0.08)` : `rgba(${look.ghostRgb},0.03)`;
    if (!s.ignition) {
      drawNumber(ctx, '88', 196, 64, 46, 80, 12, ghost, ghost);
      return;
    }
    // Bar-graph rev counter across the top, rising to the right.
    const litBars = Math.round((s.rpm / s.maxRpm) * BARS);
    const redFrom = Math.round((s.redline / s.maxRpm) * BARS);
    for (let i = 0; i < BARS; i++) {
      const x = 14 + i * 16;
      const h = 10 + (i / BARS) * 26;
      ctx.fillStyle = i < litBars ? (i >= redFrom ? red : on) : ghost;
      ctx.fillRect(x, 46 - h, 12, h);
    }
    ctx.fillStyle = on;
    ctx.font = 'bold 13px sans-serif';
    const k = Math.floor(s.maxRpm / 1000);
    for (let i = 0; i <= k; i++) ctx.fillText(String(i), 14 + (i / (s.maxRpm / 1000)) * BARS * 16, 62);
    ctx.fillText('x1000 r/min', 392, 62);

    // Speed in the middle.
    drawNumber(ctx, padSpeed(s.speedMph), 196, 70, 46, 80, 12, on, ghost);
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('mph', 312, 146);

    // Vertical fuel gauge on the right.
    const segs = 8;
    const lit = Math.ceil(s.fuelLevel * segs - 0.001);
    const low = s.fuelLevel <= s.reserveLevel;
    for (let i = 0; i < segs; i++) {
      ctx.fillStyle = i < lit ? (low ? red : on) : ghost;
      ctx.fillRect(460, 160 - i * 12, 34, 8);
    }
    ctx.fillStyle = on;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('F', 444, 80);
    ctx.fillText('E', 444, 168);
    drawIcon(ctx, 'fuel', 412, 130, low ? red : ghost);

    // Warning icons and flags on the left.
    drawIcon(ctx, 'temp', 18, 78, s.coldLight ? '#5ab0ff' : ghost);
    drawIcon(ctx, 'key', 50, 82, on);
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = s.tap === 'reserve' ? on : ghost;
    ctx.fillText('RES', 100, 100);
    ctx.fillStyle = s.tap === 'off' ? red : ghost;
    ctx.fillText('OFF', 148, 100);
    ctx.fillStyle = s.reverse ? on : ghost;
    ctx.fillText('R', 100, 126);
    ctx.fillStyle = on;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('TRIP', 18, 160);
    drawNumber(ctx, tripText(s.tripMiles), 60, 142, 13, 22, 5, on, ghost);
  }

  return {
    group,
    update(s) {
      displayRpm += (s.rpm - displayRpm) * 0.35;
      const key = [
        s.ignition,
        padSpeed(s.speedMph),
        Math.round((displayRpm / s.maxRpm) * BARS),
        Math.ceil(s.fuelLevel * 8 - 0.001),
        s.fuelLevel <= s.reserveLevel,
        s.tap,
        s.coldLight,
        tripText(s.tripMiles),
        s.reverse,
      ].join('|');
      if (gate(key)) {
        drawLcd({ ...s, rpm: displayRpm });
        lcd.tex.needsUpdate = true;
      }
    },
  };
}

export function buildDash(style = 'classic') {
  if (style === 'modern') return buildModern(MODERN);
  if (style === 'sport') return buildModern(SPORT);
  return buildClassic();
}
