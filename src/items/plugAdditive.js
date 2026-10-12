import * as THREE from 'three';

// A bottle of plug-saver on the ground by the oil bottle. Hold E on it with a pre-mix can in your hands to treat what is in the can; the
// treated share carries into a quad's tank when you fill it, and the engine then loads its plug up much less at idle (engine
// `additiveFoulCut`). It lasts as long as the treated fuel does: top up with untreated fuel and it thins out, burn it and it is gone.
// Unlike the oil bottle it stays where it stands.

export const DEFAULT_PLUG_ADDITIVE_PARAMS = {
  treatRate: 2, // litres of fuel treated per second while you hold E (five seconds for a full 10 L can)
};

export const PLUG_ADDITIVE_PARAM_RANGES = {
  treatRate: [0.1, 20, 0.1],
};

function buildModel() {
  const g = new THREE.Group();
  g.name = 'plugAdditive';
  const plastic = new THREE.MeshStandardMaterial({ color: 0xdfe6e0, roughness: 0.45 });
  const label = new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.6 });
  const cap = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.2, 14), plastic);
  body.position.y = 0.1;
  g.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0465, 0.0515, 0.09, 14), label);
  band.position.y = 0.1;
  g.add(band);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.035, 0.04, 12), plastic);
  neck.position.y = 0.22;
  g.add(neck);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.025, 12), cap);
  lid.position.y = 0.2525;
  g.add(lid);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

export class PlugAdditive {
  constructor({ scene, world, position, yaw = 0, params = { ...DEFAULT_PLUG_ADDITIVE_PARAMS } }) {
    this.params = params;
    this.model = buildModel();
    this.model.position.set(position.x, world.heightAt(position.x, position.z) + 0.005, position.z);
    this.model.rotation.set(0, yaw, 0);
    scene.add(this.model);
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.y = 0.15;
    this.model.add(this.proxy);
  }
}
