import * as THREE from 'three';
import { buildDash, addIgnitionKey } from './dash.js';
import { addHeadlightBeams, addSignalLamps, addSignalStalk, addHazardSwitch } from './quadModel.js';
import { mergeStatic } from './quadGeometry.js';
import { add, post, rbox as roundedBox, label, plate, fitText, canvasTexture, seeded, tube, axleCyl, addPedals } from './landRoverModel.js';
import { treadTyre } from './detail/tread.js';
import { buildRoadWheel } from './detail/roadWheels.js';
import { buildSeatBelt, webbingMaterial } from './detail/belts.js';
import { buildWiper } from './detail/fittings.js';
import { buildRadio } from './detail/radios.js';
import { CORSA_BODY, CORSA_DOOR, CORSA_HATCH, CORSA_TAIL_LAMP, CORSA_BOOT, CORSA_BUMPER, CORSA_R, CORSA_TYRE_W, CORSA_RIDE_LIFT } from './corsaBody.js';

// The Corsa B at its real size (TODO 103), built from corsaBody.js's numbers after the photos. Driven by Quad through the same named parts as the
// Land Rovers' and the Fiesta's (carModel.js: steeringColumn > handlebars, dash, gearLever, parkBrakeLever, chokeKnob (hidden: it is injected),
// seatBack_driver and seatBack_left that tip, riderAnchor, seatLeft, seatRearLeft, seatRearRight, the cameras, exhaustTip, belt_<seat>), plus:
//
//   doorLeft, doorRight    groups hinged on their front edges: poseSeriesDoors swings them (the dirt on them goes with them: `mudRest`)
//   hatch                  a group hinged along the roof's rear edge, with the glass, the spoiler, the deck, the tail lamps and the plate: poseCorsaHatch lifts it on T
//   hatchStrutLeft/Right   the gas struts, stretched and aimed by poseCorsaHatch between the body and the hatch
//   pedalClutch, pedalBrake, pedalAccel   swung by poseCarControls

const c = CORSA_BODY;
const W = c.width;
const zF = c.wheelbase / 2;
const [zs, ys] = c.screenBase;
const [zt, yt] = c.screenTop;
const [zr, yr] = c.roofRear;
const [zh, yh] = c.hatchBottom;
const FACE = W / 2 - 0.02; // the body side's middle: panels are 3.5 cm thick across it
const OUT = FACE + 0.0175; // the side's outer face
const INNER = FACE - 0.0175; // and its inner face
const ARCH = { y: c.R + 0.03, r: c.R + 0.07 };
const NOSE_LOW = 0.45; // the body's lower edge at the nose and the tail, inside the bumpers' plastic
const WING_END = c.nose - 0.28; // where the front wing stops, behind the front corner (the apron wraps it)

/** A box with its edges rounded, or, up to a 12 mm radius, a plain one: watertight where boxes butt (rounded ones leave pinholes at the corners, see defenderModel.js). */
function rbox(w, h, d, r, mat, x, y, z, parent, name) {
  if (r > 0.012) return roundedBox(w, h, d, r, mat, x, y, z, parent, name);
  const m = add(new THREE.BoxGeometry(w, h, d), mat, parent, name);
  m.position.set(x, y, z);
  return m;
}

/** The upper line sampled smoothly from the nose back (the Corsa is all curves): [[z, y], ...]. */
const LINE = new THREE.SplineCurve(c.upper.map(([z, y]) => new THREE.Vector2(z, y))).getPoints(64).map((v) => [v.x, v.y]);

/** The top of the body's side at z. */
function upperAt(z) {
  if (z >= LINE[0][0]) return LINE[0][1];
  for (let i = 1; i < LINE.length; i++) {
    const [z0, y0] = LINE[i - 1];
    const [z1, y1] = LINE[i];
    if (z >= z1) return y0 + ((y1 - y0) * (z0 - z)) / (z0 - z1 || 1);
  }
  return LINE[LINE.length - 1][1];
}

/** The glasshouse's half width at height y: the body's at the waist, drawn in (tumblehome) towards the roof. */
export const halfAt = (y) => W / 2 - 0.05 - (y - ys) * c.tumble;

const archDz = () => Math.sqrt(Math.max(0, ARCH.r * ARCH.r - (c.sill - ARCH.y) ** 2));

/** A body side piece: the front wing (from the nose back to the door's front edge) or the rear quarter (from the door's rear edge to the tail), arches cut in. */
export function sidePiece(part) {
  const dz = archDz();
  const start = Math.atan2(c.sill - ARCH.y, dz);
  const s = new THREE.Shape();
  if (part === 'front') {
    s.moveTo(WING_END, NOSE_LOW);
    s.lineTo(zF + dz + 0.0, c.sill);
    s.absarc(zF, ARCH.y, ARCH.r, start, Math.PI - start, false);
    s.lineTo(zF - dz, c.sill);
    s.lineTo(CORSA_DOOR.hinge, c.sill);
    s.lineTo(CORSA_DOOR.hinge, upperAt(CORSA_DOOR.hinge));
    for (const [z, y] of LINE.filter(([z]) => z > CORSA_DOOR.hinge && z < WING_END).reverse()) s.lineTo(z, y);
    s.lineTo(WING_END, upperAt(WING_END)); // the wing stops at the corner; the front apron carries on round it
  } else {
    s.moveTo(CORSA_DOOR.rear, c.sill);
    s.lineTo(-zF + dz, c.sill);
    s.absarc(-zF, ARCH.y, ARCH.r, start, Math.PI - start, false);
    s.lineTo(-zF - dz, c.sill);
    s.lineTo(c.tail, NOSE_LOW);
    for (let i = LINE.length - 1; i >= 0; i--) if (LINE[i][0] < CORSA_DOOR.rear) s.lineTo(LINE[i][0], LINE[i][1]);
    s.lineTo(CORSA_DOOR.rear, upperAt(CORSA_DOOR.rear));
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


/** The body sides lean in towards the roof (the Corsa B is barrel-shaped, not slab-sided): panels hang in a group turned about the sill's line. */
const TILT = 0.05;
function tiltGroup(s, parent) {
  const g = new THREE.Group();
  g.position.set(s * FACE, c.sill, 0);
  g.rotation.z = s * TILT;
  parent.add(g);
  return g;
}

/** The half width of the nose in plan at z: full `hw0` back of the corner, drawn in round a corner of radius `R` at the front. */
function planHalf(z, hw0, R) {
  const z0 = c.nose - R;
  return z <= z0 ? hw0 : hw0 - (R - Math.sqrt(Math.max(0, R * R - (z - z0) ** 2)));
}

/**
 * A crowned, closed sheet of metal from z0 to z1 (the bonnet): its top follows `topAt(z)` at the edges and rises `crown` in the middle, `halfAt(z)`
 * wide (it narrows to round the nose in plan), `t` thick. Smooth normals, so it reads as curved.
 */
function loft(z0, z1, topAt, halfW, crown, t, mat, parent, bottom) {
  const n = 18;
  const m = 10;
  const pos = [];
  const at = (i, j, isBottom) => {
    const z = z0 + ((z1 - z0) * i) / n;
    const u = -1 + (2 * j) / m;
    const y = isBottom ? (bottom ?? topAt(z) - t) : topAt(z) + crown * (1 - u * u);
    return [u * halfW(z), y, z];
  };
  const idx = (i, j, b) => (b * (n + 1) + i) * (m + 1) + j;
  for (const b of [0, 1]) for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) pos.push(...at(i, j, b));
  const tri = [];
  const quad = (a, b2, c2, d) => tri.push(a, b2, c2, a, c2, d);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    quad(idx(i, j, 0), idx(i + 1, j, 0), idx(i + 1, j + 1, 0), idx(i, j + 1, 0)); // top
    quad(idx(i, j, 1), idx(i, j + 1, 1), idx(i + 1, j + 1, 1), idx(i + 1, j, 1)); // underside
  }
  for (let i = 0; i < n; i++) for (const j of [0, m]) quad(idx(i, j, 0), idx(i + 1, j, 0), idx(i + 1, j, 1), idx(i, j, 1)); // the two edges
  for (const i of [0, n]) for (let j = 0; j < m; j++) quad(idx(i, j, 0), idx(i, j + 1, 0), idx(i, j + 1, 1), idx(i, j, 1)); // the two ends
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(tri);
  g.computeVertexNormals();
  return add(g, mat, parent, 'bonnet');
}

