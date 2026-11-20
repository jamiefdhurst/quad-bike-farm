import * as THREE from 'three';
import { createRandom } from '../core/random.js';
import { canvasTexture, worldBox } from '../world/outbuildingProps.js';
import { concreteTexture, rubberTexture, galvanisedTexture } from '../world/yardKit.js';
import { hoseGeometry } from '../vehicle/detail/cables.js';

function label(text, paper = '#e8e2c8', ink = '#1e1e1e') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = ink;
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The tank's paint: its colour with streaks running down it, scuffs, a few chips down to rust and a seam round the middle. */
function paintTexture(colour, random) {
  const base = new THREE.Color(colour);
  const rgb = (k) => `rgb(${Math.round(base.r * 255 * k)},${Math.round(base.g * 255 * k)},${Math.round(base.b * 255 * k)})`;
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = rgb(1);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${random() > 0.5 ? '0,0,0' : '255,255,255'},${0.04 + random() * 0.07})`;
      ctx.fillRect(random() * w, random() * h * 0.5, 1 + random() * 3, 20 + random() * 80);
    }
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(${130 + random() * 40},${64 + random() * 24},28,${0.35 + random() * 0.35})`;
      ctx.beginPath();
      ctx.ellipse(random() * w, random() * h, 0.8 + random() * 2.4, 0.6 + random() * 1.6, random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, h / 2, w, 1);
  });
}

/** The slab a bowser stands on, in metres: its size, how far it rises above the ground it is highest on, and how far it is sunk below the lowest. */
export const STAND = { x: 2.7, z: 1.7, rise: 0.1, sink: 0.3, lip: 0.07 };

/**
 * Where a bowser's slab sits on the ground at (x, z) turned `yaw`: sampled at its corners, edges and middle, `top` is the highest ground under it plus the slab's rise
 * (the tank stands on that) and `bottom` the lowest ground less the sink, so a slope has the slab buried at its high side and standing out at its low, never floating (#614).
 */
export function bowserStand(heightAt, x, z, yaw, scale = 1) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  let lo = Infinity;
  let hi = -Infinity;
  for (const u of [-1, 0, 1]) {
    for (const v of [-1, 0, 1]) {
      const lx = u * (STAND.x / 2) * scale;
      const lz = v * (STAND.z / 2) * scale;
      const h = heightAt(x + lx * c + lz * s, z - lx * s + lz * c);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
  }
  return { top: hi + STAND.rise * scale, bottom: lo - STAND.sink * scale, lo, hi };
}

/**
 * A farm fuel tank on a stand with a hose and nozzle: where the jerry can is
 * refilled. Never runs out. The red diesel bowser is the same thing, squatter, darker and labelled.
 * It stands on a concrete slab with a bund lip that follows the ground under it (`bowserStand`), and the hose runs from the tank's valve to the nozzle in its holster on a steel post.
 */
