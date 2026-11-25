// A kit for the way into a yard or a works off a lane (#1002), first used at the Old Pit's lane gate: precast concrete gate posts with their weathered
// caps, a chain of real links wrapped round two gate stiles with a laminated padlock, the hinges that hang a leaf on a post, interlocking concrete
// blocks, a height barrier with reflective bands and its limit plate, a works sign on two posts with a reflective edge, buddleia, litter, a ground
// drape (the bellmouth's broken surface) and loose lumps of tarmac. Pieces go into a `Parts` (parts.js), so a whole entrance is a few draw calls;
// everything is lit, with an edge to every part, and built to real sizes. The tape is drawn bright and its material glossy, so a headlamp catches it.

import * as THREE from 'three';
import { worldBox, canvasTexture } from './outbuildingProps.js';
import { galvanisedTexture, concreteTexture } from './yardKit.js';
import { reflectiveTapeTexture, heightPlateTexture } from './villageTextures.js';
import { vergeLeafTexture } from './laneVerge.js';
import { boltGeometry } from '../vehicle/detail/fixings.js';

const TAU = Math.PI * 2;
/** How much more light reflective tape gives back than plain white paint: its material's colour (1 is white). */
export const TAPE_GAIN = 1.6;

/** The kit's materials, all lit: dull galvanising, weathered precast concrete, old yellow paint gone to rust, reflective tape, chain and lock steel, earth. */
export function entranceMaterials(random) {
  const concreteMap = concreteTexture(random);
  return {
    concrete: new THREE.MeshStandardMaterial({ map: concreteMap, roughness: 0.95 }),
    galv: new THREE.MeshStandardMaterial({ map: galvanisedTexture(random), color: 0xe4e4df, roughness: 0.72, metalness: 0.15 }), // galvanising gone dull and chalky: pale, not shiny
    paint: new THREE.MeshStandardMaterial({ map: rustyPaintTexture(random, '#a88a3e'), roughness: 0.85, metalness: 0.15 }), // a barrier's yellow, mostly rust now
    // Reflective tape gives back far more of a lamp than paint does: lit like everything else (dark with no light on it), but its colour taken past
    // white, so a headlamp's light comes back off it brighter than off the board or the paint round it.
    tape: new THREE.MeshStandardMaterial({ map: reflectiveTapeTexture('hazard'), color: new THREE.Color(TAPE_GAIN, TAPE_GAIN, TAPE_GAIN), roughness: 0.12, metalness: 0 }),
    tapeWhite: new THREE.MeshStandardMaterial({ map: reflectiveTapeTexture('white'), color: new THREE.Color(TAPE_GAIN, TAPE_GAIN, TAPE_GAIN), roughness: 0.12, metalness: 0 }),
    chain: new THREE.MeshStandardMaterial({ color: 0x6e6152, roughness: 0.62, metalness: 0.5 }), // galvanised chain gone brown at the links' wear
    lock: new THREE.MeshStandardMaterial({ color: 0x8c8a84, roughness: 0.45, metalness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x24221f, roughness: 0.7, metalness: 0.3 }),
    earth: new THREE.MeshStandardMaterial({ color: 0x55462f, roughness: 1 }),
    heightPlate: new THREE.MeshStandardMaterial({ map: heightPlateTexture('2.1m'), roughness: 0.35 }),
  };
}

/**
 * Old paint on steel gone mostly to rust, one tile 0.6 m: the paint (`base`) left in faded islands over orange-brown rust, with darker pitting and
 * streaks running down. For a barrier, a post or anything painted and left out for years.
 */
export function rustyPaintTexture(random, base) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#7c4a2a';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(${random() < 0.5 ? '150,82,40' : '96,52,30'},${0.3 + random() * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(random() * w, random() * h, 3 + random() * 12, 2 + random() * 8, random() * 3, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = base; // what is left of the paint
    for (let i = 0; i < 26; i++) {
      ctx.globalAlpha = 0.7 + random() * 0.3;
      ctx.beginPath();
      ctx.ellipse(random() * w, random() * h, 6 + random() * 20, 4 + random() * 14, random() * 3, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 30; i++) {
      const x = random() * w;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(90,44,20,0.5)');
      g.addColorStop(1, 'rgba(90,44,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, random() * h * 0.5, 1 + random() * 2, h * 0.5);
    }
  });
}

