import * as THREE from 'three';
import { tempGaugeFraction } from './tempGauge.js';
import { lampStates, counterDigits, counterText, cycleIndex, gearShown, forwardGearShown } from './dashState.js';
import {
  plastic, charcoal, blackMat, agedSteel, agedBlack, gloss, chromeMat, changeGate, mmPanel, housing, chromeRing, text, ticks, labels, arc, needle, drum, lamp, glyphLetter, keySwitch,
  segText, speedText, warnSymbol, LAMP,
} from './dashParts.js';

// The stock dashes. Each quad's own dash is close to the real machine it's modelled on, which for most means very little: the
// instruments are on the two accessory pods (dashPod.js). Layouts and colours follow docs/briefs/dashes/ (see DECISIONS.md, "The dashes").
//
//   foreman:   red. A Honda Foreman-style cover: a rectangular speedo with hour and odometer drums, N / R / OIL lamps and the key.
//   grizzly:   blue. A Yamaha Grizzly-style pod around a grey-green LCD: fuel and temperature bars, gear letter, speed, clock and a
//              line that cycles trip, odometer and hours.
//   kodiak:    loan quad. The same idea, newer: a wider, glossier pod with a cooler LCD and a gear column.
//   bayou:     green. Only a little cover on the headlight nacelle with N and R lamps and the key.
//   blaster:   yellow. The back of a headlamp shell on the bars with a red power lamp and the key.
//   quadracer: orange. A RUN / OFF kill switch on the left bar and its lanyard.
//   kidsKey:   kids' quad. A key switch under the bar clamp.
//   tractor:   the tractor. Three round dials in chrome bezels (water temperature, a rev counter with an hour meter and the PTO speed marked, fuel), GLOW, CHARGE and OIL lamps and the key.
//   utv:       the UTV. A basic LCD (speed, five fuel and four water blocks, F / N / R, hours and a 4WD note) over symbols for glow, charge, oil, park
//              (parking brake), a belted figure (flashes while someone sits unbelted), a headlamp (green, blue for main beam) and the key.
//   fiesta:    Amy's Mk1 Fiesta: a speedo and a combined fuel and water gauge the same size, the lamps between them, on brown. corsa: Jess's Corsa B, with a rev counter too.
//   series:    the Land Rover. A Series III binnacle: a big speedo to 90 mph with its odometer, a combined fuel and water gauge,
//              IGN, OIL, CHOKE and BRAKE lamps, a 4WD and a DIFF lamp, and the key.
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
  return [s.ignition, s.keyOn, l.r, l.n, l.temp, l.fuel, l.oil, ...extra].join('|');
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
    needle(ctx, cx, cy, r - 2, 170 - (160 * Math.min(45, L.mph)) / 45, '#e8541e');
    // Lamps and the key, on a small panel under the window.
    ctx.fillStyle = '#18191b';
    ctx.beginPath();
    ctx.roundRect(126, 104, 68, 26, 3);
    ctx.fill();
    glyphLetter(ctx, 138, 114, LAMP.amber, 'R', L.lamps.r, 9);
    glyphLetter(ctx, 160, 114, LAMP.green, 'N', L.lamps.n, 9);
    warnSymbol(ctx, 'oil', 182, 114, LAMP.red, L.lamps.oil, 0.85);
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
      text(ctx, gearShown(s), x + 9.5, y + 25, 10, on, { align: 'center', weight: 'bold' });
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
    glyphLetter(ctx, 86, 44, LAMP.green, 'N', L.lamps.n, 9);
    glyphLetter(ctx, 86, 72, LAMP.amber, 'R', L.lamps.r, 9);
    warnSymbol(ctx, 'temp', 244, 44, LAMP.red, L.lamps.temp);
    warnSymbol(ctx, 'fuel', 244, 72, LAMP.amber, L.lamps.fuel);
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
      [...'DLNRP'].forEach((g, i) => text(ctx, g, x + 8, y + 18 + i * 9, 6.4, i === cur ? on : ghost, { align: 'center', weight: 'bold' }));
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
      warnSymbol(ctx, '4wd', x + w - 26, y + 17, on, true, 0.8, false); // the loan quad's is always in four-wheel drive
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
    glyphLetter(ctx, 74, 50, LAMP.amber, 'R', L.lamps.r, 8.5);
    glyphLetter(ctx, 74, 76, LAMP.green, 'N', L.lamps.n, 8.5);
    warnSymbol(ctx, 'temp', 266, 50, LAMP.red, L.lamps.temp);
    warnSymbol(ctx, 'fuel', 266, 76, LAMP.amber, L.lamps.fuel);
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
          glyphLetter(ctx, 132, 26, LAMP.green, 'N', l.n, 10);
          glyphLetter(ctx, 156, 26, LAMP.amber, 'R', l.r, 10);
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

// The tractor ------------------------------------------------------------------------------

/** A dial face for the old tractor: brown-black, with the paint gone dull. */
function agedFace(ctx, d) {
  ctx.fillStyle = '#16120d';
  ctx.beginPath();
  ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
  ctx.fill();
}

/** Years of yellowed glass over a dial: a warm haze, a few scratches and dust specks (fixed, so they don't shimmer). */
function agedGlass(ctx, d) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(176, 148, 82, 0.13)';
  ctx.fillRect(d.cx - d.r, d.cy - d.r, d.r * 2, d.r * 2);
  ctx.strokeStyle = 'rgba(230, 220, 190, 0.22)';
  ctx.lineWidth = 0.25;
  for (let i = 0; i < 4; i++) {
    const a = 0.7 + i * 1.9 + d.r * 0.1;
    ctx.beginPath();
    ctx.moveTo(d.cx + Math.cos(a) * d.r * 0.9, d.cy + Math.sin(a) * d.r * 0.9);
    ctx.lineTo(d.cx + Math.cos(a + 0.9) * d.r * 0.5, d.cy + Math.sin(a + 0.9) * d.r * 0.7);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(120, 90, 50, 0.35)';
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + d.r;
    const rr = d.r * (0.35 + ((i * 37) % 10) / 16);
    ctx.fillRect(d.cx + Math.cos(a) * rr, d.cy + Math.sin(a) * rr, 0.5, 0.5);
  }
  ctx.restore();
}

