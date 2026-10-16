import * as THREE from 'three';
import { buildDash } from './dash.js';
import { addHeadlightBeams, addSignalLamps, addSignalStalk } from './quadModel.js';
import { loftGeometry, mergeStatic } from './quadGeometry.js';
import { buildSeatBelt, webbingMaterial } from './detail/belts.js';
import { buildWiper, buildGrabHandle } from './detail/fittings.js';
import { buildGlovebox } from './detail/switchgear.js';
import {
  MAT, add, rbox as roundedBox, archPanel, archFlare, post, tube, axleCyl, plate, label, fitText, badge, trimMaterials, buildWheel,
  LANDY_SEATS, LANDY_REAR_SEATS, SEAT_BACK, HANDBRAKE_OFF, TIPPING_SEATS, DEFENDER_LAYOUT, R,
} from './landRoverModel.js';
import {
  DEF_WHEELBASE, DEF_TRACK, DEF_END, DEF_SPARE, DEF_FRONT, DEF_WING, DEF_BONNET, DEF_BONNET_E, DEF_SCUTTLE, DEF_SCREEN, DEF_SCREEN_H,
  DEF_SCREEN_TOP_Z, defScreenZ, DEF_DOOR, DEF_CAB, DEF_ROOF, DEF_SIDE_WINDOW, DEF_BACK_DOOR, DEF_HITCH, DEF_DASH,
} from './defenderBody.js';

// The 200TDi: a Defender 90 station wagon at its real size (TODO 100), built from defenderBody.js's numbers after the photos. Driven by Quad
// through the same named parts as the Series' (seriesModel.js: steeringColumn > handlebars, dash, gearLever, transferKnob, diffLockKnob,
// parkBrakeLever, riderAnchor, seatMid, seatLeft, the cameras, towHitch, exhaustTip, belt_<seat>, the back bench's seat<Name> and camera<Name>,
// seatBack_driver and seatBack_left that tip), plus:
//
//   doorLeft, doorRight     groups hinged on their front edges: poseSeriesDoors swings them (the dirt on them goes with them: `mudRest`)
//   backDoor                a group hinged on the offside edge of the back, carrying the spare: poseDefenderBackDoor swings it out on T

/** A box with its edges rounded, or, for the small ones whose rounding you could not see, a plain one (a third of the triangles each). */
function rbox(w, h, d, r, mat, x, y, z, parent, name) {
  if (r >= 0.0075) return roundedBox(w, h, d, r, mat, x, y, z, parent, name);
  const m = add(new THREE.BoxGeometry(w, h, d), mat, parent, name);
  m.position.set(x, y, z);
  return m;
}

/** The 200TDi's registration (an H, 1990). */
const PLATE_200 = 'H471 DKP';
const PLATE_BG = '#e8c51c';

