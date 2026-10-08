// Everything a quad sounds like besides its engine: tyres on grass, the dirt
// track, mud and puddles, the suspension knocking over bumps and thudding down
// after a jump, the racks rattling, and wind in the rider's ears.
//
// Continuous sounds are noise through native filters (cheap, no per-sample
// JavaScript): a low rolling rumble, a grass swish, gravel grit (a loop of
// random clicks played faster the faster the wheels turn) and a water wash.
// Mud is recorded squelches fired off at a rate that rises with speed. Knocks
// and rattles are synthesised once at load; splashes and thuds into dirt are
// CC0 recordings cut by tools/slice_ride_audio.py. Every quad's ride sounds go
// through the same path as its engine (propagation.js), so they pass by with
// the same Doppler shift.

import { squealLevel, slipAngle, DEFAULT_SQUEAL_PARAMS } from '../vehicle/tyreSqueal.js';
import { hornVoice } from '../npc/horns.js';
import { RideEvents, createSurfaceSampler } from './rideEvents.js';

const TWO_PI = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Shared buffers ---------------------------------------------------------------

function makeBuffer(ctx, seconds, fill) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  fill(buf.getChannelData(0), ctx.sampleRate);
  return buf;
}

function whiteNoise(d) {
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function brownNoise(d) {
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
}

/** Sparse random clicks, mostly tiny with the odd bigger stone: gravel under a tyre. */
function gritNoise(d, sr) {
  const add = (at, len, amp, tau) => {
    for (let k = 0; k < len && at + k < d.length; k++) d[at + k] += amp * (Math.random() * 2 - 1) * Math.exp(-k / tau);
  };
  let t = 0;
  while (t < d.length) {
    t += Math.floor((-Math.log(1 - Math.random()) / 260) * sr);
    const r = Math.random();
    add(t, Math.floor(0.003 * sr), 0.25 + r * r * r * 1.2, (0.0003 + Math.random() * 0.0008) * sr);
  }
  // Bigger stones crunching, duller and less often.
  t = 0;
  while (t < d.length) {
    t += Math.floor((-Math.log(1 - Math.random()) / 25) * sr);
    let lp = 0;
    const len = Math.floor(0.012 * sr);
    const amp = 0.4 + Math.random() * 0.8;
    for (let k = 0; k < len && t + k < d.length; k++) {
      lp += 0.25 * ((Math.random() * 2 - 1) - lp);
      d[t + k] += amp * lp * Math.exp(-k / (0.003 * sr));
    }
  }
  // Loop seam: fade the last few ms into the start.
  const xf = Math.floor(0.005 * sr);
  for (let k = 0; k < xf; k++) d[d.length - xf + k] *= 1 - k / xf;
}

/** A suspension knock: a low thump that drops in pitch, a dull clunk and a hint of metal. */
function knockSound(d, sr) {
  const f0 = 80 + Math.random() * 40;
  const f1 = 45 + Math.random() * 15;
  const clunkF = 350 + Math.random() * 400;
  const metalF = 1600 + Math.random() * 1400;
  let phase = 0;
  let lp = 0;
  let bp1 = 0;
  let bp2 = 0;
  const w = (TWO_PI * clunkF) / sr;
  const r = 0.985;
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    const f = f1 + (f0 - f1) * Math.exp(-t / 0.03);
    phase += (TWO_PI * f) / sr;
    const attack = Math.min(1, t / 0.0015);
    const thump = Math.sin(phase) * attack * Math.exp(-t / 0.05);
    // Clunk: noise through a two-pole resonator.
    const n = Math.random() * 2 - 1;
    const y = n * (1 - r) + 2 * r * Math.cos(w) * bp1 - r * r * bp2;
    bp2 = bp1;
    bp1 = y;
    const clunk = y * 6 * Math.exp(-t / 0.012);
    lp += 0.3 * (n - lp);
    const metal = Math.sin(TWO_PI * metalF * t) * Math.exp(-t / 0.02) * 0.06 + (n - lp) * Math.exp(-t / 0.002) * 0.15;
    d[i] = 0.8 * thump + 0.5 * clunk + metal;
  }
}

