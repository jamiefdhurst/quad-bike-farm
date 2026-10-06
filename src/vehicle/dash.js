import * as THREE from 'three';
import { tempGaugeFraction } from './tempGauge.js';
import { lampStates, counterDigits, counterText, cycleIndex } from './dashState.js';
import {
  plastic, charcoal, blackMat, gloss, chromeMat, changeGate, mmPanel, housing, text, ticks, labels, needle, drum, lamp, keySwitch,
  segText, speedText, LAMP,
} from './dashParts.js';

// The stock dashes. Each quad's own dash is close to the real machine it's modelled on, which for most means very little: the
// instruments are on the two accessory pods (dashPod.js). Layouts and colours follow docs/briefs/dashes/ (see README TODO 26).
//
//   foreman:   red. A Honda Foreman-style cover: a rectangular speedo with hour and odometer drums, N / R / OIL lamps and the key.
//   grizzly:   blue. A Yamaha Grizzly-style pod around a grey-green LCD: fuel and temperature bars, gear letter, speed, clock and a
//              line that cycles trip, odometer and hours.
//   kodiak:    loan quad. The same idea, newer: a wider, glossier pod with a cooler LCD and a gear column.
//   bayou:     green. Only a little cover on the headlight nacelle with N and R lamps and the key.
//   blaster:   yellow. The back of a headlamp shell on the bars with a red power lamp and the key.
//   quadracer: orange. A RUN / OFF kill switch on the left bar and its lanyard.
//   kidsKey:   kids' quad. A key switch under the bar clamp.
//
// buildDash(style) returns { group, update(state), mount } where state is { rpm, maxRpm, redline, speedMph, fuelLevel, reserveLevel,
// tap, temperature, overheat, coldBelow, ignition (has power), keyOn, tripMiles, odoMiles, hours, reverse, neutral, clock, seconds }.
// The group faces the rider along -Z and its +X is on the rider's left. `mount` is where a pod stands (a child of the group) or null.

const LCD = { bg: '#a9b59d', on: '#1f261c', ghost: '#9aa68f', dim: '#b0bba5' }; // Grizzly 660: positive, grey-green
const LCD_COOL = { bg: '#b8c2c7', on: '#151a1e', ghost: '#a9b3b8', dim: '#bcc6cb' }; // the loan quad's newer one

/** Fuel and temperature as lit-segment counts, shared by the LCDs. */
export function segmentCounts(s, fuelSegs, tempSegs) {
  return {
    fuel: Math.ceil(s.fuelLevel * fuelSegs - 0.001),
    temp: Math.ceil(tempGaugeFraction(s.temperature, true, s.overheat) * tempSegs - 0.001),
  };
}

/** Everything a face needs about a state that changes how it looks, as a string: redraw only when it changes. */
function lookKey(s, extra = []) {
  const l = lampStates(s);
  return [s.ignition, s.keyOn, l.r, l.n, l.temp, l.fuel, ...extra].join('|');
}

/** A pod's mounting point: a child of the dash, leaning the pod back about 20 degrees whatever the dash's tilt. */
function podMount(group, x, y, z, dashTilt) {
  const m = new THREE.Object3D();
  m.name = 'podMount';
  m.position.set(x, y, z);
  m.rotation.x = 0.35 - dashTilt;
  group.add(m);
  return m;
}

// Red: Honda Foreman ------------------------------------------------------------------