function buildTractor() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 180, oy: 70 };
  // An old pressed-steel binnacle, its paint worn through to the metal, with three round dials in dull, pitted bezels: the big rev counter on
  // the left, water temperature and fuel side by side on the right, and the lamps and the key in a line under them.
  housing(group, { x: 80, y: 22, w: 200, h: 96, r: 12, ...O, material: agedBlack });
  const face = mmPanel({ x: 80, y: 22, w: 200, h: 96, ...O });
  group.add(face.mesh);
  const dials = [
    { cx: 200, cy: 53, r: 19 }, // water temperature
    { cx: 132, cy: 70, r: 34 }, // the rev counter
    { cx: 252, cy: 53, r: 19 }, // fuel
  ];
  for (const d of dials) chromeRing(group, { ...d, r: d.r + 1, ...O, material: agedSteel });
  const gate = changeGate();
  let shownRpm = 0;
  let shownFuel = 0;
  let shownTemp = 0;

  /** A small dial: a faded cream-on-brown-black arc scale from 150 to 30 degrees with a needle. */
  function small(ctx, d, frac, lo, hi, redEnd = false) {
    agedFace(ctx, d);
    ticks(ctx, d.cx, d.cy, d.r - 5, d.r - 1.5, 150, 30, 6, '#cdbf98', 0.8);
    if (redEnd) arc(ctx, d.cx, d.cy, d.r - 2.5, 50, 30, '#d8402e', 2.2);
    text(ctx, lo, d.cx - d.r * 0.62, d.cy + d.r * 0.5, 4.4, '#cdbf98', { align: 'center' });
    text(ctx, hi, d.cx + d.r * 0.62, d.cy + d.r * 0.5, 4.4, redEnd ? '#ff6a5a' : '#cdbf98', { align: 'center' });
    needle(ctx, d.cx, d.cy, d.r - 3, 150 - 120 * frac, '#d8cfae', 1);
    agedGlass(ctx, d);
  }

  function draw(ctx, s, L) {
    // The rev counter, 0 to 3,000 rpm in hundreds, with the PTO speed marked in green.
    const t = dials[1];
    agedFace(ctx, t);
    arc(ctx, t.cx, t.cy, t.r - 3, 170 - 160 * (1500 / 3000), 170 - 160 * (1800 / 3000), '#3fb85a', 3);
    ticks(ctx, t.cx, t.cy, t.r - 6, t.r - 1.5, 170, 10, 30, '#cdbf98', 0.5);
    ticks(ctx, t.cx, t.cy, t.r - 9, t.r - 1.5, 170, 10, 6, '#cdbf98', 1);
    labels(ctx, t.cx, t.cy, t.r - 14.5, 170, 10, ['0', '5', '10', '15', '20', '25', '30'], '#cdbf98', 4.6);
    text(ctx, 'PTO', t.cx, t.cy - 4, 3.2, '#6fd18a', { align: 'center' }); // in the clear middle, off the figures
    text(ctx, 'R.P.M. x 100', t.cx, t.cy + 10, 3.4, '#a89f84', { align: 'center' });
    const h = counterDigits(s.hours, 4);
    drum(ctx, t.cx - 11.5, t.cy + 14, h.whole, h.tenth, 6);
    needle(ctx, t.cx, t.cy, t.r - 2, 170 - (160 * Math.min(3000, L.rpm)) / 3000, '#d8cfae', 1.3);
    agedGlass(ctx, t);
    small(ctx, dials[0], L.temp, 'C', 'H', true);
    small(ctx, dials[2], L.fuel, 'E', 'F');
    // The lamps along the bottom, and the key.
    warnSymbol(ctx, 'glow', 196, 93, LAMP.amber, L.glow, 0.7);
    warnSymbol(ctx, 'charge', 216, 93, LAMP.red, L.charge, 0.7);
    warnSymbol(ctx, 'oil', 236, 93, LAMP.red, L.oil, 0.7);
    keySwitch(ctx, 262, 98, s.keyOn);
  }

  return {
    group,
    mount: null,
    update(s) {
      // Cable-driven and mechanical gauges read with the key off, and swing with a little lag.
      shownRpm += (s.rpm - shownRpm) * 0.35;
      shownFuel += (s.fuelLevel - shownFuel) * 0.2;
      shownTemp += (tempGaugeFraction(s.temperature, true, s.overheat) - shownTemp) * 0.1;
      const running = s.rpm > 300;
      const L = { rpm: shownRpm, fuel: shownFuel, temp: shownTemp, glow: !!s.ignition && !!s.glow, charge: !!s.ignition && !running, oil: !!s.ignition && !running };
      const hh = counterDigits(s.hours, 4);
      if (gate([s.ignition, s.keyOn, L.glow, L.charge, Math.round(shownRpm / 8), Math.round(shownFuel * 20), Math.round(shownTemp * 20), hh.whole + hh.tenth].join('|'))) face.redraw((ctx) => draw(ctx, s, L));
    },
  };
}

// The UTV -------------------------------------------------------------------------------

