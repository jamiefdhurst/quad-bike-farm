import { part } from './part.js';
import * as THREE from 'three';
import { buildDash, addIgnitionKey } from './dash.js';
import { addHeadlightBeams, addSignalLamps, addSignalStalk, addHazardSwitch } from './quadModel.js';
import { mergeStatic } from './quadGeometry.js';
import { add, post, rbox as roundedBox, label, plate, fitText, canvasTexture, seeded, tube, axleCyl, addPedals } from './landRoverModel.js';
import { treadTyre } from './detail/tread.js';
import { buildRoadWheel } from './detail/roadWheels.js';
import { buildSeatBelt, webbingMaterial } from './detail/belts.js';
import { buildWiper } from './detail/fittings.js';
import { markWiper, addRainGlassBetween, addWiperStalk, markGlass } from './wiperModel.js';
import { buildRadio } from './detail/radios.js';
import { P309_BODY, P309_DOOR, P309_HATCH, P309_TAIL_LAMP, P309_BOOT, P309_R, P309_TYRE_W, P309_RIDE_LIFT, P309_RUB, P309_DENTS, P309_SHELF, P309_STRUT } from './p309Body.js';

// Your car (#229): a 1987 three-door 309 diesel at its real size, the Vauclair 39D, built from p309Body.js's numbers after the photos. Built as the
// Fiesta is (fiestaModel.js, whose fixes it keeps: watertight panels, the doors' frames, the hatch spanning the quarters, the boot closed underneath),
// through the same named parts as the Land Rovers' (carModel.js: steeringColumn > handlebars, dash, gearLever, parkBrakeLever, chokeKnob, the
// tipping seatBack_driver and seatBack_left, riderAnchor, seatLeft, seatRearLeft, seatRearRight, the cameras, exhaustTip, belt_<seat>), plus:
//
//   doorLeft, doorRight    groups hinged on their front edges: poseSeriesDoors swings them (the dirt on them goes with them: `mudRest`)
//   hatch                  a group hinged along the roof's rear edge: the glass, the bustle's deck, the tail panel and its lamps; pose309Hatch lifts it on T
//   hatchStrutLeft/Right   the gas struts, stretched and aimed by pose309Hatch between the body and the hatch
//   pedalClutch, pedalBrake, pedalAccel   swung by poseCarControls
//
// A basic one (Jamie): silver-grey paint, grey cloth inside, grey plastic bumpers and a black rubbing strip, steel wheels under plain plastic trims,
// a couple of bottles in the driver's door pocket, CD cases in the dash tray, and a few dents. No choke: it is a diesel with glow plugs.

const c = P309_BODY;
const W = c.width;
const zF = c.wheelbase / 2;
const [zs, ys] = c.screenBase;
const [zt, yt] = c.screenTop;
const [zr, yr] = c.roofRear;
const [zh, yh] = c.hatchBottom;
const FACE = W / 2 - 0.02; // the body side's middle: panels are 3.5 cm thick across it
const OUT = FACE + 0.0175; // the side's outer face
const ARCH = { y: c.R + 0.03, r: c.R + 0.07 };
const NOSE_LOW = 0.47; // the body's lower edge at the nose and the tail: the deep bumpers cover everything under it
const BUMPER = { y0: 0.26, y1: 0.48 }; // the grey plastic bumpers' bottom and top

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

/** Whether a dent is on a door's panel (between its edges) rather than the wing or the quarter. */
export const onDoor = (d) => d.z < P309_DOOR.hinge && d.z > P309_DOOR.rear;

const archDz = () => Math.sqrt(Math.max(0, ARCH.r * ARCH.r - (c.sill - ARCH.y) ** 2));

/** A body side piece: the front wing (from the nose back to the door's front edge) or the rear quarter (from the door's rear edge to the tail), arches cut in. */
export function sidePiece(which) {
  const dz = archDz();
  const start = Math.atan2(c.sill - ARCH.y, dz);
  const s = new THREE.Shape();
  if (which === 'front') {
    s.moveTo(c.nose, NOSE_LOW);
    s.lineTo(zF + dz + 0.12, c.sill + 0.06); // the valance's lower edge slopes down to the sill along the wing, under the bumper's end
    s.lineTo(zF + dz, c.sill);
    s.absarc(zF, ARCH.y, ARCH.r, start, Math.PI - start, false);
    s.lineTo(zF - dz, c.sill);
    s.lineTo(P309_DOOR.hinge, c.sill);
    s.lineTo(P309_DOOR.hinge, upperAt(P309_DOOR.hinge));
    for (const [z, y] of c.upper.filter(([z]) => z > P309_DOOR.hinge).reverse()) s.lineTo(z, y);
  } else {
    s.moveTo(P309_DOOR.rear, c.sill);
    s.lineTo(-zF + dz, c.sill);
    s.absarc(-zF, ARCH.y, ARCH.r, start, Math.PI - start, false);
    s.lineTo(-zF - dz, c.sill);
    s.lineTo(-zF - dz - 0.12, c.sill + 0.06);
    s.lineTo(c.tail, NOSE_LOW);
    for (let i = c.upper.length - 1; i >= 0; i--) if (c.upper[i][0] < P309_DOOR.rear) s.lineTo(c.upper[i][0], c.upper[i][1]);
    s.lineTo(P309_DOOR.rear, upperAt(P309_DOOR.rear));
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

/**
 * A dent: a disc of paint lying on the panel whose normals bow in as a pushed-in bowl's would, so the light catches it as a dent without cutting the
 * panel. Faces +x; `depth` 0 to 1 is how far the normals tip (and so how deep it reads). Pure geometry, exported for the test.
 */
export function dentGeometry(r, depth, rings = 6, segments = 20) {
  const pos = [0, 0, 0];
  const nrm = [1, 0, 0];
  const idx = [];
  for (let i = 1; i <= rings; i++) {
    const t = i / rings;
    // The bowl's slope: steepest two thirds of the way out, flat at the bottom and at the lip.
    const tip = depth * 0.7 * Math.sin(Math.PI * Math.min(1, t * 1.15));
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      const y = Math.cos(a) * r * t;
      const z = Math.sin(a) * r * t;
      pos.push(0, y, z);
      const n = new THREE.Vector3(1, -Math.cos(a) * tip, -Math.sin(a) * tip).normalize(); // tipped towards the middle, as a pushed-in bowl's sides face: lit as a hollow is (outwards it read as a bump)
      nrm.push(n.x, n.y, n.z);
    }
  }
  for (let j = 0; j < segments; j++) idx.push(0, 1 + j, 1 + ((j + 1) % segments));
  for (let i = 1; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const a = 1 + (i - 1) * segments + j;
      const b = 1 + (i - 1) * segments + ((j + 1) % segments);
      idx.push(a, a + segments, b, b, a + segments, b + segments);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

// Materials, made once --------------------------------------------------------------------

const PAL = {
  rubber: new THREE.MeshStandardMaterial({ color: 0x1a1a19, roughness: 0.95 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1b1c1d, roughness: 0.7 }),
  bumper: new THREE.MeshStandardMaterial({ color: 0x5b5e62, roughness: 0.85 }), // the grey plastic bumpers, gone chalky
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
  trimCap: new THREE.MeshStandardMaterial({ color: 0x8e9296, roughness: 0.5, metalness: 0.3 }), // the wheels' plain silver plastic trims
};

// The inside's own copies of the dark plastics and metals (vents, switches, the door cards' fittings, the seat frames, the levers), so they can be
// listed as clean: the mud coat keeps mud out of a cab's clean materials, but puts it in every nook of a shared one, and the vents are all nooks.
const IN = { black: PAL.black.clone(), under: PAL.under.clone(), steel: PAL.steel.clone(), chrome: PAL.chrome.clone(), rubber: PAL.rubber.clone() };

/** The inside: grey, a basic one's (Jamie): ribbed grey cloth on grey vinyl, grey plastics, dark grey carpet. Made when one is built (they need a canvas). */
function trimMaterials() {
  const grain = (g, w, h, rand, n = 900) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.18)';
      g.fillRect(rand() * w, rand() * h, 1.6, 1.6);
    }
  };
  const vinylTex = canvasTexture(128, 128, (g, w, h) => {
    const rand = seeded(15);
    g.fillStyle = '#3c3e42';
    g.fillRect(0, 0, w, h);
    grain(g, w, h, rand, 1400);
  });
  // The cloth: fine vertical ribs in two greys (the photos' basic trim), worn shiny in places.
  const clothTex = canvasTexture(128, 128, (g, w, h) => {
    const rand = seeded(19);
    g.fillStyle = '#5a5d62';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 4) {
      g.fillStyle = 'rgba(30,32,36,0.55)';
      g.fillRect(x, 0, 1.5, h);
    }
    grain(g, w, h, rand, 1100);
  }, { repeat: [2, 2] });
  const carpetTex = canvasTexture(64, 64, (g, w, h) => {
    const rand = seeded(23);
    g.fillStyle = '#2f3033';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.3)';
      g.fillRect(rand() * w, rand() * h, 1, 1);
    }
  }, { repeat: [4, 4] });
  return {
    vinyl: new THREE.MeshStandardMaterial({ map: vinylTex, roughness: 0.55 }),
    cloth: new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.95 }),
    floor: new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 1 }),
    dash: new THREE.MeshStandardMaterial({ color: 0x46484c, roughness: 0.8 }), // the grey plastic moulding
    card: new THREE.MeshStandardMaterial({ color: 0x53565b, roughness: 0.75 }), // the door cards
    lining: new THREE.MeshStandardMaterial({ color: 0xbcbcb6, roughness: 0.95, side: THREE.DoubleSide }), // the headlining
    trim: new THREE.MeshStandardMaterial({ color: 0x2c2d30, roughness: 0.85 }), // the boot's side trim
    mat: new THREE.MeshStandardMaterial({ color: 0x161617, roughness: 0.95 }), // the rubber floor mats
  };
}

