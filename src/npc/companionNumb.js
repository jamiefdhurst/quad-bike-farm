import * as THREE from 'three';
import { Numbness, DEFAULT_NUMB_PARAMS } from './numbness.js';

// A long sit on a shaking seat: her legs go tingly, her bum goes numb, and she gets off, walks it off, stretches and gets back on (numbness.js
// has the build-up). As Companion methods, mixed in by companion.js. Only for a sit of her own choosing on a parked running quad's back, not
// one she is holding for you (item 119's hold, waiting for you, warming it up) and not while you ride.

export const numbMethods = {
  get numbParams() {
    return this.numbShared ?? DEFAULT_NUMB_PARAMS;
  },

  get numbness() {
    this._numbness ??= new Numbness(this.numbParams);
    return this._numbness;
  },

  /** Each step while she is seated: builds the numbness if this is the kind of sit that counts, and acts on it. */
  updateNumb(dt) {
    const q = this.quad;
    const counts =
      this.seatKind === 'pillion' && this.seatedByChoice && !this.holdingIdle && !q.rider && !q.driver && !q.isGhostRiding && q.speed < 0.5 && q.engine.isRunning && !this.numbPlan;
    for (const e of this.numbness.update(dt, { sitting: counts, level: this.voice.level })) {
      if (e === 'tingle') this.selfEvents.push('numbTingle');
      else if (e === 'numb') this.getOffNumb();
    }
  },

  /** Her bum has gone numb: she gets off, and then walks it off (startNumbWalk). */
  getOffNumb() {
    this.selfEvents.push('numbGo');
    const quad = this.quad;
    this.afterDismount = () => this.startNumbWalk(quad);
    this.fsm.transition('dismounting');
  },

  /** Off the quad: a few steps away to shake her legs out. */
  startNumbWalk(quad) {
    const a = Math.random() * Math.PI * 2;
    const d = this.numbParams.walkDistance;
    const here = quad.position;
    const target = new THREE.Vector3(here.x + Math.sin(a) * d, 0, here.z + Math.cos(a) * d);
    target.y = this.world.heightAt(target.x, target.z);
    this.numbPlan = { quad, phase: 'walking', sawWalking: false, t: 0, dur: 0 };
    this.walkTo(target, Math.atan2(here.x - target.x, here.z - target.z));
  },

  /** Each step: the walk, the stretch, and getting back on. */
  updateNumbPlan(dt) {
    const m = this.numbPlan;
    if (!m) return;
    const p = this.numbParams;
    if (m.phase === 'walking') {
      if (this.fsm.is('walking')) m.sawWalking = true;
      else if (this.fsm.is('idle') && m.sawWalking) {
        m.phase = 'stretch';
        m.t = 0;
        m.dur = p.walkAfterMin + Math.random() * Math.max(0, p.walkAfterMax - p.walkAfterMin);
        this.selfEvents.push('numbStretch');
      } else if (!this.fsm.is('idle')) this.numbPlan = null; // something else took her
      return;
    }
    if (!this.fsm.is('idle')) {
      this.numbPlan = null;
      return;
    }
    m.t += dt;
    if (!this.fidget) this.fidget = { type: 'stretch', side: 1, t: 0, duration: 2.6 };
    if (m.t < m.dur) return;
    this.numbPlan = null;
    const q = m.quad;
    if (q.engine.isRunning && this.canRidePillion(q) && !this.takenByOther(q)) {
      this.selfEvents.push('numbBack');
      this.requestMount(q, { ownChoice: true });
    }
  },

  /** The debug button: numb now, if she is sat on the back of a quad. Returns whether she was. */
  forceNumb() {
    if (!this.isSeated || this.seatKind !== 'pillion') return false;
    this.getOffNumb();
    return true;
  },
};
