import * as THREE from 'three';

// Shared pieces for the dashes and pods. Faces are canvases drawn in millimetres, using the same coordinates as the mockups in
// docs/briefs/dashes/ (x to the rider's right, y down), so a drawing routine can be read against its mockup.

export const MM = 0.001;

export const plastic = new THREE.MeshStandardMaterial({ color: 0x26272a, roughness: 0.55 });
export const charcoal = new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.45, metalness: 0.2 });
export const blackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
export const gloss = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.25, metalness: 0.1 });
export const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dadc, roughness: 0.15, metalness: 1.0 });
export const agedSteel = new THREE.MeshStandardMaterial({ color: 0x77715f, roughness: 0.8, metalness: 0.45 }); // a bezel gone dull and pitted
export const agedBlack = new THREE.MeshStandardMaterial({ color: 0x24201a, roughness: 0.85 }); // old pressed steel, its paint worn
export const steel = new THREE.MeshStandardMaterial({ color: 0x555a5e, roughness: 0.5, metalness: 0.7 });

/** Redraws only when what's shown has changed. */
export function changeGate() {
  let last = '';
  return (key) => {
    if (key === last) return false;
    last = key;
    return true;
  };
}

/**
 * A flat canvas face covering the rectangle (x, y, w, h) mm of a mockup, placed relative to the group origin (ox, oy) in the same
 * mockup coordinates. `redraw(fn)` clears it and calls fn(ctx) with the context scaled so fn can draw in mockup millimetres.
 */
export function mmPanel({ x, y, w, h, ox, oy, z = -0.0356, pxPerMm = 5 }) {
  const k = pxPerMm;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * k);
  canvas.height = Math.ceil(h * k);
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w * MM, h * MM),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true }),
  );
  mesh.rotation.y = Math.PI; // the canvas reads left to right from the rider's side
  mesh.position.set(-(x + w / 2 - ox) * MM, -(y + h / 2 - oy) * MM, z);
  return {
    mesh,
    redraw(fn) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(k, 0, 0, k, -x * k, -y * k);
      fn(ctx);
      tex.needsUpdate = true;
    },
  };
}

// Moulded housings ---------------------------------------------------------------

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

/**
 * A moulded housing for the mockup rectangle (x, y, w, h) mm, softly rounded, its face at z = -0.035 towards the rider.
 * `depth` is how far it stands back from the face.
 */
export function housing(group, { x, y, w, h, r = 8, ox, oy, material = plastic, depth = 0.05, name = 'dashHousing' }) {
  const bevel = 0.006;
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w * MM - 2 * bevel, h * MM - 2 * bevel, Math.max(0.002, r * MM - bevel)), {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 12,
  });
  geo.translate(0, 0, -0.025 - (depth - 0.05) / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  mesh.position.set(-(x + w / 2 - ox) * MM, -(y + h / 2 - oy) * MM, 0);
  group.add(mesh);
  return mesh;
}

/** A chrome ring standing a little proud of a face, centred on mockup point (cx, cy). */
export function chromeRing(group, { cx, cy, r, ox, oy, z = -0.0365, tube = 0.0028, material = chromeMat }) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * MM, tube, 8, 40), material);
  ring.position.set(-(cx - ox) * MM, -(cy - oy) * MM, z);
  group.add(ring);
  return ring;
}

// Drawing in millimetres ----------------------------------------------------------

export const FONT = 'Helvetica, Arial, sans-serif';

/** Point at angle a degrees (0 = right, counter-clockwise, y up on screen). */
export function pol(cx, cy, r, a) {
  const t = (a * Math.PI) / 180;
  return [cx + r * Math.cos(t), cy - r * Math.sin(t)];
}