// Wheels -------------------------------------------------------------------------------

function buildWheel(w) {
  const side = Math.sign(w.x);
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  const rimR = 0.165;
  spin.add(new THREE.Mesh(treadTyre('road', { radius: c.R, width: P309_TYRE_W, rimR, segments: 36 }), PAL.rubber));
  // A steel wheel under a full plain plastic trim, silver (the basic one's): the kit's 'trim'. Built for +x and turned half a turn for the driver's side
  // (the Fiesta's lesson: the kit mirrors its offsets but not its lathed face's winding).
  const face = buildRoadWheel('trim', { rimR: rimR - 0.004, width: P309_TYRE_W - 0.02, side: 1, nuts: 4, mats: { cap: PAL.trimCap } });
  if (side < 0) face.rotation.y = Math.PI;
  spin.add(face);
  // The inside of the wheel: a pressed steel disc across the barrel on the inner side with the hub standing out of it, so it is not hollow from behind.
  axleCyl(rimR - 0.006, 0.012, PAL.steel, -side * (P309_TYRE_W / 2 - 0.045), 0, 0, spin);
  axleCyl(0.05, 0.05, PAL.steel, -side * (P309_TYRE_W / 2 - 0.06), 0, 0, spin);
  wheel.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  mergeStatic(wheel);
  return wheel;
}

// The car -------------------------------------------------------------------------------