function buildForeman() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 180, oy: 79 };
  housing(group, { x: 98, y: 8, w: 164, h: 142, r: 12, ...O, material: plastic });
  const face = mmPanel({ x: 98, y: 8, w: 164, h: 142, ...O });
  group.add(face.mesh);
  const gate = changeGate();
  let shownMph = 0;

  function draw(ctx, s, L) {
    ctx.fillStyle = '#111';
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(118, 18, 124, 78, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0c0d0e';
    ctx.beginPath();
    ctx.roundRect(122, 22, 116, 70, 4);
    ctx.fill();
    const [cx, cy, r] = [196, 70, 40];
    ticks(ctx, cx, cy, r - 6, r, 170, 10, 9, '#e9e9e9', 0.9);
    ticks(ctx, cx, cy, r - 3, r, 170, 10, 18, '#bbb', 0.5);
    labels(ctx, cx, cy, r - 11, 170, 10, ['0', '5', '10', '15', '20', '25', '30', '35', '40', '45'], '#e9e9e9', 4.6);
    text(ctx, 'mph', cx + 30, cy + 12, 4, '#bbb');
    text(ctx, 'HOUR METER', 128, 37, 3.6, '#ccc');
    const h = counterDigits(s.hours, 4);
    drum(ctx, 128, 40, h.whole, h.tenth);
    text(ctx, 'ODOMETER', 128, 57, 3.6, '#ccc');
    const o = counterDigits(s.odoMiles, 4);
    drum(ctx, 128, 60, o.whole, o.tenth);
    text(ctx, 'HONDA', 128, 86, 6.5, '#e8e8e8', { weight: 'bold', spacing: 1 });
    needle(ctx, cx, cy, r - 2, 170 - (160 * Math.min(45, L.mph)) / 45, '#e8541e');
    // Lamps and the key, on a small panel under the window.
    ctx.fillStyle = '#18191b';
    ctx.beginPath();
    ctx.roundRect(126, 104, 68, 26, 3);
    ctx.fill();
    lamp(ctx, 138, 114, LAMP.amber, 'R', L.lamps.r, { shape: 'rect' });
    lamp(ctx, 160, 114, LAMP.green, 'N', L.lamps.n, { shape: 'rect' });
    lamp(ctx, 182, 114, LAMP.red, 'OIL °C', L.lamps.temp, { shape: 'rect' });
    keySwitch(ctx, 222, 118, s.keyOn);
  }

  return {
    group,
    mount: podMount(group, 0, 0.079, 0, 0.75),
    update(s) {
      // The needle follows the road speed with a little lag, like a cable.
      shownMph += ((s.ignition ? s.speedMph : 0) - shownMph) * 0.5;
      const L = { lamps: lampStates(s), mph: shownMph };
      const o = counterDigits(s.odoMiles, 4);
      const h = counterDigits(s.hours, 4);
      if (gate(lookKey(s, [Math.round(shownMph * 4), o.whole + o.tenth, h.whole + h.tenth]))) face.redraw((ctx) => draw(ctx, s, L));
    },
  };
}

// The two LCDs --------------------------------------------------------------------------