function buildUtv() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 180, oy: 60 };
  // A plain black binnacle for an older machine: a small grey-green LCD with the speed, fuel and water bars, the F / N / R gear and the
  // hours, over a row of warning symbols (glow plug, battery, oil can, parking brake, seat belt and headlamp) with the key beside it.
  housing(group, { x: 70, y: 14, w: 220, h: 92, r: 14, ...O, material: plastic });
  const face = mmPanel({ x: 70, y: 14, w: 220, h: 92, ...O });
  group.add(face.mesh);
  const gate = changeGate();
  let shownMph = 0;
  let shownFuel = 0;
  let shownTemp = 0;
  const BLUE = '#4aa8ff';
  const [X, Y, W, H] = [88, 22, 136, 46]; // the LCD

  function draw(ctx, s, L) {
    const { on, ghost } = LCD;
    ctx.fillStyle = LCD.bg;
    ctx.fillRect(X, Y, W, H);
    if (s.ignition) {
      // Fuel and water, five and four blocks.
      text(ctx, 'E', X + 4, Y + 8, 3.6, on);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i < L.fuelSegs ? on : ghost;
        ctx.fillRect(X + 9 + i * 6, Y + 4, 4.6, 5);
      }
      text(ctx, 'F', X + 40, Y + 8, 3.6, on);
      text(ctx, 'C', X + 62, Y + 8, 3.6, on);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i < L.tempSegs ? on : ghost;
        ctx.fillRect(X + 67 + i * 6, Y + 4, 4.6, 5);
      }
      text(ctx, 'H', X + 93, Y + 8, 3.6, on);
      // The gear: F, N and R down the right-hand side, the current one in a box, the others plain but readable.
      ['F', 'N', 'R'].forEach((g, i) => {
        const lit = g === L.gear;
        if (lit) {
          ctx.fillStyle = on;
          ctx.fillRect(X + W - 18, Y + 12 + i * 10, 11, 9.5);
        }
        text(ctx, g, X + W - 12.5, Y + 19.8 + i * 10, 6.6, lit ? LCD.bg : on, { align: 'center', weight: 'bold' });
      });
      segText(ctx, L.speed, X + 82, Y + 15, 18, on, ghost);
      text(ctx, 'MPH', X + 86, Y + 32, 4, on);
      text(ctx, 'HRS', X + 5, Y + 42, 3.6, on);
      segText(ctx, L.hours, X + 52, Y + 36, 6.5, on);
      if (s.fourWd) warnSymbol(ctx, s.diffLock ? 'lock' : '4wd', X + 70, Y + 40.5, on, true, 0.5, false);
    } else {
      segText(ctx, '88', X + 82, Y + 15, 18, ghost);
    }
    // The warning symbols under the LCD (each lit in its colour, or dull), and the key.
    warnSymbol(ctx, 'glow', 94, 84, LAMP.amber, L.glow);
    warnSymbol(ctx, 'charge', 118, 84, LAMP.red, L.charge);
    warnSymbol(ctx, 'oil', 142, 84, LAMP.red, L.oil);
    warnSymbol(ctx, 'park', 166, 84, LAMP.red, L.park);
    warnSymbol(ctx, 'belt', 190, 84, LAMP.red, L.belt);
    warnSymbol(ctx, 'lights', 214, 84, L.main ? BLUE : LAMP.green, L.lights); // the headlights: green for dipped, blue for main beam
    warnSymbol(ctx, 'turnLeft', 234, 84, LAMP.green, L.turnLeft);
    warnSymbol(ctx, 'turnRight', 254, 84, LAMP.green, L.turnRight);
    keySwitch(ctx, 274, 46, s.keyOn);
  }

  return {
    group,
    mount: null,
    update(s) {
      shownMph += ((s.ignition ? s.speedMph : 0) - shownMph) * 0.5;
      shownFuel += ((s.ignition ? s.fuelLevel : 0) - shownFuel) * 0.2;
      shownTemp += ((s.ignition ? tempGaugeFraction(s.temperature, true, s.overheat) : 0) - shownTemp) * 0.1;
      const running = s.rpm > 300;
      const lamps = lampStates(s);
      const L = {
        speed: speedText(shownMph),
        fuelSegs: Math.ceil(shownFuel * 5 - 0.001),
        tempSegs: Math.ceil(shownTemp * 4 - 0.001),
        gear: forwardGearShown(s),
        hours: counterText(s.hours, 4),
        glow: !!s.ignition && !!s.glow,
        charge: !!s.ignition && !running,
        oil: !!s.ignition && (!running || lamps.oil),
        park: !!s.ignition && !!s.parkBrake,
        belt: !!s.ignition && !!s.beltLamp,
        lights: !!s.lightLamps?.lights,
        main: !!s.lightLamps?.main,
        turnLeft: !!s.ignition && !!s.indicatorLamps?.left,
        turnRight: !!s.ignition && !!s.indicatorLamps?.right,
      };
      const key = [s.ignition, s.keyOn, L.glow, L.charge, L.oil, L.park, L.belt, L.lights, L.main, L.turnLeft, L.turnRight, !!s.fourWd, !!s.diffLock, L.gear, L.speed, L.fuelSegs, L.tempSegs, L.hours];
      if (gate(key.join('|'))) face.redraw((ctx) => draw(ctx, s, L));
    },
  };
}

// The Land Rover ----------------------------------------------------------------------------

