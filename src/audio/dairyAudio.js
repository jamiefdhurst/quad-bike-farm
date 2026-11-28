// The neighbour's dairy yard, heard (#965), made on the spot (nothing recorded): the milking machine's pulsator ticking its "tsch-tsch" a second,
// the vacuum pump's drone, the bulk tank's compressor hum, a radio playing in the parlour, the wind worrying the barn's sheeting, and now and
// then a cow lowing, hooves on the concrete, her dog, the water trough's valve filling it and her tractor ticking over. world/dairySound.js says
// what is going and where; this makes it. A loop's nodes are built only while you are within its reach and dropped beyond it, so the yard costs
// nothing from across the lane. Each sits in the world through a panner, duller with distance, and duller still through a building's wall.

import { WildlifeAudio } from './wildlifeAudio.js';
import { DogAudio } from './dogAudio.js';
import { DAIRY_SOUNDS, DEFAULT_DAIRY_SOUND_PARAMS, keepSound, muffleFor } from '../world/dairySound.js';

const SCHEDULE_AHEAD = 0.25; // s of a loop's rhythm put on the audio clock at a time
const FADE = 0.3; // s a loop fades in and out over

const RADIO_NOTES = [392, 440, 494, 587, 659, 784]; // G major pentatonic, for the tunes it plays
const RADIO_CHORDS = [[196, 247, 294], [165, 196, 247], [147, 185, 220], [175, 220, 262]];

export class DairyAudio extends WildlifeAudio {
  constructor(hub, params = DEFAULT_DAIRY_SOUND_PARAMS) {
    super(hub, { volume: 1, refDistance: 5 });
    this.params = params;
    this.loops = {}; // name -> the loop's nodes while it is made
    this.next = {}; // name -> s until the next one-shot
    this.muffleNow = 0; // the one-shot being played's muffle, for out()
    this.levelNow = 1;
    this.played = {}; // name -> how many times, for the panel and the tests
  }

  /** How many loops are made just now (none while you are out of their reach). */
  get madeCount() {
    return Object.keys(this.loops).length;
  }

  /** A one-shot's output, as the wildlife's, quieter and duller through a wall. */
  out(x, y, z, gain) {
    const o = super.out(x, y, z, gain * this.levelNow * (1 - 0.55 * this.muffleNow));
    if (o) o.node.frequency.value = Math.min(o.node.frequency.value, 9000 - 8300 * this.muffleNow);
    return o;
  }

  /**
   * Every frame. `spots` from dairySpots (y above the yard's `ground`), `plan` from dairyPlan, `listenerIn` the building you are in (buildingAt),
   * `outside` how far you are beyond her yard's wall (outsideYard), `random` the host's stream.
   */
  update(dt, { spots, plan, listenerIn, outside = 0, ground = 0, random = Math.random }) {
    const hub = this.hub;
    const running = hub.ready && !hub.paused;
    const l = hub.listenerPosition;
    const p = this.params;
    for (const [name, spec] of Object.entries(DAIRY_SOUNDS)) {
      const at = spots[name];
      if (!at) continue;
      const d = l ? Math.hypot(l.x - at.x, l.y - (ground + at.y), l.z - at.z) : 0;
      const muffle = muffleFor(at.inside, listenerIn);
      if (spec.kind === 'loop') {
        const level = plan.loops[name] ?? 0;
        const made = !!this.loops[name];
        const want = running && level > 0 && keepSound(made, d, spec.within, outside, p);
        if (want && !made) this.build(name, at, ground, spec.ref);
        else if (!want && made) this.drop(name);
        if (this.loops[name]) this.tend(name, dt, level, muffle, d, random);
      } else {
        const every = plan.every[name] ?? Infinity;
        if (every === Infinity) {
          this.next[name] = undefined;
          continue;
        }
        if (this.next[name] === undefined) this.next[name] = every * random();
        this.next[name] -= dt;
        if (this.next[name] > 0) continue;
        this.next[name] = every * (name === 'tractor' ? 1 : 0.6 + random() * 0.8); // the tractor's idles run end to end
        if (running && keepSound(false, d, spec.within, outside, p)) this.play(name, at, ground, muffle, random);
      }
    }
  }

  /** One of the one-shots, now, from where it happens (a cow anywhere in the collecting yard). */
  play(name, at, ground, muffle, random = Math.random) {
    const p = this.params;
    this.muffleNow = muffle;
    this.levelNow = p.volume;
    const x = at.x + (at.spread ? (random() * 2 - 1) * at.spread.x : 0);
    const z = at.z + (at.spread ? (random() * 2 - 1) * at.spread.z : 0);
    const where = { x, y: ground + at.y, z };
    const made = this[name]?.(where, random);
    if (made !== false) this.played[name] = (this.played[name] ?? 0) + 1;
    return made !== false;
  }