export class FuelTank {
  constructor({ scene, physics, RAPIER, world, position, yaw = 0, text = 'PETROL', colour = 0x4a8a50, paper, ink, scale = 1 }) {
    const g = new THREE.Group();
    g.name = 'fuelTank';
    const random = createRandom(0x0fe1 + Math.round(position.x * 7 + position.z * 13));
    const green = new THREE.MeshStandardMaterial({ map: paintTexture(colour, random), roughness: 0.55, metalness: 0.15 });
    const steel = new THREE.MeshStandardMaterial({ map: galvanisedTexture(random), color: 0x9a9da0, roughness: 0.5, metalness: 0.6 });
    const rubber = new THREE.MeshStandardMaterial({ map: rubberTexture(random), roughness: 0.9 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xb08d3c, roughness: 0.4, metalness: 0.7 });
    const concrete = new THREE.MeshStandardMaterial({ map: concreteTexture(random), roughness: 0.95 });
    const add = (mesh) => {
      g.add(mesh);
      return mesh;
    };

    // The slab: its top at the group's origin, buried below by however far the ground falls away, with a low lip round its edge to hold a spill.
    const stand = bowserStand((px, pz) => world.heightAt(px, pz), position.x, position.z, yaw, scale);
    const depth = (stand.top - stand.bottom) / scale;
    const slab = add(new THREE.Mesh(worldBox(STAND.x, depth, STAND.z, 1), concrete));
    slab.position.y = -depth / 2;
    for (const [sx, sz, px, pz] of [[STAND.x, STAND.lip, 0, -1], [STAND.x, STAND.lip, 0, 1], [STAND.lip, STAND.z - STAND.lip * 2, -1, 0], [STAND.lip, STAND.z - STAND.lip * 2, 1, 0]]) {
      const lip = add(new THREE.Mesh(worldBox(sx - (px ? 0 : 0.04), 0.08, sz, 1), concrete));
      lip.position.set(px * (STAND.x / 2 - STAND.lip / 2), 0.036, pz * (STAND.z / 2 - STAND.lip / 2));
    }

    // Horizontal tank on two A-frame stands.
    const tank = add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.0, 20), green));
    tank.rotation.z = Math.PI / 2;
    tank.position.y = 1.45;
    for (const cap of [-1, 1]) {
      const end = add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), green)); // the domed ends
      end.rotation.z = -cap * Math.PI / 2;
      end.position.set(cap * 1.0, 1.45, 0);
      const bead = add(new THREE.Mesh(new THREE.TorusGeometry(0.555, 0.015, 6, 20), steel)); // the weld bead round each end
      bead.position.set(cap * 0.98, 1.45, 0);
      bead.rotation.y = Math.PI / 2;
    }
    for (const x of [-0.75, 0.75]) {
      for (const z of [-0.35, 0.35]) {
        const leg = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.06), steel));
        leg.position.set(x, 0.5, z * 0.85);
        leg.rotation.x = z > 0 ? -0.3 : 0.3;
        add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.16), steel)).position.set(x, 0.006, z * 1.2); // a foot plate under each leg
      }
      const cradle = add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.95), steel));
      cradle.position.set(x, 0.98, 0);
    }
    const sign = add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18), new THREE.MeshStandardMaterial({ map: label(text, paper, ink), roughness: 0.6 })));
    sign.position.set(0, 1.45, 0.553);
    const cap = add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 12), steel)); // the filler cap on top
    cap.position.set(-0.4, 2.02, 0);

    // The outlet valve, the hose to the nozzle, and the nozzle hung in its holster on a steel post.
    const valve = add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 10), steel));
    valve.position.set(0.85, 0.9, 0.2);
    const post = add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.0, 0.07), steel));
    post.position.set(1.15, 0.5, 0.42);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.015, 0.22), steel)).position.set(1.15, 0.0075, 0.42); // the post's base plate
    const holster = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.13, 12, 1, true), steel));
    holster.name = 'holster';
    holster.material = steel.clone();
    holster.material.side = THREE.DoubleSide;
    holster.position.set(1.15, 1.04, 0.42);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.09), steel)).position.set(1.15, 0.99, 0.42); // the bracket under the cup
    const nozzle = new THREE.Group();
    nozzle.name = 'nozzle'; // the spout down in the cup, the grip above it, the swivel where the hose goes in
    nozzle.position.set(1.15, 1.04, 0.42);
    const part = (mesh, x, y, z) => {
      mesh.position.set(x, y, z);
      nozzle.add(mesh);
    };
    part(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.2, 8), steel), 0, -0.02, 0);
    part(new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.13, 0.05), rubber), 0, 0.15, 0);
    part(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.09), steel), 0, 0.1, 0.055); // the trigger guard
    part(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8), brass), 0, 0.235, 0); // the swivel
    add(nozzle);
    const { hose, clamps } = hoseGeometry([[0.88, 0.86, 0.2], [1.0, 0.6, 0.33], [1.13, 0.95, 0.4], [1.15, 1.27, 0.42]], 0.018, { sag: 0.02, steps: 10 });
    add(new THREE.Mesh(hose, rubber)).name = 'hose';
    if (clamps) add(new THREE.Mesh(clamps, steel));

    g.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    g.position.set(position.x, stand.top, position.z);
    g.rotation.y = yaw;
    g.scale.setScalar(scale);
    scene.add(g);
    this.model = g;
    this.stand = stand;

    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.1, 1.3), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.y = 1.0;
    g.add(this.proxy);

    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    physics.createCollider(
      RAPIER.ColliderDesc.cuboid(1.05 * scale, 1.0 * scale, 0.6 * scale).setTranslation(position.x, stand.top + 1.0 * scale, position.z).setRotation(q),
    );
  }
}
