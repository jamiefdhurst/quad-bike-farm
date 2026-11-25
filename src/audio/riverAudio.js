// The river's sound, made on the spot (nothing recorded, #999): two beds of filtered noise from the nearest point of the river, a bright babble that is
// loudest over the crossing's stones and a low murmur along the deep reaches, and the willows' leaves rustling in the wind; and by day the calls of rooks,
// a pied wagtail and a moorhen. `RiverAudio` plays what `riverHeard` (world/riverBed.js) says, through a panner at the river's nearest point.

/** One rook's caw at `t`: a harsh, nasal "kaah" falling at its end. Returns when it ends. */
export function rookCaw(ctx, dest, t, volume) {
  const osc = ctx.createOscillator();
  const buzz = ctx.createOscillator();
  const depth = ctx.createGain();
  const band = ctx.createBiquadFilter();
  const env = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(560 + Math.random() * 80, t);
  osc.frequency.linearRampToValueAtTime(430, t + 0.32);
  buzz.frequency.value = 38; // the rasp
  depth.gain.value = 60;
  buzz.connect(depth).connect(osc.frequency);
  band.type = 'bandpass';
  band.frequency.value = 1100;
  band.Q.value = 1.4;
  const end = t + 0.36;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(volume, t + 0.04);
  env.gain.setValueAtTime(volume, t + 0.22);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(band).connect(env).connect(dest);
  for (const o of [osc, buzz]) { o.start(t); o.stop(end + 0.05); }
  return end;
}

/** A pied wagtail's "chis-ick" at `t`: two quick high chirps, the second dropping. */
export function wagtailCall(ctx, dest, t, volume) {
  let at = t;
  for (const [from, to, len] of [[6200, 7600, 0.05], [5600, 4300, 0.065]]) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + len);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(volume, at + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, at + len);
    osc.connect(env).connect(dest);
    osc.start(at);
    osc.stop(at + len + 0.02);
    at += len + 0.06;
  }
  return at;
}

/** A moorhen's sudden "kurruk" from the reeds at `t`: a bubbling croak, rolled by a fast flutter, dropping in pitch. */
export function moorhenCall(ctx, dest, t, volume) {
  const osc = ctx.createOscillator();
  const roll = ctx.createOscillator();
  const rollDepth = ctx.createGain();
  const env = ctx.createGain();
  const band = ctx.createBiquadFilter();
  osc.type = 'square';
  osc.frequency.setValueAtTime(820, t);
  osc.frequency.linearRampToValueAtTime(640, t + 0.26);
  roll.frequency.value = 28; // the "rr"
  rollDepth.gain.value = volume * 0.6;
  band.type = 'bandpass';
  band.frequency.value = 1300;
  band.Q.value = 2;
  const end = t + 0.3;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(volume * 0.6, t + 0.02);
  env.gain.setValueAtTime(volume * 0.6, t + 0.2);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  roll.connect(rollDepth).connect(env.gain);
  osc.connect(band).connect(env).connect(dest);
  for (const o of [osc, roll]) { o.start(t); o.stop(end + 0.05); }
  return end;
}

/** Two seconds of white noise, looped by the beds. */
function noiseBuffer(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export class RiverAudio {
  constructor(hub) {
    this.hub = hub;
    this.nodes = null;
    this.nextBird = 0;
  }

  /** The beds, made once on first use: noise into a babble band, a murmur's low-pass and the willows' high hiss, each with a slow sway, through one panner. */
  build() {
    const ctx = this.hub.ctx;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'linear';
    panner.rolloffFactor = 0; // the level is riverHeard's: the panner only says which way the water is
    panner.connect(this.hub.master);
    const bed = (type, freq, q, swayHz, swayDepth) => {
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const sway = ctx.createOscillator(); // the water's and the wind's slow come and go
      const depth = ctx.createGain();
      sway.frequency.value = swayHz;
      depth.gain.value = swayDepth;
      const level = ctx.createGain();
      level.gain.value = 1;
      sway.connect(depth).connect(level.gain);
      sway.start();
      src.connect(filter).connect(level).connect(gain).connect(panner);
      return gain;
    };
    this.nodes = {
      src,
      panner,
      babble: bed('bandpass', 2400, 0.7, 3.1, 0.35),
      murmur: bed('lowpass', 420, 0.6, 0.23, 0.25),
      willows: bed('bandpass', 4300, 0.5, 0.17, 0.6),
    };
    src.start();
  }

  /** A bird's call due now, from somewhere by the water: rooks most, then the wagtail, then the moorhen. */
  bird(t, volume) {
    const ctx = this.hub.ctx;
    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() * 2 - 1) * 0.8;
    pan.connect(this.hub.master);
    const r = Math.random();
    if (r < 0.45) {
      let at = t;
      const caws = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < caws; i++) at = rookCaw(ctx, pan, at, volume * (0.6 + Math.random() * 0.3)) + 0.25 + Math.random() * 0.3;
    } else if (r < 0.8) wagtailCall(ctx, pan, t, volume * 0.5);
    else moorhenCall(ctx, pan, t, volume * 0.8);
  }

  /** Plays `heard` (riverHeard's) at `volume` (`riverVolume`), the birds at `birdVolume`. Called every frame. */
  update(heard, volume, birdVolume) {
    const { hub } = this;
    if (!hub.ready || hub.paused) return;
    const t = hub.ctx.currentTime;
    if (!this.nodes) {
      if (!heard?.level) return; // nothing made until the river is first heard
      this.build();
    }
    const n = this.nodes;
    const level = heard?.level ? 1 : 0;
    n.babble.gain.setTargetAtTime(level * volume * (heard?.babble ?? 0), t, 0.4);
    n.murmur.gain.setTargetAtTime(level * volume * 1.6 * (heard?.murmur ?? 0), t, 0.4);
    n.willows.gain.setTargetAtTime(level * volume * 0.5 * (heard?.willows ?? 0), t, 0.6);
    if (heard?.at) {
      const y = hub.listenerPosition?.y ?? 0;
      const p = n.panner;
      if (p.positionX) {
        p.positionX.setTargetAtTime(heard.at.x, t, 0.1);
        p.positionY.setTargetAtTime(y, t, 0.1);
        p.positionZ.setTargetAtTime(heard.at.z, t, 0.1);
      } else p.setPosition(heard.at.x, y, heard.at.z);
    }
    if (!heard || heard.birdsEvery === Infinity) this.nextBird = 0;
    else if (t >= this.nextBird) {
      if (this.nextBird) this.bird(t, birdVolume * heard.level);
      this.nextBird = t + heard.birdsEvery * (0.5 + Math.random());
    }
  }
}
