// The hut's own sounds: the stove's crackle (little pops of noise, more of them the hotter it is) and the splash of the kettle pouring. Procedural;
// sits in the world at the stove like the fence's sounds do (audio/fenceAudio.js).

/** How many pops a second a stove at `heat` (0..1) makes. */
export function popRate(heat) {
  return heat <= 0.05 ? 0 : 0.8 + 3.2 * heat;
}

export class HutAudio {
  constructor(hub, params = {}) {
    this.hub = hub;
    this.p = { volume: 0.5, ...params };
    this.popBudget = 0;
  }

  /** A burst of filtered noise at (x, y, z): `seconds` long, `hz` the filter's centre, `gain` loud; nothing if the audio isn't running or it's too far. */
  noise(at, within, hz, seconds, gain, q = 1) {
    const hub = this.hub;
    if (!hub.ready || hub.paused) return;
    const l = hub.listenerPosition;
    const d = l ? Math.hypot(l.x - at.x, l.y - at.y, l.z - at.z) : 0;
    if (d > within) return;
    const ctx = hub.ctx;
    const t = ctx.currentTime;
    const n = Math.max(1, Math.round(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = hz;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime((this.p.volume * gain) / (1 + d * 0.25), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    src.connect(filter).connect(g).connect(hub.master);
    src.start(t);
  }

  /** The stove's crackle for one frame: pops at a rate set by its heat. */
  crackle(dt, at, heat) {
    this.popBudget += popRate(heat) * dt;
    while (this.popBudget >= 1) {
      this.popBudget -= 1;
      this.noise(at, 14, 900 + Math.random() * 2600, 0.03 + Math.random() * 0.05, 0.35 + Math.random() * 0.4, 2);
    }
  }

  /** A slice of the kettle's pour, to be called every few tenths of a second while it goes. */
  pour(at) {
    this.noise(at, 10, 1800, 0.45, 0.4, 0.6);
  }

  /** A match struck and the stove's door shut on it: one low whump. */
  light(at) {
    this.noise(at, 16, 250, 0.35, 0.7, 0.8);
  }
}
