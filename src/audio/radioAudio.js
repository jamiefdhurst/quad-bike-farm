// The sound of the radios. Each radio that is on gets a chain of its own (built when it first makes a sound, dropped when it has been
// silent a while): the station it is tuned to (radioStation.js: recorded songs and talk shuffled into a programme on the audio clock,
// loaded by radioLibrary.js) mixed with hiss and crackle that grow as the station drifts off, then through the set's speaker (its
// band, its bass, how much it overloads, a cassette's warble) and out at the level where the listener is. Changing station is a burst
// of static. Two radios on one station play the same thing at the same moment.

import { Programme, stationById, STATION_PARAMS } from './radioStation.js';
import { RadioLibrary, idsInUse } from './radioLibrary.js';
import { heardAt } from '../vehicle/radio.js';

const LOOKAHEAD = 0.7; // seconds ahead that the next item is scheduled
const PREFETCH = 30; // seconds ahead that the next item starts loading
const DROP_AFTER = 1.5; // seconds silent before a chain is taken down
const EVICT_EVERY = 2; // seconds between letting go of audio that is no longer wanted

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

/** A soft-clipping curve: `amount` 0 leaves it clean, 1 is a cheap speaker overloading. Pure. */
export function distortionCurve(amount, n = 1024) {
  const k = 1 + amount * 14;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    out[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return out;
}

export class RadioAudio {
  constructor(hub, params = {}) {
    this.hub = hub;
    this.p = { volume: 0.5, crackleRate: 9, ...params };
    this.chains = new Map(); // key -> chain
    this.library = new RadioLibrary(hub);
    this.programmes = new Map(); // station id -> Programme, shared by every radio tuned to it
    this.evictIn = 0;
  }

  /** Is there a sound to make at all right now? */
  get live() {
    return !!(this.hub.ready && !this.hub.paused && !this.hub.params?.muted);
  }

  /** The programme of a station, made when first wanted and given its songs and talk as they load or are added. */
  programmeFor(id, now) {
    let prog = this.programmes.get(id);
    if (!prog) {
      prog = new Programme(stationById(id), this.library.library(id), STATION_PARAMS);
      prog.revision = this.library.revision;
      this.programmes.set(id, prog);
    } else if (prog.revision !== this.library.revision) {
      prog.setLibrary(this.library.library(id), now);
      prog.revision = this.library.revision;
    }
    return prog;
  }

  /** What is on a station now: { kind, title, left } or null (for the debug panel). */
  nowPlaying(id) {
    const now = this.hub.ctx?.currentTime;
    const prog = this.programmes.get(id);
    if (now === undefined || !prog) return null;
    const slot = prog.at(now);
    return { kind: slot.kind, title: slot.item?.title ?? slot.item?.id ?? '', left: Math.max(0, slot.end - now) };
  }

  /** Adds songs picked in the game to a station (resolves to how many could be played). */
  addMusic(stationId, files) {
    this.library.ensure();
    return this.library.addLocal(stationId, files);
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
    let tail = speaker;
    if (prof.distort > 0) {
      const shaper = ctx.createWaveShaper(); // a small speaker overloading
      shaper.curve = distortionCurve(prof.distort);
      shaper.oversample = '2x';
      tail = tail.connect(shaper);
    }
    tail.connect(hp).connect(shelf).connect(lp).connect(dull).connect(out).connect(this.hub.master);

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

    const chain = {
      key, out, dull, programme, hiss, hissFilter, speaker, hissSrc, warble,
      station: radio.station, bus: null, sources: new Set(), started: new Set(), silentFor: 0, popDebt: 0,
    };
    this.newBus(chain);
    this.chains.set(key, chain);
    this.library.ensure();
    return chain;
  }

  /** A fresh mixing point for what is playing, so that the old one can be faded out on its own. */
  newBus(chain) {
    chain.bus = this.hub.ctx.createGain();
    chain.bus.connect(chain.programme);
  }

  /** Tunes the chain to another station: what was playing stops and the new programme starts from wherever it has got to. */
  retune(chain, station) {
    const ctx = this.hub.ctx;
    const old = chain.bus;
    const sources = chain.sources;
    old.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    setTimeout(() => {
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          // already stopped
        }
      }
      old.disconnect();
    }, 150);
    chain.sources = new Set();
    chain.started = new Set();
    chain.station = station;
    this.newBus(chain);
  }

  drop(key) {
    const c = this.chains.get(key);
    if (!c) return;
    try {
      c.hissSrc.stop();
      c.warble?.lfo.stop();
      for (const s of c.sources) s.stop();
    } catch {
      // already stopped
    }
    c.out.disconnect();
    this.chains.delete(key);
  }

  /** Starts the items of the chain's station that are due (and any that began a moment ago), and starts loading the ones coming up. */
  schedule(chain) {
    const ctx = this.hub.ctx;
    const now = ctx.currentTime;
    const prog = this.programmeFor(chain.station, now);
    for (const slot of prog.between(now, now + PREFETCH)) {
      if (!slot.item || chain.started.has(slot.start)) continue;
      const buf = this.library.buffer(slot.item); // starts loading it if it isn't
      if (!buf || slot.start > now + LOOKAHEAD) continue;
      const offset = Math.max(0, now - slot.start);
      chain.started.add(slot.start);
      if (offset >= buf.duration - 0.05) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      if (chain.warble) chain.warble.connect(src.detune);
      src.connect(chain.bus);
      src.start(now + Math.max(0, slot.start - now), offset);
      chain.sources.add(src);
      src.onended = () => {
        chain.sources.delete(src);
        try {
          chain.warble?.disconnect(src.detune);
        } catch {
          // not connected
        }
      };
    }
    for (const t of chain.started) if (t < now - 600) chain.started.delete(t);
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
      if (chain.station !== radio.station) this.retune(chain, radio.station);
      const t = ctx.currentTime;
      const signal = radio.signal;
      const prof = radio.profile;
      // changing station: the programme drops out under a burst of static that dies away
      const between = P.retuneSeconds > 0 ? Math.max(0, 1 - radio.sinceRetune / P.retuneSeconds) : 0;
      chain.out.gain.setTargetAtTime(gain * this.p.volume, t, 0.06);
      chain.dull.frequency.setTargetAtTime(18000 - dull * 16500, t, 0.1);
      // a weak station is thin in the noise: the voice drops, the hiss comes up
      chain.programme.gain.setTargetAtTime((0.25 + 0.75 * signal * signal) * (1 - 0.9 * between), t, between > 0 ? 0.02 : 0.15);
      chain.hiss.gain.setTargetAtTime(prof.hiss * (0.012 + 0.16 * (1 - signal)) + 0.35 * between, t, between > 0 ? 0.02 : 0.15);
      chain.hissFilter.frequency.setTargetAtTime(2200 + 2500 * between * Math.sin(radio.sinceRetune * 40), t, 0.03);
      // pops and spits: more in static, and the ignition's tick rising with the revs
      chain.popDebt += dt * this.p.crackleRate * (prof.crackle * (0.3 + 2.2 * (1 - signal)) + prof.whine * radio.rev * 3);
      while (chain.popDebt >= 1) {
        chain.popDebt -= 1;
        this.pop(chain, 0.04 + 0.2 * prof.crackle + 0.1 * prof.whine * radio.rev);
      }
      this.schedule(chain);
    }
    this.evictIn -= dt;
    if (this.evictIn <= 0 && ctx) {
      this.evictIn = EVICT_EVERY;
      const now = ctx.currentTime;
      const keep = new Set();
      for (const c of this.chains.values()) for (const id of idsInUse(this.programmeFor(c.station, now).between(now - 1, now + PREFETCH))) keep.add(id);
      this.library.evict(keep);
    }
  }

  dispose() {
    for (const key of [...this.chains.keys()]) this.drop(key);
  }
}