  // The loops ---------------------------------------------------------------

  build(name, at, ground, ref = 4) {
    const ctx = this.hub.ctx;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = ref;
    panner.maxDistance = 200;
    if (panner.positionX) {
      panner.positionX.value = at.x;
      panner.positionY.value = ground + at.y;
      panner.positionZ.value = at.z;
    } else panner.setPosition(at.x, ground + at.y, at.z);
    const level = ctx.createGain();
    level.gain.value = 0;
    const dull = ctx.createBiquadFilter();
    dull.type = 'lowpass';
    dull.frequency.value = 9000;
    const input = ctx.createGain();
    input.connect(dull).connect(level).connect(panner).connect(this.hub.master);
    const loop = { input, dull, level, panner, sources: [], nextAt: ctx.currentTime + 0.05, gust: 0.5, part: 0, partLeft: 0 };
    this.loops[name] = loop;
    this[`${name}Loop`]?.(loop);
  }

  drop(name) {
    const loop = this.loops[name];
    delete this.loops[name];
    const t = this.hub.ctx.currentTime;
    loop.level.gain.setTargetAtTime(0, t, FADE / 3);
    for (const s of loop.sources) {
      try {
        s.stop(t + FADE);
      } catch {
        // already ended
      }
    }
    setTimeout(() => loop.panner.disconnect?.(), FADE * 1000 + 100);
  }

  /** Each frame a loop is made: its level, its wall and its distance, and whatever rhythm it keeps put on the clock a little ahead. */
  tend(name, dt, level, muffle, d, random) {
    const loop = this.loops[name];
    const p = this.params;
    const t = this.hub.ctx.currentTime;
    const own = { pulse: p.machineVolume, vacuum: p.machineVolume * 0.6, compressor: p.compressorVolume, radio: p.radioVolume, wind: p.windVolume }[name] ?? 1;
    loop.level.gain.setTargetAtTime(p.volume * own * level * (1 - 0.55 * muffle), t, FADE / 3);
    loop.dull.frequency.setTargetAtTime(Math.max(500, (9000 - d * 60) * (1 - 0.88 * muffle)), t, 0.1);
    const step = this[`${name}Step`];
    if (!step) return;
    if (loop.nextAt < t) loop.nextAt = t + 0.02; // back from a pause: carry on from now, not from when it stopped
    while (loop.nextAt < t + SCHEDULE_AHEAD) loop.nextAt += step.call(this, loop, loop.nextAt, random, level);
  }

  noiseSource(loop) {
    const ctx = this.hub.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    src.start();
    loop.sources.push(src);
    return src;
  }

  osc(loop, type, hz) {
    const o = this.hub.ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    o.start();
    loop.sources.push(o);
    return o;
  }

  filter(type, hz, q = 1) {
    const f = this.hub.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    f.Q.value = q;
    return f;
  }