function buildGrizzly() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 165, oy: 62 };
  housing(group, { x: 64, y: 10, w: 202, h: 104, r: 14, ...O, material: charcoal });
  const face = mmPanel({ x: 64, y: 10, w: 202, h: 104, ...O });
  group.add(face.mesh);
  const gate = changeGate();

  function draw(ctx, s, L) {
    // The brow, and the black window around the LCD.
    ctx.fillStyle = '#202124';
    ctx.beginPath();
    ctx.moveTo(96, 16);
    ctx.lineTo(234, 16);
    ctx.lineTo(228, 24);
    ctx.lineTo(102, 24);
    ctx.fill();
    ctx.fillStyle = '#151617';
    ctx.beginPath();
    ctx.roundRect(103, 26, 124, 72, 6);
    ctx.fill();
    const [x, y, w, h] = [109, 31, 112, 62];
    const { on, ghost } = LCD;
    ctx.fillStyle = LCD.bg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 3);
    ctx.fill();
    if (s.ignition) {
      const c = segmentCounts(s, 6, 5);
      text(ctx, 'E', x + 4, y + 8, 3.6, on);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i < c.fuel ? on : ghost;
        ctx.fillRect(x + 9 + i * 6, y + 4, 4.6, 5);
      }
      text(ctx, 'F', x + 46, y + 8, 3.6, on);
      const tx = x + w - 44;
      text(ctx, 'C', tx, y + 8, 3.6, on);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i < c.temp ? on : ghost;
        ctx.fillRect(tx + 5 + i * 6, y + 4, 4.6, 5);
      }
      text(ctx, 'H', tx + 36, y + 8, 3.6, on);
      // Gear letter in a box.
      ctx.strokeStyle = on;
      ctx.lineWidth = 0.6;
      ctx.strokeRect(x + 4, y + 14, 11, 14);
      text(ctx, s.reverse ? 'R' : s.neutral ? 'N' : 'H', x + 9.5, y + 25, 10, on, { align: 'center', weight: 'bold' });
      text(ctx, 'MPH', x + w / 2 + 17, y + 35, 4.4, on);
      segText(ctx, L.speed, x + w / 2 + 14, y + 18, 18, on, ghost);
      segText(ctx, s.clock, x + w - 5, y + 16, 5.2, on);
      // Trip, odometer and hours in turn.
      ctx.strokeStyle = ghost;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + h - 13);
      ctx.lineTo(x + w - 3, y + h - 13);
      ctx.stroke();
      text(ctx, L.line[0], x + 5, y + h - 4, 4.2, on, { weight: 'bold' });
      segText(ctx, L.line[1], x + w - 5, y + h - 9.1, 5.6, on);
    } else {
      segText(ctx, '88', x + w / 2 + 14, y + 18, 18, ghost);
    }
    // Lamps either side, and the two buttons under the LCD.
    lamp(ctx, 86, 44, LAMP.green, 'N', L.lamps.n, { r: 4.2 });
    lamp(ctx, 86, 72, LAMP.amber, 'R', L.lamps.r, { r: 4.2 });
    lamp(ctx, 244, 44, LAMP.red, 'TEMP', L.lamps.temp, { r: 4.2 });
    lamp(ctx, 244, 72, LAMP.amber, 'FUEL', L.lamps.fuel, { r: 4.2 });
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.roundRect(146, 100, 14, 6, 2);
    ctx.roundRect(170, 100, 14, 6, 2);
    ctx.fill();
    text(ctx, 'SELECT', 153, 111, 3.2, '#aaa', { align: 'center' });
    text(ctx, 'RESET', 177, 111, 3.2, '#aaa', { align: 'center' });
  }

  return {
    group,
    mount: podMount(group, 0, 0.06, 0, 0.75),
    update(s) {
      const c = segmentCounts(s, 6, 5);
      const line = bottomLine(s, 4, 5);
      const L = { lamps: lampStates(s), speed: speedText(s.speedMph), line };
      const key = lookKey(s, [L.speed, c.fuel, c.temp, s.reverse, s.neutral, s.clock, line.join(' ')]);
      if (gate(key)) face.redraw((ctx) => draw(ctx, s, L));
    },
  };
}

/** The line along the bottom of an LCD: trip, odometer or hours, four seconds each. */
function bottomLine(s, tripDigits, odoDigits, labelsFor = ['TRIP', 'ODO', 'HRS']) {
  const i = cycleIndex(s.seconds ?? 0, 3);
  const value = [s.tripMiles, s.odoMiles, s.hours][i];
  return [labelsFor[i], counterText(value, i === 0 ? tripDigits : odoDigits)];
}

