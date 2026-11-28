// Hollow Wood's sound, made on the spot (nothing recorded, #980): beds of filtered noise for the wind in the canopy and the autumn leaves under you, and
// calls between them: a wren's loud trill, a chiffchaff's two notes, a wood pigeon's coo and a woodpecker's drum by day, a drip and frogs from the pond,
// and a tawny owl from dusk. `WoodsAudio` plays what `woodsHeard` (world/woodsBed.js) says, all through the hub's master, so the master volume and
// `muted` hold for it.

/** One wren's song at `t`: a loud run of fast high notes with a trill in it, about two seconds. */
export function wrenSong(ctx, dest, t, volume) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  let at = t;
  const notes = 14 + Math.floor(Math.random() * 8);
  for (let i = 0; i < notes; i++) {
    const trill = i > notes * 0.45 && i < notes * 0.75; // the rattle in the middle
    osc.frequency.setValueAtTime(trill ? 4200 + (i % 2) * 900 : 3800 + Math.random() * 2600, at);
    at += trill ? 0.035 : 0.075 + Math.random() * 0.04;
  }
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(volume, t + 0.05);
  env.gain.setValueAtTime(volume, at - 0.1);
  env.gain.linearRampToValueAtTime(0.0001, at);
  osc.connect(env).connect(dest);
  osc.start(t);
  osc.stop(at + 0.05);
  return at;
}

/** A chiffchaff at `t`: "chiff chaff chiff chaff", two notes a few tones apart, over and over. */
export function chiffchaffSong(ctx, dest, t, volume) {
  let at = t;
  const notes = 6 + Math.floor(Math.random() * 6);
  for (let i = 0; i < notes; i++) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const f = (i + (Math.random() < 0.2 ? 1 : 0)) % 2 ? 4300 : 5300; // now and then two the same, as the bird does
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f + 300, at);
    osc.frequency.exponentialRampToValueAtTime(f - 400, at + 0.09);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(volume, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    osc.connect(env).connect(dest);
    osc.start(at);
    osc.stop(at + 0.12);
    at += 0.38 + Math.random() * 0.08;
  }
  return at;
}

/** A wood pigeon at `t`: the low, breathy "coo-COO-coo, coo-coo". */
export function pigeonCoo(ctx, dest, t, volume) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const soft = ctx.createBiquadFilter();
  osc.type = 'triangle';
  soft.type = 'lowpass';
  soft.frequency.value = 900;
  osc.frequency.setValueAtTime(420, t);
  env.gain.setValueAtTime(0.0001, t);
  let at = t;
  for (const [len, loud] of [[0.35, 0.6], [0.55, 1], [0.3, 0.6], [0.3, 0.7], [0.3, 0.6]]) {
    osc.frequency.setValueAtTime(430, at);
    osc.frequency.linearRampToValueAtTime(390, at + len);
    env.gain.linearRampToValueAtTime(volume * loud, at + 0.07);
    env.gain.setValueAtTime(volume * loud, at + len - 0.1);
    env.gain.linearRampToValueAtTime(0.0001, at + len);
    at += len + 0.12;
  }
  osc.connect(soft).connect(env).connect(dest);
  osc.start(t);
  osc.stop(at + 0.05);
  return at;
}

/** A great spotted woodpecker's drum at `t`: a second of knocks on a dead branch, quickening and dying away. */
export function woodpeckerDrum(ctx, dest, t, volume) {
  let at = t;
  for (let i = 0; i < 16; i++) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(950, at);
    osc.frequency.exponentialRampToValueAtTime(500, at + 0.02);
    const loud = volume * (1 - i / 22);
    env.gain.setValueAtTime(loud, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.025);
    osc.connect(env).connect(dest);
    osc.start(at);
    osc.stop(at + 0.03);
    at += 0.055 - i * 0.0012;
  }
  return at;
}