/** A square post `w` across with its four arrises chamfered `c`, standing from y = 0 to `h`, its texture in metres over `tile`. */
export function chamferedPostGeometry(w, h, c = 0.025, tile = 0.5) {
  const s = w / 2;
  const pts = [[-s + c, -s], [s - c, -s], [s, -s + c], [s, s - c], [s - c, s], [-s + c, s], [-s, s - c], [-s, -s + c]];
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: h, bevelEnabled: false, steps: 1 });
  geo.rotateX(-Math.PI / 2); // the extrusion's length, along +z, stands up the post
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile);
  return geo;
}

/** A precast concrete gate post at (x, y, z) turned `yaw`: chamfered, `h` out of the ground and `sink` into it, a weathered cap and a ring of trodden earth at its foot. */
export function addGatePost(parts, mats, x, y, z, yaw, { w = 0.3, h = 1.8, sink = 0.45 } = {}) {
  parts.add(mats.concrete, chamferedPostGeometry(w, h + sink, 0.025, h + sink), x, y - sink, z, 0, yaw, 0); // one tile up the post: its seam once, the green at its foot
  parts.add(mats.concrete, new THREE.ConeGeometry(w * 0.72, 0.06, 4, 1).rotateY(Math.PI / 4), x, y + h + 0.028, z, 0, yaw, 0); // the cap, weathered to shed the wet
  parts.add(mats.earth, new THREE.CylinderGeometry(w * 0.9, w * 1.25, 0.08, 10), x, y + 0.005, z, 0, yaw, 0);
}

/** Bolt heads (the detail kit's) at `points` ([x, y, z] in the parts' frame), each facing along `normal`. */
export function addBolts(parts, material, points, normal, size = 0.016) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...normal).normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
  for (const [x, y, z] of points) {
    const geo = boltGeometry({ size, kind: 'hex' });
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 2), 2)); // so it merges with the textured parts it holds on
    parts.add(material, geo, x, y, z, e.x, e.y, e.z);
  }
}

/**
 * The hinges that hang a gate leaf on a post, in the gate's frame (x along the gate, z out): at each of `heights`, a strap bolted through the post's face
 * at `postFace` and a collar round the leaf's hinge stile at `stileX`.
 */
export function addHinges(parts, mats, postFace, stileX, heights, y0 = 0) {
  const side = Math.sign(postFace - stileX) || 1;
  for (const hy of heights) {
    const len = Math.abs(postFace - stileX) + 0.05;
    parts.add(mats.galv, worldBox(len, 0.045, 0.06, 0.3), (postFace + stileX) / 2 + side * 0.015, y0 + hy, 0);
    parts.add(mats.dark, new THREE.CylinderGeometry(0.034, 0.034, 0.07, 10), stileX, y0 + hy, 0);
    addBolts(parts, mats.galv, [[postFace + side * 0.06, y0 + hy, 0.155]], [0, 0, 1], 0.014);
  }
}

/** One chain link: an oval ring 5 cm long, its long way along local x. */
function linkGeometry() {
  return new THREE.TorusGeometry(0.016, 0.0045, 5, 10).scale(1.55, 1, 1);
}

/** Places a link at `p` along `dir`, its ring upright (`upright`) or flat, as alternate links of a chain lie. */
function placeLink(parts, material, p, dir, upright) {
  const x = new THREE.Vector3(...dir).normalize();
  const flat = new THREE.Vector3(-x.z, 0, x.x).normalize();
  const y = upright ? new THREE.Vector3(0, 1, 0) : flat;
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  const geo = linkGeometry().applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z));
  parts.add(material, geo, p[0], p[1], p[2]);
}

