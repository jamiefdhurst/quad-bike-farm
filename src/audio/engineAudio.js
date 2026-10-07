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
import { SoundPath } from './propagation.js';
import { rainHeard } from '../world/barn.js';

// Recorded pulse banks in public/audio/, made by tools/slice_engine_audio.py.
const BANK_NAMES = ['engine-bank', 'engine-bank-2t', 'engine-bank-50', 'engine-bank-tractor', 'engine-bank-moto', 'engine-bank-atc', 'engine-bank-utv', 'engine-bank-green', 'engine-bank-yellow', 'engine-bank-landy'];

/** The echo of the barn: a couple of seconds of noise that dies away fast, duller as it goes (tin and brick, not a cathedral). */
function barnImpulse(ctx, seconds = 1.6) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      lp += (0.55 - 0.45 * t) * (Math.random() * 2 - 1 - lp);
      d[i] = lp * Math.pow(1 - t, 3.2) * (i < 400 ? i / 400 : 1);
    }
  }
  return buf;
}

/** Raindrops on tin: sparse sharp ticks, each a short ring, looped. */
function tinRain(ctx, seconds = 3) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const drops = Math.floor(seconds * 520);
  for (let n = 0; n < drops; n++) {
    const at = Math.floor(Math.random() * len);
    const amp = 0.15 + Math.random() ** 3 * 0.9;
    const ring = 0.0015 + Math.random() * 0.004;
    const f = 2200 + Math.random() * 2600;
    for (let k = 0; k < ring * ctx.sampleRate * 5 && at + k < len; k++) {
      d[at + k] += amp * Math.sin((2 * Math.PI * f * k) / ctx.sampleRate) * Math.exp(-k / (ring * ctx.sampleRate));
    }
  }
  return buf;
}

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
    this.banks = {}; // recorded pulse banks by name, filled in as they load
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
    // If the browser pauses the sound (it can, after a while, if it thinks nothing's playing) say so in the console and keep trying to resume it.
    this.ctx.onstatechange = () => console.warn(`Audio context ${this.ctx.state}`);
    this.loading = this.ctx.audioWorklet
      .addModule(workletUrl)
      .then(() => this.build())
      .then(() => Promise.all(BANK_NAMES.map((name) => this.loadBank(name))))
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
    // The hose: a bright hiss, with a patter when it hits something.
    const hose = ctx.createBufferSource();
    hose.buffer = noise;
    hose.loop = true;
    hose.playbackRate.value = 0.83;
    this.hoseFilter = ctx.createBiquadFilter();
    this.hoseFilter.type = 'bandpass';
    this.hoseFilter.Q.value = 0.7;
    this.hoseFilter.frequency.value = 3200;
    this.hoseGain = ctx.createGain();
    this.hoseGain.gain.value = 0;
    hose.connect(this.hoseFilter).connect(this.hoseGain).connect(this.master);
    hose.start();
    // Rain: a soft wash of noise, brighter the harder it falls.
    const rain = ctx.createBufferSource();
    rain.buffer = noise;
    rain.loop = true;
    rain.playbackRate.value = 0.61;
    this.rainFilter = ctx.createBiquadFilter();
    this.rainFilter.type = 'bandpass';
    this.rainFilter.Q.value = 0.35;
    this.rainFilter.frequency.value = 1400;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rain.connect(this.rainFilter).connect(this.rainGain).connect(this.master);
    rain.start();
    // Rain on the barn's tin roof, only heard under it.
    const tin = ctx.createBufferSource();
    tin.buffer = tinRain(ctx);
    tin.loop = true;
    this.tinGain = ctx.createGain();
    this.tinGain.gain.value = 0;
    tin.connect(this.tinGain).connect(this.master);
    tin.start();
    // The barn's echo: every quad's sound path can send into this (propagation.js).
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = barnImpulse(ctx);
    this.reverbOut = ctx.createGain();
    this.reverb.connect(this.reverbOut).connect(this.master);
    this.glugTimer = 0;
    this.ready = true;
  }

  /** Call every frame with whether fuel is being poured. */
  /** The hose spraying; `onTarget` when it's hitting something close (it patters lower). */
  setSpraying(active, onTarget = false) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.hoseGain.gain.setTargetAtTime(active ? this.params.hoseVolume * (onTarget ? 1 : 0.7) : 0, t, 0.06);
    this.hoseFilter.frequency.setTargetAtTime(onTarget ? 1800 : 3200, t, 0.1);
  }

  /** How hard it's raining, 0..1, and how far indoors you are (0..1): under the barn's tin roof it drums (see `rainHeard`). */
  setRain(level, indoor = 0, barnParams) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const heard = barnParams ? rainHeard(level, indoor, barnParams) : { level, tin: 0 };
    this.rainGain.gain.setTargetAtTime(this.params.rainVolume * Math.sqrt(Math.max(0, heard.level)), t, 0.5);
    this.rainFilter.frequency.setTargetAtTime(1000 + 1400 * level, t, 0.5);
    this.tinGain.gain.setTargetAtTime(this.params.rainVolume * 2.2 * heard.tin * Math.sqrt(Math.max(0, level)), t, 0.4);
  }

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

  /** Loads one bank of recorded engine pulses (see tools/slice_engine_audio.py). Until then, or if it fails, voices use the synth. */
  async loadBank(name) {
    const base = import.meta.env?.BASE_URL ?? '/';
    try {
      const bank = await (await fetch(`${base}audio/${name}.json`)).json();
      const buffer = await this.ctx.decodeAudioData(await (await fetch(base + bank.file)).arrayBuffer());
      this.banks[name] = { ...bank, data: buffer.getChannelData(0) };
    } catch (err) {
      console.warn(`Recorded engine sound ${name} unavailable, using the synth`, err);
    }
  }

  /** Points the listener at the camera and drives the master volume and wind. */
  update(dt, listener) {
    if (!this.ready) return;
    const ctx = this.ctx;
    if (ctx.state !== 'running' && ctx.state !== 'closed' && (this.resumeWait = (this.resumeWait ?? 0) - dt) <= 0) {
      this.resumeWait = 1;
      ctx.resume().catch(() => {});
    }
    const p = this.params;
    const t = ctx.currentTime;
    this.master.gain.setTargetAtTime(p.muted ? 0 : p.masterVolume, t, 0.05);

    const l = ctx.listener;
    const pos = listener.position;
    // Where each quad's sound path measures its distance from (see propagation.js).
    this.listenerPosition = { x: pos.x, y: pos.y, z: pos.z };
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
    this.bankSent = null; // name of the bank the worklet has
  }

  /** Creates the worklet node once the hub is ready, and sends it the pulse bank once that has loaded. */
  attach() {
    const hub = this.hub;
    if (!hub.ready) return false;
    if (!this.node) {
      const ctx = hub.ctx;
      const p = this.params;
      // Travel delay (Doppler), air absorption and panning; the ride sounds join it too.
      this.path = new SoundPath(hub, { refDistance: p.refDistance, rolloff: p.rolloff });
      this.panner = this.path.panner;
      this.node = new AudioWorkletNode(ctx, 'engine-processor', { numberOfInputs: 0, outputChannelCount: [1] });
      this.node.onprocessorerror = () => console.error(`Engine sound processor failed (${hub.ctx.currentTime.toFixed(0)} s in)`);
      this.node.port.onmessage = (e) => e.data?.warn && console.warn(e.data.warn);
      this.node.connect(this.path.input);
      this.nextFrameTime = 0;
    }
    const bank = hub.banks[this.params.recBank];
    if (this.bankSent !== this.params.recBank && bank) {
      // Each voice gets its own copy; the worklet keeps it until it's replaced.
      const data = new Float32Array(bank.data);
      this.node.port.postMessage({ bank: { ...bank, data } }, [data.buffer]);
      this.bankSent = this.params.recBank;
    }
    return true;
  }

  get bankLoaded() {
    return !!this.bankSent;
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
        fan: engine.fan,
        loud: engine.exhaustLoud,
        revsPerCycle: engine.revsPerCycle,
      },
      events,
    });

    this.panner.refDistance = p.refDistance;
    this.panner.rolloffFactor = p.rolloff;
    // onBoard is set by the quad's unit while you're riding it.
    this.path.update(dt, source, !!this.onBoard);
  }
}
