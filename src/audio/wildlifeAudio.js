// The wildlife's sounds, made on the spot (nothing recorded): a pheasant bursting out is a hoarse double "kok-kok" and a clatter of
// wings, its crow from the hedge a harsher "korr-kok" with a flutter after it, and a rabbit bolting sometimes thumps the ground once.
// All played from where it happens through a panner, duller the further off.

const HEARD_WITHIN = 120; // m beyond which a sound isn't worth starting

export class WildlifeAudio {
  constructor(hub, params = {}) {
    this.hub = hub;
    this.p = { volume: 0.5, refDistance: 6, ...params };
    this.noise = null;
  }

  /** The panned, low-passed output for a sound at (x, y, z); null if it is too far or the audio isn't running. */
  out(x, y, z, gain) {
    const hub = this.hub;
    if (!hub.ready || hub.paused) return null;
    const l = hub.listenerPosition;
    const d = l ? Math.hypot(l.x - x, l.y - y, l.z - z) : 0;
    if (d > HEARD_WITHIN) return null;
    const ctx = hub.ctx;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = this.p.refDistance;
    panner.maxDistance = 400;
    if (panner.positionX) {
      panner.positionX.value = x;
      panner.positionY.value = y;
      panner.positionZ.value = z;
    } else panner.setPosition(x, y, z);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.max(1500, 9000 - d * 60);
    const g = ctx.createGain();
    g.gain.value = this.p.volume * gain;
    filter.connect(g).connect(panner).connect(hub.master);
    return { ctx, node: filter, panner };
  }

  noiseBuffer(ctx) {
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const a = this.noise.getChannelData(0);
      for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  /** One short rasping note: a sawtooth through a band-pass, sliding from `f0` to `f1` Hz over `len` seconds, starting `at` seconds from now. */
  note(o, at, len, f0, f1, vol) {
    const { ctx, node } = o;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + len);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = (f0 + f1) * 1.3;
    band.Q.value = 2.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(band).connect(g).connect(node);
    osc.start(t);
    osc.stop(t + len + 0.05);
  }

  /** Beating wings: noise through a band-pass, chopped by a fast flutter that slows as it goes. */
  wings(o, at, len, vol) {
    const { ctx, node } = o;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800;
    band.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0;
    const flutter = ctx.createOscillator();
    flutter.frequency.setValueAtTime(26, t);
    flutter.frequency.linearRampToValueAtTime(11, t + len);
    const depth = ctx.createGain();
    depth.gain.value = vol * 0.5;
    flutter.connect(depth).connect(g.gain);
    g.gain.setValueAtTime(vol * 0.5, t);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    src.connect(band).connect(g).connect(node);
    src.start(t);
    flutter.start(t);
    src.stop(t + len + 0.05);
    flutter.stop(t + len + 0.05);
  }

  /** A pheasant flushed from the hedge at (x, y, z). */
  burst({ x, y, z, strength = 1 }) {
    const o = this.out(x, y, z, 0.9 * Math.min(1.3, strength));
    if (!o) return;
    this.note(o, 0.05, 0.11, 1250, 800, 0.5);
    this.note(o, 0.23, 0.11, 1200, 760, 0.5);
    this.wings(o, 0, 1.6, 0.7);
  }

  /** A cock pheasant crowing from the hedge. */
  call({ x, y, z }) {
    const o = this.out(x, y, z, 0.55);
    if (!o) return;
    this.note(o, 0, 0.16, 700, 1100, 0.4);
    this.note(o, 0.24, 0.09, 1300, 900, 0.5);
    this.wings(o, 0.4, 0.5, 0.3);
  }

  /** A rabbit's warning thump: one low dull knock. */
  thump({ x, y, z }) {
    const o = this.out(x, y, z, 0.6);
    if (!o) return;
    const { ctx, node } = o;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(g).connect(node);
    osc.start(t);
    osc.stop(t + 0.15);
  }
}