/**
 * A chain wrapped round two gate stiles `apart` m apart at height `y` (the gate's frame: x along it, z out), and a padlock through its front links
 * with a short tail hanging under it. Returns where the lock hangs.
 */
export function addChainAndLock(parts, mats, y, apart) {
  const a = apart / 2 + 0.05;
  const b = 0.05;
  const n = 16;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    const p = [a * Math.cos(t), y + 0.012 * Math.sin(t * 3), b * Math.sin(t)];
    const dir = [-a * Math.sin(t), 0, b * Math.cos(t)];
    placeLink(parts, mats.chain, p, dir, i % 2 === 0);
  }
  // The tail, hanging from the front of the wrap.
  for (let i = 0; i < 5; i++) placeLink(parts, mats.chain, [0.012 * Math.sin(i), y - 0.05 - i * 0.045, b + 0.008], [0.05, -1, 0.02], i % 2 === 0);
  // The padlock: a laminated body of thin plates (each with its edge), a dark keyway, and its shackle up through the wrap's front links.
  const lx = 0.03;
  const ly = y - 0.085;
  const lz = b + 0.02;
  for (let k = 0; k < 5; k++) parts.add(mats.lock, worldBox(0.046, 0.0085, 0.024, 0.1), lx, ly - 0.02 + k * 0.0095, lz);
  parts.add(mats.dark, worldBox(0.006, 0.014, 0.004, 0.1), lx, ly - 0.012, lz + 0.0135);
  parts.add(mats.lock, new THREE.TorusGeometry(0.014, 0.0035, 5, 10, Math.PI), lx, ly + 0.024, lz);
  return { x: lx, y: ly, z: lz };
}

/** A square section `w` across chamfered `c`, `l` long along local x, centred: the body of an interlocking block. */
function blockBody(l, w, c) {
  return chamferedPostGeometry(w, l, c, l).translate(0, -l / 2, 0).rotateZ(Math.PI / 2); // one tile along it, so the texture's seam is not a course of bricks
}

/**
 * An interlocking concrete block (1.6 by 0.8 by 0.8 m) on the ground at `y` under its middle, turned `yaw` (its length along local x) and tipped `tilt`:
 * a chamfered body, two studs on top for the next one up, and a rusty lifting eye cast into it. A few centimetres sunk, as it was dropped.
 */
export function addConcreteBlock(parts, mats, x, y, z, yaw, tilt = 0, { l = 1.6, w = 0.8 } = {}) {
  const local = new THREE.Group(); // only for the matrix
  local.position.set(x, y + w / 2 - 0.04, z);
  local.rotation.set(0, yaw, tilt, 'YXZ');
  local.updateMatrix();
  const p = (geo) => geo.applyMatrix4(local.matrix);
  parts.add(mats.concrete, p(blockBody(l, w, 0.035)));
  for (const sx of [-l / 4, l / 4]) parts.add(mats.concrete, p(new THREE.CylinderGeometry(0.13, 0.15, 0.08, 14).translate(sx, w / 2 + 0.038, 0)));
  parts.add(mats.chain, p(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI).translate(0, w / 2 - 0.012, 0)));
}

/**
 * A height barrier across a way, in its own frame (x along it, z out): two square posts `span` m either side of the middle, each standing on its own
 * ground (`groundL`, `groundR`, heights relative to the frame's origin), a beam across their fronts with its underside `clear` m over the higher ground, bolted
 * through angle cleats, reflective bands on the beam and the posts, and the limit plate hung under the beam's middle.
 */
