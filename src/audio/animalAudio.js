// The yard animals' sounds, made on the spot (nothing recorded): a hen's cluck is two or three short falling notes, a scatter a burst of
// high ragged squawks with a clatter of noise for the wings, a hungry pig's squeal a long rising and falling shriek with a wobble in it,
// and a content pig's grunt a low pulsed rumble. All played from where they happen.

import { WildlifeAudio } from './wildlifeAudio.js';

export class AnimalAudio extends WildlifeAudio {
  constructor(hub, params = {}) {
    super(hub, { volume: 0.55, refDistance: 4, ...params });
  }

  /** A hen's cluck: a few short notes, falling a little. */
  cluck({ x, z }, y = 0.3) {
    const o = this.out(x, y, z, 0.5);
    if (!o) return;
    const n = 2 + Math.floor(Math.random() * 2);
    const pitch = 520 + Math.random() * 120;
    for (let i = 0; i < n; i++) this.note(o, i * 0.11, 0.08, pitch * (1.1 - i * 0.07), pitch * (0.8 - i * 0.05), 0.7);
  }

  /** A scatter: ragged squawks and the clatter of wings. */
  squawk({ x, z }, y = 0.4) {
    const o = this.out(x, y, z, 0.9);
    if (!o) return;
    const { ctx, node } = o;
    for (let i = 0; i < 4; i++) this.note(o, i * 0.13 + Math.random() * 0.04, 0.16, 700 + Math.random() * 300, 450 + Math.random() * 150, 0.8);
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(bp).connect(g).connect(node);
    src.start(t);
    src.stop(t + 0.75);
  }

  /** The hungry pig's squeal: up, a wobble, and down. */
  squeal({ x, z }, y = 0.6) {
    const o = this.out(x, y, z, 1);
    if (!o) return;
    const { ctx, node } = o;
    const t = ctx.currentTime;
    const len = 0.75 + Math.random() * 0.25;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.linearRampToValueAtTime(1500, t + len * 0.35);
    osc.frequency.linearRampToValueAtTime(950, t + len);
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 22;
    const depth = ctx.createGain();
    depth.gain.value = 70;
    wobble.connect(depth).connect(osc.frequency);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800;
    band.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.06);
    g.gain.setValueAtTime(0.7, t + len - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(band).connect(g).connect(node);
    osc.start(t);
    wobble.start(t);
    osc.stop(t + len + 0.05);
    wobble.stop(t + len + 0.05);
  }

  /** A content grunt: two or three low pulses. */
  grunt({ x, z }, y = 0.5) {
    const o = this.out(x, y, z, 0.9);
    if (!o) return;
    const n = 2 + Math.floor(Math.random() * 2);
    const pitch = 95 + Math.random() * 30;
    for (let i = 0; i < n; i++) this.note(o, i * 0.2, 0.17, pitch * 1.3, pitch, 0.9);
  }
}
