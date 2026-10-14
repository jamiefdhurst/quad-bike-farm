// The dog's sounds, made on the spot (nothing recorded): a bark is a short buzzy note falling from about 480 Hz through two vowel-ish
// bands with a puff of noise at the start, sometimes two in quick succession; a yelp is a higher squeal that rises and falls; panting is
// soft breath noise chopped five or so times a second while she is running and close enough to hear.

import { WildlifeAudio } from './wildlifeAudio.js';

const PANT_WITHIN = 8; // m: further off than this a pant is not worth making
const PANT_BURST = 1.2; // s per burst

export class DogAudio extends WildlifeAudio {
  constructor(hub, params = {}) {
    super(hub, { volume: 0.7, refDistance: 4, ...params });
    this.pantIn = 0;
  }

  /** One bark: `excited` makes it higher and sometimes a double. */
  bark({ x, y, z }, excited = false) {
    const o = this.out(x, y, z, excited ? 1 : 0.9);
    if (!o) return;
    const one = (at, pitch) => {
      const { ctx, node } = o;
      const t = ctx.currentTime + at;
      const len = 0.17;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(pitch * 1.25, t);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.72, t + len);
      const sum = ctx.createGain();
      for (const [f, q, v] of [[750, 4, 1], [1500, 5, 0.6]]) {
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = f * (0.95 + Math.random() * 0.1);
        band.Q.value = q;
        const g = ctx.createGain();
        g.gain.value = v;
        osc.connect(band).connect(g).connect(sum);
      }
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.9, t + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, t + len);
      sum.connect(env).connect(node);
      osc.start(t);
      osc.stop(t + len + 0.05);
      // The breath at the front of it.
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2200;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.35, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      src.connect(bp).connect(ng).connect(node);
      src.start(t);
      src.stop(t + 0.08);
    };
    const pitch = (excited ? 520 : 440) * (0.92 + Math.random() * 0.16);
    one(0, pitch);
    if (excited && Math.random() < 0.5) one(0.26, pitch * 1.05);
  }

  /** A yelp, when a vehicle nearly gets her. */
  yelp({ x, y, z }) {
    const o = this.out(x, y, z, 0.8);
    if (!o) return;
    const { ctx, node } = o;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.linearRampToValueAtTime(1250, t + 0.09);
    osc.frequency.linearRampToValueAtTime(800, t + 0.26);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1600;
    band.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(band).connect(g).connect(node);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  /** One burst of panting: soft noise chopped at about five a second. */
  pantBurst({ x, y, z }) {
    const o = this.out(x, y, z, 0.3);
    if (!o) return;
    const { ctx, node } = o;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = 0;
    const chop = ctx.createOscillator();
    chop.frequency.value = 5.5;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    chop.connect(depth).connect(g.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(1, t + 0.2);
    env.gain.setValueAtTime(1, t + PANT_BURST - 0.3);
    env.gain.linearRampToValueAtTime(0.0001, t + PANT_BURST);
    g.gain.setValueAtTime(0.5, t);
    src.connect(bp).connect(g).connect(env).connect(node);
    src.start(t);
    chop.start(t);
    src.stop(t + PANT_BURST + 0.05);
    chop.stop(t + PANT_BURST + 0.05);
  }

  /** Called every frame: keeps a pant going while she runs and you are near. */
  update(dt, at, panting) {
    this.pantIn -= dt;
    if (!panting || this.pantIn > 0) return;
    const l = this.hub.listenerPosition;
    if (l && Math.hypot(l.x - at.x, l.z - at.z) > PANT_WITHIN) return;
    this.pantIn = PANT_BURST - 0.2;
    this.pantBurst(at);
  }
}
