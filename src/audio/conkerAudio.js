// A conker landing: a short hard "thock" (a high woody knock with a puff of noise) made once and played where it lands, louder when it hit
// you. Same shape as doorAudio.js, but the place changes with each throw.

/** One thock as samples: a 420 Hz knock dying in 60 ms with a click of noise on the front. Deterministic. */
export function thockSamples(rate) {
  const n = Math.round(rate * 0.18);
  const out = new Float32Array(n);
  let seed = 4242;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    lp += (noise - lp) * 0.4;
    out[i] = Math.sin(2 * Math.PI * 420 * t) * Math.exp(-t * 55) * 0.6 + Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 40) * 0.4 + lp * Math.exp(-t * 120) * 0.7;
  }
  return out;
}

export class ConkerAudio {
  constructor(hub, volume = 0.7) {
    this.hub = hub;
    this.volume = volume;
    this.panner = null;
  }

  attach() {
    const hub = this.hub;
    if (this.panner || !hub.ready) return !!this.panner;
    const ctx = hub.ctx;
    this.panner = ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 4;
    this.panner.maxDistance = 300;
    this.panner.connect(hub.master);
    const samples = thockSamples(ctx.sampleRate);
    this.buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    this.buffer.copyToChannel(samples, 0);
    return true;
  }

  /** One thock at `at` ({ x, y, z }), `strength` 0 to 1 (1 on a hit). */
  thock(at, strength = 0.6) {
    if (!this.attach()) return;
    const ctx = this.hub.ctx;
    if (this.panner.positionX) {
      this.panner.positionX.value = at.x;
      this.panner.positionY.value = at.y;
      this.panner.positionZ.value = at.z;
    } else this.panner.setPosition(at.x, at.y, at.z);
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = 0.9 + Math.random() * 0.25;
    const gain = ctx.createGain();
    gain.gain.value = this.volume * (0.3 + 0.7 * strength);
    src.connect(gain).connect(this.panner);
    src.start();
  }
}
