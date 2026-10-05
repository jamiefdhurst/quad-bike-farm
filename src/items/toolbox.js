import * as THREE from 'three';

const LENGTH = 0.5;
const DEPTH = 0.22;
const BODY_H = 0.17; // the box below the lid
const LID_H = 0.05;

function buildModel() {
  const g = new THREE.Group();
  g.name = 'toolbox';
  const red = new THREE.MeshStandardMaterial({ color: 0xb3201a, roughness: 0.42, metalness: 0.45 });
  const worn = new THREE.MeshStandardMaterial({ color: 0x8e1a15, roughness: 0.6, metalness: 0.4 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xa6a8aa, roughness: 0.35, metalness: 0.8 });
  const black = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.85 });

  // The box, with a rolled lip round the top edge.
  const body = new THREE.Mesh(new THREE.BoxGeometry(LENGTH, BODY_H, DEPTH), red);
  body.position.y = BODY_H / 2;
  g.add(body);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(LENGTH + 0.008, 0.012, DEPTH + 0.008), worn);
  lip.position.y = BODY_H - 0.004;
  g.add(lip);
  // Pressed strengthening ribs along the front and back.
  for (const z of [-1, 1]) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(LENGTH - 0.06, 0.016, 0.006), worn);
    rib.position.set(0, BODY_H * 0.42, z * (DEPTH / 2 + 0.002));
    g.add(rib);
  }

  // A shallow pitched lid: two sloping halves meeting under the handle.
  const half = DEPTH / 2;
  const slope = Math.atan2(LID_H * 0.6, half);
  const panelW = Math.hypot(half, LID_H * 0.6);
  for (const z of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(LENGTH + 0.004, 0.008, panelW + 0.004), red);
    panel.position.set(0, BODY_H + LID_H * 0.3 + 0.004, (z * half) / 2);
    panel.rotation.x = z * slope;
    g.add(panel);
  }
  // Lid ends, so the pitch isn't hollow from the side.
  const endShape = new THREE.Shape();
  endShape.moveTo(-half, 0);
  endShape.lineTo(half, 0);
  endShape.lineTo(0, LID_H * 0.6);
  endShape.closePath();
  const endGeom = new THREE.ShapeGeometry(endShape);
  const endRed = red.clone();
  endRed.side = THREE.DoubleSide;
  for (const x of [-1, 1]) {
    const end = new THREE.Mesh(endGeom, endRed);
    end.position.set((x * (LENGTH + 0.004)) / 2, BODY_H + 0.004, 0);
    end.rotation.y = Math.PI / 2;
    g.add(end);
  }

  // Handle: two folding brackets and a black grip across the top.
  const top = BODY_H + LID_H * 0.6;
  for (const x of [-1, 1]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.02), steel);
    bracket.position.set(x * 0.12, top + 0.02, 0);
    g.add(bracket);
  }
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.21, 12), black);
  grip.rotation.z = Math.PI / 2;
  grip.position.set(0, top + 0.045, 0);
  g.add(grip);

  // Two latches on the front, hinges on the back, and a padlock loop.
  for (const x of [-1, 1]) {
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.01), steel);
    latch.position.set(x * 0.17, BODY_H - 0.012, DEPTH / 2 + 0.006);
    g.add(latch);
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8), steel);
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(x * 0.15, BODY_H, -DEPTH / 2 - 0.004);
    g.add(hinge);
  }
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 12), steel);
  loop.position.set(0, BODY_H - 0.02, DEPTH / 2 + 0.006);
  g.add(loop);

  // A spanner left lying on the lid.
  const spanner = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.006, 0.018), steel);
  spanner.add(shaft);
  for (const x of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.007, 10), steel);
    head.position.x = x * 0.08;
    spanner.add(head);
  }
  spanner.position.set(0.13, BODY_H + LID_H * 0.3 + 0.013, 0.055);
  spanner.rotation.set(slope, 0.35, 0);
  g.add(spanner);

  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

/**
 * A red metal toolbox. It sits on the ground until picked up, then rides low
 * in front of the camera (you can't carry it and the jerry can at once). Take
 * it to a quad that's switched off to tinker with it (see workshop.js).
 */
export class Toolbox {
  constructor({ scene, world, position, yaw = 0 }) {
    this.scene = scene;
    this.world = world;
    this.model = buildModel();
    this.proxy = new THREE.Mesh(
      new THREE.BoxGeometry(LENGTH + 0.15, 0.45, DEPTH + 0.2),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.proxy.position.y = 0.18;
    this.model.add(this.proxy);
    this.held = false;
    this.putDown(position, yaw);
  }

  putDown(position, yaw) {
    this.held = false;
    this.scene.add(this.model);
    this.model.position.set(position.x, this.world.heightAt(position.x, position.z) + 0.005, position.z);
    this.model.rotation.set(0, yaw, 0);
  }

  /** Carried by the handle, low and to the right, where the jerry can goes. */
  pickUp(camera) {
    this.held = true;
    camera.add(this.model);
    this.model.position.set(0.4, -0.74, -0.8);
    this.model.rotation.set(0.04, 1.85, -0.05);
  }
}
