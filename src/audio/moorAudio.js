// The Moor's birds, made on the spot (nothing recorded, #821): a curlew's long rising "cur-lee" and its bubbling trill, and a skylark's unbroken warble from high
// overhead. Each is a call through a stereo pan and a soft low-pass, placed at a random side of you. `MoorAudio` schedules them from `moorBed` (world/moorBed.js).

/** One curlew call at `t`: a rising whistle, then the bubbling trill that runs on and quickens. */
export function curlewCall(ctx, dest, t, volume) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(950, t);
  osc.frequency.exponentialRampToValueAtTime(1600, t + 0.55); // the "cur-lee": up and held
  osc.frequency.setValueAtTime(1350, t + 0.7);
  for (let i = 0; i < 22; i++) osc.frequency.setValueAtTime(1250 + (i % 2) * 380 + i * 8, t + 0.7 + i * (0.075 - i * 0.0013)); // the trill, quickening
  const end = t + 2.3;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(volume, t + 0.12);
  env.gain.setValueAtTime(volume, t + 0.6);
  env.gain.linearRampToValueAtTime(volume * 0.7, t + 0.75);
  env.gain.linearRampToValueAtTime(volume * 0.55, t + 1.9);
  env.gain.linearRampToValueAtTime(0.0001, end);
  osc.connect(env).connect(dest);
  osc.start(t);
  osc.stop(end + 0.05);
  return end;
}

/** One skylark song at `t`: a warble of quick jumps in a high band, `len` seconds, swelling and fading. */
export function larkSong(ctx, dest, t, volume, len = 4) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  let f = 3600;
  for (let s = 0; s < len; s += 0.045) {
    f = Math.min(5600, Math.max(2600, f + (Math.random() - 0.5) * 1500));
    osc.frequency.setValueAtTime(f, t + s);
  }
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(volume, t + 0.4);
  env.gain.setValueAtTime(volume, t + len - 0.8);
  env.gain.linearRampToValueAtTime(0.0001, t + len);
  osc.connect(env).connect(dest);
  osc.start(t);
  osc.stop(t + len + 0.05);
  return t + len;
}

export class MoorAudio {
  constructor(hub) {
    this.hub = hub;
    this.nextCurlew = 0;
    this.nextLark = 0;
  }

  /** The panned, softened output for a call from one side of you: `far` 0..1 (a far call is duller and quieter). */
  out(far) {
    const ctx = this.hub.ctx;
    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() * 2 - 1) * 0.9;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 7000 - far * 3500;
    filter.connect(pan).connect(this.hub.master);
    return filter;
  }

  /** Calls the birds due now: `bed` is `moorBed`'s, `volume` is the `moorVolume` param. Called every frame. */
  update(bed, volume) {
    const { hub } = this;
    if (!hub.ready || hub.paused) return;
    const t = hub.ctx.currentTime;
    if (bed.curlewEvery === Infinity) this.nextCurlew = 0;
    else if (t >= this.nextCurlew) {
      if (this.nextCurlew) { const far = 0.3 + Math.random() * 0.7; curlewCall(hub.ctx, this.out(far), t, volume * (1 - far * 0.6)); }
      this.nextCurlew = t + bed.curlewEvery * (0.6 + Math.random() * 0.8);
    }
    if (bed.larkEvery === Infinity) this.nextLark = 0;
    else if (t >= this.nextLark) {
      if (this.nextLark) larkSong(hub.ctx, this.out(0.6), t, volume * 0.6, 3 + Math.random() * 3);
      this.nextLark = t + bed.larkEvery * (0.6 + Math.random() * 0.8);
    }
  }
}
