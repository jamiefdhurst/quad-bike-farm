import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Instrument panels. Each quad picks a style from its spec:
//
//   classic: three chrome-ringed analogue dials in a pill-shaped pod: rev
//            counter, speedo with a trip counter, and a fuel gauge with the
//            tap position, plus lamps set into the dials. Honda-ish.
//   modern:  one wide amber-on-black LCD with a bar-graph rev counter, big
//            speed digits, a vertical fuel gauge and warning icons drawn on
//            the display, in a rounded pod with a curved visor. Yamaha-ish.
//   sport:   the same layout, compact, red-on-black, no visor, in a rounder
//            bare pod. For the sport quad.
//
// buildDash(style) returns { group, update(state) } where state is
// { rpm, maxRpm, redline, speedMph, fuelLevel, reserveLevel, tap, coldLight,
//   ignition, tripMiles, reverse }. The group faces the rider along -Z and its
// +X is on the rider's left.

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

/** Redraws only when what's shown has actually changed. */
function changeGate() {
  let last = '';
  return (key) => {
    if (key === last) return false;
    last = key;
    return true;
  };
}

// Rounded pods ---------------------------------------------------------------

const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dadc, roughness: 0.15, metalness: 1.0 });

/** A rounded-rectangle outline; a radius of half the height gives a pill. */
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

/** A moulded pod with softly rounded edges, its face at z = -0.035 towards the rider. */
function podMesh(w, h, r, material) {
  const bevel = 0.008;
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w - 2 * bevel, h - 2 * bevel, Math.max(0.002, r - bevel)), {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 16,
  });
  geo.translate(0, 0, -0.025);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'dashHousing';
  return mesh;
}

/** The dark front of a pod, inset from its edge. */
function podFace(w, h, r) {
  const face = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(w, h, r), 16), faceMat);
  face.position.z = -0.0352;
  face.rotation.y = Math.PI;
  return face;
}

// Classic: three analogue dials in a pill-shaped pod ---------------------------------

/**
 * A round analogue gauge: a face drawn on a canvas (redrawn only when asked), a
 * chrome bezel and a needle. Angles are canvas angles (clockwise from +x).
 */
function gauge(group, { x, y, radius, name }) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const face = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  face.name = name;
  face.position.set(x, y, -0.036);
  face.rotation.y = Math.PI;
  group.add(face);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.002, 0.0028, 8, 48), chrome);
  bezel.position.set(x, y, -0.0362);
  group.add(bezel);
  const pivot = new THREE.Group();
  pivot.name = `${name}Needle`;
  pivot.position.set(x, y, -0.038);
  pivot.rotation.y = Math.PI;
  group.add(pivot);
  const needle = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 0.86, Math.max(0.0022, radius * 0.06), 0.001),
    new THREE.MeshBasicMaterial({ color: 0xff5522, toneMapped: false }),
  );
  needle.position.x = radius * 0.33;
  pivot.add(needle);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.13, 16), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
  cap.position.z = 0.0005;
  pivot.add(cap);
  return {
    ctx: c.getContext('2d'),
    tex,
    /** Points the needle at a canvas angle. */
    point(angle) {
      pivot.rotation.z = -angle;
    },
  };
}

/** Plain dial background with a ring of ticks; returns the canvas centre. */
function dialBase(ctx) {
  ctx.clearRect(0, 0, 256, 256);
  const g = ctx.createRadialGradient(128, 110, 20, 128, 128, 128);
  g.addColorStop(0, '#1c1c1c');
  g.addColorStop(1, '#070707');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
}

function ticks(ctx, start, sweep, count, major, outer, colourFor) {
  for (let i = 0; i <= count; i++) {
    const a = start + (sweep * i) / count;
    const big = i % major === 0;
    ctx.strokeStyle = colourFor(i / count);
    ctx.lineWidth = big ? 5 : 2.5;
    const inner = outer - (big ? 22 : 12);
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * outer, 128 + Math.sin(a) * outer);
    ctx.lineTo(128 + Math.cos(a) * inner, 128 + Math.sin(a) * inner);
    ctx.stroke();
  }
}

/** A small round warning lamp set into a dial, at (dx, dy) metres from its centre. */
function dialLamp(group, gx, gy, dx, dy, radius = 0.0045) {
  const lens = new THREE.Mesh(new THREE.CircleGeometry(radius, 16), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, toneMapped: false }));
  lens.position.set(gx + dx, gy + dy, -0.0368);
  lens.rotation.y = Math.PI;
  group.add(lens);
  return lens.material;
}

/** Canvas position of a point (dx, dy) metres from a dial's centre; +x is the rider's left. */
function onDial(dx, dy, radius) {
  const k = 128 / radius;
  return [128 - dx * k, 128 - dy * k];
}

