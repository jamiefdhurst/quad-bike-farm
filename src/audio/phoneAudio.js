// A phone ringing: the old two-tone trill, four quick pairs, heard from the girl's pocket. Procedural; sits in the world at her like the
// fence's tick does (audio/fenceAudio.js).

export class PhoneAudio {
  constructor(hub, params = {}) {
    this.hub = hub;
    this.p = { volume: 0.35, hearWithin: 45, ...params };
  }

  /** Your own loud two-note whistle for calling the girls (npc/callThem.js), from where you stand: nothing if the audio isn't running. */
  whistle(volume = 0.5) {
    const hub = this.hub;
    if (!hub.ready || hub.paused) return;
    const ctx = hub.ctx;
    const t0 = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.value = volume * 0.5;
    gain.connect(hub.master);
    [[0, 0.32, 1500, 2300], [0.4, 0.5, 1800, 2600]].forEach(([at, len, from, to]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(from, t0 + at);
      osc.frequency.exponentialRampToValueAtTime(to, t0 + at + len);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0 + at);
      env.gain.exponentialRampToValueAtTime(1, t0 + at + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
      osc.connect(env).connect(gain);
      osc.start(t0 + at);
      osc.stop(t0 + at + len + 0.02);
    });
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
