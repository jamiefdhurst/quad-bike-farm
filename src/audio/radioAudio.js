// The sound of the radios: all procedural. Each radio that is on gets a chain of its own (built when it first makes a sound, dropped
// when it has been silent a while): the station's programme (radioProgramme.js: syllables of a presenter, a tune, a jingle) mixed with
// hiss and crackle that grow as the station drifts off, then through the set's speaker (its band, its bass) and out at the level where
// the listener is. The programme is on the audio clock, so two radios playing at once play the same thing.

import { programmeEvents } from './radioProgramme.js';
import { heardAt } from '../vehicle/radio.js';

const LOOKAHEAD = 0.7; // seconds of the programme scheduled ahead of the clock
const DROP_AFTER = 1.5; // seconds silent before a chain is taken down

let noiseBuffer = null;
function whiteNoise(ctx) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const n = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

export class RadioAudio {
  constructor(hub, params = {}) {
    this.hub = hub;
    this.p = { volume: 0.5, crackleRate: 9, ...params };
    this.chains = new Map(); // key -> chain
  }

  /** Is there a sound to make at all right now? */
  get live() {
    return !!(this.hub.ready && !this.hub.paused && !this.hub.params?.muted);
  }

  build(key, radio) {
    const ctx = this.hub.ctx;
    const prof = radio.profile;
    const out = ctx.createGain(); // the level where the listener is
    out.gain.value = 0;
    const dull = ctx.createBiquadFilter(); // duller outside the cab
    dull.type = 'lowpass';
    dull.frequency.value = 18000;
    const hp = ctx.createBiquadFilter(); // the speaker's band
    hp.type = 'highpass';
    hp.frequency.value = prof.band[0];
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = prof.band[1];
    const shelf = ctx.createBiquadFilter();
    shelf.type = 'lowshelf';
    shelf.frequency.value = 200;
    shelf.gain.value = prof.bass;
    const speaker = ctx.createGain(); // everything the set makes goes through here
    speaker.connect(hp).connect(shelf).connect(lp).connect(dull).connect(out).connect(this.hub.master);

    const programme = ctx.createGain(); // the station: clear when the signal is, thin in static
    programme.connect(speaker);

    const hissSrc = ctx.createBufferSource();
    hissSrc.buffer = whiteNoise(ctx);
    hissSrc.loop = true;
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.value = 2200;
    hissFilter.Q.value = 0.5;
    const hiss = ctx.createGain();
    hiss.gain.value = 0;
    hissSrc.connect(hissFilter).connect(hiss).connect(speaker);
    hissSrc.start();

    let warble = null; // a worn cassette head's slow wobble of pitch, in cents
    if (prof.warble > 0) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.9;
      warble = ctx.createGain();
      warble.gain.value = prof.warble * 28;
      lfo.connect(warble);
      lfo.start();
      warble.lfo = lfo;
    }

