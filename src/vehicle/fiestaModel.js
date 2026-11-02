import { part } from './part.js';
import * as THREE from 'three';
import { buildDash } from './dash.js';
import { addHeadlightBeams, addSignalLamps, addSignalStalk, addHazardSwitch, faceAlong } from './quadModel.js';
import { mergeStatic } from './quadGeometry.js';
import { add, post, rbox as roundedBox, label, plate, fitText, canvasTexture, seeded, tube, axleCyl, addPedals } from './landRoverModel.js';
import { buildLPlate } from './lPlateModel.js';
import { treadTyre } from './detail/tread.js';
import { buildRoadWheel } from './detail/roadWheels.js';
import { buildSeatBelt, webbingMaterial } from './detail/belts.js';
import { buildWiper } from './detail/fittings.js';
import { markWiper, addRainGlassBetween, addWiperStalk, markGlass } from './wiperModel.js';
import { buildRadio } from './detail/radios.js';
import { addIgnitionKey } from './dash.js';
import { FIESTA_BODY, FIESTA_DOOR, FIESTA_HATCH, FIESTA_TAIL_LAMP, FIESTA_BOOT, FIESTA_R, FIESTA_TYRE_W, FIESTA_RIDE_LIFT } from './fiestaBody.js';

// The Mk1 Fiesta at its real size (TODO 102), built from fiestaBody.js's numbers after the photos. Driven by Quad through the same named parts as the
// Land Rovers' (carModel.js: steeringColumn > handlebars, dash, gearLever, parkBrakeLever, chokeKnob, seatBack_driver and seatBack_left that tip,
// riderAnchor, seatLeft, seatRearLeft, seatRearRight, the cameras, exhaustTip, belt_<seat>), plus:
//
//   doorLeft, doorRight    groups hinged on their front edges: poseSeriesDoors swings them (the dirt on them goes with them: `mudRest`)
//   hatch                  a group hinged along the roof's rear edge, with the glass, the deck and the tail panel: poseFiestaHatch lifts it on T
//   hatchStrutLeft/Right   the gas struts, stretched and aimed by poseFiestaHatch between the body and the hatch
//   pedalClutch, pedalBrake, pedalAccel   swung by poseCarControls

const c = FIESTA_BODY;
const W = c.width;
const zF = c.wheelbase / 2;
const [zs, ys] = c.screenBase;
const [zt, yt] = c.screenTop;
const [zr, yr] = c.roofRear;
const [zh, yh] = c.hatchBottom;
const FACE = W / 2 - 0.02; // the body side's middle: panels are 3.5 cm thick across it
const OUT = FACE + 0.0175; // the side's outer face
const ARCH = { y: c.R + 0.03, r: c.R + 0.07 };
const NOSE_LOW = 0.31; // the body's lower edge at the nose and the tail, level with the bumper's top

/** A box with its edges rounded, or, up to a 12 mm radius, a plain one: watertight where boxes butt (rounded ones leave pinholes at the corners, see defenderModel.js). */
function rbox(w, h, d, r, mat, x, y, z, parent, name) {
  if (r > 0.012) return roundedBox(w, h, d, r, mat, x, y, z, parent, name);
  const m = add(new THREE.BoxGeometry(w, h, d), mat, parent, name);
  m.position.set(x, y, z);
  return m;
}

/** The top of the body's side at z (the line runs from the nose back). */
function upperAt(z) {
  const u = c.upper;
  if (z >= u[0][0]) return u[0][1];
  for (let i = 1; i < u.length; i++) {
    const [z0, y0] = u[i - 1];
    const [z1, y1] = u[i];
    if (z >= z1) return y0 + ((y1 - y0) * (z0 - z)) / (z0 - z1 || 1);
  }
  return u[u.length - 1][1];
}

/** The glasshouse's half width at height y: the body's at the waist, drawn in (tumblehome) towards the roof. */
export const halfAt = (y) => W / 2 - 0.05 - (y - ys) * c.tumble;

/** The arch's centre height and radius (the tyre's centre a little under, it sinks on its springs). */
const archDz = () => Math.sqrt(Math.max(0, ARCH.r * ARCH.r - (c.sill - ARCH.y) ** 2));

/** A body side piece: the front wing (from the nose back to the door's front edge) or the rear quarter (from the door's rear edge to the tail), arches cut in. */
export function sidePiece(part) {
  const dz = archDz();
  const start = Math.atan2(c.sill - ARCH.y, dz);
  const s = new THREE.Shape();
  if (part === 'front') {
    s.moveTo(c.nose, NOSE_LOW); // the valance's lower edge is higher than the sill and slopes down to it along the wing, as in the photos
    s.lineTo(zF + dz, c.sill);
    s.absarc(zF, ARCH.y, ARCH.r, start, Math.PI - start, false);
    s.lineTo(zF - dz, c.sill);
    s.lineTo(FIESTA_DOOR.hinge, c.sill);
    s.lineTo(FIESTA_DOOR.hinge, upperAt(FIESTA_DOOR.hinge));
    for (const [z, y] of c.upper.filter(([z]) => z > FIESTA_DOOR.hinge).reverse()) s.lineTo(z, y); // up the line from the door's edge to the nose
  } else {
    s.moveTo(FIESTA_DOOR.rear, c.sill);
    s.lineTo(-zF + dz, c.sill);
    s.absarc(-zF, ARCH.y, ARCH.r, start, Math.PI - start, false);
    s.lineTo(-zF - dz, c.sill);
    s.lineTo(c.tail, NOSE_LOW); // and rises again to the tail
    for (let i = c.upper.length - 1; i >= 0; i--) if (c.upper[i][0] < FIESTA_DOOR.rear) s.lineTo(c.upper[i][0], c.upper[i][1]);
    s.lineTo(FIESTA_DOOR.rear, upperAt(FIESTA_DOOR.rear));
  }
  s.closePath();
  return s;
}

/** A shape in (z, y) extruded `depth` along x, centred on `x`. */
function extrudeZY(shape, depth, x, mat, parent, name) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 14 });
  geo.rotateY(-Math.PI / 2);
  geo.translate(x + depth / 2, 0, 0);
  return add(geo, mat, parent, name);
}

/** A strip of skin `t` thick under the upper line from z0 back to z1, `width` across, for the bonnet. */
function skin(z0, z1, t, width, mat, parent) {
  const s = new THREE.Shape();
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    if (i === 0) s.moveTo(z, upperAt(z));
    else s.lineTo(z, upperAt(z));
  }
  for (let i = n; i >= 0; i--) {
    const z = z0 + ((z1 - z0) * i) / n;
    s.lineTo(z, upperAt(z) - t);
  }
  s.closePath();
  return extrudeZY(s, width, 0, mat, parent);
}

/** A flat quad through four points, its two triangles facing whichever way the corners wind. */
function quadMesh(a, b, c2, d, mat, parent) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c2, ...a, ...c2, ...d], 3));
  g.computeVertexNormals();
  return add(g, mat, parent);
}

// Materials, made once --------------------------------------------------------------------

const PAL = {
  rubber: new THREE.MeshStandardMaterial({ color: 0x1a1a19, roughness: 0.95 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1b1c1d, roughness: 0.7 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.22, metalness: 0.9 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.5, metalness: 0.6 }),
  under: new THREE.MeshStandardMaterial({ color: 0x18191a, roughness: 0.9 }),
  glass: markGlass(new THREE.MeshStandardMaterial({ color: 0x9fb3b8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })),
  amber: new THREE.MeshStandardMaterial({ color: 0x5c2c08, roughness: 0.25 }), // dark until it flashes (addSignalLamps)
  smoke: new THREE.MeshStandardMaterial({ color: 0x4d5254, roughness: 0.2 }), // the reverse lens, smoked until it lights
  fog: new THREE.MeshStandardMaterial({ color: 0x5a110d, roughness: 0.2 }),
  rust: new THREE.MeshStandardMaterial({ color: 0x4b3a2e, roughness: 0.7, metalness: 0.5 }),
  grille: new THREE.MeshStandardMaterial({ color: 0x1d1e20, roughness: 0.5 }),
  strap: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.9 }),
};

