// Main-thread side of the engine sound. The sound itself is made in an
// AudioWorklet (engineWorklet.js), either from recorded pulses or fully
// synthesised.
//
// AudioHub owns the one AudioContext, the master volume, the wind bed and the
// recorded pulse bank. Each quad has an EngineAudio voice: its own worklet node
// and panner, fed with that engine's firing pulses and events at exact
// audio-clock timestamps.

import workletUrl from './engineWorklet.js?url';
import { DEFAULT_AUDIO_PARAMS, DEFAULT_SOUND_PARAMS } from './audioParams.js';

function brownNoise(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

export class AudioHub {
  constructor(params = { ...DEFAULT_SOUND_PARAMS }) {
    this.params = params;
    this.ctx = null;
    this.ready = false;
    this.bank = null;
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.loading;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    this.ctx = new Ctx();
    this.loading = this.ctx.audioWorklet
      .addModule(workletUrl)
      .then(() => this.build())
      .then(() => this.loadBank())
      .catch((err) => console.error('Engine audio failed to load', err));
    return this.loading;
  }

  build() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.params.masterVolume;
    this.master.connect(ctx.destination);

    // Ambient wind, not positional.
    const wind = ctx.createBufferSource();
    wind.buffer = brownNoise(ctx, 4);
    wind.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 500;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.master);
    wind.start();
    this.windPhase = Math.random() * 10;

    // Fuel pouring: white noise through a band-pass that glugs about.
    const len = ctx.sampleRate * 2;
    const noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const pour = ctx.createBufferSource();
    pour.buffer = noise;
    pour.loop = true;
    this.pourFilter = ctx.createBiquadFilter();
    this.pourFilter.type = 'bandpass';
    this.pourFilter.Q.value = 3;
    this.pourFilter.frequency.value = 700;
    this.pourGain = ctx.createGain();
    this.pourGain.gain.value = 0;
    pour.connect(this.pourFilter).connect(this.pourGain).connect(this.master);
    pour.start();
    this.glugTimer = 0;
    this.ready = true;
  }

  /** Call every frame with whether fuel is being poured. */
  setPouring(active, dt) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    if (!active) {
      this.pourGain.gain.setTargetAtTime(0, t, 0.05);
      return;
    }
    // A glug every so often: the pitch jumps and the level swells.
    this.glugTimer -= dt;
    if (this.glugTimer <= 0) {
      this.glugTimer = 0.09 + Math.random() * 0.12;
      this.pourFilter.frequency.setTargetAtTime(450 + Math.random() * 700, t, 0.02);
      this.pourGain.gain.setTargetAtTime(this.params.pourVolume * (0.6 + Math.random() * 0.6), t, 0.03);
    }
  }

  /** Loads the recorded engine pulses (see tools/slice_engine_audio.py). Until then, or if it fails, voices use the synth. */
  async loadBank() {
    const base = import.meta.env?.BASE_URL ?? '/';
    try {
      const bank = await (await fetch(`${base}audio/engine-bank.json`)).json();
      const buffer = await this.ctx.decodeAudioData(await (await fetch(base + bank.file)).arrayBuffer());
      this.bank = { ...bank, data: buffer.getChannelData(0) };
    } catch (err) {
      console.warn('Recorded engine sound unavailable, using the synth', err);
    }
  }

  /** Points the listener at the camera and drives the master volume and wind. */
  update(dt, listener) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const p = this.params;
    const t = ctx.currentTime;
    this.master.gain.setTargetAtTime(p.muted ? 0 : p.masterVolume, t, 0.05);

    const l = ctx.listener;
    const pos = listener.position;
    const fwd = listener.getWorldDirection(this.tmpFwd ?? (this.tmpFwd = listener.position.clone()));
    const up = listener.up.clone().applyQuaternion(listener.quaternion);
    if (l.positionX) {
      l.positionX.setTargetAtTime(pos.x, t, 0.02);
      l.positionY.setTargetAtTime(pos.y, t, 0.02);
      l.positionZ.setTargetAtTime(pos.z, t, 0.02);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.02);
      l.forwardY.setTargetAtTime(fwd.y, t, 0.02);
      l.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      l.upX.setTargetAtTime(up.x, t, 0.02);
      l.upY.setTargetAtTime(up.y, t, 0.02);
      l.upZ.setTargetAtTime(up.z, t, 0.02);
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }

    this.windPhase += dt;
    const gust = 0.7 + 0.3 * Math.sin(this.windPhase * 0.23) * Math.sin(this.windPhase * 0.071 + 1);
    this.windGain.gain.setTargetAtTime(p.ambientVolume * gust, t, 0.5);
    this.windFilter.frequency.setTargetAtTime(300 + 250 * gust, t, 0.5);
  }
}