export function build309Model({ bodyColor = 0x8f9396, reg = null } = {}) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.35, side: THREE.DoubleSide }); // metallic silver-grey
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x3a0a07, roughness: 0.25, emissive: 0x000000 });
  const trim = trimMaterials();
  const webbing = webbingMaterial();
  const layoutWheels = wheels309();

  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  quad.userData.seatMaterial = trim.vinyl;
  quad.userData.steerGain = 6; // about three and a half turns lock to lock, without power steering
  quad.userData.liveMaterials = [];
  quad.userData.carKind = 'p309';
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const bodyRoot = new THREE.Group();
  bodyRoot.name = 'bodyRoot';
  body.add(bodyRoot);
  const root = new THREE.Group(); // everything but the wheels, raised on them (P309_RIDE_LIFT)
  root.position.y = P309_RIDE_LIFT;
  bodyRoot.add(root);

  addBody();
  addDoors();
  addGlasshouse();
  addHatch();
  addFrontEnd();
  addRear();
  addInterior();
  addControls();
  addLitter();
  addAnchors();

  // The body sides: the wing in front of the door and the quarter behind it (the door is its own group), the rubbing strip along them at the bumpers'
  // height, the arches' liners and the inner wings so you cannot see through them, the engine, mudflaps, the fuel flap and the dents.
  function addBody() {
    for (const s of [-1, 1]) {
      extrudeZY(sidePiece('front'), 0.035, s * FACE, paint, root, 'wing');
      extrudeZY(sidePiece('rear'), 0.035, s * FACE, paint, root, 'quarter');
      rbox(0.035, P309_DOOR.bottom - c.sill - 0.002, P309_DOOR.hinge - P309_DOOR.rear, 0.006, paint, s * FACE, (P309_DOOR.bottom + c.sill) / 2 - 0.001, (P309_DOOR.hinge + P309_DOOR.rear) / 2, root, 'sill'); // the sill under the door, in paint, flush with the wing and the quarter it runs between
      // The rubbing strip: black plastic along the wing (from the bumper's end back to the door) and the quarter (from the door to the bumper); the door's is on the door.
      // Each piece stops at the arch's edge at the strip's height; it stands 1 cm proud and is sunk 6 mm into the skin, so no face lies on the paint's.
      const archHalf = Math.sqrt(ARCH.r * ARCH.r - (P309_RUB.y - ARCH.y) ** 2) + 0.02;
      const strip = (z0, z1) => rbox(0.016, P309_RUB.h, z0 - z1, 0.006, PAL.black, s * (OUT + 0.002), P309_RUB.y, (z0 + z1) / 2, root);
      strip(zF - archHalf, P309_DOOR.hinge + 0.02); // on the wing, between the front arch and the door
      strip(P309_DOOR.rear - 0.02, -zF + archHalf); // on the quarter, between the door and the rear arch
      rbox(0.012, 0.025, 0.06, 0.008, PAL.amber, s * (OUT + 0.004), upperAt(zs + 0.35) - 0.12, zs + 0.35, root); // the indicator repeater on the wing
      for (const zc of [zF, -zF]) {
        const liner = add(new THREE.CylinderGeometry(ARCH.r - 0.008, ARCH.r - 0.008, 0.24, 16, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95, side: THREE.DoubleSide }), root);
        liner.position.set(s * (W / 2 - 0.15), ARCH.y, zc);
        rbox(0.26, 0.04, 0.7, 0.01, PAL.under, s * (W / 2 - 0.15), ARCH.y + ARCH.r + 0.01, zc, root); // the arch's roof
        rbox(0.18, 0.26, 0.018, 0.005, PAL.rubber, s * (c.track / 2 - 0.01), 0.17, zc - 0.38, root); // a mudflap behind each wheel, inside the sill's face
      }
      rbox(0.03, 0.5, 1.0, 0.01, PAL.under, s * (c.track / 2 - P309_TYRE_W / 2 - 0.05), 0.48, (zs + c.nose) / 2 - 0.05, root); // the inner wing
      rbox(0.03, 0.4, 0.75, 0.01, PAL.under, s * (c.track / 2 - P309_TYRE_W / 2 - 0.05), 0.5, -zF, root);
    }
    rbox(0.6, 0.45, 0.55, 0.05, PAL.steel, 0, 0.5, zF - 0.02, root); // the engine, across the car (the 1.9 diesel, a tall block)
    rbox(0.012, 0.11, 0.14, 0.006, paint, -(OUT + 0.001), 0.72, -1.5, root, 'fuelFlap'); // the fuel flap on the right (-x) rear quarter, in paint, standing a few mm proud
    rbox(0.008, 0.01, 0.025, 0.002, PAL.black, -(OUT + 0.007), 0.72, -1.45, root); // and the notch you open it by
    // The dents on the wings and quarters (p309Body.js): each a bowl of paint shaded as if pushed in, 1 mm off the panel. A door's go on the door.
    for (const d of P309_DENTS.filter((x) => !onDoor(x))) {
      const m = add(dentGeometry(d.r, d.depth), paint, root, 'dent');
      if (d.side < 0) m.rotation.y = Math.PI;
      m.position.set(d.side * (OUT + 0.001), d.y, d.z);
    }
  }

  // Each door: a group on its front hinge, the lower panel with its handle, the window and its black frame, the mirror, the card inside. Local z runs
  // back from the hinge, so a door opens by turning about y.
  function addDoors() {
    const D = P309_DOOR;
    const len = D.hinge - D.rear;
    const lz = (z) => z - D.hinge; // a car z to the door's own
    for (const s of [-1, 1]) {
      const d = new THREE.Group();
      d.name = s > 0 ? 'doorLeft' : 'doorRight';
      d.userData.keep = true;
      d.position.set(s * FACE, 0, D.hinge);
      d.userData.mudRest = [s * FACE, 0, D.hinge];
      const panel = new THREE.Shape();
      panel.moveTo(0, D.bottom);
      panel.lineTo(-len, D.bottom);
      panel.lineTo(-len, upperAt(D.rear));
      panel.lineTo(0, upperAt(D.hinge));
      panel.closePath();
      extrudeZY(panel, 0.035, 0, paint, d, 'doorPanel');
      rbox(0.012, 0.02, len - 0.04, 0.006, PAL.black, 0.0235 * s, ys - 0.02, -len / 2, d); // the black strip along the window's sill (beltline)
      rbox(0.016, 0.026, 0.13, 0.007, PAL.black, s * 0.0245, ys - 0.1, lz(D.rear) + 0.15, d, 'doorHandle'); // the black pull handle at the back
      rbox(0.014, 0.02, 0.04, 0.006, PAL.chrome, s * 0.0245, ys - 0.15, lz(D.rear) + 0.04, d); // the lock
      rbox(0.016, P309_RUB.h, len - 0.04, 0.006, PAL.black, s * 0.0195, P309_RUB.y, -len / 2, d); // the rubbing strip, on the door so it swings with it
      for (const z of [-0.003, -len + 0.003]) rbox(0.006, upperAt(D.rear) - D.bottom - 0.01, 0.005, 0.002, PAL.black, s * 0.0205, (D.bottom + upperAt(D.rear)) / 2, z, d); // the shut lines
      // The window: the glass leaning in as the glasshouse does, between the A pillar's line and the door's rear edge, in a black frame.
      const win = new THREE.Group();
      const x0 = s * (halfAt(ys) - 0.01) - s * FACE;
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
      const fr = (a, b) => post([0, ...a], [0, ...b], 0.032, 0.03, PAL.black, win);
      fr([0, 0], [yt - ys, zt - D.hinge]); // the front upright, up the A pillar's line
      fr([yt - ys + 0.005, zt - D.hinge], [yt - ys + 0.005, -len]); // the top rail
      fr([0, -len + 0.015], [yt - ys, -len + 0.015]); // the rear upright
      rbox(0.026, 0.026, len - 0.02, 0.01, PAL.black, x0 + s * 0.003, ys + 0.008, -len / 2, d); // the seal along the glass's foot
      // The mirror: a black housing on a triangular foot in the window's front corner, on the door (so it swings with it).
      const mirror = new THREE.Group();
      mirror.name = 'mirror';
      mirror.userData.keep = true;
      mirror.position.set(s * 0.045, ys + 0.06, zs - D.hinge - 0.12);
      rbox(0.06, 0.08, 0.1, 0.01, PAL.black, 0, 0, 0, mirror); // its foot on the door
      rbox(0.13, 0.09, 0.06, 0.015, PAL.black, s * 0.09, 0.03, -0.01, mirror); // the housing
      rbox(0.115, 0.075, 0.004, 0.003, PAL.glass, s * 0.09, 0.03, -0.0415, mirror, 'mirrorGlass'); // and its glass, facing back
      d.add(mirror);
      // The card on the inside: grey, with a long pull along it, a deep pocket at the bottom, the winder and the lock button.
      const inside = -s * 0.03;
      rbox(0.02, upperAt(D.rear) - D.bottom - 0.05, len - 0.1, 0.01, trim.card, inside, (D.bottom + upperAt(D.rear)) / 2 - 0.01, -len / 2, d);
      rbox(0.05, 0.04, len - 0.4, 0.015, trim.card, inside - s * 0.02, ys - 0.2, -len / 2 + 0.05, d); // the arm rest
      tube([inside - s * 0.03, ys - 0.24, -0.62], [inside - s * 0.03, ys - 0.24, -0.4], 0.012, IN.black, d, 6); // the pull
      // The door pocket: a deep open bin along the bottom of the card, its front lip low enough to see the bottles in it.
      const pz = -len / 2 - 0.05;
      rbox(0.1, 0.02, 0.6, 0.008, trim.card, inside - s * 0.05, D.bottom + 0.06, pz, d); // its floor
      rbox(0.012, 0.12, 0.6, 0.005, trim.card, inside - s * 0.1, D.bottom + 0.12, pz, d); // its front lip
      for (const e of [-0.3, 0.3]) rbox(0.1, 0.12, 0.012, 0.005, trim.card, inside - s * 0.05, D.bottom + 0.12, pz + e, d); // its ends
      if (s < 0) d.userData.pocket = [inside - s * 0.05, D.bottom + 0.07, pz]; // where the driver's bottles stand (addLitter)
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6).rotateZ(Math.PI / 2), IN.chrome, d).position.set(inside - s * 0.04, ys - 0.12, lz(D.rear) + 0.36);
      add(new THREE.SphereGeometry(0.018, 8, 6), IN.black, d).position.set(inside - s * 0.07, ys - 0.12, lz(D.rear) + 0.36);
      rbox(0.012, 0.03, 0.012, 0.004, IN.black, inside, ys + 0.015, lz(D.rear) + 0.1, d); // the lock button on the sill
      for (const dent of P309_DENTS.filter((x) => x.side === s && onDoor(x))) { // its dents, so they swing with it
        const m = add(dentGeometry(dent.r, dent.depth), paint, d, 'dent');
        if (s < 0) m.rotation.y = Math.PI;
        m.position.set(s * 0.0185, dent.y, lz(dent.z));
      }
      root.add(d);
    }
  }

  // The pillars, the rails, the windscreen, the roof, the aerial and the rear quarter windows. The side glass in front of the B pillar is the doors'.
  function addGlasshouse() {
    const pr = 0.035;
    for (const s of [-1, 1]) {
      tube([s * halfAt(ys), ys, zs], [s * halfAt(yt), yt, zt], pr, paint, root, 8); // the A pillar
      tube([s * halfAt(ys), ys, c.bPillar], [s * halfAt(yt), yt - 0.01, c.bPillar], 0.045, PAL.black, root, 6); // the B pillar, black
      tube([s * halfAt(yt), yt, zt], [s * halfAt(yr), yr, zr], pr, paint, root, 8); // the rail over the windows
      tube([s * halfAt(yr), yr, zr], [s * halfAt(yh), yh, zh], pr + 0.005, paint, root, 8); // the hatch's edge
      // The rear quarter: the fixed glass between the B pillar and the C pillar, and the C pillar's painted panel behind it (the 309's is broad).
      const lean = (shape, inset, mat, name) => {
        const g = new THREE.Group();
        g.position.set(s * (halfAt(ys) - inset), ys, 0);
        g.rotation.z = s * Math.atan(c.tumble);
        add(new THREE.ShapeGeometry(shape).rotateY(-Math.PI / 2).translate(0, -ys, 0), mat, g, name);
        root.add(g);
      };
      const qBack = -1.3; // the glass's back edge at the waist; it slants forward to the roof
      const glass = new THREE.Shape();
      glass.moveTo(c.bPillar - 0.03, ys + 0.04);
      glass.lineTo(c.bPillar - 0.03, yr - 0.03);
      glass.lineTo(zr + 0.12, yr - 0.03);
      glass.lineTo(qBack, ys + 0.04);
      glass.closePath();
      lean(glass, 0.01, PAL.glass, 'quarterGlass');
      const cp = new THREE.Shape();
      cp.moveTo(zr + 0.12, yr);
      cp.lineTo(zr - 0.04, yr);
      cp.lineTo(zh, yh);
      cp.lineTo(zh, ys);
      cp.lineTo(c.bPillar - 0.03, ys);
      cp.lineTo(c.bPillar - 0.03, ys + 0.04);
      cp.lineTo(qBack, ys + 0.04);
      cp.lineTo(zr + 0.12, yr - 0.03);
      cp.closePath();
      lean(cp, -0.006, paint, 'cPillar');
      rbox(0.03, 0.025, c.bPillar - zh, 0.01, PAL.black, s * (halfAt(ys) + 0.005), ys + 0.05, (c.bPillar + zh) / 2, root); // the quarter glass's seal along its foot
    }
    // The windscreen in its black rubber, the roof, the headlining and the sun visors.
    quadMesh([-halfAt(ys), ys, zs], [halfAt(ys), ys, zs], [halfAt(yt), yt, zt], [-halfAt(yt), yt, zt], PAL.glass, root);
    tube([-halfAt(ys), ys, zs], [halfAt(ys), ys, zs], 0.03, PAL.black, root, 6);
    tube([-halfAt(yt), yt, zt], [halfAt(yt), yt, zt], 0.03, paint, root, 6);
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
    const lining = rbox(roofW - 0.12, 0.012, roofLen - 0.1, 0.005, trim.lining, 0, (yt + yr) / 2 - 0.012, (zt + zr) / 2, root);
    lining.rotation.x = roof.rotation.x;
    for (const x of [-0.42, 0.42]) rbox(0.36, 0.015, 0.2, 0.006, trim.lining, x, yt - 0.045, zt - 0.14, root); // the sun visors, under the lining
    // The aerial: a thin black whip from the roof's front edge over the driver's door, raked back (the photos').
    const aerial = new THREE.Group(); // its own group, so the size check leaves it out as the published heights do
    aerial.name = 'aerial';
    aerial.userData.keep = true;
    tube([-0.5, yt + 0.035, zt - 0.08], [-0.5, yt + 0.6, zt - 0.62], 0.0035, PAL.black, aerial, 4);
    add(new THREE.CylinderGeometry(0.012, 0.016, 0.03, 8), PAL.black, aerial).position.set(-0.5, yt + 0.04, zt - 0.08);
    root.add(aerial);
    // The wipers, parked along the foot of the screen.
    for (const [x, ang] of [[-0.5, 0.05], [0.06, 0.05]]) {
      const wiper = buildWiper({ len: 0.52, mats: { arm: PAL.black } });
      wiper.position.set(x, ys + 0.022, zs + 0.03);
      wiper.rotation.set(-Math.atan2(yt - ys, zs - zt), 0, ang);
      wiper.rotation.order = 'YXZ';
      root.add(markWiper(wiper, 1.85)); // sweeping up from the foot of the screen, past upright (#103)
    }
    addRainGlassBetween(root, { foot: [zs, ys], top: [zt, yt], halfFoot: halfAt(ys), halfTop: halfAt(yt) }); // where the rain lands on it
    rbox(0.22, 0.06, 0.02, 0.01, PAL.black, 0, yt - 0.15, zt - 0.06, root, 'mirrorGlass'); // the rear-view mirror
    tube([0, yt - 0.01, zt - 0.03], [0, yt - 0.12, zt - 0.06], 0.008, PAL.black, root, 5);
  }

  // The hatch: a group hinged along the roof's rear edge, the glass in its black rubber, the bustle's short deck, and the tail panel down to the
  // cargo sill with the lamps, the badges, the lock and the plate; two gas struts joining it to the body.
  function addHatch() {
    const H = P309_HATCH;
    const hatch = new THREE.Group();
    hatch.name = 'hatch';
    hatch.userData.keep = true;
    hatch.position.set(0, yr, zr);
    hatch.userData.mudRest = [0, yr, zr];
    const hz = (z) => z - zr;
    const hy = (y) => y - yr;
    const half = halfAt(yh) - 0.02;
    quadMesh([-halfAt(yr) + 0.02, 0, 0], [halfAt(yr) - 0.02, 0, 0], [half, hy(yh), hz(zh)], [-half, hy(yh), hz(zh)], PAL.glass, hatch);
    const edge = (a, b, r = 0.016) => tube(a, b, r, PAL.black, hatch, 6);
    edge([-halfAt(yr) + 0.02, 0, 0], [halfAt(yr) - 0.02, 0, 0]);
    edge([-half, hy(yh), hz(zh)], [half, hy(yh), hz(zh)]);
    edge([-halfAt(yr) + 0.02, 0, 0], [-half, hy(yh), hz(zh)]);
    edge([halfAt(yr) - 0.02, 0, 0], [half, hy(yh), hz(zh)]);
    // The deck: from the glass's foot back over the bustle to the tail, falling as the upper line does.
    const deckW = W - 2 * H.inset - 0.02 + 0.04;
    const deck = new THREE.Shape();
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const z = zh + ((c.tail + 0.02 - zh) * i) / n;
      const y = i === 0 ? yh : upperAt(z);
      if (i === 0) deck.moveTo(hz(z), hy(y));
      else deck.lineTo(hz(z), hy(y));
    }
    for (let i = n; i >= 0; i--) {
      const z = zh + ((c.tail + 0.02 - zh) * i) / n;
      const y = i === 0 ? yh : upperAt(z);
      deck.lineTo(hz(z), hy(y) - 0.03);
    }
    deck.closePath();
    extrudeZY(deck, deckW, 0, paint, hatch);
    const tailTop = upperAt(c.tail);
    rbox(deckW, tailTop - H.foot, 0.04, 0.02, paint, 0, hy((tailTop + H.foot) / 2), hz(c.tail + 0.02), hatch);
    // The tail lamps: wide, shallow units at the panel's ends, red over amber over red, so they lift with it. Between them a black panel with the badges.
    const L = P309_TAIL_LAMP;
    const lz = hz(c.tail) - 0.012;
    for (const sd of [-1, 1]) {
      const ly = hy((L.y0 + L.y1) / 2);
      const lh = L.y1 - L.y0;
      rbox(L.w, lh, 0.02, 0.008, PAL.black, sd * L.x, ly, hz(c.tail) - 0.004, hatch, 'tailLampBody');
      rbox(L.w - 0.02, lh * 0.3, 0.012, 0.005, tailMat, sd * L.x, ly + lh * 0.3, lz - 0.008, hatch); // the tail and stop light, on top
      rbox(L.w - 0.02, lh * 0.26, 0.012, 0.005, PAL.amber, sd * L.x, ly, lz - 0.008, hatch); // the indicator across the middle
      rbox((L.w - 0.02) * 0.5, lh * 0.28, 0.012, 0.005, tailMat, sd * (L.x + (L.w - 0.02) * 0.25), ly - lh * 0.3, lz - 0.008, hatch); // the rear lamp under it...
      rbox((L.w - 0.02) * 0.5, lh * 0.28, 0.012, 0.005, sd > 0 ? PAL.smoke : PAL.fog, sd * (L.x - (L.w - 0.02) * 0.25), ly - lh * 0.3, lz - 0.008, hatch); // ...and the reverse or the fog lamp
    }
    rbox(2 * (L.x - L.w / 2) - 0.01, L.y1 - L.y0 - 0.04, 0.012, 0.005, PAL.black, 0, hy((L.y0 + L.y1) / 2), lz, hatch); // the black panel between the lamps
    const badge = (text, w, h, x, y, size = 0.6) => {
      const b = label(w, h, 1200, (g, Wd, Hd) => {
        g.fillStyle = '#d9dadb';
        fitText(g, text, Wd / 2, Hd / 2 + Hd * 0.06, Hd * size, Wd * 0.95);
      }, hatch);
      b.position.set(x, y, lz - 0.0075);
      b.rotation.y = Math.PI;
      return b;
    };
    badge('VAUCLAIR', 0.2, 0.03, 0.18, hy((L.y0 + L.y1) / 2)); // the maker's name on the left of the panel, as the photos' (seen from behind)
    badge('39D', 0.08, 0.03, -0.24, hy((L.y0 + L.y1) / 2));
    rbox(0.05, 0.025, 0.02, 0.006, PAL.chrome, 0, hy(L.y0 - 0.04), hz(c.tail) - 0.012, hatch, 'hatchHandle'); // the lock, under the panel
    rbox(deckW - 0.1, tailTop - H.foot - 0.06, 0.012, 0.005, trim.trim, 0, hy((tailTop + H.foot) / 2), hz(c.tail + 0.045), hatch); // the lining inside
    const rw = buildWiper({ len: 0.36, mats: { arm: PAL.black } });
    const tilt = Math.atan2(zh - zr, yr - yh);
    rw.position.set(0, hy(yh) + 0.05, hz(zh) + 0.05);
    rw.rotation.set(-Math.PI / 2 + tilt, 0, 0.08);
    rw.rotation.order = 'YXZ';
    hatch.add(rw);
    root.add(hatch);
    for (const s of [-1, 1]) {
      const strut = new THREE.Group();
      strut.name = s > 0 ? 'hatchStrutLeft' : 'hatchStrutRight';
      strut.userData.keep = true;
      // Both ends well in from the C pillars (which lean in as they rise) and under the glass: the body's end low on the boot's side, the hatch's a
      // third of the way down its glass and 3 cm inside it. Out at the pillars, the open strut went through them (Jamie).
      strut.position.set(s * P309_STRUT.x, P309_STRUT.y, P309_STRUT.z);
      const along = 0.35 * Math.hypot(zh - zr, yh - yr); // down the glass from the hinge...
      const dir = [(zh - zr) / Math.hypot(zh - zr, yh - yr), (yh - yr) / Math.hypot(zh - zr, yh - yr)]; // (z, y)
      strut.userData.hatchEnd = [s * P309_STRUT.x, dir[1] * along + dir[0] * 0.03, dir[0] * along - dir[1] * 0.03]; // ...and in from it, at right angles towards the cabin
      add(new THREE.CylinderGeometry(0.009, 0.009, 1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5), PAL.chrome, strut);
      add(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 6).rotateX(Math.PI / 2).translate(0, 0, 0.06), PAL.steel, strut);
      root.add(strut);
    }
    pose309Hatch(quad, 0);
  }

  // The nose: the sloping bonnet, the front panel, a body-coloured grille of four slats with the maker's badge between two wide rectangular
  // headlamps, the indicators round the corners, and the deep grey bumper with the plate.
  function addFrontEnd() {
    skin(c.nose, zs, 0.035, W - 0.06, paint, root);
    rbox(W - 0.06, 0.03, 0.03, 0.01, PAL.under, 0, ys - 0.04, zs + 0.02, root); // the scuttle panel at the foot of the screen
    const noseTop = upperAt(c.nose);
    rbox(W - 0.04, noseTop - NOSE_LOW, 0.04, 0.012, paint, 0, (noseTop + NOSE_LOW) / 2, c.nose - 0.025, root); // the front panel
    // The grille: four body-coloured slats in a dark opening, with the maker's shield in the middle.
    rbox(0.6, 0.16, 0.03, 0.01, PAL.grille, 0, 0.6, c.nose + 0.002, root);
    for (let i = 0; i < 4; i++) rbox(0.58, 0.018, 0.02, 0.004, paint, 0, 0.54 + i * 0.04, c.nose + 0.018, root);
    const shield = label(0.05, 0.06, 1000, (g, Wd, H) => {
      g.fillStyle = '#1b1c1e';
      g.beginPath();
      g.moveTo(Wd * 0.1, H * 0.05);
      g.lineTo(Wd * 0.9, H * 0.05);
      g.lineTo(Wd * 0.9, H * 0.6);
      g.quadraticCurveTo(Wd * 0.9, H * 0.92, Wd / 2, H * 0.98);
      g.quadraticCurveTo(Wd * 0.1, H * 0.92, Wd * 0.1, H * 0.6);
      g.closePath();
      g.fill();
      g.fillStyle = '#cfd2d4';
      fitText(g, 'V', Wd / 2, H * 0.5, H * 0.5, Wd * 0.6);
    }, root);
    shield.position.set(0, 0.6, c.nose + 0.03);
    for (const s of [-1, 1]) {
      rbox(0.34, 0.15, 0.036, 0.01, PAL.black, s * 0.5, 0.6, c.nose + 0.004, root); // the headlamp's housing
      add(new THREE.PlaneGeometry(0.31, 0.12), lensMat, root).position.set(s * 0.5, 0.6, c.nose + 0.026); // 4 mm proud of its housing
      rbox(0.09, 0.13, 0.03, 0.01, PAL.amber, s * (W / 2 - 0.06), 0.6, c.nose - 0.005, root); // the indicator beside it, wrapping the corner
      rbox(0.03, 0.12, 0.1, 0.01, PAL.amber, s * (W / 2 - 0.012), 0.6, c.nose - 0.06, root);
    }
    // The bumper: deep grey plastic wrapping the corners back to the arches, with a groove along it, and the plate on it.
    const by = (BUMPER.y0 + BUMPER.y1) / 2;
    const bh = BUMPER.y1 - BUMPER.y0;
    rbox(W + 0.02, bh, 0.1, 0.03, PAL.bumper, 0, by, c.nose + 0.02, root, 'bumperFront');
    const front = zF + archDz();
    for (const s of [-1, 1]) rbox(0.06, bh, c.nose - front - 0.04, 0.02, PAL.bumper, s * (W / 2 + 0.02), by, (c.nose + front) / 2 + 0.03, root); // its ends, back along the wings to the arch (their inner face inside the wing's skin)
    rbox(W + 0.024, 0.012, 0.012, 0.004, PAL.black, 0, BUMPER.y1 - 0.03, c.nose + 0.071, root); // the groove along it, over the plate
    rbox(0.5, 0.04, 0.012, 0.004, PAL.black, 0, BUMPER.y0 + 0.035, c.nose + 0.071, root); // the slot under the plate
    plate(reg ?? c.plate, '#ece9de', root, { x: 0, y: by - 0.025, z: c.nose + 0.0735, facing: 1 });
  }

  // The tail: the deep grey bumper wrapping the corners, the valance between it and the hatch's foot, the cargo sill and its seal, the plate in the
  // bumper's recess, the exhaust.
  function addRear() {
    const by = (BUMPER.y0 + BUMPER.y1) / 2;
    const bh = BUMPER.y1 - BUMPER.y0;
    rbox(W + 0.02, bh, 0.1, 0.03, PAL.bumper, 0, by, c.tail - 0.02, root, 'bumperRear');
    const back = -zF - archDz();
    for (const s of [-1, 1]) rbox(0.06, bh, back - c.tail - 0.04, 0.02, PAL.bumper, s * (W / 2 + 0.02), by, (back + c.tail) / 2 - 0.03, root); // its ends along the quarters
    rbox(W + 0.024, 0.012, 0.012, 0.004, PAL.black, 0, BUMPER.y1 - 0.03, c.tail - 0.071, root); // the groove along it, over the plate's recess
    rbox(W - 0.5, P309_HATCH.foot - BUMPER.y1 + 0.02, 0.04, 0.01, paint, 0, (P309_HATCH.foot + BUMPER.y1) / 2, c.tail + 0.02, root); // the valance over the bumper, up to the hatch's foot
    rbox(W - 0.5, 0.03, 0.05, 0.01, PAL.black, 0, P309_HATCH.foot - 0.02, c.tail + 0.01, root); // the cargo sill's rubber seal
    rbox(0.56, 0.14, 0.02, 0.01, PAL.black, 0.18, by, c.tail - 0.065, root); // the plate's recess, a little to the left (as the photos')
    plate(reg ?? c.plate, '#e8c51c', root, { x: 0.18, y: by, z: c.tail - 0.0765, facing: -1 }); // yellow at the back
    tube([-0.35, 0.2, -0.6], [-0.42, 0.2, c.tail - 0.05], 0.022, PAL.rust, root, 6); // the exhaust, a plain pipe under the back, poking out on the right
  }

  function frontSeat(name, seat) {
    // The cushion: grey vinyl with a ribbed cloth cover on its top, the bolsters, a frame and runners; the back: a shell with a cloth inset and a
    // separate headrest on two stems, on a pivot at the base so it tips forward (seatBack_<name>).
    rbox(0.48, 0.1, 0.48, 0.04, trim.vinyl, seat.x, seat.y - 0.08, seat.z + 0.12, root);
    rbox(0.34, 0.02, 0.42, 0.008, trim.cloth, seat.x, seat.y - 0.025, seat.z + 0.12, root);
    for (const sx of [-1, 1]) rbox(0.07, 0.06, 0.46, 0.03, trim.cloth, seat.x + sx * 0.21, seat.y - 0.045, seat.z + 0.12, root);
    rbox(0.42, 0.2, 0.36, 0.02, IN.under, seat.x, seat.y - 0.24, seat.z + 0.1, root);
    const pivot = new THREE.Group();
    pivot.name = `seatBack_${name}`;
    pivot.userData.keep = true;
    pivot.position.set(seat.x, seat.y - 0.04, seat.z - 0.13);
    const lean = new THREE.Group();
    lean.rotation.x = -0.22;
    rbox(0.48, 0.52, 0.1, 0.04, trim.vinyl, 0, 0.26, -0.03, lean);
    rbox(0.34, 0.4, 0.08, 0.01, trim.cloth, 0, 0.25, -0.01, lean);
    for (const sx of [-1, 1]) rbox(0.07, 0.4, 0.13, 0.03, trim.cloth, sx * 0.21, 0.23, 0.0, lean);
    for (const sx of [-0.08, 0.08]) tube([sx, 0.5, -0.03], [sx, 0.6, -0.03], 0.006, IN.chrome, lean, 5); // the headrest's stems
    rbox(0.28, 0.14, 0.08, 0.03, trim.cloth, 0, 0.64, -0.02, lean); // and the headrest
    pivot.add(lean);
    root.add(pivot);
  }

  // The floor, the bulkhead, the dash with its tray, vents, switches and cluster, the console with its radio, the seats and the boot.
  function addInterior() {
    rbox(W - 0.1, 0.03, zs - 0.1 + 0.75, 0.01, trim.floor, 0, 0.26, (zs - 0.1 - 0.75) / 2, root);
    rbox(1.12, 0.03, -0.75 - c.tail - 0.1, 0.01, trim.floor, 0, 0.26, (-0.75 + c.tail + 0.1) / 2, root);
    for (const x of [c.seats.driver.x, c.seats.left.x]) rbox(0.4, 0.008, 0.45, 0.003, trim.mat, x, 0.2785, zs - 0.42, root); // the rubber mats in the footwells
    rbox(W - 0.1, 0.5, 0.04, 0.01, IN.under, 0, 0.5, zs - 0.06, root); // the bulkhead
    rbox(0.16, 0.12, zs - 0.1 - (c.seats.driver.z - 0.2), 0.04, trim.floor, 0, 0.32, (zs - 0.1 + c.seats.driver.z - 0.2) / 2, root); // the tunnel
    for (const s of [-1, 1]) {
      rbox(0.08, 0.3, 0.7, 0.03, trim.trim, s * 0.52, 0.42, -zF, root); // the rear arch inside, beside the back seat
      rbox(0.03, 0.17, c.bPillar - zh - 0.2, 0.01, trim.card, s * (W / 2 - 0.06), 0.8, (c.bPillar + zh) / 2 - 0.05, root); // the rear quarter trim
    }
    // The dash: the grey moulding across under the screen, the binnacle's hood over the driver's dials, the long open tray on the passenger's side
    // with a vent at its outer end and the glovebox under it, two square vents at the top of the centre console.
    const dashTop = ys - 0.02;
    const face = zs - 0.32;
    rbox(W - 0.12, 0.08, 0.32, 0.03, trim.dash, 0, dashTop, zs - 0.17, root);
    rbox(W - 0.12, 0.3, 0.04, 0.02, trim.dash, 0, dashTop - 0.17, face, root); // its face
    // The tray: a recess in the face on the passenger's half (its floor, back and lip), the vent at its outer end.
    // (0.2 to 0.6 across: clear of the centre vents on one side and the end vent on the other, which it overlapped when it was wider)
    const TRAY = { x: 0.39, half: 0.2 };
    rbox(2 * TRAY.half - 0.02, 0.012, 0.12, 0.004, IN.black, TRAY.x, dashTop - 0.1, face - 0.06, root, 'dashTray');
    rbox(2 * TRAY.half, 0.03, 0.012, 0.004, trim.dash, TRAY.x, dashTop - 0.09, face - 0.12, root); // its front lip
    for (const e of [-TRAY.half, TRAY.half]) rbox(0.012, 0.06, 0.12, 0.004, trim.dash, TRAY.x + e, dashTop - 0.07, face - 0.06, root);
    quad.userData.tray = { x: TRAY.x, y: dashTop - 0.094, z: face - 0.06, half: TRAY.half }; // where the CD cases lie (addLitter)
    rbox(2 * TRAY.half - 0.04, 0.13, 0.012, 0.004, trim.dash, TRAY.x, dashTop - 0.2, face - 0.024, root, 'glovebox'); // the glovebox lid
    rbox(0.05, 0.016, 0.008, 0.003, IN.black, TRAY.x, dashTop - 0.16, face - 0.032, root); // its catch
    rbox(0.42, 0.04, 0.12, 0.02, trim.dash, c.seats.driver.x, dashTop + 0.07, face - 0.05, root); // the binnacle's hood
    rbox(0.42, 0.2, 0.04, 0.02, trim.dash, c.seats.driver.x, dashTop - 0.03, face - 0.01, root);
    const dash = buildDash('p309');
    dash.group.position.set(c.seats.driver.x, dashTop - 0.03, face - 0.04);
    dash.group.rotation.x = 0.3;
    dash.group.scale.setScalar(1.5);
    dash.group.userData.keep = true;
    root.add(dash.group);
    quad.userData.dash = dash;
    quad.userData.metalBody = true;
    quad.userData.podMount = null;
    // The vents: a slatted one at each end of the dash, two square ones at the top of the console.
    const vent = (x, y, w, h) => {
      rbox(w, h, 0.02, 0.006, IN.black, x, y, face - 0.025, root, 'vent');
      for (let i = 0; i < Math.round(h / 0.013); i++) rbox(w - 0.016, 0.004, 0.006, 0.002, IN.under, x, y - h / 2 + 0.008 + i * 0.013, face - 0.036, root);
    };
    vent(0.66, dashTop - 0.05, 0.1, 0.06);
    vent(-0.66, dashTop - 0.05, 0.1, 0.06);
    vent(-0.065, dashTop - 0.06, 0.1, 0.08);
    vent(0.065, dashTop - 0.06, 0.1, 0.08);
    // The console: a grey panel from the face down to the tunnel, with a row of round push switches, the heater's two dials and slider, and the radio.
    rbox(0.3, 0.26, 0.1, 0.02, trim.dash, 0, 0.43, face - 0.04, root);
    const switches = {};
    const push = (x, y, name = null) => {
      const g = new THREE.Group();
      if (name) {
        g.name = name;
        g.userData.keep = true;
        switches[name] = g;
      }
      g.position.set(x, y, face - 0.026);
      add(new THREE.CylinderGeometry(0.013, 0.013, 0.012, 14).rotateX(Math.PI / 2), IN.black, g);
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 12).rotateX(Math.PI / 2), IN.steel, g).position.z = -0.007; // its symbol's face
      root.add(g);
    };
    const pushY = dashTop - 0.135;
    [-0.09, -0.045, 0, 0.045].forEach((x, i) => push(x, pushY, i === 3 ? 'pushRadio' : null)); // the heated rear screen, the rear fog, the rear wiper: for show; the last is the radio's
    const hz = addHazardSwitch(root, 0.09, pushY, face - 0.026, { plate: false, w: 0.026, h: 0.026 }); // the hazards, last of the row
    hz.rotation.y = Math.PI;
    for (const x of [-0.07, 0.07]) {
      add(new THREE.CylinderGeometry(0.026, 0.026, 0.012, 18).rotateX(Math.PI / 2), IN.black, root).position.set(x, dashTop - 0.19, face - 0.03); // the heater's dials
      rbox(0.008, 0.03, 0.01, 0.003, IN.steel, x, dashTop - 0.19, face - 0.038, root).rotation.z = x < 0 ? 0.5 : -0.4; // their pointers
    }
    rbox(0.012, 0.03, 0.01, 0.003, IN.steel, 0, dashTop - 0.19, face - 0.03, root); // the slider between them
    const radio = buildRadio('cassette', { w: 0.18, h: 0.05 });
    radio.position.set(0, dashTop - 0.255, face - 0.0225);
    radio.rotation.y = Math.PI;
    root.add(radio);
    quad.userData.liveMaterials.push(radio.userData.faceMaterial);
    const podUpdate = dash.update;
    dash.update = (state) => {
      podUpdate(state);
      radio.userData.setPower(!!state.radioOn && !!state.ignition);
      const g = switches.pushRadio;
      if (g) g.position.z += ((state.radioOn ? face - 0.02 : face - 0.026) - g.position.z) * 0.5; // pushed in while the radio's on
    };

    for (const [name, seat] of Object.entries(c.seats)) frontSeat(name, seat);
    // The back seat: one bench in cloth with two shaped places, and the boot behind it: the carpeted floor, the side trim round the arch humps.
    const rz = c.rear.rearLeft.z;
    rbox(1.12, 0.1, 0.48, 0.04, trim.vinyl, 0, c.rear.rearLeft.y - 0.08, rz + 0.12, root);
    for (const x of [-0.28, 0.28]) rbox(0.38, 0.02, 0.42, 0.008, trim.cloth, x, c.rear.rearLeft.y - 0.025, rz + 0.12, root);
    rbox(1.12, 0.26, 0.4, 0.02, IN.under, 0, 0.37, rz + 0.1, root);
    const back = new THREE.Group();
    back.position.set(0, c.rear.rearLeft.y + 0.2, rz - 0.2);
    back.rotation.x = -0.2;
    rbox(1.12, 0.44, 0.1, 0.04, trim.vinyl, 0, 0, 0, back);
    for (const x of [-0.28, 0.28]) rbox(0.38, 0.32, 0.08, 0.01, trim.cloth, x, 0.0, 0.012, back);
    root.add(back);
    // The parcel shelf: under the glass, from behind the seat back's top to the deck, below the deck's underside (it stuck out through the bustle
    // when it ran to the tail at the waist), and narrower than the boot so the back belts hang clear of it.
    rbox(2 * P309_SHELF.half, 0.012, P309_SHELF.front - P309_SHELF.back, 0.005, trim.trim, 0, P309_SHELF.y, (P309_SHELF.front + P309_SHELF.back) / 2, root, 'parcelShelf');
    const bootFront = P309_BOOT.front;
    rbox(1.46, 0.03, bootFront - (c.tail + 0.015), 0.01, trim.floor, 0, P309_BOOT.floor, (c.tail + 0.015 + bootFront) / 2, root);
    rbox(1.42, P309_BOOT.floor - 0.29, bootFront - (c.tail + 0.015), 0.01, IN.under, 0, (P309_BOOT.floor + 0.29) / 2, (c.tail + 0.015 + bootFront) / 2, root);
    for (const s of [-1, 1]) {
      rbox(0.12, 0.2, 0.6, 0.03, trim.trim, s * 0.5, P309_BOOT.floor + 0.1, -1.26, root); // the arch hump in the boot
      rbox(0.03, 0.3, bootFront - (c.tail + 0.12), 0.01, trim.trim, s * (W / 2 - 0.1), P309_BOOT.floor + 0.17, (bootFront + c.tail + 0.12) / 2, root); // the boot's side trim, behind the tyres
    }
    // The belts: the kit's, the front ones from the B pillar, the back ones from the quarter.
    const outer = W / 2 - 0.1;
    const frontTop = (seat) => halfAt(seat.y + 0.72) - 0.045;
    const reelX = 0.715;
    const belt = (name, seat, inn, postZ, outTop, topY, lowOut, lowY) => {
      const hip = [seat.x, seat.y - 0.05, seat.z - 0.12];
      root.add(buildSeatBelt(name, { top: [outTop, topY, postZ], low: [lowOut, lowY, postZ], buckle: [inn, seat.y + 0.03, seat.z - 0.08], hip, lapOnly: false, mats: { webbing } }));
    };
    belt('driver', c.seats.driver, -0.12, c.bPillar + 0.005, -frontTop(c.seats.driver), c.seats.driver.y + 0.72, -reelX, 0.6);
    belt('left', c.seats.left, 0.12, c.bPillar + 0.005, frontTop(c.seats.left), c.seats.left.y + 0.72, reelX, 0.6);
    const rearTop = (seat) => halfAt(seat.y + 0.6) - 0.03;
    belt('rearLeft', c.rear.rearLeft, 0.1, -1.3, rearTop(c.rear.rearLeft), c.rear.rearLeft.y + 0.6, reelX, 0.74);
    belt('rearRight', c.rear.rearRight, -0.1, -1.3, -rearTop(c.rear.rearRight), c.rear.rearRight.y + 0.6, -reelX, 0.74);
  }

  // The steering wheel and its column, the gear lever, the handbrake and the pedals. No choke: the 309's is a diesel, with glow plugs on the key.
  function addControls() {
    const face = zs - 0.32;
    const column = new THREE.Group();
    column.name = 'steeringColumn';
    column.userData.keep = true;
    column.position.set(c.seats.driver.x, c.columnY, face);
    column.rotation.x = -1.12;
    tube([0, -0.02, 0], [0, c.wheelOut - 0.02, 0], 0.03, IN.black, column);
    rbox(0.1, 0.07, 0.12, 0.025, trim.dash, 0, 0.05, 0, column); // the shroud by the dash, grey
    root.add(column);
    addSignalStalk(column, c.wheelOut - 0.06, IN.black, { modern: true });
    addWiperStalk(column, c.wheelOut - 0.06, IN.black, { modern: true }); // and the wipers' on the right
    const keyHolder = new THREE.Group();
    keyHolder.position.set(-0.052, 0.05, 0.03); // the key on the shroud's right side, the door's
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
    // The 309's big wheel: a thick black rim on two wide spokes that sweep down to a broad horn pad with the maker's shield.
    const rimR = c.rim;
    add(new THREE.TorusGeometry(rimR, 0.017, 8, 32).rotateX(Math.PI / 2), IN.black, wheel);
    rbox(0.24, 0.045, 0.08, 0.02, IN.black, 0, 0, -0.02, wheel); // the horn pad, wide
    for (const a of [Math.PI / 2 + 0.3, -Math.PI / 2 - 0.3]) tube([Math.sin(a) * 0.1, 0, Math.cos(a) * 0.1 - 0.02], [Math.sin(a) * rimR, 0, Math.cos(a) * rimR], 0.02, IN.black, wheel, 6);
    const hub = label(0.03, 0.036, 1000, (g, Wd, H) => {
      g.fillStyle = '#8f9396';
      g.fillRect(0, 0, Wd, H);
      g.fillStyle = '#1b1c1e';
      fitText(g, 'V', Wd / 2, H * 0.5, H * 0.6, Wd * 0.7);
    }, wheel);
    hub.position.set(0, 0.0235, -0.02);
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
    // The gear lever on the floor between the seats, with its gaiter in a tray; the handbrake behind it.
    const gear = new THREE.Group();
    gear.name = 'gearLever';
    gear.userData.keep = true;
    gear.position.set(0, 0.36, zs - 0.62);
    tube([0, 0, 0], [0, 0.26, 0], 0.008, IN.steel, gear, 5);
    add(new THREE.SphereGeometry(0.026, 12, 10).scale(1, 1.2, 1), IN.black, gear).position.set(0, 0.27, 0);
    root.add(gear);
    add(new THREE.CylinderGeometry(0.03, 0.06, 0.06, 12), IN.rubber, root).position.set(0, 0.38, zs - 0.62);
    rbox(0.16, 0.03, 0.22, 0.01, trim.dash, 0, 0.36, zs - 0.62, root); // the console's tray round it
    const hb = new THREE.Group();
    hb.name = 'parkBrakeLever';
    hb.userData.keep = true;
    hb.position.set(0, 0.405, c.seats.driver.z - 0.1);
    rbox(0.035, 0.03, 0.26, 0.012, IN.black, 0, 0, 0.13, hb);
    rbox(0.014, 0.014, 0.02, 0.004, IN.chrome, 0, 0.005, 0.27, hb);
    root.add(hb);
    addPedals(root, { pivot: [0.62, 0.58], foot: [0.36, 0.5], xs: [c.seats.driver.x + 0.17, c.seats.driver.x, c.seats.driver.x - 0.15], widths: [0.07, 0.07, 0.04], padMat: IN.rubber, armMat: IN.steel, ribMat: IN.black });
    for (const name of ['fuelTap', 'chokeLever', 'chokeKnob']) { // Quad poses these on a quad; a diesel car has none
      const g = new THREE.Group();
      g.name = name;
      g.userData.keep = true;
      g.userData.baseZ = 0;
      g.visible = false;
      root.add(g);
    }
  }

  // What lives in it (Jamie): two bottles of pop in the driver's door pocket and a few CD cases in the dash tray.
  function addLitter() {
    const door = root.getObjectByName('doorRight');
    const at = door?.userData.pocket;
    if (at) {
      const bottle = (dz, liquid, cap, tall) => {
        const g = new THREE.Group();
        g.name = 'bottle';
        g.position.set(at[0], at[1], at[2] + dz);
        add(new THREE.CylinderGeometry(0.032, 0.032, tall * 0.7, 12), liquid, g).position.y = tall * 0.35;
        add(new THREE.CylinderGeometry(0.013, 0.032, tall * 0.2, 12), liquid, g).position.y = tall * 0.8; // its shoulder
        add(new THREE.CylinderGeometry(0.014, 0.014, 0.022, 10), cap, g).position.y = tall + 0.011;
        add(new THREE.CylinderGeometry(0.0325, 0.0325, tall * 0.25, 12), new THREE.MeshStandardMaterial({ color: 0xc8302a, roughness: 0.6 }), g).position.y = tall * 0.42; // a label round it
        for (const o of g.children) quad.userData.liveMaterials.push(o.material); // its own look: no mud, no wear
        door.add(g);
      };
      bottle(-0.18, new THREE.MeshStandardMaterial({ color: 0x3a1c0e, roughness: 0.15, transparent: true, opacity: 0.85 }), new THREE.MeshStandardMaterial({ color: 0xb02020, roughness: 0.5 }), 0.24); // cola, half drunk
      bottle(0.12, new THREE.MeshStandardMaterial({ color: 0xaecbd6, roughness: 0.1, transparent: true, opacity: 0.6 }), new THREE.MeshStandardMaterial({ color: 0x2a62b8, roughness: 0.5 }), 0.22); // water
    }
    const tray = quad.userData.tray;
    const cdCase = (dx, dz, yaw, colour, title, layer) => {
      const g = new THREE.Group();
      g.position.set(tray.x + dx, tray.y + 0.009 + layer * 0.012, tray.z + dz);
      g.rotation.y = yaw;
      quad.userData.liveMaterials.push(rbox(0.142, 0.01, 0.125, 0.002, new THREE.MeshStandardMaterial({ color: 0x202224, roughness: 0.3 }), 0, 0, 0, g).material); // the case
      const cover = label(0.12, 0.12, 900, (cx, Wd, H) => {
        cx.fillStyle = colour;
        cx.fillRect(0, 0, Wd, H);
        cx.fillStyle = 'rgba(255,255,255,0.85)';
        fitText(cx, title, Wd / 2, H * 0.2, H * 0.12, Wd * 0.8);
      }, g);
      cover.material.transparent = false;
      cover.rotation.set(-Math.PI / 2, 0, Math.PI); // lying flat, the top of its cover away from you, so it reads from the driver's seat
      quad.userData.liveMaterials.push(cover.material); // the mud coat leaves the covers alone
      cover.position.y = 0.0055;
      root.add(g);
    };
    cdCase(-0.077, 0.0, 0.05, '#3b5f8a', 'NOW 37', 0); // two side by side across the tray...
    cdCase(0.08, 0.0, -0.05, '#c2a23a', 'HITS 98', 0);
    cdCase(-0.02, 0.0, 0.3, '#2d2d2d', 'DRIVING', 1); // ...and one dropped on top of them
  }

  function addAnchors() {
    const tip = new THREE.Object3D();
    tip.name = 'exhaustTip';
    tip.position.set(-0.42, 0.2, c.tail - 0.05);
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
    const wheelModel = buildWheel(w);
    wheelModel.name = w.name;
    quad.add(wheelModel);
  }
  addHeadlightBeams(quad);
  addSignalLamps(quad, PAL.amber, PAL.smoke);
  quad.userData.tailMaterial = tailMat;
  quad.userData.tailHaloMaterial = new THREE.SpriteMaterial({ transparent: true, opacity: 0 });
  quad.userData.tailHalos = [];
  mergeStatic(root);
  quad.userData.cleanMaterials = [trim.vinyl, trim.cloth, trim.floor, trim.dash, trim.card, trim.lining, trim.trim, trim.mat, PAL.strap, ...Object.values(IN)];
  quad.userData.cabin = { min: [-c.width / 2, c.sill, c.hatchBottom[0]], max: [c.width / 2, c.screenTop[1] + 0.1, c.screenBase[0]] };
  const casts = new Set([paint, PAL.rubber, PAL.black, PAL.under, PAL.chrome, PAL.bumper]);
  quad.traverse((o) => {
    if (!o.isMesh || o.material === PAL.glass) return;
    o.castShadow = casts.has(o.material);
    o.receiveShadow = true;
  });
  return quad;
}

