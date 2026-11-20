// The yard's lights at night (#817, #171): a floodlight on the barn's gable over the doors and another on a timber pole behind the fuel tanks, so the yard is not black
// at dusk but for the barn's bulb. Each is a black halogen floodlight (finned back, hood, glass front, a round sensor under it) with a hard cone of light on the yard,
// the glass lit when on. They run off the generator like the barn's bulb and come on after dark (`yardLightLevel`). The lights are made once, here, and only dimmed.

import * as THREE from 'three';
import { worldBox } from './outbuildingProps.js';
import { woodTexture } from './neighbourTextures.js';
import { bag, put, galvanisedTexture, concreteTexture, restingHeight } from './yardKit.js';
import { barnFrame, barnShape } from './barn.js';

export const FLOOD_CANDELA = 120; // candela of each floodlight at full, the cone's brightness on the yard
const POLE = { h: 6.2, r: 0.115, arm: 1.1 };
const TILT = 0.7; // radians a floodlight's face is tipped down

/** 0..1 how brightly the yard lights burn: off in daylight, up through dusk, and off when the generator is. */
export function yardLightLevel(darkness, powered) {
  if (!powered) return 0;
  const t = Math.max(0, Math.min(1, (darkness - 0.3) / 0.25));
  return t * t * (3 - 2 * t);
}

/** Where the pole stands: behind the two fuel tanks (the side their labels face away from), halfway between them along their length. */
export function poleSpot(layout) {
  const a = layout.fuelTank;
  const b = layout.dieselBowser;
  return { x: (a.x + b.x) / 2, z: Math.min(a.z, b.z) - 2.6 };
}

/** Where the gable's floodlight hangs, in the world: on the door gable, to the hay door's yard-left side, with the way it faces (a heading) and the ground it lights. */
export function gableSpot(layout, floorY) {
  const s = barnShape({ ...layout, ...layout.barnLocal });
  const f = barnFrame(layout);
  const p = f.toWorld(s.outer.maxX + 0.3, s.z + 2.1);
  return { x: p.x, y: floorY + s.wallHeight + 0.55, z: p.z, heading: f.headingToWorld(Math.PI / 2) };
}

/** A black halogen floodlight, built facing local +z with its mounting plate at the origin: bracket, finned housing, hood, glass, a PIR sensor under it. */
function floodlight(b, mats, lens) {
  const { black, grey } = mats;
  b.add(grey, put(worldBox(0.14, 0.2, 0.025, 1), 0, 0, 0.0125)); // the mounting plate, bolted to the wall or arm
  b.add(black, put(worldBox(0.05, 0.05, 0.22, 1), 0, 0.02, 0.13)); // the arm it hangs from
  const head = new THREE.Group();
  const h = bag();
  h.add(black, put(worldBox(0.34, 0.25, 0.12, 1), 0, 0, 0));
  for (let i = -3; i <= 3; i++) h.add(black, put(worldBox(0.012, 0.22, 0.05, 1), i * 0.045, 0, -0.085)); // the cooling fins on the back
  h.add(black, put(worldBox(0.38, 0.015, 0.1, 1), 0, 0.135, 0.07)); // the hood over the glass
  for (const s of [-1, 1]) h.add(black, put(worldBox(0.015, 0.25, 0.09, 1), s * 0.18, 0, 0.055)); // and its cheeks
  h.add(grey, put(worldBox(0.31, 0.015, 0.14, 1), 0, -0.1325, 0.0)); // a steel lip along the bottom edge
  for (const [x, y] of [[-0.15, 0.1], [0.15, 0.1], [-0.15, -0.1], [0.15, -0.1]]) h.add(grey, put(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 6), x, y, 0.062, 0, Math.PI / 2)); // screws
  const body = h.group();
  body.name = 'floodlightBody';
  head.add(body);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.2), lens);
  glass.name = 'lens';
  glass.position.set(0, 0, 0.0615);
  glass.userData.keepFar = true;
  head.add(glass);
  head.position.set(0, 0.02, 0.26);
  head.rotation.x = TILT; // tipped down: +z forward, rotating about x by +tilt turns the face towards -y
  const sensor = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mats.pir);
  sensor.rotation.x = Math.PI;
  sensor.position.set(0, -0.19, 0.28);
  return { head, sensor, plate: b };
}

/** One lamp: the floodlight group at (x, y, z) facing `heading`, its spot light (off) aimed at the ground `reach` metres out, and the lens. Returns { group, light, lens }. */
function lamp(mats, x, y, z, heading, ground, reach) {
  const group = new THREE.Group();
  group.name = 'floodlight';
  const plate = bag();
  const fl = floodlight(plate, mats, mats.lens);
  group.add(plate.group(), fl.head, fl.sensor);
  group.position.set(x, y, z);
  group.rotation.y = heading;
  const light = new THREE.SpotLight(0xfff0d0, 0, 34, 0.75, 0.55, 1.5);
  const out = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  light.position.set(x + out.x * 0.35, y - 0.05, z + out.z * 0.35);
  light.target.position.set(x + out.x * reach, ground, z + out.z * reach);
  return { group, light };
}