export function addHeightBarrier(parts, mats, span, groundL, groundR, { clear = 2.1, post = 0.15, beam = 0.18 } = {}) {
  const beamY = Math.max(groundL, groundR) + clear + beam / 2;
  const top = beamY + beam / 2 + 0.06;
  for (const [sx, gy] of [[-span, groundL], [span, groundR]]) {
    const h = top - gy + 0.35;
    parts.add(mats.paint, worldBox(post, h, post, 0.6), sx, gy - 0.35 + h / 2, 0);
    parts.add(mats.paint, worldBox(post + 0.04, 0.012, post + 0.04, 0.3), sx, top + 0.006, 0); // the cap plate
    parts.add(mats.concrete, new THREE.CylinderGeometry(0.22, 0.27, 0.1, 12), sx, gy + 0.02, 0); // the footing's concrete showing
    for (const by of [0.55, 1.0, 1.55]) parts.add(mats.tape, worldBox(post + 0.008, 0.2, post + 0.008, 0.4, 0.2), sx, gy + by, 0); // reflective bands round the post
    parts.add(mats.paint, worldBox(post + 0.02, beam + 0.08, 0.01, 0.3), sx, beamY, post / 2 + 0.005); // the cleat the beam is bolted to
    addBolts(parts, mats.galv, [[sx - 0.045, beamY + 0.05, post / 2 + 0.07], [sx + 0.045, beamY - 0.05, post / 2 + 0.07]], [0, 0, 1], 0.015);
  }
  const len = span * 2 + post + 0.1;
  parts.add(mats.paint, worldBox(len, beam, 0.11, 0.6), 0, beamY, post / 2 + 0.065);
  // Reflective bands round the beam, every half metre or so: the barrier's warning at night.
  const bands = Math.max(3, Math.round(len / 0.9));
  for (let i = 0; i < bands; i++) {
    const bx = -len / 2 + 0.35 + (i * (len - 0.7)) / Math.max(1, bands - 1);
    parts.add(mats.tape, worldBox(0.5, beam + 0.008, 0.118, 0.4, 0.2), bx, beamY, post / 2 + 0.065);
  }
  // The limit plate on two straps under the beam's middle.
  for (const sx of [-0.12, 0.12]) parts.add(mats.galv, worldBox(0.03, 0.22, 0.008, 0.2), sx, beamY - beam / 2 - 0.08, post / 2 + 0.125);
  parts.add(mats.galv, worldBox(0.42, 0.42, 0.008, 0.4), 0, beamY - beam / 2 - 0.27, post / 2 + 0.135);
  parts.add(mats.heightPlate, new THREE.PlaneGeometry(0.4, 0.4), 0, beamY - beam / 2 - 0.27, post / 2 + 0.144);
  return { beamY };
}

/**
 * A works sign in its own frame (x across it, z out): a galvanised board `w` by `h` with its edges folded back, `face` the lettered material on its
 * front, a reflective white edge round the face, on two square posts with clamps and caps, each post on its own ground (`groundL`, `groundR`).
 */