/** Racks and bodywork rattling: a handful of quick, ringing ticks. */
function rattleSound(d, sr) {
  const ticks = 3 + Math.floor(Math.random() * 4);
  let at = 0;
  for (let k = 0; k < ticks; k++) {
    const amp = (1 - k / (ticks + 1)) * (0.5 + Math.random() * 0.5);
    const fa = 1800 + Math.random() * 3200;
    const fb = fa * (1.3 + Math.random() * 0.9);
    const tau = (0.004 + Math.random() * 0.01) * sr;
    const start = Math.floor(at);
    for (let i = 0; start + i < d.length && i < tau * 6; i++) {
      const e = Math.exp(-i / tau);
      d[start + i] += amp * e * (0.6 * Math.sin((TWO_PI * fa * i) / sr) + 0.3 * Math.sin((TWO_PI * fb * i) / sr) + (i < 0.0006 * sr ? (Math.random() * 2 - 1) * 0.6 : 0));
    }
    at += (0.012 + Math.random() * 0.04) * sr;
  }
}

/** Buffers every quad shares, made once per AudioContext. */
export function rideBuffers(hub) {
  if (hub.rideBuffers) return hub.rideBuffers;
  const ctx = hub.ctx;
  const variants = (n, seconds, fill) => Array.from({ length: n }, () => makeBuffer(ctx, seconds, fill));
  const b = {
    white: makeBuffer(ctx, 2, whiteNoise),
    brown: makeBuffer(ctx, 4, brownNoise),
    grit: makeBuffer(ctx, 2, gritNoise),
    knocks: variants(6, 0.3, knockSound),
    rattles: variants(6, 0.3, rattleSound),
    recorded: null, // { buffer, clips: { squelch, splash, slosh, thud, crunch } } once loaded
  };
  hub.rideBuffers = b;
  const base = import.meta.env?.BASE_URL ?? '/';
  fetch(`${base}audio/ride.json`)
    .then((r) => r.json())
    .then(async (bank) => {
      const data = await (await fetch(base + bank.file)).arrayBuffer();
      b.recorded = { buffer: await ctx.decodeAudioData(data), clips: bank.clips };
    })
    .catch((err) => console.warn('Recorded ride sounds unavailable', err));
  return b;
}

// Per quad -------------------------------------------------------------------

/** One quad's tyre, suspension and splash sounds, fed into its engine's sound path. */
export class RideAudio {
  /**
   * @param {AudioHub} hub
   * @param {QuadUnit} unit  Supplies quad (physics, position), audio (its SoundPath) and vibration.
   * @param {object} world   For what the wheels are rolling on.
   */
  constructor(hub, unit, world) {
    this.hub = hub;
    this.unit = unit;
    this.surfaceAt = createSurfaceSampler(world);
    this.events = new RideEvents(hub.params);
    this.surface = { grass: 1, dirt: 0, mud: 0, water: 0, tarmac: 0 };
    this.contact = 0; // share of wheels on the ground
    this.wheelSurface = [0, 1, 2, 3].map(() => ({ grass: 1, dirt: 0, mud: 0, water: 0, tarmac: 0 }));
    this.squealParams = world.squealParams ?? DEFAULT_SQUEAL_PARAMS;
    this.surfaceTimer = 0;
    this.squelchTimer = 0;
    this.sloshTimer = 0;
    this.flutter = 1;
    this.lastSplash = -1;
    this.built = false;
  }

  /** Physics side, every fixed step after the quad's physics: watch the suspension. */
  step(dt) {
    const quad = this.unit.quad;
    const ph = quad.physics;
    const speed = quad.speed;
    const wheels = [];
    let contacts = 0;
    // Surfaces under each wheel, refreshed a few times a second while moving.
    this.surfaceTimer -= dt;
    const refresh = speed > 0.3 && this.surfaceTimer <= 0;
    if (refresh) this.surfaceTimer = clamp(0.5 / speed, 1 / 60, 0.1);
    const avg = { grass: 0, dirt: 0, mud: 0, water: 0, tarmac: 0 };
    for (let i = 0; i < 4; i++) {
      const contact = ph.vehicle.wheelIsInContact(i);
      if (refresh && contact) {
        const c = ph.vehicle.wheelContactPoint(i);
        if (c) this.wheelSurface[i] = this.surfaceAt(c.x, c.z);
      }
      const s = this.wheelSurface[i];
      if (contact) {
        contacts++;
        avg.grass += s.grass;
        avg.dirt += s.dirt;
        avg.mud += s.mud;
        avg.water += s.water;
        avg.tarmac += s.tarmac ?? 0;
      }
      wheels.push({ suspension: ph.vehicle.wheelSuspensionLength(i) ?? 0, contact, water: s.water });
    }
    if (contacts) for (const k in avg) this.surface[k] = avg[k] / contacts;
    this.contact = contacts / 4;
    const useJolts = !quad.rider && this.unit.vibration.params.groundGain > 0;
    this.events.step(dt, { wheels, vy: ph.body.linvel().y, speed, surface: this.surface, jolts: useJolts ? [] : null });
  }