/** A tawny owl at `t`: the male's long "hoo", a pause, a short "hu", then the wavering "hoo-oo-oo-oo"; now and then the female's sharp "ke-wick" instead. */
export function owlCall(ctx, dest, t, volume) {
  if (Math.random() < 0.3) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1500, t);
    osc.frequency.linearRampToValueAtTime(1900, t + 0.12);
    osc.frequency.linearRampToValueAtTime(1300, t + 0.4);
    const soft = ctx.createBiquadFilter();
    soft.type = 'bandpass';
    soft.frequency.value = 1700;
    soft.Q.value = 2;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(volume * 0.8, t + 0.03);
    env.gain.setValueAtTime(volume * 0.8, t + 0.12);
    env.gain.linearRampToValueAtTime(volume * 0.2, t + 0.18);
    env.gain.linearRampToValueAtTime(volume * 0.7, t + 0.24);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    osc.connect(soft).connect(env).connect(dest);
    osc.start(t);
    osc.stop(t + 0.45);
    return t + 0.42;
  }
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const wave = ctx.createOscillator();
  const waveDepth = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(390, t);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(volume, t + 0.15); // the first long "hoo"
  osc.frequency.linearRampToValueAtTime(420, t + 0.5);
  env.gain.linearRampToValueAtTime(0.0001, t + 0.9);
  const hu = t + 3.2; // the pause, then the short "hu"
  osc.frequency.setValueAtTime(400, hu);
  env.gain.setValueAtTime(0.0001, hu);
  env.gain.linearRampToValueAtTime(volume * 0.6, hu + 0.05);
  env.gain.linearRampToValueAtTime(0.0001, hu + 0.25);
  const long = hu + 0.55; // and the wavering last one
  osc.frequency.setValueAtTime(420, long);
  osc.frequency.linearRampToValueAtTime(380, long + 1.8);
  env.gain.setValueAtTime(0.0001, long);
  env.gain.linearRampToValueAtTime(volume, long + 0.1);
  env.gain.setValueAtTime(volume, long + 1.4);
  env.gain.linearRampToValueAtTime(0.0001, long + 1.9);
  wave.frequency.value = 7; // the quaver in it
  waveDepth.gain.value = 18;
  wave.connect(waveDepth).connect(osc.frequency);
  osc.connect(env).connect(dest);
  const end = long + 1.95;
  for (const o of [osc, wave]) { o.start(t); o.stop(end + 0.05); }
  return end;
}

/** A drop into the pond at `t`: a quick falling plink. */
export function pondDrip(ctx, dest, t, volume) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.frequency.setValueAtTime(1300 + Math.random() * 900, t);
  osc.frequency.exponentialRampToValueAtTime(600, t + 0.07);
  env.gain.setValueAtTime(volume, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  osc.connect(env).connect(dest);
  osc.start(t);
  osc.stop(t + 0.12);
  return t + 0.1;
}

/** A common frog at `t`: a low, soft purring croak or two, rolled by a quick flutter. */
export function frogCroak(ctx, dest, t, volume) {
  let at = t;
  const croaks = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < croaks; i++) {
    const osc = ctx.createOscillator();
    const roll = ctx.createOscillator();
    const rollDepth = ctx.createGain();
    const env = ctx.createGain();
    const band = ctx.createBiquadFilter();
    osc.type = 'square';
    osc.frequency.setValueAtTime(260 + Math.random() * 60, at);
    roll.frequency.value = 22;
    rollDepth.gain.value = volume * 0.7;
    band.type = 'bandpass';
    band.frequency.value = 520;
    band.Q.value = 3;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(volume * 0.7, at + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
    roll.connect(rollDepth).connect(env.gain);
    osc.connect(band).connect(env).connect(dest);
    for (const o of [osc, roll]) { o.start(at); o.stop(at + 0.45); }
    at += 0.5 + Math.random() * 0.3;
  }
  return at;
}