function buildKodiak() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 170, oy: 62 };
  housing(group, { x: 56, y: 8, w: 228, h: 108, r: 16, ...O, material: gloss });
  const face = mmPanel({ x: 56, y: 8, w: 228, h: 108, ...O });
  group.add(face.mesh);
  const gate = changeGate();

  function draw(ctx, s, L) {
    ctx.strokeStyle = '#8d949a'; // the thin silver trim
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(80, 12);
    ctx.lineTo(260, 12);
    ctx.stroke();
    ctx.fillStyle = '#0e0f10';
    ctx.beginPath();
    ctx.roundRect(88, 20, 164, 76, 8);
    ctx.fill();
    const [x, y, w] = [94, 25, 152];
    const { on, ghost } = LCD_COOL;
    ctx.fillStyle = LCD_COOL.bg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 66, 5);
    ctx.fill();
    if (s.ignition) {
      const c = segmentCounts(s, 8, 6);
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i < c.fuel ? on : ghost;
        ctx.beginPath();
        ctx.roundRect(x + 34 + i * 10.5, y + 4, 8.5, 4.6, 0.6);
        ctx.fill();
      }
      text(ctx, 'E', x + 28, y + 8.4, 4, on, { align: 'right' });
      text(ctx, 'F', x + 120, y + 8.4, 4, on);
      // Gear column, the current one boxed.
      const cur = s.reverse ? 3 : s.neutral ? 2 : 0;
      [...'HLNRP'].forEach((g, i) => text(ctx, g, x + 8, y + 18 + i * 9, 6.4, i === cur ? on : ghost, { align: 'center', weight: 'bold' }));
      ctx.strokeStyle = on;
      ctx.lineWidth = 0.6;
      ctx.strokeRect(x + 3.5, y + 12 + cur * 9, 9, 8);
      text(ctx, 'mph', x + 95, y + 44, 5, on);
      segText(ctx, L.speed, x + 92, y + 23.6, 22.4, on, ghost);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i < c.temp ? on : ghost;
        ctx.fillRect(x + w - 12, y + 46 - i * 6, 7, 4.4);
      }
      text(ctx, '°C', x + w - 8.5, y + 56, 3.6, on, { align: 'center' });
      text(ctx, '4WD', x + w - 30, y + 20, 4.6, on, { weight: 'bold' });
      segText(ctx, s.clock, x + w - 18, y + 25.8, 5.25, on);
      ctx.strokeStyle = ghost;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x + 18, y + 52);
      ctx.lineTo(x + w - 18, y + 52);
      ctx.stroke();
      text(ctx, L.line[0], x + 20, y + 62, 4.6, on, { weight: 'bold' });
      segText(ctx, L.line[1], x + w - 20, y + 56.2, 6.3, on);
    } else {
      segText(ctx, '88', x + 92, y + 23.6, 22.4, ghost);
    }
    ctx.fillStyle = '#3a3d40';
    ctx.beginPath();
    for (const bx of [126, 162, 198]) ctx.roundRect(bx, 100, 18, 7, 2.5);
    ctx.fill();
    lamp(ctx, 74, 50, LAMP.amber, 'R', L.lamps.r, { r: 3.6 });
    lamp(ctx, 74, 76, LAMP.green, 'N', L.lamps.n, { r: 3.6 });
    lamp(ctx, 266, 50, LAMP.red, 'TEMP', L.lamps.temp, { r: 3.6 });
    lamp(ctx, 266, 76, LAMP.amber, 'FUEL', L.lamps.fuel, { r: 3.6 });
  }

  return {
    group,
    mount: podMount(group, 0, 0.062, 0, 0.75),
    update(s) {
      const c = segmentCounts(s, 8, 6);
      const line = bottomLine(s, 4, 5, ['TRIP A', 'ODO', 'HRS']);
      const L = { lamps: lampStates(s), speed: speedText(s.speedMph), line };
      const key = lookKey(s, [L.speed, c.fuel, c.temp, s.reverse, s.neutral, s.clock, line.join(' ')]);
      if (gate(key)) face.redraw((ctx) => draw(ctx, s, L));
    },
  };
}

// Green: Kawasaki Bayou ---------------------------------------------------------------

function buildBayou() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 150, oy: 28 };
  housing(group, { x: 102, y: 10, w: 96, h: 36, r: 6, ...O, material: plastic });
  const face = mmPanel({ x: 102, y: 10, w: 96, h: 36, ...O });
  group.add(face.mesh);
  const gate = changeGate();
  return {
    group,
    mount: podMount(group, 0, 0.026, 0.03, 0.85),
    update(s) {
      const l = lampStates(s);
      if (gate(lookKey(s)))
        face.redraw((ctx) => {
          lamp(ctx, 132, 26, LAMP.green, 'N', l.n, { r: 4.6, shape: 'rect' });
          lamp(ctx, 156, 26, LAMP.amber, 'R', l.r, { r: 4.6, shape: 'rect' });
          keySwitch(ctx, 182, 28, s.keyOn);
        });
    },
  };
}

// Yellow: Yamaha Blaster ----------------------------------------------------------------

