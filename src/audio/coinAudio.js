// A coin or two dropped on a tin: a few short metallic pings made once and played at the tin, softer when it is a small amount. Same shape as
// doorAudio.js: pure samples (tested), and a small class that plays them through a panner at the tin's place.

/** The chink as samples: three coins, each a bright ring of two or three partials that dies in a tenth of a second, a little apart. Deterministic. */
export function chinkSamples(rate) {
  const n = Math.round(rate * 0.55);
  const out = new Float32Array(n);
  const coins = [
    { at: 0, f: 2640, level: 0.55 },
    { at: 0.07, f: 3310, level: 0.45 },
    { at: 0.15, f: 2980, level: 0.35 },
  ];
  for (const coin of coins) {
    const start = Math.round(coin.at * rate);
    for (let i = start; i < n; i++) {
      const t = (i - start) / rate;
      const decay = Math.exp(-t * 28);
      const ring = Math.sin(2 * Math.PI * coin.f * t) + 0.5 * Math.sin(2 * Math.PI * coin.f * 1.51 * t) + 0.25 * Math.sin(2 * Math.PI * coin.f * 2.32 * t);
      const tick = i - start < 40 ? 0.6 * (1 - (i - start) / 40) : 0; // the click as it lands
      out[i] += (ring * decay * coin.level + tick * coin.level) * 0.5;
    }
  }
  return out;
}

export class CoinAudio {
  constructor(hub, position, volume = 0.7) {
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
    this.panner.refDistance = 4;
    this.panner.maxDistance = 400;
    const { x, y, z } = this.position;
    if (this.panner.positionX) {
      this.panner.positionX.value = x;
      this.panner.positionY.value = y;
      this.panner.positionZ.value = z;
    } else this.panner.setPosition(x, y, z);
    this.out = ctx.createGain();
    this.out.connect(this.panner).connect(hub.master);
    const samples = chinkSamples(ctx.sampleRate);
    this.buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    this.buffer.copyToChannel(samples, 0);
    return true;
  }

  /** One chink at `at` (a position) instead of at the tin: a till or a rack away from the farm. */
  chinkAt(at, strength = 0.6) {
    if (!this.attach()) return;
    const { x, y, z } = at;
    if (this.panner.positionX) {
      this.panner.positionX.value = x;
      this.panner.positionY.value = y;
      this.panner.positionZ.value = z;
    } else this.panner.setPosition(x, y, z);
    this.chink(strength);
  }

  /** One chink, `strength` 0 to 1 (a job paying is a small one, a purchase a big one). */
  chink(strength = 0.6) {
    if (!this.attach()) return;
    const ctx = this.hub.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = 0.95 + Math.random() * 0.1;
    const gain = ctx.createGain();
    gain.gain.value = this.volume * (0.3 + 0.7 * strength);
    src.connect(gain).connect(this.out);
    src.start();
  }
}