export function text(ctx, str, x, y, size, colour, { align = 'left', weight = 'normal', style = '', spacing = 0 } = {}) {
  ctx.fillStyle = colour;
  ctx.font = `${style} ${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (spacing) ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(str, x, y);
  if (spacing) ctx.letterSpacing = '0px';
}

export function ticks(ctx, cx, cy, r0, r1, a0, a1, n, colour, width) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const [x0, y0] = pol(cx, cy, r0, a);
    const [x1, y1] = pol(cx, cy, r1, a);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
}

export function labels(ctx, cx, cy, r, a0, a1, texts, colour, size) {
  texts.forEach((t, i) => {
    const a = a0 + ((a1 - a0) * i) / (texts.length - 1);
    const [x, y] = pol(cx, cy, r, a);
    text(ctx, t, x, y + size * 0.36, size, colour, { align: 'center' });
  });
}

export function arc(ctx, cx, cy, r, a0, a1, colour, width) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(cx, cy, r, (-a0 * Math.PI) / 180, (-a1 * Math.PI) / 180, a1 > a0);
  ctx.stroke();
}

export function needle(ctx, cx, cy, r, a, colour = '#e8541e', width = 1.4) {
  const [x, y] = pol(cx, cy, r, a);
  const [bx, by] = pol(cx, cy, r * 0.18, a + 180);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(cx, cy, width * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = 'butt';
}

/** A mechanical counter: white digits on black, the last (tenths) inverted. */
export function drum(ctx, x, y, whole, tenth, h = 7) {
  const digits = whole + tenth;
  const w = 4.6;
  ctx.fillStyle = '#0b0b0b';
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.roundRect(x - 1, y - 1, digits.length * w + 2, h + 2, 0.8);
  ctx.fill();
  ctx.stroke();
  [...digits].forEach((ch, i) => {
    const last = i === digits.length - 1;
    ctx.fillStyle = last ? '#f2f2f2' : '#151515';
    ctx.fillRect(x + i * w + 0.3, y, w - 0.6, h);
    text(ctx, ch, x + i * w + w / 2, y + h * 0.78, h * 0.8, last ? '#111' : '#f2f2f2', { align: 'center' });
  });
}

export const LAMP = { green: '#3fd36b', amber: '#ffb52e', red: '#ff4a3a' };

/** A warning lamp: lit in its colour with a glow, or dull grey. */
export function lamp(ctx, x, y, colour, label, lit, { r = 3.4, shape = 'circle', labelBelow = true, labelColour = '#ddd' } = {}) {
  if (lit) {
    ctx.fillStyle = colour;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = lit ? colour : '#3a3a3a';
  ctx.strokeStyle = '#777';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2);
  else ctx.roundRect(x - r, y - r, 2 * r, 2 * r, 0.8);
  ctx.fill();
  ctx.stroke();
  if (label && labelBelow) text(ctx, label, x, y + r + 5, 3.6, labelColour, { align: 'center' });
}

/**
 * A warning symbol, drawn in millimetres about (x, y): lit in `colour` with a glow behind, or dull when out. `scale` shrinks it for a
 * dial face, and `glow` false drops the glow (for an LCD). Every dash and pod uses these in place of words on its lamps and gauges.
 */
export function warnSymbol(ctx, kind, x, y, colour, lit, scale = 1, glow = true) {
  if (scale !== 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    warnSymbol(ctx, kind, 0, 0, colour, lit, 1, glow);
    ctx.restore();
    return;
  }
  const c = lit ? colour : '#3c3f42';
  if (lit && glow) {
    ctx.fillStyle = colour;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = 1.1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (kind === 'glow') {
    // A glow plug's coil.
    ctx.moveTo(x - 7, y + 1);
    for (let i = 0; i <= 28; i++) ctx.lineTo(x - 7 + i * 0.5, y + Math.sin(i * 0.9) * 3.2 * (i < 3 || i > 25 ? 0.3 : 1));
    ctx.stroke();
  } else if (kind === 'charge') {
    // A battery with its two terminals and a plus and a minus.
    ctx.strokeRect(x - 6.5, y - 3, 13, 7.5);
    ctx.fillRect(x - 4.5, y - 5.2, 2.6, 2.2);
    ctx.fillRect(x + 2, y - 5.2, 2.6, 2.2);
    ctx.lineWidth = 0.9;
    ctx.moveTo(x - 4.2, y + 0.8);
    ctx.lineTo(x - 1.4, y + 0.8);
    ctx.moveTo(x - 2.8, y - 0.6);
    ctx.lineTo(x - 2.8, y + 2.2);
    ctx.moveTo(x + 1.6, y + 0.8);
    ctx.lineTo(x + 4.6, y + 0.8);
    ctx.stroke();
  } else if (kind === 'oil') {
    // An oil can with its spout and a drop.
    ctx.moveTo(x - 5, y - 1);
    ctx.lineTo(x + 3.5, y - 1);
    ctx.lineTo(x + 3.5, y + 4);
    ctx.lineTo(x - 5, y + 4);
    ctx.closePath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x - 8.5, y - 3);
    ctx.moveTo(x - 1.5, y - 1);
    ctx.lineTo(x - 1.5, y - 3.2);
    ctx.lineTo(x + 2, y - 3.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 6.2, y + 2.6, 1.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'choke') {
    // A choke: the carb's throat with its flap closed across it and an arrow of air coming in.
    ctx.moveTo(x - 7, y - 4);
    ctx.lineTo(x + 7, y - 4);
    ctx.moveTo(x - 7, y + 4);
    ctx.lineTo(x + 7, y + 4);
    ctx.moveTo(x + 2.5, y - 4);
    ctx.lineTo(x - 2.5, y + 4);
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x - 4, y);
    ctx.moveTo(x - 5.4, y - 1.6);
    ctx.lineTo(x - 3.8, y);
    ctx.lineTo(x - 5.4, y + 1.6);
    ctx.stroke();
  } else if (kind === 'park') {
    // A P in a circle.
    ctx.arc(x, y, 5.4, 0, Math.PI * 2);
    ctx.stroke();
    text(ctx, 'P', x, y + 2.8, 7.4, c, { align: 'center', weight: 'bold' });
  } else if (kind === 'belt') {
    // Someone seated with the belt across them.
    ctx.arc(x - 1.5, y - 4, 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 1.5, y - 1.6);
    ctx.lineTo(x - 1.5, y + 2.4);
    ctx.lineTo(x + 3.6, y + 2.4);
    ctx.moveTo(x - 5.2, y - 2.6);
    ctx.lineTo(x + 3.4, y + 3.6);
    ctx.stroke();
  } else if (kind === 'turn' || kind === 'turnLeft' || kind === 'turnRight') {
    // The indicator tell-tale: "<- ->" for the Series' single lamp, or one arrow (turnLeft, turnRight) for the lamps that come in a pair.
    const single = kind !== 'turn';
    for (const d of single ? [kind === 'turnLeft' ? -1 : 1] : [-1, 1]) {
      const tail = single ? x - d * 6 : x + d * 1.4; // a single arrow is centred on its lamp, a pair sits either side of the middle
      const tip = single ? x + d * 6 : x + d * 8.6;
      ctx.moveTo(tail, y);
      ctx.lineTo(tip, y);
      ctx.moveTo(tip - d * 3.4, y - 3.2);
      ctx.lineTo(tip, y);
      ctx.lineTo(tip - d * 3.4, y + 3.2);
    }
    ctx.stroke();
  } else if (kind === 'beam') {
    // A headlamp with its main beam: four straight rays.
    ctx.arc(x - 3, y, 4.2, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.moveTo(x + 2.2, y - 4.5 + i * 3);
      ctx.lineTo(x + 8, y - 4.5 + i * 3);
    }
    ctx.stroke();
  } else if (kind === 'fuel') {
    // A fuel pump: the cabinet with its window, a base line and the hose looping off the side.
    ctx.strokeRect(x - 5, y - 5, 6.4, 10);
    ctx.strokeRect(x - 3.8, y - 3.8, 4, 2.8);
    ctx.moveTo(x - 6.4, y + 5);
    ctx.lineTo(x + 2.8, y + 5);
    ctx.moveTo(x + 1.4, y - 3);
    ctx.lineTo(x + 4.4, y - 3);
    ctx.lineTo(x + 4.4, y + 2.6);
    ctx.stroke();
  } else if (kind === 'temp') {
    // A thermometer standing in two wavy lines of coolant.
    ctx.moveTo(x - 3.4, y - 5);
    ctx.lineTo(x - 3.4, y + 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - 3.4, y + 3.4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    for (const wy of [-1.2, 3.4]) {
      ctx.moveTo(x + 0.4, wy + y);
      ctx.quadraticCurveTo(x + 2, wy + y - 1.6, x + 3.6, wy + y);
      ctx.quadraticCurveTo(x + 5.2, wy + y + 1.6, x + 6.8, wy + y);
    }
    ctx.stroke();
  } else if (kind === '4wd' || kind === 'lock') {
    // Two axles joined by a shaft to a wheel at each end; the diff lock's has a locked centre ring.
    for (const ay of [-3.6, 3.6]) {
      ctx.moveTo(x - 5, y + ay);
      ctx.lineTo(x + 5, y + ay);
      ctx.fillRect(x - 7.2, y + ay - 2, 2.4, 4);
      ctx.fillRect(x + 4.8, y + ay - 2, 2.4, 4);
    }
    ctx.moveTo(x, y - 3.6);
    ctx.lineTo(x, y + 3.6);
    ctx.stroke();
    if (kind === 'lock') {
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = '#101010';
      ctx.fill();
      ctx.stroke();
    }
  } else if (kind === 'lights') {
    // A headlamp with its beams.
    ctx.arc(x - 2, y, 4.2, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(x + 3.2, y - 3.6 + i * 3.6);
      ctx.lineTo(x + 8, y - 3.6 + i * 3.6);
    }
    ctx.stroke();
  }
}

/** A lit-up letter (N, R) with no lamp behind it: coloured with a glow when lit, dull when not. */
export function glyphLetter(ctx, x, y, colour, letter, lit, size = 7) {
  if (lit) {
    ctx.fillStyle = colour;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  text(ctx, letter, x, y + size * 0.36, size, lit ? colour : '#3c3f42', { align: 'center', weight: 'bold' });
}

/** The ignition key in its barrel: upright for on, turned a quarter for off. */
export function keySwitch(ctx, x, y, on, ring = '#9a9a9a') {
  ctx.fillStyle = '#111';
  ctx.strokeStyle = ring;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(on ? 0 : -Math.PI / 2);
  ctx.fillStyle = '#bbb';
  ctx.beginPath();
  ctx.roundRect(-1.2, -5, 2.4, 10, 0.6);
  ctx.fill();
  ctx.restore();
  text(ctx, 'O', x - 9, y - 6, 3.4, '#ccc');
  text(ctx, 'I', x + 7.5, y - 6, 3.4, '#ccc');
}

// Seven-segment digits, in millimetres ------------------------------------------------

const SEGMENTS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };

function drawDigit(ctx, ch, x, y, w, h, on, ghost) {
  const t = w * 0.17;
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
    const isOn = lit.includes(name);
    if (!isOn && !ghost) continue;
    ctx.fillStyle = isOn ? on : ghost;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(sx(px, py), y + py) : ctx.moveTo(sx(px, py), y + py)));
    ctx.closePath();
    ctx.fill();
  }
}

/** Seven-segment text ending at xRight, top at yTop, digits h mm tall. Understands digits, '-', ' ', '.' and ':'. Unlit segments are drawn in `ghost`. */
export function segText(ctx, str, xRight, yTop, h, on, ghost = null) {
  const w = h * 0.52;
  const gap = h * 0.16;
  const cell = (ch) => (ch === '.' ? h * 0.2 : ch === ':' ? h * 0.26 : w + gap);
  let x = xRight - [...str].reduce((sum, ch) => sum + cell(ch), 0) + gap;
  for (const ch of str) {
    if (ch === '.') {
      ctx.fillStyle = on;
      ctx.fillRect(x + h * 0.02, yTop + h - h * 0.12, h * 0.12, h * 0.12);
    } else if (ch === ':') {
      ctx.fillStyle = on;
      ctx.fillRect(x + h * 0.06, yTop + h * 0.3, h * 0.11, h * 0.11);
      ctx.fillRect(x + h * 0.06, yTop + h * 0.65, h * 0.11, h * 0.11);
    } else {
      drawDigit(ctx, ch, x, yTop, w, h, on, ghost);
    }
    x += cell(ch);
  }
}

/** The text a speed readout shows. */
export function speedText(mph, digits = 2) {
  return String(Math.min(10 ** digits - 1, Math.round(mph))).padStart(digits, ' ');
}
