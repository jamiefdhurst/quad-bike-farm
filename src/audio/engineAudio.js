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
import { SoundPath, distanceLevel, airCutoff } from './propagation.js';
import { rainHeard } from '../world/barn.js';
import { yardBed } from '../world/yardBed.js';
import { moorBed } from '../world/moorBed.js';
import { MoorAudio } from './moorAudio.js';
import { RiverAudio } from './riverAudio.js';
import { USE_CUES, useSamples } from './useAudio.js';
import { STEP_KINDS, stepSamples } from './footstepSamples.js';
import { wantsBank } from './bankWant.js';

// Recorded pulse banks in public/audio/, made by tools/slice_engine_audio.py and tools/wav_to_flac.py. Only the ones a vehicle near
// the start uses load behind the loading screen; any other loads the first time a voice asks for it (`requestBank`).
const BANK_NAMES = ['engine-bank', 'engine-bank-2t', 'engine-bank-50', 'engine-bank-tractor', 'engine-bank-moto', 'engine-bank-atc', 'engine-bank-plover', 'engine-bank-utv', 'engine-bank-green', 'engine-bank-yellow', 'engine-bank-tor', 'engine-bank-tdi', 'engine-bank-finch', 'engine-bank-griffin', 'engine-bank-vauclair'];

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

  /**
   * Makes the audio context and loads everything (the worklet, then every recorded engine bank), behind the loading screen. A context
   * made before any click starts suspended but decodes all the same, so the game never starts silent: the click only switches it on
   * (`unlock`). `onBank(done, total)` is told as each bank arrives.
   */
  prepare(onBank = () => {}, names = BANK_NAMES) {
    if (this.ctx) return this.loading;
    this.startNames = names;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    this.ctx = new Ctx();
    // If the browser pauses the sound (it can, after a while, if it thinks nothing's playing) say so in the console and keep trying to resume it.
    this.ctx.onstatechange = () => console.warn(`Audio context ${this.ctx.state}`);
    let done = 0;
    this.loading = this.ctx.audioWorklet
      .addModule(workletUrl)
      .then(() => this.build())
      .then(() => Promise.all(names.map((name) => this.requestBank(name).then(() => onBank(++done, names.length)))))
      .catch((err) => console.error('Engine audio failed to load', err));
    return this.loading;
  }

  /** How many banks `prepare` loads, for the loading screen's count. */
  get bankCount() {
    return (this.startNames ?? BANK_NAMES).length;
  }

  /** Must be called from a user gesture: switches the sound on (making and loading it first if `prepare` hasn't). Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) this.prepare();
    // Resumed here, inside the click, since some browsers only allow it then; if the game is still paused next frame, it suspends again.
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    this.paused = false;
    return this.loading;
  }

  /** The game is paused (the start or pause card is up): every sound stops where it is, and carries on from there afterwards. */
  setPaused(on) {
    if (this.paused === on) return;
    this.paused = on;
    if (!on) this.played = true;
    if (!this.ctx) return;
    // Not before the game has begun: the click that unlocks the sound leaves the card up for a frame or two while the pointer locks, and
    // suspending then (Firefox) shuts the sound off again with no click left to switch it back on.
    if (on && this.played && this.ctx.state === 'running') this.ctx.suspend();
    else if (!on && this.ctx.state === 'suspended') this.ctx.resume();
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
    // The yard's loose tin: the same ticks put through a band that opens with the wind, only heard in the yard (`setYard`).
    const yardTin = ctx.createBufferSource();
    yardTin.buffer = tinRain(ctx, 4);
    yardTin.loop = true;
    yardTin.playbackRate.value = 0.37;
    const yardBand = ctx.createBiquadFilter();
    yardBand.type = 'bandpass';
    yardBand.frequency.value = 900;
    yardBand.Q.value = 1.4;
    this.yardGain = ctx.createGain();
    this.yardGain.gain.value = 0;
    yardTin.connect(yardBand).connect(this.yardGain).connect(this.master);
    yardTin.start();
    this.nextDrip = 0;
    // The barn's echo: every quad's sound path can send into this (propagation.js).
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = barnImpulse(ctx);
    this.reverbOut = ctx.createGain();
    this.reverb.connect(this.reverbOut).connect(this.master);
    this.glugTimer = 0;
    this.ready = true;
  }

  /** A soft two-note chime for an achievement (a fifth up, bell-like: sines with a quick attack and a slow fade). */
  chime() {
    if (!this.ready || this.params.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.02;
    [[784, 0], [1175, 0.13]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = t0 + delay;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      osc.connect(gain).connect(this.master);
      osc.start(t);
      osc.stop(t + 1.2);
    });
  }

  /**
   * The UTV's seat belt reminder: a soft, round "bong", a low note with an octave over it that rings for a moment. `at` is where it
   * sounds from, so it fades and dulls as you walk away from the UTV like its engine does; left out, it plays at full level.
   */
  beltBing(at = null) {
    if (!this.ready || this.params.muted) return;
    const ctx = this.ctx;
    const l = this.listenerPosition;
    const distance = at && l ? Math.hypot(at.x - l.x, at.y - l.y, at.z - l.z) : 0;
    const p = DEFAULT_AUDIO_PARAMS; // the same reference distance and rolloff as a vehicle's engine
    const near = distanceLevel(distance, p.refDistance, p.rolloff);
    if (near < 0.002) return;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = airCutoff(distance, this.params.airAbsorptionDistance);
    filter.connect(this.master);
    const t = ctx.currentTime + 0.02;
    [[523, 1, 0.7], [1046, 0.35, 0.35]].forEach(([freq, level, ring]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(this.params.beltBingVolume * level * near, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + ring);
      osc.connect(gain).connect(filter);
      osc.start(t);
      osc.stop(t + ring + 0.05);
    });
  }

  /**
   * One footstep on `kind` of ground (`STEP_KINDS`), `level` 0 to 1 already faded for the distance (audio/footsteps.js `stepGain`), placed at
   * `at` so a girl coming up behind you is heard from behind. Yours pass no `at` and play at the listener.
   */
  footstep(kind, level, at = null) {
    if (!this.ready || this.params.muted || level < 0.01 || !STEP_KINDS.includes(kind)) return;
    const ctx = this.ctx;
    this.stepBuffers ??= {};
    const variant = Math.floor(Math.random() * 3);
    const key = `${kind}${variant}`;
    if (!this.stepBuffers[key]) {
      const samples = stepSamples(kind, ctx.sampleRate, variant);
      this.stepBuffers[key] = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      this.stepBuffers[key].copyToChannel(samples, 0);
    }
    const src = ctx.createBufferSource();
    src.buffer = this.stepBuffers[key];
    src.playbackRate.value = 0.92 + Math.random() * 0.16;
    const gain = ctx.createGain();
    gain.gain.value = this.params.footstepVolume * level;
    src.connect(gain);
    if (at && ctx.createPanner) {
      // Placed by direction only: the level already has the distance in it.
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'linear';
      panner.rolloffFactor = 0;
      if (panner.positionX) {
        panner.positionX.value = at.x;
        panner.positionY.value = at.y ?? 0;
        panner.positionZ.value = at.z;
      } else panner.setPosition(at.x, at.y ?? 0, at.z);
      gain.connect(panner).connect(this.master);
    } else gain.connect(this.master);
    src.start(ctx.currentTime + 0.01);
  }

  /** One of the small sounds of using things (`USE_CUES`), at the listener. */
  useCue(kind) {
    if (!this.ready || this.params.muted || !USE_CUES.includes(kind)) return;
    const ctx = this.ctx;
    this.useBuffers ??= {};
    if (!this.useBuffers[kind]) {
      const samples = useSamples(kind, ctx.sampleRate);
      this.useBuffers[kind] = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      this.useBuffers[kind].copyToChannel(samples, 0);
    }
    const src = ctx.createBufferSource();
    src.buffer = this.useBuffers[kind];
    src.playbackRate.value = 0.94 + Math.random() * 0.12;
    const gain = ctx.createGain();
    gain.gain.value = this.params.useVolume;
    src.connect(gain).connect(this.master);
    src.start(ctx.currentTime + 0.01);
  }

  /**
   * The indicator relay's tick and tock: a short dry click, a little higher when the lamp comes on than when it goes off. `at` is where it
   * sounds from, so it fades as you walk away.
   */
  indicatorClick(on, at = null) {
    if (!this.ready || this.params.muted) return;
    const ctx = this.ctx;
    const l = this.listenerPosition;
    const distance = at && l ? Math.hypot(at.x - l.x, at.y - l.y, at.z - l.z) : 0;
    const near = distanceLevel(distance, DEFAULT_AUDIO_PARAMS.refDistance, DEFAULT_AUDIO_PARAMS.rolloff);
    if (near < 0.002) return;
    const t = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = on ? 1900 : 1500;
    gain.gain.setValueAtTime(this.params.indicatorVolume * near, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(4500, airCutoff(distance, this.params.airAbsorptionDistance));
    osc.connect(gain).connect(filter).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  /** Call every frame with whether fuel is being poured. */
  /** The hose spraying; `onTarget` when it's hitting something close (it patters lower). */
  setSpraying(active, onTarget = false) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.hoseGain.gain.setTargetAtTime(active ? this.params.hoseVolume * (onTarget ? 1 : 0.7) : 0, t, 0.06);
    this.hoseFilter.frequency.setTargetAtTime(onTarget ? 1800 : 3200, t, 0.1);
  }

  /** How hard it's raining, 0..1, and how far indoors you are (0..1): under the barn's tin roof it drums (see `rainHeard`). `yard` is the yard's share (`yardHeard`), with the weather's windiness (`weather.wind`, not the gusts). */
  setRain(level, indoor = 0, barnParams, yard = 0, windiness = 0, moor = null) {
    if (!this.ready) return;
    this.setYard(yard, Math.min(1, windiness / 1.5), level);
    this.setMoor(moor, Math.min(1, windiness / 1.5));
    const t = this.ctx.currentTime;
    const heard = barnParams ? rainHeard(level, indoor, barnParams) : { level, tin: 0 };
    this.rainGain.gain.setTargetAtTime(this.params.rainVolume * Math.sqrt(Math.max(0, heard.level)), t, 0.5);
    this.rainFilter.frequency.setTargetAtTime(1000 + 1400 * level, t, 0.5);
    this.tinGain.gain.setTargetAtTime(this.params.rainVolume * 2.2 * heard.tin * Math.sqrt(Math.max(0, level)), t, 0.4);
  }

  /** The Moor's bed (#821): `moor` is { level, birds } from `world.moorHeard` (null off the Moor): the wind rises on the common and the curlews and larks call, by `moorBed`. */
  setMoor(moor, wind) {
    const bed = moorBed(moor?.level ?? 0, moor?.birds ?? { curlew: 0, lark: 0 }, wind);
    this.moorWind = bed.wind;
    this.moorAudio ??= new MoorAudio(this);
    this.moorAudio.update(bed, this.params.moorVolume);
  }

  /** The river (#999): `heard` is `world.riverHeard`'s (null with no river): its babble and murmur from its nearest point, the willows and the birds by day. */
  setRiver(heard) {
    if (!this.ready) return;
    this.riverAudio ??= new RiverAudio(this);
    this.riverAudio.update(heard, this.params.riverVolume, this.params.riverBirdVolume);
  }

  /** The yard's bed: `level` (world/yardBed.js `yardHeard`), the wind and the rain 0..1. The loose tin rattles with the wind; a tap drips every so often. */
  setYard(level, wind, rain) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const bed = yardBed(level, wind, rain);
    this.yardGain.gain.setTargetAtTime(this.params.yardVolume * bed.tin, t, 0.6);
    if (t < this.nextDrip || bed.dripEvery === Infinity) return;
    this.nextDrip = t + bed.dripEvery * (0.6 + Math.random() * 0.8);
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.frequency.setValueAtTime(1500 + Math.random() * 700, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.08);
    env.gain.setValueAtTime(this.params.yardVolume * level * 0.9, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.14);
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

  /** Starts loading a bank unless it's loaded or on its way. */
  requestBank(name) {
    this.pending ??= {};
    if (!this.banks[name] && !this.pending[name]) this.pending[name] = this.loadBank(name);
    return this.pending[name];
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
    const open = 1 + p.moorWind * (this.moorWind ?? 0); // the Moor is open ground: more of it, and a higher rush
    this.windGain.gain.setTargetAtTime(p.ambientVolume * gust * open, t, 0.5);
    this.windFilter.frequency.setTargetAtTime((300 + 250 * gust) * (1 + 0.5 * (this.moorWind ?? 0)), t, 0.5);
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
    if (!bank) hub.requestBank(this.params.recBank);
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
    const l = this.hub.listenerPosition;
    const distance = l && source ? Math.hypot(source.x - l.x, source.z - l.z) : undefined;
    // A stopped vehicle far from you has no use for its bank yet (and so no voice), which keeps its download off the load.
    if (!this.node && !wantsBank(engine.state, distance)) return;
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
      events.push({ time, type: e.type, strength: e.type === 'slap' ? engine.slap : e.type === 'blow' ? engine.blow : e.strength }); // (a pop's and a spit-back's strength: without it their loudness was NaN)
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
        revsPerCycle: engine.revsPerFiring, // the synth's 'cycle' is the gap between firings
      },
      events,
    });

    this.panner.refDistance = p.refDistance;
    this.panner.rolloffFactor = p.rolloff;
    // onBoard is set by the quad's unit while you're riding it.
    this.path.update(dt, source, !!this.onBoard);
  }
}