export function addSignBoard(parts, mats, face, { w = 1.5, h = 1.0, bottom = 0.95, post = 0.06 } = {}, groundL = 0, groundR = 0) {
  const g = Math.min(groundL, groundR);
  const y0 = g + bottom;
  const px = w / 2 - 0.18;
  for (const [sx, gy] of [[-px, groundL], [px, groundR]]) {
    const top = y0 + h + 0.05;
    parts.add(mats.galv, worldBox(post, top - gy + 0.4, post, 0.5), sx, (top + gy - 0.4) / 2, 0);
    parts.add(mats.dark, worldBox(post + 0.008, 0.02, post + 0.008, 0.1), sx, top + 0.01, 0); // a plastic cap
    parts.add(mats.earth, new THREE.CylinderGeometry(0.09, 0.13, 0.06, 8), sx, gy + 0.005, 0);
    for (const cy of [y0 + 0.2, y0 + h - 0.2]) {
      parts.add(mats.galv, worldBox(0.11, 0.045, 0.03, 0.2), sx, cy, post / 2 + 0.006); // the clamp
      addBolts(parts, mats.galv, [[sx - 0.035, cy, post / 2 + 0.022], [sx + 0.035, cy, post / 2 + 0.022]], [0, 0, 1], 0.011);
    }
  }
  const bz = post / 2 + 0.03;
  parts.add(mats.galv, worldBox(w - 0.01, h - 0.01, 0.012, 0.5), 0, y0 + h / 2, bz); // 5 mm inside its folded edge all round
  // The folded edge, standing back behind the board: its front inside the board and its back clear of the posts, the sides between the top and bottom.
  for (const [ex, ey, ew, eh] of [[0, h / 2 - 0.0125, w, 0.025], [0, -h / 2 + 0.0125, w, 0.025], [w / 2 - 0.0125, 0, 0.025, h - 0.05], [-w / 2 + 0.0125, 0, 0.025, h - 0.05]]) {
    parts.add(mats.galv, worldBox(ew, eh, 0.025, 0.3), ex, y0 + h / 2 + ey, bz + 0.002 - 0.0125);
  }
  const fz = bz + 0.006 + 0.004; // the lettered face, 4 mm proud of the board so the two never fight
  parts.add(face, new THREE.PlaneGeometry(w - 0.02, h - 0.02), 0, y0 + h / 2, fz);
  // The reflective edge round the face, its back 4 mm proud of the face.
  const t = 0.035;
  for (const [ex, ey, ew, eh] of [[0, h / 2 - t / 2 - 0.012, w - 0.03, t], [0, -h / 2 + t / 2 + 0.012, w - 0.03, t], [w / 2 - t / 2 - 0.012, 0, t, h - 0.1], [-w / 2 + t / 2 + 0.012, 0, t, h - 0.1]]) {
    parts.add(mats.tapeWhite, worldBox(ew, eh, 0.004, 0.4, 0.1), ex, y0 + h / 2 + ey, fz + 0.006);
  }
  return { y0 };
}

// Plants and litter ---------------------------------------------------------------------------------------------------------------------------

/** Buddleia's long grey-green leaves (a lance on transparent) and its flower spikes (tiny purple florets on a cone), as two textures. */
export function buddleiaMaterials() {
  const flowers = canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#5b3a78';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) {
      const x = (i * 37) % w;
      const y = (i * 53) % h;
      ctx.fillStyle = i % 5 === 0 ? '#e0b64a' : i % 2 ? '#9a6cc0' : '#7d52a8'; // lilac florets with their orange eyes
      ctx.fillRect(x, y, 3, 3);
    }
  });
  return {
    stem: new THREE.MeshStandardMaterial({ color: 0x6a5c49, roughness: 0.95 }),
    leaf: new THREE.MeshLambertMaterial({ map: vergeLeafTexture('#6f8466', 2), alphaTest: 0.5, side: THREE.DoubleSide }),
    flower: new THREE.MeshStandardMaterial({ map: flowers, roughness: 0.9 }),
    old: new THREE.MeshStandardMaterial({ color: 0x5c4634, roughness: 1 }), // last year's spikes, gone brown
  };
}

/**
 * A buddleia bush `h` m tall at (x, y, z): arching stems from a woody base, pairs of long leaves along their upper parts, and a purple flower spike
 * drooping at the end of each (or last year's, brown). Into `parts`, with `random` for its shape.
 */
