// The cat's sounds, made on the spot (nothing recorded): a mew is a pitched note that rises and falls through a vowel-ish band-pass, a
// hiss is high-passed noise, and a purr is low noise chopped at about 25 times a second, played in short bursts while it is close enough
// to hear. All from where the cat is, through the wildlife's panner.

import { WildlifeAudio } from './wildlifeAudio.js';

const PURR_WITHIN = 5; // m: further off than this a purr is not worth making
const PURR_BURST = 2.4; // s per burst

export class CatAudio extends WildlifeAudio {
  constructor(hub, params = {}) {
    super(hub, { volume: 0.6, refDistance: 2.5, ...params });
    this.purrIn = 0;
  }

  /** A mew from (x, y, z): rising then falling, a little wavering. `kind` 'mew' or 'cry' (short and sharp, when it is frightened). */
  mew({ x, y, z }, kind = 'mew') {
    const o = this.out(x, y, z, kind === 'cry' ? 0.9 : 0.7);
    if (!o) return;
    const { ctx, node } = o;
    const t = ctx.currentTime;
    const len = kind === 'cry' ? 0.28 : 0.55;
    const base = (kind === 'cry' ? 780 : 560) * (0.94 + Math.random() * 0.12);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.linearRampToValueAtTime(base * 1.55, t + len * 0.35);
    osc.frequency.linearRampToValueAtTime(base * 0.8, t + len);
    const vib = ctx.createOscillator();
    vib.frequency.value = 7;
    const vibDepth = ctx.createGain();
    vibDepth.gain.value = 14;
    vib.connect(vibDepth).connect(osc.frequency);
    const vowel = ctx.createBiquadFilter();
    vowel.type = 'bandpass';
    vowel.Q.value = 3;
    vowel.frequency.setValueAtTime(900, t);
    vowel.frequency.linearRampToValueAtTime(1900, t + len * 0.4); // "mee" into "ow"
    vowel.frequency.linearRampToValueAtTime(1000, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(vowel).connect(g).connect(node);
    osc.start(t);
    vib.start(t);
    osc.stop(t + len + 0.05);
    vib.stop(t + len + 0.05);
  }

  /** A hiss: a burst of bright noise. */
  hiss({ x, y, z }) {
    const o = this.out(x, y, z, 0.6);
    if (!o) return;
    const { ctx, node } = o;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    src.connect(hp).connect(g).connect(node);
    src.start(t);
    src.stop(t + 0.5);
  }

  /** One burst of purring, soft low noise chopped fast. */
  purrBurst({ x, y, z }) {
    const o = this.out(x, y, z, 0.35);
    if (!o) return;
    const { ctx, node } = o;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0;
    const chop = ctx.createOscillator();
    chop.frequency.value = 24;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    chop.connect(depth).connect(g.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(1, t + 0.4);
    env.gain.setValueAtTime(1, t + PURR_BURST - 0.5);
    env.gain.linearRampToValueAtTime(0.0001, t + PURR_BURST);
    g.gain.setValueAtTime(0.5, t);
    src.connect(lp).connect(g).connect(env).connect(node);
    src.start(t);
    chop.start(t);
    src.stop(t + PURR_BURST + 0.05);
    chop.stop(t + PURR_BURST + 0.05);
  }

  /** Called every frame: keeps a purr going while the cat purrs and you are near. */
  update(dt, at, purring) {
    this.purrIn -= dt;
    if (!purring || this.purrIn > 0) return;
    const l = this.hub.listenerPosition;
    if (l && Math.hypot(l.x - at.x, l.z - at.z) > PURR_WITHIN) return;
    this.purrIn = PURR_BURST - 0.4;
    this.purrBurst(at);
  }
}