  gain(v) {
    const g = this.hub.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  /** The pulsator: air let in and out of the clusters' liners, a sharp hiss and a click each half of its cycle, sixty cycles a minute. */
  pulseLoop(loop) {
    loop.gate = this.gain(0);
    this.noiseSource(loop).connect(this.filter('bandpass', 2600, 1.4)).connect(loop.gate).connect(loop.input);
  }

  pulseStep(loop, t) {
    const g = loop.gate.gain;
    for (const [at, v, len] of [[0, 0.9, 0.09], [0.5, 0.6, 0.12]]) {
      g.setValueAtTime(0.0001, t + at);
      g.exponentialRampToValueAtTime(v, t + at + 0.008);
      g.exponentialRampToValueAtTime(0.0001, t + at + len);
    }
    return 1;
  }

  /** The vacuum pump: a steady motor drone and the rush of air through it. */
  vacuumLoop(loop) {
    this.osc(loop, 'sawtooth', 48).connect(this.filter('lowpass', 320, 0.8)).connect(this.gain(0.5)).connect(loop.input);
    this.osc(loop, 'sine', 96).connect(this.gain(0.25)).connect(loop.input);
    this.noiseSource(loop).connect(this.filter('lowpass', 700, 0.7)).connect(this.gain(0.35)).connect(loop.input);
  }

  /** The tank's compressor: mains hum, its condenser fan's air, and a slight wobble as it labours. */
  compressorLoop(loop) {
    const hum = this.gain(0.5);
    this.osc(loop, 'triangle', 100).connect(hum).connect(loop.input);
    this.osc(loop, 'sine', 200).connect(this.gain(0.2)).connect(loop.input);
    const wobble = this.osc(loop, 'sine', 0.7);
    wobble.connect(this.gain(0.08)).connect(hum.gain);
    this.noiseSource(loop).connect(this.filter('bandpass', 900, 0.6)).connect(this.gain(0.3)).connect(loop.input);
  }

  /** The radio: through a small speaker's band, a tune over a chord a bar, then a while of talk, then music again. */
  radioLoop(loop) {
    loop.speaker = this.filter('bandpass', 1200, 0.5);
    loop.speaker.connect(loop.input);
    loop.voice = this.gain(0);
    this.noiseSource(loop).connect(this.filter('bandpass', 700, 3)).connect(loop.voice).connect(loop.speaker);
  }

  radioStep(loop, t, random) {
    if (loop.partLeft <= 0) {
      loop.part = loop.part === 'music' ? 'talk' : 'music';
      loop.partLeft = loop.part === 'music' ? 30 + random() * 30 : 8 + random() * 10;
    }
    const bar = 2;
    loop.partLeft -= bar;
    if (loop.part === 'talk') {
      // Syllables: the voice band opened and shut four or five times a second, in phrases with gaps.
      const g = loop.voice.gain;
      for (let s = 0; s < bar; s += 0.18 + random() * 0.12) {
        if (random() < 0.15) continue;
        g.setValueAtTime(0.0001, t + s);
        g.exponentialRampToValueAtTime(0.5 + random() * 0.4, t + s + 0.04);
        g.exponentialRampToValueAtTime(0.0001, t + s + 0.16);
      }
      return bar;
    }
    const chord = RADIO_CHORDS[Math.floor(random() * RADIO_CHORDS.length)];
    for (const hz of chord) this.note(loop, t, bar, hz, 'triangle', 0.12);
    for (let s = 0; s < bar; s += 0.25) if (random() < 0.7) this.note(loop, t + s, 0.22, RADIO_NOTES[Math.floor(random() * RADIO_NOTES.length)], 'square', 0.08);
    for (let s = 0; s < bar; s += 0.5) this.tick(loop, t + s);
    return bar;
  }

  note(loop, t, len, hz, type, vol) {
    const ctx = this.hub.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(loop.speaker);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  /** The drum's beat, a short tick of noise. */
  tick(loop, t) {
    const ctx = this.hub.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(g).connect(loop.speaker);
    src.start(t, Math.random() * 0.5, 0.07);
  }

  /** The wind in the sheeting: a hollow roar that swells with the gusts, and the sheets' loose corners clacking as one comes. */
  windLoop(loop) {
    loop.roar = this.gain(0.4);
    this.noiseSource(loop).connect(this.filter('bandpass', 420, 0.9)).connect(loop.roar).connect(loop.input);
    loop.rattle = this.gain(0);
    this.noiseSource(loop).connect(this.filter('bandpass', 1800, 4)).connect(loop.rattle).connect(loop.input);
  }

  windStep(loop, t, random, level) {
    const len = 0.5;
    loop.gust = Math.max(0.15, Math.min(1, loop.gust + (random() - 0.5) * 0.35));
    loop.roar.gain.linearRampToValueAtTime(0.2 + 0.6 * loop.gust, t + len);
    if (loop.gust * level > 0.55 && random() < 0.6) {
      const g = loop.rattle.gain;
      for (let i = 0, s = random() * 0.2; i < 3 && s < len; i++, s += 0.06 + random() * 0.1) {
        g.setValueAtTime(0.0001, t + s);
        g.exponentialRampToValueAtTime(0.7, t + s + 0.005);
        g.exponentialRampToValueAtTime(0.0001, t + s + 0.05);
      }
    }
    return len;
  }

  // The one-shots ------------------------------------------------------------

  /** A cow lowing: a long low buzzy note that rises and falls, through two mouth bands, with a wobble. */
  moo({ x, y, z }, random = Math.random) {
    const o = this.out(x, y, z, 0.6);
    if (!o) return false;
    const { ctx, node } = o;
    const t = ctx.currentTime;
    const len = 1.2 + random() * 0.8;
    const base = 95 + random() * 40;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * 0.9, t);
    osc.frequency.linearRampToValueAtTime(base * 1.3, t + len * 0.35);
    osc.frequency.linearRampToValueAtTime(base, t + len);
    const sum = ctx.createGain();
    for (const [f, q, v] of [[380, 3, 1], [950, 4, 0.45]]) {
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.setValueAtTime(f * 0.8, t);
      band.frequency.linearRampToValueAtTime(f * 1.1, t + len * 0.4); // the mouth opening
      band.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = v;
      osc.connect(band).connect(g).connect(sum);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.25);
    env.gain.setValueAtTime(1, t + len - 0.4);
    env.gain.exponentialRampToValueAtTime(0.0001, t + len);
    sum.connect(env).connect(node);
    osc.start(t);
    osc.stop(t + len + 0.05);
    return true;
  }

  /** A cow or two shifting on the concrete: a few dull knocks of hoof, each a thud with a scrape of grit. */
  hooves({ x, y, z }, random = Math.random) {
    const o = this.out(x, y, z, 0.5);
    if (!o) return false;
    const { ctx, node } = o;
    const n = 2 + Math.floor(random() * 3);
    for (let i = 0, s = 0; i < n; i++, s += 0.18 + random() * 0.3) {
      const t = ctx.currentTime + s;
      const thud = ctx.createOscillator();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(160 + random() * 40, t);
      thud.frequency.exponentialRampToValueAtTime(70, t + 0.06);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0.7, t);
      tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      thud.connect(tg).connect(node);
      thud.start(t);
      thud.stop(t + 0.1);
      const grit = ctx.createBufferSource();
      grit.buffer = this.noiseBuffer(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1100 + random() * 600;
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(0.35, t);
      gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      grit.connect(bp).connect(gg).connect(node);
      grit.start(t, random() * 0.5, 0.09);
    }
    return true;
  }

  /** Her dog at its kennel: the farm dog's bark (audio/dogAudio.js), sometimes twice. */
  bark(at, random = Math.random) {
    DogAudio.prototype.bark.call(this, at, random() < 0.3);
    return true;
  }

  /** The trough's ball valve letting water in: a rushing hiss that settles to a trickle and stops. */
  trough({ x, y, z }, random = Math.random) {
    const o = this.out(x, y, z, 0.5);
    if (!o) return false;
    const { ctx, node } = o;
    const t = ctx.currentTime;
    const len = 4 + random() * 4;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2200, t);
    bp.frequency.linearRampToValueAtTime(1300, t + len); // the note falls as the trough fills
    bp.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.15);
    g.gain.linearRampToValueAtTime(0.3, t + len * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const gurgle = ctx.createOscillator();
    gurgle.frequency.value = 7 + random() * 4;
    const depth = ctx.createGain();
    depth.gain.value = 0.12;
    gurgle.connect(depth).connect(g.gain);
    src.connect(bp).connect(g).connect(node);
    src.start(t);
    gurgle.start(t);
    src.stop(t + len + 0.05);
    gurgle.stop(t + len + 0.05);
    return true;
  }