/** The maker's round badge (Ashby: the makers are made up), `size` across, a label facing +z to put on the nose and, turned half a turn, the tail. */
function makerBadge(size, parent) {
  return label(size, size, 800, (g, Wd, H) => {
    g.fillStyle = '#d8dadc';
    g.beginPath();
    g.arc(Wd / 2, H / 2, Wd / 2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2a2b2d';
    g.beginPath();
    g.arc(Wd / 2, H / 2, Wd * 0.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d8dadc';
    fitText(g, 'A', Wd / 2, H / 2 + H * 0.03, H * 0.5, Wd * 0.5);
  }, parent);
}

// Materials, made once --------------------------------------------------------------------

const PAL = {
  rubber: new THREE.MeshStandardMaterial({ color: 0x1a1a19, roughness: 0.95 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1b1c1d, roughness: 0.7 }),
  plastic: new THREE.MeshStandardMaterial({ color: 0x2a2b2d, roughness: 0.75 }), // the bumpers, the arch trim, the sills: black plastic gone grey
  chrome: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.22, metalness: 0.9 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.5, metalness: 0.6 }),
  under: new THREE.MeshStandardMaterial({ color: 0x18191a, roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9fb3b8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
  amber: new THREE.MeshStandardMaterial({ color: 0xb8700f, roughness: 0.25 }), // an amber lens, brighter when it flashes (addSignalLamps)
  smoke: new THREE.MeshStandardMaterial({ color: 0x4d5254, roughness: 0.2 }), // the reverse lens, smoked until it lights
  fog: new THREE.MeshStandardMaterial({ color: 0x5a110d, roughness: 0.2 }),
  rust: new THREE.MeshStandardMaterial({ color: 0x4b3a2e, roughness: 0.7, metalness: 0.5 }),
  primer: new THREE.MeshStandardMaterial({ color: 0x8d9092, roughness: 0.85, side: THREE.DoubleSide }), // the grey wing, never painted
  grille: new THREE.MeshStandardMaterial({ color: 0x1d1e20, roughness: 0.5 }),
  red: new THREE.MeshStandardMaterial({ color: 0xb02018, roughness: 0.35 }),
  wheelTrim: new THREE.MeshStandardMaterial({ color: 0xb4b8bb, roughness: 0.4, metalness: 0.5 }), // the full wheel trim's silver
  bare: new THREE.MeshStandardMaterial({ color: 0x1e1f21, roughness: 0.6, metalness: 0.4 }), // the bare black steel wheel where the trim has gone
};

/** The inside: grey fleck cloth and a charcoal dash, Jess's lurid buckets in front. Made when a Corsa is built (they need a canvas). */
function trimMaterials() {
  const grain = (g, w, h, rand, n = 900) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.2)';
      g.fillRect(rand() * w, rand() * h, 1.5, 1.5);
    }
  };
  // The rear bench's cloth: grey with small flecks of blue, red and green, as the photo's.
  const fleck = canvasTexture(128, 128, (g, w, h) => {
    const rand = seeded(33);
    g.fillStyle = '#4d5056';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = ['#c0463c', '#3c78c0', '#40a46a'][i % 3];
      g.fillRect(rand() * w, rand() * h, 4, 2);
    }
    grain(g, w, h, rand, 1200);
  }, { repeat: [2, 2] });
  const plainTex = canvasTexture(64, 64, (g, w, h) => {
    const rand = seeded(8);
    g.fillStyle = '#3a3c40';
    g.fillRect(0, 0, w, h);
    grain(g, w, h, rand, 700);
  }, { repeat: [2, 2] });
  const carpetTex = canvasTexture(64, 64, (g, w, h) => {
    const rand = seeded(5);
    g.fillStyle = '#2c2d2f';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.25)';
      g.fillRect(rand() * w, rand() * h, 1, 1);
    }
  }, { repeat: [4, 4] });
  // Jess's sports seats, after a mid-2000s Recaro: a dark charcoal cloth with a fine weave and a few red threads in it between black bolsters.
  const loud = canvasTexture(128, 128, (g, w, h) => {
    const rand = seeded(47);
    g.fillStyle = '#24252a';
    g.fillRect(0, 0, w, h);
    g.lineWidth = 1;
    for (let i = -h; i < w; i += 6) { // the weave: crossed fine diagonals
      g.strokeStyle = 'rgba(120,124,134,0.22)';
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + h, h);
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.beginPath();
      g.moveTo(i + h, 0);
      g.lineTo(i, h);
      g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(168,40,34,0.7)';
      g.fillRect(rand() * w, rand() * h, 3, 1);
    }
  }, { repeat: [2, 2] });
  return {
    bucket: new THREE.MeshStandardMaterial({ map: loud, roughness: 0.95 }),
    bolster: new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.7 }), // the seats' black bolsters, in vinyl
    seat: new THREE.MeshStandardMaterial({ map: fleck, roughness: 0.95 }),
    band: new THREE.MeshStandardMaterial({ map: plainTex, roughness: 0.95 }), // the plain centre band of the rear bench
    floor: new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 1 }),
    dash: new THREE.MeshStandardMaterial({ color: 0x2f3032, roughness: 0.8 }), // the dash's moulding, charcoal
    card: new THREE.MeshStandardMaterial({ color: 0x3a3b3e, roughness: 0.75 }), // the door cards
    lining: new THREE.MeshStandardMaterial({ color: 0x9a9b98, roughness: 0.95, side: THREE.DoubleSide }), // the headlining
    trim: new THREE.MeshStandardMaterial({ color: 0x232426, roughness: 0.85 }), // the boot's side trim
  };
}

// Wheels -------------------------------------------------------------------------------

function buildWheel(w, bareWheel) {
  const side = Math.sign(w.x);
  const wheel = new THREE.Group();
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  wheel.add(spin);
  const rimR = 0.165;
  spin.add(new THREE.Mesh(treadTyre('road', { radius: c.R, width: CORSA_TYRE_W, rimR, segments: 36 }), PAL.rubber));
  // A silver full wheel trim over the steel wheel, as in the photos; the bare black wheel with its nuts where the trim has come off (Jess's back right).
  // The kit's wheel is built for the +x side (mirrored, its lathed face shows black), so the driver's side is the same wheel turned half a turn about y.
  const kit = bareWheel
    ? buildRoadWheel('steel', { rimR: rimR - 0.004, width: CORSA_TYRE_W - 0.02, side: 1, nuts: 4, mats: { rim: PAL.bare, steel: PAL.chrome } })
    : buildRoadWheel('trim', { rimR: rimR - 0.004, width: CORSA_TYRE_W - 0.02, side: 1, nuts: 4, mats: { rim: PAL.wheelTrim, cap: PAL.wheelTrim } });
  if (side < 0) kit.rotation.y = Math.PI;
  spin.add(kit);
  // The inside of the wheel: a pressed steel disc across the barrel on the inner side with the hub standing out of it, so it is not hollow from behind.
  axleCyl(rimR - 0.006, 0.012, PAL.steel, -side * (CORSA_TYRE_W / 2 - 0.045), 0, 0, spin);
  axleCyl(0.05, 0.05, PAL.steel, -side * (CORSA_TYRE_W / 2 - 0.06), 0, 0, spin);
  wheel.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  mergeStatic(wheel);
  return wheel;
}

// The car -------------------------------------------------------------------------------