/** The Defender 90 station wagon. `reg` is the number plate (a visiting one has its own). */
export function buildDefenderModel({ bodyColor = 0x4f6f86, dashStyle = 'defender', reg = null } = {}) {
  const regText = reg ?? PLATE_200;
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5, side: THREE.DoubleSide });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x3a0a07, roughness: 0.25, emissive: 0x000000 }); // dark red until lit
  const amber = new THREE.MeshStandardMaterial({ color: 0x5c2c08, roughness: 0.25 }); // the indicators: dark amber until they flash
  const smoke = new THREE.MeshStandardMaterial({ color: 0x4d5254, roughness: 0.2 }); // the reverse lens: smoked until it lights
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x555a5c, roughness: 0.2, emissive: 0x000000 }); // the sidelamps: lit with the headlights
  const fogMat = new THREE.MeshStandardMaterial({ color: 0x5a110d, roughness: 0.2 }); // the rear fog lamp, dark red
  const trim = trimMaterials(true);
  const frame = MAT.black; // the screen's and the windows' frames are black
  const webbing = webbingMaterial();
  const plastic = new THREE.MeshStandardMaterial({ color: 0x3a3d41, roughness: 0.72 }); // the dash's moulding
  const plastic2 = new THREE.MeshStandardMaterial({ color: 0x2d3033, roughness: 0.75 }); // its darker parts
  const console_ = new THREE.MeshStandardMaterial({ color: 0x474b4f, roughness: 0.7 }); // the centre stack's panel
  const lining = new THREE.MeshStandardMaterial({ color: 0x6d6c66, roughness: 0.95 }); // the headlining
  const alpine = new THREE.MeshStandardMaterial({ color: 0x1b2326, roughness: 0.1, metalness: 0.2 }); // the roof's side windows
  const cover = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.85 }); // the spare wheel's cover

  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  quad.userData.seatMaterial = trim.seat;
  quad.userData.cleanMaterials = [trim.seat, trim.dash, trim.floor, MAT.belt, plastic, plastic2, console_, lining]; // the cab's inside never gets muddy (effects/mudCoat.js)
  quad.userData.cabin = { min: [-0.9, 0.4, DEF_CAB.rear - 0.04], max: [0.9, DEF_CAB.top + 0.05, DEF_SCREEN.baseZ + 0.02] }; // the paint inside it stays clean too (cabinMud.js)
  quad.userData.steerGain = 7; // a big wheel, a lot of turns lock to lock
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);
  const zF = DEF_WHEELBASE / 2;
  const zR = -DEF_WHEELBASE / 2;
  const { wing, door } = { wing: DEF_WING, door: DEF_DOOR };

  // Chassis: two box-section rails and cross members, the engine and gearbox, live axles with their diffs, coil springs and dampers (not
  // leaf springs), and the radius arms.
  for (const s of [-1, 1]) rbox(0.08, 0.15, 3.6, 0.01, MAT.chassis, s * 0.43, 0.5, -0.05, root);
  for (const z of [1.62, 0.6, -0.5, -1.55, -1.9]) rbox(0.86, 0.1, 0.08, 0.01, MAT.chassis, 0, 0.5, z, root);
  rbox(0.5, 0.42, 0.75, 0.05, MAT.steel, 0, 0.75, 1.05, root); // the engine under the bonnet
  rbox(0.3, 0.3, 0.6, 0.04, MAT.steel, 0, 0.6, 0.3, root); // gearbox and transfer box under the seat
  tube([0, 0.48, 0.05], [0, 0.4, zR + 0.25], 0.03, MAT.steel, root); // the propshafts
  tube([0, 0.48, 0.55], [0, 0.4, zF - 0.25], 0.03, MAT.steel, root);
  for (const [z, off] of [[zF, 0.18], [zR, -0.12]]) {
    axleCyl(0.05, DEF_TRACK, MAT.chassis, 0, R, z, root);
    add(new THREE.SphereGeometry(0.15, 16, 12), MAT.chassis, root).position.set(off, R, z); // the diff casing
    for (const s of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.075, 0.075, 0.26, 12), MAT.steel, root).position.set(s * 0.58, 0.58, z); // the coil spring
      tube([s * 0.5, 0.42, z + 0.1], [s * 0.5, 0.7, z + 0.14], 0.022, MAT.steel, root); // the damper
      tube([s * 0.43, 0.46, z - Math.sign(z) * 0.7], [s * 0.4, R + 0.05, z], 0.018, MAT.chassis, root); // the radius arm, from the chassis to the axle
    }
  }

  // A round lamp: a ring and a lens on a face looking along `dir` (+1 front, -1 back).
  const lampAt = (x, y, z, r, mat, dir, d = 0.02) => add(new THREE.CylinderGeometry(r, r, d, 18).rotateX(Math.PI / 2), mat, root).position.set(x, y, z + dir * d / 2);

  // The black wheel-arch flare: a thick half ring round the arch (a moulding 7.5 cm deep, standing out from the body's side at `x` and sloping
  // a little past the horizontal at each end), as the real one's wide black arches.
  const flare = (s, x, zc) => {
    const depth = 0.075;
    const inner = 0.42; // the arch's own radius (landRoverModel.js ARCH_R)
    const outer = 0.49;
    const shape = new THREE.Shape();
    shape.absarc(zc, R + 0.2, outer, 0.1, Math.PI - 0.1, false); // (it stops just above the horizontal at each end, well clear of the tyre's front and back)
    shape.absarc(zc, R + 0.2, inner, Math.PI - 0.1, 0.1, true);
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    g.rotateY(-Math.PI / 2); // shape x becomes z, the extrusion runs along -x from 0 to -depth
    g.translate(s > 0 ? x + depth : x, 0, 0);
    add(g, MAT.black, root);
  };

  addFront();
  addScuttleAndScreen();
  addCab();
  addRear();
  addInterior();
  addControls();
  addTail();

  // The front: the black bumper with its plate, the black grille between the wings, the wings with a black surround each round a round headlamp,
  // a sidelamp and an indicator, the bonnet with its raised ridge.
  function addFront() {
    const bz = DEF_FRONT.bumper - 0.05;
    rbox(1.76, 0.2, 0.1, 0.02, MAT.black, 0, 0.6, bz, root); // the bumper
    for (const s of [-1, 1]) {
      rbox(0.06, 0.2, 0.16, 0.02, MAT.black, s * 0.87, 0.6, bz - 0.04, root); // its ends, turned back
      rbox(0.06, 0.12, 0.2, 0.01, MAT.chassis, s * 0.43, 0.6, 1.68, root); // its mounts to the rails
      rbox(0.16, 0.012, 0.1, 0.004, MAT.chassis, s * 0.7, 0.705, bz - 0.02, root); // the rubber step on its top
    }
    plate(regText, '#ece9de', root, { x: 0, y: 0.6, z: DEF_FRONT.bumper + 0.0005, facing: 1 }); // the front number plate, on the bumper's face
    // The grille: a black panel with horizontal slats, the badge at its right-hand end, the maker's name on a strip above.
    const pz = DEF_FRONT.panel;
    rbox(0.78, 0.36, 0.04, 0.012, MAT.black, 0, 0.86, pz, root); // (between the wings' inner walls, not through them)
    for (let i = 0; i < 8; i++) rbox(0.72, 0.014, 0.018, 0.004, MAT.chassis, 0, 0.72 + i * 0.04, pz + 0.025, root);
    badge(root, { x: 0.3, y: 0.8, z: pz + 0.0215, facing: 1, w: 0.08 });
    const name = label(0.2, 0.034, 1000, (g, W, H) => {
      g.fillStyle = '#16171a';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#d4d7da';
      fitText(g, 'MOORLAND', W / 2, H / 2 + H * 0.04, H * 0.7, W * 0.9);
    }, root);
    name.position.set(0, 1.07, pz + 0.0215);
    rbox(0.78, 0.1, 0.04, 0.012, paint, 0, 0.635, pz + 0.005, root); // the apron under it, over the bumper (its top is the grille panel's bottom, not inside it)
    for (const s of [-1, 1]) {
      const wz = (DEF_FRONT.wingFace + wing.scuttle) / 2;
      const wl = DEF_FRONT.wingFace + 0.02 - wing.scuttle;
      rbox(wing.outer - wing.inner + 0.01, 0.03, wl, 0.012, paint, s * (wing.outer + wing.inner) / 2, wing.top - 0.015, wz + 0.01, root, 'wingTop'); // the flat top, which you can stand a mug on
      archPanel(s * wing.outer, 0.03, wing.bottom, wing.top, wing.scuttle, DEF_FRONT.wingFace + 0.02, zF, paint, root); // the outer side, with the wheel arch cut in it
      flare(s, s * wing.outer, zF); // the black flare over the wheel, standing well out
      rbox(0.03, wing.top - wing.bottom - 0.02, DEF_FRONT.wingFace - wing.scuttle, 0.01, paint, s * wing.inner, (wing.top + wing.bottom) / 2 - 0.01, (DEF_FRONT.wingFace + wing.scuttle) / 2, root); // the inner wall
      rbox(wing.outer - wing.inner, wing.top - wing.bottom, 0.03, 0.01, paint, s * (wing.outer + wing.inner) / 2, (wing.top + wing.bottom) / 2, DEF_FRONT.wingFace, root); // the front face
      // The lamp panel: a black plastic surround on the wing's face with the round headlamp, the sidelamp above and the indicator below.
      const lx = s * 0.58;
      rbox(0.32, 0.3, 0.02, 0.012, MAT.black, lx, 0.87, DEF_FRONT.wingFace + 0.02, root);
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 22).rotateX(Math.PI / 2), MAT.galv, root).position.set(lx - s * 0.04, 0.87, DEF_FRONT.wingFace + 0.03); // the headlamp's rim
      add(new THREE.CylinderGeometry(0.088, 0.088, 0.02, 22).rotateX(Math.PI / 2), lensMat, root).position.set(lx - s * 0.04, 0.87, DEF_FRONT.wingFace + 0.042);
      lampAt(lx + s * 0.12, 0.96, DEF_FRONT.wingFace + 0.03, 0.022, sideMat, 1); // the sidelamp, above and outboard
      lampAt(lx + s * 0.12, 0.78, DEF_FRONT.wingFace + 0.03, 0.022, amber, 1); // the indicator below it
      rbox(0.01, 0.1, 0.16, 0.004, MAT.black, s * (wing.outer + 0.02), 0.94, 0.78, root); // the black louvre on the wing's side
      rbox(0.012, 0.03, 0.06, 0.004, amber, s * (wing.outer + 0.02), 1.0, 1.1, root); // and the repeater lamp
    }
    // The bonnet: a loft with a raised ridge, hinged at the scuttle and held down at the front by two catches.
    add(loftGeometry(DEF_BONNET, { exponent: DEF_BONNET_E }), paint, root, 'bonnet');
    for (const s of [-1, 1]) rbox(0.05, 0.03, 0.04, 0.008, MAT.black, s * 0.3, 1.14, 1.62, root); // the catches
    rbox(0.1, 0.012, 0.1, 0.004, MAT.black, -0.2, 1.205, 1.0, root); // the little vent on the bonnet
  }

  // The scuttle (the deck behind the bonnet with the two vent flaps), the bulkhead under it, and the windscreen: a black frame raked back, two
  // panes and a centre post, with its wipers and the rear-view mirror.
  function addScuttleAndScreen() {
    const sc = DEF_SCUTTLE;
    rbox(1.66, 0.04, sc.to - sc.from, 0.012, paint, 0, sc.top - 0.02, (sc.from + sc.to) / 2, root); // the deck
    rbox(1.66, 0.6, 0.05, 0.02, paint, 0, 0.9, sc.from + 0.02, root); // the bulkhead under it
    for (const s of [-1, 1]) {
      rbox(0.4, 0.02, 0.07, 0.01, MAT.black, s * 0.32, sc.top + 0.01, 0.62, root); // the vent flaps' grilles, one each side of the wipers, outside the glass
      const pz = door.hinge + 0.1; // the body's side runs on from the hinge pillar to the wing, one panel the whole way
      rbox(0.03, sc.top - wing.bottom, sc.to - pz, 0.01, paint, s * wing.outer, (sc.top + wing.bottom) / 2, (pz + sc.to) / 2, root);
    }
    const screen = new THREE.Group();
    screen.position.set(0, DEF_SCREEN.baseY, DEF_SCREEN.baseZ);
    screen.rotation.x = -DEF_SCREEN.rake;
    root.add(screen);
    const H = DEF_SCREEN_H;
    rbox(1.64, 0.06, 0.06, 0.01, frame, 0, 0.03, 0, screen); // the bottom rail, on the scuttle
    rbox(1.64, 0.06, 0.06, 0.01, frame, 0, H - 0.03, 0, screen); // the top rail, into the roof
    rbox(0.05, H, 0.05, 0.01, frame, 0, H / 2, 0, screen); // the centre post
    for (const s of [-1, 1]) {
      const pane = add(new THREE.PlaneGeometry(0.76, H - 0.1), MAT.glass, screen);
      pane.position.set(s * 0.4, H / 2, 0);
      rbox(0.05, H, 0.05, 0.01, frame, s * 0.8, H / 2, 0, screen); // the sides: the doors' front uprights
      const wiper = buildWiper({ len: 0.5, mats: { arm: MAT.black } }); // a wiper from the kit, parked along the foot of the glass
      wiper.position.set(s * 0.1, 0.1, 0);
      wiper.rotation.z = s > 0 ? 0.05 : Math.PI - 0.05;
      screen.add(wiper);
    }
    rbox(0.2, 0.07, 0.03, 0.01, MAT.black, 0, DEF_SCREEN.topY - 0.1, DEF_SCREEN_TOP_Z - 0.04, root); // the rear-view mirror
    tube([0, DEF_SCREEN.topY - 0.05, DEF_SCREEN_TOP_Z - 0.01], [0, DEF_SCREEN.topY - 0.09, DEF_SCREEN_TOP_Z - 0.04], 0.006, MAT.black, root, 4);
  }

  // The cab: the doors (groups on their front hinges), the body behind them with the long side window, the white roof cap with its alpine lights.
  function addCab() {
    const dz = (z) => z - door.hinge;
    const top = DEF_CAB.top;
    for (const s of [-1, 1]) {
      // A door: the lower panel, the window frame with the glass, the front upright, a trim card on its inside with a pull and a pocket, the
      // handle. Its own coordinates: z back from the hinge.
      const d = new THREE.Group();
      d.name = s > 0 ? 'doorLeft' : 'doorRight';
      d.userData.keep = true;
      d.position.set(s * door.x, 0, door.hinge);
      d.userData.mudRest = [s * door.x, 0, door.hinge];
      const len = door.hinge - door.rear;
      const lowH = door.y1 - door.y0;
      rbox(0.05, lowH, len, 0.012, paint, 0, (door.y0 + door.y1) / 2, -len / 2, d); // the lower panel
      rbox(0.03, 0.03, len, 0.008, frame, 0.01 * s, door.y1 + 0.005, -len / 2, d); // the black capping
      rbox(0.014, lowH - 0.08, len - 0.08, 0.004, trim.dash, -s * 0.03, (door.y0 + door.y1) / 2, -len / 2, d); // the trim card on its inside
      rbox(0.02, 0.1, 0.36, 0.01, plastic2, -s * 0.043, door.y0 + 0.2, dz(-0.1), d); // its map pocket
      tube([-s * 0.045, door.y1 - 0.12, dz(-0.28)], [-s * 0.045, door.y1 - 0.12, dz(0.1)], 0.012, plastic2, d, 6); // the pull, along the top of the card
      rbox(0.04, door.glassTop - door.y1 + 0.04, 0.045, 0.008, frame, 0, (door.y1 + door.glassTop) / 2 + 0.01, dz(door.rear) + 0.0225, d); // the rear upright
      const railFront = defScreenZ(door.glassTop + 0.045);
      rbox(0.04, 0.045, railFront - (door.rear - 0.025), 0.008, frame, 0, door.glassTop + 0.0225, dz((railFront + door.rear - 0.025) / 2), d); // the top rail
      post([0, door.y1, dz(defScreenZ(door.y1)) - 0.03], [0, door.glassTop + 0.045, dz(defScreenZ(door.glassTop + 0.045)) - 0.03], 0.03, 0.035, frame, d); // the front upright, on the screen post's line, holding the glass
      const glass = add(new THREE.ShapeGeometry(new THREE.Shape([
        new THREE.Vector2(dz(defScreenZ(door.y1 + 0.02)), door.y1 + 0.02), new THREE.Vector2(dz(door.rear + 0.02), door.y1 + 0.02),
        new THREE.Vector2(dz(door.rear + 0.02), door.glassTop), new THREE.Vector2(dz(defScreenZ(door.glassTop)), door.glassTop),
      ])).rotateY(-Math.PI / 2), MAT.glass, d);
      glass.position.x = 0;
      tube([s * 0.045, door.y1 - 0.12, dz(-0.22)], [s * 0.045, door.y1 - 0.12, dz(-0.34)], 0.012, MAT.black, d, 6); // the pull handle, outside
      rbox(0.03, 0.03, 0.1, 0.006, MAT.black, s * 0.04, door.y1 - 0.12, dz(-0.28), d);
      rbox(0.02, 0.03, 0.05, 0.006, MAT.black, s * 0.032, door.y1 - 0.18, dz(-0.1), d); // its lock
      root.add(d);
      post([s * door.x, DEF_SCREEN.baseY, DEF_SCREEN.baseZ], [s * door.x, DEF_SCREEN.topY, DEF_SCREEN_TOP_Z], 0.04, 0.05, frame, root); // the screen's raked side post
      for (const y of [0.78, 1.1]) rbox(0.03, 0.09, 0.05, 0.008, MAT.black, s * (door.x + 0.03), y, door.hinge + 0.01, root); // the hinges on the pillar
      // A big square mirror on two arms from the bulkhead under the screen's post: a named group, so the proportion check leaves it out.
      const mirror = new THREE.Group();
      mirror.name = 'mirror';
      mirror.userData.keep = true;
      mirror.position.set(s * 0.84, 1.3, defScreenZ(1.3) - 0.02);
      tube([0, -0.06, 0.02], [s * 0.14, 0.02, -0.06], 0.009, MAT.black, mirror, 6);
      tube([0, 0.06, 0.02], [s * 0.14, 0.1, -0.06], 0.009, MAT.black, mirror, 6);
      rbox(0.13, 0.2, 0.025, 0.01, MAT.black, s * 0.17, 0.11, -0.08, mirror);
      root.add(mirror);
      // The body at each side: the hinge pillar, the B pillar, the rear side with its arch, the long window, the rail over it.
      rbox(0.04, door.y1 - door.y0, 0.1, 0.01, paint, s * door.x, (door.y0 + door.y1) / 2, door.hinge + 0.06, root); // the hinge pillar
      const w = DEF_SIDE_WINDOW;
      rbox(0.04, top - 0.04 - door.y0, 0.05, 0.01, paint, s * door.x, (top - 0.04 + door.y0) / 2, door.rear - 0.025, root); // the B pillar
      archPanel(s * door.x, 0.04, door.y0, door.y1, DEF_END + 0.02, door.rear - 0.05, zR, paint, root); // the rear side below the window, with the arch cut in it
      flare(s, s * door.x, zR);
      rbox(0.03, 0.03, door.rear - 0.05 - (DEF_END + 0.02), 0.008, frame, s * (door.x + 0.002), door.y1 + 0.02, (door.rear - 0.05 + DEF_END + 0.02) / 2, root); // the capping carried on
      rbox(0.04, 0.05, door.rear - 0.05 - (DEF_END + 0.02), 0.008, frame, s * door.x, top - 0.025, (door.rear - 0.05 + DEF_END + 0.02) / 2, root); // the rail over the window
      const wl = w.z0 - w.z1;
      const wz = (w.z0 + w.z1) / 2;
      rbox(0.04, w.y1 - w.y0, 0.05, 0.01, frame, s * door.x, (w.y0 + w.y1) / 2, w.z0 + 0.025, root); // the post at the window's front
      rbox(0.04, w.y1 - w.y0, 0.05, 0.01, frame, s * door.x, (w.y0 + w.y1) / 2, w.z1 - 0.025, root); // and its back
      rbox(0.06, w.y1 - w.y0, 0.16, 0.012, paint, s * door.x, (w.y0 + w.y1) / 2, -1.43, root); // the C pillar, a solid panel across the window behind the back seats: the belts hang on it
      const side = add(new THREE.PlaneGeometry(wl, w.y1 - w.y0), MAT.glass, root); // the long window
      side.rotation.y = Math.PI / 2;
      side.position.set(s * door.x, (w.y0 + w.y1) / 2, wz);
      rbox(0.025, w.y1 - w.y0, 0.02, 0.006, frame, s * door.x, (w.y0 + w.y1) / 2, wz + 0.1, root); // the divider where the sliding half runs
      rbox(0.05, 0.12, 0.45, 0.01, MAT.black, s * (door.x + 0.03), 0.56, -0.06, root); // the black step under the door
      for (const z of [-0.2, 0.25]) rbox(0.05, 0.05, 0.03, 0.008, MAT.black, s * (door.x + 0.03), 0.6, z, root); // its brackets
      rbox(0.05, 0.09, 1.2, 0.01, MAT.chassis, s * door.x, 0.55, 0.0, root); // the sill under the door, closing the gap to the chassis
    }
    // The roof: the white cap, a loft with sloping sides and a rounded top, ends and all, from the screen's header to just past the back, with
    // a dark alpine light along each side of it and a gutter under its edge.
    const rf = DEF_ROOF;
    add(loftGeometry([
      { z: rf.z0, w: rf.w - 0.04, y0: rf.y0, y1: rf.y1 - 0.03 },
      { z: rf.z0 - 0.06, w: rf.w, y0: rf.y0, y1: rf.y1 },
      { z: rf.z1 + 0.06, w: rf.w, y0: rf.y0, y1: rf.y1 },
      { z: rf.z1, w: rf.w - 0.03, y0: rf.y0, y1: rf.y1 - 0.02 },
    ], { exponent: 5, bottom: 14 }), MAT.roof, root, 'roof'); // (a square bottom edge: a rounded one left a gap between the cap and the body)
    for (const s of [-1, 1]) {
      const light = add(new THREE.PlaneGeometry(0.9, 0.09), alpine, root);
      light.rotation.y = s * Math.PI / 2;
      light.position.set(s * (rf.w / 2 + 0.004), (rf.y0 + rf.y1) / 2 + 0.01, -1.05);
      rbox(0.01, 0.1, 0.96, 0.004, MAT.black, s * (rf.w / 2 - 0.004), (rf.y0 + rf.y1) / 2 + 0.01, -1.05, root); // its frame, behind
    }
    // The headlining: a grey lining under the roof, so you see it from inside through the windows.
    rbox(1.62, 0.012, rf.z0 - rf.z1 - 0.1, 0.004, lining, 0, DEF_CAB.top - 0.012, (rf.z0 + rf.z1) / 2, root);
  }

  // The back: the body round the back door (the corner posts with their narrow windows, the lamps, the bumper), the door itself on its offside
  // hinge with the window and the spare wheel in its cover, and the step under it.
  function addRear() {
    const rz = DEF_END;
    const B = DEF_BACK_DOOR;
    const h = B.y1 - B.y0;
    const doorW = B.width;
    for (const s of [-1, 1]) {
      // The corner post each side of the door: a body-colour panel with a narrow tall window in it, and the round lamps on it, low.
      const cx = s * (B.width / 2 + 0.2 + (s > 0 ? 0 : 0));
      // In pieces round a real opening (a window laid over a whole panel's face fights it, and shows the paint through it).
      rbox(0.4, 1.2 - B.y0, 0.04, 0.01, paint, cx, (B.y0 + 1.2) / 2, rz, root); // below the window
      rbox(0.4, B.y1 - 1.7, 0.04, 0.01, paint, cx, (1.7 + B.y1) / 2, rz, root); // above it
      for (const t of [-1, 1]) rbox(0.14, 0.5, 0.04, 0.01, paint, cx + t * 0.13, 1.45, rz, root); // either side
      const win = add(new THREE.PlaneGeometry(0.12, 0.5), MAT.glass, root);
      win.position.set(cx, 1.45, rz);
      win.rotation.y = Math.PI;
      for (const x of [-0.07, 0.07]) rbox(0.015, 0.54, 0.012, 0.004, MAT.black, cx + x, 1.45, rz - 0.015, root); // its frame
      for (const y of [1.18, 1.72]) rbox(0.16, 0.015, 0.012, 0.004, MAT.black, cx, y, rz - 0.015, root);
      // The lamps: a black block on the post under its window, in line with it (the same x), with a gap under the window's frame: the round stop
      // and tail lamp over the round indicator over the nearside's reverse lamp or the offside's fog lamp, evenly spaced down it.
      rbox(0.12, 0.4, 0.03, 0.01, MAT.black, cx, 0.93, rz - 0.035, root);
      lampAt(cx, 1.04, rz - 0.05, 0.04, tailMat, -1);
      lampAt(cx, 0.93, rz - 0.05, 0.04, amber, -1);
      rbox(0.08, 0.06, 0.02, 0.008, s > 0 ? smoke : fogMat, cx, 0.82, rz - 0.05, root);
      rbox(0.2, 0.26, 0.02, 0.005, MAT.black, s * 0.7, 0.5, zR - 0.52, root); // the mudflap behind the wheel
      badge(root, { x: s * 0.7, y: 0.5, z: zR - 0.5301, facing: -1, w: 0.14, h: 0.06, px: 600 }); // the maker's oval on it
    }
    rbox(1.74, 0.2, 0.12, 0.02, MAT.black, 0, 0.6, rz - 0.02, root); // the rear crossmember and step
    rbox(1.0, 0.22, 0.04, 0.01, paint, 0, 0.66 + 0.0, rz + 0.0, root); // the rear panel under the door, over the crossmember
    // The back door: its own coordinates, hinged on the offside edge, so the door runs from local x 0 (the hinge) out to +x.
    const door2 = new THREE.Group();
    door2.name = 'backDoor';
    door2.userData.keep = true;
    door2.position.set(B.hingeX, 0, rz);
    door2.userData.mudRest = [B.hingeX, 0, rz]; // the dirt on it swings with it
    const cx = doorW / 2;
    rbox(doorW, 0.46, 0.05, 0.012, paint, cx, B.y0 + 0.23, 0, door2); // below the window
    const winH = B.window.y1 - B.window.y0;
    const wy = (B.window.y0 + B.window.y1) / 2;
    for (const x of [0.08, doorW - 0.08]) rbox(0.16, winH, 0.05, 0.012, paint, x, wy, 0, door2); // beside the window
    rbox(doorW, B.y1 - B.window.y1, 0.05, 0.012, paint, cx, (B.window.y1 + B.y1) / 2, 0, door2); // above it
    rbox(doorW, B.window.y0 - (B.y0 + 0.46), 0.05, 0.012, paint, cx, (B.window.y0 + B.y0 + 0.46) / 2, 0, door2); // and the strip between
    const rear = add(new THREE.PlaneGeometry(B.window.w, winH), MAT.glass, door2);
    rear.position.set(cx, wy, 0);
    rear.rotation.y = Math.PI;
    rbox(B.window.w + 0.03, 0.02, 0.058, 0.006, MAT.black, cx, B.window.y0 - 0.005, -0.002, door2); // its black rubber, round the glass
    rbox(B.window.w + 0.03, 0.02, 0.058, 0.006, MAT.black, cx, B.window.y1 + 0.005, -0.002, door2);
    for (const x of [cx - B.window.w / 2 - 0.005, cx + B.window.w / 2 + 0.005]) rbox(0.02, winH + 0.03, 0.058, 0.006, MAT.black, x, wy, -0.002, door2);
    rbox(0.1, 0.04, 0.03, 0.006, MAT.black, doorW - 0.06, B.y0 + 0.5, -0.04, door2); // the handle
    rbox(0.06, 0.06, 0.04, 0.008, MAT.black, doorW - 0.01, B.y1 - 0.12, 0.02, door2); // the latch, on the free edge
    rbox(0.016, 0.28, 0.02, 0.004, MAT.chassis, 0.01, wy, 0.02, door2); // a strip on the hinge edge
    // The spare wheel on the door: only its black cover shows (a cylinder with a rounded edge, over the tyre and rim), on a stub carrier from the door.
    const coverBody = new THREE.Mesh(new THREE.LatheGeometry([
      [0.0, 0.1], [DEF_SPARE.r - 0.03, 0.1], [DEF_SPARE.r, 0.07], [DEF_SPARE.r, -0.09], [DEF_SPARE.r - 0.03, -0.105], [0.0, -0.105],
    ].map(([r, y]) => new THREE.Vector2(r, y)), 36).rotateX(-Math.PI / 2), cover); // the cover, its axis along z, its face looking back
    coverBody.position.set(cx, DEF_SPARE.y, -0.04 - DEF_SPARE.depth / 2); // its front face is 1.5 cm behind the door's back face (-0.025), the carrier's stub bridging the gap
    door2.add(coverBody);
    rbox(0.12, 0.3, 0.05, 0.01, MAT.black, cx, DEF_SPARE.y, -0.035, door2); // the carrier's stub, from the door into the cover
    badge(door2, { x: cx, y: DEF_SPARE.y, z: -0.04 - DEF_SPARE.depth - 0.0015, facing: -1, w: 0.2, h: 0.08, px: 900 }); // the maker's oval on the cover
    plate(regText, PLATE_BG, root, { x: 0, y: 0.66, z: rz - 0.0205, facing: -1 }); // the rear number plate, under the door
    root.add(door2);
    for (const y of [B.y0 + 0.1, B.y1 - 0.1]) rbox(0.06, 0.1, 0.06, 0.01, MAT.black, B.hingeX - 0.02, y, rz + 0.0, root); // the hinges, on the body
  }

  // Inside: the floor and seat box, the front seats (the outer two tip forward), the console between them, the back bench with the load space
  // behind it, the belts.
  function addInterior() {
    const fz = DEF_SCUTTLE.from + 0.02;
    rbox(1.56, 0.03, fz - -0.55, 0.01, trim.floor, 0, 0.62, (fz - 0.55) / 2, root); // the floor, from the bulkhead back to the seat box
    rbox(1.56, 0.26, 0.5, 0.02, paint, 0, 0.76, -0.3, root, 'seatBox');
    rbox(1.56, 0.03, 0.32, 0.01, trim.floor, 0, 0.62, -0.66, root); // the footwell behind the front seats
    rbox(0.4, 0.26, 0.9, 0.04, console_, 0, 0.75, 0.1, root); // the tunnel, a moulded console between the seats
    for (const [name, seat] of Object.entries(LANDY_SEATS)) {
      rbox(0.44, 0.1, 0.46, 0.04, trim.seat, seat.x, 0.9, seat.z - SEAT_BACK, root); // the cushion runs forward from the backrest
      for (const sx of [-1, 1]) rbox(0.03, 0.06, 0.4, 0.015, trim.seat, seat.x + sx * 0.2, 0.96, seat.z - SEAT_BACK, root); // its side bolsters
      // The outer two backrests tip forward to let people into the back: each is its own part, hinged at its foot (`seatBack_<seat>`, posed by
      // poseSeatTips). The middle one is fixed.
      const tips = TIPPING_SEATS.includes(name);
      let holder = root;
      let at = (x, y, z) => [x, y, z];
      if (tips) {
        holder = new THREE.Group();
        holder.name = `seatBack_${name}`;
        holder.userData.keep = true;
        holder.position.set(seat.x, 0.94, -0.5);
        root.add(holder);
        at = (x, y, z) => [x - seat.x, y - 0.94, z + 0.5];
      }
      rbox(0.44, 0.5, 0.08, 0.04, trim.seat, ...at(seat.x, 1.19, -0.5), holder).rotation.x = -0.08;
      for (const sx of [-1, 1]) rbox(0.04, 0.46, 0.1, 0.016, trim.seat, ...at(seat.x + sx * 0.21, 1.17, -0.48), holder).rotation.x = -0.08; // the backrest's bolsters
      if (name !== 'mid') {
        // A headrest built into the top of the backrest (the middle seat has none): wide and tall enough to read from behind, its bottom sunk into
        // the backrest so it is one piece with it.
        rbox(0.3, 0.2, 0.09, 0.04, trim.seat, ...at(seat.x, 1.49, -0.52), holder).rotation.x = -0.08;
      }
    }
    // The back bench (LANDY_REAR_SEATS): a seat box with three seats facing forward on it, the wheel boxes beside the outer two, and the load
    // floor behind. Its belts are posed by name.
    rbox(1.1, 0.26, 0.44, 0.02, paint, 0, 0.75, -1.02, root); // the seat box
    rbox(1.1, 0.4, 0.03, 0.01, paint, 0, 0.82, -1.29, root); // its back, up to the load floor behind
    for (const seat of Object.values(LANDY_REAR_SEATS)) {
      rbox(0.36, 0.1, 0.42, 0.04, trim.seat, seat.x, 0.94, seat.z - SEAT_BACK, root);
      rbox(0.36, 0.5, 0.08, 0.04, trim.seat, seat.x, 1.24, -1.26, root).rotation.x = -0.1; // (no headrests on the back bench)
    }
    // The load floor behind the bench: carpet on a solid block down to the chassis (so nothing underneath shows through the back or the windows),
    // level with the bench's cushions, with the wheel boxes beside it.
    const loadL = -1.32 - (DEF_END + 0.02);
    const loadZ = (-1.32 + DEF_END + 0.02) / 2;
    rbox(1.12, 0.32, loadL, 0.01, plastic2, 0, 0.74, loadZ, root); // the block under it
    rbox(1.12, 0.012, loadL - 0.02, 0.004, trim.floor, 0, 0.906, loadZ, root); // the carpet on top
    for (const s of [-1, 1]) {
      rbox(0.24, 0.5, 0.86, 0.04, trim.dash, s * 0.68, 0.86, zR, root); // the wheel box beside the bench, over the tyre, in the trim's plastic
      rbox(0.014, 0.5, 1.3, 0.004, trim.dash, s * 0.78, 1.0, -1.2, root); // the plastic trim on the rear side under the window
    }
    // The seat belts (detail/belts.js buildSeatBelt): a diagonal and lap belt for the outer seats, hanging on the body at the B pillar or the
    // rear quarter from the loop at the top to the reel at the bottom, and a lap belt for each middle seat. Stowed they hang there; worn they run
    // across whoever sits (poseUtvBelts poses the same names).
    for (const [seat, belt] of Object.entries({ driver: { anchor: -0.785, buckle: -0.23 }, mid: { anchor: -0.19, buckle: 0.19 }, left: { anchor: 0.785, buckle: 0.23 } })) {
      const s = LANDY_SEATS[seat];
      const lapOnly = seat === 'mid';
      const hip = [s.x, s.y - 0.05, s.z + SEAT_BACK];
      const top = lapOnly ? [belt.anchor, 0.98, -0.44] : [belt.anchor, 1.5, door.rear - 0.04];
      const low = lapOnly ? [belt.anchor, 0.98, -0.44] : [belt.anchor, 0.9, door.rear - 0.12];
      root.add(buildSeatBelt(seat, { top, low, buckle: [belt.buckle, 0.99, -0.42], hip, lapOnly, mats: { webbing } }));
    }
    // The back bench's: a diagonal and lap belt for the outer two from a loop on the C pillar (the solid panel across the side window behind them)
    // down to a reel on top of the wheel box, and a lap belt for the middle one, each with its buckle in the crease between cushion and backrest.
    for (const [seat, belt] of Object.entries({ rearLeft: { anchor: 0.76, buckle: 0.2 }, rearMid: { anchor: -0.16, buckle: 0.16 }, rearRight: { anchor: -0.76, buckle: -0.2 } })) {
      const s = LANDY_REAR_SEATS[seat];
      const lapOnly = seat === 'rearMid';
      const hip = [s.x, s.y - 0.05, s.z + SEAT_BACK];
      const top = lapOnly ? [belt.anchor, 0.99, -1.2] : [belt.anchor, 1.5, -1.43];
      const low = lapOnly ? [belt.anchor, 0.99, -1.2] : [belt.anchor, 1.12, -1.42];
      root.add(buildSeatBelt(seat, { top, low, buckle: [belt.buckle, 0.99, -1.18], hip, lapOnly, mats: { webbing } }));
    }
  }

  // The steering wheel, the dash and the controls. The wheel and its raked column stay where they were (about 0.45 m ahead of the hips); the dash
  // is a moulded slab with a binnacle, the centre stack with the radio, and the closeout panel under it.
  function addControls() {
    const column = new THREE.Group();
    column.name = 'steeringColumn';
    column.userData.keep = true;
    column.position.set(-0.42, 0.9, 0.5);
    column.rotation.x = -1.05;
    tube([0, 0, 0], [0, 0.42, 0], 0.026, MAT.black, column);
    root.add(column);
    addSignalStalk(column, 0.34, MAT.black, { modern: true });
    const wheel = new THREE.Group();
    wheel.name = 'handlebars';
    wheel.userData.keep = true;
    wheel.position.set(0, 0.42, 0);
    column.add(wheel);
    // A thick soft rim on two spokes with a big padded hub (the horn pad) carrying the badge, as in the photos.
    add(new THREE.TorusGeometry(0.2, 0.02, 10, 40).rotateX(Math.PI / 2), MAT.black, wheel);
    rbox(0.18, 0.05, 0.13, 0.03, MAT.black, 0, 0, 0, wheel); // the hub
    for (const sx of [-1, 1]) rbox(0.13, 0.022, 0.05, 0.01, MAT.black, sx * 0.115, -0.002, 0.005, wheel); // the two spokes, left and right, a little low
    badge(wheel, { x: 0, y: 0.0265, z: 0, facing: 1, w: 0.09, h: 0.04, px: 1200 }).rotation.set(-Math.PI / 2, 0, Math.PI);
    for (const side of [1, -1]) {
      const grip = new THREE.Object3D();
      grip.name = side > 0 ? 'gripLeft' : 'gripRight';
      grip.userData.keep = true;
      grip.position.set(side * 0.21, 0, 0);
      wheel.add(grip);
    }
    const hands = new THREE.Group(); // your own arms aren't drawn: Quad just expects the group
    hands.name = 'riderHands';
    hands.userData.keep = true;
    hands.visible = false;
    wheel.add(hands);

    const D = DEF_DASH;
    // The slab: a shallow top pad (0.28 m from the screen's foot to its front edge, with the demister grilles in it), a straight face down to
    // `face`, and nothing under it at the driver's end: the knees and feet go there, in front of the pedals. The passenger's end comes down to a
    // glovebox and the centre stack down to the console.
    rbox(D.half * 2, 0.07, D.z0 - D.z1, 0.012, plastic, 0, D.top - 0.035, (D.z0 + D.z1) / 2, root, 'dashTop');
    rbox(D.half * 2, D.top - 0.07 - D.face, 0.05, 0.012, plastic, 0, (D.top - 0.07 + D.face) / 2, D.z1 + 0.025, root, 'dashFace'); // the face, straight down from the shelf's edge
    rbox(D.half * 2 - 0.04, D.top - D.face - 0.04, D.z0 - D.z1 - 0.06, 0.012, plastic2, 0, (D.top + D.face) / 2 - 0.02, (D.z0 + D.z1) / 2 + 0.03, root); // the body of it, solid behind the face
    rbox(1.54, 0.3, 0.03, 0.01, plastic2, 0, 0.77, D.z0 - 0.035, root); // the plastic lining on the bulkhead under the shelf, down to the floor
    for (const s of [-1, 1]) {
      rbox(0.2, 0.004, 0.05, 0.002, MAT.black, s * 0.32, D.top + 0.002, 0.4, root); // a demister grille: a black plate with slots across it
      for (let i = 0; i < 5; i++) rbox(0.19, 0.003, 0.004, 0.001, plastic, s * 0.32, D.top + 0.004, 0.378 + i * 0.011, root);
    }
    rbox(1.4, 0.004, 0.025, 0.002, MAT.black, 0, D.top + 0.002, D.z0 - 0.04, root); // the demister slot along the screen's foot
    // The binnacle: the pod (the old fixed point) in the top of the slab, with an eyebrow over it.
    const dash = buildDash(dashStyle);
    dash.group.position.set(D.pod.x, D.pod.y, D.pod.z);
    dash.group.rotation.x = D.pod.tilt;
    dash.group.scale.setScalar(1.5); // the binnacle's about 0.36 m wide
    dash.group.userData.keep = true;
    root.add(dash.group);
    quad.userData.dash = dash;
    quad.userData.metalBody = true;
    quad.userData.podMount = null;
    rbox(0.44, 0.02, 0.1, 0.01, plastic, D.pod.x, D.pod.y + 0.095, D.pod.z + 0.06, root); // the eyebrow over the pod
    rbox(1.56, 0.1, 0.03, 0.01, plastic, 0, 1.19, D.z0 - 0.015, root); // the padded roll along the back of the shelf, up to the screen's bottom rail, so no gap shows
    // The centre stack: a deep box from the shelf down to the console, its face a little proud of the shelf's, with a row of rockers over the radio
    // (a head unit with a display and a row of preset buttons) and the heater's two knobs under it. The `radio` is the game's one.
    const st = D.stack;
    const front = D.z1 - 0.02; // the stack's face
    rbox(st.w, 0.28, 0.3, 0.01, console_, st.x, 1.0, front + 0.15, root);
    const fit = (g, x, y, z, rot = Math.PI) => {
      g.position.set(x, y, z);
      g.rotation.y = rot;
      root.add(g);
    };
    const rocker = (x, y, on, z = front) => { // a rocker: a bezel with a cap tipped one way or the other, on a face at z
      rbox(0.03, 0.04, 0.006, 0.002, MAT.black, x, y, z - 0.003, root);
      const cap = rbox(0.022, 0.032, 0.01, 0.002, console_, x, y, z - 0.009, root);
      cap.rotation.x = on ? 0.15 : -0.15;
      rbox(0.012, 0.004, 0.004, 0.001, on ? MAT.amber : MAT.chassis, x, y + 0.008, z - 0.015, root);
    };
    for (const [i, on] of [[-2, true], [-1, false], [0, false], [1, true], [2, false]]) rocker(st.x + i * 0.05, 1.085, on);
    const head = label(st.w - 0.03, 0.09, 1400, (g, W, H) => {
      g.fillStyle = '#0e1012';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#9a9ea3';
      g.fillRect(0, 0, W, H * 0.05);
      g.fillStyle = '#10222c'; // the display
      g.fillRect(W * 0.2, H * 0.14, W * 0.6, H * 0.45);
      g.fillStyle = '#f09a28';
      fitText(g, '97.4 FM', W * 0.5, H * 0.38, H * 0.3, W * 0.5);
      g.fillStyle = '#2d86d6';
      for (let i = 0; i < 6; i++) g.fillRect(W * (0.2 + i * 0.1), H * 0.7, W * 0.075, H * 0.14);
      g.fillStyle = '#9a9ea3'; // a knob each end
      for (const x of [0.09, 0.91]) {
        g.beginPath();
        g.arc(W * x, H * 0.45, H * 0.26, 0, Math.PI * 2);
        g.fill();
      }
    }, root);
    head.position.set(st.x, 0.995, front - 0.0015);
    head.rotation.y = Math.PI;
    quad.userData.cleanMaterials.push(head.material);
    for (const x of [-0.1, 0.1]) add(new THREE.CylinderGeometry(0.018, 0.02, 0.014, 12).rotateX(Math.PI / 2), MAT.knob, root).position.set(st.x + x, 0.915, front - 0.007); // the heater's rotary knobs
    // The heater's two sliders at the driver's end of the face (red-to-blue strips), and a row of three rockers on the face between the column and
    // the stack.
    const strips = label(0.1, 0.14, 400, (g, W, H) => {
      g.fillStyle = '#1b1c1e';
      g.fillRect(0, 0, W, H);
      for (const [x, from, to] of [[0.3, '#3b6fd8', '#d8402e'], [0.7, '#3b6fd8', '#d8402e']]) {
        const grad = g.createLinearGradient(0, H * 0.1, 0, H * 0.9);
        grad.addColorStop(0, from);
        grad.addColorStop(1, to);
        g.fillStyle = grad;
        g.fillRect(W * (x - 0.07), H * 0.1, W * 0.14, H * 0.8);
      }
    }, root);
    strips.position.set(-0.72, 1.0, D.z1 - 0.002);
    strips.rotation.y = Math.PI;
    for (const x of [-0.7, -0.74]) rbox(0.016, 0.03, 0.018, 0.004, MAT.black, x, 0.99, D.z1 - 0.011, root); // the sliders
    for (const [i, on] of [[0, false], [1, false], [2, true]]) rocker(-0.28 + i * 0.05, 1.0, on, D.z1);
    // The passenger's glovebox: a box down from the shelf on that side with a lid in its face, and a grab handle on the face above.
    const gx = (D.glove.x0 + D.glove.x1) / 2;
    rbox(D.glove.x1 - D.glove.x0, D.face - D.foot, D.z0 - D.z1, 0.012, plastic2, gx, (D.face + D.foot) / 2, (D.z0 + D.z1) / 2, root);
    fit(buildGlovebox({ w: 0.4, h: 0.17 }), gx, D.foot + 0.025, D.z1 - 0.003);
    const grab = buildGrabHandle({ len: 0.22, stand: 0.035, r: 0.01 });
    grab.position.set(0.52, 1.0, D.z1 - 0.003);
    grab.rotation.set(0, Math.PI, 0);
    root.add(grab);
    // A diesel with glow plugs has no choke and no hand throttle; the pose code still looks the knobs up by name.
    for (const name of ['chokeKnob', 'handThrottleKnob']) {
      const g = new THREE.Group();
      g.name = name;
      g.userData.keep = true;
      g.visible = false;
      root.add(g);
    }
    // The levers on the console: the gear lever (a long bent stalk out of a big black gaiter, a ball knob), the high and low transfer lever and the
    // yellow-knobbed diff lock lever, through a plate. Short, so none reaches the dash.
    const lever = (name, x, mat, len, r) => {
      const g = new THREE.Group();
      g.name = name;
      g.userData.keep = true;
      g.position.set(x, 0.84, 0.04);
      tube([0, 0, 0], [0, len, 0], 0.009, MAT.galv, g, 5);
      add(new THREE.SphereGeometry(r, 12, 10), mat, g).position.set(0, len, 0);
      root.add(g);
    };
    lever('gearLever', -0.08, MAT.knob, 0.3, 0.03);
    lever('transferKnob', 0.06, MAT.knob, 0.2, 0.018);
    lever('diffLockKnob', 0.14, MAT.yellow, 0.14, 0.016);
    add(new THREE.CylinderGeometry(0.04, 0.075, 0.08, 14), MAT.rubber, root).position.set(-0.08, 0.88, 0.04); // the gear lever's big gaiter
    for (const x of [0.06, 0.14]) add(new THREE.CylinderGeometry(0.024, 0.04, 0.05, 12), MAT.rubber, root).position.set(x, 0.865, 0.04);
    rbox(0.24, 0.012, 0.18, 0.005, MAT.steel, 0.1, 0.88, 0.04, root); // the plate round the transfer and diff lock levers
    // The pedals: clutch, brake and accelerator, black pads hanging on arms from under the dash.
    for (const [x, w] of [[-0.55, 0.075], [-0.4, 0.075], [-0.25, 0.045]]) {
      const pad = new THREE.Group();
      pad.position.set(x, 0.66, 0.32);
      pad.rotation.x = -0.6;
      rbox(w, 0.016, 0.1, 0.005, MAT.black, 0, 0, 0, pad);
      for (const dz of [-0.03, 0, 0.03]) rbox(w - 0.01, 0.006, 0.008, 0.002, MAT.knob, 0, 0.01, dz, pad);
      root.add(pad);
      tube([x, 0.68, 0.34], [x, 0.93, 0.53], 0.008, MAT.galv, root, 5); // the arm, up to its pivot on the bulkhead's lining
    }
    // The handbrake: a ratchet lever on the right of the console, by the driver's left knee. Down and forward when off; pulled up and back when on.
    const hb = new THREE.Group();
    hb.name = 'parkBrakeLever';
    hb.userData.keep = true;
    hb.position.set(-0.22, 0.8, -0.05);
    tube([0, 0, 0], [0, 0.2, 0], 0.01, MAT.galv, hb, 6);
    add(new THREE.CylinderGeometry(0.019, 0.022, 0.1, 10), MAT.knob, hb).position.set(0, 0.24, 0);
    rbox(0.014, 0.014, 0.02, 0.004, MAT.red, 0, 0.295, 0, hb); // the release button
    hb.rotation.x = HANDBRAKE_OFF;
    root.add(hb);
    rbox(0.012, 0.1, 0.1, 0.004, MAT.steel, -0.22, 0.84, -0.07, root); // the ratchet quadrant it moves against
    add(new THREE.CylinderGeometry(0.03, 0.045, 0.05, 10), MAT.rubber, root).position.set(-0.22, 0.84, -0.05); // and its gaiter
    for (const name of ['fuelTap', 'chokeLever']) { // Quad poses these two on a quad; the 200TDi has neither
      const g = new THREE.Group();
      g.name = name;
      g.userData.keep = true;
      g.visible = false;
      root.add(g);
    }
  }

  // The tow jaw (a pin through a jaw, where the trailer's ring goes) behind the crossmember, the exhaust, and the anchors people hang from.
  function addTail() {
    rbox(1.0, 0.12, 0.1, 0.01, MAT.chassis, 0, 0.56, DEF_END - 0.12, root);
    rbox(0.08, 0.08, 0.1, 0.01, MAT.steel, DEF_HITCH.x, DEF_HITCH.y, DEF_HITCH.z + 0.02, root);
    tube([DEF_HITCH.x, DEF_HITCH.y + 0.06, DEF_HITCH.z - 0.01], [DEF_HITCH.x, DEF_HITCH.y - 0.06, DEF_HITCH.z - 0.01], 0.01, MAT.galv, root, 6);
    rbox(0.1, 0.05, 0.4, 0.01, MAT.steel, 0, 0.56, DEF_HITCH.z + 0.2 - 0.0, root); // the tow plate, out from the crossmember to the jaw
    const hitch = new THREE.Object3D();
    hitch.name = 'towHitch';
    hitch.position.set(DEF_HITCH.x, DEF_HITCH.y, DEF_HITCH.z);
    root.add(hitch);
    // The exhaust: a silencer under the right side, inboard of the rail, and a tailpipe running under the back.
    const tail = DEF_END - 0.1;
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 14).rotateX(Math.PI / 2), MAT.rust, root).position.set(-0.34, 0.38, -0.7);
    tube([-0.34, 0.38, -1.0], [-0.36, 0.34, tail], 0.022, MAT.rust, root, 6);
    const tip = new THREE.Object3D();
    tip.name = 'exhaustTip';
    tip.position.set(-0.36, 0.34, tail);
    root.add(tip);
    // The seats' anchors: hips on the cushions. The driver's is yours; the others are where the girls sit; the back bench's too.
    for (const [name, seat] of [['riderAnchor', LANDY_SEATS.driver], ['seatMid', LANDY_SEATS.mid], ['seatLeft', LANDY_SEATS.left]]) {
      const a = new THREE.Object3D();
      a.name = name;
      a.position.set(seat.x, seat.y, seat.z);
      root.add(a);
    }
    const cap = (n) => n[0].toUpperCase() + n.slice(1);
    for (const [name, seat] of Object.entries(LANDY_REAR_SEATS)) {
      const a = new THREE.Object3D();
      a.name = `seat${cap(name)}`;
      a.position.set(seat.x, seat.y, seat.z);
      const eyes = new THREE.Object3D();
      eyes.name = `camera${cap(name)}`;
      eyes.position.set(seat.x, seat.y + 0.69, seat.z + 0.02);
      root.add(a, eyes);
    }
    const cameraAnchor = new THREE.Object3D();
    cameraAnchor.name = 'cameraAnchor';
    cameraAnchor.position.set(LANDY_SEATS.driver.x, LANDY_SEATS.driver.y + 0.69, LANDY_SEATS.driver.z + 0.02);
    root.add(cameraAnchor);
    for (const [name, seat] of [['cameraMid', LANDY_SEATS.mid], ['cameraLeft', LANDY_SEATS.left]]) {
      const a = new THREE.Object3D();
      a.name = name;
      a.position.set(seat.x, seat.y + 0.69, seat.z + 0.02);
      root.add(a);
    }
  }

  for (const w of DEFENDER_LAYOUT.wheels) {
    const wheelModel = buildWheel(w, MAT.rimGrey);
    wheelModel.name = w.name;
    quad.add(wheelModel);
  }
  addHeadlightBeams(quad);
  addSignalLamps(quad, amber, smoke);
  quad.userData.sideMaterial = sideMat; // lit with the headlights
  quad.userData.tailMaterial = tailMat;
  quad.userData.tailHaloMaterial = new THREE.SpriteMaterial({ transparent: true, opacity: 0 });
  quad.userData.tailHalos = [];
  mergeStatic(root);
  quad.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return quad;
}

/** Swings the back door out on its offside hinge: 0 (shut) to 1 (swung right out behind, a little past square). */
export function poseDefenderBackDoor(model, open) {
  const door = model.getObjectByName('backDoor');
  if (!door || !door.userData.keep) return;
  door.rotation.y = DEF_BACK_DOOR.open * open;
}