function buildSeries() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 180, oy: 60 };
  // A black binnacle in front of the driver, squarer than a quad's.
  housing(group, { x: 80, y: 14, w: 200, h: 92, r: 4, ...O, material: plastic });
  const face = mmPanel({ x: 80, y: 14, w: 200, h: 92, ...O });
  group.add(face.mesh);
  // A Series III binnacle: a flat black moulding with a strip of warning lamps along its top, the big speedometer at the left, the
  // combined fuel and water gauge at the right, and the ignition switch at the far end.
  const speedo = { cx: 138, cy: 66, r: 30 };
  const combo = { cx: 222, cy: 68, r: 23 };
  for (const d of [speedo, combo]) chromeRing(group, { ...d, r: d.r + 1, ...O });
  const gate = changeGate();
  let shownMph = 0;
  let shownFuel = 0;
  let shownTemp = 0;

  function draw(ctx, s, L) {
    // The lamp strip: ignition and oil in red, the handbrake red, the choke amber and the blue main beam. A Series III has nothing else (no belt lamp, no 4WD lamp, no side lights one).
    ctx.fillStyle = '#121213';
    ctx.beginPath();
    ctx.roundRect(88, 18, 184, 17, 3);
    ctx.fill();
    warnSymbol(ctx, 'charge', 108, 26.5, LAMP.red, L.charge);
    warnSymbol(ctx, 'oil', 140, 26.5, LAMP.red, L.oil);
    warnSymbol(ctx, 'park', 172, 26.5, LAMP.red, L.park);
    warnSymbol(ctx, 'choke', 204, 26.5, LAMP.amber, L.choke);
    warnSymbol(ctx, 'beam', 232, 26.5, '#4aa8ff', L.main); // the main beam tell-tale: all a Series has for its lights
    warnSymbol(ctx, 'turn', 258, 26.5, LAMP.green, L.turn); // and the indicators' arrows, one lamp for both sides
    // The speedo: 0 to 90 mph round 260 degrees, white on black, with the odometer's drums under the boss.
    ctx.fillStyle = '#0b0b0b';
    ctx.beginPath();
    ctx.arc(speedo.cx, speedo.cy, speedo.r, 0, Math.PI * 2);
    ctx.fill();
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 5, speedo.r - 1.5, 220, -40, 18, '#ece6d2', 0.5);
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 8, speedo.r - 1.5, 220, -40, 9, '#ece6d2', 1);
    labels(ctx, speedo.cx, speedo.cy, speedo.r - 13, 220, -40, ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90'], '#ece6d2', 3.8);
    text(ctx, 'MPH', speedo.cx, speedo.cy - 8, 3.4, '#ccc', { align: 'center' });
    const odo = counterDigits(s.odoMiles, 5);
    drum(ctx, speedo.cx - 14, speedo.cy + 10, odo.whole, odo.tenth, 6);
    needle(ctx, speedo.cx, speedo.cy, speedo.r - 2, 220 - (260 * Math.min(90, L.mph)) / 90, '#f0eadc', 1.2);
    // The combination gauge: fuel along its top half, water temperature along its bottom, each with its own needle.
    ctx.fillStyle = '#0b0b0b';
    ctx.beginPath();
    ctx.arc(combo.cx, combo.cy, combo.r, 0, Math.PI * 2);
    ctx.fill();
    ticks(ctx, combo.cx, combo.cy, combo.r - 5, combo.r - 1.5, 150, 30, 4, '#ece6d2', 0.8);
    ticks(ctx, combo.cx, combo.cy, combo.r - 5, combo.r - 1.5, 210, 330, 4, '#ece6d2', 0.8);
    arc(ctx, combo.cx, combo.cy, combo.r - 2.5, 315, 330, '#d8402e', 2.2);
    warnSymbol(ctx, 'fuel', combo.cx, combo.cy - 9, '#bbb', true, 0.5);
    warnSymbol(ctx, 'temp', combo.cx, combo.cy + 9, '#bbb', true, 0.5);
    text(ctx, 'E', combo.cx - combo.r * 0.62, combo.cy - 5, 3.6, '#ece6d2', { align: 'center' });
    text(ctx, 'F', combo.cx + combo.r * 0.62, combo.cy - 5, 3.6, '#ece6d2', { align: 'center' });
    text(ctx, 'C', combo.cx - combo.r * 0.62, combo.cy + 8, 3.6, '#ece6d2', { align: 'center' });
    text(ctx, 'H', combo.cx + combo.r * 0.62, combo.cy + 8, 3.6, '#ff6a5a', { align: 'center' });
    needle(ctx, combo.cx, combo.cy, combo.r - 4, 150 - 120 * L.fuel, '#f0eadc', 1);
    needle(ctx, combo.cx, combo.cy, combo.r - 4, 210 + 120 * L.temp, '#f0eadc', 1);
    keySwitch(ctx, 262, 80, s.keyOn);
  }

  return {
    group,
    mount: null,
    update(s) {
      shownMph += ((s.ignition ? s.speedMph : 0) - shownMph) * 0.5;
      shownFuel += ((s.ignition ? s.fuelLevel : 0) - shownFuel) * 0.2;
      shownTemp += ((s.ignition ? tempGaugeFraction(s.temperature, true, s.overheat) : 0) - shownTemp) * 0.1;
      const running = s.rpm > 300;
      const on = !!s.ignition;
      const L = {
        mph: shownMph,
        fuel: shownFuel,
        temp: shownTemp,
        charge: on && !running,
        oil: on && (!running || !!s.oilLow),
        choke: on && (s.choke ?? 0) > 0.05,
        park: on && !!s.parkBrake,
        main: on && !!s.lightLamps?.main,
        turn: on && !!(s.indicatorLamps?.left || s.indicatorLamps?.right),
      };
      const odo = counterDigits(s.odoMiles, 5);
      if (gate([on, s.keyOn, L.charge, L.oil, L.choke, L.park, L.main, L.turn, Math.round(shownMph * 2), Math.round(shownFuel * 20), Math.round(shownTemp * 20), odo.whole + odo.tenth].join('|'))) {
        face.redraw((ctx) => draw(ctx, s, L));
      }
    },
  };
}

// The 200TDi ---------------------------------------------------------------------------------

/**
 * An early-90s Land Rover 90's dash, in a different style from the Series': a flat grey moulding with white-on-black dials and orange
 * needles, a rev counter, the speedometer, and fuel and water gauges stacked on the right, with a row of warning lamps along the bottom
 * (glow plugs, charge, oil, handbrake, seat belts, side lights and main beam) and the key at the far end.
 */