/** The inside: brown vinyl with check cloth, the 70s way (Jamie), made when a Fiesta is built (they need a canvas). */
function trimMaterials() {
  const grain = (g, w, h, rand, n = 900) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = rand() > 0.5 ? 'rgba(255,230,200,0.07)' : 'rgba(20,8,2,0.2)';
      g.fillRect(rand() * w, rand() * h, 1.6, 1.6);
    }
  };
  // Brown vinyl: a pebbled grain with a horizontal pleat seam across it every 16 pixels.
  const vinylTex = canvasTexture(128, 128, (g, w, h) => {
    const rand = seeded(5);
    g.fillStyle = '#4a2a1a';
    g.fillRect(0, 0, w, h);
    grain(g, w, h, rand, 1400);
    g.strokeStyle = 'rgba(15,6,2,0.55)';
    g.lineWidth = 2.2;
    for (let y = 0; y < h; y += 32) {
      g.beginPath();
      g.moveTo(0, y + 2);
      g.lineTo(w, y + 2);
      g.stroke();
      g.strokeStyle = 'rgba(210,170,130,0.22)'; // the highlight under each seam
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, y + 5);
      g.lineTo(w, y + 5);
      g.stroke();
      g.strokeStyle = 'rgba(15,6,2,0.55)';
      g.lineWidth = 2.2;
    }
  });
  // Check cloth: a tan and brown dogtooth check, as the centre panels of the seats.
  const checkTex = canvasTexture(128, 128, (g, w, h) => {
    const rand = seeded(9);
    g.fillStyle = '#7c5a3a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#a58a62';
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) if (((x + y) / 16) % 2 === 0) g.fillRect(x, y, 16, 16);
    g.fillStyle = 'rgba(40,24,12,0.35)';
    for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 1);
    for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 1, h);
    grain(g, w, h, rand, 1200);
  }, { repeat: [2, 2] });
  const carpetTex = canvasTexture(64, 64, (g, w, h) => {
    const rand = seeded(3);
    g.fillStyle = '#5a4128';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = rand() > 0.5 ? 'rgba(255,230,190,0.08)' : 'rgba(0,0,0,0.28)';
      g.fillRect(rand() * w, rand() * h, 1, 1);
    }
  }, { repeat: [4, 4] });
  return {
    vinyl: new THREE.MeshStandardMaterial({ map: vinylTex, roughness: 0.5 }),
    cloth: new THREE.MeshStandardMaterial({ map: checkTex, roughness: 0.95 }),
    floor: new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 1 }),
    dash: new THREE.MeshStandardMaterial({ color: 0x1f1c1a, roughness: 0.75 }), // the black PVC moulding
    card: new THREE.MeshStandardMaterial({ color: 0x4a2c1c, roughness: 0.7 }), // the door cards, brown to match
    lining: new THREE.MeshStandardMaterial({ color: 0xcdbf9f, roughness: 0.95, side: THREE.DoubleSide }), // the headlining
    shelf: new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.95 }), // the parcel shelf's hardboard, brown felt
    trim: new THREE.MeshStandardMaterial({ color: 0x2b2522, roughness: 0.8 }), // the boot's side trim
  };
}

// Wheels -------------------------------------------------------------------------------

function buildWheel(w, rimMat) {
  const side = Math.sign(w.x);
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  const rimR = 0.152;
  spin.add(new THREE.Mesh(treadTyre('road', { radius: c.R, width: FIESTA_TYRE_W, rimR, segments: 36 }), PAL.rubber));
  // The Mk1's pressed steel wheel: silver, with its slots round the face and a small cap in the middle (detail/roadWheels.js).
  // The kit's wheel is built for the +x side (its lathed face faces the wrong way mirrored: the driver's wheels showed their dished faces black), so the
  // driver's side is the same wheel turned half a turn about the vertical.
  const face = buildRoadWheel('slots', { rimR: rimR - 0.004, width: FIESTA_TYRE_W - 0.02, side: 1, nuts: 4, mats: { rim: rimMat, steel: PAL.chrome } });
  if (side < 0) face.rotation.y = Math.PI;
  spin.add(face);
  // The hub: a raised boss in the middle of the face (a ring of darker steel) with a small domed chrome cap on it, inside the ring of nuts, as the Mk1's.
  axleCyl(0.056, 0.022, PAL.steel, side * (FIESTA_TYRE_W / 2 + 0.003), 0, 0, spin);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1), PAL.chrome);
  dome.rotation.z = -side * Math.PI / 2;
  dome.position.x = side * (FIESTA_TYRE_W / 2 + 0.014);
  spin.add(dome);
  // The inside of the wheel: a pressed steel disc across the barrel on the inner side with the hub standing out of it, so it is not hollow from behind.
  axleCyl(rimR - 0.006, 0.012, PAL.steel, -side * (FIESTA_TYRE_W / 2 - 0.045), 0, 0, spin);
  axleCyl(0.05, 0.05, PAL.steel, -side * (FIESTA_TYRE_W / 2 - 0.06), 0, 0, spin);
  wheel.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  mergeStatic(wheel);
  return wheel;
}

// The car -------------------------------------------------------------------------------

