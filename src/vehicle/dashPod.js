import * as THREE from 'three';
import { HOT_FROM, tempGaugeFraction, coldZoneEnd } from './tempGauge.js';
import { lampStates, counterDigits, counterText, cycleIndex, gearShown } from './dashState.js';
import {
  blackMat, steel, changeGate, mmPanel, housing, chromeRing, text, ticks, labels, arc, needle, drum, lamp, segText, speedText, LAMP,
} from './dashParts.js';
import { segmentCounts } from './dash.js';

// The two accessory pods (README TODO 26, docs/briefs/dashes/). Each shows everything for whichever quad it's fitted to, and there's
// only one of each, so the toolbox moves them between quads. buildPod(kind) returns { group, update(state) } with the same state the
// stock dash gets; the group's origin is the bar clamp at the foot of its stem, and it faces the rider along -Z.

const INK = '#1d1d1b';
const CREAM = '#efe6cf';
const CHROME = '#cfd2d5';

// Analogue: two cream dials, two small ones and four lamps -----------------------------------

const SPEED_MAX_MPH = 60;
const REV_MAX = 12000;
const DIAL_START = 210;
const DIAL_END = -30;
const dialAngle = (fraction) => DIAL_START + (DIAL_END - DIAL_START) * Math.min(1, Math.max(0, fraction));
const MINI_START = 160;
const MINI_END = 20;
const miniAngle = (fraction) => MINI_START + (MINI_END - MINI_START) * Math.min(1, Math.max(0, fraction));

function bigDial(ctx, cx, cy, r, kind, s, on) {
  ctx.fillStyle = CHROME;
  ctx.strokeStyle = '#8d9195';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#9a9ea2';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  if (kind === 'speed') {
    ticks(ctx, cx, cy, r - 6, r - 1, DIAL_START, DIAL_END, 12, INK, 0.9);
    ticks(ctx, cx, cy, r - 3.5, r - 1, DIAL_START, DIAL_END, 24, INK, 0.5);
    labels(ctx, cx, cy, r - 12, DIAL_START, DIAL_END, ['0', '10', '20', '30', '40', '50', '60'], INK, 5);
    text(ctx, 'MPH', cx, cy - 12, 4, INK, { align: 'center' });
    const o = counterDigits(s.odoMiles, 4);
    drum(ctx, cx - 11.5, cy + 15, o.whole, o.tenth, 6);
    text(ctx, 'ODO', cx + 13, cy + 20, 3, '#555');
    const t = counterDigits(s.tripMiles, 3);
    drum(ctx, cx - 9.2, cy + 24, t.whole, t.tenth, 6);
    text(ctx, 'TRIP', cx + 13, cy + 29, 3, '#555');
    needle(ctx, cx, cy, r - 3, dialAngle(on ? s.speedMph / SPEED_MAX_MPH : 0), '#d2321e', 1.3);
  } else {
    // The red band starts at the fitted quad's own redline.
    arc(ctx, cx, cy, r - 3.5, dialAngle(s.redline / REV_MAX), DIAL_END, '#d2321e', 5);
    ticks(ctx, cx, cy, r - 6, r - 1, DIAL_START, DIAL_END, 12, INK, 0.9);
    labels(ctx, cx, cy, r - 12, DIAL_START, DIAL_END, Array.from({ length: 13 }, (_, i) => String(i)), INK, 4.2);
    text(ctx, '×1000 r/min', cx, cy - 12, 3.6, INK, { align: 'center' });
    const h = counterDigits(s.hours, 4);
    drum(ctx, cx - 11.5, cy + 17, h.whole, h.tenth, 6);
    text(ctx, 'HRS', cx + 13, cy + 22, 3, '#555');
    needle(ctx, cx, cy, r - 3, dialAngle(on ? s.rpm / REV_MAX : 0), '#d2321e', 1.3);
  }
}

