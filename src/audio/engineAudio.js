// Procedural engine sound with Web Audio. No audio files: every exhaust pulse
// from the engine model is played as a short synthesised thump, scheduled at
// the pulse's own time, so pitch and pulse rate follow rpm and a rough engine
// sounds lumpy for the same reason it shakes. Starter whine, stall cough and a
// light wind bed are synthesised too.

import { DEFAULT_AUDIO_PARAMS } from './audioParams.js';

const TYPE_GAIN = { fire: 1, sputter: 0.6, compression: 0.22, misfire: 0.05 };

function makeThump(ctx) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 0.3);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let phase = 0;
  let peak = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = (1 - Math.exp(-t / 0.0012)) * Math.exp(-t / 0.05);
    const f = 62 + 110 * Math.exp(-t / 0.018); // pitch drops through the pulse
    phase += (2 * Math.PI * f) / sr;
    const tone = Math.sin(phase) + 0.45 * Math.sin(2 * phase + 0.6) + 0.2 * Math.sin(3 * phase + 1.1);
    const crack = (Math.random() * 2 - 1) * Math.exp(-t / 0.008);
    d[i] = env * tone * 0.8 + crack * 0.55;
    peak = Math.max(peak, Math.abs(d[i]));
  }
  for (let i = 0; i < len; i++) d[i] /= peak;
  return buf;
}

function makeNoise(ctx, seconds = 2, brown = false) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else {
      d[i] = w;
    }
  }
  return buf;
}

