// A phone ringing: the old two-tone trill, four quick pairs, heard from the girl's pocket. Procedural; sits in the world at her like the
// fence's tick does (audio/fenceAudio.js).

export class PhoneAudio {
  constructor(hub, params = {}) {
    this.hub = hub;
    this.p = { volume: 0.35, hearWithin: 45, ...params };
  }

  /** One ring at (x, y, z): nothing if the audio isn't running or it is too far. */
  ring(at) {
    const hub = this.hub;
    if (!hub.ready || hub.paused) return;
    const l = hub.listenerPosition;
    const d = l ? Math.hypot(l.x - at.x, l.y - at.y, l.z - at.z) : 0;
    if (d > this.p.hearWithin) return;
    const ctx = hub.ctx;
    const t0 = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.value = (this.p.volume * 1) / (1 + d * 0.12);
    gain.connect(hub.master);
    for (let i = 0; i < 8; i++) {
      const t = t0 + i * 0.11;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = i % 2 ? 1320 : 1760;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(1, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      osc.connect(env).connect(gain);
      osc.start(t);
      osc.stop(t + 0.11);
    }
  }
}
