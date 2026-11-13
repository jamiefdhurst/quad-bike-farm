import * as THREE from 'three';
import { tempGaugeFraction, HOT_FROM } from './tempGauge.js';
import { MAKERS } from './detail/decals.js';
import { lampStates, counterDigits, counterText, cycleIndex, gearShown, forwardGearShown, voltsFraction } from './dashState.js';
import {
  plastic, charcoal, blackMat, agedSteel, agedBlack, gloss, chromeMat, changeGate, mmPanel, housing, chromeRing, text, ticks, labels, arc, needle, drum, lamp, glyphLetter, keySwitch,
  segText, speedText, warnSymbol, LAMP, pol,
} from './dashParts.js';

// The stock dashes. Each quad's own dash is close to the real machine it's modelled on, which for most means very little: the
// instruments are on the two accessory pods (dashPod.js). Layouts and colours follow docs/briefs/dashes/ (see
// docs/decisions/vehicles.md, "The dashes").
//
//   farm300:   red. A utility-quad cover: a rectangular speedo with hour and odometer drums, N / R / OIL lamps and the key.
//   bruin:   blue. A big-farm-quad pod around a cyan-backlit LCD: a big speed, the odometer (or the trip) and the hours, a thermometer
//              and a fuel pump symbol, a column of L, H, R and P lamps, a DIFF.LOCK lamp and two round buttons.
//   ursa:    loan quad. The same idea, newer: a wider, glossier pod with a cooler LCD and a gear column.
//   rb300:     green. A round black speedo on a stalk over the bars: white mph to 40 with a blue km/h scale inside, an odometer window,
//              N and R lamps and the key under the needle's hub.
//   hornet:   yellow. Only the key, in a small housing on the bar clamp.
//   adder: orange. A RUN / OFF kill switch on the left bar and its lanyard.
//   kidsKey:   mini moto, old three-wheeler. A key switch under the bar clamp. asp: the kids' quad's, the same key on the V bars' clamp block.
//   trail:     the farm bike: a round white-faced speedo to 70 mph in a black bezel, with an odometer drum, an ignition lamp and the key.
//   mower:     the ride-on mower (#76): a small black panel with an hour meter, a red charge lamp, an amber blade lamp that lights while the blade is engaged, and the key.
//   plover:    the old bike: a round speedo to 70 mph with an odometer drum, a red ignition lamp and the key, in a cup on the headlamp's top.
//   tractor:   the tractor (a tractor cluster, TODO 98). Three round dials in chrome bezels set straight into the red metal of the cowl, no housing (a big rev counter with an hour meter and the PTO speed marked, water temperature, fuel), a brass ignition switch, and four warning lamps (temperature, GLOW, CHARGE, OIL).
//   utv:       the UTV (a side-by-side cluster, TODO 99): a round speedo to 40 mph with its odometer between four lamp pockets (glow, charge, oil, parking brake), a strip of the rest of the tell-tales, a separate fuel and hours unit and a key switch in 3D. It was a basic LCD over symbols for glow, charge, oil, park
//              (parking brake), a belted figure (flashes while someone sits unbelted), a headlamp (green, blue for main beam) and the key.
//   finch:    Amy's Finch: a speedo and a combined fuel and water gauge the same size, the lamps between them, on brown. griffin: Jess's Griffin, with a rev counter too.
//   vauclair:      your Vauclair: a speedo and a clock, the lamps between, fuel and water in pockets at the ends.
//   tor:    the Tor. An old binnacle: a big speedo to 90 mph with its odometer, a combined fuel and water gauge,
//              IGN, OIL, CHOKE and BRAKE lamps, a 4WD and a DIFF lamp, and the key.
//
// buildDash(style) returns { group, update(state), mount } where state is { rpm, maxRpm, redline, speedMph, fuelLevel, reserveLevel,
// tap, temperature, overheat, coldBelow, ignition (has power), keyOn, tripMiles, odoMiles, hours, reverse, neutral, clock, seconds }.
// The group faces the rider along -Z and its +X is on the rider's left. `mount` is where a pod stands (a child of the group) or null.

const LCD = { bg: '#a9b59d', on: '#1f261c', ghost: '#9aa68f', dim: '#b0bba5' }; // Bruin 660: positive, grey-green
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

// Red: Farm 300 ------------------------------------------------------------------

