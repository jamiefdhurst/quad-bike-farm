// The winch cable groaning under load: a low creak of strained fibre, made once (a slow swept tone with rough noise on it) and played at the
// fairlead through a panner, louder the harder the cable works. Same shape as doorAudio.js.

/** One groan as samples: a 70 to 120 Hz scrape rising and falling over 0.6 s with a rasp of noise. Deterministic. */
export function creakSamples(rate) {
  const n = Math.round(rate * 0.6);
  const out = new Float32Array(n);
  let seed = 4242;
  let lp = 0;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const u = t / 0.6;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    lp += (noise - lp) * 0.12;
    phase += (2 * Math.PI * (70 + 50 * Math.sin(Math.PI * u))) / rate;
    const env = Math.sin(Math.PI * u) ** 1.5;
    out[i] = (Math.sign(Math.sin(phase)) * 0.18 + Math.sin(phase) * 0.3 + lp * 0.9) * env;
  }
  return out;
}

export class WinchAudio {
  constructor(hub, volume = 0.5) {
    this.hub = hub;
    this.volume = volume;
    this.out = null;
  }

  attach() {
    const hub = this.hub;
    if (this.out || !hub.ready) return !!this.out;
    const ctx = hub.ctx;
    this.panner = ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 4;
    this.panner.maxDistance = 300;
    this.out = ctx.createGain();
    this.out.connect(this.panner).connect(hub.master);
    const samples = creakSamples(ctx.sampleRate);
    this.buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    this.buffer.copyToChannel(samples, 0);
    return true;
  }

  /** One groan at `at` ({ x, y, z }), `strength` 0 to 1. */
  creak(strength, at) {
    if (!this.attach()) return;
    const ctx = this.hub.ctx;
    if (this.panner.positionX) {
      this.panner.positionX.value = at.x;
      this.panner.positionY.value = at.y;
      this.panner.positionZ.value = at.z;
    } else this.panner.setPosition(at.x, at.y, at.z);
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = 0.85 + strength * 0.3 + Math.random() * 0.15;
    const gain = ctx.createGain();
    gain.gain.value = this.volume * (0.2 + 0.8 * strength);
    src.connect(gain).connect(this.out);
    src.start();
  }
}