function shaperCurve(drive) {
  const n = 1024;
  const curve = new Float32Array(n);
  const norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / norm;
  }
  return curve;
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
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.build();
    this.ready = true;
  }

  build() {
    const ctx = this.ctx;
    const p = this.params;
    this.thump = makeThump(ctx);
    this.noise = makeNoise(ctx, 2);
    this.brown = makeNoise(ctx, 4, true);

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

    // Exhaust chain.
    this.exhaustBus = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = shaperCurve(p.drive);
    this.shaperDrive = p.drive;
    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.Q.value = 0.8;
    this.lowpass.frequency.value = p.filterBase;
    this.exhaustBus.connect(this.shaper).connect(this.lowpass).connect(this.panner);

    // Mechanical clatter and intake roar: looped noise through band-passes.
    const loop = (buffer, type, freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain);
      src.start();
      return { src, filter, gain };
    };
    this.mech = loop(this.noise, 'bandpass', 1500, 1.2);
    this.mech.gain.connect(this.panner);
    this.intake = loop(this.noise, 'bandpass', 400, 0.9);
    this.intake.gain.connect(this.panner);

    // Starter motor: two detuned oscillators plus gear noise.
    this.starterGain = ctx.createGain();
    this.starterGain.gain.value = 0;
    const starterFilter = ctx.createBiquadFilter();
    starterFilter.type = 'bandpass';
    starterFilter.frequency.value = 900;
    starterFilter.Q.value = 0.7;
    this.starterGain.connect(starterFilter).connect(this.panner);
    this.starterOscA = ctx.createOscillator();
    this.starterOscA.type = 'sawtooth';
    this.starterOscB = ctx.createOscillator();
    this.starterOscB.type = 'square';
    const bGain = ctx.createGain();
    bGain.gain.value = 0.35;
    this.starterOscA.connect(this.starterGain);
    this.starterOscB.connect(bGain).connect(this.starterGain);
    this.starterOscA.start();
    this.starterOscB.start();
    this.starterGrind = loop(this.noise, 'bandpass', 2500, 2);
    this.starterGrind.gain.connect(this.starterGain);
    this.starterGrind.gain.gain.value = 0.4;

    // Ambient wind, not positional.
    this.wind = loop(this.brown, 'lowpass', 500, 0.5);
    this.wind.gain.connect(this.master);
    this.windPhase = Math.random() * 10;

    this.nextFrameTime = 0;
    this.wasCranking = false;
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

    this.master.gain.setTargetAtTime(p.muted ? 0 : p.masterVolume, now, 0.05);
    this.panner.refDistance = p.refDistance;
    this.panner.rolloffFactor = p.rolloff;
    if (p.drive !== this.shaperDrive) {
      this.shaper.curve = shaperCurve(p.drive);
      this.shaperDrive = p.drive;
    }
    this.updatePositions(source, listener);

    // Keep a running schedule so pulse spacing survives frame jitter.
    if (this.nextFrameTime < now || this.nextFrameTime > now + 0.25) this.nextFrameTime = now + p.latency;
    const frameStart = this.nextFrameTime;
    this.nextFrameTime += dt;

    const rpm = engine.rpm;
    const throttle = engine.throttle;
    for (const pulse of engine.pulses) this.playPulse(frameStart + pulse.t, pulse, engine);
    for (const e of engine.events) this.playEvent(frameStart + e.t, e);

    const running = engine.isRunning;
    const cutoff = p.filterBase + p.filterRpm * rpm + p.filterThrottle * throttle;
    this.lowpass.frequency.setTargetAtTime(Math.min(cutoff, 12000), now, 0.03);

    const rpmNorm = Math.min(1, rpm / engine.params.maxRpm);
    this.mech.filter.frequency.setTargetAtTime(900 + rpm * 0.5, now, 0.05);
    this.mech.gain.gain.setTargetAtTime(running ? p.mechVolume * (0.25 + rpmNorm) : 0, now, 0.05);
    this.intake.filter.frequency.setTargetAtTime(250 + rpm * 0.08, now, 0.05);
    this.intake.gain.gain.setTargetAtTime(running ? p.intakeVolume * throttle * (0.3 + rpmNorm) : 0, now, 0.06);

    this.updateStarter(engine, now);

    // Wind gusts slowly.
    this.windPhase += dt;
    const gust = 0.7 + 0.3 * Math.sin(this.windPhase * 0.23) * Math.sin(this.windPhase * 0.071 + 1);
    this.wind.gain.gain.setTargetAtTime(p.ambientVolume * gust, now, 0.5);
    this.wind.filter.frequency.setTargetAtTime(300 + 250 * gust, now, 0.5);
  }

  playPulse(t, pulse, engine) {
    const ctx = this.ctx;
    const p = this.params;
    const rough = engine.roughness;
    const rpm = Math.max(engine.rpm, 250);
    const src = ctx.createBufferSource();
    src.buffer = this.thump;
    const jitter = 1 + (Math.random() - 0.5) * p.pitchJitter * rough;
    const typeRate = pulse.type === 'compression' ? 0.7 : 1;
    src.playbackRate.value = (p.pitchBase + p.pitchRpmScale * (rpm / 1000)) * jitter * typeRate;

    const loud = 1 + p.throttleLoudness * engine.throttle;
    const vary = 1 + (Math.random() - 0.5) * p.volumeJitter * rough;
    const amp = p.pulseVolume * (TYPE_GAIN[pulse.type] ?? 1) * pulse.strength * loud * vary;
    const tau = Math.min(p.maxDecay, (p.decayFraction * 120) / rpm);

    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.setTargetAtTime(0, t + 0.004, tau);
    src.connect(g).connect(this.exhaustBus);
    src.start(t);
    src.stop(t + 0.004 + tau * 6);

    // Each compression stroke loads the starter, giving the "rur-rur" rhythm.
    if (engine.state === 'cranking') {
      const f = this.starterFreq(engine);
      for (const osc of [this.starterOscA, this.starterOscB]) {
        osc.frequency.setValueAtTime(f * 0.72, t);
        osc.frequency.linearRampToValueAtTime(f, t + 0.14);
      }
    }
  }

  playEvent(t, e) {
    const ctx = this.ctx;
    const p = this.params;
    if (e.type === 'stalled') {
      // A couple of uneven coughs and a breathy puff.
      const coughs = [
        [0, 0.9, 0.85],
        [0.1 + Math.random() * 0.06, 0.55, 0.7],
        [0.27 + Math.random() * 0.08, 0.3, 0.6],
      ];
      for (const [dt, gain, rate] of coughs) {
        const src = ctx.createBufferSource();
        src.buffer = this.thump;
        src.playbackRate.value = rate;
        const g = ctx.createGain();
        g.gain.setValueAtTime(p.coughVolume * gain, t + dt);
        g.gain.setTargetAtTime(0, t + dt + 0.01, 0.07);
        src.connect(g).connect(this.exhaustBus);
        src.start(t + dt);
        src.stop(t + dt + 0.5);
      }
      const puff = ctx.createBufferSource();
      puff.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 450;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(p.coughVolume * 0.35, t + 0.05);
      g.gain.setTargetAtTime(0, t + 0.08, 0.12);
      puff.connect(f).connect(g).connect(this.panner);
      puff.start(t);
      puff.stop(t + 0.8);
    } else if (e.type === 'ignitionOn' || e.type === 'ignitionOff') {
      // Relay click, and a short fuel pump whirr when switching on.
      const click = ctx.createBufferSource();
      click.buffer = this.noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.25, t);
      g.gain.setTargetAtTime(0, t + 0.002, 0.006);
      click.connect(hp).connect(g).connect(this.panner);
      click.start(t);
      click.stop(t + 0.1);
      if (e.type === 'ignitionOn') {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 1400;
        const pg = ctx.createGain();
        pg.gain.setValueAtTime(0, t);
        pg.gain.linearRampToValueAtTime(0.02, t + 0.05);
        pg.gain.setValueAtTime(0.02, t + 0.7);
        pg.gain.linearRampToValueAtTime(0, t + 0.9);
        osc.connect(pg).connect(this.panner);
        osc.start(t);
        osc.stop(t + 1);
      }
    }
  }

  starterFreq(engine) {
    return this.params.starterBaseHz + this.params.starterRpmHz * engine.rpm;
  }

  updateStarter(engine, now) {
    const cranking = engine.state === 'cranking';
    const target = cranking ? this.params.starterVolume : 0;
    this.starterGain.gain.setTargetAtTime(target, now, cranking ? 0.02 : 0.04);
    if (cranking && !this.wasCranking) {
      const f = this.starterFreq(engine);
      this.starterOscA.frequency.setValueAtTime(f * 0.5, now);
      this.starterOscA.frequency.linearRampToValueAtTime(f, now + 0.15);
      this.starterOscB.frequency.setValueAtTime(f * 0.5 * 1.01, now);
    }
    this.wasCranking = cranking;
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