/** The wheels' places (the layout's, without importing it, so carModel.js can import this file): the front two steer. */
function wheels309() {
  const wheelY = c.R + 0.16 - 0.45;
  return [
    { name: 'wheel_fl', x: c.track / 2, z: zF, front: true, radius: c.R, y: wheelY },
    { name: 'wheel_fr', x: -c.track / 2, z: zF, front: true, radius: c.R, y: wheelY },
    { name: 'wheel_rl', x: c.track / 2, z: -zF, front: false, radius: c.R, y: wheelY, driven: false },
    { name: 'wheel_rr', x: -c.track / 2, z: -zF, front: false, radius: c.R, y: wheelY, driven: false },
  ];
}

/** Lifts the hatch, 0 (shut) to 1 (swung up and back on its hinge), and stretches the two gas struts between the body and it. */
export function pose309Hatch(model, open) {
  const hatch = part(model, 'hatch');
  if (!hatch || !hatch.userData.keep) return;
  hatch.rotation.x = P309_HATCH.open * open;
  hatch.updateMatrix();
  for (const name of ['hatchStrutLeft', 'hatchStrutRight']) {
    const strut = part(model, name);
    if (!strut) continue;
    const end = new THREE.Vector3(...strut.userData.hatchEnd).applyMatrix4(hatch.matrix);
    const way = end.sub(strut.position);
    strut.scale.z = Math.max(0.001, way.length());
    strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), way.normalize());
  }
}
