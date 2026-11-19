// The road signs and small furniture of a country lane (#686): a kit for any road, not for one lane. Each `build...` makes one thing standing at the origin
// facing +z (a flat sign shows its face to +z and a plainer back to -z), on its own post, ready to be placed and turned. Textures are canvases with the real
// signs' shapes and colours (British, 2026): white diamond "Passing place", blue "Single track road with passing places", the national speed limit, the red
// warning triangles, black-and-white chevrons, a ford's depth gauge, a fingerpost and a stile.

import * as THREE from 'three';
import { canvasTexture, worldBox } from './outbuildingProps.js';
import { woodTexture } from './neighbourTextures.js';

function text(ctx, lines, x, y, size, colour, gap = 1.15) {
  ctx.fillStyle = colour;
  ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x, y + (i - (lines.length - 1) / 2) * size * gap));
}

/** A white diamond with a black rim and "PASSING PLACE" across it, on a transparent square. */
export function passingPlaceTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const diamond = (inset, colour) => {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(w / 2, inset);
      ctx.lineTo(w - inset, h / 2);
      ctx.lineTo(w / 2, h - inset);
      ctx.lineTo(inset, h / 2);
      ctx.closePath();
      ctx.fill();
    };
    diamond(4, '#111');
    diamond(14, '#f4f4ef');
    text(ctx, ['PASSING', 'PLACE'], w / 2, h / 2, 34, '#111');
  });
}

/** A blue rectangle with a white rim: "Single track road with passing places". */
export function singleTrackTexture() {
  return canvasTexture(384, 288, (ctx, w, h) => {
    ctx.fillStyle = '#9a9ea0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#12449b';
    ctx.fillRect(16, 16, w - 32, h - 32);
    text(ctx, ['SINGLE TRACK ROAD', 'WITH', 'PASSING PLACES'], w / 2, h / 2, 27, '#fff');
  });
}

/** The national speed limit: a white disc with a black diagonal bar, on a grey back. */
export function nationalLimitTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#9a9ea0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 124, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4f4ef';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 114, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(w / 2 + 70, h / 2 - 78);
    ctx.lineTo(w / 2 - 70, h / 2 + 78);
    ctx.stroke();
  });
}

/** A red-bordered warning triangle with `draw(ctx, w, h)` for its picture, and an optional plate of `plate` beneath. */
function warningTexture(draw, plate = null) {
  return canvasTexture(256, plate ? 320 : 256, (ctx, w, h) => {
    ctx.fillStyle = '#9a9ea0';
    ctx.fillRect(0, 0, w, h);
    const tri = (inset, colour) => {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(w / 2, 6 + inset * 1.7);
      ctx.lineTo(w - 8 - inset * 1.5, 226 - inset * 0.55);
      ctx.lineTo(8 + inset * 1.5, 226 - inset * 0.55);
      ctx.closePath();
      ctx.fill();
    };
    tri(0, '#c4171d');
    tri(22, '#f4f4ef');
    ctx.save();
    draw(ctx, w, 230);
    ctx.restore();
    if (plate) {
      ctx.fillStyle = '#f4f4ef';
      ctx.fillRect(18, 240, w - 36, 64);
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 4;
      ctx.strokeRect(18, 240, w - 36, 64);
      text(ctx, [plate], w / 2, 273, 38, '#111');
    }
  });
}

/** "Series of bends": a triangle with a zig-zag line. */
export function bendsTexture() {
  return warningTexture((ctx, w) => {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(w / 2 + 4, 196);
    ctx.bezierCurveTo(w / 2 - 50, 170, w / 2 + 50, 130, w / 2 - 10, 100);
    ctx.bezierCurveTo(w / 2 - 36, 88, w / 2 - 20, 70, w / 2 - 6, 66);
    ctx.stroke();
  }, 'BENDS');
}

/** The ford warning: a triangle with a vehicle and a wavy line under it, "FORD" on a plate beneath. */
export function fordTexture() {
  return warningTexture((ctx, w) => {
    ctx.fillStyle = '#111';
    ctx.fillRect(w / 2 - 38, 128, 76, 26);
    ctx.fillRect(w / 2 - 22, 108, 40, 22);
    ctx.fillRect(w / 2 - 30, 150, 14, 12);
    ctx.fillRect(w / 2 + 18, 150, 14, 12);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 8;
    for (const y of [176, 194]) {
      ctx.beginPath();
      for (let x = w / 2 - 62; x <= w / 2 + 62; x += 4) ctx[x === w / 2 - 62 ? 'moveTo' : 'lineTo'](x, y + Math.sin((x - w / 2) / 8) * 5);
      ctx.stroke();
    }
  }, 'FORD');
}

