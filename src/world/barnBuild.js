import * as THREE from 'three';
import { barnShape, barnFrame } from './barn.js';
import { buildJack, buildAxleStand } from '../workshop/jackModel.js';
import { buildDesk, DESK } from '../workshop/deskModel.js';
import { buildBayKit } from './bayKit.js';
import { buildWideShell } from './barnWide.js';
import { boardTexture, concreteTexture } from './barnTextures.js';

// Draws the barn (the shape and numbers are in barn.js): the one building's walls, roof and doors (barnWide.js), a concrete floor with the
// inspection pit cut through it, the workbench, the bays, the desk and the bulbs. All procedural, so there are no model files for it.

/**
 * Builds the barn and its colliders. Returns { group, light, bulb, lights, bulbs, floorY, pitPlug } (each light is a bulb's glow, dimmed to nothing by day).
 *
 * It is all drawn in the barn's own frame (the one it has at yaw 0 about its anchor: `layout.barnLocal` has its things there), inside a group that
 * stands at the anchor turned by the barn's yaw (#682), and the colliders are put through the same turn.
 */
export function buildBarnShed({ scene, layout: worldLayout, heights, fixedBox: fixedWorldBox, random }) {
  const layout = { ...worldLayout, ...worldLayout.barnLocal };
  const frame = barnFrame(worldLayout);
  const shape = barnShape(layout);
  const { outer, wallHeight } = shape;
  const floorY = heights.heightAt(shape.x, shape.z);
  const fixedBox = (x, y, z, hx, hy, hz, rotY = 0) => {
    const p = frame.toWorld(x, z);
    return fixedWorldBox(p.x, y, p.z, hx, hy, hz, rotY + frame.yaw);
  };
  const pivot = new THREE.Group(); // at the anchor, turned: what is inside is placed as it would be unturned
  pivot.name = 'barn';
  pivot.position.set(shape.x, 0, shape.z);
  pivot.rotation.y = frame.yaw;
  const group = new THREE.Group();
  group.position.set(-shape.x, 0, -shape.z);
  pivot.add(group);
  scene.add(pivot);

  const sizeX = outer.maxX - outer.minX;
  const sizeZ = outer.maxZ - outer.minZ;

  const boards = boardTexture(random, '#7d2a22');
  const white = new THREE.MeshStandardMaterial({ color: 0xe9e6dd, roughness: 0.8 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x55595c, roughness: 0.5, metalness: 0.7 });
  const add = (mesh, x, y, z, { cast = true, receive = true } = {}) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    group.add(mesh);
    return mesh;
  };
  const box = (sx, sy, sz, mat) => new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);

  // Floor: a slab just proud of the flattened ground.
  // The inspection pit's opening is cut through it (workshop/shedModels.js builds the trench below); `pitPlug` fills the hole while the pit isn't bought.
  const floorMat = new THREE.MeshStandardMaterial({ map: concreteTexture(random, [4 / sizeX, 4 / sizeZ]), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 });
  const slabMesh = (path) => {
    const geometry = new THREE.ExtrudeGeometry(path, { depth: 0.03, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2); // drawn in (x, -z), then laid down: the picture runs in metres, so the concrete is the same size on every piece
    const mesh = new THREE.Mesh(geometry, floorMat);
    mesh.position.y = floorY - 0.019;
    mesh.receiveShadow = true;
    return mesh;
  };
  const rectOn = (path, minX, maxX, minZ, maxZ) => {
    path.moveTo(minX, -minZ);
    path.lineTo(maxX, -minZ);
    path.lineTo(maxX, -maxZ);
    path.lineTo(minX, -maxZ);
    return path;
  };
  const slabShape = rectOn(new THREE.Shape(), shape.x - sizeX / 2 + 0.01, shape.x + sizeX / 2 - 0.01, shape.z - sizeZ / 2 + 0.01, shape.z + sizeZ / 2 - 0.01);
  const pit = layout.shed?.pit;
  let pitPlug = null;
  if (pit) {
    const [x0, x1, z0, z1] = [pit.x - pit.halfX, pit.x + pit.halfX, pit.z - pit.halfZ, pit.z + pit.halfZ];
    slabShape.holes.push(rectOn(new THREE.Path(), x0, x1, z0, z1));
    pitPlug = new THREE.Group(); // at the anchor, turned, like the barn, but outside its group, which is merged for drawing (farDetail.js): shown and hidden on its own
    pitPlug.position.set(shape.x, 0, shape.z);
    pitPlug.rotation.y = frame.yaw;
    const inner = new THREE.Group();
    inner.position.set(-shape.x, 0, -shape.z);
    inner.add(slabMesh(rectOn(new THREE.Shape(), x0, x1, z0, z1)));
    pitPlug.add(inner);
    scene.add(pitPlug);
  }
  group.add(slabMesh(slabShape));

  // The barn's walls, roof and doors (barnWide.js).
  buildWideShell({ shape, layout, floorY, random, group, add, box, fixedBox, boards, white, timber, steel });

  // The workbench along the north wall: a thick top, four legs and a shelf, with a vice at one end.
  const b = layout.bench;
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.85 });
  const benchTop = floorY + b.height;
  // The top is separate planks with a hairline between them, on a frame of rails; legs have a cross brace and the shelf is slatted.
  const plankMats = [0x7a5a3a, 0x72532f, 0x82623f].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  const planks = 5;
  const plankD = b.depth / planks;
  for (let i = 0; i < planks; i++) {
    add(box(b.length + 0.06, 0.055, plankD - 0.006, plankMats[i % 3]), b.x, benchTop - 0.0275, b.z - b.depth / 2 + plankD * (i + 0.5));
  }
  const legX = b.length / 2 - 0.08;
  const legZ = b.depth / 2 - 0.08;
  add(box(b.length - 0.1, 0.1, 0.04, timber), b.x, benchTop - 0.1, b.z + legZ); // front and back aprons
  add(box(b.length - 0.1, 0.1, 0.04, timber), b.x, benchTop - 0.1, b.z - legZ);
  for (const sx of [-1, 1]) {
    add(box(0.04, 0.1, b.depth - 0.12, timber), b.x + sx * legX, benchTop - 0.1, b.z); // end rails
    for (const sz of [-1, 1]) add(box(0.08, b.height - 0.06, 0.08, timber), b.x + sx * legX, floorY + (b.height - 0.06) / 2, b.z + sz * legZ);
    // Diagonal brace between the legs at each end.
    const brace = box(0.035, 0.6, 0.035, timber);
    brace.rotation.x = Math.atan2(b.depth - 0.2, 0.45);
    add(brace, b.x + sx * legX, floorY + 0.5, b.z);
  }
  for (let i = 0; i < 4; i++) add(box(b.length - 0.1, 0.03, (b.depth - 0.1) / 4 - 0.01, timber), b.x, floorY + 0.3, b.z - (b.depth - 0.1) / 2 + ((b.depth - 0.1) / 4) * (i + 0.5));
  // Vice at the right-hand end, bolted to the front edge: a cast iron body with a fixed jaw, a moving jaw on a slide bar, a screw
  // running out of the back and a T handle with ball ends, the jaws open a hand's width.
  const vx = b.x + b.length / 2 - 0.3;
  const vz = b.z + b.depth / 2 - 0.1;
  const vice = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x2f4a5c, roughness: 0.55, metalness: 0.55 });
  const jawFace = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.6, metalness: 0.8 });
  const part = (geo, mat, x, y, z, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(...rot);
    m.castShadow = m.receiveShadow = true;
    vice.add(m);
    return m;
  };
  part(new THREE.BoxGeometry(0.16, 0.025, 0.2), iron, 0, 0.0125, 0); // base plate with four bolt heads
  for (const [bx, bz] of [[-0.06, -0.08], [0.06, -0.08], [-0.06, 0.08], [0.06, 0.08]]) part(new THREE.CylinderGeometry(0.01, 0.01, 0.008, 6), steel, bx, 0.029, bz);
  part(new THREE.BoxGeometry(0.12, 0.09, 0.16), iron, -0.02, 0.07, 0); // the body and fixed jaw
  part(new THREE.BoxGeometry(0.03, 0.05, 0.14), iron, -0.095, 0.115, 0); // fixed jaw standing proud of the body
  part(new THREE.BoxGeometry(0.006, 0.04, 0.12), jawFace, -0.078, 0.115, 0);
  part(new THREE.BoxGeometry(0.03, 0.05, 0.14), iron, -0.02 + 0.2 * 0.5 - 0.02, 0.115, 0); // moving jaw, a hand's width off the fixed one
  part(new THREE.BoxGeometry(0.006, 0.04, 0.12), jawFace, -0.02 + 0.2 * 0.5 - 0.037, 0.115, 0);
  part(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), steel, 0.03, 0.095, 0, [0, 0, Math.PI / 2]); // slide bar
  part(new THREE.CylinderGeometry(0.009, 0.009, 0.12, 8), steel, 0.15, 0.115, 0, [0, 0, Math.PI / 2]); // the screw, out the back
  part(new THREE.CylinderGeometry(0.006, 0.006, 0.26, 6), steel, 0.2, 0.115, 0, [Math.PI / 2, 0, 0]); // T handle across it
  for (const sz of [-1, 1]) part(new THREE.SphereGeometry(0.014, 8, 6), steel, 0.2, 0.115, sz * 0.13);
  vice.position.set(vx, benchTop, vz);
  group.add(vice);
  // Things on the top: an oil can, two jars of screws and a dark rag.
  const redPaint = new THREE.MeshStandardMaterial({ color: 0xb3201a, roughness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfd6d0, roughness: 0.15, transparent: true, opacity: 0.55 });
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 12), redPaint);
  add(can, b.x - b.length / 2 + 0.35, benchTop + 0.07, b.z - 0.1);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 0.09, 6), steel);
  spout.rotation.z = -0.9;
  add(spout, b.x - b.length / 2 + 0.4, benchTop + 0.18, b.z - 0.1, { cast: false });
  for (let i = 0; i < 2; i++) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.11, 12), glass), b.x + i * 0.16, benchTop + 0.055, b.z - 0.2, { cast: false });
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.015, 12), steel), b.x + i * 0.16, benchTop + 0.118, b.z - 0.2, { cast: false });
  }
  const rag = box(0.22, 0.015, 0.16, new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 1 }));
  rag.rotation.y = 0.4;
  add(rag, b.x + b.length / 2 - 1.1, benchTop + 0.008, b.z + 0.05, { cast: false });
  // (No pegboard over it until there are real tools to hang on one, #517.)
  fixedBox(b.x, floorY + b.height / 2, b.z, b.length / 2, b.height / 2, b.depth / 2);
  // The bays for working on a quad: a wheel stop, corner kerbs, an oil stain and a drip tray each, with no paint on the floor (bayKit.js, #404).
  group.add(buildBayKit({ bays: [layout.bay, layout.bay2].filter(Boolean), floorY, random }));
  if (layout.desk) {
    // The farm desk and its stool, against the back wall by the boards (the new barn's).
    const desk = buildDesk(random);
    desk.position.set(layout.desk.x, floorY, layout.desk.z);
    desk.rotation.y = layout.desk.yaw;
    group.add(desk);
    fixedBox(layout.desk.x, floorY + DESK.height / 2, layout.desk.z, DESK.depth / 2, DESK.height / 2, DESK.length / 2);
  }
  if (layout.bay2) {
    // A trolley jack and a pair of axle stands wait beside the big bay.
    const jack = buildJack();
    jack.position.set(layout.jack.x, floorY, layout.jack.z);
    jack.rotation.y = layout.jack.yaw;
    group.add(jack);
    for (const st of layout.axleStands) {
      const stand = buildAxleStand();
      stand.position.set(st.x, floorY, st.z);
      stand.rotation.y = st.yaw;
      group.add(stand);
    }
  }

  // Bare bulbs on flexes, which come on in the gloom: six hung from the purlins in two rows either side of the doors' line, sharing three lights
  // (the shaders count every light in the scene) at the same total level as the barn's first two bulbs.
  const bulbAt = [-9, 0, 9].flatMap((z) => [-3.2, 3.2].map((x) => ({ x: shape.x + x, y: floorY + wallHeight + 0.3 - Math.abs(x) * 0.05, z: shape.z + z })));
  const bulbs = bulbAt.map((p) => {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c9 }));
    add(bulb, p.x, p.y, p.z, { cast: false, receive: false });
    const flex = 1.8; // from the purlins, 1.8 m up
    add(box(0.015, flex, 0.015, steel), p.x, p.y + flex / 2 + 0.05, p.z, { cast: false, receive: false });
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.05, 0.1, 10, 1, true), steel), p.x, p.y + 0.12, p.z, { cast: false, receive: false }); // a shade over it
    return bulb;
  });
  const lights = [-9, 0, 9].map((z) => ({ x: shape.x, y: bulbAt[0].y, z: shape.z + z })).map((p) => {
    const l = new THREE.PointLight(0xffe2b0, 0, 15, 1.6);
    l.position.set(p.x, p.y - 0.15, p.z);
    group.add(l);
    return l;
  });

  return { group: pivot, light: lights[0], bulb: bulbs[0], light2: lights[1] ?? null, bulb2: bulbs[1] ?? null, lights, bulbs, floorY, pitPlug };
}