function buildDefender() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 180, oy: 60 };
  housing(group, { x: 60, y: 14, w: 240, h: 92, r: 3, ...O, material: charcoal });
  const face = mmPanel({ x: 60, y: 14, w: 240, h: 92, ...O });
  group.add(face.mesh);
  const tacho = { cx: 98, cy: 50, r: 27 };
  const speedo = { cx: 170, cy: 50, r: 30 };
  const temp = { cx: 236, cy: 36, r: 14 };
  const fuel = { cx: 236, cy: 66, r: 14 };
  for (const d of [tacho, speedo, temp, fuel]) chromeRing(group, { ...d, r: d.r + 1, ...O, tube: 0.0018 });
  const gate = changeGate();
  let shownMph = 0;
  let shownRpm = 0;
  let shownFuel = 0;
  let shownTemp = 0;
  const SPEEDO_MAX = 100;
  const TACHO_MAX = 5000;
  const NEEDLE = '#ff8a1f'; // orange needles, white figures: the look of the newer instruments
  const WHITE = '#ffffff';
  const dial = (ctx, d) => {
    ctx.fillStyle = '#0c0d0e';
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
    ctx.fill();
  };
  /** A small gauge: an arc scale from 150 to 30 degrees, labelled at its ends. */
  const small = (ctx, d, frac, name, lo, hi, hotEnd) => {
    dial(ctx, d);
    ticks(ctx, d.cx, d.cy, d.r - 4, d.r - 1.5, 150, 30, 4, WHITE, 0.7);
    if (hotEnd) arc(ctx, d.cx, d.cy, d.r - 2, 40, 30, '#d8402e', 1.8);
    text(ctx, name, d.cx, d.cy + 1.5, 3, '#bbb', { align: 'center' });
    text(ctx, lo, d.cx - d.r * 0.62, d.cy + d.r * 0.62, 3.4, WHITE, { align: 'center' });
    text(ctx, hi, d.cx + d.r * 0.62, d.cy + d.r * 0.62, 3.4, hotEnd ? '#ff6a5a' : WHITE, { align: 'center' });
    needle(ctx, d.cx, d.cy, d.r - 3, 150 - 120 * frac, NEEDLE, 1);
  };

  function draw(ctx, s, L) {
    // The rev counter: 0 to 5,000 round 260 degrees, with the red zone from the redline.
    dial(ctx, tacho);
    arc(ctx, tacho.cx, tacho.cy, tacho.r - 2.5, -40, 220 - (260 * L.redline) / TACHO_MAX, '#d8402e', 2.2);
    ticks(ctx, tacho.cx, tacho.cy, tacho.r - 4.5, tacho.r - 1.5, 220, -40, 10, WHITE, 0.5);
    ticks(ctx, tacho.cx, tacho.cy, tacho.r - 7, tacho.r - 1.5, 220, -40, 5, WHITE, 1);
    labels(ctx, tacho.cx, tacho.cy, tacho.r - 11.5, 220, -40, ['0', '1', '2', '3', '4', '5'], WHITE, 3.8);
    text(ctx, 'RPM x1000', tacho.cx, tacho.cy + 10, 3, '#ccc', { align: 'center' });
    needle(ctx, tacho.cx, tacho.cy, tacho.r - 2, 220 - (260 * Math.min(TACHO_MAX, L.rpm)) / TACHO_MAX, NEEDLE, 1.1);
    // The speedometer: 0 to 100 mph with its odometer.
    dial(ctx, speedo);
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 5, speedo.r - 1.5, 220, -40, 20, WHITE, 0.5);
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 8, speedo.r - 1.5, 220, -40, 10, WHITE, 1);
    labels(ctx, speedo.cx, speedo.cy, speedo.r - 13, 220, -40, ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'], WHITE, 3.3);
    text(ctx, 'MPH', speedo.cx, speedo.cy - 8, 3.4, '#ccc', { align: 'center' });
    const odo = counterDigits(s.odoMiles, 6);
    drum(ctx, speedo.cx - 17, speedo.cy + 12, odo.whole, odo.tenth, 6);
    needle(ctx, speedo.cx, speedo.cy, speedo.r - 2, 220 - (260 * Math.min(SPEEDO_MAX, L.mph)) / SPEEDO_MAX, NEEDLE, 1.2);
    small(ctx, temp, L.temp, 'temp', 'C', 'H', true);
    small(ctx, fuel, L.fuel, 'fuel', 'E', 'F', false);
    // The lamps along the bottom: glow plugs, charge, oil, handbrake, seat belts, side lights and main beam. The key at the end.
    ctx.fillStyle = '#121213';
    ctx.beginPath();
    ctx.roundRect(66, 86, 208, 17, 2);
    ctx.fill();
    warnSymbol(ctx, 'glow', 82, 94.5, LAMP.amber, L.glow);
    warnSymbol(ctx, 'charge', 103.5, 94.5, LAMP.red, L.charge);
    warnSymbol(ctx, 'oil', 125, 94.5, LAMP.red, L.oil);
    warnSymbol(ctx, 'park', 146.5, 94.5, LAMP.red, L.park);
    warnSymbol(ctx, 'belt', 168, 94.5, LAMP.red, L.belt);
    warnSymbol(ctx, 'lights', 189.5, 94.5, LAMP.green, L.lights);
    warnSymbol(ctx, 'beam', 211, 94.5, '#4aa8ff', L.main);
    warnSymbol(ctx, 'turnLeft', 232.5, 94.5, LAMP.green, L.turnLeft);
    warnSymbol(ctx, 'turnRight', 254, 94.5, LAMP.green, L.turnRight);
    keySwitch(ctx, 284, 50, s.keyOn);
    // The hazard button above the key: a black surround round a red square with a white triangle, point up, flashing red with the hazards.
    ctx.fillStyle = '#050505';
    ctx.fillRect(275, 19, 18, 16);
    ctx.fillStyle = L.hazard ? '#ff3a22' : '#8c1812';
    ctx.fillRect(277, 21, 14, 12);
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(284, 22.8);
    ctx.lineTo(288.4, 30.6);
    ctx.lineTo(279.6, 30.6);
    ctx.closePath();
    ctx.stroke();
  }

  return {
    group,
    mount: null,
    update(s) {
      shownMph += ((s.ignition ? s.speedMph : 0) - shownMph) * 0.5;
      shownRpm += ((s.ignition ? s.rpm : 0) - shownRpm) * 0.35;
      shownFuel += ((s.ignition ? s.fuelLevel : 0) - shownFuel) * 0.2;
      shownTemp += ((s.ignition ? tempGaugeFraction(s.temperature, true, s.overheat) : 0) - shownTemp) * 0.1;
      const running = s.rpm > 300;
      const on = !!s.ignition;
      const L = {
        mph: shownMph,
        rpm: shownRpm,
        redline: s.redline ?? 4300,
        fuel: shownFuel,
        temp: shownTemp,
        glow: on && !!s.glow,
        charge: on && !running,
        oil: on && (!running || !!s.oilLow),
        park: on && !!s.parkBrake,
        belt: on && !!s.beltLamp,
        lights: on && !!s.lightLamps?.lights,
        main: on && !!s.lightLamps?.main,
        turnLeft: on && !!s.indicatorLamps?.left,
        turnRight: on && !!s.indicatorLamps?.right,
        hazard: !!s.hazardLit,
      };
      const odo = counterDigits(s.odoMiles, 6);
      if (gate([on, s.keyOn, L.glow, L.charge, L.oil, L.park, L.belt, L.lights, L.main, L.turnLeft, L.turnRight, L.hazard, Math.round(shownMph * 2), Math.round(shownRpm / 40), Math.round(shownFuel * 20), Math.round(shownTemp * 20), odo.whole + odo.tenth].join('|'))) {
        face.redraw((ctx) => draw(ctx, s, L));
      }
    },
  };
}