export function buildFiestaModel({ bodyColor = 0x7a4f30, reg = null } = {}) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45, side: THREE.DoubleSide });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x3a0a07, roughness: 0.25, emissive: 0x000000 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb4b8bb, roughness: 0.4, metalness: 0.5 });
  const trim = trimMaterials();
  const webbing = webbingMaterial();
  const layoutWheels = fiestaWheels();

  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  quad.userData.seatMaterial = trim.vinyl;
  quad.userData.steerGain = 6; // about three and a half turns lock to lock
  quad.userData.liveMaterials = [];
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const bodyRoot = new THREE.Group();
  bodyRoot.name = 'bodyRoot';
  body.add(bodyRoot);
  const root = new THREE.Group(); // everything but the wheels, raised on them (FIESTA_RIDE_LIFT)
  root.position.y = FIESTA_RIDE_LIFT;
  bodyRoot.add(root);

  addBody();
  addDoors();
  addGlasshouse();
  addHatch();
  addFrontEnd();
  addRear();
  addInterior();
  addControls();
  addAnchors();

  // The body sides: the wing in front of the door and the quarter behind it (the door is its own group, below), the black sill moulding between,
  // the arches' liners and the inner wings so you cannot see through them, the engine, mudflaps and the fuel flap.
  function addBody() {
    for (const s of [-1, 1]) {
      extrudeZY(sidePiece('front'), 0.035, s * FACE, paint, root, 'wing');
      extrudeZY(sidePiece('rear'), 0.035, s * FACE, paint, root, 'quarter');
      rbox(0.05, 0.108, FIESTA_DOOR.hinge - FIESTA_DOOR.rear + 0.2, 0.01, PAL.black, s * (FACE + 0.003), c.sill + 0.049, (FIESTA_DOOR.hinge + FIESTA_DOOR.rear) / 2, root, 'sill'); // the sill moulding under the door
      const mz0 = FIESTA_DOOR.hinge + 0.02; // the thin black body-side moulding at the door handle's height: on the wing, and on the quarter; the door's own is on the door
      rbox(0.01, 0.022, c.nose - 0.12 - mz0, 0.006, PAL.black, s * (OUT + 0.004), 0.62, (c.nose - 0.12 + mz0) / 2, root);
      rbox(0.01, 0.022, FIESTA_DOOR.rear - 0.02 - (c.tail + 0.1), 0.006, PAL.black, s * (OUT + 0.004), 0.62, (FIESTA_DOOR.rear - 0.02 + c.tail + 0.1) / 2, root);
      rbox(0.012, 0.025, 0.06, 0.008, PAL.amber, s * (OUT + 0.004), upperAt(zs + 0.45) - 0.12, zs + 0.45, root); // the indicator repeater on the wing
      for (const zc of [zF, -zF]) {
        const liner = add(new THREE.CylinderGeometry(ARCH.r - 0.008, ARCH.r - 0.008, 0.24, 16, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95, side: THREE.DoubleSide }), root);
        liner.position.set(s * (W / 2 - 0.15), ARCH.y, zc);
        rbox(0.26, 0.04, 0.7, 0.01, PAL.under, s * (W / 2 - 0.15), ARCH.y + ARCH.r + 0.01, zc, root); // the arch's roof
        rbox(0.2, 0.26, 0.018, 0.005, PAL.rubber, s * c.track / 2, 0.17, zc - 0.36, root); // a mudflap behind each wheel
      }
      rbox(0.03, 0.5, 1.0, 0.01, PAL.under, s * (c.track / 2 - FIESTA_TYRE_W / 2 - 0.05), 0.48, (zs + c.nose) / 2 - 0.05, root); // the inner wing
      rbox(0.03, 0.4, 0.75, 0.01, PAL.under, s * (c.track / 2 - FIESTA_TYRE_W / 2 - 0.05), 0.5, -zF, root);
    }
    rbox(0.55, 0.4, 0.5, 0.05, PAL.steel, 0, 0.5, zF - 0.05, root); // the engine, across the car
    rbox(0.004, 0.11, 0.15, 0.004, PAL.black, -(OUT + 0.005), 0.5, -1.32, root); // the fuel flap's outline on the right (-x) rear quarter
  }

  // Each door: a group on its front hinge, the lower panel with its handle, the window and its frame, the mirror, the card inside. Local z runs
  // back from the hinge, so a door opens by turning about y.
  function addDoors() {
    const D = FIESTA_DOOR;
    const len = D.hinge - D.rear;
    const lz = (z) => z - D.hinge; // a car z to the door's own
    for (const s of [-1, 1]) {
      const d = new THREE.Group();
      d.name = s > 0 ? 'doorLeft' : 'doorRight';
      d.userData.keep = true;
      d.position.set(s * FACE, 0, D.hinge);
      d.userData.mudRest = [s * FACE, 0, D.hinge]; // the dirt on it goes with it
      // The lower panel: from the hinge to the rear edge, between the door's bottom and the top of the side line.
      const panel = new THREE.Shape();
      panel.moveTo(0, D.bottom);
      panel.lineTo(-len, D.bottom);
      panel.lineTo(-len, upperAt(D.rear));
      panel.lineTo(0, upperAt(D.hinge));
      panel.closePath();
      extrudeZY(panel, 0.035, 0, paint, d, 'doorPanel');
      rbox(0.012, 0.02, len - 0.04, 0.006, PAL.chrome, 0.0235 * s, ys - 0.02, -len / 2, d); // the chrome strip along the window's sill (beltline)
      rbox(0.014, 0.03, 0.12, 0.007, PAL.chrome, s * 0.0245, ys - 0.1, lz(D.rear) + 0.14, d, 'doorHandle'); // the pull handle at the back
      rbox(0.014, 0.02, 0.05, 0.006, PAL.chrome, s * 0.0245, ys - 0.15, lz(D.rear) + 0.03, d); // the lock
      rbox(0.01, 0.022, len - 0.06, 0.006, PAL.black, s * 0.0225, 0.62, -len / 2, d); // the thin black moulding along the door, on the door so it swings with it
      for (const z of [-0.003, -len + 0.003]) rbox(0.006, upperAt(D.rear) - D.bottom - 0.01, 0.005, 0.002, PAL.black, s * 0.0205, (D.bottom + upperAt(D.rear)) / 2, z, d); // the shut lines at the door's two edges
      // The window: a glass in a rubber surround, leaning in as the glasshouse does, between the A pillar's line and the door's rear edge.
      const win = new THREE.Group();
      const x0 = s * (halfAt(ys) - 0.01) - s * FACE; // the glass's foot, relative to the door's middle
      win.position.set(x0, ys, 0);
      win.rotation.z = s * Math.atan(c.tumble);
      const glass = new THREE.Shape();
      glass.moveTo(0, 0);
      glass.lineTo(zt - D.hinge, yt - ys);
      glass.lineTo(-len, yt - ys);
      glass.lineTo(-len, 0);
      glass.closePath();
      add(new THREE.ShapeGeometry(glass).rotateY(-Math.PI / 2), PAL.glass, win);
      d.add(win);
      // The door's own frame in black rubber round the glass's rear and bottom (the A pillar and the roof rail are the body's).
      // The frame, in the window's own (leaning) frame: a steel upright up the raked front edge, the top rail and the rear upright, round the whole glass.
      const fr = (a, b) => post([0, ...a], [0, ...b], 0.032, 0.03, paint, win);
      fr([0, 0], [yt - ys, zt - D.hinge]); // the front upright (where the tube was: it goes up the A pillar's line)
      fr([yt - ys + 0.005, zt - D.hinge], [yt - ys + 0.005, -len]); // the top rail
      fr([0, -len + 0.015], [yt - ys, -len + 0.015]); // the rear upright
      rbox(0.026, 0.026, len - 0.02, 0.01, PAL.black, x0 + s * 0.003, ys + 0.008, -len / 2, d); // the seal along the glass's foot
      // The mirror: a square chrome housing on a short arm at the front top corner of the door, on the door (so it swings with it).
      const mirror = new THREE.Group();
      mirror.name = 'mirror';
      mirror.userData.keep = true;
      mirror.position.set(s * 0.045, ys + 0.1, -0.1);
      rbox(0.07, 0.03, 0.05, 0.01, PAL.black, s * 0.0, 0.0, 0.0, mirror); // its foot on the door
      rbox(0.12, 0.085, 0.05, 0.015, PAL.chrome, s * 0.08, 0.05, -0.02, mirror); // the housing
      rbox(0.105, 0.07, 0.004, 0.003, PAL.glass, s * 0.08, 0.05, -0.0475, mirror, 'mirrorGlass'); // and its glass, facing back
      d.add(mirror);
      // The card on the inside: brown vinyl with the arm rest and its pull, a map pocket under, the winder and the lock button.
      const inside = -s * 0.03;
      rbox(0.02, upperAt(D.rear) - D.bottom - 0.05, len - 0.1, 0.01, trim.card, inside, (D.bottom + upperAt(D.rear)) / 2 - 0.01, -len / 2, d);
      rbox(0.05, 0.05, len - 0.3, 0.02, trim.card, inside - s * 0.02, ys - 0.2, -len / 2 - 0.02, d); // the arm rest along the top
      tube([inside - s * 0.03, ys - 0.28, -0.5], [inside - s * 0.03, ys - 0.28, -0.3], 0.012, PAL.black, d, 6); // the pull handle's bar, set in the arm rest
      rbox(0.04, 0.12, 0.38, 0.015, PAL.black, inside - s * 0.018, D.bottom + 0.14, -len / 2 - 0.02, d); // the map pocket
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6).rotateZ(Math.PI / 2), PAL.chrome, d).position.set(inside - s * 0.04, ys - 0.12, lz(D.rear) + 0.32); // the window winder's shaft...
      add(new THREE.SphereGeometry(0.018, 8, 6), PAL.black, d).position.set(inside - s * 0.07, ys - 0.12, lz(D.rear) + 0.32); // ...its knob
      rbox(0.012, 0.03, 0.012, 0.004, PAL.chrome, inside, ys + 0.015, lz(D.rear) + 0.1, d); // the lock button on the sill
      root.add(d);
    }
  }

  // The pillars, the rails, the windscreen, the roof and the rear quarter windows. The side glass in front of the B pillar is the doors'.
  function addGlasshouse() {
    const pr = 0.035;
    for (const s of [-1, 1]) {
      tube([s * halfAt(ys), ys, zs], [s * halfAt(yt), yt, zt], pr, paint, root, 8); // the A pillar
      tube([s * halfAt(ys), ys, c.bPillar], [s * halfAt(yt), yt - 0.01, c.bPillar], 0.04, paint, root, 6); // the B pillar
      tube([s * halfAt(yt), yt, zt], [s * halfAt(yr), yr, zr], pr, paint, root, 8); // the rail over the windows
      tube([s * halfAt(yr), yr, zr], [s * halfAt(yh), yh, zh], pr + 0.005, paint, root, 8); // the hatch's edge
      // The rear quarter: the fixed glass between the B pillar and the slanted C pillar, and the C pillar's painted panel behind it.
      const lean = (shape, inset, mat, name) => {
        const g = new THREE.Group();
        g.position.set(s * (halfAt(ys) - inset), ys, 0);
        g.rotation.z = s * Math.atan(c.tumble);
        add(new THREE.ShapeGeometry(shape).rotateY(-Math.PI / 2).translate(0, -ys, 0), mat, g, name);
        root.add(g);
      };
      const glass = new THREE.Shape();
      glass.moveTo(c.bPillar - 0.03, ys);
      glass.lineTo(c.bPillar - 0.03, yr - 0.03);
      glass.lineTo(zr + 0.02, yr - 0.03);
      glass.lineTo(-1.36, ys);
      glass.closePath();
      lean(glass, 0.01, PAL.glass, 'quarterGlass');
      const cp = new THREE.Shape();
      cp.moveTo(zr + 0.02, yr);
      cp.lineTo(zr - 0.04, yr);
      cp.lineTo(zh, yh);
      cp.lineTo(zh, ys);
      cp.lineTo(-1.36, ys);
      cp.lineTo(zr + 0.02, yr - 0.03);
      cp.closePath();
      lean(cp, -0.006, paint, 'cPillar');
      rbox(0.03, 0.025, c.bPillar - zh, 0.01, PAL.black, s * (halfAt(ys) + 0.005), ys + 0.01, (c.bPillar + zh) / 2, root); // the quarter's seal along its foot
    }
    // The windscreen in its thick black rubber, the roof, the headlining and the sun visors.
    quadMesh([-halfAt(ys), ys, zs], [halfAt(ys), ys, zs], [halfAt(yt), yt, zt], [-halfAt(yt), yt, zt], PAL.glass, root);
    tube([-halfAt(ys), ys, zs], [halfAt(ys), ys, zs], 0.03, PAL.black, root, 6); // the screen's bottom seal
    tube([-halfAt(yt), yt, zt], [halfAt(yt), yt, zt], 0.03, paint, root, 6); // and its top rail
    const roofW = 2 * halfAt(yt) + 0.06;
    const roofLen = Math.hypot(zt - zr, yt - yr);
    const arc = new THREE.Shape();
    arc.moveTo(-roofW / 2, 0);
    arc.quadraticCurveTo(0, 0.05, roofW / 2, 0);
    arc.lineTo(roofW / 2, -0.03);
    arc.quadraticCurveTo(0, 0.02, -roofW / 2, -0.03);
    arc.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(arc, { depth: roofLen + 0.06, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -(roofLen + 0.06) / 2);
    const roof = add(roofGeo, paint, root, 'roof');
    roof.position.set(0, (yt + yr) / 2 + 0.015, (zt + zr) / 2);
    roof.rotation.x = Math.atan2(yt - yr, zt - zr) * -1;
    const lining = rbox(roofW - 0.12, 0.012, roofLen - 0.1, 0.005, trim.lining, 0, (yt + yr) / 2 - 0.012, (zt + zr) / 2, root); // the headlining
    lining.rotation.x = roof.rotation.x;
    for (const x of [-0.42, 0.42]) { // the sun visors, pale boards against the headlining over the screen
      rbox(0.36, 0.015, 0.2, 0.006, trim.lining, x, yt - 0.03, zt - 0.14, root);
    }
    // The wipers: the kit's, parked along the foot of the screen, their spindles in the scuttle below the glass.
    for (const [x, ang] of [[-0.45, 0.06], [0.08, 0.06]]) {
      const wiper = buildWiper({ len: 0.5, mats: { arm: PAL.black } });
      wiper.position.set(x, ys + 0.022, zs + 0.03);
      wiper.rotation.set(-Math.atan2(yt - ys, zs - zt), 0, ang);
      wiper.rotation.order = 'YXZ';
      root.add(markWiper(wiper, 1.85)); // sweeping up from the foot of the screen, past upright (#103)
    }
    addRainGlassBetween(root, { foot: [zs, ys], top: [zt, yt], halfFoot: halfAt(ys), halfTop: halfAt(yt) }); // where the rain lands on it
    // The rear-view mirror at the top of the screen, in the middle, on its stem from the header.
    rbox(0.2, 0.06, 0.02, 0.01, PAL.black, 0, yt - 0.15, zt - 0.06, root, 'mirrorGlass');
    tube([0, yt - 0.01, zt - 0.03], [0, yt - 0.12, zt - 0.06], 0.008, PAL.black, root, 5);
  }

  // The hatch: a group hinged along the roof's rear edge (the origin is the hinge), the glass in its black rubber, the deck below it and the tail panel
  // down to the cargo sill, the lock, the rear wiper and the plate; two gas struts joining it to the body.
  function addHatch() {
    const H = FIESTA_HATCH;
    const hatch = new THREE.Group();
    hatch.name = 'hatch';
    hatch.userData.keep = true;
    hatch.position.set(0, yr, zr);
    hatch.userData.mudRest = [0, yr, zr];
    const hz = (z) => z - zr; // car z to the hatch's own
    const hy = (y) => y - yr;
    const half = halfAt(yh) - 0.02;
    // The glass: from the roof's edge down to hatchBottom, in a black rubber frame.
    quadMesh([-halfAt(yr) + 0.02, 0, 0], [halfAt(yr) - 0.02, 0, 0], [half, hy(yh), hz(zh)], [-half, hy(yh), hz(zh)], PAL.glass, hatch);
    const edge = (a, b, r = 0.016) => tube(a, b, r, PAL.black, hatch, 6);
    edge([-halfAt(yr) + 0.02, 0, 0], [halfAt(yr) - 0.02, 0, 0]);
    edge([-half, hy(yh), hz(zh)], [half, hy(yh), hz(zh)]);
    edge([-halfAt(yr) + 0.02, 0, 0], [-half, hy(yh), hz(zh)]);
    edge([halfAt(yr) - 0.02, 0, 0], [half, hy(yh), hz(zh)]);
    // The deck below the glass and the tail panel down to the sill.
    const deckW = W - 2 * FIESTA_HATCH.inset - 0.02 + 0.04; // spans to the quarters' inner faces (0.7475 each side), with no slot where the boot trim showed
    const deck = new THREE.Shape();
    deck.moveTo(hz(zh), hy(yh));
    deck.lineTo(hz(c.tail + 0.02), hy(upperAt(c.tail + 0.02)));
    deck.lineTo(hz(c.tail + 0.02), hy(upperAt(c.tail + 0.02)) - 0.03);
    deck.lineTo(hz(zh), hy(yh) - 0.03);
    deck.closePath();
    extrudeZY(deck, deckW, 0, paint, hatch);
    const tailTop = upperAt(c.tail);
    rbox(deckW, tailTop - H.foot, 0.04, 0.02, paint, 0, hy((tailTop + H.foot) / 2), hz(c.tail + 0.02), hatch);
    rbox(deckW - 0.1, 0.04, 0.012, 0.006, PAL.black, 0, hy(H.foot + 0.03), hz(c.tail) - 0.0, hatch); // a panel line over the sill
    // The tail lamps, small and in the hatch's lower corners so they lift with it: a black housing, the stop and tail lens over the indicator and the
    // reverse (or fog) lens, all inside the hatch's width.
    const L = FIESTA_TAIL_LAMP;
    for (const sd of [-1, 1]) {
      const ly = hy((L.y0 + L.y1) / 2);
      rbox(L.w, L.y1 - L.y0, 0.02, 0.008, PAL.black, sd * L.x, ly, hz(c.tail) - 0.01, hatch, 'tailLampBody');
      rbox(L.w - 0.02, (L.y1 - L.y0) * 0.5, 0.012, 0.006, tailMat, sd * L.x, ly + (L.y1 - L.y0) * 0.2, hz(c.tail) - 0.026, hatch);
      rbox((L.w - 0.02) * 0.5, (L.y1 - L.y0) * 0.36, 0.012, 0.006, PAL.amber, sd * (L.x + (L.w - 0.02) * 0.25), ly - (L.y1 - L.y0) * 0.25, hz(c.tail) - 0.026, hatch);
      rbox((L.w - 0.02) * 0.5, (L.y1 - L.y0) * 0.36, 0.012, 0.006, sd > 0 ? PAL.smoke : PAL.fog, sd * (L.x - (L.w - 0.02) * 0.25), ly - (L.y1 - L.y0) * 0.25, hz(c.tail) - 0.026, hatch);
    }
    rbox(0.18, 0.03, 0.025, 0.008, PAL.chrome, 0, hy(0.74), hz(c.tail) - 0.012, hatch, 'hatchHandle'); // the pull
    // The lining inside it: a brown board with a handle strap.
    rbox(deckW - 0.1, tailTop - H.foot - 0.06, 0.012, 0.005, trim.trim, 0, hy((tailTop + H.foot) / 2), hz(c.tail + 0.045), hatch);
    // The rear wiper on the glass, spindle at its foot in the middle.
    const rw = buildWiper({ len: 0.34, mats: { arm: PAL.black } });
    const lean = Math.atan2(zh - zr, yr - yh); // the glass's lean from upright, back and down
    rw.position.set(0, hy(yh) + 0.05, hz(zh) + 0.05);
    rw.rotation.set(-Math.PI / 2 + lean, 0, 0.08);
    rw.rotation.order = 'YXZ';
    hatch.add(rw);
    // The number plate on the tail panel below the glass (white at the front, yellow at the back: a 1979 car).
    plate(reg ?? c.plate, '#e8c51c', hatch, { x: 0, y: hy(0.6), z: hz(c.tail) - 0.0125, facing: -1 });
    root.add(hatch);
    // The struts: a body end low on each C pillar's inside, aimed at a hatch end on its frame (stretched and turned by poseFiestaHatch).
    for (const s of [-1, 1]) {
      const strut = new THREE.Group();
      strut.name = s > 0 ? 'hatchStrutLeft' : 'hatchStrutRight';
      strut.userData.keep = true;
      strut.position.set(s * (halfAt(1.0) - 0.04), 1.0, -1.38); // on the C pillar panel's inside, low
      strut.userData.hatchEnd = [s * (halfAt(1.12) - 0.045), 1.12 - yr, -0.23]; // on the hatch's glass frame a third of the way down it (the hatch's own frame), so the strut stretches as the hatch lifts
      add(new THREE.CylinderGeometry(0.009, 0.009, 1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5), PAL.chrome, strut);
      add(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 6).rotateX(Math.PI / 2).translate(0, 0, 0.06), PAL.steel, strut); // the cylinder end, a fixed length
      root.add(strut);
    }
    poseFiestaHatch(quad, 0);
  }

  // The nose: the bonnet with its slot vents at the screen, the front panel, a black slatted grille between two rectangular headlamps with their
  // indicators under, the black and chrome bumper, the plate and Amy's L plate.
  function addFrontEnd() {
    skin(c.nose, zs, 0.035, W - 0.06, paint, root);
    for (const x of [-0.45, 0.45]) rbox(0.22, 0.005, 0.1, 0.002, PAL.black, x, upperAt(zs + 0.12) + 0.001, zs + 0.12, root); // the slot vents at the bonnet's rear edge, a dark panel with ribs standing out of it
    for (const x of [-0.45, 0.45]) for (let i = 0; i < 4; i++) rbox(0.2, 0.004, 0.008, 0.002, PAL.grille, x, upperAt(zs + 0.12) + 0.0045, zs + 0.085 + i * 0.025, root);
    rbox(W - 0.06, 0.03, 0.03, 0.01, PAL.under, 0, ys - 0.04, zs + 0.02, root); // the scuttle panel at the foot of the screen
    const noseTop = upperAt(c.nose);
    rbox(W - 0.04, noseTop - NOSE_LOW, 0.04, 0.02, paint, 0, (noseTop + NOSE_LOW) / 2, c.nose - 0.025, root); // the front panel (its face 5 mm behind the bonnet's end, so they share none)
    // The grille: a wide black panel with horizontal slats and the maker's oval on it (Thorne, not a real maker's), between the lamps.
    rbox(0.74, 0.19, 0.03, 0.01, PAL.grille, 0, 0.58, c.nose + 0.006, root);
    for (let i = 0; i < 6; i++) rbox(0.7, 0.012, 0.02, 0.004, PAL.black, 0, 0.51 + i * 0.031, c.nose + 0.024, root);
    const oval = label(0.08, 0.04, 800, (g, Wd, H) => {
      g.fillStyle = '#16346a';
      g.beginPath();
      g.ellipse(Wd / 2, H / 2, Wd / 2, H / 2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f4f4f4';
      fitText(g, 'Thorne', Wd / 2, H / 2 + H * 0.04, H * 0.46, Wd * 0.8);
    }, root);
    oval.position.set(-0.18, 0.605, c.nose + 0.0375);
    for (const s of [-1, 1]) {
      rbox(0.28, 0.17, 0.036, 0.01, PAL.black, s * 0.55, 0.585, c.nose + 0.008, root); // the headlamp's housing
      add(new THREE.PlaneGeometry(0.25, 0.14), lensMat, root).position.set(s * 0.55, 0.585, c.nose + 0.022);
      rbox(0.27, 0.05, 0.03, 0.01, PAL.amber, s * 0.55, 0.465, c.nose + 0.005, root); // the indicator below it, wrapping the corner
      rbox(0.08, 0.05, 0.1, 0.02, PAL.amber, s * (W / 2 - 0.03), 0.47, c.nose - 0.06, root); // ...round the side
    }
    // The bumper: a black blade with a chrome strip along its top and another under, the number plate in front of the valance below it.
    rbox(W + 0.04, 0.11, 0.1, 0.03, PAL.black, 0, 0.36, c.nose + 0.04, root);
    rbox(W + 0.04, 0.025, 0.012, 0.006, PAL.chrome, 0, 0.408, c.nose + 0.093, root);
    rbox(W + 0.04, 0.015, 0.012, 0.004, PAL.chrome, 0, 0.312, c.nose + 0.093, root);
    plate(reg ?? c.plate, '#ece9de', root, { x: 0, y: 0.355, z: c.nose + 0.0955, facing: 1 });
    // Amy's L plate, taped on the bumper beside the number plate.
    const lp = buildLPlate();
    lp.visible = true;
    lp.position.set(-0.42, 0.37, c.nose + 0.1);
    lp.userData.keep = true;
    root.add(lp);
  }

  // The tail: the tail lamps in the body's corners either side of the hatch, the black bumper with its chrome ends, the cargo sill with its seal,
  // the L plate, the exhaust.
  function addRear() {
    rbox(W + 0.04, 0.11, 0.1, 0.03, PAL.black, 0, 0.36, c.tail - 0.04, root); // the bumper
    for (const s of [-1, 1]) rbox(0.18, 0.1, 0.014, 0.005, PAL.chrome, s * (W / 2 - 0.1), 0.36, c.tail - 0.092, root); // its chrome ends
    rbox(W - 0.5, 0.5 - 0.38, 0.04, 0.02, paint, 0, 0.44, c.tail + 0.02, root); // the rear valance between the bumper and the hatch's foot, over the bumper
    rbox(W - 0.5, 0.03, 0.05, 0.01, PAL.black, 0, FIESTA_HATCH.foot - 0.02, c.tail + 0.01, root); // the cargo sill's rubber seal
    const lp = buildLPlate();
    lp.visible = true;
    lp.position.set(0.42, 0.37, c.tail - 0.1);
    lp.rotation.y = Math.PI;
    lp.userData.keep = true;
    root.add(lp);
    tube([-0.4, 0.22, -0.6], [-0.45, 0.22, c.tail - 0.06], 0.022, PAL.rust, root, 6); // the exhaust, a plain pipe under the back
  }

  function frontSeat(name, seat) {
    // The cushion: a vinyl base with a check-cloth cover on its top, vinyl bolsters, a frame and runners; the back: a high vinyl shell with a check inset,
    // a pivot at the base so it tips forward (seatBack_<name>).
    rbox(0.46, 0.1, 0.46, 0.04, trim.vinyl, seat.x, seat.y - 0.08, seat.z + 0.12, root); // the cushion's vinyl base
    rbox(0.3, 0.02, 0.4, 0.008, trim.cloth, seat.x, seat.y - 0.025, seat.z + 0.12, root); // its check cover, proud of the top
    for (const sx of [-1, 1]) rbox(0.07, 0.07, 0.44, 0.03, trim.vinyl, seat.x + sx * 0.2, seat.y - 0.04, seat.z + 0.12, root); // the bolsters
    rbox(0.4, 0.2, 0.36, 0.02, PAL.under, seat.x, seat.y - 0.24, seat.z + 0.1, root); // its frame and runners
    const pivot = new THREE.Group();
    pivot.name = `seatBack_${name}`;
    pivot.userData.keep = true;
    pivot.position.set(seat.x, seat.y - 0.04, seat.z - 0.13);
    const lean = new THREE.Group();
    lean.rotation.x = -0.22; // reclined a little
    rbox(0.46, 0.5, 0.1, 0.04, trim.vinyl, 0, 0.25, -0.03, lean); // the shell: 0.5 tall (it was 0.68, too high against the roof)
    rbox(0.3, 0.36, 0.08, 0.01, trim.cloth, 0, 0.24, -0.01, lean); // the check inset, on the front
    for (const sx of [-1, 1]) rbox(0.07, 0.36, 0.13, 0.03, trim.vinyl, sx * 0.2, 0.22, 0.0, lean); // the side bolsters
    pivot.add(lean);
    root.add(pivot);
  }

  // The floor, the bulkhead, the arch humps, the door cards' place, the dash with its cluster, the console with its radio, the seats and the boot.
  function addInterior() {
    // The floor: the full width under the seats and the pedals (to z -0.75, in front of the rear wheels), then only 1.1 m between the rear tyres.
    rbox(W - 0.1, 0.03, zs - 0.1 + 0.75, 0.01, trim.floor, 0, 0.26, (zs - 0.1 - 0.75) / 2, root);
    rbox(1.12, 0.03, -0.75 - c.tail - 0.1, 0.01, trim.floor, 0, 0.26, (-0.75 + c.tail + 0.1) / 2, root);
    rbox(W - 0.1, 0.5, 0.04, 0.01, PAL.under, 0, 0.5, zs - 0.06, root); // the bulkhead
    rbox(0.16, 0.12, zs - 0.1 - (c.seats.driver.z - 0.2), 0.04, trim.floor, 0, 0.32, (zs - 0.1 + c.seats.driver.z - 0.2) / 2, root); // the low tunnel
    for (const s of [-1, 1]) {
      rbox(0.08, 0.3, 0.7, 0.03, trim.trim, s * 0.5, 0.42, -zF, root); // the rear arch inside, beside the back seat
      rbox(0.03, 0.17, c.bPillar - zh - 0.2, 0.01, trim.card, s * (W / 2 - 0.06), 0.785, (c.bPillar + zh) / 2 - 0.05, root); // the rear quarter trim, above the arch (it was a tall panel the tyre passed through)
    }
    // The dash: the black moulding across under the screen with its long shallow tray on the passenger's half, the binnacle's hood in front of
    // the driver, the face down to the console, vents at its ends.
    const dashTop = ys - 0.02;
    const face = zs - 0.32;
    rbox(W - 0.12, 0.08, 0.32, 0.03, trim.dash, 0, dashTop, zs - 0.17, root);
    rbox(W - 0.12, 0.3, 0.04, 0.02, trim.dash, 0, dashTop - 0.17, face, root); // its face
    rbox(0.78, 0.012, 0.18, 0.005, PAL.black, 0.32, dashTop + 0.046, zs - 0.15, root); // the tray's floor, a dark recess along the top
    rbox(0.78, 0.015, 0.012, 0.005, trim.dash, 0.32, dashTop + 0.052, zs - 0.06, root); // its front lip
    rbox(0.42, 0.04, 0.12, 0.02, trim.dash, c.seats.driver.x, dashTop + 0.07, face - 0.05, root); // the binnacle's hood
    rbox(0.42, 0.2, 0.04, 0.02, trim.dash, c.seats.driver.x, dashTop - 0.03, face - 0.01, root); // its back, round the dials
    const dash = buildDash('fiesta');
    dash.group.position.set(c.seats.driver.x, dashTop - 0.03, face - 0.04);
    dash.group.rotation.x = 0.3;
    dash.group.scale.setScalar(1.5); // the cluster's about 0.36 m wide
    dash.group.userData.keep = true;
    root.add(dash.group);
    quad.userData.dash = dash;
    quad.userData.metalBody = true;
    quad.userData.podMount = null;
    // The centre stack: the console (a black moulding from the dash face down to the tunnel), the cassette radio (the shared piece, in a new style)
    // with the bank of rocker switches under it, two heater sliders under those.
    rbox(0.24, 0.26, 0.1, 0.02, trim.dash, 0, 0.43, face - 0.04, root); // the centre stack under the face, a slim panel running down to the tunnel (it was a big block 26 cm deep behind the gear lever)
    const radio = buildRadio('cassette', { w: 0.18, h: 0.05 });
    radio.position.set(0, dashTop - 0.12, face - 0.0225);
    radio.rotation.y = Math.PI;
    root.add(radio);
    quad.userData.liveMaterials.push(radio.userData.faceMaterial);
    const rockers = {};
    const rocker = (x, y, name = null) => {
      rbox(0.04, 0.03, 0.006, 0.002, PAL.black, x, y, face - 0.022, root);
      if (!name) {
        rbox(0.03, 0.024, 0.012, 0.003, PAL.steel, x, y, face - 0.03, root).rotation.x = -0.12;
        return;
      }
      const g = new THREE.Group();
      g.name = name;
      g.userData.keep = true;
      g.position.set(x, y, face - 0.03);
      add(new THREE.BoxGeometry(0.03, 0.024, 0.012), PAL.steel, g);
      root.add(g);
      rockers[name] = g;
    };
    const rockY = dashTop - 0.2;
    [-0.075, -0.025, 0.025, 0.075].forEach((x, i) => rocker(x, rockY, i === 3 ? 'rockerRadio' : null)); // fog, heated rear screen, fan: for show; the last is the radio's
    const hz = addHazardSwitch(root, -0.125, rockY, face - 0.026, { plate: false, w: 0.03, h: 0.024 }); // the hazard rocker, first on the bank
    hz.rotation.y = Math.PI;
    for (const x of [-0.07, 0.0, 0.07]) rbox(0.012, 0.03, 0.01, 0.003, PAL.steel, x, dashTop - 0.255, face - 0.025, root); // the heater's sliders
    for (const s of [-1, 1]) {
      rbox(0.12, 0.05, 0.02, 0.01, PAL.black, s * 0.55, dashTop - 0.06, face - 0.025, root); // the vents at the ends
      for (let i = 0; i < 4; i++) rbox(0.1, 0.004, 0.006, 0.002, PAL.under, s * 0.55, dashTop - 0.075 + i * 0.012, face - 0.036, root);
    }
    const podUpdate = dash.update;
    dash.update = (state) => { // the pod's own update, then the radio and its rocker follow the radio
      podUpdate(state);
      radio.userData.setPower(!!state.radioOn && !!state.ignition);
      const g = rockers.rockerRadio;
      if (g) g.rotation.x += ((state.radioOn ? 0.15 : -0.15) - g.rotation.x) * 0.5;
    };
    // Amy's road atlas, on the rear seat.
    // The atlas: a thin book lying on the shelf with a cover (blue, with its title and a map's lines), its back edge short of the glass.
    const atlas = label(0.22, 0.28, 700, (g, Wd, H) => {
      g.fillStyle = '#1f4f98';
      g.fillRect(0, 0, Wd, H);
      g.fillStyle = '#f2e9b8';
      g.fillRect(Wd * 0.08, H * 0.1, Wd * 0.84, H * 0.3);
      g.fillStyle = '#17306a';
      fitText(g, 'ROAD ATLAS', Wd / 2, H * 0.2, H * 0.1, Wd * 0.74);
      fitText(g, 'OF BRITAIN', Wd / 2, H * 0.31, H * 0.09, Wd * 0.66);
      g.strokeStyle = '#e8d16a';
      g.lineWidth = Math.max(1, Wd * 0.012);
      g.beginPath();
      g.moveTo(Wd * 0.08, H * 0.9);
      g.lineTo(Wd * 0.4, H * 0.62);
      g.lineTo(Wd * 0.62, H * 0.74);
      g.lineTo(Wd * 0.92, H * 0.5);
      g.moveTo(Wd * 0.3, H * 0.95);
      g.lineTo(Wd * 0.55, H * 0.6);
      g.stroke();
    }, root);
    atlas.material.transparent = false; // opaque, and 4 mm above its book's top, so it never fights it or drops out
    atlas.rotation.x = -Math.PI / 2;
    atlas.rotation.z = 0.2;
    const seatTop = c.rear.rearLeft.y - 0.08 + 0.05 + 0.0; // the rear cushion's top (its check cover stands 1 cm on it)
    atlas.position.set(0.3, seatTop + 0.01 + 0.015 + 0.004, -0.98);
    rbox(0.22, 0.015, 0.28, 0.003, PAL.black, 0.3, seatTop + 0.01 + 0.0075, -0.98, root).rotation.y = -0.2; // its pages, lying on the rear seat
    quad.userData.liveMaterials.push(atlas.material); // (the cover is left to the mud coat alone: it stays as drawn)

    for (const [name, seat] of Object.entries(c.seats)) frontSeat(name, seat);
    // The back seat: one bench with a vinyl shell and two check panels in it, and the boot behind it: the carpeted floor, the side trim round the
    // arch humps, the parcel shelf in hardboard.
    const rz = c.rear.rearLeft.z;
    rbox(1.1, 0.1, 0.46, 0.04, trim.vinyl, 0, c.rear.rearLeft.y - 0.08, rz + 0.12, root);
    for (const x of [-0.27, 0.27]) rbox(0.34, 0.02, 0.4, 0.008, trim.cloth, x, c.rear.rearLeft.y - 0.025, rz + 0.12, root);
    rbox(1.1, 0.26, 0.4, 0.02, PAL.under, 0, 0.37, rz + 0.1, root);
    const back = new THREE.Group();
    back.position.set(0, c.rear.rearLeft.y + 0.18, rz - 0.2); // a low back, its top just under the parcel shelf (it was 0.55 tall and went up through it)
    back.rotation.x = -0.18;
    rbox(1.1, 0.4, 0.1, 0.04, trim.vinyl, 0, 0, 0, back);
    for (const x of [-0.27, 0.27]) rbox(0.34, 0.28, 0.08, 0.01, trim.cloth, x, 0.0, 0.012, back);
    root.add(back);
    // (no parcel shelf: it sat above the seat backs; the boot is open to the cabin under the glass)
    rbox(1.46, 0.03, -1.42 - (c.tail + 0.015), 0.01, trim.floor, 0, FIESTA_BOOT.floor, (c.tail + 0.015 - 1.42) / 2, root); // the boot floor, carpet, the width of the boot behind the tyres (their rear edge is at z -1.415): there was a gap either side of it
    rbox(1.42, FIESTA_BOOT.floor - 0.29, -1.42 - (c.tail + 0.015), 0.01, PAL.under, 0, (FIESTA_BOOT.floor + 0.29) / 2, (c.tail + 0.015 - 1.42) / 2, root); // the solid block under it, so nothing underneath shows
    for (const s of [-1, 1]) {
      rbox(0.12, 0.2, 0.6, 0.03, trim.trim, s * 0.49, FIESTA_BOOT.floor + 0.1, -1.18, root); // the arch hump in the boot, inboard of the tyre
      rbox(0.03, 0.3, -1.3 - (c.tail + 0.12), 0.01, trim.trim, s * (W / 2 - 0.1), FIESTA_BOOT.floor + 0.17, (-1.3 + c.tail + 0.12) / 2, root); // the boot's side trim, a panel from the seat back to the tail (the length was a slip that made it a 4 cm post)
    }
    // The belts: the kit's, hanging from the B pillar (front) and the quarter (back) and tucked to a buckle by each seat.
    const outer = W / 2 - 0.1;
    const top = (seat) => halfAt(seat.y + 0.66) - 0.07;
    const post = c.bPillar + 0.04;
    const belt = (name, seat, out, inn, postZ, outTop, topY = seat.y + 0.68, lowOut = out, lowY = seat.y + 0.12) => {
      const lapOnly = false;
      const hip = [seat.x, seat.y - 0.05, seat.z - 0.12];
      root.add(buildSeatBelt(name, { top: [outTop, topY, postZ], low: [lowOut, lowY, postZ], buckle: [inn, seat.y + 0.03, seat.z - 0.08], hip, lapOnly, mats: { webbing } }));
    };
    // The front belts: the loop on the inside of the B pillar (the pillar leans in as it goes up, so x is the glasshouse's half width at the loop's height less
    // the pillar's radius), the reel low on the quarter panel's inner face just behind the door.
    const frontTop = (seat) => halfAt(seat.y + 0.72) - 0.045;
    const reelX = 0.715;
    belt('driver', c.seats.driver, -outer, -0.12, c.bPillar + 0.005, -frontTop(c.seats.driver), c.seats.driver.y + 0.72, -reelX, 0.62);
    belt('left', c.seats.left, outer, 0.12, c.bPillar + 0.005, frontTop(c.seats.left), c.seats.left.y + 0.72, reelX, 0.62);
    // The back belts: the loop on the C pillar's inner face (the panel is about z -1.25 at that height), the reel on the quarter's inner face above the arch.
    const rearTop = (seat) => halfAt(seat.y + 0.6) - 0.03;
    belt('rearLeft', c.rear.rearLeft, outer, 0.1, -1.25, rearTop(c.rear.rearLeft), c.rear.rearLeft.y + 0.6, reelX, 0.74);
    belt('rearRight', c.rear.rearRight, -outer, -0.1, -1.25, -rearTop(c.rear.rearRight), c.rear.rearRight.y + 0.6, -reelX, 0.74);
  }

  // The steering wheel and its column, the gear lever, the handbrake, the pedals and the choke.
  function addControls() {
    const face = zs - 0.32;
    const column = new THREE.Group();
    column.name = 'steeringColumn';
    column.userData.keep = true;
    column.position.set(c.seats.driver.x, c.columnY, face);
    column.rotation.x = -1.12;
    tube([0, -0.02, 0], [0, c.wheelOut - 0.02, 0], 0.03, PAL.black, column);
    rbox(0.08, 0.06, 0.1, 0.025, PAL.black, 0, 0.05, 0, column); // the shroud by the dash
    root.add(column);
    addSignalStalk(column, c.wheelOut - 0.06, PAL.black, { modern: false });
    addWiperStalk(column, c.wheelOut - 0.06, PAL.black, { modern: false }); // and the wipers' on the right
    // The key in the column's right side, a real one (as the UTV's): on the shroud, facing the driver, turned by the dash's update.
    const keyHolder = new THREE.Group();
    keyHolder.position.set(-0.045, 0.045, 0.03); // on the driver's right, the door's side
    keyHolder.rotation.y = Math.PI / 2;
    column.add(keyHolder);
    const ignitionKey = addIgnitionKey(keyHolder, { ox: 0, oy: 0 }, { x: 0, y: 0 }, 0.6);
    const podUpdate2 = quad.userData.dash.update;
    let keyAngle = 0;
    quad.userData.dash.update = (state) => {
      podUpdate2(state);
      const to = state.cranking ? 1.45 : state.keyOn ? 0.72 : 0;
      keyAngle += (to - keyAngle) * 0.5;
      ignitionKey.rotation.z = keyAngle;
    };
    const wheel = new THREE.Group();
    wheel.name = 'handlebars';
    wheel.userData.keep = true;
    wheel.position.set(0, c.wheelOut, 0);
    column.add(wheel);
    // The Mk1's: a thin black rim on two spokes, low, with a big flat hub (the horn pad) carrying the maker's oval.
    const rimR = 0.19;
    add(new THREE.TorusGeometry(rimR, 0.014, 8, 32).rotateX(Math.PI / 2), PAL.black, wheel);
    rbox(0.12, 0.045, 0.07, 0.02, PAL.black, 0, 0, 0.0, wheel); // the boss
    for (const a of [Math.PI / 2 + 0.25, -Math.PI / 2 - 0.25]) tube([0, 0, 0], [Math.sin(a) * rimR, 0, Math.cos(a) * rimR], 0.013, PAL.black, wheel, 5);
    const hub = label(0.07, 0.035, 900, (g, Wd, H) => {
      g.fillStyle = '#16346a';
      g.beginPath();
      g.ellipse(Wd / 2, H / 2, Wd / 2, H / 2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f4f4f4';
      fitText(g, 'Thorne', Wd / 2, H / 2 + H * 0.04, H * 0.45, Wd * 0.8);
    }, wheel);
    hub.position.set(0, 0.0235, 0);
    hub.rotation.set(-Math.PI / 2, 0, Math.PI);
    for (const side of [1, -1]) {
      const grip = new THREE.Object3D();
      grip.name = side > 0 ? 'gripLeft' : 'gripRight';
      grip.userData.keep = true;
      grip.position.set(side * rimR, 0, 0);
      wheel.add(grip);
    }
    const hands = new THREE.Group();
    hands.name = 'riderHands';
    hands.userData.keep = true;
    hands.visible = false;
    wheel.add(hands);
    // The gear lever on the floor between the seats, with its gaiter; the handbrake behind it.
    const gear = new THREE.Group();
    gear.name = 'gearLever';
    gear.userData.keep = true;
    gear.position.set(0, 0.36, zs - 0.62);
    tube([0, 0, 0], [0, 0.26, 0], 0.008, PAL.steel, gear, 5);
    add(new THREE.SphereGeometry(0.026, 12, 10), PAL.black, gear).position.set(0, 0.27, 0);
    root.add(gear);
    add(new THREE.CylinderGeometry(0.03, 0.06, 0.06, 12), PAL.rubber, root).position.set(0, 0.38, zs - 0.62);
    const hb = new THREE.Group();
    hb.name = 'parkBrakeLever';
    hb.userData.keep = true;
    hb.position.set(0, 0.405, c.seats.driver.z - 0.1);
    rbox(0.035, 0.03, 0.26, 0.012, PAL.black, 0, 0, 0.13, hb);
    rbox(0.014, 0.014, 0.02, 0.004, PAL.chrome, 0, 0.005, 0.27, hb);
    hb.rotation.x = 0;
    root.add(hb);
    // The pedals, right-hand drive: the clutch next to the tunnel, the brake, the accelerator by the door; each on an arm from the bulkhead.
    addPedals(root, { pivot: [0.62, 0.58], foot: [0.36, 0.5], xs: [c.seats.driver.x + 0.17, c.seats.driver.x, c.seats.driver.x - 0.15], widths: [0.07, 0.07, 0.04] });
    // The choke: a pull knob in the dash face on the inside of the column, out on its cable towards you.
    const choke = new THREE.Group();
    choke.name = 'chokeKnob';
    choke.userData.keep = true;
    choke.position.set(c.seats.driver.x - 0.3, ys - 0.02 - 0.1, face - 0.02); // just outboard of the wheel's rim as seen from the seat // on the driver's right of the column, clear of the radio (it was inboard, over it)
    choke.userData.baseZ = choke.position.z;
    tube([0, 0, 0.1], [0, 0, -0.03], 0.004, PAL.steel, choke, 6);
    add(new THREE.CylinderGeometry(0.024, 0.024, 0.026, 14).rotateX(Math.PI / 2), PAL.black, choke).position.set(0, 0, -0.04);
    add(new THREE.CylinderGeometry(0.017, 0.017, 0.004, 14).rotateX(Math.PI / 2), PAL.chrome, choke).position.set(0, 0, -0.0545); // its pale face, so it shows on the black dash
    root.add(choke);
    for (const name of ['fuelTap', 'chokeLever']) { // Quad poses these on a quad; a car has neither
      const g = new THREE.Group();
      g.name = name;
      g.userData.keep = true;
      g.visible = false;
      root.add(g);
    }
  }

  function addAnchors() {
    const tip = new THREE.Object3D();
    tip.name = 'exhaustTip';
    tip.position.set(-0.45, 0.22, c.tail - 0.06);
    root.add(tip);
    const cap = (n) => n[0].toUpperCase() + n.slice(1);
    for (const [name, seat] of [['riderAnchor', c.seats.driver], ['seatLeft', c.seats.left], ...Object.entries(c.rear).map(([n, s]) => [`seat${cap(n)}`, s])]) {
      const a = new THREE.Object3D();
      a.name = name;
      a.position.set(seat.x, seat.y, seat.z);
      root.add(a);
    }
    for (const [name, seat] of [['cameraAnchor', c.seats.driver], ['cameraLeft', c.seats.left], ...Object.entries(c.rear).map(([n, s]) => [`camera${cap(n)}`, s])]) {
      const a = new THREE.Object3D();
      a.name = name;
      a.position.set(seat.x, seat.y + 0.66, seat.z + 0.02);
      root.add(a);
    }
  }

  for (const w of layoutWheels) {
    const wheelModel = buildWheel(w, rimMat);
    wheelModel.name = w.name;
    quad.add(wheelModel);
  }
  addHeadlightBeams(quad);
  addSignalLamps(quad, PAL.amber, PAL.smoke);
  quad.userData.tailMaterial = tailMat;
  quad.userData.tailHaloMaterial = new THREE.SpriteMaterial({ transparent: true, opacity: 0 });
  quad.userData.tailHalos = [];
  mergeStatic(root);
  quad.userData.cleanMaterials = [trim.vinyl, trim.cloth, trim.floor, trim.dash, trim.card, trim.lining, trim.shelf, trim.trim, PAL.strap];
  quad.userData.cabin = { min: [-c.width / 2, c.sill, c.hatchBottom[0]], max: [c.width / 2, c.screenTop[1] + 0.1, c.screenBase[0]] };
  const casts = new Set([paint, PAL.rubber, PAL.black, PAL.under, PAL.chrome]);
  quad.traverse((o) => {
    if (!o.isMesh || o.material === PAL.glass) return;
    o.castShadow = casts.has(o.material);
    o.receiveShadow = true;
  });
  return quad;
}

/** The wheels' places (the layout's, without importing it, so carModel.js can import this file): the front two steer. */
function fiestaWheels() {
  const wheelY = c.R + 0.16 - 0.45; // radius plus the suspension's rest length plus the chassis-to-ground offset
  return [
    { name: 'wheel_fl', x: c.track / 2, z: zF, front: true, radius: c.R, y: wheelY },
    { name: 'wheel_fr', x: -c.track / 2, z: zF, front: true, radius: c.R, y: wheelY },
    { name: 'wheel_rl', x: c.track / 2, z: -zF, front: false, radius: c.R, y: wheelY, driven: false },
    { name: 'wheel_rr', x: -c.track / 2, z: -zF, front: false, radius: c.R, y: wheelY, driven: false },
  ];
}

/** Lifts the hatch, 0 (shut) to 1 (swung up and back on its hinge), and stretches the two gas struts between the body and it. */
export function poseFiestaHatch(model, open) {
  const hatch = part(model, 'hatch');
  if (!hatch || !hatch.userData.keep) return;
  hatch.rotation.x = FIESTA_HATCH.open * open;
  hatch.updateMatrix();
  for (const name of ['hatchStrutLeft', 'hatchStrutRight']) {
    const strut = part(model, name);
    if (!strut) continue;
    const end = new THREE.Vector3(...strut.userData.hatchEnd).applyMatrix4(hatch.matrix); // the hatch end in the body's frame (the hatch's parent is the body root)
    const way = end.sub(strut.position);
    const len = way.length();
    strut.scale.z = Math.max(0.001, len);
    strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), way.normalize());
  }
}
