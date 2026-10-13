// Thunder: low-passed noise with a rolling envelope. A close strike is a sharp crack that drops into a long rumble; a far one is only
// the rumble, lower and softer. Procedural, no recordings. Heard the same indoors (the barn's roof only dulls it a little).

export class ThunderAudio {
  constructor(hub, params = {}) {
    this.hub = hub;
    this.p = { volume: 0.9, ...params };
    this.buffer = null;
  }

  noise() {
    const ctx = this.hub.ctx;
    if (!this.buffer) {
      const len = Math.floor(ctx.sampleRate * 8);
      this.buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; // brown-ish noise: mostly low rumble
        d[i] = last * 6;
      }
    }
    return this.buffer;
  }

  /** `loud` 0..1 (Thunderstorm.loudness), `cracks` a close one with a sharp front, `indoor` 0..1 the barn's roof dulls it. */
  rumble(loud, cracks, indoor = 0) {
    const hub = this.hub;
    if (!hub.ready || hub.paused) return;
    const ctx = hub.ctx;
    const t = ctx.currentTime;
    const seconds = 2.5 + 4 * (1 - loud) + (cracks ? 0.5 : 1.5);
    const src = ctx.createBufferSource();
    src.buffer = this.noise();
    src.playbackRate.value = 0.7 + 0.5 * Math.random();
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.setValueAtTime((cracks ? 900 : 380) * (1 - 0.5 * indoor), t);
    low.frequency.exponentialRampToValueAtTime(110, t + seconds);
    const g = ctx.createGain();
    const peak = this.p.volume * loud * (1 - 0.35 * indoor);
    // The rolling: a swell, a dip and another swell, then away.
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t + (cracks ? 0.03 : 0.5));
    g.gain.exponentialRampToValueAtTime(peak * 0.45, t + seconds * 0.3);
    g.gain.exponentialRampToValueAtTime(peak * 0.8, t + seconds * 0.42);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    src.connect(low).connect(g).connect(hub.master);
    src.start(t, Math.random() * 3);
    src.stop(t + seconds + 0.05);
    if (cracks) {
      // The crack itself: a short burst of bright noise on the front.
      const crack = ctx.createBufferSource();
      crack.buffer = this.noise();
      const hi = ctx.createBiquadFilter();
      hi.type = 'bandpass';
      hi.frequency.value = 1800;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(this.p.volume * loud * 0.8 * (1 - 0.5 * indoor), t);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      crack.connect(hi).connect(cg).connect(hub.master);
      crack.start(t, Math.random() * 3);
      crack.stop(t + 0.4);
    }
  }
}