// The girls' cars ------------------------------------------------------------------------

const FIESTA_BROWN = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.75 }); // the Fiesta's binnacle, brown like its dash

/**
 * Amy's Mk1 Fiesta: a brown binnacle with two dials the same size, the speedometer to 100 mph (and its odometer) and a combined fuel
 * and water gauge, and the warning lamps between them: ignition, oil, the choke, the handbrake, the indicators and main beam. No rev
 * counter (only the sporty ones had one). The key is on the steering column, drawn at the binnacle's right end.
 */
function buildFiesta() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 180, oy: 60 };
  housing(group, { x: 76, y: 14, w: 208, h: 92, r: 6, ...O, material: FIESTA_BROWN });
  const face = mmPanel({ x: 76, y: 14, w: 208, h: 92, ...O });
  group.add(face.mesh);
  // Two dials the same size, set low in the panel: the speedometer and a combined fuel and water gauge, with the lamps in a column
  // between them, black rims, pale green-white figures and orange needles, as a 70s Ford's were.
  const speedo = { cx: 124, cy: 64, r: 29 };
  const combo = { cx: 236, cy: 64, r: 29 };
  const gate = changeGate();
  let shownMph = 0;
  let shownFuel = 0;
  let shownTemp = 0;
  const FIG = '#dfeedd';
  const NEEDLE = '#ff8a2a';
  const dial = (ctx, d) => {
    ctx.fillStyle = '#060606';
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, d.r + 2.5, 0, Math.PI * 2); // its black rim
    ctx.fill();
    ctx.fillStyle = '#101211';
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
    ctx.fill();
  };

  function draw(ctx, s, L) {
    ctx.fillStyle = '#3b2a1e'; // the brown panel the dials sit in
    ctx.fillRect(76, 14, 208, 92);
    dial(ctx, speedo);
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 4, speedo.r - 1.5, 225, -45, 20, FIG, 0.5);
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 7, speedo.r - 1.5, 225, -45, 10, FIG, 1);
    labels(ctx, speedo.cx, speedo.cy, speedo.r - 12, 225, -45, ['0', '', '20', '', '40', '', '60', '', '80', '', '100'], FIG, 4);
    text(ctx, 'MPH', speedo.cx, speedo.cy - 8, 3.2, '#a9b8a7', { align: 'center' });
    const odo = counterDigits(s.odoMiles, 5);
    drum(ctx, speedo.cx - 14, speedo.cy + 11, odo.whole, odo.tenth, 6);
    needle(ctx, speedo.cx, speedo.cy, speedo.r - 2, 225 - (270 * Math.min(100, L.mph)) / 100, NEEDLE, 1.3);
    // The combined gauge: fuel round its top half, water temperature round its bottom.
    dial(ctx, combo);
    ticks(ctx, combo.cx, combo.cy, combo.r - 5, combo.r - 1.5, 150, 30, 4, FIG, 0.8);
    ticks(ctx, combo.cx, combo.cy, combo.r - 5, combo.r - 1.5, 210, 330, 4, FIG, 0.8);
    arc(ctx, combo.cx, combo.cy, combo.r - 2.5, 315, 330, '#d8402e', 2.2);
    warnSymbol(ctx, 'fuel', combo.cx, combo.cy - 10, '#a9b8a7', true, 0.5, false);
    warnSymbol(ctx, 'temp', combo.cx, combo.cy + 10, '#a9b8a7', true, 0.5, false);
    text(ctx, 'E', combo.cx - combo.r * 0.62, combo.cy - 5, 3.6, FIG, { align: 'center' });
    text(ctx, 'F', combo.cx + combo.r * 0.62, combo.cy - 5, 3.6, FIG, { align: 'center' });
    text(ctx, 'C', combo.cx - combo.r * 0.62, combo.cy + 8, 3.6, FIG, { align: 'center' });
    text(ctx, 'H', combo.cx + combo.r * 0.62, combo.cy + 8, 3.6, '#ff6a5a', { align: 'center' });
    needle(ctx, combo.cx, combo.cy, combo.r - 4, 150 - 120 * L.fuel, NEEDLE, 1.1);
    needle(ctx, combo.cx, combo.cy, combo.r - 4, 210 + 120 * L.temp, NEEDLE, 1.1);
    // The lamps in two short rows high between the dials (the hazard switch on top of the column sits in front of the gap below them).
    ctx.fillStyle = '#1c140e';
    ctx.beginPath();
    ctx.roundRect(157, 29, 46, 26, 3);
    ctx.fill();
    warnSymbol(ctx, 'charge', 166, 36, LAMP.red, L.charge, 0.6);
    warnSymbol(ctx, 'oil', 180, 36, LAMP.red, L.oil, 0.6);
    warnSymbol(ctx, 'choke', 194, 36, LAMP.amber, L.choke, 0.6);
    warnSymbol(ctx, 'park', 166, 48, LAMP.red, L.park, 0.6);
    warnSymbol(ctx, 'turn', 180, 48, LAMP.green, L.turn, 0.6);
    warnSymbol(ctx, 'beam', 194, 48, '#4aa8ff', L.main, 0.6);
    keySwitch(ctx, 272, 96, s.keyOn);
  }

  return {
    group,
    mount: null,
    update(s) {
      shownMph += ((s.ignition ? s.speedMph : 0) - shownMph) * 0.5;
      shownFuel += ((s.ignition ? s.fuelLevel : 0) - shownFuel) * 0.2;
      shownTemp += ((s.ignition ? tempGaugeFraction(s.temperature, true, s.overheat) : 0) - shownTemp) * 0.1;
      const running = s.rpm > 300;
      const on = !!s.ignition;
      const L = {
        mph: shownMph,
        fuel: shownFuel,
        temp: shownTemp,
        charge: on && !running,
        oil: on && (!running || !!s.oilLow),
        choke: on && (s.choke ?? 0) > 0.05,
        park: on && !!s.parkBrake,
        main: on && !!s.lightLamps?.main,
        turn: on && !!(s.indicatorLamps?.left || s.indicatorLamps?.right),
      };
      const odo = counterDigits(s.odoMiles, 5);
      if (gate([on, s.keyOn, L.charge, L.oil, L.choke, L.park, L.main, L.turn, Math.round(shownMph * 2), Math.round(shownFuel * 20), Math.round(shownTemp * 20), odo.whole + odo.tenth].join('|'))) {
        face.redraw((ctx) => draw(ctx, s, L));
      }
    },
  };
}

