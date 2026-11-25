// The farm's birds by day, made on the spot (nothing recorded, #124): a blackbird's low fluting phrase ending in a squeaky twitter, a robin's thin,
// wistful run of high notes, a wren's loud fast trill with a rattle in it, and a rook's harsh "kaah". Each is played from where the bird is
// through the wildlife's panner (`WildlifeAudio.out`), so it is placed and dulled with distance like the pheasant. world/farmBirds.js says
// who sings where and when.

/** A whistled note on `osc` and its envelope `env`: from `f0` to `f1` Hz over `len` s at `t`, rising to `vol` and back. */
function whistle(osc, env, t, len, f0, f1, vol) {
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + len);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, len * 0.3));
  env.gain.setValueAtTime(vol, t + len * 0.7);
  env.gain.exponentialRampToValueAtTime(0.0001, t + len);
}

/** A sine voice into `dest` from `t` to `end`: { osc, env } to write notes on. */
function voice(ctx, dest, t, end) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  osc.connect(env).connect(dest);
  osc.start(t);
  osc.stop(end + 0.05);
  return { osc, env };
}

/** A blackbird at `t`: four to seven low fluted notes that slide and warble, then a quick high twitter to end. About `len` s. */
export function blackbirdSong(ctx, dest, t, volume, len = 2.5, random = Math.random) {
  const { osc, env } = voice(ctx, dest, t, t + len);
  let s = 0;
  const notes = 4 + Math.floor(random() * 4);
  const flute = len * 0.7;
  for (let i = 0; i < notes; i++) {
    const n = (flute / notes) * (0.55 + random() * 0.3);
    const f = 1500 + random() * 1100;
    whistle(osc, env, t + s, n, f, f * (0.8 + random() * 0.45), volume * (0.7 + random() * 0.3));
    s += (flute / notes);
  }
  for (; s < len - 0.06; s += 0.07) whistle(osc, env, t + s, 0.05, 4000 + random() * 2200, 3200 + random() * 1800, volume * 0.35);
  return t + len;
}

/** A robin at `t`: a thin, high, liquid run of short notes, leaping about between 2.5 and 7 kHz with short pauses, `len` s. */
export function robinSong(ctx, dest, t, volume, len = 2, random = Math.random) {
  const { osc, env } = voice(ctx, dest, t, t + len);
  for (let s = 0; s < len - 0.08; ) {
    const n = 0.05 + random() * 0.12;
    const f = 2500 + random() * 4500;
    whistle(osc, env, t + s, n, f, Math.min(7000, f * (0.7 + random() * 0.6)), volume * (0.5 + random() * 0.5));
    s += n + (random() < 0.2 ? 0.12 : 0.015);
  }
  return t + len;
}

/** A wren at `t`: loud for its size, a fast run of high notes (about 14 a second) with a rattle of quicker ones in the middle, `len` s. */
export function wrenSong(ctx, dest, t, volume, len = 4, random = Math.random) {
  const { osc, env } = voice(ctx, dest, t, t + len);
  const rattle = [len * (0.35 + random() * 0.15), len * (0.6 + random() * 0.1)];
  for (let s = 0; s < len - 0.05; ) {
    const fast = s > rattle[0] && s < rattle[1];
    const n = fast ? 0.025 : 0.055;
    const f = fast ? 4200 + random() * 600 : 4500 + random() * 2800;
    whistle(osc, env, t + s, n, f, f * (fast ? 0.85 : 0.75 + random() * 0.4), volume * (fast ? 0.8 : 1));
    s += n + (fast ? 0.008 : 0.016);
  }
  return t + len;
}

/** A rook's caw at `t`: a hoarse falling "kaah", a buzzing sawtooth through two throat formants with breath in it; `double` for a second one after. */
export function rookCaw(ctx, dest, t, volume, noise, double = false, random = Math.random) {
  const one = (at, len, f) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f, at);
    osc.frequency.linearRampToValueAtTime(f * 1.08, at + len * 0.25);
    osc.frequency.exponentialRampToValueAtTime(f * 0.78, at + len);
    const breath = ctx.createBufferSource();
    breath.buffer = noise;
    breath.loop = true;
    const breathGain = ctx.createGain();
    breathGain.gain.value = 0.35;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(volume, at + 0.03);
    env.gain.setValueAtTime(volume * 0.8, at + len * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, at + len);
    for (const [freq, q, g] of [[1150, 4, 1], [1900, 5, 0.6]]) {
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = freq * (0.92 + random() * 0.16);
      band.Q.value = q;
      const share = ctx.createGain();
      share.gain.value = g;
      osc.connect(band);
      breath.connect(breathGain).connect(band);
      band.connect(share).connect(env);
    }
    env.connect(dest);
    osc.start(at);
    breath.start(at);
    osc.stop(at + len + 0.05);
    breath.stop(at + len + 0.05);
  };
  const f = 330 + random() * 120;
  const len = 0.32 + random() * 0.18;
  one(t, len, f);
  if (double) one(t + len + 0.12 + random() * 0.1, len * 0.85, f * 0.95);
  return t + len;
}

const SONGS = { blackbird: [blackbirdSong, 0.55], robin: [robinSong, 0.4], wren: [wrenSong, 0.6] };

export class FarmBirdsAudio {
  /** `wildlife` is the game's WildlifeAudio, whose panner and noise these share; `params` the farm birds' (read live for `volume`). */
  constructor(wildlife, params) {
    this.wildlife = wildlife;
    this.p = params;
  }

  /** Plays one event from `FarmBirds.update`, from `y` metres up for a song in a hedge (a rook flock has its own height). */
  play(e, groundAt) {
    const vol = this.p.volume;
    if (vol <= 0) return;
    if (e.kind === 'song') {
      const [song, gain] = SONGS[e.species] ?? [];
      if (!song) return;
      const o = this.wildlife.out(e.x, groundAt(e.x, e.z) + 2.5, e.z, gain * vol);
      if (o) song(o.ctx, o.node, o.ctx.currentTime + 0.02, 1, e.len);
    } else if (e.kind === 'flock') {
      for (const c of e.caws) {
        const o = this.wildlife.out(c.x, groundAt(c.x, c.z) + e.height, c.z, 0.7 * vol);
        if (o) rookCaw(o.ctx, o.node, o.ctx.currentTime + c.at, 1, this.wildlife.noiseBuffer(o.ctx), c.double);
      }
    }
  }
}
