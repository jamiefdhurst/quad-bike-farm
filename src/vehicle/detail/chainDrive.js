import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { chainLoop, linkPlaces, shownWear, sprocketOutline, teethFor } from '../chainShape.js';

// A drive chain and its two sprockets for the chain-driven vehicles (#48): toothed sprockets and a chain of plates and rollers that follows
// how stretched the quad's chain is (chainShape.js has the shapes, pure). `buildChainDrive` adds it to a model and returns the drive, which
// Quad calls every frame with `set(wear)` (rebuilds only when the picture changes) and `spin(angle)` (the rear wheel's turn).

const OILED = new THREE.Color(0x3a3937);
const RUSTY = new THREE.Color(0x9e5c2c);
const SPROCKET_OILED = new THREE.Color(0x7d8083);
const SPROCKET_RUSTY = new THREE.Color(0x7a4a2a);

/** A sprocket with its axis along x, about the origin: `width` thick, the rollers' circle at `r`, worn by `hook`. */
export function sprocketGeometry(r, hook, width = 0.006) {
  const outline = sprocketOutline(r, teethFor(r), hook);
  const shape = new THREE.Shape();
  outline.forEach(([a, rad], i) => {
    const z = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) shape.moveTo(z, y);
    else shape.lineTo(z, y);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, steps: 1 });
  geo.rotateY(-Math.PI / 2); // the shape's x (z here) is forward and the extrusion runs along -x
  geo.translate(width / 2, 0, 0);
  return geo;
}

/** The links of a chain along `places`: a wide outer link alternating with a narrower inner one, each one box, about x = 0. */
export function chainGeometry(places) {
  const parts = [];
  const outer = new THREE.BoxGeometry(0.0074, 0.0112, 0.0108);
  const inner = new THREE.BoxGeometry(0.0046, 0.0102, 0.0108);
  const m = new THREE.Matrix4();
  places.forEach((p, i) => {
    m.makeRotationX(-p.angle).setPosition(0, p.y, p.z);
    parts.push((i % 2 ? inner : outer).clone().applyMatrix4(m));
  });
  return mergeGeometries(parts);
}

/**
 * Adds the chain drive to `parent`. `front` and `rear` are the sprockets' centres and the radius their rollers sit at ({ y, z, r } in
 * `parent`'s frame), `x` the chain's plane. Returns the drive (`set`, `spin`, and the meshes by name).
 */
export function buildChainDrive(parent, { x, front, rear, width = 0.006, sprocketColour = null }) {
  const group = new THREE.Group();
  group.name = 'chainDrive';
  group.userData.keep = true;
  parent.add(group);
  const chainMat = new THREE.MeshStandardMaterial({ color: OILED, roughness: 0.45, metalness: 0.85 });
  const sprocketMat = new THREE.MeshStandardMaterial({ color: sprocketColour ?? SPROCKET_OILED, roughness: 0.5, metalness: 0.8 });
  const frontMesh = new THREE.Mesh(sprocketGeometry(front.r, 0, width), sprocketMat);
  frontMesh.name = 'chainFrontSprocket';
  frontMesh.position.set(x, front.y, front.z);
  const rearMesh = new THREE.Mesh(sprocketGeometry(rear.r, 0, width), sprocketMat);
  rearMesh.name = 'chainRearSprocket';
  rearMesh.position.set(x, rear.y, rear.z);
  const chain = new THREE.Mesh(new THREE.BufferGeometry(), chainMat);
  chain.name = 'chain';
  chain.position.x = x;
  group.add(frontMesh, rearMesh, chain);

  const sprockets = new Map(); // geometry by sprocket and hook, so wearing and mending don't build the same ones again
  const sprocketFor = (c, hook) => {
    const key = `${c.r}:${hook}`;
    if (!sprockets.has(key)) sprockets.set(key, sprocketGeometry(c.r, hook, width));
    return sprockets.get(key);
  };
  const baseColour = new THREE.Color(sprocketColour ?? SPROCKET_OILED);
  let shown = null;
  const drive = {
    group,
    /** The materials this changes as the chain wears: kept out of the mud and wear coat, which would copy them and so hide the change. */
    materials: [chainMat, sprocketMat],
    chain,
    front: frontMesh,
    rear: rearMesh,
    /** What is drawn now ({ slack, hook, off, dry } as shown), null before the first set. */
    get shown() {
      return shown;
    },
    /** Draw the chain as worn: the links are rebuilt when slack, the teeth or whether it is off change; the rust follows how dry it is. */
    set(wear) {
      const w = shownWear(wear);
      const dry = Math.round(w.dry * 20) / 20;
      if (!shown || dry !== shown.dry) {
        chainMat.color.copy(OILED).lerp(RUSTY, dry ** 1.3);
        chainMat.roughness = 0.45 + 0.5 * dry;
        chainMat.metalness = 0.85 - 0.7 * dry;
        sprocketMat.color.copy(baseColour).lerp(SPROCKET_RUSTY, 0.55 * dry ** 1.3);
      }
      if (!shown || w.slack !== shown.slack || w.off !== shown.off) {
        chain.geometry.dispose();
        chain.geometry = chainGeometry(linkPlaces(chainLoop(front, rear, { slack: w.slack, off: w.off })).places);
      }
      if (!shown || w.hook !== shown.hook) {
        frontMesh.geometry = sprocketFor(front, w.hook);
        rearMesh.geometry = sprocketFor(rear, w.hook);
      }
      shown = { ...w, dry };
    },
    /** Turn the sprockets with the rear wheel (the front one goes faster by the ratio of their rollers' circles). */
    spin(angle) {
      rearMesh.rotation.x = angle;
      frontMesh.rotation.x = (angle * rear.r) / front.r;
    },
  };
  drive.set({ slack: 0, hook: 0, off: false, dry: 0 });
  group.userData.drive = drive; // Quad finds it by the group's name
  return drive;
}
