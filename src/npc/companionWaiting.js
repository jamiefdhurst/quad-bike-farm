import * as THREE from 'three';
import { WAITING_IDLES, DEFAULT_WAITING_PARAMS, waitingChoices, nearestWithin, describeWaiting } from './waiting.js';

// Waiting that fits where she is (waiting.js decides which ways suit). As Companion methods, mixed in by companion.js: every so
// often her ways of standing about are re-weighed by what's around her; while she kicks a tyre or wipes a seat she's turned to it;
// each says what she looks at (attention.js); and while she checks her phone it's in her hand.

const _at = new THREE.Vector3();
const _wrist = new THREE.Vector3();
const _finger = new THREE.Vector3();
const _head = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();

/** A phone: dark, thin, the screen lit a little. Made once per girl, in the scene, hidden until she checks it. */
function makePhone() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.148, 0.009), new THREE.MeshStandardMaterial({ color: 0x1c1d21, roughness: 0.4, metalness: 0.3 }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.064, 0.136), new THREE.MeshStandardMaterial({ color: 0x9cc0e0, emissive: 0x6f95bd, emissiveIntensity: 0.7, roughness: 0.2 }));
  screen.position.z = 0.0047;
  g.add(body, screen);
  g.visible = false;
  g.name = 'phone';
  return g;
}

export const waitingMethods = {
  /** Every so often, her ways of standing about weighed by what's around her; each frame, what the current one has her face and watch. */
  updateWaiting(dt) {
    const idles = this.standingIdles;
    if (!idles) return;
    const p = this.waitingParams ?? DEFAULT_WAITING_PARAMS;
    if ((this.waitCheck = (this.waitCheck ?? 0) - dt) <= 0 && this.fsm.is('idle')) {
      this.waitCheck = 1;
      const here = this.root.position;
      const wheels = [];
      const seats = [];
      for (const q of this.quads) {
        if (q.position.distanceTo(here) > 6 || q.speed > 0.3 || q.isTipped) continue;
        for (const w of q.wheels ?? []) if (w.object) wheels.push({ ...pt(w.object.getWorldPosition(_at)), quad: q });
        if (q.riderAnchor && !q.rider) seats.push({ ...pt(q.riderAnchor.getWorldPosition(_at)), quad: q });
      }
      this.waitTargets = { wheel: nearestWithin(here, wheels, p.waitReach), seat: nearestWithin(here, seats, p.waitReach * 0.8) };
      const w = this.waitWeather ?? {};
      const ctx = { ...this.waitTargets, chill: w.chill, sun: w.sun, clouding: w.clouding, wet: w.wet };
      idles.setChoices(waitingChoices(this.character?.idles ?? [], ctx, this.character?.waitTastes ?? {}, p));
    }
    this.waitTurn = null;
    const name = idles.name;
    if (!name || !WAITING_IDLES[name] || idles.weight < 0.05 || !this.fsm.is('idle')) return;
    const r = this.root.position;
    const t = name === 'kickTyre' ? this.waitTargets?.wheel : name === 'wipeSeat' ? this.waitTargets?.seat : null;
    if (t) {
      this.waitTurn = Math.atan2(t.x - r.x, t.z - r.z);
      this.attend({ x: t.x, y: t.y, z: t.z }, { weight: 2 });
    } else if (name === 'phone' && this.phone?.visible) {
      this.attend(pt(this.phone.position), { weight: 2.5 });
    } else if (name === 'lookUp') {
      this.attend({ x: r.x + Math.sin(this.heading) * 4, y: r.y + 1.5 + 6, z: r.z + Math.cos(this.heading) * 4 }, { weight: 2 });
    } else if (name === 'shadeEyes') {
      this.attend({ x: r.x + Math.sin(this.heading) * 40, y: r.y + 3, z: r.z + Math.cos(this.heading) * 40 }, { weight: 1.5 });
    }
  },

  /** Whether what she's doing waiting has her turned to something (a tyre, a seat), so she doesn't turn round to look elsewhere. */
  waitPinned() {
    const n = this.standingIdles?.name;
    return !!n && !!WAITING_IDLES[n]?.pins && this.standingIdles.weight > 0.2;
  },

  /** Whether what she's doing waiting has something in or under her hand (her phone, a seat), so a hands-up reaction waits. */
  waitHands() {
    const n = this.standingIdles?.name;
    return !!n && !!WAITING_IDLES[n]?.hands && this.standingIdles.weight > 0.2;
  },

  /** What she's doing waiting, for the debug panel and the console. */
  waitingText() {
    const s = this.standingIdles;
    if (!s?.name || !this.fsm.is('idle')) return 'not stood about';
    return WAITING_IDLES[s.name] ? describeWaiting(s.name, s.weight) : `standing ${s.name}`;
  },

  /**
   * Starts a way of waiting now (the debug panel and the console). Returns why not, or null: a tyre or a seat has to be within reach,
   * and she has to be stood about.
   */
  forceWaiting(name) {
    if (!this.fsm.is('idle')) return 'she is not stood about';
    this.waitCheck = 0;
    this.updateWaiting(0);
    if (name === 'kickTyre' && !this.waitTargets?.wheel) return 'there is no tyre within reach';
    if (name === 'wipeSeat' && !this.waitTargets?.seat) return 'there is no seat within reach';
    this.standingIdles.force(name);
    this.waitCheck = 8; // leave her list be while she does it
    return null;
  },

  /** Her phone in her right hand while she checks it, screen up to her face. Runs as a rig poser, after the hands are posed. */
  posePhone() {
    const s = this.standingIdles;
    const show = s?.name === 'phone' && s.weight > 0.6 && this.fsm.is('idle') && !this.reaction;
    if (!show) {
      if (this.phone) this.phone.visible = false;
      return;
    }
    const b = this.rig.bones;
    if (!b.RightHand || !b.Head) return;
    if (!this.phone) this.scene.add((this.phone = makePhone()));
    b.RightHand.getWorldPosition(_wrist);
    (b.RightHandIndex1 ?? b.RightHand).getWorldPosition(_finger);
    b.Head.getWorldPosition(_head);
    // Up the phone along her fingers, the screen turned to her eyes.
    _y.subVectors(_finger, _wrist);
    if (_y.lengthSq() < 1e-8) _y.set(0, 0, 1);
    _y.normalize();
    const centre = _at.copy(_wrist).addScaledVector(_y, 0.07);
    _z.subVectors(_head, centre).normalize();
    _y.addScaledVector(_z, -_y.dot(_z)).normalize();
    _x.crossVectors(_y, _z);
    _m.makeBasis(_x, _y, _z);
    this.phone.quaternion.setFromRotationMatrix(_m);
    this.phone.position.copy(centre).addScaledVector(_z, 0.012);
    this.phone.visible = true;
  },
};

const pt = (v) => ({ x: v.x, y: v.y, z: v.z });