export function buildCorsaModel({ bodyColor = 0xb8322e, reg = null } = {}) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6, side: THREE.DoubleSide });
  // The roof, the bonnet and the nose have faded in the sun: a paler, chalkier red.
  const faded = new THREE.MeshStandardMaterial({ color: new THREE.Color(bodyColor).lerp(new THREE.Color(0xe8b0a8), 0.35), roughness: 0.8, side: THREE.DoubleSide });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0xc4cccf, roughness: 0.1, metalness: 0.2, emissive: 0x000000 }); // clear glass over the reflector: pale, with the black housing round it
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x9a1812, roughness: 0.25, emissive: 0x000000 });
  const trim = trimMaterials();
  const webbing = webbingMaterial();
  const layoutWheels = corsaWheels();
  const reg_ = reg ?? c.plate;

  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  quad.userData.seatMaterial = trim.bucket;
  quad.userData.carKind = 'corsa';
  quad.userData.steerGain = 6; // about three and a half turns lock to lock
  quad.userData.liveMaterials = [];
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const bodyRoot = new THREE.Group();
  bodyRoot.name = 'bodyRoot';
  body.add(bodyRoot);
  const root = new THREE.Group(); // everything but the wheels, raised on them (CORSA_RIDE_LIFT)
  root.position.y = CORSA_RIDE_LIFT;
  bodyRoot.add(root);

  addBody();
  addDoors();
  addGlasshouse();
  addHatch();
  addFrontEnd();
  addRear();
  addInterior();
  addControls();
  addJess();
  addAnchors();

  // The body sides: the wing in front of the door (the left one in grey primer: a replacement never painted) and the quarter behind it (the door is its
  // own group, below), the black arch trim round all four arches, the black sills, the arches' liners and the inner wings so you cannot see through
  // them, the engine.
  function addBody() {
    for (const s of [-1, 1]) {
      const tg = tiltGroup(s, root); // the wing, the quarter and what is fixed to them lean in together
      const lean = (m) => { m.position.x -= s * FACE; m.position.y -= c.sill; return m; };
      lean(extrudeZY(sidePiece('front'), 0.035, s * FACE, s > 0 ? PAL.primer : paint, tg, 'wing'));
      lean(extrudeZY(sidePiece('rear'), 0.035, s * FACE, paint, tg, 'quarter'));
      rbox(0.05, 0.108, CORSA_DOOR.hinge - CORSA_DOOR.rear + 0.2, 0.01, PAL.plastic, s * (FACE + 0.003), c.sill + 0.049, (CORSA_DOOR.hinge + CORSA_DOOR.rear) / 2, root, 'sill'); // the black plastic sill under the door
      lean(rbox(0.01, 0.022, CORSA_DOOR.rear - 0.02 - (-0.84), 0.006, PAL.black, s * (OUT + 0.004), 0.62, (CORSA_DOOR.rear - 0.02 - 0.84) / 2, tg)); // on the quarter it stops short of the arch's trim, not through it
      for (const zc of [zF, -zF]) {
        const liner = add(new THREE.CylinderGeometry(ARCH.r - 0.008, ARCH.r - 0.008, 0.24, 16, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95, side: THREE.DoubleSide }), root);
        liner.position.set(s * (W / 2 - 0.15), ARCH.y, zc);
        rbox(0.26, 0.04, 0.7, 0.01, PAL.under, s * (W / 2 - 0.15), ARCH.y + ARCH.r + 0.01, zc, root); // the arch's roof
        // The black plastic arch trim: a half ring standing 5 cm out of the paint round the arch's edge, a wide chunky lip as in the photos.
        const ring = new THREE.Shape();
        ring.absarc(zc, ARCH.y, ARCH.r + 0.05, 0.12, Math.PI - 0.12, false);
        ring.absarc(zc, ARCH.y, ARCH.r - 0.004, Math.PI - 0.12, 0.12, true);
        const g = new THREE.ExtrudeGeometry(ring, { depth: 0.025, bevelEnabled: false, curveSegments: 20 });
        g.rotateY(-Math.PI / 2); // runs along -x from 0 to -0.025
        g.translate(s > 0 ? OUT + 0.016 : -OUT + 0.009, 0, 0); // standing 1.6 cm out of the paint, clear of the body-side moulding (1 cm)
        add(g, PAL.plastic, root);
      }
      rbox(0.03, 0.5, 1.0, 0.01, PAL.under, s * (c.track / 2 - CORSA_TYRE_W / 2 - 0.05), 0.48, (zs + c.nose) / 2 - 0.05, root); // the inner wing
      rbox(0.03, 0.4, 0.75, 0.01, PAL.under, s * (c.track / 2 - CORSA_TYRE_W / 2 - 0.05), 0.5, -zF, root);
    }
    rbox(0.55, 0.4, 0.5, 0.05, PAL.steel, 0, 0.5, zF - 0.05, root); // the engine, across the car
  }

  // Each door: a group on its front hinge, the lower panel with its handle, the window and its frame, the big mirror, the card inside. Local z runs
  // back from the hinge, so a door opens by turning about y.
  function addDoors() {
    const D = CORSA_DOOR;
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
      for (let k = 1; k < 8; k++) {
        const z = D.rear + ((D.hinge - D.rear) * k) / 8;
        panel.lineTo(z - D.hinge, upperAt(z));
      }
      panel.lineTo(0, upperAt(D.hinge));
      panel.closePath();
      const dt = new THREE.Group(); // the door's skin leans in with the body's sides (TILT) about the sill's line
      dt.position.y = c.sill;
      dt.rotation.z = s * TILT;
      d.add(dt);
      const dl = (m) => { m.position.y -= c.sill; return m; };
      dl(extrudeZY(panel, 0.035, 0, paint, dt, 'doorPanel'));
      // The handle: a small black pull at the back of the door in a dark recess, and the lock above it.
      dl(rbox(0.004, 0.05, 0.16, 0.002, PAL.black, s * 0.0195, ys - 0.1, lz(D.rear) + 0.14, dt)); // its recess
      dl(rbox(0.014, 0.026, 0.12, 0.007, PAL.plastic, s * 0.0245, ys - 0.1, lz(D.rear) + 0.14, dt, 'doorHandle'));
      dl(rbox(0.01, 0.022, len - 0.06, 0.006, PAL.black, s * 0.0225, 0.62, -len / 2, dt)); // the thin black moulding along the door, on the door so it swings with it
      for (const z of [-0.003, -len + 0.003]) dl(rbox(0.006, upperAt(D.rear) - D.bottom - 0.01, 0.005, 0.002, PAL.black, s * 0.0205, (D.bottom + upperAt(D.rear)) / 2, z, dt)); // the shut lines at the door's two edges
      // The window: a glass leaning in as the glasshouse does, between the A pillar's line and the door's rear edge.
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
      // The frame, in the window's own (leaning) frame: a body-colour upright up the raked front edge, the top rail and the rear upright, round the whole glass.
      const fr = (a, b) => post([0, ...a], [0, ...b], 0.034, 0.034, paint, win);
      fr([0, 0], [yt - ys, zt - D.hinge]);
      fr([yt - ys + 0.005, zt - D.hinge], [yt - ys + 0.005, -len]);
      fr([0, -len + 0.015], [yt - ys, -len + 0.015]);
      rbox(0.026, 0.026, len - 0.02, 0.01, PAL.black, x0 + s * 0.003, ys + 0.008, -len / 2, d); // the black seal along the glass's foot
      // The mirror: a big rounded black housing on a short arm at the front top corner of the door, on the door (so it swings with it).
      const mirror = new THREE.Group();
      mirror.name = 'mirror';
      mirror.userData.keep = true;
      mirror.position.set(s * 0.015, ys + 0.06, -0.06);
      rbox(0.07, 0.04, 0.06, 0.012, PAL.black, 0, 0, 0, mirror); // its foot on the door
      rbox(0.16, 0.1, 0.07, 0.035, PAL.black, s * 0.1, 0.04, -0.02, mirror); // the housing, rounded
      rbox(0.13, 0.075, 0.004, 0.003, PAL.glass, s * 0.1, 0.04, -0.0575, mirror); // and its glass, facing back
      d.add(mirror);
      // The card on the inside: grey, with the arm rest and its pull, a map pocket under, the winder and the lock button.
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
    const pr = 0.032;
    const cz0 = c.bPillar - (c.bPillar - zr) * 0.62; // the quarter window's back edge, at the roof
    for (const s of [-1, 1]) {
      tube([s * halfAt(ys), ys, zs], [s * halfAt(yt), yt, zt], pr, faded, root, 8); // the A pillar
      tube([s * halfAt(ys), ys, c.bPillar], [s * halfAt(yt), yt - 0.01, c.bPillar], 0.04, faded, root, 6); // the B pillar
      tube([s * halfAt(yt), yt, zt], [s * halfAt(yr), yr, zr], pr, faded, root, 8); // the rail over the windows
      tube([s * halfAt(yr), yr, zr], [s * halfAt(yh), yh, zh], pr + 0.005, faded, root, 8); // the hatch's edge
      const lean = (shape, inset, mat, name) => {
        const g = new THREE.Group();
        g.position.set(s * (halfAt(ys) - inset), ys, 0);
        g.rotation.z = s * Math.atan(c.tumble);
        add(new THREE.ShapeGeometry(shape).rotateY(-Math.PI / 2).translate(0, -ys, 0), mat, g, name);
        root.add(g);
      };
      // The rear quarter: the fixed glass between the B pillar and the slanted C pillar, and the C pillar's painted panel behind it.
      const glass = new THREE.Shape();
      glass.moveTo(c.bPillar - 0.03, ys);
      glass.lineTo(c.bPillar - 0.03, yr - 0.03);
      glass.lineTo(cz0, yr - 0.03);
      glass.lineTo(cz0 - 0.12, ys);
      glass.closePath();
      lean(glass, 0.01, PAL.glass, 'quarterGlass');
      const cp = new THREE.Shape();
      cp.moveTo(cz0, yr - 0.03);
      cp.lineTo(zr + 0.02, yr);
      cp.lineTo(zr - 0.04, yr);
      cp.lineTo(zh, yh);
      cp.lineTo(zh, ys);
      cp.lineTo(cz0 - 0.12, ys);
      cp.closePath();
      lean(cp, -0.006, faded, 'cPillar');
      rbox(0.03, 0.025, c.bPillar - zh, 0.01, PAL.black, s * (halfAt(ys) + 0.005), ys + 0.01, (c.bPillar + zh) / 2, root); // the quarter's seal along its foot
    }
    // The roof's frame closes at the back across the top of the hatch, and the rails' ends are capped with a ball at each corner, so no tube ends in the air.
    tube([-halfAt(yr), yr, zr], [halfAt(yr), yr, zr], pr + 0.005, faded, root, 8);
    for (const s of [-1, 1]) {
      for (const [z, y] of [[zr, yr], [zt, yt], [zh, yh]]) add(new THREE.SphereGeometry(pr + 0.003, 10, 8), faded, root).position.set(s * halfAt(y), y, z);
    }
    // The windscreen in its black rubber, the roof, the headlining and the sun visors.
    quadMesh([-halfAt(ys), ys, zs], [halfAt(ys), ys, zs], [halfAt(yt), yt, zt], [-halfAt(yt), yt, zt], PAL.glass, root);
    tube([-halfAt(ys), ys, zs], [halfAt(ys), ys, zs], 0.03, PAL.black, root, 6); // the screen's bottom seal
    tube([-halfAt(yt), yt, zt], [halfAt(yt), yt, zt], 0.03, faded, root, 6); // and its top rail
    const roofW = 2 * halfAt(yt) + 0.06;
    const roofLen = Math.hypot(zt - zr, yt - yr);
    const arc = new THREE.Shape();
    arc.moveTo(-roofW / 2, 0);
    arc.quadraticCurveTo(0, 0.11, roofW / 2, 0);
    arc.lineTo(roofW / 2, -0.03);
    arc.quadraticCurveTo(0, 0.08, -roofW / 2, -0.03);
    arc.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(arc, { depth: roofLen + 0.06, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -(roofLen + 0.06) / 2); // ends 3 cm past the header and the hatch's rail, not over them
    const roof = add(roofGeo, faded, root, 'roof');
    roof.position.set(0, (yt + yr) / 2 + 0.035, (zt + zr) / 2);
    roof.rotation.x = Math.atan2(yt - yr, zt - zr) * -1;
    // The headlining: a crowned sheet hard against the roof's underside (the same curve, 3 mm under it), so it is joined to the roof from outside too.
    const ln = new THREE.Shape();
    ln.moveTo(-roofW / 2 + 0.03, -0.033);
    ln.quadraticCurveTo(0, 0.08 - 0.006, roofW / 2 - 0.03, -0.033);
    ln.lineTo(roofW / 2 - 0.03, -0.045);
    ln.quadraticCurveTo(0, 0.08 - 0.018, -roofW / 2 + 0.03, -0.045);
    ln.closePath();
    const lining = add(new THREE.ExtrudeGeometry(ln, { depth: roofLen - 0.06, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -(roofLen - 0.06) / 2), trim.lining, root, 'lining');
    lining.position.copy(roof.position);
    lining.rotation.copy(roof.rotation);
    // The sun visors: flat boards folded up against the lining (their height under the lining's curve at their x), in its slope.
    for (const x of [-0.42, 0.42]) {
      const t = 0.5 + x / (roofW - 0.06); // where along the lining's curve
      const visor = rbox(0.36, 0.012, 0.2, 0.004, trim.lining, x, roof.position.y - 0.045 + 2 * t * (1 - t) * 0.107 - 0.012, roof.position.z + 0.5 * roofLen * 0.82 - 0.0, root);
      visor.rotation.copy(roof.rotation);
      visor.position.y += (visor.position.z - roof.position.z) * Math.tan(roof.rotation.x) * -1;
    }
    // The wipers: the kit's, parked along the foot of the screen, their spindles in the scuttle below the glass.
    for (const [x, ang] of [[-0.5, 0.06], [0.08, 0.06]]) {
      const wiper = buildWiper({ len: 0.5, mats: { arm: PAL.black } });
      wiper.position.set(x, ys + 0.022, zs + 0.03);
      wiper.rotation.set(-Math.atan2(yt - ys, zs - zt), 0, ang);
      wiper.rotation.order = 'YXZ';
      root.add(wiper);
    }
    // The rear-view mirror at the top of the screen, in the middle, on its stem from the header.
    rbox(0.2, 0.06, 0.02, 0.01, PAL.black, 0, yt - 0.15, zt - 0.06, root);
    tube([0, yt - 0.01, zt - 0.03], [0, yt - 0.12, zt - 0.06], 0.008, PAL.black, root, 5);
  }

  // The hatch: a group hinged along the roof's rear edge (the origin is the hinge), the glass in its black rubber, Jess's spoiler over it, the deck below
  // and the tail panel down to the bumper, the big tail lamps in its lower corners, the black handle and the plate; two gas struts join it to the body.
  function addHatch() {
    const H = CORSA_HATCH;
    const hatch = new THREE.Group();
    hatch.name = 'hatch';
    hatch.userData.keep = true;
    hatch.position.set(0, yr, zr);
    hatch.userData.mudRest = [0, yr, zr];
    const hz = (z) => z - zr; // car z to the hatch's own
    const hy = (y) => y - yr;
    const half = halfAt(yh) - 0.02;
    quadMesh([-halfAt(yr) + 0.02, 0, 0], [halfAt(yr) - 0.02, 0, 0], [half, hy(yh), hz(zh)], [-half, hy(yh), hz(zh)], PAL.glass, hatch);
    const edge = (a, b, r = 0.016) => tube(a, b, r, PAL.black, hatch, 6);
    edge([-halfAt(yr) + 0.02, 0, 0], [halfAt(yr) - 0.02, 0, 0]);
    edge([-half, hy(yh), hz(zh)], [half, hy(yh), hz(zh)]);
    edge([-halfAt(yr) + 0.02, 0, 0], [-half, hy(yh), hz(zh)]);
    edge([halfAt(yr) - 0.02, 0, 0], [half, hy(yh), hz(zh)]);
    // The deck below the glass and the tail panel down to the bumper.
    const deckW = 2 * INNER - 0.005; // spans to the quarters' inner faces
    const deck = new THREE.Shape();
    deck.moveTo(hz(zh), hy(yh));
    deck.lineTo(hz(c.tail + 0.02), hy(upperAt(c.tail + 0.02)));
    deck.lineTo(hz(c.tail + 0.02), hy(upperAt(c.tail + 0.02)) - 0.03);
    deck.lineTo(hz(zh), hy(yh) - 0.03);
    deck.closePath();
    extrudeZY(deck, 2 * (INNER - 0.04), 0, faded, hatch); // the deck leans in with the quarters (TILT), so it is narrower than the panel under it
    const tailTop = upperAt(c.tail);
    // The tail panel: a trapezoid, as wide as the quarters' inner faces at its foot and drawn in with them (they lean in) towards its top.
    const innerAt = (y) => INNER - TILT * (y - c.sill) - 0.0025;
    const tp = new THREE.Shape();
    tp.moveTo(-innerAt(H.foot), hy(H.foot));
    tp.lineTo(innerAt(H.foot), hy(H.foot));
    tp.lineTo(innerAt(tailTop), hy(tailTop));
    tp.lineTo(-innerAt(tailTop), hy(tailTop));
    tp.closePath();
    add(new THREE.ExtrudeGeometry(tp, { depth: 0.04, bevelEnabled: false }).translate(0, 0, hz(c.tail)), paint, hatch);
    // The tail lamps (after the photo): a tall rounded teardrop of red lens at each corner, wider at the bottom, that bulges out of the tail and wraps the corner, with a
    // dark outline, a horizontal break across it and a rounded amber lens at the foot, the reverse (left) or fog (right) lamp as a small round lens in that.
    const L = CORSA_TAIL_LAMP;
    for (const sd of [-1, 1]) {
      const H3 = L.y1 - L.y0;
      const ly = hy((L.y0 + L.y1) / 2);
      const lx = sd * (L.x + 0.01);
      const at = (mesh, dy, dz, w = 1) => { // places a lens at `dy` up the lamp, turned out round the corner
        mesh.position.set(lx + sd * (1 - w) * 0.0, ly + dy, hz(c.tail) - dz);
        mesh.rotation.y = sd * 0.3;
        return mesh;
      };
      at(add(new THREE.SphereGeometry(0.5, 20, 14).scale(L.w + 0.014, H3 + 0.012, 0.06), PAL.black, hatch), 0, 0.0125); // the dark outline
      at(add(new THREE.SphereGeometry(0.5, 22, 14).scale(L.w, H3 * 0.97, 0.085), tailMat, hatch), 0.01 * H3, 0.02); // the red lens: the whole height, bulging
      at(add(new THREE.SphereGeometry(0.5, 16, 10).scale(L.w * 0.96, H3 * 0.012, 0.09), PAL.black, hatch), -H3 * 0.12, 0.022); // the break across it
      at(add(new THREE.SphereGeometry(0.5, 18, 10).scale(L.w * 0.9, H3 * 0.26, 0.07), PAL.amber, hatch), -H3 * 0.285, 0.028); // the amber lens below it
      at(add(new THREE.SphereGeometry(0.5, 14, 10).scale(L.w * 0.4, H3 * 0.14, 0.05), sd > 0 ? PAL.smoke : PAL.fog, hatch), -H3 * 0.285, 0.05); // and the reverse or fog lamp in that
    }
    rbox(0.07, 0.04, 0.03, 0.01, PAL.plastic, 0, hy(0.715), hz(c.tail) - 0.0125, hatch, 'hatchHandle'); // the black pull above the plate
    const tailBadge = makerBadge(0.05, hatch); // the maker's badge on the tail, above the pull
    tailBadge.position.set(0, hy(0.785), hz(c.tail) - 0.0225);
    tailBadge.rotation.y = Math.PI;
    rbox(deckW - 0.1, tailTop - H.foot - 0.06, 0.012, 0.005, trim.trim, 0, hy((tailTop + H.foot) / 2), hz(c.tail + 0.045), hatch); // the lining inside it
    // The rear wiper on the glass, spindle at its foot in the middle.
    const rw = buildWiper({ len: 0.34, mats: { arm: PAL.black } });
    const lean = Math.atan2(zh - zr, yr - yh); // the glass's lean from upright, back and down
    rw.position.set(0, hy(yh) + 0.05, hz(zh) + 0.05);
    rw.rotation.set(-Math.PI / 2 + lean, 0, 0.08);
    rw.rotation.order = 'YXZ';
    hatch.add(rw);
    // Jess's black spoiler over the glass, on the hatch's top edge (so it lifts with it), and her sticker in the glass.
    const spoiler = rbox(halfAt(yr) * 2 - 0.1, 0.03, 0.2, 0.012, PAL.black, 0, 0.035, -0.07, hatch);
    spoiler.rotation.x = 0.18;
    const sticker = label(0.3, 0.07, 800, (g, Wd, Ht) => {
      g.fillStyle = '#f2f2f2';
      g.fillRect(0, Ht * 0.7, Wd, Ht * 0.18);
      g.fillStyle = '#ff6a1a';
      fitText(g, 'BRAP', Wd / 2, Ht * 0.38, Ht * 0.6, Wd * 0.6);
    }, hatch);
    const hl = Math.atan2(zr - zh, yr - yh); // the hatch glass's lean from upright
    sticker.position.set(0, hy(yh) + 0.15 * Math.cos(hl) + 0.008 * Math.sin(hl), hz(zh) + 0.15 * Math.sin(hl) - 0.008 * Math.cos(hl));
    sticker.rotation.set(hl, Math.PI, 0);
    // The plate on the tail panel above the bumper (yellow at the back).
    plate(reg_, '#e8c51c', hatch, { x: 0, y: hy(0.62), z: hz(c.tail) - 0.0125, facing: -1 });
    root.add(hatch);
    for (const s of [-1, 1]) { // the struts: a body end low on each C pillar's inside, aimed at a hatch end on its frame (stretched and turned by poseCorsaHatch)
      const strut = new THREE.Group();
      strut.name = s > 0 ? 'hatchStrutLeft' : 'hatchStrutRight';
      strut.userData.keep = true;
      strut.position.set(s * (halfAt(1.0) - 0.04), 1.0, -1.38);
      strut.userData.hatchEnd = [s * (halfAt(1.14) - 0.045), 1.14 - yr, -0.2];
      add(new THREE.CylinderGeometry(0.009, 0.009, 1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5), PAL.chrome, strut);
      add(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 6).rotateX(Math.PI / 2).translate(0, 0, 0.06), PAL.steel, strut);
      root.add(strut);
    }
    poseCorsaHatch(quad, 0);
  }

  // The nose: the faded bonnet, the front panel, the swept oval headlamps either side of the slim grille with its round badge, the deep black plastic
  // bumper with its lower intake, the plate in front of it.
  function addFrontEnd() {
    // The bonnet: crowned across, narrowing round the nose in plan (a loft, with smooth normals), not a flat slab.
    loft(c.nose - 0.02, zs, upperAt, (z) => planHalf(z, W / 2 - 0.05, 0.22), 0.045, 0.04, faded, root);
    rbox(W - 0.06, 0.03, 0.03, 0.01, PAL.under, 0, ys - 0.04, zs + 0.02, root); // the scuttle panel at the foot of the screen
    // The front apron: the body's nose, rounded in plan at the corners and running up under the bonnet's edge (and back under the wings' ends), so the front is
    // one closed shape from the bumper to the bonnet: nothing sticks out, nothing is left open behind the lamps.
    loft(c.nose, c.nose - 0.38, (z) => upperAt(z) - 0.045, (z) => planHalf(z, W / 2 - 0.03, 0.22), 0, 0, faded, root, NOSE_LOW);
    // The grille: a slim black slot between the lamps with the maker's round badge on it (Ashby: the makers are made up).
    rbox(0.46, 0.09, 0.03, 0.02, PAL.black, 0, 0.62, c.nose + 0.005, root);
    const noseBadge = makerBadge(0.05, root);
    noseBadge.position.set(0, 0.62, c.nose + 0.0215);
    for (const s of [-1, 1]) {
      // The lamp: a big clear lens that bulges out of the nose and wraps the corner, a silver reflector bowl with its bulb drawn on the lens's face (no black box behind it).
      const lamp = add(new THREE.SphereGeometry(0.5, 24, 14).scale(0.46, 0.19, 0.1), lensMat, root);
      lamp.position.set(s * 0.47, 0.63, c.nose - 0.03);
      lamp.rotation.y = s * 0.35;
      const bowl = label(0.2, 0.12, 900, (g, Wd, H) => {
        const grad = g.createRadialGradient(Wd * 0.45, H * 0.5, 2, Wd / 2, H / 2, Wd * 0.5);
        grad.addColorStop(0, '#f4f4f0');
        grad.addColorStop(0.5, '#a9acad');
        grad.addColorStop(1, '#5a5d5f');
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(Wd / 2, H / 2, Wd * 0.48, H * 0.46, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#e8d890';
        g.beginPath();
        g.arc(Wd * 0.45, H * 0.5, H * 0.14, 0, Math.PI * 2);
        g.fill();
      }, root);
      bowl.position.set(s * 0.47 + Math.sin(s * 0.35) * 0.053, 0.63, c.nose - 0.03 + Math.cos(s * 0.35) * 0.053);
      bowl.rotation.y = s * 0.35;
      const ind = add(new THREE.SphereGeometry(0.5, 14, 10).scale(0.1, 0.06, 0.07), PAL.amber, root); // the indicator: a small amber lens low on the corner, in the apron's skin
      ind.position.set(s * 0.735, 0.55, c.nose - 0.15);
      ind.rotation.y = s * 0.9;
    }
    // The bumper: deep black plastic from the nose's lower edge to under the lamps, wrapping round both corners, with a lower intake slot and the plate.
    const B = CORSA_BUMPER;
    rbox(W - 0.01, B.high - B.low, 0.2, 0.07, PAL.plastic, 0, (B.low + B.high) / 2, c.nose - 0.07, root);
    for (const s of [-1, 1]) rbox(0.18, B.high - B.low - 0.02, 0.23, 0.06, PAL.plastic, s * (W / 2 - 0.08), (B.low + B.high) / 2, c.nose - 0.115, root); // its corners wrapping back along the wing (a hair smaller, so no face matches the main piece's)
    rbox(0.7, 0.05, 0.02, 0.02, PAL.black, 0, B.low + 0.07, c.nose + 0.035, root); // the intake
    plate(reg_, '#ece9de', root, { x: 0, y: 0.4, z: c.nose + 0.032, facing: 1 });
  }

  // The tail: the deep black plastic bumper with its reverse and fog lamps, the exhaust (Jess's: a big chrome can).
  function addRear() {
    const B = CORSA_BUMPER;
    // The bumper has a notch in it for the exhaust (Jess's can comes out through it): two long pieces either side, and a short piece over the gap.
    const NX = -0.5; // the notch's middle, on the driver's side
    const NW = 0.16;
    const bz = c.tail + 0.07;
    const bh = B.high - B.low;
    const bm = (B.low + B.high) / 2;
    const left = W / 2 - 0.005; // the bumper's outer edges
    rbox(left - (NX + NW / 2), bh, 0.2, 0.012, PAL.plastic, (left + NX + NW / 2) / 2, bm, bz, root); // from the notch to the left corner
    rbox(NX - NW / 2 + left, bh, 0.2, 0.012, PAL.plastic, (NX - NW / 2 - left) / 2, bm, bz, root); // and to the right corner
    rbox(NW + 0.08, 0.2, 0.19, 0.012, PAL.plastic, NX, B.high - 0.1 - 0.005, bz, root); // over the notch: the bumper's upper part, which carries on across
    rbox(W - 0.5, 0.03, 0.05, 0.01, PAL.black, 0, CORSA_HATCH.foot - 0.02, c.tail + 0.01, root); // the cargo sill's rubber seal
    // Jess's exhaust: a pipe under the car to a big chrome can sticking out under the right of the bumper.
    // The can is a double-skinned chrome tube you can look into: the outer wall (chrome, seen from both sides), a dark inner liner, a rolled lip and a dark baffle deep inside.
    const ez = c.tail - 0.14; // the tip, at the mouth
    tube([-0.4, 0.22, -0.6], [NX, 0.22, ez + 0.2], 0.03, PAL.rust, root, 6);
    const chromeIn = PAL.chrome.clone();
    chromeIn.side = THREE.DoubleSide;
    add(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 20, 1, true).rotateX(Math.PI / 2), chromeIn, root).position.set(NX, 0.22, ez + 0.1);
    const liner = PAL.black.clone();
    liner.side = THREE.DoubleSide;
    add(new THREE.CylinderGeometry(0.047, 0.047, 0.2, 20, 1, true).rotateX(Math.PI / 2), liner, root).position.set(NX, 0.22, ez + 0.1 + 0.005);
    add(new THREE.TorusGeometry(0.0525, 0.007, 6, 20), PAL.chrome, root).position.set(NX, 0.22, ez - 0.0); // the rolled lip
    const baffle = add(new THREE.CircleGeometry(0.048, 20), liner, root); // the dark disc inside, facing out of the mouth
    baffle.position.set(NX, 0.22, ez + 0.14);
    baffle.rotation.y = Math.PI;
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 10, 1, true).rotateX(Math.PI / 2), liner, root).position.set(NX, 0.22, ez + 0.12); // the pipe's mouth inside it
  }

  // The front seats: Jess's aftermarket buckets, tall with the headrest built in and a slot through it for a harness, big bolsters on the back and the
  // cushion, in a loud zigzag cloth.
  function frontSeat(name, seat) {
    const mat = trim.bucket;
    const bol = trim.bolster;
    rbox(0.46, 0.1, 0.46, 0.04, bol, seat.x, seat.y - 0.08, seat.z + 0.12, root); // the cushion, black
    rbox(0.26, 0.012, 0.36, 0.005, mat, seat.x, seat.y - 0.0245, seat.z + 0.12, root); // with a cloth inset
    for (const sx of [-1, 1]) rbox(0.08, 0.12, 0.42, 0.03, bol, seat.x + sx * 0.23, seat.y - 0.04, seat.z + 0.12, root); // and tall bolsters either side
    rbox(0.4, 0.2, 0.36, 0.02, PAL.under, seat.x, seat.y - 0.24, seat.z + 0.1, root); // its frame and runners
    const pivot = new THREE.Group();
    pivot.name = `seatBack_${name}`;
    pivot.userData.keep = true;
    pivot.position.set(seat.x, seat.y - 0.04, seat.z - 0.13);
    const lean = new THREE.Group();
    lean.rotation.x = -0.22; // reclined a little
    rbox(0.46, 0.7, 0.1, 0.05, bol, 0, 0.35, -0.03, lean); // the shell, black, the headrest built in at the top
    rbox(0.26, 0.4, 0.012, 0.005, mat, 0, 0.3, 0.026, lean); // the cloth inset down the middle
    for (const sx of [-1, 1]) {
      const wing = rbox(0.08, 0.42, 0.16, 0.04, bol, sx * 0.24, 0.26, 0.03, lean); // the big side bolster, standing forward
      wing.rotation.y = sx * -0.25;
    }
    rbox(0.2, 0.12, 0.012, 0.005, mat, 0, 0.6, 0.026, lean); // a cloth panel on the headrest
    pivot.add(lean);
    root.add(pivot);
  }

  // The floor, the bulkhead, the dash with its cluster, the console with the stereo, the seats and the boot (the bass box in it).
  function addInterior() {
    // The floor: the full width under the seats and the pedals (to z -0.75, in front of the rear wheels), then only 1.1 m between the rear tyres.
    rbox(W - 0.1, 0.03, zs - 0.1 + 0.75, 0.01, trim.floor, 0, 0.26, (zs - 0.1 - 0.75) / 2, root);
    rbox(1.12, 0.03, -0.75 - c.tail - 0.1, 0.01, trim.floor, 0, 0.26, (-0.75 + c.tail + 0.1) / 2, root);
    rbox(W - 0.1, 0.5, 0.04, 0.01, PAL.under, 0, 0.5, zs - 0.06, root); // the bulkhead
    rbox(0.16, 0.12, zs - 0.1 - (c.seats.driver.z - 0.2), 0.04, trim.floor, 0, 0.32, (zs - 0.1 + c.seats.driver.z - 0.2) / 2, root); // the low tunnel
    for (const s of [-1, 1]) {
      rbox(0.08, 0.3, 0.7, 0.03, trim.trim, s * 0.5, 0.42, -zF, root); // the rear arch inside, beside the back seat
      rbox(0.03, 0.17, c.bPillar - zh - 0.2, 0.01, trim.card, s * (W / 2 - 0.06), 0.785, (c.bPillar + zh) / 2 - 0.05, root); // the rear quarter trim, above the arch
    }
    // The dash: the rounded moulding across under the screen, the binnacle's deep hood in front of the driver, vents at each end, the centre stack.
    const dashTop = ys - 0.02;
    const face = zs - 0.32;
    rbox(W - 0.12, 0.08, 0.32, 0.03, trim.dash, 0, dashTop, zs - 0.17, root);
    rbox(W - 0.12, 0.3, 0.04, 0.02, trim.dash, 0, dashTop - 0.17, face, root); // its face
    rbox(0.5, 0.05, 0.14, 0.025, trim.dash, c.seats.driver.x, dashTop + 0.075, face - 0.06, root); // the binnacle's hood
    for (const sx of [-1, 1]) rbox(0.03, 0.17, 0.1, 0.01, trim.dash, c.seats.driver.x + sx * 0.235, dashTop + 0.0, face - 0.05, root); // its cheeks, so the dials sit in a pocket under it
    rbox(0.5, 0.2, 0.04, 0.02, trim.dash, c.seats.driver.x, dashTop - 0.03, face - 0.01, root); // its back, round the dials
    const dash = buildDash('corsa');
    dash.group.position.set(c.seats.driver.x, dashTop - 0.03, face - 0.04); // a fixed point
    dash.group.rotation.x = 0.3;
    for (const ch of dash.group.children) ch.position.y -= 0.018; // the cluster's drawn lower inside its group (the group's own place is the fixed point), down in the pocket under the hood
    dash.group.scale.setScalar(1.35); // the cluster's about 0.32 m wide
    dash.group.userData.keep = true;
    root.add(dash.group);
    quad.userData.dash = dash;
    quad.userData.metalBody = true;
    quad.userData.podMount = null;
    for (const s of [-1, 1]) { // the vents at the ends: a big louvred rectangle each, the photos'
      rbox(0.15, 0.07, 0.02, 0.01, PAL.black, s * 0.65, dashTop - 0.05, face - 0.025, root);
      for (let i = 0; i < 5; i++) rbox(0.13, 0.004, 0.006, 0.002, PAL.under, s * 0.65, dashTop - 0.077 + i * 0.013, face - 0.036, root);
    }
    // The centre stack: a panel from the dash face down to the tunnel with the clock's display on top, the hazard button between two vents, the three heater
    // knobs, and Jess's head unit (the shared radio piece, in its loud style) in the slot under them.
    rbox(0.3, 0.5, 0.1, 0.02, trim.dash, 0, 0.6, face - 0.04, root);
    const zf = face - 0.095; // the stack's face
    const clock = label(0.12, 0.03, 900, (g, Wd, Ht) => {
      g.fillStyle = '#0a0a0a';
      g.fillRect(0, 0, Wd, Ht);
      g.fillStyle = '#ff8a2a';
      fitText(g, '12:45', Wd / 2, Ht / 2 + Ht * 0.04, Ht * 0.7, Wd * 0.6);
    }, root);
    clock.position.set(0, 0.83, zf - 0.001);
    clock.rotation.y = Math.PI;
    quad.userData.liveMaterials.push(clock.material);
    for (const s of [-1, 1]) {
      rbox(0.07, 0.04, 0.012, 0.004, PAL.black, s * 0.095, 0.77, zf - 0.006, root); // the two small vents
      for (let i = 0; i < 3; i++) rbox(0.06, 0.003, 0.006, 0.002, PAL.under, s * 0.095, 0.762 + i * 0.01, zf - 0.013, root);
    }
    const hazard = addHazardSwitch(root, 0, 0.77, zf - 0.006, { plate: false, w: 0.034, h: 0.026 });
    hazard.rotation.y = Math.PI;
    for (const x of [-0.095, 0, 0.095]) {
      add(new THREE.CylinderGeometry(0.022, 0.024, 0.018, 14).rotateX(Math.PI / 2), PAL.black, root).position.set(x, 0.69, zf - 0.009); // the heater's knobs
      rbox(0.004, 0.026, 0.006, 0.002, PAL.chrome, x, 0.69, zf - 0.02, root); // each with a pointer
    }
    const radio = buildRadio('headunit', { w: 0.2, h: 0.06 });
    radio.position.set(0, 0.6, zf - 0.0015);
    radio.rotation.y = Math.PI;
    root.add(radio);
    quad.userData.liveMaterials.push(radio.userData.faceMaterial);
    // The lights' knob and two rockers at the driver's right under the binnacle, the photos': the knob turns with the light switch.
    const lights = new THREE.Group();
    lights.position.set(c.seats.driver.x - 0.3, dashTop - 0.165, face - 0.025);
    root.add(lights);
    rbox(0.21, 0.085, 0.01, 0.004, PAL.under, 0.035, 0, 0.002, lights); // the little pod's black plate, under the end vent: all the lights' controls are here, as the photo's
    const knob = new THREE.Group();
    knob.name = 'lightsKnob';
    knob.userData.keep = true;
    knob.position.set(0.0, 0.0, -0.005);
    add(new THREE.CylinderGeometry(0.026, 0.028, 0.02, 16).rotateX(Math.PI / 2), PAL.black, knob);
    rbox(0.005, 0.034, 0.008, 0.002, PAL.chrome, 0, 0.0, -0.014, knob);
    lights.add(knob);
    for (const x of [0.06, 0.105]) rbox(0.03, 0.036, 0.014, 0.004, PAL.plastic, x, 0.0, -0.006, lights); // the two fog lamp rockers
    const podUpdate = dash.update;
    dash.update = (state) => { // the pod's own update, then the radio's display and the lights' knob follow the radio and the switch
      podUpdate(state);
      radio.userData.setPower(!!state.radioOn && !!state.ignition);
      const to = state.lightLamps?.main ? -1.1 : state.lightLamps?.lights ? -0.55 : 0;
      knob.rotation.z += (to - knob.rotation.z) * 0.4;
    };

    for (const [name, seat] of Object.entries(c.seats)) frontSeat(name, seat);
    // The back bench: grey fleck cloth with a plain band down the middle, as the photo's, no headrests, and the boot behind it: the carpeted floor, the side
    // trim round the arch humps, the bass box Jess fitted with its speaker facing out of the hatch.
    const rz = c.rear.rearLeft.z;
    rbox(1.1, 0.1, 0.46, 0.04, trim.seat, 0, c.rear.rearLeft.y - 0.08, rz + 0.12, root);
    rbox(0.3, 0.02, 0.4, 0.008, trim.band, 0, c.rear.rearLeft.y - 0.025, rz + 0.12, root);
    rbox(1.1, 0.26, 0.4, 0.02, PAL.under, 0, 0.37, rz + 0.1, root);
    const back = new THREE.Group();
    back.position.set(0, c.rear.rearLeft.y + 0.18, rz - 0.2);
    back.rotation.x = -0.18;
    rbox(1.1, 0.4, 0.1, 0.04, trim.seat, 0, 0, 0, back);
    rbox(0.3, 0.38, 0.08, 0.01, trim.band, 0, 0, 0.012, back);
    root.add(back);
    rbox(1.2, 0.03, -1.42 - (c.tail + 0.07), 0.01, trim.floor, 0, CORSA_BOOT.floor, (c.tail + 0.07 - 1.42) / 2, root); // the boot floor, carpet: between the rear tyres (their inner faces are at 0.62)
    rbox(1.46, 0.03, -1.53 - (c.tail + 0.07), 0.01, trim.floor, 0, CORSA_BOOT.floor + 0.004, (c.tail + 0.07 - 1.53) / 2, root); // and the full width behind them
    rbox(1.18, CORSA_BOOT.floor - 0.29, -1.42 - (c.tail + 0.07), 0.01, PAL.under, 0, (CORSA_BOOT.floor + 0.29) / 2, (c.tail + 0.07 - 1.42) / 2, root); // the solid block under it
    rbox(1.42, CORSA_BOOT.floor - 0.29, -1.53 - (c.tail + 0.07), 0.01, PAL.under, 0, (CORSA_BOOT.floor + 0.29) / 2, (c.tail + 0.07 - 1.53) / 2, root);
    for (const s of [-1, 1]) {
      rbox(0.12, 0.2, 0.6, 0.03, trim.trim, s * 0.49, CORSA_BOOT.floor + 0.1, -1.18, root); // the arch hump in the boot, inboard of the tyre
      rbox(0.03, 0.3, -1.3 - (c.tail + 0.14), 0.01, trim.trim, s * (W / 2 - 0.1), CORSA_BOOT.floor + 0.17, (-1.3 + c.tail + 0.14) / 2, root); // the boot's side trim
    }
    // The belts: the kit's, hanging from the B pillar (front) and the C pillar (back) and tucked to a buckle by each seat.
    const outer = W / 2 - 0.1;
    const post_ = c.bPillar + 0.005;
    const belt = (name, seat, out, inn, postZ, outTop, topY, lowOut, lowY) => {
      const hip = [seat.x, seat.y - 0.05, seat.z - 0.12];
      root.add(buildSeatBelt(name, { top: [outTop, topY, postZ], low: [lowOut, lowY, postZ], buckle: [inn, seat.y + 0.07, seat.z - 0.02], hip, lapOnly: false, mats: { webbing } }));
    };
    const frontTop = (seat) => halfAt(seat.y + 0.72) - 0.045;
    const innerAt = (y) => INNER - TILT * (y - c.sill) - 0.032; // the quarters' inner faces lean in with the sides
    belt('driver', c.seats.driver, -outer, -0.08, post_, -frontTop(c.seats.driver), c.seats.driver.y + 0.72, -innerAt(0.62), 0.62);
    belt('left', c.seats.left, outer, 0.08, post_, frontTop(c.seats.left), c.seats.left.y + 0.72, innerAt(0.62), 0.62);
    const rearTop = (seat) => halfAt(seat.y + 0.6) - 0.03;
    belt('rearLeft', c.rear.rearLeft, outer, 0.1, -1.25, rearTop(c.rear.rearLeft), c.rear.rearLeft.y + 0.6, innerAt(0.74), 0.74);
    belt('rearRight', c.rear.rearRight, -outer, -0.1, -1.25, -rearTop(c.rear.rearRight), c.rear.rearRight.y + 0.6, -innerAt(0.74), 0.74);
  }

  // The steering wheel and its column, the gear lever, the handbrake, the pedals (the choke is only a hidden stand-in: it is injected).
  function addControls() {
    const face = zs - 0.32;
    const column = new THREE.Group();
    column.name = 'steeringColumn';
    column.userData.keep = true;
    column.position.set(c.seats.driver.x, c.columnY, face);
    column.rotation.x = -1.12;
    tube([0, -0.02, 0], [0, c.wheelOut - 0.02, 0], 0.03, PAL.black, column);
    rbox(0.1, 0.07, 0.11, 0.025, PAL.plastic, 0, 0.05, 0, column); // the shroud by the dash
    root.add(column);
    addSignalStalk(column, c.wheelOut - 0.06, PAL.black, { modern: true });
    // The key in the column's right side, a real one (as the UTV's): on the shroud, facing the driver, turned by the dash's update.
    const keyHolder = new THREE.Group();
    keyHolder.position.set(0.05, 0.045, 0.03); // on the column's centre side, as the photo of the real one's dash shows its barrel
    keyHolder.rotation.y = -Math.PI / 2;
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
    // Jess's small sports wheel: a thick rim on three spokes (left, right and down, the top open so you see the dials) with a red mark at the top.
    const rimR = 0.17;
    add(new THREE.TorusGeometry(rimR, 0.02, 8, 32).rotateX(Math.PI / 2), PAL.black, wheel);
    rbox(0.03, 0.044, 0.044, 0.01, PAL.red, 0, 0, rimR, wheel);
    rbox(0.09, 0.04, 0.07, 0.02, PAL.black, 0, 0, 0, wheel); // the boss
    for (const a of [Math.PI / 2, -Math.PI / 2, Math.PI]) tube([0, 0, 0], [Math.sin(a) * rimR, 0, Math.cos(a) * rimR], 0.012, PAL.black, wheel, 5);
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
    // The gear lever on the floor between the seats, with its gaiter: Jess's billet knob, a polished alloy barrel with a red top.
    const gear = new THREE.Group();
    gear.name = 'gearLever';
    gear.userData.keep = true;
    gear.position.set(0, 0.36, zs - 0.62);
    tube([0, 0, 0], [0, 0.26, 0], 0.008, PAL.steel, gear, 5);
    add(new THREE.CylinderGeometry(0.022, 0.02, 0.06, 16), PAL.chrome, gear).position.set(0, 0.28, 0);
    add(new THREE.CylinderGeometry(0.022, 0.022, 0.008, 16), PAL.red, gear).position.set(0, 0.314, 0);
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
    // The pedals, right-hand drive: Jess's are drilled alloy; each on an arm from the bulkhead.
    addPedals(root, { pivot: [0.62, 0.58], foot: [0.36, 0.5], xs: [c.seats.driver.x + 0.17, c.seats.driver.x, c.seats.driver.x - 0.15], widths: [0.07, 0.07, 0.04], padMat: PAL.chrome });
    const choke = new THREE.Group(); // injected: no choke, but the pose code looks the knob up by name
    choke.name = 'chokeKnob';
    choke.userData.keep = true;
    choke.userData.baseZ = 0;
    choke.visible = false;
    root.add(choke);
    for (const name of ['fuelTap', 'chokeLever']) { // Quad poses these on a quad; a car has neither
      const g = new THREE.Group();
      g.name = name;
      g.userData.keep = true;
      g.visible = false;
      root.add(g);
    }
  }

  // Jess's additions that are not on the car's shell: fluffy dice and an air freshener off the mirror, a sun strip with her name across the top of the
  // screen, the bass box in the boot (the hatch's own are on it: the spoiler and the sticker).
  function addJess() {
    tube([0, yt - 0.13, zt - 0.07], [0, yt - 0.26, zt - 0.08], 0.002, PAL.black, root, 3);
    const fluff = new THREE.MeshStandardMaterial({ color: 0xff7ac8, roughness: 1 });
    for (const [x, dy, r] of [[-0.025, 0.28, 0.3], [0.03, 0.3, -0.4]]) {
      const die = rbox(0.045, 0.045, 0.045, 0.012, fluff, x, yt - dy, zt - 0.08, root);
      die.rotation.set(r, r * 0.7, 0.2);
    }
    add(new THREE.ConeGeometry(0.03, 0.07, 3).rotateX(Math.PI), new THREE.MeshStandardMaterial({ color: 0x3fae4a, roughness: 0.8 }), root).position.set(0.06, yt - 0.22, zt - 0.075);
    const strip = label(1.2, 0.1, 600, (g, Wd, H) => {
      g.fillStyle = 'rgba(20,40,110,0.82)';
      g.fillRect(0, 0, Wd, H);
      g.fillStyle = '#f4f4f4';
      fitText(g, 'JESS', Wd / 2, H * 0.55, H * 0.7, Wd * 0.3);
    }, root);
    // Lying on the outside of the glass, read from in front, as a sun strip is.
    const out = new THREE.Vector3(0, zs - zt, yt - ys).normalize(); // square to the glass, outwards (forward and up)
    const along = new THREE.Vector3(0, yt - ys, zt - zs).normalize();
    strip.position.set(0, ys + (yt - ys) * 0.88, zs + (zt - zs) * 0.88).addScaledVector(out, 0.006);
    const z = out.clone();
    const x = new THREE.Vector3().crossVectors(along, z).normalize();
    const y = new THREE.Vector3().crossVectors(z, x);
    strip.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    // The bass box in the boot, its speaker facing back out of the hatch.
    rbox(0.7, 0.32, 0.2, 0.02, new THREE.MeshStandardMaterial({ color: 0x232426, roughness: 0.9 }), 0.1, CORSA_BOOT.floor + 0.175, -1.5, root);
    for (const [r, m, dz] of [[0.12, PAL.black, 0.101], [0.035, PAL.chrome, 0.102]]) {
      const cone = add(new THREE.CircleGeometry(r, 18), m, root);
      cone.position.set(0.1, CORSA_BOOT.floor + 0.18, -1.5 - dz);
      cone.rotation.y = Math.PI;
    }
  }

  function addAnchors() {
    const tip = new THREE.Object3D();
    tip.name = 'exhaustTip';
    tip.position.set(-0.5, 0.22, c.tail - 0.14);
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
    const wheelModel = buildWheel(w, w.name === 'wheel_rr');
    wheelModel.name = w.name;
    quad.add(wheelModel);
  }
  addHeadlightBeams(quad);
  addSignalLamps(quad, PAL.amber, PAL.smoke);
  quad.userData.tailMaterial = tailMat;
  quad.userData.tailHaloMaterial = new THREE.SpriteMaterial({ transparent: true, opacity: 0 });
  quad.userData.tailHalos = [];
  mergeStatic(root);
  quad.userData.cleanMaterials = [trim.bucket, trim.bolster, trim.seat, trim.band, trim.floor, trim.dash, trim.card, trim.lining, trim.trim];
  quad.userData.cabin = { min: [-c.width / 2, c.sill, c.hatchBottom[0]], max: [c.width / 2, c.screenTop[1] + 0.1, c.screenBase[0]] };
  const casts = new Set([paint, faded, PAL.rubber, PAL.black, PAL.plastic, PAL.primer, PAL.under, PAL.chrome]);
  quad.traverse((o) => {
    if (!o.isMesh || o.material === PAL.glass) return;
    o.castShadow = casts.has(o.material);
    o.receiveShadow = true;
  });
  return quad;
}

