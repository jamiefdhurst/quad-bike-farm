import { part } from './part.js';
import * as THREE from 'three';
import { buildDash } from './dash.js';
import { addHeadlightBeams, addSignalLamps, addSignalStalk, addHazardSwitch, faceAlong } from './quadModel.js';
import { bentTube, loftGeometry, mergeStatic } from './quadGeometry.js';
import { buildSeatBelt, webbingMaterial } from './detail/belts.js';
import { buildWiper } from './detail/fittings.js';
import { buildToggle, buildPullKnob, buildLampLens } from './detail/switchgear.js';
import { buildRadio } from './detail/radios.js';
import {
  MAT, add, rbox as roundedBox, archPanel, archFlare, post, tube, axleCyl, plate, label, fitText, badge, trimMaterials, seatRip, buildWheel, addWheelFace, tyre, cached, addPedals,
  LANDY_SEATS, LANDY_LAYOUT, SEAT_BACK, HANDBRAKE_OFF, CRANK_HOLE, R, WHEELBASE, PLATE,
} from './landRoverModel.js';
import {
  SERIES_END, SERIES_FRONT, SERIES_WING, SERIES_BONNET, SERIES_BONNET_E, SERIES_SCUTTLE, SERIES_SPARE, SERIES_SCREEN, SERIES_SCREEN_H, SERIES_SCREEN_TOP_Z,
  screenZ, SERIES_DOOR, SERIES_CAB, SERIES_ROOF, SERIES_TUB, SERIES_GATE, SERIES_TUB_SPOTS, SERIES_TUB_PROXY, SERIES_HITCH, SERIES_DASH,
} from './seriesBody.js';

// The Series III pick-up at its real size (TODO 100), built from seriesBody.js's numbers after the photos. It is driven by Quad through the
// same named parts as the 200TDi's model (landRoverModel.js: steeringColumn > handlebars, dash, gearLever, transferKnob, diffLockKnob,
// chokeKnob, handThrottleKnob, parkBrakeLever, riderAnchor, seatMid, seatLeft, the cameras, crankHole, towHitch, exhaustTip, belt_<seat>), plus:
//
//   doorLeft, doorRight     groups hinged on their front edges: poseSeriesDoors swings them (the dirt on them goes with them: `mudRest`)
//   tailgate                a group hinged along the tub floor's rear edge: poseSeriesTailgate drops it, and stretches the two chains
//   bedCargo0..5, bedProxy  where things stand in the tub and a box to look at to put something in (game.js addLandyCargo)

const PLATE_BG = '#e8c51c';

/** A box with its edges rounded, or a plain one for a radius up to 12 mm (watertight where boxes butt, see defenderModel.js: rounded boxes leave pinholes at the corners). */
function rbox(w, h, d, r, mat, x, y, z, parent, name) {
  if (r > 0.012) return roundedBox(w, h, d, r, mat, x, y, z, parent, name);
  const m = add(new THREE.BoxGeometry(w, h, d), mat, parent, name);
  m.position.set(x, y, z);
  return m;
}