/** Two seconds of white noise, looped by the beds. */
function noiseBuffer(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export class WoodsAudio {
  constructor(hub) {
    this.hub = hub;
    this.nodes = null;
    this.next = { bird: 0, drip: 0, frog: 0, owl: 0 };
  }

  /** The beds, made once on first use: noise into the canopy's low roar and its leaves' hiss, each swaying, and the litter's crackle under you. */
  build() {
    const ctx = this.hub.ctx;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    const bed = (type, freq, q, swayHz, swayDepth) => {
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const sway = ctx.createOscillator(); // the gusts through the trees, the scuff of the wheels
      const depth = ctx.createGain();
      sway.frequency.value = swayHz;
      depth.gain.value = swayDepth;
      const swaying = ctx.createGain();
      swaying.gain.value = 1;
      sway.connect(depth).connect(swaying.gain);
      sway.start();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(swaying).connect(gain).connect(this.hub.master);
      return gain;
    };
    // The pond's drips and frogs come from its side: a panner there, the level woodsHeard's.
    const pondPan = ctx.createPanner();
    pondPan.panningModel = 'equalpower';
    pondPan.distanceModel = 'linear';
    pondPan.rolloffFactor = 0;
    pondPan.connect(this.hub.master);
    this.nodes = {
      src,
      roar: bed('lowpass', 650, 0.5, 0.11, 0.55),
      rustle: bed('bandpass', 2600, 0.6, 0.19, 0.6),
      leaves: bed('bandpass', 3800, 0.9, 7.5, 0.7),
      pondPan,
    };
    src.start();
  }

  /** The panned, softened output for a call from somewhere in the trees: `far` 0..1 (a far call is duller). */
  out(far) {
    const ctx = this.hub.ctx;
    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() * 2 - 1) * 0.85;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 8000 - far * 4500;
    filter.connect(pan).connect(this.hub.master);
    return filter;
  }

  /** One wood bird's song now: the wren and the chiffchaff most, then the pigeon, then the woodpecker's drum. */
  bird(t, volume) {
    const ctx = this.hub.ctx;
    const far = Math.random() * 0.8;
    const dest = this.out(far);
    const v = volume * (1 - far * 0.5);
    const r = Math.random();
    if (r < 0.35) wrenSong(ctx, dest, t, v * 0.5);
    else if (r < 0.65) chiffchaffSong(ctx, dest, t, v * 0.45);
    else if (r < 0.88) pigeonCoo(ctx, dest, t, v * 0.9);
    else woodpeckerDrum(ctx, dest, t, v * 0.8);
  }

  /** Moves the pond's panner to `at` ({ x, z }). */
  placePond(at, t) {
    const p = this.nodes.pondPan;
    const y = this.hub.listenerPosition?.y ?? 0;
    if (p.positionX) {
      p.positionX.setTargetAtTime(at.x, t, 0.1);
      p.positionY.setTargetAtTime(y, t, 0.1);
      p.positionZ.setTargetAtTime(at.z, t, 0.1);
    } else p.setPosition(at.x, y, at.z);
  }

  /**
   * A call due on its own clock: `every` is seconds on average (Infinity when it isn't due, which resets the clock so the first call after waits its turn).
   * Returns true when one is to be played now.
   */
  due(key, every, t) {
    if (every === Infinity) { this.next[key] = 0; return false; }
    if (t < this.next[key]) return false;
    const play = this.next[key] > 0;
    this.next[key] = t + every * (0.5 + Math.random());
    return play;
  }

  /** Plays `heard` (woodsHeard's) at `volume` (the `woodsVolume` param). Called every frame. */
  update(heard, volume) {
    const { hub } = this;
    if (!hub.ready || hub.paused) return;
    const t = hub.ctx.currentTime;
    if (!this.nodes) {
      if (!heard?.level) return; // nothing made until the wood is first heard
      this.build();
    }
    const n = this.nodes;
    const h = heard ?? { level: 0, canopy: 0, leaves: 0 };
    n.roar.gain.setTargetAtTime(volume * 1.4 * h.canopy, t, 0.8);
    n.rustle.gain.setTargetAtTime(volume * 0.6 * h.canopy, t, 0.8);
    n.leaves.gain.setTargetAtTime(volume * 1.2 * h.leaves, t, 0.15);
    if (h.pondAt) this.placePond(h.pondAt, t);
    if (this.due('bird', h.birdsEvery ?? Infinity, t)) this.bird(t, volume * h.birds);
    if (this.due('owl', h.owlEvery ?? Infinity, t)) owlCall(hub.ctx, this.out(0.4 + Math.random() * 0.5), t, volume * 0.9 * h.owl);
    if (this.due('drip', h.dripEvery ?? Infinity, t)) pondDrip(hub.ctx, n.pondPan, t, volume * 0.5 * h.pond);
    if (this.due('frog', h.frogsEvery ?? Infinity, t)) frogCroak(hub.ctx, n.pondPan, t, volume * 0.9 * h.pond);
  }
}