/** One engine's sound, positioned at its quad. */
export class EngineAudio {
  constructor(hub, params = { ...DEFAULT_AUDIO_PARAMS }) {
    this.hub = hub;
    this.params = params;
    this.node = null;
    this.bankSent = false;
  }

  /** Creates the worklet node once the hub is ready, and sends it the pulse bank once that has loaded. */
  attach() {
    const hub = this.hub;
    if (!hub.ready) return false;
    if (!this.node) {
      const ctx = hub.ctx;
      const p = this.params;
      this.panner = ctx.createPanner();
      this.panner.panningModel = 'HRTF';
      this.panner.distanceModel = 'inverse';
      this.panner.refDistance = p.refDistance;
      this.panner.rolloffFactor = p.rolloff;
      this.panner.maxDistance = 600;
      this.panner.connect(hub.master);
      this.node = new AudioWorkletNode(ctx, 'engine-processor', { numberOfInputs: 0, outputChannelCount: [1] });
      this.node.connect(this.panner);
      this.nextFrameTime = 0;
    }
    if (!this.bankSent && hub.bank) {
      // Each voice gets its own copy; the worklet keeps it for good.
      const data = new Float32Array(hub.bank.data);
      this.node.port.postMessage({ bank: { ...hub.bank, data } }, [data.buffer]);
      this.bankSent = true;
    }
    return true;
  }

  get bankLoaded() {
    return this.bankSent;
  }

  /**
   * @param {number} dt  Duration of the engine update whose pulses are being played.
   * @param {EngineModel} engine
   * @param {object} source  World position of the engine { x, y, z }.
   */
  update(dt, engine, source) {
    if (!this.attach()) return;
    const ctx = this.hub.ctx;
    const p = this.params;
    const now = ctx.currentTime;
    const latency = this.hub.params.latency;

    // Keep a running schedule so pulse spacing survives frame jitter.
    if (this.nextFrameTime < now || this.nextFrameTime > now + 0.3) this.nextFrameTime = now + latency;
    const frameStart = this.nextFrameTime;
    this.nextFrameTime += dt;

    const events = engine.pulses.map((pulse) => ({
      time: frameStart + pulse.t,
      type: pulse.type,
      strength: pulse.strength,
      period: pulse.period,
    }));
    for (const e of engine.events) {
      const time = frameStart + e.t;
      if (e.type === 'stalled') {
        // A couple of uneven coughs as it dies (the synth uses these; the recorded engine plays its own run-down).
        const v = p.coughVolume;
        events.push({ time, type: 'cough', strength: 0.9 * v });
        events.push({ time: time + 0.1 + Math.random() * 0.06, type: 'cough', strength: 0.55 * v });
        events.push({ time: time + 0.27 + Math.random() * 0.08, type: 'cough', strength: 0.3 * v });
      }
      events.push({ time, type: e.type });
    }

    this.node.port.postMessage({
      params: p,
      state: {
        rpm: engine.rpm,
        throttle: engine.throttle,
        roughness: engine.roughness,
        running: engine.isRunning,
        cranking: engine.state === 'cranking',
      },
      events,
    });

    this.panner.refDistance = p.refDistance;
    this.panner.rolloffFactor = p.rolloff;
    const pn = this.panner;
    if (pn.positionX) {
      pn.positionX.setTargetAtTime(source.x, now, 0.02);
      pn.positionY.setTargetAtTime(source.y, now, 0.02);
      pn.positionZ.setTargetAtTime(source.z, now, 0.02);
    } else {
      pn.setPosition(source.x, source.y, source.z);
    }
  }
}