/** A chevron board: a white rectangle with a heavy black chevron on it, pointing right. */
export function chevronTexture() {
  return canvasTexture(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f4f4ef';
    ctx.fillRect(7, 7, w - 14, h - 14);
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(60, 20);
    ctx.lineTo(120, 20);
    ctx.lineTo(196, h / 2);
    ctx.lineTo(120, h - 20);
    ctx.lineTo(60, h - 20);
    ctx.lineTo(136, h / 2);
    ctx.closePath();
    ctx.fill();
  });
}

/** A ford's depth gauge: a post painted in bands, a tick and a number at each tenth of a metre. */
export function gaugeTexture() {
  return canvasTexture(64, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f4f4ef';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 ? '#f4f4ef' : '#111';
      ctx.fillRect(0, h - (i + 1) * 25.6, w * 0.45, 25.6);
    }
    ctx.fillStyle = '#111';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 1; i < 10; i += 2) ctx.fillText(String(i), w * 0.52, h - i * 25.6);
  });
}

/** A fingerpost arm: white-painted, black capitals, a pointed end. */
export function fingerpostTexture(lines) {
  return canvasTexture(512, 96, (ctx, w, h) => {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f1efe6';
    ctx.fillRect(4, 4, w - 8, h - 8);
    text(ctx, lines, w * 0.46, h / 2, lines.length > 1 ? 30 : 40, '#111', 1.05);
  });
}

const steel = new THREE.MeshStandardMaterial({ color: 0x8a8f92, roughness: 0.55, metalness: 0.5 });
const back = new THREE.MeshStandardMaterial({ color: 0x8e9396, roughness: 0.6, metalness: 0.3 });

/**
 * A sign on a post: a face of `w` by `h` m, its bottom at `bottom` m, a steel post with a cap and a back plate that shows grey from behind, a rim round the
 * face, and `shape` 'rect', 'round' or 'diamond' (a square face turned 45 degrees, transparent corners). The face looks along +z; the post stands at the origin.
 */
export function buildSignPost(texture, w, h, { bottom = 1.5, shape = 'rect' } = {}) {
  const g = new THREE.Group();
  const top = bottom + h;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, top + 0.3, 8), steel);
  post.position.set(0, (top + 0.3) / 2 - 0.3, -0.03);
  g.add(post);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 8), steel);
  cap.position.set(0, top + 0.02, -0.03);
  g.add(cap);
  const geo = shape === 'round' ? new THREE.CircleGeometry(w / 2, 28) : new THREE.PlaneGeometry(w, h);
  const diamond = shape === 'diamond';
  const face = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.45, metalness: 0.1, transparent: diamond, alphaTest: diamond ? 0.5 : 0 }));
  face.position.set(0, bottom + h / 2, 0.012);
  g.add(face);
  // The back plate has the face's own outline: a diamond's is turned, so its corners do not show grey round the white.
  const plate = new THREE.Mesh(diamond ? new THREE.CircleGeometry(w * 0.5, 4) : geo, back);
  if (diamond) plate.rotation.z = 0;
  plate.position.set(0, bottom + h / 2, -0.005);
  plate.rotation.y = Math.PI;
  g.add(plate);
  if (shape === 'rect') {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, h + 0.03, 0.018), steel);
    rim.position.set(0, bottom + h / 2, 0);
    g.add(rim);
  } else if (shape === 'round') {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(w / 2, 0.012, 6, 28), steel);
    rim.position.set(0, bottom + h / 2, 0.004);
    g.add(rim);
  }
  return g;
}

/** The "Passing place" diamond, 0.6 m square on a post at 1.7 m. */
export const buildPassingPlaceSign = () => buildSignPost(passingPlaceTexture(), 0.62, 0.62, { bottom: 1.5, shape: 'diamond' });
/** The blue "Single track road with passing places" board, 0.9 by 0.68 m. */
export const buildSingleTrackSign = () => buildSignPost(singleTrackTexture(), 0.9, 0.68, { bottom: 1.35 });
/** The national speed limit disc, 0.6 m. */
export const buildNationalLimitSign = () => buildSignPost(nationalLimitTexture(), 0.6, 0.6, { bottom: 1.5, shape: 'round' });
/** The bends triangle with its plate, 0.75 m wide. */
export const buildBendsSign = () => buildSignPost(bendsTexture(), 0.75, 0.94, { bottom: 1.3 });
/** The ford triangle with its plate. */
export const buildFordSign = () => buildSignPost(fordTexture(), 0.75, 0.94, { bottom: 1.3 });
/** A chevron board, 0.9 by 0.56 m, on a post at 1.0 m. */
export const buildChevronBoard = () => buildSignPost(chevronTexture(), 0.9, 0.56, { bottom: 1.0 });