const SPEEDO_MAX_MPH = 40;
const SWEEP_START = Math.PI * 0.75;
const SWEEP = Math.PI * 1.5;
const FUEL_START = Math.PI * 1.2; // empty, upper left
const FUEL_SWEEP = Math.PI * 0.6; // to full, upper right

function buildClassic() {
  const group = new THREE.Group();
  group.name = 'dash';
  const W = 0.31;
  const H = 0.13;
  group.add(podMesh(W, H, H / 2, black));
  group.add(podFace(W - 0.012, H - 0.012, (H - 0.012) / 2));

  // Rev counter on the rider's left, speedo in the middle, fuel on the right.
  const REV = { x: 0.1, y: 0, radius: 0.034 };
  const SPD = { x: 0, y: 0.002, radius: 0.052 };
  const FUEL = { x: -0.1, y: 0, radius: 0.034 };
  const rev = gauge(group, { ...REV, name: 'rpmDial' });
  const spd = gauge(group, { ...SPD, name: 'speedo' });
  const fuel = gauge(group, { ...FUEL, name: 'fuelGauge' });

  const tempLamp = dialLamp(group, REV.x, REV.y, 0, -0.019);
  const ignLamp = dialLamp(group, SPD.x, SPD.y, 0.02, -0.004);
  const revLamp = dialLamp(group, SPD.x, SPD.y, -0.02, -0.004);
  const fuelLamp = dialLamp(group, FUEL.x, FUEL.y, 0.011, -0.016);

  // Trip counter: a little drum readout in the speedo.
  const trip = canvasPanel(160, 40, 0.022, 0.0055);
  trip.mesh.position.set(SPD.x, SPD.y - 0.036, -0.0369);
  group.add(trip.mesh);
  // Fuel tap position under the fuel needle.
  const tap = canvasPanel(120, 40, 0.024, 0.008);
  tap.mesh.position.set(FUEL.x - 0.008, FUEL.y - 0.017, -0.0369);
  group.add(tap.mesh);

  let faces = '';
  function drawFaces(s) {
    // Rev counter, scaled to this engine.
    const top = Math.ceil((s.maxRpm + 500) / 1000);
    let ctx = rev.ctx;
    dialBase(ctx);
    ticks(ctx, SWEEP_START, SWEEP, top * 2, 2, 120, (f) => (f * top * 1000 >= s.redline ? '#ff4433' : '#eeeeee'));
    ctx.fillStyle = '#eeeeee';
    ctx.font = 'bold 34px sans-serif';
    for (let i = 0; i <= top; i++) {
      const a = SWEEP_START + (SWEEP * i) / top;
      ctx.fillText(String(i), 128 + Math.cos(a) * 74, 128 + Math.sin(a) * 74);
    }
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#9a9a9a';
    ctx.fillText('x1000', 128, 92);
    let [lx, ly] = onDial(0, -0.019, REV.radius);
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('TEMP', lx, ly + 34);
    rev.tex.needsUpdate = true;

    // Speedo.
    ctx = spd.ctx;
    dialBase(ctx);
    ticks(ctx, SWEEP_START, SWEEP, SPEEDO_MAX_MPH / 2.5, 2, 122, () => '#eeeeee');
    ctx.fillStyle = '#eeeeee';
    ctx.font = 'bold 30px sans-serif';
    for (let v = 0; v <= SPEEDO_MAX_MPH; v += 10) {
      const a = SWEEP_START + (SWEEP * v) / SPEEDO_MAX_MPH;
      ctx.fillText(String(v), 128 + Math.cos(a) * 80, 128 + Math.sin(a) * 80);
    }
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#9a9a9a';
    ctx.fillText('MPH', 128, 86);
    ctx.font = 'bold 15px sans-serif';
    [lx, ly] = onDial(0.02, -0.004, SPD.radius);
    ctx.fillText('IGN', lx, ly + 20);
    [lx, ly] = onDial(-0.02, -0.004, SPD.radius);
    ctx.fillText('R', lx, ly + 20);
    spd.tex.needsUpdate = true;

    // Fuel: E to F across the top, red below the reserve.
    ctx = fuel.ctx;
    dialBase(ctx);
    ticks(ctx, FUEL_START, FUEL_SWEEP, 8, 4, 118, (f) => (f <= s.reserveLevel + 0.001 ? '#ff4433' : '#eeeeee'));
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#c0221a';
    ctx.beginPath();
    ctx.arc(128, 128, 112, FUEL_START, FUEL_START + FUEL_SWEEP * s.reserveLevel);
    ctx.stroke();
    ctx.fillStyle = '#eeeeee';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('E', 128 + Math.cos(FUEL_START) * 72, 128 + Math.sin(FUEL_START) * 72 + 6);
    ctx.fillText('F', 128 + Math.cos(FUEL_START + FUEL_SWEEP) * 72, 128 + Math.sin(FUEL_START + FUEL_SWEEP) * 72 + 6);
    // A fuel pump in the middle.
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(116, 62, 18, 26);
    ctx.fillRect(134, 66, 8, 4);
    ctx.fillRect(140, 66, 4, 18);
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(120, 66, 10, 8);
    fuel.tex.needsUpdate = true;
  }

  const gate = changeGate();
  let displayRpm = 0;
  let displayMph = 0;
  let displayFuel = 0;

  function drawReadouts(s) {
    let { ctx, canvas } = trip;
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const digits = tripText(s.tripMiles).replace('.', '').padStart(5, '0').slice(-5);
    for (let i = 0; i < 5; i++) {
      const last = i === 4;
      ctx.fillStyle = last ? '#e8e8e8' : '#262626';
      ctx.fillRect(4 + i * 31, 3, 28, 34);
      ctx.fillStyle = last ? '#111111' : '#e8e8e8';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(digits[i], 18 + i * 31, 21);
    }
    ({ ctx, canvas } = tap);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const colour = { on: '#9a9a9a', reserve: '#ffa020', off: '#ff4433' }[s.tap] ?? '#9a9a9a';
    ctx.fillStyle = s.ignition ? colour : '#555555';
    ctx.fillText(s.tap === 'reserve' ? 'RES' : s.tap.toUpperCase(), 60, 21);
    trip.tex.needsUpdate = true;
    tap.tex.needsUpdate = true;
  }

  return {
    group,
    update(s) {
      const facesKey = `${s.maxRpm}|${s.redline}|${s.reserveLevel}`;
      if (facesKey !== faces) {
        faces = facesKey;
        drawFaces(s);
      }
      // Needles swing rather than jump; with the ignition off they drop to rest.
      displayRpm += (s.rpm - displayRpm) * 0.25;
      displayMph += (s.speedMph - displayMph) * 0.2;
      displayFuel += ((s.ignition ? s.fuelLevel : 0) - displayFuel) * 0.05;
      const top = Math.ceil((s.maxRpm + 500) / 1000) * 1000;
      rev.point(SWEEP_START + SWEEP * THREE.MathUtils.clamp(displayRpm / top, 0, 1));
      spd.point(SWEEP_START + SWEEP * THREE.MathUtils.clamp(displayMph / SPEEDO_MAX_MPH, 0, 1));
      fuel.point(FUEL_START + FUEL_SWEEP * THREE.MathUtils.clamp(displayFuel, 0, 1));
      tempLamp.color.setHex(s.ignition && s.coldLight ? 0x2f7bff : 0x1a1a1a);
      ignLamp.color.setHex(s.ignition ? 0x33dd44 : 0x1a1a1a);
      revLamp.color.setHex(s.ignition && s.reverse ? 0xffe066 : 0x1a1a1a);
      fuelLamp.color.setHex(s.ignition && s.fuelLevel <= s.reserveLevel ? 0xffa020 : 0x1a1a1a);
      if (gate([s.ignition, s.tap, tripText(s.tripMiles)].join('|'))) drawReadouts(s);
    },
  };
}