/**
 * Jess's Corsa B: a rounded charcoal binnacle with a rev counter on the left, the speedometer to 120 mph in the middle (with the
 * odometer), the water and fuel gauges stacked on the right, red-orange needles on black, and a strip of lamps along the bottom:
 * charge, oil, engine management (it is injected), handbrake, belts, the indicators, side lights and main beam. The key is on the
 * column, drawn at the binnacle's right end.
 */
function buildCorsa() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 180, oy: 60 };
  housing(group, { x: 62, y: 12, w: 236, h: 96, r: 18, ...O, material: charcoal });
  const face = mmPanel({ x: 62, y: 12, w: 236, h: 96, ...O });
  group.add(face.mesh);
  const tacho = { cx: 106, cy: 50, r: 28 };
  const speedo = { cx: 178, cy: 50, r: 33 };
  const temp = { cx: 246, cy: 36, r: 13 };
  const fuel = { cx: 246, cy: 66, r: 13 };
  const gate = changeGate();
  let shownMph = 0;
  let shownRpm = 0;
  let shownFuel = 0;
  let shownTemp = 0;
  const TACHO_MAX = 7000;
  const NEEDLE = '#ff5a1f';
  const WHITE = '#f4f4f4';
  const dial = (ctx, d) => {
    ctx.fillStyle = '#0b0c0d';
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
    ctx.fill();
  };
  const small = (ctx, d, frac, sym, hotEnd) => {
    dial(ctx, d);
    ticks(ctx, d.cx, d.cy, d.r - 4, d.r - 1.5, 150, 30, 4, WHITE, 0.7);
    if (hotEnd) arc(ctx, d.cx, d.cy, d.r - 2, 40, 30, '#d8402e', 1.8);
    warnSymbol(ctx, sym, d.cx, d.cy + 5, '#aaa', true, 0.42, false);
    needle(ctx, d.cx, d.cy, d.r - 3, 150 - 120 * frac, NEEDLE, 1);
  };

  function draw(ctx, s, L) {
    dial(ctx, tacho);
    arc(ctx, tacho.cx, tacho.cy, tacho.r - 2.5, -45, 225 - (270 * L.redline) / TACHO_MAX, '#d8402e', 2.2);
    ticks(ctx, tacho.cx, tacho.cy, tacho.r - 4.5, tacho.r - 1.5, 225, -45, 14, WHITE, 0.5);
    ticks(ctx, tacho.cx, tacho.cy, tacho.r - 7, tacho.r - 1.5, 225, -45, 7, WHITE, 1);
    labels(ctx, tacho.cx, tacho.cy, tacho.r - 11.5, 225, -45, ['0', '1', '2', '3', '4', '5', '6', '7'], WHITE, 3.8);
    text(ctx, '1/min x1000', tacho.cx, tacho.cy + 11, 2.8, '#bbb', { align: 'center' });
    needle(ctx, tacho.cx, tacho.cy, tacho.r - 2, 225 - (270 * Math.min(TACHO_MAX, L.rpm)) / TACHO_MAX, NEEDLE, 1.1);
    dial(ctx, speedo);
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 5, speedo.r - 1.5, 225, -45, 24, WHITE, 0.5);
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 8, speedo.r - 1.5, 225, -45, 12, WHITE, 1);
    labels(ctx, speedo.cx, speedo.cy, speedo.r - 13, 225, -45, ['0', '', '20', '', '40', '', '60', '', '80', '', '100', '', '120'], WHITE, 3.8);
    text(ctx, 'mph', speedo.cx, speedo.cy - 9, 3.4, '#bbb', { align: 'center' });
    const odo = counterDigits(s.odoMiles, 6);
    drum(ctx, speedo.cx - 17, speedo.cy + 12, odo.whole, odo.tenth, 6);
    needle(ctx, speedo.cx, speedo.cy, speedo.r - 2, 225 - (270 * Math.min(120, L.mph)) / 120, NEEDLE, 1.2);
    small(ctx, temp, L.temp, 'temp', true);
    small(ctx, fuel, L.fuel, 'fuel', false);
    ctx.fillStyle = '#121213';
    ctx.beginPath();
    ctx.roundRect(78, 88, 196, 16, 4);
    ctx.fill();
    const lamps = [['charge', LAMP.red, L.charge], ['oil', LAMP.red, L.oil], ['engine', LAMP.amber, L.engine], ['park', LAMP.red, L.park], ['belt', LAMP.red, L.belt], ['turnLeft', LAMP.green, L.turnLeft], ['turnRight', LAMP.green, L.turnRight], ['lights', LAMP.green, L.lights], ['beam', '#4aa8ff', L.main]];
    lamps.forEach(([kind, colour, lit], i) => warnSymbol(ctx, kind, 90 + i * 21.5, 96, colour, lit, 0.85));
    keySwitch(ctx, 286, 86, s.keyOn);
  }

  return {
    group,
    mount: null,
    update(s) {
      shownMph += ((s.ignition ? s.speedMph : 0) - shownMph) * 0.5;
      shownRpm += ((s.ignition ? s.rpm : 0) - shownRpm) * 0.35;
      shownFuel += ((s.ignition ? s.fuelLevel : 0) - shownFuel) * 0.2;
      shownTemp += ((s.ignition ? tempGaugeFraction(s.temperature, true, s.overheat) : 0) - shownTemp) * 0.1;
      const running = s.rpm > 300;
      const on = !!s.ignition;
      const L = {
        mph: shownMph,
        rpm: shownRpm,
        redline: s.redline ?? 6000,
        fuel: shownFuel,
        temp: shownTemp,
        charge: on && !running,
        oil: on && (!running || !!s.oilLow),
        engine: on && !running, // the injection's lamp: on with the key, out once it runs
        park: on && !!s.parkBrake,
        belt: on && !!s.beltLamp,
        lights: on && !!s.lightLamps?.lights,
        main: on && !!s.lightLamps?.main,
        turnLeft: on && !!s.indicatorLamps?.left,
        turnRight: on && !!s.indicatorLamps?.right,
      };
      const odo = counterDigits(s.odoMiles, 6);
      if (gate([on, s.keyOn, L.charge, L.oil, L.engine, L.park, L.belt, L.lights, L.main, L.turnLeft, L.turnRight, Math.round(shownMph * 2), Math.round(shownRpm / 40), Math.round(shownFuel * 20), Math.round(shownTemp * 20), odo.whole + odo.tenth].join('|'))) {
        face.redraw((ctx) => draw(ctx, s, L));
      }
    },
  };
}