/**
 * A ford's depth gauge: a timber post with a painted board down it, to 1 m, a metal cap, and a concrete foot. It stands at the ford's edge, the numbers facing along
 * the road. `random` is for the timber.
 */
export function buildDepthGauge(random) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(random, [118, 100, 78]), roughness: 0.95 });
  const post = new THREE.Mesh(worldBox(0.14, 1.5, 0.14, 1), wood);
  post.position.y = 0.55;
  g.add(post);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.012), new THREE.MeshStandardMaterial({ map: gaugeTexture(), roughness: 0.6 }));
  board.position.set(0, 0.5, 0.078);
  g.add(board);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.18), steel);
  cap.position.y = 1.32;
  g.add(cap);
  const foot = new THREE.Mesh(worldBox(0.4, 0.14, 0.4, 1), new THREE.MeshStandardMaterial({ color: 0x9b9a94, roughness: 1 }));
  foot.position.y = -0.04;
  g.add(foot);
  return g;
}

/**
 * A fingerpost: a white-painted timber post with a ball finial and one arm pointing along +x, "Public footpath" and the place on it. The arm is cut to a point
 * at its end and has a rim, and it is fixed to the post with a strap.
 */
export function buildFingerpost(random, lines = ['Public footpath', 'Upper Thornby 1']) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xece9de, roughness: 0.9 });
  const post = new THREE.Mesh(worldBox(0.13, 2.2, 0.13, 1), paint);
  post.position.y = 0.9;
  g.add(post);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), paint);
  ball.position.y = 2.08;
  g.add(ball);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.2, 0.035), new THREE.MeshStandardMaterial({ map: fingerpostTexture(lines), roughness: 0.8 }));
  arm.position.set(0.42, 1.75, 0.09);
  g.add(arm);
  const point = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.12, 4), paint);
  point.rotation.z = -Math.PI / 2;
  point.rotation.x = Math.PI / 4;
  point.scale.set(1, 1, 0.25);
  point.position.set(0.88, 1.75, 0.09);
  g.add(point);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.03), steel);
  strap.position.set(0.0, 1.75, 0.085);
  g.add(strap);
  const foot = new THREE.Mesh(worldBox(0.3, 0.1, 0.3, 1), new THREE.MeshStandardMaterial({ color: 0x9b9a94, roughness: 1 }));
  foot.position.y = -0.1;
  g.add(foot);
  return g;
}

/**
 * A timber stile in a hedge or wall, 1.1 m wide across the way through and 1.05 m to its top rail: two posts, two steps and a top rail, with the gap's
 * hedge either side left to the caller. It spans x, with the climb along z.
 */
export function buildStile(random) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(random, [122, 104, 80]), roughness: 0.95 });
  const add = (w, h, d, x, y, z, rotZ = 0) => {
    const m = new THREE.Mesh(worldBox(w, h, d, 1), wood);
    m.position.set(x, y, z);
    m.rotation.z = rotZ;
    g.add(m);
    return m;
  };
  for (const x of [-0.55, 0.55]) add(0.12, 1.25, 0.12, x, 0.5, 0); // the posts, sunk a little
  add(1.2, 0.09, 0.1, 0, 1.0, 0.0); // the top rail
  add(1.0, 0.08, 0.3, 0, 0.42, 0.28); // the step up on the near side
  add(1.0, 0.08, 0.3, 0, 0.42, -0.28); // and down the far
  add(1.0, 0.07, 0.07, 0, 0.62, 0.0); // a middle rail so the gap under the top rail is closed
  return g;
}

/** A road drain: a cast-iron grating of slotted bars in a concrete frame, flush with the carriageway's edge, 0.6 by 0.4 m. Lies flat, its slots across +x. */
export function buildDrainGrate() {
  const g = new THREE.Group();
  const grit = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#8f8d86';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = i % 3 ? 'rgba(60,58,52,0.35)' : 'rgba(190,188,178,0.4)';
      ctx.fillRect((i * 37) % w, (i * 53) % h, 2, 2);
    }
    ctx.fillStyle = 'rgba(70,64,50,0.3)'; // silt in the corners
    ctx.fillRect(0, 0, 10, h);
  });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.5), new THREE.MeshStandardMaterial({ map: grit, roughness: 1 }));
  g.add(frame);
  const iron = new THREE.MeshStandardMaterial({ color: 0x23262a, metalness: 0.5, roughness: 0.55 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.4), new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 1 })); // the dark below the bars
  base.position.y = 0.022;
  g.add(base);
  for (let i = 0; i < 7; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.025, 0.4), iron);
    bar.position.set(-0.27 + i * 0.09, 0.04, 0);
    g.add(bar);
  }
  for (const z of [-0.19, 0.19]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.025, 0.03), iron);
    rail.position.set(0, 0.04, z);
    g.add(rail);
  }
  return g;
}