// Modern: one amber LCD in a rounded pod -----------------------------------------

const MODERN = { width: 0.31, on: '#ffad3a', red: '#ff4a22', ghostRgb: '255,173,58', bg: '#100c07', visor: true };
const SPORT = { width: 0.27, on: '#ff5a46', red: '#ffffff', ghostRgb: '255,90,70', bg: '#0b0606', visor: false };

function buildModern(look = MODERN) {
  const group = new THREE.Group();
  group.name = 'dash';
  group.add(podMesh(look.width, 0.115, look.visor ? 0.04 : 0.05, look.visor ? charcoal : black));
  // Chamfered lower edge and a visor over the display.
  if (look.visor) {
    const chin = new THREE.Mesh(new RoundedBoxGeometry(0.25, 0.03, 0.06, 2, 0.01), charcoal);
    chin.position.set(0, -0.062, 0.006);
    chin.rotation.x = -0.5;
    group.add(chin);
    // A slim rounded brow along the top edge.
    const visor = new THREE.Mesh(new RoundedBoxGeometry(look.width + 0.008, 0.012, 0.045, 3, 0.0058), charcoal);
    visor.position.set(0, 0.06, -0.036);
    visor.rotation.x = 0.35;
    visor.name = 'dashVisor';
    group.add(visor);
  }
  group.add(podFace(look.width - 0.014, 0.103, look.visor ? 0.034 : 0.044));

  const lcd = canvasPanel(512, 176, look.width - 0.048, 0.09);
  lcd.mesh.name = 'lcd';
  lcd.mesh.position.set(0, 0, -0.0356);
  lcd.mesh.material.transparent = true; // its corners are rounded off
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
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = s.ignition ? look.bg : '#0a0908';
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 36);
    ctx.fill();
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
    ctx.fillText('x1000 r/min', 14, 18); // above the short end of the bars

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