  /** Her tractor ticking over: a four-cylinder diesel's idle, a low knock at 25 firings a second and its clatter, for a few seconds. */
  tractor({ x, y, z }, random = Math.random) {
    const o = this.out(x, y, z, 0.55);
    if (!o) return false;
    const { ctx, node } = o;
    const t = ctx.currentTime;
    const len = 9.5; // a little over the plan's 9 s between, so one runs into the next while she works
    const rate = 24 + random() * 2;
    const knock = ctx.createOscillator();
    knock.type = 'sawtooth';
    knock.frequency.value = rate;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const clatter = ctx.createBufferSource();
    clatter.buffer = this.noiseBuffer(ctx);
    clatter.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    const chop = ctx.createGain();
    chop.gain.value = 0.15;
    const firing = ctx.createOscillator();
    firing.type = 'square';
    firing.frequency.value = rate;
    const depth = ctx.createGain();
    depth.gain.value = 0.15;
    firing.connect(depth).connect(chop.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(1, t + 0.4);
    env.gain.setValueAtTime(1, t + len - 0.5);
    env.gain.linearRampToValueAtTime(0.0001, t + len);
    knock.connect(lp).connect(env);
    clatter.connect(bp).connect(chop).connect(env);
    env.connect(node);
    for (const s of [knock, clatter, firing]) {
      s.start(t);
      s.stop(t + len + 0.05);
    }
    return true;
  }

  /** Every loop dropped: the game ending or the audio torn down. */
  dispose() {
    for (const name of Object.keys(this.loops)) this.drop(name);
  }
}