/**
 * The yard's two floodlights and the pole one hangs on. Returns the group (`userData.set(level)` sets both lights and the glass), or null on a farm without the yard.
 * The pole is timber, set in a concrete collar, with a steel arm and brace, a junction box and the cable's conduit running down it.
 */
export function buildYardLights({ scene, layout, heights, fixedBox, random }) {
  if (!layout.farmstead?.yard) return null;
  const ground = (x, z) => heights.heightAt(x, z);
  const mats = {
    black: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.5, metalness: 0.55 }),
    grey: new THREE.MeshStandardMaterial({ map: galvanisedTexture(random), roughness: 0.5, metalness: 0.5 }),
    pir: new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.35, transparent: true, opacity: 0.9 }),
    lens: new THREE.MeshStandardMaterial({ color: 0xcfd6d8, roughness: 0.08, metalness: 0.1, emissive: 0xfff0c8, emissiveIntensity: 0 }),
  };
  const group = new THREE.Group();
  group.name = 'yardLights';
  const lamps = [];

  // On the barn's door gable.
  const gable = gableSpot(layout, ground(layout.barn.x, layout.barn.z));
  const onGable = lamp(mats, gable.x, gable.y, gable.z, gable.heading, ground(gable.x, gable.z), 9);
  group.add(onGable.group);
  lamps.push(onGable);

  // On the pole behind the tanks, its head out on an arm over the yard (south, the way the tanks' labels face).
  const pole = poleSpot(layout);
  const y0 = restingHeight(ground, pole.x, pole.z, 0.3, 0.3);
  const timber = new THREE.MeshStandardMaterial({ map: woodTexture(random, [66, 52, 38]), roughness: 0.95 }); // creosoted
  const concrete = new THREE.MeshStandardMaterial({ map: concreteTexture(random), roughness: 0.95 });
  const b = bag();
  b.add(timber, put(new THREE.CylinderGeometry(POLE.r * 0.85, POLE.r, POLE.h, 10), pole.x, y0 + POLE.h / 2 - 0.4, pole.z));
  b.add(timber, put(new THREE.CylinderGeometry(POLE.r * 0.7, POLE.r * 0.85, 0.05, 10), pole.x, y0 + POLE.h - 0.4, pole.z)); // the cut top, bevelled
  b.add(concrete, put(new THREE.CylinderGeometry(0.26, 0.32, 0.3, 12), pole.x, y0 + 0.1, pole.z)); // a collar of concrete round the foot
  b.add(mats.grey, put(worldBox(0.07, 0.07, POLE.arm, 1), pole.x, y0 + POLE.h - 0.7, pole.z + POLE.arm / 2)); // the arm out over the yard
  const reach = POLE.arm * 0.75;
  b.add(mats.grey, put(new THREE.CylinderGeometry(0.02, 0.02, Math.hypot(reach, 0.6), 6), pole.x, y0 + POLE.h - 1.0, pole.z + reach / 2, 0, Math.atan2(reach, 0.6))); // the brace under it
  for (const dy of [-0.55, -1.5]) b.add(mats.grey, put(worldBox(0.3, 0.025, 0.3, 1), pole.x, y0 + POLE.h - 0.4 + dy, pole.z)); // two steel straps round the pole
  b.add(mats.black, put(worldBox(0.2, 0.26, 0.1, 1), pole.x - 0.18, y0 + 1.6, pole.z + 0.04)); // the junction box low on the pole
  b.add(mats.black, put(new THREE.CylinderGeometry(0.014, 0.014, POLE.h - 2.3, 6), pole.x - 0.12, y0 + 1.7 + (POLE.h - 2.3) / 2, pole.z + 0.07)); // the conduit up to the arm
  group.add(b.group());
  const head = lamp(mats, pole.x, y0 + POLE.h - 0.62, pole.z + POLE.arm + 0.02, 0, ground(pole.x, pole.z + 6), 5); // heading 0: south (+z), out over the yard
  group.add(head.group);
  lamps.push(head);
  fixedBox(pole.x, y0 + POLE.h / 2 - 0.4, pole.z, 0.14, POLE.h / 2, 0.14, 0);

  for (const l of lamps) scene.add(l.light, l.light.target); // in the scene, not the group: far detail hides the group, and a light going missing would recompile every shader
  /** Sets both floodlights to `level` (0..1): the cone and the glass. */
  group.userData.set = (level) => {
    for (const l of lamps) l.light.intensity = FLOOD_CANDELA * level;
    mats.lens.emissiveIntensity = level * 2.2;
  };
  group.userData.pole = pole;
  group.userData.lamps = lamps.map((l) => ({ x: l.group.position.x, y: l.group.position.y, z: l.group.position.z }));
  scene.add(group);
  return group;
}