export function addBuddleia(parts, mats, x, y, z, h, random) {
  const stems = 8 + Math.floor(random() * 4);
  parts.add(mats.stem, new THREE.CylinderGeometry(0.09, 0.14, 0.35, 8), x, y + 0.15, z);
  for (let s = 0; s < stems; s++) {
    const yaw = (s / stems) * TAU + random() * 0.5;
    const out = (0.35 + random() * 0.45) * h;
    const up = (0.7 + random() * 0.3) * h;
    const dx = Math.cos(yaw);
    const dz = Math.sin(yaw);
    const pts = [
      [x + dx * 0.05, y + 0.2, z + dz * 0.05],
      [x + dx * out * 0.3, y + up * 0.55, z + dz * out * 0.3],
      [x + dx * out * 0.7, y + up * 0.92, z + dz * out * 0.7],
      [x + dx * out, y + up * 0.8, z + dz * out],
    ];
    for (let i = 0; i < 3; i++) parts.rod(mats.stem, pts[i], pts[i + 1], 0.024 - i * 0.005, 0.019 - i * 0.005, 5);
    // Leaves in pairs along the upper two pieces, each a card from the stem outwards and down a little.
    for (let i = 1; i < 3; i++) {
      for (let k = 0; k < 3; k++) {
        const f = (k + 0.5) / 3;
        const p = pts[i].map((c, j) => c + (pts[i + 1][j] - c) * f);
        for (const side of [-1, 1]) {
          const a = yaw + side * (Math.PI / 2) + (random() - 0.5) * 0.6;
          const len = 0.16 + random() * 0.08;
          const leaf = new THREE.PlaneGeometry(0.05, len).translate(0, len / 2, 0).rotateX(-1.1 - random() * 0.5);
          parts.add(mats.leaf, leaf, p[0], p[1], p[2], 0, -a + Math.PI / 2, 0);
        }
      }
    }
    // The flower spike, hanging from the tip.
    const tip = pts[3];
    const spike = new THREE.ConeGeometry(0.055, 0.3, 7).translate(0, -0.15, 0);
    parts.add(random() < 0.8 ? mats.flower : mats.old, spike, tip[0], tip[1], tip[2], 0.3 * dz, 0, -0.3 * dx);
  }
}

/** The litter's materials: a faded can, a foil crisp packet, a white carrier bag and green bottle glass. */
export function litterMaterials(random) {
  const can = canvasTexture(64, 32, (ctx, w, h) => {
    ctx.fillStyle = '#b9bcbd';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = random() < 0.5 ? '#a8463e' : '#3f5f8c'; // a faded label, no maker's name
    ctx.fillRect(0, 5, w, h - 10);
    ctx.fillStyle = 'rgba(240,240,236,0.6)';
    ctx.fillRect(0, h / 2 - 2, w, 4);
  });
  const foil = canvasTexture(32, 32, (ctx, w, h) => {
    ctx.fillStyle = '#c9b13c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#a42b2b';
    ctx.fillRect(4, 10, w - 8, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(0, 0, w, 3);
  });
  return {
    can: new THREE.MeshStandardMaterial({ map: can, roughness: 0.35, metalness: 0.6 }),
    packet: new THREE.MeshStandardMaterial({ map: foil, roughness: 0.3, metalness: 0.5 }),
    bag: new THREE.MeshStandardMaterial({ color: 0xe6e4dc, roughness: 0.55 }),
    bottle: new THREE.MeshStandardMaterial({ color: 0x2f5a34, roughness: 0.15, metalness: 0.1 }),
  };
}

/** One bit of litter of `kind` ('can', 'packet', 'bag', 'bottle') at (x, y, z), lying or snagged as it fell: `tip` 0..1 deals how. */
export function addLitter(parts, mats, kind, x, y, z, yaw, tip) {
  if (kind === 'can') {
    const can = new THREE.CylinderGeometry(0.033, 0.033, 0.115, 12);
    if (tip < 0.5) can.scale(1, 0.45, 1.15); // trodden flat
    parts.add(mats.can, can, x, y + 0.03, z, Math.PI / 2, yaw, 0);
  } else if (kind === 'packet') {
    const packet = new THREE.BoxGeometry(0.13, 0.012, 0.19);
    const p = packet.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.01 * Math.sin(p.getX(i) * 30) + 0.012 * Math.sin(p.getZ(i) * 21)); // crumpled
    packet.computeVertexNormals();
    parts.add(mats.packet, packet, x, y + 0.01, z, 0.2 + tip * 0.9, yaw, 0.3);
  } else if (kind === 'bag') {
    const bag = new THREE.IcosahedronGeometry(0.12, 1);
    const p = bag.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const k = 1 + 0.25 * Math.sin(p.getX(i) * 41 + p.getY(i) * 17) + 0.2 * Math.sin(p.getZ(i) * 29);
      p.setXYZ(i, p.getX(i) * k * 1.4, p.getY(i) * k * 0.8, p.getZ(i) * k);
    }
    bag.computeVertexNormals();
    parts.add(mats.bag, bag, x, y, z, 0.4, yaw, 0.2);
    parts.add(mats.bag, new THREE.TorusGeometry(0.05, 0.008, 4, 10, Math.PI), x + 0.1 * Math.cos(yaw), y + 0.08, z - 0.1 * Math.sin(yaw), 0, yaw, 0.6); // a handle caught on a twig
  } else {
    parts.add(mats.bottle, new THREE.CylinderGeometry(0.036, 0.036, 0.2, 12), x, y + 0.035, z, Math.PI / 2, yaw, 0);
    parts.add(mats.bottle, new THREE.CylinderGeometry(0.013, 0.033, 0.08, 10), x + 0.14 * Math.cos(yaw), y + 0.035, z - 0.14 * Math.sin(yaw), 0, yaw, Math.PI / 2);
  }
}

