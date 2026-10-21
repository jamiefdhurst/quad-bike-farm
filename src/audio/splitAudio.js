// A round giving way on the splitter's wedge: a sharp crack of wood (a burst of filtered noise) over a low thump as the halves drop. Made once
// and played where it happens. Same shape as conkerAudio.js.

/** One split as samples: noise with a fast click and a ragged tail, and a 90 Hz thump. Deterministic. */
export function crackSamples(rate) {
  const n = Math.round(rate * 0.5);
  const out = new Float32Array(n);
  let seed = 9091;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    lp += (noise - lp) * 0.55;
    const ragged = 0.6 + 0.4 * Math.sin(t * 310) * Math.sin(t * 77); // the splintering is uneven
    out[i] = lp * Math.exp(-t * 28) * ragged * 0.9 + Math.sin(2 * Math.PI * 90 * t) * Math.exp(-t * 18) * 0.55 + noise * Math.exp(-t * 300) * 0.5;
  }
  return out;
}

export class SplitAudio {
  constructor(hub, volume = 0.8) {
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
    const samples = crackSamples(ctx.sampleRate);
    this.buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    this.buffer.copyToChannel(samples, 0);
    return true;
  }

  /** One crack at `at` ({ x, y, z }); a gnarled round gives a lower, longer one. */
  crack(at, gnarled = false) {
    if (!this.attach()) return;
    const ctx = this.hub.ctx;
    if (this.panner.positionX) {
      this.panner.positionX.value = at.x;
      this.panner.positionY.value = at.y;
      this.panner.positionZ.value = at.z;
    } else this.panner.setPosition(at.x, at.y, at.z);
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = (gnarled ? 0.8 : 1) * (0.92 + Math.random() * 0.16);
    const gain = ctx.createGain();
    gain.gain.value = this.volume;
    src.connect(gain).connect(this.panner);
    src.start();
  }
}