  build() {
    const hub = this.hub;
    const path = this.unit.audio.path;
    if (!hub.ready || !path) return false;
    const ctx = hub.ctx;
    this.buffers = rideBuffers(hub);
    const b = this.buffers;
    this.out = ctx.createGain();
    this.out.connect(path.input);

    const loop = (buffer) => {
      const s = ctx.createBufferSource();
      s.buffer = buffer;
      s.loop = true;
      s.start(0, Math.random() * buffer.duration);
      return s;
    };
    const filter = (type, freq, q) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    };
    const silent = () => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.out);
      return g;
    };
    const white = loop(b.white);
    const brown = loop(b.brown);
    this.gritSource = loop(b.grit);

    // Tyres rolling: a low rumble on every surface.
    this.rollFilter = filter('lowpass', 120, 0.7);
    this.rollGain = silent();
    brown.connect(this.rollFilter).connect(this.rollGain);
    // Grass brushing the tyres and the underside.
    this.grassFilter = filter('bandpass', 2500, 0.6);
    this.grassGain = silent();
    white.connect(this.grassFilter).connect(this.grassGain);
    // Grit on the track, plus some dull crunch under it.
    this.gritFilter = filter('highpass', 700, 0.6);
    this.gritGain = silent();
    this.gritSource.connect(this.gritFilter).connect(this.gritGain);
    this.crunchFilter = filter('bandpass', 450, 0.9);
    this.crunchGain = silent();
    this.gritSource.connect(this.crunchFilter).connect(this.crunchGain);
    // Water churning round the wheels.
    this.waterFilter = filter('bandpass', 1400, 0.8);
    this.waterGain = silent();
    white.connect(this.waterFilter).connect(this.waterGain);
    this.built = true;
    return true;
  }

  /** Hold the horn down (or let go). It's built the first time it's sounded: two buzzy tones through a low-pass, switched by a gain. */
  setHorn(on) {
    if (on === !!this.hornOn && (this.hornGain || !on)) return;
    this.hornOn = on;
    if (!this.hornGain) {
      if (!on || !this.built) return;
      const ctx = this.hub.ctx;
      const v = hornVoice(this.unit.spec);
      this.hornLevel = v.level;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = v.bright;
      // A buzz: a slow-ish wobble on the level, which is most of what makes a cheap horn sound cheap.
      const buzz = ctx.createOscillator();
      buzz.frequency.value = 95;
      const depth = ctx.createGain();
      depth.gain.value = v.buzz * 0.5;
      const swing = ctx.createGain();
      swing.gain.value = 1 - v.buzz * 0.5;
      buzz.connect(depth).connect(swing.gain);
      for (const f of v.freqs) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.connect(swing);
        o.start();
      }
      buzz.start();
      swing.connect(tone).connect(gain).connect(this.out);
      this.hornGain = gain;
    }
    const g = this.hornGain.gain;
    const t = this.hub.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(on ? this.hornLevel * this.hub.params.hornVolume * 0.5 : 0, t, on ? 0.008 : 0.02);
  }

  /** A squealing brake (quirks.js): a thin, high, slightly wobbling whistle while it's braked hard enough, lower as it slows. Built when first needed. */
  updateSqueal(level, speed) {
    if (!this.squealGain) {
      if (level <= 0) return;
      const ctx = this.hub.ctx;
      const tone = ctx.createBiquadFilter();
      tone.type = 'bandpass';
      tone.frequency.value = 2600;
      tone.Q.value = 6;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      tone.connect(gain).connect(this.out);
      const oscs = [1, 1.51].map((ratio) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 1800 * ratio;
        o.connect(tone);
        o.start();
        return o;
      });
      this.squealGain = gain;
      this.squealTone = tone;
      this.squealOscs = oscs;
    }
    const now = this.hub.ctx.currentTime;
    const wobble = 1 + 0.03 * Math.sin(now * 37) + 0.02 * Math.sin(now * 91);
    this.squealOscs.forEach((o, i) => o.frequency.setTargetAtTime((1500 + 150 * speed) * (i ? 1.51 : 1) * wobble, now, 0.03));
    this.squealTone.frequency.setTargetAtTime(2000 + 150 * speed, now, 0.05);
    this.squealGain.gain.setTargetAtTime(this.hub.params.rideVolume * 0.12 * level, now, level > 0 ? 0.03 : 0.08);
  }

  /** 0..1 how hard the tyres are squealing on the tarmac (vehicle/tyreSqueal.js): sliding, braking hard or spinning up. */
  tyreSquealLevel(quad, speed, contact) {
    const tarmac = (this.surface.tarmac ?? 0) * contact;
    if (tarmac <= 0) return 0;
    const v = quad.physics.body.linvel();
    const yaw = quad.yaw;
    const forward = v.x * Math.sin(yaw) + v.z * Math.cos(yaw);
    const sideways = v.x * Math.cos(yaw) - v.z * Math.sin(yaw);
    return squealLevel(this.squealParams, { tarmac, slip: slipAngle(forward, sideways), speed, brake: quad.brake ?? 0, spin: quad.physics.traction?.spin ?? 0 });
  }

  /**
   * Tyres squealing on tarmac: a rubbery, wavering cry, noise through two resonances plus a pair of slightly detuned tones, the pitch
   * wandering as the tyre grips and lets go. Built when first needed.
   */
  updateTyreSqueal(level, speed) {
    if (!this.tyreSquealGain) {
      if (level <= 0) return;
      const ctx = this.hub.ctx;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.out);
      const noise = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      noise.buffer = buf;
      noise.loop = true;
      const bands = [950, 1900].map((f) => {
        const b = ctx.createBiquadFilter();
        b.type = 'bandpass';
        b.frequency.value = f;
        b.Q.value = 9;
        noise.connect(b).connect(gain);
        return b;
      });
      const tones = ctx.createGain();
      tones.gain.value = 0.05;
      tones.connect(gain);
      const oscs = [1, 1.012].map((ratio) => {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = 900 * ratio;
        o.connect(tones);
        o.start();
        return o;
      });
      noise.start();
      this.tyreSquealGain = gain;
      this.tyreSquealBands = bands;
      this.tyreSquealOscs = oscs;
    }
    const now = this.hub.ctx.currentTime;
    const wander = 1 + 0.06 * Math.sin(now * 23) + 0.04 * Math.sin(now * 61) + 0.03 * (Math.random() - 0.5);
    const pitch = (850 + 25 * speed) * wander;
    this.tyreSquealBands.forEach((b, i) => b.frequency.setTargetAtTime(pitch * (i ? 2.05 : 1), now, 0.02));
    this.tyreSquealOscs.forEach((o, i) => o.frequency.setTargetAtTime(pitch * (i ? 1.012 : 1), now, 0.02));
    this.tyreSquealGain.gain.setTargetAtTime(this.hub.params.rideVolume * this.hub.params.tyreSquealVolume * level, now, level > 0 ? 0.04 : 0.1);
  }

  /** Every frame, after the engine sound has updated (it owns the sound path). */
  update(dt) {
    if (!this.built && !this.build()) {
      this.events.take();
      return;
    }
    const ctx = this.hub.ctx;
    const p = this.hub.params;
    const now = ctx.currentTime;
    const quad = this.unit.quad;
    const speed = quad.speed;
    const s = this.surface;
    const on = this.contact;
    const v = clamp(speed / p.rideFullSpeed, 0, 1.6);
    const level = p.rideVolume;
    const set = (param, value, tau = 0.06) => param.setTargetAtTime(value, now, tau);

    this.updateSqueal(quad.quirks.squeal(quad.brake, Math.abs(speed)), Math.abs(speed));
    this.updateTyreSqueal(this.tyreSquealLevel(quad, speed, on), Math.abs(speed));

    // Grass catches the tyres unevenly.
    this.flutter += (0.55 + Math.random() * 0.9 - this.flutter) * Math.min(1, dt * 12);

    const surfaceRumble = s.grass * 0.55 + s.dirt + s.mud * 0.8 + s.water * 0.5 + (s.tarmac ?? 0) * 0.4;
    set(this.rollGain.gain, level * p.rollVolume * on * surfaceRumble * Math.pow(v, 1.3));
    set(this.rollFilter.frequency, 70 + 22 * speed);
    set(this.grassGain.gain, level * p.grassVolume * on * s.grass * Math.pow(v, 1.5) * this.flutter, 0.03);
    set(this.grassFilter.frequency, 1500 + 160 * speed);
    // The grit loop plays faster with speed: more stones a second, and brighter.
    this.gritSource.playbackRate.setTargetAtTime(clamp(0.3 + speed / 7, 0.3, 3.5), now, 0.08);
    set(this.gritGain.gain, level * p.dirtVolume * on * (s.dirt + 0.3 * s.mud) * Math.pow(v, 0.9));
    set(this.gritFilter.frequency, 600 + 90 * speed);
    set(this.crunchGain.gain, level * p.dirtVolume * 0.6 * on * s.dirt * Math.pow(v, 1.1));
    const churn = 0.5 + Math.random();
    set(this.waterGain.gain, level * p.waterVolume * on * s.water * Math.min(1, v * 1.5) * churn, 0.03);
    set(this.waterFilter.frequency, 1000 + 80 * speed + Math.random() * 600, 0.03);

    // Squelches through mud and sloshes through water, more of them the faster it goes.
    if (on > 0 && speed > 0.4) {
      this.squelchTimer -= dt * s.mud * (1 + speed * 0.8);
      if (this.squelchTimer <= 0) {
        this.squelchTimer = 0.3 + Math.random() * 0.7;
        this.playClip('squelch', level * p.mudVolume * on * Math.min(1, 0.35 + v) * (0.6 + Math.random() * 0.5), 0.85 + Math.random() * 0.3);
      }
      this.sloshTimer -= dt * s.water * (2 + speed * 1.5);
      if (this.sloshTimer <= 0) {
        this.sloshTimer = 0.3 + Math.random() * 0.7;
        this.playClip('slosh', level * p.splashVolume * 0.6 * Math.min(1, 0.3 + v) * (0.6 + Math.random() * 0.5), 0.8 + Math.random() * 0.3);
      }
    }

    // Ground jolts that shake a riderless quad are the bumps you hear from it.
    const vib = this.unit.vibration;
    if (!quad.rider && vib.params.groundGain > 0 && vib.jolts) {
      // It takes a jolt every metre or so; only the bigger ones are worth a knock.
      for (const k of vib.jolts) if (k * 0.6 > 0.45) this.events.push('bump', Math.min(1.2, k * 0.6));
    }

    for (const e of this.events.take()) this.play(e, p, level);
  }

  play(e, p, level) {
    const k = e.strength;
    const jitter = Math.random() * 0.012;
    switch (e.type) {
      case 'knock':
        this.playKnock(level * p.knockVolume * k, 0.9 + Math.random() * 0.25, jitter);
        if (k > p.rattleThreshold) this.playRattle(level * p.rattleVolume * k, jitter + 0.008 + Math.random() * 0.02);
        break;
      case 'bump':
        // Small ones whisper, big ones knock.
        this.playKnock(level * p.bumpVolume * Math.pow(k, 1.5), 1 + Math.random() * 0.4, jitter);
        if (Math.random() < k * p.rattleChance) this.playRattle(level * p.rattleVolume * k * 0.6, jitter + 0.01);
        if (this.surface.dirt > 0.5 && Math.random() < 0.5) this.playClip('thud', level * p.bumpVolume * 0.5 * k * this.surface.dirt, 1.2 + Math.random() * 0.4, jitter);
        break;
      case 'land': {
        // The suspension bottoming, the tyres hitting the dirt, everything on the racks jumping.
        this.playKnock(level * p.landVolume * k, 0.7 + Math.random() * 0.15, 0);
        this.playClip('thud', level * p.landVolume * 1.2 * k, 0.8 + Math.random() * 0.2, 0.005);
        if (k > 0.5) this.playClip('crunch', level * p.landVolume * 0.7 * (k - 0.3), 0.9 + Math.random() * 0.2, 0.01);
        this.playRattle(level * p.rattleVolume * Math.min(1.5, k * 1.3), 0.02 + Math.random() * 0.02);
        if (this.surface.water > 0.3) this.playClip('splash', level * p.splashVolume * k, 0.8, 0);
        break;
      }
      case 'splash': {
        // Front and back wheels hit the water a moment apart; one splash per axle.
        const now = this.hub.ctx.currentTime;
        if (now - this.lastSplash < 0.08) break;
        this.lastSplash = now;
        this.playClip('splash', level * p.splashVolume * k, 0.85 + Math.random() * 0.25, jitter);
        break;
      }
      default:
    }
  }

  playKnock(gain, rate, delay) {
    const list = this.buffers.knocks;
    this.oneShot(list[Math.floor(Math.random() * list.length)], gain, rate, delay);
  }

  playRattle(gain, delay) {
    const list = this.buffers.rattles;
    this.oneShot(list[Math.floor(Math.random() * list.length)], gain, 0.9 + Math.random() * 0.2, delay);
  }

  playClip(kind, gain, rate, delay = 0) {
    const rec = this.buffers.recorded;
    const list = rec?.clips[kind];
    if (!list?.length) return;
    const clip = list[Math.floor(Math.random() * list.length)];
    this.oneShot(rec.buffer, gain, rate, delay, clip);
  }

  oneShot(buffer, gain, rate, delay, clip = null) {
    if (gain < 0.002) return;
    const ctx = this.hub.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.out);
    const when = ctx.currentTime + this.hub.params.latency + delay;
    if (clip) src.start(when, clip.start, clip.dur);
    else src.start(when);
    src.onended = () => g.disconnect();
  }
}

