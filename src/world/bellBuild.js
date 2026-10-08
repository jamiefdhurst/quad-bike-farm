import * as THREE from 'three';
import { BellSwing, DEFAULT_BELL_PARAMS } from './bell.js';
import { BellAudio } from '../audio/bellAudio.js';

/**
 * The bell on a post beside the barn doors (layout.bell): a timber post with an arm out towards the yard, a brass bell hung
 * from it on a yoke, and a rope off the yoke's lever to pull. Ring it with `ring()`; `update(dt)` swings it and sounds each
 * strike. The swing and the sound are in bell.js.
 */
export class Bell {
  constructor({ scene, physics, RAPIER, world, audioHub, position, yaw = 0, params = { ...DEFAULT_BELL_PARAMS } }) {
    this.params = params;
    this.swing = new BellSwing(params);
    const g = new THREE.Group();
    g.name = 'bell';
    const timber = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.9 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6, metalness: 0.5 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xb08a3e, roughness: 0.35, metalness: 0.85 });
    const rope = new THREE.MeshStandardMaterial({ color: 0xc8b48a, roughness: 1 });
    const add = (parent, geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };

    // The post, with a cap, and the arm out along +x (towards the yard) on a diagonal brace.
    const postH = 2.6;
    add(g, new THREE.BoxGeometry(0.14, postH, 0.14), timber, 0, postH / 2, 0);
    add(g, new THREE.BoxGeometry(0.18, 0.04, 0.18), timber, 0, postH + 0.02, 0);
    const armY = postH - 0.12;
    add(g, new THREE.BoxGeometry(0.62, 0.1, 0.1), timber, 0.31, armY, 0);
    const brace = add(g, new THREE.BoxGeometry(0.42, 0.07, 0.07), timber, 0.17, armY - 0.17, 0);
    brace.rotation.z = Math.PI / 4;

    // The yoke hangs under the end of the arm on two iron straps and swings about the arm's line (x), so the bell swings across z.
    const hangX = 0.46;
    for (const dx of [-0.07, 0.07]) add(g, new THREE.BoxGeometry(0.02, 0.1, 0.03), iron, hangX + dx, armY - 0.09, 0);
    const pivot = new THREE.Group();
    pivot.position.set(hangX, armY - 0.13, 0);
    g.add(pivot);
    this.pivot = pivot;
    add(pivot, new THREE.CylinderGeometry(0.018, 0.018, 0.2, 8), iron, 0, 0, 0).rotation.z = Math.PI / 2;
    add(pivot, new THREE.BoxGeometry(0.08, 0.07, 0.1), timber, 0, -0.05, 0);
    // The bell, mouth down: a lathed profile from the crown to a flared lip.
    const profile = [
      [0.0, 0.0], [0.05, 0.0], [0.075, -0.02], [0.085, -0.07], [0.095, -0.13], [0.115, -0.18], [0.15, -0.215], [0.16, -0.23],
      [0.15, -0.235], [0.135, -0.22], [0.105, -0.185], [0.085, -0.13], [0.075, -0.07], [0.065, -0.025], [0.0, -0.015],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const shell = add(pivot, new THREE.LatheGeometry(profile, 28), brass, 0, -0.08, 0);
    shell.material.side = THREE.DoubleSide;
    // The clapper hangs inside and lags the swing a little.
    const clapper = new THREE.Group();
    clapper.position.set(0, -0.11, 0);
    pivot.add(clapper);
    add(clapper, new THREE.CylinderGeometry(0.006, 0.006, 0.15, 6), iron, 0, -0.075, 0);
    add(clapper, new THREE.SphereGeometry(0.025, 10, 8), iron, 0, -0.16, 0);
    this.clapper = clapper;
    // The lever off the yoke, and the rope down off its end to pulling height.
    add(pivot, new THREE.BoxGeometry(0.03, 0.03, 0.26), iron, 0, -0.03, 0.15);
    const ropeLen = armY - 0.16 - 1.1;
    add(pivot, new THREE.CylinderGeometry(0.009, 0.009, ropeLen, 6), rope, 0, -0.03 - ropeLen / 2, 0.27);
    add(pivot, new THREE.SphereGeometry(0.022, 8, 6), rope, 0, -0.03 - ropeLen, 0.27);

    g.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    const y = world.heightAt(position.x, position.z);
    g.position.set(position.x, y, position.z);
    g.rotation.y = yaw;
    scene.add(g);
    this.model = g;

    // What you look at to ring it: the post, the bell and the rope.
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.9, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.set(0.25, 1.65, 0.1);
    g.add(this.proxy);

    // Only the post stops you.
    physics.createCollider(RAPIER.ColliderDesc.cuboid(0.08, postH / 2, 0.08).setTranslation(position.x, y + postH / 2, position.z));

    const bellAt = new THREE.Vector3(hangX, armY - 0.25, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(g.position);
    this.audio = new BellAudio(audioHub, params, bellAt);
  }

  ring() {
    this.swing.ring();
  }

  get ringing() {
    return this.swing.ringing;
  }

  update(dt) {
    for (const strength of this.swing.update(dt)) this.audio.strike(strength);
    this.pivot.rotation.x = this.swing.angle;
    this.clapper.rotation.x = -this.swing.speed * 0.025;
  }
}