    const chain = { key, out, dull, programme, hiss, speaker, hissSrc, warble, scheduledTo: ctx.currentTime, silentFor: 0, popDebt: 0 };
    this.chains.set(key, chain);
    return chain;
  }

  drop(key) {
    const c = this.chains.get(key);
    if (!c) return;
    try {
      c.hissSrc.stop();
      c.warble?.lfo.stop();
    } catch {
      // already stopped
    }
    c.out.disconnect();
    this.chains.delete(key);
  }

  /** Plays the programme's events that start in the next little while on this radio's chain. */
  schedule(chain) {
    const ctx = this.hub.ctx;
    const now = ctx.currentTime;
    const from = Math.max(chain.scheduledTo, now);
    const to = now + LOOKAHEAD;
    if (to <= from) return;
    for (const e of programmeEvents(from, to)) this.voice(chain, e);
    chain.scheduledTo = to;
  }

  osc(chain, type, freq, t) {
    const o = this.hub.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (chain.warble) chain.warble.connect(o.detune);
    return o;
  }

  noiseBurst(chain, t, dur, gain, filterType, freq) {
    const ctx = this.hub.ctx;
    const src = ctx.createBufferSource();
    src.buffer = whiteNoise(ctx);
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(chain.programme);
    src.start(t, Math.random() * 1.5, dur + 0.02);
  }

  voice(chain, e) {
    const ctx = this.hub.ctx;
    const t = e.t;
    const end = t + e.dur;
    if (e.kind === 'syllable') {
      const o = this.osc(chain, 'sawtooth', e.f0 * 0.96, t);
      o.frequency.linearRampToValueAtTime(e.f0, end);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.5 * e.gain, t + 0.02);
      env.gain.linearRampToValueAtTime(0.0001, end + 0.03);
      for (const [f, q, g] of [[e.f1, 6, 1], [e.f2, 9, 0.6]]) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f;
        bp.Q.value = q;
        const gg = ctx.createGain();
        gg.gain.value = g * 2.2;
        o.connect(bp).connect(gg).connect(env);
      }
      env.connect(chain.programme);
      o.start(t);
      o.stop(end + 0.05);
      if (e.hiss) this.noiseBurst(chain, t, 0.07, 0.18 * e.gain, 'highpass', 4500);
    } else if (e.kind === 'lead') {
      const o = this.osc(chain, 'square', e.freq, t);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2200;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.11 * e.gain, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, end + 0.1);
      o.connect(lp).connect(env).connect(chain.programme);
      o.start(t);
      o.stop(end + 0.12);
    } else if (e.kind === 'bass') {
      const o = this.osc(chain, 'triangle', e.freq, t);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.4 * e.gain, t + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      o.connect(env).connect(chain.programme);
      o.start(t);
      o.stop(end + 0.02);
    } else if (e.kind === 'kick') {
      const o = this.osc(chain, 'sine', 120, t);
      o.frequency.exponentialRampToValueAtTime(42, t + e.dur);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.7, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + e.dur + 0.04);
      o.connect(env).connect(chain.programme);
      o.start(t);
      o.stop(t + e.dur + 0.06);
    } else if (e.kind === 'snare') {
      this.noiseBurst(chain, t, e.dur, 0.35 * e.gain, 'bandpass', 1800);
    } else if (e.kind === 'hat') {
      this.noiseBurst(chain, t, e.dur, 0.14 * e.gain, 'highpass', 6500);
    }
  }

  /** A pop or spit in the static, through the speaker only (it isn't part of the station). */
  pop(chain, strength) {
    const ctx = this.hub.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = whiteNoise(ctx);
    const g = ctx.createGain();
    const dur = 0.004 + Math.random() * 0.02;
    g.gain.setValueAtTime(strength * (0.3 + Math.random() * 0.7), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(g).connect(chain.speaker);
    src.start(t, Math.random() * 1.5, dur + 0.01);
  }

  /**
   * Every frame. `sets` is every radio that might be heard: { key, radio, distance, inside }. A radio that is not on (or too far to hear)
   * costs nothing once its chain is dropped.
   */
  update(sets, dt, P) {
    const live = this.live;
    const ctx = live ? this.hub.ctx : null;
    for (const s of sets) {
      const { radio } = s;
      const { gain, dull } = heardAt(radio.level, s.distance, s.inside, P);
      const audible = live && gain > 0.003;
      let chain = this.chains.get(s.key);
      if (!audible) {
        if (chain) {
          chain.silentFor += dt;
          chain.out.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
          if (chain.silentFor > DROP_AFTER) this.drop(s.key);
        }
        continue;
      }
      chain ??= this.build(s.key, radio);
      chain.silentFor = 0;
      const t = ctx.currentTime;
      const signal = radio.signal;
      const prof = radio.profile;
      chain.out.gain.setTargetAtTime(gain * this.p.volume, t, 0.06);
      chain.dull.frequency.setTargetAtTime(18000 - dull * 16500, t, 0.1);
      // a weak station is thin in the noise: the voice drops, the hiss comes up
      chain.programme.gain.setTargetAtTime(0.25 + 0.75 * signal * signal, t, 0.15);
      chain.hiss.gain.setTargetAtTime(prof.hiss * (0.012 + 0.16 * (1 - signal)), t, 0.15);
      // pops and spits: more in static, and the ignition's tick rising with the revs
      chain.popDebt += dt * this.p.crackleRate * (prof.crackle * (0.3 + 2.2 * (1 - signal)) + prof.whine * radio.rev * 3);
      while (chain.popDebt >= 1) {
        chain.popDebt -= 1;
        this.pop(chain, 0.04 + 0.2 * prof.crackle + 0.1 * prof.whine * radio.rev);
      }
      this.schedule(chain);
    }
  }

  dispose() {
    for (const key of [...this.chains.keys()]) this.drop(key);
  }
}