function buildBlaster() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 150, oy: 80 };
  housing(group, { x: 96, y: 52, w: 108, h: 56, r: 10, ...O, material: blackMat });
  const rim = housing(group, { x: 104, y: 44, w: 92, h: 7, r: 3.5, ...O, material: chromeMat, depth: 0.04 });
  rim.name = 'dashRim';
  const face = mmPanel({ x: 96, y: 52, w: 108, h: 56, ...O });
  group.add(face.mesh);
  const gate = changeGate();
  return {
    group,
    mount: null,
    update(s) {
      if (gate(lookKey(s)))
        face.redraw((ctx) => {
          lamp(ctx, 150, 60, LAMP.red, 'power', s.ignition, { r: 3.6, labelBelow: false });
          keySwitch(ctx, 150, 86, s.keyOn);
        });
    },
  };
}

// Orange: Suzuki quadracer ------------------------------------------------------------------

function buildQuadracer() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 47, oy: 40 };
  housing(group, { x: 34, y: 28, w: 26, h: 24, r: 3, ...O, material: new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 0.5 }), depth: 0.03 });
  const face = mmPanel({ x: 30, y: 26, w: 34, h: 96, ...O });
  group.add(face.mesh);
  const gate = changeGate();
  return {
    group,
    mount: null,
    update(s) {
      if (gate(lookKey(s)))
        face.redraw((ctx) => {
          // The red tab sits at RUN with the ignition on, OFF with it off.
          ctx.fillStyle = LAMP.red;
          ctx.beginPath();
          ctx.roundRect(40, s.keyOn ? 31 : 40, 14, 8, 2);
          ctx.fill();
          text(ctx, 'RUN', 47, s.keyOn ? 46 : 37, 3.6, '#ddd', { align: 'center' });
          text(ctx, 'OFF', 47, s.keyOn ? 37 : 46, 3.6, '#777', { align: 'center' });
          // The tether lanyard.
          ctx.strokeStyle = '#d33';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(47, 52);
          ctx.quadraticCurveTo(41, 61, 47, 67);
          ctx.quadraticCurveTo(53, 73, 47, 82);
          ctx.quadraticCurveTo(57, 92, 47, 106);
          ctx.stroke();
        });
    },
  };
}

// Kids': a key switch --------------------------------------------------------------------------

function buildKidsKey() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 110, oy: 55 };
  housing(group, { x: 96, y: 44, w: 28, h: 22, r: 4, ...O, material: blackMat, depth: 0.03 });
  const face = mmPanel({ x: 96, y: 44, w: 28, h: 22, ...O });
  group.add(face.mesh);
  const gate = changeGate();
  return {
    group,
    mount: null,
    update(s) {
      if (gate(lookKey(s))) face.redraw((ctx) => keySwitch(ctx, 110, 55, s.keyOn));
    },
  };
}

/** Dash styles buildDash knows: every quad spec must name one of these. */
export const DASH_STYLES = ['foreman', 'grizzly', 'kodiak', 'bayou', 'blaster', 'quadracer', 'kidsKey'];

/** Where each dash sits on the bars (metres, in the bars' frame) and how far it tilts back. A nacelle quad carries its own on its top. */
export const DASH_PLACE = {
  foreman: { pos: [0, 0.1, 0.02], tilt: 0.75 },
  grizzly: { pos: [0, 0.1, 0.02], tilt: 0.75 },
  kodiak: { pos: [0, 0.1, 0.02], tilt: 0.75 },
  bayou: { pos: [0, 0.115, 0.05], tilt: 0.85 },
  blaster: { pos: [0, 0.08, 0.04], tilt: 0.45 }, // sat down on the bar clamp, not floating over it
  quadracer: { pos: [0.225, 0.085, -0.035], tilt: 0.9 },
  kidsKey: { pos: [0, 0.075, 0.0], tilt: 0.9 },
};

const BUILDERS = {
  foreman: buildForeman,
  grizzly: buildGrizzly,
  kodiak: buildKodiak,
  bayou: buildBayou,
  blaster: buildBlaster,
  quadracer: buildQuadracer,
  kidsKey: buildKidsKey,
};

export function buildDash(style = 'foreman') {
  return (BUILDERS[style] ?? buildForeman)();
}