/** The Series III hard-top pick-up. `reg` is the number plate (a visiting one has its own). */
export function buildSeriesModel({ bodyColor = 0x3b4a36, dashStyle = 'series', reg = null } = {}) {
  const regText = reg ?? PLATE;
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.55, side: THREE.DoubleSide });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2c302c, roughness: 0.08, metalness: 0.2, emissive: 0x000000 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x3a0a07, roughness: 0.25, emissive: 0x000000 }); // dark red until lit
  const amber = new THREE.MeshStandardMaterial({ color: 0x5c2c08, roughness: 0.25 }); // the indicators: dark amber until they flash (addSignalLamps lights each side)
  const smoke = new THREE.MeshStandardMaterial({ color: 0x4d5254, roughness: 0.2 }); // the reverse lens: smoked until it lights
  const reflector = new THREE.MeshStandardMaterial({ color: 0x6e1712, roughness: 0.2 }); // the red reflectors under the tail lamps
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x555a5c, roughness: 0.2, emissive: 0x000000 }); // the sidelamps: smoked until the headlights come on (setHeadlights lights them)
  const trim = trimMaterials(false);
  const frame = MAT.galv; // the screen's and the windows' frames and the cappings are galvanised
  const webbing = webbingMaterial();
  const dashMetal = new THREE.MeshStandardMaterial({ color: 0x6b7152, roughness: 0.6, metalness: 0.15 }); // the dash: painted metal, olive
  const dashMetal2 = new THREE.MeshStandardMaterial({ color: 0x5b6145, roughness: 0.65, metalness: 0.15 }); // its lip and the radio's housing, a shade darker
  const felt = new THREE.MeshStandardMaterial({ color: 0x1b1b19, roughness: 0.95 }); // the tray's felt

  const quad = new THREE.Group();
  quad.name = 'quad';
  quad.userData.lensMaterial = lensMat;
  quad.userData.seatMaterial = trim.seat;
  quad.userData.cleanMaterials = [trim.seat, trim.dash, trim.floor, MAT.belt, dashMetal, dashMetal2, felt]; // the cab's inside never gets muddy (effects/mudCoat.js)
  quad.userData.cabin = { min: [-0.9, 0.4, SERIES_CAB.rear - 0.04], max: [0.9, SERIES_CAB.top + 0.05, SERIES_SCREEN.baseZ + 0.02] }; // the paint inside it stays clean too (cabinMud.js)
  quad.userData.steerGain = 7; // a big wheel, a lot of turns lock to lock
  quad.userData.liveMaterials = [sideMat]; // what the game lights directly (the sidelamps, a radio's display): the mud coat leaves them be
  quad.userData.knobZ = SERIES_DASH.knobZ; // where poseLandyControls pulls the choke and the hand throttle from
  const body = new THREE.Group();
  body.name = 'body';
  quad.add(body);
  const root = new THREE.Group();
  root.name = 'bodyRoot';
  body.add(root);
  const zF = WHEELBASE / 2;
  const zR = -WHEELBASE / 2;
  const { wing, door, tub } = { wing: SERIES_WING, door: SERIES_DOOR, tub: SERIES_TUB };

  // Chassis: two box-section rails and cross members, the engine and gearbox, live axles with their diffs, and the leaf springs.
  for (const s of [-1, 1]) rbox(0.08, 0.15, 3.4, 0.01, MAT.chassis, s * 0.43, 0.5, -0.025, root);
  for (const z of [1.62, 0.6, -0.5, -1.4]) rbox(0.86, 0.1, 0.08, 0.01, MAT.chassis, 0, 0.5, z, root);
  rbox(0.5, 0.42, 0.75, 0.05, MAT.steel, 0, 0.75, 1.05, root); // the engine under the bonnet
  rbox(0.3, 0.3, 0.6, 0.04, MAT.steel, 0, 0.6, 0.3, root); // gearbox and transfer box under the seat
  tube([0, 0.48, 0.05], [0, 0.4, zR + 0.25], 0.03, MAT.steel, root); // the propshafts
  tube([0, 0.48, 0.55], [0, 0.4, zF - 0.25], 0.03, MAT.steel, root);
  for (const [z, off] of [[zF, 0.18], [zR, -0.12]]) {
    axleCyl(0.05, 1.31, MAT.chassis, 0, R, z, root);
    add(new THREE.SphereGeometry(0.15, 16, 12), MAT.chassis, root).position.set(off, R, z); // the diff casing, offset as on a Series
    for (const s of [-1, 1]) {
      // A leaf spring along the rail, with its shackle, and a damper.
      add(bentTube([[s * 0.43, 0.56, z + 0.48], [s * 0.43, 0.46, z], [s * 0.43, 0.56, z - 0.48]], 0.028, { bend: 0.2, radial: 6 }), MAT.chassis, root);
      tube([s * 0.5, 0.42, z + 0.08], [s * 0.5, 0.7, z + 0.2], 0.022, MAT.steel, root);
    }
  }

  addFront();
  addScuttleAndScreen();
  addCab();
  addTub();
  addInterior();
  addControls();
  addTail();

  // The front: the galvanised bumper with the starting handle's hole, the body-colour panel with the silver grille, the wings with their
  // lamps, the bonnet with the spare wheel on it.
  function addFront() {
    const bz = SERIES_FRONT.bumper - 0.05;
    rbox(1.62, 0.17, 0.1, 0.02, MAT.galv, 0, 0.6, bz, root); // the bumper
    for (const s of [-1, 1]) rbox(0.07, 0.17, 0.16, 0.02, MAT.galv, s * 0.83, 0.6, bz - 0.04, root); // its ends, turned back
    for (const s of [-1, 1]) rbox(0.06, 0.12, 0.2, 0.01, MAT.chassis, s * 0.43, 0.6, 1.68, root); // its mounts to the rails
    add(new THREE.TorusGeometry(0.035, 0.012, 8, 16), MAT.steel, root).position.set(CRANK_HOLE.x, CRANK_HOLE.y + 0.04, CRANK_HOLE.z - 0.035); // the starting handle's hole
    add(new THREE.CircleGeometry(0.03, 14), MAT.knob, root).position.set(CRANK_HOLE.x, CRANK_HOLE.y + 0.04, CRANK_HOLE.z - 0.04);
    plate(regText, '#ece9de', root, { x: 0.45, y: 0.6, z: SERIES_FRONT.bumper + 0.0005, facing: 1 }); // the front number plate, on the bumper's face

    // The panel between the wings (body colour), and the grille in it: a silver frame round a black opening with bars across, and a mesh
    // wing of dark grey either side. The maker's name is a black strip with silver letters over it.
    const pz = SERIES_FRONT.panel;
    rbox(0.74, 0.5, 0.04, 0.012, paint, 0, 0.9, pz, root);
    rbox(0.52, 0.42, 0.02, 0.008, MAT.galv, 0, 0.88, pz + 0.025, root);
    rbox(0.46, 0.36, 0.02, 0.006, MAT.black, 0, 0.88, pz + 0.033, root);
    for (let i = 0; i < 7; i++) rbox(0.46, 0.018, 0.016, 0.004, MAT.galv, 0, 0.73 + i * 0.05, pz + 0.045, root);
    for (const s of [-1, 1]) rbox(0.1, 0.36, 0.012, 0.004, MAT.steel, s * 0.31, 0.88, pz + 0.022, root);
    const name = label(0.22, 0.04, 1000, (g, W, H) => {
      g.fillStyle = '#16171a';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#d4d7da';
      fitText(g, 'MOORLAND', W / 2, H / 2 + H * 0.04, H * 0.7, W * 0.9);
    }, root);
    name.position.set(0, 1.12, pz + 0.0215);
    rbox(0.72, 0.06, 0.04, 0.012, paint, 0, 0.655, pz + 0.005, root); // the valance under it, over the bumper: its face (pz + 0.025) is not the grille frame's (pz + 0.035)

    for (const s of [-1, 1]) {
      const wz = (SERIES_FRONT.wingFace + wing.scuttle) / 2; // the flat top runs from the scuttle to the front edge
      const wl = SERIES_FRONT.wingFace + 0.02 - wing.scuttle;
      rbox(wing.outer - wing.inner + 0.01, 0.03, wl, 0.012, paint, s * (wing.outer + wing.inner) / 2, wing.top - 0.015, wz + 0.01, root, 'wingTop'); // the flat top, which you can stand a mug on
      archPanel(s * wing.outer, 0.03, wing.bottom, wing.top - 0.004, wing.scuttle, SERIES_FRONT.wingFace + 0.02, zF, paint, root); // the outer side (its top edge 4 mm under the flat top's face, not on it), with the wheel arch cut in it
      archFlare(s * (wing.outer + 0.015), zF, paint, root);
      rbox(0.03, wing.top - wing.bottom - 0.02, SERIES_FRONT.wingFace - wing.rear, 0.01, paint, s * wing.inner, (wing.top + wing.bottom) / 2 - 0.01, (SERIES_FRONT.wingFace + wing.rear) / 2, root); // the inner wall, against the engine bay
      rbox(wing.outer - wing.inner, wing.top - wing.bottom - 0.004, 0.03, 0.01, paint, s * (wing.outer + wing.inner) / 2, (wing.top + wing.bottom) / 2 - 0.002, SERIES_FRONT.wingFace, root); // the front face (4 mm under the top too)
      const lx = s * 0.55;
      const bezel = add(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 22).rotateX(Math.PI / 2), MAT.galv, root); // the headlamp's rim
      bezel.position.set(lx, 0.91, SERIES_FRONT.wingFace + 0.012);
      const lamp = add(new THREE.CylinderGeometry(0.087, 0.087, 0.02, 22).rotateX(Math.PI / 2), lensMat, root);
      lamp.position.set(lx, 0.91, SERIES_FRONT.wingFace + 0.032);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 14).rotateX(Math.PI / 2), sideMat, root).position.set(s * 0.74, 1.02, SERIES_FRONT.wingFace + 0.02); // the sidelamp, above and outboard
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 14).rotateX(Math.PI / 2), amber, root).position.set(s * 0.74, 0.8, SERIES_FRONT.wingFace + 0.02); // the indicator below it
    }

    // The bonnet: a crowned loft, narrower than the gap between the wings, hinged at the scuttle and held down at the front by two catches.
    add(loftGeometry(SERIES_BONNET, { exponent: SERIES_BONNET_E }), paint, root, 'bonnet');
    for (const s of [-1, 1]) rbox(0.07, 0.025, 0.05, 0.008, MAT.galv, s * 0.24, 1.2, 1.5, root); // the catches
    // The spare wheel, lying flat on the bonnet over its rear half, strapped down.
    const spare = new THREE.Group();
    spare.position.set(0, SERIES_SPARE.y, SERIES_SPARE.z);
    spare.rotation.z = Math.PI / 2;
    add(cached('tyre', tyre), MAT.rubber, spare);
    addWheelFace(spare, 1);
    root.add(spare);
    for (const dz of [-0.2, 0.2]) rbox(0.05, 0.02, 0.05, 0.005, MAT.chassis, 0, SERIES_SPARE.y + 0.118, SERIES_SPARE.z + dz, root); // the straps' buckles
    rbox(0.05, 0.02, 0.8, 0.005, MAT.chassis, 0, SERIES_SPARE.y + 0.112, SERIES_SPARE.z, root); // the strap, its underside 3 mm into the tread so it never shares a face with it
  }

  // The scuttle (the deck behind the bonnet with the two vent flaps on it), the bulkhead under it, and the windscreen: a galvanised frame
  // raked back, two panes and a centre post, with its wipers on the outside and the mirror at the top.
  function addScuttleAndScreen() {
    const sc = SERIES_SCUTTLE;
    rbox(1.66, 0.04, sc.to - sc.from, 0.012, paint, 0, sc.top - 0.02, (sc.from + sc.to) / 2, root); // the deck
    rbox(1.66, 0.6, 0.05, 0.02, paint, 0, 0.9, sc.from + 0.02, root); // the bulkhead under it
    for (const s of [-1, 1]) {
      rbox(0.42, 0.025, 0.17, 0.01, paint, s * 0.3, sc.top + 0.01, 0.56, root); // the vent flaps: raised panels, one each side
      rbox(0.05, 0.02, 0.025, 0.006, MAT.galv, s * 0.3, sc.top + 0.03, 0.62, root); // with a catch
      rbox(0.06, 0.03, 0.04, 0.008, MAT.galv, s * 0.24, sc.top + 0.005, 0.69, root); // and the bonnet's hinges, at its back edge
      const pz = door.hinge + 0.11; // the hinge pillar ends here; the body's side runs on from it to the wing, one panel the whole way (no two panels share a face)
      rbox(0.03, sc.top - 0.04 - wing.bottom, sc.to - 0.006 - pz, 0.01, paint, s * (wing.outer - 0.004), (sc.top - 0.04 + wing.bottom) / 2, (pz + sc.to - 0.006) / 2, root); // the scuttle's side, up under its deck, 4 mm inboard of the wing's side and short of its front so they share no face
    }
    const screen = new THREE.Group();
    screen.position.set(0, SERIES_SCREEN.baseY, SERIES_SCREEN.baseZ);
    screen.rotation.x = -SERIES_SCREEN.rake;
    root.add(screen);
    const H = SERIES_SCREEN_H;
    rbox(1.64, 0.06, 0.06, 0.01, frame, 0, 0.03, 0, screen); // the bottom rail, on the scuttle
    rbox(1.64, 0.06, 0.06, 0.01, frame, 0, H - 0.03, 0, screen); // the top rail, into the roof
    rbox(0.05, H, 0.05, 0.01, frame, 0, H / 2, 0, screen); // the centre post
    for (const s of [-1, 1]) {
      const pane = add(new THREE.PlaneGeometry(0.76, H - 0.1), MAT.glass, screen);
      pane.position.set(s * 0.4, H / 2, 0);
      rbox(0.05, H, 0.05, 0.01, frame, s * 0.8, H / 2, 0, screen); // the sides: the doors' front uprights
      // A wiper from the kit, parked along the foot of the glass on the outside: its spindle by the centre post, the arm out to the pillar.
      const wiper = buildWiper({ len: 0.55, mats: { arm: MAT.black } });
      wiper.position.set(s * 0.1, 0.03, 0); // its spindle in the bottom rail, below the glass, the arm rising out of it onto the glass
      wiper.rotation.z = s > 0 ? 0.12 : Math.PI - 0.12;
      screen.add(wiper);
    }
    rbox(0.2, 0.07, 0.03, 0.01, MAT.black, 0, SERIES_SCREEN.topY - 0.1, SERIES_SCREEN_TOP_Z - 0.04, root); // the rear-view mirror
    tube([0, SERIES_SCREEN.topY - 0.05, SERIES_SCREEN_TOP_Z - 0.01], [0, SERIES_SCREEN.topY - 0.09, SERIES_SCREEN_TOP_Z - 0.04], 0.006, MAT.galv, root, 4);
  }

  // The cab: the doors (groups on their front hinges), the sides behind them, the rear panel with its window and the white roof.
  function addCab() {
    const dz = (z) => z - door.hinge;
    for (const s of [-1, 1]) {
      // A door: the lower panel, the capping along its top, the window frame with the glass (a divider where the sliding half runs), the rear
      // upright, a trim card on its inside, the push button handle. Its own coordinates: z back from the hinge.
      const d = new THREE.Group();
      d.name = s > 0 ? 'doorLeft' : 'doorRight';
      d.userData.keep = true;
      d.position.set(s * door.x, 0, door.hinge);
      d.userData.mudRest = [s * door.x, 0, door.hinge]; // the dirt on it swings with it (effects/mudCoat.js)
      const len = door.hinge - door.rear;
      const lowH = door.y1 - door.y0;
      rbox(0.05, lowH, len, 0.012, paint, 0, (door.y0 + door.y1) / 2, -len / 2, d); // the lower panel
      rbox(0.03, 0.03, len, 0.008, frame, 0.015 * s, door.y1 + 0.005, -len / 2, d); // the capping, its outer face 5 mm proud of the panel's
      rbox(0.014, lowH - 0.1, len - 0.1, 0.004, trim.dash, -s * 0.03, (door.y0 + door.y1) / 2, -len / 2, d); // the trim card on its inside
      rbox(0.032, door.glassTop - door.y1 + 0.04, 0.045, 0.008, paint, 0, (door.y1 + door.glassTop) / 2 + 0.01, dz(door.rear) + 0.0225, d); // the rear upright, thinner than the rail so they share no face
      const railFront = screenZ(door.glassTop + 0.045); // the glass's top edge follows the raked post, so the rail starts where it does
      rbox(0.04, 0.045, railFront - (door.rear - 0.025), 0.008, paint, 0, door.glassTop + 0.0225, dz((railFront + door.rear - 0.025) / 2), d); // the top rail, up against the roof
      rbox(0.025, door.glassTop - door.y1, 0.02, 0.006, frame, 0, (door.y1 + door.glassTop) / 2, dz(-0.1), d); // the sliding window's divider
      // The metal upright down the front of the window, raked like the screen's post: it holds the glass's front edge and goes with the door when
      // it opens. It lies just behind the screen's own post (its front half is inside it), so the two never share a face.
      post([0, door.y1, -0.03], [0, door.glassTop + 0.045, dz(screenZ(door.glassTop + 0.045)) - 0.03], 0.03, 0.035, paint, d);
      const glass = add(new THREE.ShapeGeometry(new THREE.Shape([
        new THREE.Vector2(dz(door.hinge + 0.02), door.y1 + 0.02), new THREE.Vector2(dz(door.rear + 0.02), door.y1 + 0.02),
        new THREE.Vector2(dz(door.rear + 0.02), door.glassTop), new THREE.Vector2(dz(screenZ(door.glassTop)), door.glassTop),
      ])).rotateY(-Math.PI / 2), MAT.glass, d);
      glass.position.x = 0;
      rbox(0.03, 0.045, 0.085, 0.01, MAT.black, s * 0.035, 1.08, dz(-0.3), d); // the push button handle
      rbox(0.02, 0.03, 0.05, 0.006, MAT.galv, s * 0.032, 1.16, dz(-0.31), d); // its lock
      root.add(d);
      post([s * door.x, SERIES_SCREEN.baseY, SERIES_SCREEN.baseZ], [s * door.x, SERIES_SCREEN.topY, SERIES_SCREEN_TOP_Z], 0.036, 0.05, frame, root); // the screen's raked side post, which the door's glass shuts against (thinner than the hinge pillar, so they share no face)
      for (const y of [0.76, 1.1]) rbox(0.03, 0.09, 0.05, 0.008, MAT.galv, s * (door.x + 0.03), y, door.hinge + 0.01, root); // the hinge plates, on the pillar
      // A mirror on an arm from the screen's side post, at the height of the door's top: a black head on a short stalk. A named group, so the
      // proportion check leaves it out (the makers' widths do) and it stays apart from the merge.
      const mirror = new THREE.Group();
      mirror.name = 'mirror';
      mirror.userData.keep = true;
      mirror.position.set(s * 0.84, 1.3, screenZ(1.3) + 0.02);
      tube([0, 0, 0], [s * 0.1, 0.02, -0.04], 0.009, MAT.black, mirror, 6);
      tube([s * 0.1, 0.02, -0.04], [s * 0.16, 0.1, -0.06], 0.007, MAT.black, mirror, 6);
      rbox(0.13, 0.18, 0.025, 0.01, MAT.black, s * 0.18, 0.15, -0.08, mirror); // the head faces back
      root.add(mirror);
      // The body at each side: the hinge pillar the door's front edge meets, the B pillar behind it, the quarter below the quarter window, the
      // sill closing the gap to the chassis, the rear upright and the rails above and below the quarter glass.
      rbox(0.04, door.y1 - door.y0, 0.1, 0.01, paint, s * door.x, (door.y0 + door.y1) / 2, door.hinge + 0.06, root); // the hinge pillar between the door and the wing
      const top = SERIES_CAB.top;
      const qz = SERIES_CAB.quarterRear;
      rbox(0.04, top - 0.04 - door.y0, 0.05, 0.01, paint, s * door.x, (top - 0.04 + door.y0) / 2, door.rear - 0.025, root); // the B pillar, up to the rail
      rbox(0.04, door.y1 - door.y0, door.rear - 0.05 - qz, 0.01, paint, s * door.x, (door.y0 + door.y1) / 2, (door.rear - 0.05 + qz) / 2, root); // the quarter, from the B pillar to the rear post
      rbox(0.04, top - 0.04 - door.y1, 0.04, 0.01, paint, s * door.x, (top - 0.04 + door.y1) / 2, qz + 0.02, root); // the rear post, above it
      rbox(0.04, 0.04, door.rear - 0.05 - qz + 0.04, 0.008, paint, s * door.x, top - 0.02, (door.rear - 0.05 + qz) / 2 + 0.0, root); // the top rail
      rbox(0.03, 0.03, door.rear - 0.05 - qz, 0.008, frame, s * (door.x + 0.002), door.y1 + 0.02, (door.rear - 0.05 + qz) / 2, root); // the capping carried on
      const quarter = add(new THREE.PlaneGeometry(door.rear - 0.05 - qz + 0.04, top - 0.04 - door.y1), MAT.glass, root); // the quarter glass
      quarter.rotation.y = Math.PI / 2;
      quarter.position.set(s * door.x, (top - 0.04 + door.y1) / 2, (door.rear - 0.05 + qz) / 2 + 0.01); // (it runs 2 cm into the pillar each end, so no slot shows)
      rbox(0.05, 0.09, 1.2, 0.01, MAT.chassis, s * (door.x - 0.012), 0.58, 0.0, root); // the sill (its outer face inside the door's, not on it) under the door, closing the gap to the chassis
    }
    // The cab's rear panel in pieces round a real opening with the glass set in the middle of it: glass laid on a whole panel's face fights
    // it for the same depth and flickers.
    const rz = SERIES_CAB.rear;
    const lowTop = tub.floor + 0.46; // the lower panel's top edge
    const upBottom = SERIES_CAB.top - 0.08; // the bar over the window's bottom edge
    const wh = upBottom - lowTop; // the window's height: the glass fills the opening from the lower panel to the bar over it
    const wy = (lowTop + upBottom) / 2;
    rbox(1.66, 0.46, 0.04, 0.01, paint, 0, tub.floor + 0.23, rz, root, 'cabBack'); // below the window, down into the tub
    rbox(1.66, 0.08, 0.04, 0.01, paint, 0, SERIES_CAB.top - 0.04, rz, root); // above it
    for (const s of [-1, 1]) rbox(0.36, wh, 0.04, 0.01, paint, s * 0.65, wy, rz, root); // either side
    const rear = add(new THREE.PlaneGeometry(0.94, wh), MAT.glass, root);
    rear.position.set(0, wy, rz);
    // The roof: Limestone, a gentle rise to its middle and a lip all round, with the rain gutters along its edges.
    const rl = SERIES_ROOF.z0 - SERIES_ROOF.z1;
    const rm = (SERIES_ROOF.z0 + SERIES_ROOF.z1) / 2;
    rbox(SERIES_ROOF.w, 0.06, rl, 0.03, MAT.roof, 0, SERIES_ROOF.y, rm, root, 'roof');
    rbox(SERIES_ROOF.w - 0.1, 0.03, rl - 0.1, 0.015, MAT.roof, 0, SERIES_ROOF.y + 0.04, rm, root);
    for (const s of [-1, 1]) rbox(0.03, 0.03, rl, 0.008, MAT.galv, s * (SERIES_ROOF.w / 2 + 0.005), SERIES_ROOF.y - 0.03, rm, root);
  }

  // The tub: a floor over the wheels with a hump on each side of it, the sides with the arches cut in them, the drop tailgate hinged on its
  // rear edge with its two chains, the body panel under it with the lamps and the plate, and the spots things stand on.
  function addTub() {
    const tl = tub.front - SERIES_END; // the tub's length
    const tm = (tub.front + SERIES_END) / 2;
    rbox(1.62, 0.04, tl, 0.01, paint, 0, tub.floor, tm, root);
    rbox(1.4, 0.008, tl - 0.04, 0.003, MAT.black, 0, tub.floor + 0.024, tm, root); // the rubber mat on it
    for (const s of [-1, 1]) {
      archPanel(s * tub.side, 0.04, 0.64, tub.top, SERIES_END, tub.front + 0.02, zR, paint, root); // the side, with the wheel arch cut in it
      archFlare(s * (tub.side + 0.025), zR, paint, root);
      rbox(0.2, 0.26, 0.02, 0.005, MAT.black, s * 0.7, 0.5, zR - 0.52, root); // the mudflap behind the wheel
      rbox(0.08, 0.03, tl, 0.01, MAT.galv, s * tub.side, tub.top + 0.01, tm, root); // its capping
      rbox(0.34, 0.1, 0.84, 0.04, paint, s * 0.62, tub.floor + 0.06, zR, root); // the hump over the arch, clear of the tyre
      for (const z of [-0.95, -1.6]) add(new THREE.TorusGeometry(0.02, 0.005, 6, 10), MAT.galv, root).position.set(s * (tub.side - 0.025), tub.top - 0.06, z); // rope hooks
      // The rear lamps, round as on a Series III: an indicator over a tail lamp, a red reflector under them, and the nearside's reverse lamp.
      const round = (r, mat, y, depth = 0.03) => add(new THREE.CylinderGeometry(r, r, depth, 16).rotateX(Math.PI / 2), mat, root).position.set(s * 0.74, y, SERIES_END - 0.02);
      round(0.04, amber, 0.86);
      round(0.04, tailMat, 0.77);
      rbox(0.07, 0.04, 0.02, 0.006, reflector, s * 0.74, 0.69, SERIES_END - 0.015, root);
      if (s > 0) round(0.04, smoke, 0.61, 0.03); // a single round reverse lamp, on the nearside
      // The tailgate's chain: from a pin on the tub's side to the gate's corner, aimed and stretched by poseSeriesTailgate as the gate swings.
      const chain = new THREE.Group();
      chain.name = s > 0 ? 'gateChainLeft' : 'gateChainRight';
      chain.userData.keep = true;
      chain.position.set(s * 0.775, SERIES_GATE.pinY, SERIES_END + 0.03);
      add(new THREE.CylinderGeometry(0.0045, 0.0045, 1, 4).rotateX(Math.PI / 2).translate(0, 0, 0.5), MAT.galv, chain);
      root.add(chain);
      rbox(0.05, 0.06, 0.05, 0.008, MAT.galv, s * 0.7, tub.floor - 0.02, SERIES_END - 0.01, root); // the tailgate's hinges
    }
    // The tailgate: a group hinged along the tub floor's rear edge, so it drops flat behind (T), held by its chains. Its own coordinates run
    // up from the hinge; `mudRest` keeps the dirt on it as it swings.
    const gate = new THREE.Group();
    gate.name = 'tailgate';
    gate.userData.keep = true;
    gate.position.set(0, SERIES_GATE.hingeY, SERIES_END);
    gate.userData.mudRest = [0, SERIES_GATE.hingeY, SERIES_END];
    rbox(1.62, SERIES_GATE.height, 0.04, 0.01, paint, 0, SERIES_GATE.height / 2, 0, gate);
    for (const y of [0.1, 0.25]) rbox(1.5, 0.02, 0.01, 0.004, paint, 0, y, -0.025, gate); // its pressings
    rbox(0.1, 0.04, 0.02, 0.006, MAT.galv, 0, SERIES_GATE.height - 0.05, -0.025, gate); // its catch
    root.add(gate);
    rbox(1.64, 0.3, 0.04, 0.01, paint, 0, 0.78, SERIES_END, root); // the rear body panel under it
    plate(regText, PLATE_BG, root, { x: 0, y: 0.78, z: SERIES_END - 0.0205, facing: -1 }); // the rear number plate
    badge(gate, { x: 0, y: 0.17, z: -0.0205, facing: -1, w: 0.2, h: 0.14, twoLines: true }); // the maker's badge on the tailgate
    SERIES_TUB_SPOTS.forEach((c, i) => {
      const a = new THREE.Object3D();
      a.name = `bedCargo${i}`;
      a.position.set(c.x, tub.floor + 0.02, c.z);
      root.add(a);
    });
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(SERIES_TUB_PROXY.w, SERIES_TUB_PROXY.h, SERIES_TUB_PROXY.d), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.name = 'bedProxy';
    proxy.position.set(0, SERIES_TUB_PROXY.y, SERIES_TUB_PROXY.z);
    root.add(proxy);
  }

  // Inside: the floor, the seat box with the bench on it (three in a row, black vinyl), the gearbox tunnel, the belts.
  function addInterior() {
    const fz = SERIES_SCUTTLE.from + 0.02;
    rbox(1.56, 0.03, fz - -0.55, 0.01, trim.floor, 0, 0.62, (fz - 0.55) / 2, root); // the floor, from the bulkhead back to the seat box
    rbox(1.56, 0.26, 0.5, 0.02, paint, 0, 0.76, -0.3, root, 'seatBox');
    rbox(1.56, 0.04, -0.55 - (SERIES_CAB.rear + 0.02), 0.01, trim.floor, 0, 0.91, (SERIES_CAB.rear + 0.02 - 0.55) / 2, root); // the shelf behind the seats
    rbox(0.36, 0.22, 0.48, 0.04, MAT.black, 0, 0.73, 0.19, root); // the gearbox tunnel
    for (const seat of Object.values(LANDY_SEATS)) {
      rbox(0.42, 0.1, 0.46, 0.04, trim.seat, seat.x, 0.9, seat.z - SEAT_BACK, root); // the cushion runs forward from the backrest
      rbox(0.42, 0.48, 0.08, 0.04, trim.seat, seat.x, 1.18, -0.5, root).rotation.x = -0.08; // clear of the cab's rear panel, even leant back
    }
    // The driver's cushion is split: the foam showing, with a strip of tape over one end.
    const rip = seatRip(root);
    rip.position.set(LANDY_SEATS.driver.x - 0.03, 0.9505, LANDY_SEATS.driver.z - SEAT_BACK + 0.06);
    rip.rotation.x = -Math.PI / 2;
    rip.rotation.z = 0.25;
    // The seat belts (detail/belts.js buildSeatBelt, the kit's old Land Rover pattern): a diagonal and lap belt for the driver's and the left
    // seat, hanging on the B pillar's quarter panel from the loop at the top to the reel at the bottom, and a lap belt for the middle. Stowed
    // they hang there; worn they run across whoever sits (poseUtvBelts poses the same names).
    for (const [seat, belt] of Object.entries({ driver: { anchor: -0.785, buckle: -0.23 }, mid: { anchor: -0.19, buckle: 0.19 }, left: { anchor: 0.785, buckle: 0.23 } })) {
      const s = LANDY_SEATS[seat];
      const lapOnly = seat === 'mid';
      const hip = [s.x, s.y - 0.05, s.z + SEAT_BACK];
      const top = lapOnly ? [belt.anchor, 0.98, -0.44] : [belt.anchor, 1.5, door.rear - 0.04];
      const low = lapOnly ? [belt.anchor, 0.98, -0.44] : [belt.anchor, 0.9, door.rear - 0.12];
      root.add(buildSeatBelt(seat, { top, low, buckle: [belt.buckle, 0.99, -0.42], hip, lapOnly, mats: { webbing } }));
    }
  }

  // The steering wheel, dash and the controls: the wheel and its raked column where they were (the wheel is about 0.45 m ahead of the
  // hips), the dash pad and binnacle against the bulkhead.
  function addControls() {
    const column = new THREE.Group();
    column.name = 'steeringColumn';
    column.userData.keep = true;
    column.position.set(-0.42, 0.9, 0.5);
    column.rotation.x = -1.05;
    tube([0, 0, 0], [0, 0.42, 0], 0.024, MAT.black, column);
    root.add(column);
    addSignalStalk(column, 0.34, MAT.black, { modern: false });
    // The hazard button: just the red switch, on top of the column in front of the wheel, tipped up to face the driver.
    const top = new THREE.Vector3(0, 0.27, 0.03).applyEuler(column.rotation).add(column.position);
    top.y += 0.02;
    const hazard = addHazardSwitch(root, top.x, top.y, top.z, { plate: false });
    faceAlong(hazard, new THREE.Vector3(0, 0.75, -0.66), new THREE.Vector3(0, 0.66, 0.75));
    const wheel = new THREE.Group();
    wheel.name = 'handlebars';
    wheel.userData.keep = true;
    wheel.position.set(0, 0.42, 0);
    column.add(wheel);
    add(new THREE.TorusGeometry(0.21, 0.012, 8, 36).rotateX(Math.PI / 2), MAT.black, wheel);
    // The hub is a deep round cup, as on the real wheel (dished towards you, a dark recess with the badge in it) on three flat metal spokes.
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x7d8083, roughness: 0.45, metalness: 0.5, side: THREE.DoubleSide });
    add(new THREE.LatheGeometry([[0.0, -0.022], [0.06, -0.022], [0.058, 0.022], [0.05, 0.022], [0.048, 0.006], [0.0, 0.006]].map(([r, y]) => new THREE.Vector2(r, y)), 22), hubMat, wheel); // the cup, open towards you
    badge(wheel, { x: 0, y: 0.0075, z: 0, facing: 1, w: 0.07, h: 0.035, px: 1200 }).rotation.set(-Math.PI / 2, 0, Math.PI); // the badge in its floor
    for (const a of [Math.PI / 2 + 0.2, -Math.PI / 2 - 0.2, Math.PI]) {
      const spoke = add(new THREE.BoxGeometry(0.15, 0.007, 0.024), hubMat, wheel); // left, right and down, the top open so you see the dials
      spoke.position.set(Math.sin(a) * 0.13, -0.004, Math.cos(a) * 0.13);
      spoke.rotation.y = a - Math.PI / 2;
    }
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

    // The dash, after the photos: a straight olive shelf the width of the cab with a lip under its front edge, the instrument panel (the pod
    // set into it) under the shelf in front of you, and a big open gap under the rest, down to the bulkhead. The radio's housing hangs under the
    // shelf with a felt tray below it. The choke comes out of the bulkhead at your end and the hand throttle at the tray's.
    const D = SERIES_DASH;
    const dk = D.deck;
    const dl = dk.z1 - dk.z0;
    rbox(dk.half * 2, dk.t, dl, 0.008, dashMetal, 0, dk.y, (dk.z0 + dk.z1) / 2, root); // the shelf
    rbox(dk.half * 2 - D.lip.x0 - dk.half, D.lip.h, 0.02, 0.006, dashMetal2, (dk.half + D.lip.x0) / 2, dk.y - dk.t / 2 - D.lip.h / 2 + 0.005, dk.z0, root); // the lip under its edge, standing 1 cm proud of the shelf's front so they share no face, from the panel to the passenger's end
    const fascia = new THREE.Group();
    fascia.position.set(0, D.y, D.z);
    fascia.rotation.x = D.tilt;
    root.add(fascia);
    const P = D.panel;
    rbox(P.x1 - P.x0, P.y1 - P.y0, 0.03, 0.008, dashMetal, (P.x0 + P.x1) / 2, (P.y0 + P.y1) / 2, 0.015, fascia); // the instrument panel
    // The switch panel at the door end, as in the photo: a black plate with two chrome toggles over two small lamps and a push button, a toggle
    // and the lights' pull knob under them. They face you (the fascia's face is its +z side, so each is turned half round).
    rbox(0.15, 0.22, 0.004, 0.002, MAT.black, -0.665, 0.125, -0.002, fascia);
    const fit = (g, x, y) => {
      g.position.set(x, y, -0.004);
      g.rotation.y = Math.PI;
      fascia.add(g);
    };
    fit(buildToggle({ on: true }), -0.7, 0.2);
    fit(buildToggle({ on: false }), -0.63, 0.2);
    fit(buildLampLens({ r: 0.006, colour: 'Red' }), -0.7, 0.15);
    fit(buildLampLens({ r: 0.006, colour: 'Amber' }), -0.665, 0.15);
    fit(buildLampLens({ r: 0.011, colour: 'Clear' }), -0.63, 0.11); // the push button
    fit(buildToggle({ on: false }), -0.7, 0.07);
    const lightsKnob = buildPullKnob({ out: 0 }); // the lights' pull knob: out one notch for the lights, two for main beam (the dash's update moves it)
    fit(lightsKnob, -0.63, 0.04);
    const dash = buildDash(dashStyle);
    dash.group.position.set(-0.42, 0.12, -0.02);
    dash.group.scale.setScalar(1.5); // the binnacle's about 0.3 m wide, as on a Series III
    dash.group.userData.keep = true;
    fascia.add(dash.group);
    const pull = lightsKnob.getObjectByName('pullKnob');
    let radioUnit = null; // (made below)
    const podUpdate = dash.update;
    dash.update = (st) => {
      podUpdate(st);
      radioUnit?.userData.setPower(!!st.radioOn && !!st.ignition); // its display is lit while the radio is on, with the key
      const want = st.lightLamps?.main ? 0.024 : st.lightLamps?.lights ? 0.012 : 0;
      pull.position.z += (want - pull.position.z) * 0.4;
    };
    quad.userData.dash = dash;
    quad.userData.metalBody = true; // painted steel (or aluminium) panels, not plastic: they chip and rust rather than fade (effects/wearLayer.js)
    quad.userData.podMount = null;
    // The radio: a housing the same olive hung under the shelf's lip and standing proud of it, with a head unit set in its face (display, buttons, a big knob).
    const R_ = D.radio;
    const radio = new THREE.Group();
    radio.position.set(R_.x, R_.y, R_.z0);
    root.add(radio);
    rbox(R_.w + 0.04, R_.h + 0.03, R_.z1 - R_.z0, 0.01, dashMetal2, 0, 0, (R_.z1 - R_.z0) / 2, radio);
    radioUnit = buildRadio('dab', { w: R_.w, h: R_.h * 0.7 }); // the shared head unit (detail/radios.js), the same as the 200TDi's
    radioUnit.position.set(0, 0, -0.0005);
    radioUnit.rotation.y = Math.PI; // facing you
    radio.add(radioUnit);
    quad.userData.liveMaterials.push(radioUnit.userData.faceMaterial); // the display lights with the radio, so the mud coat leaves its material alone
    const T = D.tray; // the felt-lined tray under the radio, open to the front, with a lip
    rbox(T.x1 - T.x0, 0.012, T.z1 - T.z0, 0.004, felt, (T.x0 + T.x1) / 2, T.y, (T.z0 + T.z1) / 2, root);
    rbox(T.x1 - T.x0, 0.06, 0.012, 0.004, felt, (T.x0 + T.x1) / 2, T.y + 0.03, T.z0 + 0.006, root);
    rbox(0.012, 0.06, T.z1 - T.z0, 0.004, felt, T.x1 - 0.006, T.y + 0.03, (T.z0 + T.z1) / 2, root);
    // Knobs, each pulled out towards you on a shaft that runs back into the bulkhead, so it stays joined to it however far it is out (the pose
    // moves the group by up to KNOB_TRAVEL).
    for (const [name, x, mat] of [['chokeKnob', D.knobX[0], MAT.red], ['handThrottleKnob', D.knobX[1], MAT.galv]]) {
      const knob = new THREE.Group();
      knob.name = name;
      knob.userData.keep = true;
      knob.position.set(x, D.knobY, D.knobZ);
      tube([0, 0, 0.25], [0, 0, -0.05], 0.005, MAT.galv, knob, 6);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.028, 12).rotateX(Math.PI / 2), mat, knob).position.set(0, 0, -0.059);
      root.add(knob);
    }
    // The levers on the tunnel: the gear lever, the transfer lever with its yellow knob (4WD, pushed down) and a red knob for the diff lock.
    const lever = (name, x, mat, len, r) => {
      const g = new THREE.Group();
      g.name = name;
      g.userData.keep = true;
      g.position.set(x, 0.84, 0.12);
      tube([0, 0, 0], [0, len, 0], 0.008, MAT.galv, g, 5);
      add(new THREE.SphereGeometry(r, 12, 10), mat, g).position.set(0, len, 0);
      root.add(g);
    };
    add(new THREE.CylinderGeometry(0.045, 0.06, 0.03, 16), MAT.black, root).position.set(-0.1, 0.835, 0.12); // the gear lever's rubber gaiter
    add(new THREE.TorusGeometry(0.06, 0.006, 6, 18).rotateX(Math.PI / 2), MAT.galv, root).position.set(-0.1, 0.825, 0.12); // and its ring
    rbox(0.16, 0.006, 0.07, 0.002, MAT.black, 0.08, 0.842, 0.12, root); // the plate the transfer and diff levers come through
    lever('gearLever', -0.1, MAT.knob, 0.3, 0.026);
    lever('transferKnob', 0.04, MAT.yellow, 0.2, 0.018);
    lever('diffLockKnob', 0.12, MAT.red, 0.14, 0.016);
    addPedals(root, { pivot: [0.98, 0.43], foot: [0.66, 0.32] }); // the pedals (clutch, brake, accelerator), on arms from under the dash; your feet work them (poseLandyControls)
    // The handbrake: a ratchet lever on the right of the tunnel, by the driver's left knee. Down and forward when off; pulled up and back when on.
    const hb = new THREE.Group();
    hb.name = 'parkBrakeLever';
    hb.userData.keep = true;
    hb.position.set(-0.2, 0.8, -0.05);
    tube([0, 0, 0], [0, 0.2, 0], 0.01, MAT.galv, hb, 6);
    add(new THREE.CylinderGeometry(0.019, 0.022, 0.1, 10), MAT.knob, hb).position.set(0, 0.24, 0);
    rbox(0.014, 0.014, 0.02, 0.004, MAT.red, 0, 0.295, 0, hb); // the release button
    hb.rotation.x = HANDBRAKE_OFF;
    root.add(hb);
    rbox(0.012, 0.1, 0.1, 0.004, MAT.steel, -0.2, 0.84, -0.07, root); // the ratchet quadrant it moves against
    // Quad poses these two on a quad; the Land Rover's choke is the dash knob and it has no fuel tap.
    for (const name of ['fuelTap', 'chokeLever']) {
      const g = new THREE.Group();
      g.name = name;
      g.userData.keep = true;
      g.visible = false;
      root.add(g);
    }
  }

  // The rear crossmember with the towing jaw (a pin through a jaw, where the trailer's ring goes), the exhaust, and the anchors people hang from.
  function addTail() {
    rbox(1.0, 0.12, 0.1, 0.01, MAT.chassis, 0, 0.56, SERIES_END + 0.07, root);
    rbox(0.08, 0.08, 0.1, 0.01, MAT.steel, SERIES_HITCH.x, SERIES_HITCH.y, SERIES_HITCH.z + 0.02, root);
    tube([SERIES_HITCH.x, SERIES_HITCH.y + 0.06, SERIES_HITCH.z - 0.01], [SERIES_HITCH.x, SERIES_HITCH.y - 0.06, SERIES_HITCH.z - 0.01], 0.01, MAT.galv, root, 6);
    for (const [name, at] of [['towHitch', SERIES_HITCH], ['crankHole', CRANK_HOLE]]) {
      const o = new THREE.Object3D();
      o.name = name;
      o.position.set(at.x, at.y, at.z);
      root.add(o);
    }
    // The exhaust: a silencer under the right side, inboard of the rail, and a tailpipe running well inside the rear wheel to come out under the back.
    const tail = SERIES_END - 0.04;
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 14).rotateX(Math.PI / 2), MAT.rust, root).position.set(-0.34, 0.38, -0.6);
    tube([-0.34, 0.38, -0.9], [-0.36, 0.34, tail], 0.022, MAT.rust, root, 6);
    const tip = new THREE.Object3D();
    tip.name = 'exhaustTip';
    tip.position.set(-0.36, 0.34, tail);
    root.add(tip);
    // The seats' anchors: hips on the cushions. The driver's is yours; the other two are where the girls sit.
    for (const [name, seat] of [['riderAnchor', LANDY_SEATS.driver], ['seatMid', LANDY_SEATS.mid], ['seatLeft', LANDY_SEATS.left]]) {
      const a = new THREE.Object3D();
      a.name = name;
      a.position.set(seat.x, seat.y, seat.z);
      root.add(a);
    }
    const cameraAnchor = new THREE.Object3D();
    cameraAnchor.name = 'cameraAnchor';
    cameraAnchor.position.set(LANDY_SEATS.driver.x, LANDY_SEATS.driver.y + 0.69, LANDY_SEATS.driver.z + 0.02);
    root.add(cameraAnchor);
    // Where your eyes are riding in the middle or the left of the bench.
    for (const [name, seat] of [['cameraMid', LANDY_SEATS.mid], ['cameraLeft', LANDY_SEATS.left]]) {
      const a = new THREE.Object3D();
      a.name = name;
      a.position.set(seat.x, seat.y + 0.69, seat.z + 0.02);
      root.add(a);
    }
  }

  for (const w of LANDY_LAYOUT.wheels) {
    const wheelModel = buildWheel(w, MAT.rim);
    wheelModel.name = w.name;
    quad.add(wheelModel);
  }
  addHeadlightBeams(quad);
  addSignalLamps(quad, amber, smoke);
  quad.userData.sideMaterial = sideMat; // lit with the headlights
  // Its own tail lamp material, which setTaillights lights (no halos).
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

