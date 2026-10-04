// Main-thread side of the engine sound. The sound itself is made in an
// AudioWorklet (engineWorklet.js), either from recorded pulses or fully
// synthesised; this file creates the audio graph, loads the recordings,
// forwards the engine's firing pulses and events with exact audio-clock
// timestamps, and handles positioning and the ambient wind bed.

import workletUrl from './engineWorklet.js?url';
import { DEFAULT_AUDIO_PARAMS } from './audioParams.js';

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

export class EngineAudio {
  constructor(params = { ...DEFAULT_AUDIO_PARAMS }) {
    this.params = params;
    this.ctx = null;
    this.ready = false;
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
    const p = this.params;

    this.master = ctx.createGain();
    this.master.gain.value = p.masterVolume;
    this.master.connect(ctx.destination);

    this.panner = ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = p.refDistance;
    this.panner.rolloffFactor = p.rolloff;
    this.panner.maxDistance = 600;
    this.panner.connect(this.master);

    this.node = new AudioWorkletNode(ctx, 'engine-processor', { numberOfInputs: 0, outputChannelCount: [1] });
    this.node.connect(this.panner);

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

    this.nextFrameTime = 0;
    this.ready = true;
  }

  /**
   * Loads the recorded engine pulses (see tools/slice_engine_audio.py) and hands
   * them to the worklet. Until this finishes, or if it fails, the synth plays.
   */
  async loadBank() {
    const base = import.meta.env?.BASE_URL ?? '/';
    try {
      const bank = await (await fetch(`${base}audio/engine-bank.json`)).json();
      const buffer = await this.ctx.decodeAudioData(await (await fetch(base + bank.file)).arrayBuffer());
      const data = new Float32Array(buffer.getChannelData(0));
      this.node.port.postMessage({ bank: { ...bank, data } }, [data.buffer]);
      this.bankLoaded = true;
    } catch (err) {
      console.warn('Recorded engine sound unavailable, using the synth', err);
    }
  }

  /**
   * @param {number} dt  Duration of the engine update whose pulses are being played.
   * @param {EngineModel} engine
   * @param {object} source  World position of the engine { x, y, z }.
   * @param {THREE.Camera} listener
   */
  update(dt, engine, source, listener) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const p = this.params;
    const now = ctx.currentTime;

    // Keep a running schedule so pulse spacing survives frame jitter.
    if (this.nextFrameTime < now || this.nextFrameTime > now + 0.3) this.nextFrameTime = now + p.latency;
    const frameStart = this.nextFrameTime;
    this.nextFrameTime += dt;

    const events = engine.pulses.map((pulse) => ({ time: frameStart + pulse.t, type: pulse.type, strength: pulse.strength }));
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

    this.master.gain.setTargetAtTime(p.muted ? 0 : p.masterVolume, now, 0.05);
    this.panner.refDistance = p.refDistance;
    this.panner.rolloffFactor = p.rolloff;
    this.updatePositions(source, listener);

    // Wind gusts slowly.
    this.windPhase += dt;
    const gust = 0.7 + 0.3 * Math.sin(this.windPhase * 0.23) * Math.sin(this.windPhase * 0.071 + 1);
    this.windGain.gain.setTargetAtTime(p.ambientVolume * gust, now, 0.5);
    this.windFilter.frequency.setTargetAtTime(300 + 250 * gust, now, 0.5);
  }

  updatePositions(source, listener) {
    const ctx = this.ctx;
    const pn = this.panner;
    const t = ctx.currentTime;
    if (pn.positionX) {
      pn.positionX.setTargetAtTime(source.x, t, 0.02);
      pn.positionY.setTargetAtTime(source.y, t, 0.02);
      pn.positionZ.setTargetAtTime(source.z, t, 0.02);
    } else {
      pn.setPosition(source.x, source.y, source.z);
    }
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
  }
}
