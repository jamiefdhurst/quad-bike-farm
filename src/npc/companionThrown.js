import * as THREE from 'three';
import { attachKeepingSize } from './attachKeepingSize.js';

// A girl thrown off the mini moto (motoGo.js decides when): over the side onto the grass, a moment lying there, and up again. As a
// Companion state, mixed in by companion.js. The bike is left lying where it fell; you right it with T like any two-wheeler.

const smooth = (t) => t * t * (3 - 2 * t);
const UP = new THREE.Vector3(0, 1, 0);

export const DEFAULT_THROWN_PARAMS = {
  throwSeconds: 0.7, // the arc over the side
  throwOut: 1.7, // metres to the side of the bike where she lands
  throwAhead: 0.9, // metres she is carried on past where she came off
  lieSeconds: 2.2, // how long she lies on the grass
  riseSeconds: 0.9,
};

export const THROWN_PARAM_RANGES = {
  throwSeconds: [0.2, 2, 0.05],
  throwOut: [0.8, 4, 0.1],
  throwAhead: [0, 3, 0.1],
  lieSeconds: [0, 8, 0.1],
  riseSeconds: [0.2, 3, 0.05],
};

export const thrownStates = {
  thrown: {
    look: 'free',
    enter(data) {
      const q = this.quad;
      attachKeepingSize(this.scene, this.root); // keeps where she is
      this.startPos = this.root.position.clone();
      const e = new THREE.Euler().setFromQuaternion(this.root.quaternion, 'YXZ');
      this.heading = e.y;
      this.root.rotation.set(0, e.y, 0);
      const side = data.side; // +1 to the bike's left
      const t = this.thrownParams;
      // Left of the bike is (cos yaw, -sin yaw); forward is (sin yaw, cos yaw).
      this.landing = new THREE.Vector3(
        q.position.x + (Math.cos(q.yaw) * side * t.throwOut) + Math.sin(q.yaw) * t.throwAhead,
        0,
        q.position.z - (Math.sin(q.yaw) * side * t.throwOut) + Math.cos(q.yaw) * t.throwAhead,
      );
      this.landing.y = this.world.heightAt(this.landing.x, this.landing.z);
      data.phase = 'fall';
      this.rig.play('Idle', { fade: 0.15 });
      this.rig.legSpread = 0;
    },
    update(dt, data) {
      const p = this.thrownParams;
      const side = data.side;
      const roll = (k) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), side * (Math.PI / 2) * k);
      const yawQ = new THREE.Quaternion().setFromAxisAngle(UP, this.heading);
      if (data.phase === 'fall') {
        const k = smooth(Math.min(1, this.fsm.time / p.throwSeconds));
        this.root.position.lerpVectors(this.startPos, this.landing, k);
        this.root.position.y += Math.sin(Math.PI * k) * 0.3;
        this.root.position.y = Math.max(this.root.position.y, this.landing.y + 0.18 * k);
        this.root.quaternion.copy(yawQ).multiply(roll(k));
        if (k >= 1) {
          data.phase = 'lie';
          data.lieFor = p.lieSeconds * (0.8 + Math.random() * 0.4);
          this.voice.say('motoCameOff', { urgent: true, chance: 1 });
          for (const o of this.others()) if (o.root.position.distanceTo(this.landing) < 40) o.voice.say('motoFellOther', { urgent: true, chance: 1 });
        }
        return;
      }
      if (data.phase === 'lie') {
        this.root.position.copy(this.landing);
        this.root.position.y = this.landing.y + 0.18;
        this.root.quaternion.copy(yawQ).multiply(roll(1));
        data.lieFor -= dt;
        if (data.lieFor <= 0) {
          data.phase = 'rise';
          data.riseAt = this.fsm.time;
        }
        return;
      }
      const k = smooth(Math.min(1, (this.fsm.time - data.riseAt) / p.riseSeconds));
      this.root.position.copy(this.landing);
      this.root.position.y = this.landing.y + 0.18 * (1 - k);
      this.root.quaternion.copy(yawQ).multiply(roll(1 - k));
      if (k >= 1) {
        this.root.rotation.set(0, this.heading, 0);
        this.setColliderEnabled(true);
        this.fsm.transition('idle', { facing: this.heading });
      }
    },
  },
};