/** The wheels' places (the layout's, without importing it, so carModel.js can import this file): the front two steer. */
function corsaWheels() {
  const wheelY = c.R + 0.16 - 0.45; // radius plus the suspension's rest length plus the chassis-to-ground offset
  return [
    { name: 'wheel_fl', x: c.track / 2, z: zF, front: true, radius: c.R, y: wheelY },
    { name: 'wheel_fr', x: -c.track / 2, z: zF, front: true, radius: c.R, y: wheelY },
    { name: 'wheel_rl', x: c.track / 2, z: -zF, front: false, radius: c.R, y: wheelY, driven: false },
    { name: 'wheel_rr', x: -c.track / 2, z: -zF, front: false, radius: c.R, y: wheelY, driven: false },
  ];
}

/** Lifts the hatch, 0 (shut) to 1 (swung up and back on its hinge), and stretches the two gas struts between the body and it. */
export function poseCorsaHatch(model, open) {
  const hatch = model.getObjectByName('hatch');
  if (!hatch || !hatch.userData.keep) return;
  hatch.rotation.x = CORSA_HATCH.open * open;
  hatch.updateMatrix();
  for (const name of ['hatchStrutLeft', 'hatchStrutRight']) {
    const strut = model.getObjectByName(name);
    if (!strut) continue;
    const end = new THREE.Vector3(...strut.userData.hatchEnd).applyMatrix4(hatch.matrix);
    const way = end.sub(strut.position);
    strut.scale.z = Math.max(0.001, way.length());
    strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), way.normalize());
  }
}