/** Swings the Series' doors, each side on its own: `open` is { left, right }, each 0 (shut) to 1 (swung out on its front edge). */
export function poseSeriesDoors(model, open) {
  const left = part(model, 'doorLeft');
  const right = part(model, 'doorRight');
  if (!left || !right || !left.userData.keep) return; // the 200TDi's doors are still fixed panels
  left.rotation.y = -SERIES_DOOR.open * open.left; // the free edge at the back swings out to the side
  right.rotation.y = SERIES_DOOR.open * open.right;
}

/** Drops the Series' tailgate, 0 (shut) to 1 (lying flat behind, level with the floor), and stretches its chains between the tub and its corners. */
export function poseSeriesTailgate(model, open) {
  const gate = part(model, 'tailgate');
  if (!gate || !gate.userData.keep) return;
  const angle = -open * Math.PI / 2;
  gate.rotation.x = angle;
  const reach = SERIES_GATE.height - 0.03; // the gate's top corner, in the body's frame, turning about its hinge
  for (const name of ['gateChainLeft', 'gateChainRight']) {
    const chain = part(model, name);
    const corner = new THREE.Vector3(chain.position.x, gate.position.y + reach * Math.cos(angle), gate.position.z + reach * Math.sin(angle));
    const way = corner.sub(chain.position);
    chain.scale.z = Math.max(0.001, way.length());
    chain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), way.normalize());
  }
}
