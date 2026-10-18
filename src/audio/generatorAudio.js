// The generator's sound: one recording (public/audio/generator.flac, CC0, a small diesel set), cut into the motor starting, a steady run
// to loop (cross-faded at its seam) and the stop. Loaded the first time you are near enough to hear it. It sits in the world at the
// generator through a panner, and goes duller and quieter with distance and when you are indoors with the barn wall between you.

export const GENERATOR_CLIP = {
  start: [0, 3.7], // cranking up to about 1.6 s, then the engine catches and picks up
  loop: [3.7, 31.7],
  stop: [31.7, 38.6],
  catchAt: 1.6, // seconds into the start where it catches
};

const HEARD_WITHIN = 120;

export class GeneratorAudio {
  constructor(hub, params = {}) {
    this.hub = hub;
    this.p = { volume: 0.9, refDistance: 3.5, ...params };
    this.buffer = null;
    this.loading = null;
    this.chain = null; // { panner, filter, gain } once built
    this.loop = null;
    this.looping = false;
  }

  async load() {
    const base = import.meta.env?.BASE_URL ?? '/';
    try {
      this.buffer = await this.hub.ctx.decodeAudioData(await (await fetch(`${base}audio/generator.flac`)).arrayBuffer());
    } catch (err) {
      console.warn('Generator sound unavailable', err);
      this.buffer = false;
    }
  }

  /** Is there anything to play with right now? Starts the load the first time it is wanted. */
  ready(at) {
    const hub = this.hub;
    if (!hub.ready || hub.paused || this.buffer === false) return false;
    const l = hub.listenerPosition;
    if (l && Math.hypot(l.x - at.x, l.y - at.y, l.z - at.z) > HEARD_WITHIN) return false;
    if (!this.buffer) {
      this.loading ??= this.load();
      return false;
    }
    return true;
  }

  build(at) {
    const ctx = this.hub.ctx;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = this.p.refDistance;
    panner.maxDistance = 300;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 9000;
    const gain = ctx.createGain();
    gain.gain.value = this.p.volume;
    filter.connect(gain).connect(panner).connect(this.hub.master);
    this.chain = { panner, filter, gain };
    this.place(at);
  }

  place(at) {
    const { panner } = this.chain;
    if (panner.positionX) {
      panner.positionX.value = at.x;
      panner.positionY.value = at.y;
      panner.positionZ.value = at.z;
    } else panner.setPosition(at.x, at.y, at.z);
  }

  /** A slice of the recording through the chain. */
  slice([from, to], { offset = 0, rate = 1, gain = 1 } = {}) {
    const ctx = this.hub.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.chain.filter);
    src.start(0, from + offset, to - from - offset);
    return { src, g };
  }

  /** A pull that didn't catch: the cranking and a cough. `dry` is quieter and shorter (nothing to burn). */
  crank(at, dry = false) {
    if (!this.ready(at)) return;
    if (!this.chain) this.build(at);
    this.slice([0, 0.2 + (dry ? 0.5 : 1.0)], { rate: dry ? 0.8 : 0.95, gain: dry ? 0.6 : 0.9 });
  }

  /** It catches: the rest of the start, then the loop takes over where it ends. */
  catch(at) {
    if (!this.ready(at)) return false;
    if (!this.chain) this.build(at);
    const ctx = this.hub.ctx;
    const offset = Math.max(0, GENERATOR_CLIP.catchAt - 0.9);
    this.slice(GENERATOR_CLIP.start, { offset });
    this.startLoop(ctx.currentTime + (GENERATOR_CLIP.start[1] - GENERATOR_CLIP.start[0] - offset));
    return true;
  }

  /** It is running but you were out of earshot (or it was still loading) when it caught: join the loop now. */
  ensureLoop(at) {
    if (this.looping || !this.ready(at)) return;
    if (!this.chain) this.build(at);
    this.startLoop();
  }

  startLoop(when = 0) {
    if (this.looping || !this.buffer) return;
    const ctx = this.hub.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    src.loopStart = GENERATOR_CLIP.loop[0];
    src.loopEnd = GENERATOR_CLIP.loop[1];
    src.connect(this.chain.filter);
    src.start(when, GENERATOR_CLIP.loop[0]);
    this.loop = src;
    this.looping = true;
  }

  /** Switched off, or out of fuel: the loop ends and the stop plays (a stall is the same, a little faster). */
  stop(at, stalled = false) {
    if (this.loop) {
      try {
        this.loop.stop();
      } catch {
        // already ended
      }
      this.loop = null;
    }
    this.looping = false;
    if (!this.ready(at)) return;
    if (!this.chain) this.build(at);
    this.slice(GENERATOR_CLIP.stop, { rate: stalled ? 1.12 : 1 });
  }

  /** Every frame while it runs, or while the start is still sounding: duller and quieter in the barn, duller with distance. */
  update(at, indoor = 0) {
    if (!this.chain) return;
    const hub = this.hub;
    const l = hub.listenerPosition;
    const d = l ? Math.hypot(l.x - at.x, l.y - at.y, l.z - at.z) : 0;
    const t = hub.ctx.currentTime;
    this.chain.filter.frequency.setTargetAtTime(Math.max(700, (9000 - d * 70) * (1 - indoor * 0.75)), t, 0.1);
    this.chain.gain.gain.setTargetAtTime(this.p.volume * (1 - indoor * 0.45) * (hub.paused ? 0 : 1), t, 0.1);
  }

  /** Dropped when the game ends or the audio is torn down. */
  dispose() {
    this.stop({ x: 0, y: 0, z: 0 });
    this.chain?.panner.disconnect();
    this.chain = null;
  }
}