/** Dash styles buildDash knows: every quad spec must name one of these. */
export const DASH_STYLES = ['foreman', 'grizzly', 'kodiak', 'bayou', 'blaster', 'quadracer', 'kidsKey', 'tractor', 'utv', 'series', 'defender', 'fiesta', 'corsa'];

/** Where each dash sits on the bars (metres, in the bars' frame) and how far it tilts back. A nacelle quad carries its own on its top. */
export const DASH_PLACE = {
  foreman: { pos: [0, 0.1, 0.02], tilt: 0.75 },
  grizzly: { pos: [0, 0.1, 0.02], tilt: 0.75 },
  kodiak: { pos: [0, 0.1, 0.02], tilt: 0.75 },
  bayou: { pos: [0, 0.115, 0.05], tilt: 0.85 },
  blaster: { pos: [0, 0.08, 0.04], tilt: 0.45 }, // sat down on the bar clamp, not floating over it
  quadracer: { pos: [0.225, 0.085, -0.035], tilt: 0.9 },
  kidsKey: { pos: [0, 0.075, 0.0], tilt: 0.9 },
  tractor: { pos: [0, 0, 0], tilt: 1.05 }, // the tractor's model places it on its scuttle itself
  utv: { pos: [0, 0, 0], tilt: 0.9 }, // so does the UTV's
  series: { pos: [0, 0, 0], tilt: 0.55 }, // and the Land Rover's
  defender: { pos: [0, 0, 0], tilt: 0.55 }, // and the 200TDi's
  fiesta: { pos: [0, 0, 0], tilt: 0.5 }, // and the girls' cars'
  corsa: { pos: [0, 0, 0], tilt: 0.5 },
};

const BUILDERS = {
  foreman: buildForeman,
  grizzly: buildGrizzly,
  kodiak: buildKodiak,
  bayou: buildBayou,
  blaster: buildBlaster,
  quadracer: buildQuadracer,
  kidsKey: buildKidsKey,
  tractor: buildTractor,
  utv: buildUtv,
  series: buildSeries,
  defender: buildDefender,
  fiesta: buildFiesta,
  corsa: buildCorsa,
};

export function buildDash(style = 'foreman') {
  return (BUILDERS[style] ?? buildForeman)();
}
