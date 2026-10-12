import * as THREE from 'three';

// A pair of jump leads, left by the petrol tank. Pick them up, clamp one end on a
// quad with a flat battery (E on it), and the other end on a quad with a running
// engine (E on that); the running one charges the flat one while they're joined.
// The leads only reach a few metres, so park the quads nose to nose. E on a
// clamped quad takes them off again.

export const DEFAULT_JUMP_LEAD_PARAMS = {
  reach: 4.5, // metres between the two quads the leads will stretch
  handReach: 5, // metres from a clamped quad you can carry the other end before it pulls off
  chargeRate: 0.012, // battery (0..1) gained per second by the quad being jumped from a running one: a flat one needs a minute or two, not a moment
};

export const JUMP_LEAD_PARAM_RANGES = {
  reach: [1, 12, 0.1],
  handReach: [1, 15, 0.1],
  chargeRate: [0, 0.5, 0.001],
};

/**
 * Which of two engines the leads charge, if either: the running one is the donor
 * (the higher battery if both run), and the other, if it's lower, takes the charge.
 * Neither running, nothing happens. Returns the engine to charge, or null.
 */
export function jumpTarget(a, b) {
  if (a.batteryOut || b.batteryOut) return null; // no battery in it to charge or to give
  if (!a.isRunning && !b.isRunning) return null;
  let donor = a.isRunning ? a : b;
  if (a.isRunning && b.isRunning) donor = a.battery >= b.battery ? a : b;
  const receiver = donor === a ? b : a;
  return receiver.battery < donor.battery || !receiver.isRunning ? (receiver.battery < 1 ? receiver : null) : null;
}

const SAG_POINTS = 12;

function buildModel() {
  const g = new THREE.Group();
  g.name = 'jumpLeads';
  const red = new THREE.MeshStandardMaterial({ color: 0xc02020, roughness: 0.6 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9a9da0, roughness: 0.4, metalness: 0.7 });
  // Two loops of cable lying together, a clamp on each.
  for (const [mat, r] of [[red, 0.12], [black, 0.16]]) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 20), mat);
    coil.rotation.x = Math.PI / 2;
    coil.position.y = 0.02 + (mat === black ? 0.012 : 0);
    g.add(coil);
  }
  for (const [mat, x] of [[red, -0.14], [black, 0.14]]) {
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.12), mat);
    clamp.position.set(x, 0.03, -0.17);
    g.add(clamp);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.05), steel);
    jaw.position.set(x, 0.03, -0.25);
    g.add(jaw);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

export class JumpLeads {
  constructor({ scene, world, position, yaw = 0, params = { ...DEFAULT_JUMP_LEAD_PARAMS } }) {
    this.scene = scene;
    this.world = world;
    this.params = params;
    this.model = buildModel();
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.y = 0.08;
    this.model.add(this.proxy);
    this.held = false;
    this.ends = []; // the quads clamped, in the order clamped
    this.points = new Float32Array(SAG_POINTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.points, 3).setUsage(THREE.DynamicDrawUsage));
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xc02020 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    scene.add(this.line);
    this.putDown(position, yaw);
  }

  /** Both ends on quads. */
  get joined() {
    return this.ends.length === 2;
  }

  putDown(position, yaw) {
    this.held = false;
    this.ends = [];
    this.scene.add(this.model);
    this.model.visible = true;
    this.model.position.set(position.x, this.world.heightAt(position.x, position.z) + 0.005, position.z);
    this.model.rotation.set(0, yaw, 0);
    this.line.visible = false;
  }

  /** Carried low in front of the camera, where the toolbox goes. */
  pickUp(camera) {
    this.held = true;
    this.ends = [];
    camera.add(this.model);
    this.model.position.set(0.35, -0.6, -0.7);
    this.model.rotation.set(0.1, 0.4, 0);
  }

  /** E on a quad with the leads in hand: the first clamp goes on, then the second. Returns what happened. */
  clamp(quad) {
    if (!this.held || this.ends.includes(quad)) return null;
    this.ends.push(quad);
    if (this.ends.length < 2) return 'first';
    // Both on: they lie between the quads, out of your hands.
    this.held = false;
    this.model.visible = false;
    return 'joined';
  }

  /** E on a clamped quad: the leads come off and are back in your hand. */
  unclamp(camera) {
    this.ends = [];
    this.held = true;
    camera.add(this.model);
    this.model.visible = true;
    this.model.position.set(0.35, -0.6, -0.7);
    this.model.rotation.set(0.1, 0.4, 0);
    this.line.visible = false;
  }

  /**
   * One step. `handPos` is where your hands are (to draw the cable and to pull it
   * out of your hand if you wander too far). Returns an event: 'pulledOff' (from your hand, or the quads
   * rolled apart), or { type: 'charging', engine } while a flat quad is being jumped.
   */
  update(dt, handPos) {
    const p = this.params;
    if (!this.ends.length) {
      this.line.visible = false;
      return null;
    }
    const [a, b] = this.ends;
    const aPos = new THREE.Vector3(a.position.x, a.position.y + 0.55, a.position.z);
    if (!b) {
      if (aPos.distanceTo(handPos) > p.handReach) {
        this.ends = [];
        this.line.visible = false;
        return 'pulledOff';
      }
      this.draw(aPos, handPos, p.handReach);
      return null;
    }
    const bPos = new THREE.Vector3(b.position.x, b.position.y + 0.55, b.position.z);
    if (aPos.distanceTo(bPos) > p.reach) {
      // The quads have moved apart: the leads are pulled off and drop between them.
      const mid = aPos.clone().add(bPos).multiplyScalar(0.5);
      this.putDown(mid, 0);
      return 'pulledOff';
    }
    this.draw(aPos, bPos, p.reach);
    const target = jumpTarget(a.engine, b.engine);
    if (target) {
      target.charge(p.chargeRate * dt);
      return { type: 'charging', engine: target };
    }
    return null;
  }

  /** The cable between two points, sagging a little. */
  draw(from, to, reach) {
    const sag = Math.min(0.6, 0.25 + (1 - Math.min(1, from.distanceTo(to) / reach)) * 0.5);
    for (let i = 0; i < SAG_POINTS; i++) {
      const t = i / (SAG_POINTS - 1);
      this.points[i * 3] = from.x + (to.x - from.x) * t;
      this.points[i * 3 + 1] = from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * sag;
      this.points[i * 3 + 2] = from.z + (to.z - from.z) * t;
    }
    this.line.geometry.attributes.position.needsUpdate = true;
    this.line.visible = true;
  }
}