function miniDial(ctx, cx, cy, r, kind, s, on) {
  ctx.fillStyle = CHROME;
  ctx.strokeStyle = '#8d9195';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = CREAM;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ticks(ctx, cx, cy, r - 5, r - 1.5, MINI_START, MINI_END, 4, INK, 0.7);
  if (kind === 'fuel') {
    arc(ctx, cx, cy, r - 3, MINI_START, miniAngle(s.reserveLevel), '#d2321e', 2); // the red reserve sector
    labels(ctx, cx, cy, r - 9, MINI_START, MINI_END, ['E', '', '', '', 'F'], INK, 3.8);
    text(ctx, 'FUEL', cx, cy + 9, 3, INK, { align: 'center' });
    needle(ctx, cx, cy, r - 2, miniAngle(on ? s.fuelLevel : 0), '#d2321e', 0.9);
  } else {
    arc(ctx, cx, cy, r - 3, MINI_START, miniAngle(coldZoneEnd(s.coldBelow)), '#2f6fd6', 2);
    arc(ctx, cx, cy, r - 3, miniAngle(HOT_FROM), MINI_END, '#d2321e', 2);
    labels(ctx, cx, cy, r - 9, MINI_START, MINI_END, ['C', '', '', '', 'H'], INK, 3.8);
    text(ctx, 'TEMP', cx, cy + 9, 3, INK, { align: 'center' });
    needle(ctx, cx, cy, r - 2, miniAngle(tempGaugeFraction(s.temperature, on, s.overheat)), '#d2321e', 0.9);
  }
}

function buildAnalogue() {
  const group = new THREE.Group();
  group.name = 'podAnalogue';
  const O = { ox: 100, oy: 172 };
  // Stem and bar clamp, then the black steel bracket plate.
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.026, 0.016), steel);
  stem.position.set(0, 0.012, 0.012);
  group.add(stem);
  const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 12).rotateZ(Math.PI / 2), steel);
  clamp.position.set(0, 0, 0.012);
  group.add(clamp);
  housing(group, { x: 12, y: 12, w: 176, h: 138, r: 28, ...O, material: blackMat });
  for (const cx of [55, 145]) chromeRing(group, { cx, cy: 58, r: 38, ...O, tube: 0.0035 });
  const face = mmPanel({ x: 12, y: 12, w: 176, h: 138, ...O });
  group.add(face.mesh);
  const gate = changeGate();

  function draw(ctx, s) {
    const on = s.ignition;
    bigDial(ctx, 55, 58, 34, 'speed', s, on);
    bigDial(ctx, 145, 58, 34, 'revs', s, on);
    miniDial(ctx, 40, 125, 15, 'fuel', s, on);
    miniDial(ctx, 160, 125, 15, 'temp', s, on);
    const l = lampStates(s);
    [[76, LAMP.green, 'N', l.n], [92, LAMP.amber, 'R', l.r], [108, LAMP.red, 'TEMP', l.temp], [124, LAMP.amber, 'FUEL', l.fuel]].forEach(([x, c, name, lit]) => {
      ctx.fillStyle = CHROME;
      ctx.beginPath();
      ctx.arc(x, 122, 5.6, 0, Math.PI * 2);
      ctx.fill();
      lamp(ctx, x, 122, c, name, lit, { r: 3.8, labelBelow: false });
      text(ctx, name, x, 132, 3, '#aaa', { align: 'center' });
    });
  }

  return {
    group,
    update(s) {
      const o = counterDigits(s.odoMiles, 4);
      const t = counterDigits(s.tripMiles, 3);
      const h = counterDigits(s.hours, 4);
      const l = lampStates(s);
      const key = [
        s.ignition, l.r, l.n, l.temp, l.fuel, Math.round(s.speedMph * 3), Math.round(s.rpm / 40), Math.round(s.redline / 100),
        Math.round(s.fuelLevel * 60), Math.round(s.reserveLevel * 100), Math.round(tempGaugeFraction(s.temperature, s.ignition, s.overheat) * 60),
        o.whole + o.tenth, t.whole + t.tenth, h.whole + h.tenth,
      ].join('|');
      if (gate(key)) face.redraw((ctx) => draw(ctx, s));
    },
  };
}

// Digital: an amber bar-graph display on a ball-and-arm mount -----------------------------------

const AMBER = '#ffad3a';
const AMBER_BG = '#100c07';
const AMBER_GHOST = '#3a2a12';
const AMBER_RED = '#ff4a22';
const BARS = 30;