// Wind for the rider --------------------------------------------------------

/**
 * Wind roaring past your ears while you ride, rising with speed. Not
 * positional, and only for the quad you're on; the AudioHub's ambient breeze
 * carries on underneath.
 */
export class RideWind {
  constructor(hub) {
    this.hub = hub;
    this.built = false;
    this.buffet = 1;
  }

  build() {
    const hub = this.hub;
    if (!hub.ready) return false;
    const ctx = hub.ctx;
    const b = rideBuffers(hub);
    const src = ctx.createBufferSource();
    src.buffer = b.brown;
    src.loop = true;
    src.start(0, Math.random() * 3);
    const hiss = ctx.createBufferSource();
    hiss.buffer = b.white;
    hiss.loop = true;
    hiss.start(0, Math.random());
    // Low buffeting roar and a higher rush past the helmet.
    this.low = ctx.createBiquadFilter();
    this.low.type = 'lowpass';
    this.low.frequency.value = 300;
    this.lowGain = ctx.createGain();
    this.lowGain.gain.value = 0;
    this.high = ctx.createBiquadFilter();
    this.high.type = 'bandpass';
    this.high.frequency.value = 1200;
    this.high.Q.value = 0.5;
    this.highGain = ctx.createGain();
    this.highGain.gain.value = 0;
    src.connect(this.low).connect(this.lowGain).connect(hub.master);
    hiss.connect(this.high).connect(this.highGain).connect(hub.master);
    this.built = true;
    return true;
  }

  /** @param {number} speed  The ridden quad's speed in m/s, 0 when walking. */
  update(dt, speed) {
    if (!this.built && !this.build()) return;
    const p = this.hub.params;
    const now = this.hub.ctx.currentTime;
    const v = clamp(speed / p.rideWindFullSpeed, 0, 1.5);
    this.buffet += (0.6 + Math.random() * 0.8 - this.buffet) * Math.min(1, dt * 6);
    const level = p.rideWindVolume * v * v;
    this.lowGain.gain.setTargetAtTime(level * this.buffet, now, 0.08);
    this.low.frequency.setTargetAtTime(150 + 45 * speed, now, 0.1);
    this.highGain.gain.setTargetAtTime(level * 0.35 * Math.pow(v, 0.5) * (0.8 + 0.4 * this.buffet), now, 0.1);
    this.high.frequency.setTargetAtTime(700 + 90 * speed, now, 0.1);
  }
}