// The ground ------------------------------------------------------------------------------------------------------------------------------------

/**
 * A drape over the ground: `rows` across a way ([{ u, left, right }], metres out and the edges' offsets along), `cols` points across each, set in
 * `frame` (pitEntrance.js `frameOf`) on `groundY` raised `lift` m less `dip(u, v)`, with a skirt down into the ground along both edges and at the
 * first row so its edge has a face and no gap shows. `uvOf(u, v)` gives each point's texture place.
 */
export function drapeGeometry(rows, { frame, groundY, lift = 0.05, dip = () => 0, cols = 24, uvOf, skirt = 0.08 }) {
  const pos = [];
  const uv = [];
  const index = [];
  const vert = (u, v, down = 0) => {
    const p = frame.at(u, v);
    pos.push(p.x, groundY(p.x, p.z) + (down ? -down : lift - dip(u, v)), p.z);
    uv.push(...uvOf(u, v));
    return pos.length / 3 - 1;
  };
  const grid = rows.map((r) => Array.from({ length: cols + 1 }, (_, k) => vert(r.u, r.left + ((r.right - r.left) * k) / cols)));
  for (let i = 0; i + 1 < grid.length; i++) {
    for (let k = 0; k < cols; k++) {
      const a = grid[i][k];
      const b = grid[i][k + 1];
      const c = grid[i + 1][k];
      const d = grid[i + 1][k + 1];
      index.push(a, c, b, b, c, d);
    }
  }
  // The skirts: each edge's points again, down in the ground, joined to the edge.
  const skirtAlong = (pick) => {
    const top = grid.map(pick);
    const low = rows.map((r, i) => {
      const k = top[i];
      const p = [pos[k * 3], pos[k * 3 + 2]];
      const fr = frame.toFrame(p[0], p[1]);
      return vert(fr.u, fr.v, skirt);
    });
    return { top, low };
  };
  const left = skirtAlong((row) => row[0]);
  const right = skirtAlong((row) => row[cols]);
  for (let i = 0; i + 1 < rows.length; i++) {
    index.push(left.top[i], left.low[i], left.top[i + 1], left.top[i + 1], left.low[i], left.low[i + 1]);
    index.push(right.top[i], right.top[i + 1], right.low[i], right.top[i + 1], right.low[i + 1], right.low[i]);
  }
  const first = grid[0].map((k) => {
    const fr = frame.toFrame(pos[k * 3], pos[k * 3 + 2]);
    return vert(fr.u, fr.v, skirt);
  });
  for (let k = 0; k < cols; k++) index.push(grid[0][k], grid[0][k + 1], first[k], grid[0][k + 1], first[k + 1], first[k]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** A loose lump of broken tarmac, about `size` m across and 4 cm thick, with a ragged outline and its edges just softened: `shape` 0..1 deals the outline. */
export function tarmacChunkGeometry(size, shape) {
  const n = 6 + Math.floor(shape * 3);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const r = size * 0.5 * (0.7 + 0.3 * Math.sin(i * 2.3 + shape * 9) * Math.cos(i * 1.1 + shape * 4));
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.032, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  return geo;
}