function buildDigital() {
  const group = new THREE.Group();
  group.name = 'podDigital';
  const O = { ox: 100, oy: 160 };
  // Clamp, ball-and-arm and the slim housing.
  const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 12).rotateZ(Math.PI / 2), steel);
  clamp.position.set(0, 0, 0.012);
  group.add(clamp);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.034, 8), steel);
  arm.position.set(0, 0.025 + 0.002, 0.012);
  group.add(arm);
  for (const y of [0.012, 0.047]) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.007, 12, 8), steel);
    ball.position.set(0, y, 0.012);
    group.add(ball);
  }
  housing(group, { x: 14, y: 14, w: 172, h: 92, r: 12, ...O, material: blackMat });
  for (const bx of [32, 156]) housing(group, { x: bx, y: 9, w: 12, h: 6, r: 2, ...O, material: steel, depth: 0.02, name: 'podButton' });
  const face = mmPanel({ x: 14, y: 14, w: 172, h: 92, ...O });
  group.add(face.mesh);
  const gate = changeGate();

  function draw(ctx, s, L) {
    const [x, y, w, h] = [22, 22, 156, 76];
    ctx.fillStyle = AMBER_BG;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    const on = s.ignition;
    const redFrom = Math.round((s.redline / REV_MAX) * BARS);
    const lit = on ? Math.round((s.rpm / REV_MAX) * BARS) : 0;
    for (let i = 0; i < BARS; i++) {
      const hh = 3 + i * 0.32 * 1.4;
      ctx.fillStyle = i < lit ? (i >= redFrom ? AMBER_RED : AMBER) : i >= redFrom ? '#3a1810' : AMBER_GHOST;
      if (!on) ctx.fillStyle = '#1a1409';
      ctx.fillRect(x + 8 + i * 4.6, y + 16 - hh, 3.4, hh);
    }
    if (on) {
      text(ctx, '0', x + 8, y + 22, 3.2, AMBER);
      text(ctx, '12 ×1000', x + 140, y + 22, 3.2, AMBER, { align: 'right' });
    }
    const ghost = on ? AMBER_GHOST : '#1a1409';
    segText(ctx, L.speed, x + 92, y + 31, 21, on ? AMBER : ghost, ghost);
    if (!on) return;
    text(ctx, 'MPH', x + 95, y + 50, 5, AMBER);
    const f = segmentCounts(s, 6, 6);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i < f.fuel ? (L.lamps.fuel ? AMBER_RED : AMBER) : AMBER_GHOST;
      ctx.fillRect(x + 6, y + 56 - i * 6, 9, 4.6);
      ctx.fillStyle = i < f.temp ? (i === 5 ? AMBER_RED : AMBER) : AMBER_GHOST;
      ctx.fillRect(x + w - 15, y + 56 - i * 6, 9, 4.6);
    }
    text(ctx, 'FUEL', x + 10.5, y + 66, 3.4, AMBER, { align: 'center' });
    text(ctx, 'TEMP', x + w - 10.5, y + 66, 3.4, AMBER, { align: 'center' });
    const gear = gearShown(s);
    if (gear) text(ctx, gear, x + w - 30, y + 36, 11, AMBER, { align: 'center', weight: 'bold' });
    segText(ctx, s.clock, x + w - 22, y + 43.4, 4.55, AMBER);
    ctx.strokeStyle = AMBER_GHOST;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 60);
    ctx.lineTo(x + w - 20, y + 60);
    ctx.stroke();
    text(ctx, L.line[0], x + 22, y + 71, 4.6, AMBER, { weight: 'bold' });
    segText(ctx, L.line[1], x + w - 22, y + 65.5, 5.95, AMBER);
    // Warning labels under the display.
    [[LAMP.green, 'N', L.lamps.n], [LAMP.amber, 'R', L.lamps.r], [LAMP.red, 'TEMP', L.lamps.temp], [LAMP.amber, 'FUEL', L.lamps.fuel]].forEach(([c, name, lit], i) => {
      text(ctx, name, 54 + i * 30, 104, 3.6, lit ? c : '#5a5a5a', { align: 'center' });
    });
  }

  return {
    group,
    update(s) {
      const i = cycleIndex(s.seconds ?? 0, 3);
      const line = [['ODO', counterText(s.odoMiles, 5)], ['TRIP', counterText(s.tripMiles, 4)], ['HRS', counterText(s.hours, 5)]][i];
      const L = { lamps: lampStates(s), speed: speedText(s.speedMph), line };
      const f = segmentCounts(s, 6, 6);
      const key = [
        s.ignition, L.speed, Math.round((s.rpm / REV_MAX) * BARS), Math.round((s.redline / REV_MAX) * BARS), f.fuel, f.temp, L.lamps.r, L.lamps.n,
        L.lamps.temp, L.lamps.fuel, s.reverse, s.neutral, s.clock, line.join(' '),
      ].join('|');
      if (gate(key)) face.redraw((ctx) => draw(ctx, s, L));
    },
  };
}

export const POD_BUILDERS = { analogue: buildAnalogue, digital: buildDigital };

/** The pod of this kind: { group, update(state) }. There are only two in the whole game, so the game builds each once. */
export function buildPod(kind) {
  const pod = POD_BUILDERS[kind]();
  pod.kind = kind;
  return pod;
}
