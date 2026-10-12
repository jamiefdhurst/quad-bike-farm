// The electric fence's sounds: the energiser's dry tick (a short click, heard from a few metres) and the snap of a zap. Procedural; sits
// in the world at the fence like the wildlife's sounds do (audio/wildlifeAudio.js).

export class FenceAudio {
  constructor(hub, params = {}) {
    this.hub = hub;
    this.p = { volume: 0.5, ...params };
  }

  /** A short burst of `hz` square wave at (x, y, z), `seconds` long and `gain` loud; nothing if the audio isn't running or it's too far. */
  burst(at, within, hz, seconds, gain, sweep = 1) {
    const hub = this.hub;
    if (!hub.ready || hub.paused) return;
    const l = hub.listenerPosition;
    const d = l ? Math.hypot(l.x - at.x, l.y - at.y, l.z - at.z) : 0;
    if (d > within) return;
    const ctx = hub.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(hz, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, hz * sweep), t + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(this.p.volume * gain / (1 + d * 0.15), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 600;
    osc.connect(filter).connect(g).connect(hub.master);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }

  tick(at, within = 30) {
    this.burst(at, within, 2400, 0.012, 0.25, 0.5);
  }

  zap(at) {
    this.burst(at, 80, 900, 0.16, 0.8, 0.15);
  }
}
