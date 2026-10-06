import * as THREE from 'three';

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

/**
 * A farm fuel tank on a stand with a hose and nozzle: where the jerry can is
 * refilled. Never runs out. The red diesel bowser is the same thing, squatter, darker and labelled.
 */
export class FuelTank {
  constructor({ scene, physics, RAPIER, world, position, yaw = 0, text = 'PETROL', colour = 0x4a8a50, paper, ink, scale = 1 }) {
    const g = new THREE.Group();
    g.name = 'fuelTank';
    const green = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.55, metalness: 0.15 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x55585b, roughness: 0.5, metalness: 0.6 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });

    // Horizontal tank on two A-frame stands.
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.0, 20), green);
    tank.rotation.z = Math.PI / 2;
    tank.position.y = 1.45;
    g.add(tank);
    for (const x of [-0.75, 0.75]) {
      for (const z of [-0.35, 0.35]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.06), steel);
        leg.position.set(x, 0.5, z * 0.85);
        leg.rotation.x = z > 0 ? -0.3 : 0.3;
        g.add(leg);
      }
      const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.95), steel);
      cradle.position.set(x, 0.98, 0);
      g.add(cradle);
    }
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.18),
      new THREE.MeshBasicMaterial({ map: label(text, paper, ink) }),
    );
    sign.position.set(0, 1.45, 0.553);
    g.add(sign);
    // Outlet, hose down to a nozzle hung on the stand.
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 10), steel);
    valve.position.set(0.85, 0.9, 0.2);
    g.add(valve);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.85, 0.84, 0.2),
      new THREE.Vector3(0.95, 0.45, 0.35),
      new THREE.Vector3(1.05, 0.25, 0.45),
      new THREE.Vector3(1.1, 0.7, 0.42),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.018, 8), rubber));
    const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), steel);
    nozzle.position.set(1.1, 0.78, 0.42);
    g.add(nozzle);

    g.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    const y = world.heightAt(position.x, position.z);
    g.position.set(position.x, y, position.z);
    g.rotation.y = yaw;
    g.scale.setScalar(scale);
    scene.add(g);
    this.model = g;

    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.1, 1.3), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.y = 1.0;
    g.add(this.proxy);

    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    physics.createCollider(
      RAPIER.ColliderDesc.cuboid(1.05 * scale, 1.0 * scale, 0.6 * scale).setTranslation(position.x, y + 1.0 * scale, position.z).setRotation(q),
    );
  }
}
