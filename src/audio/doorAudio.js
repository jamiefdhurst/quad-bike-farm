// A loose shutter banging: one slap of boards made once (a woody thump and a short burst of low-passed noise) and played at the door,
// louder or softer by how hard it hit, through a panner so it comes from where the door is. Same shape as bellAudio.js.

/** One bang as samples: a 95 Hz body dying in 0.25 s with a clack of noise on the front. Deterministic. */
export function bangSamples(rate) {
  const n = Math.round(rate * 0.4);
  const out = new Float32Array(n);
  let seed = 12345;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    lp += (noise - lp) * 0.25;
    out[i] = Math.sin(2 * Math.PI * 95 * t) * Math.exp(-t * 18) * 0.7 + lp * Math.exp(-t * 55) * 0.9 + Math.sin(2 * Math.PI * 310 * t) * Math.exp(-t * 40) * 0.25;
  }
  return out;
}

export class DoorAudio {
  constructor(hub, position, volume = 0.8) {
    this.hub = hub;
    this.position = position;
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
    this.panner.refDistance = 6;
    this.panner.maxDistance = 600;
    const { x, y, z } = this.position;
    if (this.panner.positionX) {
      this.panner.positionX.value = x;
      this.panner.positionY.value = y;
      this.panner.positionZ.value = z;
    } else this.panner.setPosition(x, y, z);
    this.out = ctx.createGain();
    this.out.connect(this.panner).connect(hub.master);
    const samples = bangSamples(ctx.sampleRate);
    this.buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    this.buffer.copyToChannel(samples, 0);
    return true;
  }

  /** One bang, `strength` 0 to 1. */
  bang(strength) {
    if (!this.attach()) return;
    const ctx = this.hub.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const gain = ctx.createGain();
    gain.gain.value = this.volume * (0.25 + 0.75 * strength);
    src.connect(gain).connect(this.out);
    src.start();
  }
}