/** The maker's name in its badge style on a dash face, centred at (x, y): italic capitals with an outline, as on the bodywork. */
function makerBadge(ctx, maker, x, y, size, maxW = 0) {
  const m = MAKERS[maker];
  ctx.save();
  ctx.font = `italic 900 ${size}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = m.name.toUpperCase();
  if (maxW && ctx.measureText(text).width > maxW) ctx.font = `italic 900 ${(size * maxW) / ctx.measureText(text).width}px Helvetica, Arial, sans-serif`;
  if (m.edge) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = m.edge;
    ctx.strokeText(m.name.toUpperCase(), x, y);
  }
  ctx.fillStyle = m.ink;
  ctx.fillText(m.name.toUpperCase(), x, y);
  ctx.restore();
}

function buildFarm300() {
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
    drum(ctx, 128, 40, h);
    text(ctx, 'ODOMETER', 128, 57, 3.6, '#ccc');
    const o = counterDigits(s.odoMiles, 4);
    drum(ctx, 128, 60, o);
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
    makerBadge(ctx, 'kestrel', 141, 82, 8, 30); // in the window under the hour and odometer drums, where the face was empty
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
      if (gate(lookKey(s, [Math.round(shownMph * 4), o.key, h.key]))) face.redraw((ctx) => draw(ctx, s, L));
    },
  };
}

// The two LCDs --------------------------------------------------------------------------

/** The Bruin's gear column letter that is lit: its selector has L, H, R and P, so forward is H, reverse is R and stopped in neutral is P. */
export function bruinGear(s) {
  return s.reverse ? 'R' : s.neutral ? 'P' : 'H';
}

function buildBruin() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 180, oy: 62 };
  housing(group, { x: 64, y: 10, w: 232, h: 104, r: 14, ...O, material: charcoal });
  const face = mmPanel({ x: 64, y: 10, w: 232, h: 104, ...O });
  group.add(face.mesh);
  const gate = changeGate();
  const LCD_BACKLIT = { bg: '#5fcfcb', on: '#154850', ghost: '#55bfbb' }; // after a photo of the real one: a cyan backlight, dark teal digits

  function draw(ctx, s, L) {
    // The brow, and the black window round the whole instrument.
    ctx.fillStyle = '#202124';
    ctx.beginPath();
    ctx.moveTo(100, 16);
    ctx.lineTo(260, 16);
    ctx.lineTo(254, 22);
    ctx.lineTo(106, 22);
    ctx.fill();
    ctx.fillStyle = '#121314';
    ctx.beginPath();
    ctx.roundRect(70, 24, 220, 84, 8);
    ctx.fill();
    // The two round buttons on the left (SELECT and RESET).
    ctx.fillStyle = '#1c1d1f';
    ctx.strokeStyle = '#2c2e30';
    ctx.lineWidth = 1;
    for (const by of [44, 82]) {
      ctx.beginPath();
      ctx.arc(84, by, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // The diff lock lamp in a chamfered window above the gear column, with its name beside it; the lamp glows amber when the lock is on.
    ctx.strokeStyle = '#4a4d50';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#17181a';
    ctx.beginPath();
    ctx.moveTo(103, 27);
    ctx.lineTo(122, 27);
    ctx.lineTo(126, 31);
    ctx.lineTo(126, 40);
    ctx.lineTo(122, 44);
    ctx.lineTo(103, 44);
    ctx.lineTo(99, 40);
    ctx.lineTo(99, 31);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (L.diffLock) {
      ctx.fillStyle = LAMP.amber;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(112.5, 35.5, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = L.diffLock ? LAMP.amber : '#3a3b3c';
    ctx.beginPath();
    ctx.arc(112.5, 35.5, 5, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'DIFF.LOCK', 131, 31.5, 6.4, '#e2e2de', { weight: 'bold' });
    // The gear column: L, H, R and P in a pill, the current one a green lamp.
    ctx.strokeStyle = '#3a3d40';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.roundRect(103, 49, 19, 56, 6);
    ctx.stroke();
    [...'LHRP'].forEach((g, i) => {
      const lit = L.on && g === L.gear;
      const gy = 59 + i * 13;
      if (lit) {
        ctx.fillStyle = LAMP.green;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.roundRect(100.5, gy - 8, 24, 16, 5);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#d6ffe0';
        ctx.beginPath();
        ctx.roundRect(105.5, gy - 5.5, 14, 11, 3);
        ctx.fill();
      }
      text(ctx, g, 112.5, gy + 3.2, 9, lit ? '#0d3a1c' : '#8e9296', { align: 'center', weight: 'bold' });
    });
    // The LCD.
    const [x, y, w, h] = [132, 38, 122, 64];
    const { on, ghost } = LCD_BACKLIT;
    ctx.fillStyle = '#2a2c2e';
    ctx.beginPath();
    ctx.roundRect(x - 3, y - 3, w + 6, h + 6, 6);
    ctx.fill();
    ctx.fillStyle = LCD_BACKLIT.bg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    if (s.ignition) {
      segText(ctx, L.speed, x + w - 28, y + 5, 34, on, ghost);
      text(ctx, 'mph', x + w - 5, y + 31, 6, on, { align: 'right', weight: 'bold' });
      warnSymbol(ctx, 'temp', x + w - 12, y + 9, on, L.lamps.temp, 0.8, false);
      warnSymbol(ctx, 'fuel', x + 10, y + 9, on, L.lamps.fuel, 0.8, false);
      ctx.strokeStyle = ghost;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x + w - 20, y + 3);
      ctx.lineTo(x + w - 20, y + 38);
      ctx.stroke();
      segText(ctx, L.line[1], x + 54, y + 43, 10.5, on, ghost);
      text(ctx, L.line[0], x + 6, y + h - 3, 5.6, on, { weight: 'bold' });
      segText(ctx, L.hours, x + w - 5, y + 43, 10.5, on, ghost);
      text(ctx, 'HOUR', x + w - 5, y + h - 3, 5.6, on, { align: 'right', weight: 'bold' });
    } else {
      segText(ctx, '88', x + w - 28, y + 5, 34, ghost);
    }
    // The maker's round badge, on the right of the window beside the LCD.
    ctx.strokeStyle = '#9a9ea2';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(274, 70, 9, 0, Math.PI * 2);
    ctx.stroke();
    text(ctx, 'T', 274, 74.4, 11, '#9a9ea2', { align: 'center', weight: 'bold' });
  }

  return {
    group,
    mount: podMount(group, 0, 0.06, 0, 0.75),
    update(s) {
      const odoTrip = cycleIndex(s.seconds ?? 0, 2); // the left reading alternates between the odometer and the trip
      const line = odoTrip ? ['TRIP', counterText(s.tripMiles, 4)] : ['ODO', counterText(s.odoMiles, 5)];
      const L = { on: !!s.ignition, lamps: lampStates(s), speed: speedText(s.speedMph), line, hours: counterText(s.hours, 4), gear: bruinGear(s), diffLock: s.diffLock === true };
      const key = lookKey(s, [L.speed, L.gear, L.diffLock, line.join(' '), L.hours]);
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

function buildUrsa() {
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

// Green: RB300 ---------------------------------------------------------------

/** The RB300's speedo: mph 0 to 40 sweeping 220 degrees from the lower left to the lower right, 20 at the top. */
export const RB300_DIAL = { from: 200, to: -20, maxMph: 40 };

/** The needle's angle in degrees for a speed, held to the dial's end. */
export function rb300NeedleAngle(mph) {
  const { from, to, maxMph } = RB300_DIAL;
  return from + ((to - from) * Math.min(maxMph, Math.max(0, mph))) / maxMph;
}

function buildRb300() {
  const group = new THREE.Group();
  group.name = 'dash';
  const [cx, cy] = [150, 50];
  // A round black cup with a bezel lip, open towards the rider (-Z), the dial recessed in it.
  const cup = new THREE.LatheGeometry(
    [[0, -0.032], [0.05, -0.032], [0.0545, -0.026], [0.0545, 0.026], [0.0515, 0.034], [0.0465, 0.034], [0.0465, 0.026], [0.0455, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)),
    40,
  ).rotateX(-Math.PI / 2);
  const cupMesh = new THREE.Mesh(cup, plastic);
  cupMesh.name = 'dashHousing';
  group.add(cupMesh);
  const face = mmPanel({ x: cx - 50, y: cy - 50, w: 100, h: 100, ox: cx, oy: cy, z: -0.0185 });
  group.add(face.mesh);
  const gate = changeGate();
  let shownMph = 0;
  const KMH = [10, 20, 30, 40, 50, 60];

  function draw(ctx, s, L) {
    const { from, to } = RB300_DIAL;
    ctx.fillStyle = '#0a0a0b';
    ctx.beginPath();
    ctx.arc(cx, cy, 45, 0, Math.PI * 2);
    ctx.fill();
    // The mph scale: a tick every 2, long ones with figures every 10, white on black.
    ticks(ctx, cx, cy, 39, 44, from, to, 20, '#e9e9e6', 0.7);
    ticks(ctx, cx, cy, 35, 44, from, to, 4, '#ffffff', 1.5);
    labels(ctx, cx, cy, 29, from, to, ['0', '10', '20', '30', '40'], '#f2f2ef', 7.5);
    // The km/h scale inside it, in blue: an arc and small figures.
    arc(ctx, cx, cy, 23, from, to, '#2a8fd6', 0.8);
    KMH.forEach((k) => {
      const a = rb300NeedleAngle(k / 1.609344);
      const [x0, y0] = pol(cx, cy, 23, a);
      const [x1, y1] = pol(cx, cy, 20.5, a);
      ctx.strokeStyle = '#2a8fd6';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      const [tx, ty] = pol(cx, cy, 17, a);
      text(ctx, String(k), tx, ty + 1.2, 3.4, '#2a8fd6', { align: 'center' });
    });
    // The odometer's window, at the top, and the unit names under the needle's hub.
    drum(ctx, cx - 13.8, 28, L.odo, 7);
    text(ctx, 'km/h', cx, 59.5, 3.8, '#2a8fd6', { align: 'center' });
    text(ctx, 'mph', cx, 65, 5, '#f2f2ef', { align: 'center', weight: 'bold' });
    makerBadge(ctx, 'ridgeback', cx, 72, 7, 26);
    // The needle, white, and a grey hub on its pivot; then the lamps and the key in the empty sector under the dial.
    needle(ctx, cx, cy, 41, rb300NeedleAngle(L.mph), '#f4f4ee', 1.5);
    ctx.fillStyle = '#4a4c4f';
    ctx.beginPath();
    ctx.arc(cx, cy, 4.2, 0, Math.PI * 2);
    ctx.fill();
    glyphLetter(ctx, cx - 21, 80, LAMP.green, 'N', L.lamps.n, 7); // in from the bezel, which is at 46 mm out
    glyphLetter(ctx, cx + 21, 80, LAMP.amber, 'R', L.lamps.r, 7);
    keySwitch(ctx, cx, 87, s.keyOn);
  }

  return {
    group,
    mount: podMount(group, 0, 0.062, 0, 0.85),
    update(s) {
      // The needle follows the road speed with a little lag, like a cable.
      shownMph += ((s.ignition ? s.speedMph : 0) - shownMph) * 0.5;
      const o = counterDigits(s.odoMiles, 6);
      const L = { lamps: lampStates(s), mph: shownMph, odo: o };
      if (gate(lookKey(s, [Math.round(shownMph * 4), o.key]))) face.redraw((ctx) => draw(ctx, s, L));
    },
  };
}

// The old bike's speedo ----------------------------------------------------------------

/** The old bike's speedo: mph 0 to 70 sweeping 270 degrees from the lower left to the lower right, 35 at the top. */
export const SMITHS_DIAL = { from: 225, to: -45, maxMph: 70 };

export function smithsNeedleAngle(mph) {
  const { from, to, maxMph } = SMITHS_DIAL;
  return from + ((to - from) * Math.min(maxMph, Math.max(0, mph))) / maxMph;
}

function buildPloverDash() {
  const group = new THREE.Group();
  group.name = 'dash';
  const [cx, cy] = [150, 50];
  // A round cup in the body paint colour's place (a dark one here, the model paints its own bezel), open towards the rider (-Z).
  const cup = new THREE.LatheGeometry(
    [[0, -0.03], [0.047, -0.03], [0.0515, -0.024], [0.0515, 0.022], [0.0485, 0.03], [0.0435, 0.03], [0.0425, 0.022], [0.0415, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)),
    40,
  ).rotateX(-Math.PI / 2);
  const cupMesh = new THREE.Mesh(cup, plastic);
  cupMesh.name = 'dashHousing';
  group.add(cupMesh);
  const face = mmPanel({ x: cx - 46, y: cy - 46, w: 92, h: 92, ox: cx, oy: cy, z: -0.0175 });
  group.add(face.mesh);
  const gate = changeGate();
  let shownMph = 0;

  function draw(ctx, s, L) {
    const { from, to } = SMITHS_DIAL;
    ctx.fillStyle = '#0c0c0b';
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.fill();
    // Cream figures every ten, a tick every five and a short one between, as on the old instruments.
    ticks(ctx, cx, cy, 37, 41, from, to, 70, '#d9d3bd', 0.5);
    ticks(ctx, cx, cy, 34, 41, from, to, 14, '#ece6cf', 1.1);
    labels(ctx, cx, cy, 27, from, to, ['0', '10', '20', '30', '40', '50', '60', '70'], '#ece6cf', 6.4);
    text(ctx, 'MILES', cx, cy - 14, 3.6, '#c9c3ad', { align: 'center', spacing: 0.4 });
    text(ctx, 'PER HOUR', cx, cy - 10, 2.8, '#c9c3ad', { align: 'center', spacing: 0.3 });
    drum(ctx, cx - 13.8, cy + 12, L.odo, 7);
    makerBadge(ctx, 'ashby', cx, cy + 27, 5.4, 24);
    // A red ignition lamp low on the face, lit with the key; the key's own switch beside it.
    lamp(ctx, cx - 17, cy + 31, LAMP.red, '', L.lit, { r: 2.6 });
    keySwitch(ctx, cx + 17, cy + 31, s.keyOn);
    needle(ctx, cx, cy, 38, smithsNeedleAngle(L.mph), '#e8dfb6', 1.2);
    ctx.fillStyle = '#58584f';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    group,
    mount: podMount(group, 0, 0.058, 0, 0.85),
    update(s) {
      // The needle follows the road speed with a little lag, like a cable.
      shownMph += ((s.ignition ? s.speedMph : 0) - shownMph) * 0.5;
      const o = counterDigits(s.odoMiles, 6);
      const L = { mph: shownMph, odo: o, lit: !!s.ignition };
      if (gate(lookKey(s, [Math.round(shownMph * 4), o.key]))) face.redraw((ctx) => draw(ctx, s, L));
    },
  };
}

// The farm bike's speedo ------------------------------------------------------------------

/** The trail bike's speedo: a round white-faced dial in a black bezel, mph 0 to 70 as the old bike's,, with an ignition lamp and the key. */
function buildTrail() {
  const group = new THREE.Group();
  group.name = 'dash';
  const [cx, cy] = [150, 50];
  const cup = new THREE.LatheGeometry(
    [[0, -0.03], [0.047, -0.03], [0.0515, -0.024], [0.0515, 0.022], [0.0485, 0.03], [0.0435, 0.03], [0.0425, 0.022], [0.0415, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)),
    40,
  ).rotateX(-Math.PI / 2);
  const cupMesh = new THREE.Mesh(cup, plastic);
  cupMesh.name = 'dashHousing';
  group.add(cupMesh);
  const face = mmPanel({ x: cx - 46, y: cy - 46, w: 92, h: 92, ox: cx, oy: cy, z: -0.0175 });
  group.add(face.mesh);
  const gate = changeGate();
  let shownMph = 0;

  function draw(ctx, s, L) {
    const { from, to } = SMITHS_DIAL;
    ctx.fillStyle = '#0c0c0b';
    ctx.beginPath();
    ctx.arc(cx, cy, 43, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e9e8e1';
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.fill();
    ticks(ctx, cx, cy, 36, 39, from, to, 70, '#2a2a28', 0.5);
    ticks(ctx, cx, cy, 33, 39, from, to, 14, '#1c1c1a', 1.1);
    labels(ctx, cx, cy, 26, from, to, ['0', '10', '20', '30', '40', '50', '60', '70'], '#1c1c1a', 6.2);
    text(ctx, 'MPH', cx, cy - 12, 4, '#3a3a36', { align: 'center', spacing: 0.4 });
    drum(ctx, cx - 13.8, cy + 12, L.odo, 7);
    makerBadge(ctx, 'ridgeback', cx, cy + 27, 5.4, 24);
    lamp(ctx, cx - 17, cy + 31, LAMP.red, '', L.lit, { r: 2.6 });
    keySwitch(ctx, cx + 17, cy + 31, s.keyOn);
    needle(ctx, cx, cy, 37, smithsNeedleAngle(L.mph), '#e0b400', 1.4);
    ctx.fillStyle = '#6a6a64';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    group,
    mount: podMount(group, 0, 0.058, 0, 0.85),
    update(s) {
      shownMph += ((s.ignition ? s.speedMph : 0) - shownMph) * 0.5;
      const o = counterDigits(s.odoMiles, 6);
      const L = { mph: shownMph, odo: o, lit: !!s.ignition };
      if (gate(lookKey(s, [Math.round(shownMph * 4), o.key]))) face.redraw((ctx) => draw(ctx, s, L));
    },
  };
}

// Yellow: Hornet 200 ----------------------------------------------------------------

// Just the key, in a small black housing on the bar clamp: no lamp, no gauge (the Hornet's headlamp is in its nose, not here).
function buildHornet() {
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

// Orange: Adder 250 ------------------------------------------------------------------

function buildAdder() {
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

// The ride-on mower ------------------------------------------------------------------------

// A small black panel on the dash: the hour meter, a red charge lamp that is lit with the key on and the engine not yet charging, an amber lamp
// that lights while the blade is engaged, and the key switch. No speedo: you judge your speed by the grass.
function buildMower() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 150, oy: 40 };
  housing(group, { x: 118, y: 24, w: 64, h: 32, r: 4, ...O, material: blackMat, depth: 0.03 });
  const face = mmPanel({ x: 118, y: 24, w: 64, h: 32, ...O });
  group.add(face.mesh);
  const gate = changeGate();
  function draw(ctx, s, L) {
    ctx.fillStyle = '#121212';
    ctx.fillRect(118, 24, 64, 32);
    text(ctx, 'HOURS', 134, 31, 3.4, '#9a9a94', { align: 'center', spacing: 0.3 });
    drum(ctx, 124, 34, L.hours, 7);
    lamp(ctx, 134, 51, LAMP.red, 'CHARGE', L.charge, { r: 2.4 });
    lamp(ctx, 150, 51, LAMP.amber, 'BLADE', L.blade, { r: 2.4 });
    makerBadge(ctx, 'ridgeback', 166, 31, 4.4, 20);
    keySwitch(ctx, 166, 45, s.keyOn);
  }
  return {
    group,
    mount: null,
    update(s) {
      const h = counterDigits(s.hours, 4);
      const L = { hours: h, charge: !!s.keyOn && !!s.ignition && s.rpm < 1200, blade: !!s.bladeOn && !!s.ignition };
      if (gate(lookKey(s, [h.key, L.charge, L.blade]))) face.redraw((ctx) => draw(ctx, s, L));
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
  // The tractor cluster (TODO 98), set straight into the red metal of the cowl, no housing and no plastic: the model puts
  // a pressed steel panel behind this face, and the dials, the key's brass plate and the lamps are drawn on it. A big rev counter in the
  // middle with its hours drum and the PTO speed marked, fuel on its left over the ignition switch and water temperature on its right,
  // each in a chrome bezel; the four warning lamps in a row centred under the rev counter. All of it inside the plate's edges.
  const face = mmPanel({ x: 60, y: 20, w: 260, h: 100, ...O });
  group.add(face.mesh);
  const dials = [
    { cx: 250, cy: 56, r: 19 }, // water temperature
    { cx: 180, cy: 62, r: 34 }, // the rev counter
    { cx: 110, cy: 56, r: 19 }, // fuel
  ];
  for (const d of dials) {
    chromeRing(group, { ...d, r: d.r + 1.2, ...O, material: chromeMat, tube: 0.0034 });
    chromeRing(group, { ...d, r: d.r + 2.6, ...O, z: -0.0345, material: chromeMat, tube: 0.0022 }); // and the bezel's rolled outer lip
  }
  const gate = changeGate();
  let shownRpm = 0;
  let shownFuel = 0;
  let shownTemp = 0;

  /** A small dial: a black face with a white arc scale from 150 to 30 degrees and a needle. */
  function small(ctx, d, frac, lo, hi, redEnd = false) {
    ctx.fillStyle = '#0c0c0b';
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
    ctx.fill();
    ticks(ctx, d.cx, d.cy, d.r - 5, d.r - 1.5, 150, 30, 6, '#e6e2d4', 0.8);
    if (redEnd) arc(ctx, d.cx, d.cy, d.r - 2.5, 150 - 120 * HOT_FROM, 30, '#d8402e', 2.2);
    else arc(ctx, d.cx, d.cy, d.r - 2.5, 105, 75, '#3fb85a', 2.2);
    text(ctx, lo, d.cx - d.r * 0.62, d.cy + d.r * 0.5, 4.4, '#e6e2d4', { align: 'center' });
    text(ctx, hi, d.cx + d.r * 0.62, d.cy + d.r * 0.5, 4.4, redEnd ? '#ff6a5a' : '#e6e2d4', { align: 'center' });
    needle(ctx, d.cx, d.cy, d.r - 3, 150 - 120 * frac, '#f2efe4', 1);
    agedGlass(ctx, d);
  }

  function draw(ctx, s, L) {
    // The rev counter, 0 to 3,000 rpm in hundreds, with the PTO speed marked in green and the hours drum under the needle's hub.
    const t = dials[1];
    ctx.fillStyle = '#0c0c0b';
    ctx.beginPath();
    ctx.arc(t.cx, t.cy, t.r, 0, Math.PI * 2);
    ctx.fill();
    arc(ctx, t.cx, t.cy, t.r - 3, 170 - 160 * (1500 / 3000), 170 - 160 * (1800 / 3000), '#3fb85a', 3);
    arc(ctx, t.cx, t.cy, t.r - 7, 170 - 160 * (1500 / 3000), 170 - 160 * (1800 / 3000), '#d8402e', 2);
    ticks(ctx, t.cx, t.cy, t.r - 6, t.r - 1.5, 170, 10, 30, '#e6e2d4', 0.5);
    ticks(ctx, t.cx, t.cy, t.r - 9, t.r - 1.5, 170, 10, 6, '#e6e2d4', 1);
    labels(ctx, t.cx, t.cy, t.r - 14.5, 170, 10, ['0', '5', '10', '15', '20', '25', '30'], '#f2efe4', 4.6);
    text(ctx, 'HARTLEY', t.cx, t.cy - 8, 4.2, '#f2efe4', { align: 'center', weight: 'bold', style: 'italic' });
    text(ctx, 'REV COUNTER', t.cx, t.cy - 3.5, 2.6, '#cfcabb', { align: 'center' });
    text(ctx, 'R.P.M. x 100', t.cx, t.cy + 11, 3.2, '#cfcabb', { align: 'center' });
    const h = counterDigits(s.hours, 4);
    drum(ctx, t.cx - 11.5, t.cy + 14, h, 6);
    needle(ctx, t.cx, t.cy, t.r - 2, 170 - (160 * Math.min(3000, L.rpm)) / 3000, '#f2efe4', 1.3);
    agedGlass(ctx, t);
    small(ctx, dials[0], L.temp, 'C', 'H', true);
    small(ctx, dials[2], L.fuel, 'E', 'F');
    // The warning lamps in a row under the rev counter, each in a chrome bezel's ring.
    for (const [kind, x, colour, lit] of [['temp', 141, LAMP.red, L.hot], ['glow', 167, LAMP.red, L.glow], ['charge', 193, LAMP.red, L.charge], ['oil', 219, LAMP.red, L.oil]].map(([k, x, c, l]) => [k, x, k === 'glow' ? LAMP.amber : c, l])) {
      ctx.fillStyle = kind === 'glow' ? '#3a2410' : '#2e100d'; // the lens, dark until it lights
      ctx.beginPath();
      ctx.arc(x, 112, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c9c9c4';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      warnSymbol(ctx, kind, x, 112, colour, lit, 0.62);
    }
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
      const L = { rpm: shownRpm, fuel: shownFuel, temp: shownTemp, hot: !!s.ignition && shownTemp >= HOT_FROM, glow: !!s.ignition && !!s.glow, charge: !!s.ignition && !running, oil: !!s.ignition && !running };
      const hh = counterDigits(s.hours, 4);
      if (gate([s.ignition, s.keyOn, L.glow, L.hot, L.charge, Math.round(shownRpm / 8), Math.round(shownFuel * 20), Math.round(shownTemp * 20), hh.key].join('|'))) face.redraw((ctx) => draw(ctx, s, L));
    },
  };
}

// The UTV -------------------------------------------------------------------------------

function buildUtv() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 180, oy: 60 };
  // A side-by-side cluster (TODO 99), after the photos: one grey moulded binnacle holding a round chrome-bezelled speedo (0 to 40 mph, the
  // odometer's drums under its hub) with a pocket either side of it for two lamps each (glow plug and charge on the left, oil and parking
  // brake on the right), a thin strip of the rest of the tell-tales under it (water, belt, headlamp, indicators, 4WD) and, set into the
  // moulding's left end, a separate small round unit with the fuel gauge (a bar, E to F with quarters marked) over the hours' LCD. The key
  // switch stands out of the right-hand end (`ignitionKey`, turned by the update).
  const BODY = { x: 36, y: 12, w: 292, h: 104 };
  housing(group, { ...BODY, r: 16, ...O, material: charcoal });
  const speedo = { cx: 196, cy: 58, r: 35 };
  const unit = { cx: 78, cy: 62, r: 29 }; // the fuel and hours unit
  const pockets = [{ cx: 140, cy: 46 }, { cx: 140, cy: 74 }, { cx: 252, cy: 46 }, { cx: 252, cy: 74 }];
  // The rest of the tell-tales, in the same round bezels in a row along the bottom: the left indicator at the left edge, the right at the right.
  const strip = [{ cx: 128, cy: 105, r: 6.4, kind: 'turnLeft' }, { cx: 176, cy: 105, r: 6.4, kind: 'temp' }, { cx: 216, cy: 105, r: 6.4, kind: 'belt' }, { cx: 264, cy: 105, r: 6.4, kind: 'turnRight' }];
  const face = mmPanel({ ...BODY, ...O });
  group.add(face.mesh);
  chromeRing(group, { ...speedo, r: speedo.r + 1.5, ...O, tube: 0.0034, material: agedSteel });
  chromeRing(group, { ...unit, r: unit.r + 1.5, ...O, tube: 0.0034, material: agedSteel });
  for (const p of [...pockets, ...strip]) chromeRing(group, { ...p, r: p.r ?? 8.5, ...O, material: agedSteel, tube: 0.0022 }); // every lamp in a round bezel
  const KEY = { x: 291, y: 61 }; // the ignition's centre (mm), at the right-hand end
  const gate = changeGate();
  let shownMph = 0;
  let shownFuel = 0;
  let shownTemp = 0;
  let keyAngle = 0;
  const BLUE = '#4aa8ff';

  function draw(ctx, s, L) {
    // The binnacle's own face: a slightly lighter panel round the dials so the speedo and the unit stand out of it.
    ctx.fillStyle = '#2b2d30';
    ctx.fillRect(BODY.x, BODY.y, BODY.w, BODY.h);
    // The speedo: white on black, 0 to 40 mph round 270 degrees, the odometer's drums under the hub.
    ctx.fillStyle = '#0b0b0b';
    ctx.beginPath();
    ctx.arc(speedo.cx, speedo.cy, speedo.r, 0, Math.PI * 2);
    ctx.fill();
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 5, speedo.r - 1.5, 225, -45, 40, '#ece6d2', 0.4);
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 8, speedo.r - 1.5, 225, -45, 8, '#ece6d2', 1);
    labels(ctx, speedo.cx, speedo.cy, speedo.r - 14, 225, -45, ['0', '5', '10', '15', '20', '25', '30', '35', '40'], '#ece6d2', 4);
    text(ctx, 'MPH', speedo.cx, speedo.cy - 9, 3.6, '#ccc', { align: 'center' });
    const odo = counterDigits(s.odoMiles, 6);
    drum(ctx, speedo.cx - 15, speedo.cy + 13, odo, 5);
    needle(ctx, speedo.cx, speedo.cy, speedo.r - 2, 225 - (270 * Math.min(40, L.mph)) / 40, '#f0742a', 1.3); // an orange needle
    agedGlass(ctx, speedo); // the years: a yellowed haze, scratches and dust over the glass
    // The fuel gauge and the hours: a red-lit window with five bars (lit up to the level) with E 1/4 1/2 3/4 F under it, and an LCD of hours.
    ctx.fillStyle = '#0b0b0b';
    ctx.beginPath();
    ctx.arc(unit.cx, unit.cy, unit.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a0b0b';
    ctx.fillRect(unit.cx - 17, unit.cy - 17, 34, 10);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < L.fuelSegs ? '#ff4a3a' : '#4a1816';
      ctx.fillRect(unit.cx - 16 + i * 6.6, unit.cy - 16, 5.6, 8);
    }
    text(ctx, 'E', unit.cx - 17, unit.cy - 3, 3.4, '#ece6d2');
    text(ctx, '1/2', unit.cx, unit.cy - 3, 3.2, '#ece6d2', { align: 'center' });
    text(ctx, 'F', unit.cx + 14, unit.cy - 3, 3.4, '#ece6d2');
    warnSymbol(ctx, 'fuel', unit.cx + 20, unit.cy - 11, '#e8e2cc', true, 0.3, false);
    ctx.fillStyle = LCD.bg;
    ctx.fillRect(unit.cx - 17, unit.cy + 2, 34, 14);
    segText(ctx, L.hours, unit.cx + 14.5, unit.cy + 5, 8, LCD.on, LCD.ghost); // right-aligned inside the window
    text(ctx, 'HOURS', unit.cx, unit.cy + 22, 3.2, '#ece6d2', { align: 'center' });
    agedGlass(ctx, unit);
    // Dust and wear on the moulding: a few light scuffs on its top edge and a grimy bottom edge.
    ctx.fillStyle = 'rgba(160,150,130,0.13)';
    ctx.fillRect(BODY.x, BODY.y + BODY.h - 8, BODY.w, 8);
    ctx.fillStyle = 'rgba(200,196,186,0.2)';
    for (const [x, y, w] of [[60, 16, 14], [130, 14, 9], [226, 15, 17], [296, 18, 7]]) ctx.fillRect(x, y, w, 0.9);
    // The four lamps in their pockets (each lit in its colour, or dull), and the strip of the rest under the speedo.
    const lamps = [['glow', LAMP.amber, L.glow], ['charge', LAMP.red, L.charge], ['oil', LAMP.red, L.oil], ['park', LAMP.red, L.park]];
    pockets.forEach((p, i) => {
      ctx.fillStyle = '#080808';
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, 7.4, 0, Math.PI * 2);
      ctx.fill();
      const [kind, colour, lit] = ['glow', 'oil', 'charge', 'park'].map((k) => lamps.find((l) => l[0] === k))[i];
      warnSymbol(ctx, kind, p.cx, p.cy, colour, lit, 0.6);
    });
    const colours = { turnLeft: [LAMP.green, L.turnLeft], temp: [LAMP.red, L.hot], belt: [LAMP.red, L.belt], turnRight: [LAMP.green, L.turnRight] };
    for (const p of strip) {
      ctx.fillStyle = '#080808';
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, 5.6, 0, Math.PI * 2);
      ctx.fill();
      warnSymbol(ctx, p.kind, p.cx, p.cy, colours[p.kind][0], colours[p.kind][1], 0.5, false);
    }
    // The key's legend at the right-hand end.
    text(ctx, 'OFF', KEY.x, KEY.y - 17, 3.2, '#ece6d2', { align: 'center' });
    text(ctx, 'ON', KEY.x + 13, KEY.y - 10, 3, '#ece6d2');
    text(ctx, 'START', KEY.x + 15, KEY.y + 2, 3, '#ece6d2');
  }

  // The ignition: a round black bezel with a chrome barrel, and a real key in it: a flat steel blade with teeth standing out towards the driver and a
  // black rubber bow (a rounded flat with a ring hole). It turns from OFF at the top to ON a quarter-way and on to START, where it springs back
  // to ON when let go (the legend is printed round it); the dash update eases it to whichever the engine is doing.
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0135, 0.008, 22).rotateX(Math.PI / 2), blackMat);
  bezel.position.set(-(KEY.x - O.ox) * 0.001, -(KEY.y - O.oy) * 0.001, -0.039);
  group.add(bezel);
  const ignitionKey = new THREE.Group();
  ignitionKey.name = 'ignitionKey';
  ignitionKey.position.set(bezel.position.x, bezel.position.y, -0.0435);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0088, 0.0088, 0.006, 18).rotateX(Math.PI / 2), chromeMat);
  ignitionKey.add(barrel);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.0065, 0.0024, 0.02), chromeMat);
  blade.position.set(0, 0, -0.012); // lying along the barrel's axis, standing out of it
  const cuts = new THREE.Mesh(new THREE.BoxGeometry(0.0068, 0.0012, 0.012), blackMat);
  cuts.position.set(0, 0.0014, -0.0145);
  const bow = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.02, 0.0055), blackMat); // the head's flat, long up the key (pointing up at OFF), so it reads as a car key's
  bow.position.set(0, 0.0045, -0.0245);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0042, 0.0013, 6, 14), chromeMat);
  ring.position.set(0, 0.0165, -0.0275);
  ignitionKey.add(blade, cuts, bow, ring);
  group.add(ignitionKey);

  return {
    group,
    mount: null,
    update(s) {
      shownMph += ((s.ignition ? s.speedMph : 0) - shownMph) * 0.5;
      shownFuel += ((s.ignition ? s.fuelLevel : 0) - shownFuel) * 0.2;
      shownTemp += ((s.ignition ? tempGaugeFraction(s.temperature, true, s.overheat) : 0) - shownTemp) * 0.1;
      const keyTo = s.cranking ? 1.45 : s.keyOn ? 0.72 : 0; // OFF at the top, ON half-way round, START at the end, clockwise as the driver sees it
      keyAngle += (keyTo - keyAngle) * 0.5;
      ignitionKey.rotation.z = keyAngle;
      const running = s.rpm > 300;
      const lamps = lampStates(s);
      const L = {
        mph: shownMph,
        fuelSegs: Math.ceil(shownFuel * 5 - 0.001),
        hot: !!s.ignition && shownTemp >= HOT_FROM,
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
      const key = [s.ignition, s.keyOn, !!s.cranking, L.glow, L.charge, L.oil, L.park, L.belt, L.lights, L.main, L.turnLeft, L.turnRight, !!s.fourWd, !!s.diffLock, Math.round(L.mph * 2), L.fuelSegs, L.hot, L.hours, counterText(s.odoMiles, 6)];
      if (gate(key.join('|'))) face.redraw((ctx) => draw(ctx, s, L));
    },
  };
}

// The Tor ----------------------------------------------------------------------------

/**
 * A real ignition on a pod face: a small black bezel with a chrome barrel and a key in it (a steel blade with teeth standing out towards the
 * driver, a black bow with a ring hole), as the UTV's, at `key` (mm, in the pod's canvas) and `scale` times the UTV's size. Returns the key's
 * group (named 'ignitionKey'): turn it about z, clockwise as the driver sees it, 0 at OFF (pointing up) to 0.72 ON and 1.45 START.
 */
export function addIgnitionKey(group, O, key, scale = 1) {
  const lock = new THREE.Group();
  lock.scale.setScalar(scale);
  lock.position.set(-(key.x - O.ox) * 0.001, -(key.y - O.oy) * 0.001, 0);
  group.add(lock);
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0135, 0.008, 22).rotateX(Math.PI / 2), blackMat);
  bezel.position.z = -0.039 / scale; // its face is a hair proud of the pod's (z -0.0356), whatever the scale
  lock.add(bezel);
  const ignitionKey = new THREE.Group();
  ignitionKey.name = 'ignitionKey';
  ignitionKey.position.z = -0.0435 / scale;
  ignitionKey.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0088, 0.0088, 0.006, 18).rotateX(Math.PI / 2), chromeMat));
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.0065, 0.0024, 0.02), chromeMat);
  blade.position.set(0, 0, -0.012);
  const cuts = new THREE.Mesh(new THREE.BoxGeometry(0.0068, 0.0012, 0.012), blackMat);
  cuts.position.set(0, 0.0014, -0.0145);
  const bow = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.02, 0.0055), blackMat);
  bow.position.set(0, 0.0045, -0.0245);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0042, 0.0013, 6, 14), chromeMat);
  ring.position.set(0, 0.0165, -0.0275);
  ignitionKey.add(blade, cuts, bow, ring);
  lock.add(ignitionKey);
  return ignitionKey;
}

function buildTor() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 180, oy: 60 };
  // A black binnacle in front of the driver, squarer than a quad's.
  housing(group, { x: 80, y: 14, w: 200, h: 92, r: 4, ...O, material: plastic });
  const face = mmPanel({ x: 80, y: 14, w: 200, h: 92, ...O });
  group.add(face.mesh);
  // After the photo of a real cab: a column of warning lamps down the left edge (main beam, charge, oil, handbrake), the speedometer
  // with the indicators' green lamp and the choke's amber one in the bottom of its dial, a big round combined fuel and water gauge to its right,
  // and the ignition key (a real one, as the UTV's) at the right-hand end.
  const speedo = { cx: 142, cy: 60, r: 31 }; // both dials the same size, and centred on the pod (its middle is y 60)
  const combo = { cx: 222, cy: 60, r: 31 };
  const KEY = { x: 268, y: 92 };
  for (const d of [speedo, combo]) chromeRing(group, { ...d, r: d.r + 1, ...O });
  const gate = changeGate();
  let shownMph = 0;
  let shownFuel = 0;
  let shownTemp = 0;
  let keyAngle = 0;

  function draw(ctx, s, L) {
    // The lamp column: each in its own black pocket.
    const column = [['beam', '#4aa8ff', L.main], ['charge', LAMP.red, L.charge], ['oil', LAMP.red, L.oil], ['park', LAMP.red, L.park]];
    column.forEach(([kind, colour, lit], i) => {
      const cy = 33 + i * 18; // four lamps, 18 apart, centred on the pod's middle (y 60)
      ctx.fillStyle = '#080808';
      ctx.beginPath();
      ctx.arc(95, cy, 7, 0, Math.PI * 2);
      ctx.fill();
      warnSymbol(ctx, kind, 95, cy, colour, lit, 0.6);
    });
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
    drum(ctx, speedo.cx - 14, speedo.cy + 8, odo, 6);
    for (const [kind, x, colour, lit] of [['turn', speedo.cx - 11, LAMP.green, L.turn], ['choke', speedo.cx + 11, LAMP.amber, L.choke]]) { // the two small lamps in the dial's foot
      ctx.fillStyle = '#080808';
      ctx.beginPath();
      ctx.arc(x, speedo.cy + 21, 4.4, 0, Math.PI * 2);
      ctx.fill();
      warnSymbol(ctx, kind, x, speedo.cy + 21, colour, lit, 0.4);
    }
    needle(ctx, speedo.cx, speedo.cy, speedo.r - 2, 220 - (260 * Math.min(90, L.mph)) / 90, '#f0eadc', 1.2);
    // The combination gauge: big and round, fuel along its top half, water temperature along its bottom, each with its own needle.
    ctx.fillStyle = '#0b0b0b';
    ctx.beginPath();
    ctx.arc(combo.cx, combo.cy, combo.r, 0, Math.PI * 2);
    ctx.fill();
    ticks(ctx, combo.cx, combo.cy, combo.r - 6, combo.r - 2, 150, 30, 4, '#ece6d2', 0.8);
    ticks(ctx, combo.cx, combo.cy, combo.r - 6, combo.r - 2, 210, 330, 4, '#ece6d2', 0.8);
    arc(ctx, combo.cx, combo.cy, combo.r - 3, 210 + 120 * HOT_FROM, 330, '#d8402e', 2.4);
    text(ctx, 'FUEL', combo.cx, combo.cy - 15, 3.4, '#ccc', { align: 'center' });
    text(ctx, 'WATER', combo.cx, combo.cy + 19, 3.4, L.temp >= HOT_FROM ? LAMP.red : '#ccc', { align: 'center' });
    warnSymbol(ctx, 'fuel', combo.cx, combo.cy - 8, '#bbb', true, 0.5);
    warnSymbol(ctx, 'temp', combo.cx, combo.cy + 10, L.temp >= HOT_FROM ? LAMP.red : '#bbb', true, 0.5);
    text(ctx, 'E', combo.cx - combo.r * 0.68, combo.cy - 5, 3.8, '#ece6d2', { align: 'center' });
    text(ctx, 'F', combo.cx + combo.r * 0.68, combo.cy - 5, 3.8, '#ece6d2', { align: 'center' });
    text(ctx, 'C', combo.cx - combo.r * 0.68, combo.cy + 8, 3.8, '#ece6d2', { align: 'center' });
    text(ctx, 'H', combo.cx + combo.r * 0.68, combo.cy + 8, 3.8, '#ff6a5a', { align: 'center' });
    needle(ctx, combo.cx, combo.cy, combo.r - 5, 150 - 120 * L.fuel, '#f0eadc', 1);
    needle(ctx, combo.cx, combo.cy, combo.r - 5, 210 + 120 * L.temp, '#f0eadc', 1);
  }

  // The ignition: a small black bezel with a chrome barrel and a real key in it, as the UTV's (a steel blade standing out towards the driver, a black
  // bow with a ring hole), at the dash's right-hand end. It turns clockwise from OFF at the top to ON and on to START, and the dash eases it to
  // whichever the engine is doing.
  const ignitionKey = addIgnitionKey(group, O, KEY, 0.6); // the Tor's switch is smaller than the UTV's

  return {
    group,
    mount: null,
    update(s) {
      shownMph += ((s.ignition ? s.speedMph : 0) - shownMph) * 0.5;
      shownFuel += ((s.ignition ? s.fuelLevel : 0) - shownFuel) * 0.2;
      shownTemp += ((s.ignition ? tempGaugeFraction(s.temperature, true, s.overheat) : 0) - shownTemp) * 0.1;
      const keyTo = s.cranking ? 1.45 : s.keyOn ? 0.72 : 0; // OFF at the top, ON half-way round, START at the end, clockwise as the driver sees it
      keyAngle += (keyTo - keyAngle) * 0.5;
      ignitionKey.rotation.z = keyAngle;
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
      if (gate([on, L.charge, L.oil, L.choke, L.park, L.main, L.turn, Math.round(shownMph * 2), Math.round(shownFuel * 20), Math.round(shownTemp * 20), odo.key].join('|'))) {
        face.redraw((ctx) => draw(ctx, s, L));
      }
    },
  };
}

// The 200TDi ---------------------------------------------------------------------------------

/**
 * An early-90s 90's dash, after the photo of the real cluster and in a different style from the Tor's: a flat black moulding with
 * white-on-black dials and orange needles. Three small gauges in a row at the left (the battery's volts, the water temperature, the fuel), the
 * big speedometer at the right with its odometer, a panel of warning symbols in two rows under the small gauges (glow plugs, charge, oil, the
 * handbrake, seat belts, the hazards; side lights, main beam and the indicators), and the ignition's key (a real one) at the far end.
 */
function buildCrag() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 180, oy: 60 };
  housing(group, { x: 60, y: 14, w: 240, h: 92, r: 3, ...O, material: charcoal });
  const face = mmPanel({ x: 60, y: 14, w: 240, h: 92, ...O });
  group.add(face.mesh);
  // One row of four dials on one centre line (y 52), the three small ones 43 mm apart with a gap between, the speedometer clear of the pod's top (10 mm);
  // the warning symbols in two rows under the small ones, in columns under their centres.
  const volts = { cx: 87, cy: 49, r: 14 };
  const temp = { cx: 130, cy: 49, r: 14 };
  const fuel = { cx: 173, cy: 49, r: 14 };
  const speedo = { cx: 243, cy: 49, r: 28 };
  const KEY = { x: 286, y: 92 };
  for (const d of [volts, temp, fuel, speedo]) chromeRing(group, { ...d, r: d.r + 1, ...O, tube: 0.0018 });
  const gate = changeGate();
  let shownMph = 0;
  let shownFuel = 0;
  let shownTemp = 0;
  let shownVolts = 0;
  let keyAngle = 0;
  const SPEEDO_MAX = 110;
  const NEEDLE = '#ff8a1f'; // orange needles, white figures: the look of the newer instruments
  const WHITE = '#ffffff';
  const dial = (ctx, d) => {
    ctx.fillStyle = '#0c0d0e';
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
    ctx.fill();
  };
  /** A small gauge: a short arc scale across its top (150 to 30 degrees) with its symbol under the pivot and a red end for the hot ones. */
  const small = (ctx, d, frac, symbol, colour, lo, hi, redEnd, redStart) => {
    dial(ctx, d);
    ticks(ctx, d.cx, d.cy, d.r - 4, d.r - 1.5, 150, 30, 4, WHITE, 0.7);
    if (redEnd) arc(ctx, d.cx, d.cy, d.r - 2, 150 - 120 * redStart, 30, '#d8402e', 1.8);
    warnSymbol(ctx, symbol, d.cx, d.cy + 6.5, colour, true, 0.42);
    text(ctx, lo, d.cx - d.r * 0.62, d.cy - 1, 3.2, WHITE, { align: 'center' });
    text(ctx, hi, d.cx + d.r * 0.62, d.cy - 1, 3.2, redEnd ? '#ff6a5a' : WHITE, { align: 'center' });
    needle(ctx, d.cx, d.cy, d.r - 3, 150 - 120 * frac, NEEDLE, 0.9);
  };

  function draw(ctx, s, L) {
    // The three small gauges: volts (a steady 13 or so when running, a little under when not), water temperature and fuel.
    small(ctx, volts, L.volts, 'charge', '#bbb', '8', '16', false, 0);
    small(ctx, temp, L.temp, 'temp', L.temp >= HOT_FROM ? LAMP.red : '#bbb', 'C', 'H', true, HOT_FROM);
    small(ctx, fuel, L.fuel, 'fuel', '#bbb', 'E', 'F', false, 0);
    // The speedometer: 0 to 110 mph with its odometer.
    dial(ctx, speedo);
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 5, speedo.r - 1.5, 220, -40, 22, WHITE, 0.5);
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 8, speedo.r - 1.5, 220, -40, 11, WHITE, 1);
    labels(ctx, speedo.cx, speedo.cy, speedo.r - 14, 220, 220 - (260 * 100) / SPEEDO_MAX, ['0', '20', '40', '60', '80', '100'], WHITE, 3.6); // every 20 mph, evenly round to 100
    text(ctx, 'MPH', speedo.cx, speedo.cy + 6, 3.6, '#ccc', { align: 'center' });
    const odo = counterDigits(s.odoMiles, 6);
    drum(ctx, speedo.cx - 17, speedo.cy + 14, odo, 6);
    needle(ctx, speedo.cx, speedo.cy, speedo.r - 2, 220 - (260 * Math.min(SPEEDO_MAX, L.mph)) / SPEEDO_MAX, NEEDLE, 1.3);
    // The panel of warning symbols under the small gauges: two rows of five in columns that line up with the gauges above, each in a black pocket
    // on a dark strip.
    ctx.fillStyle = '#121213';
    ctx.beginPath();
    ctx.roundRect(71, 68, 118, 33, 2);
    ctx.fill();
    const cols = [87, 108.5, 130, 151.5, 173];
    // Each symbol is drawn about its own middle, but they are not the same width or placed the same about their (x, y), so each is nudged to put its
    // drawn middle on the column's: [dx, dy] by kind (found by working out each one's extent in dashParts.js warnSymbol).
    const nudge = { glow: [0, 0], charge: [0, 0.4], oil: [0.6, -0.4], park: [0, 0], belt: [0.8, 0], lights: [-3, 0], beam: [-2.6, 0], turnLeft: [0, 0], turnRight: [0, 0] };
    const row1 = [['glow', LAMP.amber, L.glow], ['charge', LAMP.red, L.charge], ['oil', LAMP.red, L.oil], ['park', LAMP.red, L.park], ['belt', LAMP.red, L.belt]];
    const row2 = [['lights', LAMP.green, L.lights], ['beam', '#4aa8ff', L.main], ['turnLeft', LAMP.green, L.turnLeft], ['turnRight', LAMP.green, L.turnRight]];
    row1.forEach(([kind, colour, lit], i) => warnSymbol(ctx, kind, cols[i] + nudge[kind][0], 77 + nudge[kind][1], colour, lit));
    row2.forEach(([kind, colour, lit], i) => warnSymbol(ctx, kind, cols[i] + nudge[kind][0], 93 + nudge[kind][1], colour, lit));
    // The hazard button in the last place of the second row: a black surround round a red square with a white triangle, point up, flashing red
    // with the hazards.
    ctx.fillStyle = '#050505';
    ctx.fillRect(cols[4] - 7, 86, 14, 14);
    ctx.fillStyle = L.hazard ? '#ff3a22' : '#8c1812';
    ctx.fillRect(cols[4] - 5.5, 87.5, 11, 11);
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = 0.9;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cols[4], 89.5);
    ctx.lineTo(cols[4] + 3.6, 96);
    ctx.lineTo(cols[4] - 3.6, 96);
    ctx.closePath();
    ctx.stroke();
  }

  const ignitionKey = addIgnitionKey(group, O, KEY, 0.7); // the real key, at the far end

  return {
    group,
    mount: null,
    update(s) {
      shownMph += ((s.ignition ? s.speedMph : 0) - shownMph) * 0.5;
      shownFuel += ((s.ignition ? s.fuelLevel : 0) - shownFuel) * 0.2;
      shownTemp += ((s.ignition ? tempGaugeFraction(s.temperature, true, s.overheat) : 0) - shownTemp) * 0.1;
      shownVolts += ((s.ignition ? voltsFraction(s.battery, s.rpm > 300) : 0) - shownVolts) * 0.1; // the volts gauge reads the battery
      const keyTo = s.cranking ? 1.45 : s.keyOn ? 0.72 : 0;
      keyAngle += (keyTo - keyAngle) * 0.5;
      ignitionKey.rotation.z = keyAngle;
      const running = s.rpm > 300;
      const on = !!s.ignition;
      const L = {
        mph: shownMph,
        volts: shownVolts,
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
      if (gate([on, running, L.glow, L.charge, L.oil, L.park, L.belt, L.lights, L.main, L.turnLeft, L.turnRight, L.hazard, Math.round(shownMph * 2), Math.round(shownFuel * 20), Math.round(shownTemp * 20), Math.round(shownVolts * 20), odo.key].join('|'))) {
        face.redraw((ctx) => draw(ctx, s, L));
      }
    },
  };
}

// The girls' cars ------------------------------------------------------------------------

const FINCH_BLACK = new THREE.MeshStandardMaterial({ color: 0x1d1b19, roughness: 0.7 }); // the Finch's cluster's black moulding

/**
 * Amy's Finch, after the photo of the real cluster: a brushed silver panel in a black moulding, the speedometer on the left (to 100 mph with km/h
 * in a smaller ring inside, the odometer under the boss, a yellow needle), a black window of the gear lever's H (R 1 3 over 2 4) in the middle over a
 * row of small slots and five lamps (oil, charge, the indicators, main beam, choke), and on the right a round combined gauge with a black boss in the
 * middle: fuel in its upper half, water temperature in its lower. No rev counter. The key is on the column (finchModel.js).
 */
function buildFinch() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 180, oy: 60 };
  const P = { x: 60, y: 24, w: 240, h: 72 };
  housing(group, { ...P, x: P.x - 4, y: P.y - 4, w: P.w + 8, h: P.h + 8, r: 7, ...O, material: FINCH_BLACK });
  const face = mmPanel({ ...P, ...O });
  group.add(face.mesh);
  const speedo = { cx: 98, cy: 60, r: 33 };
  const combo = { cx: 262, cy: 60, r: 33 };
  const gate = changeGate();
  let shownMph = 0;
  let shownFuel = 0;
  let shownTemp = 0;
  const FIG = '#f2f2ee';
  const NEEDLE = '#f2a516';
  const dial = (ctx, d) => {
    ctx.fillStyle = '#050505';
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, d.r + 2.5, 0, Math.PI * 2); // its black rim
    ctx.fill();
    ctx.fillStyle = '#121211';
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
    ctx.fill();
  };

  function draw(ctx, s, L) {
    const g = ctx.createLinearGradient(P.x, P.y, P.x + P.w, P.y + P.h); // the brushed silver
    g.addColorStop(0, '#c7c8c4');
    g.addColorStop(0.5, '#b3b4b0');
    g.addColorStop(1, '#bfc0bc');
    ctx.fillStyle = g;
    ctx.fillRect(P.x, P.y, P.w, P.h);
    // The speedometer: 0 to 100 mph round 270 degrees, white on black with an inner ring of km/h and the odometer under the boss.
    dial(ctx, speedo);
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 4, speedo.r - 1.5, 225, -45, 50, FIG, 0.4);
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 6.5, speedo.r - 1.5, 225, -45, 10, FIG, 1);
    labels(ctx, speedo.cx, speedo.cy, speedo.r - 11, 225, -45, ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'], FIG, 3.8);
    const kmh = [20, 40, 60, 80, 100, 120, 140, 160];
    kmh.forEach((k) => {
      const a = (225 - (270 * (k / 1.609)) / 100) * (Math.PI / 180); // km/h as mph, round the same arc
      text(ctx, String(k), speedo.cx + Math.cos(a) * (speedo.r - 19), speedo.cy - Math.sin(a) * (speedo.r - 19) + 1.2, 2.6, '#bdbdb4', { align: 'center' });
    });
    text(ctx, 'MPH', speedo.cx, speedo.cy + 21, 3.2, '#d8d8d0', { align: 'center' });
    const odo = counterDigits(s.odoMiles, 5);
    drum(ctx, speedo.cx - 14, speedo.cy + 6, odo, 6);
    needle(ctx, speedo.cx, speedo.cy, speedo.r - 2, 225 - (270 * Math.min(100, L.mph)) / 100, NEEDLE, 1.5);
    // The combined gauge: a boss in the middle, fuel along its upper half, water temperature along its lower.
    dial(ctx, combo);
    ticks(ctx, combo.cx, combo.cy, combo.r - 5, combo.r - 1.5, 150, 30, 4, FIG, 0.8);
    ticks(ctx, combo.cx, combo.cy, combo.r - 5, combo.r - 1.5, 210, 330, 4, FIG, 0.8);
    arc(ctx, combo.cx, combo.cy, combo.r - 2.5, 210 + 120 * HOT_FROM, 330, '#f2c614', 2.4);
    warnSymbol(ctx, 'fuel', combo.cx, combo.cy - 21, '#d8d8d0', true, 0.45, false);
    warnSymbol(ctx, 'temp', combo.cx, combo.cy + 21, L.temp >= HOT_FROM ? LAMP.red : '#d8d8d0', true, 0.45, L.temp >= HOT_FROM);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; // the two white arcs the halves are drawn in, as in the photo
    ctx.lineWidth = 0.8;
    for (const [a0, a1] of [[200, 340], [20, 160]]) {
      ctx.beginPath();
      ctx.arc(combo.cx, combo.cy, combo.r - 9, (a0 * Math.PI) / 180, (a1 * Math.PI) / 180);
      ctx.stroke();
    }
    needle(ctx, combo.cx, combo.cy, combo.r - 4, 150 - 120 * L.fuel, NEEDLE, 1.5);
    needle(ctx, combo.cx, combo.cy, combo.r - 4, 210 + 120 * L.temp, NEEDLE, 1.5);
    ctx.fillStyle = '#0a0a0a'; // the boss over the needles' roots
    ctx.beginPath();
    ctx.arc(combo.cx, combo.cy, 11, 0, Math.PI * 2);
    ctx.fill();
    // The middle: the gear lever's H in a black window (R 1 3 over 2 4), a block of slots under it, and the five lamps in a row.
    ctx.fillStyle = '#080808';
    ctx.fillRect(135, 31, 90, 26);
    ctx.strokeStyle = FIG;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(158, 36); ctx.lineTo(158, 52); // the H's legs
    ctx.moveTo(180, 36); ctx.lineTo(180, 52);
    ctx.moveTo(202, 36); ctx.lineTo(202, 52);
    ctx.moveTo(158, 44); ctx.lineTo(202, 44); // and its bar
    ctx.stroke();
    text(ctx, 'R', 154, 36.5, 3.4, FIG, { align: 'center' });
    text(ctx, '1', 176, 36.5, 3.4, FIG, { align: 'center' });
    text(ctx, '3', 198, 36.5, 3.4, FIG, { align: 'center' });
    text(ctx, '2', 176, 53, 3.4, FIG, { align: 'center' });
    text(ctx, '4', 198, 53, 3.4, FIG, { align: 'center' });
    ctx.fillStyle = '#4a4b48'; // the slots
    for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) ctx.fillRect(139 + i * 17.5, 62 + r * 10, 12, 1.6);
    const lamps = [['oil', LAMP.red, L.oil], ['charge', LAMP.red, L.charge], ['turn', LAMP.green, L.turn], ['beam', '#4aa8ff', L.main], ['park', LAMP.red, L.park]];
    lamps.forEach(([kind, colour, lit], i) => {
      ctx.fillStyle = '#0c0c0b';
      ctx.fillRect(135 + i * 18, 70, 15, 13);
      warnSymbol(ctx, kind, 142.5 + i * 18, 76.5, colour, lit, 0.36, false);
    });
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
        park: on && !!s.parkBrake,
        main: on && !!s.lightLamps?.main,
        turn: on && !!(s.indicatorLamps?.left || s.indicatorLamps?.right),
      };
      const odo = counterDigits(s.odoMiles, 5);
      if (gate([on, L.charge, L.oil, L.park, L.main, L.turn, Math.round(shownMph * 2), Math.round(shownFuel * 20), Math.round(shownTemp * 20), odo.key].join('|'))) {
        face.redraw((ctx) => draw(ctx, s, L));
      }
    },
  };
}

/**
 * Jess's Griffin, after the photo of the real cluster: a rounded charcoal binnacle with the rev counter and the speedometer (to 130 mph, with the
 * odometer) side by side in the middle, a small fuel gauge at the lower left and a small water gauge at the lower right, the indicators' tell-tales at
 * the two ends and a strip of lamps along the bottom: charge, oil, engine management (it is injected), handbrake, belts, side lights and main beam.
 * The key is a real one on the column (griffinModel.js).
 */
function buildGriffin() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 180, oy: 60 };
  housing(group, { x: 62, y: 12, w: 236, h: 96, r: 18, ...O, material: charcoal });
  const face = mmPanel({ x: 62, y: 12, w: 236, h: 96, ...O });
  group.add(face.mesh);
  // After the photo of the real one: two big dials side by side in the middle (the rev counter on the left, the speedometer to 130 on the right), a small
  // fuel gauge at the lower left and a small temperature gauge at the lower right, the indicators' tell-tales at the two ends and the other lamps between.
  const tacho = { cx: 140, cy: 48, r: 31 };
  const speedo = { cx: 214, cy: 48, r: 35 };
  const fuel = { cx: 92, cy: 82, r: 13 };
  const temp = { cx: 268, cy: 82, r: 13 };
  const gate = changeGate();
  let shownMph = 0;
  let shownRpm = 0;
  let shownFuel = 0;
  let shownTemp = 0;
  const TACHO_MAX = 7000;
  const NEEDLE = '#f4f0e8';
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
    if (hotEnd) arc(ctx, d.cx, d.cy, d.r - 2, 150 - 120 * HOT_FROM, 30, '#d8402e', 1.8);
    const hot = hotEnd && frac >= HOT_FROM; // the symbol lights as the needle goes into the red
    warnSymbol(ctx, sym, d.cx, d.cy + 6, hot ? LAMP.red : '#aaa', true, 0.42, hot);
    needle(ctx, d.cx, d.cy, d.r - 3, 150 - 120 * frac, NEEDLE, 1);
  };

  function draw(ctx, s, L) {
    dial(ctx, tacho);
    arc(ctx, tacho.cx, tacho.cy, tacho.r - 2.5, -45, 225 - (270 * L.redline) / TACHO_MAX, '#d8402e', 2.2);
    ticks(ctx, tacho.cx, tacho.cy, tacho.r - 4.5, tacho.r - 1.5, 225, -45, 14, WHITE, 0.5);
    ticks(ctx, tacho.cx, tacho.cy, tacho.r - 7, tacho.r - 1.5, 225, -45, 7, WHITE, 1);
    labels(ctx, tacho.cx, tacho.cy, tacho.r - 11.5, 225, -45, ['0', '1', '2', '3', '4', '5', '6', '7'], '#f2a516', 3.8);
    text(ctx, '1/min x1000', tacho.cx, tacho.cy + 14, 2.6, '#bbb', { align: 'center' });
    needle(ctx, tacho.cx, tacho.cy, tacho.r - 2, 225 - (270 * Math.min(TACHO_MAX, L.rpm)) / TACHO_MAX, NEEDLE, 1.1);
    dial(ctx, speedo);
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 5, speedo.r - 1.5, 225, -45, 26, WHITE, 0.5);
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 8, speedo.r - 1.5, 225, -45, 13, WHITE, 1);
    labels(ctx, speedo.cx, speedo.cy, speedo.r - 13, 225, -45, ['0', '', '20', '', '40', '', '60', '', '80', '', '100', '', '120', ''], '#f2a516', 3.8);
    text(ctx, 'mph', speedo.cx, speedo.cy - 9, 3.2, '#bbb', { align: 'center' });
    const odo = counterDigits(s.odoMiles, 6);
    drum(ctx, speedo.cx - 17, speedo.cy + 12, odo, 6);
    needle(ctx, speedo.cx, speedo.cy, speedo.r - 2, 225 - (270 * Math.min(130, L.mph)) / 130, NEEDLE, 1.2);
    small(ctx, fuel, L.fuel, 'fuel', false);
    small(ctx, temp, L.temp, 'temp', true);
    // The tell-tales: the indicators' arrows at the two ends (each flashes with its own side), the rest in a strip along the bottom between the small gauges.
    for (const [kind, x, lit] of [['turnLeft', 86, L.turnLeft], ['turnRight', 274, L.turnRight]]) {
      ctx.fillStyle = '#121213';
      ctx.beginPath();
      ctx.roundRect(x - 11, 21, 22, 16, 4);
      ctx.fill();
      warnSymbol(ctx, kind, x, 29, LAMP.green, lit, 0.85);
    }
    // The other lamps in their own small pods, as in the photo: charge and oil to the left, main beam and side lights to the right, the rest in a strip under the dials.
    const SHIFT = { beam: -1.5, lights: -1.5, oil: 1.5 }; // the glyphs' own weight to one side (the beam's rays, the oil can's drip), so each looks centred in its slot
    const pod = (x, y, w, list) => {
      ctx.fillStyle = '#121213';
      ctx.beginPath();
      ctx.roundRect(x, y, w, 15, 4);
      ctx.fill();
      list.forEach(([kind, colour, lit], i) => warnSymbol(ctx, kind, x + (w / list.length) * (i + 0.5) + (SHIFT[kind] ?? 0), y + 7.5, colour, lit, 0.68));
    };
    pod(70, 42, 36, [['charge', LAMP.red, L.charge], ['oil', LAMP.red, L.oil]]);
    pod(254, 42, 36, [['beam', '#4aa8ff', L.main], ['lights', LAMP.green, L.lights]]);
    pod(139, 86, 82, [['engine', LAMP.amber, L.engine], ['park', LAMP.red, L.park], ['belt', LAMP.red, L.belt]]);
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
      if (gate([on, s.keyOn, L.charge, L.oil, L.engine, L.park, L.belt, L.lights, L.main, L.turnLeft, L.turnRight, Math.round(shownMph * 2), Math.round(shownRpm / 40), Math.round(shownFuel * 20), Math.round(shownTemp * 20), odo.key].join('|'))) {
        face.redraw((ctx) => draw(ctx, s, L));
      }
    },
  };
}

/**
 * Your 309 (#229), after the photo of the real cluster: a black panel in a deep hood, the speedometer left of middle (to 100 mph, km/h in a ring
 * inside, the odometer and trip in a window under the boss, an orange needle), an analogue clock to the right of middle where a better model has its
 * rev counter (it keeps the game's time, and goes dark with no power), a column of lamps between them (indicators, glow plugs, charge, handbrake,
 * main beam), and at each end a pocket of two: the oil lamp over the fuel gauge on the left, the water lamp over the temperature gauge on the right.
 */
/** Your 309's cluster's layout, in the panel's pixels: each dial's middle and radius, and the left edges of the two end pockets (34 wide). */
export const VAUCLAIR_CLUSTER = {
  speedo: { cx: 127, cy: 60, r: 31 },
  clock: { cx: 230, cy: 60, r: 30 },
  fuel: { cx: 70, cy: 76, r: 14 },
  water: { cx: 289, cy: 76, r: 14 },
  pockets: [53, 272],
  lamps: [170, 190],
};

function buildVAUCLAIR() {
  const group = new THREE.Group();
  group.name = 'dash';
  const O = { ox: 180, oy: 60 };
  const P = { x: 50, y: 22, w: 260, h: 76 };
  housing(group, { ...P, x: P.x - 4, y: P.y - 4, w: P.w + 8, h: P.h + 8, r: 7, ...O, material: FINCH_BLACK });
  const face = mmPanel({ ...P, ...O });
  group.add(face.mesh);
  // Laid out left to right with room between (the speedo's rim ran into the left pocket, the clock's into the right): the left pocket 53 to 87, the
  // speedo 94 to 160, the lamps 170 to 190, the clock 198 to 262, the right pocket 272 to 306. VAUCLAIR_CLUSTER is the same, for the test.
  const { speedo, clock, fuel, water, pockets } = VAUCLAIR_CLUSTER;
  const gate = changeGate();
  let shownMph = 0;
  let shownFuel = 0;
  let shownTemp = 0;
  const FIG = '#eeeeea';
  const NEEDLE = '#f2741c';
  const dial = (ctx, d) => {
    ctx.fillStyle = '#060606';
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, d.r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#121313';
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
    ctx.fill();
  };
  const pocket = (ctx, x, y, w, h) => { // the moulded pockets the end lamps and gauges sit in
    ctx.fillStyle = '#0d0e0e';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
  };

  function draw(ctx, s, L) {
    ctx.fillStyle = '#1a1b1c';
    ctx.fillRect(P.x, P.y, P.w, P.h);
    // The left end: the oil lamp over the fuel gauge (a quarter arc, E to F).
    pocket(ctx, pockets[0], 26, 34, 28);
    warnSymbol(ctx, 'oil', fuel.cx, 40, LAMP.red, L.oil, 0.5, false);
    pocket(ctx, pockets[0], 58, 34, 36);
    ticks(ctx, fuel.cx, fuel.cy, fuel.r - 4, fuel.r, 150, 30, 4, FIG, 0.8);
    text(ctx, '0', fuel.cx - 11, fuel.cy - 4, 3.2, LAMP.red, { align: 'center' });
    text(ctx, '1', fuel.cx + 11, fuel.cy - 4, 3.2, FIG, { align: 'center' });
    warnSymbol(ctx, 'fuel', fuel.cx, fuel.cy + 9, '#cfd0cc', true, 0.36, false);
    needle(ctx, fuel.cx, fuel.cy, fuel.r - 1, 150 - 120 * L.fuel, NEEDLE, 1.3);
    // The speedometer: 0 to 100 mph round 270 degrees, with km/h inside and the odometer under the boss.
    dial(ctx, speedo);
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 4, speedo.r - 1.5, 225, -45, 50, FIG, 0.4);
    ticks(ctx, speedo.cx, speedo.cy, speedo.r - 6.5, speedo.r - 1.5, 225, -45, 10, FIG, 1);
    labels(ctx, speedo.cx, speedo.cy, speedo.r - 11, 225, -45, ['0', '', '20', '', '40', '', '60', '', '80', '', '100'], FIG, 4.2);
    [20, 40, 60, 80, 100, 120, 140, 160].forEach((k) => {
      const a = (225 - (270 * (k / 1.609)) / 100) * (Math.PI / 180);
      text(ctx, String(k), speedo.cx + Math.cos(a) * (speedo.r - 19), speedo.cy - Math.sin(a) * (speedo.r - 19) + 1.2, 2.5, '#a8a8a2', { align: 'center' });
    });
    text(ctx, 'MPH', speedo.cx, speedo.cy - 9, 3.2, '#d8d8d0', { align: 'center' });
    drum(ctx, speedo.cx - 14, speedo.cy + 6, counterDigits(s.odoMiles, 5), 6);
    needle(ctx, speedo.cx, speedo.cy, speedo.r - 2, 225 - (270 * Math.min(100, L.mph)) / 100, NEEDLE, 1.6);
    // The lamps in a column between the dials.
    const lamps = [['turn', LAMP.green, L.turn], ['glow', LAMP.amber, L.glow], ['charge', LAMP.red, L.charge], ['park', LAMP.red, L.park], ['beam', '#4aa8ff', L.main]];
    lamps.forEach(([kind, colour, lit], i) => {
      ctx.fillStyle = '#0c0c0b';
      ctx.fillRect(170, 26 + i * 14, 20, 12);
      warnSymbol(ctx, kind, 180, 32 + i * 14, colour, lit, 0.34, false);
    });
    // The clock: hours round the face, two hands, a red seconds hand, dark without power.
    dial(ctx, clock);
    ticks(ctx, clock.cx, clock.cy, clock.r - 4, clock.r - 1, 90, -270, 12, FIG, 1.1);
    labels(ctx, clock.cx, clock.cy, clock.r - 10, 60, -270, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], FIG, 4);
    if (L.clock) {
      const [hh, mm] = L.clock.split(':').map(Number);
      needle(ctx, clock.cx, clock.cy, clock.r * 0.5, 90 - ((hh % 12) + mm / 60) * 30, '#f0f0ea', 2);
      needle(ctx, clock.cx, clock.cy, clock.r * 0.78, 90 - mm * 6, '#f0f0ea', 1.4);
    }
    // The right end: the water lamp over the temperature gauge (cold to hot, red at the top end).
    pocket(ctx, pockets[1], 26, 34, 28);
    warnSymbol(ctx, 'temp', water.cx, 40, LAMP.red, L.temp >= HOT_FROM, 0.5, false);
    pocket(ctx, pockets[1], 58, 34, 36);
    ticks(ctx, water.cx, water.cy, water.r - 4, water.r, 150, 30, 4, FIG, 0.8);
    arc(ctx, water.cx, water.cy, water.r - 1.5, 150 - 120 * HOT_FROM, 30, LAMP.red, 2);
    warnSymbol(ctx, 'temp', water.cx, water.cy + 9, '#cfd0cc', true, 0.36, false);
    needle(ctx, water.cx, water.cy, water.r - 1, 150 - 120 * L.temp, NEEDLE, 1.3);
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
        glow: on && !!s.glow,
        park: on && !!s.parkBrake,
        main: on && !!s.lightLamps?.main,
        turn: on && !!(s.indicatorLamps?.left || s.indicatorLamps?.right),
        clock: s.clock ?? '', // a clock runs all the time, key on or off (Jamie)
      };
      const odo = counterDigits(s.odoMiles, 5);
      if (gate([on, L.charge, L.oil, L.glow, L.park, L.main, L.turn, L.clock, Math.round(shownMph * 2), Math.round(shownFuel * 20), Math.round(shownTemp * 20), odo.key].join('|'))) {
        face.redraw((ctx) => draw(ctx, s, L));
      }
    },
  };
}

/** Dash styles buildDash knows: every quad spec must name one of these. */
export const DASH_STYLES = ['farm300', 'bruin', 'ursa', 'rb300', 'hornet', 'adder', 'kidsKey', 'asp', 'plover', 'trail', 'mower', 'tractor', 'utv', 'tor', 'crag', 'finch', 'griffin', 'vauclair'];

/** Where each dash sits on the bars (metres, in the bars' frame) and how far it tilts back. A nacelle quad carries its own on its top. */
export const DASH_PLACE = {
  farm300: { pos: [0, 0.1, 0.02], tilt: 0.75 },
  bruin: { pos: [0, 0.1, 0.02], tilt: 0.75 },
  ursa: { pos: [0, 0.1, 0.02], tilt: 0.75 },
  rb300: { pos: [0, 0.05, 0.04], tilt: 0.85 }, // low, just over the middle of the bars
  hornet: { pos: [0, -0.034, -0.02], tilt: 0.5 }, // sitting on the clamp block at the bars' middle, behind the lamp (the V's middle is 7 cm below the bars' origin)
  adder: { pos: [0.195, -0.022, -0.075], tilt: 0.9 }, // on the pod on the level run of the V bars (the kill switch's panel)
  kidsKey: { pos: [0, 0.075, 0.0], tilt: 0.9 },
  plover: { pos: [0, 0, 0], tilt: 0.5 }, // the old bike's speedo: its model sets it in the headlamp nacelle itself
  trail: { pos: [0, 0, 0], tilt: 0.5 }, // the farm bike's: its model sets it on the bars' bracket
  mower: { pos: [0, 0, 0], tilt: 1.1 }, // the mower's: its model sets it on the dash panel's top
  asp: { pos: [0, -0.034, -0.02], tilt: 0.5 }, // the kids' quad's key, on the clamp block at the V bars' middle as the yellow's
  tractor: { pos: [0, 0, 0], tilt: 1.05 }, // the tractor's model places it on its scuttle itself
  utv: { pos: [0, 0, 0], tilt: 0.9 }, // so does the UTV's
  tor: { pos: [0, 0, 0], tilt: 0.55 }, // and the Tor's
  crag: { pos: [0, 0, 0], tilt: 0.55 }, // and the 200TDi's
  finch: { pos: [0, 0, 0], tilt: 0.5 }, // and the girls' cars'
  griffin: { pos: [0, 0, 0], tilt: 0.5 },
  vauclair: { pos: [0, 0, 0], tilt: 0.5 }, // and your car's
};

const BUILDERS = {
  farm300: buildFarm300,
  bruin: buildBruin,
  ursa: buildUrsa,
  rb300: buildRb300,
  hornet: buildHornet,
  adder: buildAdder,
  kidsKey: buildKidsKey,
  asp: buildKidsKey,
  plover: buildPloverDash,
  trail: buildTrail,
  mower: buildMower,
  tractor: buildTractor,
  utv: buildUtv,
  tor: buildTor,
  crag: buildCrag,
  finch: buildFinch,
  griffin: buildGriffin,
  vauclair: buildVAUCLAIR,
};

export function buildDash(style = 'farm300') {
  return (BUILDERS[style] ?? buildFarm300)();
}
